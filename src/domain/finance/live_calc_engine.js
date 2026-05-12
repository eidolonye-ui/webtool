/**
 * @file domain/finance/live_calc_engine.js
 * @description Real-time financial snapshot for AppShell live preview.
 * Reads from correct store path: state.scenarios[activeId].finance
 * @version 1.3.0 - Unified stamp duty via tax_engine; removed duplicate implementation
 */

import { store } from '../../core/store/store.js';
import { calcVicStampDuty } from './tax_engine.js';

/**
 * Compute a quick live snapshot of key financial metrics.
 * Used by AppShell for the live sidebar preview.
 *
 * @returns {Object} { footprint, setbackLoss, margin, totalCost, profit, stampDuty, grv, results, delta }
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
  const buildArea     = Number(finance.buildArea)      || footprint;
  const buildCostPSM  = Number(finance.buildCostPSM)   || 2200;
  const siteWorksCost = Number(physical.siteWorksCost) || 0;
  const legalFees     = Number(finance.legalFees)      || 15000;
  const contingencyPct = Number(finance.contingencyPct) || 5;
  const projectMonths = Number(finance.projectMonths)  || 24;

  const constructionCost = buildArea * buildCostPSM;
  const contingency      = Math.round((constructionCost + siteWorksCost) * (contingencyPct / 100));

  // 5. Holding/interest costs
  const lvrPct       = Number(financing.lvrPct)       || 65;
  const interestRate = Number(financing.interestRate)  || 6.5;
  const seniorDebt   = Math.round((landPrice + constructionCost) * (lvrPct / 100));
  const holdingInterest = Math.round(seniorDebt * (interestRate / 100) * (projectMonths / 12) * 0.5);

  // 6. Total cost
  const totalCost = Math.round(
    landPrice + stampDuty + constructionCost + siteWorksCost +
    legalFees + contingency + holdingInterest
  );

  // 7. Profit + margin
  const profit = grv - totalCost;
  const margin = grv > 0 ? Math.round((profit / totalCost) * 1000) / 10 : 0;

  // 8. Cost breakdown
  const results = {
    land:        landPrice + stampDuty,
    hard:        constructionCost + siteWorksCost,
    soft:        legalFees,
    hold:        holdingInterest,
    contingency: contingency,
    total:       totalCost,
    grv:         grv,
    profit:      profit,
    margin:      margin
  };

  // 9. Delta vs. previous snapshot
  const prev  = getLiveSnapshot._prev || {};
  const delta = {
    margin: Math.round((margin - (prev.margin || 0)) * 10) / 10,
    profit: profit - (prev.profit || 0),
    grv:    grv    - (prev.grv    || 0)
  };
  getLiveSnapshot._prev = { margin, profit, grv };

  return { footprint, setbackLoss, margin, totalCost, profit, stampDuty, grv, results, delta };
}

/** @deprecated Use getLiveSnapshot */
export const computeLiveSnapshot = getLiveSnapshot;
