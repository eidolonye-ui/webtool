/**
 * @file tests/store_tests.js
 * @description L3 Store Integration Tests.
 * Ensures state dispatch and merge logic correctly updates the project tree.
 */

import { store } from '../core/store/store.js';

async function runL3() {
  console.log("=== 🧪 Starting L3 Store Integration Tests ===\n");
  
  // Test 1: Basic Dispatch
  store.dispatch('fin.landPrice', '1200000');
  if (store.getState().fin.landPrice === '1200000') {
    console.log("✅ Test 1: Basic Dispatch [PASSED]");
  } else {
    console.log(`❌ Test 1: Basic Dispatch [FAILED] - Expected 1200000, Actual ${store.getState().fin.landPrice}`);
  }

  // Test 2: Deep Merge
  const update = {
    site: { 
      data: { area: '700', frontage: '15' } 
    },
    plan: { 
      data: { zone: 'RGZ' } 
    }
  };
  store.merge(update);
  const state = store.getState();
  if (state.site.data.area === '700' && state.plan.data.zone === 'RGZ') {
    console.log("✅ Test 2: Deep Merge [PASSED]");
  } else {
    console.log(`❌ Test 2: Deep Merge [FAILED] - State: ${JSON.stringify(state)}`);
  }

  // Test 3: State Persistence (Simulation)
  const snapshot = JSON.stringify(store.getState());
  store.dispatch('fin.landPrice', '1500000');
  store.merge(JSON.parse(snapshot));
  if (store.getState().fin.landPrice === '1200000') {
    console.log("✅ Test 3: State Restore [PASSED]");
  } else {
    console.log(`❌ Test 3: State Restore [FAILED]`);
  }

  console.log(`\n📊 L3 Result: All tests completed.`);
}

runL3();
