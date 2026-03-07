#!/usr/bin/env node
/**
 * bmad-speckit CLI entry (ARCH §3.1)
 */
const { program } = require('commander');
const pkg = require('../package.json');
const { initCommand } = require('../src/commands/init');

program
  .name('bmad-speckit')
  .version(pkg.version)
  .description('BMAD-Speckit: init, check, version, upgrade, config, feedback');

program
  .command('init [project-name]')
  .description('Initialize a new SDD project')
  .option('--here', 'Use current directory')
  .option('--modules <list>', 'Comma-separated modules (bmm,bmb,tea,bmgd,cis,...)')
  .option('--force', 'Force overwrite non-empty directory')
  .option('--no-git', 'Skip git init')
  .option('--debug', 'Enable debug output')
  .option('--github-token <token>', 'GitHub API token')
  .option('--skip-tls', 'Skip SSL/TLS verification (not recommended)')
  .action(initCommand);

program.parse();
