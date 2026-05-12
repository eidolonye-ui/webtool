/**
 * @file ui/components/PersonaPill.jsx
 * @description Segmented persona switcher with animated sliding pill indicator.
 * Extracted from SovereignHeader.jsx to enforce the 300-line module limit.
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { T } from '../../core/config/theme_v3.js';
import { PERSONA_CONFIG } from '../../domain/spatial/siteInsightMapper.js';

const PERSONAS = Object.entries(PERSONA_CONFIG).map(([id, config]) => ({
  id,
  ...config,
  focus: config.focus
}));

/**
 * @param {string}   activePersona      - Current persona ID
 * @param {Function} onPersonaChange    - Callback (personaId) => void
 * @param {Function} onCommandTriggered - Fired after any persona change (for pulse effect)
 * @param {string}   accentColor        - Hex accent matching current persona
 */
export const PersonaPill = ({ activePersona, onPersonaChange, onCommandTriggered, accentColor }) => {
  const containerRef = useRef(null);
  const pillRef      = useRef(null);
  const [pillStyle, setPillStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current) {
        const activeBtn = containerRef.current.querySelector(`[data-persona="${activePersona}"]`);
        if (activeBtn) {
          setPillStyle({ left: activeBtn.offsetLeft, width: activeBtn.offsetWidth });
        }
      }
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [activePersona]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: 'rgba(255,255,255,0.03)',
        padding: '3px',
        borderRadius: '100px',
        border: '1px solid rgba(255,255,255,0.05)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
      }}
    >
      {/* Sliding active indicator */}
      <div
        ref={pillRef}
        style={{
          position: 'absolute',
          height: 'calc(100% - 6px)',
          top: '3px',
          left: pillStyle.left,
          width: pillStyle.width,
          backgroundColor: 'rgba(255,255,255,0.9)',
          borderRadius: '100px',
          transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
          boxShadow: `0 0 12px ${accentColor}44`,
          zIndex: 0,
        }}
      />

      {PERSONAS.map((p) => {
        const isActive = activePersona === p.id;
        return (
          <button
            key={p.id}
            data-persona={p.id}
            onClick={() => {
              onPersonaChange(p.id);
              onCommandTriggered();
            }}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '6px 18px',
              borderRadius: '100px',
              border: 'none',
              cursor: 'pointer',
              fontSize: T.fs.xs,
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: isActive ? p.color : 'rgba(255,255,255,0.6)',
              transition: 'color 0.3s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {p.icon} {p.label}
          </button>
        );
      })}
    </div>
  );
};

export { PERSONAS };
