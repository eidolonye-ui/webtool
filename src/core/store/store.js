/**
 * @file core/store/store.js
 * @description Centralized state management for WebTool SaaS.
 * Supports Multi-Scenario management, Immutable State Updates, and Project Archiving.
 * @version 2.4.0 - Performance: structuredClone replaces JSON hot path;
 *                   batchDispatch added for multi-field updates without extra renders.
 */

/**
 * Fast deep clone - structuredClone (native, ~3x faster than JSON round-trip)
 * with JSON fallback for older environments.
 */
const deepClone = (obj) => {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
};

class WebToolStore {
  constructor() {
    this.STORAGE_KEY = 'webtool_saas_state';
    
    this.initialState = {
      system: {
        activeScenarioId:  'default',
        activePersona:     'developer',
        lastSync:          null,
        userPrefs:         { language: 'en', currency: 'AUD' },
        financeSuggestions: {},
        activeAccentColor: '#0f4c75',
        lastInsights:      null
      },
      scenarios: {
        default: {
          label:        '',        // human display name for this scenario
          strategyType: '',        // 'dual_occ' | 'townhouse' | 'apartments' | 'custom'
          site: {
            address: '',
            lat: null,
            lon: null,
            area: 0,
            zoning: 'NRZ',
            frontage: 0,
            depth: 0,
            investigation: {
              terrainData: null,
              locationData: null,
              synthesis: null,
              facts: []
            }
          },
          planning: {
            zoneCode:          '',
            maxHeight:         0,
            siteCoverage:      0,
            setbacks:          { front: 0, side: 0, rear: 0 },
            minLotSize:        0,
            hasHO:             false,
            hasVPO:            false,
            hasSBO:            false,
            hasBMO:            false,
            hasEasementBoe:    false,
            hasSingleCovenant: false,
            hasS173:           false,
            s173Details:       '',
            covenantDetails:   '',
            dealingNumbers:    [],          // Victorian title dealing numbers (D######, AL######, etc.)
            // Overlay flags (referenced by risk_engine + constraint_engine)
            hasDDO:            false,
            hasSLO:            false,
            hasESO:            false,
            hasACHO:           false,
            hasEMO:            false,
            overlayLabels:     [],
            // Site services availability
            servicesElec:      false,
            servicesGas:       false,
            servicesWater:     false,
            servicesSewer:     false
          },
          physical: {
            slope:                    null,
            aspect:                   null,
            elevationDelta:           null,
            soilType:                 'Standard',
            easements:                [],
            siteWorksCost:            0,
            siteWorksCostOverridden:  false
          },
          market: {
            grvPerUnit: 0,
            grvUnits: 1,
            dom: 45,
            marketTrend: 'stable'
          },
          finance: {
            landPrice: 0,
            isForeign: false,
            isOTP: true,
            buildArea: 0,
            buildCostPSM: 0,
            legalFees: 0,
            contingencyPct: 5,
            projectMonths: 24,
            targetMargin: 20
          },
          financeLocks: {
            buildArea: false,
            siteWorks: false,
            buildCostPSM: false,
            contingencyPct: false
          },
          trustOverrides: {},
          financing: {
            lvrPct: 65,
            interestRate: 6.5,
            equityRequired: 0,
            seniorDebt: 0,
            bankabilityStatus: 'TBC'
          },
          calculations: {
            total: 0,
            grv: 0,
            profit: 0,
            margin: 0,
            irr: 0,
            capInterest: 0,
            drawdownSchedule: []
          }
        }
      }
    };

    this.state = this._loadFromStorage() || deepClone(this.initialState);
    this.listeners = new Set();
    this._persistTimeout = null;
  }

  getState() {
    return this.state;
  }

  getActiveScenario() {
    const id = this.state.system.activeScenarioId;
    return this.state.scenarios[id];
  }

  dispatch(path, value) {
    const activeId = this.state.system.activeScenarioId;
    
    const fullPath = path.startsWith('system.') ? path : `scenarios.${activeId}.${path}`;
    const currentValue = this._getDeepValue(this.state, fullPath);
    
    if (JSON.stringify(currentValue) === JSON.stringify(value)) {
      return;
    }

    const newState = deepClone(this.state);
    if (path.startsWith('system.')) {
      this._setDeepValue(newState, path, value);
    } else {
      const scenarioPath = `scenarios.${activeId}.${path}`;
      this._setDeepValue(newState, scenarioPath, value);
    }
    
    this.state = newState;
    this.notify();
    this._schedulePersistence();
  }

  /**
   * Dispatch multiple path/value pairs atomically - triggers only ONE notify cycle
   * instead of N, preventing cascade re-renders on bulk updates.
   *
   * @param {Array<{path: string, value: *}>} updates
   */
  batchDispatch(updates = []) {
    if (!updates.length) return;
    const activeId = this.state.system.activeScenarioId;
    const newState = deepClone(this.state);

    let changed = false;
    updates.forEach(({ path, value }) => {
      const fullPath = path.startsWith('system.') ? path : `scenarios.${activeId}.${path}`;
      const current  = this._getDeepValue(newState, fullPath);
      if (JSON.stringify(current) !== JSON.stringify(value)) {
        this._setDeepValue(newState, fullPath, value);
        changed = true;
      }
    });

    if (changed) {
      this.state = newState;
      this.notify();
      this._schedulePersistence();
    }
  }

  _getDeepValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === null || current === undefined || !(key in current)) return undefined;
      current = current[key];
    }
    return current;
  }

  setActiveScenario(id) {
    if (this.state.scenarios[id]) {
      this.state = {
        ...this.state,
        system: {
          ...this.state.system,
          activeScenarioId: id
        }
      };
      this.notify();
      this._schedulePersistence();
    }
  }

  createScenario(name) {
    const id = name.toLowerCase().replace(/\s+/g, '_');
    if (this.state.scenarios[id]) return id;

    const currentData = deepClone(this.getActiveScenario());
    
    this.state = {
      ...this.state,
      scenarios: {
        ...this.state.scenarios,
        [id]: currentData
      },
      system: {
        ...this.state.system,
        activeScenarioId: id
      }
    };
    
    this.notify();
    this._schedulePersistence();
    return id;
  }

  deleteScenario(id) {
    if (id === 'default') return;
    
    const newScenarios = { ...this.state.scenarios };
    delete newScenarios[id];
    
    let activeId = this.state.system.activeScenarioId;
    if (activeId === id) {
      activeId = 'default';
    }

    this.state = {
      ...this.state,
      scenarios: newScenarios,
      system: {
        ...this.state.system,
        activeScenarioId: activeId
      }
    };
    
    this.notify();
    this._schedulePersistence();
  }

  renameScenario(oldId, newName) {
    if (oldId === 'default') return;
    const newId = newName.toLowerCase().replace(/\s+/g, '_');
    if (newId === oldId) return;
    if (this.state.scenarios[newId]) {
      return { success: false, error: 'A scenario with this name already exists.' };
    }

    const scenarioData = this.state.scenarios[oldId];
    const newScenarios = { ...this.state.scenarios };
    
    newScenarios[newId] = scenarioData;
    delete newScenarios[oldId];

    const activeId = this.state.system.activeScenarioId === oldId ? newId : this.state.system.activeScenarioId;

    this.state = {
      ...this.state,
      scenarios: newScenarios,
      system: {
        ...this.state.system,
        activeScenarioId: activeId
      }
    };
    
    this.notify();
    this._schedulePersistence();
    return { success: true, newId };
  }

  restoreFromArchive(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.system && parsed.scenarios && parsed.scenarios.default) {
        this.state = parsed;
        this.notify();
        this._schedulePersistence();
        return { success: true };
      }
      throw new Error('Invalid archive format');
    } catch (e) {
      return { success: false, error: e.message };
    }
  }

  saveToStorage() {
    try {
      const serializedState = JSON.stringify(this.state);
      localStorage.setItem(this.STORAGE_KEY, serializedState);
      this.state.system.lastSync = new Date().toISOString();
    } catch (e) {
      console.error('[Store] Persistence failed:', e);
    }
  }

  _schedulePersistence() {
    if (this._persistTimeout) clearTimeout(this._persistTimeout);
    this._persistTimeout = setTimeout(() => this.saveToStorage(), 1000);
  }

  _loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      if (parsed.system && parsed.scenarios && parsed.scenarios.default) return parsed;
      return null;
    } catch (e) {
      return null;
    }
  }

  clearAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
    this.state = deepClone(this.initialState);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(fn => fn(this.state));
  }

  _setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (current[keys[i]] === undefined || typeof current[keys[i]] !== 'object') {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }
}

export const store = new WebToolStore();
