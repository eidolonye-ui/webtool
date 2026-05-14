/**
 * @file ui/panels/site/LocationScoreCard.jsx
 * @description Location amenity score card — 5-pillar OSM breakdown with expand/collapse.
 * @version 1.0.0 — extracted from SiteInvestigationPanel.jsx (Task #81)
 */

import React from 'react';
import { T } from '../../../core/config/theme_v3.js';

/**
 * LocationScoreCard
 * @param {{ locationData: object|null }} props
 */
export const LocationScoreCard = ({ locationData }) => {
  const [expanded, setExpanded] = React.useState({});
  if (!locationData) return null;

  const { score, label, breakdown } = locationData;

  const scoreColor = score >= 80 ? '#2ecc71'
    : score >= 65 ? '#00b8d9'
    : score >= 50 ? '#faad14'
    : score >= 35 ? '#ff8c00'
    : '#ff4d4f';

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const SCORED = [
    { key: 'transport', label: 'Transport', icon: '🚆', weight: 30 },
    { key: 'education', label: 'Education', icon: '🎓', weight: 20 },
    { key: 'shopping',  label: 'Shopping',  icon: '🛒', weight: 20 },
    { key: 'lifestyle', label: 'Lifestyle', icon: '🌳', weight: 15 },
    { key: 'health',    label: 'Health',    icon: '🏥', weight: 15 },
  ];

  // Green <=500m, amber <=1500m, red beyond
  const distColor = (rawM) => {
    if (!rawM && rawM !== 0) return 'rgba(255,255,255,0.4)';
    return rawM <= 500 ? '#2ecc71' : rawM <= 1500 ? '#faad14' : '#ff6b6b';
  };

  const AmenityRow = ({ item }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
    }}>
      <span style={{ fontSize: 13, lineHeight: 1, minWidth: 18 }}>{item.icon}</span>
      <span style={{
        flex: 1, fontSize: '11px', color: 'rgba(255,255,255,0.8)', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {item.label || '—'}
        {item.type     && <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 5, fontSize: '10px' }}> ({item.type})</span>}
        {item.operator && <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 5, fontSize: '10px' }}>{item.operator}</span>}
        {item.ref      && <span style={{ color: '#00b8d9', marginLeft: 5, fontWeight: 700, fontSize: '10px' }}>#{item.ref}</span>}
      </span>
      <span style={{ fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', color: 'rgba(255,255,255,0.5)' }}>
        {item.dist}
      </span>
    </div>
  );

  // Private schools section — shows nearby private/independent/Catholic schools.
  // Users contact each school directly for bus route info (OSM school bus data is unreliable).
  const PrivateSchoolsSection = () => {
    const ps    = breakdown.privateSchools || {};
    const items = ps.items || [];
    const nk    = ps.nearestKey;
    return (
      <div style={{
        marginTop: 8,
        backgroundColor: 'rgba(120,80,200,0.04)',
        border: '1px solid rgba(120,80,200,0.18)',
        borderRadius: 6,
        overflow: 'hidden',
      }}>
        <div
          onClick={() => toggle('privateSchools')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>🏫</span>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>Nearby Private Schools</span>

          {nk ? (
            <span style={{
              fontSize: '10px', fontWeight: 700, color: distColor(nk.raw),
              backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 3, padding: '1px 6px',
            }}>
              {nk.name} · {nk.dist}
            </span>
          ) : (
            <span style={{
              fontSize: '10px', fontWeight: 600, color: 'rgba(255,255,255,0.3)',
              backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3, padding: '1px 6px',
            }}>
              none identified
            </span>
          )}

          <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
            {items.length} found · {expanded.privateSchools ? '▲' : '▼'}
          </span>
        </div>

        <div style={{ padding: '0 12px 8px 38px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
          {ps.detail}
        </div>

        {expanded.privateSchools && (
          <div style={{ padding: '4px 12px 12px 38px' }}>
            {items.length > 0 ? (
              <div>
                {items.map((item, i) => <AmenityRow key={i} item={item} />)}
                <div style={{
                  marginTop: 8, padding: '5px 8px',
                  backgroundColor: 'rgba(167,139,250,0.07)',
                  border: '1px solid rgba(167,139,250,0.2)',
                  borderRadius: 4,
                  fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6,
                }}>
                  <span style={{ color: '#a78bfa', fontWeight: 700, marginRight: 5 }}>Note:</span>
                  Private schools typically operate their own bus routes. Contact each school's transport office directly to confirm route availability, stops, and fees.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                No private/independent schools identified within 3 km via OSM. Check MySchool.edu.au for a complete local school list.
              </div>
            )}
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
      border: '1px solid rgba(255,255,255,0.08)',
    }}>

      {/* Overall score header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: T.fs.xs, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Location Score
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
            OSM data · 5 categories · 100 pts total
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: '26px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>/100</span>
          <span style={{
            fontSize: '10px', fontWeight: 800, color: scoreColor,
            backgroundColor: scoreColor + '18', border: '1px solid ' + scoreColor + '44',
            borderRadius: 4, padding: '2px 9px', marginLeft: 4,
            textTransform: 'uppercase', letterSpacing: '0.04em',
          }}>
            {label}
          </span>
        </div>
      </div>

      {/* Master score bar */}
      <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%', width: Math.min(100, score) + '%', backgroundColor: scoreColor,
          borderRadius: 3, transition: 'width 0.6s ease', boxShadow: '0 0 8px ' + scoreColor + '55',
        }} />
      </div>

      {/* Scored pillars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {SCORED.map(({ key, label: pLabel, icon }) => {
          const p      = breakdown[key] || { score: 0, max: 20, detail: '', items: [], nearestKey: null, thresholds: '' };
          const pct    = p.max > 0 ? Math.round((p.score / p.max) * 100) : 0;
          const barCol = pct >= 80 ? '#2ecc71' : pct >= 55 ? '#00b8d9' : pct >= 35 ? '#faad14' : '#ff4d4f';
          const isOpen = !!expanded[key];
          const items  = p.items || [];
          const nk     = p.nearestKey;

          return (
            <div key={key} style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}>
              {/* Collapsed header */}
              <div
                onClick={() => toggle(key)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: 14, lineHeight: 1, minWidth: 18 }}>{icon}</span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.85)', minWidth: 62 }}>
                  {pLabel}
                </span>

                {nk ? (
                  <span style={{
                    flex: 1, fontSize: '10px', fontWeight: 600, color: distColor(nk.raw),
                    backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 3, padding: '2px 7px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {nk.icon} {nk.name} · <strong>{nk.dist}</strong>
                  </span>
                ) : (
                  <span style={{
                    flex: 1, fontSize: '10px', fontWeight: 600,
                    color: 'rgba(255,100,100,0.7)', backgroundColor: 'rgba(255,80,80,0.06)',
                    border: '1px solid rgba(255,80,80,0.15)', borderRadius: 3, padding: '2px 7px',
                  }}>
                    None found in search radius
                  </span>
                )}

                <div style={{ width: 48, height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', width: pct + '%', backgroundColor: barCol, borderRadius: 2, transition: 'width 0.5s ease' }} />
                </div>

                <span style={{ fontSize: '11px', color: barCol, fontWeight: 900, minWidth: 38, textAlign: 'right', flexShrink: 0 }}>
                  {p.score}<span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>/{p.max}</span>
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', marginLeft: 2 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </div>

              {/* Detail line (always visible) */}
              <div style={{ padding: '0 10px 7px 38px', fontSize: '10px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                {p.detail}
              </div>

              {/* Expanded section */}
              {isOpen && (
                <div style={{ padding: '8px 10px 12px 38px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{
                    marginBottom: 10, padding: '6px 8px',
                    backgroundColor: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.2)',
                    borderRadius: 4, fontSize: '10px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7,
                  }}>
                    <span style={{ color: '#007AFF', fontWeight: 700, marginRight: 6 }}>Scoring criteria:</span>
                    {p.thresholds}
                  </div>
                  {items.length > 0
                    ? items.map((item, i) => <AmenityRow key={i} item={item} />)
                    : <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
                        No amenities found within the search radius.
                      </div>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Private schools section */}
      <PrivateSchoolsSection />

      {/* Attribution footer */}
      <div style={{
        marginTop: 10, fontSize: '9px', color: 'rgba(255,255,255,0.2)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Source: OpenStreetMap · Coverage varies by suburb</span>
        <span>Distances are straight-line (not road distance)</span>
      </div>
    </div>
  );
};
