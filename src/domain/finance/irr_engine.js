/**
 * @file domain/finance/irr_engine.js
 * @description Monthly cash flow generation and IRR calculation using Newton-Raphson.
 * Integrates with cashflow_engine for industrial S-Curve distribution.
 * @version 2.1.0 - Fixed truncation at buildIRRCashFlows body.
 */

import { distributeCostsOverTime } from './cashflow_engine.js';

/**
 * TRUE IRR Calculation
 * Newton-Raphson on monthly cash flows.
 * Returns annualised IRR in %, or null if no solution.
 */
export const calcTrueIRR = (cashFlows, maxIter = 60, tol = 1e-8) => {
  if (!cashFlows || cashFlows.length < 2) return null;

  let r = 0.01; // starting guess: 1%/month
  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0;
    let dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const cf = cashFlows[t];
      if (!cf) continue;
      const disc = Math.pow(1 + r, t);
      npv  += cf / disc;
      dnpv -= (t * cf) / (disc * (1 + r));
    }
    if (Math.abs(dnpv) < 1e-10) break;
    const nr = r - npv / dnpv;
    if (Math.abs(nr - r) < tol) {
      r = nr;
      break;
    }
    r = Math.max(-0.99, Math.min(0.99, nr));
  }
  if (r <= -1 || isNaN(r)) return null;
  const annualIRR = (Math.pow(1 + r, 12) - 1) * 100;
  return Number.isFinite(annualIRR) ? annualIRR : null;
};

/**
 * Build professional monthly cash flows for IRR calc.
 * Uses industrial Sigmoid S-Curve for construction drawdowns.
 *
 * @param {number} land          - Total land acquisition cost (price + stamp duty)
 * @param {number} soft          - Soft costs (legal, contingency, planning fees)
 * @param {number} hard          - Hard costs (construction + site works)
 * @param {number} grv           - Gross Realisation Value (total sale proceeds)
 * @param {number} lvrPct        - Loan-to-Value Ratio, e.g. 65 = 65%
 * @param {number} projectMonths - Total project duration in months
 * @param {number} delayMonths   - Settlement delay after practical completion
 * @param {number} interestRate  - Annual interest rate, e.g. 6.5 = 6.5%
 * @returns {number[]} Monthly cash flows array (negative = outflow, positive = inflow)
 */
export const buildIRRCashFlows = (
  land,
  soft,
  hard,
  grv,
  lvrPct,
  projectMonths,
  delayMonths = 0,
  interestRate = 8.5
) => {
  const lv           = lvrPct / 100;
  const pm           = Math.max(6, Math.round(projectMonths));
  const planM        = Math.max(4, Math.round(pm * 0.47));
  const buildM       = pm - planM;
  const saleM        = 4;
  const settleStart  = pm + delayMonths;
  const totalM       = settleStart + saleM;
  const monthlyRate  = (interestRate / 100) / 12;

  // Distribute hard costs via S-Curve over construction phase
  const hardDist = distributeCostsOverTime(hard, buildM);

  const flows = Array(totalM + 1).fill(0);
  let loanBalance = 0;

  for (let m = 0; m <= totalM; m++) {
    let eq   = 0;  // equity outflow this month
    let db   = 0;  // debt drawdown this month
    let proc = 0;  // sale proceeds this month

    // Month 0: Land Acquisition
    if (m === 0) {
      eq          += land * (1 - lv);
      db          += land * lv;
      loanBalance += land * lv;
    }

    // Planning Phase (months 1..planM): Soft costs linear
    if (m >= 1 && m <= planM && soft > 0) {
      const monthlySoft = soft / planM;
      eq          += monthlySoft * (1 - lv);
      db          += monthlySoft * lv;
      loanBalance += monthlySoft * lv;
    }

    // Construction Phase (months planM..pm-1): Hard costs via S-Curve
    if (m >= planM && m < pm && hard > 0) {
      const idx   = m - planM;
      const draw  = (hardDist[idx] && hardDist[idx].amount) || 0;
      eq          += draw * (1 - lv);
      db          += draw * lv;
      loanBalance += draw * lv;
    }

    // Capitalised interest on outstanding loan balance
    const interest = loanBalance * monthlyRate;
    db          += interest;
    loanBalance += interest;

    // Exit Phase: GRV proceeds spread over saleM months after settlement start
    if (m > settleStart && m <= totalM && grv > 0) {
      proc += grv / saleM;
    }

    flows[m] = proc - eq - db;
  }

  return flows;
};
