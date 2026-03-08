#!/usr/bin/env node
/**
 * bmad-speckit CLI entry (ARCH §3.1)
 */
const { program } = require('commander');
const pkg = require('../package.json');
const { initCommand, showBanner } = require('../src/commands/init');
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
  .option('--modules <list>', 'Comma-separated modules (bmm,bmb,tea,bmgd,cis,...)')
  .option('--force', 'Force overwrite non-empty directory')
  .option('--no-git', 'Skip git init')
  .option('--debug', 'Enable debug output')
  .option('--github-token <token>', 'GitHub API token')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)')
  .action(initCommand);

program.parse();
