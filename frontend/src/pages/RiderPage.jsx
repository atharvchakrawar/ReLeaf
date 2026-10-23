import React, { useState } from 'react';
import { getRiders, getRiderJobs, riderPickup, riderDeliver, riderCancel, riderHeartbeat } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import ScoreBar from '../components/ScoreBar.jsx';
import ExpandableWhy from '../components/ExpandableWhy.jsx';

export default function RiderPage() {
  const [riders, setRiders] = useState(null);
  const [selectedRider, setSelectedRider] = useState('');
  const [jobs, setJobs] = useState(null);
  const [actionMsg, setActionMsg] = useState({});
  const [deliverCode, setDeliverCode] = useState({});
  const [hbMsg, setHbMsg] = useState(null);

  usePolling(async () => {
    const data = await getRiders();
    setRiders(data);
  }, 2000);

  usePolling(async () => {
    if (!selectedRider) return;
    const data = await getRiderJobs(selectedRider);
    setJobs(data);
  }, 2000);

  const flash = (key, msg, ok) => {
    setActionMsg(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setActionMsg(m => { const c = { ...m }; delete c[key]; return c; }), 3000);
  };

  const handlePickup = async (riderId, assignmentId) => {
    try {
      await riderPickup(riderId, assignmentId);
      flash(assignmentId + '_pickup', '✓ Picked up!', true);
    } catch (e) { flash(assignmentId + '_pickup', '✗ ' + e.message, false); }
  };

  const handleDeliver = async (riderId, assignmentId) => {
    const code = deliverCode[assignmentId] || '';
    try {
      await riderDeliver(riderId, assignmentId, code);
      flash(assignmentId + '_deliver', '✓ Delivered!', true);
      setDeliverCode(c => ({ ...c, [assignmentId]: '' }));
    } catch (e) { flash(assignmentId + '_deliver', '✗ ' + e.message, false); }
  };

  const handleCancel = async (riderId, assignmentId) => {
    try {
      await riderCancel(riderId, assignmentId);
      flash(assignmentId + '_cancel', '✓ Cancelled', true);
    } catch (e) { flash(assignmentId + '_cancel', '✗ ' + e.message, false); }
  };

  const handleHeartbeat = async (riderId) => {
    try {
      const res = await riderHeartbeat(riderId);
      setHbMsg({ msg: `💓 Heartbeat sent at ${new Date(res.last_heartbeat).toLocaleTimeString()}`, ok: true });
    } catch (e) { setHbMsg({ msg: '✗ ' + e.message, ok: false }); }
    setTimeout(() => setHbMsg(null), 3000);
  };

  const selectedRiderObj = riders?.find(r => r.id === selectedRider);

  return (
    <div className="page">
      <h1 className="page-title">🏍️ Rider Dashboard</h1>

      {/* Rider Selector */}
      {riders === null ? (
        <div className="spinner" />
      ) : (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="section-title">Select Rider</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select className="form-select" value={selectedRider} onChange={e => { setSelectedRider(e.target.value); setJobs(null); }}>
              <option value="">— Pick a rider —</option>
              {riders.map(r => (
                <option key={r.id} value={r.id}>
                  {r.name} [{r.status}] — Trust: {Math.round(r.trust_score * 100)}%
                </option>
              ))}
            </select>
            {selectedRider && (
              <>
                <button className="btn btn-green btn-sm" onClick={() => handleHeartbeat(selectedRider)}>
                  💓 I'm Alive
                </button>
                {hbMsg && <span className={`flash ${hbMsg.ok ? 'flash-ok' : 'flash-err'}`}>{hbMsg.msg}</span>}
              </>
            )}
          </div>

          {/* Rider Stats */}
          {selectedRiderObj && (
            <div className="card-row" style={{ marginTop: 14, fontSize: '0.87rem' }}>
              <span>Status: <span className={`badge badge-${selectedRiderObj.status}`}>{selectedRiderObj.status}</span></span>
              <span>Trust: <ScoreBar value={selectedRiderObj.trust_score} /></span>
              <span>Reliability: <ScoreBar value={selectedRiderObj.reliability} /></span>
              <span>Last heartbeat: {new Date(selectedRiderObj.last_heartbeat).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Jobs */}
      {selectedRider && (
        <>
          <div className="section-title">📋 Active Jobs</div>
          {jobs === null ? (
            <div className="spinner" />
          ) : jobs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🛵</div>
              <p>No active jobs assigned to this rider.</p>
            </div>
          ) : (
            jobs.map(job => (
              <div key={job.assignment_id} className={`card${job.status === 'rerouted' ? ' row-rerouted' : ''}`} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{job.item_type} — {job.qty} units</div>
                    <div style={{ color: '#555', fontSize: '0.85rem' }}>→ {job.shelter_name}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className={`badge badge-${job.stage}`}>{job.stage.replace('_', ' ')}</span>
                    <span className={`badge badge-${job.status}`}>{job.status}</span>
                  </div>
                </div>

                <div className="card-row" style={{ fontSize: '0.85rem' }}>
                  <Countdown safe_minutes_left={job.safe_minutes_left} expiry_minutes={120} />
                  <span>ETA: <b>{job.eta_minutes} min</b></span>
                  <span>Confirm code: <span className="confirm-code" style={{ fontSize: '1.1rem', padding: '3px 10px' }}>{job.confirm_code}</span></span>
                </div>

                {/* Plan B */}
                {job.plan_b && (
                  <div style={{ marginTop: 8 }}>
                    <span className={`planb${job.status === 'rerouted' ? ' rerouted' : ''}`}>
                      Plan B: {job.plan_b.shelter_name} ({job.plan_b.eta_minutes} min)
                      {job.status === 'rerouted' && ' ← ACTIVE'}
                    </span>
                  </div>
                )}

                {/* Confidence */}
                <div style={{ marginTop: 8, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.8rem', color: '#555' }}>Confidence:</span>
                  <ScoreBar value={job.confidence} />
                  {job.standby_rider_name && (
                    <span style={{ fontSize: '0.8rem', color: '#555' }}>Standby: <b>{job.standby_rider_name}</b></span>
                  )}
                </div>

                <ExpandableWhy explanation={job.explanation} />

                {/* Actions */}
                <div className="ctrl-row" style={{ marginTop: 12 }}>
                  <button className="btn btn-blue btn-sm" onClick={() => handlePickup(selectedRider, job.assignment_id)}>
                    📦 Pickup
                  </button>
                  {actionMsg[job.assignment_id + '_pickup'] && (
                    <span className={`flash ${actionMsg[job.assignment_id + '_pickup'].ok ? 'flash-ok' : 'flash-err'}`}>
                      {actionMsg[job.assignment_id + '_pickup'].msg}
                    </span>
                  )}

                  <input
                    className="code-input"
                    placeholder="Code"
                    value={deliverCode[job.assignment_id] || ''}
                    onChange={e => setDeliverCode(c => ({ ...c, [job.assignment_id]: e.target.value }))}
                    maxLength={4}
                  />
                  <button className="btn btn-green btn-sm" onClick={() => handleDeliver(selectedRider, job.assignment_id)}>
                    ✅ Deliver
                  </button>
                  {actionMsg[job.assignment_id + '_deliver'] && (
                    <span className={`flash ${actionMsg[job.assignment_id + '_deliver'].ok ? 'flash-ok' : 'flash-err'}`}>
                      {actionMsg[job.assignment_id + '_deliver'].msg}
                    </span>
                  )}

                  <button className="btn btn-red btn-sm" onClick={() => handleCancel(selectedRider, job.assignment_id)}>
                    ✗ Cancel
                  </button>
                  {actionMsg[job.assignment_id + '_cancel'] && (
                    <span className={`flash ${actionMsg[job.assignment_id + '_cancel'].ok ? 'flash-ok' : 'flash-err'}`}>
                      {actionMsg[job.assignment_id + '_cancel'].msg}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* All Riders Table */}
      <hr className="section-divider" />
      <div className="section-title">🏍️ All Riders</div>
      {riders === null ? (
        <div className="spinner" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Status</th><th>Trust</th><th>Reliability</th><th>Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {riders.map(r => (
                <tr key={r.id} style={{ cursor: 'pointer', background: selectedRider === r.id ? 'var(--green-bg)' : '' }}
                  onClick={() => { setSelectedRider(r.id); setJobs(null); }}>
                  <td><b>{r.name}</b></td>
                  <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                  <td><ScoreBar value={r.trust_score} /></td>
                  <td><ScoreBar value={r.reliability} /></td>
                  <td style={{ fontSize: '0.82rem' }}>{new Date(r.last_heartbeat).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
