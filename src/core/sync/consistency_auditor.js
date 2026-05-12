/**
 * @file core/sync/consistency_auditor.js
 * @description Audits internal consistency of project state.
 * Detects logical conflicts where manual inputs diverge from physical constraints.
 * @version 1.1.0 - Fixed state path (scenario.site not state.site); added 300ms debounce
 */

import { store } from '../store/store.js';

export const SovereignConsistencyAuditor = {
  _timer: null,

  init() {
    store.subscribe((state) => {
      // Debounce: only run audit 300ms after the last state change
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => this.performFullAudit(state), 300);
    });
  },

  performFullAudit(state) {
    const activeId = state.system?.activeScenarioId;
    const scenario = state.scenarios?.[activeId];
    if (!scenario) return;

    const { site, planning, finance, market, physical } = scenario;
    const conflicts = [];

    // --- 1. Physical capacity vs. declared build area ---
    const terrainData = site?.investigation?.terrainData;
    const siteArea    = Number(site?.area) || 0;
    // Estimate buildable footprint: site area * 60% coverage * floor estimate
    const coverage    = 0.60;
    const estFloors   = planning?.maxHeight >= 9 ? 2 : 1;
    const capacity    = Math.round(siteArea * coverage * estFloors * 0.85);
    const userBuild   = Number(finance?.buildArea) || 0;

    if (userBuild > 0 && capacity > 0 && Math.abs(userBuild - capacity) / capacity > 0.25) {
      conflicts.push({
        id:         'CAPACITY_MISMATCH',
        severity:   'danger',
        label:      'Build Area vs. Site Capacity',
        message:    `Declared build area (${userBuild.toLocaleString()} m²) is more than 25% away from estimated site capacity (${capacity.toLocaleString()} m²).`,
        suggestion: 'Verify coverage ratio and floor count, or update build area to match physical constraints.'
      });
    }

    // --- 2. Zoning vs. unit count ---
    const grvUnits = Number(market?.grvUnits) || 0;
    const zone     = planning?.zone || 'NRZ';
    if (zone === 'NRZ' && grvUnits > 2) {
      conflicts.push({
        id:         'ZONING_PARADOX',
        severity:   'danger',
        label:      'NRZ Unit Count Conflict',
        message:    `NRZ zoning typically permits a maximum of 2 dwellings, but ${grvUnits} units are planned.`,
        suggestion: 'Re-verify zoning schedule or reduce unit count to avoid permit rejection.'
      });
    }

    // --- 3. Slope vs. site works budget ---
    const slope     = Number(physical?.slope) || (terrainData?.maxSlope) || 0;
    const siteWorks = Number(finance?.siteWorks) || 0;
    if (slope > 10 && siteWorks > 0 && siteWorks < 50000) {
      conflicts.push({
        id:         'UNDERFUNDED_RISK',
        severity:   'warn',
        label:      'Underfunded Site Works',
        message:    `Steep slope (${slope}°) detected but site works budget ($${siteWorks.toLocaleString()}) is below the $50,000 professional baseline.`,
        suggestion: 'Increase provisional sums for retaining walls and cut-and-fill earthworks.'
      });
    }

    // --- 4. Feasibility: margin below threshold ---
    const calcs  = scenario?.calculations || {};
    const margin = Number(calcs.margin) || 0;
    if (calcs.total > 0 && margin > -50 && margin < 10) {
      conflicts.push({
        id:         'LOW_MARGIN',
        severity:   'warn',
        label:      'Margin Below Viable Threshold',
        message:    `Project margin is ${margin.toFixed(1)}%, below the 15-20% industry minimum for bankable development.`,
        suggestion: 'Review land price, GRV assumptions, or unit count to improve margin.'
      });
    }

    // --- 5. GRV vs. land price sanity check ---
    const grv       = Number(calcs.grv) || 0;
    const landPrice = Number(finance?.landPrice) || 0;
    if (grv > 0 && landPrice > 0 && landPrice > grv * 0.75) {
      conflicts.push({
        id:         'LAND_GRV_RATIO',
        severity:   'danger',
        label:      'Land Cost Exceeds GRV Ratio',
        message:    `Land price ($${landPrice.toLocaleString()}) is more than 75% of GRV ($${grv.toLocaleString()}). Residual margin is insufficient.`,
        suggestion: 'Re-assess land price or increase GRV through higher spec or additional units.'
      });
    }

    // Only dispatch if the conflict list actually changed
    const prev = JSON.stringify(state.system?.consistencyConflicts || []);
    const next = JSON.stringify(conflicts);
    if (prev !== next) {
      store.dispatch('system.consistencyConflicts', conflicts);
    }
  }
};
