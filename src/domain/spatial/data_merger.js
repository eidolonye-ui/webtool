/**
 * @file domain/spatial/data_merger.js
 * @description Implements the "Source of Truth Hierarchy" for site data.
 * Ensures that high-precision sources (Survey Plans) override estimates (API).
 * @version 1.0.0
 */

/**
 * Priority Map for data sources. Higher number = Higher Authority.
 */
const PRIORITY_MAP = {
  'SURVEY': 4,    // Feature & Level Survey (Physical Truth)
  'S32': 3,       // Section 32 / Title (Legal Truth)
  'VICPLAN': 2,   // VicPlan / Govt records (Planning Truth)
  'API': 1,       // API / Estimations (Default Baseline)
  'MANUAL': 5,    // User manual override (Absolute Truth)
};

/**
 * Merges a new value into the current state based on source priority.
 * @param {Object} currentState - The current value and its source (e.g., { value: 800, source: 'API' })
 * @param {any} newValue - The new value to potentially merge
 * @param {string} newSource - The source of the new value
 * @returns {Object} The winning value and its source
 */
export const mergeDataWithPriority = (currentState, newValue, newSource) => {
  if (!currentState || currentState.value === undefined) {
    return { value: newValue, source: newSource };
  }

  const currentPriority = PRIORITY_MAP[currentState.source] || 0;
  const newPriority = PRIORITY_MAP[newSource] || 0;

  // Only overwrite if the new source has equal or higher priority
  if (newPriority >= currentPriority) {
    return { value: newValue, source: newSource };
  }

  return currentState;
};

/**
 * Bulk merges an extraction result into the site state.
 * @param {Object} siteState - The current site state object
 * @param {Object} extractedData - Key-value pairs of extracted data (e.g., { area: 792 })
 * @param {string} source - The source of this extraction batch
 * @returns {Object} The updated site state
 */
export const mergeExtractionBatch = (siteState, extractedData, source) => {
  const updatedState = { ...siteState };
  
  Object.entries(extractedData).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    
    const currentEntry = updatedState[key] || {};
    // Handle cases where the state is just the value, not an object {value, source}
    const normalizedCurrent = (typeof currentEntry === 'object' && currentEntry.value !== undefined) 
      ? currentEntry 
      : { value: currentEntry, source: 'API' };

    const result = mergeDataWithPriority(normalizedCurrent, value, source);
    updatedState[key] = result;
  });

  return updatedState;
};
