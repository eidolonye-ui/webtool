/**
 * @file ui/panels/MarketPanel_V2.jsx
 * @description Market intelligence panel with live RBA/ABS indices.
 * VERSION: V2 - CACHE BUSTED
 * @version 1.1.0
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

  const market = state?.market?.data || {
    grvPerUnit: 0,
    grvUnits: 1,
    dom: 45
  };
  
  const [indicators, setIndicators] = useState({ status: 'loading', rba: null, cpi: null, ppi: null, ts: '' });

  useEffect(() => {
    const loadInd = async () => {
      try {
        const res = await fetchLiveIndicators();
        setIndicators({ 
          status: res.isLive ? 'live' : 'estimated',
          cpi: res.cpi, 
          ppi: res.buildingActivity, 
          ts: res.timestamp,
          isLive: !!res.isLive
        });
      } catch (e) {
        setIndicators(prev => ({ ...prev, status: 'error' }));
      }
    };
    loadInd();
  }, []);

  const updateMarket = (field, value) => {
    if (store && store.dispatch) {
      store.dispatch(`market.data.${field}`, value);
    }
  };

  return (
    <UIPanel 
      title="Market Intelligence (V2)" 
      subtitle="Real-time benchmarks and exit valuation data"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.lg }}>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.md }}>
          <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.brand, borderBottom: `1px solid ${C.border}`, paddingBottom: T.sp.xs }}>
            Exit Valuation (GRV)
          </div>
          
          <UIInput 
            label="Estimated GRV per Unit" 
            value={market?.grvPerUnit || ''} 
            onChange={updateMarket} 
            placeholder="e.g. 1200000" 
          />
          
          <UIInput 
            label="Target Unit Count" 
            value={market?.grvUnits || ''} 
            onChange={updateMarket} 
            placeholder="e.g. 2" 
          />
          
          <UIInput 
            label="Estimated Days on Market (DOM)" 
            value={market?.dom || ''} 
            onChange={updateMarket} 
            placeholder="e.g. 45" 
          />
        </div>

        <div style={{ 
          backgroundColor: '#f8fafc', 
          border: `1px solid ${C.border}`, 
          borderRadius: T.r.md, 
          padding: T.sp.md,
          display: 'flex',
          flexDirection: 'column',
          gap: T.sp.md
        }}>
          <div style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.textSecondary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>MARKET INDICATORS (VIC)</span>
            <span style={{
              fontSize: T.fs.xxs, fontWeight: 700, padding: '2px 8px', borderRadius: 12,
              background: indicators.isLive ? '#16a34a22' : '#f59e0b22',
              color: indicators.isLive ? '#16a34a' : '#d97706',
              border: `1px solid ${indicators.isLive ? '#16a34a44' : '#f59e0b44'}`
            }}>
              {indicators.isLive ? '● LIVE' : '○ Estimated'}
            </span>
          </div>
          {indicators.ts ? (
            <div style={{ fontSize: T.fs.xxs, color: C.text?.muted || '#94a3b8', marginTop: -8 }}>
              Last updated: {indicators.ts}
            </div>
          ) : null}

          {indicators.status === 'loading' ? (
            <div style={{ fontSize: T.fs.xs, textAlign: 'center', padding: T.sp.md }}>Loading market data...</div>
          ) : indicators.status === 'error' ? (
            <div style={{ fontSize: T.fs.xs, textAlign: 'center', color: '#dc2626', padding: T.sp.md }}>ABS API unavailable — showing estimated values.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: T.fs.xs, fontWeight: 600 }}>ABS CPI (YoY)</span>
                <span style={{ fontWeight: 800, color: C.brand }}>{indicators.cpi ? `${indicators.cpi.toFixed(2)}%` : 'N/A'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', backgroundColor: '#fff', borderRadius: 4, border: `1px solid ${C.border}` }}>
                <span style={{ fontSize: T.fs.xs, fontWeight: 600 }}>ABS Bldg Activity (QoQ)</span>
                <span style={{ fontWeight: 800, color: C.brand }}>{indicators.ppi ? `${indicators.ppi.toFixed(2)}%` : 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </UIPanel>
  );
};
