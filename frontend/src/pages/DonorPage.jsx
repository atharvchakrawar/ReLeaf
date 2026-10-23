import React, { useState } from 'react';
import { getBatches, createBatch } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import BatchDetail from '../components/BatchDetail.jsx';

const ITEM_TYPES = ['cooked_food', 'medical', 'ration_kit', 'infant_formula'];

const ITEM_LABELS = {
  cooked_food: '🍱 Cooked Food',
  medical: '💊 Medical',
  ration_kit: '📦 Ration Kit',
  infant_formula: '🍼 Infant Formula'
};

const RISK_ORDER = { critical: 0, urgent: 1, safe: 2 };

export default function DonorPage() {
  const [batches, setBatches] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    donor_name: '', item_type: 'cooked_food', quantity: 30,
    expires_in_minutes: 90, lat: 18.52, lng: 73.85
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  usePolling(async () => {
    const data = await getBatches();
    // Sort: critical first, then urgent, then safe; expired last
    const active = data.filter(b => b.status !== 'expired').sort((a, b) =>
      (RISK_ORDER[a.risk] ?? 3) - (RISK_ORDER[b.risk] ?? 3)
    );
    const expired = data.filter(b => b.status === 'expired');
    setBatches([...active, ...expired]);
  }, 2000);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === 'number' ? Number(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.donor_name.trim()) { setSubmitMsg({ msg: 'Donor name required', ok: false }); return; }
    setSubmitting(true); setSubmitMsg(null);
    try {
      await createBatch(form);
      setSubmitMsg({ msg: '✓ Batch created!', ok: true });
      setForm(f => ({ ...f, donor_name: '' }));
    } catch (err) { setSubmitMsg({ msg: '✗ ' + err.message, ok: false }); }
    finally { setSubmitting(false); setTimeout(() => setSubmitMsg(null), 3000); }
  };

  const progressPct = (b) =>
    b.quantity > 0 ? Math.round(((b.quantity - b.remaining_qty) / b.quantity) * 100) : 100;

  const riskStyle = { critical: 'var(--red)', urgent: 'var(--orange)', safe: 'var(--green)' };

  return (
    <div className="page">
      <h1 className="page-title">🥗 Donor — Create & Manage Batches</h1>

      {/* Create form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">➕ Register New Donation Batch</div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Donor Name</label>
              <input className="form-input" name="donor_name" value={form.donor_name}
                onChange={handleChange} placeholder="e.g. Green Kitchen" required />
            </div>
            <div className="form-group">
              <label className="form-label">Item Type</label>
              <select className="form-select" name="item_type" value={form.item_type} onChange={handleChange}>
                {ITEM_TYPES.map(t => <option key={t} value={t}>{ITEM_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" name="quantity" min="1" value={form.quantity} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Expires in (minutes)</label>
              <input className="form-input" type="number" name="expires_in_minutes" min="10" value={form.expires_in_minutes} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Latitude</label>
              <input className="form-input" type="number" step="0.001" name="lat" value={form.lat} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Longitude</label>
              <input className="form-input" type="number" step="0.001" name="lng" value={form.lng} onChange={handleChange} />
            </div>
          </div>

          {/* Dependency hints */}
          {form.item_type === 'ration_kit' && (
            <div className="alert alert-warn" style={{ marginBottom: 10 }}>
              ⚠️ Ration kits require shelters with <b>clean water AND cooking fuel</b>.
            </div>
          )}
          {form.item_type === 'infant_formula' && (
            <div className="alert alert-info" style={{ marginBottom: 10 }}>
              ℹ️ Infant formula requires shelters with <b>clean water</b>.
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-green" type="submit" disabled={submitting}>
              {submitting ? '⏳ Creating...' : '➕ Create Batch'}
            </button>
            {submitMsg && (
              <span className={`flash ${submitMsg.ok ? 'flash-ok' : 'flash-err'}`}>{submitMsg.msg}</span>
            )}
          </div>
        </form>
      </div>

      {/* Batch list */}
      <div className="section-title">
        📋 Active Batches
        {batches !== null && <span style={{ fontSize: '0.82rem', color: '#888', fontWeight: 400, marginLeft: 8 }}>
          ({batches.filter(b => b.status !== 'expired').length} active)
        </span>}
      </div>

      {batches === null ? (
        <div className="spinner" />
      ) : batches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No batches registered yet. Create one above!</p>
        </div>
      ) : (
        <div className="card-grid">
          {batches.map(b => (
            <div key={b.id}>
              <div
                className={`card${selected?.id === b.id ? ' selected' : ''}`}
                style={{
                  cursor: 'pointer',
                  borderLeft: `4px solid ${riskStyle[b.risk] || '#ddd'}`,
                  opacity: b.status === 'expired' ? 0.55 : 1
                }}
                onClick={() => setSelected(s => s?.id === b.id ? null : b)}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{b.donor_name}</div>
                    <span className={`badge badge-${b.item_type}`}>{ITEM_LABELS[b.item_type] || b.item_type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span className={`badge badge-${b.status}`}>{b.status.replace('_', ' ')}</span>
                    <span className={`badge badge-${b.risk}`}>{b.risk}</span>
                  </div>
                </div>

                {/* Qty */}
                <div style={{ fontSize: '0.85rem', marginBottom: 6 }}>
                  <b>{b.remaining_qty}</b> / {b.quantity} remaining
                </div>

                {/* Assigned progress bar */}
                <div className="progress-wrap" style={{ marginBottom: 8 }}>
                  <div className="progress-bar">
                    <div className="progress-fill fill-blue" style={{ width: `${progressPct(b)}%` }} />
                  </div>
                  <span style={{ fontSize: '0.76rem', color: '#777' }}>{progressPct(b)}% assigned</span>
                </div>

                <Countdown safe_minutes_left={b.safe_minutes_left} expiry_minutes={b.safe_minutes_left + 20} />

                <div style={{ fontSize: '0.76rem', color: '#aaa', marginTop: 6 }}>
                  📍 {b.lat?.toFixed(3)}, {b.lng?.toFixed(3)} · ID: {b.id}
                </div>
              </div>

              {selected?.id === b.id && <BatchDetail batch={b} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
