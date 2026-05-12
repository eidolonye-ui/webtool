/**
 * @file domain/spatial/synthesis_engine.js
 * @description Sovereign Synthesis Engine.
 * Converts spatial geometric results into financial yield waterfalls and cost warnings.
 * @version 2.0.0 - Fix #26: actually use the constraints (planning) argument for setbacks/easements/TPZ.
 *
 * Argument semantics:
 *   terrainData  - result from runSiteInvestigation() { polygon, slope, aspect, elevationDelta, metrics, ... }
 *   siteState    - site section from store (site.address, site.area, site.frontage, ...)
 *   constraints  - planning section from store (planning.setbacks.{front,side,rear}, planning.hasEasementBoe, ...)
 *
 * Setback priority:
 *   1. constraints.setbacks.{front,side,rear}  → derive average from planning panel values
 *   2. constraints.setbacks.average            → explicit average if set
 *   3. siteState.setbacks                      → legacy field
 *   4. 3.0m default (VicPlan NRZ minimum)
 */

import { calculateSovereignYield } from './terrain_engine.js';

/**
 * Derive an average setback (in metres) from the planning setbacks object.
 * Averages whichever of front/side/rear are explicitly set (>0), falls back gracefully.
 *
 * @param {Object} setbacks - e.g. { front: 5, side: 1, rear: 3 }
 * @returns {number} average setback in metres
 */
const deriveAverageSetback = (setbacks) => {
  if (!setbacks) return null;
  // Named scalar
  if (typeof setbacks.average === 'number' && setbacks.average > 0) return setbacks.average;
  // Individual faces — average whichever are set
  const vals = [setbacks.front, setbacks.side, setbacks.rear]
    .map(v => parseFloat(v))
    .filter(v => !isNaN(v) && v > 0);
  if (vals.length === 0) return null;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
};

/**
 * Parse easements into the format calculateSovereignYield expects: [{ width: number }]
 * Accepts:
 *   - an array of { width } objects (already correct)
 *   - a boolean (hasEasementBoe → assume 2m standard drain easement)
 *   - null / undefined → []
 */
const parseEasements = (easements, hasEasementBoe) => {
  if (Array.isArray(easements) && easements.length > 0) return easements;
  if (hasEasementBoe) return [{ width: 2 }]; // 2m standard drain easement
  return [];
};

export const synthesizeSiteAnalysis = (terrainData, siteState = {}, constraints = {}) => {
  if (!terrainData || !terrainData.polygon) {
    return { error: 'No geometry data available for synthesis.' };
  }

  // ---------------------------------------------------------------------------
  // Fix #26: build combinedConstraints from the constraints (planning) arg first,
  // falling back to siteState fields, then hardcoded defaults.
  // ---------------------------------------------------------------------------
  const setbackAvg =
    deriveAverageSetback(constraints.setbacks) ??  // planning panel values
    deriveAverageSetback(siteState.setbacks)   ??  // legacy
    3.0;                                           // VicPlan NRZ default

  const combinedConstraints = {
    setbacks: {
      average: setbackAvg,
      front:   parseFloat(constraints.setbacks?.front) || setbackAvg,
      side:    parseFloat(constraints.setbacks?.side)  || 1.0,
      rear:    parseFloat(constraints.setbacks?.rear)  || 3.0,
    },
    easements: parseEasements(
      constraints.easements || siteState.easements,
      constraints.hasEasementBoe
    ),
    tpz: constraints.tpz || siteState.tpz || [],
  };

  // ---------------------------------------------------------------------------
  // 1. Sovereign Yield Waterfall
  // ---------------------------------------------------------------------------
  const { waterfall, effectiveArea, finalPolygon } = calculateSovereignYield(
    terrainData.polygon,
    combinedConstraints
  );

  // ---------------------------------------------------------------------------
  // 2. Implicit cost warnings
  // ---------------------------------------------------------------------------
  const warnings = [];
  const slope          = terrainData.slope          || 0;
  const elevationDelta = terrainData.elevationDelta || 0;
  const frontage       = siteState.frontage         || terrainData.metrics?.frontage || 0;

  if (slope > 15) {
    warnings.push({
      type: 'CRITICAL',
      label: 'Retaining Wall Cost',
      message: `Slope of ${slope.toFixed(1)}% far exceeds threshold for simple grading. Significant structural retaining costs expected — obtain geotechnical report.`,
      impact: 'High CapEx',
    });
  } else if (slope > 8) {
    warnings.push({
      type: 'WARNING',
      label: 'Site Grading Required',
      message: `Moderate slope of ${slope.toFixed(1)}%. Grading and possible split-level design required for stable footprint.`,
      impact: 'Medium CapEx',
    });
  }

  if (elevationDelta > 3) {
    warnings.push({
      type: 'CRITICAL',
      label: 'Stepped Floor Plan',
      message: `Elevation delta of ${elevationDelta.toFixed(1)}m necessitates a stepped or split-level design to avoid deep excavation.`,
      impact: 'Design Constraint',
    });
  }

  if (frontage > 0 && frontage < 12) {
    warnings.push({
      type: 'WARNING',
      label: 'Narrow Frontage — Construction Access Risk',
      message: `Frontage of ${frontage.toFixed(1)}m may restrict heavy machinery access during construction. Confirm with builder.`,
      impact: 'Operational Risk',
    });
  }

  // Easement warning
  if (combinedConstraints.easements.length > 0) {
    const totalEasementWidth = combinedConstraints.easements.reduce((s, e) => s + (e.width || 0), 0);
    warnings.push({
      type: 'WARNING',
      label: 'Easement — Buildable Area Reduction',
      message: `${combinedConstraints.easements.length} easement(s) totalling ${totalEasementWidth}m detected. BOE application may be required ($1,500–$5,000). Reduces net buildable area.`,
      impact: 'Legal / Cost',
    });
  }

  // S.173 or covenant warning from planning flags
  if (constraints.hasSingleCovenant) {
    warnings.push({
      type: 'CRITICAL',
      label: 'Single Dwelling Covenant — Development Blocked',
      message: 'Legal covenant restricts this site to one dwelling only. Subdivision and multi-dwelling development prohibited until covenant is removed by court application.',
      impact: 'Development Blocked',
    });
  }

  if (constraints.hasS173) {
    warnings.push({
      type: 'CRITICAL',
      label: 'Section 173 Agreement',
      message: 'A registered S.173 agreement is attached to this title. ' + (constraints.s173Details || 'Review agreement for specific restrictions before proceeding.'),
      impact: 'Legal Constraint',
    });
  }

  // Heritage overlay
  if (constraints.hasHO) {
    warnings.push({
      type: 'WARNING',
      label: 'Heritage Overlay (HO)',
      message: 'Council heritage overlay detected. Demolition permit required and may be refused. External alterations subject to Heritage Advisor review.',
      impact: 'Permit Risk',
    });
  }

  // ---------------------------------------------------------------------------
  // 3. Summary text
  // ---------------------------------------------------------------------------
  const riskSummary = warnings.length > 0
    ? `${warnings.length} risk factor${warnings.length > 1 ? 's' : ''} identified — most critical: ${warnings[0].label}.`
    : 'Site is physically optimal with no major risk factors detected.';

  const setbackNote = setbackAvg !== 3.0
    ? `Setbacks applied: avg ${setbackAvg.toFixed(1)}m (front ${combinedConstraints.setbacks.front}m / side ${combinedConstraints.setbacks.side}m / rear ${combinedConstraints.setbacks.rear}m).`
    : 'Default 3m setback applied (enter planning setbacks in Planning & Zoning panel for greater precision).';

  return {
    yieldWaterfall: waterfall,
    effectiveArea,
    finalPolygon,
    implicitCosts: warnings,
    summary: {
      text: `Site analysis reveals an effective buildable area of ${Math.round(effectiveArea)}m² after deducting setbacks, easements, and TPZ. ${setbackNote} ${riskSummary}`,
    },
  };
};
