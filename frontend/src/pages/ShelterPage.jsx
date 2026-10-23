import React, { useState } from 'react';
import { getShelters, updateShelter, getAssignments } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food',
  medical: '💊 Medical',
  ration_kit: '📦 Ration Kit',
  infant_formula: '🍼 Infant Formula',
  'Cooked Meals': '🍱 Cooked Meals',
  Bread: '🍞 Bread',
  Rice: '🍚 Rice',
  'Medical Kits': '💊 Medical Kits',
  'Raw Ration': '📦 Raw Ration'
};

const getKind = (s) => s.kind || (s.id?.startsWith('sv') ? 'salvage' : 'shelter');

function ShelterCard({ shelter, assignments, onToggle, msgs }) {
  const kind = getKind(shelter);

  // Deliveries can come directly from backend shelter object or assignments list
  const incoming_deliveries = (shelter.incoming_deliveries && shelter.incoming_deliveries.length > 0)
    ? shelter.incoming_deliveries
    : (assignments || []).filter(
        a => a.shelter_id === shelter.id && ['reserved', 'in_transit', 'pending'].includes(a.status)
      );

  const freeSpace = (item) => {
    if (shelter.free_space && shelter.free_space[item] !== undefined) {
      return shelter.free_space[item];
    }
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
          <span className={`badge badge-${kind}`}>{kind}</span>
          <span className={`badge badge-${shelter.is_open ? 'available' : 'failed'}`}>
            {shelter.is_open ? 'Open' : 'Closed'}
          </span>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#aaa' }}>
          📍 {(shelter.lat ?? shelter.location?.lat)?.toFixed(3)}, {(shelter.lng ?? shelter.location?.lng)?.toFixed(3)}
        </span>
      </div>

      {/* Toggles (only for real shelters) */}
      {kind === 'shelter' && (
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
                <span className={`flash ${msgs[`${shelter.id}_${field}`].ok ? 'flash-ok' : 'flash-err'}`} style={{ fontSize: '0.75rem', padding: '1px 6px' }}>
                  {msgs[`${shelter.id}_${field}`].msg}
                </span>
              )}
            </label>
          ))}
          {!depOk && shelter.is_open && (
            <span style={{ fontSize: '0.8rem', color: 'var(--orange)', display: 'flex', alignItems: 'center', gap: 4 }}>
              ⚠️ Missing water/fuel — cooked food blocked by Rule 3
            </span>
          )}
        </div>
      )}

      {/* Demand table */}
      {shelter.demand && Object.keys(shelter.demand).length > 0 && (
        <>
          <div className="section-title" style={{ fontSize: '0.92rem', marginBottom: 6 }}>📊 Demand vs Capacity</div>
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
                  <th>Rider</th><th>ETA</th><th>Status</th><th>Confirm Code</th>
                </tr>
              </thead>
              <tbody>
                {incoming_deliveries.map((d, i) => {
                  const aid = d.assignment_id || d.id || `inc-${i}`;
                  const qty = d.qty ?? d.quantity;
                  const eta = d.eta_minutes != null ? `${Number(d.eta_minutes).toFixed(1)} min` : '—';
                  return (
                    <tr key={aid}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{aid}</td>
                      <td>{ITEM_LABELS[d.item_type] || d.item_type || '—'}</td>
                      <td>{qty}</td>
                      <td><b>{d.rider_name || 'Assigned Rider'}</b></td>
                      <td>{eta}</td>
                      <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                      <td>
                        <span className="confirm-code" style={{ fontSize: '1.2rem', padding: '2px 10px' }}>
                          {d.confirm_code}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {incoming_deliveries.length === 0 && kind !== 'salvage' && (
        <div style={{ color: '#aaa', fontSize: '0.85rem' }}>No incoming deliveries right now.</div>
      )}
    </div>
  );
}

export default function ShelterPage() {
  const [shelters, setShelters] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [msgs, setMsgs] = useState({});

  usePolling(async () => {
    try { setShelters(await getShelters()); } catch (e) { console.error(e); }
  }, 2000);
  usePolling(async () => {
    try { setAssignments(await getAssignments()); } catch (e) { console.error(e); }
  }, 2000);

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

  const normalShelters = shelters.filter(s => getKind(s) !== 'salvage');
  const salvageSinks   = shelters.filter(s => getKind(s) === 'salvage');

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
