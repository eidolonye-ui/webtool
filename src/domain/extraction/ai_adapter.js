/**
 * @file domain/extraction/ai_adapter.js
 * @description Rule-based Victorian property document parser.
 * @version 4.1.0 - Section-aware ENCUMBRANCES extraction + expanded covenant patterns + dealing numbers.
 *
 * Zero external dependencies. Works fully offline, instantly, reliably.
 * Parses: VicPlan Certificates, Section 32 Vendor Statements, Survey Plans.
 */

// ---------------------------------------------------------------------------
// Zone code detection
// ---------------------------------------------------------------------------

const ZONE_NAME_MAP = [
  { rx: /Neighbourhood\s+Residential\s+Zone/i,       code: 'NRZ'  },
  { rx: /General\s+Residential\s+Zone/i,             code: 'GRZ'  },
  { rx: /Residential\s+Growth\s+Zone/i,              code: 'RGZ'  },
  { rx: /Low\s+Density\s+Residential\s+Zone/i,       code: 'LDRZ' },
  { rx: /Mixed\s+Use\s+Zone/i,                       code: 'MUZ'  },
  { rx: /Commercial\s+1\s+Zone/i,                    code: 'C1Z'  },
  { rx: /Commercial\s+2\s+Zone/i,                    code: 'C2Z'  },
  { rx: /Activity\s+Centre\s+Zone/i,                 code: 'ACZ'  },
  { rx: /Urban\s+Activity\s+Zone/i,                  code: 'UAZ'  },
  { rx: /Industrial\s+1\s+Zone/i,                    code: 'IN1Z' },
  { rx: /Industrial\s+2\s+Zone/i,                    code: 'IN2Z' },
  { rx: /Industrial\s+3\s+Zone/i,                    code: 'IN3Z' },
  { rx: /Public\s+Use\s+Zone/i,                      code: 'PUZ'  },
  { rx: /Public\s+Park\s+and\s+Recreation\s+Zone/i,  code: 'PPRZ' },
  { rx: /Comprehensive\s+Development\s+Zone/i,       code: 'CDZ'  },
  { rx: /Rural\s+Activity\s+Zone/i,                  code: 'RAZ'  },
  { rx: /Farming\s+Zone/i,                           code: 'FZ'   },
  { rx: /Green\s+Wedge\s+Zone/i,                     code: 'GWZ'  },
];

const ZONE_SHORTCODES = /\b(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|PPRZ|FZ|CDZ|GWZ|MDZ|RAZ)\b/i;

const extractZoneCode = (text) => {
  const directCode = text.match(
    /\b(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|PPRZ|FZ|CDZ|GWZ|MDZ|RAZ)\s*(\d+)\b/i
  );
  if (directCode) return directCode[1].toUpperCase() + directCode[2];

  const scheduleCode = text.match(
    /\b(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|FZ|CDZ|GWZ|RAZ)\s*[-–]\s*Schedule\s+(\d+)/i
  );
  if (scheduleCode) return scheduleCode[1].toUpperCase() + scheduleCode[2];

  const codeInParen = text.match(
    /\(\s*(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|FZ|CDZ|GWZ|RAZ)\s*(\d+)?\s*\)/i
  );
  if (codeInParen) return (codeInParen[1] + (codeInParen[2] || '')).toUpperCase();

  for (const { rx, code } of ZONE_NAME_MAP) {
    const m = text.match(rx);
    if (m) {
      const win = text.slice(Math.max(0, m.index - 20), m.index + 140);
      const sm = win.match(/[-–(]\s*Schedule\s+(\d+)/i)
              || win.match(/Schedule\s+(\d+)/i)
              || win.match(/[-–(]\s*(\d+)\s*[)-]/);
      return code + (sm ? sm[1] : '');
    }
  }

  const bare = text.match(ZONE_SHORTCODES);
  if (bare) return bare[1].toUpperCase();
  return null;
};

// ---------------------------------------------------------------------------
// Overlay detection
// ---------------------------------------------------------------------------

const extractOverlaySchedule = (matchStr) => {
  const m = matchStr.match(/[-–\s]+Schedule\s+(\d+)/i)
          || matchStr.match(/\b([A-Z]+O)\s*(\d+)\b/i)
          || matchStr.match(/\b(\d{1,4})\b/);
  if (!m) return '';
  const num = m[2] || m[1];
  return /^\d+$/.test(num) ? num : '';
};

const OVERLAY_DEFS = [
  { re: /Heritage\s+Overlay\s*(\d+)?|Heritage\s+Precinct|\bHO\s*(\d+)?\b/i,
    tag: 'HO', field: 'hasHO', label: (n) => 'Heritage Overlay' + (n ? ' (HO' + n + ')' : ' (HO)') },
  { re: /Vegetation\s+Protection\s+Overlay\s*(\d+)?|\bVPO\s*(\d+)?\b/i,
    tag: 'VPO', field: 'hasVPO', label: (n) => 'Vegetation Protection Overlay' + (n ? ' (VPO' + n + ')' : ' (VPO)') },
  { re: /Special\s+Building\s+Overlay\s*(\d+)?|Land\s+Subject\s+to\s+Inundation|\bSBO\s*(\d+)?\b|\bLSIO\s*(\d+)?\b/i,
    tag: 'SBO', field: 'hasSBO', label: (n) => 'Flood Risk Overlay' + (n ? ' (SBO' + n + ')' : ' (SBO/LSIO)') },
  { re: /Bushfire\s+Management\s+Overlay\s*(\d+)?|\bBMO\s*(\d+)?\b/i,
    tag: 'BMO', field: 'hasBMO', label: (n) => 'Bushfire Management Overlay' + (n ? ' (BMO' + n + ')' : ' (BMO)') },
  { re: /Environmental\s+Significance\s+Overlay\s*(\d+)?|\bESO\s*(\d+)?\b/i,
    tag: 'ESO', field: 'hasESO', label: (n) => 'Environmental Significance Overlay' + (n ? ' (ESO' + n + ')' : ' (ESO)') },
  { re: /Design\s+and\s+Development\s+Overlay\s*(\d+)?|\bDDO\s*(\d+)?\b/i,
    tag: 'DDO', field: 'hasDDO', label: (n) => 'Design & Development Overlay' + (n ? ' (DDO' + n + ')' : ' (DDO)') },
  { re: /Significant\s+Landscape\s+Overlay\s*(\d+)?|\bSLO\s*(\d+)?\b/i,
    tag: 'SLO', field: 'hasSLO', label: (n) => 'Significant Landscape Overlay' + (n ? ' (SLO' + n + ')' : ' (SLO)') },
  { re: /Aboriginal\s+Cultural\s+Heritage\s+Overlay|\bACHO\b/i,
    tag: 'ACHO', field: 'hasACHO', label: () => 'Aboriginal Cultural Heritage Overlay (ACHO)' },
  { re: /Erosion\s+Management\s+Overlay|Geotechnical\s+Overlay|\bEMO\s*(\d+)?\b/i,
    tag: 'EMO', field: 'hasEMO', label: (n) => 'Erosion Management Overlay' + (n ? ' (EMO' + n + ')' : ' (EMO)') },
];

// ---------------------------------------------------------------------------
// Section-aware encumbrances extraction
// ---------------------------------------------------------------------------

const extractEncumbrancesSection = (text) => {
  const headingRx = /ENCUMBRANCES?,?\s*CAVEATS?\s+AND\s+NOTICES?|ENCUMBRANCES?\s+ON\s+TITLE|CAVEATS?\s+AND\s+ENCUMBRANCES?|REGISTERED\s+ENCUMBRANCES?/i;
  const match = text.match(headingRx);
  if (!match) return '';
  const start = match.index + match[0].length;
  const tail = text.slice(start, start + 3500);
  const stopRx = /\n[A-Z][A-Z\s,&]{8,}\n|\n\s*\d+\.\s+[A-Z]{3}/;
  const stopMatch = tail.match(stopRx);
  return stopMatch ? tail.slice(0, stopMatch.index) : tail;
};

// ---------------------------------------------------------------------------
// Dealing number extraction
// ---------------------------------------------------------------------------

const extractDealingNumbers = (text) => {
  const matches = [];
  let m;
  const rx = /\b([DATRK][0-9]{5,8}|A[LTKFR][0-9]{5,8})\b/gi;
  while ((m = rx.exec(text)) !== null) matches.push(m[1]);
  return [...new Set(matches)];
};

// ---------------------------------------------------------------------------
// Covenant patterns
// ---------------------------------------------------------------------------

const COVENANT_PATTERNS = [
  {
    re: /one\s+(?:private\s+)?dwelling\s+only|single\s+dwelling\s+covenant|one\s+house\s+only|no\s+more\s+than\s+one\s+(?:private\s+)?dwelling|restricted\s+to\s+one\s+(?:private\s+)?dwelling|erect\s+one\s+(?:private\s+)?dwelling\s+house\s+only|shall\s+not\s+erect\s+any\s+building\s+other\s+than\s+a\s+(?:private\s+)?dwelling|not\s+to\s+erect\s+more\s+than\s+one\s+dwelling|one\s+residential\s+dwelling\s+only|limited\s+to\s+(?:a\s+)?single\s+(?:private\s+)?dwelling/i,
    tag: 'SINGLE_DWELLING_COVENANT', field: 'hasSingleCovenant',
  },
  {
    re: /no\s+subdivision|cannot\s+be\s+(?:further\s+)?divided|shall\s+not\s+be\s+subdivided|not\s+to\s+be\s+subdivided/i,
    tag: 'NO_SUBDIVISION_COVENANT', field: 'hasNoSubdivisionCovenant',
  },
];

// ---------------------------------------------------------------------------
// Easement patterns
// ---------------------------------------------------------------------------

const EASEMENT_PATTERNS = [
  { re: /\beasement\b.*?(?:drainage|sewerage|sewer|stormwater|water|gas|electricity|service|access|carriageway)/i },
  { re: /(?:drainage|sewerage|sewer|stormwater).*?\beasement\b/i },
  { re: /right\s+of\s+way\b|right\s+of\s+carriageway/i },
  { re: /build\s+over\s+easement|\bBOE\b/i },
];

const extractEasementDetails = (text) => {
  const widthM = text.match(/(\d+(?:\.\d+)?)\s*m(?:etre|eter)?s?\b.*?easement/i)
              || text.match(/easement.*?(\d+(?:\.\d+)?)\s*m(?:etre|eter)?s?\b/i);
  if (widthM) return widthM[1] + 'm easement detected in document';
  const links = text.match(/(\d+(?:\.\d+)?)\s*links?\s+(?:wide\s+)?easement/i);
  if (links) return (parseFloat(links[1]) * 0.201168).toFixed(2) + 'm easement (converted from links)';
  return 'Easement detected in document';
};

// ---------------------------------------------------------------------------
// S.173 Agreement patterns
// ---------------------------------------------------------------------------

const S173_PATTERNS = [
  { re: /section\s+173\s+agreement|s\.?\s*173\s+agreement|agreement\s+under\s+section\s+173/i, tag: 'S173_BASE' },
  { re: /s\.?173[^.]{0,80}single\s+dwelling|s\.?173[^.]{0,80}one\s+dwelling|single\s+dwelling[^.]{0,80}s\.?173/i, tag: 'S173_SINGLE_DWELLING' },
  { re: /s\.?173[^.]{0,80}no\s+further\s+subdivision|s\.?173[^.]{0,80}cannot\s+be\s+subdivided/i, tag: 'S173_NO_FURTHER_SUBDIVISION' },
  { re: /s\.?173[^.]{0,80}open\s+space|open\s+space[^.]{0,80}contribution[^.]{0,80}s\.?173/i, tag: 'S173_OPEN_SPACE' },
  { re: /s\.?173[^.]{0,80}building\s+envelope|building\s+envelope[^.]{0,80}s\.?173/i, tag: 'S173_BUILDING_ENVELOPE' },
];

// ---------------------------------------------------------------------------
// Tree / vegetation patterns
// ---------------------------------------------------------------------------

const TREE_PATTERNS = [
  { re: /tree\s+protection\s+zone|\bTPZ\b|significant\s+tree|protected\s+tree|vegetation\s+removal\s+permit/i, tag: 'LARGE_TREE' },
];

// ---------------------------------------------------------------------------
// Mortgage / charge patterns
// ---------------------------------------------------------------------------

const MORTGAGE_PATTERNS = [
  { re: /\bmortgage\b/i, field: 'hasMortgage' },
  { re: /\bcharge\s+(?:registered|on\s+title)/i, field: 'hasMortgage' },
  { re: /\bcaveat\b/i, field: 'hasMortgage' },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export const parseDocumentWithAI = async (text) => {
  if (!text || !text.trim()) {
    throw new Error('No document text provided for analysis.');
  }

  const facts  = [];
  const fields = {
    zoneCode:                 null,
    hasHO: false, hasVPO: false, hasSBO: false, hasBMO: false,
    hasESO: false, hasDDO: false, hasSLO: false, hasACHO: false, hasEMO: false,
    overlayLabels:            [],
    hasSingleCovenant:        false,
    hasNoSubdivisionCovenant: false,
    hasEasement:              false,
    easementDetails:          null,
    hasS173Agreement:         false,
    s173Details:              null,
    covenantDetails:          null,
    dealingNumbers:           [],
    encumbranceSectionText:   null,
    hasMortgage:              false,
    keyRisks:                 [],
    summary:                  null,
  };

  // 0 — Extract encumbrances section for section-aware searching
  const encText = extractEncumbrancesSection(text);
  if (encText) fields.encumbranceSectionText = encText.trim().slice(0, 500);
  const corpus = encText || text;

  fields.dealingNumbers = extractDealingNumbers(corpus);

  // 1 — Zone code (full doc — zones appear in planning certificate section)
  fields.zoneCode = extractZoneCode(text);

  // 2 — Overlays (full doc)
  OVERLAY_DEFS.forEach(({ re, tag, field, label }) => {
    const m = text.match(re);
    if (m) {
      facts.push(tag);
      fields[field] = true;
      fields.overlayLabels.push(label(extractOverlaySchedule(m[0])));
    }
  });

  // 3 — Covenants (encumbrances corpus first, fallback to full doc)
  COVENANT_PATTERNS.forEach(({ re, tag, field }) => {
    const m = corpus.match(re) || text.match(re);
    if (m) {
      facts.push(tag);
      fields[field] = true;
      if (field === 'hasSingleCovenant') fields.covenantDetails = m[0].trim().slice(0, 120);
    }
  });

  // 4 — Easements (corpus first)
  let easementFound = false;
  EASEMENT_PATTERNS.forEach(({ re }) => {
    if (!easementFound && (re.test(corpus) || re.test(text))) {
      facts.push('EASEMENT');
      fields.hasEasement = true;
      fields.easementDetails = extractEasementDetails(corpus || text);
      easementFound = true;
    }
  });

  // 5 — S.173 Agreements (corpus first)
  let s173Found = false;
  S173_PATTERNS.forEach(({ re, tag }) => {
    if (re.test(corpus) || re.test(text)) {
      s173Found = true;
      if (tag !== 'S173_BASE') facts.push(tag);
    }
  });
  if (s173Found) {
    fields.hasS173Agreement = true;
    if (!facts.some(f => f.startsWith('S173_'))) facts.push('S173_SINGLE_DWELLING');
    const s173Match = (corpus || text).match(/s(?:ection)?\.?\s*173[^.]{0,200}/i);
    fields.s173Details = s173Match ? s173Match[0].trim().slice(0, 160) : 'Section 173 agreement registered on title.';
  }

  // 6 — Trees / TPZ (full doc)
  TREE_PATTERNS.forEach(({ re, tag }) => { if (re.test(text)) facts.push(tag); });

  // 7 — Mortgage / charge / caveat (corpus first)
  MORTGAGE_PATTERNS.forEach(({ re, field }) => {
    if (re.test(corpus) || re.test(text)) fields[field] = true;
  });

  // 8 — Key risks summary
  const risks = [];
  if (fields.hasSingleCovenant)  risks.push('Single dwelling covenant restricts development');
  if (fields.hasHO)              risks.push('Heritage Overlay — demolition/alterations permit required');
  if (fields.hasSBO)             risks.push('Flood overlay — hydrology / BOE report needed');
  if (fields.hasBMO)             risks.push('Bushfire overlay — BAL rating required');
  if (fields.hasDDO)             risks.push('Design & Development Overlay — design response required');
  if (fields.hasS173Agreement)   risks.push('Section 173 agreement on title');
  if (fields.hasEasement)        risks.push('Easement detected — check for build-over easement (BOE) implications');
  if (fields.hasMortgage)        risks.push('Mortgage/charge registered — confirm discharge pre-settlement');
  fields.keyRisks = risks;

  // 9 — Summary
  const zoneStr    = fields.zoneCode ? 'Zone: ' + fields.zoneCode + '. ' : '';
  const overlayStr = fields.overlayLabels.length
    ? fields.overlayLabels.join(', ') + ' apply. '
    : 'No planning overlays detected. ';
  fields.summary   = zoneStr + overlayStr +
    (risks.length ? risks.length + ' risk factor(s): ' + risks.join('; ') + '.' : 'No significant encumbrances detected.');

  const hitCount   = facts.length + (fields.zoneCode ? 2 : 0);
  const confidence = Math.min(95, 55 + hitCount * 8);

  return { facts: [...new Set(facts)], fields, confidence };
};

// parseDocumentWithAI is already exported as `export const` above (named export, no default).
export const PARSING_SYSTEM_PROMPT = '/* Rule-based parser v4.1.0 — no LLM required */';
