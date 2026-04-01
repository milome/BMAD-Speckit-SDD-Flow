/**
 * ConfigManager unit tests (Story 10.4 - T1..T4, T6.1)
 * Run: node --test tests/config-manager.test.js
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

let configManager;
try {
  configManager = require('../src/services/config-manager');
} catch (e) {
  configManager = null;
}

const tmpDir = path.join(os.tmpdir(), `bmad-speckit-cm-${Date.now()}`);
const isolatedHome = path.join(tmpDir, 'home');
const originalHomedir = os.homedir;

before(() => {
  fs.mkdirSync(isolatedHome, { recursive: true });
  os.homedir = () => isolatedHome;
});

after(() => {
  os.homedir = originalHomedir;
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
});

describe('T1.1: getGlobalConfigPath / getProjectConfigPath', () => {
  it('module exists and exports path functions', () => {
    assert.ok(configManager, 'config-manager module should exist');
    assert.strictEqual(typeof configManager.getGlobalConfigPath, 'function');
    assert.strictEqual(typeof configManager.getProjectConfigPath, 'function');
  });

  it('global path contains homedir and .bmad-speckit/config.json', () => {
    if (!configManager) return;
    const globalPath = configManager.getGlobalConfigPath();
    assert.ok(globalPath.includes(os.homedir()), 'global path should contain homedir');
    assert.ok(globalPath.includes('bmad-speckit') && globalPath.includes('config.json'), 'global path should point to config.json');
    assert.ok(!globalPath.includes('\\') || path.sep === '\\', 'no hardcoded backslash except on Windows');
  });

  it('project path is cwd/_bmad-output/config/bmad-speckit.json', () => {
    if (!configManager) return;
    const cwd = path.join(os.tmpdir(), 'some-project');
    const projectPath = configManager.getProjectConfigPath(cwd);
    const expected = path.join(cwd, '_bmad-output', 'config', 'bmad-speckit.json');
    assert.strictEqual(projectPath, expected);
  });
});

describe('T1.2: read/write convention - mkdir recursive, utf8, write then read back', () => {
  it('set then get: write to project scope and read back (directory created)', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'proj1');
    fs.mkdirSync(tmpDir, { recursive: true });
    configManager.set('testKey', 'testValue', { scope: 'project', cwd });
    const value = configManager.get('testKey', { cwd });
    assert.strictEqual(value, 'testValue');
    const projectPath = configManager.getProjectConfigPath(cwd);
    assert.ok(fs.existsSync(projectPath));
    const raw = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
    assert.strictEqual(raw.testKey, 'testValue');
  });
});

describe('T2.1: get(key, options) - priority and networkTimeoutMs', () => {
  it('only global has value: get returns global value', () => {
    if (!configManager) return;
    const globalPath = configManager.getGlobalConfigPath();
    const dir = path.dirname(globalPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify({ defaultAI: 'global-ai' }), 'utf8');
    const cwd = path.join(tmpDir, 'no-project');
    fs.mkdirSync(cwd, { recursive: true });
    const v = configManager.get('defaultAI', { cwd });
    assert.strictEqual(v, 'global-ai');
  });

  it('project overrides global: get returns project value', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'proj-override');
    fs.mkdirSync(cwd, { recursive: true });
    configManager.set('defaultAI', 'project-ai', { scope: 'project', cwd });
    const v = configManager.get('defaultAI', { cwd });
    assert.strictEqual(v, 'project-ai');
  });

  it('neither has key: get returns undefined (except networkTimeoutMs)', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'empty-proj');
    fs.mkdirSync(cwd, { recursive: true });
    // Use a key not written in any test to avoid global config pollution
    assert.strictEqual(configManager.get('keyNotSetAnywhere', { cwd }), undefined);
  });

  it('networkTimeoutMs when neither has it returns 30000', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'no-timeout');
    fs.mkdirSync(cwd, { recursive: true });
    assert.strictEqual(configManager.get('networkTimeoutMs', { cwd }), 30000);
  });
});

describe('T2.2: key types and exports', () => {
  it('get/set defaultAI as string', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'types1');
    fs.mkdirSync(cwd, { recursive: true });
    configManager.set('defaultAI', 'cursor-agent', { scope: 'project', cwd });
    assert.strictEqual(configManager.get('defaultAI', { cwd }), 'cursor-agent');
  });

  it('get/set networkTimeoutMs as number', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'types2');
    fs.mkdirSync(cwd, { recursive: true });
    configManager.set('networkTimeoutMs', 15000, { scope: 'project', cwd });
    assert.strictEqual(configManager.get('networkTimeoutMs', { cwd }), 15000);
  });

  it('exports get, set, setAll, list', () => {
    assert.strictEqual(typeof configManager?.get, 'function');
    assert.strictEqual(typeof configManager?.set, 'function');
    assert.strictEqual(typeof configManager?.setAll, 'function');
    assert.strictEqual(typeof configManager?.list, 'function');
  });
});

describe('T3.1/T3.2: set single key does not remove others; setAll merges', () => {
  it('set one key keeps other keys', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'merge1');
    fs.mkdirSync(cwd, { recursive: true });
    configManager.set('a', 1, { scope: 'project', cwd });
    configManager.set('b', 2, { scope: 'project', cwd });
    assert.strictEqual(configManager.get('a', { cwd }), 1);
    assert.strictEqual(configManager.get('b', { cwd }), 2);
    configManager.set('c', 3, { scope: 'project', cwd });
    assert.strictEqual(configManager.get('a', { cwd }), 1);
    assert.strictEqual(configManager.get('b', { cwd }), 2);
    assert.strictEqual(configManager.get('c', { cwd }), 3);
  });

  it('setAll merges multiple keys', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'merge2');
    fs.mkdirSync(cwd, { recursive: true });
    configManager.setAll({ x: 1, y: 2 }, { scope: 'project', cwd });
    assert.strictEqual(configManager.get('x', { cwd }), 1);
    assert.strictEqual(configManager.get('y', { cwd }), 2);
    configManager.setAll({ z: 3 }, { scope: 'project', cwd });
    assert.strictEqual(configManager.get('x', { cwd }), 1);
    assert.strictEqual(configManager.get('y', { cwd }), 2);
    assert.strictEqual(configManager.get('z', { cwd }), 3);
  });
});

describe('T4.1: list(options) - merged view, project overrides global', () => {
  it('list returns merged object; project overrides global for same key', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'list1');
    fs.mkdirSync(cwd, { recursive: true });
    const globalPath = configManager.getGlobalConfigPath();
    const gdir = path.dirname(globalPath);
    fs.mkdirSync(gdir, { recursive: true });
    fs.writeFileSync(globalPath, JSON.stringify({ defaultAI: 'global-ai', templateSource: 'global-src' }), 'utf8');
    configManager.set('defaultAI', 'project-ai', { scope: 'project', cwd });
    const list = configManager.list({ cwd });
    assert.strictEqual(list.defaultAI, 'project-ai');
    assert.strictEqual(list.templateSource, 'global-src');
  });

  it('list with no project file returns global only', () => {
    if (!configManager) return;
    const cwd = path.join(tmpDir, 'list2-nonexist');
    fs.mkdirSync(cwd, { recursive: true });
    const list = configManager.list({ cwd });
    assert.ok(typeof list === 'object');
  });
});
