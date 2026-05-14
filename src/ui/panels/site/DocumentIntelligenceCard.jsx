/**
 * @file ui/panels/site/DocumentIntelligenceCard.jsx
 * @description Step 2 — Document Intelligence container.
 *   Manages docFiles state, upload parsing, priority-cascade apply logic.
 *   Extracted from SiteInvestigationPanel.jsx (Task #83).
 * @version 1.0.0
 */

import React, { useState } from 'react';
import { C, T } from '../../../core/config/theme_v3.js';
import { store } from '../../../core/store/store.js';
import { extractFileText } from '../../../domain/extraction/pdf_ocr.js';
import {
  normalizeVicPlanResult, normalizeS32Result, normalizeSurveyResult,
  FIELD_TO_PATH, FIELD_LABELS,
} from '../../../domain/extraction/unified_engine.js';
import { parseDocumentWithAI } from '../../../domain/extraction/ai_adapter.js';
import { parseVicPlanText, parseSection32Text, parseSurveyPlan } from '../../../domain/extraction/parsers.js';
import { evaluateConstraints } from '../../../domain/spatial/constraint_engine.js';
import { DocFileCard } from './DocFileCard.jsx';

const DOC_SLOTS = [
  { key: 'vp',  label: 'VicPlan Certificate',         hint: 'Planning certificate from SPEAR / council' },
  { key: 's32', label: 'Section 32 Vendor Statement',  hint: 'Vendor statement / Contract of Sale' },
  { key: 'fsp', label: 'Feature & Level Survey Plan',  hint: 'Registered surveyor plan — extracts lot area, frontage, depth, easements' },
];

const PRIORITY_ORDER = ['vp', 's32', 'fsp'];

const APPLY_STYLE = {
  height: 38,
  backgroundColor: '#007AFF',
  color: '#fff',
  fontWeight: 700,
  border: 'none',
  boxShadow: '0 4px 12px rgba(0, 122, 255, 0.3)',
};

/**
 * @param {Function} props.onEstimatedReset - Called after apply to clear estimated flags
 */
export const DocumentIntelligenceCard = ({ onEstimatedReset }) => {
  const [docFiles,           setDocFiles]           = useState({ vp: null, s32: null, fsp: null });
  const [extractionProgress, setExtractionProgress] = useState(false);
  const [extractionError,    setExtractionError]    = useState(null);
  const [appliedFields,      setAppliedFields]      = useState(null);

  // ---------------------------------------------------------------------------
  // Upload — type-aware specialist parsing
  // ---------------------------------------------------------------------------
  const handleDocUpload = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocFiles(prev => ({ ...prev, [type]: { status: 'parsing', fileName: file.name } }));
    setExtractionError(null);
    setAppliedFields(null);
    try {
      const text = await extractFileText(file);
      let parsed;
      if (type === 'vp') {
        parsed = normalizeVicPlanResult(parseVicPlanText(text), await parseDocumentWithAI(text));
      } else if (type === 's32') {
        parsed = normalizeS32Result(parseSection32Text(text), await parseDocumentWithAI(text));
      } else {
        parsed = normalizeSurveyResult(parseSurveyPlan(text));
      }
      setDocFiles(prev => ({ ...prev, [type]: { status: 'ready', fileName: file.name, text, parsed } }));
    } catch {
      setDocFiles(prev => ({ ...prev, [type]: { status: 'error', fileName: file.name } }));
      setExtractionError('Could not parse "' + file.name + '". Make sure it is a readable PDF or text file.');
    }
  };

  const clearDocFile = (type) => {
    setDocFiles(prev => ({ ...prev, [type]: null }));
    setAppliedFields(null);
  };

  const hasReadyDoc      = Object.values(docFiles).some(f => f?.status === 'ready');
  const pendingFieldCount = Object.values(docFiles)
    .filter(f => f?.status === 'ready')
    .reduce((sum, f) => {
      const fields = f.parsed?.fields || {};
      return sum + Object.entries(fields).filter(([k, v]) =>
        FIELD_TO_PATH[k] && v !== false && v !== null && v !== undefined
      ).length;
    }, 0);

  // ---------------------------------------------------------------------------
  // Apply — priority cascade: VP → S32 → FSP (FSP wins)
  // ---------------------------------------------------------------------------
  const applyExtraction = () => {
    if (!hasReadyDoc) return;
    setExtractionProgress(true);
    setExtractionError(null);
    try {
      const mergedPaths = {};
      PRIORITY_ORDER.forEach(docKey => {
        const f = docFiles[docKey];
        if (!f || f.status !== 'ready') return;
        Object.entries(f.parsed?.fields || {}).forEach(([key, val]) => {
          const path = FIELD_TO_PATH[key];
          if (!path || val === false || val === null || val === undefined) return;
          mergedPaths[path] = { val, key };
        });
      });

      const updates = [];
      const changes = [];
      Object.entries(mergedPaths).forEach(([path, { val, key }]) => {
        updates.push({ path, value: val });
        const label   = FIELD_LABELS[key] || key;
        const display = typeof val === 'boolean' ? 'Yes'
          : Array.isArray(val) ? val.join(', ').slice(0, 80)
          : String(val).slice(0, 80);
        changes.push({ label, display });
      });

      if (updates.length) store.batchDispatch(updates);

      // Constraint synthesis from all collected facts (deduped)
      const allFacts = [...new Set(PRIORITY_ORDER.flatMap(k => docFiles[k]?.parsed?.facts || []))];
      if (allFacts.length) {
        try { store.dispatch('site.investigation.synthesis', evaluateConstraints(allFacts)); } catch {}
      }

      onEstimatedReset?.();
      setAppliedFields(changes);
      setDocFiles({ vp: null, s32: null, fsp: null });
    } catch (e) {
      setExtractionError('Failed to apply: ' + (e.message || 'unknown error'));
    } finally {
      setExtractionProgress(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div style={{
      padding: T.sp.md, backgroundColor: C.surface.card,
      borderRadius: '0 0 ' + T.r.md + 'px ' + T.r.md + 'px',
      border: '1px solid ' + C.surface.border, borderTop: 'none'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{ backgroundColor: '#007AFF', color: '#fff', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>2</div>
        <div style={{ fontWeight: 800, fontSize: T.fs.sm, color: '#FFFFFF' }}>Document Intelligence</div>
        <span style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginLeft: 4 }}>
          Upload VicPlan, Section 32, or Feasibility Report — fields update automatically
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: T.sp.sm }}>

        {/* Per-file cards */}
        {DOC_SLOTS.map(({ key, label, hint }) => (
          <DocFileCard
            key={key}
            docKey={key}
            label={label}
            hint={hint}
            slot={docFiles[key]}
            onUpload={handleDocUpload}
            onClear={clearDocFile}
          />
        ))}

        {/* Extraction error */}
        {extractionError && (
          <div style={{ padding: '9px 12px', backgroundColor: 'rgba(255,77,79,0.1)', border: '1px solid rgba(255,77,79,0.3)', borderRadius: T.r.sm, fontSize: T.fs.xs, color: '#ff4d4f', lineHeight: 1.5 }}>
            {extractionError}
          </div>
        )}

        {/* Apply button */}
        {hasReadyDoc && !appliedFields && (
          <button
            onClick={applyExtraction}
            disabled={extractionProgress}
            style={{ ...APPLY_STYLE, padding: '10px 18px', borderRadius: T.r.md, fontSize: T.fs.sm, cursor: extractionProgress ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {extractionProgress
              ? 'Applying…'
              : '✓ Apply ' + pendingFieldCount + ' field' + (pendingFieldCount !== 1 ? 's' : '') + ' to project'
            }
          </button>
        )}

        {/* Post-apply confirmation */}
        {appliedFields && (
          <div style={{ backgroundColor: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.3)', borderRadius: T.r.md, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: appliedFields.length > 0 ? '1px solid rgba(46,204,113,0.15)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: T.fs.xs, fontWeight: 800, color: '#2ecc71' }}>
                ✓ {appliedFields.length} field{appliedFields.length !== 1 ? 's' : ''} applied to project
              </span>
              <button onClick={() => setAppliedFields(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>×</button>
            </div>
            {appliedFields.length > 0 && (
              <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {appliedFields.map((f, i) => (
                  <span key={i} style={{ fontSize: T.fs.xxs, padding: '3px 8px', borderRadius: 10, backgroundColor: 'rgba(46,204,113,0.12)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.2)' }}>
                    {f.label}: <strong>{f.display}</strong>
                  </span>
                ))}
              </div>
            )}
            <div style={{ padding: '6px 14px 10px', fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.4)' }}>
              Check the Planning &amp; Zoning tab to review and adjust any values.
            </div>
          </div>
        )}

        {!hasReadyDoc && !appliedFields && (
          <div style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', textAlign: 'center', padding: '6px 0' }}>
            Upload at least one document above — extracted fields will appear here before you apply them.
          </div>
        )}
      </div>
    </div>
  );
};
