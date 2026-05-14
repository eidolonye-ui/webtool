/**
 * @file domain/finance/quality_engine.js
 * @description Implementation of the la-rated data confidence and auditability layer.
 */

import { parseNum } from '../../core/utils/formatters.js';

export const calcFreshness = (isoTs) => {
  if (!isoTs) return { label: "No data", score: 0, color: "#9ca3af" };
  const ageDays = (Date.now() - new Date(isoTs).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < 1) return { label: "Fresh (<1 day)", score: 100, color: "#00b894" };
  if (ageDays < 7) return { label: "Recent (<7 days)", score: 70, color: "#f39c12" };
  if (ageDays < 30) return { label: "Stale (<30 days)", score: 40, color: "#e17055" };
  return { label: "Old (>30 days)", score: 10, color: "#dc2626" };
};

export const calcRiskAdjustedMargin = (baseMargin, riskFlags) => {
  if (baseMargin == null) return null;
  let erosion = 0;
  riskFlags.forEach((f) => {
    if (f.label.includes("Heritage Overlay")) erosion += 4.5;
    if (f.label.includes("Vegetation Protection")) erosion += 1.5;
    if (f.label.includes("Environmental Significance")) erosion += 2.0;
    if (f.label.includes("Flood Risk")) erosion += 1.8;
    if (f.label.includes("Bushfire Management")) erosion += 2.5;
    if (f.label.includes("SINGLE DWELLING COVENANT")) erosion += 10.0;
    if (f.label.includes("Steep Site")) erosion += 2.2;
    if (f.label.includes("Overhead Power Lines")) erosion += 1.2;
    if (f.label.includes("Aboriginal Cultural Heritage")) erosion += 1.8;
    if (f.label.includes("NRZ  Density")) erosion += 3.0;
  });
  return { adjusted: Math.max(-100, baseMargin - erosion), erosion };
};

export const calculateQualitySignals = (state) => {
  const { market, fin, plan, str, params, siteInv, lookupResult, domainData, benchmarks, sourceReg } = state;
  
  let grvScore = 0;
  const grvSources = [];
  if (parseNum(market.grvPerUnit) > 0) {
    const srcBonus = sourceReg?.grvPerUnit?.source === "Comparable Sales" ? 15 : sourceReg?.grvPerUnit?.source === "Domain" ? 10 : 0;
    grvScore += 30 + srcBonus;
    grvSources.push(sourceReg?.grvPerUnit?.source && sourceReg.grvPerUnit.source !== "Manual" ? `GRV via ${sourceReg.grvPerUnit.source}` : "Manual GRV entry");
  }
  if (parseNum(market.grvUnits) > 0) { grvScore += 10; grvSources.push("Unit count set"); }
  if (benchmarks && benchmarks.length > 0) { grvScore += Math.min(20, benchmarks.length * 5); grvSources.push(`${benchmarks.length} historical comps`); }
  if (domainData?.status === "ok") { grvScore += 20; grvSources.push("Domain live data"); }

  let costScore = 0;
  const costSources = [];
  if (parseNum(fin.buildCostPSM) > 0) { costScore += 25; costSources.push("Build rate $/m"); }
  if (parseNum(fin.buildArea) > 0 || parseNum(fin.areaLiving) > 0) { costScore += 25; costSources.push("GFA entered"); }
  if (params.buildType) { costScore += 20; costSources.push("Build type set"); }

  let irrScore = 0;
  const irrSources = [];
  if (str.projectMonths > 0) { irrScore += 20; irrSources.push("Project months set"); }
  if (str.interestRate > 0) { irrScore += 20; irrSources.push("Interest rate set"); }
  if (str.lvrPct > 0) { irrScore += 20; irrSources.push("LVR set"); }

  let planScore = 0;
  const planSources = [];
  if (plan.zoneCode || plan.zone) { planScore += 30; planSources.push("Zone set"); }
  if (lookupResult?.lat) { planScore += 20; planSources.push("Address geocoded"); }
  if (plan.overlayReviewed) { planScore += 20; planSources.push("Overlays confirmed"); }

  const overall = Math.round((grvScore + costScore + irrScore + planScore) / 4);
  
  return {
    overall,
    rows: [
      { metric: "GRV / Exit Value", score: grvScore, sources: grvSources },
      { metric: "Construction & TDC", score: costScore, sources: costSources },
      { metric: "IRR & Returns", score: irrScore, sources: irrSources },
      { metric: "Planning & Timeline", score: planScore, sources: planSources },
    ]
  };
};
