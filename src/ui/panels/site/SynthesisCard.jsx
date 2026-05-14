/**
 * @file ui/panels/site/SynthesisCard.jsx
 * @description Sovereign Yield Waterfall + Implicit Cost Warnings + Intelligence Summary.
 *   Extracted from SiteInvestigationPanel.jsx (Task #83).
 * @version 1.0.0
 */

import React from 'react';
import { C, T } from '../../../core/config/theme_v3.js';
import { synthesizeSiteAnalysis } from '../../../domain/spatial/synthesis_engine.js';

/**
 * @param {object} props
 * @param {object} props.terrainData     - Terrain engine result
 * @param {object} props.site            - Active scenario site slice
 * @param {object} props.planning        - Active scenario planning slice
 * @param {object} props.estimatedFields - { area: bool, frontage: bool, depth: bool }
 */
export const SynthesisCard = ({ terrainData, site, planning, estimatedFields }) => {
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
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
