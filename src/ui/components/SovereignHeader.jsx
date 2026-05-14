/**
 * @file ui/components/SovereignHeader.jsx
 * @description Professional Command Center Header for WebTool SaaS.
 * @version 4.1.0 - Bug fixes: onTabChange prop, alert() -> toast, single stable subscription.
 *
 * Sub-modules:
 *   - PersonaPill.jsx     (persona switcher)
 *   - ScenarioManager.jsx (scenario CRUD dropdown)
 */

import React, { useState, useEffect, useRef } from 'react';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { store } from '../../core/store/store.js';
import { KineticMetric } from '../components/KineticMetric.jsx';
import { PersonaPill, PERSONAS } from './PersonaPill.jsx';
import { ScenarioManager } from './ScenarioManager.jsx';

// ---------------------------------------------------------------------------
// TargetBreadcrumb
// ---------------------------------------------------------------------------

const TargetBreadcrumb = ({ site, scenarioId }) => {
  if (!site || !site.address) {
    return (
      <div style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.3)', fontWeight: 500, fontStyle: 'italic' }}>
        NO TARGET SELECTED
      </div>
    );
  }

  const scenarioName = scenarioId ? scenarioId.toUpperCase().replace(/_/g, ' ') : 'DEFAULT';
  const hasMetrics   = site.area > 0 || site.frontage > 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: T.sp.sm,
      fontSize: T.fs.xs,
      color: 'rgba(255,255,255,0.8)',
      fontFamily: T.mono || 'monospace',
      fontWeight: 500
    }}>
      <span style={{
        backgroundColor: 'rgba(255,255,255,0.15)',
        padding: '2px 6px',
        borderRadius: 4,
        color: '#fff',
        fontWeight: 800,
        fontSize: '9px',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {scenarioName}
      </span>
      <span style={{ opacity: 0.5 }}>Pin</span>
      <span style={{ fontWeight: 700, color: '#fff' }}>{site.address}</span>

      {hasMetrics && (
        <div style={{ display: 'flex', gap: T.sp.sm, color: 'rgba(255,255,255,0.5)' }}>
          <span style={{ opacity: 0.3 }}>|</span>
          <KineticMetric value={site.area}     suffix="m2" decimals={0} />
          <KineticMetric value={site.frontage} suffix="m"  decimals={1} />
          <KineticMetric value={site.depth}    suffix="m"  decimals={1} />
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Inline Toast
// ---------------------------------------------------------------------------

const Toast = ({ msg, type }) => {
  if (!msg) return null;
  const bg = type === 'error' ? 'rgba(231,76,60,0.15)' : 'rgba(46,204,113,0.15)';
  const border = type === 'error' ? 'rgba(231,76,60,0.4)' : 'rgba(46,204,113,0.4)';
  const color  = type === 'error' ? '#ff6b6b' : '#2ecc71';
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      padding: '10px 16px',
      backgroundColor: bg,
      border: '1px solid ' + border,
      borderRadius: 8,
      fontSize: T.fs.xs,
      fontWeight: 700,
      color,
      zIndex: 9999,
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      animation: 'fadeIn 0.2s ease'
    }}>
      {msg}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main Header
// ---------------------------------------------------------------------------

/**
 * @param {Function} onTabChange  - Callback from AppShell to switch the active tab.
 *                                  Replaces the old store.dispatch('system.activeTab') anti-pattern.
 */
export const SovereignHeader = ({ onTabChange }) => {
  const [isScenarioOpen, setIsScenarioOpen] = useState(false);
  const [internalState,  setInternalState]  = useState(store.getState());
  const [pulseActive,    setPulseActive]    = useState(false);
  const [toast,          setToast]          = useState(null); // { msg, type }

  const fileInputRef = useRef(null);
  const headerRef    = useRef(null);

  // Single stable subscription -- no propState dependency, no re-subscription on every render.
  useEffect(() => {
    const unsubscribe = store.subscribe((newState) => setInternalState(newState));

    // Alt+[1-4]: switch persona
    const handleKeyDown = (e) => {
      if (e.altKey && /^[1-4]$/.test(e.key)) {
        const persona = PERSONAS[parseInt(e.key) - 1];
        if (persona) {
          store.dispatch('system.activePersona', persona.id);
          store.dispatch('system.activeAccentColor', persona.color);
          setPulseActive(true);
          setTimeout(() => setPulseActive(false), 600);
        }
      }
    };

    const handleClickOutside = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) {
        setIsScenarioOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      unsubscribe();
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []); // empty deps: runs once, stable for lifetime of component

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  const state         = internalState;
  const { system, scenarios } = state;
  const activeId      = system.activeScenarioId;
  const activePersona = system.activePersona;
  const accentColor   = system.activeAccentColor || '#0f4c75';
  const conflicts     = system.consistencyConflicts || [];
  const site          = state.scenarios?.[activeId]?.site || {};

  const health = (() => {
    const count = conflicts.length;
    if (count === 0) return { label: 'SYSTEM HEALTHY',      color: '#00b894' };
    if (count <= 3)  return { label: 'MINOR DISCREPANCIES', color: '#fdcb6e' };
    return             { label: 'CRITICAL CONFLICT',        color: '#d63030' };
  })();

  const handlePersonaChange = (id) => {
    const p = PERSONAS.find(p => p.id === id);
    store.dispatch('system.activePersona', id);
    if (p) store.dispatch('system.activeAccentColor', p.color);
  };

  const handleExport = () => {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'Sovereign_Project_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = store.restoreFromArchive(ev.target.result);
      // FIX: was alert() -- now uses inline toast
      if (result.success) {
        showToast('Project archive restored successfully.', 'success');
      } else {
        showToast('Restore failed: ' + (result.error || 'Unknown error'), 'error');
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = '';
  };

  // FIX: health button now calls onTabChange prop instead of store.dispatch('system.activeTab')
  const handleHealthClick = () => {
    if (onTabChange) onTabChange('comparison');
  };

  return (
    <header
      ref={headerRef}
      className={pulseActive ? 'command-pulse' : ''}
      style={{
        height: 60,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 ' + T.sp.lg + 'px',
        fontFamily: SANS,
        backgroundColor: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(25px)',
        WebkitBackdropFilter: 'blur(25px)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 30px ' + accentColor + '22',
        transition: 'box-shadow 0.8s cubic-bezier(0.23, 1, 0.32, 1)',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        @keyframes command-pulse {
          0%   { border-bottom-color: rgba(255,255,255,0.1); }
          50%  { border-bottom-color: ${accentColor}; }
          100% { border-bottom-color: rgba(255,255,255,0.1); }
        }
        .command-pulse { animation: command-pulse 0.6s ease-out; }
        @keyframes logo-pulse {
          0%   { transform: scale(1);    box-shadow: 0 0 15px ${accentColor}44; }
          50%  { transform: scale(1.05); box-shadow: 0 0 25px ${accentColor}88; }
          100% { transform: scale(1);    box-shadow: 0 0 15px ${accentColor}44; }
        }
        .logo-pulse { animation: logo-pulse 0.6s ease-out; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* LEFT: Brand + System Health */}
      <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.lg }}>
        <div
          className={pulseActive ? 'logo-pulse' : ''}
          style={{
            width: 36, height: 36, borderRadius: 8,
            background: 'linear-gradient(135deg, ' + accentColor + ', #fff)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: T.fs.sm,
            boxShadow: '0 4px 12px ' + accentColor + '44',
            color: '#fff', transition: 'all 0.6s ease'
          }}
        >
          WT
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h1 style={{ fontSize: T.fs.md, fontWeight: 700, margin: 0, color: '#fff', letterSpacing: '-0.5px' }}>
            WebTool <span style={{ opacity: 0.4, fontWeight: 400, fontSize: T.fs.xs }}>Sovereign Platform</span>
          </h1>
          {/* FIX: was store.dispatch('system.activeTab', ...) which AppShell never reads */}
          <button
            onClick={handleHealthClick}
            title="Click to open Comparison panel"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '10px', fontWeight: 700, color: health.color,
              letterSpacing: '1px', textTransform: 'uppercase',
              background: 'none', border: 'none', padding: 0,
              cursor: conflicts.length > 0 ? 'pointer' : 'default',
              fontFamily: SANS
            }}
          >
            {health.label}
            {conflicts.length > 0 && (
              <span style={{ opacity: 0.5, fontWeight: 400 }}>({conflicts.length} issues)</span>
            )}
          </button>
        </div>
      </div>

      {/* CENTER: Persona switcher + breadcrumb */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: T.sp.xs,
        flex: 1, maxWidth: '50%', marginLeft: T.sp.xl, marginRight: T.sp.xl
      }}>
        <PersonaPill
          activePersona={activePersona}
          onPersonaChange={handlePersonaChange}
          accentColor={accentColor}
          onCommandTriggered={() => {
            setPulseActive(true);
            setTimeout(() => setPulseActive(false), 600);
          }}
        />
        <TargetBreadcrumb site={site} scenarioId={activeId} />
      </div>

      {/* RIGHT: Scenario + Import/Export */}
      <div style={{ display: 'flex', gap: T.sp.md, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsScenarioOpen(!isScenarioOpen)}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '6px 14px', borderRadius: 8,
              fontSize: T.fs.xs, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10
            }}
          >
            <span style={{ opacity: 0.5, fontWeight: 600 }}>SCENARIO</span>
            <span style={{ fontWeight: 700 }}>
              {activeId ? activeId.toUpperCase().replace(/_/g, ' ') : 'DEFAULT'}
            </span>
            <span style={{ fontSize: '8px', opacity: 0.5 }}>v</span>
          </button>

          {isScenarioOpen && (
            <ScenarioManager
              scenarios={scenarios}
              activeId={activeId}
              onClose={() => setIsScenarioOpen(false)}
            />
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleImport}
          />
          <button
            onClick={() => fileInputRef.current.click()}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '6px 14px', borderRadius: 8,
              cursor: 'pointer', fontSize: T.fs.xs, fontFamily: SANS,
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            Import
          </button>
          <button
            onClick={handleExport}
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '6px 14px', borderRadius: 8,
              cursor: 'pointer', fontSize: T.fs.xs, fontFamily: SANS,
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            Export
          </button>
        </div>
      </div>

      {/* Toast notification (replaces alert) */}
      <Toast msg={toast?.msg} type={toast?.type} />
    </header>
  );
};
