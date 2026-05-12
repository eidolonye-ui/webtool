/**
 * @file ui/panels/PlanningPanel.jsx
 * @description Planning & Zoning Panel with live store subscription.
 * Displays extracted planning fields (zoneCode, overlays, S.173, covenant, easements)
 * and auto-fills maxHeight/coverage from zoning_rules.js when zoneCode is set.
 * @version 4.0.0
 */

import React, { useState, useEffect } from 'react';
import { UIPanel, UIInput } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { validateCompliance } from '../../domain/finance/compliance_engine.js';
import { ZONE_RULES } from '../../domain/data/zoning_rules.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Parse numeric value from zone string like "9m (2 storeys)" */
const parseZoneHeight = (str) => {
  if (!str) return null;
  const m = String(str).match(/^([\d.]+)/);
  return m ? parseFloat(m[1]) : null;
};

/** Parse numeric coverage from zone rules (default 60 for most residential) */
const parseZoneCoverage = (zoneCode) => {
  const coverageMap = {
    NRZ: 40, GRZ: 60, RGZ: 60, MUZ: 80,
    C1Z: 80, C2Z: 80, B1Z: 80, B2Z: 80,
    IN1Z: 80, IN3Z: 80, PPRZ: 5, FZ: 10
  };
  return coverageMap[zoneCode] ?? 60;
};

const ZoneBadge = ({ zoneCode, zoneRule }) => {
  if (!zoneCode) return null;
  const color = zoneRule?.color || '#6b7280';
  const pot = zoneRule?.devPotential || '—';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
      <span style={{
        background: color, color: '#fff', fontWeight: 700,
        fontSize: T.fs.sm, padding: '4px 12px', borderRadius: 20, letterSpacing: 1
      }}>{zoneCode}</span>
      {zoneRule && (
        <span style={{ fontSize: T.fs.xs, color: C.text.secondary, fontStyle: 'italic' }}>
          {zoneRule.label}
        </span>
      )}
      <span style={{
        fontSize: T.fs.xs, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
        background: pot === 'Premium' || pot === 'Maximum' ? '#16a34a22' :
                    pot === 'High' ? '#0ea5e922' : '#94a3b822',
        color: pot === 'Premium' || pot === 'Maximum' ? '#16a34a' :
               pot === 'High' ? '#0ea5e9' : '#64748b'
      }}>
        Dev Potential: {pot}
      </span>
    </div>
  );
};

const OverlayBadge = ({ label, icon, color }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    background: color + '22', border: `1px solid ${color}55`,
    color: color, fontSize: T.fs.xs, fontWeight: 700,
    padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap'
  }}>
    {icon} {label}
  </span>
);

const WarnBox = ({ icon, label, detail, color = '#dc2626' }) => (
  <div style={{
    display: 'flex', alignItems: 'flex-start', gap: 10,
    background: color + '11', border: `1px solid ${color}33`,
    borderLeft: `4px solid ${color}`, borderRadius: T.r.md,
    padding: '10px 12px'
  }}>
    <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
    <div>
      <div style={{ fontWeight: 700, fontSize: T.fs.xs, color }}>{label}</div>
      {detail && <div style={{ fontSize: T.fs.xxs, color: C.text.secondary, marginTop: 3 }}>{detail}</div>}
    </div>
  </div>
);

// ── main component ────────────────────────────────────────────────────────────

export const PlanningPanel = () => {
  const [planning, setPlanning] = useState(() => store.getActiveScenario()?.planning || {});
  const [site, setSite]         = useState(() => store.getActiveScenario()?.site || {});
  const [compliance, setCompliance] = useState([]);

  // ── live store subscription ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = store.subscribe(() => {
      const sc = store.getActiveScenario();
      setPlanning(sc?.planning || {});
      setSite(sc?.site || {});
    });
    return unsub;
  }, []);

  // ── auto-fill maxHeight + siteCoverage from zoneCode ──────────────────────
  useEffect(() => {
    const zoneCode = planning.zoneCode;
    if (!zoneCode) return;
    const rule = ZONE_RULES[zoneCode];
    if (!rule) return;

    const autoHeight   = parseZoneHeight(rule.maxHeight);
    const autoCoverage = parseZoneCoverage(zoneCode);

    // Only auto-fill if user has not overridden (value is 0 or absent)
    if (autoHeight && (!planning.maxHeight || planning.maxHeight === 0)) {
      store.dispatch('planning.maxHeight', autoHeight);
    }
    if (!planning.siteCoverage || planning.siteCoverage === 0) {
      store.dispatch('planning.siteCoverage', autoCoverage);
    }
  }, [planning.zoneCode]);

  // ── compliance audit ──────────────────────────────────────────────────────
  useEffect(() => {
    const zoneCode = planning.zoneCode;
    const rule = ZONE_RULES[zoneCode] || {};
    const zoningRules = {
      maxSiteCoverage: parseZoneCoverage(zoneCode),
      maxHeight:       parseZoneHeight(rule.maxHeight) || 9,
      minLotSize:      planning.minLotSize || 300
    };
    const audit = validateCompliance({
      siteCoverage: planning.siteCoverage,
      maxHeight:    planning.maxHeight,
      area:         site.area
    }, zoningRules);
    setCompliance(audit);
  }, [planning, site]);

  const updatePlanning = (field, value) => store.dispatch(`planning.${field}`, value);

  // ── derived display data ──────────────────────────────────────────────────
  const zoneCode = planning.zoneCode || '';
  const zoneRule = ZONE_RULES[zoneCode];

  const overlays = [
    { key: 'hasHO',           label: 'Heritage Overlay',   icon: '🏛️', color: '#7c3aed' },
    { key: 'hasVPO',          label: 'Vegetation Overlay', icon: '🌳', color: '#16a34a' },
    { key: 'hasSBO',          label: 'Flood Overlay',      icon: '🌊', color: '#0284c7' },
    { key: 'hasBMO',          label: 'Bushfire Overlay',   icon: '🔥', color: '#ea580c' },
  ].filter(o => planning[o.key]);

  const hasS173       = planning.hasS173;
  const hasCovenant   = planning.hasSingleCovenant;
  const hasEasement   = planning.hasEasementBoe;
  const s173Details   = planning.s173Details;
  const covenantDets  = planning.covenantDetails;

  const hasExtractionData = zoneCode || overlays.length > 0 || hasS173 || hasCovenant || hasEasement;

  return (
    <UIPanel
      title="Planning & Zoning"
      subtitle="Statutory controls and development potential"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>

        {/* ── Extracted Data Banner ─────────────────────────────────────── */}
        {hasExtractionData && (
          <div style={{
            background: '#0ea5e911', border: '1px solid #0ea5e944',
            borderRadius: T.r.md, padding: T.sp.md
          }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.xs, color: '#0ea5e9', marginBottom: 10 }}>
              ✅ Auto-Extracted from Document
            </div>

            {/* Zone Badge */}
            {zoneCode && <ZoneBadge zoneCode={zoneCode} zoneRule={zoneRule} />}

            {/* Overlays */}
            {overlays.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {overlays.map(o => (
                  <OverlayBadge key={o.key} label={o.label} icon={o.icon} color={o.color} />
                ))}
              </div>
            )}

            {/* Warnings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {hasS173 && (
                <WarnBox
                  icon="📋"
                  label="Section 173 Agreement"
                  detail={s173Details || 'A S.173 agreement is registered on title — verify restrictions with council before proceeding.'}
                  color="#7c3aed"
                />
              )}
              {hasCovenant && (
                <WarnBox
                  icon="🔒"
                  label="Single Dwelling Covenant"
                  detail={covenantDets || 'Title contains a single dwelling covenant — subdivision or multi-unit development may be prohibited.'}
                  color="#dc2626"
                />
              )}
              {hasEasement && (
                <WarnBox
                  icon="⚠️"
                  label="Easement Detected"
                  detail="An easement is registered on title. Verify width and type — this will reduce net developable area."
                  color="#d97706"
                />
              )}
            </div>

            {/* Zone Notes */}
            {zoneRule?.notes && (
              <div style={{
                fontSize: T.fs.xxs, color: C.text.secondary, fontStyle: 'italic',
                marginTop: 10, padding: '8px', background: C.surface.base, borderRadius: T.r.sm
              }}>
                💡 {zoneRule.notes}
              </div>
            )}
          </div>
        )}

        {/* ── Main Layout: Inputs + Compliance ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: T.sp.lg }}>

          {/* Input Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand.main, borderBottom: `1px solid ${C.surface.border}`, paddingBottom: T.sp.xs }}>
              Development Parameters
            </div>

            {/* Zone Code manual input */}
            <UIInput
              label="Zone Code"
              value={zoneCode}
              onChange={(v) => updatePlanning('zoneCode', v.toUpperCase().trim())}
              placeholder="e.g. GRZ, NRZ, RGZ, MUZ"
              isAutoFilled={!!zoneCode}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.md }}>
              <UIInput
                label="Max Building Height (m)"
                value={planning.maxHeight || ''}
                onChange={(v) => updatePlanning('maxHeight', parseFloat(v))}
                placeholder="e.g. 9"
                isAutoFilled={!!planning.maxHeight}
              />
              <UIInput
                label="Site Coverage (%)"
                value={planning.siteCoverage || ''}
                onChange={(v) => updatePlanning('siteCoverage', parseFloat(v))}
                placeholder="e.g. 60"
                isAutoFilled={!!planning.siteCoverage}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: T.sp.md }}>
              <UIInput
                label="Front Setback (m)"
                value={planning.setbacks?.front || ''}
                onChange={(v) => store.dispatch('planning.setbacks.front', parseFloat(v))}
                isAutoFilled={!!planning.setbacks?.front}
              />
              <UIInput
                label="Side Setback (m)"
                value={planning.setbacks?.side || ''}
                onChange={(v) => store.dispatch('planning.setbacks.side', parseFloat(v))}
                isAutoFilled={!!planning.setbacks?.side}
              />
              <UIInput
                label="Rear Setback (m)"
                value={planning.setbacks?.rear || ''}
                onChange={(v) => store.dispatch('planning.setbacks.rear', parseFloat(v))}
                isAutoFilled={!!planning.setbacks?.rear}
              />
            </div>

            <UIInput
              label="Minimum Lot Size (sqm)"
              value={planning.minLotSize || ''}
              onChange={(v) => updatePlanning('minLotSize', parseFloat(v))}
            />

            {/* Zone reference table */}
            {zoneRule && (
              <div style={{
                background: C.surface.elevated, border: `1px solid ${C.surface.border}`,
                borderRadius: T.r.md, padding: T.sp.md
              }}>
                <div style={{ fontWeight: 700, fontSize: T.fs.xs, color: C.text.primary, marginBottom: 8 }}>
                  📐 Zone {zoneCode} Reference
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px', fontSize: T.fs.xxs, color: C.text.secondary }}>
                  {[
                    ['Max Height', zoneRule.maxHeight],
                    ['Max Dwellings', zoneRule.maxDwellings],
                    ['Min Lot Size', zoneRule.minLot],
                    ['Setbacks',     zoneRule.setbacks],
                  ].map(([k, v]) => v ? (
                    <div key={k} style={{ padding: '3px 0', borderBottom: `1px solid ${C.surface.border}` }}>
                      <span style={{ fontWeight: 600 }}>{k}:</span> {v}
                    </div>
                  ) : null)}
                </div>
              </div>
            )}
          </div>

          {/* Compliance Sidebar */}
          <div style={{
            backgroundColor: C.surface.elevated,
            border: `1px solid ${C.surface.border}`,
            borderRadius: T.r.md,
            padding: T.sp.md,
            display: 'flex',
            flexDirection: 'column',
            gap: T.sp.md
          }}>
            <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.text.primary, display: 'flex', alignItems: 'center', gap: 8 }}>
              🛡️ Compliance Audit
            </div>

            {compliance.length === 0 ? (
              <div style={{ fontSize: T.fs.xs, color: C.text.muted, textAlign: 'center', padding: T.sp.md }}>
                Enter parameters to run audit...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
                {compliance.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px',
                      backgroundColor: '#fff1',
                      borderLeft: `4px solid ${item.status === 'ok' ? C.semantic.success : C.semantic.danger}`,
                      borderRadius: T.r.sm,
                      border: `1px solid ${C.surface.border}`,
                      borderLeftWidth: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.fs.xs, fontWeight: 700, marginBottom: 4 }}>
                      <span>{item.metric}</span>
                      <span style={{ color: item.status === 'ok' ? C.semantic.success : C.semantic.danger }}>
                        {item.status === 'ok' ? 'Compliant' : 'Violation'}
                      </span>
                    </div>
                    <div style={{ fontSize: T.fs.xxs, color: C.text.secondary }}>
                      Value: {item.value} / Limit: {item.limit}
                    </div>
                    <div style={{ fontSize: T.fs.xxs, color: item.status === 'ok' ? C.text.muted : C.semantic.danger, marginTop: 4, fontStyle: 'italic' }}>
                      {item.message}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Zone dev rating */}
            {zoneRule?.devRating !== undefined && (
              <div style={{ borderTop: `1px solid ${C.surface.border}`, paddingTop: T.sp.sm }}>
                <div style={{ fontSize: T.fs.xs, color: C.text.secondary, marginBottom: 6 }}>
                  Development Rating
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    flex: 1, height: 8, background: C.surface.border, borderRadius: 4, overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${zoneRule.devRating * 10}%`,
                      height: '100%',
                      background: zoneRule.devRating >= 8 ? '#16a34a' :
                                  zoneRule.devRating >= 5 ? '#0ea5e9' : '#f59e0b',
                      borderRadius: 4
                    }} />
                  </div>
                  <span style={{ fontSize: T.fs.xs, fontWeight: 700, color: C.text.primary, minWidth: 32 }}>
                    {zoneRule.devRating}/10
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </UIPanel>
  );
};
