/**
 * @file domain/finance/__tests__/irr_engine.test.js
 * @description Vitest regression suite for IRR engine.
 * Tests: calcTrueIRR convergence, annualisation, degenerate inputs.
 *        buildIRRCashFlows: structure, sign convention, S-Curve integration.
 */

import { describe, it, expect } from 'vitest';
import { calcTrueIRR, buildIRRCashFlows } from '../irr_engine.js';

// ── calcTrueIRR ───────────────────────────────────────────────────────────────

describe('calcTrueIRR', () => {
  it('returns null for null input', () => {
    expect(calcTrueIRR(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(calcTrueIRR([])).toBeNull();
  });

  it('returns null for single-element array', () => {
    expect(calcTrueIRR([-1000])).toBeNull();
  });

  it('calculates IRR for a simple bond-like cash flow', () => {
    // invest $1000 now, receive $1100 in 12 months → ~10% annual
    const flows = [-1000, ...Array(11).fill(0), 1100];
    const irr = calcTrueIRR(flows);
    expect(irr).not.toBeNull();
    expect(irr).toBeGreaterThan(8);
    expect(irr).toBeLessThan(12);
  });

  it('returns a finite number, not Infinity or NaN', () => {
    // Typical dual-occ cash flows
    const flows = buildIRRCashFlows(1_280_000, 95_000, 600_000, 2_400_000, 65, 24, 0, 6.5);
    const irr = calcTrueIRR(flows);
    expect(irr).not.toBeNull();
    expect(Number.isFinite(irr)).toBe(true);
  });

  it('produces a positive IRR for a profitable deal', () => {
    const flows = buildIRRCashFlows(1_000_000, 80_000, 500_000, 2_200_000, 65, 24, 0, 6.5);
    const irr = calcTrueIRR(flows);
    expect(irr).toBeGreaterThan(0);
  });

  it('townhouse deal IRR is in realistic range (5%–40%)', () => {
    // 4x townhouse: land $1.5M, soft $150k, hard $1.4M, GRV $4.8M, LVR 65%, 30mo
    const flows = buildIRRCashFlows(1_600_000, 150_000, 1_400_000, 4_800_000, 65, 30, 0, 6.5);
    const irr = calcTrueIRR(flows);
    expect(irr).toBeGreaterThan(5);
    expect(irr).toBeLessThan(40);
  });
});

// ── buildIRRCashFlows ─────────────────────────────────────────────────────────

describe('buildIRRCashFlows', () => {
  const LAND  = 1_000_000;
  const SOFT  = 80_000;
  const HARD  = 600_000;
  const GRV   = 2_200_000;
  const LVR   = 65;
  const MONTHS = 24;

  it('returns an array of numbers', () => {
    const flows = buildIRRCashFlows(LAND, SOFT, HARD, GRV, LVR, MONTHS);
    expect(Array.isArray(flows)).toBe(true);
    expect(flows.length).toBeGreaterThan(0);
    flows.forEach(f => expect(typeof f).toBe('number'));
  });

  it('first cash flow is negative (equity outflow at t=0)', () => {
    const flows = buildIRRCashFlows(LAND, SOFT, HARD, GRV, LVR, MONTHS);
    expect(flows[0]).toBeLessThan(0);
  });

  it('last cash flow is positive (sale proceeds)', () => {
    const flows = buildIRRCashFlows(LAND, SOFT, HARD, GRV, LVR, MONTHS);
    expect(flows[flows.length - 1]).toBeGreaterThan(0);
  });

  it('contains no NaN or Infinity values', () => {
    const flows = buildIRRCashFlows(LAND, SOFT, HARD, GRV, LVR, MONTHS);
    flows.forEach(f => {
      expect(Number.isFinite(f)).toBe(true);
    });
  });

  it('respects minimum project length (< 6 months clamped to 6)', () => {
    const shortFlows = buildIRRCashFlows(500_000, 20_000, 200_000, 800_000, 65, 2);
    const normalFlows = buildIRRCashFlows(500_000, 20_000, 200_000, 800_000, 65, 6);
    expect(shortFlows.length).toBe(normalFlows.length);
  });

  it('higher LVR produces larger total cash outflow at t=0 (more debt interest)', () => {
    const low  = buildIRRCashFlows(LAND, SOFT, HARD, GRV, 50, MONTHS);
    const high = buildIRRCashFlows(LAND, SOFT, HARD, GRV, 80, MONTHS);
    // Higher LVR draws more debt at t=0 → more capitalised interest → flows[0] more negative
    expect(high[0]).toBeLessThan(low[0]);
  });
});
