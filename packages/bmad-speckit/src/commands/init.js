/**
 * InitCommand - init subcommand handler (ARCH §3.2)
 * T007-T012: 参数解析、路径解析、非空校验、Banner、ai-builtin
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk').default ?? require('chalk');
const boxen = require('boxen');
const pathUtils = require('../utils/path');
const ttyUtils = require('../utils/tty');
const exitCodes = require('../constants/exit-codes');
const aiBuiltin = require('../constants/ai-builtin');
const { validateBmadStructure } = require('../utils/structure-validate');

/**
 * Check if directory is non-empty (FR-019): has _bmad, _bmad-output, or other files/subdirs
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
 * Story 11.1: Resolve network timeout ms: CLI > env > project config > global config > 30000
 */
function resolveNetworkTimeoutMs(options = {}) {
  const cwd = process.cwd();
  if (options.networkTimeout != null) {
    const n = parseInt(options.networkTimeout, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const envMs = process.env.SDD_NETWORK_TIMEOUT_MS;
  if (envMs != null && envMs !== '') {
    const n = parseInt(envMs, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  try {
    const configManager = require('../services/config-manager');
    const project = configManager?.get?.('networkTimeoutMs', { cwd });
    if (project != null && Number(project) > 0) return Number(project);
    const global = configManager?.get?.('networkTimeoutMs', {});
    if (global != null && Number(global) > 0) return Number(global);
  } catch {
    // ignore
  }
  return 30000;
}

/**
 * Story 11.1: Resolve template source: env > project config > global config > default
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
 * Check if path is writable (GAP-8.1)
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
 * Init command handler
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
      console.error('Error:', err.message);
      process.exit(exitCodes.GENERAL_ERROR);
    }
    return;
  }

  if (nonInteractive) {
    runNonInteractiveFlow(targetPath, resolvedOptions, log).catch((err) => {
      console.error('Error:', err.message);
      process.exit(exitCodes.GENERAL_ERROR);
    });
  } else if (!ttyUtils.isTTY()) {
    console.error('Error: Interactive init requires a TTY. Use --ai <name> and --yes for non-interactive (Story 10.2).');
    process.exit(exitCodes.GENERAL_ERROR);
  } else {
    runInteractiveFlow(targetPath, resolvedOptions, log).catch((err) => {
      console.error('Error:', err.message);
      process.exit(exitCodes.GENERAL_ERROR);
    });
  }
}

/**
 * Story 10.2 / 10.4: Get default AI (ConfigManager defaultAI > aiBuiltin[0]); cwd for project-level override.
 */
function getDefaultAI(cwd = process.cwd()) {
  try {
    const configManager = require('../services/config-manager');
    const defaultAI = configManager?.get?.('defaultAI', { cwd });
    if (defaultAI && typeof defaultAI === 'string') return defaultAI;
  } catch {
    // ConfigManager may not exist in older installs
  }
  return aiBuiltin[0]?.id || 'claude';
}

/**
 * Story 10.5: Worktree flow (--bmad-path): no _bmad copy, only _bmad-output + sync from bmadPath, write bmadPath to config
 */
async function runWorktreeFlow(targetPath, options, log) {
  let selectedAI = options.ai;
  if (selectedAI) {
    const validIds = aiBuiltin.map((a) => a.id);
    if (!validIds.includes(selectedAI)) {
      const list = aiBuiltin.map((a) => a.id).join(', ');
      console.error(`Error: Invalid AI "${selectedAI}". Available: ${list}`);
      process.exit(exitCodes.AI_INVALID);
    }
  } else {
    selectedAI = getDefaultAI(process.cwd());
  }

  const bmadPathResolved = options.resolvedBmadPath;
  const { createWorktreeSkeleton, writeSelectedAI, runGitInit } = require('./init-skeleton');

  createWorktreeSkeleton(targetPath, bmadPathResolved, selectedAI);
  writeSelectedAI(targetPath, selectedAI, 'latest', bmadPathResolved);
  if (!options.noGit) runGitInit(targetPath);
  console.log(chalk.green(`\n✓ Initialized (worktree) at ${targetPath}`));
  console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));
}

/**
 * Story 10.2: Non-interactive flow (--ai, --yes, TTY auto --yes, SDD_AI, SDD_YES)
 */
async function runNonInteractiveFlow(targetPath, options, log) {
  let selectedAI = options.ai;
  if (selectedAI) {
    const validIds = aiBuiltin.map((a) => a.id);
    if (!validIds.includes(selectedAI)) {
      const list = aiBuiltin.map((a) => a.id).join(', ');
      console.error(`Error: Invalid AI "${selectedAI}". Available: ${list}`);
      console.error('Run "bmad-speckit check --list-ai" for full list.');
      process.exit(exitCodes.AI_INVALID);
    }
  } else {
    selectedAI = getDefaultAI(process.cwd());
  }

  const finalPath = targetPath;
  const tag = (options.template && options.template.trim()) || 'latest';
  const networkTimeoutMs = resolveNetworkTimeoutMs(options);
  log(`selectedAI=${selectedAI}, finalPath=${finalPath}, tag=${tag} (non-interactive)`);

  const { generateSkeleton, createWorktreeSkeleton, writeSelectedAI, runGitInit } = require('./init-skeleton');
  const { generateScript } = require('./script-generator');

  try {
    if (options.resolvedBmadPath) {
      // Story 10.5: worktree mode - no _bmad copy, only _bmad-output and sync from bmadPath
      createWorktreeSkeleton(finalPath, options.resolvedBmadPath, selectedAI);
      writeSelectedAI(finalPath, selectedAI, tag, options.resolvedBmadPath);
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
      await generateSkeleton(finalPath, templateDir, modules, options.force);
      writeSelectedAI(finalPath, selectedAI, tag);
      generateScript(finalPath, options.resolvedScriptType);
      if (!options.noGit) runGitInit(finalPath);
    }
    console.log(chalk.green(`\n✓ Initialized at ${finalPath}`));
    console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));
  } catch (err) {
    if (err.code === 'OFFLINE_CACHE_MISSING') {
      console.error(err.message);
      process.exit(exitCodes.OFFLINE_CACHE_MISSING);
    }
    console.error('Error:', err.message);
    process.exit(err.code === 'NETWORK_TEMPLATE' ? exitCodes.NETWORK_TEMPLATE_FAILED : exitCodes.GENERAL_ERROR);
  }
}

/**
 * T012: Banner BMAD-Speckit, ASCII/box-drawing (GAP-2.1)
 * Style inspired by specify-cn: block-art + gradient + subtitle
 * BMAD: specify-cn style; SPECKIT: TAAG ANSI Shadow (https://www.patorjk.com/software/taag/)
 * 
 * BUGFIX_showBanner-ascii-art: 重构使用 banner.js 模块
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
 * T013-T014: Inquirer AI selection with search filter, path confirm, template version (GAP-2.2, 2.3, 2.4, AC-2)
 * GAP-2: AI list supports input filter (search by name) via inquirer-autocomplete-prompt
 */
async function runInteractiveFlow(targetPath, options, log) {
  const inquirer = (await import('inquirer')).default;
  const AutocompletePrompt = (await import('inquirer-autocomplete-prompt')).default;
  inquirer.registerPrompt('autocomplete', AutocompletePrompt);

  let selectedAI;
  if (options.ai) {
    const validIds = aiBuiltin.map((a) => a.id);
    if (!validIds.includes(options.ai)) {
      const list = aiBuiltin.map((a) => a.id).join(', ');
      console.error(`Error: Invalid AI "${options.ai}". Available: ${list}`);
      console.error('Run "bmad-speckit check --list-ai" for full list.');
      process.exit(exitCodes.AI_INVALID);
    }
    selectedAI = options.ai;
  } else {
    const aiChoices = aiBuiltin.map((a) => ({ name: `${a.name} (${a.id})`, value: a.id }));
    const res = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'selectedAI',
        message: 'Select AI assistant (type to search):',
        source: (answersSoFar, input) => {
          const q = (input || '').toLowerCase().trim();
          const filtered = q
            ? aiChoices.filter(
                (c) =>
                  c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q),
              )
            : aiChoices;
          return Promise.resolve(filtered);
        },
        pageSize: 15,
      },
    ]);
    selectedAI = res.selectedAI;
  }

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
  log(`selectedAI=${selectedAI}, finalPath=${finalPath}, tag=${tag}`);

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
    await generateSkeleton(finalPath, templateDir, modules, options.force);
    writeSelectedAI(finalPath, selectedAI, tag);
    generateScript(finalPath, options.resolvedScriptType);
    if (!options.noGit) {
      const { runGitInit } = require('./init-skeleton');
      runGitInit(finalPath);
    }
    console.log(chalk.green(`\n✓ Initialized at ${finalPath}`));
    console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));
  } catch (err) {
    if (err.code === 'OFFLINE_CACHE_MISSING') {
      console.error(err.message);
      process.exit(exitCodes.OFFLINE_CACHE_MISSING);
    }
    console.error('Error:', err.message);
    process.exit(err.code === 'NETWORK_TEMPLATE' ? exitCodes.NETWORK_TEMPLATE_FAILED : exitCodes.GENERAL_ERROR);
  }
}

module.exports = {
  initCommand,
  showBanner,
  resolveNetworkTimeoutMs,
  resolveTemplateSource,
};
