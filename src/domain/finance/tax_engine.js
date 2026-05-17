/**
 * @file domain/finance/tax_engine.js
 * @description Pure functions for Victorian stamp duty, land tax, and GST calculations.
 * @version 2.0.0 - BREAKING: removed OTP concession (invalid for developer purchases since 2017);
 *                  updated land tax to SRO 2024-25 including COVID Debt Levy (valid to 2033).
 */

/**
 * Victorian Stamp Duty (Transfer Duty) — SRO 2024-25 rates.
 * Always based on FULL PURCHASE PRICE for developer/investment purchases.
 *
 * IMPORTANT — OTP CONCESSION REMOVED (2017-07-01):
 *   The Off-The-Plan concession was abolished for investment and development
 *   purchases from 1 July 2017 (State Revenue Office Vic, Ruling DA-063).
 *   It now only applies to owner-occupiers (PPR) purchasing a dwelling, subject to
 *   a $750,000 cap. A developer acquiring land or an OTP lot for resale NEVER qualifies.
 *   Any tool that applies OTP to a developer will understate stamp duty by $20k–$120k+.
 *
 * Brackets (dutiable value = full purchase price):
 *   $0        - $25,000    : 1.4%
 *   $25,001   - $130,000   : $350 + 2.4% of excess over $25,000
 *   $130,001  - $960,000   : $2,870 + 6% of excess over $130,000
 *   $960,001  - $2,000,000 : 5.5% of total
 *   >$2,000,000            : 6.5% of total
 *
 * Foreign purchaser surcharge (FSAD): +8% of dutiable value.
 *
 * @param {number}  price     - Purchase price (full dutiable value)
 * @param {boolean} isForeign - Foreign purchaser surcharge (FSAD) applies
 * @returns {number} Stamp duty in AUD (rounded)
 */
export function calcVicStampDuty(price, isForeign = false) {
  if (!price || price <= 0) return 0;

  // Developer/investment purchases: dutiable value is always the full price.
  const dutiable = price;
  let d = 0;

  if      (dutiable <= 25000)   d = dutiable * 0.014;
  else if (dutiable <= 130000)  d = 350  + (dutiable - 25000)  * 0.024;
  else if (dutiable <= 960000)  d = 2870 + (dutiable - 130000) * 0.06;
  else if (dutiable <= 2000000) d = dutiable * 0.055;
  else                          d = dutiable * 0.065;

  if (isForeign) d += dutiable * 0.08;

  return Math.round(d);
}

/**
 * Victorian Land Tax — SRO 2024-25 combined rates (General + COVID Debt Levy).
 *
 * The COVID Debt Repayment Plan surcharge (introduced 1 Jul 2023, running to 2033)
 * added a fixed component and +0.1% to all investment/commercial holdings:
 *   $50,001  - $100,000  : $500 flat (COVID levy only; base rate = nil)
 *   $100,001 - $300,000  : $975 fixed + 0.1% on excess over $100k  (additional to base)
 *   $300,001+            : 0.1% on excess over $100k continues (cumulative)
 *
 * Combined brackets (base + COVID levy, general rate — not trust surcharge):
 *   $0        - $50,000   : nil
 *   $50,001   - $100,000  : $500
 *   $100,001  - $300,000  : $1,350 + 0.30% of excess over $100,000
 *   $300,001  - $600,000  : $1,950 + 0.67% of excess over $300,000
 *   $600,001  - $1,000,000: $3,960 + 1.00% of excess over $600,000
 *   $1,000,001- $1,800,000: $7,960 + 1.40% of excess over $1,000,000
 *   $1,800,001- $3,000,000: $19,160+ 1.70% of excess over $1,800,000
 *   >$3,000,000           : $39,560+ 2.30% of excess over $3,000,000
 *
 * Source: SRO Victoria — Land Tax 2024 Rate Table (general rates, non-PPR).
 *
 * @param {number} landValue    - Unimproved land value (proxy: purchase price)
 * @param {number} holdingYears - Holding period in years
 * @returns {number} Total land tax over holding period (AUD)
 */
export function calcVicSROLandTax(landValue, holdingYears = 1) {
  if (!landValue || landValue <= 0) return 0;
  const years = Math.max(0.5, holdingYears);

  // Combined 2024-25 rates (general + COVID debt levy — valid to 2033)
  let annualTax = 0;
  if      (landValue <= 50000)    annualTax = 0;
  else if (landValue <= 100000)   annualTax = 500;
  else if (landValue <= 300000)   annualTax = 1350  + (landValue - 100000)  * 0.003;
  else if (landValue <= 600000)   annualTax = 1950  + (landValue - 300000)  * 0.0067;
  else if (landValue <= 1000000)  annualTax = 3960  + (landValue - 600000)  * 0.01;
  else if (landValue <= 1800000)  annualTax = 7960  + (landValue - 1000000) * 0.014;
  else if (landValue <= 3000000)  annualTax = 19160 + (landValue - 1800000) * 0.017;
  else                            annualTax = 39560 + (landValue - 3000000) * 0.023;

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
