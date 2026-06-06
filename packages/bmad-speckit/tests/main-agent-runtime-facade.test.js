const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-runtime-facade-'));
}

function runCli(args, cwd) {
  return execFileSync(process.execPath, [PACKAGE_CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      BMAD_LANG: '',
      LC_ALL: 'C',
      LC_MESSAGES: 'C',
      LANG: 'C',
    },
  });
}

function runCliFailure(args, cwd) {
  try {
    runCli(args, cwd);
  } catch (error) {
    return {
      status: error.status,
      stdout: String(error.stdout || ''),
      stderr: String(error.stderr || ''),
    };
  }
  throw new Error(`expected command to fail: ${args.join(' ')}`);
}

describe('main-agent package runtime facade', () => {
  it('prints stable JSON for main-agent inspect without source checkout state', () => {
    const root = makeConsumerRoot();
    try {
      const result = JSON.parse(runCli(['main-agent', 'inspect', '--json'], root));

      assert.equal(result.schemaVersion, 'main-agent-package-runtime/v1');
      assert.equal(result.action, 'inspect');
      assert.equal(result.cwd, root);
      assert.equal(result.status, 'ok');
      assert.equal(result.exitCode, 0);
      assert.deepEqual(result.errors, []);
      assert.equal(result.data.source, 'none');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed for unknown main-agent actions', () => {
    const root = makeConsumerRoot();
    try {
      const failure = runCliFailure(['main-agent', 'not-a-real-action', '--json'], root);
      const result = JSON.parse(failure.stdout);

      assert.notEqual(failure.status, 0);
      assert.equal(result.status, 'unsupported_main_agent_action');
      assert.equal(result.exitCode, failure.status);
      assert.equal(result.errors[0].code, 'unsupported_main_agent_action');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails closed when dispatch-plan needs missing runtime state', () => {
    const root = makeConsumerRoot();
    try {
      const failure = runCliFailure(['main-agent', 'dispatch-plan', '--json'], root);
      const result = JSON.parse(failure.stdout);

      assert.notEqual(failure.status, 0);
      assert.equal(result.status, 'runtime_state_missing');
      assert.equal(result.errors[0].code, 'runtime_state_missing');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('keeps legacy public commands as package runtime aliases', () => {
    const root = makeConsumerRoot();
    try {
      const legacy = JSON.parse(
        runCli(['main-agent-orchestration', '--action', 'inspect', '--json'], root)
      );
      const confirmScope = runCliFailure(['confirm-scope', '--json'], root);
      const namespaced = runCliFailure(['main-agent:confirm-scope', '--json'], root);

      assert.equal(legacy.action, 'inspect');
      assert.equal(legacy.status, 'ok');
      assert.equal(JSON.parse(confirmScope.stdout).action, 'confirm-scope');
      assert.equal(JSON.parse(namespaced.stdout).action, 'confirm-scope');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
