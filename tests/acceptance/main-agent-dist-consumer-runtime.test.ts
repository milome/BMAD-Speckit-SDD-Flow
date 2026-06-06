import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const WAVE_ID = 'main-agent-source-authority-wave-2';
const WAVE_DIR = join(REPO_ROOT, '.tmp', WAVE_ID);
const INSTALL_MATRIX_DIR = join(WAVE_DIR, 'install-matrix');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npmCacheDir = mkdtempSync(join(tmpdir(), 'wave2-main-agent-npm-cache-'));

type ProcessResult = {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
};

type ProbeFlags = {
  usedRootScript: boolean;
  usedTsx: boolean;
  usedTsNode: boolean;
  usedCompiledFallback: boolean;
  probeHits: unknown[];
};

function slash(value: string): string {
  return value.replace(/\\/g, '/');
}

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function runProcess(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {}
): ProcessResult {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      npm_config_loglevel: 'error',
      npm_config_cache: npmCacheDir,
      BMAD_SKIP_CONSUMER_MCP_INSTALL: '1',
      ...env,
    },
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    command: [command, ...args.map((arg) => (/\s/.test(arg) ? JSON.stringify(arg) : arg))].join(
      ' '
    ),
    exitCode: result.status ?? 1,
    stdout: String(result.stdout || ''),
    stderr: String(result.stderr || result.error?.message || ''),
  };
}

function expectSuccess(result: ProcessResult): ProcessResult {
  expect(
    result.exitCode,
    `${result.command}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  ).toBe(0);
  return result;
}

function latestTarball(): string | null {
  if (!existsSync(WAVE_DIR)) return null;
  const candidates = readdirSync(WAVE_DIR)
    .filter((name) => name.endsWith('.tgz'))
    .map((name) => join(WAVE_DIR, name))
    .sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);
  return candidates[0] ?? null;
}

function prepareRootPackageTarball(): string {
  mkdirSync(WAVE_DIR, { recursive: true });
  const existing = latestTarball();
  if (existing) return existing;
  expectSuccess(runProcess(npmCmd, ['run', 'build:main-agent-dist', '--prefix', 'packages/bmad-speckit'], REPO_ROOT));
  expectSuccess(runProcess(npmCmd, ['pack', '--pack-destination', WAVE_DIR], REPO_ROOT));
  const tarball = latestTarball();
  if (!tarball) throw new Error('npm pack did not create a root package tarball');
  return tarball;
}

function writeConsumerPackageJson(target: string, name: string): void {
  writeFileSync(
    join(target, 'package.json'),
    JSON.stringify({ name, version: '1.0.0', private: true }, null, 2),
    'utf8'
  );
}

function resolveInstalledPackageRuntime(target: string): string {
  const candidates = [
    join(target, 'node_modules', 'bmad-speckit-sdd-flow', 'node_modules', 'bmad-speckit'),
    join(target, 'node_modules', 'bmad-speckit'),
  ];
  return candidates.find((candidate) => existsSync(join(candidate, 'dist', 'main-agent', 'index.js'))) ?? 'unresolved';
}

function ensureRuntimeProbe(target: string): { probePath: string; logPath: string } {
  const probePath = join(target, 'main-agent-runtime-probe.cjs');
  const logPath = join(target, 'main-agent-runtime-probe.ndjson');
  writeFileSync(
    probePath,
    [
      "const fs = require('node:fs');",
      "const childProcess = require('node:child_process');",
      "const Module = require('node:module');",
      "const logPath = process.env.BMAD_WAVE2_RUNTIME_PROBE_LOG;",
      "const ROOT_SCRIPT_RE = /(^|[\\\\/])scripts[\\\\/]main-agent-orchestration\\.ts\\b/i;",
      "const TSX_RE = /(^|[\\\\/])tsx(?:\\.cmd)?$|\\btsx\\b/i;",
      "const TS_NODE_RE = /(^|[\\\\/])ts-node(?:\\.cmd)?$|\\bts-node\\b/i;",
      "const COMPILED_FALLBACK_RE = /compiled[\\\\/]main-agent-orchestration\\.cjs/i;",
      'function stringify(value) {',
      '  try { return JSON.stringify(value); } catch { return String(value); }',
      '}',
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
  rmSync(logPath, { force: true });
  return { probePath, logPath };
}

function readProbeFlags(logPath: string): ProbeFlags {
  if (!existsSync(logPath)) {
    return {
      usedRootScript: false,
      usedTsx: false,
      usedTsNode: false,
      usedCompiledFallback: false,
      probeHits: [],
    };
  }
  const probeHits = readFileSync(logPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return {
    usedRootScript: probeHits.some((hit: any) => hit.usedRootScript),
    usedTsx: probeHits.some((hit: any) => hit.usedTsx),
    usedTsNode: probeHits.some((hit: any) => hit.usedTsNode),
    usedCompiledFallback: probeHits.some((hit: any) => hit.usedCompiledFallback),
    probeHits,
  };
}

function parseLastJson(stdout: string): any {
  const trimmed = stdout.trim();
  for (let index = trimmed.indexOf('{'); index >= 0; index = trimmed.indexOf('{', index + 1)) {
    try {
      return JSON.parse(trimmed.slice(index));
    } catch {
      // npm/npx can prepend non-JSON lines; keep scanning for the runtime envelope.
    }
  }
  throw new Error(`runtime stdout did not contain a JSON envelope:\n${stdout}`);
}

function writeInstallEvidence(row: {
  installMode: string;
  commandId: string;
  command: string;
  packageSpec: string;
  packagePath: string;
  consumerRoot: string;
  result: ProcessResult;
  parsed: any;
  flags: ProbeFlags;
}): void {
  mkdirSync(INSTALL_MATRIX_DIR, { recursive: true });
  const filePath = join(INSTALL_MATRIX_DIR, `${row.installMode}-${row.commandId}.json`);
  const evidence = {
    installMode: row.installMode,
    commandId: row.commandId,
    command: row.command,
    packageSpec: row.packageSpec,
    packagePath: row.packagePath,
    consumerRoot: row.consumerRoot,
    exitCode: row.result.exitCode,
    stdoutHash: sha256(row.result.stdout),
    stderrHash: sha256(row.result.stderr),
    schemaVersion: row.parsed.schemaVersion,
    action: row.parsed.action,
    cwd: row.parsed.cwd,
    status: row.parsed.status,
    usedRootScript: row.flags.usedRootScript,
    usedTsx: row.flags.usedTsx,
    usedTsNode: row.flags.usedTsNode,
    usedCompiledFallback: row.flags.usedCompiledFallback,
    probeHits: row.flags.probeHits,
  };
  writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

function runObservedMainAgentInspect(
  installMode: string,
  commandId: string,
  command: string,
  args: string[],
  target: string,
  packageSpec: string,
  packagePath: string
): void {
  const { probePath, logPath } = ensureRuntimeProbe(target);
  const result = runProcess(command, args, target, {
    BMAD_WAVE2_RUNTIME_PROBE_LOG: logPath,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ? `${process.env.NODE_OPTIONS} ` : ''}--require=${probePath}`,
  });
  const parsed = parseLastJson(result.stdout);
  const flags = readProbeFlags(logPath);
  writeInstallEvidence({
    installMode,
    commandId,
    command: result.command,
    packageSpec,
    packagePath,
    consumerRoot: target,
    result,
    parsed,
    flags,
  });

  expectSuccess(result);
  expect(parsed).toMatchObject({
    schemaVersion: 'main-agent-package-runtime/v1',
    action: 'inspect',
    status: 'ok',
  });
  expect(slash(parsed.cwd)).toBe(slash(target));
  expect(typeof parsed.exitCode).toBe('number');
  expect(Array.isArray(parsed.errors)).toBe(true);
  expect(flags.usedRootScript, `${result.command} executed scripts/main-agent-orchestration.ts`).toBe(false);
  expect(flags.usedTsx, `${result.command} executed tsx`).toBe(false);
  expect(flags.usedTsNode, `${result.command} executed ts-node`).toBe(false);
  expect(flags.usedCompiledFallback, `${result.command} entered compiled fallback`).toBe(false);
}

describe('main-agent source authority wave 2 consumer dist runtime', () => {
  it('writes save-dev, npx --package, and tgz evidence for package-local dist runtime', () => {
    const tarball = prepareRootPackageTarball();
    const packageSpec = slash(tarball);

    const saveDev = mkdtempSync(join(tmpdir(), 'wave2-main-agent-save-dev-'));
    try {
      writeConsumerPackageJson(saveDev, 'wave2-main-agent-save-dev');
      expectSuccess(runProcess(npmCmd, ['install', '--save-dev', tarball], saveDev));
      const packagePath = resolveInstalledPackageRuntime(saveDev);
      expect(packagePath).not.toBe('unresolved');
      runObservedMainAgentInspect(
        'save-dev',
        'main-agent-inspect',
        npxCmd,
        ['--no-install', 'bmad-speckit', 'main-agent', 'inspect', '--json'],
        saveDev,
        packageSpec,
        packagePath
      );
    } finally {
      rmSync(saveDev, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }

    const npxConsumer = mkdtempSync(join(tmpdir(), 'wave2-main-agent-npx-package-'));
    try {
      writeConsumerPackageJson(npxConsumer, 'wave2-main-agent-npx-package');
      runObservedMainAgentInspect(
        'npx-package',
        'main-agent-inspect',
        npxCmd,
        ['--yes', '--package', tarball, 'bmad-speckit', 'main-agent', 'inspect', '--json'],
        npxConsumer,
        packageSpec,
        packageSpec
      );
    } finally {
      rmSync(npxConsumer, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }

    const tgzConsumer = mkdtempSync(join(tmpdir(), 'wave2-main-agent-tgz-'));
    try {
      writeConsumerPackageJson(tgzConsumer, 'wave2-main-agent-tgz');
      expectSuccess(runProcess(npmCmd, ['install', '--no-save', tarball], tgzConsumer));
      const packagePath = resolveInstalledPackageRuntime(tgzConsumer);
      expect(packagePath).not.toBe('unresolved');
      runObservedMainAgentInspect(
        'tgz',
        'main-agent-inspect',
        npxCmd,
        ['--no-install', 'bmad-speckit', 'main-agent', 'inspect', '--json'],
        tgzConsumer,
        packageSpec,
        packagePath
      );
    } finally {
      rmSync(tgzConsumer, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    }
  }, 900_000);
});
