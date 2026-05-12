/**
 * @file core/sync/sovereign_orchestrator.js
 * @description Real-time synchronization orchestrator between Spatial and Financial domains.
 * Ensures that physical site changes (like footprint) immediately ripple through to the financial model.
 * @version 1.0.0
 */

import { store } from '../store/store.js';
import { calculateProjectFinances } from '../../domain/finance/financial_engine.js';

// Default Coupling Constants
const COUPLING_CONFIG = {
  DEFAULT_FLOORS: 3,
  DEFAULT_EFFICIENCY: 0.85, // Net usable area / Gross area
};

export const SovereignSyncOrchestrator = {
  init() {
    console.log('[SovereignSync] Initializing Spatial-Financial Coupling...');
    
    store.subscribe((state) => {
      this.syncSpatialToFinancial(state);
    });
  },

  /**
   * The core coupling logic: 
   * Physical Footprint -> Build Area -> Financials
   */
  syncSpatialToFinancial(state) {
    const scenario = store.getActiveScenario();
    if (!scenario) return;

    const terrainData = scenario.site?.investigation?.terrainData;
    const synthesis = scenario.site?.investigation?.synthesis;
    const finance = scenario.finance || {};
    const locks = scenario.financeLocks || {};
    
    // 1. Calculate dynamic build area based on footprint
    const footprint = terrainData?.footprint || (scenario.site?.area * 0.6) || 0;
    const calculatedBuildArea = Math.round(
      footprint * COUPLING_CONFIG.DEFAULT_FLOORS * COUPLING_CONFIG.DEFAULT_EFFICIENCY
    );

    // 2. Check for locks before updating Build Area
    const shouldUpdateBuildArea = !locks.buildArea && calculatedBuildArea !== finance.buildArea;
    
    if (shouldUpdateBuildArea) {
      console.log(`[SovereignSync] Footprint changed. Updating Build Area to ${calculatedBuildArea}m2.`);
      const tempFinance = { ...finance, buildArea: calculatedBuildArea };
      const results = this.runFinancialPipeline(state, tempFinance);
      if (results) {
        store.dispatch('finance.buildArea', calculatedBuildArea);
        store.dispatch('calculations', results);
      }
    }

    // 3. Risk-to-Cost Coupling (The Sovereign Premium)
    this.syncRisksToCosts(scenario, synthesis);
  },

  /**
   * Maps synthesis alignment status to financial suggestions.
   * Instead of forcing values, it updates "suggestions" in the state.
   */
  syncRisksToCosts(scenario, synthesis) {
    if (!synthesis || !synthesis.alignment) return;

    const alignment = synthesis.alignment;
    const suggestions = {};

    // Logic: If Terrain Slope is CONFLICT, suggest higher Contingency
    if (alignment.maxSlope?.status === 'CONFLICT') {
      suggestions.contingencyPct = 12; // Suggest 12% instead of 5%
      suggestions.contingencyNote = 'High terrain conflict: recommend 12% contingency for unforeseen site works.';
    } else if (alignment.maxSlope?.status === 'ESTIMATED') {
      suggestions.contingencyPct = 8;
      suggestions.contingencyNote = 'Terrain estimated: recommend 8% contingency.';
    }

    // Logic: If land area is CONFLICT, suggest higher siteWorks budget
    if (alignment.siteArea?.status === 'CONFLICT') {
      suggestions.siteWorksPremium = 25000; 
      suggestions.siteWorksNote = 'Boundary conflict: suggest +$25k for survey and legal adjustments.';
    }

    // Update suggestions in store (new system.financeSuggestions state)
    store.dispatch('system.financeSuggestions', suggestions);
  },

  /**
   * Wraps the financial_engine with the necessary dependencies to run in the background
   */
  runFinancialPipeline(state, overrideFinance) {
    try {
      const scenario = store.getActiveScenario();
      
      const args = {
        fin: overrideFinance,
        market: scenario.market || {},
        plan: scenario.planning || {},
        conds: { 
          slopeClass: 'auto', 
          soilClass: 'M', 
          rockGrade: 'R1',
          bushfireProne: false 
        },
        siteInv: scenario.site?.investigation || {},
        site: scenario.site || {},
        str: { projectMonths: 24 },
        params: { builderMarginPct: 10, marketRiskPct: 5, buildType: 'std-th' },
        utils: { 
          parseNum: (v) => parseFloat(v) || 0, 
          calcVicSROLandTax: (p, y) => p * 0.01 * y,
          buildIRRCashFlows: () => [], 
          calcTrueIRR: () => 0, 
          estimateIRR: () => 0, 
          calcGST: (v) => v * 0.1, 
          calcRLVIterative: () => 0 
        },
        external: { 
          calcBuildCost: { total: null }, 
          calcFeasScore: () => 70 
        }
      };

      return calculateProjectFinances(args);
    } catch (e) {
      console.error('[SovereignSync] Financial Pipeline Error:', e);
      return null;
    }
  }
};
