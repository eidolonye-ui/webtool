/**
 * @file domain/data/zoning_rules.js
 * @description Victorian Planning Zone rules database.
 * @version 1.1.0 - Fixed encoding artifacts; added devPotential descriptor
 */

export const ZONE_RULES = {
  NRZ: {
    label:       'Neighbourhood Residential Zone (NRZ)',
    color:       '#e74c3c',
    maxHeight:   '9m (2 storeys)',
    maxDwellings:'Typically max 2 dwellings',
    minLot:      'Varies by schedule - approx 400-600m² per lot',
    setbacks:    'Front 4-9m, side 1.2-2m, rear 3-6m',
    devPotential:'Low',
    devRating:   2,
    notes:       'Most restrictive residential zone. High-density development virtually impossible. Common in VPO/HO overlay areas.',
    schedules: {
      1: { minLot: '500m²', maxDwellings: '1 dwelling - no subdivision', notes: 'Most restrictive. One dwelling per lot. Rules out any density play.' },
      2: { minLot: '500m²', maxDwellings: 'Max 2 dwellings',           notes: 'Dual-occ may be possible subject to ResCode. Subdivision to 2 lots may be permitted.' },
      3: { minLot: '400m²', maxDwellings: 'Max 2 dwellings',           notes: 'More flexible minimum. Dual-occ with smaller lots. Check council-specific schedule.' },
      4: { minLot: '300m²', maxDwellings: '2+ (check schedule)',       notes: 'Rare - verify council planning scheme before assuming flexibility.' }
    }
  },

  GRZ: {
    label:       'General Residential Zone (GRZ)',
    color:       '#e67e22',
    maxHeight:   '9m (2-3 storeys)',
    maxDwellings:'No maximum (subject to ResCode)',
    minLot:      'From 300m² per lot',
    setbacks:    'Front 4-9m, side 1-2m, rear 3m',
    devPotential:'High',
    devRating:   7,
    notes:       'Most common development zone. Strong townhouse and dual-occ opportunities. An 850m² site typically yields 3-4 dwellings.',
    schedules: {
      1: { minLot: '300m²', maxDwellings: 'No maximum', notes: 'GRZ1 standard. Min 300m² lot, max 60% site coverage, 9m height.' },
      2: { minLot: '250m²', maxDwellings: 'No maximum', notes: 'GRZ2 - more flexible minimum lot. Common in transit corridors and activity centres.' },
      3: { minLot: '300m²', maxDwellings: 'No maximum', notes: 'GRZ3 - neighbourhood character controls may apply. Similar minimums to GRZ1.' },
      4: { minLot: '400m²', maxDwellings: 'No maximum', notes: 'GRZ4 - larger lot requirement. Common in outer suburban growth corridors.' }
    }
  },

  RGZ: {
    label:       'Residential Growth Zone (RGZ)',
    color:       '#27ae60',
    maxHeight:   '13.5m (3-4 storeys)',
    maxDwellings:'No maximum',
    minLot:      '200m² per lot',
    setbacks:    'Front 5m, reduced side setbacks',
    devPotential:'Premium',
    devRating:   9,
    notes:       'Premium development zone. Common near transit corridors. Ideal for medium-density townhouses and low-rise apartments.'
  },

  MUZ: {
    label:       'Mixed Use Zone (MUZ)',
    color:       '#2980b9',
    maxHeight:   'No set limit (controlled by DDO)',
    maxDwellings:'No maximum',
    minLot:      'None',
    setbacks:    'As per DDO or nil setback possible',
    devPotential:'Maximum',
    devRating:   10,
    notes:       'Maximum flexibility. Commercial/residential mix. Highest density development potential. Check active-use permit requirements.'
  },

  C1Z: {
    label:       'Commercial 1 Zone (C1Z)',
    color:       '#8e44ad',
    maxHeight:   'As per DDO',
    maxDwellings:'No maximum',
    minLot:      'None',
    setbacks:    'Zero setback possible',
    devPotential:'High',
    devRating:   8,
    notes:       'Ground-floor retail with upper-level residential. Check active-use permit requirements. Strong location premiums apply.'
  },

  B1Z: {
    label:       'Commercial 2 Zone (C2Z / B1Z)',
    color:       '#16a085',
    maxHeight:   'As per DDO',
    maxDwellings:'No maximum',
    minLot:      'None',
    setbacks:    'As per schedule',
    devPotential:'Medium-High',
    devRating:   7,
    notes:       'Office and light industrial conversion potential. Residential uses may require permit. Check council policy.'
  },

  IN1Z: {
    label:       'Industrial 1 Zone (IN1Z)',
    color:       '#7f8c8d',
    maxHeight:   'As per schedule',
    maxDwellings:'Residential not permitted',
    minLot:      'None',
    setbacks:    'As per schedule',
    devPotential:'Low',
    devRating:   3,
    notes:       'Residential development is prohibited. Industrial and warehousing uses only. Rezoning required for residential conversion.'
  }
};

export const zoningRules = ZONE_RULES;

/**
 * Returns a brief summary of development potential for a given zone code.
 */
export function getZoneSummary(zoneCode) {
  const rule = ZONE_RULES[(zoneCode || '').toUpperCase()];
  if (!rule) return { label: zoneCode, devPotential: 'Unknown', devRating: 0 };
  return {
    label:       rule.label,
    devPotential:rule.devPotential,
    devRating:   rule.devRating,
    maxHeight:   rule.maxHeight,
    minLot:      rule.minLot,
    notes:       rule.notes
  };
}
