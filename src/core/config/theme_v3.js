/**
 * @file core/config/theme_v3.js
 * @description AI-Native Design System for WebTool (Sovereign Edition).
 * Inspired by Cursor's high-precision, deep-dark aesthetic.
 * @version 4.2.0 - Fix: removed duplicate 'brand'/'text' keys that silently
 *                  overwrote nested objects (C.brand.main / C.text.secondary
 *                  were resolving to undefined across the entire UI).
 */

export const C = {
  // Brand Palette - Deep & Precise
  brand: {
    main: '#007AFF', // Modern AI Blue
    light: '#3A86FF',
    dark: '#0056B3',
    accent: '#00B894',
    accentDark: '#008A6B',
  },

  // Semantic Colors - High Contrast for Dark Mode
  semantic: {
    success: '#2ECC71',
    warning: '#F1C40F',
    danger: '#E74C3C',
    info: '#3498DB',
    neutral: '#94A3B8',
  },

  // Surface & Border - The "Deep Layer" Philosophy
  // Backgrounds move from deep black to subtle greys
  surface: {
    bg: '#0B0B0B',           // Base Layer (Deepest)
    panel: '#121212',        // Panel Layer
    card: '#1A1A1A',         // Component Layer
    elevated: '#252525',     // Hover/Active Layer
    border: 'rgba(255,255,255,0.08)', // Hairline Border
    borderBright: 'rgba(255,255,255,0.15)',
  },

  // Typography - High Precision Contrast
  text: {
    primary: '#FFFFFF',       // Pure white for headlines
    secondary: 'rgba(255,255,255,0.7)', // Muted white for body
    muted: 'rgba(255,255,255,0.4)',    // Dimmed for meta info
    inverse: '#0B0B0B',       // For light-on-dark components
  },

  // ── Flat aliases (non-conflicting legacy keys) ──────────────────────
  // NOTE: 'brand' and 'text' are intentionally NOT repeated here because
  // duplicate keys in an object literal silently overwrite the earlier value
  // in JavaScript — the nested objects above would be lost.
  // Use C.brand.main or C.brand.light, and C.text.primary / C.text.secondary.
  brandLight:    '#3A86FF',
  border:        'rgba(255,255,255,0.08)',
  textSecondary: 'rgba(255,255,255,0.7)',

  // Dark-on-light ink alias (used by ComparisonPanel light-table headers)
  ink: '#1e293b',
};

// Typography - Inter is the gold standard for AI-Native UI
export const SANS = `'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif`;
export const SERIF = `'Georgia', 'Times New Roman', serif`;
export const MONO = `'JetBrains Mono', 'Fira Code', 'SF Mono', monospace`;

export const T = {
  // 8-pt spacing grid - Increased for "breathability"
  sp: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },

  // Precise Font-size hierarchy — bumped +1-2px for readability
  fs: {
    xxs: 11,
    xs: 12,
    sm: 13,
    md: 14,
    base: 15,
    lg: 17,
    xl: 22,
    xxl: 30,
  },

  // Border radius - From "Rounded" to "Precision Sharp"
  r: { sm: 4, md: 6, lg: 8, xl: 12 },

  // Shadows - Subtle, depth-based rather than glow-based
  sh: {
    xs: '0 1px 2px rgba(0,0,0,.3)',
    sm: '0 2px 4px rgba(0,0,0,.4)',
    md: '0 4px 12px rgba(0,0,0,.5)',
    lg: '0 8px 24px rgba(0,0,0,.6)',
  },

  ctrlH: 36,

  ok: '#2ECC71',
  warn: '#E74C3C',
  caution: '#F1C40F',
  info: '#3498DB',
};
