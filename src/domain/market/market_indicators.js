/**
 * @file domain/market/market_indicators.js
 * @description Live market data retrieval for RBA and ABS indices.
 * @version 1.1.0
 */

import { ENV } from '../../core/config/env_config';

export const fetchLiveIndicators = async () => {
  const result = { 
    status: "done", 
    ts: new Date().toISOString(), 
    rba: null, 
    cpi: null, 
    ppi: null 
  };

  // 1. RBA: Cash Rate
  try {
    const rbaUrl = `${ENV.market.rbaBase}/statistics/tables/F4_001?format=csv`;
    const rbaResp = await fetch(
      rbaUrl,
      { signal: AbortSignal.timeout(6000) }
    );
    if (rbaResp.ok) {
      const txt = await rbaResp.text();
      const lines = txt.split("\n").filter(l => l.trim());
      const last = lines[lines.length - 1].split(",");
      result.rba = { rate: parseFloat(last[1]) || 4.35, source: "RBA API", date: last[0] };
    }
  } catch (e) {
    result.rba = { 
      rate: 4.10, 
      source: "Hardcoded fallback", 
      date: "2026-04", 
      link: "https://www.rba.gov.au/statistics/cash-rate/" 
    };
  }

  // 2. ABS: CPI All Groups
  try {
    const cpiUrl = `${ENV.market.absBase}/data/CPI/1.10001.10.50.Q?startPeriod=2023-Q1&detail=DataOnly&format=jsondata`;
    const absResp = await fetch(
      cpiUrl,
      { 
        signal: AbortSignal.timeout(10000), 
        headers: { "Accept": "application/vnd.sdmx.data+json" } 
      }
    );
    if (absResp.ok) {
      const json = await absResp.json();
      const obs = json?.data?.dataSets?.[0]?.series?.["0:0:0:0:0"]?.observations || {};
      const periods = json?.data?.structure?.dimensions?.observation?.[0]?.values || [];
      const series = periods.map((p, i) => ({ period: p.id, val: obs[i]?.[0] })).filter(x => x.val != null);
      if (series.length >= 2) {
        const lat = series[series.length - 1];
        const yr = series[series.length - 5] || series[0];
        const yoy = yr ? ((lat.val - yr.val) / yr.val * 100) : null;
        result.cpi = { latest: lat, yearAgo: yr, yoy, series: series.slice(-8), source: "ABS CPI API" };
      }
    }
  } catch (e) {
    result.cpi = { error: "ABS CPI API temporarily unavailable" };
  }

  // 3. ABS: Building Activity (Residential)
  try {
    const bldgUrl = `${ENV.market.absBase}/data/BLDG_ACTIVITY/1.1.3.AUS.Q?startPeriod=2023-Q1&detail=DataOnly&format=jsondata`;
    const bldgResp = await fetch(
      bldgUrl,
      { 
        signal: AbortSignal.timeout(10000), 
        headers: { "Accept": "application/vnd.sdmx.data+json" } 
      }
    );
    if (bldgResp.ok) {
      const json = await bldgResp.json();
      const obs = json?.data?.dataSets?.[0]?.series?.["0:0:0:0:0"]?.observations || {};
      const periods = json?.data?.structure?.dimensions?.observation?.[0]?.values || [];
      const series = periods.map((p, i) => ({ period: p.id, val: obs[i]?.[0] })).filter(x => x.val != null);
      if (series.length >= 2) {
        const lat = series[series.length - 1];
        const prev = series[series.length - 2];
        const qoq = prev ? ((lat.val - prev.val) / prev.val * 100) : null;
        result.ppi = { latest: lat, prev, qoq, series: series.slice(-6), source: "ABS Building Activity API" };
      }
    }
  } catch (e) {
    result.ppi = { error: "ABS Building Activity API temporarily unavailable" };
  }

  return result;
};
