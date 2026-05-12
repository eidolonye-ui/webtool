/**
 * @file domain/spatial/terrain_engine.js
 * @description Sovereign Spatial Analysis Engine — accurate parcel dimensions.
 * @version 4.0.0
 *
 * Data source priority for parcel geometry:
 *   1. OSM element by ID (way/relation, SKIPS buildings — only lot/land elements)
 *   2. OSM Overpass cadastral — ways tagged landuse/boundary=cadastral near the point
 *   3. Vicmap GeoServer WFS — CONTAINS filter (more reliable than INTERSECTS for points)
 *   4. Vicmap GeoServer WFS — DWITHIN 1m fallback
 *   5. OSM Overpass containing polygon — non-building lots preferred over building footprints
 *   6. Smart suburb-aware estimate — lookup table for 50+ Melbourne suburbs
 *
 * Elevation: OpenTopoData SRTM 30m (5-point grid)
 *
 * Key fixes in v4:
 *   - Source 1: reject OSM elements with building tags (was using building footprint as lot)
 *   - Source 2: NEW dedicated cadastral Overpass query
 *   - Source 3-4: fix WFS CQL filter (INTERSECTS → CONTAINS/DWITHIN)
 *   - Source 5: prefer non-building polygons in sort order
 *   - Source 6: 50-suburb lookup table replacing 5-band CBD-distance estimate
 *   - Removed: fake Vicmap ArcGIS URL (services6.arcgis.com — was 404 always)
 */

import * as turf from 'https://cdn.skypack.dev/@turf/turf';
import { ENV } from '../../core/config/env_config.js';

// ---------------------------------------------------------------------------
// Overpass mirror list
// ---------------------------------------------------------------------------
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// ---------------------------------------------------------------------------
// Tags that indicate an OSM way is a LOT/LAND boundary (not a building)
// ---------------------------------------------------------------------------
const LOT_TAGS = new Set(['landuse', 'land_use', 'boundary', 'cadastre', 'lot', 'parcel']);
const BUILDING_TAGS = new Set(['building', 'building:part', 'amenity', 'shop', 'office']);

const isLotWay = (tags = {}) => {
  // Explicit lot-type tags
  for (const t of LOT_TAGS) if (t in tags) return true;
  // Has address without building tag
  if ('addr:housenumber' in tags && !('building' in tags)) return true;
  return false;
};

const isBuildingWay = (tags = {}) => {
  for (const t of BUILDING_TAGS) if (t in tags) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Helper: build GeoJSON polygon from OSM way nodes
// ---------------------------------------------------------------------------
const osmWayToPolygon = (way, nodeMap) => {
  if (!way.nodes || way.nodes.length < 3) return null;
  const coords = way.nodes.map(id => nodeMap[id]).filter(Boolean);
  if (coords.length < 3) return null;
  if (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1]) {
    coords.push(coords[0]);
  }
  try { return turf.polygon([coords]); } catch { return null; }
};

// ---------------------------------------------------------------------------
// Source 1: OSM element by ID
// FIX v4: reject elements tagged as buildings — use only lot/land ways
// ---------------------------------------------------------------------------
const fetchOSMById = async (osmType, osmId) => {
  if (!osmType || !osmId || osmType === 'node') return null;

  const q = osmType === 'relation'
    ? `[out:json][timeout:15];relation(${osmId});out body tags;>;out skel qt;`
    : `[out:json][timeout:12];way(${osmId});out body tags;>;out skel qt;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const resp = await fetch(mirror + '?data=' + encodeURIComponent(q), {
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      const elements = json.elements || [];

      const nodeMap = {};
      elements.filter(e => e.type === 'node').forEach(n => {
        nodeMap[n.id] = [n.lon, n.lat];
      });

      let way = null;
      if (osmType === 'relation') {
        const rel = elements.find(e => e.type === 'relation');
        if (!rel) continue;
        const outerRef = rel.members?.find(m => m.type === 'way' && m.role === 'outer');
        if (!outerRef) continue;
        way = elements.find(e => e.type === 'way' && e.id === outerRef.ref);
      } else {
        way = elements.find(e => e.type === 'way' && e.id === Number(osmId));
      }
      if (!way) continue;

      // FIX v4: skip building footprints — they are NOT lot boundaries
      if (isBuildingWay(way.tags || {})) {
        console.log('[terrain] OSM by ID: element is a building footprint — skipping, will use parcel sources');
        return null;
      }

      const poly = osmWayToPolygon(way, nodeMap);
      if (!poly) continue;

      const area = Math.round(turf.area(poly));
      // Sanity check: residential lots are typically 80–8000 m²
      if (area < 50 || area > 20000) {
        console.log('[terrain] OSM by ID: area', area, 'm² out of plausible range — skipping');
        return null;
      }

      console.log('[terrain] OSM by ID success:', osmType, osmId, '| area:', area, 'm²');
      return { polygon: poly, source: 'OSM_ID' };
    } catch (e) {
      console.warn('[terrain] OSM by ID mirror failed:', e.message);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Source 2 (NEW): OSM Overpass — dedicated cadastral/landuse query
// Queries specifically for land boundary elements, not buildings
// Returns smallest plausible residential lot containing the point
// ---------------------------------------------------------------------------
const fetchOSMCadastral = async (lat, lon) => {
  // Two-pass: first look for explicitly tagged lot/cadastral ways, then landuse
  const q = `[out:json][timeout:18];
(
  way["boundary"="cadastral"](around:60,${lat},${lon});
  way["landuse"="residential"](around:60,${lat},${lon});
  way["landuse"="meadow"](around:60,${lat},${lon});
  way["landuse"="farmyard"](around:60,${lat},${lon});
  way["lot"](around:60,${lat},${lon});
);
out body tags;>;out skel qt;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const resp = await fetch(mirror + '?data=' + encodeURIComponent(q), {
        signal: AbortSignal.timeout(18000),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      const elements = json.elements || [];

      const nodeMap = {};
      elements.filter(e => e.type === 'node').forEach(n => {
        nodeMap[n.id] = [n.lon, n.lat];
      });

      const point = turf.point([lon, lat]);
      const candidates = [];

      for (const way of elements.filter(e => e.type === 'way')) {
        const poly = osmWayToPolygon(way, nodeMap);
        if (!poly) continue;
        try {
          const area = turf.area(poly);
          // For residential parcels: 80–5000 m²
          if (area < 80 || area > 8000) continue;
          if (turf.booleanPointInPolygon(point, poly)) {
            candidates.push({ poly, area, tags: way.tags || {} });
          }
        } catch {}
      }

      if (!candidates.length) continue;
      candidates.sort((a, b) => a.area - b.area);

      console.log('[terrain] OSM Cadastral: found lot', Math.round(candidates[0].area), 'm²', JSON.stringify(candidates[0].tags).slice(0, 60));
      return { polygon: candidates[0].poly, source: 'OSM_CADASTRAL' };
    } catch (e) {
      console.warn('[terrain] OSM Cadastral query failed:', e.message);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Source 3 & 4: Vicmap GeoServer WFS — fixed coordinate axis order
//
// ROOT CAUSE of v4 failure: GeoServer WFS 2.0.0 with EPSG:4326 mandates
// LATITUDE-FIRST axis order per the EPSG spec.  We were sending POINT(lon lat),
// which puts Melbourne (144.97, -37.82) at (144.97°N, -37.82°E) ≈ Mongolia.
// No Victorian parcel will ever match that.
//
// Fix strategy — try every permutation:
//   A) CRS:84 (urn:ogc:def:crs:OGC:1.3:CRS84) + POINT(lon lat)
//      CRS:84 mandates lon,lat axis order — most reliable for lon,lat input data
//   B) EPSG:4326 + POINT(lat lon)
//      Spec-compliant lat,lon axis order for EPSG:4326
//   C) WFS 1.0.0 + EPSG:4326 + POINT(lon lat)
//      WFS 1.0.0 always uses x,y = lon,lat regardless of CRS
//   D) DWITHIN 5m buffer (catches boundary/rounding edge cases)
// ---------------------------------------------------------------------------
const fetchVicmapWFS = async (lat, lon) => {
  const baseUrl = 'https://opendata.maps.vic.gov.au/geoserver/datavic/wfs';

  // Layer preference: MP (multipolygon) variant first, then regular
  const LAYERS = [
    { type: 'datavic:VMPROP_PROPERTY_MP',    geomCol: 'SHAPE' },
    { type: 'datavic:VMPROP_PROPERTY',        geomCol: 'SHAPE' },
    { type: 'datavic:VMPROP_LAND_PARCEL_MP',  geomCol: 'SHAPE' },
    { type: 'datavic:VMPROP_PROPERTY',        geomCol: 'shape' },
  ];

  // Axis-order permutations — exhaustive coverage of server configurations
  const AXIS_OPTS = [
    // Option A: CRS:84 + lon,lat — the safest
    { srs: 'urn:ogc:def:crs:OGC:1.3:CRS84', pt: `POINT(${lon} ${lat})`, ver: '2.0.0' },
    // Option B: EPSG:4326 + lat,lon — spec-compliant
    { srs: 'EPSG:4326', pt: `POINT(${lat} ${lon})`, ver: '2.0.0' },
    // Option C: WFS 1.0.0 always lon,lat
    { srs: 'EPSG:4326', pt: `POINT(${lon} ${lat})`, ver: '1.0.0' },
    // Option D: DWITHIN 5m — survives boundary/rounding cases, CRS:84
    { srs: 'urn:ogc:def:crs:OGC:1.3:CRS84', pt: `POINT(${lon} ${lat})`, ver: '2.0.0', dwithin: 5 },
  ];

  const processGeoJSON = (gj, geomCol) => {
    const features = (gj.features || []).filter(f =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    );
    if (!features.length) return null;
    const feat = features[0];

    const lotAreaAttr =
      feat.properties?.LOT_AREA   || feat.properties?.lot_area    ||
      feat.properties?.SHAPE_AREA || feat.properties?.shape_area  ||
      feat.properties?.AREA       || feat.properties?.area_m2;

    let poly;
    try {
      poly = feat.geometry.type === 'MultiPolygon'
        ? turf.multiPolygon(feat.geometry.coordinates)
        : turf.polygon(feat.geometry.coordinates);
    } catch { return null; }

    // Verify point containment — reject if polygon is clearly wrong location
    try {
      const innerPoly = feat.geometry.type === 'MultiPolygon'
        ? turf.polygon(feat.geometry.coordinates[0])
        : poly;
      if (!turf.booleanPointInPolygon(turf.point([lon, lat]), innerPoly)) {
        // Some servers return lat,lon in GeoJSON — flip coords and retry
        const flippedCoords = feat.geometry.coordinates[0]?.map(ring =>
          Array.isArray(ring[0]) ? ring.map(([a, b]) => [b, a]) : [ring[1], ring[0]]
        );
        if (flippedCoords) {
          try {
            const flippedPoly = turf.polygon([flippedCoords]);
            if (turf.booleanPointInPolygon(turf.point([lon, lat]), flippedPoly)) {
              poly = flippedPoly;
            } else {
              return null; // Can't rescue this feature
            }
          } catch { return null; }
        } else { return null; }
      }
    } catch {} // booleanPointInPolygon can throw for complex polygons — proceed

    const area = lotAreaAttr
      ? parseFloat(lotAreaAttr)
      : Math.round(turf.area(poly));

    // Sanity check: reject impossibly small or large lots
    if (area < 30 || area > 100000) return null;

    return { polygon: poly, area };
  };

  for (const { type, geomCol } of LAYERS) {
    for (const { srs, pt, ver, dwithin } of AXIS_OPTS) {
      let cql;
      if (dwithin) {
        cql = `DWITHIN(${geomCol},${pt},${dwithin},meters)`;
      } else {
        // Try INTERSECTS first (works when point is inside polygon)
        cql = `INTERSECTS(${geomCol},${pt})`;
      }

      const url = baseUrl +
        `?SERVICE=WFS&VERSION=${ver}&REQUEST=GetFeature` +
        `&typeNames=${encodeURIComponent(type)}` +
        `&outputFormat=application/json` +
        `&srsName=${encodeURIComponent(srs)}` +
        `&count=3` +
        `&CQL_FILTER=${encodeURIComponent(cql)}`;

      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(14000) });
        if (!resp.ok) continue;
        const gj = await resp.json();
        const result = processGeoJSON(gj, geomCol);
        if (result) {
          console.log('[terrain] Vicmap WFS ✓', type, ver, srs, '| area:', result.area, 'm²');
          return { polygon: result.polygon, source: 'VICMAP', lotArea: result.area };
        }
      } catch (e) {
        // Only log on non-abort errors to reduce console noise
        if (e.name !== 'TimeoutError' && e.name !== 'AbortError') {
          console.warn('[terrain] Vicmap WFS failed:', type, ver, e.message?.slice(0, 60));
        }
      }

      // Try CONTAINS as well (same layer/axis config)
      if (!dwithin) {
        const cql2 = `CONTAINS(${geomCol},${pt})`;
        const url2 = baseUrl +
          `?SERVICE=WFS&VERSION=${ver}&REQUEST=GetFeature` +
          `&typeNames=${encodeURIComponent(type)}` +
          `&outputFormat=application/json` +
          `&srsName=${encodeURIComponent(srs)}` +
          `&count=3` +
          `&CQL_FILTER=${encodeURIComponent(cql2)}`;
        try {
          const resp2 = await fetch(url2, { signal: AbortSignal.timeout(14000) });
          if (resp2.ok) {
            const gj2 = await resp2.json();
            const result2 = processGeoJSON(gj2, geomCol);
            if (result2) {
              console.log('[terrain] Vicmap WFS (CONTAINS) ✓', type, ver, srs, '| area:', result2.area, 'm²');
              return { polygon: result2.polygon, source: 'VICMAP', lotArea: result2.area };
            }
          }
        } catch {}
      }
    }
  }
  console.warn('[terrain] Vicmap WFS: all attempts failed');
  return null;
};

// ---------------------------------------------------------------------------
// Source 5: OSM Overpass — any closed polygon containing the point
// FIX v4: sort order — non-building lots preferred over building footprints
// ---------------------------------------------------------------------------
const fetchOSMContaining = async (lat, lon) => {
  const q = `[out:json][timeout:18];way(around:40,${lat},${lon});out body tags;>;out skel qt;`;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const resp = await fetch(mirror + '?data=' + encodeURIComponent(q), {
        signal: AbortSignal.timeout(18000),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      const elements = json.elements || [];

      const nodeMap = {};
      elements.filter(e => e.type === 'node').forEach(n => {
        nodeMap[n.id] = [n.lon, n.lat];
      });

      const point = turf.point([lon, lat]);
      const candidates = [];

      for (const way of elements.filter(e => e.type === 'way')) {
        const poly = osmWayToPolygon(way, nodeMap);
        if (!poly) continue;
        try {
          const area = turf.area(poly);
          if (area < 30 || area > 50000) continue;
          if (turf.booleanPointInPolygon(point, poly)) {
            candidates.push({ poly, area, tags: way.tags || {}, isBuilding: isBuildingWay(way.tags || {}) });
          }
        } catch {}
      }

      if (!candidates.length) continue;

      // FIX v4: sort — non-buildings first, then smallest within each group
      candidates.sort((a, b) => {
        if (a.isBuilding !== b.isBuilding) return a.isBuilding ? 1 : -1;
        return a.area - b.area;
      });

      const best = candidates[0];

      if (best.isBuilding) {
        // Still a building — estimate lot from footprint using Melbourne coverage ratios
        // Coverage ratio by suburb type (distKm already computed below via fallback, use area heuristic)
        const bArea = best.area;
        // Melbourne typical building coverage: inner 60-85%, middle 40-60%, outer 25-40%
        // Approximate by footprint size: small footprints = inner (high coverage)
        const coverage = bArea < 100 ? 0.75 : bArea < 180 ? 0.65 : bArea < 280 ? 0.55 : 0.40;
        const estLotArea = bArea / coverage;
        const scale = Math.sqrt(estLotArea / bArea);
        let resultPoly = best.poly;
        try {
          const bufferDist = (scale - 1) * Math.sqrt(bArea / Math.PI);
          resultPoly = turf.buffer(best.poly, Math.min(bufferDist, 10), { units: 'meters' }) || best.poly;
        } catch {}
        console.log('[terrain] OSM building footprint: est lot via coverage ratio', (coverage * 100).toFixed(0) + '%', '→', Math.round(turf.area(resultPoly)), 'm²');
        return { polygon: resultPoly, source: 'OSM_BUILDING' };
      }

      console.log('[terrain] OSM containing lot:', Math.round(best.area), 'm²', JSON.stringify(best.tags).slice(0, 60));
      return { polygon: best.poly, source: 'OSM_LOT' };
    } catch (e) {
      console.warn('[terrain] Overpass containing search failed:', e.message);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Source 6: Smart suburb-aware estimate (replaces crude CBD-distance bands)
// Lookup table covers 50+ Melbourne suburbs with typical lot dimensions.
// Falls back to CBD-distance bands for unknown suburbs.
// ---------------------------------------------------------------------------

// Typical lot sizes: [frontageM, depthM] based on pre-war/post-war/modern subdivision era
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
};

const makeSmartFallback = (lat, lon, suburb = '') => {
  const suburbKey = suburb.toLowerCase().trim().replace(/\s+(vic|victoria)\s*\d*/i, '').trim();

  // Try exact suburb lookup
  let frontageM, depthM;
  if (suburbKey && SUBURB_LOT_TABLE[suburbKey]) {
    [frontageM, depthM] = SUBURB_LOT_TABLE[suburbKey];
    console.log('[terrain] Smart fallback: suburb lookup', suburbKey, '→', frontageM, '×', depthM);
  } else {
    // Partial match (e.g. "south morang" partial in address)
    const partialKey = Object.keys(SUBURB_LOT_TABLE).find(k => suburbKey.includes(k) || k.includes(suburbKey));
    if (partialKey) {
      [frontageM, depthM] = SUBURB_LOT_TABLE[partialKey];
      console.log('[terrain] Smart fallback: partial suburb match', partialKey, '→', frontageM, '×', depthM);
    } else {
      // CBD-distance band fallback
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
      console.log('[terrain] Smart fallback: CBD dist', distKm.toFixed(1), 'km →', frontageM, '×', depthM);
    }
  }

  const dLon = (frontageM / 2) / (111320 * Math.cos(lat * Math.PI / 180));
  const dLat = (depthM    / 2) / 111320;
  const coords = [
    [lon - dLon, lat - dLat],
    [lon + dLon, lat - dLat],
    [lon + dLon, lat + dLat],
    [lon - dLon, lat + dLat],
    [lon - dLon, lat - dLat],
  ];
  return { polygon: turf.polygon([coords]), source: 'ESTIMATED', frontage: frontageM, depth: depthM };
};

// ---------------------------------------------------------------------------
// Elevation: OpenTopoData SRTM 30m (5-point grid)
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
      if (maxElev === n) aspect = 'South-facing';
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
// Derive frontage + depth using minimum bounding rectangle
// ---------------------------------------------------------------------------
const deriveDimensions = (polygon, knownFrontage = null, knownDepth = null) => {
  const area = turf.area(polygon);

  let bestFrontage = null, bestDepth = null, minBoxArea = Infinity;

  for (let angleDeg = 0; angleDeg < 90; angleDeg += 5) {
    try {
      const rotated = turf.transformRotate(polygon, angleDeg, { pivot: turf.centroid(polygon) });
      const bbox = turf.bbox(rotated);
      const w = turf.distance([bbox[0], bbox[1]], [bbox[2], bbox[1]], { units: 'meters' });
      const h = turf.distance([bbox[0], bbox[1]], [bbox[0], bbox[3]], { units: 'meters' });
      const boxArea = w * h;
      if (boxArea < minBoxArea) {
        minBoxArea = boxArea;
        bestFrontage = Math.min(w, h);
        bestDepth    = Math.max(w, h);
      }
    } catch {}
  }

  const frontage = knownFrontage
    ? knownFrontage
    : Math.max(4, Math.min(80, Math.round((bestFrontage || Math.sqrt(area * 0.3)) * 10) / 10));
  const depth = knownDepth
    ? knownDepth
    : Math.max(8, Math.round((bestDepth || area / Math.max(frontage, 1)) * 10) / 10);

  return { area: Math.round(area), frontage, depth };
};

// ---------------------------------------------------------------------------
// calculateSovereignYield — used by synthesis_engine (unchanged contract)
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
      const b = turf.bbox(sitePolygon);
      const rearY = b[3];
      const ePoly = turf.bboxPolygon([b[0], rearY - (e.width || 3), b[2], rearY]);
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
    finalPolygon: currentPolygon,
  };
};

// ---------------------------------------------------------------------------
// Main entry point
// osmType + osmId: from Nominatim — enables Source 1
// suburb: from Nominatim address components — improves Source 6 fallback
// ---------------------------------------------------------------------------
export const runSiteInvestigation = async (lat, lon, osmType = null, osmId = null, suburb = '') => {
  const latF = parseFloat(lat);
  const lonF = parseFloat(lon);
  const osmIdN = osmId ? parseInt(osmId, 10) : null;

  const [parcelResult, elevData] = await Promise.all([
    (async () => {
      let r = null;

      // Source 1: OSM by ID (buildings rejected)
      if (osmType && osmIdN) r = await fetchOSMById(osmType, osmIdN);

      // Source 2: OSM dedicated cadastral query
      if (!r) r = await fetchOSMCadastral(latF, lonF);

      // Source 3+4: Vicmap WFS (CONTAINS + DWITHIN)
      if (!r) r = await fetchVicmapWFS(latF, lonF);

      // Source 5: OSM any containing polygon (non-buildings preferred)
      if (!r) r = await fetchOSMContaining(latF, lonF);

      // Source 6: Smart suburb-aware estimate
      if (!r) r = makeSmartFallback(latF, lonF, suburb);

      return r;
    })(),
    fetchRealElevation(latF, lonF),
  ]);

  const { polygon, source, frontage: knownF, depth: knownD, lotArea } = parcelResult;

  // If Vicmap returned a reliable LOT_AREA attribute, override computed area
  let dims;
  if (lotArea && (source === 'VICMAP' || source === 'ESTIMATED')) {
    dims = deriveDimensions(polygon, knownF, knownD);
    dims.area = Math.round(lotArea);
  } else {
    dims = deriveDimensions(polygon, knownF, knownD);
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
      landArea: dims.area,
      frontage: dims.frontage,
      depth:    dims.depth,
    },
    slope:           elevData.slope,
    aspect:          elevData.aspect,
    elevationDelta:  elevData.elevationDelta,
    centerElevation: elevData.centerElevation,
  };
};
