/**
 * @file domain/finance/irr_engine.js
 * @description Monthly cash flow generation and IRR calculation using Newton-Raphson.
 * Integrates with cashflow_engine for industrial S-Curve distribution.
 * @version 2.0.0
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
      npv += cf / disc;
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
  return (Math.pow(1 + r, 12) - 1) * 100; // annualise
};

/**
 * Build professional monthly cash flows for IRR calc.
 * Replaces legacy Cosine-S-Curve with industrial Sigmoid-S-Curve.
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
  const lv = lvrPct / 100;
  const pm = Math.max(6, Math.round(projectMonths));
  const planM = Math.max(4, Math.round(pm * 0.47));
  const buildM = pm - planM;
  const saleM = 4;
  const settleStart = pm + delayMonths;
  const totalM = settleStart + saleM;
  const monthlyRate = (interestRate / 100) / 12;

  // 1. Distribute Hard Costs using S-Curve
  const hardCostDistribution = distributeCostsOverTime(hard, buildM);
  
  const flows = Array(totalM + 1).fill(0);
  let cumulativeLoanBalance = 0;

  for (let m = 0; m <= totalM; m++) {
    let eq = 0; // Equity outflow
    let db = 0;  // Debt outflow/drawdown
    let proc = 0; // Proceeds inflow

    // Month 0: Land Acquisition
    if (m === 0) {
      eq += land * (1 - lv);
      db += land * lv;
      cumulativeLoanBalance += land * lv;
    }

    // Planning Phase: Soft costs distributed linearly
    if (m >= 1 && m <= planM && soft > 0) {
      const monthlySoft = soft / planM;
      eq += monthlySoft * (1 - lv);
      db += monthlySoft * lv;
      cumulativeLoanBalance += monthlySoft * lv;
    }

    // Construction Phase: Hard costs distributed via S-Curve
    if (m >= planM && m < pm && hard > 0) {
      const monthIdx = m - planM;
      const draw = hardCostDistribution[monthIdx] || { amount: 0 };
      
      eq += draw.amount * (1 - lv);
      db += draw.amount * lv;
      cumulativeLoanBalance += draw.amount * lv;
    }

    // Interest Calculation: Applied to cumulative loan balance
    const interestExpense = cumulativeLoanBalance * monthlyRate;
    db += interestExpense; // Interest is typically capitalized (added to loan)
    cumulativeLoanBalance += interestExpense;

    // Exit Phase: GRV proceeds
    if (m > settleStart && m <= totalM && grv > 0) {
      proc += grv / saleM;
    }

    // Final Cash Flow: Inflow - Outflow
    flows[m] = proc - eq - db;
  }

  return flows;
};
