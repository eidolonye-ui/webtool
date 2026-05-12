/**
 * @file ui/components/SiteContextSidebar.jsx
 * @description Sticky sidebar: site identity, satellite map, confidence score card.
 * Map only re-centers when lat/lon actually changes (not on every state update).
 * @version 2.1.0 - Confidence Card + Map Perf Fix
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { C, SANS, MONO, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { ConfidenceEngine } from '../../domain/spatial/confidence_engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sanitizeAddress = (addr) => {
  if (!addr) return '';
  return addr.replace(/[^\x00-\x7F]+/g, '').replace(/\s+/g, ' ').trim();
};

const RATING_COLOR = { High: '#16a34a', Medium: '#d97706', Low: '#dc2626' };

const PILLAR_ICON = {
  'Site Data (Address, Area, Coordinates)':   'LOC',
  'Site Dimensions (Frontage & Depth)':       'DIM',
  'Planning (Zone)':                          'ZON',
  'Market Data (GRV per Unit)':               'MKT',
  'Financial Inputs (Land Price, Build Cost)':'FIN',
  'Document Intelligence (VicPlan/S32)':      'DOC',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Compact metric tile used in Site Identity card */
const MetricTile = ({ label, val, unit, accent }) => (
  <div style={{
    backgroundColor: accent ? 'rgba(0,122,255,0.1)' : 'rgba(255,255,255,0.06)',
    border: accent ? '1px solid rgba(0,122,255,0.3)' : '1px solid rgba(255,255,255,0.15)',
    borderRadius: T.r.sm,
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  }}>
    <span style={{ fontSize: 9, fontWeight: 700, color: accent ? '#007AFF' : 'rgba(255,255,255,0.8)', textTransform: 'uppercase' }}>
      {label}
    </span>
    <span style={{ fontSize: T.fs.xs, fontWeight: 800, color: accent ? '#007AFF' : '#FFFFFF', fontFamily: MONO }}>
      {val || 0} {unit}
    </span>
  </div>
);

/** ConfidenceEngine score card */
const ConfidenceCard = ({ scenario }) => {
  const result = useMemo(() => ConfidenceEngine.calculateScore(scenario), [scenario]);
  const { score, rating, breakdown } = result;
  const ratingColor = RATING_COLOR[rating] || '#888';

  const barFill = Math.min(100, Math.max(0, score));
  const barColor = barFill >= 85 ? '#16a34a' : barFill >= 55 ? '#d97706' : '#dc2626';

  return (
    <div style={{
      backgroundColor: 'rgba(0,0,0,0.25)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: T.r.md,
      padding: T.sp.md,
      display: 'flex',
      flexDirection: 'column',
      gap: T.sp.sm
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Data Confidence
        </span>
        <span style={{ fontSize: T.fs.sm, fontWeight: 900, color: ratingColor }}>
          {score}%
          <span style={{ fontSize: 9, fontWeight: 700, marginLeft: 4, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
            {rating}
          </span>
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: barFill + '%',
          backgroundColor: barColor,
          borderRadius: 99,
          transition: 'width 0.4s ease'
        }} />
      </div>

      {/* Pillar breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {breakdown.map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 8,
              fontWeight: 800,
              color: p.reliable ? '#16a34a' : 'rgba(255,255,255,0.3)',
              fontFamily: MONO,
              minWidth: 28,
              textAlign: 'center',
              backgroundColor: p.reliable ? 'rgba(22,163,74,0.15)' : 'rgba(255,255,255,0.05)',
              border: '1px solid ' + (p.reliable ? 'rgba(22,163,74,0.4)' : 'rgba(255,255,255,0.08)'),
              borderRadius: 3,
              padding: '1px 3px'
            }}>
              {PILLAR_ICON[p.name] || 'N/A'}
            </span>
            <span style={{
              fontSize: 9,
              color: p.reliable ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {p.name.split('(')[0].trim()}
            </span>
            <span style={{
              fontSize: 8,
              fontWeight: 800,
              color: p.reliable ? '#16a34a' : '#dc2626'
            }}>
              {p.reliable ? '+' + p.contribution : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const SiteContextSidebar = () => {
  const [appState, setAppState] = useState(() => store.getState());

  // Subscribe to store -- update only when state reference changes
  useEffect(() => {
    const unsub = store.subscribe((s) => setAppState(s));
    return () => unsub();
  }, []);

  // Derive site + scenario from store state
  const activeId = appState.system?.activeScenarioId;
  const scenario = appState.scenarios?.[activeId] || {};
  const site     = scenario.site || {};

  // Map DOM ref and Leaflet instance ref
  const mapRef       = useRef(null);
  const leafletMap   = useRef(null);
  const markerRef    = useRef(null);

  // Track previous coordinates to skip map updates when coords haven't changed
  const prevLatRef   = useRef(null);
  const prevLonRef   = useRef(null);

  // -------------------------------------------------------------------------
  // One-time Leaflet load + map init
  // -------------------------------------------------------------------------
  useEffect(() => {
    const loadLeaflet = async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id   = 'leaflet-css';
        link.rel  = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      if (!window.L) {
        await new Promise((resolve) => {
          const script = document.createElement('script');
          script.src   = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.async = true;
          script.onload = resolve;
          document.head.appendChild(script);
        });
      }
      initMap();
    };

    const initMap = () => {
      if (!mapRef.current || leafletMap.current) return;
      const L      = window.L;
      const lat    = parseFloat(site.lat) || -37.8136;
      const lon    = parseFloat(site.lon) || 144.9631;
      const center = [lat, lon];

      leafletMap.current = L.map(mapRef.current, {
        center,
        zoom: 19,
        zoomControl: false,
        attributionControl: false
      });

      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20
      }).addTo(leafletMap.current);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        opacity: 0.3
      }).addTo(leafletMap.current);

      if (site.lat && site.lon) {
        markerRef.current = L.marker(center).addTo(leafletMap.current);
        prevLatRef.current = site.lat;
        prevLonRef.current = site.lon;
      }
    };

    loadLeaflet();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Map update -- only when lat/lon actually changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!leafletMap.current || !window.L) return;
    if (!site.lat || !site.lon) return;

    // Skip update if coordinates haven't changed
    if (site.lat === prevLatRef.current && site.lon === prevLonRef.current) return;

    const L         = window.L;
    const newCenter = [parseFloat(site.lat), parseFloat(site.lon)];

    leafletMap.current.setView(newCenter, 19, { animate: true });

    // Remove old marker safely (collect first, then remove)
    if (markerRef.current) {
      leafletMap.current.removeLayer(markerRef.current);
      markerRef.current = null;
    }
    markerRef.current = L.marker(newCenter).addTo(leafletMap.current);

    prevLatRef.current = site.lat;
    prevLonRef.current = site.lon;
  }, [site.lat, site.lon]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div style={{
      width: '280px',
      height: 'calc(100vh - 120px)',
      position: 'sticky',
      top: '60px',
      display: 'flex',
      flexDirection: 'column',
      gap: T.sp.md,
      paddingRight: T.sp.md,
      overflowY: 'auto',
      borderRight: '1px solid ' + C.surface.border
    }}>

      {/* ------------------------------------------------------------------ */}
      {/* Site Identity Card                                                   */}
      {/* ------------------------------------------------------------------ */}
      <div style={{
        backgroundColor: C.surface.card,
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: T.r.md,
        padding: T.sp.md,
        boxShadow: T.sh.sm
      }}>
        <div style={{ fontWeight: 800, fontSize: T.fs.xs, color: 'rgba(255,255,255,0.9)', marginBottom: T.sp.sm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Site Identity
        </div>
        <div style={{ fontSize: T.fs.sm, fontWeight: 700, color: '#FFFFFF', marginBottom: T.sp.md, lineHeight: 1.4 }}>
          {sanitizeAddress(site.address) || 'No address locked'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.xs }}>
          <MetricTile label="Land Area" val={site.area}     unit="m2" />
          <MetricTile label="Frontage"  val={site.frontage} unit="m"  />
          <MetricTile label="Depth"     val={site.depth}    unit="m"  />
          <MetricTile
            label="Status"
            val={site.address ? 'LOCKED' : 'OPEN'}
            unit=""
            accent
          />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Confidence Score Card                                                */}
      {/* ------------------------------------------------------------------ */}
      <ConfidenceCard scenario={scenario} />

      {/* ------------------------------------------------------------------ */}
      {/* Interactive Satellite Map                                            */}
      {/* ------------------------------------------------------------------ */}
      <div style={{
        flex: 1,
        minHeight: 180,
        backgroundColor: C.surface.panel,
        borderRadius: T.r.md,
        border: '1px solid ' + C.surface.border,
        overflow: 'hidden',
        position: 'relative'
      }}>
        {site.address ? (
          <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: 180 }} />
        ) : (
          <div style={{
            height: 180,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.text ? C.text.secondary : '#888',
            fontSize: T.fs.xs,
            textAlign: 'center',
            padding: T.sp.md
          }}>
            <div style={{ fontSize: '28px', marginBottom: 10 }}>MAP</div>
            <div style={{ fontWeight: 800, color: C.text ? C.text.primary : '#fff', fontSize: T.fs.xs, textTransform: 'uppercase' }}>
              Geospatial Viewport
            </div>
            <div style={{ opacity: 0.5, marginTop: 6, lineHeight: 1.5, maxWidth: '160px', fontSize: 10 }}>
              Lock a site address to activate satellite imagery
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Sovereign Context Footer                                             */}
      {/* ------------------------------------------------------------------ */}
      <div style={{
        backgroundColor: 'rgba(0,122,255,0.05)',
        border: '1px solid rgba(0,122,255,0.2)',
        borderRadius: T.r.md,
        padding: T.sp.sm,
        fontSize: T.fs.xs,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, color: '#FFFFFF' }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            backgroundColor: '#2ECC71',
            boxShadow: '0 0 8px #2ECC71',
            animation: 'sidebar-pulse 2s infinite'
          }} />
          Sovereign Context
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
          Active Scenario: <strong style={{ color: '#fff' }}>{activeId || 'Default'}</strong>
        </div>
        <style>{`
          @keyframes sidebar-pulse {
            0%   { opacity: 0.4; }
            50%  { opacity: 1; }
            100% { opacity: 0.4; }
          }
        `}</style>
      </div>
    </div>
  );
};
