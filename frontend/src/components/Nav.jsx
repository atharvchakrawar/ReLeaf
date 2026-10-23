import React from 'react';

const PAGES = ['Dashboard', 'Donor', 'Rider', 'Shelter', 'Control Panel', 'Map'];

const PAGE_ICONS = {
  Dashboard: '📊',
  Donor: '🥡',
  Rider: '🛵',
  Shelter: '🏠',
  'Control Panel': '⚙️',
  Map: '🗺️',
};

export default function Nav({ page, setPage, clock, dark, setDark }) {
  // Format sim time from sim_time ISO string or float minutes to HH:MM
  const formatClock = (clk) => {
    if (!clk) return '--:--';
    if (clk.sim_time) {
      return clk.sim_time.slice(11, 16);
    }
    if (clk.now != null) {
      const h = Math.floor(clk.now / 60) % 24;
      const m = Math.floor(clk.now % 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    return '--:--';
  };

  return (
    <nav className="nav">
      <span className="nav-brand">
        <span className="brand-leaf">🌿</span> ReLeaf
      </span>

      {PAGES.map(p => (
        <button
          key={p}
          className={`nav-link${page === p ? ' active' : ''}`}
          onClick={() => setPage(p)}
          title={p}
        >
          <span style={{ marginRight: 4 }}>{PAGE_ICONS[p]}</span>
          {p}
        </button>
      ))}

      <div className="clock-bar">
        {clock ? (
          <>
            <span className="clock-time">🕐 {formatClock(clock)}</span>
            <span className="clock-speed">{clock.speed ?? 1}×</span>
          </>
        ) : (
          <span className="clock-time" style={{ opacity: 0.5 }}>🕐 --:--</span>
        )}

        {/* Dark mode toggle */}
        <button
          className="dark-toggle"
          onClick={() => setDark(d => !d)}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle dark mode"
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>
    </nav>
  );
}
