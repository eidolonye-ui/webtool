/**
 * @file core/sync/validators/sanity_validator.js
 * @description Ensures updated data is within plausible biological/economic ranges.
 */

export const validateRateUpdate = (oldValue, newValue) => {
  const MAX_VARIANCE = 0.02; // Maximum 2% change allowed per update
  
  if (typeof newValue !== 'number') return { valid: false, error: "Invalid data type" };
  
  const diff = Math.abs(oldValue - newValue);
  if (diff > MAX_VARIANCE) {
    return { 
      valid: false, 
      error: `Extreme Variance Detected: ${oldValue} -> ${newValue} (Diff: ${diff.toFixed(4)})` 
    };
  }
  
  return { valid: true };
};
