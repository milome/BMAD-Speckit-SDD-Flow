#!/usr/bin/env node
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function stripModeArgs(argv) {
  const out = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') {
      index += 1;
      continue;
    }
    out.push(arg);
  }
  return out;
}

function hasFlag(argv, flag) {
  return argv.includes(flag);
}

function printUsage(config) {
  console.log(`Usage:
  node ${config.cliName} <source-document.md> [options]
  node ${config.cliName} --source <source-document.md> [options]

Stage:
  ${config.stage}

Options:
  --render-report <path>
  --confirmation-dir <dir>
  --record-id <id>
  --grill-report <path>
  --json
  --help

This stage CLI is single-purpose and forces reverse_audit_contract.js --mode ${config.mode}.`);
}

function runStageAudit(argv, config) {
  if (hasFlag(argv, '--help') || hasFlag(argv, '-h')) {
    printUsage(config);
    return 0;
  }

  const coreScript = path.join(__dirname, 'reverse_audit_contract.js');
  const coreArgs = [coreScript, ...stripModeArgs(argv), '--mode', config.mode];
  const result = spawnSync(process.execPath, coreArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024,
  });

  const exitCode = typeof result.status === 'number' ? result.status : result.error ? 2 : 0;
  const wantsJson = hasFlag(argv, '--json');
  if (!wantsJson) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return exitCode;
  }

  try {
    const report = JSON.parse(result.stdout || '{}');
    process.stdout.write(
      `${JSON.stringify(
        {
          ...report,
          stageAudit: {
            stage: config.stage,
            cli: config.cliName,
            coreScript: 'reverse_audit_contract.js',
            forcedMode: config.mode,
            genericWrapperPassDeprecated: true,
            exitSemantics: config.exitSemantics,
          },
        },
        null,
        2
      )}\n`
    );
  } catch {
    if (result.stdout) process.stdout.write(result.stdout);
  }
  if (result.stderr) process.stderr.write(result.stderr);
  return exitCode;
}

module.exports = {
  runStageAudit,
};
