#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  ROOT,
  WAVE_DIR,
  WAVE_ID,
  formatJson,
  nowIso,
  repoPath,
  safeWriteFile,
  sha256Text,
} = require('./safe-write-main-agent-wave-3-12-artifact.cjs');

const LEDGER_PATH = `${WAVE_DIR}/migration-ledger.json`;
const EVIDENCE_PATH = `${WAVE_DIR}/package-command-evidence.json`;
const EXPECTED_QUEUE_HASH = 'sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea';

function parseArgs(argv) {
  const args = { packages: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--kind') args.kind = argv[++index];
    else if (arg === '--command') args.command = argv[++index];
    else if (arg === '--package') {
      args.packages.push({ packagePath: argv[++index], targetPrefix: null });
    } else if (arg === '--target-prefix') {
      if (args.packages.length === 0) throw new Error('--target-prefix must follow --package');
      args.packages[args.packages.length - 1].targetPrefix = argv[++index];
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!args.kind) throw new Error('--kind is required');
  if (args.packages.length === 0) throw new Error('at least one --package is required');
  for (const pkg of args.packages) {
    if (!pkg.targetPrefix) throw new Error(`missing --target-prefix for ${pkg.packagePath}`);
  }
  return args;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function packageJsonFor(packagePath) {
  const packageJsonPath = path.join(ROOT, packagePath, 'package.json');
  if (!fs.existsSync(packageJsonPath)) return null;
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function pathsForEntry(entry) {
  const values = [
    ...(entry.targetPaths || []),
    ...((entry.callerSwitchPlan || []).map((plan) => plan.targetPath)),
    ...((entry.buildCopyPlan || []).map((plan) => plan.targetPath)),
    ...(entry.testPaths || []),
  ];
  return values.filter(Boolean);
}

function touchedPaths(ledger, targetPrefix) {
  return ledger.entries
    .flatMap((entry) => pathsForEntry(entry))
    .filter((targetPath) => targetPath === targetPrefix || targetPath.startsWith(`${targetPrefix}/`));
}

function commandIdFor(kind, packagePath) {
  const ids = {
    build: {
      'packages/scoring': 'CMD014',
      'packages/runtime-context': 'CMD015',
      'packages/runtime-emit': 'CMD016',
      'packages/ralph-method': 'CMD017',
      'packages/bmad-speckit': 'CMD018',
    },
    test: {
      'packages/scoring': 'CMD019',
      'packages/bmad-speckit': 'CMD020',
    },
    'test-not-applicable': {
      'packages/runtime-context': 'CMD021',
      'packages/runtime-emit': 'CMD021',
      'packages/ralph-method': 'CMD021',
      'packages/schema': 'CMD021',
    },
  };
  return ids[kind]?.[packagePath] || `CMD-${kind}-${packagePath.replace(/^packages\//u, '').replace(/\//gu, '-')}`;
}

function runShell(command) {
  const startedAt = nowIso();
  const result = spawnSync(command, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: true,
    maxBuffer: 120 * 1024 * 1024,
  });
  return {
    startedAt,
    completedAt: nowIso(),
    exitCode: result.status === null ? 1 : result.status,
    stdoutHash: sha256Text(result.stdout || ''),
    stderrHash: sha256Text(result.stderr || ''),
    stdoutPreview: String(result.stdout || '').slice(0, 2000),
    stderrPreview: String(result.stderr || '').slice(0, 2000),
  };
}

function loadEvidence() {
  if (!fs.existsSync(repoPath(EVIDENCE_PATH))) {
    return {
      schemaVersion: 'main-agent-runtime-migration-wave-3.12-package-command-evidence/v1',
      waveId: WAVE_ID,
      generatedAt: nowIso(),
      ledgerPath: LEDGER_PATH,
      queueHash: EXPECTED_QUEUE_HASH,
      rows: [],
    };
  }
  return readJson(EVIDENCE_PATH);
}

function saveEvidence(artifact) {
  artifact.generatedAt = nowIso();
  safeWriteFile(EVIDENCE_PATH, formatJson(artifact), {
    operation: 'wave_3_12_package_command_evidence',
    requires: [WAVE_ID, EXPECTED_QUEUE_HASH],
    minBytes: 100,
  });
}

function buildRow(args, ledger, pkg) {
  const touchedTargetPaths = touchedPaths(ledger, pkg.targetPrefix);
  const packageJson = packageJsonFor(pkg.packagePath);
  const scripts = packageJson?.scripts || {};
  const hasBuildScript = Boolean(scripts.build || scripts['build:main-agent-dist']);
  const hasTestScript = Boolean(scripts.test);
  const ledgerQuery = {
    targetPrefix: pkg.targetPrefix,
    touchedTargetCount: touchedTargetPaths.length,
    provesNotApplicable: false,
  };
  const commandId = commandIdFor(args.kind, pkg.packagePath);
  const base = {
    commandId,
    kind: args.kind,
    packagePath: pkg.packagePath,
    targetPrefix: pkg.targetPrefix,
    packageJsonPath: `${pkg.packagePath}/package.json`,
    packageJsonScripts: scripts,
    touchedTargetPaths,
    ledgerQuery,
  };

  if (args.kind === 'test-not-applicable') {
    const noTestScript = !hasTestScript;
    ledgerQuery.provesNotApplicable = noTestScript || touchedTargetPaths.length === 0;
    return {
      ...base,
      command: null,
      status: ledgerQuery.provesNotApplicable ? 'not_applicable' : 'failed',
      reason: noTestScript ? 'package_has_no_test_script' : 'package_has_no_touched_targets',
      exitCode: ledgerQuery.provesNotApplicable ? 0 : 1,
    };
  }

  if (touchedTargetPaths.length === 0) {
    ledgerQuery.provesNotApplicable = true;
    return {
      ...base,
      command: args.command || null,
      status: 'not_applicable',
      reason: 'ledger_has_no_touched_targets_for_prefix',
      exitCode: 0,
    };
  }

  if (!args.command) {
    return {
      ...base,
      command: null,
      status: 'failed',
      reason: 'command_required_for_touched_targets',
      exitCode: 1,
    };
  }

  if (args.kind === 'build' && !hasBuildScript && !args.command.includes('build')) {
    return {
      ...base,
      command: args.command,
      status: 'failed',
      reason: 'package_build_script_missing',
      exitCode: 1,
    };
  }

  if (args.kind === 'test' && !hasTestScript) {
    return {
      ...base,
      command: args.command,
      status: 'failed',
      reason: 'package_test_script_missing',
      exitCode: 1,
    };
  }

  const result = runShell(args.command);
  return {
    ...base,
    command: args.command,
    status: result.exitCode === 0 ? 'passed' : 'failed',
    ...result,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledger = readJson(LEDGER_PATH);
  const artifact = loadEvidence();
  const rows = args.packages.map((pkg) => buildRow(args, ledger, pkg));
  const replacementIds = new Set(rows.map((row) => row.commandId));
  artifact.rows = (artifact.rows || []).filter((row) => !replacementIds.has(row.commandId));
  artifact.rows.push(...rows);
  saveEvidence(artifact);
  const output = {
    status: rows.every((row) => row.status === 'passed' || row.status === 'not_applicable') ? 'passed' : 'failed',
    waveId: WAVE_ID,
    rows,
    evidencePath: EVIDENCE_PATH,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.status === 'passed' ? 0 : 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
