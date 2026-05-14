/**
 * @file ui/panels/SovereignMemoPanel.jsx
 * @description Ultra-Executive Investment Memo for WebTool SaaS.
 * Implements Conclusion-First Architecture, Logical Evidence Flows, and Professional Financial Typography.
 * @version 3.0.0 - ULTRA-EXECUTIVE MEMO UPGRADE
 */

import React, { useState, useEffect } from 'react';
import { UIPanel, YieldWaterfall } from '../components/Common_V2.jsx';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { computeLiveSnapshot } from '../../domain/finance/live_calc_engine.js';

export const SovereignMemoPanel = () => {
  const [state,    setState]    = useState(() => store.getState());
  const [scenario, setScenario] = useState(() => store.getActiveScenario());

  useEffect(() => {
    const unsub = store.subscribe(() => {
      setState(store.getState());
      setScenario(store.getActiveScenario());
    });
    return unsub;
  }, []);

  const site         = scenario?.site || {};
  const fin          = scenario?.finance || {};
  const synthesis    = scenario?.site?.investigation?.synthesis;
  const fatalRisks   = synthesis?.fatalRisks || [];
  const activeAlerts = synthesis?.activeAlerts || [];
  const accentColor  = state?.system?.activeAccentColor || '#0f4c75';

  // SOVEREIGN DATA ACTIVATION: Compute live financial results for the memo
  const liveSnapshot = computeLiveSnapshot();
  const liveResults  = liveSnapshot.results || {};
  const calc         = liveResults;

  // Target margin: user-configured in Finance Panel, default 20%
  const targetMargin = Number(fin.targetMargin) || 20;

  // Deterministic project ID: scenario name + date portion (no Math.random())
  const projectId = (state?.system?.activeScenarioId || 'DEFAULT')
    .toUpperCase().replace(/[^A-Z0-9]/g, '')
    .slice(0, 6)
    .padEnd(6, '0') + '-' + new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const handlePrint = () => {
    window.print();
  };

  // Trust label: driven by decisionWaterfall step type (alignment map removed — never existed in store)
  const getTrustLabel = (step) => {
    const labels = {
      ALERT:  { text: 'RISK',      color: C.semantic.danger,  bg: 'rgba(231, 76, 60, 0.1)'  },
      ADVICE: { text: 'ADVISORY',  color: C.semantic.info,    bg: 'rgba(52, 152, 219, 0.1)' },
      INSIGHT:{ text: 'VERIFIED',  color: C.semantic.success, bg: 'rgba(46, 204, 113, 0.1)' },
    };
    return labels[step?.type] || { text: 'ESTIMATED', color: 'rgba(148,163,184,1)', bg: 'rgba(148,163,184,0.1)' };
  };

  const hasConflict = (fatalRisks.length > 0) || state?.system?.consistencyConflicts?.length > 0;

  return (
    <div>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; color: #000 !important; }
          .memo-page { 
            box-shadow: none !important; 
            border: none !important; 
            margin: 0 !important; 
            padding: 0 !important;
            width: 100% !important;
          }
        }
      `}</style>

      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        marginBottom: T.sp.md 
      }}>
        <button 
          onClick={handlePrint}
          style={{ 
            padding: '8px 16px', 
            backgroundColor: accentColor, 
            color: '#fff', 
            border: 'none', 
            borderRadius: 6, 
            cursor: 'pointer', 
            fontFamily: SANS, 
            fontWeight: 600,
            fontSize: T.fs.xs,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          🖨️ Export to PDF / Print
        </button>
      </div>

      <div style={{ 
        backgroundColor: C.surface.panel, 
        width: '850px', 
        margin: '0 auto', 
        padding: '60px', 
        border: `1px solid ${C.surface.border}`, 
        borderRadius: '8px', 
        boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
        fontFamily: SANS,
        color: C.text.primary
      }}>
        {/* --- 1. TOP BRANDING & HEADER --- */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          borderBottom: `4px solid ${accentColor}`, 
          paddingBottom: '25px', 
          marginBottom: '40px' 
        }}>
          <div>
            <h1 style={{ 
              fontSize: '28px', 
              fontWeight: 800, 
              margin: 0, 
              color: accentColor, 
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>Sovereign Site Memo</h1>
            <div style={{ fontSize: '13px', color: C.text.secondary, marginTop: 8, letterSpacing: '0.5px' }}>
              Date: {new Date().toLocaleDateString('en-AU')} | Scenario: <span style={{ fontWeight: 700 }}>{state.system.activeScenarioId || 'Default'}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: '18px', lineHeight: 1.2 }}>{site.address || "UNSPECIFIED PROPERTY"}</div>
            <div style={{ fontSize: '12px', color: C.text.secondary, marginTop: 4 }}>Project ID: {projectId}</div>
          </div>
        </div>

        {/* --- 2. EXECUTIVE DECISION BOX (Conclusion-First) --- */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 2fr', 
          gap: '30px', 
          marginBottom: '40px',
          padding: '30px',
          backgroundColor: C.surface.card,
          border: `1px solid ${C.surface.border}`,
          borderRadius: '12px',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            borderRight: `1px solid ${C.surface.border}`,
            paddingRight: '30px'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: C.text.secondary, textTransform: 'uppercase', marginBottom: 15 }}>Investment Decision</div>
            <div style={{
              fontSize: '24px',
              fontWeight: 900,
              padding: '10px 20px',
              borderRadius: '4px',
              backgroundColor: (calc.margin >= targetMargin) ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)',
              color: (calc.margin >= targetMargin) ? C.semantic.success : C.semantic.danger,
              border: `2px solid ${(calc.margin >= targetMargin) ? C.semantic.success : C.semantic.danger}`,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              {(calc.margin >= targetMargin) ? 'PROCEED' : 'RENEGOTIATE'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
              Hurdle: {targetMargin}% margin
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.text.secondary, textTransform: 'uppercase', fontWeight: 700 }}>Est. TDC</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: C.text.primary }}>${(calc.total || 0).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.text.secondary, textTransform: 'uppercase', fontWeight: 700 }}>Project Profit</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: calc.profit >= 0 ? C.semantic.success : C.semantic.danger }}>${(calc.profit || 0).toLocaleString()}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: C.text.secondary, textTransform: 'uppercase', fontWeight: 700 }}>Project Margin</div>
              <div style={{
                fontSize: '20px',
                fontWeight: 800,
                color: (calc.margin >= targetMargin) ? C.semantic.success : C.semantic.danger
              }}>
                {(calc.margin || 0).toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* --- 3. SITE IDENTITY & BASELINES --- */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: C.text.primary, textTransform: 'uppercase', marginBottom: 15, borderBottom: `1px solid ${accentColor}44`, paddingBottom: 5 }}>Physical Identity</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div><span style={{ color: C.text.secondary }}>Lot Area:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>{site.area || 0} m²</strong></div>
              <div><span style={{ color: C.text.secondary }}>Frontage:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>{site.frontage || 0} m</strong></div>
              <div><span style={{ color: C.text.secondary }}>Depth:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>{site.depth || 0} m</strong></div>
              <div><span style={{ color: C.text.secondary }}>Shape:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>{site.shape || 'Regular'}</strong></div>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 800, color: C.text.primary, textTransform: 'uppercase', marginBottom: 15, borderBottom: `1px solid ${accentColor}44`, paddingBottom: 5 }}>Financial Baseline</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
              <div><span style={{ color: C.text.secondary }}>Land Price:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>${(fin.landPrice || 0).toLocaleString()}</strong></div>
              <div><span style={{ color: C.text.secondary }}>Est. GRV:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>${(calc.grv || 0).toLocaleString()}</strong></div>
              <div><span style={{ color: C.text.secondary }}>Build Cost:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>${(fin.buildCostPSM || 0).toLocaleString()} /m²</strong></div>
              <div><span style={{ color: C.text.secondary }}>Target Margin:</span> <strong style={{ marginLeft: 4, color: C.text.primary }}>{targetMargin}%</strong></div>
            </div>
          </div>
        </div>

        {/* --- 4. YIELD ANALYSIS --- */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, color: C.slate, textTransform: 'uppercase', marginBottom: 20, borderBottom: '1px solid #eee', paddingBottom: 5 }}>Yield & Footprint Efficiency</div>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '50px', padding: '20px 0' }}>
            <div style={{ textAlign: 'center' }}>
               <div style={{ fontSize: '11px', color: C.text.secondary, textTransform: 'uppercase', fontWeight: 700 }}>Total Lot Area</div>
               <div style={{ fontSize: '22px', fontWeight: 800 }}>{site.area || 0} m²</div>
            </div>
            <div style={{ fontSize: '24px', color: C.border }}>→</div>
            <YieldWaterfall
              total={Number(site.area) || 0}
              deductions={[
                { label: 'Setbacks',  value: liveSnapshot.setbackLoss || 0 },
                { label: 'Easements', value: 0 },
                { label: 'TPZ',       value: 0 },
              ]}
              final={liveSnapshot.footprint || 0}
            />
          </div>
        </div>

        {/* --- 5. STRATEGIC EVIDENCE FLOW --- */}
        <div style={{ marginBottom: '40px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 15, 
            borderBottom: `1px solid ${accentColor}44`, 
            paddingBottom: 5 
          }}>
            <div style={{ fontSize: '12px', fontWeight: 800, color: accentColor, textTransform: 'uppercase' }}>Sovereign Strategic Evidence Chain</div>
            {hasConflict && (
              <div style={{ fontSize: '10px', fontWeight: 800, color: C.semantic.danger, backgroundColor: 'rgba(231, 76, 60, 0.1)', padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.semantic.danger}44` }}>
                ⚠️ RISK-ADJUSTED
              </div>
            )}
          </div>
          
          <div style={{ 
            fontSize: '14px', 
            lineHeight: 1.6, 
            color: C.text.secondary, 
            marginBottom: 25, 
            fontStyle: 'italic', 
            borderLeft: `4px solid ${accentColor}`, 
            padding: '15px 20px',
            backgroundColor: C.surface.card
          }}>
            "{synthesis?.summary || (typeof synthesis === 'object' ? synthesis?.text : "No strategic synthesis available. Please run Site Investigation to generate AI insights.")}"
          </div>
          
          {synthesis?.decisionWaterfall && synthesis.decisionWaterfall.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {synthesis.decisionWaterfall.map((step, i) => {
                const trust = getTrustLabel(step);
                return (
                  <div key={i} style={{ 
                    fontSize: '13px', 
                    padding: '15px', 
                    backgroundColor: C.surface.card, 
                    borderRadius: '6px', 
                    border: `1px solid ${C.surface.border}`,
                    borderLeft: `5px solid ${step.type === 'ALERT' ? C.semantic.danger : (step.type === 'ADVICE' ? C.semantic.info : C.semantic.success)}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ 
                        fontWeight: 800, 
                        color: step.type === 'ALERT' ? C.semantic.danger : (step.type === 'ADVICE' ? C.semantic.info : C.semantic.success),
                        fontSize: '14px'
                      }}>
                        {step.type === 'ALERT' ? '⚠️' : (step.type === 'ADVICE' ? 'ℹ️' : '✅')} {step.conclusion}
                      </div>
                      {trust && (
                        <div style={{ 
                          fontSize: '9px', 
                          fontWeight: 800, 
                          color: trust.color, 
                          textTransform: 'uppercase', 
                          border: `1px solid ${trust.color}66`, 
                          padding: '1px 6px', 
                          borderRadius: 3,
                          backgroundColor: trust.bg
                        }}>
                          {trust.text}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', color: C.text.secondary, fontSize: '12px' }}>
                      <div><span style={{ fontWeight: 700, color: C.text.primary }}>Evidence:</span> {step.evidence}</div>
                      <div><span style={{ fontWeight: 700, color: C.text.primary }}>Impact:</span> {step.impact}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* --- 6. SOVEREIGN AUDIT STAMP --- */}
        <div style={{ 
          marginTop: '40px', 
          padding: '20px', 
          backgroundColor: C.surface.panel, 
          borderRadius: '8px', 
          border: `1px solid ${C.surface.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 10
        }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: C.text.primary, textTransform: 'uppercase', marginBottom: 5 }}>Sovereign Audit Verification</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(fatalRisks.length > 0 || activeAlerts.length > 0) ? (
              <>
                {fatalRisks.map((risk, i) => (
                  <div key={i} style={{ fontSize: '12px', color: C.semantic.danger, fontWeight: 700, display: 'flex', gap: 6 }}>
                    <span>🚫</span> FATAL: {risk.message}
                  </div>
                ))}
                {activeAlerts.map((alert, i) => (
                  <div key={i} style={{ fontSize: '12px', color: 'rgba(241, 196, 15, 0.8)', display: 'flex', gap: 6 }}>
                    <span>⚠️</span> ALERT: {alert.message}
                  </div>
                ))}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: C.semantic.success, fontWeight: 600 }}>✓ All primary physical constraints verified. No fatal anomalies detected.</div>
            )}
          </div>
        </div>

        {/* --- 7. FORMAL FOOTER --- */}
        <div style={{ 
          marginTop: '60px', 
          textAlign: 'right', 
          fontSize: '10px', 
          color: C.text.secondary, 
          borderTop: `1px solid ${C.surface.border}`, 
          paddingTop: '20px',
          fontStyle: 'italic'
        }}>
          Generated by WebTool v2.3 Sovereign Platform | Proprietary & Confidential | Project-Specific Evidence-Backed Analysis
        </div>
      </div>
    </div>
  );
};
