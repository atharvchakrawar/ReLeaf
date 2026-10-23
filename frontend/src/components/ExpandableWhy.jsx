import React, { useState } from 'react';

/**
 * ExpandableWhy — click "Why?" to expand explanation text.
 */
export default function ExpandableWhy({ explanation }) {
  const [open, setOpen] = useState(false);
  if (!explanation) return null;
  return (
    <div>
      <button className="expandable-btn" onClick={() => setOpen(o => !o)}>
        {open ? '▲ Hide' : '▼ Why?'}
      </button>
      {open && <div className="expandable-text">{explanation}</div>}
    </div>
  );
}
