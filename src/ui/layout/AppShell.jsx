/**
 * @file ui/layout/AppShell.jsx
 * @description Main application shell for WebTool SaaS.
 * Implements the Sovereign Task Switcher and Logical Conflict HUD.
 * @version 3.2.0 - liveSnapshot fully removed from AppShell; each consumer owns its own hook.
 */

import React, { useState, useEffect } from 'react';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { SovereignHeader } from '../components/SovereignHeader.jsx';
import { SiteContextSidebar } from '../components/SiteContextSidebar.jsx';

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
 * React Error Boundary — wraps each panel individually.
 * Catches runtime errors so a single broken panel doesn't white-screen the app.
 * key={activeTab} in the call site ensures the boundary resets on tab switch.
 *
 * Multi-level recovery:
 *   1st crash  → "Force Retry" button (tries once more in case it was transient)
 *   2nd crash  → only "Go to Site Investigation" is shown; retry is hidden to
 *               prevent an infinite crash loop caused by bad store state.
 */
class PanelErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '', retryCount: 0 };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || 'Unknown error' };
  }
  componentDidCatch(err, info) {
    console.error('[PanelErrorBoundary]', err, info);
  }
  handleRetry() {
    this.setState(prev => ({
      hasError: false,
      message: '',
      retryCount: prev.retryCount + 1,
    }));
  }
  render() {
    if (this.state.hasError) {
      const canRetry = this.state.retryCount < 1;
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '60vh', gap: 16,
          color: 'rgba(255,255,255,0.7)', textAlign: 'center', padding: 32
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#f87171' }}>
            Panel crashed — {this.state.message}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', maxWidth: 420 }}>
            {canRetry
              ? 'Your data is safe. You can retry once, or switch to a different tab.'
              : 'This panel keeps crashing — likely caused by unexpected data in this scenario. Switch to Site Investigation to continue safely.'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {/* Primary: always offer escape to a known-safe panel */}
            <button
              onClick={() => this.props.onSafeTabRequest?.('siteinv')}
              style={{
                background: 'rgba(0,122,255,0.2)', border: '1px solid rgba(0,122,255,0.5)',
                borderRadius: 8, color: '#60aaff', fontWeight: 700, fontSize: 13,
                padding: '8px 20px', cursor: 'pointer'
              }}
            >
              ← Go to Site Investigation
            </button>
            {/* Secondary: only shown on first crash */}
            {canRetry && (
              <button
                onClick={() => this.handleRetry()}
                style={{
                  background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
                  borderRadius: 8, color: '#a5b4fc', fontWeight: 700, fontSize: 13,
                  padding: '8px 20px', cursor: 'pointer'
                }}
              >
                ↺ Force Retry
              </button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppShell = () => {
  const [activeTab, setActiveTab] = useState('siteinv');

  // AppShell only tracks the two fields it directly renders:
  //   accentColor  — nav tab highlight colour
  //   conflicts    — Logical Conflict HUD
  // Everything else is owned by each panel's own store.subscribe().
  // liveSnapshot is no longer held here — each consumer (InsightPanel, SovereignMemoPanel)
  // calls useLiveSnapshot() internally so AppShell never re-renders on finance changes.
  const [shellSlice, setShellSlice] = useState(() => {
    const sys = store.getState().system;
    return {
      accentColor: sys?.activeAccentColor   || '#0f4c75',
      conflicts:   sys?.consistencyConflicts || [],
    };
  });

  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => {
      const sys = newState.system;
      // Only re-render AppShell when its own visual fields change.
      // liveSnapshot is no longer held here — bail out early on unrelated changes.
      setShellSlice(prev => {
        const nextAccent    = sys?.activeAccentColor    || '#0f4c75';
        const nextConflicts = sys?.consistencyConflicts || [];
        if (
          prev.accentColor === nextAccent &&
          prev.conflicts   === nextConflicts
        ) return prev; // referential equality — no re-render
        return { accentColor: nextAccent, conflicts: nextConflicts };
      });
    });
    return () => unsubscribe();
  }, []);

  const { accentColor, conflicts } = shellSlice;

  // Each panel manages its own store.subscribe() and (where needed) useLiveSnapshot().
  // AppShell passes NO state, scenario, or liveSnapshot props — eliminating all
  // props-cascade double-renders from AppShell re-renders.
  const renderPanel = () => {
    switch (activeTab) {
      case 'siteinv':    return <SiteInvestigationPanel />;
      case 'physical':   return <PhysicalConditionPanel />;
      case 'planning':   return <PlanningPanel />;
      case 'market':     return <MarketPanel_V2 />;
      case 'finance':    return <FinancePanel />;
      case 'insights':   return <InsightPanel />;
      case 'comparison': return <ComparisonPanel />;
      case 'report':     return <ReportPanel_Fixed />;
      case 'memo':       return <SovereignMemoPanel />;
      default:           return <SiteInvestigationPanel />;
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
      {/* SovereignHeader has its own store.subscribe — state prop is redundant */}
      <SovereignHeader onTabChange={setActiveTab} />

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
        {/* LEFT SIDEBAR - Site Context — clips all overflow, no scrollbars */}
        <aside style={{
          borderRight: '1px solid ' + C.surface.border,
          overflow: 'hidden',            // both X and Y — prevents any scrollbar
          backgroundColor: C.surface.panel
        }}>
          {/* SiteContextSidebar has its own store.subscribe and useLiveSnapshot — no props needed */}
          <SiteContextSidebar />
        </aside>

        {/* CONTENT AREA */}
        <section style={{
          overflowY: 'auto',
          padding: T.sp.lg,
          display: 'flex',
          flexDirection: 'column',
          gap: T.sp.md
        }}>
          <PanelErrorBoundary key={activeTab} onSafeTabRequest={setActiveTab}>{renderPanel()}</PanelErrorBoundary>
        </section>
      </main>
    </div>
  );
};
