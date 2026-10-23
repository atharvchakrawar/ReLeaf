from datetime import datetime, timedelta
from db import get_db


def get_clock_state():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT sim_time, speed, real_elapsed_seconds FROM sim_state WHERE id = 1")
    row = cur.fetchone()
    conn.close()
    if not row:
        return {"sim_time": datetime.now().isoformat(), "speed": 1, "real_elapsed_seconds": 0}
    return {
        "sim_time": row["sim_time"],
        "speed": row["speed"],
        "real_elapsed_seconds": row["real_elapsed_seconds"],
    }


def advance_clock(minutes: float):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT sim_time FROM sim_state WHERE id = 1")
    row = cur.fetchone()
    current_time = datetime.fromisoformat(row["sim_time"])
    new_time = current_time + timedelta(minutes=minutes)
    new_str = new_time.isoformat()
    cur.execute("UPDATE sim_state SET sim_time = ? WHERE id = 1", (new_str,))
    conn.commit()
    conn.close()
    return {"sim_time": new_str}


def reset_clock():
    conn = get_db()
    cur = conn.cursor()
    default_time = "2026-10-23T00:00:00"
    cur.execute("""
    UPDATE sim_state 
    SET sim_time = ?, speed = 1, real_elapsed_seconds = 0
    WHERE id = 1
    """, (default_time,))
    conn.commit()
    conn.close()
    return {"sim_time": default_time, "speed": 1}


def set_clock_speed(speed: int):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE sim_state SET speed = ? WHERE id = 1", (speed,))
    cur.execute("SELECT sim_time FROM sim_state WHERE id = 1")
    row = cur.fetchone()
    conn.commit()
    conn.close()
    return {"sim_time": row["sim_time"], "speed": speed}


def get_current_sim_time():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT sim_time FROM sim_state WHERE id = 1")
    row = cur.fetchone()
    conn.close()
    return datetime.fromisoformat(row["sim_time"]) if row else datetime.now()
