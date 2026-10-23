import React, { useState } from 'react';
import { getStats, getBatches, getRiders, getAssignments, getEvents } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import ScoreBar from '../components/ScoreBar.jsx';

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food', medical: '💊 Medical',
  ration_kit: '📦 Ration Kit', infant_formula: '🍼 Infant Formula'
};

function WhyTooltip({ why }) {
  const [open, setOpen] = useState(false);
  if (!why || why.length === 0) return null;
  return (
    <div>
      <button className="expandable-btn" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼ Why?'}
      </button>
      {open && (
        <ul className="expandable-text" style={{ paddingLeft: 14, margin: '4px 0 0' }}>
          {why.map((w, i) => <li key={i}>{w}</li>)}
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

  usePolling(async () => { setStats(await getStats()); }, 2000);
  usePolling(async () => { setBatches(await getBatches()); }, 2000);
  usePolling(async () => { setRiders(await getRiders()); }, 2000);
  usePolling(async () => { setAssignments(await getAssignments()); }, 2000);
  usePolling(async () => { setEvents(await getEvents()); }, 2000);

  return (
    <div className="page">
      <h1 className="page-title">📊 Live Dashboard</h1>

      {/* Stat Cards */}
      {stats === null ? <Spinner /> : (
        <div className="stat-cards">
          {[
            { label: 'Delivered',    value: stats.delivered_qty,                         cls: '' },
            { label: 'Wasted',       value: stats.wasted_qty,           color:'var(--red)',    cls: 'stat-red' },
            { label: 'In Transit',   value: stats.in_transit_qty,       color:'var(--blue)',   cls: 'stat-blue' },
            { label: 'Salvaged',     value: stats.salvaged_qty,         color:'var(--purple)', cls: 'stat-purple' },
            { label: 'Reroutes',     value: stats.reroutes,             color:'var(--orange)', cls: 'stat-orange' },
            { label: 'Avg Delivery', value: `${stats.avg_delivery_minutes ?? '—'}m`,     cls: 'stat-gray' }
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
                {batches.map(b => (
                  <tr key={b.id} className={b.risk === 'critical' ? 'row-error' : b.risk === 'urgent' ? 'row-warning' : ''}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{b.id}</td>
                    <td><b>{b.donor_name}</b></td>
                    <td><span className={`badge badge-${b.item_type}`}>{ITEM_LABELS[b.item_type] || b.item_type}</span></td>
                    <td>{b.remaining_qty}/{b.quantity}</td>
                    <td><span className={`badge badge-${b.status}`}>{b.status.replace('_', ' ')}</span></td>
                    <td><span className={`badge badge-${b.risk}`}>{b.risk}</span></td>
                    <td>
                      <Countdown safe_minutes_left={b.safe_minutes_left} expiry_minutes={b.safe_minutes_left + 20} />
                    </td>
                  </tr>
                ))}
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
                {riders.map(r => (
                  <tr key={r.id} className={r.status === 'unresponsive' ? 'row-error' : ''}>
                    <td><b>{r.name}</b></td>
                    <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ScoreBar value={r.reliability / 100} />
                        <span style={{ fontSize: '0.8rem' }}>{r.reliability}%</span>
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
                {assignments.map(a => (
                  <tr key={a.id} className={a.reroute_count > 0 ? 'row-warning' : a.status === 'failed' ? 'row-error' : ''}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{a.batch_id}</td>
                    <td>{a.rider_id}</td>
                    <td>{a.shelter_id}</td>
                    <td>{a.quantity}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                    <td><span className={`badge badge-${a.stage}`}>{a.stage?.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{a.eta_minutes?.toFixed(1)} min</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <ScoreBar value={a.confidence / 100} />
                        <span style={{ fontSize: '0.78rem' }}>{a.confidence}%</span>
                      </div>
                    </td>
                    <td>
                      {a.backup_shelter_id ? (
                        <span className={`planb${a.reroute_count > 0 ? ' rerouted' : ''}`}>
                          {a.backup_shelter_id}{a.reroute_count > 0 ? ' ← ACTIVE' : ''}
                        </span>
                      ) : '—'}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: a.reroute_count > 0 ? 'var(--orange)' : '#aaa' }}>
                      {a.reroute_count || '—'}
                    </td>
                    <td><WhyTooltip why={a.why} /></td>
                  </tr>
                ))}
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
                <tr><th>Sim Time</th><th>Level</th><th>Message</th></tr>
              </thead>
              <tbody>
                {events.map((e, i) => (
                  <tr key={i} className={e.level === 'error' ? 'row-error' : e.level === 'warning' ? 'row-warning' : ''}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                      t={typeof e.time === 'number' ? e.time.toFixed(1) : e.time}
                    </td>
                    <td><span className={`badge badge-${e.level}`}>{e.level}</span></td>
                    <td style={{ fontSize: '0.88rem' }}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
