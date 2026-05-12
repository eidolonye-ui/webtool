/**
 * @file domain/finance/market_indicators_v2.js
 * @description Ultra-resilient market data retrieval from ABS. 
 * Now uses a specialized ABS-Structure parser to handle the specific {meta, data, errors} format.
 * @version 1.3.0
 */

const ABS_BASE_URL = '/api-abs';

const FALLBACKS = {
  cpi: 3.6,
  buildingActivity: 1.0,
};

/**
 * ABS-Specific Parser.
 * Based on log: {meta: {…}, data: {…}, errors: Array(0)}
 * It seems ABS data is nested inside data.data or similar.
 */
const safeParseABS = (json) => {
  try {
    if (!json) return null;

    // 1. Handle the { meta, data, errors } envelope
    let target = json;
    if (json.data && typeof json.data === 'object') {
      target = json.data;
    }

    // 2. Try to find the actual value in the target
    // Case A: target.values is an array [ { value: ... }, ... ]
    if (target.values && Array.isArray(target.values) && target.values.length > 0) {
      const first = target.values[0];
      return typeof first === 'object' ? (first.value || first.data) : first;
    }

    // Case B: target is an array itself
    if (Array.isArray(target) && target.length > 0) {
      const first = target[0];
      return typeof first === 'object' ? (first.value || first.data) : first;
    }

    // Case C: target has a direct .value or .data property
    if (target.value !== undefined) return target.value;
    if (target.data !== undefined && typeof target.data !== 'object') return target.data;

    // Case D: Deep scan for any numeric array (last resort)
    const findNumeric = (obj) => {
      if (Array.isArray(obj) && obj.length > 0) {
        const first = obj[0];
        if (typeof first === 'number') return first;
        if (first && typeof first === 'object' && (first.value || first.data)) {
          return first.value || first.data;
        }
      }
      if (obj && typeof obj === 'object') {
        for (const key in obj) {
          const res = findNumeric(obj[key]);
          if (res !== null) return res;
        }
      }
      return null;
    };

    const found = findNumeric(json);
    if (found !== null) return found;
    
    console.warn("[MarketIndicators] ABS API returned an unknown structure:", json);
    return null;
  } catch (e) {
    console.error("[MarketIndicators] Parsing crash:", e);
    return null;
  }
};

const fetchABSData = async (endpoint, fallbackValue) => {
  try {
    const url = `${ABS_BASE_URL}${endpoint}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      console.warn(`[MarketIndicators] API ${res.status} for ${endpoint}. Using fallback.`);
      return fallbackValue;
    }
    
    const json = await res.json();
    const rawValue = safeParseABS(json);
    
    if (rawValue === null) return fallbackValue;
    
    const parsed = parseFloat(rawValue);
    return isNaN(parsed) ? fallbackValue : parsed;
    
  } catch (e) {
    console.error(`[MarketIndicators] Network error for ${endpoint}:`, e.message);
    return fallbackValue;
  }
};

export const fetchCPI = async () => {
  return await fetchABSData('/data/CPI/1.10001.10.50.Q?startPeriod=2023-Q1&detail=DataOnly&format=jsondata', FALLBACKS.cpi);
};

export const fetchBuildingActivity = async () => {
  return await fetchABSData('/data/BLDG_ACTIVITY/1.1.3.AUS.Q?startPeriod=2023-Q1&detail=DataOnly&format=jsondata', FALLBACKS.buildingActivity);
};

export const fetchLiveIndicators = async () => {
  console.log("[MarketIndicators] Syncing live indicators (ABS-Structure Mode)...");
  const [cpi, bldg] = await Promise.all([
    fetchCPI(),
    fetchBuildingActivity()
  ]);
  
  const isFallback = (cpi === FALLBACKS.cpi || bldg === FALLBACKS.buildingActivity);
  return {
    cpi,
    buildingActivity: bldg,
    timestamp:  isFallback ? null : new Date().toLocaleString('en-AU'),
    isFallback,
    isLive:     !isFallback,
  };
};
