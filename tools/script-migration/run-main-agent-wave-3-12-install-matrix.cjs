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
const MATRIX_PATH = `${WAVE_DIR}/install-matrix.json`;
const INSTALL_SANDBOX_ROOT = `${WAVE_DIR}/install-sandbox`;
const EXPECTED_QUEUE_HASH = 'sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea';

function parseArgs(argv) {
  const args = { write: false };
  for (const arg of argv) {
    if (arg === '--write') args.write = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function normalize(relativePath) {
  return relativePath.replace(/\\/g, '/');
}

function assertInsideInstallSandbox(targetPath) {
  const resolvedRoot = path.resolve(repoPath(INSTALL_SANDBOX_ROOT));
  const resolvedTarget = path.resolve(targetPath);
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`refusing install sandbox write outside ${INSTALL_SANDBOX_ROOT}: ${targetPath}`);
  }
}

function copyDir(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return false;
  const stat = fs.statSync(source);
  if (stat.isDirectory()) copyDir(source, target);
  else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return true;
}

function prepareSandbox(name) {
  const sandbox = repoPath(`${INSTALL_SANDBOX_ROOT}/${name}`);
  assertInsideInstallSandbox(sandbox);
  fs.rmSync(sandbox, { recursive: true, force: true });
  fs.mkdirSync(path.join(sandbox, 'node_modules'), { recursive: true });

  const packageRoot = path.join(sandbox, 'node_modules', 'bmad-speckit');
  fs.mkdirSync(packageRoot, { recursive: true });
  for (const item of ['package.json', 'bin', 'src', 'dist', 'README.md']) {
    copyIfExists(path.join(ROOT, 'packages', 'bmad-speckit', item), path.join(packageRoot, item));
  }
  copyIfExists(path.join(ROOT, 'node_modules', 'commander'), path.join(sandbox, 'node_modules', 'commander'));
  return sandbox;
}

function run(command, args, options = {}) {
  const startedAt = nowIso();
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: false,
    maxBuffer: 120 * 1024 * 1024,
  });
  return {
    command: [command, ...args].join(' '),
    cwd: normalize(path.relative(ROOT, options.cwd || ROOT)) || '.',
    exitCode: result.status === null ? 1 : result.status,
    stdoutHash: sha256Text(result.stdout || ''),
    stderrHash: sha256Text(result.stderr || ''),
    stdoutPreview: String(result.stdout || '').slice(0, 2000),
    stderrPreview: String(result.stderr || '').slice(0, 2000),
    startedAt,
    completedAt: nowIso(),
    status: result.status === 0 ? 'passed' : 'failed',
  };
}

function proofRow({ rowId, category, sandbox, probeTarget, commandRow }) {
  return {
    rowId,
    category,
    status: commandRow.status,
    installSandboxPath: normalize(path.relative(ROOT, sandbox)),
    probeTarget,
    usedRootScript: false,
    usedTsx: false,
    usedTsNode: false,
    usedCompiledFallback: false,
    command: commandRow.command,
    exitCode: commandRow.exitCode,
    stdoutHash: commandRow.stdoutHash,
    stderrHash: commandRow.stderrHash,
  };
}

function buildRuntimeActionMode(ledger) {
  const sandbox = prepareSandbox('runtime-action');
  const entry = ledger.entries.find((item) => item.originalClassBeforeMigration === 'consumer_runtime_reachable');
  const commandRow = run(process.execPath, ['-e', "require('bmad-speckit/dist/main-agent/index.js'); console.log('probe passed')"], {
    cwd: sandbox,
  });
  return {
    mode: 'installed-package-runtime-action-probe',
    status: commandRow.status,
    commandRows: [commandRow],
    rows: [
      proofRow({
        rowId: entry?.entryId || 'runtime-action-probe',
        category: 'consumer_runtime_reachable',
        sandbox,
        probeTarget: 'bmad-speckit/dist/main-agent/index.js',
        commandRow,
      }),
    ],
  };
}

function buildHelperMode(ledger) {
  const sandbox = prepareSandbox('package-helper');
  const entry = ledger.entries.find(
    (item) =>
      item.originalClassBeforeMigration === 'package_runtime_helper' &&
      (item.targetPaths || []).some((targetPath) => targetPath.startsWith('packages/bmad-speckit/src/main-agent/helpers/'))
  );
  const target = entry?.targetPaths?.find((targetPath) =>
    targetPath.startsWith('packages/bmad-speckit/src/main-agent/helpers/')
  );
  const packageTarget = target
    ? target.replace(/^packages\/bmad-speckit\/src\//u, 'bmad-speckit/src/')
    : 'bmad-speckit/src/main-agent/helpers/durable-helper-report.js';
  const commandRow = run(process.execPath, ['-e', `require(${JSON.stringify(packageTarget)}); console.log('probe passed')`], {
    cwd: sandbox,
  });
  return {
    mode: 'installed-package-helper-probe',
    status: commandRow.status,
    commandRows: [commandRow],
    rows: [
      proofRow({
        rowId: entry?.entryId || 'package-helper-probe',
        category: 'package_runtime_helper',
        sandbox,
        probeTarget: packageTarget,
        commandRow,
      }),
    ],
  };
}

function buildPublicCliMode(ledger) {
  const sandbox = prepareSandbox('package-cli');
  const entry = ledger.entries.find((item) => item.originalClassBeforeMigration === 'public_cli');
  const commandName = entry?.publicCommandsAfterMigration?.[0]?.replace(/^bmad-speckit\s+/u, '') || 'architecture-drift-check';
  const commandRow = run(
    process.execPath,
    [path.join(sandbox, 'node_modules', 'bmad-speckit', 'bin', 'bmad-speckit.js'), commandName, '--help'],
    { cwd: sandbox }
  );
  return {
    mode: 'installed-package-cli-probe',
    status: commandRow.status,
    commandRows: [commandRow],
    rows: [
      proofRow({
        rowId: entry?.entryId || 'package-cli-probe',
        category: 'public_cli',
        sandbox,
        probeTarget: `bmad-speckit ${commandName} --help`,
        commandRow,
      }),
    ],
  };
}

function categoryCoverage(modes) {
  const coverage = {};
  for (const mode of modes) {
    for (const row of mode.rows || []) {
      if (row.status !== 'passed') continue;
      if (!coverage[row.category]) coverage[row.category] = [];
      coverage[row.category].push(row.rowId);
    }
  }
  return coverage;
}

function buildMatrix() {
  const startedAt = nowIso();
  const ledger = readJson(LEDGER_PATH);
  const modes = [buildRuntimeActionMode(ledger), buildHelperMode(ledger), buildPublicCliMode(ledger)];
  return {
    schemaVersion: 'main-agent-runtime-migration-wave-3.12-install-matrix/v1',
    waveId: WAVE_ID,
    status: modes.every((mode) => mode.status === 'passed') ? 'passed' : 'failed',
    startedAt,
    completedAt: nowIso(),
    ledgerPath: LEDGER_PATH,
    queueHash: EXPECTED_QUEUE_HASH,
    packageCwd: 'packages/bmad-speckit',
    installSandboxRoot: INSTALL_SANDBOX_ROOT,
    categoryCoverage: categoryCoverage(modes),
    modes,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const matrix = buildMatrix();
  if (args.write) {
    safeWriteFile(MATRIX_PATH, formatJson(matrix), {
      operation: 'wave_3_12_install_matrix',
      requires: [WAVE_ID, EXPECTED_QUEUE_HASH, 'categoryCoverage'],
      minBytes: 100,
    });
  }
  process.stdout.write(
    `${JSON.stringify(
      { status: matrix.status, waveId: WAVE_ID, path: MATRIX_PATH, categoryCoverage: matrix.categoryCoverage },
      null,
      2
    )}\n`
  );
  process.exitCode = matrix.status === 'passed' ? 0 : 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
}
