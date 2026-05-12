/**
 * @file domain/finance/comparison_engine.js
 * @description Logic for comparing multiple project scenarios to highlight deltas and variances.
 * @version 1.0.0
 */

/**
 * Calculates the difference between two scenarios for a specific set of metrics.
 * @param {Object} base - The baseline scenario data.
 * @param {Object} target - The target scenario data for comparison.
 * @returns {Object} A map of metrics with their absolute and percentage differences.
 */
export const calculateScenarioDelta = (base, target) => {
  const metrics = {
    profit: 'calculations.profit',
    margin: 'calculations.margin',
    irr: 'calculations.irr',
    totalCost: 'calculations.total',
    landPrice: 'finance.landPrice',
    grv: 'params.grv',
  };

  const delta = {};

  Object.entries(metrics).forEach(([key, path]) => {
    const baseVal = getValueByPath(base, path);
    const targetVal = getValueByPath(target, path);
    
    const diff = targetVal - baseVal;
    const pct = baseVal !== 0 ? (diff / Math.abs(baseVal)) * 100 : 0;

    delta[key] = {
      base: baseVal,
      target: targetVal,
      diff: diff,
      pct: pct,
      trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable'
    };
  });

  return delta;
};

/**
 * Helper to extract nested values from scenario state.
 */
function getValueByPath(obj, path) {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj) || 0;
}

/**
 * Ranks scenarios based on a specific metric (e.g., IRR).
 * @param {Object} scenarios - Map of all scenarios { id: data }.
 * @param {string} metricPath - Path to the metric to rank by.
 * @returns {Array} Sorted array of scenario IDs.
 */
export const rankScenarios = (scenarios, metricPath) => {
  return Object.keys(scenarios)
    .map(id => ({ id, val: getValueByPath(scenarios[id], metricPath) }))
    .sort((a, b) => b.val - a.val)
    .map(item => item.id);
};
