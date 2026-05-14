/**
 * @file domain/financial_engine.js
 * @description 房产开发项目金融内核 (Hardened & Parameterized)
 * @version 1.1.0 - S-CURVE INTEGRATION
 * @compliance SaaS-Grade Professional Standards
 */

import { calculateCapitalizedInterest, distributeCostsOverTime } from './cashflow_engine.js';
import { safeRound, safeNum, guardObj } from '../../core/utils/num_guard.js';

/**
 * [DOMAIN_CONSTANTS] - Consolidated Financial & Risk Parameters
 * Single source of truth for all risk-sensitive and fiscal thresholds.
 */
export const FINANCIAL_CONFIG = {
  SLOPE: {
    BASE_RATES: { flat: 20, slight: 60, moderate: 150, steep: 350 },
    EXPONENT_BASE: 1.15,
    EXPONENT_THRESHOLD: 10,
    EXPONENT_MAX_DELTA: 15,
    COST_MULTIPLIERS: { flat: 1.0, slight: 1.0, moderate: 1.2, steep: 1.5 }
  },
  LVR: {
    SENIOR_GRV_CAP: 0.65,
    LVR_SAFETY_BUFFER: 0.05
  },
  RISK_WEIGHTS: {
    SOIL: { M: 1.0, H: 1.3, P: 1.5 },
    ROCK: { R1: 25000, R2: 65000, R3: 120000 },
    BAL: { "BAL-12": 0, "BAL-19": 12000, "BAL-29": 22000, "BAL-40": 38000, "FZ": 65000 },
    BAL_DEFAULT: 18000
  }
};

/**
 * Main Financial Calculation Engine
 * 
 * @param {Object} args - Dependency injection container to maintain pure functionality.
 * @param {Object} args.fin - Financial state (costs, taxes, etc.)
 * @param {Object} args.market - Market state (GRV, units, etc.)
 * @param {Object} args.plan - Planning state (zones, units, etc.)
 * @param {Object} args.conds - Site conditions (slope, soil, rock, bushfire, etc.)
 * @param {Object} args.siteInv - Site investigation data (elevation, OSM, etc.)
 * @param {Object} args.site - Physical site attributes (area, frontage, etc.)
 * @param {Object} args.str - String/Time state (months, interest, etc.)
 * @param {Object} args.params - User-defined parameters (margins, risk pct, etc.)
 * @param {Object} args.utils - Helper functions (parseNum, etc.)
 * @param {Object} args.external - External logic (calcBuildCost, calcFeasScore, etc.)
 * 
 * @returns {Object} Complete financial breakdown for the project.
 */
export function calculateProjectFinances({
  fin, market, plan, conds, siteInv, site, str, params,
  utils, external
}) {
  const { parseNum, calcVicSROLandTax, buildIRRCashFlows, calcTrueIRR, estimateIRR, calcGST, calcRLVIterative } = utils;
  const { calcBuildCost, calcFeasScore } = external;

  /* 1. Land Acquisition Layer */
  const land = parseNum(fin.landPrice) + parseNum(fin.stampDuty) + parseNum(fin.legalFees);

  /* 2. Soft Cost Layer */
  const baseSoft = parseNum(fin.architectFees) + parseNum(fin.townPlannerFees) + parseNum(fin.buildingSurveyorFees)
    + parseNum(fin.structuralGeoFees) + parseNum(fin.energyEsdFees) + parseNum(fin.surveyFees)
    + parseNum(fin.councilFees) + parseNum(fin.consultantFees)
    + parseNum(fin.openSpaceContrib) + parseNum(fin.infraContrib)
    + parseNum(fin.devFee) + parseNum(fin.phase1ESA) + parseNum(fin.planOfSubdiv);

  /* 3. Hard Cost Layer: Base Construction */
  const buildCostBase = calcBuildCost.total || Math.round(parseNum(fin.buildCostPSM) * parseNum(fin.buildArea));
  const builderMarginAmt = Math.round(buildCostBase * (parseNum(params.builderMarginPct) || 0) / 100);
  const marketRiskAmt = Math.round(buildCostBase * (parseNum(params.marketRiskPct) || 0) / 100);
  const nccUpliftPerDwelling = (() => {
    if (fin.ncc2022 === "off") return 0;
    const U = { "dual-occ": 8000, "std-th": 10000, "med-th": 11000, "prem-th": 12000, "low-apt": 13000, "mid-apt": 15000 };
    return U[params.buildType] || 0;
  })();
  const nccUpliftTotal = nccUpliftPerDwelling * (parseNum(market.grvUnits) || parseNum(plan.estUnits) || 1);

  /* 4. Hard Cost Layer: Site Works & Provisional Sums */
  const slopeRaw = conds.slopeClass === "auto" && siteInv?.elev && !siteInv.elev.error
    ? (siteInv.elev.maxSlope >= 10 ? "steep" : siteInv.elev.maxSlope >= 5 ? "moderate" : siteInv.elev.maxSlope >= 2 ? "slight" : "flat")
    : (conds.slopeClass || "flat");

  const maxSlopeVal = siteInv?.elev && !siteInv.elev.error ? siteInv.elev.maxSlope : (slopeRaw === "steep" ? 14 : slopeRaw === "moderate" ? 5 : slopeRaw === "slight" ? 3 : 0);
  const _slopeBaseRate = FINANCIAL_CONFIG.SLOPE.BASE_RATES[slopeRaw] || 20;
  const _slopeExp = (slopeRaw === 'steep' && maxSlopeVal > FINANCIAL_CONFIG.SLOPE.EXPONENT_THRESHOLD) 
    ? Math.pow(FINANCIAL_CONFIG.SLOPE.EXPONENT_BASE, Math.min(maxSlopeVal - FINANCIAL_CONFIG.SLOPE.EXPONENT_THRESHOLD, FINANCIAL_CONFIG.SLOPE.EXPONENT_MAX_DELTA)) 
    : 1.0;

  const slopePS = Math.round(
    (parseNum(site.area) || 0) * 
    Math.round(_slopeBaseRate * _slopeExp) * 
    (FINANCIAL_CONFIG.SLOPE.COST_MULTIPLIERS[slopeRaw] || 1.0) * 
    (FINANCIAL_CONFIG.RISK_WEIGHTS.SOIL[conds.soilClass] || 1.0)
  );

  const rockPS = FINANCIAL_CONFIG.RISK_WEIGHTS.ROCK[conds.rockGrade] || 0;
  const soilPS = FINANCIAL_CONFIG.RISK_WEIGHTS.SOIL[conds.soilClass] || 0;
  const balPS = conds.bushfireProne ? (FINANCIAL_CONFIG.RISK_WEIGHTS.BAL[conds.balRating] || FINANCIAL_CONFIG.RISK_WEIGHTS.BAL_DEFAULT) : 0;
  const powerLinePS = siteInv?.osm && siteInv.osm.powerLines?.length > 0 ? 35000 : 0;
  const drainageSinkPS = (siteInv?.elev && siteInv.elev.elevs?.length >= 5 && siteInv.elev.elevs[0] < ((siteInv.elev.elevs[1] + siteInv.elev.elevs[2] + siteInv.elev.elevs[3] + siteInv.elev.elevs[4]) / 4) - 0.3) ? 25000 : 0;
  const parkingPS = (parseNum(conds.parkingSpaces) || 0) > 0 ? ({"on-grade": 10000, "semi-basement": 45000, "full-basement": 72000}[conds.parkingType] || 8000) * parseNum(conds.parkingSpaces) : 0;

  /* Site Preparation */
  const sitePrepManual = parseNum(fin.sitePrep) || 0;
  const sitePrepSugg = Math.round((parseNum(site.area) || 0) * 15);
  const sitePrep = sitePrepManual > 0 ? sitePrepManual : sitePrepSugg;

  const baseHard = parseNum(fin.demolition) + buildCostBase + builderMarginAmt + marketRiskAmt
    + parseNum(fin.siteWorks) + parseNum(fin.serviceConn) + parseNum(fin.externals) + parseNum(fin.dbi)
    + soilPS + slopePS + rockPS + balPS + powerLinePS + drainageSinkPS + nccUpliftTotal + parkingPS
    + sitePrep;

  /* Dynamic Contingency */
  const baseContPct = (parseNum(fin.contingencyPct) || 5) / 100;
  const riskScorePenalty = (100 - (calcFeasScore(0, 0, plan.zoneCode || plan.zone, 0) || 0)) * 0.001;
  const effectiveContPct = baseContPct + riskScorePenalty;
  const contingencyAmt = parseNum(fin.contingency) > 0 ? parseNum(fin.contingency) : Math.round(baseHard * effectiveContPct);

  const hard = baseHard + contingencyAmt;

  /* Temporal Escalation */
  const escRate = (parseNum(fin.escalationPct) || 0) / 100;
  const projYears = (parseNum(str.projectMonths) || 30) / 12;
  const escalationAmt = Math.round(hard * escRate * projYears);
  const hardFinal = hard + escalationAmt;

  /* Holding & Sale */
  const holdingYears = projYears;
  const autoLandTax = calcVicSROLandTax(parseNum(fin.landPrice) || 0, holdingYears);
  
  // SOVEREIGN UPGRADE: Calculate interest based on S-Curve construction drawdown
  const constructionCostForInterest = hardFinal - escalationAmt; 
  const annualInterestRate = (parseNum(fin.interestRate) || 6.5) / 100;
  const projectMonths = parseNum(str.projectMonths) || 24;
  
  const capInterest = calculateCapitalizedInterest(constructionCostForInterest, annualInterestRate, projectMonths);
  const loanInterest = parseNum(fin.loanInterest) > 0 ? parseNum(fin.loanInterest) : capInterest;

  const hold = autoLandTax + parseNum(fin.councilRatesHold) + parseNum(fin.cwInsurance) + parseNum(fin.holdingCosts) + loanInterest || 0;
  const sale = parseNum(fin.agentComm) + parseNum(fin.marketing) + parseNum(fin.saleLegal) + parseNum(fin.titleInsurance || 0);

  const total = land + baseSoft + hardFinal + hold + sale;
  const grv = parseNum(market.grvPerUnit) * (parseNum(market.grvUnits) || parseNum(plan.estUnits) || 1);
  const profit = grv - total;
  const margin = total > 0 ? (profit / total) * 100 : 0;

  // Guard entire output: any NaN/Infinity in the chain (e.g. zero land × undefined rate)
  // must not reach the UI or store as a corrupted number.
  const raw = {
    land, soft: baseSoft, hard: hardFinal, hold, sale, total, grv, profit,
    contingencyAmt, escalationAmt, sitePrep,
    slopePS, rockPS, soilPS, balPS, powerLinePS, drainageSinkPS, parkingPS,
    totalHard: hardFinal, capInterest,
  };
  const safe = guardObj(raw);  // replaces any NaN/Infinity with 0

  // margin is a percentage — compute from safe values so it can't be NaN
  const safeMargin = safe.total > 0 ? safeNum((safe.profit / safe.total) * 100) : 0;

  return {
    ...safe,
    margin: safeMargin,
    effectiveContPct: safeNum(effectiveContPct),
    launderS: safe.land,
    drawdownSchedule: distributeCostsOverTime(hardFinal - escalationAmt, projectMonths),
  };
}
