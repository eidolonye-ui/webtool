/**
 * @file domain/finance/live_calc_engine.js
 * @description Real-time financial snapshot for AppShell live preview.
 * Reads from correct store path: state.scenarios[activeId].finance
 * @version 1.4.0 - IRR integration via irr_engine; fixed duplicate-content corruption.
 */

import { store } from '../../core/store/store.js';
import { calcVicStampDuty } from './tax_engine.js';
import { safeNum, safeRound, guardObj } from '../../core/utils/num_guard.js';
import { buildIRRCashFlows, calcTrueIRR } from './irr_engine.js';

// Module-level variable for delta tracking — survives HMR unlike function properties.
let _prevSnapshot = { margin: 0, profit: 0, grv: 0 };

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

  // 3. Land + stamp duty (unified via tax_engine)
  const landPrice  = Number(finance.landPrice)  || 0;
  const isForeign  = Boolean(finance.isForeign);
  const isOTP      = Boolean(finance.isOTP);
  const stampDuty  = landPrice > 0 ? calcVicStampDuty(landPrice, isForeign, isOTP) : 0;

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

  // 6. Total cost
  const totalCost = Math.round(
    landPrice + stampDuty + constructionCost + siteWorksCost +
    legalFees + contingency + holdingInterest
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
  const safeFootprint   = safeRound(Math.max(0, footprint));
  const safeSetbackLoss = safeRound(Math.max(0, setbackLoss));
  const safeTotalCost   = safeRound(Math.max(0, totalCost));
  const safeGrv         = safeRound(Math.max(0, grv));
  const safeProfit      = safeNum(profit);
  const safeMargin      = safeGrv > 0 ? safeNum((safeProfit / safeTotalCost) * 100) : 0;
  const safeStampDuty   = safeRound(Math.max(0, stampDuty));
  const safeIrr         = (irr !== null && Number.isFinite(irr)) ? Math.round(irr * 10) / 10 : null;
  const safeCapInterest = safeRound(Math.max(0, capInterest));

  const results = guardObj({
    land:        landPrice + safeStampDuty,
    hard:        constructionCost + siteWorksCost,
    soft:        legalFees,
    hold:        holdingInterest,
    contingency: contingency,
    total:       safeTotalCost,
    grv:         safeGrv,
    profit:      safeProfit,
    margin:      safeMargin,
    irr:         safeIrr,
    capInterest: safeCapInterest,
  });

  // 10. Delta vs. previous snapshot (module-level var — not lost on HMR)
  const delta = {
    margin: safeNum(Math.round((safeMargin - (_prevSnapshot.margin || 0)) * 10) / 10),
    profit: safeNum(safeProfit - (_prevSnapshot.profit || 0)),
    grv:    safeNum(safeGrv    - (_prevSnapshot.grv    || 0)),
  };
  _prevSnapshot = { margin: safeMargin, profit: safeProfit, grv: safeGrv };

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

/** Reset the delta baseline (call after scenario switch) */
export const resetLiveSnapshotBaseline = () => {
  _prevSnapshot = { margin: 0, profit: 0, grv: 0 };
};
