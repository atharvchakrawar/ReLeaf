import React, { useState } from 'react';
import { getStats, getBatches, getRiders, getAssignments, getEvents } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import ScoreBar from '../components/ScoreBar.jsx';

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food', medical: '💊 Medical',
  ration_kit: '📦 Ration Kit', infant_formula: '🍼 Infant Formula'
};

function WhyTooltip({ why, explanation }) {
  const [open, setOpen] = useState(false);
  const items = Array.isArray(why) ? why : explanation ? [explanation] : [];
  if (items.length === 0) return null;
  return (
    <div>
      <button className="expandable-btn" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼ Why?'}
      </button>
      {open && (
        <ul className="expandable-text" style={{ paddingLeft: 14, margin: '4px 0 0' }}>
          {items.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}

function Spinner() { return <div className="spinner" />; }

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [batches, setBatches] = useState(null);
  const [riders, setRiders] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [events, setEvents] = useState(null);

  usePolling(async () => {
    try { setStats(await getStats()); } catch (e) { console.error(e); }
  }, 2000);
  usePolling(async () => {
    try { setBatches(await getBatches()); } catch (e) { console.error(e); }
  }, 2000);
  usePolling(async () => {
    try { setRiders(await getRiders()); } catch (e) { console.error(e); }
  }, 2000);
  usePolling(async () => {
    try { setAssignments(await getAssignments()); } catch (e) { console.error(e); }
  }, 2000);
  usePolling(async () => {
    try { setEvents(await getEvents()); } catch (e) { console.error(e); }
  }, 2000);

  const formatHeartbeat = (hb) => {
    if (hb == null) return '—';
    if (typeof hb === 'number') return `t=${hb.toFixed(1)}`;
    if (typeof hb === 'string') return hb.length > 16 ? hb.slice(11, 19) : hb;
    return String(hb);
  };

  const formatEventTime = (t) => {
    if (t == null) return '—';
    if (typeof t === 'number') return `t=${t.toFixed(1)}`;
    if (typeof t === 'string') return t.length > 16 ? t.slice(11, 19) : t;
    return String(t);
  };

  return (
    <div className="page">
      <h1 className="page-title">📊 Live Dashboard</h1>

      {/* Stat Cards */}
      {stats === null ? <Spinner /> : (
        <div className="stat-cards">
          {[
            { label: 'Delivered',    value: stats.delivered_qty ?? stats.delivered ?? 0,                         cls: '' },
            { label: 'Wasted',       value: stats.wasted_qty ?? stats.wasted ?? 0,           color:'var(--red)',    cls: 'stat-red' },
            { label: 'In Transit',   value: stats.in_transit_qty ?? stats.in_transit ?? 0,       color:'var(--blue)',   cls: 'stat-blue' },
            { label: 'Salvaged',     value: stats.salvaged_qty ?? stats.salvaged ?? 0,         color:'var(--purple)', cls: 'stat-purple' },
            { label: 'Reroutes',     value: stats.reroutes ?? 0,             color:'var(--orange)', cls: 'stat-orange' },
            { label: 'Avg Delivery', value: `${(stats.avg_delivery_minutes ?? stats.avg_delivery_time_minutes ?? 18.5)}m`,     cls: 'stat-gray' }
          ].map(s => (
            <div className={`stat-card ${s.cls}`} key={s.label}>
              <div className="stat-value" style={s.color ? { color: s.color } : {}}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Batches */}
      <div className="section-title">📦 Batches</div>
      {batches === null ? <Spinner /> : batches.length === 0
        ? <div className="empty-state"><div className="empty-icon">📭</div><p>No batches yet.</p></div>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>ID</th><th>Donor</th><th>Item</th><th>Remaining</th><th>Status</th><th>Risk</th><th>Safe Time</th></tr>
              </thead>
              <tbody>
                {batches.map(b => {
                  const risk = b.risk || (b.safe_minutes_left < 10 ? 'critical' : b.safe_minutes_left < 30 ? 'urgent' : 'safe');
                  return (
                    <tr key={b.id} className={risk === 'critical' ? 'row-error' : risk === 'urgent' ? 'row-warning' : ''}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.id}</td>
                      <td><b>{b.donor_name}</b></td>
                      <td><span className={`badge badge-${b.item_type}`}>{ITEM_LABELS[b.item_type] || b.item_type}</span></td>
                      <td>{b.remaining_qty}/{b.quantity ?? b.total_qty}</td>
                      <td><span className={`badge badge-${b.status}`}>{b.status?.replace('_', ' ')}</span></td>
                      <td><span className={`badge badge-${risk}`}>{risk}</span></td>
                      <td>
                        <Countdown safe_minutes_left={b.safe_minutes_left} expiry_minutes={b.expiry_minutes || ((b.safe_minutes_left || 30) + 20)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* Riders */}
      <div className="section-title">🏍️ Riders</div>
      {riders === null ? <Spinner /> : riders.length === 0
        ? <div className="empty-state"><div className="empty-icon">🛵</div><p>No riders.</p></div>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Status</th><th>Reliability</th><th>Capacity</th><th>Bag 🧊</th><th>Last Heartbeat</th></tr>
              </thead>
              <tbody>
                {riders.map(r => {
                  const rel = r.reliability > 1 ? r.reliability : Math.round((r.reliability ?? r.trust_score ?? 0.8) * 100);
                  return (
                    <tr key={r.id} className={r.status === 'unresponsive' ? 'row-error' : ''}>
                      <td><b>{r.name}</b></td>
                      <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <ScoreBar value={rel / 100} />
                          <span style={{ fontSize: '0.8rem' }}>{rel}%</span>
                        </div>
                      </td>
                      <td>{r.capacity ?? 30}</td>
                      <td style={{ textAlign: 'center' }}>{r.has_insulated_bag ? '✅' : '—'}</td>
                      <td style={{ fontSize: '0.82rem' }}>{formatHeartbeat(r.last_heartbeat)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* Assignments */}
      <div className="section-title">📋 Assignments</div>
      {assignments === null ? <Spinner /> : assignments.length === 0
        ? <div className="empty-state"><div className="empty-icon">📋</div><p>No assignments.</p></div>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Batch</th><th>Rider</th><th>Shelter</th><th>Qty</th>
                  <th>Status</th><th>Stage</th><th>ETA</th><th>Confidence</th>
                  <th>Plan B</th><th>Reroutes</th><th>Why?</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a, i) => {
                  const aid = a.id || a.assignment_id || `asgn-${i}`;
                  const conf = a.confidence > 1 ? a.confidence : Math.round((a.confidence || 0.8) * 100);
                  const planBName = a.backup_shelter_id || a.plan_b?.shelter_name || a.plan_b?.shelter_id;
                  const reroutes = a.reroute_count || 0;
                  return (
                    <tr key={aid} className={reroutes > 0 ? 'row-warning' : a.status === 'failed' ? 'row-error' : ''}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{aid}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.batch_id}</td>
                      <td>{a.rider_name || a.rider_id}</td>
                      <td>{a.shelter_name || a.shelter_id}</td>
                      <td>{a.quantity ?? a.qty}</td>
                      <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                      <td><span className={`badge badge-${a.stage || 'in_transit'}`}>{(a.stage || a.status)?.replace('_', ' ')}</span></td>
                      <td style={{ fontSize: '0.85rem' }}>{a.eta_minutes != null ? `${Number(a.eta_minutes).toFixed(1)} min` : (a.plan_b?.eta_minutes ? `${a.plan_b.eta_minutes} min` : '—')}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ScoreBar value={conf / 100} />
                          <span style={{ fontSize: '0.78rem' }}>{conf}%</span>
                        </div>
                      </td>
                      <td>
                        {planBName ? (
                          <span className={`planb${reroutes > 0 ? ' rerouted' : ''}`}>
                            {planBName}{reroutes > 0 ? ' ← ACTIVE' : ''}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: reroutes > 0 ? 'var(--orange)' : '#aaa' }}>
                        {reroutes || '—'}
                      </td>
                      <td><WhyTooltip why={a.why} explanation={a.explanation} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

      {/* Event Timeline */}
      <div className="section-title">
        📜 Events <span style={{ fontSize: '0.78rem', color: '#aaa', fontWeight: 400 }}>(newest first)</span>
      </div>
      {events === null ? <Spinner /> : events.length === 0
        ? <div className="empty-state"><div className="empty-icon">📜</div><p>No events yet.</p></div>
        : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Timestamp</th><th>Level</th><th>Message</th></tr>
              </thead>
              <tbody>
                {events.map((e, i) => {
                  const level = e.level || e.severity || 'info';
                  return (
                    <tr key={e.id || i} className={level === 'error' ? 'row-error' : level === 'warning' ? 'row-warning' : ''}>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {formatEventTime(e.time || e.timestamp)}
                      </td>
                      <td><span className={`badge badge-${level}`}>{level}</span></td>
                      <td style={{ fontSize: '0.88rem' }}>{e.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
