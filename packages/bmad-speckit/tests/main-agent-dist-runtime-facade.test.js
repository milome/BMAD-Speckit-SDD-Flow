const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DIST_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'index.js');

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-dist-runtime-'));
}

async function captureRuntime(argv) {
  const { mainAgentRuntimeCommand } = require(DIST_ENTRY);
  let stdout = '';
  let stderr = '';
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  process.stdout.write = function writeStdout(chunk, ...rest) {
    stdout += String(chunk);
    const callback = rest.find((value) => typeof value === 'function');
    if (callback) callback();
    return true;
  };
  process.stderr.write = function writeStderr(chunk, ...rest) {
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

function parseStdoutJson(result) {
  assert.equal(result.stderr, '');
  return JSON.parse(result.stdout);
}

describe('main-agent dist runtime facade', () => {
  it('exports mainAgentRuntimeCommand from dist/main-agent/index.js', () => {
    assert.equal(fs.existsSync(DIST_ENTRY), true);
    const runtime = require(DIST_ENTRY);
    assert.equal(typeof runtime.mainAgentRuntimeCommand, 'function');
  });

  it('supports covered actions with stable JSON envelopes', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of [
        'inspect',
        'confirm-scope',
        'dispatch-plan',
        'release-gate',
        'quality-gate',
        'delivery-truth-gate',
        'requirements-contract-prompt-transaction-publish',
        'implementation-readiness-gate',
        'unified-ingress',
        'delivery-closeout-gate',
        'delivery-evidence-run',
        'soak-runner',
        'dual-host-pr-orchestrator',
        'chaos-scenarios',
      ]) {
        const args =
          action === 'confirm-scope'
            ? [action, '--cwd', root, '--source', 'requirements.md', '--json']
            : [action, '--cwd', root, '--json'];
        const result = await captureRuntime(args);
        const body = parseStdoutJson(result);

        assert.equal(body.schemaVersion, 'main-agent-package-runtime/v1');
        assert.equal(body.action, action);
        assert.equal(body.cwd, root);
        assert.equal(typeof body.status, 'string');
        assert.equal(typeof body.exitCode, 'number');
        assert.equal(Array.isArray(body.errors), true);
        assert.equal(result.exitCode, body.exitCode);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for unknown actions', async () => {
    const root = makeConsumerRoot();
    try {
      const result = await captureRuntime(['not-real', '--cwd', root, '--json']);
      const body = parseStdoutJson(result);

      assert.notEqual(result.exitCode, 0);
      assert.equal(body.status, 'unsupported_main_agent_action');
      assert.equal(body.errors[0].code, 'unsupported_main_agent_action');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
