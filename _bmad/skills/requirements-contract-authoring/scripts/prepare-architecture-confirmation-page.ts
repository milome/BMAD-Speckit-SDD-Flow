#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable no-console */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.resolve(__dirname, '..');

function resolvePackageCli() {
  const directCandidates = [
    path.resolve('packages/bmad-speckit/bin/bmad-speckit.js'),
    path.resolve('node_modules/bmad-speckit/bin/bmad-speckit.js'),
    path.resolve(
      'node_modules',
      'bmad-speckit-sdd-flow',
      'node_modules',
      'bmad-speckit',
      'bin',
      'bmad-speckit.js'
    ),
    path.resolve(
      SKILL_DIR,
      '..',
      '..',
      '..',
      'node_modules',
      'bmad-speckit-sdd-flow',
      'node_modules',
      'bmad-speckit',
      'bin',
      'bmad-speckit.js'
    ),
    path.resolve(SKILL_DIR, '..', '..', '..', 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
  ];
  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  try {
    const packageJson = require.resolve('bmad-speckit/package.json', {
      paths: [process.cwd(), SKILL_DIR],
    });
    const packageRoot = path.dirname(packageJson);
    const packageCandidate = path.join(packageRoot, 'bin', 'bmad-speckit.js');
    if (fs.existsSync(packageCandidate)) return packageCandidate;
  } catch {
    // Fall through to the fail-closed error below.
  }

  throw new Error(
    'Unable to resolve the bmad-speckit package CLI; build or install bmad-speckit before preparing architecture confirmation.'
  );
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (arg !== '--request-id') {
      const name = arg.startsWith('--') ? arg.slice(2) : arg;
      throw new Error(`caller_derived_input_forbidden:${name}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error('request_id_missing');
    args.requestId = value;
    index += 1;
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: node prepare-architecture-confirmation-page.ts --request-id <requestId> --json'
    );
    return 0;
  }
  if (!args.requestId) throw new Error('request_id_missing');

  const result = spawnSync(
    process.execPath,
    [
      resolvePackageCli(),
      'main-agent',
      'prepare-architecture-confirmation',
      '--request-id',
      args.requestId,
      '--json',
    ],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === null) throw result.error ?? new Error('package_cli_execution_failed');
  return result.status;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
