/**
 * @file domain/finance/engine.js
 * @description Feasibility Score Engine - synthesizes site, planning, and financial
 * signals into a single 0-100 viability score with band classification.
 * Replaces the legacy stub. Called by financial_engine.js as external.calcFeasScore.
 * @version 2.0.0
 */

const ZONE_POTENTIAL = {
  NRZ: 30, GRZ: 60, RGZ: 80, MUZ: 90,
  B1Z: 70, B2Z: 80, C1Z: 75, C2Z: 80,
  IN1Z: 40, IN3Z: 50, PPRZ: 10, PUZ: 20, SUZ: 55
};

const OVERLAY_PENALTIES = {
  HO: 18, VPO: 8, SBO: 12, BMO: 10, ESO: 10, DDO: 4,
  S173_SINGLE_DWELLING: 30, S173_NO_FURTHER_SUBDIVISION: 28,
  SINGLE_DWELLING_COVENANT: 35, NO_SUBDIVISION_COVENANT: 32,
  EASEMENT: 5, LARGE_TREE: 4
};

const getBand = (score) => {
  if (score >= 80) return { label: 'PRIME',    color: '#00b894', emoji: 'trophy' };
  if (score >= 65) return { label: 'VIABLE',   color: '#27ae60', emoji: 'check' };
  if (score >= 50) return { label: 'MARGINAL', color: '#f39c12', emoji: 'warn' };
  if (score >= 30) return { label: 'RISKY',    color: '#e17055', emoji: 'red' };
  return             { label: 'CRITICAL',  color: '#c0392b', emoji: 'skull' };
};

/**
 * Core feasibility scoring function (0-100).
 * 30 pts margin + 20 pts IRR + 20 pts zone + 15 pts overlays + 15 pts geometry
 *
 * @param {number} margin   - Development margin %
 * @param {number} irr      - Project IRR % annualised
 * @param {string} zone     - VicPlan zone code
 * @param {number} frontage - Site frontage in metres
 * @param {Object} opts     - { overlays[], slope, area }
 * @returns {number} 0-100
 */
export const calculateFeasibilityScore = (
  margin   = 0,
  irr      = 0,
  zone     = 'NRZ',
  frontage = 0,
  opts     = {}
) => {
  const { overlays = [], slope = 0, area = 0 } = opts;

  let marginScore = 0;
  if (margin >= 25)       marginScore = 30;
  else if (margin >= 20)  marginScore = 25;
  else if (margin >= 15)  marginScore = 18;
  else if (margin >= 10)  marginScore = 12;
  else if (margin >= 5)   marginScore = 6;
  else if (margin > 0)    marginScore = 2;

  let irrScore = 0;
  if (irr >= 30)      irrScore = 20;
  else if (irr >= 25) irrScore = 17;
  else if (irr >= 20) irrScore = 14;
  else if (irr >= 18) irrScore = 10;
  else if (irr >= 12) irrScore = 6;
  else if (irr > 0)   irrScore = 2;

  const zonePot   = ZONE_POTENTIAL[(zone || 'NRZ').toUpperCase()] || 30;
  const zoneScore = Math.round((zonePot / 100) * 20);

  let overlayScore = 15;
  (overlays || []).forEach(key => { overlayScore -= (OVERLAY_PENALTIES[key] || 0); });
  overlayScore = Math.max(0, overlayScore);

  let geoScore = 0;
  if (frontage >= 15.2)     geoScore += 6;
  else if (frontage >= 12)  geoScore += 4;
  else if (frontage >= 10)  geoScore += 2;

  if (area >= 800)       geoScore += 5;
  else if (area >= 600)  geoScore += 4;
  else if (area >= 450)  geoScore += 2;
  else if (area >= 300)  geoScore += 1;

  if (slope >= 15)      geoScore -= 3;
  else if (slope >= 10) geoScore -= 2;
  else if (slope >= 5)  geoScore -= 1;

  geoScore = Math.max(0, Math.min(15, geoScore));

  return Math.max(0, Math.min(100, marginScore + irrScore + zoneScore + overlayScore + geoScore));
};

/**
 * Full feasibility assessment with band + breakdown + recommendation.
 * @returns {Object} { score, band, breakdown, recommendation }
 */
export const assessFeasibility = (margin = 0, irr = 0, zone = 'NRZ', frontage = 0, opts = {}) => {
  const score = calculateFeasibilityScore(margin, irr, zone, frontage, opts);
  const band  = getBand(score);

  const breakdown = {
    margin:   { value: margin,  weight: '30pts', note: margin >= 20 ? 'Meets 20% target' : 'Below 20% target' },
    irr:      { value: irr,     weight: '20pts', note: irr >= 18 ? 'Meets 18% hurdle' : 'Below hurdle rate' },
    zone:     { value: zone,    weight: '20pts', note: 'Zone potential: ' + (ZONE_POTENTIAL[(zone || 'NRZ').toUpperCase()] || 30) + '%' },
    overlays: { count: (opts.overlays || []).length, weight: '15pts' },
    geometry: { frontage, area: opts.area || 0, slope: opts.slope || 0, weight: '15pts' }
  };

  const recommendation = score >= 65
    ? 'Site demonstrates credible development potential. Proceed to detailed feasibility.'
    : score >= 50
    ? 'Site is marginal. Stress-test costs and GRV assumptions before committing.'
    : 'High-risk profile. Independent review strongly recommended before acquisition.';

  return { score, band, breakdown, recommendation };
};

export const Engine = {
  run: () => calculateFeasibilityScore(0, 0, 'NRZ', 0)
};
