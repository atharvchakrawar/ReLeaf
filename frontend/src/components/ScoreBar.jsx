import React from 'react';

/**
 * ScoreBar — renders a colored score/confidence bar with label.
 * < 0.5 red, 0.5-0.75 orange, > 0.75 green
 */
export default function ScoreBar({ value, showLabel = true }) {
  const pct = Math.round((value || 0) * 100);
  let fillClass = 'fill-green';
  if (value < 0.5) fillClass = 'fill-red';
  else if (value < 0.75) fillClass = 'fill-orange';

  return (
    <div className="progress-wrap">
      <div className="progress-bar" style={{ minWidth: '60px' }}>
        <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{pct}%</span>}
    </div>
  );
}
