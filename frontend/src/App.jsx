import React, { useState } from 'react';
import './styles.css';
import Nav from './components/Nav.jsx';
import { usePolling } from './hooks/usePolling.js';
import { getClock } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import DonorPage from './pages/DonorPage.jsx';
import RiderPage from './pages/RiderPage.jsx';
import ShelterPage from './pages/ShelterPage.jsx';
import ControlPanel from './pages/ControlPanel.jsx';
import MapPage from './pages/MapPage.jsx';

function formatSimTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ts; }
}

export default function App() {
  const [page, setPage] = useState('Dashboard');
  const [clock, setClock] = useState(null);
  const [apiError, setApiError] = useState(false);

  usePolling(async () => {
    try {
      const c = await getClock();
      setClock(c);
      setApiError(false);
    } catch {
      setApiError(true);
    }
  }, 2000);

  const renderPage = () => {
    switch (page) {
      case 'Dashboard':    return <Dashboard />;
      case 'Donor':        return <DonorPage />;
      case 'Rider':        return <RiderPage />;
      case 'Shelter':      return <ShelterPage />;
      case 'Control Panel': return <ControlPanel />;
      case 'Map':          return <MapPage />;
      default:             return <Dashboard />;
    }
  };

  return (
    <div>
      <Nav page={page} setPage={setPage} />

      {clock && (
        <div style={{ background: '#f0f9f0', borderBottom: '1px solid var(--border)', padding: '6px 24px', display: 'flex', gap: 12, alignItems: 'center', fontSize: '0.85rem' }}>
          <span>🕐 Sim Time: <b>{formatSimTime(clock.sim_time)}</b></span>
          <span style={{ background: 'var(--green-bg)', color: 'var(--green)', padding: '1px 8px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 700 }}>
            {clock.speed}× speed
          </span>
          {apiError && <span style={{ color: 'var(--orange)', fontWeight: 600 }}>⚠️ Backend offline — showing mock data</span>}
        </div>
      )}

      {!clock && apiError && (
        <div className="alert alert-warn" style={{ margin: '10px 24px 0', borderRadius: 6 }}>
          ⚠️ Backend offline — showing mock data
        </div>
      )}

      {renderPage()}
    </div>
  );
}
