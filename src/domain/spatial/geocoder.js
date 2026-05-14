/**
 * @file domain/spatial/geocoder.js
 * @description Three-tier cascade geocoder for Victorian property addresses.
 *   Tier 1: MapShare VIC (DEECA — GNAF + Vicmap Address, monthly updates, <5m accuracy)
 *   Tier 2: Nominatim    (OSM crowdsourced — fallback)
 *   Tier 3: Photon/komoot (OSM alternative engine — last resort)
 *
 * No API key required for any tier. Victorian-biased bounding boxes applied.
 * @version 1.0.0 — extracted from SiteInvestigationPanel.jsx (Task #81)
 */

// ---------------------------------------------------------------------------
// Tier 1 — MapShare VIC (official Victorian government GNAF geocoder)
// ---------------------------------------------------------------------------

export const geocodeMapShareVIC = async (query) => {
  const url = 'https://api.mapshare.vic.gov.au/arcgis/rest/services'
    + '/mapshare/Geocoding/GeocodeServer/findAddressCandidates'
    + '?SingleLine=' + encodeURIComponent(query)
    + '&maxLocations=8&outFields=*&f=json';
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (!data.candidates?.length) return [];
  return data.candidates
    .filter(c => c.score >= 60)
    .map(c => ({
      id:      'mapshare_' + c.score + '_' + c.location.x,
      name:    c.address,
      lat:     String(c.location.y),
      lon:     String(c.location.x),
      osmType: null,   // not an OSM entity — terrain engine falls through to Vicmap WFS directly
      osmId:   null,
      suburb:  c.attributes?.City || c.attributes?.Sublocality || '',
      source:  'mapshare',
      score:   c.score,
    }));
};

// ---------------------------------------------------------------------------
// Tier 2 — Nominatim (OpenStreetMap)
// ---------------------------------------------------------------------------

export const geocodeNominatim = async (query) => {
  const url = 'https://nominatim.openstreetmap.org/search?q='
    + encodeURIComponent(query)
    + '&format=json&addressdetails=1&limit=5&countrycodes=au&accept-language=en';
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  return data.map(item => ({
    id:      item.place_id,
    name:    item.display_name,
    lat:     item.lat,
    lon:     item.lon,
    osmType: item.osm_type,
    osmId:   item.osm_id,
    suburb:  item.address?.suburb || item.address?.city_district || item.address?.town || item.address?.village || '',
    source:  'nominatim',
  }));
};

// ---------------------------------------------------------------------------
// Tier 3 — Photon/komoot (OSM alternative)
// ---------------------------------------------------------------------------

export const geocodePhoton = async (query) => {
  // Victorian bounding box: lon 140.9–149.9, lat -39.2 to -33.9
  const url = 'https://photon.komoot.io/api/?q='
    + encodeURIComponent(query)
    + '&lang=en&limit=5&bbox=140.9,-39.2,149.9,-33.9';
  const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (!data.features?.length) return [];
  return data.features.map((f, i) => {
    const p = f.properties;
    const label = [p.housenumber, p.street, p.city || p.suburb, p.state, p.postcode, 'Australia']
      .filter(Boolean).join(', ');
    return {
      id:      'photon_' + i,
      name:    label || p.name || '',
      lat:     String(f.geometry.coordinates[1]),
      lon:     String(f.geometry.coordinates[0]),
      osmType: p.osm_type?.toLowerCase() || null,
      osmId:   p.osm_id   || null,
      suburb:  p.city || p.suburb || '',
      source:  'photon',
    };
  });
};

// ---------------------------------------------------------------------------
// Cascade orchestrator — public API
// ---------------------------------------------------------------------------

/**
 * fetchAddressSuggestions
 * Tries MapShare VIC first, falls back through Nominatim, then Photon.
 * @param {string} query
 * @returns {Promise<Array>} suggestion objects with { id, name, lat, lon, osmType, osmId, suburb, source }
 */
export const fetchAddressSuggestions = async (query) => {
  if (!query?.trim() || query.length < 3) return [];
  try {
    const tier1 = await geocodeMapShareVIC(query).catch(() => []);
    if (tier1.length > 0) return tier1;

    const tier2 = await geocodeNominatim(query).catch(() => []);
    if (tier2.length > 0) return tier2;

    return await geocodePhoton(query).catch(() => []);
  } catch {
    return [];
  }
};
