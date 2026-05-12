/**
 * @file domain/finance/tax_engine.js
 * @description Pure functions for Victorian stamp duty, land tax, and GST calculations.
 * @version 1.1.0 - Fixed bracket 3 rate (5% -> 6%); added calcVicSROLandTax export
 */

/**
 * Victorian Stamp Duty (Transfer Duty) - SRO 2024-25 rates.
 * Applies to investment / development purchases (non-PPR).
 *
 * Brackets (dutiable value):
 *   $0        - $25,000    : 1.4%
 *   $25,001   - $130,000   : $350 + 2.4% of excess over $25,000
 *   $130,001  - $960,000   : $2,870 + 6% of excess over $130,000  [was incorrectly 5%]
 *   $960,001  - $2,000,000 : 5.5% of total
 *   >$2,000,000            : 6.5% of total
 *
 * Foreign purchaser surcharge: +8% of dutiable value (FSAD).
 * OTP concession: dutiable value = purchase price minus construction cost already done.
 *
 * @param {number}  price       - Purchase price
 * @param {boolean} isForeign   - Foreign purchaser surcharge applies
 * @param {boolean} isOTP       - Off-the-plan concession applies
 * @param {number}  buildCost   - Construction cost already done (OTP only)
 * @returns {number} Stamp duty in AUD (rounded)
 */
export function calcVicStampDuty(price, isForeign = false, isOTP = false, buildCost = 0) {
  if (!price || price <= 0) return 0;

  const dutiable = isOTP && buildCost > 0 ? Math.max(0, price - buildCost) : price;
  let d = 0;

  if      (dutiable <= 25000)   d = dutiable * 0.014;
  else if (dutiable <= 130000)  d = 350  + (dutiable - 25000)  * 0.024;
  else if (dutiable <= 960000)  d = 2870 + (dutiable - 130000) * 0.06;   // fixed: was 5%
  else if (dutiable <= 2000000) d = dutiable * 0.055;
  else                          d = dutiable * 0.065;

  if (isForeign) d += dutiable * 0.08;

  return Math.round(d);
}

/**
 * Victorian Land Tax (SRO 2024-25 general rates, not PPR).
 * Charged annually on unimproved land value above threshold.
 * Used for holding cost estimation during development.
 *
 * @param {number} landValue    - Unimproved land value (proxy: land price)
 * @param {number} holdingYears - Holding period in years
 * @returns {number} Total land tax over holding period (AUD)
 */
export function calcVicSROLandTax(landValue, holdingYears = 1) {
  if (!landValue || landValue <= 0) return 0;
  const years = Math.max(0.5, holdingYears);

  // 2024-25 thresholds (general - not trust surcharge)
  let annualTax = 0;
  if      (landValue <= 50000)    annualTax = 0;
  else if (landValue <= 100000)   annualTax = 100;
  else if (landValue <= 300000)   annualTax = 375  + (landValue - 100000) * 0.002;
  else if (landValue <= 600000)   annualTax = 775  + (landValue - 300000) * 0.0057;
  else if (landValue <= 1000000)  annualTax = 2485 + (landValue - 600000) * 0.009;
  else if (landValue <= 1800000)  annualTax = 6085 + (landValue - 1000000) * 0.013;
  else if (landValue <= 3000000)  annualTax = 16485+ (landValue - 1800000) * 0.016;
  else                            annualTax = 35685+ (landValue - 3000000) * 0.022;

  return Math.round(annualTax * years);
}

/**
 * GST calculation (margin scheme vs. standard).
 * Developers typically use margin scheme which reduces GST liability.
 *
 * @param {number} grv       - Gross Realisation Value (sales price)
 * @param {number} landCost  - Original land acquisition cost (margin scheme)
 * @returns {{ standard: number, marginScheme: number }}
 */
export function calcGST(grv, landCost) {
  const margin = Math.max(0, grv - landCost);
  return {
    standard:     Math.round(grv / 11),
    marginScheme: Math.round(margin / 11)
  };
}
