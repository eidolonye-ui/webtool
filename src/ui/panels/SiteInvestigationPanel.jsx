/**
 * @file ui/panels/SiteInvestigationPanel.jsx
 * @description Professional Site Investigation Panel — orchestrates address search,
 *   terrain/location analysis, yield synthesis, and document intelligence.
 * @version 10.0.0 - Task #83: extracted SiteMetricsCard, SynthesisCard,
 *   DocFileCard, DocumentIntelligenceCard into sub-modules.
 */

import React, { useState, useEffect, useRef } from 'react';
import { UIPanel, UIInput, UIButton } from '../components/Common_V2.jsx';
import { C, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { runSiteInvestigation } from '../../domain/spatial/terrain_engine.js';
import { runLocationAnalysis } from '../../domain/spatial/location_engine.js';
import { fetchAddressSuggestions } from '../../domain/spatial/geocoder.js';
import { SiteMetricsCard } from './site/SiteMetricsCard.jsx';
import { SynthesisCard } from './site/SynthesisCard.jsx';
import { DocumentIntelligenceCard } from './site/DocumentIntelligenceCard.jsx';
import { LocationScoreCard } from './site/LocationScoreCard.jsx';
import { PersonaIntelligenceCard } from './site/PersonaIntelligenceCard.jsx';

const SOVEREIGN_ACTION_STYLE = {
  height: 38,
  backgroundColor: '#007AFF',
  color: '#fff',
  fontWeight: 700,
  border: 'none',
  boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)',
};

export const SiteInvestigationPanel = () => {
  const [site,           setSite]           = useState(store.getActiveScenario()?.site || {});
  const [terrainData,    setTerrainData]    = useState(store.getActiveScenario()?.site?.investigation?.terrainData || null);
  const [planning,       setPlanning]       = useState(store.getActiveScenario()?.planning || {});
  const [locationData,   setLocationData]   = useState(store.getActiveScenario()?.site?.investigation?.locationData || null);
  const [activePersona,  setActivePersona]  = useState(store.getState()?.system?.activePersona || 'developer');
  const [lookupAddr,     setLookupAddr]     = useState('');
  const [suggestions,    setSuggestions]    = useState([]);
  const [analysisStatus, setAnalysisStatus] = useState('idle');
  const [estimatedFields, setEstimatedFields] = useState({ area: false, frontage: false, depth: false });
  const debounceTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const active = store.getActiveScenario() || {};
      setSite(active.site || {});
      setTerrainData(active.site?.investigation?.terrainData   || null);
      setLocationData(active.site?.investigation?.locationData || null);
      setPlanning(active.planning || {});
      setActivePersona(store.getState()?.system?.activePersona || 'developer');
    });
    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const sanitizeAddress = (addr) => {
    if (!addr) return '';
    let clean = addr.replace(/[^\x00-\x7F]+/g, '').replace(/\s+/g, ' ').trim();
    const parts = clean.split(',').map(p => p.trim());
    if (parts.length >= 6) {
      const street   = parts[0] + ' ' + parts[1];
      const suburb   = parts[2];
      const state    = parts[4];
      const postcode = parts[5];
      const country  = parts[6] || 'Australia';
      return street + ', ' + suburb + ', ' + state + ' ' + postcode + ', ' + country;
    }
    return clean;
  };

  const handleInputChange = (val) => {
    setLookupAddr(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      const results = await fetchAddressSuggestions(val);
      setSuggestions(results);
    }, 300);
  };

  const handleManualFieldEdit = (field, value) => {
    store.dispatch('site.' + field, Number(value) || 0);
    setEstimatedFields(prev => ({ ...prev, [field]: false }));
  };

  // ---------------------------------------------------------------------------
  // Address selection — runs terrain + location analysis in parallel
  // ---------------------------------------------------------------------------

  const selectAddress = async (item) => {
    setSuggestions([]);
    setLookupAddr(item.name);
    setAnalysisStatus('loading');
    store.batchDispatch([
      { path: 'site.address',  value: '' },
      { path: 'site.area',     value: 0  },
      { path: 'site.frontage', value: 0  },
      { path: 'site.depth',    value: 0  },
    ]);
    const cleanAddress = sanitizeAddress(item.name);
    store.dispatch('site.address', cleanAddress);
    store.dispatch('site.lat',     item.lat);
    store.dispatch('site.lon',     item.lon);

    try {
      const [terrainResults, locResults] = await Promise.allSettled([
        runSiteInvestigation(item.lat, item.lon, item.osmType, item.osmId, item.suburb || ''),
        runLocationAnalysis(item.lat, item.lon),
      ]);

      if (terrainResults.status === 'fulfilled') {
        const r = terrainResults.value;
        if (r.metrics) {
          const isEst = r.isEstimate !== false;
          // Only dispatch dimensions if no FSP-confirmed values already exist.
          // Never overwrite confirmed FSP dimensions with terrain estimates.
          const currentSrc = store.getActiveScenario()?.site?.dimensionsSource;
          const fspLocked  = currentSrc === 'fsp';
          const dimSrc     = isEst ? 'terrain' : (r.dataSource?.toLowerCase() || 'terrain');
          store.batchDispatch([
            ...(!fspLocked ? [
              { path: 'site.area',            value: r.metrics.landArea },
              { path: 'site.frontage',         value: r.metrics.frontage },
              { path: 'site.depth',            value: r.metrics.depth    },
              { path: 'site.dimensionsSource', value: dimSrc             },
            ] : []),
          ]);
          setEstimatedFields({ area: isEst, frontage: isEst, depth: isEst });
        }
        store.dispatch('site.investigation.terrainData', r);
        setTerrainData(r);
        if (typeof r.slope === 'number') store.dispatch('physical.slope', parseFloat(r.slope.toFixed(1)));
        if (r.aspect) store.dispatch('physical.aspect', r.aspect);
        if (typeof r.elevationDelta === 'number') store.dispatch('physical.elevationDelta', parseFloat(r.elevationDelta.toFixed(1)));
        if (typeof r.slope === 'number' && !store.getActiveScenario()?.physical?.siteWorksCostOverridden) {
          const sl = r.slope;
          store.dispatch('physical.siteWorksCost', sl < 2 ? 8000 : sl < 5 ? 15000 : sl < 10 ? 28000 : sl < 15 ? 45000 : 65000);
        }
      }

      if (locResults.status === 'fulfilled') {
        store.dispatch('site.investigation.locationData', locResults.value);
        setLocationData(locResults.value);
      } else {
        console.warn('[SiteInv] Location analysis failed:', locResults.reason?.message);
      }
      setAnalysisStatus('done');
    } catch (e) {
      console.error('[SiteInv] selectAddress error:', e);
      setAnalysisStatus('error');
    }
  };

  const handleRunAnalysis = async () => {
    if (!site.address) { setAnalysisStatus('error'); return; }
    setAnalysisStatus('loading');
    try {
      const [terrainResults, locResults] = await Promise.allSettled([
        runSiteInvestigation(site.lat, site.lon),
        runLocationAnalysis(site.lat, site.lon),
      ]);
      if (terrainResults.status === 'fulfilled') {
        const r = terrainResults.value;
        store.dispatch('site.investigation.terrainData', r);
        setTerrainData(r);
        if (typeof r.slope === 'number') store.dispatch('physical.slope', parseFloat(r.slope.toFixed(1)));
        if (r.aspect) store.dispatch('physical.aspect', r.aspect);
        if (typeof r.elevationDelta === 'number') store.dispatch('physical.elevationDelta', parseFloat(r.elevationDelta.toFixed(1)));
        if (typeof r.slope === 'number' && !store.getActiveScenario()?.physical?.siteWorksCostOverridden) {
          const sl = r.slope;
          store.dispatch('physical.siteWorksCost', sl < 2 ? 8000 : sl < 5 ? 15000 : sl < 10 ? 28000 : sl < 15 ? 45000 : 65000);
        }
      }
      if (locResults.status === 'fulfilled') {
        store.dispatch('site.investigation.locationData', locResults.value);
        setLocationData(locResults.value);
      }
      setAnalysisStatus('done');
    } catch {
      setAnalysisStatus('error');
    }
  };

  const handleClearAll = () => {
    setLookupAddr('');
    setTerrainData(null);
    setLocationData(null);
    setEstimatedFields({ area: false, frontage: false, depth: false });
    setAnalysisStatus('idle');
    store.batchDispatch([
      { path: 'site.address',                     value: ''    },
      { path: 'site.lat',                         value: null  },
      { path: 'site.lon',                         value: null  },
      { path: 'site.area',                        value: 0     },
      { path: 'site.frontage',                    value: 0     },
      { path: 'site.depth',                       value: 0     },
      { path: 'site.investigation.terrainData',   value: null  },
      { path: 'site.investigation.locationData',  value: null  },
      { path: 'site.investigation.synthesis',     value: null  },
      { path: 'physical.slope',                   value: null  },
      { path: 'physical.aspect',                  value: null  },
      { path: 'physical.elevationDelta',          value: null  },
      { path: 'physical.siteWorksCost',           value: 0     },
      { path: 'physical.siteWorksCostOverridden', value: false },
      { path: 'planning.zoneCode',                value: ''    },
      { path: 'planning.hasHO',                   value: false },
      { path: 'planning.hasVPO',                  value: false },
      { path: 'planning.hasSBO',                  value: false },
      { path: 'planning.hasBMO',                  value: false },
      { path: 'planning.hasEasementBoe',          value: false },
      { path: 'planning.hasSingleCovenant',       value: false },
      { path: 'planning.hasS173',                 value: false },
      { path: 'planning.s173Details',             value: ''    },
      { path: 'planning.covenantDetails',         value: ''    },
    ]);
  };

  // ---------------------------------------------------------------------------
  // JSX
  // ---------------------------------------------------------------------------

  return (
    <UIPanel title="Site Investigation and Sovereign Analysis">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

        {/* STEP 1 — Site Discovery */}
        <div style={{
          padding: T.sp.md, backgroundColor: C.surface.card,
          borderRadius: T.r.md + 'px ' + T.r.md + 'px 0 0',
          border: '1px solid ' + C.surface.border, borderBottom: 'none', position: 'relative'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ backgroundColor: '#007AFF', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>1</div>
            <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: '#FFFFFF' }}>Site Discovery</div>
          </div>

          <div style={{ padding: T.sp.md, backgroundColor: C.surface.panel, borderRadius: T.r.sm, border: '1px solid ' + C.surface.border, display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.xs, color: 'rgba(255,255,255,0.9)' }}>Property Address</div>

            <div style={{ display: 'flex', gap: T.sp.md, alignItems: 'center', width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <UIInput placeholder="Search address..." value={lookupAddr} onChange={handleInputChange} style={{ marginBottom: 0 }} />
              </div>
              <UIButton label="Clear" onClick={handleClearAll} variant="ghost" style={{ height: 38 }} />
              <UIButton
                label={analysisStatus === 'loading' ? 'Analyzing...' : 'Run Deep Analysis'}
                onClick={handleRunAnalysis}
                disabled={analysisStatus === 'loading' || !site.address}
                style={SOVEREIGN_ACTION_STYLE}
              />
            </div>

            {/* Address autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div style={{ backgroundColor: C.surface.card, border: '1px solid ' + C.surface.border, borderRadius: T.r.sm, zIndex: 100, boxShadow: T.sh.md, maxHeight: 200, overflowY: 'auto' }}>
                {suggestions.map(item => (
                  <div key={item.id} onClick={() => selectAddress(item)} style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid ' + C.surface.border, fontSize: T.fs.xs, color: '#FFFFFF' }}>
                    {item.name}
                  </div>
                ))}
              </div>
            )}

            {analysisStatus === 'error' && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)', borderRadius: T.r.sm, fontSize: T.fs.xs, color: '#ff4d4f' }}>
                Analysis failed. Check your network connection and try again.
              </div>
            )}

            <SiteMetricsCard
              site={site}
              estimatedFields={estimatedFields}
              terrainData={terrainData}
              onFieldEdit={handleManualFieldEdit}
            />

            {/* Verify links */}
            {site.address && (
              <div style={{ display: 'flex', gap: T.sp.sm, flexWrap: 'wrap', marginTop: 2 }}>
                <a href={'https://www.property.com.au/search/find-properties?search-term=' + encodeURIComponent(site.address)}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: T.fs.xxs, color: '#007AFF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid rgba(0,122,255,0.3)', borderRadius: T.r.sm, backgroundColor: 'rgba(0,122,255,0.07)', fontWeight: 600 }}>
                  <span style={{ fontSize: 11 }}>↗</span> Verify on property.com.au
                </a>
                <a href={'https://www.domain.com.au/sale/' + encodeURIComponent(site.address.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.5)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: T.r.sm, backgroundColor: 'rgba(255,255,255,0.04)', fontWeight: 600 }}>
                  <span style={{ fontSize: 11 }}>↗</span> Domain
                </a>
              </div>
            )}

            <LocationScoreCard locationData={locationData} />
          </div>

          <div style={{ position: 'absolute', left: 10, top: '100%', width: 2, height: 24, background: 'linear-gradient(180deg, #007AFF 0%, rgba(0,122,255,0) 100%)', zIndex: 0 }} />
        </div>

        {/* Yield Waterfall / Synthesis */}
        {terrainData ? (
          <SynthesisCard
            terrainData={terrainData}
            site={site}
            planning={planning}
            estimatedFields={estimatedFields}
          />
        ) : (
          <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: T.fs.xs, fontStyle: 'italic', backgroundColor: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            Awaiting site discovery to generate sovereign analysis...
          </div>
        )}

        {/* STEP 2 — Document Intelligence */}
        <DocumentIntelligenceCard
          onEstimatedReset={() => setEstimatedFields({ area: false, frontage: false, depth: false })}
        />

        {/* Role Intelligence Card */}
        <PersonaIntelligenceCard
          terrainData={terrainData}
          planning={planning}
          activePersona={activePersona}
        />

      </div>
    </UIPanel>
  );
};
