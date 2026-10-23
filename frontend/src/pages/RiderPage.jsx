import React, { useState } from 'react';
import { getRiders, getRiderAssignments, assignPickup, assignDeliver, assignCancel, riderHeartbeat, getShelters } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import ScoreBar from '../components/ScoreBar.jsx';

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food', medical: '💊 Medical',
  ration_kit: '📦 Ration Kit', infant_formula: '🍼 Infant Formula'
};

function WhyList({ why }) {
  const [open, setOpen] = useState(false);
  if (!why || why.length === 0) return null;
  return (
    <div style={{ marginTop: 6 }}>
      <button className="expandable-btn" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Hide' : '▼ Why this plan?'}
      </button>
      {open && (
        <ul className="expandable-text" style={{ margin: '6px 0 0', paddingLeft: 16 }}>
          {why.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function RiderPage() {
  const [riders, setRiders] = useState(null);
  const [selectedRider, setSelectedRider] = useState('');
  const [jobs, setJobs] = useState(null);
  const [shelters, setShelters] = useState([]);
  const [actionMsg, setActionMsg] = useState({});
  const [deliverCode, setDeliverCode] = useState({});
  const [hbMsg, setHbMsg] = useState(null);

  usePolling(async () => { setRiders(await getRiders()); }, 2000);
  usePolling(async () => { setShelters(await getShelters()); }, 10000);
  usePolling(async () => {
    if (!selectedRider) return;
    setJobs(await getRiderAssignments(selectedRider));
  }, 2000);

  const flash = (key, msg, ok) => {
    setActionMsg(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setActionMsg(m => { const c = { ...m }; delete c[key]; return c; }), 3500);
  };

  const handlePickup = async (assignmentId) => {
    try { await assignPickup(assignmentId); flash(assignmentId + '_pu', '✓ Picked up!', true); }
    catch (e) { flash(assignmentId + '_pu', '✗ ' + e.message, false); }
  };

  const handleDeliver = async (assignmentId) => {
    const code = deliverCode[assignmentId] || '';
    try {
      await assignDeliver(assignmentId, code);
      flash(assignmentId + '_dl', '✓ Delivered!', true);
      setDeliverCode(c => ({ ...c, [assignmentId]: '' }));
    } catch (e) { flash(assignmentId + '_dl', '✗ ' + e.message, false); }
  };

  const handleCancel = async (assignmentId) => {
    try { await assignCancel(assignmentId); flash(assignmentId + '_cn', '✓ Cancelled', true); }
    catch (e) { flash(assignmentId + '_cn', '✗ ' + e.message, false); }
  };

  const handleHeartbeat = async () => {
    try {
      const res = await riderHeartbeat(selectedRider);
      setHbMsg({ msg: `💓 Heartbeat sent (t=${res.now?.toFixed(1) ?? '—'})`, ok: true });
    } catch (e) { setHbMsg({ msg: '✗ ' + e.message, ok: false }); }
    setTimeout(() => setHbMsg(null), 3000);
  };

  const shelterName = (id) => shelters.find(s => s.id === id)?.name || id;
  const selectedRiderObj = riders?.find(r => r.id === selectedRider);

  return (
    <div className="page">
      <h1 className="page-title">🏍️ Rider Dashboard</h1>

      {/* Rider selector */}
      {riders === null ? <div className="spinner" /> : (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">Select Rider</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" value={selectedRider}
              onChange={e => { setSelectedRider(e.target.value); setJobs(null); }}>
              <option value="">— Pick a rider —</option>
              {riders.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} [{r.status}] · Reliability {r.reliability}% · Cap {r.capacity}
                  {r.has_insulated_bag ? ' 🧊' : ''}
                </option>
              ))}
            </select>
            {selectedRider && (
              <>
                <button className="btn btn-green btn-sm" onClick={handleHeartbeat}>💓 I'm Alive</button>
                {hbMsg && <span className={`flash ${hbMsg.ok ? 'flash-ok' : 'flash-err'}`}>{hbMsg.msg}</span>}
              </>
            )}
          </div>

          {selectedRiderObj && (
            <div style={{ marginTop: 14, display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.87rem' }}>
              <span>Status: <span className={`badge badge-${selectedRiderObj.status}`}>{selectedRiderObj.status}</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                Reliability: <ScoreBar value={selectedRiderObj.reliability / 100} />
                <b>{selectedRiderObj.reliability}%</b>
              </span>
              <span>Capacity: <b>{selectedRiderObj.capacity}</b></span>
              <span>Insulated bag: <b>{selectedRiderObj.has_insulated_bag ? '✅ Yes' : '❌ No'}</b></span>
              <span>Last heartbeat: <b>t={selectedRiderObj.last_heartbeat?.toFixed(1)}</b></span>
            </div>
          )}
        </div>
      )}

      {/* Active jobs */}
      {selectedRider && (
        <>
          <div className="section-title">📋 Active Jobs</div>
          {jobs === null ? <div className="spinner" /> :
          jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛵</div>
              <p>No active jobs assigned to this rider.</p>
            </div>
          ) : (
            jobs.map(job => {
              const bkShelter = job.backup_shelter_id ? shelterName(job.backup_shelter_id) : null;
              const isRerouted = job.reroute_count > 0;
              return (
                <div key={job.id} className="card" style={{
                  marginBottom: 16,
                  borderLeft: `4px solid ${isRerouted ? 'var(--orange)' : job.stage === 'to_shelter' ? 'var(--blue)' : 'var(--green)'}`,
                  background: isRerouted ? '#fffbf0' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>
                        {ITEM_LABELS[job.item_type] || job.item_type} — {job.quantity} units
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#555' }}>→ <b>{shelterName(job.shelter_id)}</b></div>
                      {job.reason && <div style={{ fontSize: '0.8rem', color: 'var(--orange)' }}>⚠️ {job.reason}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <span className={`badge badge-${job.stage}`}>{job.stage.replace('_', ' ')}</span>
                      <span className={`badge badge-${job.status}`}>{job.status}</span>
                      {isRerouted && <span className="badge badge-warning">Rerouted ×{job.reroute_count}</span>}
                    </div>
                  </div>

                  <div className="card-row" style={{ fontSize: '0.85rem', marginBottom: 8 }}>
                    <Countdown safe_minutes_left={job.eta_minutes} expiry_minutes={job.eta_minutes + 20} />
                    <span>ETA: <b>{job.eta_minutes?.toFixed(1)} min</b></span>
                    <span>
                      Confirm Code:
                      <span className="confirm-code" style={{ fontSize: '1.2rem', padding: '3px 14px', marginLeft: 8 }}>
                        {job.confirm_code}
                      </span>
                    </span>
                  </div>

                  {/* Confidence */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.8rem', color: '#555' }}>Confidence:</span>
                    <ScoreBar value={job.confidence / 100} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{job.confidence}%</span>
                    {job.backup_rider_id && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--orange)' }}>
                        🔄 Standby rider warming up
                      </span>
                    )}
                  </div>

                  {/* Plan B */}
                  {bkShelter && (
                    <div style={{ marginBottom: 8 }}>
                      <span className={`planb${isRerouted ? ' rerouted' : ''}`}>
                        🔄 Plan B: {bkShelter}{isRerouted ? ' ← ACTIVE' : ''}
                      </span>
                    </div>
                  )}

                  <WhyList why={job.why} />

                  {/* Action buttons */}
                  <div className="ctrl-row" style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <button className="btn btn-blue btn-sm" onClick={() => handlePickup(job.id)}>📦 Pickup</button>
                    {actionMsg[job.id + '_pu'] && (
                      <span className={`flash ${actionMsg[job.id + '_pu'].ok ? 'flash-ok' : 'flash-err'}`}>
                        {actionMsg[job.id + '_pu'].msg}
                      </span>
                    )}

                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        className="code-input" placeholder="Code" maxLength={4}
                        value={deliverCode[job.id] || ''}
                        onChange={e => setDeliverCode(c => ({ ...c, [job.id]: e.target.value }))}
                      />
                      <button className="btn btn-green btn-sm" onClick={() => handleDeliver(job.id)}>✅ Deliver</button>
                    </span>
                    {actionMsg[job.id + '_dl'] && (
                      <span className={`flash ${actionMsg[job.id + '_dl'].ok ? 'flash-ok' : 'flash-err'}`}>
                        {actionMsg[job.id + '_dl'].msg}
                      </span>
                    )}

                    <button className="btn btn-red btn-sm" onClick={() => handleCancel(job.id)}>✗ Cancel</button>
                    {actionMsg[job.id + '_cn'] && (
                      <span className={`flash ${actionMsg[job.id + '_cn'].ok ? 'flash-ok' : 'flash-err'}`}>
                        {actionMsg[job.id + '_cn'].msg}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <hr className="section-divider" />
        </>
      )}

      {/* All riders table */}
      <div className="section-title">🏍️ All Riders</div>
      {riders === null ? <div className="spinner" /> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Status</th><th>Reliability</th>
                <th>Capacity</th><th>Bag 🧊</th><th>Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {riders.map(r => (
                <tr key={r.id}
                  style={{ cursor: 'pointer', background: selectedRider === r.id ? 'var(--green-bg)' : '' }}
                  onClick={() => { setSelectedRider(r.id); setJobs(null); }}
                >
                  <td><b>{r.name}</b></td>
                  <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ScoreBar value={r.reliability / 100} />
                      <span style={{ fontSize: '0.82rem' }}>{r.reliability}%</span>
                    </div>
                  </td>
                  <td>{r.capacity}</td>
                  <td style={{ textAlign: 'center' }}>{r.has_insulated_bag ? '✅' : '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>t={r.last_heartbeat?.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
