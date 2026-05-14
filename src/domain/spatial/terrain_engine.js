/**
 * @file domain/spatial/terrain_engine.js
 * @description Sovereign Spatial Analysis Engine — parcel dimension + elevation orchestrator.
 * @version 6.0.0 - Task #82: split OSM fetchers → osm_fetcher.js, Vicmap → vicmap_fetcher.js
 *
 * Data source priority for parcel geometry:
 *   1. OSM element by ID  (osm_fetcher.js: fetchOSMById)
 *   2. OSM cadastral query (osm_fetcher.js: fetchOSMCadastral)
 *   3+4. Vicmap GeoServer WFS (vicmap_fetcher.js: fetchVicmapWFS)
 *   5. OSM containing polygon (osm_fetcher.js: fetchOSMContaining)
 *   6. Smart suburb-aware estimate (suburb_lookup.js: makeSmartFallback)
 * Elevation: OpenTopoData SRTM 30m — 5-point grid
 */

import * as turf from 'https://cdn.skypack.dev/@turf/turf';
import { ENV } from '../../core/config/env_config.js';
import { safePositiveRound, safeNum, clamp } from '../../core/utils/num_guard.js';
import { fetchOSMById, fetchOSMCadastral, fetchOSMContaining } from './osm_fetcher.js';
import { fetchVicmapWFS } from './vicmap_fetcher.js';

// ---------------------------------------------------------------------------
// Source 6: Smart suburb-aware estimate
// Lookup table covers 50+ Melbourne suburbs with typical lot dimensions.
// Falls back to CBD-distance bands for unknown suburbs.
// ---------------------------------------------------------------------------
const SUBURB_LOT_TABLE = {
  // INNER (0-5km) — Victorian-era terrace/semi (very narrow)
  'fitzroy':       [6,  28], 'collingwood':   [6,  28], 'richmond':      [7,  28],
  'carlton':       [7,  30], 'north carlton': [7,  30], 'northcote':     [8,  30],
  'prahran':       [8,  32], 'south yarra':   [9,  35], 'toorak':        [15, 45],
  'st kilda':      [8,  32], 'st kilda east': [9,  33], 'port melbourne': [8, 30],
  'south melbourne':[8, 30], 'albert park':   [9,  32], 'windsor':       [7,  28],
  'abbotsford':    [7,  28], 'cremorne':      [7,  26], 'east melbourne': [8,  30],
  'west melbourne': [8, 28], 'flemington':    [9,  30], 'kensington':    [8,  30],
  'fitzroy north': [8,  30], 'brunswick':     [10, 32], 'coburg':        [12, 38],

  // INNER-MIDDLE (5-12km) — post-war California bungalow era
  'hawthorn':      [12, 40], 'camberwell':    [14, 45], 'glen iris':     [14, 45],
  'malvern':       [13, 42], 'malvern east':  [14, 44], 'caulfield':     [14, 42],
  'brighton':      [16, 50], 'sandringham':   [16, 48], 'elwood':        [11, 36],
  'glen waverley': [15, 45], 'doncaster':     [16, 48], 'box hill':      [14, 44],
  'balwyn':        [14, 44], 'kew':           [14, 45], 'ivanhoe':       [13, 42],
  'heidelberg':    [14, 44], 'reservoir':     [13, 40], 'preston':       [12, 38],
  'thornbury':     [10, 32], 'coburg north':  [12, 38], 'pascoe vale':   [12, 38],
  'footscray':     [10, 32], 'yarraville':    [10, 32], 'seddon':        [10, 32],
  'sunshine':      [14, 42], 'altona':        [15, 45],

  // MIDDLE (12-25km) — 1960s-80s brick veneer
  'ringwood':      [16, 48], 'croydon':       [16, 48], 'blackburn':     [16, 48],
  'nunawading':    [16, 46], 'mitcham':       [15, 46], 'vermont':       [16, 48],
  'moorabbin':     [15, 45], 'bentleigh':     [14, 44], 'cheltenham':    [15, 46],
  'mentone':       [15, 46], 'mordialloc':    [15, 46], 'parkdale':      [15, 46],
  'dandenong':     [16, 48], 'springvale':    [15, 45], 'keysborough':   [16, 48],
  'endeavour hills':[16,48], 'rowville':      [16, 48], 'ferntree gully':[16,48],
  'templestowe':   [16, 50], 'warrandyte':    [20, 55], 'eltham':        [18, 52],
  'montmorency':   [16, 48], 'greensborough': [16, 48], 'bundoora':      [16, 48],
  'watsonia':      [16, 46], 'macleod':       [16, 46],

  // OUTER (25-40km+) — post-2000 estate lots
  'pakenham':      [14, 35], 'officer':       [14, 32], 'berwick':       [15, 40],
  'narre warren':  [14, 38], 'cranbourne':    [14, 38], 'frankston':     [16, 46],
  'langwarrin':    [18, 50], 'carrum downs':  [14, 38], 'hallam':        [14, 38],
  'sunbury':       [18, 50], 'craigieburn':   [14, 32], 'epping':        [14, 35],
  'doreen':        [14, 32], 'mernda':        [14, 32], 'south morang':  [14, 32],
  'werribee':      [16, 42], 'hoppers crossing':[15,40],'point cook':    [14, 36],
  'truganina':     [14, 32], 'tarneit':       [14, 32], 'wyndham vale':  [14, 32],
  'melton':        [15, 38], 'caroline springs':[14,34],

  // MANNINGHAM LGA — target development area
  'doncaster east':[16, 48], 'templestowe lower':[15,46], 'warrandyte south':[18,50],
  'park orchards': [22, 60], 'christmas hills':[25,70],
};

const makeSmartFallback = (lat, lon, suburb = '') => {
  const suburbKey = suburb.toLowerCase().trim().replace(/\s+(vic|victoria)\s*\d*/i, '').trim();
  let frontageM, depthM;

  if (suburbKey && SUBURB_LOT_TABLE[suburbKey]) {
    [frontageM, depthM] = SUBURB_LOT_TABLE[suburbKey];
  } else {
    const partialKey = Object.keys(SUBURB_LOT_TABLE).find(k => suburbKey.includes(k) || k.includes(suburbKey));
    if (partialKey) {
      [frontageM, depthM] = SUBURB_LOT_TABLE[partialKey];
    } else {
      const cbdLat = -37.8183, cbdLon = 144.9671;
      const distKm = Math.sqrt(
        Math.pow((lat - cbdLat) * 111, 2) +
        Math.pow((lon - cbdLon) * 111 * Math.cos(cbdLat * Math.PI / 180), 2)
      );
      if      (distKm < 3)  { frontageM = 6;  depthM = 28; }
      else if (distKm < 7)  { frontageM = 9;  depthM = 33; }
      else if (distKm < 12) { frontageM = 12; depthM = 40; }
      else if (distKm < 20) { frontageM = 14; depthM = 45; }
      else if (distKm < 30) { frontageM = 16; depthM = 48; }
      else                  { frontageM = 14; depthM = 35; }
    }
  }

  const dLon = (frontageM / 2) / (111320 * Math.cos(lat * Math.PI / 180));
  const dLat = (depthM    / 2) / 111320;
  const coords = [
    [lon - dLon, lat - dLat], [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat], [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
  return { polygon: turf.polygon([coords]), source: 'ESTIMATED', frontage: frontageM, depth: depthM };
};

// ---------------------------------------------------------------------------
// Elevation: OpenTopoData SRTM 30m — 5-point grid around target coordinate
// ---------------------------------------------------------------------------
const fetchRealElevation = async (lat, lon) => {
  const offset = 0.00022;
  const points = [
    [lat, lon], [lat + offset, lon], [lat - offset, lon],
    [lat, lon + offset], [lat, lon - offset],
  ];
  const locStr = points.map(p => p.join(',')).join('|');
  try {
    const endpoint = (ENV.spatial && ENV.spatial.openTopoData) ||
                     'https://api.opentopodata.org/v1/srtm30m';
    const resp = await fetch(endpoint + '?locations=' + locStr, {
      signal: AbortSignal.timeout(10000),
    });
    if (!resp.ok) throw new Error('OpenTopoData HTTP ' + resp.status);
    const json = await resp.json();
    const elevs = (json.results || []).map(r => typeof r.elevation === 'number' ? r.elevation : null).filter(v => v !== null);
    if (elevs.length < 5) throw new Error('Incomplete elevation data');

    const [ctr, n, s, e, w] = elevs;
    const distM = 24;
    const slopePct = Math.round(Math.sqrt(
      ((n - s) / (distM * 2)) ** 2 + ((e - w) / (distM * 2)) ** 2
    ) * 100);
    const delta = Math.round((Math.max(...elevs) - Math.min(...elevs)) * 10) / 10;

    const maxElev = Math.max(n, s, e, w);
    let aspect = 'Flat';
    if (delta > 0.3) {
      if      (maxElev === n) aspect = 'South-facing';
      else if (maxElev === s) aspect = 'North-facing';
      else if (maxElev === e) aspect = 'West-facing';
      else if (maxElev === w) aspect = 'East-facing';
    }

    return { centerElevation: Math.round(ctr * 10) / 10, slope: slopePct, elevationDelta: delta, aspect };
  } catch (e) {
    console.warn('[terrain] Elevation failed:', e.message);
    return { centerElevation: null, slope: null, elevationDelta: null, aspect: 'Unknown' };
  }
};

// ---------------------------------------------------------------------------
// deriveDimensions — minimum bounding rectangle (MBR) at 2° rotation steps
// v5: 2° steps reduce max angular error to ~0.7m vs 1.7m at 5° steps.
// Convention: shorter side = frontage, longer side = depth.
// ---------------------------------------------------------------------------
const deriveDimensions = (polygon, knownFrontage = null, knownDepth = null) => {
  const area = turf.area(polygon);
  let bestFrontage = null, bestDepth = null, minBoxArea = Infinity;
  const pivot = turf.centroid(polygon);

  for (let angleDeg = 0; angleDeg < 90; angleDeg += 2) {
    try {
      const rotated = turf.transformRotate(polygon, angleDeg, { pivot });
      const bbox    = turf.bbox(rotated);
      const w = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'meters' });
      const h = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' });
      const boxArea = w * h;
      if (boxArea < minBoxArea) {
        minBoxArea   = boxArea;
        bestFrontage = Math.min(w, h);
        bestDepth    = Math.max(w, h);
      }
    } catch {}
  }

  const safeArea    = safePositiveRound(area);
  const frontageRaw = knownFrontage || Math.round((bestFrontage || Math.sqrt(safeArea * 0.35)) * 10) / 10;
  const frontage    = clamp(safeNum(frontageRaw), 3, 100, 10);
  const depthRaw    = knownDepth    || Math.round((bestDepth    || safeArea / Math.max(frontage, 1)) * 10) / 10;
  const depth       = clamp(safeNum(depthRaw),    8, 300, 25);

  return { area: safeArea, frontage, depth };
};

// ---------------------------------------------------------------------------
// calculateSovereignYield — spatial deduction waterfall (used by synthesis_engine)
// ---------------------------------------------------------------------------
export const calculateSovereignYield = (sitePolygon, constraints) => {
  let currentPolygon = sitePolygon;
  const waterfall    = [];
  const totalArea    = turf.area(sitePolygon);
  waterfall.push({ label: 'Total Site Area', value: totalArea, polygon: currentPolygon });

  const setbackDist = constraints.setbacks?.average || 3.0;
  let setbackPoly;
  try { setbackPoly = turf.buffer(sitePolygon, -setbackDist, { units: 'meters' }); } catch {}

  if (setbackPoly) {
    const areaAfterSetbacks = turf.area(setbackPoly);
    waterfall.push({
      label: 'Setbacks (' + setbackDist + ' m)',
      deduction: totalArea - areaAfterSetbacks,
      remaining: areaAfterSetbacks,
      polygon: setbackPoly,
    });
    currentPolygon = setbackPoly;
  }

  if (constraints.easements?.length > 0) {
    const prevArea = turf.area(currentPolygon);
    constraints.easements.forEach(e => {
      const b    = turf.bbox(sitePolygon);
      const ePoly = turf.bboxPolygon([b[0], b[3] - (e.width || 3), b[2], b[3]]);
      if (ePoly && currentPolygon) {
        try { currentPolygon = turf.difference(currentPolygon, ePoly) || currentPolygon; } catch {}
      }
    });
    waterfall.push({
      label: 'Easements',
      deduction: prevArea - turf.area(currentPolygon),
      remaining: turf.area(currentPolygon),
      polygon: currentPolygon,
    });
  }

  if (constraints.tpz?.length > 0) {
    const prevArea = turf.area(currentPolygon);
    constraints.tpz.forEach(t => {
      const center = turf.centroid(sitePolygon);
      let tpzPoly;
      try { tpzPoly = turf.buffer(center, (t.radius || 5) / 2, { units: 'meters' }); } catch {}
      if (tpzPoly && currentPolygon) {
        try { currentPolygon = turf.difference(currentPolygon, tpzPoly) || currentPolygon; } catch {}
      }
    });
    waterfall.push({
      label: 'Tree Protection Zone (TPZ)',
      deduction: prevArea - turf.area(currentPolygon),
      remaining: turf.area(currentPolygon),
      polygon: currentPolygon,
    });
  }

  return {
    waterfall,
    effectiveArea: turf.area(currentPolygon),
    finalPolygon:  currentPolygon,
  };
};

// ---------------------------------------------------------------------------
// runSiteInvestigation — main public entry point
// osmType + osmId: from geocoder (enables Source 1 fast path)
// suburb: from geocoder address components (improves Source 6 fallback accuracy)
// ---------------------------------------------------------------------------
export const runSiteInvestigation = async (lat, lon, osmType = null, osmId = null, suburb = '') => {
  const latF  = parseFloat(lat);
  const lonF  = parseFloat(lon);
  const osmIdN = osmId ? parseInt(osmId, 10) : null;

  const [parcelResult, elevData] = await Promise.all([
    (async () => {
      let r = null;
      if (osmType && osmIdN)    r = await fetchOSMById(osmType, osmIdN);   // Source 1
      if (!r)                   r = await fetchOSMCadastral(latF, lonF);    // Source 2
      if (!r)                   r = await fetchVicmapWFS(latF, lonF);       // Source 3+4
      if (!r)                   r = await fetchOSMContaining(latF, lonF);   // Source 5
      if (!r)                   r = makeSmartFallback(latF, lonF, suburb);  // Source 6
      return r;
    })(),
    fetchRealElevation(latF, lonF),
  ]);

  const { polygon, source, frontage: knownF, depth: knownD, lotArea } = parcelResult;

  let dims = deriveDimensions(polygon, knownF, knownD);
  if (lotArea && (source === 'VICMAP' || source === 'ESTIMATED')) {
    dims.area = Math.round(lotArea);
  }

  const isEstimate = source === 'ESTIMATED' || source === 'OSM_BUILDING';

  console.log('[terrain] Final source:', source,
    '| area:', dims.area, 'm²',
    '| frontage:', dims.frontage, 'm',
    '| depth:', dims.depth, 'm');

  return {
    polygon,
    dataSource:      source,
    isEstimate,
    metrics: {
      landArea: safePositiveRound(dims.area),
      frontage: clamp(safeNum(dims.frontage), 3, 100, 10),
      depth:    clamp(safeNum(dims.depth),    8, 300, 25),
    },
    slope:           elevData.slope          != null ? clamp(safeNum(elevData.slope),         0, 100, 0) : null,
    aspect:          elevData.aspect         || 'Unknown',
    elevationDelta:  elevData.elevationDelta != null ? clamp(safeNum(elevData.elevationDelta), 0,  50, 0) : null,
    centerElevation: elevData.centerElevation!= null ? safeNum(elevData.centerElevation)                 : null,
  };
};
