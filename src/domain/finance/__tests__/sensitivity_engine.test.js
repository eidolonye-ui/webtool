/**
 * @file domain/finance/__tests__/sensitivity_engine.test.js
 * @description Vitest regression suite for sensitivity_engine.
 * Tests: matrix shape, centre-cell accuracy, sign correctness, guard cases.
 */

import { describe, it, expect } from 'vitest';
import { calculateSensitivity } from '../sensitivity_engine.js';

const BASE_PROFIT = 400_000;
const BASE_GRV    = 2_400_000;
const BASE_COST   = 2_000_000;

describe('calculateSensitivity', () => {
  it('returns empty array for zero GRV', () => {
    expect(calculateSensitivity(0, 0, BASE_COST)).toHaveLength(0);
  });

  it('returns empty array for zero cost', () => {
    expect(calculateSensitivity(BASE_PROFIT, BASE_GRV, 0)).toHaveLength(0);
  });

  it('returns empty array for non-finite inputs', () => {
    expect(calculateSensitivity(NaN, BASE_GRV, BASE_COST)).toHaveLength(0);
    expect(calculateSensitivity(BASE_PROFIT, Infinity, BASE_COST)).toHaveLength(0);
  });

  it('returns a 5×5 matrix for valid inputs', () => {
    const matrix = calculateSensitivity(BASE_PROFIT, BASE_GRV, BASE_COST);
    expect(matrix).toHaveLength(5);
    matrix.forEach(row => expect(row).toHaveLength(5));
  });

  it('centre cell [2][2] has zero variation → profit equals base profit', () => {
    const matrix = calculateSensitivity(BASE_PROFIT, BASE_GRV, BASE_COST);
    const centre = matrix[2][2];
    expect(centre.profit).toBeCloseTo(BASE_PROFIT, 0);
  });

  it('centre cell [2][2] margin is correct (profit/GRV * 100)', () => {
    const matrix = calculateSensitivity(BASE_PROFIT, BASE_GRV, BASE_COST);
    const expected = (BASE_PROFIT / BASE_GRV) * 100;
    expect(matrix[2][2].margin).toBeCloseTo(expected, 2);
  });

  it('best cell [0][4] (+10%GRV / -10%cost) has highest profit', () => {
    const matrix = calculateSensitivity(BASE_PROFIT, BASE_GRV, BASE_COST);
    const best  = matrix[0][4].profit;
    const worst = matrix[4][0].profit;
    expect(best).toBeGreaterThan(BASE_PROFIT);
    expect(worst).toBeLessThan(BASE_PROFIT);
  });

  it('worst cell [4][0] (-10%GRV / +10%cost) can be negative', () => {
    // With tight margin deal the worst cell should be a loss
    const matrix = calculateSensitivity(80_000, 2_000_000, 1_920_000);
    const worst = matrix[4][0].profit;
    expect(worst).toBeLessThan(0);
  });

  it('all cells contain finite profit and margin values', () => {
    const matrix = calculateSensitivity(BASE_PROFIT, BASE_GRV, BASE_COST);
    matrix.forEach(row =>
      row.forEach(cell => {
        expect(Number.isFinite(cell.profit)).toBe(true);
        expect(Number.isFinite(cell.margin)).toBe(true);
      })
    );
  });

  it('matrix is symmetric in variation: [0][2] profit increase === -[4][2] profit decrease', () => {
    const matrix = calculateSensitivity(BASE_PROFIT, BASE_GRV, BASE_COST);
    // [0][2] = cost -10%, GRV 0% → profit increase by 10% of cost
    // [4][2] = cost +10%, GRV 0% → profit decrease by same amount
    const increase = matrix[0][2].profit - BASE_PROFIT;
    const decrease = BASE_PROFIT - matrix[4][2].profit;
    expect(Math.abs(increase - decrease)).toBeLessThan(1); // within $1 rounding
  });
});
