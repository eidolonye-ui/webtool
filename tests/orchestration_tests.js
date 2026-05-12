/**
 * @file tests/orchestration_tests.js
 * @description L2 Orchestration Tests for ProjectCalculator.
 * Ensures the flow from input -> engines -> final metrics is 1:1 with monolith.
 */

import { ProjectCalculator } from '../domain/finance/calculator.js';

const mockState = {
  fin: {
    landPrice: "1000000",
    buildArea: "300",
    buildCostPSM: "2500",
    softCosts: "50000",
    holdingCosts: "20000",
  },
  plan: {
    zone: "GRZ",
  },
  site: {
    area: "600",
  },
  str: {
    projectMonths: "24",
    interestRate: "8.5",
    lvrPct: "65",
  },
  params: {
    grv: "2500000",
    isForeign: false,
  }
};

const testCase = {
  name: "Standard Residential Project",
  inputs: mockState,
  expected: {
    // Manual calculation based on monolith logic:
    // Land: 1M + StampDuty(1M) + Legal(1M*0.003 + 1500)
    // StampDuty(1M) = 1M * 0.055 = 55,000
    // Legal = 3000 + 1500 = 4500
    // Total Land = 1,059,500
    // Hard = 300 * 2500 = 750,000
    // Soft = 50,000
    // Hold = 20,000
    // Sale = 2.5M * 0.02 = 50,000
    // TDC = 1,059,500 + 750,000 + 50,000 + 20,000 + 50,000 = 1,929,500
    // Profit = 2.5M - 1,929,500 = 570,500
    // Margin = (570,500 / 1,929,500) * 100 = 29.57%
    total: 1929500,
    profit: 570500,
    margin: 29.57,
  }
};

async function runL2() {
  console.log("=== 🧪 Starting L2 Orchestration Tests ===\n");
  const calc = new ProjectCalculator(mockState);
  const result = calc.calculateAll();

  let passed = 0;
  const metrics = ['total', 'profit', 'margin'];

  metrics.forEach(m => {
    const act = result[m];
    const exp = testCase.expected[m];
    const diff = Math.abs(act - exp);
    
    if (m === 'margin' ? diff < 0.1 : diff < 100) {
      console.log(`✅ Metric ${m}: [PASSED] Act: ${act}, Exp: ${exp}`);
      passed++;
    } else {
      console.log(`❌ Metric ${m}: [FAILED] Act: ${act}, Exp: ${exp}, Diff: ${diff}`);
    }
  });

  console.log(`\n📊 L2 Result: ${passed}/${metrics.length} passed (${(passed/metrics.length*100).toFixed(2)}%)`);
  if (passed < metrics.length) process.exit(1);
  else process.exit(0);
}

runL2();
