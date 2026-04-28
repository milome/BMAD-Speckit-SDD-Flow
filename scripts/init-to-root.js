#!/usr/bin/env node
/**
 * Init-to-root: 灏?_bmad銆乢bmad-output 閮ㄧ讲鍒伴」鐩牴锛屽啀鎸?agent 浠?_bmad/ 鍚屾鍒拌繍琛屾椂鐩綍銆? *
 * 婧愯矾寰勭害瀹氾細_bmad/ 鏄敮涓€鍐呭婧愩€? *   - 鍏变韩 commands: _bmad/commands/
 *   - 鍏变韩 i18n: _bmad/i18n/
 *   - Cursor rules/skills: _bmad/cursor/
 *   - Claude agents/skills/hooks/rules: _bmad/claude/
 *
 * 鐢ㄩ€旓細閮ㄧ讲 BMAD 鐩綍缁撴瀯銆? * 瀵瑰閮ㄧ洰鏍囩洰褰曪細浠?@bmad-speckit/runtime-emit 灏?emit-runtime-policy.cjs銆乺esolve-for-session.cjs銆乺ender-audit-block.cjs 涓?write-runtime-context.cjs 澶嶅埗鍒?**.cursor/hooks** 涓?鎴?**.claude/hooks**锛堜笌 hook 鑴氭湰鍚岀洰褰曪紝涓嶅湪椤圭洰鏍瑰垱寤?scripts/锛夛紱legacy worker/dispatch hook-local bundle 涓嶅啀灞炰簬姝ｅ紡瀹夎 contract銆? * `--agent cursor`锛歚syncCursorRuntimePolicyHooks` 鍏堝皢 `_bmad/runtime/hooks` 涓?4 涓叡浜?JS 澶嶅埗鍒?`.cursor/hooks`锛屽啀瑕嗙洊 `emit-runtime-policy-cli.cjs`銆乣runtime-policy-inject.cjs`锛堣杽澹筹紝`./runtime-policy-inject-core` 浼樺厛锛夈€? * `--agent claude-code`锛歚syncClaudeRuntimePolicyHooks` 鍚屾牱灏嗕笂杩?4 涓枃浠跺鍒跺埌 `.claude/hooks` 鍚庡啀瑕嗙洊钖勫３涓?CLI锛屼笌 Cursor 渚у垎灞備竴鑷淬€? * 澶栭儴鐩爣榛樿**涓?*鍒涘缓 package.json銆佷笉鎵ц npm install锛涜嫢闇€鍦ㄦ秷璐硅€呯洰褰曞畨瑁呮湰鍦?bmad-speckit CLI 渚濊禆锛屼紶鍏?**--with-package-json**銆? * 澶栭儴鐩爣榛樿**涓?*鐢熸垚 runtime MCP 甯冨眬锛涘闇€鍚敤锛屾樉寮忎紶鍏?**--with-mcp**銆? * speckit commands 浠?_bmad/speckit/commands/ 鍚堝苟锛?specify/ 閮ㄧ讲 templates/workflows/scripts銆? *
 * CLI 鍙傛暟锛歔targetDir], --full, --agent cursor|claude-code|codex, --no-package-json, --with-package-json, --with-mcp
 *
 * 绀轰緥锛歯ode scripts/init-to-root.js
 *
 * 閫€鍑虹爜锛?=鎴愬姛
 */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const PKG_ROOT = path.resolve(__dirname, '..');
const ROOT_PACKAGE_JSON = require(path.join(PKG_ROOT, 'package.json'));
const { syncSpecifyMirror } = require(path.join(
  PKG_ROOT,
  '_bmad',
  'speckit',
  'scripts',
  'node',
  'speckit-mirror.js'
));

function resolveInstallSurfaceManifestTools() {
  const candidates = [
    path.join(PKG_ROOT, 'packages', 'bmad-speckit', 'src', 'services', 'install-surface-manifest.js'),
    path.join(PKG_ROOT, 'node_modules', 'bmad-speckit', 'src', 'services', 'install-surface-manifest.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }
  return null;
}
const args = process.argv.slice(2);
const fullMode = args.includes('--full');
const noPackageJson = args.includes('--no-package-json');
const withPackageJson = args.includes('--with-package-json');
const withMcp = args.includes('--with-mcp');
const agentArgIndex = args.findIndex((a) => a === '--agent');
let requestedAgentTarget =
  agentArgIndex >= 0 && args[agentArgIndex + 1] ? args[agentArgIndex + 1] : null;

if (!requestedAgentTarget) {
  requestedAgentTarget = 'cursor';
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
      preToolUse: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host' },
        { command: 'node .cursor/hooks/pre-continue-check.cjs' },
      ],
      subagentStart: [
        { command: 'node .cursor/hooks/runtime-policy-inject.cjs --cursor-host --subagent-start' },
      ],
      subagentStop: [{ command: 'node .cursor/hooks/subagent-result-summary.cjs' }],
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
      const cursorSkillOverridesSrc = path.join(bmadRoot, 'cursor', 'skills');
      if (fs.existsSync(cursorSkillOverridesSrc)) {
        console.log('Re-apply Cursor skill overrides', path.relative(targetDir, cursorSkillOverridesSrc), '-> .cursor/skills');
        copyRecursive(cursorSkillOverridesSrc, path.join(targetDir, '.cursor', 'skills'));
        totalFiles += countFiles(path.join(targetDir, '.cursor', 'skills'));
      }
      const crSrc = path.join(targetDir, '_bmad', '_config', 'code-reviewer-config.yaml');
      const crDest = path.join(targetDir, '.cursor', 'agents', 'code-reviewer-config.yaml');
      if (fs.existsSync(crSrc)) {
        fs.mkdirSync(path.dirname(crDest), { recursive: true });
        copyFileWithRetry(crSrc, crDest);
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
        const bmadSettings = normalizeClaudeHookCommandRefs(
          JSON.parse(fs.readFileSync(settingsSrc, 'utf8'))
        );
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
  codex: {
    runtimeRoot: '.codex',
    sync(targetDir) {
      const bmadRoot = path.join(targetDir, '_bmad');
      const codexSync = [
        { src: path.join(bmadRoot, 'commands'), dest: '.codex/commands' },
        { src: path.join(bmadRoot, 'speckit', 'commands'), dest: '.codex/commands' },
        { src: path.join(bmadRoot, 'skills'), dest: '.codex/skills' },
        { src: path.join(bmadRoot, 'core', 'skills'), dest: '.codex/skills' },
        { src: path.join(bmadRoot, 'i18n'), dest: '.codex/i18n' },
        { src: path.join(bmadRoot, 'codex', 'agents'), dest: '.codex/agents' },
        { src: path.join(bmadRoot, 'codex', 'protocols'), dest: '.codex/protocols' },
        { src: path.join(bmadRoot, 'codex', 'skills'), dest: '.codex/skills' },
      ];
      let totalFiles = 0;
      for (const { src, dest } of codexSync) {
        const destPath = path.join(targetDir, dest);
        if (fs.existsSync(src)) {
          console.log('Sync', path.relative(targetDir, src), '->', dest);
          copyRecursive(src, destPath);
          totalFiles += countFiles(destPath);
        }
      }
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'bmm', 'workflows'), path.join(targetDir, '.codex', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'bmm', 'agents'), path.join(targetDir, '.codex', 'skills'), targetDir);
      totalFiles += copySkillDirsRecursive(path.join(bmadRoot, 'core', 'tasks'), path.join(targetDir, '.codex', 'skills'), targetDir);
      totalFiles += deploySpecify(targetDir);
      const codexReadme = path.join(targetDir, '.codex', 'README.md');
      fs.mkdirSync(path.dirname(codexReadme), { recursive: true });
      fs.writeFileSync(
        codexReadme,
        [
          '# BMAD-Speckit Codex Runtime',
          '',
          'Codex uses the no-hooks path. Run main-agent orchestration through CLI surfaces such as:',
          '',
          '- `npm run main-agent-orchestration -- --action inspect`',
          '- `npm run main-agent-orchestration -- --action dispatch-plan`',
          '- `npm run main-agent:run-loop -- --taskReportPath <path>`',
          '',
          'Custom Codex agents are installed under `.codex/agents/`.',
          'Codex protocols are installed under `.codex/protocols/` and required by reviewer/auditor/closeout agents.',
          'BMAD dispatch packets resolve `role` to these TOML agents and fail closed if a role is missing.',
          'Five-layer entry: `bmad-help` -> `layer_1_intake` -> `layer_2_architecture` -> `layer_3_story` -> `layer_4_speckit` -> `layer_5_closeout`.',
          'Governed runtime entry: `$bmad-speckit`, `/bmad-speckit`, or `bmad-speckit`; short aliases `$bmads`, `/bmads`, and `bmads` are equivalent.',
          '',
        ].join('\n'),
        'utf8'
      );
      totalFiles += 1;
      return totalFiles;
    },
  },
};
const AGENT_ID_ALIASES = {
  'cursor-agent': 'cursor',
  claude: 'claude-code',
};
const AGENT_TO_SELECTED_AI = {
  cursor: 'cursor-agent',
  'claude-code': 'claude',
  codex: 'codex',
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
    a !== '--with-mcp' &&
    a !== '--agent' &&
    index !== agentArgIndex + 1
);
// When run as postinstall (npm install in consumer), INIT_CWD = consumer root; use it as target.
const TARGET = targetArg
  ? path.resolve(targetArg)
  : (process.env.INIT_CWD && path.resolve(process.env.INIT_CWD)) || process.cwd();
const installSurfaceManifestTools = resolveInstallSurfaceManifestTools();
const installTracker =
  installSurfaceManifestTools &&
  typeof installSurfaceManifestTools.createInstallStateTracker === 'function' &&
  typeof installSurfaceManifestTools.collectManagedSurfaceSpecs === 'function'
    ? installSurfaceManifestTools.createInstallStateTracker({
        projectRoot: TARGET,
        packageName: ROOT_PACKAGE_JSON.name,
        packageVersion: ROOT_PACKAGE_JSON.version,
        installedVia:
          process.env.npm_lifecycle_event === 'postinstall' || process.env.INIT_CWD
            ? 'postinstall'
            : 'bmad-speckit-init',
        installedTools: [agentTarget],
      })
    : null;
const removeUnexpectedLegacyConsumerHookFiles =
  installSurfaceManifestTools &&
  typeof installSurfaceManifestTools.removeUnexpectedLegacyConsumerHookFiles === 'function'
    ? installSurfaceManifestTools.removeUnexpectedLegacyConsumerHookFiles
    : null;

if (installTracker) {
  installTracker.registerProjectSpecs(
    installSurfaceManifestTools.collectManagedSurfaceSpecs(
      TARGET,
      path.join(PKG_ROOT, '_bmad'),
      [agentTarget]
    )
  );
}

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

function normalizeClaudeHookCommandRefs(settings) {
  const normalized = JSON.parse(JSON.stringify(settings || {}));
  if (!normalized.hooks || typeof normalized.hooks !== 'object') {
    return normalized;
  }
  for (const hookEntries of Object.values(normalized.hooks)) {
    if (!Array.isArray(hookEntries)) continue;
    for (const entry of hookEntries) {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.hooks)) continue;
      for (const hook of entry.hooks) {
        if (!hook || typeof hook !== 'object' || typeof hook.command !== 'string') continue;
        hook.command = hook.command.replace('runtime-policy-inject.js', 'runtime-policy-inject.cjs');
      }
    }
  }
  return normalized;
}

const CORE_DIRS = ['_bmad'];
const FULL_DIRS = ['_bmad'];
const DIRS = fullMode ? FULL_DIRS : CORE_DIRS;
const DEPRECATED_TARGET_FILES = [
  '_bmad/claude/rules/bmad-bug-auto-party-mode.md',
  '_bmad/cursor/rules/bmad-bug-auto-party-mode.mdc',
  '.claude/rules/bmad-bug-auto-party-mode.md',
  '.cursor/rules/bmad-bug-auto-party-mode.mdc',
];
const CRITICAL_RUNTIME_HOOK_FILES = ['party-mode-read-current-session.cjs'];

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function isRetryableCopyError(error) {
  return error && (error.code === 'EPERM' || error.code === 'EBUSY' || error.code === 'ENOENT');
}

function copyFileWithRetry(src, dest, maxAttempts = 20) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (error) {
      if (isRetryableCopyError(error) && attempt < maxAttempts - 1) {
        const delay = Math.min(50 * Math.pow(1.5, attempt), error.code === 'ENOENT' ? 250 : 1000);
        sleepMs(delay);
        continue;
      }
      throw error;
    }
  }
}

function normalizeCodexSkillFrontmatterFile(filePath) {
  const portablePath = filePath.replace(/\\/g, '/');
  if (!portablePath.includes('/.codex/skills/') && !portablePath.startsWith('.codex/skills/')) return;
  if (path.basename(filePath) !== 'SKILL.md') return;
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/u, '');
  const withoutPolicy = raw.replace(/^<!--\s*BLOCK_LABEL_POLICY=[^>]*-->\s*\r?\n?/u, '');
  const skillName = path.basename(path.dirname(filePath));
  let frontmatter = '';
  let body = withoutPolicy;
  const lines = withoutPolicy.split(/\r?\n/u);
  if (lines[0] === '---') {
    const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
    if (endIndex > 0) {
      frontmatter = lines.slice(1, endIndex).join('\n');
      body = lines.slice(endIndex + 1).join('\n').replace(/^\s*\r?\n/u, '');
    }
  }
  const name =
    frontmatter.match(/^name:\s*['"]?([^'"\r\n]+)['"]?\s*$/mu)?.[1]?.trim() || skillName;
  const blockDescriptionMatch = frontmatter.match(/^description:\s*\|\s*\n((?:[ \t]+.*\n?)*)/mu);
  const inlineDescriptionMatch = frontmatter.match(/^description:\s*(.+)$/mu);
  const rawDescription = blockDescriptionMatch
    ? blockDescriptionMatch[1]
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter(Boolean)
        .join(' ')
    : inlineDescriptionMatch?.[1]?.replace(/^['"]|['"]$/gu, '').trim();
  const description = (rawDescription || `BMAD Codex skill ${name}.`)
    .replace(/\s+/gu, ' ')
    .slice(0, 500);
  const normalized = [
    '---',
    `name: ${JSON.stringify(name)}`,
    `description: ${JSON.stringify(description)}`,
    '---',
    '',
    body,
  ].join('\n');
  if (normalized !== raw) {
    fs.writeFileSync(filePath, normalized, 'utf8');
  }
}

function statPathWithRetry(targetPath, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return fs.statSync(targetPath);
    } catch (error) {
      if (isRetryableCopyError(error) && attempt < maxAttempts - 1) {
        const delay = Math.min(50 * Math.pow(1.5, attempt), error.code === 'ENOENT' ? 250 : 1000);
        sleepMs(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Unable to stat path after retries: ${targetPath}`);
}

function readDirWithRetry(targetPath, maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return fs.readdirSync(targetPath);
    } catch (error) {
      if (isRetryableCopyError(error) && attempt < maxAttempts - 1) {
        const delay = Math.min(50 * Math.pow(1.5, attempt), error.code === 'ENOENT' ? 250 : 1000);
        sleepMs(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error(`Unable to read dir after retries: ${targetPath}`);
}

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
  const stat = statPathWithRetry(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const name of readDirWithRetry(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    copyFileWithRetry(src, dest);
    normalizeCodexSkillFrontmatterFile(dest);
  }
}

function ensureCriticalRuntimeHookCopies(sourceHooksDir, destHooksDir, logPrefix) {
  if (!fs.existsSync(sourceHooksDir) || !fs.existsSync(destHooksDir)) return;
  for (const fileName of CRITICAL_RUNTIME_HOOK_FILES) {
    const src = path.join(sourceHooksDir, fileName);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(destHooksDir, fileName);
    copyFileWithRetry(src, dest);
    console.log(`${logPrefix}${fileName}`);
  }
}

function removeDeprecatedTargetFiles(targetDir) {
  for (const relativePath of DEPRECATED_TARGET_FILES) {
    const fullPath = path.join(targetDir, relativePath);
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath, { force: true });
      console.log('Remove deprecated file', relativePath);
    }
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
    ensureCriticalRuntimeHookCopies(sharedDir, destDir, 'Force-sync .cursor/hooks/');
  }

  const names = ['emit-runtime-policy-cli.cjs', 'runtime-policy-inject.cjs', 'post-tool-use.cjs', 'runtime-dashboard-session-start.cjs', 'pre-continue-check.cjs'];
  const extendedNames = [...names, 'subagent-result-summary.cjs'];
  for (const name of extendedNames) {
    const src = path.join(cursorHooksDir, name);
    const runtimeFallback = path.join(bmadRoot, 'runtime', 'hooks', name);
    const source = fs.existsSync(src) ? src : runtimeFallback;
    if (fs.existsSync(source)) {
      copyFileWithRetry(source, path.join(destDir, name));
      console.log('Sync', path.relative(targetDir, source), '->', path.join('.cursor', 'hooks', name));
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

  const names = ['emit-runtime-policy-cli.cjs', 'runtime-policy-inject.cjs', 'session-start.cjs', 'pre-continue-check.cjs'];
  for (const name of names) {
    const src = path.join(claudeHooksDir, name);
    const runtimeFallback = path.join(bmadRoot, 'runtime', 'hooks', name);
    const source = fs.existsSync(src) ? src : runtimeFallback;
    if (fs.existsSync(source)) {
      copyFileWithRetry(source, path.join(destDir, name));
      console.log('Sync', path.relative(targetDir, source), '->', path.join('.claude', 'hooks', name));
    } else {
      console.warn(`Skip Claude hook override (missing): ${path.relative(targetDir, src)}`);
    }
  }
}

function syncArchitectureGateConfig(targetDir, bmadRoot) {
  const src = path.join(bmadRoot, '_config', 'architecture-gates.yaml');
  const dest = path.join(targetDir, '_bmad', '_config', 'architecture-gates.yaml');
  if (!fs.existsSync(src)) return;
  copyFileWithRetry(src, dest);
  console.log('Sync', path.relative(targetDir, src), '->', path.relative(targetDir, dest));

  const routingSrc = path.join(bmadRoot, '_config', 'continue-gate-routing.yaml');
  const routingDest = path.join(targetDir, '_bmad', '_config', 'continue-gate-routing.yaml');
  if (fs.existsSync(routingSrc)) {
    copyFileWithRetry(routingSrc, routingDest);
    console.log('Sync', path.relative(targetDir, routingSrc), '->', path.relative(targetDir, routingDest));
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

function writeConsumerBmadSpeckitBinWrappers(targetDir, pkgRoot) {
  const targetReal = fs.existsSync(targetDir) ? fs.realpathSync(targetDir) : path.resolve(targetDir);
  const pkgReal = fs.existsSync(pkgRoot) ? fs.realpathSync(pkgRoot) : path.resolve(pkgRoot);
  if (targetReal === pkgReal) {
    return;
  }

  const binDir = path.join(targetDir, 'node_modules', '.bin');
  if (!fs.existsSync(binDir)) {
    return;
  }

  const jsRel = path.join(
    '..',
    'bmad-speckit-sdd-flow',
    'node_modules',
    'bmad-speckit',
    'bin',
    'bmad-speckit.js'
  );
  const cmdBody = [
    '@ECHO off',
    'GOTO start',
    ':find_dp0',
    'SET dp0=%~dp0',
    'EXIT /b',
    ':start',
    'SETLOCAL',
    'CALL :find_dp0',
    '',
    'IF EXIST "%dp0%\\node.exe" (',
    '  SET "_prog=%dp0%\\node.exe"',
    ') ELSE (',
    '  SET "_prog=node"',
    '  SET PATHEXT=%PATHEXT:;.JS;=;%',
    ')',
    '',
    `endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & "%_prog%"  "%dp0%\\${jsRel.replace(/\//g, '\\')}" %*`,
    '',
  ].join('\r\n');

  const shBody = [
    '#!/bin/sh',
    "basedir=$(dirname \"$(echo \"$0\" | sed -e 's,\\\\,/,g')\")",
    '',
    'case `uname` in',
    '    *CYGWIN*|*MINGW*|*MSYS*)',
    '        if command -v cygpath > /dev/null 2>&1; then',
    '            basedir=`cygpath -w "$basedir"`',
    '        fi',
    '    ;;',
    'esac',
    '',
    'if [ -x "$basedir/node" ]; then',
    `  exec "$basedir/node" "$basedir/${jsRel.replace(/\\/g, '/')}" "$@"`,
    'else',
    `  exec node "$basedir/${jsRel.replace(/\\/g, '/')}" "$@"`,
    'fi',
    '',
  ].join('\n');

  const ps1Body = [
    '#!/usr/bin/env pwsh',
    '$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent',
    '',
    '$exe = ""',
    'if ($PSVersionTable.PSVersion -lt "6.0" -or $IsWindows) {',
    '  $exe = ".exe"',
    '}',
    'if (Test-Path "$basedir/node$exe") {',
    `  & "$basedir/node$exe"  "$basedir/${jsRel.replace(/\\/g, '/')}" $args`,
    '} else {',
    `  & "node$exe"  "$basedir/${jsRel.replace(/\\/g, '/')}" $args`,
    '}',
    'exit $LASTEXITCODE',
    '',
  ].join('\n');

  fs.writeFileSync(path.join(binDir, 'bmad-speckit.cmd'), cmdBody, 'utf8');
  fs.writeFileSync(path.join(binDir, 'bmad-speckit'), shBody, 'utf8');
  fs.writeFileSync(path.join(binDir, 'bmad-speckit.ps1'), ps1Body, 'utf8');
  try {
    fs.chmodSync(path.join(binDir, 'bmad-speckit'), 0o755);
  } catch {
    // ignore on Windows
  }
  console.log('Repaired consumer node_modules/.bin/bmad-speckit wrappers');
}

/**
 * External installs only receive `_bmad/` by default; hooks need a pre-built emit (no ts-node).
 * Resolve `@bmad-speckit/runtime-emit` from pkgRoot node_modules (bmad-speckit 渚濊禆鏍?锛屼緵澶嶅埗鍒?hooks/emit-runtime-policy.cjs銆? * @param {string} pkgRoot - BMAD-Speckit-SDD-Flow root (init script location).
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
      '@bmad-speckit/runtime-emit not found; run: npm install && npm run build:runtime-emit 鈥?policy hooks may fail in target.'
    );
    return;
  }
  const resolveSessionSrc = resolveRuntimeResolveSessionCjs(pkgRoot);
  if (!resolveSessionSrc || !fs.existsSync(resolveSessionSrc)) {
    console.warn(
      'resolve-for-session.cjs not found; run: npm run build:runtime-emit 鈥?runtime-policy-inject i18n merge may fail in target.'
    );
  }
  const renderAuditSrc = resolveRuntimeRenderAuditBlockCjs(pkgRoot);
  if (!renderAuditSrc || !fs.existsSync(renderAuditSrc)) {
    console.warn(
      'render-audit-block.cjs not found; run: npm run build:runtime-emit 鈥?pre-agent-summary audit inject may be empty in target.'
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
    copyFileWithRetry(emitSrc, path.join(d, 'emit-runtime-policy.cjs'));
    if (resolveSessionSrc && fs.existsSync(resolveSessionSrc)) {
      copyFileWithRetry(resolveSessionSrc, path.join(d, 'resolve-for-session.cjs'));
    }
    if (renderAuditSrc && fs.existsSync(renderAuditSrc)) {
      copyFileWithRetry(renderAuditSrc, path.join(d, 'render-audit-block.cjs'));
    }
    if (removeUnexpectedLegacyConsumerHookFiles) {
      removeUnexpectedLegacyConsumerHookFiles(d);
    }
    if (fs.existsSync(wrcSrc)) {
      copyFileWithRetry(wrcSrc, path.join(d, 'write-runtime-context.cjs'));
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
    'Deployed emit-runtime-policy.cjs, resolve-for-session.cjs, render-audit-block.cjs (+ write-runtime-context.cjs) under .cursor/hooks and/or .claude/hooks; removed legacy worker/dispatch/launcher hook-local bundles from the accepted install surface (no project-root scripts/).'
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
    path.join(targetDir, '.codex', 'skills'),
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
        copyFileWithRetry(src, primary);
        normalizeCodexSkillFrontmatterFile(primary);
      }
    }
  }
}

function installConsumerMcpLayout(targetDir, pkgRoot, options = {}) {
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
    (!options.force && (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test'));
  if (shouldSkipMcpInstall) {
    console.log('Skip consumer MCP install for test/runtime-constrained session.');
    return;
  }

  const shellCandidates =
    process.platform === 'win32' ? ['powershell.exe', 'pwsh'] : ['pwsh', 'powershell'];
  let result = null;
  for (const shell of shellCandidates) {
    result = spawnSync(
      shell,
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-TargetDir', targetDir],
      {
        cwd: targetDir,
        stdio: 'inherit',
      }
    );
    if (result.error?.code === 'ENOENT') {
      result = null;
      continue;
    }
    break;
  }

  if (result == null) {
    console.warn('Skip consumer MCP install: PowerShell runtime not found.');
    return;
  }

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
  if (dir === '_bmad') {
    ensureCriticalRuntimeHookCopies(
      path.join(src, 'runtime', 'hooks'),
      path.join(dest, 'runtime', 'hooks'),
      'Force-sync _bmad/runtime/hooks/'
    );
  }
  totalFiles += countFiles(dest);
}

removeDeprecatedTargetFiles(TARGET);

totalFiles += agentProfile.sync(TARGET, PKG_ROOT);

deployConsumerRuntimeEmitToHooks(PKG_ROOT, TARGET);
if (withMcp) {
  installConsumerMcpLayout(TARGET, PKG_ROOT, { force: true });
} else if (fs.realpathSync(TARGET, { encoding: 'utf8' }) !== fs.realpathSync(PKG_ROOT, { encoding: 'utf8' })) {
  console.log('Skipped runtime MCP layout (pass --with-mcp to enable consumer MCP files).');
}
syncArchitectureGateConfig(TARGET, path.join(TARGET, '_bmad'));

writeDefaultRuntimeRegistry(TARGET, PKG_ROOT);
writeDefaultRuntimeContext(TARGET, PKG_ROOT);
writeConsumerBmadSpeckitBinWrappers(TARGET, PKG_ROOT);
materializeSkillMdByLanguage(TARGET);

// Ensure _bmad-output/config exists (empty); never copy source's _bmad-output contents.
const bmadOutputDir = path.join(TARGET, '_bmad-output');
const bmadOutputConfig = path.join(bmadOutputDir, 'config');
if (!fs.existsSync(bmadOutputConfig)) {
  fs.mkdirSync(bmadOutputConfig, { recursive: true });
  console.log('Created _bmad-output/config/ (empty structure for target project)');
}

if (installTracker) {
  installTracker.finalize();
  console.log(
    'Wrote install surface manifest + install-state snapshot metadata to _bmad-output/config/.'
  );
}

function writeProjectSelectedAI(targetDir, selectedAgent, packageRoot) {
  const selectedAI = AGENT_TO_SELECTED_AI[selectedAgent];
  if (!selectedAI) return;
  const configPath = path.join(targetDir, '_bmad-output', 'config', 'bmad-speckit.json');
  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      existing = {};
    }
  }
  const selectedAIs = Array.from(
    new Set([...(Array.isArray(existing.selectedAIs) ? existing.selectedAIs : []), selectedAI])
  );
  const packageJsonPath = path.join(packageRoot, 'package.json');
  let templateVersion = existing.templateVersion || 'latest';
  if (fs.existsSync(packageJsonPath)) {
    try {
      templateVersion = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version || templateVersion;
    } catch {
      /* keep existing */
    }
  }
  const next = {
    ...existing,
    selectedAI,
    selectedAIs,
    templateVersion,
    initLog: {
      ...(existing.initLog || {}),
      timestamp: new Date().toISOString(),
      selectedAI,
      selectedAIs,
      templateVersion,
      installedVia:
        process.env.npm_lifecycle_event === 'postinstall' || process.env.INIT_CWD
          ? 'postinstall'
          : 'bmad-speckit-init',
    },
  };
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(next, null, 2) + '\n', 'utf8');
}

writeProjectSelectedAI(TARGET, agentTarget, PKG_ROOT);

// Speckit 瑙勬牸鏍圭洰褰曪紙涓?docs/tutorials/getting-started.md銆佽璁℃枃妗?搂4.10 涓€鑷达紱鍏蜂綋 epic 鐢?/speckit.specify 绛夊啓鍏ワ級
fs.mkdirSync(path.join(TARGET, 'specs'), { recursive: true });

// 澶栭儴椤圭洰锛氶粯璁や笉鍒涘缓 package.json锛坣px bmad-speckit 鍙笉渚濊禆鏈湴 package.json锛夈€?// --with-package-json锛氬啓鍏?devDependencies + npm install锛堟棫琛屼负锛夈€?// --no-package-json锛氭樉寮忚烦杩囷紙涓庨粯璁ょ瓑浠凤紝淇濈暀鍏煎锛夈€?const targetReal = fs.realpathSync(TARGET, { encoding: 'utf8' });
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
