import React, { useState } from 'react';
import { getStats, getBatches, getRiders, getAssignments, getEvents } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import ScoreBar from '../components/ScoreBar.jsx';
import ExpandableWhy from '../components/ExpandableWhy.jsx';

function formatTime(ts) {
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [batches, setBatches] = useState(null);
  const [riders, setRiders] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [events, setEvents] = useState(null);

  usePolling(async () => { const d = await getStats(); setStats(d); }, 2000);
  usePolling(async () => { const d = await getBatches(); setBatches(d); }, 2000);
  usePolling(async () => { const d = await getRiders(); setRiders(d); }, 2000);
  usePolling(async () => { const d = await getAssignments(); setAssignments(d); }, 2000);
  usePolling(async () => { const d = await getEvents(); setEvents(d); }, 2000);

  return (
    <div className="page">
      <h1 className="page-title">📊 Live Dashboard</h1>

      {/* Stat Cards */}
      {stats === null ? (
        <div className="spinner" />
      ) : (
        <div className="stat-cards">
          {[
            { label: 'Delivered', value: stats.delivered, color: 'var(--green)' },
            { label: 'Wasted', value: stats.wasted, color: 'var(--red)' },
            { label: 'In Transit', value: stats.in_transit, color: 'var(--blue)' },
            { label: 'Salvaged', value: stats.salvaged, color: 'var(--purple)' },
            { label: 'Reroutes', value: stats.reroutes, color: 'var(--orange)' },
            { label: 'Avg Delivery', value: `${stats.avg_delivery_time_minutes} min`, color: 'var(--gray)' }
          ].map(s => (
            <div className="stat-card" key={s.label}>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Batches Table */}
      <div className="section-title">📦 Batches</div>
      {batches === null ? <div className="spinner" /> : batches.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📭</div><p>No batches.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Donor</th><th>Item</th><th>Remaining</th><th>Status</th><th>Time Left</th></tr>
            </thead>
            <tbody>
              {batches.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{b.id}</td>
                  <td><b>{b.donor_name}</b></td>
                  <td>{b.item_type}</td>
                  <td>{b.remaining_qty}/{b.total_qty}</td>
                  <td><span className={`badge badge-${b.status}`}>{b.status}</span></td>
                  <td><Countdown safe_minutes_left={b.safe_minutes_left} expiry_minutes={b.expiry_minutes} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Riders Table */}
      <div className="section-title">🏍️ Riders</div>
      {riders === null ? <div className="spinner" /> : riders.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">🛵</div><p>No riders.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Status</th><th>Trust Score</th><th>Reliability</th><th>Last Heartbeat</th></tr>
            </thead>
            <tbody>
              {riders.map(r => (
                <tr key={r.id}>
                  <td><b>{r.name}</b></td>
                  <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                  <td><ScoreBar value={r.trust_score} /></td>
                  <td><ScoreBar value={r.reliability} /></td>
                  <td style={{ fontSize: '0.82rem' }}>{formatTime(r.last_heartbeat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignments Table */}
      <div className="section-title">📋 Assignments</div>
      {assignments === null ? <div className="spinner" /> : assignments.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📋</div><p>No assignments.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>ID</th><th>Rider</th><th>Shelter</th><th>Item</th><th>Qty</th><th>Status</th><th>Confidence</th><th>Plan B</th><th>Standby</th><th>Why?</th></tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.assignment_id} className={a.status === 'rerouted' ? 'row-rerouted' : ''}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{a.assignment_id}</td>
                  <td><b>{a.rider_name}</b></td>
                  <td>{a.shelter_name}</td>
                  <td>{a.item_type}</td>
                  <td>{a.qty}</td>
                  <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                  <td>
                    <ScoreBar value={a.confidence} />
                    {a.standby_rider_name && <div style={{ fontSize: '0.75rem', color: '#888' }}>{a.standby_rider_name}</div>}
                  </td>
                  <td>
                    {a.plan_b ? (
                      <span className={`planb${a.status === 'rerouted' ? ' rerouted' : ''}`}>
                        {a.plan_b.shelter_name} ({a.plan_b.eta_minutes}m)
                        {a.status === 'rerouted' && ' ← ACTIVE'}
                      </span>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{a.standby_rider_name || '—'}</td>
                  <td><ExpandableWhy explanation={a.explanation} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Event Timeline */}
      <div className="section-title">📜 Event Timeline</div>
      {events === null ? <div className="spinner" /> : events.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📜</div><p>No events yet.</p></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Time</th><th>Type</th><th>Severity</th><th>Message</th></tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} className={e.severity === 'error' ? 'row-error' : e.severity === 'warning' ? 'row-warning' : ''}>
                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatTime(e.timestamp)}</td>
                  <td><span className={`badge badge-${e.type}`} style={{ fontSize: '0.72rem' }}>{e.type.replace('_', ' ')}</span></td>
                  <td><span className={`badge badge-${e.severity}`}>{e.severity}</span></td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
