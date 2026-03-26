/**
 * UpgradeCommand tests (Story 13.3 - E13-S3)
 * TDD: T1 un-init exit 1; T2 dry-run; T3 execute; T4 full
 * Run: node --test tests/upgrade.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');

/** Upgrade may fetch templates over the network; 15s is too tight on slow CI or cold cache. */
const UPGRADE_SPAWN_TIMEOUT_MS = 120000;

function runUpgrade(args, cwd, envOverrides = {}) {
  return spawnSync('node', [BIN, 'upgrade', ...(args || [])], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    timeout: UPGRADE_SPAWN_TIMEOUT_MS,
    env: { ...process.env, ...envOverrides },
  });
}

// T1.1-T1.3: un-init directory upgrade => exit 1, stderr contains init-related message
describe('T1: UpgradeCommand skeleton and init check', () => {
  it('upgrade in un-init dir => exit 1, stderr contains 未 init or init', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-uninit-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runUpgrade([], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
    const err = (r.stderr || '').toLowerCase();
    assert.ok(err.includes('init') || err.includes('未初始化') || err.includes('未 init'), `stderr should mention init: ${r.stderr}`);
  });

  it('upgrade --help shows options', () => {
    const r = runUpgrade(['--help']);
    assert.strictEqual(r.status, 0);
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(out.includes('--dry-run') || out.includes('dry-run'), 'should show --dry-run');
    assert.ok(out.includes('--template') || out.includes('template'), 'should show --template');
    assert.ok(out.includes('--offline') || out.includes('offline'), 'should show --offline');
  });

  it('upgrade --dry-run in init dir => exit 0 (T1.3)', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-init-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ templateVersion: 'v1.0.0', selectedAI: 'cursor-agent' }),
      'utf8'
    );
    const r = runUpgrade(['--dry-run'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 0, `expected exit 0, got ${r.status}: ${r.stderr}`);
  });
});

// T2: --dry-run
describe('T2: --dry-run', () => {
  it('upgrade --dry-run in init dir: no _bmad or config changes (T2.1)', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-dryrun-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'bmad-speckit.json');
    const origConfig = JSON.stringify({ templateVersion: 'v1.0.0', selectedAI: 'cursor-agent' });
    fs.writeFileSync(configPath, origConfig, 'utf8');
    runUpgrade(['--dry-run'], tmpDir);
    const afterConfig = fs.existsSync(configPath) ? fs.readFileSync(configPath, 'utf8') : '';
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(afterConfig, origConfig, 'config must not change');
    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad')), '_bmad must not be created by dry-run');
  });

  it('upgrade --dry-run --template v1.0.0 outputs target version (T2.2)', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-dryrun-tpl-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ templateVersion: 'v0.9.0' }),
      'utf8'
    );
    const r = runUpgrade(['--dry-run', '--template', 'v1.0.0'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 0);
    const out = (r.stdout || '').toLowerCase();
    assert.ok(out.includes('target') || /\d+\.\d+\.\d+/.test(out), `stdout should mention target or version: ${r.stdout}`);
  });
});

// T3: --template and execute update
describe('T3: execute update', () => {
  it('upgrade in init dir (no bmadPath): _bmad updated, templateVersion updated (T3.3)', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-exec-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ templateVersion: 'v0.1.0', selectedAI: 'cursor-agent' }),
      'utf8'
    );
    const r = runUpgrade([], tmpDir);
    try {
      assert.strictEqual(r.status, 0, `expected exit 0: ${r.stderr}`);
      const bmadDir = path.join(tmpDir, '_bmad');
      assert.ok(fs.existsSync(bmadDir) && fs.statSync(bmadDir).isDirectory(), '_bmad must exist');
      const hasCore = fs.existsSync(path.join(bmadDir, 'core'));
      assert.ok(hasCore, '_bmad/core must exist');
      const afterConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'bmad-speckit.json'), 'utf8'));
      assert.ok(afterConfig.templateVersion, 'templateVersion must be updated');
      assert.strictEqual(afterConfig.selectedAI, 'cursor-agent', 'other config must be preserved');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    }
  });

  it('upgrade with bmadPath: only templateVersion updated, bmadPath dir untouched (T3.4)', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-bmadpath-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    const extBmad = path.join(tmpDir, 'external-bmad');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(extBmad, { recursive: true });
    const markerPath = path.join(extBmad, 'marker.txt');
    fs.writeFileSync(markerPath, 'do-not-touch', 'utf8');
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({
        templateVersion: 'v0.1.0',
        selectedAI: 'cursor-agent',
        bmadPath: path.relative(tmpDir, extBmad).replace(/\\/g, '/'),
      }),
      'utf8'
    );
    const r = runUpgrade([], tmpDir);
    try {
      assert.strictEqual(r.status, 0);
      assert.strictEqual(fs.readFileSync(markerPath, 'utf8'), 'do-not-touch', 'bmadPath dir must not be modified');
      const afterConfig = JSON.parse(fs.readFileSync(path.join(configDir, 'bmad-speckit.json'), 'utf8'));
      assert.ok(afterConfig.templateVersion, 'templateVersion must be updated');
      assert.ok(afterConfig.bmadPath, 'bmadPath must be preserved');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    }
  });

  it('upgrade --offline with missing cache => exit 5 (T3.2)', () => {
    const tmpDir = path.join(os.tmpdir(), `upgrade-offline-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ templateVersion: 'v0.1.0' }),
      'utf8'
    );
    const r = runUpgrade(['--offline', '--template', 'v999-nonexistent-cache'], tmpDir, {
      BMAD_TEST_OFFLINE_ONLY: '1',
    });
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
    assert.strictEqual(r.status, 5, `expected exit 5 (offline cache missing): ${r.stderr}`);
  });
});
