/**
 * Cost Engine
 * Faithfully migrated from legacy monolith.
 */

/**
 * Calculate Planning Permit Fee 2024-25 fee schedule
 */
export function calcPlanningPermitFee(projectCost) {
  if (!projectCost || projectCost <= 0) return 0;
  if (projectCost <= 10000) return 199;
  if (projectCost <= 100000) return Math.round(199 + (projectCost - 10000) * 0.0017);
  if (projectCost <= 1000000) return Math.round(369 + (projectCost - 100000) * 0.0024);
  if (projectCost <= 5000000) return Math.round(2525 + (projectCost - 1000000) * 0.00145);
  if (projectCost <= 15000000) return Math.round(8325 + (projectCost - 5000000) * 0.0012);
  if (projectCost <= 50000000) return Math.round(20325 + (projectCost - 15000000) * 0.0006);
  return 41325;
}

/**
 * Calculate Growth Corridor Infrastructure Contributions Plan (ICP)
 */
export function calcGrowthLevy(councilName, areaM2, GROWTH_LEVY_DB) {
  const norm = (s) => (s || "").toLowerCase();
  const key = Object.keys(GROWTH_LEVY_DB).find((k) => norm(councilName).includes(norm(k)));
  if (!key || !areaM2) return { levy: 0, found: false, note: "" };
  const areaHa = areaM2 / 10000;
  const levy = Math.round(GROWTH_LEVY_DB[key].ratePerHa * areaHa);
  return { 
    levy, 
    found: true, 
    note: GROWTH_LEVY_DB[key].note, 
    rate: GROWTH_LEVY_DB[key].ratePerHa, 
    areaHa: areaHa.toFixed(3) 
  };
}

export const GROWTH_LEVY_DB = {
  "Casey": { ratePerHa: 130000, note: "Casey ICP residential infrastructure levy" },
  "Wyndham": { ratePerHa: 145000, note: "Wyndham ICP residential levy  one of highest in metro" },
  "Hume": { ratePerHa: 135000, note: "Hume ICP residential levy" },
  "Melton": { ratePerHa: 125000, note: "Melton ICP residential levy" },
  "Whittlesea": { ratePerHa: 135000, note: "Whittlesea ICP residential levy" },
  "Cardinia": { ratePerHa: 130000, note: "Cardinia ICP residential levy" },
  "Yarra Ranges": { ratePerHa: 80000, note: "Yarra Ranges development contributions  lower rate (semi-rural)" },
};
