/**
 * SyncService - Story 12.2
 * 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录；禁止写死 .cursor/
 * vscodeSettings 深度合并 .vscode/settings.json
 */
const fs = require('fs');
const path = require('path');
const AIRegistry = require('./ai-registry');

/**
 * Recursively copy directory contents to dest.
 * @param {string} src - Source directory.
 * @param {string} dest - Destination directory.
 * @returns {void}
 */
function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src) || !fs.statSync(src).isDirectory()) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyDirRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

/**
 * Deep merge overlay into base. Arrays and primitives in overlay overwrite.
 * @param {Record<string, unknown> | null} [base] - Base object.
 * @param {Record<string, unknown> | null} [overlay] - Overlay object.
 * @returns {Record<string, unknown>} Merged result.
 */
function deepMerge(base, overlay) {
  if (overlay == null || typeof overlay !== 'object' || Array.isArray(overlay)) return base || overlay;
  const result = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(overlay)) {
    if (v !== undefined && v !== null && typeof v === 'object' && !Array.isArray(v) && typeof result[k] === 'object' && result[k] != null && !Array.isArray(result[k])) {
      result[k] = deepMerge(result[k], v);
    } else if (v !== undefined && v !== null) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Sync commands/rules/agents and platform infrastructure to AI target dirs.
 * Commands always from _bmad/commands/ (shared); rules/agents from _bmad/{sourceDir}/.
 * For Claude: also deploys hooks, settings.json, state, CLAUDE.md.
 * @param {string} projectRoot - 项目根目录.
 * @param {string} selectedAI - AI id from registry.
 * @param {{ bmadPath?: string }} [options] - Optional bmadPath for worktree mode.
 * @returns {void}
 */
function syncCommandsRulesConfig(projectRoot, selectedAI, options = {}) {
  const entry = AIRegistry.getById(selectedAI, { cwd: projectRoot });
  if (!entry || !entry.configTemplate) return;

  const ct = entry.configTemplate;
  const bmadRoot = options.bmadPath
    ? path.resolve(options.bmadPath)
    : path.join(projectRoot, '_bmad');

  if (!fs.existsSync(bmadRoot) || !fs.statSync(bmadRoot).isDirectory()) return;

  if (ct.commandsDir) {
    const src = path.join(bmadRoot, 'commands');
    const dest = path.join(projectRoot, ct.commandsDir);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }

  const sourceDir = ct.sourceDir;

  if (ct.rulesDir && sourceDir) {
    const src = path.join(bmadRoot, sourceDir, 'rules');
    const dest = path.join(projectRoot, ct.rulesDir);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }

  if (ct.agentsDir && sourceDir) {
    const src = path.join(bmadRoot, sourceDir, 'agents');
    const dest = path.join(projectRoot, ct.agentsDir);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  } else if (ct.configDir && sourceDir) {
    const configSrc = path.join(bmadRoot, sourceDir, 'config');
    if (fs.existsSync(configSrc) && fs.statSync(configSrc).isDirectory()) {
      const destFull = path.join(projectRoot, ct.configDir);
      const destDir = path.dirname(destFull);
      const entries = fs.readdirSync(configSrc, { withFileTypes: true });
      if (entries.length > 0) {
        const first = entries.find((e) => e.isFile()) || entries[0];
        const srcFile = path.join(configSrc, first.name);
        if (fs.statSync(srcFile).isFile()) {
          if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
          fs.copyFileSync(srcFile, destFull);
        }
      }
    }
  }

  if (sourceDir === 'claude') {
    deployClaudeInfrastructure(projectRoot, bmadRoot);
  }

  if (ct.vscodeSettings && typeof ct.vscodeSettings === 'object') {
    const vscodeDir = path.join(projectRoot, '.vscode');
    const settingsPath = path.join(vscodeDir, 'settings.json');
    let existing = {};
    if (fs.existsSync(settingsPath)) {
      try {
        existing = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      } catch (_) {}
    }
    const merged = deepMerge(existing, ct.vscodeSettings);
    if (!fs.existsSync(vscodeDir)) fs.mkdirSync(vscodeDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2), 'utf8');
  }
}

/**
 * Deploy Claude-specific infrastructure: hooks, settings.json, state dirs, CLAUDE.md.
 * @param {string} projectRoot - Project root.
 * @param {string} bmadRoot - Path to _bmad directory.
 */
function deployClaudeInfrastructure(projectRoot, bmadRoot) {
  const claudeSrc = path.join(bmadRoot, 'claude');
  if (!fs.existsSync(claudeSrc)) return;

  const hooksSrc = path.join(claudeSrc, 'hooks');
  const hooksDest = path.join(projectRoot, '.claude', 'hooks');
  if (fs.existsSync(hooksSrc)) {
    copyDirRecursive(hooksSrc, hooksDest);
  }

  const settingsSrc = path.join(claudeSrc, 'settings.json');
  const settingsDest = path.join(projectRoot, '.claude', 'settings.json');
  if (fs.existsSync(settingsSrc)) {
    if (!fs.existsSync(path.dirname(settingsDest))) {
      fs.mkdirSync(path.dirname(settingsDest), { recursive: true });
    }
    fs.copyFileSync(settingsSrc, settingsDest);
  }

  const stateSrc = path.join(claudeSrc, 'state');
  const stateDest = path.join(projectRoot, '.claude', 'state');
  if (fs.existsSync(stateSrc)) {
    copyDirRecursive(stateSrc, stateDest);
  }

  const templateSrc = path.join(claudeSrc, 'CLAUDE.md.template');
  const claudeMdDest = path.join(projectRoot, 'CLAUDE.md');
  if (fs.existsSync(templateSrc) && !fs.existsSync(claudeMdDest)) {
    let content = fs.readFileSync(templateSrc, 'utf8');
    const projectName = path.basename(projectRoot);
    content = content.replace(/\{\{PROJECT_NAME\}\}/g, projectName);
    fs.writeFileSync(claudeMdDest, content, 'utf8');
  }
}

module.exports = {
  syncCommandsRulesConfig,
};
