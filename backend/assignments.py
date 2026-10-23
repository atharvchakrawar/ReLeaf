import json
import random
import uuid
from datetime import datetime, timedelta
from db import get_db, log_event
import clock
import rules
import planner


def generate_confirm_code() -> str:
    return str(random.randint(1000, 9999))


def update_shelter_incoming(cur, shelter_id: str, item_type: str, delta: int):
    cur.execute("SELECT demand_json, incoming_json FROM shelters WHERE id = ?", (shelter_id,))
    s = cur.fetchone()
    if not s:
        return
    incoming = json.loads(s["incoming_json"] or "{}")
    incoming[item_type] = max(0, incoming.get(item_type, 0) + delta)
    cur.execute("UPDATE shelters SET incoming_json = ? WHERE id = ?", (json.dumps(incoming), shelter_id))


def update_shelter_demand(cur, shelter_id: str, item_type: str, delta: int):
    cur.execute("SELECT demand_json FROM shelters WHERE id = ?", (shelter_id,))
    s = cur.fetchone()
    if not s:
        return
    demand = json.loads(s["demand_json"] or "{}")
    demand[item_type] = max(0, demand.get(item_type, 0) + delta)
    cur.execute("UPDATE shelters SET demand_json = ? WHERE id = ?", (json.dumps(demand), shelter_id))


def serialize_assignment(row):
    plan_b = None
    if row["plan_b_shelter_id"]:
        plan_b = {
            "shelter_id": row["plan_b_shelter_id"],
            "shelter_name": row["plan_b_shelter_name"],
            "eta_minutes": row["plan_b_eta_minutes"],
        }
    return {
        "assignment_id": row["assignment_id"],
        "batch_id": row["batch_id"],
        "rider_id": row["rider_id"],
        "rider_name": row["rider_name"] if "rider_name" in row.keys() else "",
        "shelter_id": row["shelter_id"],
        "shelter_name": row["shelter_name"] if "shelter_name" in row.keys() else "",
        "item_type": row["item_type"],
        "qty": row["qty"],
        "status": row["status"],
        "confirm_code": row["confirm_code"],
        "plan_b": plan_b,
        "confidence": row["confidence"],
        "standby_rider_name": row["standby_rider_name"],
        "explanation": row["explanation"] or row["why"],
    }


def find_or_build_plan(batch_id: str, plan_id: str = None, rider_id: str = None, shelter_id: str = None):
    res = planner.suggest_plans_for_batch(batch_id)
    plans = res.get("plans", [])
    if plan_id:
        for p in plans:
            if p["plan_id"] == plan_id:
                return p
    if rider_id and shelter_id:
        for p in plans:
            if p["rider_id"] == rider_id and p["shelter_id"] == shelter_id:
                return p
    return plans[0] if plans else None


def create_assignment(batch_id: str, plan_id: str = None, rider_id: str = None, shelter_id: str = None):
    plan = find_or_build_plan(batch_id, plan_id, rider_id, shelter_id)
    if not plan:
        return None, "No viable delivery plan found for this batch"

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM batches WHERE id = ?", (batch_id,))
    b = cur.fetchone()
    cur.execute("SELECT * FROM riders WHERE id = ?", (plan["rider_id"],))
    r = cur.fetchone()
    cur.execute("SELECT * FROM shelters WHERE id = ?", (plan["shelter_id"],))
    s = cur.fetchone()

    if not b or b["remaining_qty"] <= 0:
        conn.close()
        return None, "Batch has no remaining quantity"
    if not r or r["status"] != "idle" or int(r["is_killed"]) == 1:
        conn.close()
        return None, "Rider is not available"

    aid = f"a{uuid.uuid4().hex[:6]}"
    code = generate_confirm_code()
    now_dt = clock.get_current_sim_time()
    lease_mins = 15.0 * float(r["reliability"])
    lease_expiry = (now_dt + timedelta(minutes=lease_mins)).isoformat()
    assign_qty = min(int(b["remaining_qty"]), int(plan["qty"]))

    plan_b = plan.get("plan_b") or {}
    cur.execute("""
    INSERT INTO assignments (
        assignment_id, batch_id, rider_id, shelter_id, item_type, qty, stage, status,
        confirm_code, plan_b_shelter_id, plan_b_shelter_name, plan_b_eta_minutes,
        confidence, standby_rider_id, standby_rider_name, explanation, why,
        lease_expiry, created_at, eta_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, 'to_pickup', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        aid, batch_id, r["id"], s["id"], b["item_type"], assign_qty,
        code, plan_b.get("shelter_id"), plan_b.get("shelter_name"), plan_b.get("eta_minutes", 0),
        plan["confidence"], plan["standby_rider_id"], plan["standby_rider_name"],
        plan["explanation"], plan["explanation"], lease_expiry, now_dt.isoformat(), plan["eta_minutes"]
    ))

    # Update batch remaining qty
    new_rem = b["remaining_qty"] - assign_qty
    b_status = "assigned" if new_rem == 0 else b["status"]
    cur.execute("UPDATE batches SET remaining_qty = ?, status = ? WHERE id = ?", (new_rem, b_status, batch_id))

    # Update rider status
    cur.execute("UPDATE riders SET status = 'en_route', active_assignment_id = ? WHERE id = ?", (aid, r["id"]))

    # Update shelter incoming
    update_shelter_incoming(cur, s["id"], b["item_type"], assign_qty)

    conn.commit()
    log_event("assigned", f"{r['name']} assigned {assign_qty} {b['item_type']} for {s['name']}", "info", now_dt.isoformat())

    cur.execute("""
    SELECT a.*, r.name as rider_name, s.name as shelter_name
    FROM assignments a
    JOIN riders r ON a.rider_id = r.id
    JOIN shelters s ON a.shelter_id = s.id
    WHERE a.assignment_id = ?
    """, (aid,))
    row = cur.fetchone()
    conn.close()
    return serialize_assignment(row), None


def pickup_assignment(rider_id: str, assignment_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT a.*, r.name as rider_name, s.name as shelter_name, b.lat as b_lat, b.lng as b_lng
    FROM assignments a
    JOIN riders r ON a.rider_id = r.id
    JOIN shelters s ON a.shelter_id = s.id
    JOIN batches b ON a.batch_id = b.id
    WHERE a.assignment_id = ? AND a.rider_id = ?
    """, (assignment_id, rider_id))
    a = cur.fetchone()
    if not a:
        conn.close()
        return False, "Assignment not found for rider"

    cur.execute("UPDATE assignments SET stage = 'to_shelter', status = 'picked_up' WHERE assignment_id = ?", (assignment_id,))
    cur.execute("UPDATE riders SET lat = ?, lng = ? WHERE id = ?", (a["b_lat"], a["b_lng"], rider_id))
    conn.commit()
    conn.close()

    log_event("picked_up", f"{a['rider_name']} picked up {a['qty']} {a['item_type']} for {a['shelter_name']}", "info")
    return True, ""


def deliver_assignment(rider_id: str, assignment_id: str, confirm_code: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT a.*, r.name as rider_name, s.name as shelter_name, s.lat as s_lat, s.lng as s_lng
    FROM assignments a
    JOIN riders r ON a.rider_id = r.id
    JOIN shelters s ON a.shelter_id = s.id
    WHERE a.assignment_id = ? AND a.rider_id = ?
    """, (assignment_id, rider_id))
    a = cur.fetchone()
    if not a:
        conn.close()
        return False, "Assignment not found for rider"

    if confirm_code and a["confirm_code"] and confirm_code.strip() != a["confirm_code"].strip():
        conn.close()
        return False, "Wrong confirmation code"

    cur.execute("UPDATE assignments SET status = 'delivered' WHERE assignment_id = ?", (assignment_id,))
    cur.execute("UPDATE riders SET status = 'idle', active_assignment_id = NULL, lat = ?, lng = ? WHERE id = ?", (a["s_lat"], a["s_lng"], rider_id))

    update_shelter_incoming(cur, a["shelter_id"], a["item_type"], -a["qty"])
    update_shelter_demand(cur, a["shelter_id"], a["item_type"], -a["qty"])

    # Check if all assignments for this batch are delivered and remaining is 0
    cur.execute("SELECT remaining_qty FROM batches WHERE id = ?", (a["batch_id"],))
    b = cur.fetchone()
    if b and b["remaining_qty"] == 0:
        cur.execute("SELECT count(*) as active_cnt FROM assignments WHERE batch_id = ? AND status IN ('pending', 'picked_up', 'rerouted')", (a["batch_id"],))
        if cur.fetchone()["active_cnt"] == 0:
            cur.execute("UPDATE batches SET status = 'delivered' WHERE id = ?", (a["batch_id"],))

    conn.commit()
    conn.close()

    log_event("delivered", f"{a['rider_name']} delivered {a['qty']} {a['item_type']} to {a['shelter_name']}", "info")
    return True, ""


def cancel_assignment(rider_id: str, assignment_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT a.*, r.name as rider_name
    FROM assignments a
    JOIN riders r ON a.rider_id = r.id
    WHERE a.assignment_id = ? AND a.rider_id = ?
    """, (assignment_id, rider_id))
    a = cur.fetchone()
    if not a:
        conn.close()
        return False, "Assignment not found for rider"

    cur.execute("UPDATE assignments SET status = 'cancelled' WHERE assignment_id = ?", (assignment_id,))
    cur.execute("UPDATE riders SET status = 'idle', active_assignment_id = NULL WHERE id = ?", (rider_id,))

    # If cancelled before pickup, return quantity to batch
    if a["stage"] == "to_pickup":
        cur.execute("UPDATE batches SET remaining_qty = remaining_qty + ?, status = 'available' WHERE id = ?", (a["qty"], a["batch_id"]))

    update_shelter_incoming(cur, a["shelter_id"], a["item_type"], -a["qty"])
    conn.commit()
    conn.close()

    log_event("released", f"Assignment {assignment_id} cancelled by rider {a['rider_name']}", "warning")
    return True, ""


def auto_dispatch_batch(batch_id: str):
    plan = find_or_build_plan(batch_id)
    if not plan:
        return None, "No viable delivery plan found for this batch"
    return create_assignment(batch_id, plan_id=plan["plan_id"])


def list_all_assignments():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
    SELECT a.*, r.name as rider_name, s.name as shelter_name
    FROM assignments a
    LEFT JOIN riders r ON a.rider_id = r.id
    LEFT JOIN shelters s ON a.shelter_id = s.id
    ORDER BY a.created_at DESC
    """)
    rows = cur.fetchall()
    result = [serialize_assignment(r) for r in rows]
    conn.close()
    return result
