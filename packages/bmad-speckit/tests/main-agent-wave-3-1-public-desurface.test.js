const { describe, it } = require('node:test');
const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const PACKAGE_CLI = path.join(PACKAGE_ROOT, 'bin', 'bmad-speckit.js');
const DESURFACED_COMMANDS = [
  'eval-questions',
  'main-agent:bmad-help-five-layer-matrix',
  'main-agent:host-matrix-pr-orchestrate',
  'bmads-auto',
];

function makeConsumerRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-1-desurface-'));
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

describe('main-agent wave 3.1 public de-surface aliases', () => {
  it('keeps de-surfaced commands as deprecated JSON aliases', () => {
    const root = makeConsumerRoot();
    try {
      for (const command of DESURFACED_COMMANDS) {
        const body = JSON.parse(runCli([command, '--json'], root));
        assert.equal(body.schemaVersion, 'bmad-speckit-deprecated-alias/v1');
        assert.equal(body.command, command);
        assert.equal(body.status, 'deprecated');
        assert.equal(body.exitCode, 0);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('marks de-surfaced command help as deprecated without source path leakage', () => {
    const root = makeConsumerRoot();
    try {
      for (const command of DESURFACED_COMMANDS) {
        const help = runCli([command, '--help'], root);
        assert.match(help, /Deprecated|deprecated/);
        assert.doesNotMatch(help, /scripts[\\/]/);
      }
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
