import { useState, useEffect, useRef } from 'react';

/**
 * usePolling — calls fn every intervalMs. Cleans up on unmount.
 * @param {Function} fn - async function to call
 * @param {number} intervalMs - polling interval in milliseconds
 */
export function usePolling(fn, intervalMs) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) {
        try { await fnRef.current(); } catch (_) { /* errors handled by caller */ }
      }
    };
    run();
    const id = setInterval(run, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [intervalMs]);
}
