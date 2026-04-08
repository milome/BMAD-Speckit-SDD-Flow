/**
 * SyncService - Story 12.2
 * 按 configTemplate 同步 commands/rules/config 到所选 AI 目标目录；禁止写死 .cursor/
 * vscodeSettings 深度合并 .vscode/settings.json
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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

function loadSpeckitMirrorTools(bmadRoot) {
  const helperPath = path.join(bmadRoot, 'speckit', 'scripts', 'node', 'speckit-mirror.js');
  if (!fs.existsSync(helperPath)) {
    return null;
  }
  return require(helperPath);
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
    const speckitCmdSrc = path.join(bmadRoot, 'speckit', 'commands');
    if (fs.existsSync(speckitCmdSrc) && fs.statSync(speckitCmdSrc).isDirectory()) {
      copyDirRecursive(speckitCmdSrc, dest);
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

  if (ct.protocolsDir && sourceDir) {
    const src = path.join(bmadRoot, sourceDir, 'protocols');
    const dest = path.join(projectRoot, ct.protocolsDir);
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }

  if (sourceDir) {
    const agentRoot = ct.commandsDir
      ? path.dirname(ct.commandsDir)
      : ct.rulesDir ? path.dirname(ct.rulesDir) : null;
    if (agentRoot) {
      const projectSkillsDest = path.join(projectRoot, agentRoot, 'skills');
      const sharedSkillsSrc = path.join(bmadRoot, 'skills');
      if (fs.existsSync(sharedSkillsSrc) && fs.statSync(sharedSkillsSrc).isDirectory()) {
        copyDirRecursive(sharedSkillsSrc, projectSkillsDest);
      }
      const platformSkillsSrc = path.join(bmadRoot, sourceDir, 'skills');
      if (fs.existsSync(platformSkillsSrc) && fs.statSync(platformSkillsSrc).isDirectory()) {
        copyDirRecursive(platformSkillsSrc, projectSkillsDest);
      }
    }
  }

  if (sourceDir === 'claude') {
    deployClaudeInfrastructure(projectRoot, bmadRoot);
  }

  if (sourceDir === 'cursor') {
    deployCursorRuntimePolicyHooks(projectRoot, bmadRoot);
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

  deploySpecifyDir(projectRoot, bmadRoot);

  /** Align with monorepo `init-to-root`: hooks dir gets `emit-runtime-policy.cjs` + `write-runtime-context.cjs`; default project context lives under `_bmad-output/runtime/context/project.json`. */
  deployRuntimeGovernanceFromPackage(projectRoot);

  fs.mkdirSync(path.join(projectRoot, 'specs'), { recursive: true });
}

/**
 * Copy `@bmad-speckit/runtime-emit` artifacts into `.cursor/hooks` and/or `.claude/hooks` (not project-root `scripts/`).
 * @param {string} projectRoot - Project root (where node_modules may contain the package).
 * @returns {void}
 */
function deployRuntimeGovernanceFromPackage(projectRoot) {
  /** bmad-speckit package root (real path when consumer uses file: link to monorepo). */
  const bmadSpeckitRoot = path.resolve(__dirname, '..', '..');
  let emitSrc;
  try {
    emitSrc = require.resolve('@bmad-speckit/runtime-emit', {
      paths: [bmadSpeckitRoot, projectRoot],
    });
  } catch {
    return;
  }
  const pkgRootRuntimeEmit =
    path.basename(path.dirname(emitSrc)) === 'dist' ? path.dirname(path.dirname(emitSrc)) : path.dirname(emitSrc);
  const wrcSrc = path.join(pkgRootRuntimeEmit, 'write-runtime-context.cjs');
  const governanceWorkerSrc = path.join(pkgRootRuntimeEmit, 'dist', 'governance-runtime-worker.cjs');
  const governanceRunnerSrc = path.join(pkgRootRuntimeEmit, 'dist', 'governance-remediation-runner.cjs');
  const hookDirs = [path.join(projectRoot, '.cursor', 'hooks'), path.join(projectRoot, '.claude', 'hooks')];
  let deployed = 0;
  for (const d of hookDirs) {
    if (!fs.existsSync(d)) continue;
    fs.copyFileSync(emitSrc, path.join(d, 'emit-runtime-policy.cjs'));
    if (fs.existsSync(wrcSrc)) {
      fs.copyFileSync(wrcSrc, path.join(d, 'write-runtime-context.cjs'));
    }
    const preContinueSrc = path.join(projectRoot, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs');
    if (fs.existsSync(preContinueSrc)) {
      fs.copyFileSync(preContinueSrc, path.join(d, 'pre-continue-check.cjs'));
    }
    if (fs.existsSync(governanceWorkerSrc)) {
      fs.copyFileSync(governanceWorkerSrc, path.join(d, 'governance-runtime-worker.cjs'));
    }
    if (fs.existsSync(governanceRunnerSrc)) {
      fs.copyFileSync(governanceRunnerSrc, path.join(d, 'governance-remediation-runner.cjs'));
    }
    deployed += 1;
  }
  if (deployed === 0) return;

  const targetContext = path.join(projectRoot, '_bmad-output', 'runtime', 'context', 'project.json');
  if (!fs.existsSync(targetContext)) {
    const wrcCandidates = [
      path.join(projectRoot, '.cursor', 'hooks', 'write-runtime-context.cjs'),
      path.join(projectRoot, '.claude', 'hooks', 'write-runtime-context.cjs'),
    ];
    const wrcDest = wrcCandidates.find((p) => fs.existsSync(p));
    if (wrcDest) {
      spawnSync(process.execPath, [wrcDest, targetContext, 'story', 'story_create'], {
        cwd: projectRoot,
        stdio: 'pipe',
      });
    }
  }
}

/**
 * Deploy .specify/ runtime directory from _bmad/speckit/ source.
 * Creates templates/, workflows/, scripts/, memory/ under .specify/.
 * @param {string} projectRoot - Project root.
 * @param {string} bmadRoot - Path to _bmad directory.
 */
function deploySpecifyDir(projectRoot, bmadRoot) {
  const mirrorTools = loadSpeckitMirrorTools(bmadRoot);
  if (mirrorTools && typeof mirrorTools.syncSpecifyMirror === 'function') {
    mirrorTools.syncSpecifyMirror({
      bmadRoot,
      projectRoot,
    });
    return;
  }

  const specifyDest = path.join(projectRoot, '.specify');
  const pairs = [
    { src: path.join(bmadRoot, 'speckit', 'templates'), dest: path.join(specifyDest, 'templates') },
    { src: path.join(bmadRoot, 'speckit', 'workflows'), dest: path.join(specifyDest, 'workflows') },
    { src: path.join(bmadRoot, 'speckit', 'scripts', 'shell'), dest: path.join(specifyDest, 'scripts') },
    { src: path.join(bmadRoot, 'speckit', 'scripts', 'powershell'), dest: path.join(specifyDest, 'scripts') },
  ];
  for (const { src, dest } of pairs) {
    if (fs.existsSync(src) && fs.statSync(src).isDirectory()) {
      copyDirRecursive(src, dest);
    }
  }
  const cmdSrc = path.join(bmadRoot, 'speckit', 'commands');
  const cmdDest = path.join(specifyDest, 'templates', 'commands');
  if (fs.existsSync(cmdSrc) && fs.statSync(cmdSrc).isDirectory()) {
    copyDirStripPrefix(cmdSrc, cmdDest, 'speckit.');
  }
  const memoryDir = path.join(specifyDest, 'memory');
  if (!fs.existsSync(memoryDir)) fs.mkdirSync(memoryDir, { recursive: true });
}

/**
 * Copy directory contents, stripping a filename prefix from top-level files.
 * e.g. speckit.plan.md -> plan.md (upstream convention for .specify/templates/commands/).
 * @param {string} src - Source directory path
 * @param {string} dest - Destination directory path
 * @param {string} prefix - Filename prefix to strip
 */
function copyDirStripPrefix(src, dest, prefix) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    if (e.isDirectory()) {
      copyDirRecursive(s, path.join(dest, e.name));
    } else {
      const destName = e.name.startsWith(prefix) ? e.name.slice(prefix.length) : e.name;
      fs.copyFileSync(s, path.join(dest, destName));
    }
  }
}

function writeCursorHooksJson(projectRoot) {
  const cursorDir = path.join(projectRoot, '.cursor');
  fs.mkdirSync(cursorDir, { recursive: true });
  const hooksJsonPath = path.join(cursorDir, 'hooks.json');
  const hooksJson = {
    version: 1,
    hooks: {
      sessionStart: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host --session-start' },
      ],
      preToolUse: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host' },
        { command: 'node .cursor/hooks/pre-continue-check.cjs' },
      ],
      subagentStart: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host --subagent-start' },
      ],
    },
  };
  fs.writeFileSync(hooksJsonPath, `${JSON.stringify(hooksJson, null, 2)}\n`, 'utf8');
}

/**
 * Deploy Claude-specific infrastructure: hooks, settings.json, state dirs, CLAUDE.md.
 * @param {string} projectRoot - Project root.
 * @param {string} bmadRoot - Path to _bmad directory.
 */
/**
 * Cursor runtime governance hooks: shared `_bmad/runtime/hooks` then thin shells from `_bmad/cursor/hooks` (aligns with `scripts/init-to-root.js`).
 * @param {string} projectRoot - Project root.
 * @param {string} bmadRoot - Path to _bmad directory.
 * @returns {void}
 */
function deployCursorRuntimePolicyHooks(projectRoot, bmadRoot) {
  const destDir = path.join(projectRoot, '.cursor', 'hooks');
  const sharedDir = path.join(bmadRoot, 'runtime', 'hooks');
  const cursorHooksDir = path.join(bmadRoot, 'cursor', 'hooks');

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(sharedDir)) {
    copyDirRecursive(sharedDir, destDir);
  }

  const names = [
    'emit-runtime-policy-cli.cjs',
    'runtime-policy-inject.cjs',
    'pre-continue-check.cjs',
    'post-tool-use.cjs',
    'runtime-dashboard-session-start.cjs',
  ];
  for (const name of names) {
    const src = path.join(cursorHooksDir, name);
    const runtimeFallback = path.join(bmadRoot, 'runtime', 'hooks', name);
    const source = fs.existsSync(src) ? src : runtimeFallback;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(destDir, name));
    }
  }
  writeCursorHooksJson(projectRoot);
}

/**
 * Claude hooks: shared `_bmad/runtime/hooks` then thin shells from `_bmad/claude/hooks` (aligns with `scripts/init-to-root.js`).
 * @param {string} projectRoot - Project root.
 * @param {string} bmadRoot - Path to _bmad directory.
 * @returns {void}
 */
function deployClaudeRuntimePolicyHooks(projectRoot, bmadRoot) {
  const destDir = path.join(projectRoot, '.claude', 'hooks');
  const sharedDir = path.join(bmadRoot, 'runtime', 'hooks');
  const claudeHooksDir = path.join(bmadRoot, 'claude', 'hooks');

  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(sharedDir)) {
    copyDirRecursive(sharedDir, destDir);
  }

  const names = [
    'emit-runtime-policy-cli.cjs',
    'runtime-policy-inject.cjs',
    'pre-continue-check.cjs',
    'post-tool-use.cjs',
    'session-start.cjs',
    'stop.cjs',
  ];
  for (const name of names) {
    const src = path.join(claudeHooksDir, name);
    const runtimeFallback = path.join(bmadRoot, 'runtime', 'hooks', name);
    const source = fs.existsSync(src) ? src : runtimeFallback;
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, path.join(destDir, name));
    }
  }
}

function deployPreContinueGateConfig(projectRoot, bmadRoot) {
  const src = path.join(bmadRoot, '_config', 'architecture-gates.yaml');
  const dest = path.join(projectRoot, '_bmad', '_config', 'architecture-gates.yaml');
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);

  const routingSrc = path.join(bmadRoot, '_config', 'continue-gate-routing.yaml');
  const routingDest = path.join(projectRoot, '_bmad', '_config', 'continue-gate-routing.yaml');
  if (fs.existsSync(routingSrc)) {
    fs.copyFileSync(routingSrc, routingDest);
  }
}

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

  deployClaudeRuntimePolicyHooks(projectRoot, bmadRoot);
  deployPreContinueGateConfig(projectRoot, bmadRoot);
}

module.exports = {
  syncCommandsRulesConfig,
};
