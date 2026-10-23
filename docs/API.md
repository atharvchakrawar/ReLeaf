# ReLeaf API Contract

Base URL: http://localhost:8000

## Simulation Clock
GET /clock
Response: { "sim_time": "2026-10-23T14:32:00", "speed": 1, "real_elapsed_seconds": 120 }

POST /clock/advance { "minutes": 5 }
Response: { "sim_time": "2026-10-23T14:37:00" }

POST /clock/reset
Response: { "sim_time": "2026-10-23T00:00:00", "speed": 1 }

POST /clock/speed { "speed": 1 }   # 1, 10, or 60
Response: { "sim_time": "...", "speed": 10 }

## Stats
GET /stats
Response:
{
  "delivered": 42,
  "wasted": 3,
  "in_transit": 5,
  "salvaged": 2,
  "reroutes": 4,
  "avg_delivery_time_minutes": 18.5
}

## Donors / Batches
GET /batches
Response: [
  {
    "id": "b1",
    "donor_name": "Green Kitchen",
    "item_type": "Cooked Meals",
    "total_qty": 30,
    "remaining_qty": 20,
    "expiry_minutes": 90,
    "safe_minutes_left": 45,
    "status": "available",   // available | assigned | expired | delivered
    "location": { "lat": 18.52, "lng": 73.85 },
    "created_at": "2026-10-23T13:00:00",
    "temperature_c": 28
  }
]

POST /batches
Body: { "donor_name": "str", "item_type": "str", "quantity": int, "expiry_minutes": int, "lat": float, "lng": float }
Response: { batch object }

GET /batches/:id
Response: { batch object }

## Suggest Plans
POST /suggest
Body: { "batch_id": "b1" }
Response:
{
  "plans": [
    {
      "plan_id": "p1",
      "rider_id": "r1",
      "rider_name": "Amit Kumar",
      "shelter_id": "s1",
      "shelter_name": "Hope House",
      "qty": 20,
      "eta_minutes": 22,
      "safe_margin_minutes": 23,
      "score": 0.87,
      "explanation": "Amit is 1.2 km away with 95% reliability. Hope House has capacity for 20 meals and is 3.1 km from donor.",
      "plan_b": { "shelter_id": "s2", "shelter_name": "City Shelter", "eta_minutes": 35 },
      "confidence": 0.82,
      "standby_rider_id": "r3",
      "standby_rider_name": "Priya Singh"
    }
  ],
  "blocked": [
    { "rider_id": "r2", "reason": "trust_score_too_low", "unlock_hint": "Complete 3 more deliveries to unlock" }
  ]
}

## Assign
POST /assign
Body: { "plan_id": "p1", "batch_id": "b1" }
Response:
{
  "assignment_id": "a1",
  "batch_id": "b1",
  "rider_id": "r1",
  "shelter_id": "s1",
  "status": "pending",   // pending | picked_up | delivered | failed | rerouted | salvaged
  "confirm_code": "7423",
  "plan_b": { "shelter_id": "s2", "shelter_name": "City Shelter", "eta_minutes": 35 },
  "confidence": 0.82,
  "standby_rider_name": "Priya Singh",
  "explanation": "Amit is 1.2 km away..."
}

POST /assign/auto { "batch_id": "b1" }
Response: { assignment object }

## Riders
GET /riders
Response: [
  {
    "id": "r1",
    "name": "Amit Kumar",
    "status": "idle",   // idle | en_route | returning
    "trust_score": 0.92,
    "reliability": 0.95,
    "location": { "lat": 18.521, "lng": 73.851 },
    "last_heartbeat": "2026-10-23T13:01:00",
    "active_assignment_id": null
  }
]

GET /riders/:id/jobs
Response: [
  {
    "assignment_id": "a1",
    "batch_id": "b1",
    "item_type": "Cooked Meals",
    "qty": 20,
    "stage": "to_pickup",   // to_pickup | to_shelter
    "pickup_location": { "lat": 18.52, "lng": 73.85 },
    "shelter_location": { "lat": 18.53, "lng": 73.86 },
    "shelter_name": "Hope House",
    "eta_minutes": 15,
    "safe_minutes_left": 40,
    "status": "pending",
    "confirm_code": "7423",
    "plan_b": { "shelter_id": "s2", "shelter_name": "City Shelter", "eta_minutes": 35 },
    "confidence": 0.82,
    "standby_rider_name": "Priya Singh",
    "explanation": "Best route based on proximity and trust score."
  }
]

POST /riders/:id/pickup { "assignment_id": "a1" }
Response: { "status": "picked_up" }

POST /riders/:id/deliver { "assignment_id": "a1", "confirm_code": "7423" }
Response: { "status": "delivered" } or 400 { "error": "Wrong confirmation code" }

POST /riders/:id/cancel { "assignment_id": "a1" }
Response: { "status": "cancelled" }

POST /riders/:id/heartbeat
Response: { "last_heartbeat": "2026-10-23T13:05:00" }

## Shelters
GET /shelters
Response: [
  {
    "id": "s1",
    "name": "Hope House",
    "is_open": true,
    "has_clean_water": true,
    "has_cooking_fuel": false,
    "location": { "lat": 18.53, "lng": 73.86 },
    "demand": { "Cooked Meals": 50, "Bread": 20 },
    "incoming": { "Cooked Meals": 20 },
    "free_space": { "Cooked Meals": 30, "Bread": 20 },
    "incoming_deliveries": [
      {
        "assignment_id": "a1",
        "item_type": "Cooked Meals",
        "qty": 20,
        "rider_name": "Amit Kumar",
        "eta_minutes": 15,
        "status": "pending",
        "confirm_code": "7423"
      }
    ]
  }
]

PATCH /shelters/:id
Body: { "is_open": true, "has_clean_water": true, "has_cooking_fuel": false }
Response: { shelter object }

POST /shelters/:id/reduce_demand
Body: { "item_type": "Cooked Meals", "amount": 10 }
Response: { shelter object }

## Events
GET /events
Response: [
  {
    "id": "e1",
    "timestamp": "2026-10-23T13:05:00",
    "type": "assigned",   // assigned | picked_up | delivered | rerouted | failed | salvaged | released | heartbeat_lost
    "message": "Amit Kumar picked up 20 Cooked Meals for Hope House",
    "severity": "info"   // info | warning | error
  }
]

## Control Panel
POST /control/reset
Response: { "status": "ok" }

POST /control/create_tight_batch
Response: { batch object }

POST /control/kill_rider { "rider_id": "r1" }
Response: { "status": "ok" }

POST /control/fill_shelter { "shelter_id": "s1" }
Response: { "status": "ok" }

POST /control/close_shelter { "shelter_id": "s1" }
Response: { "status": "ok" }

POST /control/chaos { "rounds": 3 }
Response:
{
  "injected": 5,
  "recovered": 3,
  "salvaged": 1,
  "failed": 1,
  "resilience_score": 0.80
}

POST /weather { "temperature_c": 35 }
Response: { "temperature_c": 35, "shelf_life_factor": 0.72, "note": "High heat: shelf life reduced to 72% of normal" }
