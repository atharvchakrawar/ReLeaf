// api.js — ReLeaf API client
// Set USE_MOCK = false when the backend is running at http://localhost:8000
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
// MOCK DATA
// ============================================================

const MOCK_CLOCK = { now: 12.5, speed: 1 };

const MOCK_STATS = {
  delivered_qty: 120,
  wasted_qty: 8,
  in_transit_qty: 40,
  salvaged_qty: 15,
  reroutes: 4,
  avg_delivery_minutes: 18.5
};

const MOCK_WEATHER = { temp_c: 30 };

let MOCK_BATCHES = [
  {
    id: 'b1', donor_name: 'Green Kitchen', item_type: 'cooked_food',
    quantity: 50, remaining_qty: 30, expires_at: 90.0,
    lat: 18.52, lng: 73.85,
    status: 'open', risk: 'safe', safe_minutes_left: 45.0
  },
  {
    id: 'b2', donor_name: 'Sunrise Bakery', item_type: 'cooked_food',
    quantity: 80, remaining_qty: 80, expires_at: 40.0,
    lat: 18.515, lng: 73.848,
    status: 'open', risk: 'urgent', safe_minutes_left: 22.0
  },
  {
    id: 'b3', donor_name: 'City Medical Store', item_type: 'medical',
    quantity: 20, remaining_qty: 0, expires_at: 200.0,
    lat: 18.525, lng: 73.855,
    status: 'fully_assigned', risk: 'safe', safe_minutes_left: 150.0
  },
  {
    id: 'b4', donor_name: 'Relief NGO', item_type: 'ration_kit',
    quantity: 60, remaining_qty: 60, expires_at: 18.0,
    lat: 18.51, lng: 73.84,
    status: 'open', risk: 'critical', safe_minutes_left: 8.0
  },
  {
    id: 'b5', donor_name: "Mother's Aid", item_type: 'infant_formula',
    quantity: 30, remaining_qty: 30, expires_at: 120.0,
    lat: 18.518, lng: 73.852,
    status: 'open', risk: 'safe', safe_minutes_left: 60.0
  }
];

let MOCK_SHELTERS = [
  {
    id: 's1', name: 'Hope House', kind: 'shelter',
    lat: 18.53, lng: 73.86, is_open: true,
    demand: { cooked_food: 50, ration_kit: 40 },
    incoming: { cooked_food: 20 },
    has_clean_water: true, has_cooking_fuel: true
  },
  {
    id: 's2', name: 'City Shelter', kind: 'shelter',
    lat: 18.528, lng: 73.858, is_open: true,
    demand: { cooked_food: 30, infant_formula: 20, medical: 10 },
    incoming: { medical: 20 },
    has_clean_water: true, has_cooking_fuel: false
  },
  {
    id: 's3', name: 'East Camp', kind: 'shelter',
    lat: 18.535, lng: 73.862, is_open: false,
    demand: { cooked_food: 60 },
    incoming: {},
    has_clean_water: false, has_cooking_fuel: false
  },
  // Salvage sinks
  {
    id: 'sv1', name: 'Community Fridge', kind: 'salvage',
    lat: 18.522, lng: 73.848, is_open: true,
    demand: { cooked_food: 9999 },
    incoming: {},
    has_clean_water: false, has_cooking_fuel: false
  },
  {
    id: 'sv2', name: 'Animal Feed Depot', kind: 'salvage',
    lat: 18.527, lng: 73.843, is_open: true,
    demand: { cooked_food: 9999 },
    incoming: {},
    has_clean_water: false, has_cooking_fuel: false
  }
];

let MOCK_RIDERS = [
  {
    id: 'r1', name: 'Amit Kumar', capacity: 40,
    lat: 18.521, lng: 73.851,
    status: 'available', last_heartbeat: 12.3,
    reliability: 92, has_insulated_bag: true
  },
  {
    id: 'r2', name: 'Raj Patel', capacity: 30,
    lat: 18.519, lng: 73.849,
    status: 'in_transit', last_heartbeat: 12.0,
    reliability: 67, has_insulated_bag: false
  },
  {
    id: 'r3', name: 'Priya Singh', capacity: 50,
    lat: 18.523, lng: 73.853,
    status: 'available', last_heartbeat: 12.4,
    reliability: 88, has_insulated_bag: true
  },
  {
    id: 'r4', name: 'Deepak Sharma', capacity: 25,
    lat: 18.517, lng: 73.846,
    status: 'unresponsive', last_heartbeat: 6.5,
    reliability: 45, has_insulated_bag: false
  }
];

let MOCK_ASSIGNMENTS = [
  {
    id: 'a1', batch_id: 'b3', rider_id: 'r2', shelter_id: 's2',
    quantity: 20, status: 'in_transit', stage: 'to_shelter',
    eta_minutes: 8.0, lease_expires_at: 25.0, deliver_by: 180.0,
    reroute_count: 0, reason: null,
    backup_shelter_id: 's1', backup_rider_id: null,
    confidence: 75, confirm_code: '7423',
    why: ['Raj Patel: reliability 67, nearest available', 'City Shelter: 10 free slots for medical']
  },
  {
    id: 'a2', batch_id: 'b1', rider_id: 'r1', shelter_id: 's1',
    quantity: 20, status: 'reserved', stage: 'to_pickup',
    eta_minutes: 14.0, lease_expires_at: 22.5, deliver_by: 80.0,
    reroute_count: 1, reason: 'Rerouted from East Camp — shelter closed',
    backup_shelter_id: 's2', backup_rider_id: null,
    confidence: 82, confirm_code: '1892',
    why: ['Amit Kumar: reliability 92, insulated bag, 4 min away', 'Hope House: 30 free cooked_food slots']
  }
];

let MOCK_EVENTS = [
  { time: 12.5, message: 'Assignment a2 rerouted to Hope House — East Camp closed', level: 'warning' },
  { time: 12.0, message: 'Raj Patel picked up 20 medical for City Shelter', level: 'info' },
  { time: 11.5, message: 'Rider Deepak Sharma heartbeat lost — marking unresponsive', level: 'error' },
  { time: 11.0, message: 'Amit Kumar assigned batch b1 (20 cooked_food) → Hope House', level: 'info' },
  { time: 10.5, message: 'Batch b4 ration_kit: risk escalated to CRITICAL (8 min left)', level: 'warning' },
  { time: 10.0, message: 'Priya Singh delivered 30 cooked_food to City Shelter', level: 'info' }
];

const MOCK_PLANS = {
  b1: {
    plans: [
      {
        rider_id: 'r1', rider_name: 'Amit Kumar',
        shelter_id: 's1', shelter_name: 'Hope House',
        quantity: 20, eta_minutes: 22, safe_margin_minutes: 23,
        score: 0.87,
        why: ['Amit Kumar: reliability 92, insulated bag reduces heat risk', 'Hope House: 30 free cooked_food slots, all dependencies met']
      },
      {
        rider_id: 'r3', rider_name: 'Priya Singh',
        shelter_id: 's2', shelter_name: 'City Shelter',
        quantity: 20, eta_minutes: 28, safe_margin_minutes: 17,
        score: 0.71,
        why: ['Priya Singh: reliability 88, capacity 50', 'City Shelter: 30 free slots but no cooking fuel — ration_kit blocked']
      }
    ],
    blocked: [
      {
        shelter_id: 's3', reason: 'East Camp is closed',
        unlock_hint: 'Reopen East Camp to unlock 60 cooked_food slots'
      }
    ]
  }
};

const MOCK_RESILIENCE = {
  failures_injected: 5, recovered: 3, salvaged: 1, failed: 1,
  score: 60
};

// ============================================================
// API FUNCTIONS
// ============================================================

// --- Clock ---
export async function getClock() {
  if (USE_MOCK) return { ...MOCK_CLOCK };
  return call('GET', '/clock');
}
export async function setClockSpeed(speed) {
  if (USE_MOCK) { MOCK_CLOCK.speed = speed; return { ...MOCK_CLOCK }; }
  return call('POST', '/clock/speed', { speed });
}
export async function advanceClock(minutes) {
  if (USE_MOCK) { MOCK_CLOCK.now += minutes; return { ...MOCK_CLOCK }; }
  return call('POST', '/clock/advance', { minutes });
}

// --- Stats ---
export async function getStats() {
  if (USE_MOCK) return { ...MOCK_STATS };
  return call('GET', '/stats');
}

// --- Weather ---
export async function getWeather() {
  if (USE_MOCK) return { ...MOCK_WEATHER };
  return call('GET', '/weather');
}
export async function setWeather(temp_c) {
  if (USE_MOCK) {
    MOCK_WEATHER.temp_c = temp_c;
    const factor = temp_c <= 25 ? 1.0 : temp_c <= 35 ? 1.3 : 1.6;
    const reduction = Math.round((1 - 1 / factor) * 100);
    return { temp_c, note: `Heat factor ${factor}×. Shelf life reduced by ~${reduction}%.` };
  }
  return call('POST', '/weather', { temp_c });
}

// --- Batches ---
export async function getBatches() {
  if (USE_MOCK) return [...MOCK_BATCHES];
  return call('GET', '/batches');
}
export async function createBatch(data) {
  if (USE_MOCK) {
    const nb = {
      id: `b${Date.now()}`,
      donor_name: data.donor_name,
      item_type: data.item_type,
      quantity: data.quantity,
      remaining_qty: data.quantity,
      expires_at: MOCK_CLOCK.now + data.expires_in_minutes,
      lat: data.lat, lng: data.lng,
      status: 'open', risk: 'safe',
      safe_minutes_left: data.expires_in_minutes
    };
    MOCK_BATCHES.push(nb);
    return nb;
  }
  return call('POST', '/batches', data);
}

// --- Suggest / Auto-dispatch ---
export async function suggestPlans(batchId) {
  if (USE_MOCK) return MOCK_PLANS[batchId] || { plans: [], blocked: [] };
  return call('POST', `/batches/${batchId}/suggest`);
}
export async function autoDispatch(batchId) {
  if (USE_MOCK) {
    const a = {
      id: `a${Date.now()}`, batch_id: batchId, rider_id: 'r1', shelter_id: 's1',
      quantity: 20, status: 'reserved', stage: 'to_pickup',
      eta_minutes: 22, lease_expires_at: MOCK_CLOCK.now + 10, deliver_by: MOCK_CLOCK.now + 80,
      reroute_count: 0, reason: null,
      backup_shelter_id: 's2', backup_rider_id: null,
      confidence: 82, confirm_code: String(Math.floor(1000 + Math.random() * 9000)),
      why: ['Auto-selected best plan: Amit Kumar → Hope House']
    };
    MOCK_ASSIGNMENTS.push(a);
    return [a];
  }
  return call('POST', `/batches/${batchId}/auto-dispatch`);
}

// --- Assignments ---
export async function getAssignments() {
  if (USE_MOCK) return [...MOCK_ASSIGNMENTS];
  return call('GET', '/assignments');
}
export async function createAssignment(data) {
  // data: {batch_id, rider_id, shelter_id, quantity}
  if (USE_MOCK) {
    const a = {
      id: `a${Date.now()}`, ...data,
      status: 'reserved', stage: 'to_pickup',
      eta_minutes: 20, lease_expires_at: MOCK_CLOCK.now + 10, deliver_by: MOCK_CLOCK.now + 60,
      reroute_count: 0, reason: null,
      backup_shelter_id: 's2', backup_rider_id: null,
      confidence: 80, confirm_code: String(Math.floor(1000 + Math.random() * 9000)),
      why: ['Manually assigned']
    };
    MOCK_ASSIGNMENTS.push(a);
    return a;
  }
  return call('POST', '/assignments', data);
}
export async function assignPickup(assignmentId) {
  if (USE_MOCK) return { status: 'ok' };
  return call('POST', `/assignments/${assignmentId}/pickup`);
}
export async function assignDeliver(assignmentId, code) {
  if (USE_MOCK) {
    const a = MOCK_ASSIGNMENTS.find(x => x.id === assignmentId);
    if (a && a.confirm_code !== code) throw new Error(`Wrong code. Expected ${a.confirm_code}`);
    if (a) a.status = 'delivered';
    return { status: 'delivered' };
  }
  return call('POST', `/assignments/${assignmentId}/deliver`, { code });
}
export async function assignCancel(assignmentId) {
  if (USE_MOCK) {
    const a = MOCK_ASSIGNMENTS.find(x => x.id === assignmentId);
    if (a) a.status = 'released';
    return { status: 'released' };
  }
  return call('POST', `/assignments/${assignmentId}/cancel`);
}

// --- Riders ---
export async function getRiders() {
  if (USE_MOCK) return [...MOCK_RIDERS];
  return call('GET', '/riders');
}
export async function riderHeartbeat(riderId) {
  if (USE_MOCK) {
    const r = MOCK_RIDERS.find(x => x.id === riderId);
    if (r) r.last_heartbeat = MOCK_CLOCK.now;
    return { now: MOCK_CLOCK.now };
  }
  return call('POST', `/riders/${riderId}/heartbeat`);
}

// Helper: get assignments for a specific rider
export async function getRiderAssignments(riderId) {
  const all = await getAssignments();
  return all.filter(a => a.rider_id === riderId && ['reserved', 'in_transit'].includes(a.status));
}

// --- Shelters ---
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

// --- Events ---
export async function getEvents() {
  if (USE_MOCK) return [...MOCK_EVENTS];
  return call('GET', '/events');
}

// --- Demo / Control ---
export async function demoReset() {
  if (USE_MOCK) { return { status: 'ok' }; }
  return call('POST', '/demo/reset');
}
export async function demoTightBatch() {
  if (USE_MOCK) {
    const b = {
      id: `btight${Date.now()}`, donor_name: 'Demo Tight', item_type: 'cooked_food',
      quantity: 180, remaining_qty: 180,
      expires_at: MOCK_CLOCK.now + 75,
      lat: 18.52, lng: 73.85,
      status: 'open', risk: 'urgent', safe_minutes_left: 75
    };
    MOCK_BATCHES.push(b);
    return b;
  }
  return call('POST', '/demo/tight-batch');
}
export async function demoKillRider(riderId) {
  if (USE_MOCK) {
    const r = MOCK_RIDERS.find(x => x.id === riderId);
    if (r) r.status = 'unresponsive';
    return { status: 'ok' };
  }
  return call('POST', `/demo/kill-rider/${riderId}`);
}
export async function demoFillShelter(shelterId) {
  if (USE_MOCK) {
    const s = MOCK_SHELTERS.find(x => x.id === shelterId);
    if (s) Object.keys(s.demand).forEach(k => { s.demand[k] = 0; });
    return { status: 'ok' };
  }
  return call('POST', `/demo/fill-shelter/${shelterId}`);
}
export async function demoChaos(rounds) {
  if (USE_MOCK) return { status: 'ok', rounds_scheduled: rounds };
  return call('POST', '/demo/chaos', { rounds });
}
export async function demoResilience() {
  if (USE_MOCK) return { ...MOCK_RESILIENCE };
  return call('GET', '/demo/resilience');
}
