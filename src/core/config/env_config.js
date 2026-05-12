/**
 * @file core/config/env_config.js
 * @description Centralised environment configuration.
 * AI (Ollama) section removed — document parsing is now fully rule-based.
 */

export const ENV = {
  market: {
    rbaBase: import.meta.env.VITE_RBA_API_BASE || 'https://api.rba.gov.au',
    absBase: import.meta.env.VITE_ABS_API_BASE || 'https://api.data.abs.gov.au',
  },
  spatial: {
    openTopoData: import.meta.env.VITE_OPENTOPODATA_ENDPOINT || 'https://api.opentopodata.org/v1/srtm30m',
    overpass:     import.meta.env.VITE_OVERPASS_ENDPOINT     || 'https://overpass-api.de/api/interpreter',
    vicmapWFS:    import.meta.env.VITE_VICMAP_WFS            || 'https://opendata.maps.vic.gov.au/geoserver/wfs',
    nominatim:    import.meta.env.VITE_NOMINATIM             || 'https://nominatim.openstreetmap.org',
  },
};

/** No critical env vars required — all APIs are public. Always returns []. */
export const validateEnv = () => [];
