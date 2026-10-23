import json
import uuid
from datetime import datetime
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from db import init_db, get_db, log_event
import clock
import seed
import planner

app = FastAPI(title="ReLeaf Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.on_event("startup")
def on_startup():
    init_db()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT count(*) as count FROM shelters")
    if cur.fetchone()["count"] == 0:
        seed.reset_and_seed()
    conn.close()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.post("/demo/reset")
@app.post("/control/reset")
def reset_demo():
    return seed.reset_and_seed()


# Clock Endpoints
@app.get("/clock")
def get_clock():
    return clock.get_clock_state()


@app.post("/clock/advance")
async def advance_clock_endpoint(request: Request):
    data = await request.json()
    minutes = data.get("minutes", 1)
    return clock.advance_clock(float(minutes))


@app.post("/clock/reset")
def reset_clock_endpoint():
    return clock.reset_clock()


@app.post("/clock/speed")
async def set_speed_endpoint(request: Request):
    data = await request.json()
    speed = data.get("speed", 1)
    return clock.set_clock_speed(int(speed))


# Batch Helpers
def calc_batch_safe_time(batch_row, cur_time):
    created = datetime.fromisoformat(batch_row["created_at"])
    elapsed_minutes = (cur_time - created).total_seconds() / 60.0
    safe_left = max(0.0, batch_row["expiry_minutes"] - elapsed_minutes)
    return safe_left


def serialize_batch(b, cur_time):
    safe_left = calc_batch_safe_time(b, cur_time)
    return {
        "id": b["id"],
        "donor_name": b["donor_name"],
        "item_type": b["item_type"],
        "total_qty": b["total_qty"],
        "remaining_qty": b["remaining_qty"],
        "expiry_minutes": b["expiry_minutes"],
        "safe_minutes_left": round(safe_left, 1),
        "status": b["status"],
        "location": {"lat": b["lat"], "lng": b["lng"]},
        "created_at": b["created_at"],
        "temperature_c": b["temperature_c"],
    }


# Batch Endpoints
@app.get("/batches")
def list_batches():
    conn = get_db()
    cur = conn.cursor()
    cur_time = clock.get_current_sim_time()
    cur.execute("SELECT * FROM batches ORDER BY created_at DESC")
    rows = cur.fetchall()
    result = [serialize_batch(r, cur_time) for r in rows]
    conn.close()
    return result


@app.post("/batches")
async def create_batch(request: Request):
    data = await request.json()
    conn = get_db()
    cur = conn.cursor()
    bid = f"b{uuid.uuid4().hex[:6]}"
    cur_time = clock.get_current_sim_time().isoformat()
    qty = data.get("quantity", 0)
    exp = data.get("expiry_minutes", 60)
    cur.execute("""
    INSERT INTO batches (id, donor_name, item_type, total_qty, remaining_qty, expiry_minutes, safe_minutes_left, status, lat, lng, created_at, temperature_c)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, 25.0)
    """, (bid, data.get("donor_name", "Anonymous"), data.get("item_type", "Food"), qty, qty, exp, float(exp), data.get("lat", 18.52), data.get("lng", 73.85), cur_time))
    conn.commit()
    cur.execute("SELECT * FROM batches WHERE id = ?", (bid,))
    created_row = cur.fetchone()
    conn.close()
    return serialize_batch(created_row, clock.get_current_sim_time())


@app.get("/batches/{batch_id}")
def get_batch(batch_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM batches WHERE id = ?", (batch_id,))
    row = cur.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Batch not found")
    return serialize_batch(row, clock.get_current_sim_time())


@app.post("/suggest")
async def suggest_plans_route(request: Request):
    data = await request.json()
    batch_id = data.get("batch_id")
    if not batch_id:
        raise HTTPException(status_code=400, detail="batch_id is required")
    res = planner.suggest_plans_for_batch(batch_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


@app.post("/batches/{batch_id}/suggest")
def suggest_plans_batch_route(batch_id: str):
    res = planner.suggest_plans_for_batch(batch_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


# Shelter Helpers
def get_shelter_deliveries(cur, shelter_id):
    cur.execute("""
    SELECT a.*, r.name as rider_name 
    FROM assignments a
    LEFT JOIN riders r ON a.rider_id = r.id
    WHERE a.shelter_id = ? AND a.status IN ('pending', 'picked_up', 'rerouted')
    """, (shelter_id,))
    deliveries = []
    for r in cur.fetchall():
        deliveries.append({
            "assignment_id": r["assignment_id"],
            "item_type": r["item_type"],
            "qty": r["qty"],
            "rider_name": r["rider_name"] or "Unknown",
            "eta_minutes": r["eta_minutes"],
            "status": r["status"],
            "confirm_code": r["confirm_code"],
        })
    return deliveries


def serialize_shelter(s, deliveries):
    demand = json.loads(s["demand_json"] or "{}")
    incoming = {}
    for d in deliveries:
        itype = d["item_type"]
        incoming[itype] = incoming.get(itype, 0) + d["qty"]
    free_space = {}
    for itype, needed in demand.items():
        free_space[itype] = max(0, needed - incoming.get(itype, 0))
    return {
        "id": s["id"],
        "name": s["name"],
        "is_open": bool(s["is_open"]),
        "has_clean_water": bool(s["has_clean_water"]),
        "has_cooking_fuel": bool(s["has_cooking_fuel"]),
        "location": {"lat": s["lat"], "lng": s["lng"]},
        "demand": demand,
        "incoming": incoming,
        "free_space": free_space,
        "incoming_deliveries": deliveries,
    }


# Shelter Endpoints
@app.get("/shelters")
def list_shelters():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shelters WHERE kind = 'shelter'")
    rows = cur.fetchall()
    result = []
    for s in rows:
        deliveries = get_shelter_deliveries(cur, s["id"])
        result.append(serialize_shelter(s, deliveries))
    conn.close()
    return result


@app.patch("/shelters/{shelter_id}")
async def update_shelter(shelter_id: str, request: Request):
    data = await request.json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shelters WHERE id = ?", (shelter_id,))
    s = cur.fetchone()
    if not s:
        conn.close()
        raise HTTPException(status_code=404, detail="Shelter not found")
    is_open = int(data.get("is_open", s["is_open"]))
    water = int(data.get("has_clean_water", s["has_clean_water"]))
    fuel = int(data.get("has_cooking_fuel", s["has_cooking_fuel"]))
    cur.execute("""
    UPDATE shelters SET is_open = ?, has_clean_water = ?, has_cooking_fuel = ?
    WHERE id = ?
    """, (is_open, water, fuel, shelter_id))
    conn.commit()
    cur.execute("SELECT * FROM shelters WHERE id = ?", (shelter_id,))
    updated_s = cur.fetchone()
    deliveries = get_shelter_deliveries(cur, shelter_id)
    conn.close()
    return serialize_shelter(updated_s, deliveries)


@app.post("/shelters/{shelter_id}/reduce_demand")
async def reduce_shelter_demand(shelter_id: str, request: Request):
    data = await request.json()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM shelters WHERE id = ?", (shelter_id,))
    s = cur.fetchone()
    if not s:
        conn.close()
        raise HTTPException(status_code=404, detail="Shelter not found")
    demand = json.loads(s["demand_json"] or "{}")
    itype = data.get("item_type", "")
    amt = data.get("amount", 0)
    if itype in demand:
        demand[itype] = max(0, demand[itype] - amt)
    cur.execute("UPDATE shelters SET demand_json = ? WHERE id = ?", (json.dumps(demand), shelter_id))
    conn.commit()
    cur.execute("SELECT * FROM shelters WHERE id = ?", (shelter_id,))
    updated_s = cur.fetchone()
    deliveries = get_shelter_deliveries(cur, shelter_id)
    conn.close()
    return serialize_shelter(updated_s, deliveries)


# Rider Endpoints
@app.get("/riders")
def list_riders():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM riders")
    rows = cur.fetchall()
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "name": r["name"],
            "status": r["status"],
            "trust_score": r["trust_score"],
            "reliability": r["reliability"],
            "location": {"lat": r["lat"], "lng": r["lng"]},
            "last_heartbeat": r["last_heartbeat"],
            "active_assignment_id": r["active_assignment_id"],
        })
    conn.close()
    return result


@app.get("/riders/{rider_id}/jobs")
def get_rider_jobs(rider_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT a.*, b.lat as b_lat, b.lng as b_lng, b.expiry_minutes, b.created_at as b_created_at,
           s.name as shelter_name, s.lat as s_lat, s.lng as s_lng
    FROM assignments a
    JOIN batches b ON a.batch_id = b.id
    JOIN shelters s ON a.shelter_id = s.id
    WHERE a.rider_id = ? AND a.status IN ('pending', 'picked_up', 'rerouted')
    """, (rider_id,))
    rows = cur.fetchall()
    cur_time = clock.get_current_sim_time()
    jobs = []
    for r in rows:
        safe_left = calc_batch_safe_time({"created_at": r["b_created_at"], "expiry_minutes": r["expiry_minutes"]}, cur_time)
        plan_b = None
        if r["plan_b_shelter_id"]:
            plan_b = {
                "shelter_id": r["plan_b_shelter_id"],
                "shelter_name": r["plan_b_shelter_name"],
                "eta_minutes": r["plan_b_eta_minutes"],
            }
        jobs.append({
            "assignment_id": r["assignment_id"],
            "batch_id": r["batch_id"],
            "item_type": r["item_type"],
            "qty": r["qty"],
            "stage": r["stage"],
            "pickup_location": {"lat": r["b_lat"], "lng": r["b_lng"]},
            "shelter_location": {"lat": r["s_lat"], "lng": r["s_lng"]},
            "shelter_name": r["shelter_name"],
            "eta_minutes": r["eta_minutes"],
            "safe_minutes_left": round(safe_left, 1),
            "status": r["status"],
            "confirm_code": r["confirm_code"],
            "plan_b": plan_b,
            "confidence": r["confidence"],
            "standby_rider_name": r["standby_rider_name"],
            "explanation": r["explanation"] or r["why"],
        })
    conn.close()
    return jobs


@app.post("/riders/{rider_id}/heartbeat")
def rider_heartbeat(rider_id: str):
    conn = get_db()
    cur = conn.cursor()
    now_str = clock.get_current_sim_time().isoformat()
    cur.execute("SELECT * FROM riders WHERE id = ?", (rider_id,))
    r = cur.fetchone()
    if not r:
        conn.close()
        raise HTTPException(status_code=404, detail="Rider not found")
    new_status = r["status"]
    if r["status"] == "unresponsive":
        new_status = "idle" if not r["active_assignment_id"] else "en_route"
    cur.execute("UPDATE riders SET last_heartbeat = ?, status = ? WHERE id = ?", (now_str, new_status, rider_id))
    conn.commit()
    conn.close()
    return {"last_heartbeat": now_str}
