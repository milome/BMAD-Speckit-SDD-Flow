/**
 * SyncService - Story 12.2
 * 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录；禁止写死 .cursor/
 * vscodeSettings 深度合并 .vscode/settings.json
 */
const fs = require('fs');
const path = require('path');
const AIRegistry = require('./ai-registry');

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
 * @param {string} projectRoot - 项目根目录
 * @param {string} selectedAI - AI id
 * @param {{ bmadPath?: string }} options
 */
function syncCommandsRulesConfig(projectRoot, selectedAI, options = {}) {
  const entry = AIRegistry.getById(selectedAI, { cwd: projectRoot });
  if (!entry || !entry.configTemplate) return;

  const ct = entry.configTemplate;
  const bmadPath = options.bmadPath;
  const cursorSrc = bmadPath
    ? path.join(path.resolve(bmadPath), 'cursor')
    : path.join(projectRoot, '_bmad', 'cursor');

  if (!fs.existsSync(cursorSrc) || !fs.statSync(cursorSrc).isDirectory()) return;

  if (ct.commandsDir) {
    const src = path.join(cursorSrc, 'commands');
    const dest = path.join(projectRoot, ct.commandsDir);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }

  if (ct.rulesDir) {
    const src = path.join(cursorSrc, 'rules');
    const dest = path.join(projectRoot, ct.rulesDir);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }

  const configSrc = path.join(cursorSrc, 'config');
  if (ct.agentsDir) {
    const dest = path.join(projectRoot, ct.agentsDir);
    if (fs.existsSync(configSrc) && fs.statSync(configSrc).isDirectory()) {
      copyDirRecursive(configSrc, dest);
    }
  } else if (ct.configDir) {
    const destFull = path.join(projectRoot, ct.configDir);
    const destDir = path.dirname(destFull);
    if (fs.existsSync(configSrc) && fs.statSync(configSrc).isDirectory()) {
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

module.exports = {
  syncCommandsRulesConfig,
};
