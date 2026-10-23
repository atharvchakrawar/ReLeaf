import React from 'react';

const PAGES = ['Dashboard', 'Donor', 'Rider', 'Shelter', 'Control Panel', 'Map'];

export default function Nav({ page, setPage, clock }) {
  return (
    <nav className="nav">
      <span className="nav-brand">🌿 ReLeaf</span>
      {PAGES.map(p => (
        <button
          key={p}
          className={`nav-link${page === p ? ' active' : ''}`}
          onClick={() => setPage(p)}
        >
          {p}
        </button>
      ))}
      {clock && (
        <div className="clock-bar">
          <span className="clock-time">
            🕐 {new Date(clock.sim_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="clock-speed">{clock.speed}×</span>
        </div>
      )}
    </nav>
  );
}
