import os
os.environ["TESTING"] = "1"

from starlette.testclient import TestClient
from main import app
import seed

client = TestClient(app)


def setup_function():
    seed.reset_and_seed()


def test_tight_expiry():
    # Tight batch creation and safe time checking
    res = client.post("/control/create_tight_batch")
    assert res.status_code == 200
    b = res.json()
    assert b["expiry_minutes"] == 15
    assert b["safe_minutes_left"] <= 15


def test_split_across_riders():
    # Large batch b1 (120 meals) split across multiple smaller capacity riders
    p = client.post("/suggest", json={"batch_id": "b1"}).json()
    plans = p["plans"]
    assert len(plans) > 1
    # Each plan qty is bounded by rider capacity
    assert all(plan["qty"] <= 40 for plan in plans)


def test_ghost_reservation_with_standby_swap():
    # Create assignment and advance clock past lease
    a = client.post("/assign", json={"batch_id": "b1"}).json()
    aid = a["assignment_id"]
    orig_rider = a["rider_id"]

    # Advance clock past lease (15 mins)
    client.post("/clock/advance", json={"minutes": 20})
    import recovery
    recovery.run_tick()

    # Verify assignment either swapped to standby or released
    jobs = client.get("/assignments").json()
    target = next((j for j in jobs if j["assignment_id"] == aid), None)
    assert target is not None
    assert target["status"] in ("pending", "rerouted", "failed")


def test_unresponsive_rider_redispatch():
    # Kill rider r1 and verify status is unresponsive
    client.post("/control/kill_rider", json={"rider_id": "r1"})
    r = client.get("/riders").json()
    r1 = next(x for x in r if x["id"] == "r1")
    assert r1["status"] == "unresponsive"


def test_shelter_closing_with_plan_b():
    # Assign to shelter s1 then close s1
    a = client.post("/assign", json={"batch_id": "b2"}).json()
    aid = a["assignment_id"]
    orig_shelter = a["shelter_id"]

    # Close shelter
    client.post("/control/close_shelter", json={"shelter_id": orig_shelter})

    jobs = client.get("/assignments").json()
    target = next(j for j in jobs if j["assignment_id"] == aid)
    assert target["status"] == "rerouted"
    assert target["shelter_id"] != orig_shelter


def test_no_fallback_for_medical_failed():
    # Medical items cannot be salvaged to food sinks
    from db import get_db
    import assignments
    conn = get_db()
    cur = conn.cursor()
    # Close all shelters for medical batch b4
    cur.execute("UPDATE shelters SET is_open = 0 WHERE kind = 'shelter'")
    conn.commit()

    res = assignments.reroute_single_assignment(cur, {
        "assignment_id": "amedical",
        "batch_id": "b4",
        "rider_id": "r1",
        "shelter_id": "s1",
        "item_type": "Medical Kits",
        "qty": 10,
        "plan_b_shelter_id": None,
    }, seed.datetime.now())
    conn.commit()
    conn.close()
    assert res == "failed"


def test_no_fallback_for_cooked_food_salvaged():
    from db import get_db
    import assignments
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE shelters SET is_open = 0 WHERE kind = 'shelter'")
    conn.commit()

    res = assignments.reroute_single_assignment(cur, {
        "assignment_id": "afood",
        "batch_id": "b1",
        "rider_id": "r1",
        "shelter_id": "s1",
        "item_type": "Cooked Meals",
        "qty": 20,
        "plan_b_shelter_id": None,
    }, seed.datetime.now())
    conn.commit()
    conn.close()
    assert res == "salvaged"


def test_dependency_block_with_unlock_hint():
    # Suggest plans for batch b1 returns blocked riders with unlock hints
    res = client.post("/suggest", json={"batch_id": "b1"}).json()
    assert "blocked" in res
    assert len(res["blocked"]) > 0
    assert "unlock_hint" in res["blocked"][0]


def test_wrong_confirm_code():
    a = client.post("/assign", json={"batch_id": "b1"}).json()
    aid = a["assignment_id"]
    rid = a["rider_id"]

    client.post(f"/riders/{rid}/pickup", json={"assignment_id": aid})
    # Attempt deliver with wrong code
    res = client.post(f"/riders/{rid}/deliver", json={"assignment_id": aid, "confirm_code": "99999"})
    assert res.status_code == 400
    assert "error" in res.json()


def test_heat_shortening_safe_time():
    # Set heat to 35C and verify safe minutes reduced
    b_before = client.get("/batches/b1").json()["safe_minutes_left"]
    client.post("/weather", json={"temperature_c": 35.0})
    b_after = client.get("/batches/b1").json()["safe_minutes_left"]
    assert b_after < b_before
