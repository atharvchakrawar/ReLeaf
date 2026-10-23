# ReLeaf Frontend

## Install
```
cd frontend
npm install
```

## Run
```
npm run dev
```

## Mock Mode
Set `USE_MOCK = true` in `src/api.js` to run without the backend.  
Set `USE_MOCK = false` and ensure the backend is running at http://localhost:8000.

## Pages
- **Dashboard** — live stats, batches, riders, assignments, event timeline
- **Donor** — create food batches, view plans, assign or auto-dispatch
- **Rider** — pick a rider, manage jobs, pickup/deliver/cancel
- **Shelter** — manage shelter settings, view incoming deliveries with confirm codes
- **Control Panel** — simulation controls, chaos testing, weather effects
- **Map** — live map with donor, shelter, and rider markers

## Features
- 🔄 All data polls every 2 seconds
- 🌿 Plan B fallback shelters shown on every assignment
- 📊 Confidence bars colored by score (green/orange/red)
- ⚠️ Blocked rider hints with unlock instructions
- 💥 Chaos testing with resilience score
- 🌡️ Weather effects on shelf life
- 🗺️ Live Leaflet map
- 📴 Graceful offline banner when backend is unreachable
