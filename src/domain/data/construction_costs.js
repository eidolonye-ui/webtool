/**
 * @file domain/data/construction_costs.js
 * @description Melbourne construction cost benchmarks 2025-2026.
 * All rates in AUD per sqm GFA. NCC 2022 7-star energy uplift included in notes.
 * @version 1.1.0 - Fixed encoding artifacts in labels and notes
 */

export const CONSTR_COST = {
  /**
   * nlaEff: NLA/GFA efficiency ratio.
   * GRV comparables are priced on NLA (saleable area), not GFA.
   * Costs are on GFA. This ratio converts buildArea (GFA) to saleable NLA for GRV validation.
   * Wall thickness, stairs, ducts, and common areas reduce NLA below GFA.
   */

  'dual-occ': {
    label:   'Dual Occupancy (Standard)',
    minPSM:  2000,
    maxPSM:  2500,
    midPSM:  2250,
    nlaEff:  0.93,
    notes:   'Two dwellings on one title, shared wall, standard spec. NCC 2022 uplift ~$8k/dwelling. Effective rate often lower per unit due to shared structural elements.'
  },

  'std-th': {
    label:   'Townhouse (Standard Spec)',
    minPSM:  2500,
    maxPSM:  3000,
    midPSM:  2750,
    nlaEff:  0.90,
    notes:   '3-4 bed, 2-storey, 180-220m² GFA. Brick veneer, laminate/tile finishes, standard kitchen. NCC 2022 7-star compliance adds ~$10k/dwelling.'
  },

  'med-th': {
    label:   'Townhouse (Mid-High Spec)',
    minPSM:  3000,
    maxPSM:  3600,
    midPSM:  3300,
    nlaEff:  0.88,
    notes:   '3-4 bed, premium kitchen, engineered timber floors, stone benchtops, 220-280m² GFA. Architect-designed facade.'
  },

  'prem-th': {
    label:   'Townhouse (Prestige / Architect)',
    minPSM:  3600,
    maxPSM:  5200,
    midPSM:  4400,
    nlaEff:  0.87,
    notes:   'Architect-driven, luxury finishes, 280-400m² GFA. Basement car parking, high-end facade. Full custom joinery.'
  },

  'low-apt': {
    label:   'Apartment (4-8 Storeys)',
    minPSM:  4800,
    maxPSM:  6800,
    midPSM:  5800,
    nlaEff:  0.82,
    notes:   'Concrete construction, lift, basement parking, fire sprinklers. Common areas and core reduce NLA to ~82% of GFA.'
  },

  'mid-apt': {
    label:   'Apartment (8-15 Storeys)',
    minPSM:  6200,
    maxPSM:  8800,
    midPSM:  7500,
    nlaEff:  0.78,
    notes:   'Core-and-shell plus fitout, curtain wall facade, post-tensioned slab. NLA typically 78% of GFA. High builder risk margin.'
  }
};

/**
 * Returns the mid-point PSM for a given build type.
 * Used for auto-suggestions in FinancePanel.
 */
export function getSuggestedPSM(buildType) {
  const entry = CONSTR_COST[buildType];
  if (!entry) return 2500;
  return entry.midPSM;
}

/**
 * Returns the PSM range label for display.
 */
export function getPSMRangeLabel(buildType) {
  const entry = CONSTR_COST[buildType];
  if (!entry) return '';
  return '$' + entry.minPSM.toLocaleString() + ' - $' + entry.maxPSM.toLocaleString() + '/m² (' + entry.label + ')';
}
