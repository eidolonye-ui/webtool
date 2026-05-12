/**
 * @file domain/finance/investment_engine.js
 * @description High-level investment orchestration engine.
 * Coordinates between IRR calculations, RLV iterations, and financial benchmarks.
 * @version 2.0.0
 */

import { calcTrueIRR, buildIRRCashFlows } from './irr_engine.js';

/**
 * Orchestrates the full IRR analysis for a project.
 * Wraps the underlying irr_engine to provide a simplified interface for the UI.
 */
export const analyzeProjectIRR = (params) => {
  const {
    land,
    soft,
    hard,
    grv,
    lvrPct,
    projectMonths,
    delayMonths,
    interestRate
  } = params;

  const cashFlows = buildIRRCashFlows(
    land,
    soft,
    hard,
    grv,
    lvrPct,
    projectMonths,
    delayMonths,
    interestRate
  );

  const irr = calcTrueIRR(cashFlows);

  return {
    irr: irr ? parseFloat(irr.toFixed(2)) : null,
    cashFlows,
    totalMonths: cashFlows.length - 1
  };
};

/**
 * ITERATIVE RLV ENGINE
 * Accounts for circular dependency: stamp duty = f(landPrice).
 * 
 * @param {number} grv - Gross Realization Value
 * @param {number} targetMarginPct - Desired profit margin (%)
 * @param {number} otherCostsExLand - All costs excluding land and stamp duty
 * @param {boolean} isForeign - Whether the buyer is a foreign national (affects duty)
 * @param {number} maxIter - Iteration limit for convergence
 */
export const calcRLVIterative = (
  grv,
  targetMarginPct,
  otherCostsExLand,
  isForeign = false,
  maxIter = 10
) => {
  if (!grv || grv <= 0) return null;
  
  const t = targetMarginPct / 100;
  const targetTotal = grv / (1 + t);
  
  let landGuess = targetTotal - otherCostsExLand;
  if (landGuess <= 0) return 0;
  
  // Return a closure that requires the tax function from tax_engine.js
  // This maintains decoupling from the tax engine while allowing circular calculation.
  return { 
    execute: (taxFn) => {
      let currentGuess = landGuess;
      for (let i = 0; i < maxIter; i++) {
        const duty = taxFn(Math.max(0, currentGuess), isForeign);
        const legalEst = Math.round(currentGuess * 0.003 + 1500); 
        const newGuess = targetTotal - otherCostsExLand - duty - legalEst;
        
        if (Math.abs(newGuess - currentGuess) < 500) {
          return Math.round(Math.max(0, newGuess));
        }
        currentGuess = newGuess;
      }
      return Math.round(Math.max(0, currentGuess));
    }
  };
};
