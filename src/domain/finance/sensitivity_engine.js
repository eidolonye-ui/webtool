/**
 * @file domain/finance/sensitivity_engine.js
 * @description Advanced sensitivity analysis for property development.
 * Generates a profit matrix based on GRV and Build Cost fluctuations.
 * @version 3.0.0
 */

export const calculateSensitivity = (baseProfit, baseGRV, baseCost) => {
  const variations = [-0.1, -0.05, 0, 0.05, 0.1]; // -10% to +10%
  const matrix = [];

  variations.forEach(costVar => {
    const row = [];
    variations.forEach(grvVar => {
      const adjustedGRV = baseGRV * (1 + grvVar);
      const adjustedCost = baseCost * (1 + costVar);
      
      // Profit change = Delta GRV - Delta Cost
      const deltaGRV = (adjustedGRV - baseGRV);
      const deltaCost = (adjustedCost - baseCost);
      const newProfit = baseProfit + deltaGRV - deltaCost;
      
      row.push({
        grvVar: grvVar * 100,
        costVar: costVar * 100,
        profit: newProfit,
        margin: (newProfit / adjustedGRV) * 100
      });
    });
    matrix.push(row);
  });

  return matrix;
};
