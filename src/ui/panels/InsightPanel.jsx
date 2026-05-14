/**
 * @file ui/panels/InsightPanel.jsx
 * @description Strategic insight panel — rule-based financial analysis + sensitivity matrix.
 * @version 3.1.0 - useLiveSnapshot hook: removed liveSnapshot prop dependency on AppShell.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { UIPanel } from '../components/Common_V2.jsx';
import { C, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { generateProjectInsights } from '../../domain/finance/insight_engine.js';
import { calculateSensitivity } from '../../domain/finance/sensitivity_engine.js';
import { useLiveSnapshot } from '../hooks/useLiveSnapshot.js';

// ── sub-components ────────────────────────────────────────────────────────────

const RiskBadge = ({ level }) => {
  const map = {
    High:   { bg: '#dc262622', border: '#dc2626', text: '#dc2626', icon: '🔴' },
    Medium: { bg: '#f59e0b22', border: '#f59e0b', text: '#d97706', icon: '🟡' },
    Low:    { bg: '#16a34a22', border: '#16a34a', text: '#16a34a', icon: '🟢' },
  };
  const s = map[level] || map.Medium;
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: '6px 16px', fontWeight: 700,
      fontSize: T.fs.sm, color: s.text
    }}>
      {s.icon} Risk Level: {level}
    </div>
  );
};

const InsightSection = ({ icon, title, text, color = C.text.primary }) => (
  <div style={{
    background: C.surface.elevated, border: `1px solid ${C.surface.border}`,
    borderRadius: T.r.md, padding: T.sp.md
  }}>
    <div style={{ fontWeight: 700, fontSize: T.fs.xs, color, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      <span>{icon}</span> {title}
    </div>
    <div style={{ fontSize: T.fs.xs, color: C.text.secondary, lineHeight: 1.6 }}>
      {text || '—'}
    </div>
  </div>
);

const ConfidenceMeter = ({ score }) => {
  const color = score >= 70 ? '#16a34a' : score >= 45 ? '#f59e0b' : '#dc2626';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: T.fs.xxs, color: C.text.secondary, marginBottom: 4 }}>
        <span>Data Confidence</span>
        <span style={{ fontWeight: 700, color }}>{score ?? '—'}%</span>
      </div>
      <div style={{ height: 6, background: C.surface.border, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${score ?? 0}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
    </div>
  );
};

/**
 * 5×5 Sensitivity Heat Matrix
 * Rows = Cost variation (-10% → +10%), Cols = GRV variation (-10% → +10%)
 */
const SensitivityMatrix = ({ baseProfit, baseGRV, baseCost }) => {
  const matrix = useMemo(
    () => calculateSensitivity(baseProfit, baseGRV, baseCost),
    [baseProfit, baseGRV, baseCost]
  );

  if (!matrix || matrix.length === 0) {
    return (
      <div style={{
        background: C.surface.elevated, border: `1px solid ${C.surface.border}`,
        borderRadius: T.r.md, padding: T.sp.md,
        color: C.text.muted, fontSize: T.fs.xs, textAlign: 'center'
      }}>
        Enter GRV and costs to see sensitivity analysis
      </div>
    );
  }

  const labels = ['-10%', '-5%', '0%', '+5%', '+10%'];

  const cellColor = (margin) => {
    if (margin === null || !Number.isFinite(margin)) return { bg: 'rgba(255,255,255,0.04)', text: 'rgba(255,255,255,0.2)' };
    if (margin >= 20) return { bg: 'rgba(22,163,74,0.25)',  text: '#4ade80' };
    if (margin >= 12) return { bg: 'rgba(22,163,74,0.10)',  text: '#86efac' };
    if (margin >= 0)  return { bg: 'rgba(245,158,11,0.18)', text: '#fbbf24' };
    return { bg: 'rgba(220,38,38,0.22)', text: '#f87171' };
  };

  return (
    <div style={{
      background: C.surface.elevated, border: `1px solid ${C.surface.border}`,
      borderRadius: T.r.md, padding: T.sp.md
    }}>
      {/* Header */}
      <div style={{ fontWeight: 700, fontSize: T.fs.xs, color: C.brand.main, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
        📉 Sensitivity Matrix <span style={{ fontWeight: 400, fontSize: 10, color: C.text.muted }}>— Profit Margin % by GRV vs Cost</span>
      </div>

      {/* Column header: GRV variation */}
      <div style={{ display: 'grid', gridTemplateColumns: '56px repeat(5, 1fr)', gap: 3, marginBottom: 3 }}>
        <div style={{ fontSize: 9, color: C.text.muted, display: 'flex', alignItems: 'flex-end', paddingBottom: 2, fontWeight: 600 }}>
          Cost ↓ / GRV →
        </div>
        {labels.map(l => (
          <div key={l} style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: '3px 0' }}>
            {l}
          </div>
        ))}
      </div>

      {/* Matrix rows */}
      {matrix.map((row, ri) => (
        <div key={ri} style={{ display: 'grid', gridTemplateColumns: '56px repeat(5, 1fr)', gap: 3, marginBottom: 3 }}>
          {/* Row label: cost variation */}
          <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6 }}>
            {labels[ri]}
          </div>
          {row.map((cell, ci) => {
            const col = cellColor(cell?.margin);
            return (
              <div key={ci} style={{
                background: col.bg,
                borderRadius: 4,
                padding: '5px 2px',
                textAlign: 'center',
                border: ri === 2 && ci === 2 ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
              }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: col.text }}>
                  {cell?.margin !== null && Number.isFinite(cell?.margin)
                    ? (cell.margin >= 0 ? '+' : '') + cell.margin.toFixed(1) + '%'
                    : '—'}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {[
          { col: 'rgba(22,163,74,0.25)',  tc: '#4ade80', label: '≥ 20% margin' },
          { col: 'rgba(22,163,74,0.10)',  tc: '#86efac', label: '12–20%' },
          { col: 'rgba(245,158,11,0.18)', tc: '#fbbf24', label: '0–12%' },
          { col: 'rgba(220,38,38,0.22)',  tc: '#f87171', label: 'Loss' },
        ].map(({ col, tc, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: col }} />
            <span style={{ fontSize: 9, color: C.text.muted }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── IRR display card ──────────────────────────────────────────────────────────

const IRRCard = ({ irr, margin, capInterest }) => {
  if (irr === null || irr === undefined) return null;
  const irrColor = irr >= 15 ? '#4ade80' : irr >= 8 ? '#fbbf24' : '#f87171';
  return (
    <div style={{
      background: C.surface.elevated, border: `1px solid ${C.surface.border}`,
      borderRadius: T.r.md, padding: T.sp.md,
      display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: T.sp.sm
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          True IRR
        </div>
        <div style={{ fontSize: T.fs.lg, fontWeight: 900, color: irrColor }}>
          {irr.toFixed(1)}%
        </div>
        <div style={{ fontSize: 9, color: C.text.muted, marginTop: 2 }}>annualised</div>
      </div>
      <div style={{ textAlign: 'center', borderLeft: `1px solid ${C.surface.border}`, borderRight: `1px solid ${C.surface.border}` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Dev Margin
        </div>
        <div style={{ fontSize: T.fs.lg, fontWeight: 900, color: margin >= 20 ? '#4ade80' : margin >= 10 ? '#fbbf24' : '#f87171' }}>
          {(margin ?? 0).toFixed(1)}%
        </div>
        <div style={{ fontSize: 9, color: C.text.muted, marginTop: 2 }}>on cost</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: C.text.muted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
          Cap Interest
        </div>
        <div style={{ fontSize: T.fs.md, fontWeight: 800, color: '#94a3b8' }}>
          ${capInterest ? (capInterest / 1000).toFixed(0) + 'k' : '—'}
        </div>
        <div style={{ fontSize: 9, color: C.text.muted, marginTop: 2 }}>estimated</div>
      </div>
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────

export const InsightPanel = () => {
  const [scenario, setScenario] = useState(() => store.getActiveScenario());
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Owns its own snapshot subscription — no prop from AppShell required.
  const liveSnapshot = useLiveSnapshot();

  useEffect(() => {
    const unsub = store.subscribe(() => setScenario(store.getActiveScenario()));
    return unsub;
  }, []);

  const snap    = liveSnapshot || {};
  const results = snap.results  || {};

  const baseProfit = results.profit   ?? 0;
  const baseGRV    = results.grv      ?? 0;
  const baseCost   = results.total    ?? 0;
  const irr        = results.irr      ?? snap.irr      ?? null;
  const capInt     = results.capInterest ?? snap.capInterest ?? 0;
  const margin     = results.margin   ?? snap.margin   ?? 0;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const calculations = scenario?.calculations || {};
      const result = await generateProjectInsights(scenario, calculations);
      if (result?.error) throw new Error(result.error);
      setInsights(result);
      store.dispatch('system.lastInsights', result);
    } catch (e) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  const hasFinancialData = baseGRV > 0 && baseCost > 0;

  return (
    <UIPanel
      title="Strategic Advisor"
      subtitle="Live metrics, sensitivity analysis, and rule-based risk assessment"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>

        {/* ── Live IRR + Margin strip ─────────────────────────────────── */}
        {hasFinancialData && (
          <IRRCard irr={irr} margin={margin} capInterest={capInt} />
        )}

        {/* ── Sensitivity Matrix ──────────────────────────────────────── */}
        <SensitivityMatrix
          baseProfit={baseProfit}
          baseGRV={baseGRV}
          baseCost={baseCost}
        />

        {/* ── Generate Insights button ────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: T.sp.sm }}>
          <div style={{ fontSize: T.fs.xs, color: C.text.secondary }}>
            Rule-based analysis using Melbourne industry thresholds.
          </div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              background: loading ? C.surface.elevated : C.brand.main,
              color: loading ? C.text.muted : '#fff',
              border: 'none', borderRadius: T.r.md, cursor: loading ? 'default' : 'pointer',
              fontWeight: 700, fontSize: T.fs.sm, padding: '8px 20px',
              transition: 'background .2s'
            }}
          >
            {loading ? 'Analysing…' : '⚡ Generate Insights'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#dc262611', border: '1px solid #dc262644', borderRadius: T.r.md,
            padding: T.sp.md, color: '#dc2626', fontSize: T.fs.xs
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Empty state */}
        {!insights && !loading && !error && (
          <div style={{
            textAlign: 'center', padding: `${T.sp.lg}px ${T.sp.xl}px`,
            color: C.text.muted, fontSize: T.fs.xs
          }}>
            Click "Generate Insights" for a full strategic risk analysis.
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: T.sp.xl, color: C.text.secondary, fontSize: T.fs.xs }}>
            <div style={{ fontSize: 32, marginBottom: T.sp.md }}>⏳</div>
            Analysing Melbourne property metrics…
          </div>
        )}

        {/* Results */}
        {insights && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <RiskBadge level={insights.riskLevel} />
              <ConfidenceMeter score={insights.confidenceScore} />
            </div>
            {insights.redFlag && (
              <InsightSection icon="🚩" title="Critical Red Flag" text={insights.redFlag} color="#dc2626" />
            )}
            {insights.opportunity && (
              <InsightSection icon="💚" title="Key Opportunity" text={insights.opportunity} color="#16a34a" />
            )}
            <InsightSection icon="💡" title="Strategic Recommendation" text={insights.recommendation} color={C.brand.main} />
            <InsightSection icon="🔍" title="Analysis Basis" text={insights.riskReason} />
          </div>
        )}

      </div>
    </UIPanel>
  );
};
