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
  const [autoResult, setAutoResult] = useState(null);
  const [error, setError] = useState(null);

  const flash = (key, msg, ok) => {
    setPlanMsg(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setPlanMsg(m => { const c = { ...m }; delete c[key]; return c; }), 3500);
  };

  const handleFindPlans = async () => {
    setLoading(true); setError(null); setPlans(null);
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
      setAutoResult(res);
      setAutoMsg({ msg: `✓ Auto-dispatched! Code: ${res.confirm_code}`, ok: true });
    } catch (e) { setAutoMsg({ msg: '✗ ' + e.message, ok: false }); }
    setTimeout(() => setAutoMsg(null), 5000);
  };

  return (
    <div className="card" style={{ marginTop: 12, background: '#f7fdf7', borderColor: 'var(--green)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>
          📦 {batch.donor_name} — {batch.item_type}
        </div>
        <span className={`badge badge-${batch.status}`}>{batch.status}</span>
      </div>

      <div className="card-row" style={{ fontSize: '0.85rem', color: '#555', marginBottom: 12 }}>
        <span>ID: <b style={{ fontFamily: 'monospace' }}>{batch.id}</b></span>
        <span>Qty: <b>{batch.remaining_qty}/{batch.total_qty}</b></span>
        <span>Temp: <b>{batch.temperature_c}°C</b></span>
        <span>Location: {batch.location.lat.toFixed(3)}, {batch.location.lng.toFixed(3)}</span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="btn btn-green" onClick={handleFindPlans} disabled={loading}>
          {loading ? '🔄 Finding plans...' : '🔍 Find Delivery Plans'}
        </button>
        <button className="btn btn-blue" onClick={handleAutoDispatch}>
          ⚡ Auto-Dispatch Best Plan
        </button>
        {autoMsg && (
          <span className={`flash ${autoMsg.ok ? 'flash-ok' : 'flash-err'}`}>{autoMsg.msg}</span>
        )}
      </div>

      {/* Auto dispatch result */}
      {autoResult && (
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          <div>
            <b>Assignment created!</b> Confirm code: <span className="confirm-code" style={{ fontSize: '1.2rem', padding: '2px 10px' }}>{autoResult.confirm_code}</span>
            {autoResult.standby_rider_name && <span style={{ marginLeft: 12, fontSize: '0.85rem' }}>Standby: {autoResult.standby_rider_name}</span>}
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}

      {loading && <div className="spinner" />}

      {plans !== null && !loading && (
        <>
          {plans.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px' }}>
              <div className="empty-icon">🚫</div>
              <p>No plans available for this batch right now.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.85rem', color: '#555', marginBottom: 8 }}>
                {plans.length} plan{plans.length !== 1 ? 's' : ''} found
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rider</th>
                      <th>Shelter</th>
                      <th>Qty</th>
                      <th>ETA</th>
                      <th>Safe Margin</th>
                      <th>Score</th>
                      <th>Confidence</th>
                      <th>Plan B</th>
                      <th>Standby Rider</th>
                      <th>Why?</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map(p => (
                      <tr key={p.plan_id}>
                        <td><b>{p.rider_name}</b></td>
                        <td>{p.shelter_name}</td>
                        <td>{p.qty}</td>
                        <td><b>{p.eta_minutes}</b> min</td>
                        <td>
                          <span style={{
                            fontWeight: 700,
                            color: p.safe_margin_minutes < 15 ? 'var(--red)' : p.safe_margin_minutes < 25 ? 'var(--orange)' : 'var(--green)'
                          }}>
                            {p.safe_margin_minutes} min
                          </span>
                        </td>
                        <td><ScoreBar value={p.score} /></td>
                        <td>
                          <ScoreBar value={p.confidence} />
                        </td>
                        <td>
                          {p.plan_b ? (
                            <span className="planb">
                              {p.plan_b.shelter_name}<br />
                              <span style={{ color: '#999', fontSize: '0.78rem' }}>{p.plan_b.eta_minutes} min</span>
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', color: '#555' }}>
                            {p.standby_rider_name || '—'}
                          </span>
                        </td>
                        <td><ExpandableWhy explanation={p.explanation} /></td>
                        <td>
                          <button className="btn btn-green btn-sm" onClick={() => handleAssign(p)}>
                            Assign
                          </button>
                          {planMsg[p.plan_id] && (
                            <div className={`flash ${planMsg[p.plan_id].ok ? 'flash-ok' : 'flash-err'}`} style={{ marginTop: 4 }}>
                              {planMsg[p.plan_id].msg}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Blocked riders */}
          {blocked.length > 0 && (
            <div className="blocked-box">
              <h4>⚠️ Blocked Riders ({blocked.length})</h4>
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
