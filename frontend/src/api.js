// api.js — ReLeaf API client with mock fallback
// Set USE_MOCK = false when backend is running at http://localhost:8000
const USE_MOCK = true;
const BASE_URL = 'http://localhost:8000';

async function call(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ============================================================
// MOCK DATA — realistic, comprehensive
// ============================================================
const MOCK_CLOCK = { sim_time: '2026-10-23T14:32:00', speed: 1, real_elapsed_seconds: 120 };

const MOCK_STATS = {
  delivered: 42, wasted: 3, in_transit: 5, salvaged: 2, reroutes: 4, avg_delivery_time_minutes: 18.5
};

const MOCK_BATCHES = [
  {
    id: 'b1', donor_name: 'Green Kitchen', item_type: 'Cooked Meals',
    total_qty: 30, remaining_qty: 20, expiry_minutes: 90, safe_minutes_left: 45,
    status: 'available', location: { lat: 18.52, lng: 73.85 },
    created_at: '2026-10-23T13:00:00', temperature_c: 28
  },
  {
    id: 'b2', donor_name: 'Sunrise Bakery', item_type: 'Bread',
    total_qty: 50, remaining_qty: 50, expiry_minutes: 120, safe_minutes_left: 18,
    status: 'available', location: { lat: 18.515, lng: 73.848 },
    created_at: '2026-10-23T12:50:00', temperature_c: 25
  },
  {
    id: 'b3', donor_name: 'City Hotel', item_type: 'Rice',
    total_qty: 100, remaining_qty: 60, expiry_minutes: 60, safe_minutes_left: 8,
    status: 'assigned', location: { lat: 18.525, lng: 73.855 },
    created_at: '2026-10-23T12:40:00', temperature_c: 30
  },
  {
    id: 'b4', donor_name: 'Fresh Farms', item_type: 'Vegetables',
    total_qty: 80, remaining_qty: 0, expiry_minutes: 180, safe_minutes_left: 0,
    status: 'expired', location: { lat: 18.51, lng: 73.84 },
    created_at: '2026-10-23T10:00:00', temperature_c: 35
  }
];

const MOCK_RIDERS = [
  {
    id: 'r1', name: 'Amit Kumar', status: 'idle',
    trust_score: 0.92, reliability: 0.95,
    location: { lat: 18.521, lng: 73.851 },
    last_heartbeat: '2026-10-23T13:01:00', active_assignment_id: null
  },
  {
    id: 'r2', name: 'Raj Patel', status: 'en_route',
    trust_score: 0.65, reliability: 0.71,
    location: { lat: 18.519, lng: 73.849 },
    last_heartbeat: '2026-10-23T13:10:00', active_assignment_id: 'a1'
  },
  {
    id: 'r3', name: 'Priya Singh', status: 'idle',
    trust_score: 0.88, reliability: 0.91,
    location: { lat: 18.523, lng: 73.853 },
    last_heartbeat: '2026-10-23T13:12:00', active_assignment_id: null
  }
];

const MOCK_SHELTERS = [
  {
    id: 's1', name: 'Hope House', is_open: true, has_clean_water: true, has_cooking_fuel: false,
    location: { lat: 18.53, lng: 73.86 },
    demand: { 'Cooked Meals': 50, 'Bread': 20 },
    incoming: { 'Cooked Meals': 20 },
    free_space: { 'Cooked Meals': 30, 'Bread': 20 },
    incoming_deliveries: [
      {
        assignment_id: 'a1', item_type: 'Cooked Meals', qty: 20,
        rider_name: 'Raj Patel', eta_minutes: 15, status: 'pending', confirm_code: '7423'
      }
    ]
  },
  {
    id: 's2', name: 'City Shelter', is_open: true, has_clean_water: true, has_cooking_fuel: true,
    location: { lat: 18.528, lng: 73.858 },
    demand: { 'Rice': 40, 'Bread': 30 },
    incoming: { 'Rice': 60 },
    free_space: { 'Rice': 0, 'Bread': 30 },
    incoming_deliveries: []
  }
];

const MOCK_PLANS = {
  b1: {
    plans: [
      {
        plan_id: 'p1', rider_id: 'r1', rider_name: 'Amit Kumar',
        shelter_id: 's1', shelter_name: 'Hope House', qty: 20,
        eta_minutes: 22, safe_margin_minutes: 23, score: 0.87, confidence: 0.82,
        explanation: 'Amit is 1.2 km away with 95% reliability. Hope House needs exactly this quantity and is 3.1 km from donor.',
        plan_b: { shelter_id: 's2', shelter_name: 'City Shelter', eta_minutes: 35 },
        standby_rider_id: 'r3', standby_rider_name: 'Priya Singh'
      },
      {
        plan_id: 'p2', rider_id: 'r3', rider_name: 'Priya Singh',
        shelter_id: 's2', shelter_name: 'City Shelter', qty: 20,
        eta_minutes: 28, safe_margin_minutes: 17, score: 0.71, confidence: 0.65,
        explanation: 'Priya is 1.8 km away. City Shelter has partial capacity. Tighter time margin.',
        plan_b: { shelter_id: 's1', shelter_name: 'Hope House', eta_minutes: 40 },
        standby_rider_id: 'r2', standby_rider_name: 'Raj Patel'
      }
    ],
    blocked: [
      { rider_id: 'r2', rider_name: 'Raj Patel', reason: 'trust_score_too_low', unlock_hint: 'Complete 3 more deliveries to unlock' }
    ]
  }
};

const MOCK_ASSIGNMENTS = [
  {
    assignment_id: 'a1', batch_id: 'b3', rider_id: 'r2', rider_name: 'Raj Patel',
    shelter_id: 's1', shelter_name: 'Hope House', item_type: 'Rice', qty: 60,
    status: 'picked_up', confirm_code: '7423',
    plan_b: { shelter_id: 's2', shelter_name: 'City Shelter', eta_minutes: 35 },
    confidence: 0.75, standby_rider_name: 'Priya Singh',
    explanation: 'Raj Patel is nearest active rider. Hope House has urgent need for rice.'
  },
  {
    assignment_id: 'a2', batch_id: 'b1', rider_id: 'r1', rider_name: 'Amit Kumar',
    shelter_id: 's1', shelter_name: 'Hope House', item_type: 'Cooked Meals', qty: 20,
    status: 'rerouted', confirm_code: '1892',
    plan_b: { shelter_id: 's2', shelter_name: 'City Shelter', eta_minutes: 22 },
    confidence: 0.58, standby_rider_name: 'Priya Singh',
    explanation: 'Amit Kumar assigned based on proximity. Rerouted to City Shelter after Hope House reached capacity.'
  }
];

const MOCK_EVENTS = [
  { id: 'e1', timestamp: '2026-10-23T13:15:00', type: 'rerouted', message: 'Assignment a2 rerouted to City Shelter — Hope House at capacity', severity: 'warning' },
  { id: 'e2', timestamp: '2026-10-23T13:10:00', type: 'picked_up', message: 'Raj Patel picked up 60 Rice for City Shelter', severity: 'info' },
  { id: 'e3', timestamp: '2026-10-23T13:05:00', type: 'heartbeat_lost', message: 'Rider Amit Kumar heartbeat lost — monitoring', severity: 'error' },
  { id: 'e4', timestamp: '2026-10-23T13:00:00', type: 'assigned', message: 'Amit Kumar assigned batch b1 (20 Cooked Meals) to Hope House', severity: 'info' },
  { id: 'e5', timestamp: '2026-10-23T12:55:00', type: 'salvaged', message: 'Batch b4 vegetables salvaged to Community Sink before expiry', severity: 'warning' },
  { id: 'e6', timestamp: '2026-10-23T12:50:00', type: 'delivered', message: 'Raj Patel delivered 30 Cooked Meals to Hope House', severity: 'info' }
];

const MOCK_RIDER_JOBS = {
  r1: [
    {
      assignment_id: 'a2', batch_id: 'b1', item_type: 'Cooked Meals', qty: 20,
      stage: 'to_shelter', pickup_location: { lat: 18.52, lng: 73.85 },
      shelter_location: { lat: 18.53, lng: 73.86 }, shelter_name: 'City Shelter',
      eta_minutes: 12, safe_minutes_left: 35, status: 'rerouted', confirm_code: '1892',
      plan_b: { shelter_id: 's1', shelter_name: 'Hope House', eta_minutes: 22 },
      confidence: 0.58, standby_rider_name: 'Priya Singh',
      explanation: 'Rerouted to City Shelter after Hope House reached capacity. City Shelter has free space.'
    }
  ],
  r2: [
    {
      assignment_id: 'a1', batch_id: 'b3', item_type: 'Rice', qty: 60,
      stage: 'to_shelter', pickup_location: { lat: 18.525, lng: 73.855 },
      shelter_location: { lat: 18.53, lng: 73.86 }, shelter_name: 'Hope House',
      eta_minutes: 15, safe_minutes_left: 8, status: 'picked_up', confirm_code: '7423',
      plan_b: { shelter_id: 's2', shelter_name: 'City Shelter', eta_minutes: 35 },
      confidence: 0.75, standby_rider_name: 'Priya Singh',
      explanation: 'Best route based on proximity and trust score. Urgent: batch expiring soon.'
    }
  ],
  r3: []
};

// ============================================================
// API FUNCTIONS
// ============================================================

// Clock
export async function getClock() {
  if (USE_MOCK) return { ...MOCK_CLOCK };
  return call('GET', '/clock');
}
export async function advanceClock(minutes) {
  if (USE_MOCK) return { sim_time: '2026-10-23T14:37:00' };
  return call('POST', '/clock/advance', { minutes });
}
export async function resetClock() {
  if (USE_MOCK) return { sim_time: '2026-10-23T00:00:00', speed: 1 };
  return call('POST', '/clock/reset');
}
export async function setClockSpeed(speed) {
  if (USE_MOCK) return { ...MOCK_CLOCK, speed };
  return call('POST', '/clock/speed', { speed });
}

// Stats
export async function getStats() {
  if (USE_MOCK) return { ...MOCK_STATS };
  return call('GET', '/stats');
}

// Batches
export async function getBatches() {
  if (USE_MOCK) return [...MOCK_BATCHES];
  return call('GET', '/batches');
}
export async function getBatch(id) {
  if (USE_MOCK) return MOCK_BATCHES.find(b => b.id === id) || null;
  return call('GET', `/batches/${id}`);
}
export async function createBatch(data) {
  if (USE_MOCK) {
    const nb = {
      id: `b${Date.now()}`, donor_name: data.donor_name, item_type: data.item_type,
      total_qty: data.quantity, remaining_qty: data.quantity, expiry_minutes: data.expiry_minutes,
      safe_minutes_left: data.expiry_minutes - 5, status: 'available',
      location: { lat: data.lat, lng: data.lng }, created_at: new Date().toISOString(), temperature_c: 28
    };
    MOCK_BATCHES.push(nb);
    return nb;
  }
  return call('POST', '/batches', data);
}

// Suggest Plans
export async function suggestPlans(batch_id) {
  if (USE_MOCK) return MOCK_PLANS[batch_id] || { plans: [], blocked: [] };
  return call('POST', '/suggest', { batch_id });
}

// Assign
export async function assignPlan(plan_id, batch_id) {
  if (USE_MOCK) {
    return {
      assignment_id: `a${Date.now()}`, batch_id, rider_id: 'r1', shelter_id: 's1',
      status: 'pending', confirm_code: String(Math.floor(1000 + Math.random() * 9000)),
      plan_b: { shelter_id: 's2', shelter_name: 'City Shelter', eta_minutes: 35 },
      confidence: 0.82, standby_rider_name: 'Priya Singh',
      explanation: 'Amit is 1.2 km away with 95% reliability.'
    };
  }
  return call('POST', '/assign', { plan_id, batch_id });
}
export async function autoDispatch(batch_id) {
  if (USE_MOCK) {
    return {
      assignment_id: `a${Date.now()}`, batch_id, rider_id: 'r1', shelter_id: 's1',
      status: 'pending', confirm_code: String(Math.floor(1000 + Math.random() * 9000)),
      plan_b: { shelter_id: 's2', shelter_name: 'City Shelter', eta_minutes: 35 },
      confidence: 0.82, standby_rider_name: 'Priya Singh',
      explanation: 'Auto-selected best available plan.'
    };
  }
  return call('POST', '/assign/auto', { batch_id });
}

// Assignments
export async function getAssignments() {
  if (USE_MOCK) return [...MOCK_ASSIGNMENTS];
  return call('GET', '/assignments');
}

// Riders
export async function getRiders() {
  if (USE_MOCK) return [...MOCK_RIDERS];
  return call('GET', '/riders');
}
export async function getRiderJobs(id) {
  if (USE_MOCK) return MOCK_RIDER_JOBS[id] ? [...MOCK_RIDER_JOBS[id]] : [];
  return call('GET', `/riders/${id}/jobs`);
}
export async function riderPickup(id, assignment_id) {
  if (USE_MOCK) return { status: 'picked_up' };
  return call('POST', `/riders/${id}/pickup`, { assignment_id });
}
export async function riderDeliver(id, assignment_id, confirm_code) {
  if (USE_MOCK) {
    // Simulate wrong code check
    const job = (MOCK_RIDER_JOBS[id] || []).find(j => j.assignment_id === assignment_id);
    if (job && job.confirm_code !== confirm_code) throw new Error('Wrong confirmation code');
    return { status: 'delivered' };
  }
  return call('POST', `/riders/${id}/deliver`, { assignment_id, confirm_code });
}
export async function riderCancel(id, assignment_id) {
  if (USE_MOCK) return { status: 'cancelled' };
  return call('POST', `/riders/${id}/cancel`, { assignment_id });
}
export async function riderHeartbeat(id) {
  if (USE_MOCK) return { last_heartbeat: new Date().toISOString() };
  return call('POST', `/riders/${id}/heartbeat`);
}

// Shelters
export async function getShelters() {
  if (USE_MOCK) return MOCK_SHELTERS.map(s => ({ ...s }));
  return call('GET', '/shelters');
}
export async function updateShelter(id, data) {
  if (USE_MOCK) {
    const s = MOCK_SHELTERS.find(x => x.id === id);
    if (s) Object.assign(s, data);
    return { ...(s || {}) };
  }
  return call('PATCH', `/shelters/${id}`, data);
}
export async function reduceDemand(id, item_type, amount) {
  if (USE_MOCK) {
    const s = MOCK_SHELTERS.find(x => x.id === id);
    if (s && s.demand[item_type] !== undefined) {
      s.demand[item_type] = Math.max(0, s.demand[item_type] - amount);
    }
    return { ...(s || {}) };
  }
  return call('POST', `/shelters/${id}/reduce_demand`, { item_type, amount });
}

// Events
export async function getEvents() {
  if (USE_MOCK) return [...MOCK_EVENTS];
  return call('GET', '/events');
}

// Control Panel
export async function controlReset() {
  if (USE_MOCK) return { status: 'ok' };
  return call('POST', '/control/reset');
}
export async function createTightBatch() {
  if (USE_MOCK) {
    return {
      id: `btight${Date.now()}`, donor_name: 'Test Donor (Tight)', item_type: 'Cooked Meals',
      total_qty: 10, remaining_qty: 10, expiry_minutes: 15, safe_minutes_left: 5,
      status: 'available', location: { lat: 18.52, lng: 73.85 },
      created_at: new Date().toISOString(), temperature_c: 32
    };
  }
  return call('POST', '/control/create_tight_batch');
}
export async function killRider(rider_id) {
  if (USE_MOCK) return { status: 'ok' };
  return call('POST', '/control/kill_rider', { rider_id });
}
export async function fillShelter(shelter_id) {
  if (USE_MOCK) return { status: 'ok' };
  return call('POST', '/control/fill_shelter', { shelter_id });
}
export async function closeShelter(shelter_id) {
  if (USE_MOCK) return { status: 'ok' };
  return call('POST', '/control/close_shelter', { shelter_id });
}
export async function runChaos(rounds) {
  if (USE_MOCK) return { injected: 5, recovered: 3, salvaged: 1, failed: 1, resilience_score: 0.80 };
  return call('POST', '/control/chaos', { rounds });
}

// Weather
export async function setWeather(temperature_c) {
  if (USE_MOCK) {
    const factor = Math.max(0.3, 1 - (temperature_c - 20) * 0.02);
    return {
      temperature_c,
      shelf_life_factor: Math.round(factor * 100) / 100,
      note: temperature_c >= 35
        ? `High heat: shelf life reduced to ${Math.round(factor * 100)}% of normal`
        : `Moderate temperature: shelf life at ${Math.round(factor * 100)}% of normal`
    };
  }
  return call('POST', '/weather', { temperature_c });
}
