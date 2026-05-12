/**
 * WebTool Registry System
 * Solves the "dependency hell" and loading order issues.
 * Replaces the legacy window-mounting patch.
 */

class WebToolRegistry {
  constructor() {
    this.modules = new Map();
  }

  /**
   * Register a module (data, function, or component)
   * @param {string} key - Unique identifier (e.g., 'DOMAIN_DATA_SUBURBS')
   * @param {any} value - The module content
   */
  register(key, value) {
    console.log(`[Registry] Registering module: ${key}`);
    this.modules.set(key, value);
  }

  /**
   * Retrieve a registered module
   * @param {string} key 
   * @returns {any}
   */
  get(key) {
    if (!this.modules.has(key)) {
      console.warn(`[Registry] Module not found: ${key}. Ensure it is registered before access.`);
      return undefined;
    }
    return this.modules.get(key);
  }

  /**
   * Check if a module exists
   * @param {string} key 
   * @returns {boolean}
   */
  has(key) {
    return this.modules.has(key);
  }

  /**
   * List all registered modules for debugging
   */
  list() {
    return Array.from(this.modules.keys());
  }
}

// Export as a singleton to be used across the entire SaaS app
export const registry = new WebToolRegistry();
