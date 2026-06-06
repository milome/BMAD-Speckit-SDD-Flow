const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SRC_ENTRY = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'index.js');
const DIST_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'index.js');
const ACTIONS = [
  'codex-worker-adapter',
  'compiled-prompt-runner',
  'implementation-readiness-gate',
];
const ACTION_FILES = [
  'actions/codex-worker-adapter.js',
  'actions/compiled-prompt-runner.js',
  'actions/implementation-readiness-gate.js',
];
const TYPE_SCRIPT_RUNNER_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-3-'));
}

async function captureRuntime(entry, argv) {
  const { mainAgentRuntimeCommand } = require(entry);
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function captureStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  process.stderr.write = function captureStderr(chunk, ...rest) {
    stderr += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  try {
    const exitCode = await mainAgentRuntimeCommand(argv);
    return { exitCode, stdout, stderr };
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

async function runWithoutCompiledFallback(entry, argv) {
  const originalLoad = Module._load;
  Module._load = function guardedLoad(request, parent, isMain) {
    const normalized = String(request || '').replace(/\\/g, '/');
    if (normalized.includes('compiled/main-agent-orchestration.cjs')) {
      throw new Error(`covered action entered compiled fallback: ${request}`);
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return await captureRuntime(entry, argv);
  } finally {
    Module._load = originalLoad;
  }
}

function assertEnvelope(body, action, root, exitCode) {
  assert.equal(body.schemaVersion, 'main-agent-package-runtime/v1');
  assert.equal(body.action, action);
  assert.equal(body.cwd, root);
  assert.equal(body.status, 'package_runtime_ready');
  assert.equal(body.exitCode, 0);
  assert.equal(exitCode, body.exitCode);
  assert.deepEqual(body.errors, []);
  assert.equal(body.data.report.mode, 'package_runtime_module');
  assert.equal(body.data.report.consumerRuntimeProof.usedRootScript, false);
  assert.equal(body.data.report.consumerRuntimeProof.usedCompiledFallback, false);
  assert.equal(body.data.report.consumerRuntimeProof.usedTypeScriptRunner, false);
}

describe('main-agent wave 3.3 package runtime actions', () => {
  it('ships package source action files without root TypeScript dispatch', () => {
    for (const relativePath of ACTION_FILES) {
      const sourcePath = path.join(PACKAGE_ROOT, 'src', 'main-agent', relativePath);
      assert.equal(fs.existsSync(sourcePath), true, `missing ${relativePath}`);
      const source = fs.readFileSync(sourcePath, 'utf8');

      assert.doesNotMatch(source, /scripts[\\/].*\.ts/);
      assert.doesNotMatch(source, /runRepoScript\(/);
      assert.doesNotMatch(source, TYPE_SCRIPT_RUNNER_PATTERN);
      assert.doesNotMatch(source, TS_NODE_PATTERN);
      assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/);
    }
  });

  it('supports wave 3.3 actions from package source runtime with stable envelopes', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of ACTIONS) {
        const result = await runWithoutCompiledFallback(SRC_ENTRY, [action, '--cwd', root, '--json']);
        const body = JSON.parse(result.stdout);
        assert.equal(result.stderr, '');
        assertEnvelope(body, action, root, result.exitCode);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('supports wave 3.3 actions from package dist runtime with stable envelopes', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of ACTIONS) {
        const result = await runWithoutCompiledFallback(DIST_ENTRY, [action, '--cwd', root, '--json']);
        const body = JSON.parse(result.stdout);
        assert.equal(result.stderr, '');
        assertEnvelope(body, action, root, result.exitCode);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
