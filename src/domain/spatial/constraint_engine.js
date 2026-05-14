/**
 * @file domain/spatial/constraint_engine.js
 * @description Maps legal/physical facts to financial and operational impacts.
 * @version 1.3.0 - Added ZONE_DEFAULTS for Victorian residential/mixed zones
 */

/**
 * Zone-level planning defaults for Victorian residential and mixed-use zones.
 * cov  = max site coverage ratio (0–1)
 * gdn  = min garden/permeable area ratio (0–1)
 * hgt  = preferred max building height (metres)
 * lots = min lot size per dwelling for subdivision (m²)
 */
export const ZONE_DEFAULTS = {
  // Neighbourhood Residential Zone
  NRZ:  { cov: 0.40, gdn: 0.35, hgt: 8,  lots: 300, label: 'Neighbourhood Residential Zone' },
  NRZ1: { cov: 0.40, gdn: 0.35, hgt: 8,  lots: 300, label: 'Neighbourhood Residential Zone 1' },
  NRZ2: { cov: 0.40, gdn: 0.35, hgt: 8,  lots: 300, label: 'Neighbourhood Residential Zone 2' },
  NRZ3: { cov: 0.40, gdn: 0.35, hgt: 8,  lots: 300, label: 'Neighbourhood Residential Zone 3' },
  // General Residential Zone
  GRZ:  { cov: 0.60, gdn: 0.25, hgt: 9,  lots: 250, label: 'General Residential Zone' },
  GRZ1: { cov: 0.60, gdn: 0.25, hgt: 9,  lots: 250, label: 'General Residential Zone 1' },
  GRZ2: { cov: 0.60, gdn: 0.25, hgt: 9,  lots: 250, label: 'General Residential Zone 2' },
  GRZ3: { cov: 0.60, gdn: 0.25, hgt: 9,  lots: 250, label: 'General Residential Zone 3' },
  // Residential Growth Zone
  RGZ:  { cov: 0.65, gdn: 0.20, hgt: 13.5, lots: 200, label: 'Residential Growth Zone' },
  RGZ1: { cov: 0.65, gdn: 0.20, hgt: 13.5, lots: 200, label: 'Residential Growth Zone 1' },
  RGZ2: { cov: 0.65, gdn: 0.20, hgt: 13.5, lots: 200, label: 'Residential Growth Zone 2' },
  // Mixed Use Zone
  MUZ:  { cov: 0.70, gdn: 0.10, hgt: 16,  lots: 150, label: 'Mixed Use Zone' },
  // Activity Centre / Commercial zones (no garden requirement)
  ACZ:  { cov: 0.80, gdn: 0.05, hgt: 24,  lots: 100, label: 'Activity Centre Zone' },
  // Township Zone
  TZ:   { cov: 0.50, gdn: 0.25, hgt: 9,   lots: 300, label: 'Township Zone' },
};

/**
 * Returns zone planning defaults for the given zone code.
 * Falls back gracefully using the base zone prefix (NRZ1 → NRZ).
 * @param {string} zoneCode - e.g. 'NRZ2', 'GRZ1'
 * @returns {{ cov, gdn, hgt, lots, label }}
 */
export const getZoneDefaults = (zoneCode) => {
  if (!zoneCode) return ZONE_DEFAULTS.GRZ; // safe fallback
  const code = zoneCode.toUpperCase().trim();
  if (ZONE_DEFAULTS[code]) return ZONE_DEFAULTS[code];
  // Strip trailing digit(s) and retry (e.g. NRZ4 → NRZ)
  const base = code.replace(/\d+$/, '');
  return ZONE_DEFAULTS[base] || ZONE_DEFAULTS.GRZ;
};

export const CONSTRAINT_MATRIX = {
  'VPO': {
    label: 'Vegetation Protection Overlay',
    impacts: [
      { type: 'COST', category: 'soft_cost', item: 'Arborist Report', amount: 3000, currency: 'AUD' },
      { type: 'TIME', category: 'approval', item: 'Council Tree Permit', delay_days: 60 }
    ],
    severity: 'medium',
    alert: 'Vegetation protection may limit footprint and add approval time.'
  },
  'SBO': {
    label: 'Special Building Overlay (Flood)',
    impacts: [
      { type: 'COST', category: 'hard_cost', item: 'Raised Floor/Foundation', amount: 15000, currency: 'AUD' },
      { type: 'RISK', item: 'Flood Insurance Premium', level: 'high' }
    ],
    severity: 'high',
    alert: 'Flood risk detected. Structural costs for floor level elevation will increase.'
  },
  'HO': {
    label: 'Heritage Overlay',
    impacts: [
      { type: 'TIME', category: 'approval', item: 'Heritage Impact Study', delay_days: 90 },
      { type: 'RISK', item: 'Facade Retention Requirement', level: 'critical' }
    ],
    severity: 'high',
    alert: 'Heritage constraints may severely limit demolition and design flexibility.'
  },
  'SINGLE_DWELLING_COVENANT': {
    label: 'Single Dwelling Covenant',
    impacts: [{ type: 'FATAL', item: 'No Subdivision', effect: 'LOCK_UNITS_TO_1' }],
    severity: 'critical',
    alert: 'FATAL RISK: Restrictive covenant prohibits subdivision. Site locked to single dwelling.'
  },
  'NO_SUBDIVISION_COVENANT': {
    label: 'No Subdivision Covenant',
    impacts: [{ type: 'FATAL', item: 'No Subdivision', effect: 'LOCK_UNITS_TO_1' }],
    severity: 'critical',
    alert: 'FATAL RISK: Legal restriction prohibits subdivision.'
  },
  'EASEMENT': {
    label: 'Easement',
    impacts: [
      { type: 'SPATIAL', item: 'Building Envelope Deduction', effect: 'SUBTRACT_AREA' },
      { type: 'COST', category: 'hard_cost', item: 'Easement Protection/Slab', amount: 5000, currency: 'AUD' }
    ],
    severity: 'medium',
    alert: 'Easements detected. Buildable area will be reduced.'
  },
  'LARGE_TREE': {
    label: 'Significant Tree (TPZ)',
    impacts: [
      { type: 'SPATIAL', item: 'TPZ Deduction', effect: 'SUBTRACT_AREA' },
      { type: 'COST', category: 'soft_cost', item: 'Tree Protection Fencing', amount: 2000, currency: 'AUD' }
    ],
    severity: 'medium',
    alert: 'Tree Protection Zone (TPZ) required. Reduces usable lot area.'
  },
  'S173_SINGLE_DWELLING': {
    label: 'S.173 Agreement - Single Dwelling Only',
    impacts: [
      { type: 'FATAL', item: 'No Subdivision', effect: 'LOCK_UNITS_TO_1' },
      { type: 'TIME', category: 'legal', item: 'S.173 Variation Application', delay_days: 120 },
      { type: 'COST', category: 'soft_cost', item: 'S.173 Legal Removal Application', amount: 18000, currency: 'AUD' }
    ],
    severity: 'critical',
    alert: 'FATAL RISK: S.173 Agreement restricts site to single dwelling. Variation to Council required - not guaranteed.'
  },
  'S173_NO_FURTHER_SUBDIVISION': {
    label: 'S.173 Agreement - No Further Subdivision',
    impacts: [
      { type: 'FATAL', item: 'No Further Subdivision', effect: 'LOCK_UNITS_TO_1' },
      { type: 'TIME', category: 'legal', item: 'S.173 Variation via VCAT/Council', delay_days: 180 }
    ],
    severity: 'critical',
    alert: 'FATAL RISK: S.173 restricts further subdivision. VCAT or Council variation likely needed.'
  },
  'S173_OPEN_SPACE': {
    label: 'S.173 Agreement - Open Space Contribution',
    impacts: [
      { type: 'COST', category: 'soft_cost', item: 'Open Space Levy (S.173)', amount: 25000, currency: 'AUD' },
      { type: 'TIME', category: 'approval', item: 'Open Space Payment Processing', delay_days: 30 }
    ],
    severity: 'high',
    alert: 'S.173 open space agreement in force. A cash contribution is payable upon subdivision.'
  },
  'S173_BUILDING_ENVELOPE': {
    label: 'S.173 Agreement - Building Envelope',
    impacts: [
      { type: 'SPATIAL', item: 'Restricted Building Envelope', effect: 'LIMIT_HEIGHT_AND_SETBACK' },
      { type: 'TIME', category: 'legal', item: 'S.173 Compliance Audit', delay_days: 30 }
    ],
    severity: 'high',
    alert: 'S.173 building envelope agreement limits height and setbacks beyond standard zone requirements.'
  },
  'DDO': {
    label: 'Design and Development Overlay',
    impacts: [
      { type: 'TIME', category: 'approval', item: 'DDO Design Response Required', delay_days: 45 },
      { type: 'COST', category: 'soft_cost', item: 'Urban Design Consultant', amount: 6500, currency: 'AUD' }
    ],
    severity: 'medium',
    alert: 'Design & Development Overlay applies. Additional design response and urban design consultant required.'
  },
  'ESO': {
    label: 'Environmental Significance Overlay',
    impacts: [
      { type: 'COST', category: 'soft_cost', item: 'Ecological Site Assessment', amount: 7500, currency: 'AUD' },
      { type: 'TIME', category: 'approval', item: 'ESO Referral', delay_days: 60 }
    ],
    severity: 'high',
    alert: 'Environmental Significance Overlay: ecological assessment and referral required before permit.'
  },
  'BMO': {
    label: 'Bushfire Management Overlay',
    impacts: [
      { type: 'COST', category: 'hard_cost', item: 'BAL-rated Construction Premium', amount: 22000, currency: 'AUD' },
      { type: 'TIME', category: 'approval', item: 'CFA Referral', delay_days: 30 }
    ],
    severity: 'high',
    alert: 'Bushfire Management Overlay: CFA referral required. Construction costs elevated by BAL rating.'
  }
};

export const evaluateConstraints = function(facts) {
  if (!facts) facts = [];
  var results = { triggeredActions: [], fatalRisks: [], activeAlerts: [], isFatal: false };
  if (!facts.length) return results;
  facts.forEach(function(fact) {
    var constraint = CONSTRAINT_MATRIX[fact];
    if (!constraint) return;
    results.activeAlerts.push({ label: constraint.label, message: constraint.alert, severity: constraint.severity });
    constraint.impacts.forEach(function(impact) {
      if (impact.type === 'FATAL') {
        results.isFatal = true;
        results.fatalRisks.push({ item: impact.item, effect: impact.effect, message: constraint.alert });
      } else {
        results.triggeredActions.push(impact);
      }
    });
  });
  return results;
};

export const suggestLayout = function(frontage, area) {
  if (!frontage) return { type: 'Unknown', note: 'Insufficient data' };
  if (frontage >= 15.2) return { type: 'Side-by-Side', note: 'Frontage allows for dual-access dwellings with independent driveways.', densityPotential: 'High' };
  if (frontage >= 10)   return { type: 'Tandem',       note: 'Narrow frontage suggests tandem layout (one dwelling behind another).', densityPotential: 'Medium' };
  return                       { type: 'Single',       note: 'Frontage too narrow for standard subdivision.', densityPotential: 'Low' };
};

export const calcOverlayTimeline = function(facts, options) {
  if (!facts)   facts   = [];
  if (!options) options = {};
  var basePermitMonths = options.basePermitMonths || 4;
  var hasRAA           = options.hasRAA           || false;
  var hasTownPlanner   = options.hasTownPlanner !== false;

  var milestones = [];
  var cursor     = 0;

  milestones.push({ label: 'Pre-Application Research & Due Diligence', startMonth: cursor, durationMonths: hasTownPlanner ? 1 : 2, critical: false, category: 'preparation' });
  cursor += hasTownPlanner ? 1 : 2;

  milestones.push({ label: 'Concept Design & Town Planning Drawings', startMonth: cursor, durationMonths: 2, critical: false, category: 'design' });
  cursor += 2;

  var overlayDelay = 0;
  var referralItems = [];
  facts.forEach(function(fact) {
    var constraint = CONSTRAINT_MATRIX[fact];
    if (!constraint) return;
    constraint.impacts.forEach(function(impact) {
      if (impact.type === 'TIME') {
        var months = Math.ceil((impact.delay_days || 0) / 30);
        overlayDelay = Math.max(overlayDelay, months);
        referralItems.push({ label: impact.item, months: months, category: constraint.label });
      }
    });
  });

  if (referralItems.length > 0) {
    var critical = referralItems.reduce(function(a, b) { return a.months > b.months ? a : b; });
    milestones.push({ label: 'Overlay Referrals (incl. ' + critical.label + ')', startMonth: cursor, durationMonths: overlayDelay, critical: overlayDelay >= 3, category: 'referral', detail: referralItems });
    cursor += overlayDelay;
  }

  var hasS173       = facts.some(function(f) { return f.indexOf('S173_') === 0; });
  var councilMonths = basePermitMonths + (hasS173 ? 3 : 0) + (hasRAA ? -1 : 0);
  milestones.push({ label: 'Council Planning Permit Assessment', startMonth: cursor, durationMonths: Math.max(2, councilMonths), critical: true, category: 'council' });
  cursor += Math.max(2, councilMonths);

  if (hasS173 || facts.indexOf('HO') !== -1) {
    milestones.push({ label: 'VCAT / Third-Party Objection Risk Window', startMonth: cursor, durationMonths: 3, critical: true, category: 'legal', note: 'Allow contingency. Not always triggered.' });
    cursor += 3;
  }

  milestones.push({ label: 'Endorsed Plans, CoC & Title Registration', startMonth: cursor, durationMonths: 2, critical: false, category: 'finalisation' });
  cursor += 2;

  return {
    milestones:     milestones,
    totalMonths:    cursor,
    criticalPath:   milestones.filter(function(m) { return m.critical; }).map(function(m) { return m.label; }),
    permaDaysTotal: Math.round(cursor * 30)
  };
};
