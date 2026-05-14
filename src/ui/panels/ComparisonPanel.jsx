/**
 * @file ui/panels/ComparisonPanel.jsx
 * @description Stage 5 — Multi-scenario strategy matrix + bilateral delta view.
 * @version 3.1.0 - Fix: file corruption repaired; C.text.secondary → '#64748b' for
 *                  light-table readability; C.ink resolved via theme_v3 ink alias.
 */

import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../core/store/store';
import {
  buildStrategyMatrix,
  calculateScenarioDelta,
  STRATEGY_PRESETS,
  MATRIX_METRICS,
} from '../../domain/finance/comparison_engine';
import { UIPanel, UIButton } from '../components/Common_V2';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { ConfidenceEngine } from '../../domain/spatial/confidence_engine.js';

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const fmtCell = (value, fmt) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (fmt === 'currency') {
    if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(value) >= 1_000)     return '$' + Math.round(value).toLocaleString();
    return '$' + value.toFixed(0);
  }
  if (fmt === 'pct')    return value.toFixed(1) + '%';
  if (fmt === 'number') return String(Math.round(value));
  return String(value);
};

const fmtDiff = (diff, fmt) => {
  if (!Number.isFinite(diff)) return '—';
  const sign = diff >= 0 ? '+' : '';
  if (fmt === 'currency') {
    if (Math.abs(diff) >= 1_000_000) return sign + '$' + (diff / 1_000_000).toFixed(2) + 'M';
    if (Math.abs(diff) >= 1_000)     return sign + '$' + Math.round(diff).toLocaleString();
    return sign + '$' + diff.toFixed(0);
  }
  if (fmt === 'pct') return sign + diff.toFixed(1) + '%';
  return sign + Math.round(diff).toString();
};

// ─────────────────────────────────────────────────────────────────────────────
// Integrity score (uses ConfidenceEngine)
// ─────────────────────────────────────────────────────────────────────────────

const scenarioIntegrity = (scenario) => {
  if (!scenario) return 0;
  return ConfidenceEngine.calculateScore(scenario)?.score || 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// Strategy seed helper
// ─────────────────────────────────────────────────────────────────────────────

const seedStrategy = (strategyKey) => {
  const preset = STRATEGY_PRESETS[strategyKey];
  if (!preset) return;

  const activeId = store.getState().system.activeScenarioId;
  const baseName = preset.label + ' — ' + (store.getActiveScenario()?.site?.address?.split(',')[0] || 'Site');
  const safeName = baseName.slice(0, 40).replace(/[^\w\s]/g, '').trim();

  const prevId = activeId;
  const newId  = store.createScenario(safeName);

  const updates = [
    { path: 'label',        value: preset.label },
    { path: 'strategyType', value: preset.strategyType },
    ...preset.overrides,
  ];
  store.batchDispatch(updates);
  store.setActiveScenario(prevId);
  return newId;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const ScenarioColumnHeader = ({ id, scenario, isActive, onActivate }) => {
  const integrity = scenarioIntegrity(scenario);
  const label     = scenario?.label || id.replace(/_/g, ' ').toUpperCase();
  const strat     = scenario?.strategyType;
  const icon      = strat && STRATEGY_PRESETS[strat]?.icon;

  return (
    <th
      style={{
        padding: '10px 8px',
        background: isActive ? '#0f4c7522' : '#1e293b',
        border: '1px solid ' + C.surface.border,
        minWidth: 140,
        textAlign: 'center',
        cursor: 'pointer',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}
      onClick={onActivate}
    >
      <div style={{ fontSize: 16, marginBottom: 2 }}>{icon || '📋'}</div>
      <div style={{ fontWeight: 700, fontSize: 11, color: C.text.primary, lineHeight: 1.3 }}>{label}</div>
      {strat && (
        <div style={{ fontSize: 9, color: C.text.muted, marginTop: 2 }}>
          {STRATEGY_PRESETS[strat]?.label || strat}
        </div>
      )}
      <div style={{
        marginTop: 5, display: 'inline-block', padding: '2px 6px', borderRadius: 99,
        fontSize: 9, fontWeight: 700,
        background: integrity >= 70 ? 'rgba(22,163,74,0.2)' : integrity >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(220,38,38,0.2)',
        color: integrity >= 70 ? '#4ade80' : integrity >= 40 ? '#fbbf24' : '#f87171',
      }}>
        {integrity}% data
      </div>
      {isActive && (
        <div style={{ fontSize: 9, color: '#38bdf8', fontWeight: 700, marginTop: 2 }}>● ACTIVE</div>
      )}
    </th>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Matrix View
// ─────────────────────────────────────────────────────────────────────────────

const MatrixView = ({ state }) => {
  const scenarios = state.scenarios;
  const activeId  = state.system.activeScenarioId;
  const matrix    = useMemo(() => buildStrategyMatrix(scenarios), [scenarios]);
  const ids       = Object.keys(scenarios);

  const noData = ids.every(id => !scenarios[id]?.calculations?.total);

  return (
    <div>
      {/* Strategy seeding */}
      <div style={{
        marginBottom: T.sp.lg, padding: T.sp.md,
        background: 'rgba(14,165,233,0.08)', borderRadius: T.r.md,
        border: '1px solid rgba(14,165,233,0.2)',
      }}>
        <div style={{ fontSize: T.fs.xs, fontWeight: 700, color: '#38bdf8', marginBottom: T.sp.sm }}>
          ⚡ Add Strategy — clone current site with pre-set parameters
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: T.sp.sm }}>
          {Object.entries(STRATEGY_PRESETS).map(([key, preset]) => (
            <button
              key={key}
              onClick={() => seedStrategy(key)}
              style={{
                padding: '6px 12px', border: '1px solid rgba(14,165,233,0.3)',
                borderRadius: T.r.sm, background: 'rgba(255,255,255,0.05)',
                cursor: 'pointer', fontSize: T.fs.xs, fontFamily: SANS,
                color: C.text.secondary, display: 'flex', alignItems: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(14,165,233,0.15)'; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = C.text.secondary; }}
              title={preset.description}
            >
              <span>{preset.icon}</span>
              <span style={{ fontWeight: 600 }}>{preset.label}</span>
            </button>
          ))}
        </div>
        <div style={{ fontSize: 10, color: C.text.muted, marginTop: 6 }}>
          Hover buttons for description. After adding, go to Finance tab to update parameters, then return here.
        </div>
      </div>

      {noData && (
        <div style={{
          padding: T.sp.lg, textAlign: 'center', color: C.text.muted,
          fontSize: T.fs.sm, border: '2px dashed ' + C.surface.border,
          borderRadius: T.r.lg, marginBottom: T.sp.lg,
        }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>📊</div>
          <p>No calculated financial data yet. Enter land price, GRV, and build cost in the Finance tab, then return here.</p>
        </div>
      )}

      {/* Ranking summary bar */}
      {ids.length > 1 && (
        <div style={{ display: 'flex', gap: T.sp.sm, marginBottom: T.sp.md, flexWrap: 'wrap' }}>
          {ids.map((id) => {
            const sc     = scenarios[id];
            const margin = sc?.calculations?.margin || 0;
            const profit = sc?.calculations?.profit || 0;
            const label  = sc?.label || id.replace(/_/g, ' ');
            const strat  = sc?.strategyType;
            const icon   = (strat && STRATEGY_PRESETS[strat]?.icon) || '📋';
            return (
              <div
                key={id}
                style={{
                  flex: 1, minWidth: 110, padding: '8px 10px',
                  background: id === activeId ? 'rgba(15,76,117,0.3)' : C.surface.elevated,
                  border: '1px solid ' + (id === activeId ? 'rgba(56,189,248,0.4)' : C.surface.border),
                  borderRadius: T.r.md, textAlign: 'center', cursor: 'pointer',
                }}
                onClick={() => store.setActiveScenario(id)}
              >
                <div style={{ fontSize: 14 }}>{icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.text.primary, marginTop: 2 }}>
                  {label.length > 18 ? label.slice(0, 16) + '…' : label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 800, color: margin >= 20 ? '#4ade80' : margin >= 15 ? '#fbbf24' : '#f87171', marginTop: 2 }}>
                  {margin.toFixed(1)}%
                </div>
                <div style={{ fontSize: 9, color: C.text.muted }}>
                  {profit >= 0 ? '+$' + (profit / 1000).toFixed(0) + 'k' : '-$' + (Math.abs(profit) / 1000).toFixed(0) + 'k'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Matrix table */}
      <div style={{ overflowX: 'auto', borderRadius: T.r.md, border: '1px solid ' + C.surface.border }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
          <thead>
            <tr>
              <th style={{
                padding: '10px 12px', background: C.surface.card,
                border: '1px solid ' + C.surface.border,
                textAlign: 'left', fontSize: 10, fontWeight: 700,
                color: C.text.muted, position: 'sticky', left: 0, zIndex: 3, minWidth: 130,
              }}>
                METRIC
              </th>
              {ids.map(id => (
                <ScenarioColumnHeader
                  key={id} id={id} scenario={scenarios[id]}
                  isActive={id === activeId}
                  onActivate={() => store.setActiveScenario(id)}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map(({ metric, values }) => (
              <tr
                key={metric.key}
                style={{ transition: 'background 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* Row label */}
                <td style={{
                  padding: '8px 12px', background: C.surface.card,
                  border: '1px solid ' + C.surface.border,
                  fontSize: T.fs.xxs, fontWeight: 700, color: C.text.muted,
                  position: 'sticky', left: 0, zIndex: 1,
                }}>
                  {metric.label}
                </td>
                {/* Value cells */}
                {values.map(({ scenarioId, value, isBest, isWorst }) => {
                  const cellBg = isBest  ? 'rgba(22,163,74,0.12)'
                               : isWorst ? 'rgba(220,38,38,0.10)'
                               : 'transparent';
                  const cellColor = isBest  ? '#4ade80'
                                  : isWorst ? '#f87171'
                                  : C.text.primary;
                  return (
                    <td
                      key={scenarioId}
                      style={{
                        padding: '8px', textAlign: 'center',
                        background: cellBg,
                        border: '1px solid ' + C.surface.border,
                        fontSize: T.fs.xs, fontWeight: isBest || isWorst ? 800 : 500,
                        color: cellColor,
                      }}
                    >
                      {fmtCell(value, metric.fmt)}
                      {isBest  && <span style={{ marginLeft: 4, fontSize: 9 }}>▲</span>}
                      {isWorst && <span style={{ marginLeft: 4, fontSize: 9 }}>▼</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 10, color: C.text.muted, marginTop: 8 }}>
        ▲ Best value &nbsp;·&nbsp; ▼ Worst value &nbsp;·&nbsp; Click a column header to activate that scenario.
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Delta View
// ─────────────────────────────────────────────────────────────────────────────

const DeltaView = ({ state }) => {
  const scenarios = state.scenarios;
  const activeId  = state.system.activeScenarioId;
  const ids       = Object.keys(scenarios).filter(id => id !== activeId);

  const [compareId, setCompareId] = useState(ids[0] || null);

  useEffect(() => {
    if (!compareId && ids.length > 0) setCompareId(ids[0]);
  }, [ids.join(',')]);

  if (ids.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: T.sp.xl, color: C.text.muted, fontSize: T.fs.xs }}>
        <div style={{ fontSize: 28, marginBottom: 10 }}>⚖️</div>
        Add a second scenario to compare against the active one.
      </div>
    );
  }

  const base   = scenarios[activeId];
  const target = compareId ? scenarios[compareId] : null;
  const delta  = (base && target) ? calculateScenarioDelta(base, target) : null;

  const DELTA_ROWS = [
    { key: 'profit',    label: 'Net Profit',       fmt: 'currency' },
    { key: 'margin',    label: 'Margin on Cost',   fmt: 'pct'      },
    { key: 'irr',       label: 'IRR',              fmt: 'pct'      },
    { key: 'grv',       label: 'Total GRV',        fmt: 'currency' },
    { key: 'totalCost', label: 'Total Cost',       fmt: 'currency' },
    { key: 'land',      label: 'Land + Stamp',     fmt: 'currency' },
    { key: 'hard',      label: 'Hard Costs',       fmt: 'currency' },
    { key: 'hold',      label: 'Holding Costs',    fmt: 'currency' },
  ];

  return (
    <div>
      {/* Scenario selector */}
      <div style={{ display: 'flex', gap: T.sp.sm, marginBottom: T.sp.lg, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: T.fs.xs, color: C.text.muted, fontWeight: 600 }}>Compare active scenario against:</span>
        {ids.map(id => (
          <button
            key={id}
            onClick={() => setCompareId(id)}
            style={{
              padding: '5px 12px', borderRadius: T.r.md, cursor: 'pointer',
              fontSize: T.fs.xs, fontFamily: SANS, fontWeight: 600,
              border: '1px solid ' + (id === compareId ? 'rgba(56,189,248,0.6)' : C.surface.border),
              background: id === compareId ? 'rgba(14,165,233,0.15)' : C.surface.elevated,
              color: id === compareId ? '#38bdf8' : C.text.secondary,
            }}
          >
            {scenarios[id]?.label || id.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {delta && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
          {DELTA_ROWS.map(({ key, label, fmt }) => {
            const d = delta[key];
            if (!d) return null;
            const isUp    = d.trend === 'up';
            const isDown  = d.trend === 'down';
            const trendColor = isUp ? '#4ade80' : isDown ? '#f87171' : C.text.muted;
            const arrow      = isUp ? '▲' : isDown ? '▼' : '—';
            return (
              <div
                key={key}
                style={{
                  display: 'grid', gridTemplateColumns: '140px 1fr 1fr 80px 80px',
                  gap: T.sp.sm, alignItems: 'center',
                  padding: '8px 12px', borderRadius: T.r.sm,
                  background: C.surface.elevated, border: '1px solid ' + C.surface.border,
                }}
              >
                <span style={{ fontSize: T.fs.xxs, fontWeight: 700, color: C.text.muted, textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: T.fs.xs, color: C.text.secondary, textAlign: 'right' }}>
                  {fmtCell(d.base, fmt)}
                  <span style={{ fontSize: 9, color: C.text.muted, marginLeft: 4 }}>BASE</span>
                </span>
                <span style={{ fontSize: T.fs.xs, color: C.text.primary, textAlign: 'right', fontWeight: 600 }}>
                  {fmtCell(d.target, fmt)}
                  <span style={{ fontSize: 9, color: C.text.muted, marginLeft: 4 }}>TARGET</span>
                </span>
                <span style={{ fontSize: T.fs.xs, fontWeight: 800, color: trendColor, textAlign: 'right' }}>
                  {arrow} {fmtDiff(d.diff, fmt)}
                </span>
                <span style={{ fontSize: T.fs.xxs, color: trendColor, textAlign: 'right' }}>
                  {Number.isFinite(d.pct) ? (d.pct >= 0 ? '+' : '') + d.pct.toFixed(1) + '%' : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export const ComparisonPanel = () => {
  const [state, setState]   = useState(() => store.getState());
  const [activeView, setActiveView] = useState('matrix'); // 'matrix' | 'delta'

  useEffect(() => {
    const unsub = store.subscribe(() => setState(store.getState()));
    return unsub;
  }, []);

  const tabStyle = (id) => ({
    padding: '6px 16px', borderRadius: T.r.sm, cursor: 'pointer',
    fontSize: T.fs.xs, fontWeight: 600, border: 'none', fontFamily: SANS,
    background: activeView === id ? 'rgba(14,165,233,0.18)' : 'transparent',
    color: activeView === id ? '#38bdf8' : C.text.muted,
    borderBottom: activeView === id ? '2px solid #38bdf8' : '2px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <UIPanel
      title="Scenario Comparison"
      subtitle="Multi-scenario strategy matrix and bilateral delta analysis"
    >
      {/* View switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: T.sp.lg, borderBottom: '1px solid ' + C.surface.border }}>
        <button style={tabStyle('matrix')} onClick={() => setActiveView('matrix')}>📊 Strategy Matrix</button>
        <button style={tabStyle('delta')}  onClick={() => setActiveView('delta')}>⚖️ Delta View</button>
      </div>

      {activeView === 'matrix' && <MatrixView  state={state} />}
      {activeView === 'delta'  && <DeltaView   state={state} />}
    </UIPanel>
  );
};
