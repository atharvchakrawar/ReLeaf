# ReLeaf Frontend

## Quick Start
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173

## Mock Mode
`src/api.js` has `USE_MOCK = true` by default — the app runs fully without any backend.  
Set `USE_MOCK = false` when the backend is running at `http://localhost:8000`.

## Pages

| Page | What it does |
|------|-------------|
| **Dashboard** | Live stats, batch list, rider list, assignments table, event timeline |
| **Donor** | Create food batches, click a batch to find delivery plans, assign or auto-dispatch |
| **Rider** | Pick a rider, manage jobs — pickup / deliver (with confirm code) / cancel / heartbeat |
| **Shelter** | Manage shelter flags, view demand table, reduce demand, see incoming deliveries with confirm codes |
| **Control Panel** | Reset sim, change speed, create tight batches, kill riders, fill/close shelters, chaos testing, weather |
| **Map** | Live Leaflet map — donors (blue), shelters (green/gray), riders (orange) |

## Key Features
- 🔄 Polls every 2 s — no page refresh needed
- 🌿 **Plan B** fallback shelters on every assignment, highlighted orange when rerouted
- 📊 **Confidence bars** green/orange/red based on score
- ⚠️ **Blocked rider hints** with unlock instructions
- 💥 **Chaos testing** with resilience score card
- 🌡️ **Weather** effects on shelf life
- 🗺️ **Live Leaflet map** with urgency-colour-coded markers
- 📴 Graceful offline banner when backend is unreachable
- ✅ Loading spinners on first load, empty states on every section
