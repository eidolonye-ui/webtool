/**
 * @file domain/finance/cost_engine.js
 * @description Dynamic construction cost matrix based on Melbourne 2026 benchmarks.
 * @version 1.0.0
 */

export const calculateSiteWorksCosts = (siteAreaM2, slopeClass, maxSlopeVal, soilClass, rockGrade) => {
  // 1. Slope Base Rate (Melbourne 2026)
  const slopeBaseRates = {
    flat: 20,
    slight: 60,
    moderate: 150,
    steep: 350
  };
  
  const baseRate = slopeBaseRates[slopeClass] || 20;
  
  // 2. Non-linear slope exponent for steep sites (>10%)
  let slopeExponent = 1.0;
  if (slopeClass === 'steep' && maxSlopeVal > 10) {
    slopeExponent = Math.pow(1.15, Math.min(maxSlopeVal - 10, 15));
  }
  
  const slopeRate = Math.round(baseRate * slopeExponent);
  
  // 3. Complexity and Soil Factors
  const slopeComplexity = {
    flat: 1.0,
    slight: 1.0,
    moderate: 1.2,
    steep: 1.5
  }[slopeClass] || 1.0;
  
  const soilFactor = {
    M: 1.0,
    H: 1.3,
    P: 1.5
  }[soilClass] || 1.0;
  
  // 4. Final Earthworks Cost
  const slopePS = Math.round(siteAreaM2 * slopeRate * slopeComplexity * soilFactor);
  
  // 5. Rock Excavation Provisional Sums (Melbourne Basalt/Sandstone)
  const rockPS = {
    R1: 25000, // Occasional fragments
    R2: 65000, // Significant seam
    R3: 120000 // Massive rock / blasting
  }[rockGrade] || 0;
  
  // 6. Soil Class Provisional Sums
  const soilPS = {
    M: 15000,
    H: 40000,
    P: 80000
  }[soilClass] || 0;

  return {
    slopePS,
    rockPS,
    soilPS,
    totalProvisional: slopePS + rockPS + soilPS
  };
};

export const calculateBuildingPermitLevy = (buildCostTotal) => {
  // VIC DTP 2024-25: 0.141% of construction cost
  return buildCostTotal > 0 ? Math.round(buildCostTotal * 0.00141) : 0;
};
