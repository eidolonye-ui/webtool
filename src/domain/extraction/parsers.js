/**
 * @file domain/extraction/parsers.js
 * @description Pure functions for parsing planning and legal documents (VicPlan, Section 32, Feature Survey).
 * @version 2.0.0 - Added parseSurveyPlan; expanded lot/plan reference patterns.
 */

export const parseVicPlanText = (text) => {
  if (!text || !text.trim()) return null;

  const t = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  const tUpper = t.toUpperCase();
  const result = {
    zone: "",
    overlays: [],
    overlaysConfirmedNone: false,
    council: "",
    bushfire: "",
    propnum: "",
    area: "",
    lot: "",
    address: "",
    nativeVeg: "",
    rawLines: t.split("\n").slice(0, 60)
  };

  /* 1. ZONE DETECTION — priority: code+digit > schedule notation > code in parens > full name > bare code */

  // 1a. Direct code immediately followed by digit: GRZ1, NRZ2, IN1Z3, etc.
  const directWithDigit = t.match(/\b(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|PPRZ|FZ|CDZ|GWZ)\s*(\d+)\b/i);
  if (directWithDigit) result.zone = (directWithDigit[1] + directWithDigit[2]).toUpperCase();

  // 1b. "Code - Schedule N" or "Code – Schedule N" (common in VicPlan certificates)
  if (!result.zone) {
    const codeSchedule = t.match(/\b(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|FZ|CDZ|GWZ)\s*[-–]?\s*Schedule\s+(\d+)/i) ||
      t.match(/Schedule\s+(\d+)\s*[-–]?\s*(?:to\s+the\s+)?(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|FZ|CDZ|GWZ)/i);
    if (codeSchedule) {
      const code  = codeSchedule[1].length <= 5 ? codeSchedule[1] : codeSchedule[2];
      const sched = codeSchedule[1].length <= 5 ? codeSchedule[2] : codeSchedule[1];
      result.zone = (code + sched).toUpperCase();
    }
  }

  // 1c. "(GRZ1)" in parentheses — only use if digit is present; "(GRZ)" alone is ambiguous
  if (!result.zone) {
    const codeInParen = t.match(/\(\s*(NRZ|GRZ|RGZ|LDRZ|MUZ|C1Z|C2Z|CAZ|ACZ|UAZ|IN1Z|IN2Z|IN3Z|PUZ|FZ|CDZ|GWZ)\s*(\d+)\s*\)/i);
    if (codeInParen) result.zone = (codeInParen[1] + codeInParen[2]).toUpperCase();
  }

  if (!result.zone) {
    const nameMap = [
      { rx: /Neighbourhood\s+Residential\s+Zone/i, code: "NRZ" },
      { rx: /General\s+Residential\s+Zone/i, code: "GRZ" },
      { rx: /Residential\s+Growth\s+Zone/i, code: "RGZ" },
      { rx: /Mixed\s+Use\s+Zone/i, code: "MUZ" },
      { rx: /Low\s+Density\s+Residential/i, code: "LDRZ" },
      { rx: /Commercial\s+1\s+Zone/i, code: "C1Z" },
    ];
    for (const { rx, code } of nameMap) {
      if (rx.test(t)) {
        result.zone = code;
        const mIdx = t.search(rx);
        const nearby = t.slice(Math.max(0, mIdx - 20), mIdx + 120);
        const sm = nearby.match(/Schedule\s+(\d+)/i) || nearby.match(/[-(]\s*(\d+)\s*[)]/);
        if (sm) result.zone = code + sm[1];
        break;
      }
    }
  }

  /* 2. PLANNING OVERLAYS */
  const overlaySection = t.match(/Planning\s+Overlay[s]?[:\s-]+([^\n]{0,200})/i);
  const overlaySectionText = overlaySection ? overlaySection[1] : "";
  const hasNoneKeyword = /\bNone\b|\bNil\b|\bNo\s+Overlays?\b/i;

  if (hasNoneKeyword.test(overlaySectionText) || (tUpper.includes("PLANNING OVERLAYS") && hasNoneKeyword.test(t.slice(tUpper.indexOf("PLANNING OVERLAYS"), tUpper.indexOf("PLANNING OVERLAYS") + 100)))) {
    result.overlaysConfirmedNone = true;
  } else {
    const overlayDefs = [
      { rx: /Heritage\s+Overlay|\bHO(?:\s*\d+)?\b/i, flag: "hasHO", label: "Heritage Overlay (HO)" },
      { rx: /Vegetation\s+Protection\s+Overlay|\bVPO\s*\d*\b/i, flag: "hasVPO", label: "Vegetation Protection Overlay (VPO)" },
      { rx: /Significant\s+Landscape\s+Overlay|\bSLO\s*\d*\b/i, flag: "hasSLO", label: "Significant Landscape Overlay (SLO)" },
      { rx: /Environmental\s+Significance\s+Overlay|\bESO\s*\d*\b/i, flag: "hasESO", label: "Environmental Significance Overlay (ESO)" },
      { rx: /Special\s+Building\s+Overlay|\bSBO\s*\d*\b|Land\s+Subject\s+to\s+Inundation|\bLSIO\s*\d*\b/i, flag: "hasSBO", label: "Flood Risk Overlay (SBO/LSIO)" },
      { rx: /Bushfire\s+Management\s+Overlay|\bBMO\s*\d*\b/i, flag: "hasBMO", label: "Bushfire Management Overlay (BMO)" },
      { rx: /Aboriginal\s+Cultural\s+Heritage\s+Overlay|\bACHO\b/i, flag: "hasACHO", label: "Aboriginal Cultural Heritage Overlay (ACHO)" },
      { rx: /Geotechnical\s+Overlay|Landslip\s+Overlay|\bEMO\s*\d*\b|Erosion\s+Management\s+Overlay/i, flag: "hasEMO", label: "Geotechnical/Erosion Overlay (EMO)" },
      { rx: /Design\s+and\s+Development\s+Overlay|\bDDO\s*\d*\b/i, flag: "hasDDO", label: "Design & Development Overlay (DDO)" },
    ];
    overlayDefs.forEach(({ rx, flag, label }) => { if (rx.test(t)) result.overlays.push({ flag, label }); });
  }

  /* 3. COUNCIL / LGA */
  const lgaM = t.match(/(?:Local\s+Government\s+Area|LGA|Council|Municipality)[:\s-]+([A-Za-z\s]+?)(?:\n|$|,|\()/i);
  if (lgaM) {
    const raw = lgaM[1].trim().replace(/^(City\s+of|Shire\s+of|Borough\s+of|Rural\s+City\s+of|Town\s+of)\s+/i, "");
    if (raw.length > 2 && raw.length < 40) result.council = raw.trim();
  }

  /* 4. BUSHFIRE PRONE AREA */
  const bfM = t.match(/Bushfire\s+Prone\s+Area[:\s-]+([A-Za-z]+)/i);
  if (bfM) result.bushfire = bfM[1].trim();

  /* 5. PROPERTY NUMBER */
  const propM = t.match(/(?:Property\s+No|Prop\.?\s*No\.?|Property\s+Number|PROPNUM|Parcel\s+No)[.:\s]+([A-Z0-9\/-]+)/i);
  if (propM) result.propnum = propM[1].trim();

  /* 6. LAND AREA */
  const areaM = t.match(/(?:Land\s+Area|Site\s+Area|Total\s+Area|Area\s+of\s+Land|Lot\s+Area)[:\s]+(\d[\d,]*\.?\d*)\s*(?:m2|m|sq\.?m|square\s+metres?)/i) ||
    t.match(/(\d[\d,]{2,})\s*m[2]/);
  if (areaM) result.area = areaM[1].replace(/,/g, "");

  /* 7. LOT / PLAN REFERENCE */
  const lotM = t.match(/Lot\s+(\d+[A-Z]?)\s+(?:on\s+)?(PS|LP|TP|SP|CP|DP)\s*(\d+[A-Z]?)/i);
  if (lotM) result.lot = `Lot ${lotM[1].toUpperCase()} on ${lotM[2].toUpperCase()}${lotM[3].toUpperCase()}`;

  /* 8. PROPERTY ADDRESS */
  const addrM = t.match(/\b(\d{1,4}[A-Z]?)\s+([A-Za-z][A-Za-z\s'-]{2,40}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Way|Lane|Ln|Boulevard|Blvd|Crescent|Cres|Close|Cl|Grove|Gr|Terrace|Tce)[.]?)\s*[,\s]+([A-Za-z][A-Za-z\s]{2,30})\s+VIC\s+(\d{4})/i);
  if (addrM) result.address = `${addrM[1]} ${addrM[2].trim()}, ${addrM[3].trim()} VIC ${addrM[4]}`;

  /* 9. NATIVE VEGETATION */
  if (/within\s+(?:a\s+)?(?:native\s+vegetation|vegetation\s+protection|significant\s+vegetation)/i.test(t) ||
    /native\s+vegetation\s+(?:present|applicable|detected|exists)/i.test(t)) {
    result.nativeVeg = "Within";
  } else if (/outside\s+(?:native\s+vegetation|vegetation\s+protection)/i.test(t) ||
    /no\s+native\s+vegetation/i.test(t)) {
    result.nativeVeg = "Outside";
  }

  return result;
};

/**
 * Parses a Section 32 Vendor Statement to extract encumbrances, covenants,
 * easements, services, outgoings and title details.
 *
 * Key improvement over v1: section-aware extraction.
 * Victorian S32 documents have a predictable structure — covenant and easement
 * information is concentrated under headings like:
 *   "ENCUMBRANCES, CAVEATS AND NOTICES"
 *   "RESTRICTIONS AND ENCUMBRANCES"
 *   "PARTICULARS OF ENCUMBRANCES"
 * We extract that section first and search within it for higher precision.
 *
 * Document reference numbers used on Victorian titles:
 *   D######  — Dealing (most common for covenants, e.g. D151733)
 *   A######  — (older dealings)
 *   T######  — Transfer / Transaction dealing
 *   AL###### — Affecting Land dealing
 *   AT###### — (affecting transfer)
 *   AF###### — (affecting)
 *   AK###### — (caveat / affecting)
 *   R######  — (Crown Grant reference)
 *   PS###### — Plan of Subdivision reference
 */
export const parseSection32Text = (text) => {
  if (!text || !text.trim()) return null;
  const t = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
  const tUpper = t.toUpperCase();

  const result = {
    hasSingleCovenant: false,
    hasEasement: false,
    easementDesc: "",
    easementWidthM: "",
    hasS173: false,
    s173Desc: "",
    covenantDesc: "",
    hasMortgage: false,
    mortgageDesc: "",
    hasMCP: false,
    mcpDesc: "",
    hasRestrictiveCovenant: false,
    restrictiveCovenantDesc: "",
    hasEncumbrance: false,
    encumbranceDesc: "",
    vendorName: "",
    lot: "",
    area: "",
    titleVolume: "",
    titleFolio: "",
    servicesElec: "",
    servicesGas: "",
    servicesWater: "",
    servicesSewer: "",
    servicesTel: "",
    councilRatesAmt: "",
    waterRatesAmt: "",
    landTaxAmt: "",
    hasPermit: false,
    permitNo: "",
    permitDesc: "",
    covenantDocNums: [],
    encumbranceSectionText: "",  // raw text of the encumbrances section (for display)
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Extract the ENCUMBRANCES / RESTRICTIONS section
  //    This section contains covenants, easements, caveats, mortgages.
  //    It ends at the next major section heading.
  // ─────────────────────────────────────────────────────────────────────────
  const encSectionRx = /(?:ENCUMBRANCES?[,\s]+CAVEATS?[,\s]+AND[,\s]+NOTICES?|ENCUMBRANCES?[,\s]+AND[,\s]+RESTRICTIONS?|RESTRICTIONS?[,\s]+AND[,\s]+ENCUMBRANCES?|PARTICULARS\s+OF\s+ENCUMBRANCES?|ENCUMBRANCES?\s+ON\s+TITLE)/i;
  let encText = "";
  const encIdx = tUpper.search(encSectionRx.source ? encSectionRx : new RegExp(encSectionRx.source, 'i'));
  if (encIdx !== -1) {
    // Extract up to 3000 chars; stop at the next ALL-CAPS heading
    const slice = t.slice(encIdx, encIdx + 3000);
    const nextHeadingM = slice.slice(100).match(/\n[A-Z][A-Z\s,&]+(?:\n|:)/);
    result.encumbranceSectionText = nextHeadingM
      ? slice.slice(0, 100 + nextHeadingM.index).trim()
      : slice.trim();
    encText = result.encumbranceSectionText;
    result.hasEncumbrance = encText.length > 20;
  }

  // Primary search corpus: encumbrances section if found, else full text
  const corpus = encText || t;

  // ─────────────────────────────────────────────────────────────────────────
  // 2. Document reference numbers (Victorian title dealings)
  //    D######, A######, T######, AL######, AT######, AF######, AK######, R######
  // ─────────────────────────────────────────────────────────────────────────
  const docNumRx = /\b([DATRK][0-9]{5,8}|A[LTKF][0-9]{5,8})\b/g;
  const _docNums = [...corpus.matchAll(docNumRx)];
  _docNums.forEach(m => {
    const n = m[1];
    if (!result.covenantDocNums.includes(n)) result.covenantDocNums.push(n);
  });
  // Also catch "Dealing No. D151733" / "Instrument No. D151733" formats anywhere in document
  const dealingNums = [...t.matchAll(/\b(?:Dealing|Instrument|Document|Registration|Reference)\s+No\.?\s*([A-Z]{1,2}\d{5,8})\b/gi)];
  dealingNums.forEach(m => {
    const n = m[1];
    if (!result.covenantDocNums.includes(n)) result.covenantDocNums.push(n);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Single-dwelling covenant detection
  //    Search encumbrances section first, then full document.
  //    Comprehensive patterns covering typical Victorian covenant wording.
  // ─────────────────────────────────────────────────────────────────────────
  const singleDwellingRx = new RegExp(
    'single[\\s-]dwelling\\s+covenant' +
    '|one\\s+(?:private\\s+)?dwelling\\s+(?:house\\s+)?only' +
    '|not\\s+to\\s+erect\\s+more\\s+than\\s+one\\s+(?:private\\s+)?dwelling' +
    '|erect\\s+one\\s+(?:private\\s+)?dwelling\\s+house\\s+only' +
    '|restricted\\s+to\\s+one\\s+(?:private\\s+)?dwelling' +
    '|shall\\s+not\\s+erect\\s+any\\s+building\\s+other\\s+than\\s+(?:a\\s+)?(?:private\\s+)?dwelling' +
    '|one\\s+house\\s+only' +
    '|no\\s+more\\s+than\\s+one\\s+(?:private\\s+)?dwelling' +
    '|one\\s+(?:single\\s+)?(?:private\\s+)?residential\\s+dwelling\\s+only',
    'i'
  );

  const singleDwellingMatch = singleDwellingRx.test(corpus);
  if (singleDwellingMatch) {
    result.hasSingleCovenant = true;
    const covM = corpus.match(singleDwellingRx);
    // Expand context around the match
    const matchIdx = corpus.search(singleDwellingRx);
    const ctx = corpus.slice(Math.max(0, matchIdx - 30), matchIdx + 200);
    result.covenantDesc = ctx.trim().slice(0, 250);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. No-subdivision covenant
  // ─────────────────────────────────────────────────────────────────────────
  if (!result.hasSingleCovenant && /no\s+subdivision|cannot\s+be\s+(?:further\s+)?divided|shall\s+not\s+be\s+subdivided|not\s+to\s+be\s+subdivided/i.test(corpus)) {
    result.hasRestrictiveCovenant = true;
    const rcM = corpus.match(/(?:no\s+subdivision|shall\s+not\s+be\s+subdivided)[^.;\n]{0,200}/i);
    if (rcM) result.restrictiveCovenantDesc = rcM[0].trim().slice(0, 200);
    if (!result.covenantDesc) result.covenantDesc = result.restrictiveCovenantDesc;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. General restrictive covenant (fallback)
  //    Also extract covenant description from near D-numbers in encumbrances section
  // ─────────────────────────────────────────────────────────────────────────
  if (!result.hasSingleCovenant && !result.hasRestrictiveCovenant) {
    if (/restrictive\s+covenant|registered\s+covenant|restrictive\s+agreement/i.test(corpus)) {
      result.hasRestrictiveCovenant = true;
    }
    const covM = corpus.match(/(?:restrictive\s+)?covenant[^.;\n]{0,200}/i);
    if (covM && !result.covenantDesc) {
      result.covenantDesc = covM[0].trim().slice(0, 200);
    }
  }

  // If we found doc numbers in the encumbrances section, try to extract
  // content associated with each number (line following the number)
  if (result.covenantDocNums.length && !result.covenantDesc && encText) {
    const firstNum = result.covenantDocNums[0];
    const numIdx = encText.indexOf(firstNum);
    if (numIdx !== -1) {
      result.covenantDesc = encText.slice(numIdx, numIdx + 300).trim();
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. Memorandum of Common Provisions (MCP)
  // ─────────────────────────────────────────────────────────────────────────
  const mcpM = t.match(/(?:memorandum\s+of\s+common\s+provisions?|\bMCP\b|common\s+provisions?)[^.;\n]{0,200}/i);
  if (mcpM) { result.hasMCP = true; result.mcpDesc = mcpM[0].trim().slice(0, 150); }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. Easements — search in encumbrances section first
  // ─────────────────────────────────────────────────────────────────────────
  const eM = corpus.match(/easement[^.;\n]{0,200}/i);
  if (eM) {
    result.hasEasement = true;
    result.easementDesc = eM[0].trim().slice(0, 150);
    const widthM = eM[0].match(/(\d+\.?\d*)\s*m(?:etre|eter)?s?\b/i) || eM[0].match(/(\d+\.?\d*)\s*m\b/);
    if (widthM) result.easementWidthM = widthM[1];
    const widthLinks = eM[0].match(/(\d+\.?\d*)\s*links?/i);
    if (widthLinks && !result.easementWidthM)
      result.easementWidthM = String((parseFloat(widthLinks[1]) * 0.201168).toFixed(2));
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. Section 173 Agreement
  // ─────────────────────────────────────────────────────────────────────────
  if (/section\s+173|s\.?\s*173\s+agreement/i.test(t)) {
    result.hasS173 = true;
    const s173M = t.match(/section\s+173[^.;\n]{0,200}/i);
    if (s173M) result.s173Desc = s173M[0].trim().slice(0, 200);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. Mortgage / Charge / Caveat
  // ─────────────────────────────────────────────────────────────────────────
  const mortM = t.match(/(?:mortgage|charge)[^.;\n]{0,150}/i);
  if (mortM && !/no\s+mortgage|no\s+charge/i.test(mortM[0])) {
    result.hasMortgage = true;
    result.mortgageDesc = mortM[0].trim().slice(0, 120);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. Land area + lot reference
  // ─────────────────────────────────────────────────────────────────────────
  const areaM = t.match(/(?:total\s+area|lot\s+area|site\s+area|area\s+of\s+land|land\s+area)[:\s]+(\d[\d,]*\.?\d*)\s*(m2|m|sq\.?m|square\s+metres?|ha|hectares?)/i);
  if (areaM) {
    let area = areaM[1].replace(/,/g, "");
    if (/ha|hectares?/i.test(areaM[2])) area = String(Math.round(parseFloat(area) * 10000));
    result.area = area;
  }

  const lotM = t.match(/Lot\s+(\d+[A-Z]?)\s+(?:on\s+)?(?:PS|LP|TP|SP|CP|DP)\s*(\d+[A-Z]?)/i);
  if (lotM) {
    const planType = lotM[0].match(/\b(PS|LP|TP|SP|CP|DP)\b/i)?.[1]?.toUpperCase() || 'PS';
    result.lot = `Lot ${lotM[1].toUpperCase()} on ${planType}${lotM[2].toUpperCase()}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 11. Title reference (Volume / Folio)
  // ─────────────────────────────────────────────────────────────────────────
  const ctM = t.match(/(?:Volume|Vol\.?)\s+(\d+)\s+(?:Folio|Fol\.?)\s+(\d+)/i);
  if (ctM) { result.titleVolume = ctM[1]; result.titleFolio = ctM[2]; }

  // ─────────────────────────────────────────────────────────────────────────
  // 12. Vendor / Registered proprietor
  // ─────────────────────────────────────────────────────────────────────────
  const vendorM = t.match(/(?:vendor|owner|registered\s+proprietor)[:\s]+([A-Z][A-Za-z\s'-]{3,60})(?:\n|,|\()/i);
  if (vendorM) result.vendorName = vendorM[1].trim();

  // ─────────────────────────────────────────────────────────────────────────
  // 13. Services / utilities
  // ─────────────────────────────────────────────────────────────────────────
  const svcSection = t.match(/(?:services?|utilities|connections?)[:\s-]+([^\n]{0,600})/i)?.[1] || t;
  const parseService = (rx) => {
    const m = svcSection.match(rx);
    if (!m) return "";
    const after = (svcSection.slice(svcSection.search(rx)).match(/(?:yes|no|connected|not\s+connected|available|unavailable)/i) || [""])[0];
    return after ? after.replace(/not\s+connected|unavailable/i, "No").replace(/connected|available|yes/i, "Yes") : "";
  };
  result.servicesElec  = parseService(/electricity/i) || (/electricity[^.]{0,50}yes/i.test(t) ? "Yes" : /electricity[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesGas   = parseService(/\bgas\b/i)    || (/\bgas[^.]{0,50}yes/i.test(t) ? "Yes" : /\bgas[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesWater = parseService(/water/i)       || (/water[^.]{0,50}yes/i.test(t) ? "Yes" : /water[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesSewer = parseService(/sewer(?:age)?/i) || (/sewer[^.]{0,50}yes/i.test(t) ? "Yes" : /sewer[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesTel   = parseService(/telephone|telecommunications?|nbn/i) || (/(?:telephone|nbn)[^.]{0,50}yes/i.test(t) ? "Yes" : /(?:telephone|nbn)[^.]{0,50}no\b/i.test(t) ? "No" : "");

  // ─────────────────────────────────────────────────────────────────────────
  // 14. Outgoings
  // ─────────────────────────────────────────────────────────────────────────
  const crM = t.match(/council\s+rates?[:\s$]+(\d[\d,]*\.?\d*)\s*(?:per\s+annum|p\.?a\.?|\/yr|\/year|per\s+quarter|per\s+qtr)?/i);
  if (crM) result.councilRatesAmt = crM[1].replace(/,/g, "");
  const wrM = t.match(/water\s+(?:rates?|charges?)[:\s$]+(\d[\d,]*\.?\d*)/i);
  if (wrM) result.waterRatesAmt = wrM[1].replace(/,/g, "");
  const ltM = t.match(/land\s+tax[:\s$]+(\d[\d,]*\.?\d*)/i);
  if (ltM) result.landTaxAmt = ltM[1].replace(/,/g, "");

  // ─────────────────────────────────────────────────────────────────────────
  // 15. Planning permits on title
  // ─────────────────────────────────────────────────────────────────────────
  const ppM = t.match(/planning\s+permit[:\s#]+([A-Z0-9\/-]{4,20})/i);
  if (ppM) { result.hasPermit = true; result.permitNo = ppM[1]; }
  const ppDesc = t.match(/permit(?:ted)?\s+(?:for|to)[:\s]+([^.;\n]{0,100})/i);
  if (ppDesc) result.permitDesc = ppDesc[1].trim().slice(0, 80);

  return result;
};

// ---------------------------------------------------------------------------
// Feature & Level Survey Plan parser
// ---------------------------------------------------------------------------

/**
 * Extracts site dimensions and easement details from a Feature & Level Survey Plan.
 * Survey plans are the highest-priority source for physical lot dimensions.
 *
 * Typical fields extracted:
 *  area       — surveyed lot area in m²
 *  frontage   — frontage dimension in metres
 *  depth      — average depth in metres
 *  lot        — lot/plan reference string
 *  hasEasement, easementDesc, easementWidthM
 *
 * @param {string} text - Raw OCR'd or text-layer text from a survey plan PDF
 * @returns {Object|null}
 */
export const parseSurveyPlan = (text) => {
  if (!text || !text.trim()) return null;
  const t = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");

  const result = {
    area:          null,  // number, m²
    frontage:      null,  // number, metres
    depth:         null,  // number, metres
    lot:           "",
    hasEasement:   false,
    easementDesc:  "",
    easementWidthM: "",
  };

  /* 1. LOT AREA — various formats used by surveyors */
  const areaM =
    t.match(/(?:lot\s+area|site\s+area|total\s+area|area)[:\s=]+(\d[\d,]*\.?\d*)\s*m[²2]/i) ||
    t.match(/(?:lot\s+area|site\s+area|area)[:\s=]+(\d[\d,]*\.?\d*)\s*sq\.?\s*m/i)          ||
    t.match(/(?:lot\s+area|area)[:\s=]+(\d[\d,]*\.?\d*)\s*(?:ha|hectares?)/i)                ||
    // Standalone "450.50 m²" — require at least 3 digits to avoid dimension line false positives
    t.match(/(\d{3,}\.?\d*)\s*m[²2]/i);
  if (areaM) {
    let raw = areaM[1].replace(/,/g, "");
    if (/ha|hectares?/i.test(areaM[0])) raw = String(Math.round(parseFloat(raw) * 10000));
    result.area = parseFloat(raw);
  }

  /* 2. FRONTAGE — explicit label preferred */
  const frontageM =
    t.match(/(?:road\s+)?frontage\s+to\s+[A-Za-z\s''-]{3,40}[:\s]+(\d+\.?\d*)\s*m?/i) ||
    t.match(/frontage[:\s=]+(\d+\.?\d*)\s*m?/i);
  if (frontageM) result.frontage = parseFloat(frontageM[1]);

  /* 3. DEPTH — explicit label preferred */
  const depthM =
    t.match(/(?:average\s+)?depth\s+to\s+rear[:\s=]+(\d+\.?\d*)\s*m?/i) ||
    t.match(/(?:average\s+)?depth[:\s=]+(\d+\.?\d*)\s*m?/i);
  if (depthM) result.depth = parseFloat(depthM[1]);

  /* 4. INFER depth from area/frontage if missing (area = frontage × depth) */
  if (result.area && result.frontage && !result.depth && result.frontage > 0) {
    const inferred = result.area / result.frontage;
    if (inferred > 5 && inferred < 300) result.depth = parseFloat(inferred.toFixed(1));
  }

  /* 5. LOT/PLAN REFERENCE */
  const lotM = t.match(/Lot\s+(\d+[A-Z]?)\s+(?:on\s+)?(?:PS|LP|TP|SP|CP|DP)\s*(\d+[A-Z]?)/i);
  if (lotM) {
    const planType = lotM[0].match(/\b(PS|LP|TP|SP|CP|DP)\b/i)?.[1]?.toUpperCase() || 'PS';
    result.lot = `Lot ${lotM[1].toUpperCase()} on ${planType}${lotM[2].toUpperCase()}`;
  }

  /* 6. EASEMENTS on plan */
  const eMatches = [...t.matchAll(/easement[^.\n]{0,150}/gi)];
  if (eMatches.length) {
    result.hasEasement = true;
    result.easementDesc = eMatches[0][0].trim().slice(0, 120);
    // Width in metres
    const widthM = eMatches[0][0].match(/(\d+\.?\d*)\s*m(?:etre|eter)?s?\b/i);
    if (widthM) {
      result.easementWidthM = widthM[1];
    } else {
      // Convert from links (old survey plans: 1 link = 0.201168 m)
      const widthLinks = eMatches[0][0].match(/(\d+\.?\d*)\s*links?/i);
      if (widthLinks) result.easementWidthM = String((parseFloat(widthLinks[1]) * 0.201168).toFixed(2));
    }
  }

  return result;
};
