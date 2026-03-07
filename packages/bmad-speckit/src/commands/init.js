/**
 * InitCommand - init subcommand handler (ARCH §3.2)
 * T007-T012: 参数解析、路径解析、非空校验、Banner、ai-builtin
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const boxen = require('boxen');
const pathUtils = require('../utils/path');
const ttyUtils = require('../utils/tty');
const exitCodes = require('../constants/exit-codes');
const aiBuiltin = require('../constants/ai-builtin');

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
function initCommand(projectName, options = {}) {
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

  // Story 10.1: interactive only (--ai, --yes non-interactive by Story 10.2)
  if (!ttyUtils.isTTY()) {
    console.error('Error: Interactive init requires a TTY. Use --ai <name> and --yes for non-interactive (Story 10.2).');
    process.exit(exitCodes.GENERAL_ERROR);
  }
  runInteractiveFlow(targetPath, options, log).catch((err) => {
    console.error('Error:', err.message);
    process.exit(exitCodes.GENERAL_ERROR);
  });
}

/**
 * T012: Banner BMAD-Speckit, ASCII/box-drawing, chalk+boxen (GAP-2.1)
 */
function showBanner() {
  const pkg = require('../../package.json');
  const title = chalk.cyan.bold('BMAD-Speckit');
  const version = chalk.gray(`v${pkg.version}`);
  const line = chalk.gray('─'.repeat(20));
  const content = [
    '┌─────────────────────────┐',
    `│  ${title}  │`,
    `│  ${version.padEnd(22)} │`,
    '└─────────────────────────┘',
  ].join('\n');
  console.log(boxen(content, { padding: 1, borderStyle: 'round', borderColor: 'cyan' }));
}

/**
 * T013-T014: Inquirer AI selection with search filter, path confirm, template version (GAP-2.2, 2.3, 2.4, AC-2)
 * GAP-2: AI list supports input filter (search by name) via inquirer-autocomplete-prompt
 */
async function runInteractiveFlow(targetPath, options, log) {
  const inquirer = (await import('inquirer')).default;
  const AutocompletePrompt = (await import('inquirer-autocomplete-prompt')).default;
  inquirer.registerPrompt('autocomplete', AutocompletePrompt);

  showBanner();

  const aiChoices = aiBuiltin.map((a) => ({ name: `${a.name} (${a.id})`, value: a.id }));
  const { selectedAI } = await inquirer.prompt([
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

  let tag = 'latest';
  if (templateVersion === 'custom') {
    const { customTag } = await inquirer.prompt([
      { type: 'input', name: 'customTag', message: 'Enter tag:', default: 'v1.0.0' },
    ]);
    tag = customTag.trim() || 'latest';
  }

  log(`selectedAI=${selectedAI}, finalPath=${finalPath}, tag=${tag}`);

  // Phase 5-6: TemplateFetcher + skeleton generation (will call from here)
  const { fetchTemplate } = require('../services/template-fetcher');
  const { generateSkeleton, writeSelectedAI } = require('./init-skeleton');

  try {
    const templateDir = await fetchTemplate(tag, {
      githubToken: options.githubToken || process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
      skipTls: options.skipTls,
      debug: options.debug,
    });
    const modules = options.modules ? options.modules.split(',').map((m) => m.trim()).filter(Boolean) : null;
    await generateSkeleton(finalPath, templateDir, modules, options.force);
    writeSelectedAI(finalPath, selectedAI);
    if (!options.noGit) {
      const { runGitInit } = require('./init-skeleton');
      runGitInit(finalPath);
    }
    console.log(chalk.green(`\n✓ Initialized at ${finalPath}`));
    console.log(chalk.gray('Run /bmad-help in your AI IDE for next steps.'));
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(exitCodes.GENERAL_ERROR);
  }
}

module.exports = {
  initCommand,
};
