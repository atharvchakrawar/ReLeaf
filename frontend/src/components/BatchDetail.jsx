import React, { useState } from 'react';
import { suggestPlans, assignPlan, autoDispatch } from '../api.js';
import ScoreBar from './ScoreBar.jsx';
import ExpandableWhy from './ExpandableWhy.jsx';

export default function BatchDetail({ batch }) {
  const [plans, setPlans] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [planMsg, setPlanMsg] = useState({});
  const [autoMsg, setAutoMsg] = useState(null);
  const [error, setError] = useState(null);

  const flash = (key, msg, ok) => {
    setPlanMsg(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setPlanMsg(m => { const c = { ...m }; delete c[key]; return c; }), 3000);
  };

  const handleFindPlans = async () => {
    setLoading(true); setError(null);
    try {
      const res = await suggestPlans(batch.id);
      setPlans(res.plans || []);
      setBlocked(res.blocked || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAssign = async (plan) => {
    try {
      await assignPlan(plan.plan_id, batch.id);
      flash(plan.plan_id, '✓ Assigned!', true);
    } catch (e) { flash(plan.plan_id, '✗ ' + e.message, false); }
  };

  const handleAutoDispatch = async () => {
    try {
      const res = await autoDispatch(batch.id);
      setAutoMsg({ msg: `✓ Auto-dispatched! Rider → ${res.rider_id}, Code: ${res.confirm_code}`, ok: true });
    } catch (e) { setAutoMsg({ msg: '✗ ' + e.message, ok: false }); }
    setTimeout(() => setAutoMsg(null), 4000);
  };

  return (
    <div className="card" style={{ marginTop: 12, background: '#f0f9f0' }}>
      <div className="section-title">📦 Batch Detail: {batch.donor_name} — {batch.item_type}</div>
      <div className="card-row" style={{ fontSize: '0.87rem', color: '#555' }}>
        <span>ID: <b>{batch.id}</b></span>
        <span>Qty: <b>{batch.remaining_qty}/{batch.total_qty}</b></span>
        <span>Temp: <b>{batch.temperature_c}°C</b></span>
        <span>Status: <span className={`badge badge-${batch.status}`}>{batch.status}</span></span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className="btn btn-green" onClick={handleFindPlans} disabled={loading}>
          {loading ? 'Finding...' : '🔍 Find Plans'}
        </button>
        <button className="btn btn-blue" onClick={handleAutoDispatch}>
          ⚡ Auto-Dispatch
        </button>
        {autoMsg && (
          <span className={`flash ${autoMsg.ok ? 'flash-ok' : 'flash-err'}`}>{autoMsg.msg}</span>
        )}
      </div>

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {plans !== null && (
        <>
          {plans.length === 0 ? (
            <div className="empty-state"><div className="empty-icon">🚫</div><p>No plans available for this batch.</p></div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Shelter</th>
                    <th>Qty</th>
                    <th>ETA (min)</th>
                    <th>Safe Margin</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th>Plan B</th>
                    <th>Standby</th>
                    <th>Why?</th>
                    <th>Assign</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map(p => (
                    <tr key={p.plan_id}>
                      <td><b>{p.rider_name}</b></td>
                      <td>{p.shelter_name}</td>
                      <td>{p.qty}</td>
                      <td>{p.eta_minutes} min</td>
                      <td>
                        <span style={{ color: p.safe_margin_minutes < 15 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                          {p.safe_margin_minutes} min
                        </span>
                      </td>
                      <td><ScoreBar value={p.score} /></td>
                      <td><ScoreBar value={p.confidence} /></td>
                      <td>
                        <span className="planb">
                          {p.plan_b ? `${p.plan_b.shelter_name} (${p.plan_b.eta_minutes}m)` : '—'}
                        </span>
                      </td>
                      <td><span style={{ fontSize: '0.8rem' }}>{p.standby_rider_name || '—'}</span></td>
                      <td><ExpandableWhy explanation={p.explanation} /></td>
                      <td>
                        <button className="btn btn-green btn-sm" onClick={() => handleAssign(p)}>Assign</button>
                        {planMsg[p.plan_id] && (
                          <div className={`flash ${planMsg[p.plan_id].ok ? 'flash-ok' : 'flash-err'}`}>
                            {planMsg[p.plan_id].msg}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {blocked.length > 0 && (
            <div className="blocked-box">
              <h4>⚠️ Blocked Riders</h4>
              {blocked.map(b => (
                <div className="blocked-item" key={b.rider_id}>
                  <span className="blocked-reason">
                    <b>{b.rider_name || b.rider_id}</b> — {b.reason.replace(/_/g, ' ')}
                  </span>
                  <span className="blocked-hint">💡 {b.unlock_hint}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
