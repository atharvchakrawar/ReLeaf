import React, { useState } from 'react';
import { getBatches, createBatch } from '../api.js';
import { usePolling } from '../hooks/usePolling.js';
import Countdown from '../components/Countdown.jsx';
import BatchDetail from '../components/BatchDetail.jsx';

const ITEM_TYPES = ['Cooked Meals', 'Bread', 'Rice', 'Vegetables', 'Fruits'];

export default function DonorPage({ apiError }) {
  const [batches, setBatches] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    donor_name: '', item_type: 'Cooked Meals', quantity: 20,
    expiry_minutes: 90, lat: 18.52, lng: 73.85
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  usePolling(async () => {
    const data = await getBatches();
    setBatches(data);
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
    } catch (err) {
      setSubmitMsg({ msg: '✗ ' + err.message, ok: false });
    } finally { setSubmitting(false); }
    setTimeout(() => setSubmitMsg(null), 3000);
  };

  const progressPct = (b) => b.total_qty > 0 ? Math.round((b.remaining_qty / b.total_qty) * 100) : 0;

  return (
    <div className="page">
      <h1 className="page-title">🥗 Donor — Create & Manage Batches</h1>

      {/* Batch Form */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-title">➕ Create New Batch</div>
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
                {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" name="quantity" min="1" value={form.quantity} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label className="form-label">Expiry (minutes)</label>
              <input className="form-input" type="number" name="expiry_minutes" min="10" value={form.expiry_minutes} onChange={handleChange} />
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
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-green" type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : '➕ Create Batch'}
            </button>
            {submitMsg && (
              <span className={`flash ${submitMsg.ok ? 'flash-ok' : 'flash-err'}`}>{submitMsg.msg}</span>
            )}
          </div>
        </form>
      </div>

      {/* Batch List */}
      <div className="section-title">📋 Active Batches</div>
      {batches === null ? (
        <div className="spinner" />
      ) : batches.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p>No batches yet. Create one above!</p>
        </div>
      ) : (
        <div className="card-grid">
          {batches.map(b => (
            <div key={b.id}>
              <div
                className={`card${selected?.id === b.id ? ' selected' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelected(s => s?.id === b.id ? null : b)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem' }}>{b.donor_name}</div>
                    <div style={{ color: '#555', fontSize: '0.85rem' }}>{b.item_type}</div>
                  </div>
                  <span className={`badge badge-${b.status}`}>{b.status}</span>
                </div>

                <div style={{ fontSize: '0.85rem', marginBottom: 8 }}>
                  <b>{b.remaining_qty}</b> / {b.total_qty} units remaining
                </div>

                {/* Qty progress */}
                <div className="progress-wrap" style={{ marginBottom: 8 }}>
                  <div className="progress-bar">
                    <div className="progress-fill fill-blue" style={{ width: `${progressPct(b)}%` }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#777' }}>{progressPct(b)}%</span>
                </div>

                <Countdown safe_minutes_left={b.safe_minutes_left} expiry_minutes={b.expiry_minutes} />

                <div style={{ fontSize: '0.78rem', color: '#999', marginTop: 6 }}>
                  📍 {b.location.lat.toFixed(3)}, {b.location.lng.toFixed(3)} · 🌡 {b.temperature_c}°C
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
