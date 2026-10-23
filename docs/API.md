# ReLeaf: Shared API Contract
> Do not change without telling your teammate.

Base URL: http://localhost:8000 (CORS open to all origins)

## Simulation Clock
All times are SIMULATED minutes since start. The clock advances by `speed`
sim-minutes per real minute, so the demo can run fast.

GET  /clock                       -> {"now": 12.5, "speed": 1}
POST /clock/speed   {"speed": 10}
POST /clock/advance {"minutes": 5}

## Shapes

### Batch
```json
{
  "id": "b1",
  "donor_name": "Green Kitchen",
  "item_type": "cooked_food",
  "quantity": 50,
  "remaining_qty": 30,
  "expires_at": 90.0,
  "lat": 18.52,
  "lng": 73.85,
  "status": "open",
  "risk": "safe",
  "safe_minutes_left": 45.0
}
```
- `item_type`: `cooked_food | medical | ration_kit | infant_formula`
- `status`: `open | partially_assigned | fully_assigned | expired`
- `risk`: `safe` (>30 min) | `urgent` (15-30 min) | `critical` (<15 min)
- `remaining_qty` = quantity not yet covered by an active/delivered assignment
- `safe_minutes_left` = (expires_at - now) / heat_factor

### Shelter
```json
{
  "id": "s1",
  "name": "Hope House",
  "kind": "shelter",
  "lat": 18.53,
  "lng": 73.86,
  "is_open": true,
  "demand": {"cooked_food": 50, "bread": 20},
  "incoming": {"cooked_food": 20},
  "has_clean_water": true,
  "has_cooking_fuel": false
}
```
- `kind`: `shelter | salvage`
- Salvage sinks (community_fridge, animal_feed, compost): `kind = "salvage"`, accept only `cooked_food`, unlimited demand, never need dependencies
- Free space for item = `demand - incoming - delivered`

### Rider
```json
{
  "id": "r1",
  "name": "Amit Kumar",
  "capacity": 40,
  "lat": 18.521,
  "lng": 73.851,
  "status": "available",
  "last_heartbeat": 10.5,
  "reliability": 92,
  "has_insulated_bag": true
}
```
- `status`: `available | assigned | in_transit | unresponsive | standby`
- `reliability`: 0-100, starts at 80
- +5 on delivered, -15 on timeout/unresponsive

### Assignment
```json
{
  "id": "a1",
  "batch_id": "b1",
  "rider_id": "r1",
  "shelter_id": "s1",
  "quantity": 20,
  "status": "reserved",
  "stage": "to_pickup",
  "eta_minutes": 15.0,
  "lease_expires_at": 22.5,
  "deliver_by": 80.0,
  "reroute_count": 0,
  "reason": null,
  "backup_shelter_id": "s2",
  "backup_rider_id": null,
  "confidence": 82,
  "confirm_code": "7423",
  "why": ["Rider Amit chosen: reliability 92, 6 min away"]
}
```
- `status`: `reserved | in_transit | delivered | released | failed | salvaged`
- `stage`: `to_pickup | to_shelter | done`
- `confidence`: 0-100

### Plan
```json
{
  "rider_id": "r1",
  "shelter_id": "s1",
  "quantity": 20,
  "eta_minutes": 22,
  "safe_margin_minutes": 23,
  "score": 0.87,
  "why": ["Rider Amit: reliability 92, 6 min away", "Hope House: 30 free slots"]
}
```

## Endpoints

### Batches
```
GET  /batches
POST /batches   {donor_name, item_type, quantity, expires_at, lat, lng}
```

### Shelters
```
GET   /shelters
POST  /shelters
PATCH /shelters/{id}   {is_open?, demand?, has_clean_water?, has_cooking_fuel?}
```

### Riders
```
GET  /riders
POST /riders
POST /riders/{id}/heartbeat
```

### Assignments
```
GET  /assignments
POST /assignments   {batch_id, rider_id, shelter_id, quantity}
  -> 400 {"error": "plain sentence"} if unsafe or infeasible
POST /assignments/{id}/pickup
POST /assignments/{id}/deliver   {"code": "7423"}
  -> 400 {"error": "..."} if wrong code
POST /assignments/{id}/cancel
```

### Planning
```
POST /batches/{id}/suggest
  -> {"plans": [Plan...], "blocked": [{shelter_id, reason, unlock_hint}]}
POST /batches/{id}/auto-dispatch
  -> creates the best set of assignments, returns them
```

### Events & Stats
```
GET /events   -> last 50, newest first: [{time, message, level}]
               level: info | warning | error
GET /stats    -> {delivered_qty, wasted_qty, in_transit_qty, salvaged_qty,
                  reroutes, avg_delivery_minutes}
```

### Weather
```
GET  /weather          -> {"temp_c": 32}
POST /weather          {"temp_c": 38}
```

### Demo / Control
```
POST /demo/reset
POST /demo/tight-batch            creates 180-unit cooked_food, 75 min to expiry
POST /demo/kill-rider/{id}        stops heartbeats
POST /demo/fill-shelter/{id}      sets demand to 0
POST /demo/chaos {"rounds": 5}    injects random failures
GET  /demo/resilience             -> {failures_injected, recovered, salvaged, failed, score}
```

## Backend Rules (frontend displays results only)
1. Safe delivery: pickup_travel + shelter_travel + 10 min buffer <= safe_minutes_left
2. Rider carries at most `capacity`. Batch can be split across multiple riders/shelters
3. Shelter never receives more than its free space (incoming counts)
4. Dependencies: `ration_kit` needs clean water AND cooking fuel; `infant_formula` needs clean water
5. Reservation lease = min(10, 25% of time left) minutes, scaled by reliability
6. No heartbeat for 5 sim-min -> status `unresponsive` -> reservations released -> re-dispatch
7. Shelter closes or demand drops in transit -> reroute via backup_shelter first, else nearest compatible, else salvage/failed
8. Expired batches -> status `expired`, active assignments released, undelivered qty = wasted
9. Every action writes a readable sentence to /events
10. Heat: factor 1.0 (<=25°C), 1.3 (26-35°C), 1.6 (>35°C). Insulated bag: factor * 0.75
11. Plan B: every assignment gets `backup_shelter_id`. On reroute, use backup first if still valid
12. Confidence: starts at rider.reliability. Drops 10/sim-min past half lease with no heartbeat. Heartbeat restores. Below 40 -> warm standby rider
13. Reliability: +5 delivered, -15 timeout (min 10, max 100). Lease length = base * (reliability/100), min 3 min
14. Salvage: no shelter found + cooked_food -> nearest salvage sink. Medical/ration_kit/infant_formula -> failed
15. Unlock hint: rule 4 blocks -> blocked entry saying what's missing and how much demand it unlocks
16. Why: every plan and assignment stores short reasons
17. Delivery requires the shelter's 4-digit `confirm_code`

## Distance & Speed
Straight-line distance, fixed rider speed 20 km/h.
