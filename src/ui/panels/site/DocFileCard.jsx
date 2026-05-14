/**
 * @file ui/panels/site/DocFileCard.jsx
 * @description Individual document slot card for Document Intelligence step.
 *   Renders upload controls + rich findings panel for one doc type (vp / s32 / fsp).
 *   Extracted from SiteInvestigationPanel.jsx (Task #83).
 * @version 1.0.0
 */

import React from 'react';
import { T } from '../../../core/config/theme_v3.js';

// ── Shared inline helpers ──────────────────────────────────────────────────────

const chip = (txt, bg, clr, bdr) => (
  <span key={txt} style={{
    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
    backgroundColor: bg, color: clr, border: '1px solid ' + bdr, whiteSpace: 'nowrap'
  }}>{txt}</span>
);

const Row = ({ label, value, color = 'rgba(255,255,255,0.7)' }) => value ? (
  <div style={{ display: 'flex', gap: 6, fontSize: 10, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
    <span style={{ minWidth: 115, color: 'rgba(255,255,255,0.4)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
    <span style={{ color, fontWeight: 700, wordBreak: 'break-word' }}>{value}</span>
  </div>
) : null;

// ── Rich findings — VicPlan Certificate ───────────────────────────────────────

const VicPlanFindings = ({ fields }) => {
  const zone          = fields.zoneCode;
  const overlayLabels = fields.overlayLabels?.length
    ? fields.overlayLabels
    : [
        fields.hasHO   && 'HO',  fields.hasVPO  && 'VPO', fields.hasSBO  && 'SBO',
        fields.hasBMO  && 'BMO', fields.hasESO  && 'ESO', fields.hasDDO  && 'DDO',
        fields.hasSLO  && 'SLO', fields.hasACHO && 'ACHO',fields.hasEMO  && 'EMO',
      ].filter(Boolean);
  const hasS173    = fields.hasS173Agreement;
  const hasCovenant= fields.hasSingleCovenant || fields.hasNoSubdivisionCovenant;
  const hasEase    = fields.hasEasement;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
        {zone && chip('Zone: ' + zone, 'rgba(0,122,255,0.2)', '#60aaff', 'rgba(0,122,255,0.4)')}
        {overlayLabels.map(ov => chip(ov, 'rgba(250,173,20,0.15)', '#faad14', 'rgba(250,173,20,0.35)'))}
        {overlayLabels.length === 0 && !zone &&
          chip('No overlays detected', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.1)')}
      </div>
      {(hasS173 || hasCovenant || hasEase) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {hasS173     && chip('⚠ S.173 Agreement', 'rgba(231,76,60,0.15)', '#ff6b6b', 'rgba(231,76,60,0.35)')}
          {hasCovenant && chip('🔒 ' + (fields.hasSingleCovenant ? 'Single Dwelling Covenant' : 'No-Subdivision Covenant'),
            'rgba(231,76,60,0.15)', '#ff6b6b', 'rgba(231,76,60,0.35)')}
          {hasEase && chip('Easement' + (fields.easementWidthM ? ' ' + fields.easementWidthM + 'm' : ''),
            'rgba(231,76,60,0.12)', '#ff9f7a', 'rgba(231,76,60,0.3)')}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label="Council / LGA"    value={fields.councilName} />
        <Row label="Property Ref"     value={fields.lotRef || fields.propNum} />
        <Row label="Site Area"        value={fields.siteArea ? fields.siteArea + ' m²' : null} />
        {hasS173 && <Row label="S.173 Detail"   value={fields.s173Details?.slice(0, 100)}   color="#ff9f7a" />}
        {hasCovenant && <Row label="Covenant Detail" value={fields.covenantDetails?.slice(0, 100)} color="#ff9f7a" />}
      </div>
      {!zone && overlayLabels.length === 0 && !hasS173 && !hasCovenant && !hasEase && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
          No planning data detected — check the file is a VicPlan Certificate with text content
        </div>
      )}
    </>
  );
};

// ── Rich findings — Section 32 ─────────────────────────────────────────────────

const Section32Findings = ({ fields }) => {
  const hasS173    = fields.hasS173Agreement;
  const hasCovenant= fields.hasSingleCovenant || fields.hasNoSubdivisionCovenant;
  const hasEase    = fields.hasEasement;
  return (
    <>
      {(hasS173 || hasCovenant || hasEase || fields.hasMortgage) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
          {hasS173     && chip('⚠ S.173 Agreement', 'rgba(231,76,60,0.15)', '#ff6b6b', 'rgba(231,76,60,0.35)')}
          {hasCovenant && chip('🔒 Covenant', 'rgba(231,76,60,0.15)', '#ff6b6b', 'rgba(231,76,60,0.35)')}
          {hasEase && chip('Easement' + (fields.easementWidthM ? ' ' + fields.easementWidthM + 'm' : ''),
            'rgba(231,76,60,0.12)', '#ff9f7a', 'rgba(231,76,60,0.3)')}
          {fields.hasMortgage && chip('Mortgage Registered', 'rgba(250,173,20,0.12)', '#faad14', 'rgba(250,173,20,0.3)')}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label="Lot / Plan Ref"  value={fields.lotRef} />
        {(fields.titleVolume && fields.titleFolio) &&
          <Row label="Title Reference" value={'Vol ' + fields.titleVolume + ' / Fol ' + fields.titleFolio} />}
        {fields._vendorName && <Row label="Vendor / Owner" value={fields._vendorName} />}
        <Row label="Site Area" value={fields.siteArea ? fields.siteArea + ' m²' : null} />
      </div>
      {(fields.councilRates || fields.waterRates) && (
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(160,100,255,0.07)', borderRadius: 6, padding: '6px 8px', border: '1px solid rgba(160,100,255,0.2)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#b388ff', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Outgoings</div>
          {fields.councilRates && <Row label="Council Rates" value={'$' + Number(fields.councilRates).toLocaleString() + ' / yr'} color="#b388ff" />}
          {fields.waterRates   && <Row label="Water Rates"   value={'$' + Number(fields.waterRates).toLocaleString()   + ' / yr'} color="#b388ff" />}
        </div>
      )}
      {(fields.servicesElec || fields.servicesGas || fields.servicesWater || fields.servicesSewer) && (
        <div style={{ display: 'flex', flexDirection: 'column', background: 'rgba(0,184,212,0.05)', borderRadius: 6, padding: '6px 8px', border: '1px solid rgba(0,184,212,0.2)' }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#00b8d9', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Connected Services</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {[['⚡ Electricity', fields.servicesElec], ['🔥 Gas', fields.servicesGas],
              ['💧 Water', fields.servicesWater],     ['🚿 Sewer', fields.servicesSewer]
            ].map(([lbl, val]) => val
              ? chip(lbl + ': ' + val,
                  val === 'Yes' ? 'rgba(46,204,113,0.1)' : 'rgba(255,77,79,0.1)',
                  val === 'Yes' ? '#2ecc71' : '#ff4d4f',
                  val === 'Yes' ? 'rgba(46,204,113,0.3)' : 'rgba(255,77,79,0.25)')
              : null
            )}
          </div>
        </div>
      )}
      {fields._permitNo && <Row label="Planning Permit" value={fields._permitNo} color="#60aaff" />}
      {hasS173 && fields.s173Details && <Row label="S.173 Detail"   value={fields.s173Details?.slice(0, 120)}   color="#ff9f7a" />}
      {hasEase && fields.easementDetails && <Row label="Easement Detail" value={fields.easementDetails?.slice(0, 100)} color="#ff9f7a" />}
      {!hasS173 && !hasCovenant && !hasEase && !fields.lotRef && !fields.councilRates && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
          No key data detected — check the file is a Section 32 Vendor Statement
        </div>
      )}
    </>
  );
};

// ── Rich findings — Feature & Level Survey Plan ────────────────────────────────

const SurveyPlanFindings = ({ fields }) => {
  const hasEase = fields.hasEasement;
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { lbl: 'Surveyed Area', val: fields.siteArea,     unit: 'm²' },
          { lbl: 'Frontage',      val: fields.siteFrontage, unit: 'm'  },
          { lbl: 'Depth',         val: fields.siteDepth,    unit: 'm'  },
        ].map(({ lbl, val, unit }) => (
          <div key={lbl} style={{
            background: val ? 'rgba(46,204,113,0.08)' : 'rgba(255,255,255,0.03)',
            border: '1px solid ' + (val ? 'rgba(46,204,113,0.25)' : 'rgba(255,255,255,0.08)'),
            borderRadius: 6, padding: '7px 8px', textAlign: 'center'
          }}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 3 }}>{lbl}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: val ? '#2ecc71' : 'rgba(255,255,255,0.2)' }}>{val ? val : '—'}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>{unit}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label="Lot / Plan Ref" value={fields.lotRef} color="#00b8d9" />
        {hasEase && <Row label="Easement" value={(fields.easementDetails || 'Present') + (fields.easementWidthM ? ' · ' + fields.easementWidthM + ' m wide' : '')} color="#ff9f7a" />}
      </div>
      {!fields.siteArea && !fields.siteFrontage && !fields.lotRef && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
          No dimension data detected — check the file is a Feature &amp; Level Survey Plan with text layer
        </div>
      )}
    </>
  );
};

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * @param {object}   props
 * @param {string}   props.docKey  - 'vp' | 's32' | 'fsp'
 * @param {string}   props.label   - Display label
 * @param {string}   props.hint    - Idle hint text
 * @param {object}   props.slot    - docFiles[docKey] state slice (null | { status, fileName, parsed })
 * @param {Function} props.onUpload - (e, docKey) => void
 * @param {Function} props.onClear  - (docKey) => void
 */
export const DocFileCard = ({ docKey, label, hint, slot, onUpload, onClear }) => {
  const status  = slot?.status || 'idle';
  const parsed  = slot?.parsed;
  const fields  = parsed?.fields || {};
  const facts   = parsed?.facts  || [];
  const conf    = parsed?.confidence || 0;

  const statusColor = status === 'ready' ? '#2ecc71' : status === 'error' ? '#ff4d4f' : status === 'parsing' ? '#faad14' : 'rgba(255,255,255,0.2)';
  const borderColor = status === 'ready' ? 'rgba(46,204,113,0.3)' : status === 'error' ? 'rgba(255,77,79,0.3)' : 'rgba(255,255,255,0.08)';

  return (
    <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid ' + borderColor, borderRadius: T.r.md, overflow: 'hidden' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: T.sp.sm, padding: '10px 12px' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: statusColor, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: T.fs.xs, fontWeight: 700, color: '#fff' }}>{label}</div>
          {status === 'idle'    && <div style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.35)' }}>{hint}</div>}
          {status === 'parsing' && <div style={{ fontSize: T.fs.xxs, color: '#faad14' }}>Parsing "{slot.fileName}"…</div>}
          {status === 'error'   && <div style={{ fontSize: T.fs.xxs, color: '#ff4d4f' }}>Failed to parse "{slot?.fileName}" — try another file</div>}
          {status === 'ready'   && <div style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.5)' }}>{slot.fileName} · {conf}% confidence</div>}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {status !== 'parsing' && (
            <label style={{
              cursor: 'pointer', fontSize: T.fs.xxs, fontWeight: 700, padding: '4px 10px',
              backgroundColor: status === 'ready' ? 'rgba(255,255,255,0.06)' : 'rgba(0,122,255,0.15)',
              color: status === 'ready' ? 'rgba(255,255,255,0.5)' : '#007AFF',
              border: '1px solid ' + (status === 'ready' ? 'rgba(255,255,255,0.1)' : 'rgba(0,122,255,0.3)'),
              borderRadius: T.r.sm,
            }}>
              {status === 'ready' ? 'Replace' : 'Choose file'}
              <input type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: 'none' }} onChange={(e) => onUpload(e, docKey)} />
            </label>
          )}
          {status === 'ready' && (
            <button onClick={() => onClear(docKey)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 16, lineHeight: 1, padding: '2px 4px' }}>×</button>
          )}
        </div>
      </div>

      {/* Rich findings panel */}
      {status === 'ready' && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px', backgroundColor: 'rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docKey === 'vp'  && <VicPlanFindings    fields={fields} />}
          {docKey === 's32' && <Section32Findings  fields={fields} />}
          {docKey === 'fsp' && <SurveyPlanFindings fields={fields} />}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 2 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
              {facts.length > 0 ? facts.length + ' constraint fact(s) detected' : 'Ready to apply'}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: conf >= 70 ? '#2ecc71' : conf >= 50 ? '#faad14' : '#ff4d4f' }}>
              {conf}% confidence
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
