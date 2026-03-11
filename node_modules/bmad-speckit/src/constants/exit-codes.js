/**
 * Exit codes for bmad-speckit CLI (PRD §5.2, ARCH §3.4).
 * - SUCCESS (0): Success
 * - GENERAL_ERROR (1): General error, selectedAI invalid
 * - AI_INVALID (2): AI config invalid
 * - NETWORK_TEMPLATE_FAILED (3): Template fetch failed
 * - TARGET_PATH_UNAVAILABLE (4): bmadPath missing or invalid
 * - OFFLINE_CACHE_MISSING (5): Offline mode but cache missing
 * @typedef {Object} ExitCodes
 * @property {number} SUCCESS - Success
 * @property {number} GENERAL_ERROR - General error
 * @property {number} AI_INVALID - AI config invalid
 * @property {number} NETWORK_TEMPLATE_FAILED - Template fetch failed
 * @property {number} TARGET_PATH_UNAVAILABLE - bmadPath invalid
 * @property {number} OFFLINE_CACHE_MISSING - Offline cache missing
 */
module.exports = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AI_INVALID: 2,
  NETWORK_TEMPLATE_FAILED: 3,
  TARGET_PATH_UNAVAILABLE: 4,
  OFFLINE_CACHE_MISSING: 5,
};
