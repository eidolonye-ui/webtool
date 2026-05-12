import { describe, it, expect } from 'vitest';
import { ProjectCalculator } from '../calculator.js';

describe('ProjectCalculator Finance Logic', () => {
  const mockState = {
    fin: {
      landPrice: 1000000,
      buildArea: 200,
      buildCostPSM: 2500,
      softCosts: 50000,
      holdingCosts: 30000,
    },
    params: {
      grv: 2500000,
      isForeign: false,
    },
    plan: {},
    site: {},
    str: {}
  };

  it('should calculate basic project totals correctly', () => {
    const calc = new ProjectCalculator(mockState);
    const result = calc.calculateAll();
    
    // Land Acquisition = 1M + Stamp Duty (~5.5%) + Legal
    // 1,000,000 + 55,000 + (3000 + 1500) = 1,059,500
    expect(result.land).toBeGreaterThan(1000000);
    expect(result.hard).toBe(200 * 2500); // 500,000
    expect(result.profit).toBeGreaterThan(0);
  });

  it('should handle RLV (Residual Land Value) iteratively', () => {
    const calc = new ProjectCalculator(mockState);
    const rlv = calc.calculateRLV(2500000, 20, 600000);
    
    expect(rlv).toBeDefined();
    expect(typeof rlv).toBe('number');
    expect(rlv).toBeGreaterThan(0);
  });

  it('should return 0 for RLV when GRV is missing', () => {
    const calc = new ProjectCalculator(mockState);
    const rlv = calc.calculateRLV(0, 20, 600000);
    expect(rlv).toBe(0);
  });
});
