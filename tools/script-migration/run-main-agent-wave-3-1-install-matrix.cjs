#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.1';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INSTALL_MATRIX_DIR = path.join(WAVE_DIR, 'install-matrix');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npmCacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wave31-npm-cache-'));

const COMMANDS = [
  {
    id: 'release-gate',
    args: ['main-agent:release-gate', '--json'],
    kind: 'json',
    expected: { schemaVersion: 'main-agent-package-runtime/v1', action: 'release-gate' },
    coveredAction: true,
  },
  {
    id: 'quality-gate',
    args: ['main-agent:quality-gate', '--json'],
    kind: 'json',
    expected: { schemaVersion: 'main-agent-package-runtime/v1', action: 'quality-gate' },
    coveredAction: true,
  },
  {
    id: 'delivery-truth-gate',
    args: ['main-agent:delivery-truth-gate', '--json'],
    kind: 'json',
    expected: {
      schemaVersion: 'main-agent-package-runtime/v1',
      action: 'delivery-truth-gate',
    },
    coveredAction: true,
  },
  {
    id: 'run-auditor-host-help',
    args: ['run-auditor-host', '--help'],
    kind: 'help',
  },
  {
    id: 'write-runtime-context',
    args: ({ cwd }) => [
      'write-runtime-context',
      path.join(cwd, '.tmp', 'runtime-context.json'),
      'story',
      'specify',
    ],
    kind: 'writes-file',
    outputPath: ({ cwd }) => path.join(cwd, '.tmp', 'runtime-context.json'),
  },
  {
    id: 'eval-questions-deprecated',
    args: ['eval-questions', '--json'],
    kind: 'deprecated-json',
    expected: { schemaVersion: 'bmad-speckit-deprecated-alias/v1', status: 'deprecated' },
  },
  {
    id: 'bmad-help-five-layer-matrix-deprecated',
    args: ['main-agent:bmad-help-five-layer-matrix', '--json'],
    kind: 'deprecated-json',
    expected: { schemaVersion: 'bmad-speckit-deprecated-alias/v1', status: 'deprecated' },
  },
  {
    id: 'host-matrix-pr-orchestrate-deprecated',
    args: ['main-agent:host-matrix-pr-orchestrate', '--json'],
    kind: 'deprecated-json',
    expected: { schemaVersion: 'bmad-speckit-deprecated-alias/v1', status: 'deprecated' },
  },
  {
    id: 'bmads-auto-deprecated',
    args: ['bmads-auto', '--json'],
    kind: 'deprecated-json',
    expected: { schemaVersion: 'bmad-speckit-deprecated-alias/v1', status: 'deprecated' },
  },
];

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(String(value || ''), 'utf8').digest('hex')}`;
}

function quoteArg(arg) {
  return /\s/u.test(String(arg)) ? JSON.stringify(String(arg)) : String(arg);
}

function runProcess(command, args, cwd, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
      npm_config_cache: npmCacheDir,
      npm_config_audit: 'false',
      npm_config_fund: 'false',
      BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      ...extraEnv,
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args.map(quoteArg)].join(' '),
    exitCode: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || result.error?.message || ''),
  };
}

function expectSuccess(result) {
  if (result.exitCode !== 0) {
    throw new Error(`${result.command}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  return result;
}

function parsePackOutput(stdout) {
  const start = stdout.indexOf('[');
  if (start < 0) throw new Error('npm pack output missing JSON array');
  return JSON.parse(stdout.slice(start));
}

function latestTarball() {
  if (!fs.existsSync(WAVE_DIR)) return null;
  return fs
    .readdirSync(WAVE_DIR)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => path.join(WAVE_DIR, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
}

function prepareTarball() {
  fs.mkdirSync(WAVE_DIR, { recursive: true });
  expectSuccess(runProcess(npmCmd, ['run', 'build:main-agent-dist', '--prefix', 'packages/bmad-speckit'], ROOT));
  const pack = expectSuccess(
    runProcess(npmCmd, ['pack', '--pack-destination', WAVE_DIR, '--json', '--ignore-scripts'], PACKAGE_ROOT)
  );
  const parsed = parsePackOutput(pack.stdout);
  const filename = parsed[0]?.filename;
  const tarball = filename ? path.join(WAVE_DIR, filename) : latestTarball();
  if (!tarball || !fs.existsSync(tarball)) throw new Error('npm pack did not produce a package tarball');
  return {
    tarball,
    packageName: parsed[0]?.name || 'bmad-speckit',
    packageVersion: parsed[0]?.version || null,
    packResult: pack,
  };
}

function writeConsumerPackageJson(target, name) {
  fs.writeFileSync(
    path.join(target, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', private: true }, null, 2),
    'utf8'
  );
}

function resolveInstalledPackageRuntime(target) {
  const candidates = [
    path.join(target, 'node_modules', 'bmad-speckit'),
    path.join(target, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit'),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'dist', 'main-agent', 'index.js'))) ?? 'unresolved';
}

function ensureRuntimeProbe(target) {
  const probePath = path.join(target, 'wave31-runtime-probe.cjs');
  const logPath = path.join(target, 'wave31-runtime-probe.ndjson');
  fs.writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const childProcess = require('node:child_process');",
      "const Module = require('node:module');",
      "const logPath = process.env.BMAD_WAVE31_RUNTIME_PROBE_LOG;",
      "const ROOT_SCRIPT_RE = /(^|[\\\\/])scripts[\\\\/](main-agent-release-gate|main-agent-quality-gate|main-agent-delivery-truth-gate|run-auditor-host|write-runtime-context|eval-questions-cli|main-agent-bmad-help-five-layer-matrix|main-agent-host-matrix-pr-orchestrator|bmads-auto-cli)\\.(ts|cjs)\\b/i;",
      "const TSX_RE = /(^|[\\\\/])tsx(?:\\.cmd)?$|\\btsx\\b/i;",
      "const TS_NODE_RE = /(^|[\\\\/])ts-node(?:\\.cmd)?$|\\bts-node\\b/i;",
      "const COMPILED_FALLBACK_RE = /compiled[\\\\/]main-agent-orchestration\\.cjs/i;",
      'function stringify(value) { try { return JSON.stringify(value); } catch { return String(value); } }',
      'function flags(args) {',
      '  const text = Array.isArray(args) ? args.map(stringify).join(" ") : stringify(args);',
      '  return {',
      '    usedRootScript: ROOT_SCRIPT_RE.test(text),',
      '    usedTsx: TSX_RE.test(text),',
      '    usedTsNode: TS_NODE_RE.test(text),',
      '    usedCompiledFallback: COMPILED_FALLBACK_RE.test(text),',
      '    text,',
      '  };',
      '}',
      'function record(kind, args) {',
      '  if (!logPath) return;',
      '  const result = flags(args);',
      '  if (!result.usedRootScript && !result.usedTsx && !result.usedTsNode && !result.usedCompiledFallback) return;',
      '  fs.appendFileSync(logPath, JSON.stringify({ kind, cwd: process.cwd(), ...result }) + "\\n", "utf8");',
      '}',
      'record("process.argv", process.argv);',
      'for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync"]) {',
      '  const original = childProcess[name];',
      '  if (typeof original !== "function") continue;',
      '  childProcess[name] = function patchedChildProcess(...args) {',
      '    record(`child_process.${name}`, args);',
      '    return original.apply(this, args);',
      '  };',
      '}',
      'const originalLoad = Module._load;',
      'Module._load = function patchedModuleLoad(request, parent, isMain) {',
      '  record("module.load", [request, parent && parent.filename]);',
      '  return originalLoad.call(this, request, parent, isMain);',
      '};',
      '',
    ].join('\n'),
    'utf8'
  );
  fs.rmSync(logPath, { force: true });
  return { probePath, logPath };
}

function readProbeFlags(logPath) {
  if (!fs.existsSync(logPath)) {
    return {
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
      probeHits: [],
    };
  }
  const probeHits = fs
    .readFileSync(logPath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    usedRootScript: probeHits.some((hit) => hit.usedRootScript),
    usedTsx: probeHits.some((hit) => hit.usedTsx),
    usedTsNode: probeHits.some((hit) => hit.usedTsNode),
    usedCompiledFallback: probeHits.some((hit) => hit.usedCompiledFallback),
    probeHits,
  };
}

function parseJsonFromStdout(stdout) {
  const trimmed = String(stdout || '').trim();
  for (let index = trimmed.indexOf('{'); index >= 0; index = trimmed.indexOf('{', index + 1)) {
    try {
      return JSON.parse(trimmed.slice(index));
    } catch {
      // Keep scanning; npm/npx can prepend non-JSON lines.
    }
  }
  throw new Error(`stdout did not contain a JSON object:\n${stdout}`);
}

function commandArgsForMode(mode, tarball, commandArgs) {
  if (mode === 'npx-package') return [npxCmd, ['--yes', '--package', tarball, 'bmad-speckit', ...commandArgs]];
  return [npxCmd, ['--no-install', 'bmad-speckit', ...commandArgs]];
}

function checkCommand(command, result, flags, cwd) {
  if (result.exitCode !== 0) {
    throw new Error(`${result.command}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`);
  }
  if (flags.usedRootScript || flags.usedTsx || flags.usedTsNode || flags.usedCompiledFallback) {
    throw new Error(`forbidden runtime probe hit for ${command.id}: ${JSON.stringify(flags.probeHits, null, 2)}`);
  }
  if (command.kind === 'json' || command.kind === 'deprecated-json') {
    const parsed = parseJsonFromStdout(result.stdout);
    for (const [key, value] of Object.entries(command.expected || {})) {
      if (parsed[key] !== value) {
        throw new Error(`${command.id} expected ${key}=${value}, got ${parsed[key]}`);
      }
    }
    return parsed;
  }
  if (command.kind === 'help') {
    if (/scripts[\\/]/u.test(result.stdout) || /scripts[\\/]/u.test(result.stderr)) {
      throw new Error(`${command.id} help leaked root scripts path`);
    }
    return null;
  }
  if (command.kind === 'writes-file') {
    const outputPath = command.outputPath({ cwd });
    if (!fs.existsSync(outputPath)) throw new Error(`${command.id} did not write ${outputPath}`);
    return { outputPath: slash(outputPath) };
  }
  return null;
}

function commandRow(command, result, flags, parsed) {
  return {
    commandId: command.id,
    command: result.command,
    exitCode: result.exitCode,
    stdoutHash: sha256(result.stdout),
    stderrHash: sha256(result.stderr),
    stdoutPreview: result.stdout.slice(0, 500),
    stderrPreview: result.stderr.slice(0, 500),
    parsed,
    usedRootScript: flags.usedRootScript,
    usedTsx: flags.usedTsx,
    usedTsNode: flags.usedTsNode,
    usedCompiledFallback: flags.usedCompiledFallback,
    coveredAction: Boolean(command.coveredAction),
    probeHits: flags.probeHits,
  };
}

function runObservedCommand(mode, tarball, command, cwd) {
  const { probePath, logPath } = ensureRuntimeProbe(cwd);
  const commandArgs = typeof command.args === 'function' ? command.args({ cwd }) : command.args;
  const [runner, args] = commandArgsForMode(mode, tarball, commandArgs);
  const result = runProcess(runner, args, cwd, {
    BMAD_WAVE31_RUNTIME_PROBE_LOG: logPath,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${probePath}`,
  });
  const flags = readProbeFlags(logPath);
  const parsed = checkCommand(command, result, flags, cwd);
  return commandRow(command, result, flags, parsed);
}

function aggregateFlags(commands) {
  return {
    usedRootScript: commands.some((row) => row.usedRootScript),
    usedTsx: commands.some((row) => row.usedTsx),
    usedTsNode: commands.some((row) => row.usedTsNode),
    usedCompiledFallback: commands.some((row) => row.usedCompiledFallback),
  };
}

function writeReceipt(receipt) {
  fs.mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
  const filePath = path.join(INSTALL_MATRIX_DIR, `${receipt.installMode}.json`);
  fs.writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return filePath;
}

function withConsumer(name, callback) {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), `${name}-`));
  try {
    writeConsumerPackageJson(target, name);
    return callback(target);
  } finally {
    fs.rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

function runMode(mode, tarball) {
  return withConsumer(`wave31-${mode}`, (consumerRoot) => {
    if (mode === 'save-dev') {
      expectSuccess(runProcess(npmCmd, ['install', '--save-dev', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], consumerRoot));
    }
    if (mode === 'no-save') {
      expectSuccess(runProcess(npmCmd, ['install', '--no-save', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], consumerRoot));
    }

    const packagePath = mode === 'npx-package' ? tarball : resolveInstalledPackageRuntime(consumerRoot);
    if (mode !== 'npx-package' && packagePath === 'unresolved') {
      throw new Error(`${mode} install did not expose package dist runtime`);
    }

    const commands = COMMANDS.map((command) => runObservedCommand(mode, tarball, command, consumerRoot));
    const flags = aggregateFlags(commands);
    const receipt = {
      schemaVersion: 'main-agent-runtime-migration-wave-3.1-install-matrix/v1',
      waveId: WAVE_ID,
      installMode: mode,
      packageSpec: slash(tarball),
      packagePath: slash(packagePath),
      consumerRoot: slash(consumerRoot),
      commandCount: commands.length,
      ...flags,
      commands,
      result: flags.usedRootScript || flags.usedTsx || flags.usedTsNode || flags.usedCompiledFallback ? 'failed' : 'passed',
    };
    const receiptPath = writeReceipt(receipt);
    return slash(path.relative(ROOT, receiptPath));
  });
}

function main() {
  const errors = [];
  const receipts = [];
  let packageInfo = null;
  try {
    fs.rmSync(INSTALL_MATRIX_DIR, { recursive: true, force: true });
    fs.mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
    packageInfo = prepareTarball();
    for (const mode of ['save-dev', 'npx-package', 'no-save']) {
      receipts.push(runMode(mode, packageInfo.tarball));
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  } finally {
    fs.rmSync(npmCacheDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }

  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    waveId: WAVE_ID,
    packageTarball: packageInfo ? slash(path.relative(ROOT, packageInfo.tarball)) : null,
    receipts,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (errors.length > 0) process.exit(1);
}

main();
