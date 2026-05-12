/**
 * @file ui/layout/AppShell.jsx
 * @description Main application shell for WebTool SaaS.
 * Implements the Sovereign Task Switcher and Logical Conflict HUD.
 * @version 3.1.0 - Bug fixes: nav top offset, onTabChange prop, header height constant.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { SovereignHeader } from '../components/SovereignHeader.jsx';
import { SiteContextSidebar } from '../components/SiteContextSidebar.jsx';
import { getLiveSnapshot } from '../../domain/finance/live_calc_engine.js';

// Panel Imports
import { SiteInvestigationPanel } from '../panels/SiteInvestigationPanel.jsx';
import { PlanningPanel } from '../panels/PlanningPanel.jsx';
import { FinancePanel } from '../panels/FinancePanel.jsx';
import { PhysicalConditionPanel } from '../panels/PhysicalConditionPanel.jsx';
import { MarketPanel_V2 } from '../panels/MarketPanel_V2.jsx';
import { ReportPanel_Fixed } from '../panels/ReportPanel_Fixed.jsx';
import { SovereignMemoPanel } from '../panels/SovereignMemoPanel.jsx';
import { InsightPanel } from '../panels/InsightPanel.jsx';
import { ComparisonPanel } from '../panels/ComparisonPanel.jsx';

const TABS = [
  { id: 'siteinv',    label: 'Site Investigation',  icon: '1' },
  { id: 'physical',   label: 'Physical Conditions', icon: '2' },
  { id: 'planning',   label: 'Planning & Zoning',   icon: '3' },
  { id: 'market',     label: 'Market Intelligence', icon: '4' },
  { id: 'finance',    label: 'Financial Analysis',  icon: '5' },
  { id: 'insights',   label: 'AI Insights',         icon: '6' },
  { id: 'comparison', label: 'Comparison',          icon: '7' },
  { id: 'report',     label: 'Executive Report',    icon: '8' },
  { id: 'memo',       label: 'Sovereign Memo',      icon: '9' },
];

/** Header height in px: padding-top(12) + logo(36) + padding-bottom(12) */
const HEADER_H = 60;

/**
 * Debounce helper - defers fn by `delay` ms, cancels prior pending call.
 */
const useDebouncedCallback = (fn, delay) => {
  const timerRef = useRef(null);
  return (...args) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fn(...args), delay);
  };
};

export const AppShell = () => {
  const [activeTab,    setActiveTab]    = useState('siteinv');
  const [appState,     setAppState]     = useState(store.getState());
  const [liveSnapshot, setLiveSnapshot] = useState(null);

  // Debounce the live calc so it only fires 300ms after the last state change,
  // preventing a full recalculation cascade on every keystroke.
  const debouncedCalc = useDebouncedCallback((newState) => {
    try {
      setLiveSnapshot(getLiveSnapshot(newState));
    } catch (e) {
      console.error('[LiveCalc] Simulation error', e);
    }
  }, 300);

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      setAppState(newState);
      debouncedCalc(newState);
    });
    return () => unsubscribe();
  }, []);

  const state       = appState;
  const accentColor = state.system?.activeAccentColor || '#0f4c75';

  // Memoize conflict list - avoids re-rendering the HUD on every unrelated state change
  const conflicts = useMemo(
    () => state.system?.consistencyConflicts || [],
    [state.system?.consistencyConflicts]
  );

  const renderPanel = () => {
    const scenario = store.getActiveScenario() || {};
    switch (activeTab) {
      case 'siteinv':    return <SiteInvestigationPanel  state={state} scenario={scenario} />;
      case 'physical':   return <PhysicalConditionPanel  state={state} scenario={scenario} />;
      case 'planning':   return <PlanningPanel           state={state} scenario={scenario} />;
      case 'market':     return <MarketPanel_V2          state={state} scenario={scenario} />;
      case 'finance':    return <FinancePanel            state={state} scenario={scenario} />;
      case 'insights':   return <InsightPanel            state={state} scenario={scenario} liveSnapshot={liveSnapshot} />;
      case 'comparison': return <ComparisonPanel         state={state} />;
      case 'report':     return <ReportPanel_Fixed       state={state} scenario={scenario} liveSnapshot={liveSnapshot} />;
      case 'memo':       return <SovereignMemoPanel      state={state} scenario={scenario} />;
      default:           return <SiteInvestigationPanel  state={state} scenario={scenario} />;
    }
  };

  return (
    <div style={{
      backgroundColor: C.surface.bg,
      height: '100vh',
      overflow: 'hidden',
      fontFamily: SANS,
      color: C.text.primary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* FIX #18: pass onTabChange so header health button can actually switch tabs */}
      <SovereignHeader state={state} onTabChange={setActiveTab} />

      {/* SOVEREIGN TASK SWITCHER */}
      {/* FIX #17: top was 0 -- nav slid under the sticky header. Now anchored below it. */}
      <nav style={{
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        backgroundColor: C.surface.panel,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid ' + C.surface.border,
        padding: '8px ' + T.sp.lg + 'px',
        gap: 4,
        zIndex: 999,
        position: 'sticky',
        top: HEADER_H
      }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 14px',
                border: 'none',
                cursor: 'pointer',
                fontSize: T.fs.xs,
                fontFamily: SANS,
                borderRadius: T.r.md,
                transition: 'all 0.2s ease',
                backgroundColor: isActive ? 'rgba(0, 122, 255, 0.15)' : 'transparent',
                color: isActive ? '#FFFFFF' : 'rgba(255,255,255,0.75)',
                fontWeight: isActive ? 700 : 500,
                borderBottom: isActive ? '2px solid ' + accentColor : '2px solid transparent',
                transform: isActive ? 'translateY(-1px)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                textShadow: '0 1px 2px rgba(0,0,0,0.8)'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* LOGICAL CONFLICT HUD */}
      {conflicts.length > 0 && (
        <div style={{
          backgroundColor: 'rgba(231, 76, 60, 0.1)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(231, 76, 60, 0.2)',
          padding: T.sp.sm + 'px ' + T.sp.lg + 'px',
          display: 'flex',
          flexDirection: 'column',
          gap: T.sp.xs,
          borderLeft: '4px solid #E74C3C',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          borderRadius: '0 0 12px 12px',
          margin: '0 ' + T.sp.md + 'px',
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.semantic.danger, fontSize: T.fs.xs, fontWeight: 800, letterSpacing: '0.5px' }}>
            <span>SOVEREIGN LOGICAL CONFLICT DETECTED</span>
            <span style={{ opacity: 0.6, fontWeight: 400 }}>
              ({conflicts.length} Issue{conflicts.length > 1 ? 's' : ''})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conflicts.map((conflict, i) => (
              <div key={i} style={{ fontSize: '11px', color: 'rgba(231, 76, 60, 0.85)', lineHeight: 1.5, display: 'flex', gap: 6 }}>
                <span style={{ fontWeight: 700 }}>{conflict.label}:</span>
                <span>{conflict.message}</span>
                <span style={{ color: C.semantic.danger, fontWeight: 700, fontStyle: 'italic' }}>
                  {conflict.suggestion}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN LAYOUT: sidebar + content */}
      <main style={{
        display: 'grid',
        gridTemplateColumns: '280px 1fr',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden'
      }}>
        {/* LEFT SIDEBAR - Site Context — no scrollbar, clips overflow */}
        <aside style={{
          borderRight: '1px solid ' + C.surface.border,
          overflowY: 'hidden',
          backgroundColor: C.surface.panel
        }}>
          <SiteContextSidebar state={state} liveSnapshot={liveSnapshot} />
        </aside>

        {/* CONTENT AREA */}
        <section style={{
          overflowY: 'auto',
          padding: T.sp.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: T.sp.md
        }}>
          {renderPanel()}
        </section>
      </main>
    </div>
  );
};
