/**
 * @file ui/panels/ReportPanel_Fixed.jsx
 * @description Professional report generation panel.
 * Updated to support Strategic Reports and AI Insights.
 * @version 2.0.0
 */

import React, { useState, useEffect } from 'react';
import { store } from '../../core/store/store';
import { C, SANS, T } from '../../core/config/theme_v3.js';
import { generateStrategicReport, exportProjectJSON, exportToPDF } from '../../domain/export/export_engine';

export const ReportPanel_Fixed = () => {
  const [scenario, setScenario] = useState(() => store.getActiveScenario());
  const [isExporting, setIsExporting] = useState(false);
  const [currentInsights, setCurrentInsights] = useState(null); // kept for compat

  useEffect(() => {
    const unsub = store.subscribe(() => setScenario(store.getActiveScenario()));
    return unsub;
  }, []);

  const handleExportMD = () => {
    const activeScenario = store.getActiveScenario();
    // In a real app, we'd get latest calculations from the calculator
    const calculations = activeScenario.calculations;
    
    const storeInsights = store.getState()?.system?.lastInsights || currentInsights;
    const md = generateStrategicReport(activeScenario, calculations, storeInsights);
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Strategic_Report_${activeScenario.site.address || 'Project'}.md`;
    a.click();
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const activeScenario = store.getActiveScenario();
      const calculations = activeScenario.calculations;
      await exportToPDF(activeScenario, calculations);
    } catch (e) {
      console.error('PDF Export failed:', e.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJSON = () => {
    const json = exportProjectJSON(store.getState());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  return (
    <div style={{ 
      backgroundColor: C.surface.panel, 
      color: C.text.primary,
      padding: T.sp.lg,
      borderRadius: T.r.md,
      border: `1px solid ${C.surface.border}`,
      fontFamily: SANS
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: T.sp.sm, 
        marginBottom: T.sp.md,
        color: C.text.primary,
        fontSize: T.fs.md,
        fontWeight: 700
      }}>
        <span style={{ fontSize: '20px' }}>📄</span>
        <h2>Project Export & Reports</h2>
      </div>

      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: T.sp.lg 
      }}>
        <div style={{ 
          backgroundColor: C.surface.card, 
          padding: T.sp.md, 
          borderRadius: T.r.md, 
          border: `1px solid ${C.surface.border}`,
          display: 'flex', 
          flexDirection: 'column', 
          gap: T.sp.sm
        }}>
          <h3 style={{ 
            fontSize: T.fs.sm, 
            fontWeight: 600, 
            color: C.text.primary, 
            margin: 0 
          }}>Strategic Report (MD)</h3>
          <p style={{ 
            fontSize: T.fs.xs, 
            color: C.text.secondary, 
            margin: 0, 
            lineHeight: 1.5 
          }}>Professional Markdown report including AI insights and financial summaries. Ideal for Obsidian.</p>
          <button onClick={handleExportMD} style={{ 
            marginTop: T.sp.sm,
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: C.text.primary,
            border: `1px solid ${C.surface.borderBright}`,
            padding: '6px 12px',
            borderRadius: T.r.sm,
            cursor: 'pointer',
            fontSize: T.fs.xxs,
            fontWeight: 600,
            alignSelf: 'flex-start'
          }}>
            Download .md
          </button>
        </div>

        <div style={{ 
          backgroundColor: C.surface.card, 
          padding: T.sp.md, 
          borderRadius: T.r.md, 
          border: `1px solid ${C.surface.border}`,
          display: 'flex', 
          flexDirection: 'column', 
          gap: T.sp.sm
        }}>
          <h3 style={{ 
            fontSize: T.fs.sm, 
            fontWeight: 600, 
            color: C.text.primary, 
            margin: 0 
          }}>Official PDF</h3>
          <p style={{ 
            fontSize: T.fs.xs, 
            color: C.text.secondary, 
            margin: 0, 
            lineHeight: 1.5 
          }}>Clean, printable PDF summary of the project's current viability.</p>
          <button 
            
            onClick={handleExportPDF} 
            disabled={isExporting} 
            style={{ 
              marginTop: T.sp.sm,
              backgroundColor: C.brand.main,
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: T.r.sm,
              cursor: 'pointer',
              fontSize: T.fs.xxs,
              fontWeight: 600,
              alignSelf: 'flex-start'
            }}
          >
            {isExporting ? 'Generating...' : 'Download PDF'}
          </button>
        </div>

        <div style={{ 
          backgroundColor: C.surface.card, 
          padding: T.sp.md, 
          borderRadius: T.r.md, 
          border: `1px solid ${C.surface.border}`,
          display: 'flex', 
          flexDirection: 'column', 
          gap: T.sp.sm
        }}>
          <h3 style={{ 
            fontSize: T.fs.sm, 
            fontWeight: 600, 
            color: C.text.primary, 
            margin: 0 
          }}>Data Backup (JSON)</h3>
          <p style={{ 
            fontSize: T.fs.xs, 
            color: C.text.secondary, 
            margin: 0, 
            lineHeight: 1.5 
          }}>Full system state export. Use this to backup your scenarios or share the project.</p>
          <button onClick={handleExportJSON} style={{ 
            marginTop: T.sp.sm,
            backgroundColor: 'rgba(255,255,255,0.05)',
            color: C.text.primary,
            border: `1px solid ${C.surface.borderBright}`,
            padding: '6px 12px',
            borderRadius: T.r.sm,
            cursor: 'pointer',
            fontSize: T.fs.xxs,
            fontWeight: 600,
            alignSelf: 'flex-start'
          }}>
            Export JSON
          </button>
        </div>
      </div>
      
      <div style={{ 
        marginTop: T.sp.lg, 
        padding: T.sp.sm, 
        borderLeft: `2px solid ${C.brand.main}`, 
        backgroundColor: 'rgba(0, 122, 255, 0.05)', 
        borderRadius: '0 4px 4px 0',
        fontSize: T.fs.xs, 
        color: C.text.secondary,
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }}>
        <span style={{ fontSize: '14px' }}>💡</span>
        <p style={{ margin: 0 }}>Tip: Ensure you have generated AI Insights first to include them in your Strategic Report.</p>
      </div>
    </div>
  
  );
};
