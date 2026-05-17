/**
 * @file domain/finance/live_calc_engine.js
 * @description Real-time financial snapshot for AppShell live preview.
 * Reads from correct store path: state.scenarios[activeId].finance
 * @version 1.6.0 - OTP removed; council contributions (POS+CIL) added to totalCost.
 */

import { store } from '../../core/store/store.js';
import { calcVicStampDuty } from './tax_engine.js';
import { safeNum, safeRound, guardObj } from '../../core/utils/num_guard.js';
import { buildIRRCashFlows, calcTrueIRR } from './irr_engine.js';

// Per-scenario delta map — keyed by scenarioId.
// Using a Map prevents cross-scenario delta bleed when the user rapidly switches
// between scenarios (previously a single shared object caused the delta shown for
// scenario B to be "B minus A's last values").
// Module-level placement survives HMR (see Task #60).
const _prevSnapshots = new Map();

/**
 * Compute a quick live snapshot of key financial metrics.
 * Used by AppShell for the live sidebar preview.
 *
 * @returns {Object} { footprint, setbackLoss, margin, totalCost, profit, stampDuty, grv, irr, results, delta }
 */
export function getLiveSnapshot() {
  const state    = store.getState();
  const activeId = state.system.activeScenarioId;
  const scenario = state.scenarios[activeId] || {};

  const site      = scenario.site      || {};
  const plan      = scenario.planning  || {};
  const physical  = scenario.physical  || {};
  const finance   = scenario.finance   || {};
  const market    = scenario.market    || {};
  const financing = scenario.financing || {};

  const area     = Number(site.area)     || 0;
  const frontage = Number(site.frontage) || 0;
  const depth    = Number(site.depth)    || 0;

  // 1. Footprint after setbacks
  const frontSetback = Number(plan.setbacks?.front) || 5;
  const sideSetback  = Number(plan.setbacks?.side)  || 1.5;
  const rearSetback  = Number(plan.setbacks?.rear)  || 3;

  const effectiveDepth = Math.max(0, depth - frontSetback - rearSetback);
  const effectiveWidth = Math.max(0, frontage - sideSetback * 2);
  const footprint      = Math.round(effectiveDepth * effectiveWidth);
  const setbackLoss    = Math.max(0, area - footprint);

  // 2. GRV
  const grvPerUnit = Number(market.grvPerUnit) || 0;
  const grvUnits   = Number(market.grvUnits)   || 1;
  const grv        = grvPerUnit * grvUnits;

  // 3. Land + stamp duty (OTP concession removed — invalid for developer purchases since 2017-07-01)
  const landPrice = Number(finance.landPrice) || 0;
  const isForeign = Boolean(finance.isForeign);
  const stampDuty = landPrice > 0 ? calcVicStampDuty(landPrice, isForeign) : 0;

  // 4. Construction costs
  const buildArea      = Number(finance.buildArea)      || footprint;
  const buildCostPSM   = Number(finance.buildCostPSM)   || 2200;
  const siteWorksCost  = Number(physical.siteWorksCost) || 0;
  const legalFees      = Number(finance.legalFees)      || 15000;
  const contingencyPct = Number(finance.contingencyPct) || 5;
  const projectMonths  = Number(finance.projectMonths)  || 24;

  const constructionCost = buildArea * buildCostPSM;
  const contingency      = Math.round((constructionCost + siteWorksCost) * (contingencyPct / 100));

  // 5. Holding/interest costs
  const lvrPct          = Number(financing.lvrPct)      || 65;
  const interestRate    = Number(financing.interestRate) || 6.5;
  const seniorDebt      = Math.round((landPrice + constructionCost) * (lvrPct / 100));
  const holdingInterest = Math.round(seniorDebt * (interestRate / 100) * (projectMonths / 12) * 0.5);

  // 6. Council contributions (POS + CIL) — mandatory for 3+ dwellings in Melbourne
  //    POS: % of unimproved land value (varies 2–5% by council)
  //    CIL: per-dwelling flat fee (varies $2,000–$6,000 by council)
  const posContributionPct = Number(plan.posContributionPct) || 3;   // default 3%
  const cilPerUnit         = Number(plan.cilPerUnit)         || 3500; // default $3,500/dwelling
  const councilContributions = grvUnits >= 3
    ? Math.round(landPrice * (posContributionPct / 100) + grvUnits * cilPerUnit)
    : 0;  // no council contribution for <3 dwellings

  // 7. Total cost
  const totalCost = Math.round(
    landPrice + stampDuty + constructionCost + siteWorksCost +
    legalFees + contingency + holdingInterest + councilContributions
  );

  // 7. Profit + margin
  const profit = grv - totalCost;
  const margin = grv > 0 ? Math.round((profit / totalCost) * 1000) / 10 : 0;

  // 8. IRR — Newton-Raphson on monthly cash flows (skip if inputs are degenerate)
  let irr = null;
  let capInterest = holdingInterest; // capitalised interest approximation
  try {
    if (grv > 0 && landPrice > 0 && projectMonths >= 6) {
      const softCosts = legalFees + contingency;
      const hardCosts = constructionCost + siteWorksCost;
      const cashFlows = buildIRRCashFlows(
        landPrice + stampDuty,  // total land acquisition
        softCosts,
        hardCosts,
        grv,
        lvrPct,
        projectMonths,
        0,                      // delayMonths
        interestRate
      );
      irr = calcTrueIRR(cashFlows);
    }
  } catch (_) {
    irr = null;
  }

  // 9. Guard all values before they leave this function
  const safeFootprint          = safeRound(Math.max(0, footprint));
  const safeSetbackLoss        = safeRound(Math.max(0, setbackLoss));
  const safeTotalCost          = safeRound(Math.max(0, totalCost));
  const safeGrv                = safeRound(Math.max(0, grv));
  const safeProfit             = safeNum(profit);
  const safeMargin             = safeGrv > 0 ? safeNum((safeProfit / safeTotalCost) * 100) : 0;
  const safeStampDuty          = safeRound(Math.max(0, stampDuty));
  const safeIrr                = (irr !== null && Number.isFinite(irr)) ? Math.round(irr * 10) / 10 : null;
  const safeCapInterest        = safeRound(Math.max(0, capInterest));
  const safeCouncilContribs    = safeRound(Math.max(0, councilContributions));

  const results = guardObj({
    land:               landPrice + safeStampDuty,
    hard:               constructionCost + siteWorksCost,
    soft:               legalFees,
    hold:               holdingInterest,
    contingency:        contingency,
    councilContribs:    safeCouncilContribs,
    total:              safeTotalCost,
    grv:                safeGrv,
    profit:             safeProfit,
    margin:             safeMargin,
    irr:                safeIrr,
    capInterest:        safeCapInterest,
  });

  // 10. Delta vs. previous snapshot for this specific scenario.
  // Using a per-scenario entry prevents delta bleed when switching between scenarios.
  const prev  = _prevSnapshots.get(activeId) || { margin: 0, profit: 0, grv: 0 };
  const delta = {
    margin: safeNum(Math.round((safeMargin - prev.margin) * 10) / 10),
    profit: safeNum(safeProfit - prev.profit),
    grv:    safeNum(safeGrv    - prev.grv),
  };
  _prevSnapshots.set(activeId, { margin: safeMargin, profit: safeProfit, grv: safeGrv });

  return {
    footprint:   safeFootprint,
    setbackLoss: safeSetbackLoss,
    margin:      safeMargin,
    totalCost:   safeTotalCost,
    profit:      safeProfit,
    stampDuty:   safeStampDuty,
    grv:         safeGrv,
    irr:         safeIrr,
    capInterest: safeCapInterest,
    results,
    delta,
  };
}

/** @deprecated Use getLiveSnapshot */
export const computeLiveSnapshot = getLiveSnapshot;

/**
 * Reset the delta baseline after a scenario switch.
 * @param {string} [scenarioId] - Reset a specific scenario's baseline.
 *   If omitted, clears ALL scenario baselines (e.g. on full app reset).
 */
export const resetLiveSnapshotBaseline = (scenarioId) => {
  if (scenarioId) {
    _prevSnapshots.delete(scenarioId);
  } else {
    _prevSnapshots.clear();
  }
};
