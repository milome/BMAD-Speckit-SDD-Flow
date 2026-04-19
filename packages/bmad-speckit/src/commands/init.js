/**
 * InitCommand - init subcommand handler (ARCH §3.2)
 * T007-T012: 参数解析、路径解析、非空校验、Banner、AIRegistry
 *
 * Story 12.4 Post-init 引导：init 成功完成（骨架、git init、SyncService、SkillPublisher 全部成功后）
 * 在进程退出前输出 POST_INIT_GUIDE_MSG 到 stdout；init 失败（catch 块）时不输出引导。
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk').default ?? require('chalk');
const _boxen = require('boxen');
const pathUtils = require('../utils/path');
const ttyUtils = require('../utils/tty');
const { resolveNetworkTimeoutMs: resolveNetworkTimeoutMsUtil } = require('../utils/network-timeout');
const exitCodes = require('../constants/exit-codes');
const AIRegistry = require('../services/ai-registry');
const { validateBmadStructure } = require('../utils/structure-validate');
const {
  createInstallStateTracker,
  collectManagedGlobalSkillSpecs,
  collectManagedSurfaceSpecs,
} = require('../services/install-surface-manifest');
const { getFeedbackHintText } = require('./feedback');
const { postInitGuideMsg } = require('../messages/cli');

/**
 * Check if directory is non-empty (FR-019): has _bmad, _bmad-output, or other files/subdirs.
 * @param {string} dirPath - Absolute or relative path to directory.
 * @returns {boolean} True if directory exists, is a directory, and contains _bmad, _bmad-output, or any files/subdirs.
 */
function isDirectoryNonEmpty(dirPath) {
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return false;
  }
  const entries = fs.readdirSync(dirPath);
  if (entries.length === 0) return false;
  if (entries.includes('_bmad') || entries.includes('_bmad-output')) return true;
  return entries.length > 0;
}

/**
 * Story 11.1: Resolve network timeout ms; delegates to utils/network-timeout.
 * @param {Object} [options={}] - Options (cwd, env, config overrides).
 * @returns {number} Network timeout in milliseconds.
 */
function resolveNetworkTimeoutMs(options = {}) {
  return resolveNetworkTimeoutMsUtil({ ...options, cwd: process.cwd() });
}

/**
 * Story 11.1: Resolve template source: env > project config > global config > default.
 * @param {string} [cwd=process.cwd()] - Working directory for config lookup.
 * @returns {string} Template repo (e.g. 'bmad-method/bmad-method').
 */
function resolveTemplateSource(cwd = process.cwd()) {
  if (process.env.SDD_TEMPLATE_REPO != null && process.env.SDD_TEMPLATE_REPO !== '') {
    return process.env.SDD_TEMPLATE_REPO;
  }
  try {
    const configManager = require('../services/config-manager');
    const project = configManager?.get?.('templateSource', { cwd });
    if (project != null && typeof project === 'string') return project;
    const global = configManager?.get?.('templateSource', {});
    if (global != null && typeof global === 'string') return global;
  } catch {
    // ignore
  }
  return 'bmad-method/bmad-method';
}

/**
 * Check if path is writable (GAP-8.1).
 * @param {string} dirPath - Directory path to test (creates temp file then removes).
 * @returns {boolean} True if write and unlink succeed.
 */
function isPathWritable(dirPath) {
  try {
    const testFile = path.join(dirPath, '.bmad-speckit-write-test');
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

/**
 * Init command handler: initialize a new bmad-speckit project.
 * @param {string} [projectName] - Project name or path (e.g. '.', 'my-app').
 * @param {Object} [options={}] - Commander options: here, ai, aiCommandsDir, yes, template, networkTimeout, modules, force, noGit, script, bmadPath, aiSkills, debug, githubToken, skipTls, offline.
 * @returns {Promise<void>} Resolves when init completes; exits process on error.
 */
async function initCommand(projectName, options = {}) {
  const cwd = process.cwd();
  const debug = options.debug || false;

  const log = (msg) => {
    if (debug) console.error('[bmad-speckit:debug]', msg);
  };

  // T008: Resolve target path
  let targetPath;
  if (options.here) {
    targetPath = pathUtils.resolveTargetPath('.', cwd);
  } else if (!projectName || projectName === '.') {
    targetPath = pathUtils.resolveTargetPath('.', cwd);
  } else {
    targetPath = pathUtils.resolveTargetPath(projectName, cwd);
  }
  log(`targetPath=${targetPath}`);

  // T010: Check writability (before creating dir - if parent exists, check parent; else we'll create)
  const parentDir = path.dirname(targetPath);
  if (fs.existsSync(parentDir) && !isPathWritable(parentDir)) {
    console.error(`Error: Target path is not writable: ${targetPath}`);
    console.error('Please use --force to overwrite or choose another path.');
    process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
  }

  // T009: Non-empty directory check
  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    if (isDirectoryNonEmpty(targetPath) && !options.force) {
      console.error(`Error: Target path already exists and is not empty: ${targetPath}`);
      console.error('Use --force to overwrite or choose another path.');
      process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
    }
  }

  // T007: Parsed options available - modules, force, noGit, debug, githubToken, skipTls
  log(`modules=${options.modules}, force=${options.force}, noGit=${options.noGit}`);

  // Story 10.3: --script sh|ps resolution and default (AC-1, AC-2, AC-4)
  const VALID_SCRIPT_TYPES = ['sh', 'ps'];
  let resolvedScriptType = options.script;
  if (resolvedScriptType) {
    if (!VALID_SCRIPT_TYPES.includes(resolvedScriptType)) {
      console.error(`Error: Invalid --script "${resolvedScriptType}". Use sh or ps.`);
      process.exit(exitCodes.GENERAL_ERROR);
    }
  } else {
    resolvedScriptType = process.platform === 'win32' ? 'ps' : 'sh';
    try {
      const configManager = require('../services/config-manager');
      const defaultScript = configManager?.get?.('defaultScript', { cwd: process.cwd() });
      if (defaultScript && VALID_SCRIPT_TYPES.includes(defaultScript)) {
        resolvedScriptType = defaultScript;
      }
    } catch {
      // ConfigManager may not exist in older installs
    }
  }
  log(`resolvedScriptType=${resolvedScriptType}`);

  // Story 10.2: TTY detection, --ai, --yes, env vars (AC-3, AC-4)
  const sddYes = process.env.SDD_YES;
  const isSddYes = sddYes && ['1', 'true'].includes(String(sddYes).toLowerCase());
  const internalYes = !ttyUtils.isTTY() && !options.ai && !options.yes;
  const nonInteractive = options.yes || internalYes || isSddYes || (options.ai && !ttyUtils.isTTY());

  // Story 10.5: --bmad-path worktree mode (AC-1, AC-4)
  let resolvedBmadPath = null;
  if (options.bmadPath) {
    if (!nonInteractive) {
      console.error('Error: --bmad-path requires --ai and --yes for non-interactive use.');
      process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
    }
    resolvedBmadPath = path.resolve(options.bmadPath);
    const structure = validateBmadStructure(resolvedBmadPath);
    if (!structure.valid) {
      if (structure.missing && structure.missing[0] === 'path does not exist') {
        console.error(`Error: Path does not exist: ${resolvedBmadPath}`);
      } else {
        console.error(`Error: Structure does not match (need core/cursor/speckit/skills and cursor/commands, cursor/rules): ${(structure.missing || []).join('; ')}`);
      }
      process.exit(exitCodes.TARGET_PATH_UNAVAILABLE);
    }
    log(`resolvedBmadPath=${resolvedBmadPath} (worktree mode)`);
  }

  const resolvedOptions = {
    ...options,
    ai: options.ai || process.env.SDD_AI || undefined,
    nonInteractive,
    internalYes,
    resolvedScriptType,
    resolvedBmadPath,
  };

  if (resolvedBmadPath && nonInteractive) {
    try {
      await runWorktreeFlow(targetPath, resolvedOptions, log);
    } catch (err) {
      console.error('Error:', err.message || 'Unknown error');
      process.exit(exitCodes.GENERAL_ERROR);
    }
    return;
  }

  if (nonInteractive) {
    runNonInteractiveFlow(targetPath, resolvedOptions, log).catch((err) => {
      console.error('Error:', err.message || 'Unknown error');
      process.exit(exitCodes.GENERAL_ERROR);
    });
  } else if (!ttyUtils.isTTY()) {
    console.error('Error: Interactive init requires a TTY. Use --ai <name> and --yes for non-interactive (Story 10.2).');
    process.exit(exitCodes.GENERAL_ERROR);
  } else {
    runInteractiveFlow(targetPath, resolvedOptions, log).catch((err) => {
      console.error('Error:', err.message || 'Unknown error');
      process.exit(exitCodes.GENERAL_ERROR);
    });
  }
}

/**
 * Parse AI list from comma-separated string or single value.
 * @param {string} aiArg - AI argument (e.g. 'cursor-agent,claude' or 'cursor-agent').
 * @returns {string[]} Array of AI ids.
 */
function parseAIList(aiArg) {
  if (!aiArg || typeof aiArg !== 'string') return [];
  return aiArg.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Validate a list of AI IDs against the registry.
 * @param {string[]} aiIds - AI IDs to validate.
 * @param {string} cwd - Working directory for registry lookup.
 * @returns {{ valid: string[], invalid: string[] }} Categorized AI IDs
 */
function validateAIIds(aiIds, cwd) {
  const validIds = AIRegistry.listIds({ cwd });
  const valid = aiIds.filter((id) => validIds.includes(id));
  const invalid = aiIds.filter((id) => !validIds.includes(id));
  return { valid, invalid };
}

/**
 * Run SyncService and SkillPublisher for each AI in the list.
 * @param {string} targetPath - Project root.
 * @param {string[]} aiIds - AI IDs to sync.
 * @param {{ bmadPath?: string, noAiSkills?: boolean }} options - Sync options.
 * @returns {{ published: string[], skippedReasons: string[] }} Aggregated results.
 */
function syncAllAIs(targetPath, aiIds, options = {}) {
  const SyncService = require('../services/sync-service');
  const SkillPublisher = require('../services/skill-publisher');
  const allPublished = [];
  const allSkipped = [];
  const errors = [];
  for (const aiId of aiIds) {
    try {
      SyncService.syncCommandsRulesConfig(targetPath, aiId, options);
      const result = SkillPublisher.publish(targetPath, aiId, options);
      allPublished.push(...result.published);
      allSkipped.push(...result.skippedReasons);
    } catch (err) {
      errors.push({ aiId, error: err.message || String(err) });
      console.error(`Warning: sync failed for AI "${aiId}": ${err.message || err}`);
    }
  }
  if (errors.length > 0 && errors.length === aiIds.length) {
    throw new Error(`All AI syncs failed: ${errors.map((e) => `${e.aiId}: ${e.error}`).join('; ')}`);
  }
  return { published: [...new Set(allPublished)], skippedReasons: allSkipped, errors };
}

function createInitInstallTracker(targetPath, bmadRoot, selectedAIs, installedVia, options = {}) {
  const tracker = createInstallStateTracker({
    projectRoot: targetPath,
    packageName: 'bmad-speckit',
    packageVersion: require('../../package.json').version,
    installedVia,
    installedTools: selectedAIs,
  });

  tracker.registerProjectSpecs(collectManagedSurfaceSpecs(targetPath, bmadRoot, selectedAIs));
  if (!(options.noAiSkills === true || options['no-ai-skills'] === true || options.aiSkills === false)) {
    tracker.registerGlobalSpecs(collectManagedGlobalSkillSpecs(targetPath, bmadRoot, selectedAIs));
  }
  return tracker;
}

/**
 * Validate generic AI constraints for a list of AI IDs.
 * @param {string[]} aiIds - AI IDs to check.
 * @param {Object} options - Commander options (aiCommandsDir).
 * @param {string} cwd - Working directory.
 */
function validateGenericAIs(aiIds, options, cwd) {
  for (const aiId of aiIds) {
    if (aiId === 'generic') {
      const genericDir = resolveGenericAiCommandsDir(aiId, options, cwd);
      if (genericDir == null) {
        console.error('Error: --ai generic requires --ai-commands-dir or aiCommandsDir in registry.');
        process.exit(exitCodes.AI_INVALID);
      }
    }
  }
}

/**
 * Story 10.2 / 10.4: Get default AI (ConfigManager defaultAI > first from AIRegistry); cwd for project-level override.
 * @param {string} [cwd=process.cwd()] - Working directory for config and registry lookup.
 * @returns {string} Default AI id (e.g. 'claude').
 */
function getDefaultAI(cwd = process.cwd()) {
  try {
    const configManager = require('../services/config-manager');
    const defaultAI = configManager?.get?.('defaultAI', { cwd });
    if (defaultAI && typeof defaultAI === 'string') return defaultAI;
  } catch {
    // ConfigManager may not exist in older installs
  }
  const ids = AIRegistry.listIds({ cwd });
  return ids[0] || 'claude';
}

/**
 * Story 12.1: generic 校验 - --ai generic 时须 --ai-commands-dir 或 registry 含 aiCommandsDir.
 * @param {string} selectedAI - Selected AI id ('generic' or other).
 * @param {Object} options - Commander options (aiCommandsDir).
 * @param {string} cwd - Working directory for registry lookup.
 * @returns {string|null} Resolved absolute path to ai-commands dir, or null if not generic or not configured.
 */
function resolveGenericAiCommandsDir(selectedAI, options, cwd) {
  if (selectedAI !== 'generic') return null;
  if (options.aiCommandsDir && typeof options.aiCommandsDir === 'string' && options.aiCommandsDir.trim() !== '') {
    return path.resolve(options.aiCommandsDir.trim());
  }
  const entry = AIRegistry.getById('generic', { cwd });
  if (entry?.aiCommandsDir && typeof entry.aiCommandsDir === 'string' && entry.aiCommandsDir.trim() !== '') {
    return path.resolve(entry.aiCommandsDir.trim());
  }
  return null;
}

/**
 * Story 12.4: Post-init 引导（PRD §5.2、§5.13）；文案见 messages/cli.js（BMAD_SPECKIT_LOCALE）。
 * @returns {string} Localized post-init guide text
 */
function getPostInitGuideMsg() {
  return postInitGuideMsg();
}

/**
 * Story 12.3 §6.2: stdout hint when subagentSupport is none or limited.
 * @param {string} selectedAI - Selected AI id.
 * @param {string} cwd - Working directory for registry lookup.
 * @returns {void}
 */
function maybePrintSubagentHint(selectedAI, cwd) {
  const entry = AIRegistry.getById(selectedAI, { cwd });
  const support = entry?.configTemplate?.subagentSupport;
  if (support === 'none' || support === 'limited') {
    console.log(chalk.yellow('\n所选 AI 不支持或仅部分支持子代理，BMAD/Speckit 全流程（party-mode、code-reviewer、mcp_task 等）可能无法正常运行；建议使用支持子代理的 AI（如 cursor-agent、claude）\n'));
  }
}

/**
 * Story 10.5: Worktree flow (--bmad-path): no _bmad copy, only _bmad-output + sync from bmadPath, write bmadPath to config.
 * @param {string} targetPath - Target project path.
 * @param {Object} options - Resolved options including resolvedBmadPath.
 * @param {Function} _log - Debug log function.
 * @returns {Promise<void>}
 */
async function runWorktreeFlow(targetPath, options, _log) {
  const cwd = process.cwd();
  let selectedAIs = options.ai ? parseAIList(options.ai) : [getDefaultAI(cwd)];

  const { valid, invalid } = validateAIIds(selectedAIs, cwd);
  if (invalid.length > 0) {
    const list = AIRegistry.listIds({ cwd }).join(', ');
    console.error(`Error: Invalid AI "${invalid.join(', ')}". Available: ${list}`);
    console.error('Run "bmad-speckit check --list-ai" for full list.');
    process.exit(exitCodes.AI_INVALID);
  }
  selectedAIs = valid;
  validateGenericAIs(selectedAIs, options, cwd);

  const bmadPathResolved = options.resolvedBmadPath;
  const { createWorktreeSkeleton, writeSelectedAI, runGitInit } = require('./init-skeleton');
  const installTracker = createInitInstallTracker(
    targetPath,
    bmadPathResolved,
    selectedAIs,
    'bmad-speckit-init-worktree',
    options
  );

  createWorktreeSkeleton(targetPath, bmadPathResolved, selectedAIs[0]);
  const noAiSkills = options.noAiSkills === true || options['no-ai-skills'] === true || options.aiSkills === false;
  const publishResult = syncAllAIs(targetPath, selectedAIs, {
    bmadPath: bmadPathResolved,
    noAiSkills,
  });
  writeSelectedAI(targetPath, selectedAIs, 'latest', bmadPathResolved, {
    skillsPublished: publishResult.published,
    skippedReasons: publishResult.skippedReasons,
  });
  installTracker.finalize();
  if (!options.noGit) runGitInit(targetPath);
  for (const aiId of selectedAIs) maybePrintSubagentHint(aiId, targetPath);
  console.log(chalk.green(`\n✓ Initialized (worktree) at ${targetPath} [${selectedAIs.join(', ')}]`));
  console.log(chalk.gray(getPostInitGuideMsg()));
  console.log(chalk.gray(getFeedbackHintText()));
}

/**
 * Story 10.2: Non-interactive flow (--ai, --yes, TTY auto --yes, SDD_AI, SDD_YES).
 * @param {string} targetPath - Target project path.
 * @param {Object} options - Resolved options (ai, template, resolvedBmadPath, resolvedScriptType, etc.).
 * @param {Function} log - Debug log function.
 * @returns {Promise<void>}
 */
async function runNonInteractiveFlow(targetPath, options, log) {
  const cwd = process.cwd();
  let selectedAIs = options.ai ? parseAIList(options.ai) : [getDefaultAI(cwd)];

  const { valid, invalid } = validateAIIds(selectedAIs, cwd);
  if (invalid.length > 0) {
    const list = AIRegistry.listIds({ cwd }).join(', ');
    console.error(`Error: Invalid AI "${invalid.join(', ')}". Available: ${list}`);
    console.error('Run "bmad-speckit check --list-ai" for full list.');
    process.exit(exitCodes.AI_INVALID);
  }
  selectedAIs = valid;
  validateGenericAIs(selectedAIs, options, cwd);

  const finalPath = targetPath;
  const tag = (options.template && options.template.trim()) || 'latest';
  const networkTimeoutMs = resolveNetworkTimeoutMs(options);
  log(`selectedAIs=${selectedAIs.join(',')}, finalPath=${finalPath}, tag=${tag} (non-interactive)`);

  const { generateSkeleton, createWorktreeSkeleton, writeSelectedAI, runGitInit } = require('./init-skeleton');
  const { generateScript } = require('./script-generator');
  const noAiSkills = options.noAiSkills === true || options['no-ai-skills'] === true || options.aiSkills === false;

  try {
    if (options.resolvedBmadPath) {
      const installTracker = createInitInstallTracker(
        finalPath,
        options.resolvedBmadPath,
        selectedAIs,
        'bmad-speckit-init-worktree',
        options
      );
      createWorktreeSkeleton(finalPath, options.resolvedBmadPath, selectedAIs[0]);
      const publishResult = syncAllAIs(finalPath, selectedAIs, {
        bmadPath: options.resolvedBmadPath,
        noAiSkills,
      });
      writeSelectedAI(finalPath, selectedAIs, tag, options.resolvedBmadPath, {
        skillsPublished: publishResult.published,
        skippedReasons: publishResult.skippedReasons,
      });
      installTracker.finalize();
      generateScript(finalPath, options.resolvedScriptType);
      if (!options.noGit) runGitInit(finalPath);
    } else {
      const { fetchTemplate } = require('../services/template-fetcher');
      const templateSource = resolveTemplateSource(process.cwd());
      const templateDir = await fetchTemplate(tag, {
        githubToken: options.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
        skipTls: options.skipTls,
        debug: options.debug,
        networkTimeoutMs,
        templateSource,
        offline: options.offline,
      });
      const modules = options.modules ? options.modules.split(',').map((m) => m.trim()).filter(Boolean) : null;
      const installTracker = createInitInstallTracker(
        finalPath,
        path.join(templateDir, '_bmad'),
        selectedAIs,
        'bmad-speckit-init-command',
        options
      );
      await generateSkeleton(finalPath, templateDir, modules, options.force);
      const publishResult = syncAllAIs(finalPath, selectedAIs, { noAiSkills });
      writeSelectedAI(finalPath, selectedAIs, tag, null, {
        skillsPublished: publishResult.published,
        skippedReasons: publishResult.skippedReasons,
      });
      installTracker.finalize();
      generateScript(finalPath, options.resolvedScriptType);
      if (!options.noGit) runGitInit(finalPath);
    }
    for (const aiId of selectedAIs) maybePrintSubagentHint(aiId, finalPath);
    console.log(chalk.green(`\n✓ Initialized at ${finalPath} [${selectedAIs.join(', ')}]`));
    console.log(chalk.gray(getPostInitGuideMsg()));
    console.log(chalk.gray(getFeedbackHintText()));
  } catch (err) {
    if (err.code === 'OFFLINE_CACHE_MISSING') {
      console.error(err.message);
      process.exit(exitCodes.OFFLINE_CACHE_MISSING);
    }
    if (err.code === 'NETWORK_TEMPLATE') {
      console.error(err.message || 'Network or template fetch failed');
      console.error('建议使用 --offline 或检查网络');
      process.exit(exitCodes.NETWORK_TEMPLATE_FAILED);
    }
    console.error('Error:', err.message || 'Unknown error');
    process.exit(exitCodes.GENERAL_ERROR);
  }
}

/**
 * T012: Banner BMAD-Speckit, ASCII/box-drawing (GAP-2.1).
 * Style inspired by specify-cn: block-art + gradient + subtitle.
 * BMAD: specify-cn style; SPECKIT: TAAG ANSI Shadow (https://www.patorjk.com/software/taag/).
 * BUGFIX_showBanner-ascii-art: 重构使用 banner.js 模块
 *
 * @description Outputs init subcommand banner to stdout (gradient ASCII art, subtitle, version).
 * @returns {void}
 */
function showBanner() {
  const pkg = require('../../package.json');
  const banner = require('./banner.js');
  const pad = ' '.repeat(16);

  // 构建 banner 行
  const lines = banner.buildBannerLines();

  // 应用渐变色
  let coloredLines;
  if (banner.supportsTrueColor()) {
    coloredLines = banner.applyGradient(lines, chalk);
  } else {
    // 回退到 16 色（与当前实现一致：chalk.cyan 作为第 4 个颜色）
    const fallbackStyles = [chalk.blue, chalk.blueBright, chalk.cyan, chalk.cyan, chalk.white, chalk.gray];
    coloredLines = lines.map((line, i) => fallbackStyles[i](line));
  }

  // 添加左侧缩进
  const paddedLines = coloredLines.map((line) => pad + line);

  // 输出
  const subtitle = chalk.hex('#ff9800')('BMAD-Speckit - 规范驱动开发工具包');
  const version = chalk.gray(`v${pkg.version}`);

  console.log('');
  console.log(paddedLines.join('\n'));
  console.log('');
  console.log(pad + ' '.repeat(20) + subtitle);
  console.log(pad + ' '.repeat(24) + version);
  console.log('');
}

/**
 * T013-T014: Inquirer AI selection with search filter, path confirm, template version (GAP-2.2, 2.3, 2.4, AC-2).
 * GAP-2: AI list supports input filter (search by name) via inquirer-autocomplete-prompt.
 *
 * @param {string} targetPath - Target project path (may be confirmed by user).
 * @param {Object} options - Resolved options.
 * @param {Function} log - Debug log function.
 * @returns {Promise<void>}
 */
async function runInteractiveFlow(targetPath, options, log) {
  const inquirer = (await import('inquirer')).default;
  const AutocompletePrompt = (await import('inquirer-autocomplete-prompt')).default;
  inquirer.registerPrompt('autocomplete', AutocompletePrompt);

  const cwd = process.cwd();
  const aiList = AIRegistry.load({ cwd });
  let selectedAIs;
  if (options.ai) {
    selectedAIs = parseAIList(options.ai);
    const { invalid } = validateAIIds(selectedAIs, cwd);
    if (invalid.length > 0) {
      const list = AIRegistry.listIds({ cwd }).join(', ');
      console.error(`Error: Invalid AI "${invalid.join(', ')}". Available: ${list}`);
      console.error('Run "bmad-speckit check --list-ai" for full list.');
      process.exit(exitCodes.AI_INVALID);
    }
  } else {
    const aiChoices = aiList.map((a) => ({ name: `${a.name} (${a.id})`, value: a.id }));
    const res = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedAIs',
        message: 'Select AI assistant(s) (space to toggle, enter to confirm):',
        choices: aiChoices,
        validate: (answer) => answer.length > 0 ? true : 'Please select at least one AI.',
      },
    ]);
    selectedAIs = res.selectedAIs;
  }

  validateGenericAIs(selectedAIs, options, cwd);

  const { confirmedPath } = await inquirer.prompt([
    {
      type: 'input',
      name: 'confirmedPath',
      message: 'Target path:',
      default: targetPath,
    },
  ]);
  const finalPath = confirmedPath.trim() || targetPath;
  log(`confirmedPath=${finalPath}`);

  let tag;
  if (options.template && options.template.trim()) {
    tag = options.template.trim();
  } else {
    const { templateVersion } = await inquirer.prompt([
      {
        type: 'list',
        name: 'templateVersion',
        message: 'Template version:',
        choices: [
          { name: 'latest', value: 'latest' },
          { name: 'Specify tag (e.g. v1.0.0)', value: 'custom' },
        ],
      },
    ]);
    tag = 'latest';
    if (templateVersion === 'custom') {
      const { customTag } = await inquirer.prompt([
        { type: 'input', name: 'customTag', message: 'Enter tag:', default: 'v1.0.0' },
      ]);
      tag = customTag.trim() || 'latest';
    }
  }

  const networkTimeoutMs = resolveNetworkTimeoutMs(options);
  const templateSource = resolveTemplateSource(process.cwd());
  log(`selectedAIs=${selectedAIs.join(',')}, finalPath=${finalPath}, tag=${tag}`);

  const { fetchTemplate } = require('../services/template-fetcher');
  const { generateSkeleton, writeSelectedAI } = require('./init-skeleton');
  const { generateScript } = require('./script-generator');

  try {
    const templateDir = await fetchTemplate(tag, {
      githubToken: options.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
      skipTls: options.skipTls,
      debug: options.debug,
      networkTimeoutMs,
      templateSource,
      offline: options.offline,
    });
    const modules = options.modules ? options.modules.split(',').map((m) => m.trim()).filter(Boolean) : null;
    const installTracker = createInitInstallTracker(
      finalPath,
      path.join(templateDir, '_bmad'),
      selectedAIs,
      'bmad-speckit-init-command',
      options
    );
    await generateSkeleton(finalPath, templateDir, modules, options.force);
    const noAiSkills = options.noAiSkills === true || options['no-ai-skills'] === true || options.aiSkills === false;
    const publishResult = syncAllAIs(finalPath, selectedAIs, { noAiSkills });
    writeSelectedAI(finalPath, selectedAIs, tag, null, {
      skillsPublished: publishResult.published,
      skippedReasons: publishResult.skippedReasons,
    });
    installTracker.finalize();
    generateScript(finalPath, options.resolvedScriptType);
    if (!options.noGit) {
      const { runGitInit } = require('./init-skeleton');
      runGitInit(finalPath);
    }
    for (const aiId of selectedAIs) maybePrintSubagentHint(aiId, finalPath);
    console.log(chalk.green(`\n✓ Initialized at ${finalPath} [${selectedAIs.join(', ')}]`));
    console.log(chalk.gray(getPostInitGuideMsg()));
    console.log(chalk.gray(getFeedbackHintText()));
  } catch (err) {
    if (err.code === 'OFFLINE_CACHE_MISSING') {
      console.error(err.message);
      process.exit(exitCodes.OFFLINE_CACHE_MISSING);
    }
    if (err.code === 'NETWORK_TEMPLATE') {
      console.error(err.message || 'Network or template fetch failed');
      console.error('建议使用 --offline 或检查网络');
      process.exit(exitCodes.NETWORK_TEMPLATE_FAILED);
    }
    console.error('Error:', err.message || 'Unknown error');
    process.exit(exitCodes.GENERAL_ERROR);
  }
}

module.exports = {
  initCommand,
  showBanner,
  resolveNetworkTimeoutMs,
  resolveTemplateSource,
  parseAIList,
  validateAIIds,
  syncAllAIs,
  validateGenericAIs,
};
