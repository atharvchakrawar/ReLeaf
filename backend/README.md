# ReLeaf Backend

Backend coordination engine for perishable surplus food and aid redistribution under uncertainty, built with FastAPI and SQLite.

## How to Run

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Start the backend server:
```bash
uvicorn main:app --reload --port 8000
```
The API will be available at `http://localhost:8000`.

## How to Run Tests

Run the full automated test suite:
```bash
python -m pytest tests.py
```

## File Layout

- `main.py`: FastAPI application defining REST endpoints and error handling.
- `db.py`: SQLite database schema initialization, WAL mode config, and event logger.
- `clock.py`: Virtual simulation clock management and time advance endpoints.
- `rules.py`: Rules 1 to 4 validating spoilage, capacity, compatibility, and trust.
- `planner.py`: Route candidate generation, scoring, Plan B, and blocked rider hints.
- `assignments.py`: Delivery lifecycle management, leases, pickup, deliver, and mid-transit rerouting.
- `recovery.py`: Background tick thread managing sim time, heartbeats, standby swaps, and expirations.
- `seed.py`: Initial test data population (donors, shelters, sinks, riders, batches) and demo reset.
- `tests.py`: Automated test suite verifying all 10 core failure and recovery scenarios.
