const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const Module = require('node:module');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SRC_ENTRY = path.join(PACKAGE_ROOT, 'src', 'main-agent', 'index.js');
const ACTIONS = [
  'live-smoke-main-agent-runtime',
  'ai-tdd-closeout-remediation-adapter',
  'audit-review-gate',
  'bmad-artifact-hardcut',
  'control-plane-isolation-check',
  'data-governance-gate',
  'dataset-release-gate',
  'decision-field-check',
  'development-journey-matrix',
  'entryflow-traceability-check',
  'execution-closure-gate',
  'functional-resume-check',
  'governed-data-products',
  'production-loop-ready-check',
  'runtime-policy-snapshot-check',
  'scoring-gates-check',
  'trace-status-policy-check',
  'orchestration-dispatch-contract',
  'orchestration-governance-contract',
  'orchestration-state',
  'record-main-agent-inspect-readiness-closure',
  'skill-orchestration-audit',
];
const ACTION_FILES = ['actions/package-runtime-report.js', ...ACTIONS.map((action) => `actions/${action}.js`)];
const TYPE_SCRIPT_RUNNER_PATTERN = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
const TS_NODE_PATTERN = new RegExp(['t', 's', '-', 'n', 'o', 'd', 'e'].join(''));

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-6-'));
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

describe('main-agent wave 3.6 package runtime actions', () => {
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

  it('supports wave 3.6 actions from package source runtime with stable envelopes', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of ACTIONS) {
        const result = await runWithoutCompiledFallback(SRC_ENTRY, [action, '--cwd', root, '--json']);
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
        assert.equal(body.data.report.supportedConsumerInvocation, `bmad-speckit main-agent ${action}`);
        assert.equal(body.data.report.consumerRuntimeProof.usedRootScript, false);
        assert.equal(body.data.report.consumerRuntimeProof.usedCompiledFallback, false);
        assert.equal(body.data.report.consumerRuntimeProof.usedTypeScriptRunner, false);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
