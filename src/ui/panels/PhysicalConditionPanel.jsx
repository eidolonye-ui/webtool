/**
 * @file ui/panels/PhysicalConditionPanel.jsx
 * @description Physical Site Analysis Panel — terrain auto-fill + FSP directional slope + easement cards.
 * @version 5.0.0 - Task #91: directional slope (front→rear, left→right), enriched easement cards,
 *                  frontage/depth display from terrain or FSP, cross-fall labelling.
 */

import React, { useState, useEffect } from 'react';
import { UIPanel, UIInput, UITooltip } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';

// ─── Helpers ───────────────────────────────────────────────────────────────────

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

const slopeMeta = (slope) => {
  if (slope === undefined || slope === null || slope === '')
    return { label: '—', color: 'rgba(255,255,255,0.4)', impact: '' };
  const s = parseFloat(slope);
  if (s < 2)  return { label: 'Flat (< 2%)',       color: '#2ecc71', impact: 'Minimal earthworks required' };
  if (s < 5)  return { label: 'Gentle (2–5%)',      color: '#00b8d9', impact: 'Standard earthworks, no special footing' };
  if (s < 10) return { label: 'Moderate (5–10%)',   color: '#faad14', impact: 'Split-level design likely, +$15–25k site works' };
  if (s < 15) return { label: 'Steep (10–15%)',     color: '#ff7c2a', impact: 'Retaining walls required, +$30–50k site works' };
  return       { label: 'Very steep (> 15%)',       color: '#ff4d4f', impact: 'Major earthworks, site-specific engineering required' };
};

const worksLabel = (cost) => {
  if (!cost) return '';
  if (cost <= 8000)  return 'Flat site estimate';
  if (cost <= 15000) return 'Gentle slope estimate';
  if (cost <= 28000) return 'Moderate slope estimate';
  if (cost <= 45000) return 'Steep slope estimate';
  return 'Very steep — seek geotechnical advice';
};

// Cross-fall label for left→right delta
const crossFallLabel = (delta) => {
  if (delta == null) return null;
  const d = parseFloat(delta);
  if (d < 0.2) return { text: 'Essentially flat', color: '#2ecc71' };
  if (d < 0.5) return { text: 'Minor cross-fall', color: '#00b8d9' };
  if (d < 1.0) return { text: 'Moderate cross-fall', color: '#faad14' };
  return           { text: 'Notable cross-fall', color: '#ff7c2a' };
};

// Boundary → friendly direction label
const boundaryLabel = (bnd) => {
  if (!bnd) return '';
  const map = { rear: 'Rear', front: 'Front', left: 'Left side', right: 'Right side',
                north: 'North', south: 'South', east: 'East', west: 'West' };
  return map[bnd.toLowerCase()] || bnd;
};

// ─── Component ─────────────────────────────────────────────────────────────────

export const PhysicalConditionPanel = () => {
  const [physical, setPhysical] = useState(store.getActiveScenario()?.physical || {});
  const [site, setSite]         = useState(store.getActiveScenario()?.site || {});

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const active = store.getActiveScenario() || {};
      setPhysical(active.physical || {});
      setSite(active.site || {});
    });
    return () => unsubscribe();
  }, []);

  const updatePhysical = (field, value) => store.dispatch('physical.' + field, value);

  const handleWorksOverride = (value) => {
    const num = parseFloat(value) || 0;
    store.dispatch('physical.siteWorksCost', num);
    store.dispatch('physical.siteWorksCostOverridden', num > 0);
  };

  const asp            = aspectMeta(physical.aspect);
  const slope          = slopeMeta(physical.slope);
  const hasTerrainData = physical.slope !== undefined || physical.aspect;

  // Frontage/depth: FSP (site.frontage) wins, then terrain estimate
  const frontage  = site.frontage  || null;
  const depth     = site.depth     || null;

  // Directional slope (from FSP labelled AHD corners)
  const ftrDelta  = physical.frontToRearDelta  != null ? parseFloat(physical.frontToRearDelta)  : null;
  const ltrDelta  = physical.leftToRightDelta  != null ? parseFloat(physical.leftToRightDelta)  : null;
  const crossFall = crossFallLabel(ltrDelta);

  // Enriched easement array from FSP
  const siteEasements = Array.isArray(physical.siteEasements) ? physical.siteEasements : [];

  return (
    <UIPanel
      title="Physical Conditions"
      subtitle="Terrain analysis and site preparation costs"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>

        {/* Auto-fill banner */}
        {hasTerrainData && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: 'rgba(0,184,212,0.08)',
            border: '1px solid rgba(0,184,212,0.25)',
            borderLeft: '4px solid #00b8d9',
            borderRadius: T.r.sm,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.65)',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: '#00b8d9', fontWeight: 700 }}>AUTO</span>
            Terrain data populated from Sovereign Site Analysis. Override any field manually.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.lg }}>

          {/* ── LEFT — Site Characteristics ──────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand.main, borderBottom: '1px solid ' + C.surface.border, paddingBottom: T.sp.xs }}>
              Site Characteristics
            </div>

            {/* Frontage + Depth row */}
            {(frontage || depth) && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.sm }}>
                {[
                  { label: '面宽 Frontage', value: frontage, unit: 'm' },
                  { label: '进深 Depth',    value: depth,    unit: 'm' },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {label}
                    </div>
                    <div style={{
                      padding: '6px 10px',
                      backgroundColor: 'rgba(0,184,212,0.07)',
                      border: '1px solid rgba(0,184,212,0.2)',
                      borderRadius: T.r.sm,
                      fontSize: '13px', fontWeight: 700, color: '#00b8d9',
                    }}>
                      {value != null ? `${parseFloat(value).toFixed(2)} ${unit}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

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
                    borderRadius: 3, padding: '2px 6px',
                  }}>
                    {slope.label}
                  </span>
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{slope.impact}</span>
                </div>
              )}
            </div>

            {/* Directional slope card — shown when FSP provided corner AHD data */}
            {(ftrDelta != null || ltrDelta != null) && (
              <div style={{
                padding: '10px 12px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderLeft: '3px solid #faad14',
                borderRadius: T.r.sm,
                display: 'flex', flexDirection: 'column', gap: 6,
              }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                  Slope Direction (from FSP)
                </div>

                {/* Front → Rear */}
                {ftrDelta != null && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Front → Rear</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#faad14' }}>
                      {ftrDelta.toFixed(2)}m drop
                      {depth ? <span style={{ fontWeight: 400, fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>over {depth}m</span> : null}
                    </span>
                  </div>
                )}

                {/* Left → Right cross-fall */}
                {ltrDelta != null && crossFall && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Left → Right</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: crossFall.color }}>
                        {ltrDelta.toFixed(2)}m
                      </span>
                      <span style={{
                        fontSize: '9px', fontWeight: 700,
                        color: crossFall.color,
                        backgroundColor: crossFall.color + '18',
                        border: '1px solid ' + crossFall.color + '44',
                        borderRadius: 3, padding: '1px 5px',
                      }}>
                        {crossFall.text}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Aspect */}
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
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: asp.premium ? '#2ecc71' : 'rgba(255,255,255,0.7)' }}>
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

            {/* Elevation Delta (overall, read-only) */}
            {physical.elevationDelta !== undefined && physical.elevationDelta !== null && ftrDelta == null && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Elevation Delta
                </div>
                <div style={{
                  padding: '6px 10px',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: T.r.sm,
                  fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.75)',
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

            {/* ── Easements ──────────────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
              <div style={{ fontWeight: 700, fontSize: T.fs.xs, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Easements
              </div>

              {/* Enriched easement cards from FSP */}
              {siteEasements.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
                  {siteEasements.map((e, i) => (
                    <div key={i} style={{
                      padding: '9px 12px',
                      backgroundColor: 'rgba(217,119,6,0.07)',
                      border: '1px solid rgba(217,119,6,0.25)',
                      borderLeft: '3px solid #d97706',
                      borderRadius: T.r.sm,
                    }}>
                      {/* Title row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706' }}>
                          {e.type || 'Easement'}
                        </span>
                        {e.widthM && (
                          <span style={{
                            fontSize: '10px', fontWeight: 700, color: '#d97706',
                            backgroundColor: 'rgba(217,119,6,0.15)',
                            border: '1px solid rgba(217,119,6,0.3)',
                            borderRadius: 3, padding: '1px 6px',
                          }}>
                            {e.widthM}m wide
                          </span>
                        )}
                      </div>

                      {/* Boundary position */}
                      {e.boundary && (
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>
                          <span style={{ color: 'rgba(255,255,255,0.35)' }}>Along: </span>
                          {boundaryLabel(e.boundary)} boundary
                          {e.widthM && (
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>
                              {' '}— {e.widthM}m from boundary line inward
                            </span>
                          )}
                        </div>
                      )}

                      {/* Affected area */}
                      {e.affectedAreaM2 != null && (
                        <div style={{ fontSize: '10px', color: '#faad14', fontWeight: 600 }}>
                          ~{e.affectedAreaM2} m² affected
                          {e.widthM && frontage && (e.boundary === 'rear' || e.boundary === 'front') && (
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                              {' '}({e.widthM}m × {parseFloat(frontage).toFixed(1)}m frontage)
                            </span>
                          )}
                          {e.widthM && depth && (e.boundary === 'left' || e.boundary === 'right' || e.boundary === 'side') && (
                            <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                              {' '}({e.widthM}m × {parseFloat(depth).toFixed(1)}m depth)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Raw description */}
                      {e.desc && (
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
                          {e.desc.slice(0, 120)}{e.desc.length > 120 ? '…' : ''}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* Fallback: editable notes field (no FSP data yet) */
                <div style={{ padding: T.sp.sm, backgroundColor: C.surface.elevated, borderRadius: T.r.md, border: '1px solid ' + C.surface.border }}>
                  <div style={{ fontSize: T.fs.xxs || '10px', color: C.text.muted, marginBottom: T.sp.xs }}>
                    Upload a Feature &amp; Level Survey Plan to auto-populate easement details,
                    or enter manually below.
                  </div>
                  <UIInput
                    label="Notes"
                    value={
                      Array.isArray(physical.easements)
                        ? physical.easements.map(e =>
                            `${e.type || 'Easement'}${e.widthM ? ' (' + e.widthM + 'm wide)' : ''}${e.desc ? ': ' + e.desc : ''}`
                          ).join('\n')
                        : (physical.easements || '')
                    }
                    onChange={(v) => updatePhysical('easements', v)}
                    style={{ marginTop: T.sp.sm }}
                  />
                </div>
              )}
            </div>

          </div>

          {/* ── RIGHT — Site Works Cost ───────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand.main, borderBottom: '1px solid ' + C.surface.border, paddingBottom: T.sp.xs }}>
              Detailed Site Works (Hard Costs)
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm, backgroundColor: C.surface.elevated || 'rgba(255,255,255,0.04)', padding: T.sp.md, borderRadius: T.r.md, border: '1px solid ' + C.surface.border }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.fs.xs, marginBottom: T.sp.xs }}>
                <span>Excavation &amp; Grading</span>
                <span style={{ fontWeight: 700 }}>
                  ${(physical.siteWorksCost || 0).toLocaleString()}
                  {physical.siteWorksCostOverridden && (
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 400, marginLeft: 6 }}>manual</span>
                  )}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, backgroundColor: C.surface.border, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  width: Math.min(100, ((physical.siteWorksCost || 0) / 70000) * 100) + '%',
                  height: '100%',
                  backgroundColor: (physical.siteWorksCost || 0) > 30000 ? '#ff4d4f' : (physical.siteWorksCost || 0) > 15000 ? '#faad14' : C.brand.main,
                  borderRadius: 2,
                  transition: 'width 0.5s ease',
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

              {!physical.siteWorksCostOverridden && physical.siteWorksCost > 0 && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                  Auto-estimated: {worksLabel(physical.siteWorksCost)}
                </div>
              )}
            </div>

            {/* Estimation guide */}
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
                  fontSize: '10px',
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
