/**
 * @file tests/domain_tests.js
 * @description L1 Atomic Domain Tests for Financial Accuracy.
 * Ensures 1:1 parity with the monolithic source.
 */

import { calcVicStampDuty, calcGST } from '../domain/finance/tax_engine.js';

const tests = [
  {
    name: "Stamp Duty: Low Value (SRO 2024 Bracket)",
    fn: () => calcVicStampDuty(100000),
    expected: 350 + (100000 - 25000) * 0.024, // Exact from monolith line 1279
    check: (act, exp) => Math.abs(act - exp) < 1
  },
  {
    name: "Stamp Duty: High Value (>2M)",
    fn: () => calcVicStampDuty(2500000),
    expected: 2500000 * 0.065, // Exact from monolith line 1288
    check: (act, exp) => Math.abs(act - exp) < 1
  },
  {
    name: "GST: Standard",
    fn: () => calcGST(1000000, 400000).standard,
    expected: Math.round(1000000 / 11),
    check: (act, exp) => Math.abs(act - exp) < 1
  }
];

let passed = 0;
console.log("=== 🧪 Starting L1 Domain Accuracy Tests ===\n");

tests.forEach((t, i) => {
  try {
    const actual = t.fn();
    const expected = t.expected;
    if (t.check(actual, expected)) {
      console.log(`✅ Test ${i+1}: ${t.name} [PASSED]`);
      passed++;
    } else {
      console.log(`❌ Test ${i+1}: ${t.name} [FAILED] - Expected: ${expected}, Actual: ${actual}`);
    }
  } catch (e) {
    console.log(`💥 Test ${i+1}: ${t.name} [CRASHED] - ${e.message}`);
  }
});

console.log(`\n📊 L1 Result: ${passed}/${tests.length} passed (${(passed/tests.length*100).toFixed(2)}%)`);
if (passed < tests.length) process.exit(1);
else process.exit(0);
