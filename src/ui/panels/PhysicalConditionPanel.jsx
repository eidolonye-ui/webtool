/**
 * @file ui/panels/PhysicalConditionPanel.jsx
 * @description Physical Site Analysis Panel with terrain-auto-populated fields.
 * @version 4.0.0 - Task #25: store subscription + auto-fill from terrain_engine
 *
 * Fields auto-populated from terrain analysis (after address selection):
 *   physical.slope          ← terrainResults.slope (%)
 *   physical.aspect         ← terrainResults.aspect (compass direction)
 *   physical.elevationDelta ← terrainResults.elevationDelta (m, rise across site)
 *   physical.siteWorksCost  ← estimated from slope (overrideable)
 */

import React, { useState, useEffect } from 'react';
import { UIPanel, UIInput, UITooltip } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';

// Aspect → friendly display + premium flag (north-facing is premium in Melbourne)
const aspectMeta = (aspect) => {
  if (!aspect) return { label: '—', premium: false };
  const a = aspect.toUpperCase();
  const premium = a.includes('N') && !a.includes('S');
  return {
    label: aspect,
    premium,
    tip: premium
      ? 'North-facing aspect — premium solar access, higher tenant appeal, positive impact on rental yield'
      : 'Check solar access. South-facing aspects may require design mitigation for natural light.',
  };
};

// Slope → label + impact
const slopeMeta = (slope) => {
  if (slope === undefined || slope === null || slope === '') return { label: '—', color: 'rgba(255,255,255,0.4)', impact: '' };
  const s = parseFloat(slope);
  if (s < 2)  return { label: 'Flat (< 2%)',           color: '#2ecc71', impact: 'Minimal earthworks required' };
  if (s < 5)  return { label: 'Gentle (2–5%)',          color: '#00b8d9', impact: 'Standard earthworks, no special footing' };
  if (s < 10) return { label: 'Moderate (5–10%)',       color: '#faad14', impact: 'Split-level design likely, +$15–25k site works' };
  if (s < 15) return { label: 'Steep (10–15%)',         color: '#ff7c2a', impact: 'Retaining walls required, +$30–50k site works' };
  return       { label: 'Very steep (> 15%)',           color: '#ff4d4f', impact: 'Major earthworks, site-specific engineering required' };
};

// Site works auto-estimate label
const worksLabel = (cost) => {
  if (!cost) return '';
  if (cost <= 8000)  return 'Flat site estimate';
  if (cost <= 15000) return 'Gentle slope estimate';
  if (cost <= 28000) return 'Moderate slope estimate';
  if (cost <= 45000) return 'Steep slope estimate';
  return 'Very steep — seek geotechnical advice';
};

export const PhysicalConditionPanel = () => {
  const [physical, setPhysical] = useState(store.getActiveScenario()?.physical || {});

  // Subscribe so terrain auto-dispatch re-renders this panel
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const active = store.getActiveScenario() || {};
      setPhysical(active.physical || {});
    });
    return () => unsubscribe();
  }, []);

  const updatePhysical = (field, value) => {
    store.dispatch('physical.' + field, value);
  };

  // When user manually overrides site works cost, record the flag so
  // auto-estimates from terrain don't overwrite it on re-analysis.
  const handleWorksOverride = (value) => {
    const num = parseFloat(value) || 0;
    store.dispatch('physical.siteWorksCost', num);
    store.dispatch('physical.siteWorksCostOverridden', num > 0);
  };

  const asp   = aspectMeta(physical.aspect);
  const slope = slopeMeta(physical.slope);
  const hasTerrainData = physical.slope !== undefined || physical.aspect;

  return (
    <UIPanel
      title="Physical Conditions"
      subtitle="Terrain analysis and site preparation costs"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>

        {/* Terrain auto-fill banner */}
        {hasTerrainData && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(0,184,212,0.08)',
            border: '1px solid rgba(0,184,212,0.25)',
            borderLeft: '4px solid #00b8d9',
            borderRadius: T.r.sm,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <span style={{ color: '#00b8d9', fontWeight: 700 }}>AUTO</span>
            Terrain data populated from Sovereign Site Analysis. Override any field manually.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.lg }}>

          {/* LEFT — Site Characteristics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand.main, borderBottom: '1px solid ' + C.surface.border, paddingBottom: T.sp.xs }}>
              Site Characteristics
            </div>

            {/* Slope */}
            <div>
              <UIInput
                label="Site Slope (%)"
                value={physical.slope !== undefined ? physical.slope : ''}
                onChange={(v) => updatePhysical('slope', parseFloat(v) || 0)}
                placeholder="e.g. 2.5"
                isAutoFilled={!!physical.slope}
              />
              {physical.slope !== undefined && physical.slope !== '' && (
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: '10px', fontWeight: 700,
                    color: slope.color,
                    backgroundColor: slope.color + '18',
                    border: '1px solid ' + slope.color + '44',
                    borderRadius: 3, padding: '2px 6px'
                  }}>
                    {slope.label}
                  </span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{slope.impact}</span>
                </div>
              )}
            </div>

            {/* Aspect (read-only from terrain, shown as info) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Solar Aspect
              </div>
              {physical.aspect ? (
                <div style={{
                  padding: '6px 10px',
                  backgroundColor: asp.premium ? 'rgba(46,204,113,0.08)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid ' + (asp.premium ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.1)'),
                  borderRadius: T.r.sm,
                  display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 700,
                    color: asp.premium ? '#2ecc71' : 'rgba(255,255,255,0.7)'
                  }}>
                    {asp.label}
                  </span>
                  {asp.premium && (
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#2ecc71', backgroundColor: 'rgba(46,204,113,0.15)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: 3, padding: '1px 5px' }}>
                      NORTH-FACING PREMIUM
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                  Auto-populated after address selection
                </div>
              )}
              {asp.tip && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{asp.tip}</div>
              )}
            </div>

            {/* Elevation Delta (read-only info) */}
            {physical.elevationDelta !== undefined && physical.elevationDelta !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Elevation Delta
                </div>
                <div style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: T.r.sm,
                  fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.75)'
                }}>
                  {parseFloat(physical.elevationDelta).toFixed(1)} m rise across site
                </div>
              </div>
            )}

            {/* Soil Type */}
            <UIInput
              label="Soil Type"
              value={physical.soilType || ''}
              onChange={(v) => updatePhysical('soilType', v)}
              placeholder="e.g. Reactive Clay"
              isAutoFilled={!!physical.soilType}
            />

            {/* Easements */}
            <div style={{ padding: T.sp.sm, backgroundColor: C.surface.elevated, borderRadius: T.r.md, border: '1px solid ' + C.surface.border }}>
              <div style={{ fontSize: T.fs.xs, fontWeight: 700, marginBottom: T.sp.xs }}>Easements & Covenants</div>
              <div style={{ fontSize: T.fs.xxs || '10px', color: C.text.muted }}>
                Enter documented easements (e.g. 2m wide sewage line at rear).
              </div>
              <UIInput
                label="Notes"
                value={physical.easements || ''}
                onChange={(v) => updatePhysical('easements', v)}
                style={{ marginTop: T.sp.sm }}
              />
            </div>
          </div>

          {/* RIGHT — Site Works Cost */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand.main, borderBottom: '1px solid ' + C.surface.border, paddingBottom: T.sp.xs }}>
              Detailed Site Works (Hard Costs)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm, backgroundColor: C.surface.elevated || 'rgba(255,255,255,0.04)', padding: T.sp.md, borderRadius: T.r.md, border: '1px solid ' + C.surface.border }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.fs.xs, marginBottom: T.sp.xs }}>
                <span>Excavation & Grading</span>
                <span style={{ fontWeight: 700 }}>
                  ${(physical.siteWorksCost || 0).toLocaleString()}
                  {physical.siteWorksCostOverridden && (
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: 6 }}>manual</span>
                  )}
                </span>
              </div>

              {/* Progress bar relative to a $70k max */}
              <div style={{ height: 4, backgroundColor: C.surface.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: Math.min(100, ((physical.siteWorksCost || 0) / 70000) * 100) + '%',
                  height: '100%',
                  backgroundColor: (physical.siteWorksCost || 0) > 30000 ? '#ff4d4f' : (physical.siteWorksCost || 0) > 15000 ? '#faad14' : C.brand.main,
                  borderRadius: 2,
                  transition: 'width 0.5s ease'
                }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <UIInput
                  label="Allocate Budget ($)"
                  value={physical.siteWorksCost || ''}
                  onChange={handleWorksOverride}
                  placeholder="Enter estimated cost"
                />
                <UITooltip
                  type={(physical.siteWorksCost || 0) > 30000 ? 'warn' : 'info'}
                  text={(physical.siteWorksCost || 0) > 30000
                    ? 'High cost: Steep slope detected. Seek geotechnical advice. Impacting IRR significantly.'
                    : 'Site works cost directly impacts Total Project Cost and IRR.'}
                />
              </div>

              {/* Auto-estimate label */}
              {!physical.siteWorksCostOverridden && physical.siteWorksCost > 0 && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                  Auto-estimated: {worksLabel(physical.siteWorksCost)}
                </div>
              )}
            </div>

            {/* Slope → cost breakdown explainer */}
            <div style={{ padding: T.sp.sm, backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: T.r.sm, border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Site Works Estimation Guide
              </div>
              {[
                { range: '< 2%',   cost: '~$8,000',   label: 'Flat' },
                { range: '2–5%',   cost: '~$15,000',  label: 'Gentle' },
                { range: '5–10%',  cost: '~$28,000',  label: 'Moderate' },
                { range: '10–15%', cost: '~$45,000',  label: 'Steep' },
                { range: '> 15%',  cost: '~$65,000+', label: 'Very Steep' },
              ].map(r => (
                <div key={r.range} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '3px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  fontSize: '10px'
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>{r.label} ({r.range})</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{r.cost}</span>
                </div>
              ))}
            </div>

            <div style={{ fontSize: T.fs.xs, color: C.text.muted, fontStyle: 'italic', textAlign: 'right' }}>
              * Site works cost directly impacts Total Project Cost and IRR.
            </div>
          </div>
        </div>
      </div>
    </UIPanel>
  );
};
