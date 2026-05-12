/**
 * @file ui/panels/ComparisonPanel.jsx
 * @description Sovereign Arbitration Panel for comparing development scenarios.
 * Implements Delta Analysis and Sovereign Winner determination.
 * @version 2.0.0 - ARBITRATION UPGRADE
 */

import React, { useState, useMemo, useEffect } from 'react';
import { store } from '../../core/store/store';
import { calculateScenarioDelta, rankScenarios } from '../../domain/finance/comparison_engine';
import { UIPanel, UIButton } from '../components/Common_V2';
import { C, SANS, T } from '../../core/config/theme_v3.js';

const camelToLabel = (key) => {
  let result = '';
  for (let i = 0; i < key.length; i++) {
    const ch = key[i];
    result += (i > 0 && ch >= 'A' && ch <= 'Z') ? (' ' + ch) : ch;
  }
  return result.toUpperCase();
};

export const ComparisonPanel = () => {
  const [state, setState] = useState(() => store.getState());
  const [targetScenarioId, setTargetScenarioId] = useState('');

  useEffect(() => {
    const unsub = store.subscribe(() => setState(store.getState()));
    return unsub;
  }, []);

  const activeId = state.system.activeScenarioId;
  const allScenarioIds = Object.keys(state.scenarios);
  const otherScenarios = allScenarioIds.filter(id => id !== activeId);

  const comparisonData = useMemo(() => {
    if (!targetScenarioId) return null;
    const base   = state.scenarios[activeId];
    const target = state.scenarios[targetScenarioId];
    return calculateScenarioDelta(base, target);
  }, [state.scenarios, activeId, targetScenarioId]);

  const calculateIntegrity = (id) => {
    const alignment = state.scenarios[id]?.investigation?.synthesis?.alignment;
    if (!alignment) return 0;
    const scores = Object.values(alignment).map(v => v.score);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  };

  const baseIntegrity   = calculateIntegrity(activeId);
  const targetIntegrity = calculateIntegrity(targetScenarioId);

  const determineWinner = () => {
    if (!comparisonData) return null;
    const baseMargin   = state.scenarios[activeId]?.calculations?.margin || 0;
    const targetMargin = state.scenarios[targetScenarioId]?.calculations?.margin || 0;
    const baseScore    = (baseMargin * 0.6) + (baseIntegrity * 0.4);
    const targetScore  = (targetMargin * 0.6) + (targetIntegrity * 0.4);
    return targetScore > baseScore ? 'TARGET' : 'BASELINE';
  };

  const winner = determineWinner();

  // Clone active scenario using store.createScenario (copies current active + activates it)
  const cloneScenario = () => {
    const baseName = store.getActiveScenario()?.site?.address || activeId;
    const newName  = baseName.slice(0, 30).replace(/[^a-zA-Z0-9 ]/g, '') + ' Copy ' + Date.now().toString().slice(-4);
    const prevId   = activeId; // remember baseline before clone
    const newId    = store.createScenario(newName); // clones current, activates clone
    // Keep baseline as the comparison target so user sees the diff immediately
    setTargetScenarioId(prevId);
    console.log('[ComparisonPanel] Cloned', prevId, '→', newId);
  };

  const exportToCSV = () => {
    if (!comparisonData) return;
    let csv = 'Metric,Baseline,Target,Delta,Variance%\n';
    Object.entries(comparisonData).forEach(([key, data]) => {
      csv += key + ',' + data.base + ',' + data.target + ',' + data.diff + ',' + data.pct.toFixed(2) + '%\n';
    });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'Financial_Comparison_' + activeId + '_vs_' + targetScenarioId + '.csv';
    a.click();
  };

  return (
    <UIPanel
      title="Sovereign Arbitration Center"
      subtitle="Strategic delta analysis and scenario winner determination"
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: T.sp.lg,
        padding: T.sp.md,
        backgroundColor: '#f8fafc',
        borderRadius: T.r.md,
        border: '1px solid ' + C.border
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.md }}>
          <span style={{ fontSize: T.fs.sm, fontWeight: 600, color: C.slate }}>
            Baseline: <strong>{activeId}</strong>
          </span>
          <span style={{ color: C.border }}>|</span>
          <span style={{ fontSize: T.fs.sm, fontWeight: 600, color: C.slate }}>Target:</span>
          <select
            value={targetScenarioId}
            onChange={(e) => setTargetScenarioId(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid ' + C.border,
              fontFamily: SANS,
              fontSize: T.fs.xs
            }}
          >
            <option value="">-- Select Scenario --</option>
            {otherScenarios.map(id => (
              <option key={id} value={id}>{id.toUpperCase().replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: T.sp.sm }}>
          <UIButton
            label="⧉ Clone Scenario"
            onClick={cloneScenario}
            variant="ghost"
            style={{ fontSize: T.fs.xxs, background: '#0ea5e911', border: '1px solid #0ea5e944', color: '#0ea5e9' }}
          />
          <UIButton
            label="Export to CSV"
            onClick={exportToCSV}
            variant="ghost"
            style={{ fontSize: T.fs.xs }}
          />
        </div>
      </div>

      {!targetScenarioId ? (
        <div style={{
          padding: T.sp.xl,
          textAlign: 'center',
          color: C.textSecondary,
          fontSize: T.fs.sm,
          border: '2px dashed ' + C.border,
          borderRadius: T.r.lg
        }}>
          <div style={{ fontSize: '24px', marginBottom: 8 }}>&#9878;</div>
          <p>Please select a target scenario to generate the Sovereign Arbitration.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg }}>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: T.sp.md,
            padding: T.sp.md,
            backgroundColor: '#f8fafc',
            borderRadius: T.r.md,
            border: '1px solid ' + C.border,
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#fff', borderRadius: T.r.sm, border: '1px solid ' + C.border }}>
              <div style={{ fontSize: '10px', color: C.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Baseline Integrity</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: C.ink }}>{baseIntegrity}%</div>
            </div>
            <div style={{ textAlign: 'center', padding: '10px', backgroundColor: '#fff', borderRadius: T.r.sm, border: '1px solid ' + C.border }}>
              <div style={{ fontSize: '10px', color: C.textSecondary, fontWeight: 800, textTransform: 'uppercase' }}>Target Integrity</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: C.ink }}>{targetIntegrity}%</div>
            </div>
          </div>

          <div style={{
            textAlign: 'center',
            padding: '15px',
            backgroundColor: '#fff',
            borderRadius: T.r.md,
            border: '2px solid ' + (winner === 'TARGET' ? '#fbbf24' : '#3b82f6'),
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: C.textSecondary, textTransform: 'uppercase' }}>
              Sovereign Recommendation
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: C.ink, margin: '5px 0' }}>
              {winner === 'TARGET'
                ? 'Scenario ' + targetScenarioId.toUpperCase()
                : 'Scenario ' + activeId.toUpperCase()}
            </div>
            <div style={{ fontSize: '11px', color: C.textSecondary }}>
              Based on weighted analysis of Margin (60%) and Data Integrity (40%).
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: SANS }}>
              <thead>
                <tr style={{ backgroundColor: '#f1f5f9', color: C.textSecondary, fontSize: T.fs.xs, textAlign: 'left' }}>
                  <th style={{ padding: '12px', border: '1px solid ' + C.border }}>Financial Metric</th>
                  <th style={{ padding: '12px', border: '1px solid ' + C.border }}>Baseline ({activeId})</th>
                  <th style={{ padding: '12px', border: '1px solid ' + C.border }}>Target ({targetScenarioId})</th>
                  <th style={{ padding: '12px', border: '1px solid ' + C.border }}>Delta (Abs)</th>
                  <th style={{ padding: '12px', border: '1px solid ' + C.border }}>Variance %</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData && Object.entries(comparisonData).map(([key, data]) => {
                  const isPositive = (key === 'totalCost' || key === 'landPrice') ? data.diff < 0 : data.diff > 0;
                  return (
                    <tr key={key} style={{ fontSize: T.fs.xs, transition: 'all 0.2s' }}>
                      <td style={{ padding: '12px', border: '1px solid ' + C.border, fontWeight: 600, color: C.ink, backgroundColor: '#fcfcfc' }}>
                        {camelToLabel(key)}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid ' + C.border, textAlign: 'right' }}>
                        {data.base.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid ' + C.border, textAlign: 'right', fontWeight: 600 }}>
                        {data.target.toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', border: '1px solid ' + C.border, textAlign: 'right', fontWeight: 700, color: isPositive ? '#16a34a' : '#dc2626' }}>
                        {data.diff > 0 ? '+' : ''}{data.diff.toLocaleString()}
                        <span style={{ marginLeft: 6 }}>{isPositive ? '[+]' : '[-]'}</span>
                      </td>
                      <td style={{ padding: '12px', border: '1px solid ' + C.border, textAlign: 'right', fontWeight: 700, color: isPositive ? '#16a34a' : '#dc2626' }}>
                        {data.pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{
            padding: T.sp.md,
            backgroundColor: '#eff6ff',
            border: '1px solid ' + C.brand,
            borderRadius: T.r.md,
            borderLeft: '4px solid ' + C.brand
          }}>
            <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: C.brand, marginBottom: T.sp.xs }}>
              Strategic Delta Conclusion
            </div>
            <p style={{ fontSize: T.fs.xs, color: C.text, lineHeight: 1.6 }}>
              The shift to scenario <strong>{targetScenarioId}</strong> results in a{' '}
              {comparisonData && comparisonData.profit && comparisonData.profit.trend === 'up' ? 'positive' : 'negative'}{' '}
              profit variance of{' '}
              <strong>{Math.abs((comparisonData && comparisonData.profit && comparisonData.profit.diff) || 0).toLocaleString()}</strong>.{' '}
              {comparisonData && comparisonData.margin && comparisonData.margin.trend === 'up'
                ? 'This strategy optimizes the project margin and is generally preferred.'
                : 'This strategy increases risk or costs relative to the baseline.'}
            </p>
          </div>

        </div>
      )}
    </UIPanel>
  );
};
