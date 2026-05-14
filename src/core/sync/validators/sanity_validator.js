/**
 * @file core/sync/validators/sanity_validator.js
 * @description Validates external data updates before they reach the store.
 * @version 1.1.0 - Fixed MAX_VARIANCE for percentage-expressed interest rates.
 */

/**
 * Validates that an interest rate update is within plausible bounds.
 *
 * Rates are expressed as percentages (e.g. 4.35 = 4.35%).
 * The RBA moves in 25bp (0.25%) increments. Historically the largest
 * single-meeting move was 100bp. Allow up to 200bp (2.0%) per update
 * to cover emergency cuts/hikes while still catching data errors.
 *
 * @param {number} oldValue - Previous rate (percentage, e.g. 4.35)
 * @param {number} newValue - New rate from data source
 * @returns {{ valid: boolean, error?: string }}
 */
export const validateRateUpdate = (oldValue, newValue) => {
  if (typeof newValue !== 'number' || !Number.isFinite(newValue)) {
    return { valid: false, error: 'Invalid data type — expected a finite number' };
  }

  if (newValue < 0 || newValue > 30) {
    return { valid: false, error: `Rate ${newValue}% is outside plausible range (0–30%)` };
  }

  // oldValue may be null/undefined on first load — skip delta check in that case
  if (oldValue != null && Number.isFinite(oldValue)) {
    const diff = Math.abs(oldValue - newValue);
    const MAX_DELTA_PCT = 2.0; // 200bp — covers emergency RBA moves
    if (diff > MAX_DELTA_PCT) {
      return {
        valid: false,
        error: `Extreme rate movement: ${oldValue}% → ${newValue}% (Δ${diff.toFixed(2)}pp exceeds ${MAX_DELTA_PCT}pp threshold)`
      };
    }
  }

  return { valid: true };
};
