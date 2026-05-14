/**
 * @file domain/finance/sensitivity_engine.js
 * @description Advanced sensitivity analysis for property development.
 * Generates a profit matrix based on GRV and Build Cost fluctuations.
 * @version 3.1.0 - Guard NaN/Infinity when adjustedGRV or baseCost is zero.
 */

export const calculateSensitivity = (baseProfit, baseGRV, baseCost) => {
  // Guard degenerate inputs — return empty matrix rather than a table of NaN
  if (!Number.isFinite(baseProfit) || !Number.isFinite(baseGRV) || !Number.isFinite(baseCost)) return [];
  if (baseGRV <= 0 || baseCost <= 0) return [];

  const variations = [-0.1, -0.05, 0, 0.05, 0.1]; // -10% to +10%
  const matrix = [];

  variations.forEach(costVar => {
    const row = [];
    variations.forEach(grvVar => {
      const adjustedGRV  = baseGRV  * (1 + grvVar);
      const adjustedCost = baseCost * (1 + costVar);

      // Profit change = Delta GRV - Delta Cost
      const newProfit = baseProfit + (adjustedGRV - baseGRV) - (adjustedCost - baseCost);

      // Guard: margin is NaN when adjustedGRV = 0; clamp to avoid Infinity
      const margin = adjustedGRV > 0 && Number.isFinite(newProfit)
        ? (newProfit / adjustedGRV) * 100
        : 0;

      row.push({
        grvVar:  grvVar  * 100,
        costVar: costVar * 100,
        profit:  Number.isFinite(newProfit) ? newProfit : 0,
        margin:  Number.isFinite(margin)    ? margin    : 0,
      });
    });
    matrix.push(row);
  });

  return matrix;
};
