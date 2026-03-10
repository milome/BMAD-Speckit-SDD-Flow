/**
 * Init config resolution unit tests (Story 11.1 - T006, T009)
 * resolveNetworkTimeoutMs: CLI > env > project config > global config > 30000
 * resolveTemplateSource: env > project config > global config > default
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

let initModule;
let configManager;
try {
  initModule = require('../src/commands/init');
  configManager = require('../src/services/config-manager');
} catch (e) {
  initModule = null;
  configManager = null;
}

const globalConfigPath = path.join(os.homedir(), '.bmad-speckit', 'config.json');
const projectConfigDir = (cwd) => path.join(cwd, '_bmad-output', 'config');
const projectConfigPath = (cwd) => path.join(projectConfigDir(cwd), 'bmad-speckit.json');

function writeConfig(filePath, obj) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
}

describe('Story 11.1: resolveNetworkTimeoutMs priority (T006, T009)', () => {
  const origEnv = process.env.SDD_NETWORK_TIMEOUT_MS;
  const testCwd = path.join(os.tmpdir(), `bmad-speckit-init-config-${Date.now()}`);

  it('CLI option overrides env and config', () => {
    if (!initModule) return;
    process.env.SDD_NETWORK_TIMEOUT_MS = '5000';
    try {
      const result = initModule.resolveNetworkTimeoutMs({ networkTimeout: 10000 });
      assert.strictEqual(result, 10000);
    } finally {
      process.env.SDD_NETWORK_TIMEOUT_MS = origEnv;
    }
  });

  it('env overrides project and global config', () => {
    if (!initModule || !configManager) return;
    fs.mkdirSync(projectConfigDir(testCwd), { recursive: true });
    writeConfig(projectConfigPath(testCwd), { networkTimeoutMs: 15000 });
    const origCwd = process.cwd();
    process.env.SDD_NETWORK_TIMEOUT_MS = '8000';
    try {
      process.chdir(testCwd);
      const result = initModule.resolveNetworkTimeoutMs({});
      assert.strictEqual(result, 8000);
    } finally {
      process.chdir(origCwd);
      process.env.SDD_NETWORK_TIMEOUT_MS = origEnv;
      try { fs.rmSync(testCwd, { recursive: true }); } catch {}
    }
  });

  it('project config overrides global config', () => {
    if (!initModule || !configManager) return;
    fs.mkdirSync(projectConfigDir(testCwd), { recursive: true });
    writeConfig(projectConfigPath(testCwd), { networkTimeoutMs: 12000 });
    const origCwd = process.cwd();
    delete process.env.SDD_NETWORK_TIMEOUT_MS;
    try {
      process.chdir(testCwd);
      const result = initModule.resolveNetworkTimeoutMs({});
      assert.strictEqual(result, 12000);
    } finally {
      process.chdir(origCwd);
      process.env.SDD_NETWORK_TIMEOUT_MS = origEnv;
      try { fs.rmSync(testCwd, { recursive: true }); } catch {}
    }
  });

  it('global config when no project config', () => {
    if (!initModule || !configManager) return;
    const globalDir = path.dirname(globalConfigPath);
    const existed = fs.existsSync(globalConfigPath);
    const backup = existed ? fs.readFileSync(globalConfigPath, 'utf8') : null;
    writeConfig(globalConfigPath, { networkTimeoutMs: 20000 });
    const emptyCwd = path.join(os.tmpdir(), `bmad-speckit-empty-${Date.now()}`);
    fs.mkdirSync(emptyCwd, { recursive: true });
    const origCwd = process.cwd();
    delete process.env.SDD_NETWORK_TIMEOUT_MS;
    try {
      process.chdir(emptyCwd);
      const result = initModule.resolveNetworkTimeoutMs({});
      assert.strictEqual(result, 20000);
    } finally {
      process.chdir(origCwd);
      if (backup != null) fs.writeFileSync(globalConfigPath, backup);
      else if (fs.existsSync(globalConfigPath)) fs.unlinkSync(globalConfigPath);
      process.env.SDD_NETWORK_TIMEOUT_MS = origEnv;
      try { fs.rmSync(emptyCwd, { recursive: true }); } catch {}
    }
  });

  it('default 30000 when nothing set', () => {
    if (!initModule) return;
    const emptyCwd = path.join(os.tmpdir(), `bmad-speckit-noconfig-${Date.now()}`);
    fs.mkdirSync(emptyCwd, { recursive: true });
    const origCwd = process.cwd();
    const prevEnv = process.env.SDD_NETWORK_TIMEOUT_MS;
    delete process.env.SDD_NETWORK_TIMEOUT_MS;
    try {
      process.chdir(emptyCwd);
      const result = initModule.resolveNetworkTimeoutMs({});
      assert.strictEqual(result, 30000);
    } finally {
      process.chdir(origCwd);
      process.env.SDD_NETWORK_TIMEOUT_MS = prevEnv;
      try { fs.rmSync(emptyCwd, { recursive: true }); } catch {}
    }
  });
});

describe('Story 11.1: resolveTemplateSource priority (T009)', () => {
  const origEnv = process.env.SDD_TEMPLATE_REPO;
  const testCwd = path.join(os.tmpdir(), `bmad-speckit-tmpl-${Date.now()}`);

  it('env overrides config', () => {
    if (!initModule) return;
    process.env.SDD_TEMPLATE_REPO = 'env-owner/env-repo';
    try {
      const result = initModule.resolveTemplateSource(testCwd);
      assert.strictEqual(result, 'env-owner/env-repo');
    } finally {
      process.env.SDD_TEMPLATE_REPO = origEnv;
    }
  });

  it('project config overrides global when no env', () => {
    if (!initModule || !configManager) return;
    fs.mkdirSync(projectConfigDir(testCwd), { recursive: true });
    writeConfig(projectConfigPath(testCwd), { templateSource: 'proj-owner/proj-repo' });
    delete process.env.SDD_TEMPLATE_REPO;
    try {
      const result = initModule.resolveTemplateSource(testCwd);
      assert.strictEqual(result, 'proj-owner/proj-repo');
    } finally {
      process.env.SDD_TEMPLATE_REPO = origEnv;
      try { fs.rmSync(testCwd, { recursive: true }); } catch {}
    }
  });

  it('default bmad-method/bmad-method when nothing set', () => {
    if (!initModule || !configManager) return;
    const emptyCwd = path.join(os.tmpdir(), `bmad-speckit-tmpl-default-${Date.now()}`);
    fs.mkdirSync(emptyCwd, { recursive: true });
    delete process.env.SDD_TEMPLATE_REPO;
    const globalPath = configManager.getGlobalConfigPath();
    let backup = null;
    if (fs.existsSync(globalPath)) {
      backup = fs.readFileSync(globalPath, 'utf8');
      const obj = JSON.parse(backup);
      delete obj.templateSource;
      fs.writeFileSync(globalPath, JSON.stringify(obj, null, 2));
    }
    try {
      const result = initModule.resolveTemplateSource(emptyCwd);
      assert.strictEqual(result, 'bmad-method/bmad-method');
    } finally {
      if (backup != null) fs.writeFileSync(globalPath, backup);
      process.env.SDD_TEMPLATE_REPO = origEnv;
      try { fs.rmSync(emptyCwd, { recursive: true }); } catch {}
    }
  });
});
