/**
 * @file ui/components/KineticMetric.jsx
 * @description High-fidelity, animated numerical display component.
 * Implements Number Interpolation (Rolling) and Update Pulses.
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { C, T, MONO } from '../../core/config/theme_v3.js';

/**
 * KineticMetric Component
 * 
 * @param {number} value - The target value to display.
 * @param {string} prefix - Optional prefix (e.g., '$', 'm²').
 * @param {string} suffix - Optional suffix (e.g., 'm', 'units').
 * @param {number} decimals - Number of decimal places to show.
 * @param {boolean} isCritical - If true, triggers a red-tinted pulse when the value changes.
 * @param {string} className - Optional CSS class.
 */
export const KineticMetric = ({
  value = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  isCritical = false,
  className = ''
}) => {
  const [displayValue, setDisplayValue] = useState(value);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevValueRef = useRef(value);

  // Animation Logic: Number Interpolation
  useEffect(() => {
    const startValue = displayValue;
    const endValue = value;
    const duration = 600; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic function
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      
      const currentValue = startValue + (endValue - startValue) * easeOutCubic;
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Ensure we land exactly on the target value
        setDisplayValue(endValue);
        
        // Trigger Pulse if the value actually changed
        if (Math.abs(startValue - endValue) > 0.0001) {
          setIsPulsing(true);
          setTimeout(() => setIsPulsing(false), 500);
        }
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  // Handle rounding and formatting
  const formattedValue = (displayValue ?? 0).toFixed(decimals);

  const pulseColor = isCritical ? 'rgba(225, 112, 85, 0.4)' : 'rgba(0, 184, 148, 0.2)';

  return (
    <span 
      className={`${className} ${isPulsing ? 'kinetic-pulse' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '2px',
        transition: 'color 0.3s ease',
        position: 'relative',
        fontFamily: MONO || 'monospace',
        fontWeight: 600,
        color: 'rgba(255,255,255,0.9)', // Default high-precision color
      }}
    >
      <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9em' }}>{prefix}</span>
      <span>{formattedValue}</span>
      <span style={{ opacity: 0.5, fontWeight: 400, fontSize: '0.9em' }}>{suffix}</span>

      <style>{`
        @keyframes kinetic-pulse-anim {
          0% { transform: scale(1); text-shadow: 0 0 0px transparent; }
          50% { transform: scale(1.05); text-shadow: 0 0 8px ${pulseColor}; }
          100% { transform: scale(1); text-shadow: 0 0 0px transparent; }
        }
        .kinetic-pulse {
          animation: kinetic-pulse-anim 0.5s ease-out;
          color: ${isCritical ? C.semantic.danger : C.semantic.success};
        }
      `}</style>
    </span>
  );
};

// Named export only — no default export (coding standard: No Default Exports)
