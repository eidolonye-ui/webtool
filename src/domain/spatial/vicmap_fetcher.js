/**
 * @file domain/spatial/vicmap_fetcher.js
 * @description Vicmap GeoServer WFS parcel fetcher (Source 3+4 of terrain pipeline).
 *
 * Critical axis-order fix (v5): GeoServer WFS 2.0.0 with EPSG:4326 mandates lat-first
 * axis order per EPSG spec. Exhaustive permutation tries CRS:84, EPSG:4326, WFS 1.0.0,
 * and DWITHIN 5m to cover all server configurations.
 *
 * @version 1.0.0 — extracted from terrain_engine.js (Task #82)
 */

import * as turf from 'https://cdn.skypack.dev/@turf/turf';

const BASE_URL = 'https://opendata.maps.vic.gov.au/geoserver/datavic/wfs';

const LAYERS = [
  { type: 'datavic:VMPROP_PROPERTY_MP',   geomCol: 'SHAPE' },
  { type: 'datavic:VMPROP_PROPERTY',       geomCol: 'SHAPE' },
  { type: 'datavic:VMPROP_LAND_PARCEL_MP', geomCol: 'SHAPE' },
  { type: 'datavic:VMPROP_PROPERTY',       geomCol: 'shape' },
];

// ---------------------------------------------------------------------------
// processGeoJSON — extract + validate the polygon from a WFS FeatureCollection
// ---------------------------------------------------------------------------
const processGeoJSON = (gj, lon, lat) => {
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
            return null;
          }
        } catch { return null; }
      } else { return null; }
    }
  } catch {} // booleanPointInPolygon can throw for complex polygons — proceed

  const area = lotAreaAttr ? parseFloat(lotAreaAttr) : Math.round(turf.area(poly));
  if (area < 30 || area > 100000) return null;

  return { polygon: poly, area };
};

// ---------------------------------------------------------------------------
// fetchVicmapWFS — public API
// Tries all layer + axis-order permutations. Returns null if all fail.
// ---------------------------------------------------------------------------
export const fetchVicmapWFS = async (lat, lon) => {
  // Axis-order permutations — exhaustive coverage of server configurations
  const AXIS_OPTS = [
    { srs: 'urn:ogc:def:crs:OGC:1.3:CRS84', pt: `POINT(${lon} ${lat})`, ver: '2.0.0' },           // CRS:84 lon,lat
    { srs: 'EPSG:4326',                       pt: `POINT(${lat} ${lon})`, ver: '2.0.0' },           // spec-compliant lat,lon
    { srs: 'EPSG:4326',                       pt: `POINT(${lon} ${lat})`, ver: '1.0.0' },           // WFS 1.0.0 always lon,lat
    { srs: 'urn:ogc:def:crs:OGC:1.3:CRS84', pt: `POINT(${lon} ${lat})`, ver: '2.0.0', dwithin: 5 }, // DWITHIN 5m
  ];

  for (const { type, geomCol } of LAYERS) {
    for (const { srs, pt, ver, dwithin } of AXIS_OPTS) {
      const cql = dwithin
        ? `DWITHIN(${geomCol},${pt},${dwithin},meters)`
        : `INTERSECTS(${geomCol},${pt})`;

      const url = BASE_URL
        + `?SERVICE=WFS&VERSION=${ver}&REQUEST=GetFeature`
        + `&typeNames=${encodeURIComponent(type)}`
        + `&outputFormat=application/json`
        + `&srsName=${encodeURIComponent(srs)}`
        + `&count=3`
        + `&CQL_FILTER=${encodeURIComponent(cql)}`;

      try {
        const resp = await fetch(url, { signal: AbortSignal.timeout(14000) });
        if (!resp.ok) continue;
        const gj = await resp.json();
        const result = processGeoJSON(gj, lon, lat);
        if (result) {
          console.log('[vicmap] WFS ✓', type, ver, srs, '| area:', result.area, 'm²');
          return { polygon: result.polygon, source: 'VICMAP', lotArea: result.area };
        }
      } catch (e) {
        if (e.name !== 'TimeoutError' && e.name !== 'AbortError') {
          console.warn('[vicmap] WFS failed:', type, ver, e.message?.slice(0, 60));
        }
      }

      // Also try CONTAINS (same layer/axis config)
      if (!dwithin) {
        const cql2 = `CONTAINS(${geomCol},${pt})`;
        const url2 = BASE_URL
          + `?SERVICE=WFS&VERSION=${ver}&REQUEST=GetFeature`
          + `&typeNames=${encodeURIComponent(type)}`
          + `&outputFormat=application/json`
          + `&srsName=${encodeURIComponent(srs)}`
          + `&count=3`
          + `&CQL_FILTER=${encodeURIComponent(cql2)}`;
        try {
          const resp2 = await fetch(url2, { signal: AbortSignal.timeout(14000) });
          if (resp2.ok) {
            const gj2 = await resp2.json();
            const result2 = processGeoJSON(gj2, lon, lat);
            if (result2) {
              console.log('[vicmap] WFS (CONTAINS) ✓', type, ver, srs, '| area:', result2.area, 'm²');
              return { polygon: result2.polygon, source: 'VICMAP', lotArea: result2.area };
            }
          }
        } catch {}
      }
    }
  }
  console.warn('[vicmap] WFS: all attempts failed');
  return null;
};
