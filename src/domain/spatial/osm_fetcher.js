/**
 * @file domain/spatial/osm_fetcher.js
 * @description OSM Overpass-based parcel fetchers (Sources 1, 2, 5 of terrain pipeline).
 *   Source 1: fetchOSMById       — OSM element by place_id (buildings excluded)
 *   Source 2: fetchOSMCadastral  — Dedicated cadastral/landuse Overpass query
 *   Source 5: fetchOSMContaining — Any closed polygon containing the point
 * @version 1.0.0 — extracted from terrain_engine.js (Task #82)
 */

import * as turf from 'https://cdn.skypack.dev/@turf/turf';

// ---------------------------------------------------------------------------
// Overpass mirror list
// ---------------------------------------------------------------------------
export const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

// ---------------------------------------------------------------------------
// Tag classifiers
// ---------------------------------------------------------------------------
const LOT_TAGS      = new Set(['landuse', 'land_use', 'boundary', 'cadastre', 'lot', 'parcel']);
const BUILDING_TAGS = new Set(['building', 'building:part', 'amenity', 'shop', 'office']);

export const isLotWay = (tags = {}) => {
  for (const t of LOT_TAGS) if (t in tags) return true;
  if ('addr:housenumber' in tags && !('building' in tags)) return true;
  return false;
};

export const isBuildingWay = (tags = {}) => {
  for (const t of BUILDING_TAGS) if (t in tags) return true;
  return false;
};

// ---------------------------------------------------------------------------
// Helper: build GeoJSON polygon from OSM way nodes
// ---------------------------------------------------------------------------
export const osmWayToPolygon = (way, nodeMap) => {
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
// Rejects elements tagged as buildings — uses only lot/land ways
// ---------------------------------------------------------------------------
export const fetchOSMById = async (osmType, osmId) => {
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
      elements.filter(e => e.type === 'node').forEach(n => { nodeMap[n.id] = [n.lon, n.lat]; });

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

      if (isBuildingWay(way.tags || {})) {
        console.log('[osm] By ID: element is a building footprint — skipping');
        return null;
      }

      const poly = osmWayToPolygon(way, nodeMap);
      if (!poly) continue;

      const area = Math.round(turf.area(poly));
      if (area < 50 || area > 20000) {
        console.log('[osm] By ID: area', area, 'm² out of range — skipping');
        return null;
      }

      console.log('[osm] By ID success:', osmType, osmId, '| area:', area, 'm²');
      return { polygon: poly, source: 'OSM_ID' };
    } catch (e) {
      console.warn('[osm] By ID mirror failed:', e.message);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Source 2: OSM Overpass — dedicated cadastral/landuse query
// Queries specifically for land boundary elements, not buildings
// Returns smallest plausible residential lot containing the point
// ---------------------------------------------------------------------------
export const fetchOSMCadastral = async (lat, lon) => {
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
      elements.filter(e => e.type === 'node').forEach(n => { nodeMap[n.id] = [n.lon, n.lat]; });

      const point = turf.point([lon, lat]);
      const candidates = [];

      for (const way of elements.filter(e => e.type === 'way')) {
        const poly = osmWayToPolygon(way, nodeMap);
        if (!poly) continue;
        try {
          const area = turf.area(poly);
          if (area < 80 || area > 8000) continue;
          if (turf.booleanPointInPolygon(point, poly)) {
            candidates.push({ poly, area, tags: way.tags || {} });
          }
        } catch {}
      }

      if (!candidates.length) continue;
      candidates.sort((a, b) => a.area - b.area);

      console.log('[osm] Cadastral: found lot', Math.round(candidates[0].area), 'm²');
      return { polygon: candidates[0].poly, source: 'OSM_CADASTRAL' };
    } catch (e) {
      console.warn('[osm] Cadastral query failed:', e.message);
    }
  }
  return null;
};

// ---------------------------------------------------------------------------
// Source 5: OSM Overpass — any closed polygon containing the point
// Non-building lots preferred over building footprints in sort order
// ---------------------------------------------------------------------------
export const fetchOSMContaining = async (lat, lon) => {
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
      elements.filter(e => e.type === 'node').forEach(n => { nodeMap[n.id] = [n.lon, n.lat]; });

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

      // Non-buildings first, then smallest within each group
      candidates.sort((a, b) => {
        if (a.isBuilding !== b.isBuilding) return a.isBuilding ? 1 : -1;
        return a.area - b.area;
      });

      const best = candidates[0];

      if (best.isBuilding) {
        // Estimate lot from building footprint using Melbourne coverage ratios
        const bArea = best.area;
        const coverage = bArea < 100 ? 0.75 : bArea < 180 ? 0.65 : bArea < 280 ? 0.55 : 0.40;
        const estLotArea = bArea / coverage;
        const scale = Math.sqrt(estLotArea / bArea);
        let resultPoly = best.poly;
        try {
          const bufferDist = (scale - 1) * Math.sqrt(bArea / Math.PI);
          resultPoly = turf.buffer(best.poly, Math.min(bufferDist, 10), { units: 'meters' }) || best.poly;
        } catch {}
        console.log('[osm] Building footprint: est lot via coverage', (coverage * 100).toFixed(0) + '%', '→', Math.round(turf.area(resultPoly)), 'm²');
        return { polygon: resultPoly, source: 'OSM_BUILDING' };
      }

      console.log('[osm] Containing lot:', Math.round(best.area), 'm²');
      return { polygon: best.poly, source: 'OSM_LOT' };
    } catch (e) {
      console.warn('[osm] Overpass containing search failed:', e.message);
    }
  }
  return null;
};
