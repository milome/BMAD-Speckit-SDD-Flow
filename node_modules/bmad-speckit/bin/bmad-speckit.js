#!/usr/bin/env node
/**
 * bmad-speckit CLI entry (ARCH §3.1)
 */
const { program } = require('commander');
const pkg = require('../package.json');
const { initCommand, showBanner } = require('../src/commands/init');
const { checkCommand } = require('../src/commands/check');
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
  .option('--ai <name>', 'Non-interactive AI selection (skip selector)')
  .option('-y, --yes', 'Skip all prompts, use defaults')
  .option('--template <tag|url>', 'Template version (latest, v1.0.0) or tarball URL')
  .option('--network-timeout <ms>', 'Network timeout in ms (overrides env and config)')
  .option('--modules <list>', 'Comma-separated modules (bmm,bmb,tea,bmgd,cis,...)')
  .option('--force', 'Force overwrite non-empty directory')
  .option('--no-git', 'Skip git init')
  .option('--script <type>', 'Script type: sh (POSIX) or ps (PowerShell)')
  .option('--bmad-path <path>', 'Shared _bmad path (worktree mode, no copy)')
  .option('--debug', 'Enable debug output')
  .option('--github-token <token>', 'GitHub API token')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)')
  .option('--offline', 'Use only local cache, no network')
  .action(initCommand);

program
  .command('check')
  .description('Verify bmad-speckit setup (e.g. bmadPath when using worktree)')
  .action(() => checkCommand({ cwd: process.cwd() }));

program.parse();
