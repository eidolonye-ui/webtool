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
        {hasCovenant && (() => {
          const raw = fields.covenantDetails || fields.restrictiveCovenantDesc || '';
          // Extract dealing number from raw text (e.g. D151733, AL######)
          const dealingMatch = raw.match(/([A-Z]{1,2}\d{5,8})/);
          const dealingNo    = dealingMatch ? dealingMatch[1] : null;
          // Classify scope
          const isWholeLot   = /whole\s+or\s+part|as\s+to\s+whole/i.test(raw);
          const isPartOnly   = /part\s+only|part\s+of\s+the\s+land/i.test(raw) && !isWholeLot;
          const isSingleDwg  = /single\s+dwelling|one\s+dwelling/i.test(raw);
          const isNoSubdiv   = /no\s+sub.?divis|shall\s+not\s+sub.?divis/i.test(raw);
          const scopeLabel   = isWholeLot ? 'Whole or part of lot'
                             : isPartOnly  ? 'Part of lot only'
                             : 'Scope unspecified';
          return (
            <div style={{
              marginTop: 4, borderRadius: 5, overflow: 'hidden',
              border: '1px solid rgba(231,76,60,0.3)'
            }}>
              {/* Header */}
              <div style={{
                padding: '5px 10px', fontSize: 9, fontWeight: 800,
                backgroundColor: 'rgba(231,76,60,0.1)',
                color: '#ff9f7a', letterSpacing: '0.05em', textTransform: 'uppercase',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span>Restrictive Covenant — Title Encumbrance</span>
                {dealingNo && (
                  <span style={{
                    fontFamily: 'monospace', fontSize: 10, fontWeight: 700,
                    color: '#94a3b8', backgroundColor: 'rgba(148,163,184,0.1)',
                    padding: '1px 6px', borderRadius: 4,
                    border: '1px solid rgba(148,163,184,0.2)'
                  }}>Dealing {dealingNo}</span>
                )}
              </div>
              {/* Parsed details */}
              <div style={{ padding: '7px 10px', display: 'flex', flexDirection: 'column', gap: 3, backgroundColor: 'rgba(231,76,60,0.04)' }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', display: 'flex', gap: 6 }}>
                  <span style={{ minWidth: 80, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>Scope</span>
                  <span style={{ color: '#ff9f7a', fontWeight: 700 }}>{scopeLabel}</span>
                </div>
                {isSingleDwg && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', display: 'flex', gap: 6 }}>
                    <span style={{ minWidth: 80, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>Restriction</span>
                    <span style={{ color: '#ff9f7a', fontWeight: 700 }}>Single dwelling only — no dual-occ or subdivision</span>
                  </div>
                )}
                {isNoSubdiv && !isSingleDwg && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', display: 'flex', gap: 6 }}>
                    <span style={{ minWidth: 80, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>Restriction</span>
                    <span style={{ color: '#ff9f7a', fontWeight: 700 }}>No subdivision permitted under this covenant</span>
                  </div>
                )}
                {/* Raw clause — full text, not truncated */}
                {raw && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', display: 'flex', gap: 6, marginTop: 2 }}>
                    <span style={{ minWidth: 80, fontWeight: 700, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>Instrument</span>
                    <span style={{ color: 'rgba(255,159,122,0.75)', fontStyle: 'italic', lineHeight: 1.5 }}>{raw}</span>
                  </div>
                )}
                <div style={{ marginTop: 4, padding: '5px 8px', borderRadius: 4, backgroundColor: 'rgba(231,76,60,0.08)', fontSize: 9, color: 'rgba(255,100,80,0.8)', lineHeight: 1.5 }}>
                  ⚠ Legal advice required — covenants bind future owners and may restrict development. Confirm whether removal or variation is possible via VCAT or Supreme Court application.
                </div>
              </div>
            </div>
          );
        })()}
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
      {/* Covenant / encumbrance chips */}
      {(hasS173 || hasCovenant || hasEase) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 2 }}>
          {hasS173     && chip('⚠ S.173 Agreement', 'rgba(231,76,60,0.15)', '#ff6b6b', 'rgba(231,76,60,0.35)')}
          {hasCovenant && chip('🔒 Covenant on Title', 'rgba(231,76,60,0.15)', '#ff6b6b', 'rgba(231,76,60,0.35)')}
          {hasEase && chip('Easement' + (fields.easementWidthM ? ' ' + fields.easementWidthM + 'm' : ''),
            'rgba(231,76,60,0.12)', '#ff9f7a', 'rgba(231,76,60,0.3)')}
        </div>
      )}

      {/* ✅ Explicit no-covenant confirmation — only shown when other S32 data was parsed */}
      {!hasS173 && !hasCovenant && !fields.hasRestrictiveCovenant && (fields.lotRef || fields.councilRates || fields.siteArea) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 10px',
          background: 'rgba(46,204,113,0.08)',
          border: '1px solid rgba(46,204,113,0.3)',
          borderLeft: '3px solid #2ecc71',
          borderRadius: 5,
          marginBottom: 4,
        }}>
          <span style={{ fontSize: 13 }}>✅</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#2ecc71' }}>No Restrictive Covenant Found</div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
              S32 scanned — no covenant, S.173 or single-dwelling restriction detected
            </div>
          </div>
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
  // Slope & elevation data
  const slopeVal = fields.siteSlope != null
    ? fields.siteSlope + '%' + (fields.slopeDeg != null ? ' (' + fields.slopeDeg + '°)' : '') : null;
  const elevVal  = fields.elevationDelta != null
    ? fields.elevationDelta + ' m' + (fields.ahdMin != null && fields.ahdMax != null ? ' (AHD ' + fields.ahdMin + '–' + fields.ahdMax + ')' : '')
    : null;
  const frontRear  = fields.frontToRearDelta != null ? fields.frontToRearDelta + ' m F→R' : null;
  const leftRight  = fields.leftToRightDelta != null ? fields.leftToRightDelta + ' m L→R' : null;
  const slopeColor = !slopeVal ? 'rgba(255,255,255,0.2)'
    : parseFloat(fields.siteSlope) > 10 ? '#ff9f7a'
    : parseFloat(fields.siteSlope) > 5  ? '#faad14' : '#2ecc71';

  // Easements — siteEasements is an array of {type, widthM, boundary, affectedAreaM2, desc}
  const easements = Array.isArray(fields.siteEasements) ? fields.siteEasements : [];

  return (
    <>
      {/* Dimensions grid */}
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

      {/* Slope & elevation mini-grid */}
      {(slopeVal || elevVal) && (
        <div style={{ display: 'grid', gridTemplateColumns: (frontRear || leftRight) ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)', gap: 6 }}>
          {slopeVal && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>Slope</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: slopeColor }}>{slopeVal}</div>
            </div>
          )}
          {elevVal && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>Elev. Change</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#60aaff' }}>{elevVal}</div>
            </div>
          )}
          {(frontRear || leftRight) && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 2 }}>Directional</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
                {[frontRear, leftRight].filter(Boolean).join(' / ')}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lot ref + single-easement fallback */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Row label="Lot / Plan Ref" value={fields.lotRef} color="#00b8d9" />
        {fields.hasEasement && easements.length === 0 && (
          <Row label="Easement"
            value={(fields.easementDetails || 'Present') + (fields.easementWidthM ? ' · ' + fields.easementWidthM + ' m wide' : '')}
            color="#ff9f7a" />
        )}
      </div>

      {/* Structured easement list from FSP parser */}
      {easements.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {easements.length} Easement{easements.length !== 1 ? 's' : ''} on Title
          </div>
          {easements.map((e, i) => {
            const typeLabel    = e.type     || 'Easement';
            const widthLabel   = e.widthM   ? e.widthM + ' m wide'     : '';
            const boundaryLabel= e.boundary ? 'along ' + e.boundary    : '';
            const areaLabel    = e.affectedAreaM2 ? e.affectedAreaM2 + ' m² affected' : '';
            const parts = [widthLabel, boundaryLabel, areaLabel].filter(Boolean);
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 8px', backgroundColor: 'rgba(255,159,122,0.07)', border: '1px solid rgba(255,159,122,0.2)', borderRadius: 5 }}>
                <span style={{ fontSize: 9, color: '#ff9f7a', marginTop: 1 }}>⊘</span>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#ff9f7a' }}>{typeLabel}</div>
                  {parts.length > 0 && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>{parts.join(' · ')}</div>}
                  {e.desc && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 1, fontStyle: 'italic' }}>{e.desc.slice(0, 80)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

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
