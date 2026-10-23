import sqlite3
import os
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "releaf.db")


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    cur = conn.cursor()

    cur.execute("""
    CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        donor_name TEXT,
        item_type TEXT,
        total_qty INTEGER,
        remaining_qty INTEGER,
        expiry_minutes INTEGER,
        safe_minutes_left REAL,
        status TEXT,
        lat REAL,
        lng REAL,
        created_at TEXT,
        temperature_c REAL DEFAULT 25.0,
        kind TEXT DEFAULT 'food',
        why TEXT DEFAULT ''
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS shelters (
        id TEXT PRIMARY KEY,
        name TEXT,
        is_open INTEGER DEFAULT 1,
        has_clean_water INTEGER DEFAULT 1,
        has_cooking_fuel INTEGER DEFAULT 1,
        lat REAL,
        lng REAL,
        demand_json TEXT DEFAULT '{}',
        incoming_json TEXT DEFAULT '{}',
        kind TEXT DEFAULT 'shelter'
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS riders (
        id TEXT PRIMARY KEY,
        name TEXT,
        capacity INTEGER DEFAULT 30,
        status TEXT DEFAULT 'idle',
        trust_score REAL DEFAULT 1.0,
        reliability REAL DEFAULT 1.0,
        has_insulated_bag INTEGER DEFAULT 0,
        lat REAL,
        lng REAL,
        last_heartbeat TEXT,
        active_assignment_id TEXT,
        is_killed INTEGER DEFAULT 0
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS assignments (
        assignment_id TEXT PRIMARY KEY,
        batch_id TEXT,
        rider_id TEXT,
        shelter_id TEXT,
        item_type TEXT,
        qty INTEGER,
        stage TEXT DEFAULT 'to_pickup',
        status TEXT DEFAULT 'pending',
        confirm_code TEXT,
        plan_b_shelter_id TEXT,
        plan_b_shelter_name TEXT,
        plan_b_eta_minutes REAL DEFAULT 0,
        confidence REAL DEFAULT 1.0,
        standby_rider_id TEXT,
        standby_rider_name TEXT,
        explanation TEXT DEFAULT '',
        why TEXT DEFAULT '',
        lease_expiry TEXT,
        created_at TEXT,
        eta_minutes REAL DEFAULT 15.0,
        reroute_count INTEGER DEFAULT 0
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        timestamp TEXT,
        type TEXT,
        message TEXT,
        severity TEXT DEFAULT 'info'
    )
    """)

    cur.execute("""
    CREATE TABLE IF NOT EXISTS sim_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        sim_time TEXT,
        speed INTEGER DEFAULT 1,
        real_elapsed_seconds INTEGER DEFAULT 0,
        temperature_c REAL DEFAULT 25.0,
        shelf_life_factor REAL DEFAULT 1.0,
        chaos_injected INTEGER DEFAULT 0,
        chaos_recovered INTEGER DEFAULT 0,
        chaos_salvaged INTEGER DEFAULT 0,
        chaos_failed INTEGER DEFAULT 0
    )
    """)

    # Initialize default sim state if missing
    cur.execute("SELECT id FROM sim_state WHERE id = 1")
    if not cur.fetchone():
        now_str = datetime.now().isoformat()
        cur.execute("""
        INSERT INTO sim_state (id, sim_time, speed, real_elapsed_seconds, temperature_c, shelf_life_factor)
        VALUES (1, ?, 1, 0, 25.0, 1.0)
        """, (now_str,))

    conn.commit()
    conn.close()


def log_event(event_type: str, message: str, severity: str = "info", timestamp: str = None):
    conn = get_db()
    cur = conn.cursor()
    eid = f"e{uuid.uuid4().hex[:8]}"
    if not timestamp:
        cur.execute("SELECT sim_time FROM sim_state WHERE id = 1")
        row = cur.fetchone()
        timestamp = row["sim_time"] if row and row["sim_time"] else datetime.now().isoformat()
    cur.execute("""
    INSERT INTO events (id, timestamp, type, message, severity)
    VALUES (?, ?, ?, ?, ?)
    """, (eid, timestamp, event_type, message, severity))
    conn.commit()
    conn.close()
    return eid
