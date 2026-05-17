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
    { key: 'hasHO',   label: 'Heritage Overlay (HO)',      icon: '🏛️', color: '#7c3aed' },
    { key: 'hasVPO',  label: 'Vegetation Overlay (VPO)',   icon: '🌳', color: '#16a34a' },
    { key: 'hasSBO',  label: 'Flood Overlay (SBO)',        icon: '🌊', color: '#0284c7' },
    { key: 'hasBMO',  label: 'Bushfire Overlay (BMO)',     icon: '🔥', color: '#ea580c' },
    { key: 'hasDDO',  label: 'Design & Dev Overlay (DDO)', icon: '📐', color: '#0891b2' },
    { key: 'hasSLO',  label: 'Landscape Overlay (SLO)',    icon: '🌄', color: '#65a30d' },
    { key: 'hasESO',  label: 'Environmental Overlay (ESO)',icon: '🌿', color: '#059669' },
    { key: 'hasACHO', label: 'Aboriginal Heritage (ACHO)', icon: '🪨', color: '#b45309' },
    { key: 'hasEMO',  label: 'Erosion Overlay (EMO)',      icon: '⛰️', color: '#92400e' },
  ].filter(o => planning[o.key]);

  const s32Processed           = planning.s32Processed;
  const hasS173                = planning.hasS173;
  const hasCovenant            = planning.hasSingleCovenant;
  const hasRestrictiveCovenant = planning.hasRestrictiveCovenant;
  const hasEasement            = planning.hasEasementBoe;
  const hasMortgage            = planning.hasMortgage;
  const hasMCP                 = planning.hasMCP;
  const hasPermit              = planning.hasPermit;
  const s173Details            = planning.s173Details;
  const covenantDets           = planning.covenantDetails;
  const restrictiveCovDets     = planning.restrictiveCovenantDesc;
  const easementDetails        = planning.easementDetails || '';
  const easementWidthM         = planning.easementWidthM  || '';
  const permitNo               = planning.permitNo        || '';
  const dealingNumbers = Array.isArray(planning.dealingNumbers) ? planning.dealingNumbers : [];

  const hasExtractionData = zoneCode || overlays.length > 0 || hasS173 || hasCovenant ||
    hasRestrictiveCovenant || hasEasement || hasPermit || dealingNumbers.length > 0 ||
    s32Processed;

  // S32 was processed but no covenant of any kind was found — this is critical positive info
  const s32NoCovenant = s32Processed && !hasCovenant && !hasRestrictiveCovenant && !hasS173;

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

              {/* ✅ No Covenant — explicitly confirmed by S32 scan */}
              {s32NoCovenant && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px',
                  backgroundColor: 'rgba(46,204,113,0.09)',
                  border: '1px solid rgba(46,204,113,0.35)',
                  borderLeft: '4px solid #2ecc71',
                  borderRadius: 6,
                }}>
                  <span style={{ fontSize: 16, lineHeight: 1 }}>✅</span>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 800, color: '#2ecc71', marginBottom: 3 }}>
                      No Restrictive Covenant Found on Title
                    </div>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
                      The Section 32 Vendor Statement has been scanned and <strong style={{ color: 'rgba(255,255,255,0.85)' }}>no restrictive covenant, single dwelling covenant, or Section 173 agreement</strong> was detected.
                      This is a positive indicator for development potential — however always confirm independently with your solicitor before proceeding.
                    </div>
                  </div>
                </div>
              )}

              {hasS173 && (
                <WarnBox
                  icon="📋"
                  label="Section 173 Agreement"
                  detail={s173Details || 'A S.173 agreement is registered on title — verify restrictions with council before proceeding.'}
                  color="#7c3aed"
                />
              )}
              {(hasCovenant || hasRestrictiveCovenant) && (() => {
                const raw = covenantDets || restrictiveCovDets || '';
                const dealingMatch = raw.match(/([A-Z]{1,2}\d{5,8})/);
                const dealingNo    = dealingMatch ? dealingMatch[1] : null;
                const isWholeLot   = /whole\s+or\s+part|as\s+to\s+whole/i.test(raw);
                const isSingleDwg  = hasCovenant || /single\s+dwelling|one\s+dwelling/i.test(raw);
                const isNoSubdiv   = /no\s+sub.?divis|shall\s+not\s+sub.?divis/i.test(raw);
                const scopeLabel   = isWholeLot ? 'Whole or part of lot' : 'Scope unspecified';
                return (
                  <div style={{ border: '1px solid rgba(220,38,38,0.4)', borderRadius: 6, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{
                      padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      backgroundColor: 'rgba(220,38,38,0.12)', borderBottom: '1px solid rgba(220,38,38,0.2)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14 }}>🔒</span>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 11, color: '#ff6b6b' }}>
                            {isSingleDwg ? 'Single Dwelling Covenant' : 'Restrictive Covenant'} — Title Encumbrance
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,107,107,0.7)', marginTop: 1 }}>
                            {isSingleDwg
                              ? 'Prohibits subdivision or multi-unit development — legal review required'
                              : 'Restricts use or development of the land — legal review required'}
                          </div>
                        </div>
                      </div>
                      {dealingNo && (
                        <span style={{
                          fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                          color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.08)',
                          padding: '2px 8px', borderRadius: 4,
                          border: '1px solid rgba(148,163,184,0.2)', flexShrink: 0
                        }}>Dealing {dealingNo}</span>
                      )}
                    </div>
                    {/* Parsed details */}
                    <div style={{ padding: '8px 12px', backgroundColor: 'rgba(220,38,38,0.04)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                        <span style={{ minWidth: 75, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Scope</span>
                        <span style={{ color: '#ff9f7a', fontWeight: 700 }}>{scopeLabel}</span>
                      </div>
                      {isSingleDwg && (
                        <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                          <span style={{ minWidth: 75, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Restriction</span>
                          <span style={{ color: '#ff9f7a', fontWeight: 700 }}>Single dwelling only — dual-occ and subdivision prohibited</span>
                        </div>
                      )}
                      {isNoSubdiv && !isSingleDwg && (
                        <div style={{ display: 'flex', gap: 8, fontSize: 10 }}>
                          <span style={{ minWidth: 75, color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>Restriction</span>
                          <span style={{ color: '#ff9f7a', fontWeight: 700 }}>No subdivision permitted under this covenant</span>
                        </div>
                      )}
                      {raw && (
                        <div style={{ display: 'flex', gap: 8, fontSize: 10, marginTop: 2 }}>
                          <span style={{ minWidth: 75, color: 'rgba(255,255,255,0.35)', fontWeight: 700, flexShrink: 0 }}>Instrument</span>
                          <span style={{ color: 'rgba(255,159,122,0.75)', fontStyle: 'italic', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{raw}</span>
                        </div>
                      )}
                      <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 4, backgroundColor: 'rgba(220,38,38,0.08)', fontSize: 9, color: 'rgba(255,100,80,0.8)', lineHeight: 1.5 }}>
                        ⚠ Legal advice required — covenants bind future owners and can be removed or varied only via VCAT or Supreme Court application.
                      </div>
                    </div>
                  </div>
                );
              })()}
              {hasEasement && (
                <WarnBox
                  icon="⚠️"
                  label={easementWidthM
                    ? `Easement on Title — ${easementWidthM} m wide`
                    : 'Easement on Title'}
                  detail={easementDetails || 'An easement is registered on title. Verify width and type — this will reduce net developable area.'}
                  color="#d97706"
                />
              )}
              {/* hasMortgage deliberately not shown — standard conveyancing, not a planning constraint */}
              {hasMCP && (
                <WarnBox
                  icon="📄"
                  label="Memorandum of Common Provisions"
                  detail="A Memorandum of Common Provisions (MCP) is referenced on title — review standard covenants that apply."
                  color="#0891b2"
                />
              )}
              {hasPermit && (
                <WarnBox
                  icon="🏗️"
                  label={permitNo ? `Planning Permit on Title — ${permitNo}` : 'Planning Permit on Title'}
                  detail="A planning permit is recorded on title. Review permit conditions — they may impose ongoing obligations."
                  color="#059669"
                />
              )}
            </div>

            {/* Dealing Numbers */}
            {dealingNumbers.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                  Title Dealings on Register
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {dealingNumbers.map(dn => (
                    <span key={dn} style={{
                      fontSize: 10,
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      color: '#94a3b8',
                      backgroundColor: 'rgba(148,163,184,0.08)',
                      border: '1px solid rgba(148,163,184,0.25)',
                      borderRadius: 4,
                      padding: '2px 7px',
                      letterSpacing: '0.04em'
                    }}>
                      {dn}
                    </span>
                  ))}
                </div>
              </div>
            )}

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
