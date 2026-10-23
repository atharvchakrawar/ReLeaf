import React from 'react';

/**
 * Countdown — shows minutes left with color coding and a thin bar.
 * green if > 30, orange if 10-30, red if < 10
 */
export default function Countdown({ safe_minutes_left, expiry_minutes }) {
  const mins = Math.max(0, Math.round(safe_minutes_left));
  const total = expiry_minutes || 90;
  const pct = Math.min(100, Math.round((mins / total) * 100));

  let colorClass = 'countdown-green';
  let fillClass = 'fill-green';
  if (mins < 10) { colorClass = 'countdown-red'; fillClass = 'fill-red'; }
  else if (mins < 30) { colorClass = 'countdown-orange'; fillClass = 'fill-orange'; }

  return (
    <div className="countdown">
      <span className={`countdown-val ${colorClass}`}>
        {mins === 0 ? '⚠ Expired' : `${mins} min left`}
      </span>
      <div className="countdown-bar" style={{ width: '80px' }}>
        <div
          className={`countdown-fill ${fillClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
