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

function getGlobalRegistryPath() {
  return path.join(os.homedir(), '.bmad-speckit', 'ai-registry.json');
}

function getProjectRegistryPath(cwd) {
  return path.join(cwd || process.cwd(), '_bmad-output', 'config', 'ai-registry.json');
}

/**
 * 校验 configTemplate: commandsDir/rulesDir 至少其一; agentsDir/configDir 二选一 (spec §4.2.1)
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
 * 解析 registry 文件: 支持 { "ais": [...] } 或 [...]
 * 用户/项目自定义 AI (非覆盖内置) 时 configTemplate 必填 (spec §4.1)
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
 * 读取文件，不存在返回 []
 */
function readRegistryFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf8');
  return parseRegistryFile(content, filePath);
}

/**
 * 深度合并 configTemplate（项目级字段覆盖）
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
 * 按 id 合并，优先级: project > global > builtin
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
 * load({ cwd? }) - 合并后 AI 列表
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
 * getById(id, { cwd? }) - 返回条目或 null
 */
function getById(id, opts = {}) {
  const list = load(opts);
  return list.find((a) => a.id === id) ?? null;
}

/**
 * listIds({ cwd? }) - 返回 id 数组
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
