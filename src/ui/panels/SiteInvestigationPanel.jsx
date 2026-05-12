/**
 * @file ui/panels/SiteInvestigationPanel.jsx
 * @description Professional Site Investigation Panel with Hard-Core Yield Waterfall and Cost Analysis.
 * @version 8.0.0 - Task #46-48: type-aware document parsing (VP/S32/Survey specialist parsers),
 *                  expanded field display (dimensions, outgoings, lot ref, overlay schedule numbers).
 */

import React, { useState, useEffect, useRef } from 'react';
import { UIPanel, UIInput, UIButton, UIFileInput } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { extractFileText } from '../../domain/extraction/pdf_ocr.js';
import { extractAllFields, normalizeVicPlanResult, normalizeS32Result, normalizeSurveyResult, FIELD_TO_PATH, FIELD_LABELS } from '../../domain/extraction/unified_engine.js';
import { parseDocumentWithAI } from '../../domain/extraction/ai_adapter.js';
import { parseVicPlanText, parseSection32Text, parseSurveyPlan } from '../../domain/extraction/parsers.js';
import { runSiteInvestigation } from '../../domain/spatial/terrain_engine.js';
import { runLocationAnalysis } from '../../domain/spatial/location_engine.js';
import { synthesizeSiteAnalysis } from '../../domain/spatial/synthesis_engine.js';
import { evaluateConstraints } from '../../domain/spatial/constraint_engine.js';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Inline badge shown next to auto-populated (estimated) field values */
const EstBadge = () => (
  <span style={{
    display: 'inline-block',
    marginLeft: 6,
    padding: '1px 5px',
    fontSize: '9px',
    fontWeight: 800,
    color: '#faad14',
    backgroundColor: 'rgba(250, 173, 20, 0.12)',
    border: '1px solid rgba(250, 173, 20, 0.4)',
    borderRadius: 3,
    letterSpacing: '0.04em',
    verticalAlign: 'middle',
    textTransform: 'uppercase'
  }}>
    Estimated
  </span>
);

/**
 * Location score card — shows overall score/label + 5 pillar breakdown bars.
 * Each pillar: { score, max, detail }
 */
const LocationScoreCard = ({ locationData }) => {
  const [expanded, setExpanded] = React.useState({});
  if (!locationData) return null;

  const { score, label, breakdown } = locationData;

  const scoreColor = score >= 80 ? '#2ecc71'
    : score >= 65 ? '#00b8d9'
    : score >= 50 ? '#faad14'
    : '#ff4d4f';

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  // Scored pillars + unscored school buses section
  const SCORED = [
    { key: 'transport', label: 'Transport',  icon: '🚆' },
    { key: 'education', label: 'Education',  icon: '🎓' },
    { key: 'shopping',  label: 'Shopping',   icon: '🛒' },
    { key: 'lifestyle', label: 'Lifestyle',  icon: '🌳' },
    { key: 'health',    label: 'Health',     icon: '🏥' },
  ];

  const AmenityRow = ({ item }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 13, lineHeight: 1, minWidth: 18 }}>{item.icon}</span>
      <span style={{ flex: 1, fontSize: '10px', color: 'rgba(255,255,255,0.75)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.label || '—'}
        {item.type ? <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>({item.type})</span> : null}
        {item.operator ? <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 4 }}>{item.operator}</span> : null}
        {item.ref ? <span style={{ color: '#00b8d9', marginLeft: 4, fontWeight: 700 }}>#{item.ref}</span> : null}
      </span>
      <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {item.dist}
      </span>
    </div>
  );

  const SchoolBusSection = () => {
    const sb = breakdown.schoolBuses || {};
    const items = sb.items || [];
    return (
      <div style={{
        marginTop: 8,
        padding: '10px 12px',
        backgroundColor: 'rgba(0,184,212,0.06)',
        border: '1px solid rgba(0,184,212,0.2)',
        borderRadius: 6,
      }}>
        <div
          onClick={() => toggle('schoolBuses')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>🚐</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#00b8d9', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              School Bus Stops
            </span>
            <span style={{
              fontSize: '9px', fontWeight: 700,
              backgroundColor: items.length > 0 ? 'rgba(0,184,212,0.2)' : 'rgba(255,255,255,0.06)',
              color: items.length > 0 ? '#00b8d9' : 'rgba(255,255,255,0.35)',
              border: '1px solid ' + (items.length > 0 ? 'rgba(0,184,212,0.4)' : 'rgba(255,255,255,0.1)'),
              borderRadius: 3, padding: '1px 5px'
            }}>
              {items.length > 0 ? items.length + ' found' : 'none nearby'}
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
            {expanded.schoolBuses ? '▲' : '▼'}
          </span>
        </div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{sb.detail}</div>
        {expanded.schoolBuses && items.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {items.map((item, i) => <AmenityRow key={i} item={item} />)}
          </div>
        )}
        {expanded.schoolBuses && items.length === 0 && (
          <div style={{ marginTop: 6, fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
            No school bus stops tagged in OpenStreetMap within 2 km. Check with local school directly.
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      marginTop: T.sp.sm,
      padding: T.sp.md,
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderRadius: T.r.sm,
      border: '1px solid rgba(255,255,255,0.08)'
    }}>
      {/* Header — overall score */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 800, fontSize: T.fs.xs, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Location Score
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: '22px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>/100</span>
          <span style={{
            fontSize: '10px', fontWeight: 700, color: scoreColor,
            backgroundColor: scoreColor + '18',
            border: '1px solid ' + scoreColor + '44',
            borderRadius: 3, padding: '2px 8px', marginLeft: 4,
            textTransform: 'uppercase', letterSpacing: '0.04em'
          }}>
            {label}
          </span>
        </div>
      </div>

      {/* Scored pillars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {SCORED.map(({ key, label: pLabel, icon }) => {
          const p   = breakdown[key] || { score: 0, max: 20, detail: '', items: [] };
          const pct = p.max > 0 ? Math.round((p.score / p.max) * 100) : 0;
          const barColor = pct >= 80 ? '#2ecc71' : pct >= 55 ? '#00b8d9' : pct >= 35 ? '#faad14' : '#ff4d4f';
          const isOpen = !!expanded[key];
          const items  = p.items || [];

          return (
            <div key={key} style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              {/* Row header — click to expand */}
              <div
                onClick={() => toggle(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
                <span style={{ flex: 1, fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{pLabel}</span>

                {/* Mini bar */}
                <div style={{ width: 60, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', backgroundColor: barColor, borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>

                <span style={{ fontSize: '10px', color: barColor, fontWeight: 800, minWidth: 36, textAlign: 'right' }}>
                  {p.score}/{p.max}
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* Summary line */}
              <div style={{ padding: '0 10px 6px 34px', fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>
                {p.detail}
              </div>

              {/* Expanded amenity list */}
              {isOpen && (
                <div style={{ padding: '4px 10px 10px 34px' }}>
                  {items.length > 0
                    ? items.map((item, i) => <AmenityRow key={i} item={item} />)
                    : <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>None found within search radius.</div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* School bus section (always visible, expandable) */}
      <SchoolBusSection />

      {/* Data attribution */}
      <div style={{ marginTop: 8, fontSize: '9px', color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
        Data: OpenStreetMap contributors · Tap any category to see nearby amenities
      </div>
    </div>
  );
};

export const SiteInvestigationPanel = () => {
  const [site,               setSite]              = useState(store.getActiveScenario()?.site || {});
  // Fix #20: correct state path for terrainData
  const [terrainData,        setTerrainData]       = useState(store.getActiveScenario()?.site?.investigation?.terrainData || null);
  // Fix #21: planning for accurate synthesis setbacks
  const [planning,           setPlanning]          = useState(store.getActiveScenario()?.planning || {});
  // Task #24: location analysis result
  const [locationData,       setLocationData]      = useState(store.getActiveScenario()?.site?.investigation?.locationData || null);
  const [lookupAddr,         setLookupAddr]        = useState('');
  const [suggestions,        setSuggestions]       = useState([]);
  const [analysisStatus,     setAnalysisStatus]    = useState('idle');
  // docFiles: per-file upload state { vp, s32, fsp }
  // Each slot: null | { status:'parsing'|'ready'|'error', fileName, text, parsed:{facts,fields,confidence} }
  const [docFiles,           setDocFiles]          = useState({ vp: null, s32: null, fsp: null });
  const [extractionProgress, setExtractionProgress] = useState(false);
  const [extractionError,    setExtractionError]   = useState(null);
  const [appliedFields,      setAppliedFields]     = useState(null); // null=not applied; array=applied field list
  const [estimatedFields,    setEstimatedFields]   = useState({ area: false, frontage: false, depth: false });
  const debounceTimer = useRef(null);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const active = store.getActiveScenario() || {};
      setSite(active.site || {});
      setTerrainData(active.site?.investigation?.terrainData   || null);
      setLocationData(active.site?.investigation?.locationData || null);
      setPlanning(active.planning || {});
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

  const fetchSuggestions = async (query) => {
    if (!query.trim() || query.length < 3) { setSuggestions([]); return; }
    try {
      const res  = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&addressdetails=1&limit=5&countrycodes=au&accept-language=en');
      const data = await res.json();
      setSuggestions(data.map(item => ({
        id: item.place_id,
        name: item.display_name,
        lat: item.lat,
        lon: item.lon,
        osmType: item.osm_type,
        osmId: item.osm_id,
        // Extract suburb for terrain engine Source 6 fallback accuracy
        suburb: item.address?.suburb || item.address?.city_district || item.address?.town || item.address?.village || '',
      })));
    } catch (e) { setSuggestions([]); }
  };

  const handleInputChange = (val) => {
    setLookupAddr(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fetchSuggestions(val), 300);
  };

  // ---------------------------------------------------------------------------
  // Address selection — runs terrain + location analysis in parallel
  // ---------------------------------------------------------------------------

  const selectAddress = async (item) => {
    setSuggestions([]);
    setLookupAddr(item.name);
    setAnalysisStatus('loading');
    setExtractionError(null);
    setAppliedFields(null);

    // Clear previous site data to prevent bleed between properties
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
      // Task #24: run terrain + location analysis in parallel for speed
      const [terrainResults, locResults] = await Promise.allSettled([
        runSiteInvestigation(item.lat, item.lon, item.osmType, item.osmId, item.suburb || ''),
        runLocationAnalysis(item.lat, item.lon),
      ]);

      // --- terrain ---
      if (terrainResults.status === 'fulfilled') {
        const r = terrainResults.value;
        if (r.metrics) {
          store.batchDispatch([
            { path: 'site.area',     value: r.metrics.landArea },
            { path: 'site.frontage', value: r.metrics.frontage },
            { path: 'site.depth',    value: r.metrics.depth    },
          ]);
          // Mark as estimated unless sourced from Vicmap cadastre
          const isEst = r.isEstimate !== false;
          setEstimatedFields({ area: isEst, frontage: isEst, depth: isEst });
        }
        store.dispatch('site.investigation.terrainData', r);
        setTerrainData(r);

        // Task #25: auto-populate PhysicalConditionPanel from terrain data
        if (typeof r.slope === 'number') {
          store.dispatch('physical.slope', parseFloat(r.slope.toFixed(1)));
        }
        if (r.aspect) {
          store.dispatch('physical.aspect', r.aspect);
        }
        if (typeof r.elevationDelta === 'number') {
          store.dispatch('physical.elevationDelta', parseFloat(r.elevationDelta.toFixed(1)));
        }
        // Auto-estimate site works cost from slope (only if user hasn't manually overridden)
        if (typeof r.slope === 'number' && !store.getActiveScenario()?.physical?.siteWorksCostOverridden) {
          const sl = r.slope;
          const autoWorks = sl < 2 ? 8000 : sl < 5 ? 15000 : sl < 10 ? 28000 : sl < 15 ? 45000 : 65000;
          store.dispatch('physical.siteWorksCost', autoWorks);
        }
      }

      // --- location ---
      if (locResults.status === 'fulfilled') {
        const loc = locResults.value;
        store.dispatch('site.investigation.locationData', loc);
        setLocationData(loc);
      } else {
        console.warn('[SiteInv] Location analysis failed:', locResults.reason?.message);
      }

      setAnalysisStatus('done');
    } catch (e) {
      console.error('[SiteInv] selectAddress error:', e);
      setAnalysisStatus('error');
    }
  };

  // Manual "Run Deep Analysis" button re-runs both engines for current address
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
        // Task #25: re-populate physical panel on re-run
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
    } catch (e) {
      setAnalysisStatus('error');
    }
  };

  // ---------------------------------------------------------------------------
  // Document handling
  // ---------------------------------------------------------------------------

  // ---------------------------------------------------------------------------
  // FIELD_LABELS and FIELD_TO_PATH are now imported from unified_engine.js
  // (they live there so both the panel and extractAllFields share the same definitions)

  // ---------------------------------------------------------------------------
  // Upload handler — type-aware specialist parsing on upload
  //   vp  → parseVicPlanText + parseDocumentWithAI supplement → normalizeVicPlanResult
  //   s32 → parseSection32Text + parseDocumentWithAI supplement → normalizeS32Result
  //   fsp → parseSurveyPlan → normalizeSurveyResult
  // ---------------------------------------------------------------------------
  const handleDocUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocFiles(prev => ({ ...prev, [type]: { status: 'parsing', fileName: file.name } }));
    setExtractionError(null);
    setAppliedFields(null);
    try {
      const text = await extractFileText(file);
      let parsed;
      if (type === 'vp') {
        const vpResult  = parseVicPlanText(text);
        const aiResult  = await parseDocumentWithAI(text);
        parsed          = normalizeVicPlanResult(vpResult, aiResult);
      } else if (type === 's32') {
        const s32Result = parseSection32Text(text);
        const aiResult  = await parseDocumentWithAI(text);
        parsed          = normalizeS32Result(s32Result, aiResult);
      } else {
        // fsp — Feature & Level Survey Plan
        const survResult = parseSurveyPlan(text);
        parsed           = normalizeSurveyResult(survResult);
      }
      setDocFiles(prev => ({ ...prev, [type]: { status: 'ready', fileName: file.name, text, parsed } }));
    } catch (err) {
      setDocFiles(prev => ({ ...prev, [type]: { status: 'error', fileName: file.name } }));
      setExtractionError('Could not parse "' + file.name + '". Make sure it is a readable PDF or text file.');
    }
  };

  const clearDocFile = (type) => {
    setDocFiles(prev => ({ ...prev, [type]: null }));
    setAppliedFields(null);
  };

  const hasReadyDoc = Object.values(docFiles).some(f => f?.status === 'ready');

  // Count fields that will be applied (truthy non-false values with known store path)
  const pendingFieldCount = Object.values(docFiles)
    .filter(f => f?.status === 'ready')
    .reduce((sum, f) => {
      const fields = f.parsed?.fields || {};
      return sum + Object.entries(fields).filter(([k, v]) =>
        FIELD_TO_PATH[k] && v !== false && v !== null && v !== undefined
      ).length;
    }, 0);

  // ---------------------------------------------------------------------------
  // Apply — priority cascade: SURVEY > S32 > VICPLAN (FSP wins over S32 over VP)
  // Uses batchDispatch for one atomic state update + single re-render.
  // ---------------------------------------------------------------------------
  const applyExtraction = () => {
    if (!hasReadyDoc) return;
    setExtractionProgress(true);
    setExtractionError(null);
    try {
      // Merge in priority order: VP first (lowest), then S32, then FSP (highest).
      // Later entries overwrite earlier ones for the same path.
      const mergedPaths = {};  // path → { val, key }
      const PRIORITY_ORDER = ['vp', 's32', 'fsp'];

      PRIORITY_ORDER.forEach(docKey => {
        const f = docFiles[docKey];
        if (!f || f.status !== 'ready') return;
        const fields = f.parsed?.fields || {};
        Object.entries(fields).forEach(([key, val]) => {
          const path = FIELD_TO_PATH[key];
          if (!path) return;
          if (val === false || val === null || val === undefined) return;
          mergedPaths[path] = { val, key };
        });
      });

      // Build batchDispatch updates + human-readable change list
      const updates = [];
      const changes = [];
      Object.entries(mergedPaths).forEach(([path, { val, key }]) => {
        updates.push({ path, value: val });
        const label   = FIELD_LABELS[key] || key;
        const display = typeof val === 'boolean' ? 'Yes'
          : Array.isArray(val) ? val.join(', ').slice(0, 80)
          : String(val).slice(0, 80);
        changes.push({ label, display });
      });

      if (updates.length) store.batchDispatch(updates);

      // Constraint synthesis from all collected facts (deduped)
      const allFacts = [...new Set(
        PRIORITY_ORDER.flatMap(k => docFiles[k]?.parsed?.facts || [])
      )];
      if (allFacts.length) {
        try {
          const synthesis = evaluateConstraints(allFacts);
          store.dispatch('site.investigation.synthesis', synthesis);
        } catch {}
      }

      setEstimatedFields({ area: false, frontage: false, depth: false });
      setAppliedFields(changes);
      setDocFiles({ vp: null, s32: null, fsp: null }); // reset file slots after apply
    } catch (e) {
      setExtractionError('Failed to apply: ' + (e.message || 'unknown error'));
    } finally {
      setExtractionProgress(false);
    }
  };

  const handleManualFieldEdit = (field, value) => {
    store.dispatch('site.' + field, Number(value) || 0);
    setEstimatedFields(prev => ({ ...prev, [field]: false }));
  };

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const SOVEREIGN_ACTION_STYLE = {
    height: 38,
    backgroundColor: '#007AFF',
    color: '#fff',
    fontWeight: 700,
    border: 'none',
    boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)'
  };

  const renderSiteMetrics = () => {
    if (!site.area && !site.frontage && !site.depth) return null;
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: T.sp.sm,
        padding: T.sp.md,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: T.r.sm,
        border: '1px solid rgba(255,255,255,0.08)',
        marginTop: T.sp.sm
      }}>
        {[
          { label: 'Area',     field: 'area',     unit: 'm2', val: site.area     },
          { label: 'Frontage', field: 'frontage', unit: 'm',  val: site.frontage },
          { label: 'Depth',    field: 'depth',    unit: 'm',  val: site.depth    },
        ].map(({ label, field, unit, val }) => (
          <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase' }}>
              {label}
              {estimatedFields[field] && <EstBadge />}
            </div>
            <input
              type="number"
              value={val || ''}
              onChange={(e) => handleManualFieldEdit(field, e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid ' + (estimatedFields[field] ? 'rgba(250,173,20,0.4)' : 'rgba(255,255,255,0.12)'),
                borderRadius: T.r.sm,
                color: '#fff',
                fontSize: T.fs.xs,
                fontWeight: 700,
                padding: '5px 8px',
                width: '100%',
                outline: 'none'
              }}
            />
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)' }}>{unit}</div>
          </div>
        ))}
        {(estimatedFields.area || estimatedFields.frontage || estimatedFields.depth) && (
          <div style={{ gridColumn: '1 / -1', fontSize: '10px', color: 'rgba(250,173,20,0.8)', marginTop: 2 }}>
            Estimated values shown above. Upload a Survey or Section 32 to replace with verified data.
          </div>
        )}
      </div>
    );
  };

  const renderSynthesis = () => {
    if (!terrainData) return null;
    const analysis = synthesizeSiteAnalysis(terrainData, site, planning);
    if (analysis.error) {
      return (
        <div style={{ color: '#ff4d4f', padding: T.sp.md, fontSize: T.fs.xs }}>{analysis.error}</div>
      );
    }

    const { yieldWaterfall, implicitCosts, summary, effectiveArea } = analysis;
    const anyEstimated = estimatedFields.area || estimatedFields.frontage || estimatedFields.depth;
    const hasDocIntel  = !!(site?.investigation?.synthesis);
    const dataSource   = hasDocIntel ? 'Document Intelligence' : anyEstimated ? 'Terrain Estimate' : 'Manual Input';
    const srcColor     = hasDocIntel ? '#2ecc71' : anyEstimated ? '#faad14' : '#007AFF';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md, marginBottom: T.sp.lg }}>

        {/* Yield Waterfall table */}
        <div style={{ backgroundColor: C.surface.card, borderRadius: T.r.md, border: '1px solid ' + C.surface.border, overflow: 'hidden' }}>
          <div style={{
            padding: T.sp.sm,
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderBottom: '1px solid ' + C.surface.border,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 800, fontSize: T.fs.xs, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sovereign Yield Waterfall (Spatial Deduction)
            </span>
            <span style={{
              fontSize: '9px', fontWeight: 700, color: srcColor,
              backgroundColor: srcColor + '18',
              border: '1px solid ' + srcColor + '44',
              borderRadius: 3, padding: '2px 6px',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              Source: {dataSource}
            </span>
          </div>
          <div style={{ padding: T.sp.md }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {yieldWaterfall.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                  borderBottom: i < yieldWaterfall.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}>
                  <div style={{ width: 120, fontSize: T.fs.xs, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
                    {step.label}
                  </div>
                  <div style={{ flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 2, position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, height: '100%',
                      width: ((step.remaining || step.value) / yieldWaterfall[0].value * 100) + '%',
                      backgroundColor: step.label === 'Total Site Area' ? '#007AFF' : '#ff4d4f',
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <div style={{ width: 100, textAlign: 'right', fontSize: T.fs.xs, fontWeight: 800, color: step.deduction ? '#ff4d4f' : '#fff' }}>
                    {step.deduction ? '-' + Math.round(step.deduction) + 'm2' : Math.round(step.value) + 'm2'}
                  </div>
                  <div style={{ width: 100, textAlign: 'right', fontSize: T.fs.sm, fontWeight: 800, color: '#fff' }}>
                    {step.remaining ? Math.round(step.remaining) + 'm2' : ''}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, textAlign: 'right', padding: '12px', backgroundColor: 'rgba(0,122,255,0.1)', borderRadius: T.r.sm, border: '1px solid rgba(0,122,255,0.3)' }}>
              <span style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.7)', marginRight: 8 }}>EFFECTIVE BUILDABLE AREA:</span>
              <span style={{ fontSize: T.fs.md, fontWeight: 800, color: '#007AFF' }}>{Math.round(effectiveArea)} m2</span>
            </div>
          </div>
        </div>

        {/* Implicit cost warnings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.xs }}>
          {implicitCosts.map((warn, i) => (
            <div key={i} style={{
              padding: T.sp.md, backgroundColor: C.surface.card, borderRadius: T.r.md,
              border: '1px solid ' + C.surface.border,
              borderLeft: '4px solid ' + (warn.type === 'CRITICAL' ? '#ff4d4f' : '#faad14'),
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: warn.type === 'CRITICAL' ? '#ff4d4f' : '#faad14' }}>
                  {warn.label}
                </div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#fff', backgroundColor: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4, textTransform: 'uppercase' }}>
                  {warn.impact}
                </div>
              </div>
              <div style={{ fontSize: T.fs.xs, color: C.text.secondary, lineHeight: 1.5 }}>{warn.message}</div>
            </div>
          ))}
        </div>

        {/* Sovereign Intelligence Summary */}
        <div style={{ padding: T.sp.md, backgroundColor: C.surface.card, border: '1px solid ' + C.surface.border, borderRadius: T.r.md, borderLeft: '4px solid ' + C.brand.main }}>
          <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: C.brand.main, marginBottom: 8 }}>Sovereign Intelligence Summary</div>
          <div style={{ color: C.text.secondary, fontSize: T.fs.xs, lineHeight: 1.6 }}>
            {typeof summary === 'string' ? summary : (summary && summary.text) || 'No synthesis available.'}
          </div>
        </div>
      </div>
    );
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
              <UIButton label="Clear" onClick={() => {
                setLookupAddr('');
                setTerrainData(null);
                setLocationData(null);
                setEstimatedFields({ area: false, frontage: false, depth: false });
                setExtractionError(null);
                setAppliedFields(null);
                setAnalysisStatus('idle');
                store.batchDispatch([
                  { path: 'site.address',                   value: '' },
                  { path: 'site.lat',                       value: null },
                  { path: 'site.lon',                       value: null },
                  { path: 'site.area',                      value: 0 },
                  { path: 'site.frontage',                  value: 0 },
                  { path: 'site.depth',                     value: 0 },
                  { path: 'site.investigation.terrainData', value: null },
                  { path: 'site.investigation.locationData',value: null },
                  { path: 'physical.slope',                 value: null },
                  { path: 'physical.aspect',                value: null },
                  { path: 'physical.elevationDelta',        value: null },
                  { path: 'physical.siteWorksCost',         value: 0 },
                  { path: 'physical.siteWorksCostOverridden', value: false },
                  // Reset all extracted planning fields so old data doesn't persist
                  { path: 'planning.zoneCode',          value: '' },
                  { path: 'planning.hasHO',             value: false },
                  { path: 'planning.hasVPO',            value: false },
                  { path: 'planning.hasSBO',            value: false },
                  { path: 'planning.hasBMO',            value: false },
                  { path: 'planning.hasEasementBoe',    value: false },
                  { path: 'planning.hasSingleCovenant', value: false },
                  { path: 'planning.hasS173',           value: false },
                  { path: 'planning.s173Details',       value: '' },
                  { path: 'planning.covenantDetails',   value: '' },
                  { path: 'site.investigation.synthesis', value: null },
                ]);
              }} variant="ghost" style={{ height: 38 }} />
              <UIButton
                label={analysisStatus === 'loading' ? 'Analyzing...' : 'Run Deep Analysis'}
                onClick={handleRunAnalysis}
                disabled={analysisStatus === 'loading' || !site.address}
                style={SOVEREIGN_ACTION_STYLE}
              />
            </div>

            {/* Address autocomplete dropdown */}
            {suggestions.length > 0 && (
              <div style={{
                backgroundColor: C.surface.card, border: '1px solid ' + C.surface.border,
                borderRadius: T.r.sm, zIndex: 100, boxShadow: T.sh.md,
                maxHeight: 200, overflowY: 'auto'
              }}>
                {suggestions.map(item => (
                  <div
                    key={item.id}
                    onClick={() => selectAddress(item)}
                    style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid ' + C.surface.border, fontSize: T.fs.xs, color: '#FFFFFF' }}
                  >
                    {item.name}
                  </div>
                ))}
              </div>
            )}

            {/* Error badge */}
            {analysisStatus === 'error' && (
              <div style={{ padding: '8px 12px', backgroundColor: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)', borderRadius: T.r.sm, fontSize: T.fs.xs, color: '#ff4d4f' }}>
                Analysis failed. Check your network connection and try again.
              </div>
            )}

            {/* Editable site metrics with estimated badges */}
            {renderSiteMetrics()}

            {/* Verify link — opens property.com.au listing search for the current address */}
            {site.address && (
              <div style={{ display: 'flex', gap: T.sp.sm, flexWrap: 'wrap', marginTop: 2 }}>
                <a
                  href={'https://www.property.com.au/search/find-properties?search-term=' + encodeURIComponent(site.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: T.fs.xxs,
                    color: '#007AFF',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    border: '1px solid rgba(0,122,255,0.3)',
                    borderRadius: T.r.sm,
                    backgroundColor: 'rgba(0,122,255,0.07)',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: 11 }}>↗</span> Verify on property.com.au
                </a>
                <a
                  href={'https://www.domain.com.au/sale/' + encodeURIComponent(site.address.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: T.fs.xxs,
                    color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: T.r.sm,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ fontSize: 11 }}>↗</span> Domain
                </a>
              </div>
            )}

            {/* Task #24: Location amenity score card */}
            <LocationScoreCard locationData={locationData} />
          </div>

          <div style={{ position: 'absolute', left: 10, top: '100%', width: 2, height: 24, background: 'linear-gradient(180deg, #007AFF 0%, rgba(0,122,255,0) 100%)', zIndex: 0 }} />
        </div>

        {/* Yield Waterfall / Synthesis */}
        {terrainData ? renderSynthesis() : (
          <div style={{
            padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.3)',
            fontSize: T.fs.xs, fontStyle: 'italic',
            backgroundColor: 'rgba(0,0,0,0.1)', borderBottom: '1px solid rgba(255,255,255,0.05)'
          }}>
            Awaiting site discovery to generate sovereign analysis...
          </div>
        )}

        {/* STEP 2 — Document Intelligence */}
        <div style={{
          padding: T.sp.md, backgroundColor: C.surface.card,
          borderRadius: '0 0 ' + T.r.md + 'px ' + T.r.md + 'px',
          border: '1px solid ' + C.surface.border, borderTop: 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ backgroundColor: '#007AFF', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>2</div>
            <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: '#FFFFFF' }}>Document Intelligence</div>
            <span style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginLeft: 4 }}>
              Upload VicPlan, Section 32, or Feasibility Report — fields update automatically
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>

            {/* Per-file upload cards */}
            {[
              { key: 'vp',  label: 'VicPlan Certificate',    hint: 'Planning certificate from SPEAR / council' },
              { key: 's32', label: 'Section 32 Vendor Statement', hint: 'Vendor statement / Contract of Sale' },
              { key: 'fsp', label: 'Feature & Level Survey Plan', hint: 'Registered surveyor plan — extracts lot area, frontage, depth, easements' },
            ].map(({ key, label, hint }) => {
              const slot = docFiles[key];
              const status = slot?.status || 'idle';
              const parsed = slot?.parsed;
              const fields = parsed?.fields || {};
              const facts  = parsed?.facts  || [];
              const conf   = parsed?.confidence || 0;

              // Build a quick findings summary (uses canonical field names from unified_engine)
              const zone = fields.zoneCode;
              const overlayNames = [
                fields.hasHO    && 'HO',
                fields.hasVPO   && 'VPO',
                fields.hasSBO   && 'SBO',
                fields.hasBMO   && 'BMO',
                fields.hasESO   && 'ESO',
                fields.hasDDO   && 'DDO',
                fields.hasSLO   && 'SLO',
                fields.hasACHO  && 'ACHO',
              ].filter(Boolean);
              const riskCount      = (fields.keyRisks || []).length;
              const hasS173        = fields.hasS173Agreement;
              const hasCovenant    = fields.hasSingleCovenant || fields.hasNoSubdivisionCovenant;
              const hasEase        = fields.hasEasement;
              const surveyArea     = key === 'fsp' && fields.siteArea     ? fields.siteArea     : null;
              const surveyFrontage = key === 'fsp' && fields.siteFrontage ? fields.siteFrontage : null;
              const surveyDepth    = key === 'fsp' && fields.siteDepth    ? fields.siteDepth    : null;
              const lotRef         = fields.lotRef || null;
              const councilRates   = fields.councilRates || null;

              const statusColor  = status === 'ready' ? '#2ecc71' : status === 'error' ? '#ff4d4f' : status === 'parsing' ? '#faad14' : 'rgba(255,255,255,0.2)';
              const borderColor  = status === 'ready' ? 'rgba(46,204,113,0.3)' : status === 'error' ? 'rgba(255,77,79,0.3)' : 'rgba(255,255,255,0.08)';

              return (
                <div key={key} style={{
                  backgroundColor: C.surface.panel,
                  border: '1px solid ' + borderColor,
                  borderRadius: T.r.md,
                  overflow: 'hidden',
                }}>
                  {/* File header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, padding: '10px 12px' }}>
                    {/* Status dot */}
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: T.fs.xs, fontWeight: 700, color: '#fff' }}>{label}</div>
                      {status === 'idle' && (
                        <div style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.35)' }}>{hint}</div>
                      )}
                      {status === 'parsing' && (
                        <div style={{ fontSize: T.fs.xxs, color: '#faad14' }}>Parsing "{slot.fileName}"…</div>
                      )}
                      {status === 'error' && (
                        <div style={{ fontSize: T.fs.xxs, color: '#ff4d4f' }}>Failed to parse "{slot?.fileName}" — try another file</div>
                      )}
                      {status === 'ready' && (
                        <div style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.5)' }}>
                          {slot.fileName} · {conf}% confidence
                        </div>
                      )}
                    </div>

                    {/* Upload / clear controls */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {status !== 'parsing' && (
                        <label style={{
                          cursor: 'pointer', fontSize: T.fs.xxs, fontWeight: 700,
                          padding: '4px 10px',
                          backgroundColor: status === 'ready' ? 'rgba(255,255,255,0.06)' : 'rgba(0,122,255,0.15)',
                          color: status === 'ready' ? 'rgba(255,255,255,0.5)' : '#007AFF',
                          border: '1px solid ' + (status === 'ready' ? 'rgba(255,255,255,0.1)' : 'rgba(0,122,255,0.3)'),
                          borderRadius: T.r.sm,
                        }}>
                          {status === 'ready' ? 'Replace' : 'Choose file'}
                          <input type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }}
                            onChange={(e) => handleDocUpload(e, key)} />
                        </label>
                      )}
                      {status === 'ready' && (
                        <button onClick={() => clearDocFile(key)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,255,255,0.3)', fontSize: 16, lineHeight: 1, padding: '2px 4px'
                        }}>×</button>
                      )}
                    </div>
                  </div>

                  {/* Findings panel — only when parsed and ready */}
                  {status === 'ready' && (
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      padding: '8px 12px',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      display: 'flex', flexWrap: 'wrap', gap: 6,
                    }}>
                      {/* Zone code */}
                      {zone && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(0,122,255,0.2)', color: '#60aaff', border: '1px solid rgba(0,122,255,0.35)' }}>
                          Zone: {zone}
                        </span>
                      )}
                      {/* Planning overlays */}
                      {overlayNames.map(ov => (
                        <span key={ov} style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(250,173,20,0.15)', color: '#faad14', border: '1px solid rgba(250,173,20,0.3)' }}>
                          {ov}
                        </span>
                      ))}
                      {/* Legal constraints */}
                      {hasS173 && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(231,76,60,0.15)', color: '#ff6b6b', border: '1px solid rgba(231,76,60,0.3)' }}>
                          S.173
                        </span>
                      )}
                      {hasCovenant && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(231,76,60,0.15)', color: '#ff6b6b', border: '1px solid rgba(231,76,60,0.3)' }}>
                          Covenant
                        </span>
                      )}
                      {hasEase && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(231,76,60,0.12)', color: '#ff9f7a', border: '1px solid rgba(231,76,60,0.25)' }}>
                          Easement{fields.easementWidthM ? ' ' + fields.easementWidthM + 'm' : ''}
                        </span>
                      )}
                      {/* Survey-specific dimension badges */}
                      {surveyArea && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.25)' }}>
                          Area: {surveyArea}m²
                        </span>
                      )}
                      {surveyFrontage && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.25)' }}>
                          Frontage: {surveyFrontage}m
                        </span>
                      )}
                      {surveyDepth && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.25)' }}>
                          Depth: {surveyDepth}m
                        </span>
                      )}
                      {/* Lot reference */}
                      {lotRef && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(0,184,212,0.12)', color: '#00b8d9', border: '1px solid rgba(0,184,212,0.25)' }}>
                          {lotRef}
                        </span>
                      )}
                      {/* Council rates from S32 */}
                      {councilRates && (
                        <span style={{ fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 7px', borderRadius: 12, backgroundColor: 'rgba(160,100,255,0.12)', color: '#b388ff', border: '1px solid rgba(160,100,255,0.25)' }}>
                          Council rates: ${Number(councilRates).toLocaleString()}/yr
                        </span>
                      )}
                      {/* Nothing detected */}
                      {!zone && overlayNames.length === 0 && !hasS173 && !hasCovenant && !hasEase && !surveyArea && !lotRef && (
                        <span style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                          No planning constraints detected — verify document content
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Error */}
            {extractionError && (
              <div style={{ padding: '9px 12px', backgroundColor: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)', borderRadius: T.r.sm, fontSize: T.fs.xs, color: '#ff4d4f', lineHeight: 1.5 }}>
                {extractionError}
              </div>
            )}

            {/* Apply button */}
            {hasReadyDoc && !appliedFields && (
              <button
                onClick={applyExtraction}
                disabled={extractionProgress}
                style={{
                  ...SOVEREIGN_ACTION_STYLE,
                  padding: '10px 18px',
                  borderRadius: T.r.md,
                  fontSize: T.fs.sm,
                  cursor: extractionProgress ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {extractionProgress
                  ? 'Applying…'
                  : '✓ Apply ' + pendingFieldCount + ' field' + (pendingFieldCount !== 1 ? 's' : '') + ' to project'
                }
              </button>
            )}

            {/* Post-apply confirmation */}
            {appliedFields && (
              <div style={{
                backgroundColor: 'rgba(46,204,113,0.08)',
                border: '1px solid rgba(46,204,113,0.3)',
                borderRadius: T.r.md,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '10px 14px',
                  borderBottom: appliedFields.length > 0 ? '1px solid rgba(46,204,113,0.15)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: T.fs.xs, fontWeight: 800, color: '#2ecc71' }}>
                    ✓ {appliedFields.length} field{appliedFields.length !== 1 ? 's' : ''} applied to project
                  </span>
                  <button onClick={() => setAppliedFields(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>×</button>
                </div>
                {appliedFields.length > 0 && (
                  <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {appliedFields.map((f, i) => (
                      <span key={i} style={{
                        fontSize: T.fs.xxs, padding: '3px 8px', borderRadius: 10,
                        backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ecc71',
                        border: '1px solid rgba(46,204,113,0.2)',
                      }}>
                        {f.label}: <strong>{f.display}</strong>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ padding: '6px 14px 10px', fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.4)' }}>
                  Check the Planning &amp; Zoning tab to review and adjust any values.
                </div>
              </div>
            )}

            {!hasReadyDoc && !appliedFields && (
              <div style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
                Upload at least one document above — extracted fields will appear here before you apply them.
              </div>
            )}
          </div>
        </div>

      </div>
    </UIPanel>
  );
};
