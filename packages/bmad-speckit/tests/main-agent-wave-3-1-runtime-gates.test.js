const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const DIST_ENTRY = path.join(PACKAGE_ROOT, 'dist', 'main-agent', 'index.js');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-1-'));
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

function forbiddenRuntimePatterns() {
  const runnerA = ['t', 's', 'x'].join('');
  const runnerB = ['t', 's', '-', 'n', 'o', 'd', 'e'].join('');
  return [
    /runRepoScript\(/,
    /ensure-governance-user-story-mapping-fixture\.js/,
    new RegExp(`\\b${runnerA}\\b`),
    new RegExp(runnerB),
  ];
}

describe('main-agent wave 3.1 runtime gates', () => {
  it('supports three migrated gate actions from dist runtime', async () => {
    const { mainAgentRuntimeCommand } = require(DIST_ENTRY);
    const root = makeConsumerRoot();
    const originalStdoutWrite = process.stdout.write;
    try {
      for (const action of ['release-gate', 'quality-gate', 'delivery-truth-gate']) {
        let stdout = '';
        process.stdout.write = function capture(chunk, ...rest) {
          stdout += String(chunk);
          const callback = rest.find((value) => typeof value === 'function');
          if (callback) callback();
          return true;
        };
        const exitCode = await mainAgentRuntimeCommand([action, '--cwd', root, '--json']);
        const body = JSON.parse(stdout);

        assert.equal(exitCode, 0);
        assert.equal(body.schemaVersion, 'main-agent-package-runtime/v1');
        assert.equal(body.action, action);
        assert.equal(body.cwd, root);
        assert.equal(body.status, 'package_runtime_ready');
        assert.equal(body.exitCode, 0);
        assert.deepEqual(body.errors, []);
      }
    } finally {
      process.stdout.write = originalStdoutWrite;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('routes three public gate commands through package dist runtime', () => {
    const root = makeConsumerRoot();
    try {
      for (const command of [
        'main-agent:release-gate',
        'main-agent:quality-gate',
        'main-agent:delivery-truth-gate',
      ]) {
        const body = JSON.parse(runCli([command, '--json'], root));
        assert.equal(body.schemaVersion, 'main-agent-package-runtime/v1');
        assert.equal(body.status, 'package_runtime_ready');
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('ships wave 3.1 runtime files through dist', () => {
    for (const relativePath of [
      'actions/release-gate.js',
      'actions/quality-gate.js',
      'actions/delivery-truth-gate.js',
      'auditor-host/run-auditor-host.cjs',
      'helpers/write-runtime-context.cjs',
    ]) {
      assert.equal(fs.existsSync(path.join(PACKAGE_ROOT, 'dist', 'main-agent', relativePath)), true);
    }
  });

  it('keeps wave 3.1 source and dist runtime files free of root dispatch prerequisites', () => {
    const files = [
      'src/main-agent/actions/release-gate.js',
      'src/main-agent/actions/quality-gate.js',
      'src/main-agent/actions/delivery-truth-gate.js',
      'src/main-agent/auditor-host/run-auditor-host.cjs',
      'src/main-agent/helpers/write-runtime-context.cjs',
      'dist/main-agent/actions/release-gate.js',
      'dist/main-agent/actions/quality-gate.js',
      'dist/main-agent/actions/delivery-truth-gate.js',
      'dist/main-agent/auditor-host/run-auditor-host.cjs',
      'dist/main-agent/helpers/write-runtime-context.cjs',
    ];

    for (const relativePath of files) {
      const source = fs.readFileSync(path.join(PACKAGE_ROOT, relativePath), 'utf8');
      for (const forbidden of forbiddenRuntimePatterns()) {
        assert.doesNotMatch(source, forbidden, relativePath);
      }
    }
  });
});
