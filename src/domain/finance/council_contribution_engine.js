/**
 * CouncilContributionEngine (Domain Layer)
 * 
 * Automates the estimation of municipal-level development costs.
 * 
 * Includes:
 * - ICP (Infrastructure Contributions Plan) Levies
 * - Council Planning Permit Fees (based on Victorian fee schedule)
 * - S173/Developer Contribution approximations
 */

export const CouncilContributionEngine = {
  /**
   * Estimates the total municipal-level contribution costs.
   * @param {Object} state - The current system state (site, plan, market, etc.)
   * @returns {Object} { total, icp, permitFee, s173, breakdown }
   */
  estimateContributions: (state) => {
    const { site, plan, market, str } = state;
    const areaM2 = parseFloat(site.area) || 0;
    const suburb = str.suburb || "";

    // 1. ICP (Infrastructure Contributions Plan) Estimation
    // Note: Actual rates vary by LGA and vary between 'Residential' vs 'Mixed Use'.
    // This is an industry-standard approximation for Melbourne Metro.
    let icpRatePerHa = 135000; // Base rate for common growth corridors
    
    // Heuristic adjustments for specific high-growth LGAs
    if (suburb.includes("Casey")) icpRatePerHa = 145000;
    if (suburb.includes("Wyndham")) icpRatePerHa = 155000;
    if (suburb.includes("Melton")) icpRatePerHa = 125000;
    if (suburb.includes("Whittlesea")) icpRatePerHa = 140000;

    const icpTotal = (areaM2 / 10000) * icpRatePerHa;

    // 2. Council Planning Permit Fees (Victorian Fee Schedule 2024-25)
    // Fee is generally calculated based on the complexity and estimated project cost.
    const projectCost = parseFloat(plan.estimatedProjectCost) || 500000;
    let permitFee = 0;

    if (projectCost <= 100000) permitFee = 200;
    else if (projectCost <= 1000000) permitFee = 370 + (projectCost - 100000) * 0.0024;
    else if (projectCost <= 5000000) permitFee = 2525 + (projectCost - 1000000) * 0.0015;
    else permitFee = 10000; // Cap for large-scale developments

    // 3. S173 / Developer Contributions (Estimates for large subdivisions)
    // Often a percentage of land value or a fixed per-lot fee for higher density.
    const s173Estimate = (plan.estUnits > 2) ? (areaM2 * 5) : 0; // Approx $5/m2 for infrastructure/amenity

    const total = icpTotal + permitFee + s173Estimate;

    return {
      total: Math.round(total),
      icp: Math.round(icpTotal),
      permitFee: Math.round(permitFee),
      s173: Math.round(s173Estimate),
      breakdown: [
        { label: "ICP Levy", amount: Math.round(icpTotal) },
        { label: "Planning Permit Fee", amount: Math.round(permitFee) },
        { label: "S173 / Developer Contribution", amount: Math.round(s173Estimate) }
      ]
    };
  }
};
