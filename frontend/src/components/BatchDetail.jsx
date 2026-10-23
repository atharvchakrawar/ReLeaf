import React, { useState } from 'react';
import { suggestPlans, autoDispatch, createAssignment, getRiders, getShelters } from '../api.js';
import ScoreBar from './ScoreBar.jsx';

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food', medical: '💊 Medical',
  ration_kit: '📦 Ration Kit', infant_formula: '🍼 Infant Formula'
};

function WhyList({ why }) {
  const [open, setOpen] = useState(false);
  if (!why || why.length === 0) return null;
  return (
    <div>
      <button className="expandable-btn" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Hide' : '▼ Why?'}
      </button>
      {open && (
        <ul className="expandable-text" style={{ margin: '6px 0 0', paddingLeft: 16 }}>
          {why.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function BatchDetail({ batch }) {
  const [plans, setPlans] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [planMsg, setPlanMsg] = useState({});
  const [autoMsg, setAutoMsg] = useState(null);
  const [autoResult, setAutoResult] = useState(null);
  const [error, setError] = useState(null);
  const [riders, setRiders] = useState([]);
  const [shelters, setShelters] = useState([]);

  const flash = (key, msg, ok) => {
    setPlanMsg(m => ({ ...m, [key]: { msg, ok } }));
    setTimeout(() => setPlanMsg(m => { const c = { ...m }; delete c[key]; return c; }), 3500);
  };

  const handleFindPlans = async () => {
    setLoading(true); setError(null); setPlans(null);
    try {
      const [res, rList, sList] = await Promise.all([suggestPlans(batch.id), getRiders(), getShelters()]);
      setPlans(res.plans || []);
      setBlocked(res.blocked || []);
      setRiders(rList);
      setShelters(sList.filter(s => s.kind === 'shelter'));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleAssign = async (plan) => {
    const key = `${plan.rider_id}_${plan.shelter_id}`;
    try {
      await createAssignment({
        batch_id: batch.id,
        rider_id: plan.rider_id,
        shelter_id: plan.shelter_id,
        quantity: plan.quantity
      });
      flash(key, '✓ Assigned!', true);
    } catch (e) { flash(key, '✗ ' + e.message, false); }
  };

  const handleAutoDispatch = async () => {
    setAutoLoading(true); setAutoMsg(null); setAutoResult(null);
    try {
      const res = await autoDispatch(batch.id);
      const assignments = Array.isArray(res) ? res : [res];
      setAutoResult(assignments);
      setAutoMsg({ msg: `✓ Auto-dispatched ${assignments.length} assignment(s)`, ok: true });
    } catch (e) { setAutoMsg({ msg: '✗ ' + e.message, ok: false }); }
    finally { setAutoLoading(false); }
  };

  const riderName = (id) => riders.find(r => r.id === id)?.name || id;
  const shelterName = (id) => shelters.find(s => s.id === id)?.name || id;

  return (
    <div className="card" style={{ marginTop: 12, background: '#f7fdf7', borderColor: 'var(--green)', borderLeft: '4px solid var(--green)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="section-title" style={{ margin: 0 }}>
          {ITEM_LABELS[batch.item_type] || batch.item_type} · {batch.donor_name}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span className={`badge badge-${batch.status}`}>{batch.status.replace('_', ' ')}</span>
          <span className={`badge badge-${batch.risk}`}>{batch.risk}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: '0.85rem', color: '#555', marginBottom: 14 }}>
        <span>Remaining: <b>{batch.remaining_qty}/{batch.quantity}</b></span>
        <span>Safe time: <b style={{ color: batch.risk === 'critical' ? 'var(--red)' : batch.risk === 'urgent' ? 'var(--orange)' : 'var(--green)' }}>{batch.safe_minutes_left} min</b></span>
        <span>📍 {batch.lat?.toFixed(3)}, {batch.lng?.toFixed(3)}</span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button className="btn btn-green" onClick={handleFindPlans} disabled={loading}>
          {loading ? '🔄 Searching...' : '🔍 Find Delivery Plans'}
        </button>
        <button className="btn btn-blue" onClick={handleAutoDispatch} disabled={autoLoading}>
          {autoLoading ? '⏳ Dispatching...' : '⚡ Auto-Dispatch'}
        </button>
        {autoMsg && <span className={`flash ${autoMsg.ok ? 'flash-ok' : 'flash-err'}`}>{autoMsg.msg}</span>}
      </div>

      {/* Auto-dispatch result */}
      {autoResult && (
        <div style={{ marginBottom: 12 }}>
          {autoResult.map(a => (
            <div key={a.id} className="alert alert-success">
              <div>
                <b>Assignment {a.id}</b>: {riderName(a.rider_id)} → {shelterName(a.shelter_id)} · {a.quantity} units ·
                Code: <span className="confirm-code" style={{ fontSize: '1.1rem', padding: '2px 10px' }}>{a.confirm_code}</span>
                · Confidence: {a.confidence}%
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="alert alert-error">⚠️ {error}</div>}
      {loading && <div className="spinner" />}

      {/* Plans table */}
      {plans !== null && !loading && (
        <>
          {plans.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}>
              <div className="empty-icon">🚫</div>
              <p>No feasible plans found for this batch right now.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: 8 }}>
                {plans.length} plan{plans.length !== 1 ? 's' : ''} found
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Rider</th><th>Shelter</th><th>Qty</th>
                      <th>ETA</th><th>Safe Margin</th><th>Score</th>
                      <th>Why?</th><th>Assign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plans.map((p, i) => {
                      const key = `${p.rider_id}_${p.shelter_id}`;
                      return (
                        <tr key={i}>
                          <td>
                            <b>{p.rider_name || riderName(p.rider_id)}</b>
                            {riders.find(r => r.id === p.rider_id)?.has_insulated_bag && (
                              <span title="Has insulated bag" style={{ marginLeft: 4 }}>🧊</span>
                            )}
                          </td>
                          <td>{p.shelter_name || shelterName(p.shelter_id)}</td>
                          <td>{p.quantity}</td>
                          <td><b>{p.eta_minutes}</b> min</td>
                          <td>
                            <span style={{
                              fontWeight: 700,
                              color: p.safe_margin_minutes < 10 ? 'var(--red)' : p.safe_margin_minutes < 20 ? 'var(--orange)' : 'var(--green)'
                            }}>
                              {p.safe_margin_minutes} min
                            </span>
                          </td>
                          <td><ScoreBar value={p.score} /></td>
                          <td><WhyList why={p.why} /></td>
                          <td>
                            <button className="btn btn-green btn-sm" onClick={() => handleAssign(p)}>Assign</button>
                            {planMsg[key] && (
                              <div className={`flash ${planMsg[key].ok ? 'flash-ok' : 'flash-err'}`} style={{ marginTop: 4 }}>
                                {planMsg[key].msg}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Blocked shelters */}
          {blocked.length > 0 && (
            <div className="blocked-box">
              <h4>⚠️ Blocked Shelters ({blocked.length})</h4>
              {blocked.map((b, i) => (
                <div className="blocked-item" key={i}>
                  <span className="blocked-reason"><b>{shelterName(b.shelter_id)}</b> — {b.reason}</span>
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
