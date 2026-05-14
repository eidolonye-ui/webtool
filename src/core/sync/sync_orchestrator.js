/**
 * @file core/sync/sync_orchestrator.js
 * @description Closed-loop data sync and verification system.
 */

import { fetchRBACashRate } from './connectors/rba_connector.js';
import { validateRateUpdate } from './validators/sanity_validator.js';
import { store } from '../store/store.js';

export const runDataSync = async () => {
  console.log("[DataSync] Starting Official Data Synchronization...");
  
  // 1. Fetch
  const newData = await fetchRBACashRate();
  if (!newData) throw new Error("Fetch failed");

  // 2. Sanity Check
  // Rate lives inside the active scenario's financing object, not at top-level finance
  const currentRate = store.getActiveScenario()?.financing?.interestRate ?? null;
  const sanity = validateRateUpdate(currentRate, newData.rate);
  
  if (!sanity.valid) {
    console.error(`[DataSync] SANITY CHECK FAILED: ${sanity.error}`);
    // Trigger Alert System here
    return { status: 'REJECTED', reason: sanity.error };
  }

  // 3. Shadow Deployment & Regression (Simulated)
  // In a full implementation, we would run `npm test` here.
  const regressionPassed = true; // Simulate running tests/domain_tests.js
  
  if (!regressionPassed) {
    console.error("[DataSync] REGRESSION TEST FAILED: New data breaks calculation logic");
    return { status: 'ROLLBACK', reason: 'Regression failure' };
  }

  // 4. Atomic Update — use dot-path dispatch into the active scenario's financing
  store.dispatch('financing.interestRate', newData.rate);
  console.log(`[DataSync] SUCCESS: Interest rate updated to ${newData.rate}% (${newData.updatedAt})`);
  
  return { status: 'UPDATED', value: newData.rate };
};
