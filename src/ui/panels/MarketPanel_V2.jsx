/**
 * @file ui/panels/MarketPanel_V2.jsx
 * @description Market intelligence panel with live RBA/ABS indices.
 * @version 1.2.0 - Fix: state path (state.market.data → scenario.market),
 *                  dispatch path (market.data.x → market.x),
 *                  UIInput callback signature (field,val → val only).
 */

import React, { useEffect, useState } from 'react';
import { UIPanel, UIInput } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { fetchLiveIndicators } from '../../domain/finance/market_indicators_v2.js';

export const MarketPanel_V2 = () => {
  const [state, setState] = useState(() => store.getState() || {});

  useEffect(() => {
    const unsub = store.subscribe(() => setState(store.getState() || {}));
    return unsub;
  }, []);

  // FIX: market data lives in the active scenario, not at state root.
  const activeId = state?.system?.activeScenarioId || 'default';
  const market = state?.scenarios?.[activeId]?.market || {
    grvPerUnit: 0,
    grvUnits: 1,
    dom: 45,
  };

  const [indicators, setIndicators] = useState({ status: 'loading', cpi: null, ppi: null, ts: '', isLive: false });

  useEffect(() => {
    fetchLiveIndicators()
      .then(res => setIndicators({
        status: res.isLive ? 'live' : 'estimated',
        cpi:    res.cpi,
        ppi:    res.buildingActivity,
        ts:     res.timestamp,
        isLive: !!res.isLive,
      }))
      .catch(() => setIndicators(prev => ({ ...prev, status: 'error' })));
  }, []);

  // FIX: UIInput calls onChange(value) — one argument. Use dedicated handlers.
  // FIX: store path is 'market.X' (store prepends 'scenarios.[activeId].').
  const setGrvPerUnit = (v) => store.dispatch('market.grvPerUnit',  parseFloat(v) || 0);
  const setGrvUnits   = (v) => store.dispatch('market.grvUnits',    parseInt(v, 10) || 1);
  const setDom        = (v) => store.dispatch('market.dom',         parseInt(v, 10) || 45);

  return (
    <UIPanel
      title="Market Intelligence (V2)"
      subtitle="Real-time benchmarks and exit valuation data"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.lg }}>

        {/* ── GRV Inputs ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
          <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand.main, borderBottom: `1px solid ${C.border}`, paddingBottom: T.sp.xs }}>
            Exit Valuation (GRV)
          </div>

          <UIInput
            label="Estimated GRV per Unit"
            value={market.grvPerUnit || ''}
            onChange={setGrvPerUnit}
            placeholder="e.g. 1200000"
            type="number"
          />

          <UIInput
            label="Target Unit Count"
            value={market.grvUnits || ''}
            onChange={setGrvUnits}
            placeholder="e.g. 2"
            type="number"
          />

          <UIInput
            label="Estimated Days on Market (DOM)"
            value={market.dom || ''}
            onChange={setDom}
            placeholder="e.g. 45"
            type="number"
          />

          {/* Live GRV summary */}
          {(market.grvPerUnit > 0 && market.grvUnits > 0) && (
            <div style={{
              padding: T.sp.sm, borderRadius: T.r.md,
              background: 'rgba(0,122,255,0.1)', border: '1px solid rgba(0,122,255,0.25)',
              fontSize: T.fs.xs, color: C.text.secondary,
            }}>
              <span style={{ color: C.text.muted }}>Total GRV: </span>
              <strong style={{ color: '#fff', fontSize: T.fs.sm }}>
                ${((market.grvPerUnit * market.grvUnits) / 1_000_000).toFixed(3)}M
              </strong>
              <span style={{ color: C.text.muted, marginLeft: 8 }}>
                ({market.grvUnits} × ${(market.grvPerUnit / 1000).toFixed(0)}k)
              </span>
            </div>
          )}
        </div>

        {/* ── Market Indicators ── */}
        <div style={{
          backgroundColor: C.surface.elevated,
          border: `1px solid ${C.surface.border}`,
          borderRadius: T.r.md,
          padding: T.sp.md,
          display: 'flex',
          flexDirection: 'column',
          gap: T.sp.md,
        }}>
          <div style={{
            fontWeight: 700, fontSize: T.fs.sm, color: C.text.secondary,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span>MARKET INDICATORS (VIC)</span>
            <span style={{
              fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: indicators.isLive ? '#16a34a22' : '#f59e0b22',
              color: indicators.isLive ? '#16a34a' : '#d97706',
              border: `1px solid ${indicators.isLive ? '#16a34a44' : '#f59e0b44'}`,
            }}>
              {indicators.isLive ? '● LIVE' : '○ Estimated'}
            </span>
          </div>

          {indicators.ts && (
            <div style={{ fontSize: T.fs.xxs, color: C.text.muted, marginTop: -8 }}>
              Last updated: {indicators.ts}
            </div>
          )}

          {indicators.status === 'loading' && (
            <div style={{ fontSize: T.fs.xs, textAlign: 'center', padding: T.sp.md, color: C.text.muted }}>
              Loading market data…
            </div>
          )}

          {indicators.status === 'error' && (
            <div style={{ fontSize: T.fs.xs, textAlign: 'center', color: '#dc2626', padding: T.sp.md }}>
              ABS API unavailable — showing estimated values.
            </div>
          )}

          {(indicators.status === 'live' || indicators.status === 'estimated') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px', backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: T.r.sm, border: `1px solid ${C.surface.border}`,
              }}>
                <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: C.text.secondary }}>ABS CPI (YoY)</span>
                <span style={{ fontWeight: 800, color: C.brand.main }}>
                  {indicators.cpi ? `${indicators.cpi.toFixed(2)}%` : 'N/A'}
                </span>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px', backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: T.r.sm, border: `1px solid ${C.surface.border}`,
              }}>
                <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: C.text.secondary }}>ABS Bldg Activity (QoQ)</span>
                <span style={{ fontWeight: 800, color: C.brand.main }}>
                  {indicators.ppi ? `${indicators.ppi.toFixed(2)}%` : 'N/A'}
                </span>
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px', backgroundColor: 'rgba(255,255,255,0.04)',
                borderRadius: T.r.sm, border: `1px solid ${C.surface.border}`,
              }}>
                <span style={{ fontSize: T.fs.xs, fontWeight: 600, color: C.text.secondary }}>Melbourne DOM Avg</span>
                <span style={{ fontWeight: 800, color: C.text.primary }}>~{market.dom || 45} days</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </UIPanel>
  );
};
