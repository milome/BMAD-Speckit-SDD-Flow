#!/usr/bin/env node
/**
 * bmad-speckit CLI 主入口 (ARCH §3.1)
 *
 * @description
 * BMAD-Speckit CLI：提供 init、check、version、upgrade、config、feedback 等子命令，
 * 用于初始化项目、校验配置、管理模板版本等。
 *
 * 运行方式：
 * - 项目根: npx bmad-speckit <cmd> 或 npm run speckit -- <cmd>
 * - 包目录: node bin/bmad-speckit.js <cmd>
 * - 全局: bmad-speckit <cmd> (npm link 后)
 *
 * 退出码约定（见 constants/exit-codes.js）：
 * - 0: SUCCESS
 * - 1: GENERAL_ERROR
 * - 2: AI_INVALID
 * - 3: NETWORK_TEMPLATE_FAILED
 * - 4: TARGET_PATH_UNAVAILABLE
 * - 5: OFFLINE_CACHE_MISSING
 */
const { program } = require('commander');
const pkg = require('../package.json');
const { initCommand, showBanner } = require('../src/commands/init');
const { checkCommand } = require('../src/commands/check');
const { versionCommand } = require('../src/commands/version');
const { upgradeCommand } = require('../src/commands/upgrade');
const { addAgentCommand } = require('../src/commands/add-agent');
const { configGetCommand, configSetCommand, configListCommand } = require('../src/commands/config');
const { feedbackCommand } = require('../src/commands/feedback');
const ttyUtils = require('../src/utils/tty');

// Show banner for init (including init --help) when in TTY
if (process.argv.includes('init') && ttyUtils.isTTY()) {
  showBanner();
}

program
  .name('bmad-speckit')
  .version(pkg.version)
  .description('BMAD-Speckit: init, check, version, upgrade, config, feedback');

program
  .command('init [project-name]')
  .description('Initialize a new bmad-speckit project')
  .option('--here', 'Use current directory')
  .option('--ai <name>', 'AI selection, comma-separated for multi (e.g. cursor-agent,claude)')
  .option('--ai-commands-dir <path>', 'Commands directory for generic AI (required when --ai generic)')
  .option('-y, --yes', 'Skip all prompts, use defaults')
  .option('--template <tag|url>', 'Template version (latest, v1.0.0) or tarball URL')
  .option('--network-timeout <ms>', 'Network timeout in ms (overrides env and config)')
  .option('--modules <list>', 'Comma-separated modules (bmm,bmb,tea,bmgd,cis,...)')
  .option('--force', 'Force overwrite non-empty directory')
  .option('--no-git', 'Skip git init')
  .option('--script <type>', 'Script type: sh (POSIX) or ps (PowerShell)')
  .option('--bmad-path <path>', 'Shared _bmad path (worktree mode, no copy)')
  .option('--ai-skills', 'Publish AI skills (default)')
  .option('--no-ai-skills', 'Skip publishing AI skills')
  .option('--debug', 'Enable debug output')
  .option('--github-token <token>', 'GitHub API token')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)')
  .option('--offline', 'Use only local cache, no network')
  .action(initCommand);

program
  .command('check')
  .description('Verify bmad-speckit setup (e.g. bmadPath when using worktree)')
  .option('--list-ai', 'List available AI ids from registry')
  .option('--json', 'Output as JSON')
  .option('--ignore-agent-tools', 'Skip AI tool (detectCommand) detection')
  .action((opts) =>
    checkCommand({
      cwd: process.cwd(),
      listAi: opts.listAi,
      json: opts.json,
      ignoreAgentTools: opts.ignoreAgentTools,
    })
  );

program
  .command('version')
  .description('Show CLI version, template version, Node version')
  .option('--json', 'Output as JSON')
  .action((opts) => versionCommand({ cwd: process.cwd(), json: opts.json }));

program
  .command('upgrade')
  .description('Upgrade template version in initialized project')
  .option('--dry-run', 'Only check upgrade info, no file writes')
  .option('--template <tag>', 'Target version (latest, v1.0.0)')
  .option('--offline', 'Use only local cache')
  .action((opts) =>
    upgradeCommand(process.cwd(), {
      dryRun: opts.dryRun,
      template: opts.template,
      offline: opts.offline,
    })
  );

program
  .command('add-agent <ai>')
  .description('Add AI agent infrastructure to an initialized project (e.g. bmad-speckit add-agent claude)')
  .action((ai) => addAgentCommand(ai, { cwd: process.cwd() }));

program
  .command('feedback')
  .description('Show feedback entry and full-flow compatible AI list')
  .action(() => feedbackCommand());

const configCmd = program
  .command('config')
  .description('Get/set/list bmad-speckit config');

configCmd
  .command('get <key>')
  .description('Get config value by key')
  .option('--json', 'Output as JSON')
  .action((key, opts) => {
    configGetCommand(process.cwd(), { key, json: opts.json });
  });

configCmd
  .command('set <key> <value>')
  .description('Set config value')
  .option('--global', 'Force global scope')
  .action((key, value, opts) => {
    configSetCommand(process.cwd(), { key, value, global: opts.global });
  });

configCmd
  .command('list')
  .description('List merged config (project overrides global)')
  .option('--json', 'Output as JSON')
  .action((opts) => {
    configListCommand(process.cwd(), { json: opts.json });
  });

program.parse();
