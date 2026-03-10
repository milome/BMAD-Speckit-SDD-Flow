/**
 * ConfigManager: global ~/.bmad-speckit/config.json and project _bmad-output/config/bmad-speckit.json
 * Story 10.4 - get/set/setAll/list; project overrides global on read.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_NETWORK_TIMEOUT_MS = 30000;

function getGlobalConfigPath() {
  return path.join(os.homedir(), '.bmad-speckit', 'config.json');
}

function getProjectConfigPath(cwd) {
  return path.join(cwd, '_bmad-output', 'config', 'bmad-speckit.json');
}

function _readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function _writeJson(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

/**
 * @param {string} key
 * @param {{ cwd?: string }} options
 * @returns {string|number|undefined}
 */
function get(key, options = {}) {
  const cwd = options.cwd;
  let projectValue;
  if (cwd) {
    const projectPath = getProjectConfigPath(cwd);
    const projectObj = _readJson(projectPath);
    if (Object.prototype.hasOwnProperty.call(projectObj, key)) {
      projectValue = projectObj[key];
    }
  }
  if (projectValue !== undefined) return projectValue;

  const globalPath = getGlobalConfigPath();
  const globalObj = _readJson(globalPath);
  if (Object.prototype.hasOwnProperty.call(globalObj, key)) return globalObj[key];

  if (key === 'networkTimeoutMs') return DEFAULT_NETWORK_TIMEOUT_MS;
  return undefined;
}

/**
 * @param {string} key
 * @param {string|number} value
 * @param {{ scope: 'global'|'project', cwd?: string }} options
 */
function set(key, value, options) {
  const { scope, cwd } = options || {};
  if (scope === 'project' && !cwd) throw new Error('scope "project" requires options.cwd');
  const filePath = scope === 'global' ? getGlobalConfigPath() : getProjectConfigPath(cwd);
  const obj = _readJson(filePath);
  if (key === 'networkTimeoutMs') obj[key] = Number(value);
  else obj[key] = value;
  _writeJson(filePath, obj);
}

/**
 * @param {Record<string, unknown>} record
 * @param {{ scope: 'global'|'project', cwd?: string }} options
 */
function setAll(record, options) {
  const { scope, cwd } = options || {};
  if (scope === 'project' && !cwd) throw new Error('scope "project" requires options.cwd');
  const filePath = scope === 'global' ? getGlobalConfigPath() : getProjectConfigPath(cwd);
  const obj = _readJson(filePath);
  for (const [k, v] of Object.entries(record)) {
    if (k === 'networkTimeoutMs') obj[k] = Number(v);
    else obj[k] = v;
  }
  _writeJson(filePath, obj);
}

/**
 * @param {{ cwd?: string }} options
 * @returns {Record<string, unknown>}
 */
function list(options = {}) {
  const globalObj = _readJson(getGlobalConfigPath());
  let result = { ...globalObj };
  const cwd = options.cwd;
  if (cwd) {
    const projectPath = getProjectConfigPath(cwd);
    const projectObj = _readJson(projectPath);
    result = { ...result, ...projectObj };
  }
  if (!Object.prototype.hasOwnProperty.call(result, 'networkTimeoutMs')) {
    result.networkTimeoutMs = DEFAULT_NETWORK_TIMEOUT_MS;
  }
  return result;
}

module.exports = {
  getGlobalConfigPath,
  getProjectConfigPath,
  get,
  set,
  setAll,
  list,
};
