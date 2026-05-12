/**
 * @file domain/finance/cashflow_engine.js
 * @description Engine for calculating non-linear construction cash flows using S-Curve distribution.
 * @version 1.0.0
 */

/**
 * Generates a normalized S-Curve distribution of weights over a given duration.
 * 
 * @param {number} durationMonths - The total duration of construction in months.
 * @param {number} steepness - Controls how "sharp" the S-curve is (default 0.7). 
 *                             Higher = steeper middle peak.
 * @returns {number[]} Array of weights for each month, summing to 1.0.
 */
export const calculateSCurveDistribution = (durationMonths, steepness = 0.7) => {
  if (durationMonths <= 0) return [];
  if (durationMonths === 1) return [1.0];

  const weights = [];
  let totalWeight = 0;

  // We use a sigmoid-like function: 1 / (1 + exp(-k * (t - mid)))
  const mid = (durationMonths - 1) / 2;
  const k = steepness;

  for (let t = 0; t < durationMonths; t++) {
    // The value of the sigmoid at time t
    const val = 1 / (1 + Math.exp(-k * (t - mid)));
    weights.push(val);
    totalWeight += val;
  }

  // Normalize so the sum of all weights equals exactly 1.0
  return weights.map(w => parseFloat((w / totalWeight).toFixed(4)));
};

/**
 * Distributes a total cost across a timeline using an S-Curve.
 * 
 * @param {number} totalCost - The total amount to be distributed.
 * @param {number} durationMonths - The project duration.
 * @returns {Array<{month: number, amount: number}>} Monthly cost breakdown.
 */
export const distributeCostsOverTime = (totalCost, durationMonths) => {
  if (!totalCost || totalCost <= 0 || durationMonths <= 0) {
    return [];
  }

  const distribution = calculateSCurveDistribution(durationMonths);
  
  return distribution.map((weight, index) => ({
    month: index + 1,
    weight: weight,
    amount: Math.round(totalCost * weight)
  }));
};

/**
 * Calculates capitalized interest for a loan based on S-Curve cost distribution.
 * 
 * @param {number} totalConstructionCost - Principal to be drawn down.
 * @param {number} annualInterestRate - Annual rate (e.g., 0.07 for 7%).
 * @param {number} durationMonths - Project duration.
 * @returns {number} Total capitalized interest.
 */
export const calculateCapitalizedInterest = (totalConstructionCost, annualInterestRate, durationMonths) => {
  if (!totalConstructionCost || durationMonths <= 0) return 0;

  const monthlyRate = annualInterestRate / 12;
  const monthlyDraws = distributeCostsOverTime(totalConstructionCost, durationMonths);
  
  let cumulativeBalance = 0;
  let totalInterest = 0;

  monthlyDraws.forEach(draw => {
    // Interest is calculated on the balance at the start of the month
    const interestForMonth = cumulativeBalance * monthlyRate;
    totalInterest += interestForMonth;
    
    // Drawdown occurs during/at end of month
    cumulativeBalance += draw.amount;
  });

  return Math.round(totalInterest);
};
