/**
 * @file domain/spatial/confidence_engine.js
 * @description Evaluates the reliability of project data.
 * High-confidence projects use verified/API-sourced data.
 * Low-confidence projects rely on manual or estimated input.
 * @version 1.1.0 - Fixed pillars to use fields that are actually populated in the store
 */

export const ConfidenceEngine = {

  /**
   * Calculates alignment confidence for a single metric (0-100).
   * Compares simulated value against extracted/verified value with a tolerance band.
   */
  calculateMetricConfidence: (simVal, extVal, tolerance) => {
    if (extVal === null || extVal === undefined) {
      return { score: 30, level: 'ESTIMATED', note: 'No evidence available' };
    }

    const diff       = Math.abs(simVal - extVal);
    const avg        = (simVal + extVal) / 2;
    const divergence = avg !== 0 ? (diff / avg) * 100 : 0;

    if (diff <= tolerance) {
      return { score: 100, level: 'VERIFIED', note: 'Perfect alignment' };
    }

    const score = Math.max(0, 100 - (divergence * 2));
    const level = score >= 80 ? 'VERIFIED' : score >= 50 ? 'EXTRACTED' : 'CONFLICT';
    const note  = score < 50 ? 'Critical discrepancy' : 'Moderate divergence';

    return { score: Math.round(score), level, note };
  },

  /**
   * Calculates an overall project confidence score (0-100).
   * Each pillar checks fields that are actually written by the application.
   *
   * @param {Object} state - The active scenario state (not full store state)
   * @returns {Object} { score, rating, breakdown }
   */
  calculateScore: (state) => {
    if (!state) return { score: 0, rating: 'Low', breakdown: [] };

    const site      = state.site      || {};
    const plan      = state.planning  || {};
    const market    = state.market    || {};
    const finance   = state.finance   || {};
    const inv       = site.investigation || {};
    const synthesis = inv.synthesis || null;

    const pillars = [
      {
        name:       'Site Data (Address, Area, Coordinates)',
        weight:     25,
        // Reliable when address + coordinates + non-zero area are all present
        isReliable: !!(site.address && site.lat && site.lon && site.area > 0)
      },
      {
        name:       'Site Dimensions (Frontage & Depth)',
        weight:     15,
        // Reliable when both dimensions are non-zero
        isReliable: !!(site.frontage > 0 && site.depth > 0)
      },
      {
        name:       'Planning (Zone)',
        weight:     20,
        // Reliable when a zone code is present (user entered or extracted from docs)
        isReliable: !!(plan.zone && plan.zone !== 'NRZ' || plan.zone === 'NRZ' && site.address)
      },
      {
        name:       'Market Data (GRV per Unit)',
        weight:     20,
        // Reliable when GRV per unit is non-zero
        isReliable: !!(market.grvPerUnit > 0)
      },
      {
        name:       'Financial Inputs (Land Price, Build Cost)',
        weight:     10,
        // Reliable when both key financial inputs are present
        isReliable: !!(finance.landPrice > 0 && finance.buildCostPSM > 0)
      },
      {
        name:       'Document Intelligence (VicPlan/S32)',
        weight:     10,
        // Reliable when the synthesis engine has run (documents were uploaded + parsed)
        isReliable: !!(synthesis && (synthesis.triggeredActions?.length > 0 || synthesis.activeAlerts?.length > 0))
      }
    ];

    let totalWeight  = 0;
    let earnedScore  = 0;

    pillars.forEach(p => {
      totalWeight += p.weight;
      if (p.isReliable) earnedScore += p.weight;
    });

    const score  = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;
    const rating = score >= 85 ? 'High' : score >= 55 ? 'Medium' : 'Low';

    return {
      score,
      rating,
      breakdown: pillars.map(p => ({
        name:        p.name,
        reliable:    p.isReliable,
        contribution: p.weight
      }))
    };
  }
};
