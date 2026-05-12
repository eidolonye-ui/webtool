/**
 * @file domain/extraction/ai_parser.js
 * @description Rule-based property document parser (legacy entry point).
 * @version 2.0.0 - Ollama removed. Delegates to ai_adapter rule engine.
 *
 * Kept for backward compatibility — any code that imports from this file
 * still works identically. parseDocumentWithAI now uses regex, not LLM.
 */

export { parseDocumentWithAI, PARSING_SYSTEM_PROMPT } from './ai_adapter.js';

// Legacy config object — kept so any import of AI_PARSER_CONFIG doesn't crash.
// No longer points at any real endpoint.
export const AI_PARSER_CONFIG = {
  MODEL_NAME: 'rule-based',
  TIMEOUT:    0,
};
