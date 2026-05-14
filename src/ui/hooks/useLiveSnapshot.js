/**
 * @file ui/hooks/useLiveSnapshot.js
 * @description Custom hook — owns the debounced liveSnapshot subscription.
 * Extracted from AppShell so only the consuming component re-renders on
 * finance changes, not the entire shell + nav + sidebar tree.
 * @version 1.0.0
 */

import { useState, useEffect, useRef } from 'react';
import { store } from '../../core/store/store.js';
import { getLiveSnapshot } from '../../domain/finance/live_calc_engine.js';

/**
 * Returns a debounced live financial snapshot.
 * The hook subscribes to the store internally; the parent never needs
 * to pass liveSnapshot as a prop.
 *
 * @param {number} [delay=300] - Debounce interval in ms
 * @returns {Object|null} snapshot — null only before the first calculation
 */
export const useLiveSnapshot = (delay = 300) => {
  const [snapshot, setSnapshot] = useState(() => {
    try { return getLiveSnapshot(); } catch { return null; }
  });
  const timerRef = useRef(null);

  useEffect(() => {
    const unsub = store.subscribe(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          setSnapshot(getLiveSnapshot());
        } catch (e) {
          console.error('[useLiveSnapshot] calc error', e);
        }
      }, delay);
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [delay]);

  return snapshot;
};
