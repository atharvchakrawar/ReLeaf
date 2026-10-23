import threading
import time
from datetime import datetime, timedelta
from db import get_db, log_event
import assignments


def update_clock_tick(cur, speed):
    cur.execute("SELECT sim_time, real_elapsed_seconds FROM sim_state WHERE id = 1")
    row = cur.fetchone()
    cur_sim = datetime.fromisoformat(row["sim_time"])
    sim_delta_seconds = float(speed)
    new_sim = cur_sim + timedelta(seconds=sim_delta_seconds)
    new_real = int(row["real_elapsed_seconds"]) + 1
    cur.execute("""
    UPDATE sim_state 
    SET sim_time = ?, real_elapsed_seconds = ?
    WHERE id = 1
    """, (new_sim.isoformat(), new_real))
    return new_sim, sim_delta_seconds / 60.0


def heartbeat_active_riders(cur, now_str):
    cur.execute("SELECT id FROM riders WHERE is_killed = 0")
    for r in cur.fetchall():
        cur.execute("UPDATE riders SET last_heartbeat = ? WHERE id = ?", (now_str, r["id"]))


def check_unresponsive_riders(cur, now_dt):
    cur.execute("SELECT id, name, status, last_heartbeat FROM riders WHERE is_killed = 1 AND status != 'unresponsive'")
    for r in cur.fetchall():
        if not r["last_heartbeat"]:
            continue
        lh = datetime.fromisoformat(r["last_heartbeat"])
        if (now_dt - lh).total_seconds() >= 120:
            cur.execute("UPDATE riders SET status = 'unresponsive' WHERE id = ?", (r["id"],))
            log_event("heartbeat_lost", f"Rider {r['name']} heartbeat lost — marked unresponsive", "error", now_dt.isoformat(), cur=cur)


def handle_lease_expiry_and_standby(cur, now_dt):
    # Rule 13: standby rider instant swap on lease expiry
    cur.execute("SELECT * FROM assignments WHERE status = 'pending' AND lease_expiry IS NOT NULL")
    for a in cur.fetchall():
        exp = datetime.fromisoformat(a["lease_expiry"])
        if now_dt >= exp:
            sb_id = a["standby_rider_id"]
            swapped = False
            if sb_id:
                cur.execute("SELECT * FROM riders WHERE id = ? AND status = 'idle' AND is_killed = 0", (sb_id,))
                sb = cur.fetchone()
                if sb:
                    cur.execute("UPDATE riders SET active_assignment_id = NULL, status = 'unresponsive' WHERE id = ?", (a["rider_id"],))
                    new_lease = (now_dt + timedelta(minutes=15.0 * float(sb["reliability"]))).isoformat()
                    cur.execute("""
                    UPDATE assignments 
                    SET rider_id = ?, standby_rider_id = NULL, standby_rider_name = NULL,
                        lease_expiry = ?, explanation = ?
                    WHERE assignment_id = ?
                    """, (sb["id"], new_lease, f"Standby rider {sb['name']} automatically swapped in after primary missed lease", a["assignment_id"]))
                    cur.execute("UPDATE riders SET status = 'en_route', active_assignment_id = ? WHERE id = ?", (a["assignment_id"], sb["id"]))
                    log_event("assigned", f"Standby rider {sb['name']} swapped in for assignment {a['assignment_id']}", "warning", now_dt.isoformat(), cur=cur)
                    swapped = True

            if not swapped:
                cur.execute("UPDATE assignments SET status = 'failed' WHERE assignment_id = ?", (a["assignment_id"],))
                cur.execute("UPDATE batches SET remaining_qty = remaining_qty + ?, status = 'available' WHERE id = ?", (a["qty"], a["batch_id"]))
                cur.execute("UPDATE riders SET active_assignment_id = NULL, status = 'idle' WHERE id = ? AND is_killed = 0", (a["rider_id"],))
                assignments.update_shelter_incoming(cur, a["shelter_id"], a["item_type"], -a["qty"])
                log_event("released", f"Lease expired for {a['assignment_id']} — released reservation", "warning", now_dt.isoformat(), cur=cur)


def countdown_eta_minutes(cur, delta_mins):
    cur.execute("SELECT assignment_id, eta_minutes FROM assignments WHERE status IN ('pending', 'picked_up', 'rerouted')")
    for a in cur.fetchall():
        new_eta = max(0.0, a["eta_minutes"] - delta_mins)
        cur.execute("UPDATE assignments SET eta_minutes = ? WHERE assignment_id = ?", (round(new_eta, 1), a["assignment_id"]))


def check_batch_expiries(cur, now_dt):
    # Rule 8: Batch expiry handling
    cur.execute("SELECT id, created_at, expiry_minutes, remaining_qty FROM batches WHERE status = 'available'")
    for b in cur.fetchall():
        created = datetime.fromisoformat(b["created_at"])
        elapsed = (now_dt - created).total_seconds() / 60.0
        if elapsed >= b["expiry_minutes"]:
            cur.execute("UPDATE batches SET status = 'expired', remaining_qty = 0 WHERE id = ?", (b["id"],))
            log_event("failed", f"Batch {b['id']} expired before complete pickup — marked spoiled", "error", now_dt.isoformat(), cur=cur)


def redispatch_freed_batches():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id FROM batches WHERE status = 'available' AND remaining_qty > 0")
    batches = cur.fetchall()
    conn.close()
    for b in batches:
        conn2 = get_db()
        cur2 = conn2.cursor()
        cur2.execute("SELECT count(*) as idle_cnt FROM riders WHERE status = 'idle' AND is_killed = 0 AND trust_score >= 0.70")
        has_idle = cur2.fetchone()["idle_cnt"] > 0
        conn2.close()
        if has_idle:
            assignments.auto_dispatch_batch(b["id"])


def run_tick():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT speed FROM sim_state WHERE id = 1")
    row = cur.fetchone()
    speed = row["speed"] if row else 1

    now_dt, delta_mins = update_clock_tick(cur, speed)
    now_str = now_dt.isoformat()

    heartbeat_active_riders(cur, now_str)
    check_unresponsive_riders(cur, now_dt)
    handle_lease_expiry_and_standby(cur, now_dt)
    check_batch_expiries(cur, now_dt)
    countdown_eta_minutes(cur, delta_mins)
    assignments.check_and_reroute_assignments(cur)

    conn.commit()
    conn.close()

    redispatch_freed_batches()


def recovery_loop():
    while True:
        try:
            run_tick()
        except Exception:
            pass
        time.sleep(1.0)


def start_recovery_thread():
    t = threading.Thread(target=recovery_loop, daemon=True)
    t.start()
