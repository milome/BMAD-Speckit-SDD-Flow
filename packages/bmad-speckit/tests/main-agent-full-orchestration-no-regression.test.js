const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const BUILD_SCRIPT = path.join(PACKAGE_ROOT, 'scripts', 'build-main-agent-dist.cjs');
const DIST_ENTRY = path.resolve(__dirname, '..', 'dist', 'main-agent', 'index.js');

execFileSync(process.execPath, [BUILD_SCRIPT], {
  cwd: PACKAGE_ROOT,
  encoding: 'utf8',
  stdio: 'pipe',
});

function makeConsumerRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-full-orchestration-'));
  const recordsDir = path.join(root, '_bmad-output', 'runtime', 'requirement-records');
  fs.mkdirSync(recordsDir, { recursive: true });
  fs.writeFileSync(
    path.join(recordsDir, 'index.json'),
    JSON.stringify({ active: 'REQ-1', requirementSets: { 'REQ-1': { id: 'REQ-1' } } }),
    'utf8'
  );
  return root;
}

async function captureRuntime(argv, cwd) {
  delete require.cache[require.resolve(DIST_ENTRY)];
  const { mainAgentRuntimeCommand } = require(DIST_ENTRY);
  let stdout = '';
  let stderr = '';
  const originalCwd = process.cwd();
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
    if (cwd) process.chdir(cwd);
    const exitCode = await mainAgentRuntimeCommand(argv);
    return { exitCode, stdout, stderr };
  } finally {
    process.chdir(originalCwd);
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
}

describe('main-agent full orchestration no-regression bridge', () => {
  it('does not downgrade package run-loop to the reduced package facade', async () => {
    const root = makeConsumerRoot();
    try {
      const result = await captureRuntime(['run-loop', '--cwd', root, '--json'], root);
      const output = `${result.stdout}\n${result.stderr}`;

      assert.doesNotMatch(output, /main-agent-package-run-loop/);
      assert.match(output, /main-agent-run-loop|NO_ACTIVE_REQUIREMENT|no_active_requirement/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('recognizes legacy orchestration-only actions from the package runtime', async () => {
    const root = makeConsumerRoot();
    try {
      const result = await captureRuntime([
        '--legacy-orchestration',
        '--action',
        'route-intake',
        '--cwd',
        root,
        '--json',
      ], root);
      const output = `${result.stdout}\n${result.stderr}`;

      assert.notEqual(result.exitCode, 0);
      assert.doesNotMatch(output, /unsupported_main_agent_action/);
      assert.match(output, /route-intake requires --input <json-file> or --payload <json>/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes pre-confirmation render registration aliases through source-authority orchestration', async () => {
    const root = makeConsumerRoot();
    try {
      for (const action of [
        'register-pre-confirmation-render',
        'register_pre_confirmation_render',
      ]) {
        const result = await captureRuntime(['--action', action, '--cwd', root, '--json'], root);
        const output = `${result.stdout}\n${result.stderr}`;

        assert.notEqual(result.exitCode, 0);
        assert.doesNotMatch(output, /unsupported_main_agent_action/);
        assert.match(
          output,
          /register-pre-confirmation-render requires --source, --render-report, and --requirement-record/
        );
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
