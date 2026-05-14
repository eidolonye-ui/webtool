/**
 * @file domain/finance/comparison_engine.js
 * @description Multi-scenario comparison and strategy matrix engine.
 * @version 2.0.0 - Stage 5: strategy matrix, archetype presets, fixed GRV path.
 */

import { safeNum } from '../../core/utils/num_guard.js';

// ─────────────────────────────────────────────────────────────────────────────
// Strategy Archetypes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Preset parameter overrides for common Victorian development archetypes.
 * These are applied on top of the cloned baseline scenario when seeding.
 *
 * All values are finance/market/planning dispatch paths → values.
 */
export const STRATEGY_PRESETS = {
  dual_occ: {
    label:        'Dual Occupancy',
    strategyType: 'dual_occ',
    icon:         '🏠',
    description:  'Two dwellings on one lot — side-by-side or front/rear. Suits GRZ/NRZ. Low build cost, fast permit.',
    overrides: [
      { path: 'market.grvUnits',       value: 2 },
      { path: 'finance.buildCostPSM',  value: 2100 },
      { path: 'finance.contingencyPct',value: 5 },
      { path: 'finance.projectMonths', value: 18 },
    ]
  },
  townhouse: {
    label:        'Town Houses',
    strategyType: 'townhouse',
    icon:         '🏘️',
    description:  'Row of 3–6 attached dwellings. Most common GRZ/RGZ infill type.',
    overrides: [
      { path: 'market.grvUnits',       value: 4 },
      { path: 'finance.buildCostPSM',  value: 2350 },
      { path: 'finance.contingencyPct',value: 7 },
      { path: 'finance.projectMonths', value: 24 },
    ]
  },
  apartments: {
    label:        'Apartments / Mid-Rise',
    strategyType: 'apartments',
    icon:         '🏢',
    description:  'Medium-density 3–5 storey walk-up. Suits RGZ/MUZ sites >600m².',
    overrides: [
      { path: 'market.grvUnits',       value: 8 },
      { path: 'finance.buildCostPSM',  value: 2800 },
      { path: 'finance.contingencyPct',value: 10 },
      { path: 'finance.projectMonths', value: 30 },
    ]
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Key metrics for matrix display
// ─────────────────────────────────────────────────────────────────────────────

/** Ordered metric descriptors for the comparison matrix. */
export const MATRIX_METRICS = [
  { key: 'grv',         label: 'GRV',              path: 'calculations.grv',         fmt: 'currency', higherBetter: true  },
  { key: 'totalCost',   label: 'Total Cost',        path: 'calculations.total',       fmt: 'currency', higherBetter: false },
  { key: 'profit',      label: 'Net Profit',        path: 'calculations.profit',      fmt: 'currency', higherBetter: true  },
  { key: 'margin',      label: 'Margin on Cost',    path: 'calculations.margin',      fmt: 'pct',      higherBetter: true  },
  { key: 'irr',         label: 'IRR',               path: 'calculations.irr',         fmt: 'pct',      higherBetter: true  },
  { key: 'landCost',    label: 'Land + Stamp Duty', path: 'calculations.land',        fmt: 'currency', higherBetter: false },
  { key: 'hardCost',    label: 'Hard Costs',        path: 'calculations.hard',        fmt: 'currency', higherBetter: false },
  { key: 'softCost',    label: 'Soft Costs',        path: 'calculations.soft',        fmt: 'currency', higherBetter: false },
  { key: 'holdCost',    label: 'Holding Costs',     path: 'calculations.hold',        fmt: 'currency', higherBetter: false },
  { key: 'capInterest', label: 'Cap. Interest',     path: 'calculations.capInterest', fmt: 'currency', higherBetter: false },
  { key: 'units',       label: 'Unit Count',        path: 'market.grvUnits',          fmt: 'number',   higherBetter: null  },
  { key: 'grvPerUnit',  label: 'GRV / Unit',        path: 'market.grvPerUnit',        fmt: 'currency', higherBetter: true  },
  { key: 'months',      label: 'Project Months',    path: 'finance.projectMonths',    fmt: 'number',   higherBetter: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getByPath(obj, path) {
  const v = path.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
  return safeNum(v);
}

/**
 * Builds a full N×M matrix of scenario × metric values,
 * annotated with best/worst for each metric row.
 *
 * @param {Object} scenarios - state.scenarios map
 * @returns {Array<{ metric, values: [{scenarioId, value, isBest, isWorst}] }>}
 */
export const buildStrategyMatrix = (scenarios) => {
  const ids = Object.keys(scenarios || {});
  if (ids.length === 0) return [];

  return MATRIX_METRICS.map(m => {
    const values = ids.map(id => ({
      scenarioId: id,
      label:      scenarios[id]?.label || id,
      value:      getByPath(scenarios[id], m.path),
    }));

    if (m.higherBetter !== null) {
      const nums = values.map(v => v.value);
      const best  = m.higherBetter ? Math.max(...nums) : Math.min(...nums);
      const worst = m.higherBetter ? Math.min(...nums) : Math.max(...nums);

      values.forEach(v => {
        v.isBest  = nums.length > 1 && v.value === best;
        v.isWorst = nums.length > 1 && v.value === worst;
      });
    } else {
      values.forEach(v => { v.isBest = false; v.isWorst = false; });
    }

    return { metric: m, values };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Bilateral delta (original API — preserved for ComparisonPanel Delta tab)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates the delta between two scenarios across key financial metrics.
 */
export const calculateScenarioDelta = (base, target) => {
  const metrics = {
    profit:      'calculations.profit',
    margin:      'calculations.margin',
    irr:         'calculations.irr',
    totalCost:   'calculations.total',
    grv:         'calculations.grv',      // FIXED: was 'params.grv' (wrong path)
    land:        'calculations.land',
    hard:        'calculations.hard',
    soft:        'calculations.soft',
    hold:        'calculations.hold',
    capInterest: 'calculations.capInterest',
    landPrice:   'finance.landPrice',
  };

  const delta = {};

  Object.entries(metrics).forEach(([key, path]) => {
    const baseVal   = getByPath(base,   path);
    const targetVal = getByPath(target, path);
    const diff = targetVal - baseVal;
    const pct  = baseVal !== 0 ? (diff / Math.abs(baseVal)) * 100 : 0;

    delta[key] = {
      base:   baseVal,
      target: targetVal,
      diff,
      pct:    Number.isFinite(pct) ? pct : 0,
      trend:  diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable',
    };
  });

  return delta;
};

/**
 * Ranks scenarios by a specific metric path (descending).
 */
export const rankScenarios = (scenarios, metricPath) =>
  Object.keys(scenarios || {})
    .map(id => ({ id, val: getByPath(scenarios[id], metricPath) }))
    .sort((a, b) => b.val - a.val)
    .map(item => item.id);
