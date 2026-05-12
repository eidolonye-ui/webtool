/**
 * @file audit_finance.js
 * @description Lightweight verification script for ProjectCalculator without heavy test frameworks.
 */

import { ProjectCalculator } from './src/domain/finance/calculator.js';
import { parseNum } from './src/core/utils/formatters.js';

// Mock state for testing
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

async function runAudit() {
  console.log('--- ⚕️ WebTool Finance Kernel Audit ---');
  
  try {
    const calc = new ProjectCalculator(mockState);
    const result = calc.calculateAll();
    
    console.log('\n[Test 1: Basic Totals]');
    const isHardCostCorrect = result.hard === (200 * 2500);
    console.log(`Hard Costs (Expected 500k): ${result.hard} -> ${isHardCostCorrect ? '✅ PASS' : '❌ FAIL'}`);
    
    const isLandCorrect = result.land > 1000000;
    console.log(`Land Acquisition (Expected > 1M): ${result.land} -> ${isLandCorrect ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n[Test 2: RLV Iteration]');
    const rlv = calc.calculateRLV(2500000, 20, 600000);
    const isRLVValid = typeof rlv === 'number' && rlv > 0;
    console.log(`RLV Calculation: ${rlv} -> ${isRLVValid ? '✅ PASS' : '❌ FAIL'}`);
    
    console.log('\n[Test 3: Boundary Conditions]');
    const rlvZero = calc.calculateRLV(0, 20, 600000);
    const isZeroCorrect = rlvZero === 0;
    console.log(`RLV with 0 GRV (Expected 0): ${rlvZero} -> ${isZeroCorrect ? '✅ PASS' : '❌ FAIL'}`);
    
    const allPassed = isHardCostCorrect && isLandCorrect && isRLVValid && isZeroCorrect;
    console.log('\n-------------------------------------');
    console.log(`FINAL STATUS: ${allPassed ? '🌟 ALL SYSTEMS NOMINAL' : '⚠️ KERNEL OFFSET DETECTED'}`);
    process.exit(allPassed ? 0 : 1);
    
  } catch (e) {
    console.error('\n❌ AUDIT CRASHED:');
    console.error(e);
    process.exit(1);
  }
}

runAudit();
