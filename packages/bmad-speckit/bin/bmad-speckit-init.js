#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const pkg = require('../package.json');
const { generateSkeleton, writeSelectedAI } = require('../src/commands/init-skeleton');
const { syncCommandsRulesConfig } = require('../src/services/sync-service');

const AGENT_TO_AI = {
  cursor: 'cursor-agent',
  'claude-code': 'claude',
};

function parseArgs(argv) {
  const args = [...argv];
  let requestedAgent = 'cursor';
  let targetArg = null;
  const passthrough = {
    full: false,
    noPackageJson: false,
    withPackageJson: false,
    withMcp: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const current = args[index];
    if (current === '--agent') {
      requestedAgent = args[index + 1] || requestedAgent;
      index += 1;
      continue;
    }
    if (current === '--full') {
      passthrough.full = true;
      continue;
    }
    if (current === '--no-package-json') {
      passthrough.noPackageJson = true;
      continue;
    }
    if (current === '--with-package-json') {
      passthrough.withPackageJson = true;
      continue;
    }
    if (current === '--with-mcp') {
      passthrough.withMcp = true;
      continue;
    }
    if (!current.startsWith('--') && targetArg == null) {
      targetArg = current;
    }
  }

  const selectedAI = AGENT_TO_AI[requestedAgent];
  if (!selectedAI) {
    throw new Error(`Unsupported --agent value: ${requestedAgent}. Valid: cursor, claude-code`);
  }

  const target = targetArg
    ? path.resolve(targetArg)
    : (process.env.INIT_CWD && path.resolve(process.env.INIT_CWD)) || process.cwd();

  return {
    requestedAgent,
    selectedAI,
    target,
    passthrough,
  };
}

function ensureSpecsDir(target) {
  fs.mkdirSync(path.join(target, 'specs'), { recursive: true });
}

function main() {
  const { requestedAgent, selectedAI, target } = parseArgs(process.argv.slice(2));
  const packageRoot = path.resolve(__dirname, '..');

  console.log(
    `bmad-speckit init alias: deploy to ${target} [agent=${requestedAgent}]`
  );

  generateSkeleton(target, packageRoot, null, false);
  writeSelectedAI(target, selectedAI, pkg.version);
  syncCommandsRulesConfig(target, selectedAI);
  ensureSpecsDir(target);

  console.log('Done. Verify with: _bmad/speckit/scripts/powershell/check-prerequisites.ps1');
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
