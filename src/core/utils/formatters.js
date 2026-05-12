/**
 * @file core/utils/formatters.js
 * @description Global formatting utilities for currency, percentages, and numbers.
 */

export const fmt = (val) => {
  if (val === null || val === undefined) return "—";
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(val);
};

export const fmtM = (val) => {
  if (val === null || val === undefined) return "—";
  return fmt(val / 1000000) + "M";
};

export const pct = (val) => {
  if (val === null || val === undefined) return "—";
  return val.toFixed(2) + "%";
};

export const parseNum = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const n = parseFloat(String(val).replace(/[^0-9.-]+/g, ""));
  return isNaN(n) ? 0 : n;
};

export const scoreToBand = (score) => {
  if (score >= 75) return { label: "Excellent", color: "#27ae60", band: "green" };
  if (score >= 55) return { label: "Strong", color: "#f1c40f", band: "amber" };
  if (score >= 35) return { label: "Marginal", color: "#e67e22", band: "orange" };
  return { label: "Avoid", color: "#e74c3c", band: "red" };
};
