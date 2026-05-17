/**
 * @file domain/extraction/unified_engine.js
 * @description Enhanced extraction engine with type-aware parsing and Priority Merging.
 * @version 4.0.0 - Type-aware parsers: VicPlan→parseVicPlanText, S32→parseSection32Text,
 *                  Survey→parseSurveyPlan.  Expanded FIELD_TO_PATH with site dimensions,
 *                  outgoings, lot ref, overlay flags (DDO/SLO/ESO/ACHO).
 *
 * Priority cascade: SURVEY (4) > S32 (3) > VICPLAN (2) > API (1)
 */

import { parseDocumentWithAI }               from './ai_adapter.js';
import { parseVicPlanText, parseSection32Text, parseSurveyPlan } from './parsers.js';
import { evaluateConstraints }               from '../spatial/constraint_engine.js';
import { extractFileText }                   from './pdf_ocr.js';   // PDF.js + Tesseract OCR fallback
import { mergeExtractionBatch }              from '../spatial/data_merger.js';

// ---------------------------------------------------------------------------
// Canonical field → store path mapping
// All paths that do NOT exist in initialState are created dynamically by
// store._setDeepValue() — this is safe and works for the current store impl.
// ---------------------------------------------------------------------------
export const FIELD_TO_PATH = {
  // Zone
  zoneCode:             'planning.zoneCode',

  // Planning overlays
  hasHO:                'planning.hasHO',
  hasVPO:               'planning.hasVPO',
  hasSBO:               'planning.hasSBO',
  hasBMO:               'planning.hasBMO',
  hasDDO:               'planning.hasDDO',        // dynamic
  hasSLO:               'planning.hasSLO',        // dynamic
  hasESO:               'planning.hasESO',        // dynamic
  hasACHO:              'planning.hasACHO',       // dynamic
  hasEMO:               'planning.hasEMO',        // dynamic

  // Legal constraints
  hasSingleCovenant:    'planning.hasSingleCovenant',
  hasEasement:          'planning.hasEasementBoe',
  easementDetails:      'planning.easementDetails',  // dynamic
  easementWidthM:       'planning.easementWidthM',   // dynamic
  hasS173Agreement:     'planning.hasS173',
  s173Details:          'planning.s173Details',
  covenantDetails:      'planning.covenantDetails',
  dealingNumbers:       'planning.dealingNumbers',   // Victorian title dealing refs (D######, AL######)
  hasMortgage:          'planning.hasMortgage',      // dynamic

  // Site dimensions (Survey Plan is highest-priority source; overrides API estimates)
  siteArea:             'site.area',
  siteFrontage:         'site.frontage',
  siteDepth:            'site.depth',
  dimensionsSource:     'site.dimensionsSource', // 'terrain' | 'fsp' | 'vicplan' | 'manual'

  // Physical site conditions (from Feature & Level Survey Plan)
  siteSlope:            'physical.slope',            // slope % derived from AHD or explicit label
  siteAspect:           'physical.aspect',           // cardinal direction front faces
  elevationDelta:       'physical.elevationDelta',   // max AHD − min AHD (metres)
  siteBmLevel:          'site.investigation.bmLevel',// benchmark RL datum (informational)
  surveyDate:           'site.investigation.surveyDate',
  surveyorName:         'site.investigation.surveyorName',

  // Admin / reference
  lotRef:               'planning.lotRef',           // dynamic
  titleVolume:          'planning.titleVolume',      // dynamic
  titleFolio:           'planning.titleFolio',       // dynamic
  councilName:          'planning.councilName',      // dynamic

  // Outgoings (from S32)
  councilRates:         'planning.councilRates',     // dynamic
  waterRates:           'planning.waterRates',       // dynamic

  // Overlay schedule labels (e.g. ["HO295", "DDO12"])
  overlayLabels:        'planning.overlayLabels',      // dynamic

  // Services (from S32)
  servicesElec:         'planning.servicesElec',       // dynamic
  servicesGas:          'planning.servicesGas',        // dynamic
  servicesWater:        'planning.servicesWater',      // dynamic
  servicesSewer:        'planning.servicesSewer',      // dynamic

  // ── VicPlan-specific ──────────────────────────────────────────────────────
  siteAddress:          'site.address',
  bushfireZone:         'planning.bushfireZone',
  nativeVeg:            'planning.nativeVeg',
  propnum:              'planning.propnum',

  // ── S32-specific ──────────────────────────────────────────────────────────
  hasRestrictiveCovenant:  'planning.hasRestrictiveCovenant',
  restrictiveCovenantDesc: 'planning.restrictiveCovenantDesc',
  hasMCP:               'planning.hasMCP',
  landTaxAmt:           'planning.landTaxAmt',
  servicesTel:          'planning.servicesTel',
  hasPermit:            'planning.hasPermit',
  permitNo:             'planning.permitNo',
  s32Processed:         'planning.s32Processed',  // always true once S32 is parsed

  // ── FSP-specific ───────────────────────────────────────────────────────────
  ahdMin:               'physical.ahdMin',
  ahdMax:               'physical.ahdMax',
  slopeDeg:             'physical.slopeDeg',
  frontToRearDelta:     'physical.frontToRearDelta',   // front→rear AHD height diff (m)
  leftToRightDelta:     'physical.leftToRightDelta',   // left→right cross-fall (m)
  siteEasements:        'physical.siteEasements',      // enriched array with boundary + affectedAreaM2

  // Analysis
  keyRisks:             'site.investigation.keyRisks',
  summary:              'site.investigation.summary',
};

// ---------------------------------------------------------------------------
// Human-readable labels for each field (used in the panel's apply summary)
// ---------------------------------------------------------------------------
export const FIELD_LABELS = {
  zoneCode:             'Zone Code',
  hasHO:                'Heritage Overlay (HO)',
  hasVPO:               'Vegetation Protection Overlay (VPO)',
  hasSBO:               'Flood / Special Building Overlay (SBO)',
  hasBMO:               'Bushfire Management Overlay (BMO)',
  hasDDO:               'Design & Development Overlay (DDO)',
  hasSLO:               'Significant Landscape Overlay (SLO)',
  hasESO:               'Environmental Significance Overlay (ESO)',
  hasACHO:              'Aboriginal Cultural Heritage Overlay (ACHO)',
  hasEMO:               'Erosion Management Overlay (EMO)',
  hasSingleCovenant:    'Single Dwelling Covenant',
  hasEasement:          'Easement on Title',
  easementDetails:      'Easement Details',
  easementWidthM:       'Easement Width (m)',
  hasS173Agreement:     'Section 173 Agreement',
  s173Details:          'S.173 Details',
  covenantDetails:      'Covenant Details',
  dealingNumbers:       'Title Dealing Numbers',
  hasMortgage:          'Mortgage / Charge Registered',
  siteArea:             'Surveyed Lot Area (m²)',
  siteFrontage:         'Lot Frontage (m)',
  siteDepth:            'Lot Depth (m)',
  siteSlope:            'Site Slope (%)',
  siteAspect:           'Site Aspect / Orientation',
  elevationDelta:       'Elevation Change (m)',
  siteEasements:        'Easements (all)',
  siteBmLevel:          'Survey Benchmark (RL)',
  surveyDate:           'Survey Date',
  surveyorName:         'Surveyor',
  lotRef:               'Lot / Plan Reference',
  titleVolume:          'Title Volume',
  titleFolio:           'Title Folio',
  councilName:          'Council / LGA',
  councilRates:         'Council Rates ($/yr)',
  waterRates:           'Water Rates ($/yr)',
  overlayLabels:        'Overlay Schedule Numbers',
  servicesElec:         'Electricity Connected',
  servicesGas:          'Gas Connected',
  servicesWater:        'Water Connected',
  servicesSewer:        'Sewer Connected',
  // VicPlan
  siteAddress:          'Property Address',
  bushfireZone:         'Bushfire Prone Area',
  nativeVeg:            'Native Vegetation',
  propnum:              'Property Number',
  // S32
  hasRestrictiveCovenant:  'Restrictive Covenant',
  restrictiveCovenantDesc: 'Restrictive Covenant Details',
  hasMCP:               'Memorandum of Common Provisions',
  landTaxAmt:           'Land Tax ($/yr)',
  servicesTel:          'Telephone / NBN Connected',
  hasPermit:            'Planning Permit on Title',
  permitNo:             'Permit Number',
  // FSP
  ahdMin:               'AHD Min Spot Height (m)',
  ahdMax:               'AHD Max Spot Height (m)',
  slopeDeg:             'Site Slope (degrees)',
  // Analysis
  keyRisks:             'Key Risk Factors',
  summary:              'Document Summary',
};

// ---------------------------------------------------------------------------
// Normalisers: convert each specialist parser's output to the canonical fields
// ---------------------------------------------------------------------------

/**
 * Normalise output of parseVicPlanText + parseDocumentWithAI (supplement)
 * into the canonical fields object.
 *
 * @param {Object} vpResult  — result of parseVicPlanText(text)
 * @param {Object} aiResult  — result of parseDocumentWithAI(text) (supplement for S173, mortgage etc.)
 * @returns {{ fields: Object, facts: string[], confidence: number }}
 */
export const normalizeVicPlanResult = (vpResult, aiResult) => {
  const fields = {};

  if (vpResult) {
    if (vpResult.zone)    fields.zoneCode    = vpResult.zone.trim();
    if (vpResult.council) fields.councilName = vpResult.council.trim();
    if (vpResult.area) {
      fields.siteArea = parseFloat(vpResult.area) || null;
      // VicPlan area is cadastre-grade — better than terrain estimate, but FSP takes priority
      fields.dimensionsSource = 'vicplan';
    }
    if (vpResult.lot)     fields.lotRef      = vpResult.lot;
    if (vpResult.address) fields.siteAddress = vpResult.address.trim();
    if (vpResult.propnum) fields.propnum     = vpResult.propnum.trim();
    if (vpResult.bushfire) fields.bushfireZone = vpResult.bushfire.trim();
    if (vpResult.nativeVeg) fields.nativeVeg  = vpResult.nativeVeg.trim();

    // Overlay flags from the specialised parser
    if (Array.isArray(vpResult.overlays)) {
      vpResult.overlays.forEach(({ flag, label }) => {
        if (flag) fields[flag] = true;
      });
      // Build overlayLabels array from parsed overlay labels (supplemented later by ai_adapter schedule numbers)
      if (vpResult.overlays.length && !vpResult.overlaysConfirmedNone) {
        fields.overlayLabels = vpResult.overlays.map(o => o.label);
      }
    }
    if (vpResult.overlaysConfirmedNone) fields.overlayLabels = [];
  }

  // Supplement with ai_adapter for things parsers.js doesn't cover
  if (aiResult?.fields) {
    const af = aiResult.fields;
    // Zone code: take the MORE SPECIFIC result (longer string = has schedule number).
    // parsers.js can match bare "(GRZ)" without a schedule; ai_adapter often finds "GRZ1".
    if (af.zoneCode) {
      const vpZone = (fields.zoneCode || '').trim();
      const aiZone = af.zoneCode.trim();
      if (!vpZone || aiZone.length > vpZone.length) fields.zoneCode = aiZone;
    }
    // Legal encumbrances from ai_adapter
    if (af.hasSingleCovenant)   fields.hasSingleCovenant  = true;
    if (af.hasEasement)         { fields.hasEasement = true; fields.easementDetails = af.easementDetails; }
    if (af.hasS173Agreement)    { fields.hasS173Agreement = true; fields.s173Details = af.s173Details; }
    if (af.hasMortgage)         fields.hasMortgage = true;
    if (af.covenantDetails)     fields.covenantDetails = af.covenantDetails;
    // Overlay labels with schedule numbers (e.g. ["HO295", "DDO12"])
    if (af.overlayLabels?.length) fields.overlayLabels = af.overlayLabels;
    // Overlay flags also from ai_adapter (if parsers.js missed them)
    ['hasHO','hasVPO','hasSBO','hasBMO','hasESO','hasDDO','hasSLO','hasACHO','hasEMO'].forEach(flag => {
      if (!fields[flag] && af[flag]) fields[flag] = true;
    });
    if (af.keyRisks?.length) fields.keyRisks = af.keyRisks;
    if (af.summary)           fields.summary  = af.summary;
    // Supplement council name and lot ref if parsers didn't get them
    if (!fields.councilName && af.councilName) fields.councilName = af.councilName;
    if (!fields.lotRef && af.lotRef)           fields.lotRef      = af.lotRef;
  }

  const facts       = aiResult?.facts || [];
  const confidence  = aiResult?.confidence || (vpResult?.zone ? 70 : 50);

  return { fields, facts, confidence };
};

/**
 * Normalise output of parseSection32Text into the canonical fields object.
 *
 * @param {Object} s32Result — result of parseSection32Text(text)
 * @param {Object} aiResult  — supplementary result of parseDocumentWithAI(text)
 * @returns {{ fields: Object, facts: string[], confidence: number }}
 */
export const normalizeS32Result = (s32Result, aiResult) => {
  const fields = {};

  if (s32Result) {
    // Always mark S32 as processed — even if no covenant found, the absence is important
    fields.s32Processed = true;

    if (s32Result.hasSingleCovenant) fields.hasSingleCovenant  = true;
    if (s32Result.hasEasement) {
      fields.hasEasement   = true;
      if (s32Result.easementDesc)   fields.easementDetails  = s32Result.easementDesc;
      if (s32Result.easementWidthM) fields.easementWidthM   = s32Result.easementWidthM;
    }
    if (s32Result.hasS173) {
      fields.hasS173Agreement = true;
      if (s32Result.s173Desc) fields.s173Details = s32Result.s173Desc;
    }
    if (s32Result.covenantDesc)  fields.covenantDetails = s32Result.covenantDesc;
    if (s32Result.hasMortgage)   fields.hasMortgage     = true;
    if (s32Result.area) {
      const a = parseFloat(s32Result.area);
      if (!isNaN(a) && a > 0) fields.siteArea = a;
    }
    if (s32Result.lot)          fields.lotRef       = s32Result.lot;
    if (s32Result.titleVolume)  fields.titleVolume  = s32Result.titleVolume;
    if (s32Result.titleFolio)   fields.titleFolio   = s32Result.titleFolio;
    if (s32Result.councilRatesAmt) {
      const r = parseFloat(s32Result.councilRatesAmt);
      if (!isNaN(r) && r > 0) fields.councilRates = r;
    }
    if (s32Result.waterRatesAmt) {
      const w = parseFloat(s32Result.waterRatesAmt);
      if (!isNaN(w) && w > 0) fields.waterRates = w;
    }
    // Services
    if (s32Result.servicesElec)  fields.servicesElec  = s32Result.servicesElec;
    if (s32Result.servicesGas)   fields.servicesGas   = s32Result.servicesGas;
    if (s32Result.servicesWater) fields.servicesWater = s32Result.servicesWater;
    if (s32Result.servicesSewer) fields.servicesSewer = s32Result.servicesSewer;
    // Dealing numbers (D######, AL######, etc.)
    if (s32Result.covenantDocNums?.length) fields.dealingNumbers = s32Result.covenantDocNums;

    // Restrictive covenant (non-single-dwelling)
    if (s32Result.hasRestrictiveCovenant) {
      fields.hasRestrictiveCovenant = true;
      if (s32Result.restrictiveCovenantDesc) fields.restrictiveCovenantDesc = s32Result.restrictiveCovenantDesc;
    }

    // MCP
    if (s32Result.hasMCP) fields.hasMCP = true;

    // Services — telephone
    if (s32Result.servicesTel) fields.servicesTel = s32Result.servicesTel;

    // Outgoings — land tax
    if (s32Result.landTaxAmt) {
      const lt = parseFloat(s32Result.landTaxAmt);
      if (!isNaN(lt) && lt > 0) fields.landTaxAmt = lt;
    }

    // Planning permit on title
    if (s32Result.hasPermit) {
      fields.hasPermit = true;
      if (s32Result.permitNo) fields.permitNo = s32Result.permitNo;
    }

    // Vendor name (display only — not dispatched to store, just shown in badge)
    if (s32Result.vendorName) fields._vendorName = s32Result.vendorName;
  }

  // Supplement from ai_adapter
  if (aiResult?.fields) {
    const af = aiResult.fields;
    if (!fields.hasS173Agreement && af.hasS173Agreement) {
      fields.hasS173Agreement = true;
      if (af.s173Details) fields.s173Details = af.s173Details;
    }
    if (!fields.hasSingleCovenant && af.hasSingleCovenant) fields.hasSingleCovenant = true;
    if (!fields.hasEasement && af.hasEasement) {
      fields.hasEasement  = true;
      fields.easementDetails = af.easementDetails;
    }
  }

  const facts      = aiResult?.facts || [];
  const confidence = aiResult?.confidence || 60;

  return { fields, facts, confidence };
};

/**
 * Normalise output of parseSurveyPlan into the canonical fields object.
 *
 * @param {Object} surveyResult — result of parseSurveyPlan(text)
 * @returns {{ fields: Object, facts: string[], confidence: number }}
 */
export const normalizeSurveyResult = (surveyResult) => {
  const fields = {};
  const facts  = [];

  if (surveyResult) {
    // ── Dimensions ─────────────────────────────────────────────────────────────
    // FSP is the highest-priority source — always overrides terrain estimates.
    // Once dimensionsSource is set to 'fsp', SiteInvestigationPanel won't overwrite.
    const hasFspDims = (surveyResult.area > 0) || (surveyResult.frontage > 0) || (surveyResult.depth > 0);
    if (surveyResult.area     != null && surveyResult.area     > 0) fields.siteArea     = surveyResult.area;
    if (surveyResult.frontage != null && surveyResult.frontage > 0) fields.siteFrontage = surveyResult.frontage;
    if (surveyResult.depth    != null && surveyResult.depth    > 0) fields.siteDepth    = surveyResult.depth;
    if (hasFspDims) fields.dimensionsSource = 'fsp'; // lock future terrain overwrites

    // ── Physical conditions ───────────────────────────────────────────────────
    if (surveyResult.slopePercent != null) {
      fields.siteSlope = surveyResult.slopePercent;
      const deg = surveyResult.slopeDeg != null ? ` (${surveyResult.slopeDeg}°)` : '';
      facts.push(`Site slope: ${surveyResult.slopePercent}%${deg}`);
    }
    if (surveyResult.aspect) {
      fields.siteAspect = surveyResult.aspect;
      facts.push(`Site aspect: ${surveyResult.aspect}-facing`);
    }
    if (surveyResult.elevationDeltaM != null) {
      fields.elevationDelta = surveyResult.elevationDeltaM;
      facts.push(`Elevation change across site: ${surveyResult.elevationDeltaM}m (AHD ${surveyResult.ahd_min}–${surveyResult.ahd_max})`);
    }
    if (surveyResult.ahd_min != null) fields.ahdMin = surveyResult.ahd_min;
    if (surveyResult.ahd_max != null) fields.ahdMax = surveyResult.ahd_max;
    if (surveyResult.bmLevel != null) fields.siteBmLevel = surveyResult.bmLevel;
    if (surveyResult.slopeDeg != null) {
      fields.slopeDeg = surveyResult.slopeDeg;
      facts.push(`Slope: ${surveyResult.slopePercent}% (${surveyResult.slopeDeg}°)`);
    }

    // ── Directional elevation deltas (from labelled AHD corner heights) ───────
    if (surveyResult.frontToRearDeltaM != null) {
      fields.frontToRearDelta = surveyResult.frontToRearDeltaM;
      const depth = surveyResult.depth;
      facts.push(
        `Front-to-rear slope: ${surveyResult.frontToRearDeltaM}m height difference` +
        (depth ? ` over ${depth}m depth` : '')
      );
    }
    if (surveyResult.leftToRightDeltaM != null) {
      fields.leftToRightDelta = surveyResult.leftToRightDeltaM;
      const label = surveyResult.leftToRightDeltaM < 0.3 ? 'relatively flat cross-fall'
                  : surveyResult.leftToRightDeltaM < 0.8 ? 'minor cross-fall'
                  : 'notable cross-fall';
      facts.push(`Left-to-right: ${surveyResult.leftToRightDeltaM}m ${label}`);
    }

    // ── Easements ─────────────────────────────────────────────────────────────
    if (surveyResult.hasEasement) {
      fields.hasEasement = true;
      if (surveyResult.easementDesc)   fields.easementDetails = surveyResult.easementDesc;
      if (surveyResult.easementWidthM) fields.easementWidthM  = surveyResult.easementWidthM;
      // Full enriched easement array (boundary + affectedAreaM2 per entry)
      if (surveyResult.easements?.length) {
        fields.siteEasements = surveyResult.easements;
        surveyResult.easements.forEach(e => {
          let fact = `Easement: ${e.type}`;
          if (e.widthM)        fact += ` — ${e.widthM}m wide`;
          if (e.boundary)      fact += ` along ${e.boundary} boundary`;
          if (e.affectedAreaM2 != null) fact += ` (~${e.affectedAreaM2}m² affected)`;
          facts.push(fact);
        });
      }
    }

    // ── Reference / admin ─────────────────────────────────────────────────────
    if (surveyResult.lot)          fields.lotRef       = surveyResult.lot;
    if (surveyResult.titleVolume)  fields.titleVolume  = surveyResult.titleVolume;
    if (surveyResult.titleFolio)   fields.titleFolio   = surveyResult.titleFolio;
    if (surveyResult.surveyDate)   fields.surveyDate   = surveyResult.surveyDate;
    if (surveyResult.surveyorName) fields.surveyorName = surveyResult.surveyorName;
  }

  const hasData    = Object.keys(fields).length > 0;
  const confidence = hasData
    ? (fields.siteArea && fields.siteFrontage && fields.siteDepth ? 92
       : fields.siteArea && fields.siteFrontage ? 85
       : fields.siteArea ? 70 : 55)
    : 40;

  return { fields, facts, confidence };
};

// ---------------------------------------------------------------------------
// toDispatchMap -- unwrap merged state -> dispatch-ready path/value pairs
// ---------------------------------------------------------------------------

/**
 * Convert the merged site state (which has {value, source} objects) into a flat
 * map of storePath -> plain value, ready for store.batchDispatch().
 *
 * @param {object} mergedFields - output of normalizeXxxResult().fields
 * @returns {Array<{path: string, value: *}>}
 */
export const toDispatchMap = (mergedFields) => {
  return Object.entries(mergedFields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([key, value]) => {
      const path = FIELD_TO_PATH[key];
      if (!path) return null;
      return { path, value };
    })
    .filter(Boolean);
};
