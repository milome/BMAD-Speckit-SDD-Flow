const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DIST_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'index.js');
const ACTIONS = [
  'unified-ingress',
  'delivery-closeout-gate',
  'delivery-evidence-run',
  'soak-runner',
  'dual-host-pr-orchestrator',
  'chaos-scenarios',
];
const ACTION_FILES = [
  'actions/unified-ingress.js',
  'actions/delivery-closeout-gate.js',
  'actions/delivery-evidence-run.js',
  'actions/soak-runner.js',
  'actions/dual-host-pr-orchestrator.js',
  'actions/chaos-scenarios.js',
];
const TYPE_SCRIPT_RUNNER_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-4-'));
}

async function captureRuntime(argv) {
  const { mainAgentRuntimeCommand } = require(DIST_ENTRY);
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

describe('main-agent wave 3.4 installed surface actions', () => {
  it('ships package source and dist action files for every package_runtime_module route', () => {
    for (const relativePath of ACTION_FILES) {
      for (const base of ['src/main-agent', 'dist/main-agent']) {
        const filePath = path.join(PACKAGE_ROOT, base, relativePath);
        assert.equal(fs.existsSync(filePath), true, `missing ${base}/${relativePath}`);
        const source = fs.readFileSync(filePath, 'utf8');

        assert.doesNotMatch(source, /scripts[\\/].*\.ts/);
        assert.doesNotMatch(source, /runRepoScript\(/);
        assert.doesNotMatch(source, TYPE_SCRIPT_RUNNER_PATTERN);
        assert.doesNotMatch(source, TS_NODE_PATTERN);
        assert.doesNotMatch(source, /compiled[\\/]main-agent-orchestration\.cjs/);
      }
    }
  });

  it('supports wave 3.4 package runtime routes with stable envelopes', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of ACTIONS) {
        const result = await captureRuntime([action, '--cwd', root, '--json']);
        const body = JSON.parse(result.stdout);

        assert.equal(result.stderr, '');
        assert.equal(result.exitCode, 0);
        assert.equal(body.schemaVersion, 'main-agent-package-runtime/v1');
        assert.equal(body.action, action);
        assert.equal(body.cwd, root);
        assert.equal(body.status, 'package_runtime_ready');
        assert.equal(body.exitCode, 0);
        assert.deepEqual(body.errors, []);
        assert.equal(body.data.report.mode, 'package_runtime_module');
        assert.equal(body.data.report.consumerRuntimeProof.usedRootScript, false);
        assert.equal(body.data.report.consumerRuntimeProof.usedCompiledFallback, false);
        assert.equal(body.data.report.consumerRuntimeProof.usedTypeScriptRunner, false);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
