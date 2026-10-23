import React from 'react';

const PAGES = ['Dashboard', 'Donor', 'Rider', 'Shelter', 'Control Panel', 'Map'];

export default function Nav({ page, setPage }) {
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
    </nav>
  );
}
