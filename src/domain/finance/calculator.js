/**
 * @file domain/finance/calculator.js
 * @description The central orchestration engine for all project calculations.
 * Unifies tax, cost, and irr engines to ensure 1:1 result parity with monolith.
 * @version 2.1.0 - SPATIAL-FINANCIAL LOOP INTEGRATION
 */

import { calcVicStampDuty, calcGST } from './tax_engine.js';
import { calculateSiteWorksCosts } from './cost_engine.js';
import { calcTrueIRR, buildIRRCashFlows } from './irr_engine.js';
import { parseNum } from '../../core/utils/formatters.js';
import { evaluateConstraints, suggestLayout } from '../spatial/constraint_engine.js';

export class ProjectCalculator {
  constructor(state) {
    this.state = state;
  }

  calculateAll() {
    const { fin, plan, site, str, params } = this.state;
    
    // 1. Spatial Loop: Determine Layout & Density based on Frontage/Area
    const frontage = parseNum(site?.frontage) || 0;
    const area = parseNum(site?.area) || 0;
    const layoutSuggestion = suggestLayout(frontage, area);

    // 2. Constraint Loop: Map extracted facts to costs/risks
    const extractedFacts = site?.investigation?.facts || [];
    const synthesis = evaluateConstraints(extractedFacts);
    
    const triggeredCosts = synthesis.triggeredActions.reduce((acc, action) => {
      if (action.type === 'COST') {
        acc.hard = (acc.hard || 0) + (action.category === 'hard_cost' ? action.amount : 0);
        acc.soft = (acc.soft || 0) + (action.category === 'soft_cost' ? action.amount : 0);
      }
      return acc;
    }, { hard: 0, soft: 0 });

    // 3. Basic TDC (Total Development Cost)
    const landPrice = parseNum(fin.landPrice);
    const stampDuty = calcVicStampDuty(landPrice, params.isForeign);
    const landAcquisition = landPrice + stampDuty + Math.round(landPrice * 0.003 + 1500);
    
    const baseHardCosts = this.calculateHardCosts();
    const baseSoftCosts = this.calculateSoftCosts();
    const holdingCosts = this.calculateHoldingCosts();
    const saleCosts = this.calculateSaleCosts();
    
    // Add triggered constraint costs to the baseline
    const finalHardCosts = baseHardCosts + triggeredCosts.hard;
    const finalSoftCosts = baseSoftCosts + triggeredCosts.soft;
    
    const total = landAcquisition + finalHardCosts + finalSoftCosts + holdingCosts + saleCosts;
    const grv = parseNum(params.grv) || 0;
    const profit = grv - total;
    const margin = total > 0 ? (profit / total) * 100 : 0;
    
    // 4. Iterative RLV (Residual Land Value)
    const rlv = this.calculateRLV(grv, 20, total - landAcquisition);

    return {
      total,
      grv,
      profit,
      margin,
      hard: finalHardCosts,
      soft: finalSoftCosts,
      hold: holdingCosts,
      sale: saleCosts,
      land: landAcquisition,
      rlv,
      // Extended Insights
      insights: {
        layout: layoutSuggestion,
        constraints: synthesis 
      }
    };
  }

  calculateHardCosts() {
    const buildArea = parseNum(this.state.fin.buildArea);
    const psm = parseNum(this.state.fin.buildCostPSM) || 2500;
    return buildArea * psm;
  }

  calculateSoftCosts() {
    return parseNum(this.state.fin.softCosts) || 0;
  }

  calculateHoldingCosts() {
    return parseNum(this.state.fin.holdingCosts) || 0;
  }

  calculateSaleCosts() {
    const grv = parseNum(this.state.params.grv);
    return grv * 0.02; 
  }

  calculateRLV(grv, targetMarginPct, otherCosts) {
    if (!grv) return 0;
    const t = targetMarginPct / 100;
    const targetTotal = grv / (1 + t);
    let landGuess = targetTotal - otherCosts;
    
    for (let i = 0; i < 10; i++) {
      const duty = calcVicStampDuty(landGuess, this.state.params.isForeign);
      const legal = Math.round(landGuess * 0.003 + 1500);
      const newGuess = targetTotal - otherCosts - duty - legal;
      if (Math.abs(newGuess - landGuess) < 500) return Math.round(newGuess);
      landGuess = newGuess;
    }
    return Math.round(landGuess);
  }
}
