import React, { useState } from 'react';
import { getShelters, updateShelter, getAssignments } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food', medical: '💊 Medical',
  ration_kit: '📦 Ration Kit', infant_formula: '🍼 Infant Formula'
};

function ShelterCard({ shelter, assignments, onToggle, msgs }) {
  // Find incoming deliveries for this shelter from assignments
  const incoming_deliveries = assignments.filter(
    a => a.shelter_id === shelter.id && ['reserved', 'in_transit'].includes(a.status)
  );

  const freeSpace = (item) => {
    const demand = (shelter.demand || {})[item] || 0;
    const inc = (shelter.incoming || {})[item] || 0;
    return Math.max(0, demand - inc);
  };

  const depOk = shelter.has_clean_water && shelter.has_cooking_fuel;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{shelter.name}</span>
          <span className={`badge badge-${shelter.kind}`}>{shelter.kind}</span>
          <span className={`badge badge-${shelter.is_open ? 'available' : 'failed'}`}>
            {shelter.is_open ? 'Open' : 'Closed'}
          </span>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
          📍 {shelter.lat?.toFixed(3)}, {shelter.lng?.toFixed(3)}
        </span>
      </div>

      {/* Toggles (only for real shelters) */}
      {shelter.kind === 'shelter' && (
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
          {[
            { field: 'is_open',          label: '🏠 Open' },
            { field: 'has_clean_water',  label: '💧 Clean Water' },
            { field: 'has_cooking_fuel', label: '🔥 Cooking Fuel' }
          ].map(({ field, label }) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={!!shelter[field]}
                onChange={() => onToggle(shelter, field)} style={{ width: 16, height: 16 }} />
              {label}
              {msgs[`${shelter.id}_${field}`] && (
                <span className={`flash ${msgs[`${shelter.id}_${field}`].ok ? 'flash-ok' : 'flash-err'}`}>
                  {msgs[`${shelter.id}_${field}`].msg}
                </span>
              )}
            </label>
          ))}
        </div>
      )}

      {/* Dependency warnings */}
      {shelter.kind === 'shelter' && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {!shelter.has_clean_water && (
            <div className="alert alert-warn" style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
              ⚠️ No clean water — infant_formula and ration_kit blocked
            </div>
          )}
          {shelter.has_clean_water && !shelter.has_cooking_fuel && (
            <div className="alert alert-warn" style={{ padding: '4px 10px', fontSize: '0.82rem' }}>
              ⚠️ No cooking fuel — ration_kit blocked
            </div>
          )}
        </div>
      )}

      {/* Demand table */}
      {shelter.kind !== 'salvage' && Object.keys(shelter.demand || {}).length > 0 && (
        <>
          <div className="section-title" style={{ fontSize: '0.92rem', marginBottom: 6 }}>📊 Demand</div>
          <div className="table-wrap" style={{ marginBottom: 14 }}>
            <table>
              <thead>
                <tr><th>Item</th><th>Demand</th><th>Incoming</th><th>Free Space</th></tr>
              </thead>
              <tbody>
                {Object.keys(shelter.demand).map(item => (
                  <tr key={item}>
                    <td><span className={`badge badge-${item}`}>{ITEM_LABELS[item] || item}</span></td>
                    <td><b>{shelter.demand[item]}</b></td>
                    <td style={{ color: 'var(--blue)' }}>{shelter.incoming?.[item] || 0}</td>
                    <td style={{ fontWeight: 600, color: freeSpace(item) === 0 ? 'var(--red)' : 'var(--green)' }}>
                      {freeSpace(item)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Incoming deliveries */}
      {incoming_deliveries.length > 0 && (
        <>
          <div className="section-title" style={{ fontSize: '0.92rem', marginBottom: 6 }}>🚚 Incoming Deliveries</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Assignment</th><th>Item</th><th>Qty</th>
                  <th>ETA</th><th>Status</th><th>Confirm Code</th>
                </tr>
              </thead>
              <tbody>
                {incoming_deliveries.map(d => (
                  <tr key={d.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{d.id}</td>
                    <td>{ITEM_LABELS[d.item_type] || d.item_type || '—'}</td>
                    <td>{d.quantity}</td>
                    <td>{d.eta_minutes?.toFixed(1)} min</td>
                    <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                    <td><span className="confirm-code">{d.confirm_code}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {incoming_deliveries.length === 0 && shelter.kind !== 'salvage' && (
        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No incoming deliveries right now.</div>
      )}
    </div>
  );
}

export default function ShelterPage() {
  const [shelters, setShelters] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [msgs, setMsgs] = useState({});

  usePolling(async () => { setShelters(await getShelters()); }, 2000);
  usePolling(async () => { setAssignments(await getAssignments()); }, 2000);

  const flash = (key, msg, ok) => {
    setMsgs(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setMsgs(m => { const c = { ...m }; delete c[key]; return c; }), 3000);
  };

  const handleToggle = async (shelter, field) => {
    try {
      await updateShelter(shelter.id, { [field]: !shelter[field] });
      setShelters(ss => ss.map(s => s.id === shelter.id ? { ...s, [field]: !s[field] } : s));
      flash(`${shelter.id}_${field}`, '✓ Updated', true);
    } catch (e) { flash(`${shelter.id}_${field}`, '✗ ' + e.message, false); }
  };

  if (shelters === null) return <div className="page"><h1 className="page-title">🏠 Shelter Management</h1><div className="spinner" /></div>;

  const normalShelters = shelters.filter(s => s.kind === 'shelter');
  const salvageSinks   = shelters.filter(s => s.kind === 'salvage');

  return (
    <div className="page">
      <h1 className="page-title">🏠 Shelter Management</h1>

      {normalShelters.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🏚️</div><p>No shelters registered.</p></div>
      ) : (
        normalShelters.map(s => (
          <ShelterCard key={s.id} shelter={s} assignments={assignments} onToggle={handleToggle} msgs={msgs} />
        ))
      )}

      {/* Salvage Sinks */}
      {salvageSinks.length > 0 && (
        <>
          <hr className="section-divider" />
          <div className="section-title">♻️ Salvage Sinks</div>
          <div className="alert alert-info" style={{ marginBottom: 14 }}>
            Salvage sinks accept <b>cooked_food</b> only when rerouting fails. They never need dependencies.
          </div>
          {salvageSinks.map(s => (
            <ShelterCard key={s.id} shelter={s} assignments={assignments} onToggle={handleToggle} msgs={msgs} />
          ))}
        </>
      )}
    </div>
  );
}
