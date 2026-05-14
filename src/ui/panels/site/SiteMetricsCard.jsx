/**
 * @file ui/panels/site/SiteMetricsCard.jsx
 * @description Lot dimensions card with estimated / Vicmap / OSM source badges.
 *   Extracted from SiteInvestigationPanel.jsx (Task #83).
 * @version 1.0.0
 */

import React from 'react';
import { T } from '../../../core/config/theme_v3.js';

/**
 * @param {object} props
 * @param {object} props.site            - Active scenario site slice { area, frontage, depth, ... }
 * @param {object} props.estimatedFields - { area: bool, frontage: bool, depth: bool }
 * @param {object} [props.terrainData]   - Terrain result (provides dataSource label)
 * @param {Function} props.onFieldEdit   - (field, value) => void
 */
export const SiteMetricsCard = ({ site, estimatedFields, terrainData, onFieldEdit }) => {
  if (!site.area && !site.frontage && !site.depth) return null;

  const anyEstimated = estimatedFields.area || estimatedFields.frontage || estimatedFields.depth;
  const allEstimated = estimatedFields.area && estimatedFields.frontage && estimatedFields.depth;
  const srcLabel     = terrainData?.dataSource || (anyEstimated ? 'Estimated' : 'Manual');
  const srcIsVicmap  = srcLabel === 'VICMAP';
  const srcIsOSM     = srcLabel?.startsWith('OSM');
  const srcColor     = srcIsVicmap ? '#2ecc71' : srcIsOSM ? '#00b8d9' : '#faad14';

  return (
    <div style={{
      borderRadius: T.r.sm,
      border: '1px solid ' + (anyEstimated ? 'rgba(250,173,20,0.25)' : 'rgba(255,255,255,0.08)'),
      overflow: 'hidden',
      marginTop: T.sp.sm
    }}>
      {/* Source header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px',
        backgroundColor: anyEstimated ? 'rgba(250,173,20,0.08)' : 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid ' + (anyEstimated ? 'rgba(250,173,20,0.15)' : 'rgba(255,255,255,0.06)')
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Lot Dimensions
        </span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: srcColor, letterSpacing: '0.03em' }}>
          {srcIsVicmap ? '✓ Vicmap Cadastre' : srcIsOSM ? '◉ OpenStreetMap' : '⚠ Suburb Estimate'}
        </span>
      </div>

      {/* Metric inputs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: T.sp.sm, padding: T.sp.md,
        backgroundColor: 'rgba(255,255,255,0.02)'
      }}>
        {[
          { label: 'Area',     field: 'area',     unit: 'm²', val: site.area     },
          { label: 'Frontage', field: 'frontage', unit: 'm',  val: site.frontage },
          { label: 'Depth',    field: 'depth',    unit: 'm',  val: site.depth    },
        ].map(({ label, field, unit, val }) => {
          const isEst = estimatedFields[field];
          return (
            <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: '10px', color: isEst ? 'rgba(250,173,20,0.8)' : 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase' }}>
                {label}
              </div>
              <input
                type="number"
                value={val || ''}
                onChange={(e) => onFieldEdit(field, e.target.value)}
                placeholder="—"
                style={{
                  background: isEst ? 'rgba(250,173,20,0.06)' : 'rgba(255,255,255,0.07)',
                  border: '1px solid ' + (isEst ? 'rgba(250,173,20,0.5)' : 'rgba(255,255,255,0.12)'),
                  borderRadius: T.r.sm,
                  color: isEst ? 'rgba(250,173,20,0.9)' : '#fff',
                  fontSize: T.fs.xs,
                  fontWeight: 700,
                  padding: '5px 8px',
                  width: '100%',
                  outline: 'none',
                  fontStyle: isEst ? 'italic' : 'normal',
                }}
              />
              <div style={{ fontSize: '9px', color: isEst ? 'rgba(250,173,20,0.5)' : 'rgba(255,255,255,0.3)' }}>
                {unit}{isEst ? ' · est.' : ''}
              </div>
            </div>
          );
        })}
      </div>

      {/* Warning banner — only shown for estimated values */}
      {anyEstimated && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(250,173,20,0.07)',
          borderTop: '1px solid rgba(250,173,20,0.15)',
          display: 'flex', alignItems: 'flex-start', gap: 8
        }}>
          <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>⚠</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'rgba(250,173,20,0.95)', fontWeight: 700, marginBottom: 2 }}>
              {allEstimated
                ? 'Accurate dimensions unavailable — no authoritative parcel data found'
                : 'Some dimensions are suburb-level estimates, not surveyed values'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(250,173,20,0.65)', lineHeight: 1.5 }}>
              Authoritative source: Upload a <strong style={{ color: 'rgba(250,173,20,0.9)' }}>Feature &amp; Level Survey Plan</strong> in
              Step 2 (Document Intelligence). Values shown in orange are interpolated from typical{' '}
              {terrainData?.dataSource === 'ESTIMATED' ? 'suburb averages' : 'building coverage ratios'} and may differ from the actual title.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
