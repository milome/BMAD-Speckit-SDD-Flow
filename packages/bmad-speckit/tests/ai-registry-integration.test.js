/**
 * Story 12.1 T5: AI Registry 集成测试
 * init 使用 AIRegistry, generic 校验 exit 2, --ai-commands-dir
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');

function withIsolatedHome(envOverrides = {}) {
  const homeRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-speckit-home-'));
  return {
    env: {
      ...process.env,
      HOME: homeRoot,
      USERPROFILE: homeRoot,
      ...envOverrides,
    },
    cleanup() {
      try { fs.rmSync(homeRoot, { recursive: true, force: true }); } catch (_) {}
    },
  };
}

function runInit(args, cwd, envOverrides = {}) {
  const { env, cleanup } = withIsolatedHome(envOverrides);
  try {
    return spawnSync('node', [BIN, 'init', ...args], {
      cwd: cwd || os.tmpdir(),
      encoding: 'utf8',
      timeout: 20000,
      env,
    });
  } finally {
    cleanup();
  }
}

describe('AI Registry integration (Story 12.1 T5)', () => {
  it('T4.1 init --ai generic --yes without --ai-commands-dir => exit 2', () => {
    const tmpDir = path.join(os.tmpdir(), `bmad-speckit-gen-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runInit(['.', '--ai', 'generic', '--yes'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 2, `expected exit 2, got ${r.status}`);
    const err = (r.stderr || '') + (r.stdout || '');
    assert.ok(err.includes('generic') || err.includes('ai-commands-dir') || err.includes('aiCommandsDir'), `stderr should mention generic/ai-commands-dir: ${err}`);
  });

  it('T4.1 init --ai generic --ai-commands-dir <path> --yes => passes generic validation', () => {
    const parentDir = path.join(os.tmpdir(), `bmad-speckit-gen-ok-${Date.now()}`);
    fs.mkdirSync(parentDir, { recursive: true });
    const commandsDir = path.join(parentDir, 'my-commands');
    const projectDir = path.join(parentDir, 'proj'); // empty subdir for init
    fs.mkdirSync(commandsDir, { recursive: true });
    fs.mkdirSync(projectDir, { recursive: true });
    const r = runInit(['.', '--ai', 'generic', '--ai-commands-dir', commandsDir, '--yes', '--no-git'], projectDir);
    try { fs.rmSync(parentDir, { recursive: true }); } catch (_) {}
    if (r.status === 5) return; // skip if offline cache missing
    if (r.status === 3) return; // skip if network failed
    assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  });

  it('T4.2 init uses AIRegistry (grep init.js)', () => {
    const initPath = path.join(__dirname, '../src/commands/init.js');
    const content = fs.readFileSync(initPath, 'utf8');
    assert.ok(content.includes('ai-registry') || content.includes('AIRegistry'), 'init.js must require ai-registry');
    assert.ok(!content.includes('require(\'../constants/ai-builtin\')') && !content.includes('require("../constants/ai-builtin")'), 'init.js must not require ai-builtin');
  });

  it('T4.2 init --ai invalid-ai --yes => exit 2, output available list', () => {
    const tmpDir = path.join(os.tmpdir(), `bmad-speckit-inv-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runInit(['.', '--ai', 'invalid-ai-xyz', '--yes'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 2);
    const err = (r.stderr || '') + (r.stdout || '');
    assert.ok(err.includes('Available:') || err.includes('check --list-ai'), `stderr: ${err}`);
  });

  it('T5.1 check --list-ai outputs AI ids', () => {
    const { env, cleanup } = withIsolatedHome();
    const r = spawnSync('node', [BIN, 'check', '--list-ai'], {
      cwd: path.dirname(BIN),
      encoding: 'utf8',
      timeout: 15000,
      env,
    });
    cleanup();
    assert.strictEqual(r.status, 0);
    const out = (r.stdout || '').trim();
    assert.ok(out.includes('cursor-agent'));
    assert.ok(out.includes('claude'));
    assert.ok(out.includes('generic'));
  });
});
