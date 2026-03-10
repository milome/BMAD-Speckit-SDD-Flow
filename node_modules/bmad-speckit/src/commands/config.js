/**
 * ConfigCommand - config subcommand (Story 13.4, plan-E13-S4)
 * config get <key> | config set <key> <value> | config list
 * Supports --global (set only), --json
 */
const fs = require('fs');
const { get, set, list, getProjectConfigPath } = require('../services/config-manager');

/**
 * config get <key>
 * @param {string} cwd
 * @param {{ key: string, json?: boolean }} options
 */
function configGetCommand(cwd, options) {
  const { key, json } = options;
  const value = get(key, { cwd });
  if (value === undefined) {
    console.error('Error: 配置项不存在 (Key does not exist)');
    process.exit(1);
  }
  if (json) {
    console.log(JSON.stringify({ [key]: value }));
  } else {
    console.log(String(value));
  }
  process.exit(0);
}

/**
 * config set <key> <value>
 * @param {string} cwd
 * @param {{ key: string, value: string, global?: boolean }} options
 */
function configSetCommand(cwd, options) {
  const { key, value, global: forceGlobal } = options;
  const projectPath = getProjectConfigPath(cwd);
  const isInit = fs.existsSync(projectPath);
  const scope = isInit && !forceGlobal ? 'project' : 'global';
  const resolvedValue = key === 'networkTimeoutMs' ? Number(value) : value;
  set(key, resolvedValue, { scope, cwd: scope === 'project' ? cwd : undefined });
  process.exit(0);
}

/**
 * config list
 * @param {string} cwd
 * @param {{ json?: boolean }} options
 */
function configListCommand(cwd, options) {
  const { json } = options;
  const obj = list({ cwd });
  if (json) {
    console.log(JSON.stringify(obj, null, 0));
  } else {
    for (const [k, v] of Object.entries(obj)) {
      console.log(`${k}: ${v}`);
    }
  }
  process.exit(0);
}

module.exports = {
  configGetCommand,
  configSetCommand,
  configListCommand,
};
