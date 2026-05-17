/**
 * @file domain/finance/irr_engine.js
 * @description Monthly cash flow generation and IRR calculation using Newton-Raphson.
 * Integrates with cashflow_engine for industrial S-Curve distribution.
 * @version 3.0.0 - BREAKING: buildIRRCashFlows now returns correct Levered Equity cash flows.
 *
 * Previous bug: `flows[m] = proc - eq - db` subtracted debt drawdowns (db) as if the sponsor
 * paid them. This caused double-counting of the cost of capital:
 *   (a) interest was compounding in loanBalance (the true cost of debt), AND
 *   (b) the debt drawdown itself was being deducted from the sponsor's cash flow, as if the
 *       sponsor was paying the bank's portion of each cost item.
 *
 * Correct Levered Equity IRR model — cash flow from the SPONSOR's perspective only:
 *   Outflows : equity injections = cost_item × (1 − LVR) per month
 *   Inflows  : gross GRV proceeds spread over settlement phase
 *   Loan     : capitalised interest compounds balance but is NOT an equity outflow;
 *              full loan balance repaid as a bullet at final settlement month.
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
 * Build Levered Equity monthly cash flows for IRR calculation.
 * Uses industrial Sigmoid S-Curve for construction cost drawdowns.
 *
 * Cash flow perspective: the SPONSOR (equity investor) wallet.
 *   − Equity injections during development  (cost × (1 − LVR))
 *   + GRV proceeds spread over settlement phase
 *   − Bullet loan repayment at final settlement (full balance incl. capitalised interest)
 *
 * Debt drawdowns are NOT subtracted monthly — the bank funds its share directly.
 * Capitalised interest compounds the loan balance but creates no equity cash outflow
 * until repaid at exit.
 *
 * @param {number} land          - Total land acquisition cost (price + stamp duty)
 * @param {number} soft          - Soft costs (legal, contingency, planning fees)
 * @param {number} hard          - Hard costs (construction + site works)
 * @param {number} grv           - Gross Realisation Value (total sale proceeds)
 * @param {number} lvrPct        - Loan-to-Value Ratio, e.g. 65 = 65%
 * @param {number} projectMonths - Total project duration in months
 * @param {number} delayMonths   - Settlement delay after practical completion
 * @param {number} interestRate  - Annual interest rate, e.g. 6.5 = 6.5%
 * @returns {number[]} Monthly equity cash flows (negative = outflow, positive = inflow)
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
  const lv          = Math.min(0.95, Math.max(0, lvrPct / 100));
  const pm          = Math.max(6, Math.round(projectMonths));
  const planM       = Math.max(4, Math.round(pm * 0.47));
  const buildM      = Math.max(1, pm - planM);
  const saleM       = 4;
  const settleStart = pm + Math.max(0, Math.round(delayMonths));
  const totalM      = settleStart + saleM;
  const monthlyRate = (interestRate / 100) / 12;

  // Distribute hard costs via Sigmoid S-Curve over construction phase
  const hardDist = distributeCostsOverTime(hard, buildM);

  const flows = new Array(totalM + 1).fill(0);
  let loanBalance = 0;

  for (let m = 0; m <= totalM; m++) {
    let equityOut = 0;   // equity sponsor pays this month (positive = cash out)
    let grossProc = 0;   // GRV proceeds received this month (before loan repayment)

    // ── DEVELOPMENT PHASE ─────────────────────────────────────────────────────────────────────────────────────────────────
    // Month 0: Land acquisition equity injection
    if (m === 0) {
      equityOut   = land * (1 - lv);
      loanBalance = land * lv;               // bank funds its share
    }

    // Planning phase (months 1..planM): soft cost equity injections
    if (m >= 1 && m <= planM && soft > 0) {
      const s   = soft / planM;
      equityOut  += s * (1 - lv);
      loanBalance += s * lv;
    }

    // Construction phase (months planM..pm-1): hard cost equity via S-Curve
    if (m >= planM && m < pm && hard > 0) {
      const draw  = hardDist[m - planM]?.amount || 0;
      equityOut  += draw * (1 - lv);
      loanBalance += draw * lv;
    }

    // Capitalised interest: compounds loan balance; NOT an equity cash outflow.
    loanBalance += loanBalance * monthlyRate;

    // ── SETTLEMENT PHASE ──────────────────────────────────────────────────────────────────────────────────────────
    // GRV proceeds spread equally over saleM months starting after settleStart.
    if (m > settleStart && m <= totalM && grv > 0) {
      grossProc = grv / saleM;
    }

    // Bullet loan repayment at final settlement: sponsor repays full balance.
    const loanRepay = (m === totalM) ? loanBalance : 0;
    if (m === totalM) loanBalance = 0;

    // Sponsor's net cash flow this month:
    //   positive = money IN  (proceeds)
    //   negative = money OUT (equity injection + loan repayment at exit)
    flows[m] = grossProc - loanRepay - equityOut;
  }

  return flows;
};
