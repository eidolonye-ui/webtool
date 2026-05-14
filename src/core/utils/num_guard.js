/**
 * @file core/utils/num_guard.js
 * @description Unified numerical guard utilities.
 * Apply at the OUTPUT BOUNDARY of every domain engine to ensure no NaN,
 * Infinity, negative area, or impossible percentage ever reaches the UI or store.
 *
 * Usage:
 *   import { safeNum, safeRound, safePositive, safePct, clamp, guardObj } from '../../core/utils/num_guard.js';
 *
 * @version 1.0.0 - Task #58
 */

/**
 * Parse a value to float and return fallback if the result is not a finite number.
 * @param {*}      v        - Any value (number, string, null, undefined)
 * @param {number} fallback - Value to return when v is not finite (default 0)
 * @returns {number}
 */
export const safeNum = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Like safeNum but rounds to the nearest integer.
 * @param {*}      v
 * @param {number} fallback
 * @returns {number}
 */
export const safeRound = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};

/**
 * Like safeNum but also clamps the result to ≥ 0.
 * Use for areas, distances, costs — values that cannot be negative.
 * @param {*}      v
 * @param {number} fallback
 * @returns {number}
 */
export const safePositive = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, n) : fallback;
};

/**
 * Like safeRound + safePositive — integer, non-negative.
 * Use for m², counts, dollar amounts.
 * @param {*}      v
 * @param {number} fallback
 * @returns {number}
 */
export const safePositiveRound = (v, fallback = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
};

/**
 * Clamp a percentage to [0, 100].
 * @param {*} v
 * @returns {number}
 */
export const safePct = (v) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
};

/**
 * Generic clamp to [min, max].
 * @param {*}      v
 * @param {number} min
 * @param {number} max
 * @param {number} fallback - returned when v is not finite (defaults to min)
 * @returns {number}
 */
export const clamp = (v, min, max, fallback) => {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback !== undefined ? fallback : min;
  return Math.min(max, Math.max(min, n));
};

/**
 * Walk a flat (or shallow) object and replace every NaN / Infinity / -Infinity
 * numeric property with 0 (or a custom fallback).
 *
 * Does NOT recurse into nested objects — only handles top-level numeric values.
 * Use for sanitising engine return objects before they leave the domain layer.
 *
 * @param {Object} obj      - Plain object whose numeric fields need guarding
 * @param {number} fallback - Replacement value (default 0)
 * @returns {Object} - New object with sanitised values
 */
export const guardObj = (obj, fallback = 0) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') {
      out[k] = Number.isFinite(v) ? v : fallback;
    } else {
      out[k] = v;
    }
  }
  return out;
};

/**
 * Convenience: round all number properties of obj and guard against NaN/Infinity.
 * @param {Object} obj
 * @param {number} fallback
 * @returns {Object}
 */
export const guardRoundObj = (obj, fallback = 0) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'number') {
      out[k] = Number.isFinite(v) ? Math.round(v) : fallback;
    } else {
      out[k] = v;
    }
  }
  return out;
};
