/**
 * ConfigCommand tests (Story 13.4 - E13-S4)
 * TDD: T1 skeleton/bin; T2 get/list; T3 set; T4 full
 * Run: node --test tests/config.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BIN = path.join(__dirname, '../bin/bmad-speckit.js');

function runConfig(args, subcommand, cwd, envOverrides = {}) {
  return spawnSync('node', [BIN, 'config', subcommand, ...(args || [])], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, ...envOverrides },
  });
}

function runConfigList(args, cwd, envOverrides = {}) {
  return spawnSync('node', [BIN, 'config', 'list', ...(args || [])], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, ...envOverrides },
  });
}

function runConfigSet(key, value, args, cwd, envOverrides = {}) {
  return spawnSync('node', [BIN, 'config', 'set', key, value, ...(args || [])], {
    cwd: cwd || process.cwd(),
    encoding: 'utf8',
    timeout: 5000,
    env: { ...process.env, ...envOverrides },
  });
}

// T1.1-T1.3: ConfigCommand skeleton and bin registration
describe('T1: ConfigCommand skeleton and bin registration', () => {
  it('config get unknownKey => exit 1, stderr contains 不存在 or equivalent (T1.1)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-get-missing-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runConfig(['unknownKey'], 'get', tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    const err = (r.stderr || r.stdout || '').toLowerCase();
    assert.ok(!err.includes('unknown command'), 'config command must exist (not "unknown command")');
    assert.strictEqual(r.status, 1, `expected exit 1, got ${r.status}`);
    assert.ok(
      err.includes('不存在') || err.includes('not found') || err.includes('missing'),
      `stderr should mention key missing: ${r.stderr}`
    );
  });

  it('config --help shows get/set/list (T1.2)', () => {
    const r = spawnSync('node', [BIN, 'config', '--help'], {
      encoding: 'utf8',
      timeout: 5000,
    });
    assert.strictEqual(r.status, 0);
    const out = (r.stdout || '') + (r.stderr || '');
    assert.ok(out.includes('get') || out.includes('set') || out.includes('list'), `should show get/set/list: ${out}`);
  });

  it('config list => exit 0 with output (T1.3)', () => {
    const r = runConfigList([]);
    assert.strictEqual(r.status, 0, `expected exit 0: ${r.stderr}`);
    // list may output empty or key:value lines
    assert.ok(typeof (r.stdout || '') === 'string', 'stdout should be string');
  });
});

// T2: config get and list
describe('T2: config get and list', () => {
  it('config get defaultAI when exists => stdout value, exit 0 (T2.1)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-get-exists-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ defaultAI: 'cursor-agent' }),
      'utf8'
    );
    const r = runConfig(['defaultAI'], 'get', tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    assert.strictEqual(r.status, 0);
    assert.strictEqual((r.stdout || '').trim(), 'cursor-agent', `stdout: ${r.stdout}`);
  });

  it('config get defaultAI --json => valid JSON (T2.2)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-get-json-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ defaultAI: 'cursor-agent' }),
      'utf8'
    );
    const r = runConfig(['defaultAI', '--json'], 'get', tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    assert.strictEqual(r.status, 0);
    const parsed = JSON.parse((r.stdout || '').trim());
    assert.ok(parsed.defaultAI === 'cursor-agent' || (parsed.key === 'defaultAI' && parsed.value === 'cursor-agent'), `valid JSON: ${r.stdout}`);
  });

  it('config get networkTimeoutMs default => 30000 (spec AC-1)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-timeout-default-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const r = runConfig(['networkTimeoutMs'], 'get', tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    assert.strictEqual(r.status, 0);
    assert.strictEqual((r.stdout || '').trim(), '30000');
  });

  it('config list merged view, config list --json => valid JSON (T2.3)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-list-merged-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ defaultAI: 'project-ai', selectedAI: 'cursor-agent' }),
      'utf8'
    );
    const r1 = runConfigList([], tmpDir);
    const r2 = runConfigList(['--json'], tmpDir);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    assert.strictEqual(r1.status, 0);
    assert.ok((r1.stdout || '').includes('defaultAI') || (r1.stdout || '').includes('selectedAI'), 'list should show keys');
    assert.strictEqual(r2.status, 0);
    const parsed = JSON.parse((r2.stdout || '').trim());
    assert.strictEqual(parsed.defaultAI, 'project-ai');
    assert.strictEqual(parsed.selectedAI, 'cursor-agent');
  });

  it('config list when no project-level file, only global config (AC-3#3)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-list-global-only-${Date.now()}`);
    const fakeHome = path.join(tmpDir, 'fakeHome');
    const globalConfigDir = path.join(fakeHome, '.bmad-speckit');
    fs.mkdirSync(globalConfigDir, { recursive: true });
    fs.writeFileSync(
      path.join(globalConfigDir, 'config.json'),
      JSON.stringify({ defaultAI: 'global-only-ai', customKey: 'global-value' }),
      'utf8'
    );
    const r = runConfigList([], tmpDir, {
      USERPROFILE: fakeHome,
      HOME: fakeHome,
    });
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    assert.strictEqual(r.status, 0);
    const out = r.stdout || '';
    assert.ok(out.includes('defaultAI') || out.includes('customKey'), 'list should show global keys');
    assert.ok(out.includes('global-only-ai') || out.includes('global-value'), 'list should show global values');
  });
});

// T3: config set and scope rules
describe('T3: config set and scope rules', () => {
  it('config set in init dir => write to project bmad-speckit.json (T3.1)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-set-project-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    const fakeHome = path.join(tmpDir, 'fakeHome');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'bmad-speckit.json'), '{}', 'utf8');
    const r = runConfigSet('defaultAI', 'cursor-agent', [], tmpDir, {
      USERPROFILE: fakeHome,
      HOME: fakeHome,
    });
    try {
      assert.strictEqual(r.status, 0);
      const cfg = JSON.parse(fs.readFileSync(path.join(configDir, 'bmad-speckit.json'), 'utf8'));
      assert.strictEqual(cfg.defaultAI, 'cursor-agent');
      const globalPath = path.join(fakeHome, '.bmad-speckit', 'config.json');
      assert.ok(!fs.existsSync(globalPath), 'project scope should not write to global config');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  it('config set in un-init dir => write to global (T3.1)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-set-global-${Date.now()}`);
    const fakeHome = path.join(tmpDir, 'fakeHome');
    fs.mkdirSync(fakeHome, { recursive: true });
    const r = runConfigSet('defaultAI', 'global-ai', [], tmpDir, {
      USERPROFILE: fakeHome,
      HOME: fakeHome,
    });
    try {
      assert.strictEqual(r.status, 0);
      const globalPath = path.join(fakeHome, '.bmad-speckit', 'config.json');
      assert.ok(fs.existsSync(globalPath), 'global config should exist');
      const cfg = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
      assert.strictEqual(cfg.defaultAI, 'global-ai');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  it('config set --global in init dir => write to global, not project (T3.1)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-set-global-flag-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    const fakeHome = path.join(tmpDir, 'fakeHome');
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(fakeHome, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'bmad-speckit.json'), JSON.stringify({ selectedAI: 'x' }), 'utf8');
    const r = runConfigSet('defaultAI', 'via-global', ['--global'], tmpDir, {
      USERPROFILE: fakeHome,
      HOME: fakeHome,
    });
    try {
      assert.strictEqual(r.status, 0);
      const projectCfg = JSON.parse(fs.readFileSync(path.join(configDir, 'bmad-speckit.json'), 'utf8'));
      assert.ok(!projectCfg.defaultAI, 'project should not have defaultAI');
      assert.strictEqual(projectCfg.selectedAI, 'x', 'project selectedAI preserved');
      const globalPath = path.join(fakeHome, '.bmad-speckit', 'config.json');
      assert.ok(fs.existsSync(globalPath));
      const globalCfg = JSON.parse(fs.readFileSync(globalPath, 'utf8'));
      assert.strictEqual(globalCfg.defaultAI, 'via-global');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  it('config set networkTimeoutMs 60000 => number in JSON (T3.3)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-set-timeout-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'bmad-speckit.json'), '{}', 'utf8');
    const r = runConfigSet('networkTimeoutMs', '60000', [], tmpDir);
    try {
      assert.strictEqual(r.status, 0);
      const cfg = JSON.parse(fs.readFileSync(path.join(configDir, 'bmad-speckit.json'), 'utf8'));
      assert.strictEqual(typeof cfg.networkTimeoutMs, 'number');
      assert.strictEqual(cfg.networkTimeoutMs, 60000);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });

  it('config set single key preserves other keys (T3.4)', () => {
    const tmpDir = path.join(os.tmpdir(), `config-set-merge-${Date.now()}`);
    const configDir = path.join(tmpDir, '_bmad-output', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'bmad-speckit.json'),
      JSON.stringify({ selectedAI: 'cursor-agent' }),
      'utf8'
    );
    const r = runConfigSet('defaultAI', 'bob', [], tmpDir);
    try {
      assert.strictEqual(r.status, 0);
      const cfg = JSON.parse(fs.readFileSync(path.join(configDir, 'bmad-speckit.json'), 'utf8'));
      assert.strictEqual(cfg.defaultAI, 'bob');
      assert.strictEqual(cfg.selectedAI, 'cursor-agent', 'selectedAI must be preserved');
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
    }
  });
});
