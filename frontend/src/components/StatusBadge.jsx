import React from 'react';

/**
 * StatusBadge — renders a badge for any status string.
 */
export default function StatusBadge({ status }) {
  if (!status) return null;
  const cls = status.replace(/\s+/g, '_').toLowerCase();
  return <span className={`badge badge-${cls}`}>{status.replace(/_/g, ' ')}</span>;
}
