/**
 * @file ui/components/Common_V2.jsx
 * @description Sovereign High-Fidelity UI System.
 * @version 2.1.0 - UIInput debounceMs prop: buffers store dispatches for numeric inputs.
 */

import React, { useState, useEffect, useRef } from 'react';
import { C, SANS, MONO, T } from '../../core/config/theme_v3.js';

/**
 * UIInput — controlled text/number input with optional debounced dispatch.
 *
 * @prop {number} [debounceMs=0] - When > 0, delays calling `onChange` by this many ms
 *   after the last keystroke. The displayed value updates immediately (no lag for the user).
 *   Pass 0 (default) for text fields where instant dispatch is preferable.
 *   Recommended: 250 for numeric financial inputs in FinancePanel.
 */
export const UIInput = ({
  label, value, onChange, onClear, placeholder = '', type = 'text', style = {},
  verificationSource = null, isAutoFilled = false, clearable = false, debounceMs = 0
}) => {
  // Local display state — always tracks the visible input immediately.
  // Decoupled from store dispatch when debounceMs > 0.
  const [localValue, setLocalValue] = useState(value ?? '');
  const timerRef   = useRef(null);
  const isTypingRef = useRef(false); // suppress external-sync loop during active typing

  // Sync from external value when the parent updates it (scenario switch, clear, auto-fill).
  // Skip the sync if this component itself triggered the change (debounced path).
  useEffect(() => {
    if (!isTypingRef.current) {
      setLocalValue(value ?? '');
    }
  }, [value]);

  const handleChange = (raw) => {
    setLocalValue(raw);
    if (debounceMs > 0) {
      isTypingRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        onChange(raw);
      }, debounceMs);
    } else {
      onChange(raw);
    }
  };

  // Flush immediately on blur so leaving a field always commits the value.
  const handleBlur = () => {
    if (debounceMs > 0 && timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      isTypingRef.current = false;
      onChange(localValue);
    }
  };

  return (
    <div style={{ marginBottom: T.sp.sm, fontFamily: SANS }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        {label && (
          <label style={{ fontSize: T.fs.xs, fontWeight: 700, color: 'rgba(255,255,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.05em', textShadow: '0 0 4px rgba(0,0,0,0.5)' }}>
            {label}
          </label>
        )}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {isAutoFilled && (
            <span style={{ fontSize: 9, fontWeight: 800, color: C.brand.main, backgroundColor: 'rgba(0, 122, 255, 0.1)', padding: '1px 4px', borderRadius: 4, textTransform: 'uppercase', border: '1px solid rgba(0, 122, 255, 0.3)' }}>✓ Auto-synced</span>
          )}
          {verificationSource && (
            <span style={{ fontSize: 9, fontWeight: 800, color: C.semantic.success, backgroundColor: 'rgba(46, 204, 113, 0.1)', padding: '1px 4px', borderRadius: 4, textTransform: 'uppercase', border: '1px solid rgba(46, 204, 113, 0.3)' }}>✓ Verified by {verificationSource}</span>
          )}
        </div>
      </div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={type}
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={handleBlur}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: `8px ${clearable ? `${T.sp.sm + 24}px` : `${T.sp.sm}px`}`,
            border: `1px solid ${isAutoFilled ? 'rgba(0, 122, 255, 0.4)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: T.r.sm,
            fontFamily: type === 'number' ? MONO : SANS,
            fontSize: T.fs.sm,
            color: '#FFFFFF',
            backgroundColor: isAutoFilled ? 'rgba(0, 122, 255, 0.1)' : 'rgba(0,0,0,0.5)',
            boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.8)',
            transition: 'all 0.2s ease',
            ...style
          }}
        />
        {clearable && localValue && (
          <span
            onClick={() => { onClear ? onClear() : onChange(''); setLocalValue(''); }}
            style={{ position: 'absolute', right: 8, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', transition: 'all 0.2s' }}
          >✕</span>
        )}
      </div>
    </div>
  );
};

export const UIButton = ({ children, label, onClick, variant = 'primary', disabled = false, style = {} }) => {
  const variants = {
    primary: { bg: 'linear-gradient(180deg, #0084FF 0%, #0056B3 100%)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)', shadow: '0 4px 12px rgba(0, 122, 255, 0.4)', topHighlight: 'inset 0 1px 0 rgba(255,255,255,0.3)' },
    secondary: { bg: 'rgba(255,255,255,0.05)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', shadow: 'none', topHighlight: 'none' },
    ghost: { bg: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)', shadow: 'none', topHighlight: 'none' },
    danger: { bg: 'linear-gradient(180deg, #E74C3C 0%, #C0392B 100%)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)', shadow: '0 4px 12px rgba(231, 76, 60, 0.4)', topHighlight: 'inset 0 1px 0 rgba(255,255,255,0.3)' },
  };
  const v = variants[variant] || variants.primary;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: v.bg, color: v.color, border: v.border, boxShadow: `${v.shadow}, ${v.topHighlight}`,
        fontFamily: SANS, fontSize: T.fs.sm, fontWeight: 700, padding: `0 ${T.sp.lg}px`, borderRadius: T.r.sm,
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.filter = 'brightness(1.1)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={(e) => { if (!disabled) { e.currentTarget.style.filter = 'brightness(1)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
    >
      {children || label}
    </button>
  );
};

export const UIFileInput = ({ label, icon, onChange, value = '', style = {} }) => {
  const inputRef = React.useRef(null);
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 6, 
      padding: '10px', 
      backgroundColor: 'rgba(255,255,255,0.03)', 
      border: '1px solid rgba(255,255,255,0.1)', 
      borderRadius: T.r.sm, 
      backdropFilter: 'blur(4px)',
      ...style 
    }}>
      {label && <label style={{ fontSize: T.fs.xs, fontWeight: 700, color: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', gap: 6 }}>{icon} {label}</label>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <UIButton 
          label="Choose File" 
          onClick={() => inputRef.current.click()} 
          variant="secondary" 
          style={{ fontSize: T.fs.xxs, padding: '4px 8px', height: 'auto', minWidth: 'auto', backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }} 
        />
        <span style={{ fontSize: T.fs.xxs, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px', fontFamily: MONO }}>{value || 'No file chosen'}</span>
        <input type="file" ref={inputRef} onChange={onChange} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export const UIPanel = ({ children, title, subtitle, style = {} }) => {
  return (
    <div style={{ backgroundColor: 'rgba(26, 26, 26, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: T.r.lg, padding: T.sp.lg, boxShadow: '0 10px 30px rgba(0,0,0,0.5)', fontFamily: SANS, backdropFilter: 'blur(10px)', ...style }}>
      {title && (
        <div style={{ marginBottom: T.sp.md }}>
          <h3 style={{ fontSize: T.fs.lg, fontWeight: 800, color: '#FFFFFF', margin: 0, display: 'flex', alignItems: 'center', gap: T.sp.sm, letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>{title}</h3>
          {subtitle && <p style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.7)', margin: `4px 0 0 0` }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
};

export const UITooltip = ({ text, children, type = 'info' }) => {
  const colors = { info: { bg: '#252525', color: 'white' }, warn: { bg: '#f59e0b', color: 'white' }, danger: { bg: '#ef4444', color: 'white' } };
  const c = colors[type] || colors.info;
  return <span title={text} style={{ cursor: 'help', marginLeft: 4, display: 'inline-flex', alignItems: 'center' }}><span style={{ fontSize: 10, width: 14, height: 14, borderRadius: '50%', backgroundColor: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>i</span></span>;
};

export const UIToast = ({ message, type = 'info', onClose }) => {
  const typeColors = { info: { bg: '#007AFF', text: '#fff', border: '#0056B3' }, warn: { bg: '#f59e0b', text: '#fff', border: '#d97706' }, success: { bg: '#2ECC71', text: '#fff', border: '#27ae60' }, error: { bg: '#E74C3C', text: '#fff', border: '#c0392b' } };
  const c = typeColors[type] || typeColors.info;
  return (
    <div style={{ position: 'fixed', bottom: T.sp.xl, right: T.sp.xl, backgroundColor: c.bg, color: c.text, borderLeft: `4px solid ${c.border}`, padding: `${T.sp.sm} ${T.sp.md}px`, borderRadius: T.r.sm, boxShadow: T.sh.md, fontSize: T.fs.sm, fontFamily: SANS, zIndex: 1000, display: 'flex', alignItems: 'center', gap: T.sp.sm }}>
      {message} <span onClick={onClose} style={{ cursor: 'pointer', opacity: 0.6, fontSize: T.fs.xs }}>✕</span>
    </div>
  );
};

export const YieldWaterfall = ({ total, deductions, final, label = "Yield Breakdown" }) => {
  return (
    <div style={{ padding: T.sp.md, backgroundColor: 'rgba(26, 26, 26, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: T.r.md, fontFamily: SANS, maxWidth: '300px', backdropFilter: 'blur(10px)' }}>
      <div style={{ fontWeight: 800, fontSize: T.fs.xs, color: 'rgba(255,255,255,0.4)', marginBottom: T.sp.sm, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: T.fs.xs, color: 'rgba(255,255,255,0.7)' }}>Total Site Area</span>
          <span style={{ fontWeight: 700, fontSize: T.fs.sm, color: C.text.primary }}>{total} m²</span>
        </div>
        {deductions.map((d, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', color: C.semantic.danger, fontSize: T.fs.xs }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ color: C.semantic.danger, fontSize: 12 }}>⊖</span> {d.label}</span>
            <span style={{ fontWeight: 600 }}>- {d.value} m²</span>
          </div>
        ))}
        <div style={{ marginTop: 8, padding: '12px', backgroundColor: 'rgba(46, 204, 113, 0.1)', border: `1px solid ${C.semantic.success}`, borderRadius: T.r.sm, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 800, fontSize: T.fs.xs, color: C.semantic.success }}>EST. FOOTPRINT</span>
          <span style={{ fontWeight: 800, fontSize: T.fs.sm, color: C.semantic.success }}>{final} m²</span>
        </div>
      </div>
    </div>
  );
};
