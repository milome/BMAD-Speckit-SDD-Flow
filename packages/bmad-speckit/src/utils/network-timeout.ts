/**
 * Resolve network timeout ms: env SDD_NETWORK_TIMEOUT_MS > project config > global config > 30000
 * Story 11.1, spec §8: config chain for TemplateFetcher and init
 * @param {Object} [options] - Options for resolving timeout.
 * @param {string|number} [options.networkTimeout] - CLI override
 * @param {string} [options.cwd] - cwd for project config
 * @returns {number} timeout in ms
 */
function resolveNetworkTimeoutMs(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  if (options.networkTimeout != null) {
    const n = parseInt(options.networkTimeout, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const envMs = process.env.SDD_NETWORK_TIMEOUT_MS;
  if (envMs != null && envMs !== '') {
    const n = parseInt(envMs, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  try {
    const configManager = require('../services/config-manager');
    const project = configManager?.get?.('networkTimeoutMs', { cwd });
    if (project != null && Number(project) > 0) return Number(project);
    const global = configManager?.get?.('networkTimeoutMs', {});
    if (global != null && Number(global) > 0) return Number(global);
  } catch {
    // ignore
  }
  return 30000;
}

module.exports = { resolveNetworkTimeoutMs };
