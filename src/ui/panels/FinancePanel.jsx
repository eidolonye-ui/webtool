/**
 * @file ui/panels/FinancePanel.jsx
 * @description Financial Command Cockpit for WebTool SaaS.
 * @version 5.1.0 - Fixed store subscription; auto stamp duty; smart PSM suggestion;
 *                   auto buildArea from dimensions; inline sync toast; fixed state paths.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { UIPanel, UIInput, UIButton } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { calcVicStampDuty } from '../../domain/finance/tax_engine.js';
import { getSuggestedPSM, getPSMRangeLabel } from '../../domain/data/construction_costs.js';

export const FinancePanel = () => {
  const [appState,    setAppState]    = useState(store.getState());
  const [isSimulating,setIsSimulating]= useState(false);
  const [syncMsg,     setSyncMsg]     = useState(null);   // inline toast
  const [simParams,   setSimParams]   = useState({ interestRate: 6.5, grvMod: 1.0 });

  // Subscribe to store - panel re-renders on any state change
  useEffect(() => {
    const unsub = store.subscribe(setAppState);
    return () => unsub();
  }, []);

  const state    = appState;
  const activeId = state.system.activeScenarioId;
  const scenario = state.scenarios[activeId] || {};

  const finance      = scenario.finance      || {};
  const financing    = scenario.financing    || {};
  const locks        = scenario.financeLocks || {};
  const market       = scenario.market       || {};
  const site         = scenario.site         || {};           // FIXED: was state.site
  const suggestions  = state.system.financeSuggestions || {};
  const activePersona= state.system.activePersona || 'developer';
  const accentColor  = state.system.activeAccentColor || '#0f4c75';

  // Correct path for terrain data
  const terrainData  = site?.investigation?.terrainData;
  const projectMonths= finance?.projectMonths || 24;         // safe optional chaining

  // ── Field update helpers ────────────────────────────────────────────
  const setFin  = useCallback((field, value) => store.dispatch('finance.' + field, value), []);
  const setFing = useCallback((field, value) => store.dispatch('financing.' + field, value), []);
  const toggleLock = useCallback((field) => store.dispatch('financeLocks.' + field, !locks[field]), [locks]);

  const showSync = (msg) => {
    setSyncMsg(msg);
    setTimeout(() => setSyncMsg(null), 3000);
  };

  // ── Smart: auto-stamp duty when landPrice or flags change ──────────
  const handleLandPriceChange = (raw) => {
    const price = parseFloat(raw) || 0;
    setFin('landPrice', price);
    if (price > 0 && !locks.stampDuty) {
      const duty = calcVicStampDuty(price, Boolean(finance.isForeign), Boolean(finance.isOTP));
      setFin('stampDuty', duty);
    }
  };

  // ── Smart: buildCostPSM suggestion when buildType changes ──────────
  const handleBuildTypeChange = (type) => {
    setFin('buildType', type);
    if (!locks.buildCostPSM) {
      const suggested = getSuggestedPSM(type);
      setFin('buildCostPSM', suggested);
    }
  };

  // ── Smart: auto-estimate buildArea from site dims (60% coverage) ───
  const handleAutoEstimateBuildArea = () => {
    const area    = Number(site.area)     || 0;
    const floors  = finance.estFloors     || 1;
    const coverage= 0.60;
    if (area > 0 && !locks.buildArea) {
      const est = Math.round(area * coverage * floors);
      setFin('buildArea', est);
      showSync('Build area estimated: ' + est + ' m² (' + Math.round(coverage * 100) + '% coverage × ' + floors + ' floors)');
    }
  };

  // ── Sync terrain costs ─────────────────────────────────────────────
  const syncSovereignCosts = () => {
    if (!terrainData) { showSync('Run site analysis first to unlock terrain costs.'); return; }
    const costs = {
      siteWorks:   terrainData.slopeCostImpact || 0,
      demolition:  terrainData.risks?.some(r => r.includes('Demolition')) ? 25000 : 15000,
      serviceConn: terrainData.risks?.some(r => r.includes('Power Lines')) ? 45000 : 15000
    };
    Object.entries(costs).forEach(([k, v]) => setFin(k, v));
    showSync('Site-works costs synced from terrain analysis.');
  };

  const getPriorityLayout = () => {
    switch (activePersona) {
      case 'builder':   return { primary: 'construction' };
      case 'architect': return { primary: 'construction' };
      default:          return { primary: 'sandbox' };
    }
  };
  const layout = getPriorityLayout();

  const psmLabel = finance.buildType ? getPSMRangeLabel(finance.buildType) : '';

  // ── Styles ──────────────────────────────────────────────────────────
  const cardStyle = {
    display: 'flex', flexDirection: 'column', gap: T.sp.md,
    padding: T.sp.md, borderRadius: T.r.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid ' + C.surface?.border || 'rgba(255,255,255,0.1)'
  };
  const sectionHeadStyle = {
    fontWeight: 800, fontSize: T.fs.sm, color: accentColor,
    borderBottom: '2px solid ' + accentColor, paddingBottom: T.sp.xs,
    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
  };
  const pillStyle = {
    fontSize: '10px', fontWeight: 800, color: '#fff',
    backgroundColor: accentColor, borderRadius: 100, padding: '2px 8px',
    cursor: 'pointer'
  };

  return (
    <UIPanel
      title="Financial Command Cockpit"
      subtitle={'Decision Sandbox active for ' + activePersona.toUpperCase() + ' mode'}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.lg, fontFamily: SANS }}>

        {/* Inline sync toast */}
        {syncMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: T.r.sm, fontSize: T.fs.xs,
            fontWeight: 700, color: '#00b86b',
            backgroundColor: 'rgba(0,184,107,0.1)', border: '1px solid rgba(0,184,107,0.3)'
          }}>
            {syncMsg}
          </div>
        )}

        {/* ── SENSITIVITY SANDBOX ── */}
        {layout.primary === 'sandbox' && (
          <div style={{
            padding: T.sp.md, borderRadius: T.r.md,
            border: '2px solid ' + accentColor,
            boxShadow: '0 8px 24px ' + accentColor + '22',
            backgroundColor: 'rgba(255,255,255,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: T.sp.md }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '18px' }}>🧪</span>
                <span style={{ fontWeight: 800, fontSize: T.fs.sm, color: accentColor }}>Sensitivity Sandbox</span>
              </div>
              <button onClick={() => setIsSimulating(!isSimulating)} style={{
                padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: T.fs.xs, fontWeight: 700, color: '#fff',
                backgroundColor: isSimulating ? '#ff4757' : accentColor
              }}>
                {isSimulating ? 'EXIT SIMULATION' : 'ENTER SIMULATION'}
              </button>
            </div>

            {isSimulating && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.lg, padding: T.sp.md, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: T.r.sm }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
                  <div style={{ fontSize: T.fs.xs, fontWeight: 700, color: accentColor }}>Simulate Interest Rate (%)</div>
                  <input type="range" min="3" max="12" step="0.1"
                    value={simParams.interestRate}
                    onChange={(e) => setSimParams(p => ({ ...p, interestRate: parseFloat(e.target.value) }))}
                    style={{ width: '100%', cursor: 'pointer', accentColor: accentColor }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800 }}>
                    <span>3.0%</span>
                    <span style={{ color: accentColor, fontSize: '14px' }}>{simParams.interestRate}%</span>
                    <span>12.0%</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>
                  <div style={{ fontSize: T.fs.xs, fontWeight: 700, color: accentColor }}>Simulate GRV Shift (%)</div>
                  <input type="range" min="0.8" max="1.2" step="0.01"
                    value={simParams.grvMod}
                    onChange={(e) => setSimParams(p => ({ ...p, grvMod: parseFloat(e.target.value) }))}
                    style={{ width: '100%', cursor: 'pointer', accentColor: accentColor }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 800 }}>
                    <span>-20%</span>
                    <span style={{ color: accentColor, fontSize: '14px' }}>{(simParams.grvMod * 100 - 100).toFixed(0)}%</span>
                    <span>+20%</span>
                  </div>
                </div>
                <div style={{ gridColumn: 'span 2', padding: '10px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, fontSize: T.fs.xs, textAlign: 'center', fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                  Simulation only — does not affect the official project state.
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.lg }}>

          {/* ── ACQUISITION ── */}
          <div style={cardStyle}>
            <div style={sectionHeadStyle}>
              <span>Acquisition &amp; Fixed Costs</span>
            </div>

            {/* Land price with auto stamp duty */}
            <UIInput
              label="Land Purchase Price ($)"
              value={finance.landPrice || ''}
              onChange={handleLandPriceChange}
              placeholder="e.g. 1,200,000"
              debounceMs={250}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.md }}>
              <div>
                <UIInput
                  label="Stamp Duty ($)"
                  value={finance.stampDuty || ''}
                  onChange={(v) => { setFin('stampDuty', parseFloat(v) || 0); store.dispatch('financeLocks.stampDuty', true); }}
                  placeholder="Auto-calculated"
                  debounceMs={250}
                />
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {finance.stampDuty > 0 && !locks.stampDuty ? 'Auto (SRO 2024-25 rates)' : locks.stampDuty ? 'Manually overridden' : 'Enter land price to auto-fill'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>Flags</div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
                  <input type="checkbox" checked={Boolean(finance.isForeign)} onChange={(e) => { setFin('isForeign', e.target.checked); handleLandPriceChange(finance.landPrice); }} />
                  Foreign (+8% FSAD)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: T.fs.xs, cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
                  <input type="checkbox" checked={Boolean(finance.isOTP)} onChange={(e) => { setFin('isOTP', e.target.checked); handleLandPriceChange(finance.landPrice); }} />
                  OTP Concession
                </label>
              </div>
            </div>

            <UIInput
              label="Legal &amp; Due Diligence ($)"
              value={finance.legalFees || ''}
              onChange={(v) => setFin('legalFees', parseFloat(v) || 0)}
              debounceMs={250}
            />

            {/* Site-works sync */}
            <div style={{ padding: T.sp.sm, backgroundColor: accentColor + '11', borderRadius: T.r.sm, border: '1px solid ' + accentColor + '33' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: T.fs.xs, color: accentColor }}>Site-Works Overlay</span>
                <button onClick={syncSovereignCosts} style={{ ...pillStyle }}>Sync from Terrain</button>
              </div>
              <UIInput
                label="Site Works ($)"
                value={finance.siteWorks || ''}
                onChange={(v) => setFin('siteWorks', parseFloat(v) || 0)}
                debounceMs={250}
              />
              {terrainData && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  Slope: {terrainData.maxSlope || 0}° | Risk vectors: {terrainData.risks?.length || 0}
                </div>
              )}
            </div>

            {/* Contingency + Duration */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.md }}>
              <div>
                <UIInput
                  label="Contingency (%)"
                  value={finance.contingencyPct || '5'}
                  onChange={(v) => setFin('contingencyPct', parseFloat(v) || 5)}
                  debounceMs={250}
                />
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>5-10% recommended</div>
              </div>
              <UIInput
                label="Project Duration (months)"
                value={projectMonths}
                onChange={(v) => setFin('projectMonths', parseInt(v) || 24)}
                debounceMs={250}
              />
            </div>

            {/* Target Margin — drives investment decision in Sovereign Memo */}
            <div>
              <UIInput
                label="Target Development Margin (%)"
                value={finance.targetMargin ?? 20}
                onChange={(v) => setFin('targetMargin', parseFloat(v) || 20)}
                placeholder="20"
                debounceMs={250}
              />
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                Hurdle rate for PROCEED/RENEGOTIATE decision in Executive Memo
              </div>
            </div>
          </div>

          {/* ── CONSTRUCTION & FINANCING ── */}
          <div style={cardStyle}>
            <div style={sectionHeadStyle}>
              <span>Construction &amp; Financing</span>
              {layout.primary === 'construction' && <span style={{ fontSize: '10px', opacity: 0.6 }}>PRIMARY FOCUS</span>}
            </div>

            {/* Build type selector with PSM auto-suggestion */}
            <div>
              <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: 'rgba(255,255,255,0.7)', marginBottom: 6 }}>Build Type</div>
              <select
                value={finance.buildType || ''}
                onChange={(e) => handleBuildTypeChange(e.target.value)}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: T.r.sm,
                  backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.15)', fontSize: T.fs.xs,
                  fontFamily: SANS, cursor: 'pointer'
                }}
              >
                <option value="">-- Select type --</option>
                <option value="dual-occ">Dual Occupancy</option>
                <option value="std-th">Townhouse (Standard)</option>
                <option value="med-th">Townhouse (Mid-High)</option>
                <option value="prem-th">Townhouse (Prestige)</option>
                <option value="low-apt">Apartment (4-8 storeys)</option>
                <option value="mid-apt">Apartment (8-15 storeys)</option>
              </select>
              {psmLabel && (
                <div style={{ fontSize: '10px', color: 'rgba(250,173,20,0.85)', marginTop: 4 }}>
                  Benchmark: {psmLabel}
                </div>
              )}
            </div>

            {/* Build area with auto-estimate */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: T.fs.xs, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                  Total Build Area (m²)
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {site.area > 0 && (
                    <button onClick={handleAutoEstimateBuildArea} style={{ ...pillStyle, backgroundColor: 'rgba(250,173,20,0.8)' }}>
                      Auto-estimate
                    </button>
                  )}
                  <button onClick={() => toggleLock('buildArea')} style={{
                    ...pillStyle,
                    backgroundColor: locks.buildArea ? '#f59e0b' : 'rgba(255,255,255,0.15)'
                  }}>
                    {locks.buildArea ? 'LOCKED' : 'UNLOCKED'}
                  </button>
                </div>
              </div>
              <UIInput
                label=""
                value={finance.buildArea || ''}
                onChange={(v) => { setFin('buildArea', parseFloat(v) || 0); store.dispatch('financeLocks.buildArea', true); }}
                placeholder={site.area > 0 ? 'Click Auto-estimate or enter manually' : 'Enter build area (m²)'}
                debounceMs={250}
              />
              {site.area > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>
                    Floors: <input type="number" min="1" max="10" value={finance.estFloors || 1}
                      onChange={(e) => setFin('estFloors', parseInt(e.target.value) || 1)}
                      style={{ width: 36, background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '10px', textAlign: 'center' }}
                    />
                  </div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
                    Site: {Number(site.area).toLocaleString()} m²
                  </div>
                </div>
              )}
            </div>

            {/* Build cost PSM with benchmark hint */}
            <div>
              <UIInput
                label="Build Cost per m² ($)"
                value={finance.buildCostPSM || ''}
                onChange={(v) => { setFin('buildCostPSM', parseFloat(v) || 0); store.dispatch('financeLocks.buildCostPSM', true); }}
                debounceMs={250}
              />
              {finance.buildType && finance.buildCostPSM > 0 && (() => {
                const { getSuggestedPSM: gp } = { getSuggestedPSM };
                const mid = getSuggestedPSM(finance.buildType);
                const diff = Math.abs(finance.buildCostPSM - mid);
                const pct  = Math.round((diff / mid) * 100);
                if (pct > 20) {
                  return (
                    <div style={{ fontSize: '10px', color: 'rgba(250,173,20,0.85)', marginTop: 3 }}>
                      Benchmark mid is ${mid.toLocaleString()}/m² — your input is {pct}% {finance.buildCostPSM > mid ? 'above' : 'below'} benchmark.
                    </div>
                  );
                }
                return null;
              })()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: T.sp.md }}>
              <UIInput
                label="LVR (%)"
                value={financing.lvrPct || '65'}
                onChange={(v) => setFing('lvrPct', parseFloat(v) || 65)}
                debounceMs={250}
              />
              <UIInput
                label="Interest Rate (%)"
                value={financing.interestRate || '6.5'}
                onChange={(v) => setFing('interestRate', parseFloat(v) || 6.5)}
                debounceMs={250}
              />
            </div>

            {/* S-Curve interest summary */}
            <div style={{ padding: T.sp.sm, backgroundColor: accentColor + '11', border: '1px solid ' + accentColor + '33', borderRadius: T.r.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: T.fs.xs, color: accentColor }}>Capitalised Interest (S-Curve)</span>
                <span style={{ fontSize: '10px', fontWeight: 800, color: accentColor }}>ACTIVE</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>
                Estimated: <strong style={{ color: '#fff' }}>${(scenario.calculations?.capInterest || 0).toLocaleString()}</strong>
                &nbsp;&mdash; {projectMonths}mo @ {financing.interestRate || 6.5}%
              </div>
            </div>
          </div>
        </div>

        {/* Collapsed sandbox for non-developer personas */}
        {layout.primary !== 'sandbox' && (
          <div style={{ padding: T.sp.sm, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: T.r.md, border: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: T.fs.xs, fontWeight: 700, color: 'rgba(255,255,255,0.45)' }}>🧪 Sensitivity Sandbox available</span>
            <button onClick={() => setIsSimulating(true)} style={{ ...pillStyle, backgroundColor: 'transparent', border: '1px solid ' + accentColor, color: accentColor }}>ACTIVATE</button>
          </div>
        )}
      </div>
    </UIPanel>
  );
};
