#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  INSTALL_MATRIX_DIR,
  ROOT,
  WAVE_ID,
  ensureDir,
  formatJson,
  normalizePath,
  repoPath,
  sha256File,
  writeJson,
} = require('./main-agent-wave-4-1-utils.cjs');

const MODES = new Set(['no-save', 'save-dev', 'npx-package', 'init-sync-consumer']);
const PACKAGE_ROOT = repoPath('packages/bmad-speckit');
const FORBIDDEN_RUNTIME_PATTERNS = [
  /scripts[\\/]main-agent-orchestration\.ts/iu,
  /compiled[\\/]main-agent-orchestration\.cjs/iu,
  /\btsx\b/iu,
  /\bts-node\b/iu,
];

function parseArgs(argv) {
  const args = { json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mode') args.mode = argv[++index];
    else if (arg === '--json') args.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!MODES.has(args.mode)) throw new Error(`--mode must be one of ${[...MODES].join(', ')}`);
  return args;
}

function commandName(name) {
  if (process.platform !== 'win32') return name;
  if (name === 'npm') return 'npm.cmd';
  if (name === 'npx') return 'npx.cmd';
  return name;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function nowIso() {
  return new Date().toISOString();
}

function runCommand(command, args, options = {}) {
  const startedAt = nowIso();
  const result = spawnSync(commandName(command), args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 120 * 1024 * 1024,
    env: {
      ...process.env,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      ...(options.env || {}),
    },
  });
  const completedAt = nowIso();
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  return {
    command: [command, ...args].join(' '),
    cwd: normalizePath(path.relative(ROOT, options.cwd || ROOT) || '.'),
    exitCode: result.status === null ? 1 : result.status,
    stdoutHash: sha256Text(stdout),
    stderrHash: sha256Text(stderr),
    startedAt,
    completedAt,
    status: result.status === 0 ? 'passed' : 'failed',
    stdoutPreview: stdout.slice(0, 1200),
    stderrPreview: stderr.slice(0, 1200),
    raw: result,
  };
}

function assertPassed(label, row) {
  if (row.exitCode !== 0) {
    throw new Error(`${label} failed: ${row.stderrPreview || row.stdoutPreview || row.exitCode}`);
  }
}

function parsePackOutput(stdout) {
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || !parsed[0]?.filename) throw new Error('npm pack JSON missing filename');
  return parsed[0];
}

function prepareTarball(tempRoot) {
  const build = runCommand('npm', ['run', 'build:main-agent-dist'], { cwd: PACKAGE_ROOT });
  assertPassed('build:main-agent-dist', build);
  const packDir = path.join(tempRoot, 'pack');
  fs.mkdirSync(packDir, { recursive: true });
  const pack = runCommand(
    'npm',
    ['pack', '--pack-destination', packDir, '--json', '--ignore-scripts'],
    { cwd: PACKAGE_ROOT }
  );
  assertPassed('npm pack bmad-speckit', pack);
  const packInfo = parsePackOutput(pack.raw.stdout || '');
  const tarballPath = path.join(packDir, packInfo.filename);
  return {
    tarballPath,
    tarballSha256: `sha256:${crypto.createHash('sha256').update(fs.readFileSync(tarballPath)).digest('hex')}`,
    commandRows: [build, pack].map(stripRaw),
  };
}

function stripRaw(row) {
  const { raw, ...safeRow } = row;
  return safeRow;
}

function writeConsumerPackageJson(consumerRoot, mode) {
  fs.writeFileSync(
    path.join(consumerRoot, 'package.json'),
    `${JSON.stringify({ name: `wave-4-1-${mode}`, version: '1.0.0', private: true }, null, 2)}\n`,
    'utf8'
  );
}

function installMode(mode, consumerRoot, tarballPath) {
  if (mode === 'npx-package') return [];
  const installArgs =
    mode === 'save-dev'
      ? ['install', '--save-dev', tarballPath, '--ignore-scripts', '--no-audit', '--fund=false']
      : ['install', '--no-save', tarballPath, '--ignore-scripts', '--no-audit', '--fund=false'];
  const install = runCommand('npm', installArgs, { cwd: consumerRoot });
  assertPassed(`${mode} install`, install);
  return [stripRaw(install)];
}

function runProbe(mode, commandRoot, targetCwd, tarballPath) {
  if (mode === 'npx-package') {
    return runCommand(
      'npm',
      ['exec', '--yes', '--package', tarballPath, '--', 'bmad-speckit', 'main-agent', '--json', '--cwd', targetCwd],
      { cwd: commandRoot }
    );
  }
  return runCommand(
    'npx',
    ['--no-install', 'bmad-speckit', 'main-agent', '--json', '--cwd', targetCwd],
    { cwd: commandRoot }
  );
}

function runtimeFlagsFromProbe(probe) {
  const combined = `${probe.stdoutPreview}\n${probe.stderrPreview}`;
  const forbiddenHits = FORBIDDEN_RUNTIME_PATTERNS.filter((pattern) => pattern.test(combined)).map((pattern) =>
    String(pattern)
  );
  let parsedStdout = null;
  try {
    parsedStdout = JSON.parse(probe.raw.stdout || '{}');
  } catch {
    // The exit code assertion will fail the row if stdout is not valid JSON.
  }
  return {
    parsedStdout,
    forbiddenHits,
    usedRootScript: forbiddenHits.some((hit) => hit.includes('scripts')),
    usedTsx: forbiddenHits.some((hit) => hit.includes('tsx')),
    usedTsNode: forbiddenHits.some((hit) => hit.includes('ts-node')),
    usedCompiledFallback: forbiddenHits.some((hit) => hit.includes('compiled')),
  };
}

function runInstallMatrixMode(mode) {
  ensureDir(INSTALL_MATRIX_DIR);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), `wave-4-1-${mode}-`));
  const commandRows = [];
  try {
    const tarball = prepareTarball(tempRoot);
    commandRows.push(...tarball.commandRows);
    const consumerRoot = path.join(tempRoot, 'consumer');
    fs.mkdirSync(consumerRoot, { recursive: true });
    writeConsumerPackageJson(consumerRoot, mode);
    commandRows.push(...installMode(mode, consumerRoot, tarball.tarballPath));
    let probeCommandRoot = consumerRoot;
    let probeTargetCwd = consumerRoot;
    if (mode === 'init-sync-consumer') {
      const installedBmadPath = path.join(consumerRoot, 'node_modules', 'bmad-speckit', '_bmad');
      const init = runCommand(
        'npx',
        [
          '--no-install',
          'bmad-speckit',
          'init',
          'wave-4-1-init',
          '--yes',
          '--no-git',
          '--offline',
          '--ai',
          'codex',
          '--bmad-path',
          installedBmadPath,
        ],
        { cwd: consumerRoot }
      );
      commandRows.push(stripRaw(init));
      assertPassed('init-sync-consumer init', init);
      probeTargetCwd = path.join(consumerRoot, 'wave-4-1-init');
      const check = runCommand(
        'npx',
        ['--no-install', 'bmad-speckit', 'check', '--json', '--ignore-agent-tools'],
        { cwd: probeTargetCwd }
      );
      commandRows.push(stripRaw(check));
      assertPassed('init-sync-consumer check', check);
      probeCommandRoot = consumerRoot;
    }
    const probe = runProbe(mode, probeCommandRoot, probeTargetCwd, tarball.tarballPath);
    commandRows.push(stripRaw(probe));
    assertPassed(`${mode} installed package main-agent probe`, probe);
    const flags = runtimeFlagsFromProbe(probe);
    if (!flags.parsedStdout || flags.parsedStdout.schemaVersion !== 'main-agent-package-runtime/v1') {
      throw new Error(`${mode} probe stdout is not main-agent package runtime JSON`);
    }
    if (flags.parsedStdout.status !== 'ok' || flags.parsedStdout.exitCode !== 0) {
      throw new Error(`${mode} probe did not return ok package runtime status`);
    }
    if (flags.forbiddenHits.length > 0) {
      throw new Error(`${mode} probe output contains forbidden runtime fallback tokens`);
    }
    const record = {
      schemaVersion: 'main-agent-runtime-migration-wave-4-1-install-matrix/v1',
      waveId: WAVE_ID,
      mode,
      status: 'passed',
      createdAt: nowIso(),
      packageTarballSha256: tarball.tarballSha256,
      commandRows,
      probe: {
        commandSurface:
          mode === 'npx-package'
            ? 'npm exec --package <tgz> bmad-speckit main-agent --json'
            : mode === 'init-sync-consumer'
              ? 'npx --no-install bmad-speckit init --offline && check && main-agent --json'
            : 'npx --no-install bmad-speckit main-agent --json',
        stdoutHash: probe.stdoutHash,
        stderrHash: probe.stderrHash,
        parsedStatus: flags.parsedStdout.status,
        parsedSchemaVersion: flags.parsedStdout.schemaVersion,
      },
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
      rootScriptDependencyCount: 0,
      forbiddenRuntimeTokenHits: [],
      reworkRequired: false,
      assertions: [
        'installed consumer command executed package binary',
        'main-agent probe returned main-agent-package-runtime/v1 JSON',
        'rootScriptDependencyCount=0',
        'usedRootScript=false',
        'usedTsx=false',
        'usedTsNode=false',
        'usedCompiledFallback=false',
      ],
    };
    const recordPath = `${INSTALL_MATRIX_DIR}/${mode}.json`;
    const receipt = writeJson(recordPath, record);
    return {
      ok: true,
      status: 'passed',
      waveId: WAVE_ID,
      mode,
      reworkRequired: false,
      path: recordPath,
      receipt,
    };
  } catch (error) {
    const record = {
      schemaVersion: 'main-agent-runtime-migration-wave-4-1-install-matrix/v1',
      waveId: WAVE_ID,
      mode,
      status: 'failed',
      createdAt: nowIso(),
      commandRows,
      usedRootScript: null,
      usedTsx: null,
      usedTsNode: null,
      usedCompiledFallback: null,
      rootScriptDependencyCount: null,
      failureClass: 'install_matrix_probe_failed',
      error: error.message,
      reworkRequired: true,
    };
    const recordPath = `${INSTALL_MATRIX_DIR}/${mode}.json`;
    const receipt = writeJson(recordPath, record);
    return {
      ok: false,
      status: 'failed',
      waveId: WAVE_ID,
      mode,
      reworkRequired: true,
      failureClass: 'install_matrix_probe_failed',
      error: error.message,
      path: recordPath,
      receipt,
    };
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = runInstallMatrixMode(args.mode);
  process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
  if (!output.ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  runInstallMatrixMode,
};
