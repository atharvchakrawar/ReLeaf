import React, { useState } from 'react';
import { getShelters, updateShelter, reduceDemand } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';

export default function ShelterPage() {
  const [shelters, setShelters] = useState(null);
  const [reduceForm, setReduceForm] = useState({});
  const [msgs, setMsgs] = useState({});

  usePolling(async () => {
    const data = await getShelters();
    setShelters(data);
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

  const handleReduceDemand = async (shelter) => {
    const key = shelter.id;
    const f = reduceForm[key] || { item_type: Object.keys(shelter.demand)[0] || '', amount: 10 };
    try {
      await reduceDemand(shelter.id, f.item_type, Number(f.amount));
      setShelters(ss => ss.map(s => {
        if (s.id !== shelter.id) return s;
        const newDemand = { ...s.demand };
        newDemand[f.item_type] = Math.max(0, (newDemand[f.item_type] || 0) - Number(f.amount));
        return { ...s, demand: newDemand };
      }));
      flash(`${shelter.id}_reduce`, `✓ Reduced ${f.item_type} by ${f.amount}`, true);
    } catch (e) { flash(`${shelter.id}_reduce`, '✗ ' + e.message, false); }
  };

  return (
    <div className="page">
      <h1 className="page-title">🏠 Shelter Management</h1>

      {shelters === null ? (
        <div className="spinner" />
      ) : shelters.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏚️</div>
          <p>No shelters registered yet.</p>
        </div>
      ) : (
        shelters.map(shelter => {
          const rf = reduceForm[shelter.id] || { item_type: Object.keys(shelter.demand)[0] || '', amount: 10 };
          const demandItems = Object.keys(shelter.demand);

          return (
            <div className="card" key={shelter.id} style={{ marginBottom: 20 }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1.15rem' }}>{shelter.name}</span>
                  <span style={{ marginLeft: 10 }}>
                    <span className={`badge badge-${shelter.is_open ? 'open' : 'closed'}`}>
                      {shelter.is_open ? 'Open' : 'Closed'}
                    </span>
                  </span>
                </div>
                <span style={{ fontSize: '0.82rem', color: '#888' }}>
                  📍 {shelter.location.lat.toFixed(3)}, {shelter.location.lng.toFixed(3)}
                </span>
              </div>

              {/* Toggles */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 14 }}>
                {[
                  { field: 'is_open', label: '🏠 Open' },
                  { field: 'has_clean_water', label: '💧 Clean Water' },
                  { field: 'has_cooking_fuel', label: '🔥 Cooking Fuel' }
                ].map(({ field, label }) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={!!shelter[field]}
                      onChange={() => handleToggle(shelter, field)}
                      style={{ width: 16, height: 16 }}
                    />
                    {label}
                    {msgs[`${shelter.id}_${field}`] && (
                      <span className={`flash ${msgs[`${shelter.id}_${field}`].ok ? 'flash-ok' : 'flash-err'}`}>
                        {msgs[`${shelter.id}_${field}`].msg}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {/* Demand Table */}
              <div className="section-title" style={{ fontSize: '0.95rem', marginBottom: 8 }}>📊 Demand</div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Item</th><th>Demand</th><th>Incoming</th><th>Free Space</th></tr>
                  </thead>
                  <tbody>
                    {demandItems.map(item => (
                      <tr key={item}>
                        <td>{item}</td>
                        <td><b>{shelter.demand[item]}</b></td>
                        <td style={{ color: 'var(--blue)' }}>{shelter.incoming?.[item] || 0}</td>
                        <td style={{ color: (shelter.free_space?.[item] || 0) === 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                          {shelter.free_space?.[item] ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reduce Demand */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>Reduce demand:</span>
                <select className="form-select" style={{ padding: '5px 8px', fontSize: '0.85rem' }}
                  value={rf.item_type}
                  onChange={e => setReduceForm(f => ({ ...f, [shelter.id]: { ...rf, item_type: e.target.value } }))}>
                  {demandItems.map(item => <option key={item}>{item}</option>)}
                </select>
                <input className="form-input" type="number" min="1" value={rf.amount}
                  onChange={e => setReduceForm(f => ({ ...f, [shelter.id]: { ...rf, amount: e.target.value } }))}
                  style={{ width: 70, padding: '5px 8px', fontSize: '0.85rem' }} />
                <button className="btn btn-orange btn-sm" onClick={() => handleReduceDemand(shelter)}>
                  Reduce
                </button>
                {msgs[`${shelter.id}_reduce`] && (
                  <span className={`flash ${msgs[`${shelter.id}_reduce`].ok ? 'flash-ok' : 'flash-err'}`}>
                    {msgs[`${shelter.id}_reduce`].msg}
                  </span>
                )}
              </div>

              {/* Incoming Deliveries */}
              {shelter.incoming_deliveries && shelter.incoming_deliveries.length > 0 && (
                <>
                  <div className="section-title" style={{ fontSize: '0.95rem', marginBottom: 8 }}>🚚 Incoming Deliveries</div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Item</th><th>Qty</th><th>Rider</th><th>ETA</th><th>Status</th><th>Confirm Code</th></tr>
                      </thead>
                      <tbody>
                        {shelter.incoming_deliveries.map(d => (
                          <tr key={d.assignment_id}>
                            <td>{d.item_type}</td>
                            <td>{d.qty}</td>
                            <td>{d.rider_name}</td>
                            <td>{d.eta_minutes} min</td>
                            <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                            <td><span className="confirm-code">{d.confirm_code}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {(!shelter.incoming_deliveries || shelter.incoming_deliveries.length === 0) && (
                <div style={{ color: '#888', fontSize: '0.85rem' }}>No incoming deliveries.</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
