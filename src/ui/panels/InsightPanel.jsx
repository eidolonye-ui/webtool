/**
 * @file ui/panels/InsightPanel.jsx
 * @description Strategic insight panel — rule-based financial analysis.
 * All styling is inline (no external CSS classes).
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { UIPanel } from '../components/Common_V2.jsx';
import { C, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { generateProjectInsights } from '../../domain/finance/insight_engine.js';

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

// ── main component ────────────────────────────────────────────────────────────

export const InsightPanel = () => {
  const [scenario, setScenario] = useState(() => store.getActiveScenario());
  const [insights, setInsights] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  // Live store subscription
  useEffect(() => {
    const unsub = store.subscribe(() => setScenario(store.getActiveScenario()));
    return unsub;
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const calculations = scenario?.calculations || {};
      const result = await generateProjectInsights(scenario, calculations);
      if (result?.error) throw new Error(result.error);
      setInsights(result);
      // Persist to store so ReportPanel can include insights in exported report
      store.dispatch('system.lastInsights', result);
    } catch (e) {
      setError(e.message || 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <UIPanel
      title="Strategic Advisor"
      subtitle="Rule-based financial risk analysis for this scenario"
    >
      {/* Generate button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: T.sp.md }}>
        <div style={{ fontSize: T.fs.xs, color: C.text.secondary }}>
          Analyses margin, IRR, overlays, and site risks using Melbourne industry thresholds.
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
          padding: T.sp.md, color: '#dc2626', fontSize: T.fs.xs, marginBottom: T.sp.md
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Empty state */}
      {!insights && !loading && !error && (
        <div style={{
          textAlign: 'center', padding: T.sp.xl * 2,
          color: C.text.muted, fontSize: T.fs.xs
        }}>
          <div style={{ fontSize: 36, marginBottom: T.sp.md }}>📊</div>
          Click "Generate Insights" to get a strategic analysis of your current scenario.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: T.sp.xl * 2, color: C.text.secondary, fontSize: T.fs.xs }}>
          <div style={{ fontSize: 32, marginBottom: T.sp.md, animation: 'spin 1s linear infinite' }}>⏳</div>
          Analysing Melbourne property metrics…
        </div>
      )}

      {/* Results */}
      {insights && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
          {/* Risk badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <RiskBadge level={insights.riskLevel} />
            <ConfidenceMeter score={insights.confidenceScore} />
          </div>

          {/* Red flag or opportunity */}
          {insights.redFlag && (
            <InsightSection
              icon="🚩" title="Critical Red Flag"
              text={insights.redFlag} color="#dc2626"
            />
          )}
          {insights.opportunity && (
            <InsightSection
              icon="💚" title="Key Opportunity"
              text={insights.opportunity} color="#16a34a"
            />
          )}

          <InsightSection
            icon="💡" title="Strategic Recommendation"
            text={insights.recommendation}
            color={C.brand.main}
          />

          <InsightSection
            icon="🔍" title="Analysis Basis"
            text={insights.riskReason}
          />
        </div>
      )}
    </UIPanel>
  );
};
