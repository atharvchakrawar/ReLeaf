# ReLeaf

**Other systems answer "who can carry this?" ReLeaf answers "what happens when this fails?"**

ReLeaf is a real-time coordination, dispatch and safety platform that connects food and aid **donors**, volunteer **riders** and receiving **shelters**. It treats time, rider capacity, shelter space, item compatibility and human unreliability as live variables, so perishable aid reaches people before it spoils.

Built at Vibeathon for the problem statement *"The Last-Mile Spoilage Trap: Coordinating Perishable Surplus & Fragile Aid Under Uncertainty"*.

## Live demo

- **App:** https://releaf-frontend-three.vercel.app/
- **API:** https://releaf-deh0.onrender.com (interactive docs: https://releaf-deh0.onrender.com/docs)

The backend runs on a free tier and may take up to a minute to wake up on the first request. Open the Control Panel and press **Reset demo data** to start.

---

## The problem

Every night, restaurants, hostel messes and pharmacies try to donate cooked food and short-life supplies, but about 40% of perishable aid is wasted because of coordination gaps:

1. **Supply does not match transport or demand.** 180 meals may expire in 75 minutes, but a rider carries 40 and a shelter fits 50.
2. **Ghost reservations.** Someone claims a batch, gets stuck or goes silent, and by the time the claim is cancelled the food is almost unsafe.
3. **Conditions change mid-journey.** A shelter fills up while a rider is already on the way.
4. **Dependencies.** Ration kits or infant formula sent to a site without fuel or clean water do harm.

## Our approach

| Problem | What ReLeaf does |
|---|---|
| Mismatch of supply, capacity and demand | A **split planner** divides a batch across several riders and shelters, and only proposes plans that finish before the food is unsafe |
| Ghost reservations | **Adaptive leases** that shrink with shelf life and rider reliability, a **standby rider** warmed up before a lease ends, and automatic re-dispatch |
| Mid-journey changes | A **pre-committed Plan B shelter** on every delivery, then live rerouting, then salvage, then a clear failure reason |
| Dependency rules | **Compatibility checks** at planning and reroute time, with **unlock hints** that say what would fix a block |

## Features

**Core**
- Batch creation with expiry, location and item type (cooked food, medical, ration kit, infant formula)
- Ranked delivery plans with batch splitting across riders and shelters
- One-click auto-dispatch
- Reservation leases with automatic release
- Rider heartbeats and unresponsive-rider detection
- Mid-transit rerouting when a shelter closes or its demand drops
- Shelter space that counts incoming deliveries, so two riders are never sent to fill the same gap
- Batch expiry handling and impact stats (delivered, wasted, in transit, salvaged, reroutes, average delivery time)
- Readable event log of every decision

**What makes it different**
1. **Trust-weighted leases and hot-standby rider.** Unreliable riders get shorter leases, and a backup rider swaps in instantly.
2. **Pre-committed Plan B shelter.** Every delivery already knows its fallback.
3. **Heat-aware spoilage.** Higher temperature shrinks safe time, and insulated bags slow it down.
4. **Salvage tiers.** Cooked food with no shelter goes to a community fridge, animal feed or compost. Medical items are never salvaged and fail with a reason.
5. **Unlock suggestions.** A blocked delivery explains what would unblock it.
6. **Explainable plans, delivery confirm code and Chaos mode.** Every plan lists its reasons, the shelter confirms delivery with a 4-digit code, and a Chaos button injects random failures and reports a live **resilience score**.

## How it works

1. A donor posts a batch.
2. The backend computes heat-adjusted safe time and a risk level (safe, urgent, critical).
3. The planner keeps only plans where `pickup travel + delivery travel + 10 min buffer <= safe minutes left`, the rider can carry the load, the shelter has free space, and the item's dependencies are met.
4. Plans are scored (lower spoilage risk, shorter ETA, better capacity fit) and ranked.
5. Auto-dispatch creates assignments, each with a lease, a Plan B shelter, a confirm code and a "why" explanation.
6. A background tick advances the simulation clock, recomputes ETAs, releases expired leases, detects silent riders, reroutes deliveries and expires batches.
7. The rider picks up, delivers with the shelter's code, and the event log and stats update.

## Key rules

| # | Rule |
|---|---|
| 1 | Safe delivery: travel to pickup + travel to shelter + 10 min buffer must fit in safe minutes left |
| 2 | A rider carries at most their capacity, and a batch can be split across riders and shelters |
| 3 | A shelter never receives more than its free space (demand - incoming - delivered) |
| 4 | Ration kits need clean water and cooking fuel, and infant formula needs clean water |
| 5 | Lease = min(10, 25% of time left) minutes, scaled by rider reliability |
| 6 | No heartbeat for 5 simulated minutes makes a rider unresponsive and their reservations are released |
| 7 | If a shelter closes or fills mid-transit, use Plan B, then the nearest compatible shelter, then salvage or fail with a reason |
| 8 | Expired batches release their assignments, and the undelivered quantity counts as wasted |
| 9 | Heat factor is 1.0 (up to 25 C), 1.3 (26 to 35 C) or 1.6 (above 35 C), times 0.75 with an insulated bag |
| 10 | Reliability goes +5 on delivery and -15 on timeout (range 10 to 100) |
| 11 | Delivery needs the shelter's 4-digit confirm code |

The full API contract is in [`docs/API.md`](docs/API.md).

## Architecture

```
React + Vite frontend  <--- polls every 2s --->  FastAPI backend  <--->  SQLite
 (Leaflet map)                                         |
                                                 background tick
                                (clock, leases, heartbeats, reroutes, expiry)
```

| Layer | Choice | Hosting |
|---|---|---|
| Backend | Python, FastAPI, uvicorn | Render |
| Database | SQLite (built-in `sqlite3`) | With the backend |
| Frontend | React, Vite, plain CSS | Vercel |
| Map | Leaflet | |
| Live updates | Polling every 2 seconds | |

**Backend files** (`/backend`)

| File | Purpose |
|---|---|
| `main.py` | API routes |
| `db.py` | Tables and event logging |
| `clock.py` | Simulated clock |
| `rules.py` | Safety, capacity and dependency checks |
| `planner.py` | Plan building, splitting and scoring |
| `recovery.py` | Background tick: leases, heartbeats, reroutes, expiry |
| `seed.py` | Demo data |
| `tests.py` | Scenario tests |

**Frontend** (`/frontend`): pages for Dashboard, Donor, Rider, Shelter and Control Panel, with a single `api.js` that has a mock-data flag.

## Run it locally

**Requirements:** Python 3.10+, Node 18+, git.

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API docs are at http://localhost:8000/docs.

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
Open the URL Vite prints, usually http://localhost:5173. The API address is read from `VITE_API_URL` and falls back to `http://localhost:8000`. To use mock data without the backend, set `USE_MOCK = true` in `frontend/src/api.js`.

**Tests**
```bash
cd backend
python tests.py
```

## Deployment

- **Backend (Render):** root directory `backend`, build `pip install -r requirements.txt`, start `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- **Frontend (Vercel):** root directory `frontend`, Vite preset, environment variable `VITE_API_URL=https://releaf-deh0.onrender.com`.
- Demo data lives in SQLite and resets when the backend restarts, so press **Reset demo data** in the Control Panel before a demo.

## Try the live failure scenarios

Open the **Control Panel** and try these:

1. **Tight expiry and split:** set temperature to 38 C, press *Create tight batch* (180 units, 75 min), then *Auto-dispatch*. Open "Why this plan?" to see the split.
2. **Ghost reservation:** press *Kill rider* on a rider with a job. Watch confidence drop, the standby rider warm up and the swap appear in the timeline.
3. **Shelter fills in transit:** press *Fill shelter* while a rider is on the way. Plan B takes over.
4. **No fallback:** close every shelter. Cooked food is salvaged, medical items fail with a clear reason.
5. **Delivery confirmation:** enter a wrong code, then the right one from the Shelter page.
6. **Chaos:** press *Chaos* and read the resilience score.

Use *Reset demo data* to start over, and the speed buttons (1x, 10x, 60x) to run scenarios faster.

## Real-world use

- **Donors:** restaurants, hostel messes, banquet halls, pharmacies
- **Carriers:** NGO and volunteer two-wheeler riders
- **Receivers:** night shelters and flood or emergency relief camps
- **Operators:** NGOs and municipal relief teams who need a live view of what is saving food and what is being lost

## Limitations and next steps

- Distance is straight-line at a fixed 20 km/h. Next: real road routing (OSRM or Google Maps) and live GPS.
- Rider movement is simulated through ETA countdown, not live location.
- Next: SMS and push alerts for riders, donor and shelter verification, PostgreSQL with a task queue for city scale, and real temperature data.

## Team

| Name | Role |
|---|---|
| [Name 1] | Backend: rules, planner, recovery loop, API, tests |
| [Name 2] | Frontend: screens, Control Panel, map, UI polish |

## Development note

Built during the [Hackathon Name] sprint in a fresh repository, with continuous commits. AI coding assistance was used during development, and the team reviewed and can explain every part of the code.
