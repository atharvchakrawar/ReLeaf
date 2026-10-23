import json
from datetime import datetime
from db import get_db, init_db, log_event


def seed_shelters(cur):
    shelters_data = [
        ("s1", "Hope House", 1, 1, 0, 18.530, 73.860, {"Cooked Meals": 50, "Bread": 20}, "shelter"),
        ("s2", "City Shelter", 1, 0, 1, 18.528, 73.858, {"Rice": 40, "Cooked Meals": 40}, "shelter"),
        ("s3", "Peace Haven", 1, 1, 1, 18.535, 73.865, {"Cooked Meals": 60, "Vegetables": 40, "Bread": 30}, "shelter"),
        ("s4", "Metro Relief Center", 1, 1, 1, 18.512, 73.845, {"Raw Ration": 50, "Cooked Meals": 30}, "shelter"),
        ("sink_fridge", "Community Fridge Central", 1, 1, 1, 18.522, 73.852, {"Cooked Meals": 100, "Bread": 100}, "community_fridge"),
        ("sink_animal", "City Animal Shelter Feed", 1, 1, 1, 18.540, 73.870, {"Cooked Meals": 150, "Vegetables": 100}, "animal_feed"),
        ("sink_compost", "Eco Compost Yard", 1, 1, 1, 18.505, 73.835, {"Vegetables": 200, "Cooked Meals": 200}, "compost"),
    ]
    for s in shelters_data:
        cur.execute("""
        INSERT INTO shelters (id, name, is_open, has_clean_water, has_cooking_fuel, lat, lng, demand_json, incoming_json, kind)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', ?)
        """, (s[0], s[1], s[2], s[3], s[4], s[5], s[6], json.dumps(s[7]), s[8]))


def seed_riders(cur, now_str):
    riders_data = [
        ("r1", "Amit Kumar", 30, 0.92, 0.95, 1, 18.521, 73.851),
        ("r2", "Raj Patel", 40, 0.65, 0.70, 0, 18.519, 73.849),
        ("r3", "Priya Singh", 25, 0.88, 0.90, 0, 18.523, 73.853),
        ("r4", "Vikram Rao", 15, 0.75, 0.80, 0, 18.515, 73.842),
    ]
    for r in riders_data:
        cur.execute("""
        INSERT INTO riders (id, name, capacity, trust_score, reliability, has_insulated_bag, lat, lng, last_heartbeat, status, is_killed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'idle', 0)
        """, (r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], now_str))


def seed_batches(cur, now_str):
    batches_data = [
        ("b1", "Grand Banquet Hall", "Cooked Meals", 120, 75, 18.520, 73.850, "cooked_food"),
        ("b2", "Green Kitchen", "Cooked Meals", 30, 90, 18.522, 73.852, "cooked_food"),
        ("b3", "Sunrise Bakery", "Bread", 50, 180, 18.515, 73.848, "food"),
        ("b4", "City Pharmacy Aid", "Medical Kits", 20, 240, 18.527, 73.857, "medical"),
        ("b5", "Food Bank Warehouse", "Raw Ration", 60, 360, 18.510, 73.840, "ration"),
    ]
    for b in batches_data:
        cur.execute("""
        INSERT INTO batches (id, donor_name, item_type, total_qty, remaining_qty, expiry_minutes, safe_minutes_left, status, lat, lng, created_at, kind)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, ?)
        """, (b[0], b[1], b[2], b[3], b[3], b[4], float(b[4]), b[5], b[6], now_str, b[7]))


def reset_and_seed():
    init_db()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM assignments")
    cur.execute("DELETE FROM events")
    cur.execute("DELETE FROM batches")
    cur.execute("DELETE FROM shelters")
    cur.execute("DELETE FROM riders")

    now_str = "2026-10-23T12:00:00"
    cur.execute("""
    UPDATE sim_state 
    SET sim_time = ?, speed = 1, real_elapsed_seconds = 0,
        temperature_c = 25.0, shelf_life_factor = 1.0,
        chaos_injected = 0, chaos_recovered = 0, chaos_salvaged = 0, chaos_failed = 0
    WHERE id = 1
    """, (now_str,))

    seed_shelters(cur)
    seed_riders(cur, now_str)
    seed_batches(cur, now_str)

    conn.commit()
    conn.close()

    log_event("reset", "Simulation reset and seeded with initial demo data", "info", now_str)
    return {"status": "ok"}
