/**
 * AIRegistry - load/getById/listIds (Story 12.1, spec §6)
 * 合并: 内置 + 全局 ~/.bmad-speckit/ai-registry.json + 项目 _bmad-output/config/ai-registry.json
 * 优先级: 项目 > 全局 > 内置
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const aiRegistryBuiltin = require('../constants/ai-registry-builtin');

const BUILTIN_IDS = new Set(aiRegistryBuiltin.map((a) => a.id));

/**
 * Get global ai-registry path (~/.bmad-speckit/ai-registry.json).
 * @returns {string} Absolute path.
 */
function getGlobalRegistryPath() {
  return path.join(os.homedir(), '.bmad-speckit', 'ai-registry.json');
}

/**
 * Get project ai-registry path (_bmad-output/config/ai-registry.json).
 * @param {string} [cwd] - Working directory; defaults to process.cwd().
 * @returns {string} Absolute path.
 */
function getProjectRegistryPath(cwd) {
  return path.join(cwd || process.cwd(), '_bmad-output', 'config', 'ai-registry.json');
}

/**
 * 校验 configTemplate: commandsDir/rulesDir 至少其一; agentsDir/configDir 二选一 (spec §4.2.1).
 * @param {Record<string, unknown> | null} [ct] - configTemplate object.
 * @param {string} [entryId] - AI entry id for error message.
 * @param {string} [filePath] - File path for error message.
 * @returns {void}
 * @throws {Error} If configTemplate is invalid.
 */
function validateConfigTemplate(ct, entryId, filePath) {
  if (!ct || typeof ct !== 'object') return;
  const hasCommands = ct.commandsDir != null && String(ct.commandsDir).trim() !== '';
  const hasRules = ct.rulesDir != null && String(ct.rulesDir).trim() !== '';
  if (!hasCommands && !hasRules) {
    throw new Error(`Invalid configTemplate for "${entryId}" in ${filePath}: commandsDir or rulesDir required`);
  }
  const hasAgents = ct.agentsDir != null && String(ct.agentsDir).trim() !== '';
  const hasConfig = ct.configDir != null && String(ct.configDir).trim() !== '';
  if (hasAgents && hasConfig) {
    throw new Error(`Invalid configTemplate for "${entryId}" in ${filePath}: agentsDir and configDir are mutually exclusive`);
  }
}

/**
 * 解析 registry 文件: 支持 { "ais": [...] } 或 [...]. 用户/项目自定义 AI 时 configTemplate 必填 (spec §4.1).
 * @param {string} content - JSON content.
 * @param {string} [filePath] - File path for error message.
 * @returns {Array<{ id: string, configTemplate?: Record<string, unknown> }>} Parsed AI entries.
 * @throws {Error} On invalid JSON or missing configTemplate for custom AI.
 */
function parseRegistryFile(content, filePath) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (e) {
    throw new Error(`Invalid JSON: ${filePath}`);
  }
  const arr = Array.isArray(parsed) ? parsed : (parsed != null && Array.isArray(parsed.ais) ? parsed.ais : []);
  for (const entry of arr) {
    const id = entry?.id;
    const isBuiltin = id && BUILTIN_IDS.has(id);
    const ct = entry?.configTemplate;
    if (!isBuiltin && (!ct || typeof ct !== 'object')) {
      throw new Error(`Missing configTemplate for custom AI "${id}" in ${filePath}`);
    }
    if (ct) validateConfigTemplate(ct, id || 'unknown', filePath);
  }
  return arr;
}

/**
 * 读取 registry 文件，不存在返回 [].
 * @param {string} filePath - Path to ai-registry.json.
 * @returns {Array<{ id: string, configTemplate?: Record<string, unknown> }>} Parsed entries or [].
 */
function readRegistryFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return parseRegistryFile(content, filePath);
}

/**
 * 深度合并 configTemplate（项目级字段覆盖）. 空/undefined 不覆盖.
 * @param {Record<string, unknown> | null} [base] - Base configTemplate.
 * @param {Record<string, unknown> | null} [overlay] - Overlay from project.
 * @returns {Record<string, unknown>} Merged configTemplate.
 */
function deepMergeConfigTemplate(base, overlay) {
  if (!overlay || typeof overlay !== 'object') return base ? { ...base } : {};
  const result = base && typeof base === 'object' ? { ...base } : {};
  for (const [k, v] of Object.entries(overlay)) {
    if (v !== undefined && v !== null && v !== '') {
      result[k] = v;
    }
  }
  return result;
}

/**
 * 按 id 合并，优先级: project > global > builtin.
 * @param {Array<{ id: string, configTemplate?: Record<string, unknown> }>} builtin - Builtin entries.
 * @param {Array<{ id: string, configTemplate?: Record<string, unknown> }>} global - Global registry entries.
 * @param {Array<{ id: string, configTemplate?: Record<string, unknown> }>} project - Project registry entries.
 * @returns {Array<{ id: string, configTemplate?: Record<string, unknown> }>} Merged list.
 */
function mergeByPriority(builtin, global, project) {
  const byId = new Map();
  for (const entry of builtin) {
    byId.set(entry.id, {
      ...entry,
      configTemplate: { ...entry.configTemplate },
    });
  }
  for (const entry of global) {
    const existing = byId.get(entry.id);
    const merged = {
      ...entry,
      configTemplate: deepMergeConfigTemplate(existing?.configTemplate ?? {}, entry.configTemplate ?? {}),
    };
    byId.set(entry.id, merged);
  }
  for (const entry of project) {
    const existing = byId.get(entry.id);
    const merged = {
      ...entry,
      configTemplate: deepMergeConfigTemplate(existing?.configTemplate ?? {}, entry.configTemplate ?? {}),
    };
    byId.set(entry.id, merged);
  }
  return Array.from(byId.values());
}

/**
 * Load merged AI list (builtin + global + project). 优先级: project > global > builtin.
 * @param {{ cwd?: string }} [opts] - cwd for project registry path.
 * @returns {Array<{ id: string, configTemplate?: Record<string, unknown> }>} Merged AI entries.
 */
function load(opts = {}) {
  const cwd = opts.cwd != null ? opts.cwd : process.cwd();
  const globalPath = getGlobalRegistryPath();
  const projectPath = getProjectRegistryPath(cwd);

  const builtin = aiRegistryBuiltin.map((e) => ({
    ...e,
    configTemplate: { ...e.configTemplate },
  }));
  const global = readRegistryFile(globalPath);
  const project = readRegistryFile(projectPath);

  return mergeByPriority(builtin, global, project);
}

/**
 * Get AI entry by id. 返回条目或 null.
 * @param {string} id - AI id.
 * @param {{ cwd?: string }} [opts] - cwd for load context.
 * @returns {{ id: string, configTemplate?: Record<string, unknown> } | null} The AI entry object or null if not found.
 */
function getById(id, opts = {}) {
  const list = load(opts);
  return list.find((a) => a.id === id) ?? null;
}

/**
 * List all AI ids from merged registry.
 * @param {{ cwd?: string }} [opts] - cwd for load context.
 * @returns {string[]} Array of AI ids from the merged registry.
 */
function listIds(opts = {}) {
  return load(opts).map((a) => a.id);
}

module.exports = {
  load,
  getById,
  listIds,
  getGlobalRegistryPath,
  getProjectRegistryPath,
  parseRegistryFile,
  deepMergeConfigTemplate,
  mergeByPriority,
};
