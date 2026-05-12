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

  /* 1. ZONE DETECTION */
  const codeInParen = t.match(/\(\s*(NRZ|GRZ|RGZ|MUZ|C1Z|C2Z|LDRZ)\s*(\d+)?\s*\)/i);
  if (codeInParen) {
    result.zone = (codeInParen[1] + (codeInParen[2] || "")).toUpperCase();
  }

  if (!result.zone) {
    const codeSchedule = t.match(/\b(NRZ|GRZ|RGZ|MUZ|C1Z|C2Z|LDRZ)\s*[-]?\s*Schedule\s+(\d+)/i) ||
      t.match(/Schedule\s+(\d+)\s*[-]?\s*(?:to\s+the\s+)?(NRZ|GRZ|RGZ|MUZ|C1Z|C2Z|LDRZ)/i);
    if (codeSchedule) {
      const code = codeSchedule[1].length <= 4 ? codeSchedule[1] : codeSchedule[2];
      const sched = codeSchedule[1].length <= 4 ? codeSchedule[2] : codeSchedule[1];
      result.zone = (code + sched).toUpperCase();
    }
  }

  if (!result.zone) {
    const codeAlone = t.match(/\b(NRZ\d+|GRZ\d+|RGZ\d+|NRZ|GRZ|RGZ|MUZ|C1Z|C2Z|LDRZ)\b/i);
    if (codeAlone) result.zone = codeAlone[1].toUpperCase();
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
      { rx: /Aboriginal\s+Cultural\s+Heritage\s+Overlay|\bACHO\b/i, flag: "hasAboriginal", label: "Aboriginal Cultural Heritage Overlay (ACHO)" },
      { rx: /Geotechnical\s+Overlay|Landslip\s+Overlay|\bEMO\s*\d*\b|Erosion\s+Management\s+Overlay/i, flag: "hasGeo", label: "Geotechnical/Erosion Overlay (EMO)" },
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
  const lotM = t.match(/Lot\s+(\d+)\s+(?:on\s+)?(?:LP|PS|TP|SP|CP)\s*(\d+)/i);
  if (lotM) result.lot = `Lot ${lotM[1]} on ${lotM[0].match(/\\bPS\\b/i) ? "PS" : "LP"}${lotM[2]}`;

  /* 8. PROPERTY ADDRESS */
  const addrM = t.match(/\\b(\\d{1,4}[A-Z]?)\\s+([A-Za-z][A-Za-z\\s'-]{2,40}(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Way|Lane|Ln|Boulevard|Blvd|Crescent|Cres|Close|Cl|Grove|Gr|Terrace|Tce)[.]?)\\s*[,\\s]+([A-Za-z][A-Za-z\\s]{2,30})\\s+VIC\\s+(\\d{4})/i);
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

export const parseSection32Text = (text) => {
  if (!text || !text.trim()) return null;
  const t = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
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
    covenantDocNums: []
  };

  if (/single[\s-]dwelling\s+covenant|no\s+subdivision|one\s+dwelling\s+only|restricted\s+to\s+one\s+dwelling|one\s+private\s+dwelling/i.test(t)) {
    result.hasSingleCovenant = true;
    result.covenantDesc = "Single dwelling covenant  restricts to one private dwelling";
  } else {
    const covM = t.match(/(?:restrictive\s+)?covenant[^.;\n]{0,200}/i);
    if (covM) { result.covenantDesc = covM[0].trim().slice(0, 150) + (covM[0].length > 150 ? "" : ""); }
  }

  const mcpM = t.match(/(?:memorandum\s+of\s+common\s+provisions?|\bMCP\b|common\s+provisions?)[^.;\n]{0,200}/i);
  if (mcpM) { result.hasMCP = true; result.mcpDesc = mcpM[0].trim().slice(0, 150) + (mcpM[0].length > 150 ? "" : ""); }

  if (!result.hasSingleCovenant && /restrictive\s+covenant|registered\s+covenant|restrictive\s+agreement/i.test(t)) {
    result.hasRestrictiveCovenant = true;
    const rcM = t.match(/restrictive\s+covenant[^.;\n]{0,200}/i);
    if (rcM && !result.covenantDesc) result.restrictiveCovenantDesc = rcM[0].trim().slice(0, 150) + (rcM[0].length > 150 ? "" : "");
  }

  const eM = t.match(/easement[^.;\n]{0,150}/i);
  if (eM) {
    result.hasEasement = true;
    result.easementDesc = eM[0].trim().slice(0, 120);
    const widthM = eM[0].match(/(\d+\.?\d*)\s*m(?:etre|eter)?s?\b/i) || eM[0].match(/(\d+\.?\d*)\s*m\b/);
    if (widthM) result.easementWidthM = widthM[1];
    const widthLinks = eM[0].match(/(\d+\.?\d*)\s*links?/i);
    if (widthLinks && !result.easementWidthM) result.easementWidthM = String((parseFloat(widthLinks[1]) * 0.201168).toFixed(2));
  }

  if (/section\s+173|s\.?\s*173\s+agreement/i.test(t)) {
    result.hasS173 = true;
    const s173M = t.match(/section\s+173[^.;\n]{0,200}/i);
    if (s173M) result.s173Desc = s173M[0].trim().slice(0, 150) + (s173M[0].length > 150 ? "" : "");
  }

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

  const mortM = t.match(/(?:mortgage|charge)[^.;\n]{0,150}/i);
  if (mortM && !/no\s+mortgage|no\s+charge/i.test(mortM[0])) {
    result.hasMortgage = true;
    result.mortgageDesc = mortM[0].trim().slice(0, 120) + (mortM[0].length > 120 ? "" : "");
  }

  const encM = t.match(/encumbrance[^.;\n]{0,150}/i);
  if (encM) { result.hasEncumbrance = true; result.encumbranceDesc = encM[0].trim().slice(0, 120); }

  const vendorM = t.match(/(?:vendor|owner|registered\s+proprietor)[:\s]+([A-Z][A-Za-z\s'-]{3,60})(?:\n|,|\()/i);
  if (vendorM) result.vendorName = vendorM[1].trim();

  const ctM = t.match(/(?:Volume|Vol\.?)\s+(\d+)\s+(?:Folio|Fol\.?)\s+(\d+)/i);
  if (ctM) { result.titleVolume = ctM[1]; result.titleFolio = ctM[2]; }

  const svcSection = t.match(/(?:services?|utilities|connections?)[:\s-]+([^\n]{0,600})/i)?.[1] || t;
  const parseService = (rx) => {
    const m = svcSection.match(rx);
    if (!m) return "";
    const after = (svcSection.slice(svcSection.search(rx)).match(/(?:yes|no|connected|not\s+connected|available|unavailable)/i) || [""])[0];
    return after ? after.replace(/not\s+connected|unavailable/i, "No").replace(/connected|available|yes/i, "Yes") : "";
  };
  result.servicesElec = parseService(/electricity/i) || (/electricity[^.]{0,50}yes/i.test(t) ? "Yes" : /electricity[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesGas = parseService(/\bgas\b/i) || (/\bgas[^.]{0,50}yes/i.test(t) ? "Yes" : /\bgas[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesWater = parseService(/water/i) || (/water[^.]{0,50}yes/i.test(t) ? "Yes" : /water[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesSewer = parseService(/sewer(?:age)?/i) || (/sewer[^.]{0,50}yes/i.test(t) ? "Yes" : /sewer[^.]{0,50}no\b/i.test(t) ? "No" : "");
  result.servicesTel = parseService(/telephone|telecommunications?|nbn/i) || (/(?:telephone|nbn)[^.]{0,50}yes/i.test(t) ? "Yes" : /(?:telephone|nbn)[^.]{0,50}no\b/i.test(t) ? "No" : "");

  const crM = t.match(/council\s+rates?[:\s$]+(\d[\d,]*\.?\d*)\s*(?:per\s+annum|p\.?a\.?|\/yr|\/year|per\s+quarter|per\s+qtr)?/i);
  if (crM) result.councilRatesAmt = crM[1].replace(/,/g, "");
  const wrM = t.match(/water\s+(?:rates?|charges?)[:\s$]+(\d[\d,]*\.?\d*)/i);
  if (wrM) result.waterRatesAmt = wrM[1].replace(/,/g, "");
  const ltM = t.match(/land\s+tax[:\s$]+(\d[\d,]*\.?\d*)/i);
  if (ltM) result.landTaxAmt = ltM[1].replace(/,/g, "");

  const ppM = t.match(/planning\s+permit[:\s#]+([A-Z0-9\/-]{4,20})/i);
  if (ppM) { result.hasPermit = true; result.permitNo = ppM[1]; }
  const ppDesc = t.match(/permit(?:ted)?\s+(?:for|to)[:\s]+([^.;\n]{0,100})/i);
  if (ppDesc) result.permitDesc = ppDesc[1].trim().slice(0, 80);

  const _docNums = [...t.matchAll(/\b(?:Dealing|Instrument|Document|Registration|Reference)\s+No\.?\s*([A-Z]\d{5,8})\b/gi)];
  _docNums.forEach(m => { const n = m[1]; if (!result.covenantDocNums.includes(n)) result.covenantDocNums.push(n); });
  const _standaloneNums = [...t.matchAll(/\b([DTE]\d{6,8})\b/g)];
  _standaloneNums.forEach(m => { const n = m[1]; if (!result.covenantDocNums.includes(n) ) result.covenantDocNums.push(n); });

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
