/**
 * @file ui/panels/site/PersonaIntelligenceCard.jsx
 * @description Role Intelligence card — shows persona-specific site insights.
 * @version 1.0.0 — extracted from SiteInvestigationPanel.jsx (Task #81)
 */

import React from 'react';
import { C, T } from '../../../core/config/theme_v3.js';
import { getSiteInsights, PERSONA_CONFIG } from '../../../domain/spatial/siteInsightMapper.js';

/**
 * PersonaIntelligenceCard
 * @param {{ terrainData: object|null, planning: object, activePersona: string }} props
 */
export const PersonaIntelligenceCard = ({ terrainData, planning, activePersona }) => {
  if (!terrainData) return null;

  const data = {
    maxSlope:    terrainData.slope        ?? 0,
    aspect:      terrainData.aspect       ?? 'Unknown',
    zoning:      planning?.zoneCode       ?? 'NRZ',
    heightLimit: planning?.maxHeight      ?? 9,
    risks:       terrainData.risks        ?? [],
  };

  const pConfig = PERSONA_CONFIG[activePersona] || PERSONA_CONFIG.developer;
  const insight = getSiteInsights(data, activePersona);
  if (!insight) return null;

  const accentColor = pConfig.color || C.brand.main;

  return (
    <div style={{
      padding: T.sp.md,
      backgroundColor: C.surface.card,
      border: `1px solid ${C.surface.border}`,
      borderRadius: T.r.md,
      borderLeft: `4px solid ${accentColor}`,
      marginBottom: T.sp.md,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: T.sp.sm }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>{insight.primaryMetric?.icon}</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: accentColor }}>
              {pConfig.label} View — {pConfig.focus}
            </div>
            <div style={{ fontSize: T.fs.xxs, color: C.text.muted }}>Role-specific site analysis</div>
          </div>
        </div>
        <div style={{
          padding: '4px 12px', borderRadius: 20,
          background: `${accentColor}22`, border: `1px solid ${accentColor}55`,
          fontSize: T.fs.xxs, fontWeight: 800, color: accentColor,
        }}>
          {insight.primaryMetric?.label}: {insight.primaryMetric?.value}
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: T.sp.sm, marginBottom: T.sp.sm }}>
        {insight.metrics?.map((m, i) => (
          <div key={i} style={{
            padding: T.sp.sm, background: C.surface.elevated,
            borderRadius: T.r.sm, border: `1px solid ${C.surface.border}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: T.fs.xxs, color: C.text.muted, fontWeight: 700, textTransform: 'uppercase' }}>
                {m.label}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 4,
                background: m.impact === 'Critical' || m.impact === 'High' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.05)',
                color: m.impact === 'Critical' || m.impact === 'High' ? '#f59e0b' : C.text.muted,
              }}>
                {m.impact}
              </span>
            </div>
            <div style={{ fontWeight: 700, fontSize: T.fs.xs, color: C.text.primary, marginBottom: 2 }}>{m.value}</div>
            <div style={{ fontSize: 10, color: C.text.muted, lineHeight: 1.4 }}>{m.desc}</div>
          </div>
        ))}
      </div>

      {/* Strategic advice */}
      <div style={{
        padding: T.sp.sm, background: `${accentColor}11`,
        border: `1px solid ${accentColor}33`, borderRadius: T.r.sm,
        fontSize: T.fs.xs, color: C.text.secondary, lineHeight: 1.6,
      }}>
        💡 {insight.strategicAdvice}
      </div>
    </div>
  );
};

/** Inline badge shown next to auto-populated (estimated) field values */
export const EstBadge = () => (
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
    textTransform: 'uppercase',
  }}>
    Estimated
  </span>
);
