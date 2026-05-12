/**
 * RiskEngine (Domain Layer)
 * 
 * Encapsulates the complex business logic for identifying property-specific
 * risks (Planning, Environmental, Geotechnical, and Financial).
 * 
 * Designed to be stateless: Inputs the current system state, returns an array of Risk objects.
 */

export const RiskEngine = {
  /**
   * Evaluates all active risk factors based on the current project state.
   * @param {Object} state - The current system state (site, plan, siteInv, conds, etc.)
   * @param {Object} params - User parameters (preSalesPct, etc.)
   * @param {Object} calc - Current financial calculations (for absorption/lvr risks)
   * @param {Object} bboxDims - Bounding box dimensions (for frontage/shade/light risks)
   * @returns {Array} Array of Risk objects: { label: string, tip: string, severity: 'info'|'warn'|'danger' }
   */
  getRiskFlags: (state, params, calc, bboxDims) => {
    const { site, plan, siteInv, conds, market, str, fin, liveInd, domainData, benchmarks } = state;
    const f = [];

    // --- 1. PLANNING & COMPLIANCE RISKS ---
    {
      const sa = parseFloat(site.area) || 0;
      const ba = parseFloat(plan.buildableArea) || 0;
      const covLimit = parseFloat(plan.maxCoverage) || (ZSB_RESCODE[plan.zone]?.cov * 100) || 60;
      const actualCov = sa > 0 ? ((ba / sa) * 100) : 0;
      const covFail = actualCov > covLimit;

      const estUnits = parseFloat(plan.estUnits) || parseFloat(market.grvUnits) || 0;
      const beds = parseFloat(plan.bedsPerUnit) || 3;
      const reqPark = estUnits * (beds >= 3 ? 2 : 1);
      const provPark = parseFloat(plan.providedCarSpaces) || 0;
      const parkFail = provPark < reqPark;

      const gdnLimit = (ZSB_RESCODE[plan.zone]?.gdn || 0.35) * sa;
      const gdnAvail = sa - ba;
      const gdnFail = gdnAvail < gdnLimit;

      if (covFail || parkFail || gdnFail) {
        f.push({
          label: "⚠️ Planning Compliance Risk: Footprint/Parking/Garden limits exceeded",
          tip: `Compliance Check: Coverage ${actualCov.toFixed(1)}% (Limit ${covLimit}%), Parking ${provPark}/${reqPark}, Garden Area ${gdnAvail.toFixed(0)}m2 (Req ${gdnLimit.toFixed(0)}m2). High risk of permit refusal or mandated yield reduction.`
        });
      }
    }

    // --- 2. ENVIRONMENTAL & OVERLAY RISKS ---
    if (plan.hasVPO) f.push({ label: "Vegetation Protection Overlay (VPO)", tip: "Tree report required, removal needs permit - impacts buildable area" });
    if (plan.hasSLO) f.push({ label: "Significant Landscape Overlay (SLO)", tip: "Design must protect landscape views, building bulk strictly limited" });
    if (plan.hasESO) f.push({ label: "Environmental Significance Overlay (ESO)", tip: "Environmental assessment required, may restrict construction scope" });
    if (plan.hasSBO) f.push({ label: "Flood Risk Overlay (SBO/LSIO)", tip: "Hydrology report required, floor levels may need to be raised, insurance costs increase" });
    if (plan.hasBMO) f.push({ label: "Bushfire Management Overlay (BMO)", tip: "BAL rating required, building materials restricted, construction cost +10-15%" });
    if (plan.hasGeo) f.push({ label: "Geotechnical Risk", tip: "Geotechnical investigation required, footing costs may increase substantially" });
    if (plan.hasHO) f.push({ label: "Heritage Overlay", tip: "Demolition may be refused, alterations subject to strict controls" });
    if (plan.hasAboriginal) f.push({ label: "Aboriginal Cultural Heritage", tip: "CHMP assessment required, may delay project 6-12 months" });
    if (plan.covenants) f.push({ label: "Restrictive Covenant", tip: "Covenant directly restricts development - careful legal review required" });
    if (plan.zone === "NRZ") f.push({ label: "NRZ - Density Restriction", tip: "Typically max 2 dwellings - high-density development not viable" });
    if (plan.hasSingleCovenant) f.push({ label: "🚫 SINGLE DWELLING COVENANT - Development Blocked", tip: "Legal covenant restricts property to one dwelling only. Any subdivision or multi-dwelling development is prohibited." });
    if (plan.hasEasementBoe) f.push({ label: "Easement Detected - Build Over Easement (BOE) Risk", tip: "Easement may pass through developable area. BOE application ($1,500-$5,000) and Report & Consent required. May reduce net buildable area." });

    // --- 3. SITE INVESTIGATION & CONNECTIVITY RISKS ---
    if (siteInv.status === "done" && siteInv.osm && !siteInv.osm.error && siteInv.osm.powerLines?.length > 0) {
      f.push({ label: `Overhead Power Lines Detected (${siteInv.osm.powerLines.length} segments)`, tip: "Undergrounding cost $15,000-$60,000. Confirm with distributor (CitiPower / Powercor / United Energy)." });
    }
    if (siteInv.status === "done" && siteInv.elev && !siteInv.elev.error && siteInv.elev.maxSlope >= 10) {
      f.push({ label: `Steep Site - Slope ${siteInv.elev.maxSlope?.toFixed(1)}%`, tip: "Site works cost uplift $80,000-$120,000+ for slopes >10%. Retaining walls, cut-and-fill, and drainage design required." });
    }

    // [UPGRADE] Connectivity Intelligence: Score transport access
    if (siteInv.loc && siteInv.loc.trains?.length > 0) {
      const nearestTrain = siteInv.loc.trains[0].d;
      if (nearestTrain > 1000) {
        f.push({ label: "Low Transport Connectivity", tip: `Nearest train station is ${nearestTrain}m away. This may impact exit value (GRV) and end-user appeal for multi-dwelling projects.` });
      } else if (nearestTrain > 500) {
        f.push({ label: "Moderate Transit Access", tip: `Station is within walking distance (${nearestTrain}m), but may require consideration of pedestrian access/safety in design.` });
      }
    }
    if (siteInv.loc && siteInv.loc.schools?.length > 0 && siteInv.loc.schools.length < 2) {
      f.push({ label: "Limited Schooling Options", tip: "Few schools detected within immediate vicinity. May affect family-oriented buyer demand and GRV." });
    }

    // --- 4. FINANCIAL & SENSITIVITY RISKS ---
    if (calc && calc.extMonths > 3) {
      f.push({ 
        label: `Slow Absorption - ${calc.extMonths} months beyond loan term`,
        tip: `At ${calc.rate} units/month, sales extend beyond planning timeline. Estimated bridging cost: $${calc.penalty.toLocaleString()}.` 
      });
    }

    // [UPGRADE] Financial Sensitivity Intelligence
    if (calc && calc.profit > 0) {
      // Stress Test: Interest Rate Sensitivity
      const interestSensitivity = calc.interestRate * 1.5; // Simple proxy for 1% rise
      const sensitivityImpact = (calc.profit * 0.1); // Heuristic: 1% rise eats ~10% of profit in high-leverage projects
      if (calc.profit < sensitivityImpact) {
        f.push({ label: "⚠️ HIGH INTEREST RATE SENSITIVITY", tip: "Project margin is thin relative to interest rate volatility. A 1% rate rise could significantly erode or eliminate profit." });
      }

      // Stress Test: GRV Sensitivity
      if (calc.grv > 0 && calc.margin < 15) {
        f.push({ label: "⚠️ GRV Price Sensitivity", tip: "Low margin (<15%) makes project highly vulnerable to market softening. A 5% drop in exit value could result in a break-even scenario." });
      }
    }

    // --- 5. OTHER RISKS ---
    if (conds.bushfireProne) f.push({ label: "🔥 Bushfire Prone Area - BAL Compliance Required", tip: "NCC 2022 Section 3 requires BAL-rated construction. Typical cost range $10K-$25K depending on BAL rating." });
    if (plan.hasNativeVeg === "Within") f.push({ label: "Native Vegetation Within Protected Area", tip: "Removal or destruction requires a permit under the Planning and Environment Act. Adds 3-6 months to timeline." });
    if (plan.hasMortgage) f.push({ label: "Mortgage/Charge Detected on Title (Section 32)", tip: "Confirm discharge prior to settlement. Factor in potential delays if mortgagee consent to subdivision is required." });
    if (conds.rockGrade) {
      const ROCK_LABEL = { R1: "Minor rock fragments", R2: "Significant rock seam / basalt", R3: "Massive rock - blasting likely" };
      const ROCK_PS = { R1: 25000, R2: 65000, R3: 120000 };
      f.push({ label: `Rock Excavation Risk (${ROCK_LABEL[conds.rockGrade] || conds.rockGrade})`, tip: `Rock grade ${conds.rockGrade} increases footing excavation cost. Provisional: $${(ROCK_PS[conds.rockGrade] || 0).toLocaleString()}.` });
    }

    return f;
  }
};
