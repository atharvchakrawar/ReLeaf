import json
import uuid
from db import get_db
import rules
import clock


def calc_plan_b(shelters, chosen_shelter_id, item_type, kind, b_lat, b_lng, eta_pickup):
    for s in shelters:
        if s["id"] == chosen_shelter_id or not bool(s["is_open"]):
            continue
        ok_comp, _ = rules.check_shelter_compatibility(s, item_type, kind)
        if not ok_comp:
            continue
        d_km = rules.calc_distance_km(b_lat, b_lng, s["lat"], s["lng"])
        eta_s = max(4, int(d_km * 3.0) + 3)
        return {
            "shelter_id": s["id"],
            "shelter_name": s["name"],
            "eta_minutes": eta_pickup + eta_s,
        }
    return None


def find_standby_rider(riders, chosen_rider_id):
    for r in riders:
        if r["id"] != chosen_rider_id and int(r["is_killed"]) == 0 and r["status"] == "idle":
            return r["id"], r["name"]
    return None, None


def score_plan(safe_margin: float, safe_left: float, eta: int, qty: int, capacity: int, rel: float) -> float:
    time_factor = min(1.0, safe_margin / max(1.0, safe_left))
    eta_factor = 1.0 / (1.0 + eta / 25.0)
    fit_factor = qty / max(1, capacity)
    score = 0.35 * time_factor + 0.25 * eta_factor + 0.20 * fit_factor + 0.20 * rel
    return round(score, 2)


def make_plan_explanation(rider_name, dist_r, rel, shelter_name, qty, dist_s):
    rel_pct = int(rel * 100)
    return (
        f"{rider_name} is {dist_r:.1f} km away with {rel_pct}% reliability. "
        f"{shelter_name} has capacity for {qty} and is {dist_s:.1f} km from donor."
    )


def build_plan_for_pair(b, r, s, cur_time, shelters, all_riders):
    # Calculate quantities and travel times
    demand = json.loads(s["demand_json"] or "{}")
    needed = demand.get(b["item_type"], 0)
    if needed <= 0:
        return None
    qty = min(int(b["remaining_qty"]), int(r["capacity"]), needed)
    if qty <= 0:
        return None

    dist_r = rules.calc_distance_km(r["lat"], r["lng"], b["lat"], b["lng"])
    dist_s = rules.calc_distance_km(b["lat"], b["lng"], s["lat"], s["lng"])
    eta_p = max(3, int(dist_r * 3.0) + 2)
    eta_s = max(4, int(dist_s * 3.0) + 3)
    eta_total = eta_p + eta_s

    safe_left = rules.check_spoilage_safe(eta_total, b["safe_minutes_left"])
    if not safe_left[0]:
        return None

    safe_margin = max(0.0, b["safe_minutes_left"] - eta_total)
    sc = score_plan(safe_margin, b["safe_minutes_left"], eta_total, qty, r["capacity"], r["reliability"])
    plan_b = calc_plan_b(shelters, s["id"], b["item_type"], b["kind"], b["lat"], b["lng"], eta_p)
    sb_id, sb_name = find_standby_rider(all_riders, r["id"])

    return {
        "plan_id": f"p{uuid.uuid4().hex[:6]}",
        "rider_id": r["id"],
        "rider_name": r["name"],
        "shelter_id": s["id"],
        "shelter_name": s["name"],
        "qty": qty,
        "eta_minutes": eta_total,
        "safe_margin_minutes": int(safe_margin),
        "score": sc,
        "explanation": make_plan_explanation(r["name"], dist_r, r["reliability"], s["name"], qty, dist_s),
        "plan_b": plan_b,
        "confidence": round(r["reliability"] * 0.9, 2),
        "standby_rider_id": sb_id,
        "standby_rider_name": sb_name,
    }


def suggest_plans_for_batch(batch_id: str):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM batches WHERE id = ?", (batch_id,))
    b = cur.fetchone()
    if not b:
        conn.close()
        return {"error": "Batch not found"}

    cur_time = clock.get_current_sim_time()
    # Compute current safe minutes left
    created = clock.datetime.fromisoformat(b["created_at"])
    elapsed = (cur_time - created).total_seconds() / 60.0
    b_safe = max(0.0, b["expiry_minutes"] - elapsed)
    b_dict = dict(b)
    b_dict["safe_minutes_left"] = b_safe

    cur.execute("SELECT * FROM shelters WHERE kind = 'shelter'")
    shelters = cur.fetchall()
    cur.execute("SELECT * FROM riders")
    riders = cur.fetchall()
    conn.close()

    plans = []
    blocked = []

    for r in riders:
        ok_rider, r_reason = rules.check_rider_eligibility(r)
        if not ok_rider:
            blocked.append({
                "rider_id": r["id"],
                "rider_name": r["name"],
                "reason": r_reason,
                "unlock_hint": "Improve reliability score or wait until current delivery completes",
            })
            continue

        for s in shelters:
            ok_comp, _ = rules.check_shelter_compatibility(s, b["item_type"], b["kind"])
            if not ok_comp:
                continue
            plan = build_plan_for_pair(b_dict, r, s, cur_time, shelters, riders)
            if plan:
                plans.append(plan)

    plans.sort(key=lambda p: p["score"], reverse=True)
    return {"plans": plans, "blocked": blocked}
