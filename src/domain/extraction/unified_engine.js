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
    if (vpResult.area)    fields.siteArea    = parseFloat(vpResult.area) || null;
    if (vpResult.lot)     fields.lotRef      = vpResult.lot;

    // Overlay flags from the specialised parser
    if (Array.isArray(vpResult.overlays)) {
      vpResult.overlays.forEach(({ flag }) => { if (flag) fields[flag] = true; });
    }
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
    // Vendor name (display only — not dispatched to store, just shown in badge)
    if (s32Result.vendorName)    fields._vendorName   = s32Result.vendorName;
    // Planning permit
    if (s32Result.hasPermit)     fields._permitNo     = s32Result.permitNo || 'Yes';
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

  if (surveyResult) {
    if (surveyResult.area     != null && surveyResult.area     > 0) fields.siteArea     = surveyResult.area;
    if (surveyResult.frontage != null && surveyResult.frontage > 0) fields.siteFrontage = surveyResult.frontage;
    if (surveyResult.depth    != null && surveyResult.depth    > 0) fields.siteDepth    = surveyResult.depth;
    if (surveyResult.lot)     fields.lotRef        = surveyResult.lot;
    if (surveyResult.hasEasement) {
      fields.hasEasement    = true;
      if (surveyResult.easementDesc)   fields.easementDetails = surveyResult.easementDesc;
      if (surveyResult.easementWidthM) fields.easementWidthM  = surveyResult.easementWidthM;
    }
  }

  const hasData    = Object.keys(fields).length > 0;
  const confidence = hasData ? (fields.siteArea && fields.siteFrontage ? 85 : 65) : 40;

  return { fields, facts: [], confidence };
};

// ---------------------------------------------------------------------------
// toDispatchMap — unwrap merged state → dispatch-ready path/value pairs
// ---------------------------------------------------------------------------

/**
 * Convert the merged site state (which has {value, source} objects) into a flat
 * map of `storePath → plainValue` ready for store.batchDispatch().
 *
 * @param {Object} mergedState - output of mergeExtractionBatch
 * @returns {Object}  e.g. { 'planning.zoneCode': 'NRZ1', 'planning.hasHO': true }
 */
export const toDispatchMap = (mergedState) => {
  const result = {};
  Object.entries(mergedState).forEach(([key, entry]) => {
    const path = FIELD_TO_PATH[key];
    if (!path) return;
    const plain = (entry !== null && typeof entry === 'object' && 'value' in entry)
      ? entry.value
      : entry;
    if (plain === null || plain === undefined) return;
    result[path] = plain;
  });
  return result;
};

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates extraction for all three site documents.
 * Routes each document to its specialist parser, supplements with ai_adapter,
 * then merges using the priority system (SURVEY:4 > S32:3 > VICPLAN:2).
 *
 * @param {File|string} vpFile   — VicPlan / Planning Certificate
 * @param {File|string} s32File  — Section 32 / Vendor Statement
 * @param {File|string} fspFile  — Feature & Level Survey Plan
 * @param {Object} currentSiteState — current site state from store (merge base)
 * @returns {{ dispatchMap: Object, synthesis: Object, confidence: number }}
 */
export const extractAllFields = async (vpFile, s32File, fspFile, currentSiteState = {}) => {
  const sources = [
    { file: vpFile,  type: 'VICPLAN', priority: 'VICPLAN' },
    { file: s32File, type: 'S32',     priority: 'S32'     },
    { file: fspFile, type: 'SURVEY',  priority: 'SURVEY'  },
  ];

  let siteState         = { ...currentSiteState };
  let allExtractedFacts = [];
  let totalConfidence   = 0;
  let docCount          = 0;

  for (const source of sources) {
    if (!source.file) continue;

    try {
      let text = '';
      if (source.file instanceof File) {
        // Use pdf_ocr.extractFileText() — handles PDFs via PDF.js (proper text layer),
        // with automatic Tesseract OCR fallback for scanned/image pages.
        // Replaces the previous source.file.text() which decoded raw PDF bytes as UTF-8
        // (binary garbage, not the actual text content).
        console.log('[UnifiedEngine] Extracting text from', source.file.name, '(', source.type, ')');
        text = await extractFileText(source.file);
        if (!text.trim()) {
          console.warn('[UnifiedEngine] No text extracted from', source.file.name);
        }
      } else if (typeof source.file === 'string') {
        text = source.file;
      }

      if (!text.trim()) continue;
      docCount++;

      // Type-aware specialist parsing
      let normalized;
      if (source.type === 'VICPLAN') {
        const vpResult  = parseVicPlanText(text);
        const aiResult  = await parseDocumentWithAI(text);
        normalized      = normalizeVicPlanResult(vpResult, aiResult);
      } else if (source.type === 'S32') {
        const s32Result = parseSection32Text(text);
        const aiResult  = await parseDocumentWithAI(text);
        normalized      = normalizeS32Result(s32Result, aiResult);
      } else {  // SURVEY
        const survResult = parseSurveyPlan(text);
        normalized       = normalizeSurveyResult(survResult);
      }

      // Priority-based merge
      if (normalized.fields && Object.keys(normalized.fields).length) {
        siteState = mergeExtractionBatch(siteState, normalized.fields, source.priority);
      }

      if (normalized.facts?.length) {
        allExtractedFacts = [...allExtractedFacts, ...normalized.facts];
      }

      if (typeof normalized.confidence === 'number') {
        totalConfidence += normalized.confidence;
      }

    } catch (e) {
      console.error('[UnifiedEngine] Error processing', source.type, e);
    }
  }

  // Constraint synthesis from deduplicated facts
  const synthesis   = evaluateConstraints([...new Set(allExtractedFacts)]);
  const dispatchMap = toDispatchMap(siteState);

  return {
    dispatchMap,
    updatedSiteState: dispatchMap,   // legacy alias
    synthesis,
    confidence: docCount > 0 ? Math.round(totalConfidence / docCount) : 0,
  };
};
