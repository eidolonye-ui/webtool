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
  _timer: null,

  init() {
    console.log('[SovereignSync] Initializing Spatial-Financial Coupling...');

    store.subscribe((state) => {
      // Debounce: only run sync 400ms after the last state change,
      // preventing a full pipeline execution on every keystroke.
      if (this._timer) clearTimeout(this._timer);
      this._timer = setTimeout(() => this.syncSpatialToFinancial(state), 400);
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
    
    // 1. Calculate dynamic build area based on footprint.
    // terrainData.footprint doesn't exist — use effectiveArea from synthesis
    // (the authoritative post-setback buildable area), falling back to 60% of site.
    const effectiveArea = synthesis?.effectiveArea || 0;
    const footprint = effectiveArea > 0
      ? effectiveArea
      : (parseFloat(scenario.site?.area) || 0) * 0.60;
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
   * Maps site investigation results to financial suggestions.
   * Uses terrain slope (from terrainData) and synthesis warnings rather than
   * the non-existent synthesis.alignment object.
   * Instead of forcing values, it updates "suggestions" in the state.
   */
  syncRisksToCosts(scenario, synthesis) {
    const terrainData = scenario.site?.investigation?.terrainData;
    const suggestions = {};

    // Slope-driven contingency suggestion
    const maxSlope = terrainData?.slope || terrainData?.metrics?.maxSlope || 0;
    if (maxSlope >= 15) {
      suggestions.contingencyPct  = 12;
      suggestions.contingencyNote = `Steep slope (${maxSlope.toFixed(1)}%): recommend 12% contingency for retaining and earthworks.`;
    } else if (maxSlope >= 8) {
      suggestions.contingencyPct  = 8;
      suggestions.contingencyNote = `Moderate slope (${maxSlope.toFixed(1)}%): recommend 8% contingency.`;
    }

    // Synthesis implicit-cost warnings → flag premium site works
    const implicitCosts = synthesis?.implicitCosts || [];
    const hasCritical   = implicitCosts.some(w => w.type === 'CRITICAL');
    if (hasCritical && !suggestions.contingencyPct) {
      suggestions.contingencyPct  = 10;
      suggestions.contingencyNote = 'Critical site risk detected: recommend minimum 10% contingency.';
    }

    // Area inconsistency: surveyed vs OSM area differ >10% → flag survey cost
    const surveyedArea = parseFloat(scenario.site?.area) || 0;
    const osmArea      = terrainData?.area || 0;
    if (surveyedArea > 0 && osmArea > 0 && Math.abs(surveyedArea - osmArea) / surveyedArea > 0.10) {
      suggestions.siteWorksPremium = 25000;
      suggestions.siteWorksNote   = 'Area inconsistency between surveyed and OSM data: suggest +$25k for survey clarification.';
    }

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
