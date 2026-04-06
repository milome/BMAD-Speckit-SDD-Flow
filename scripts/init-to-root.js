#!/usr/bin/env node
/**
 * Init-to-root: 将 _bmad、_bmad-output 部署到项目根，再按 agent 从 _bmad/ 同步到运行时目录。
 *
 * 源路径约定：_bmad/ 是唯一内容源。
 *   - 共享 commands: _bmad/commands/
 *   - 共享 i18n: _bmad/i18n/
 *   - Cursor rules/skills: _bmad/cursor/
 *   - Claude agents/skills/hooks/rules: _bmad/claude/
 *
 * 用途：部署 BMAD 目录结构。
 * 对外部目标目录：从 @bmad-speckit/runtime-emit 将 emit-runtime-policy.cjs、resolve-for-session.cjs、render-audit-block.cjs 与 write-runtime-context.cjs 复制到 **.cursor/hooks** 与/或 **.claude/hooks**（与 hook 脚本同目录，不在项目根创建 scripts/）。
 * `--agent cursor`：`syncCursorRuntimePolicyHooks` 先将 `_bmad/runtime/hooks` 下 4 个共享 JS 复制到 `.cursor/hooks`，再覆盖 `emit-runtime-policy-cli.cjs`、`runtime-policy-inject.cjs`（薄壳，`./runtime-policy-inject-core` 优先）。
 * `--agent claude-code`：`syncClaudeRuntimePolicyHooks` 同样将上述 4 个文件复制到 `.claude/hooks` 后再覆盖薄壳与 CLI，与 Cursor 侧分层一致。
 * 外部目标默认**不**创建 package.json、不执行 npm install；若需在消费者目录安装本地 bmad-speckit CLI 依赖，传入 **--with-package-json**。
 * speckit commands 从 _bmad/speckit/commands/ 合并；.specify/ 部署 templates/workflows/scripts。
 *
 * CLI 参数：[targetDir], --full, --agent cursor|claude-code, --no-package-json, --with-package-json
 *
 * 示例：node scripts/init-to-root.js
 *
 * 退出码：0=成功
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const { syncSpecifyMirror } = require(path.join(
  PKG_ROOT,
  '_bmad',
  'speckit',
  'scripts',
  'node',
  'speckit-mirror.js'
));
const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const noPackageJson = args.includes('--no-package-json');
const withPackageJson = args.includes('--with-package-json');
const agentArgIndex = args.findIndex((a) => a === '--agent');
let requestedAgentTarget =
  agentArgIndex >= 0 && args[agentArgIndex + 1] ? args[agentArgIndex + 1] : null;

if (!requestedAgentTarget) {
  try {
    const configPath = path.join(PKG_ROOT, '_bmad-output', 'config', 'bmad-speckit.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      requestedAgentTarget = config.selectedAI || 'cursor';
    }
  } catch {
    /* ignore */
  }
  if (!requestedAgentTarget) requestedAgentTarget = 'cursor';
}
/**
 * Deploy .specify/ runtime directory from _bmad/speckit/ source.
 * @param {string} targetDir - Project root.
 * @returns {number} Number of files deployed.
 */
function deploySpecify(targetDir) {
  const result = syncSpecifyMirror({
    bmadRoot: path.join(targetDir, '_bmad'),
    projectRoot: targetDir,
    logger: console,
  });
  return result.fileCount;
}

function writeCursorHooksJson(targetDir) {
  const cursorDir = path.join(targetDir, '.cursor');
  fs.mkdirSync(cursorDir, { recursive: true });
  const hooksJsonPath = path.join(cursorDir, 'hooks.json');
  const hooksJson = {
    version: 1,
    hooks: {
      sessionStart: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host --session-start' },
        { command: 'node .cursor/hooks/runtime-dashboard-session-start.cjs' },
      ],
      preToolUse: [{ command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host' }],
      subagentStart: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host --subagent-start' },
      ],
      postToolUse: [{ command: 'node .cursor/hooks/post-tool-use.cjs' }],
    },
  };
  fs.writeFileSync(hooksJsonPath, `${JSON.stringify(hooksJson, null, 2)}\n`, 'utf8');
}

const REGISTERED_AGENT_PROFILES = {
  cursor: {
    runtimeRoot: '.cursor',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const cursorSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.cursor/commands' },
        { src: path.join(bmadRoot, 'speckit', 'commands'), dest: '.cursor/commands' },
        { src: path.join(bmadRoot, 'cursor', 'rules'), dest: '.cursor/rules' },
        { src: path.join(bmadRoot, 'skills'), dest: '.cursor/skills' },
        { src: path.join(bmadRoot, 'cursor', 'skills'), dest: '.cursor/skills' },
        { src: path.join(bmadRoot, 'i18n'), dest: '.cursor/i18n' },
      ];
      let totalFiles = 0;
      for (const { src, dest } of cursorSync) {
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(src)) {
          console.log('Sync', path.relative(targetDir, src), '->', dest);
          copyRecursive(src, destPath);
          totalFiles += countFiles(destPath);
        }
      }
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'bmm', 'workflows'), path.join(targetDir, '.cursor', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'bmm', 'agents'), path.join(targetDir, '.cursor', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'core', 'tasks'), path.join(targetDir, '.cursor', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'core', 'skills'), path.join(targetDir, '.cursor', 'skills'), targetDir);
      const crSrc = path.join(targetDir, '_bmad', '_config', 'code-reviewer-config.yaml');
      const crDest = path.join(targetDir, '.cursor', 'agents', 'code-reviewer-config.yaml');
      if (fs.existsSync(crSrc)) {
        fs.mkdirSync(path.dirname(crDest), { recursive: true });
        fs.copyFileSync(crSrc, crDest);
        console.log('Sync _bmad/_config/code-reviewer-config.yaml -> .cursor/agents/');
        totalFiles += 1;
      }
      const cursorAgentsSrc = path.join(bmadRoot, 'cursor', 'agents');
      if (fs.existsSync(cursorAgentsSrc)) {
        const cursorAgentsDest = path.join(targetDir, '.cursor', 'agents');
        copyRecursive(cursorAgentsSrc, cursorAgentsDest);
        totalFiles += countFiles(cursorAgentsDest);
        console.log('Sync _bmad/cursor/agents/ -> .cursor/agents/');
      }
      totalFiles += deploySpecify(targetDir);
      syncCursorRuntimePolicyHooks(targetDir, bmadRoot);
      return totalFiles;
    },
  },
  'claude-code': {
    runtimeRoot: '.claude',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const claudeSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.claude/commands' },
        { src: path.join(bmadRoot, 'speckit', 'commands'), dest: '.claude/commands' },
        { src: path.join(bmadRoot, 'claude', 'rules'), dest: '.claude/rules' },
        { src: path.join(bmadRoot, 'claude', 'agents'), dest: '.claude/agents' },
        { src: path.join(bmadRoot, 'skills'), dest: '.claude/skills' },
        { src: path.join(bmadRoot, 'claude', 'skills'), dest: '.claude/skills' },
        { src: path.join(bmadRoot, 'i18n'), dest: '.claude/i18n' },
        { src: path.join(bmadRoot, 'claude', 'state'), dest: '.claude/state' },
        { src: path.join(bmadRoot, 'claude', 'hooks'), dest: '.claude/hooks' },
        { src: path.join(bmadRoot, 'claude', 'protocols'), dest: '.claude/protocols' },
      ];
      let totalFiles = 0;
      for (const { src, dest } of claudeSync) {
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(src)) {
          console.log('Sync', path.relative(targetDir, src), '->', dest);
          copyRecursive(src, destPath);
          totalFiles += countFiles(destPath);
        } else {
          fs.mkdirSync(destPath, { recursive: true });
        }
      }
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'bmm', 'workflows'), path.join(targetDir, '.claude', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'bmm', 'agents'), path.join(targetDir, '.claude', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'core', 'tasks'), path.join(targetDir, '.claude', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'core', 'skills'), path.join(targetDir, '.claude', 'skills'), targetDir);
      const settingsSrc = path.join(bmadRoot, 'claude', 'settings.json');
      const settingsDest = path.join(targetDir, '.claude', 'settings.json');
      if (fs.existsSync(settingsSrc)) {
        fs.mkdirSync(path.dirname(settingsDest), { recursive: true });
        // Merge with global settings.json hooks (preserve user's global hooks like Stop notification)
        const bmadSettings = JSON.parse(fs.readFileSync(settingsSrc, 'utf8'));
        const globalSettingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        let mergedSettings = bmadSettings;
        if (fs.existsSync(globalSettingsPath)) {
          try {
            const globalSettings = JSON.parse(fs.readFileSync(globalSettingsPath, 'utf8'));
            if (globalSettings.hooks) {
              // Deep merge: BMAD settings as base, append global hooks that don't conflict
              mergedSettings = deepMergeSettings(bmadSettings, globalSettings);
              console.log('Merged global ~/.claude/settings.json hooks into project settings');
            }
          } catch (e) {
            console.warn('Failed to read global settings, using BMAD defaults:', e.message);
          }
        }
        fs.writeFileSync(settingsDest, JSON.stringify(mergedSettings, null, 2) + '\n', 'utf8');
        console.log('Sync _bmad/claude/settings.json -> .claude/settings.json');
        totalFiles += 1;
      }
      const templateSrc = path.join(bmadRoot, 'claude', 'CLAUDE.md.template');
      const claudeMdDest = path.join(targetDir, 'CLAUDE.md');
      if (fs.existsSync(templateSrc) && !fs.existsSync(claudeMdDest)) {
        let content = fs.readFileSync(templateSrc, 'utf8');
        content = content.replace(/\{\{PROJECT_NAME\}\}/g, path.basename(targetDir));
        fs.writeFileSync(claudeMdDest, content, 'utf8');
        console.log('Generated CLAUDE.md from template');
        totalFiles += 1;
      }
      totalFiles += deploySpecify(targetDir);
      syncClaudeRuntimePolicyHooks(targetDir, bmadRoot);
      return totalFiles;
    },
  },
};
const AGENT_ID_ALIASES = {
  'cursor-agent': 'cursor',
  claude: 'claude-code',
};
const normalizedAgent = AGENT_ID_ALIASES[requestedAgentTarget] || requestedAgentTarget;
const agentProfile = REGISTERED_AGENT_PROFILES[normalizedAgent];
if (!agentProfile) {
  const validKeys = [...Object.keys(REGISTERED_AGENT_PROFILES), ...Object.keys(AGENT_ID_ALIASES)];
  console.error(
    `Unsupported --agent value: ${requestedAgentTarget}. Valid: ${validKeys.join(', ')}`
  );
  process.exit(1);
}
const agentTarget = normalizedAgent;
const targetArg = args.find(
  (a, index) =>
    a !== '--full' &&
    a !== '--no-package-json' &&
    a !== '--with-package-json' &&
    a !== '--agent' &&
    index !== agentArgIndex + 1
);
// When run as postinstall (npm install in consumer), INIT_CWD = consumer root; use it as target.
const TARGET = targetArg
  ? path.resolve(targetArg)
  : (process.env.INIT_CWD && path.resolve(process.env.INIT_CWD)) || process.cwd();

/**
 * Deep merge BMAD settings with global settings, preserving global hooks.
 * BMAD settings take precedence, but global hooks (like Stop notification) are appended.
 * @param {object} bmadSettings - BMAD settings from _bmad/claude/settings.json
 * @param {object} globalSettings - Global settings from ~/.claude/settings.json
 * @returns {object} Merged settings
 */
function deepMergeSettings(bmadSettings, globalSettings) {
  const merged = JSON.parse(JSON.stringify(bmadSettings));

  // Merge hooks: BMAD hooks first, then append global hooks that don't conflict
  if (globalSettings.hooks) {
    merged.hooks = merged.hooks || {};
    for (const [hookName, globalHookValue] of Object.entries(globalSettings.hooks)) {
      if (hookName === 'Stop' && Array.isArray(globalHookValue) && globalHookValue.length > 0) {
        // For Stop hook, append global hooks after BMAD hooks
        merged.hooks.Stop = merged.hooks.Stop || [];
        // Filter out duplicate commands
        const bmadCommands = new Set(merged.hooks.Stop.flatMap(h => h.hooks?.map(hh => hh.command) || []));
        const globalHooksToAdd = globalHookValue.filter(h => {
          const commands = h.hooks?.map(hh => hh.command) || [];
          return !commands.every(cmd => bmadCommands.has(cmd));
        });
        if (globalHooksToAdd.length > 0) {
          merged.hooks.Stop.push(...globalHooksToAdd);
          console.log(`  Appended ${globalHooksToAdd.length} global Stop hook(s)`);
        }
      }
      // Other hooks: BMAD takes precedence, skip global
    }
  }

  // Preserve global env, permissions if not defined in BMAD
  if (globalSettings.env && !merged.env) {
    merged.env = globalSettings.env;
  }
  if (globalSettings.permissions && !merged.permissions) {
    merged.permissions = globalSettings.permissions;
  }

  return merged;
}

const CORE_DIRS = ['_bmad'];
const FULL_DIRS = ['_bmad'];
const DIRS = fullMode ? FULL_DIRS : CORE_DIRS;

/**
 * Deep merge BMAD settings with global settings, preserving global hooks.
 * BMAD settings take precedence, but global hooks (like Stop notification) are appended.
 * @param {object} bmadSettings - BMAD settings from _bmad/claude/settings.json
 * @param {object} globalSettings - Global settings from ~/.claude/settings.json
 * @returns {object} Merged settings
 */
function deepMergeSettings(bmadSettings, globalSettings) {
  const merged = JSON.parse(JSON.stringify(bmadSettings));

  // Merge hooks: BMAD hooks first, then append global hooks that don't conflict
  if (globalSettings.hooks) {
    merged.hooks = merged.hooks || {};
    for (const [hookName, globalHookValue] of Object.entries(globalSettings.hooks)) {
      if (hookName === 'Stop' && Array.isArray(globalHookValue) && globalHookValue.length > 0) {
        // For Stop hook, append global hooks after BMAD hooks
        merged.hooks.Stop = merged.hooks.Stop || [];
        // Filter out duplicate commands
        const bmadCommands = new Set(merged.hooks.Stop.flatMap(h => h.hooks?.map(hh => hh.command) || []));
        const globalHooksToAdd = globalHookValue.filter(h => {
          const commands = h.hooks?.map(hh => hh.command) || [];
          return !commands.every(cmd => bmadCommands.has(cmd));
        });
        if (globalHooksToAdd.length > 0) {
          merged.hooks.Stop.push(...globalHooksToAdd);
          console.log(`  Appended ${globalHooksToAdd.length} global Stop hook(s)`);
        }
      }
      // Other hooks: BMAD takes precedence, skip global
    }
  }

  // Preserve global env, permissions if not defined in BMAD
  if (globalSettings.env && !merged.env) {
    merged.env = globalSettings.env;
  }
  if (globalSettings.permissions && !merged.permissions) {
    merged.permissions = globalSettings.permissions;
  }

  return merged;
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function copySkillDirsRecursive(srcRoot, destRoot, targetDir) {
  if (!fs.existsSync(srcRoot) || !fs.statSync(srcRoot).isDirectory()) return 0;
  let copiedFiles = 0;

  function walk(current) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    const hasSkill = entries.some((entry) => entry.isFile() && entry.name === 'SKILL.md');
    if (hasSkill) {
      const skillName = path.basename(current);
      const destDir = path.join(destRoot, skillName);
      copyRecursive(current, destDir);
      copiedFiles += countFiles(destDir);
      console.log('Sync', path.relative(targetDir, current), '->', path.relative(targetDir, destDir));
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) walk(path.join(current, entry.name));
    }
  }

  walk(srcRoot);
  return copiedFiles;
}

/**
 * Deploy emit + inject hooks for Cursor (same scripts as Claude hooks).
 * @param {string} targetDir
 * @param {string} bmadRoot
 */
function syncCursorRuntimePolicyHooks(targetDir, bmadRoot) {
  const destDir = path.join(targetDir, '.cursor', 'hooks');
  const sharedDir = path.join(bmadRoot, 'runtime', 'hooks');
  const cursorHooksDir = path.join(bmadRoot, 'cursor', 'hooks');

  fs.mkdirSync(destDir, { recursive: true });

  if (fs.existsSync(sharedDir)) {
    copyRecursive(sharedDir, destDir);
    console.log('Sync', path.relative(targetDir, sharedDir), '->', path.join('.cursor', 'hooks'));
  }

  const names = ['emit-runtime-policy-cli.cjs', 'runtime-policy-inject.cjs', 'post-tool-use.cjs', 'runtime-dashboard-session-start.cjs'];
  for (const name of names) {
    const src = path.join(cursorHooksDir, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destDir, name));
      console.log('Sync', path.relative(targetDir, src), '->', path.join('.cursor', 'hooks', name));
    } else {
      console.warn(`Skip Cursor hook override (missing): ${path.relative(targetDir, src)}`);
    }
  }
  writeCursorHooksJson(targetDir);
}

/**
 * Deploy shared runtime hook helpers + Claude thin shells into `.claude/hooks` (same layering as Cursor).
 * @param {string} targetDir
 * @param {string} bmadRoot
 */
function syncClaudeRuntimePolicyHooks(targetDir, bmadRoot) {
  const destDir = path.join(targetDir, '.claude', 'hooks');
  const sharedDir = path.join(bmadRoot, 'runtime', 'hooks');
  const claudeHooksDir = path.join(bmadRoot, 'claude', 'hooks');

  fs.mkdirSync(destDir, { recursive: true });

  if (fs.existsSync(sharedDir)) {
    copyRecursive(sharedDir, destDir);
    console.log('Sync', path.relative(targetDir, sharedDir), '->', path.join('.claude', 'hooks'));
  }

  const names = ['emit-runtime-policy-cli.cjs', 'runtime-policy-inject.cjs', 'session-start.cjs'];
  for (const name of names) {
    const src = path.join(claudeHooksDir, name);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destDir, name));
      console.log('Sync', path.relative(targetDir, src), '->', path.join('.claude', 'hooks', name));
    } else {
      console.warn(`Skip Claude hook override (missing): ${path.relative(targetDir, src)}`);
    }
  }
}

function writeDefaultRuntimeRegistry(targetDir, pkgRoot) {
  const candidates = [
    path.join(targetDir, '.cursor', 'hooks', 'write-runtime-registry.js'),
    path.join(targetDir, '.claude', 'hooks', 'write-runtime-registry.js'),
    path.join(targetDir, 'scripts', 'write-runtime-registry.js'),
    path.join(pkgRoot, 'scripts', 'write-runtime-registry.js'),
  ];
  const script = candidates.find((p) => fs.existsSync(p));
  if (!script) {
    console.warn('Skip runtime-registry: write-runtime-registry.js not found');
    return;
  }
  const r = spawnSync(process.execPath, [script, targetDir], {
    cwd: targetDir,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.warn('write-runtime-registry exited', r.status);
  }
}

function writeDefaultRuntimeContext(targetDir, pkgRoot) {
  const candidates = [
    path.join(targetDir, '.cursor', 'hooks', 'write-runtime-context.cjs'),
    path.join(targetDir, '.claude', 'hooks', 'write-runtime-context.cjs'),
    path.join(targetDir, 'scripts', 'write-runtime-context.cjs'),
    path.join(pkgRoot, 'scripts', 'write-runtime-context.cjs'),
  ];
  const script = candidates.find((p) => fs.existsSync(p));
  if (!script) {
    console.warn('Skip runtime-context: write-runtime-context.cjs not found');
    return;
  }
  const targetContext = path.join(targetDir, '_bmad-output', 'runtime', 'context', 'project.json');
  const r = spawnSync(process.execPath, [script, targetContext, 'story', 'story_create'], {
    cwd: targetDir,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.warn('write-runtime-context exited', r.status);
  }
}

/**
 * External installs only receive `_bmad/` by default; hooks need a pre-built emit (no ts-node).
 * Resolve `@bmad-speckit/runtime-emit` from pkgRoot node_modules (bmad-speckit 依赖树)，供复制到 hooks/emit-runtime-policy.cjs。
 * @param {string} pkgRoot - BMAD-Speckit-SDD-Flow root (init script location).
 * @param {string} targetDir - Consumer project root.
 */
function resolveRuntimeEmitCjs(pkgRoot) {
  try {
    return require.resolve('@bmad-speckit/runtime-emit', { paths: [pkgRoot] });
  } catch {
    const devDist = path.join(
      pkgRoot,
      'packages',
      'runtime-emit',
      'dist',
      'emit-runtime-policy.cjs'
    );
    if (fs.existsSync(devDist)) return devDist;
    const legacy = path.join(pkgRoot, 'scripts', 'emit-runtime-policy.bundle.cjs');
    if (fs.existsSync(legacy)) return legacy;
    return null;
  }
}

/**
 * Resolve bundled resolve-for-session.cjs (i18n CLI) from @bmad-speckit/runtime-emit.
 * @param {string} pkgRoot - BMAD-Speckit-SDD-Flow root (init script location).
 * @returns {string | null}
 */
function resolveRuntimeResolveSessionCjs(pkgRoot) {
  try {
    return require.resolve('@bmad-speckit/runtime-emit/dist/resolve-for-session.cjs', {
      paths: [pkgRoot],
    });
  } catch {
    const devDist = path.join(
      pkgRoot,
      'packages',
      'runtime-emit',
      'dist',
      'resolve-for-session.cjs'
    );
    return fs.existsSync(devDist) ? devDist : null;
  }
}

/**
 * Resolve bundled render-audit-block.cjs (i18n audit preview CLI) from @bmad-speckit/runtime-emit.
 * @param {string} pkgRoot - BMAD-Speckit-SDD-Flow root (init script location).
 * @returns {string | null}
 */
function resolveRuntimeRenderAuditBlockCjs(pkgRoot) {
  try {
    return require.resolve('@bmad-speckit/runtime-emit/dist/render-audit-block.cjs', {
      paths: [pkgRoot],
    });
  } catch {
    const devDist = path.join(
      pkgRoot,
      'packages',
      'runtime-emit',
      'dist',
      'render-audit-block.cjs'
    );
    return fs.existsSync(devDist) ? devDist : null;
  }
}

function deployConsumerRuntimeEmitToHooks(pkgRoot, targetDir) {
  let targetReal;
  let pkgRootReal;
  try {
    targetReal = fs.realpathSync(targetDir);
    pkgRootReal = fs.realpathSync(pkgRoot);
  } catch {
    return;
  }
  if (targetReal === pkgRootReal) return;

  const emitSrc = resolveRuntimeEmitCjs(pkgRoot);
  if (!emitSrc || !fs.existsSync(emitSrc)) {
    console.warn(
      '@bmad-speckit/runtime-emit not found; run: npm install && npm run build:runtime-emit — policy hooks may fail in target.'
    );
    return;
  }
  const resolveSessionSrc = resolveRuntimeResolveSessionCjs(pkgRoot);
  if (!resolveSessionSrc || !fs.existsSync(resolveSessionSrc)) {
    console.warn(
      'resolve-for-session.cjs not found; run: npm run build:runtime-emit — runtime-policy-inject i18n merge may fail in target.'
    );
  }
  const renderAuditSrc = resolveRuntimeRenderAuditBlockCjs(pkgRoot);
  if (!renderAuditSrc || !fs.existsSync(renderAuditSrc)) {
    console.warn(
      'render-audit-block.cjs not found; run: npm run build:runtime-emit — pre-agent-summary audit inject may be empty in target.'
    );
  }
  const wrcSrc = path.join(path.dirname(emitSrc), '..', 'write-runtime-context.cjs');
  const hookDirs = [
    path.join(targetDir, '.cursor', 'hooks'),
    path.join(targetDir, '.claude', 'hooks'),
  ];
  let deployed = 0;
  for (const d of hookDirs) {
    if (!fs.existsSync(d)) continue;
    fs.copyFileSync(emitSrc, path.join(d, 'emit-runtime-policy.cjs'));
    if (resolveSessionSrc && fs.existsSync(resolveSessionSrc)) {
      fs.copyFileSync(resolveSessionSrc, path.join(d, 'resolve-for-session.cjs'));
    }
    if (renderAuditSrc && fs.existsSync(renderAuditSrc)) {
      fs.copyFileSync(renderAuditSrc, path.join(d, 'render-audit-block.cjs'));
    }
    if (fs.existsSync(wrcSrc)) {
      fs.copyFileSync(wrcSrc, path.join(d, 'write-runtime-context.cjs'));
    }
    deployed += 1;
  }
  if (deployed === 0) {
    console.warn(
      'No .cursor/hooks or .claude/hooks found after agent sync; emit-runtime-policy.cjs not deployed (re-run init after --agent).'
    );
    return;
  }
  console.log(
    'Deployed emit-runtime-policy.cjs, resolve-for-session.cjs, render-audit-block.cjs (+ write-runtime-context.cjs) under .cursor/hooks and/or .claude/hooks (no project-root scripts/).'
  );
}

/**
 * E15-S2 T5.16: Copy SKILL.zh.md or SKILL.en.md over SKILL.md based on runtime context languagePolicy.
 * @param {string} targetDir
 */
function materializeSkillMdByLanguage(targetDir) {
  const ctxPath = path.join(targetDir, '_bmad-output', 'runtime', 'context', 'project.json');
  let mode = 'en';
  if (fs.existsSync(ctxPath)) {
    try {
      const j = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
      if (j?.languagePolicy?.resolvedMode === 'zh') mode = 'zh';
    } catch {
      /* ignore */
    }
  }
  const skillRoots = [
    path.join(targetDir, '.cursor', 'skills'),
    path.join(targetDir, '.claude', 'skills'),
  ];
  for (const root of skillRoots) {
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root)) {
      const dir = path.join(root, name);
      let stat;
      try {
        stat = fs.statSync(dir);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;
      const zh = path.join(dir, 'SKILL.zh.md');
      const en = path.join(dir, 'SKILL.en.md');
      const primary = path.join(dir, 'SKILL.md');
      if (fs.existsSync(zh) && fs.existsSync(en)) {
        const src = mode === 'zh' ? zh : en;
        fs.copyFileSync(src, primary);
      }
    }
  }
}

function installConsumerMcpLayout(targetDir, pkgRoot) {
  let targetReal;
  let pkgRootReal;
  try {
    targetReal = fs.realpathSync(targetDir);
    pkgRootReal = fs.realpathSync(pkgRoot);
  } catch {
    return;
  }
  if (targetReal === pkgRootReal) return;

  const script = path.join(pkgRoot, 'scripts', 'mcp', 'consumer', 'install-consumer-mcp.ps1');
  if (!fs.existsSync(script)) {
    console.warn('Skip consumer MCP install: script missing', script);
    return;
  }

  const shouldSkipMcpInstall =
    process.env.BMAD_SKIP_CONSUMER_MCP_INSTALL === '1' ||
    process.env.VITEST === 'true' ||
    process.env.NODE_ENV === 'test';
  if (shouldSkipMcpInstall) {
    console.log('Skip consumer MCP install for test/runtime-constrained session.');
    return;
  }

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-TargetDir', targetDir],
    {
      cwd: targetDir,
      stdio: 'inherit',
    }
  );
  if (result.status !== 0) {
    console.warn('install-consumer-mcp exited', result.status);
  }
}

function countFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dirPath)) {
    const p = path.join(dirPath, name);
    let stat;
    try {
      stat = fs.statSync(p);
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
    n += stat.isDirectory() ? countFiles(p) : 1;
  }
  return n;
}

console.log(
  'BMAD-Speckit-SDD-Flow init: deploy to',
  TARGET,
  fullMode ? '(full mode)' : '',
  `[agent=${agentTarget}]`
);
let totalFiles = 0;
for (const dir of DIRS) {
  const src = path.join(PKG_ROOT, dir);
  const dest = path.join(TARGET, dir);
  if (!fs.existsSync(src)) {
    console.warn('Skip (missing):', dir);
    continue;
  }
  console.log('Copy', dir, '->', dest);
  if (fs.existsSync(dest)) {
    console.warn('Target exists, merging:', dest);
  }
  copyRecursive(src, dest);
  totalFiles += countFiles(dest);
}

totalFiles += agentProfile.sync(TARGET, PKG_ROOT);

deployConsumerRuntimeEmitToHooks(PKG_ROOT, TARGET);
installConsumerMcpLayout(TARGET, PKG_ROOT);

writeDefaultRuntimeRegistry(TARGET, PKG_ROOT);
writeDefaultRuntimeContext(TARGET, PKG_ROOT);
materializeSkillMdByLanguage(TARGET);

// Ensure _bmad-output/config exists (empty); never copy source's _bmad-output contents.
const bmadOutputDir = path.join(TARGET, '_bmad-output');
const bmadOutputConfig = path.join(bmadOutputDir, 'config');
if (!fs.existsSync(bmadOutputConfig)) {
  fs.mkdirSync(bmadOutputConfig, { recursive: true });
  console.log('Created _bmad-output/config/ (empty structure for target project)');
}

// Speckit 规格根目录（与 docs/tutorials/getting-started.md、设计文档 §4.10 一致；具体 epic 由 /speckit.specify 等写入）
fs.mkdirSync(path.join(TARGET, 'specs'), { recursive: true });

// 外部项目：默认不创建 package.json（npx bmad-speckit 可不依赖本地 package.json）。
// --with-package-json：写入 devDependencies + npm install（旧行为）。
// --no-package-json：显式跳过（与默认等价，保留兼容）。
const targetReal = fs.realpathSync(TARGET, { encoding: 'utf8' });
const pkgRootReal = fs.realpathSync(PKG_ROOT, { encoding: 'utf8' });
if (noPackageJson || !withPackageJson) {
  if (targetReal !== pkgRootReal) {
    console.log(
      'Skipped package.json / npm install (pass --with-package-json for local bmad-speckit devDependency in target).'
    );
  }
} else if (targetReal !== pkgRootReal) {
  const relToPkg = path.relative(TARGET, path.join(PKG_ROOT, 'packages', 'bmad-speckit'));
  const bmadSpeckitDep = 'file:' + relToPkg.replace(/\\/g, '/');
  const pkgPath = path.join(TARGET, 'package.json');
  let pkg = {};
  if (fs.existsSync(pkgPath)) {
    let raw = fs.readFileSync(pkgPath, 'utf8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1); // strip BOM
    pkg = JSON.parse(raw);
  } else {
    pkg = {
      name: path.basename(TARGET).toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      description: 'BMAD-Speckit project',
    };
    console.log('Created package.json (minimal)');
  }
  pkg.devDependencies = pkg.devDependencies || {};
  if (!pkg.devDependencies['bmad-speckit']) {
    pkg.devDependencies['bmad-speckit'] = bmadSpeckitDep;
    pkg.scripts = pkg.scripts || {};
    if (!pkg.scripts.check) pkg.scripts.check = 'npx bmad-speckit check';
    if (!pkg.scripts.speckit) pkg.scripts.speckit = 'npx bmad-speckit';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('Added bmad-speckit to devDependencies');
    const { execSync } = require('node:child_process');
    try {
      execSync('npm install', { cwd: TARGET, stdio: 'inherit' });
      console.log('Ran npm install');
    } catch (e) {
      console.warn('npm install failed (run manually in target):', e.message);
    }
  }
}

console.log('Done. Copied', DIRS.length, 'dirs,', totalFiles, 'files.');
console.log('Verify with: _bmad/speckit/scripts/powershell/check-prerequisites.ps1');
