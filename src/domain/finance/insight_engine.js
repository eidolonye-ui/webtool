/**
 * @file domain/finance/insight_engine.js
 * @description Rule-based project insights engine (no external AI dependency).
 * @version 2.0.0 - Replaced Ollama calls with deterministic financial thresholds.
 *
 * Generates executive-level risk/opportunity analysis from the live financial snapshot.
 * Thresholds align with Melbourne development finance industry benchmarks (2024-25).
 */

// ---------------------------------------------------------------------------
// Threshold constants — Melbourne market benchmarks
// ---------------------------------------------------------------------------
const MARGIN_CRITICAL  = 12;   // % — below this is high risk
const MARGIN_HEALTHY   = 20;   // % — above this is comfortable
const IRR_CRITICAL     = 10;   // % — below this fails most lender tests
const IRR_HEALTHY      = 18;   // % — above this is strong

/**
 * Determine risk level from key financials.
 * @param {number} margin  - Project margin %
 * @param {number} irr     - IRR %
 * @param {Object} flags   - { hasCovenant, hasHeritage, hasFlood, hasS173 }
 * @returns {'High'|'Medium'|'Low'}
 */
const assessRisk = (margin, irr, flags = {}) => {
  const legalRisk = flags.hasCovenant || flags.hasHeritage || flags.hasS173;
  if (margin < MARGIN_CRITICAL || irr < IRR_CRITICAL || legalRisk) return 'High';
  if (margin < MARGIN_HEALTHY  || irr < IRR_HEALTHY)              return 'Medium';
  return 'Low';
};

/**
 * Generate a red flag string from the worst metric.
 */
const redFlag = (margin, irr, grv, tdc, flags) => {
  if (flags.hasCovenant)
    return 'Single dwelling covenant detected — multi-unit development is legally blocked until covenant is removed.';
  if (flags.hasS173)
    return 'Section 173 agreement on title — consult a planning solicitor before proceeding.';
  if (irr < IRR_CRITICAL)
    return `IRR of ${irr.toFixed(1)}% is below the 10% lender minimum — project is unlikely to obtain development finance.`;
  if (margin < MARGIN_CRITICAL)
    return `Margin of ${margin.toFixed(1)}% is below the 12% industry threshold — insufficient buffer for cost overruns.`;
  if (grv > 0 && tdc / grv > 0.88)
    return 'Cost-to-GRV ratio exceeds 88% — very thin equity buffer, minor cost blow-out could eliminate profit.';
  return null;
};

/**
 * Generate an opportunity string from the best metric.
 */
const opportunity = (margin, irr, state) => {
  const zone = state.planning?.zoneCode || '';
  if (['RGZ', 'MUZ', 'GRZ'].includes(zone))
    return `${zone} zoning may allow medium-density development — verify ResCode unit yield potential with a town planner.`;
  if (margin > MARGIN_HEALTHY + 10)
    return 'Strong margin — consider accelerating pre-sales to lock in profit and reduce holding cost exposure.';
  if (irr > IRR_HEALTHY + 5)
    return 'High IRR — project has capacity to absorb a value-management consultant to enhance specification and GRV.';
  return 'Review construction cost PSM against current tender market — labour costs softened ~4% in H2 2024.';
};

/**
 * Generate a strategic recommendation.
 */
const recommendation = (margin, irr, state) => {
  const buildPSM = parseFloat(state.finance?.buildCostPSM) || 0;
  if (buildPSM > 4500)
    return 'Build cost PSM appears high — benchmark against current market ($3,200–$4,200/m² for standard Melbourne medium-density). Engage a QS for independent cost plan.';
  if (margin < MARGIN_HEALTHY)
    return 'Improve margin by: (1) increasing sale price via upgraded specification or apartment mix, or (2) renegotiating land purchase price to reflect planning risk, or (3) reducing unit count to improve per-unit revenue.';
  return 'Project is viable — focus on pre-sales strategy and locking in a fixed-price construction contract to protect margin.';
};

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate project insights synchronously from current state + calculations.
 * Returns the same schema previously expected from the Ollama LLM call.
 *
 * @param {Object} state        - Full store state
 * @param {Object} calculations - { total, grv, profit, margin, irr }
 * @returns {Object} { riskLevel, riskReason, redFlag, opportunity, recommendation, confidenceScore }
 */
export const generateProjectInsights = (state, calculations) => {
  const { total = 0, grv = 0, profit = 0, margin = 0, irr = 0 } = calculations || {};
  const planning = state.scenarios?.[state.system?.activeScenarioId]?.planning || state.planning || {};

  const flags = {
    hasCovenant: !!(planning.hasSingleCovenant),
    hasHeritage: !!(planning.hasHO),
    hasFlood:    !!(planning.hasSBO),
    hasS173:     !!(planning.hasS173),
  };

  const risk    = assessRisk(margin, irr, flags);
  const riskReason = risk === 'High'
    ? (flags.hasCovenant ? 'Legal covenant blocks development.'
       : flags.hasS173   ? 'S.173 agreement constrains development.'
       : margin < MARGIN_CRITICAL ? `Margin ${margin.toFixed(1)}% is critically low.`
       : `IRR ${irr.toFixed(1)}% is below lender minimum.`)
    : risk === 'Medium'
    ? `Margin ${margin.toFixed(1)}% and IRR ${irr.toFixed(1)}% are viable but below optimal benchmarks.`
    : `Margin ${margin.toFixed(1)}% and IRR ${irr.toFixed(1)}% meet investment benchmarks.`;

  return {
    riskLevel:       risk,
    riskReason,
    redFlag:         redFlag(margin, irr, grv, total, flags),
    opportunity:     opportunity(margin, irr, state),
    recommendation:  recommendation(margin, irr, state),
    confidenceScore: total > 0 && grv > 0 ? 88 : 45,
  };
};

// Also export as async for callers that await it
export const generateProjectInsightsAsync = async (state, calculations) =>
  generateProjectInsights(state, calculations);
