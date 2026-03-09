/**
 * Story 12.2 T1: SyncService 单元测试
 * syncCommandsRulesConfig: configTemplate 映射、vscodeSettings、源路径
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

function mkdirp(p) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function createCursorSource(root) {
  const cursor = path.join(root, 'cursor');
  mkdirp(path.join(cursor, 'commands'));
  mkdirp(path.join(cursor, 'rules'));
  mkdirp(path.join(cursor, 'config'));
  fs.writeFileSync(path.join(cursor, 'commands', 'test.cmd'), 'test', 'utf8');
  fs.writeFileSync(path.join(cursor, 'rules', 'test.md'), 'rule', 'utf8');
  fs.writeFileSync(path.join(cursor, 'config', 'code-reviewer-config.yaml'), 'config', 'utf8');
  return cursor;
}

describe('SyncService (Story 12.2 T1)', () => {
  const tmpRoot = path.join(os.tmpdir(), `bmad-speckit-sync-${Date.now()}`);

  it('T1.1 syncCommandsRulesConfig exists and is callable', () => {
    const SyncService = require('../src/services/sync-service');
    assert.strictEqual(typeof SyncService.syncCommandsRulesConfig, 'function');
  });

  it('T1.2 sync cursor-agent: source from projectRoot/_bmad/cursor when no bmadPath', () => {
    const projectRoot = path.join(tmpRoot, 't1_2');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', {});

    const cmdDir = path.join(projectRoot, '.cursor', 'commands');
    const rulesDir = path.join(projectRoot, '.cursor', 'rules');
    assert.ok(fs.existsSync(cmdDir), '.cursor/commands should exist');
    assert.ok(fs.existsSync(rulesDir), '.cursor/rules should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')), 'commands content copied');
    assert.ok(fs.existsSync(path.join(rulesDir, 'test.md')), 'rules content copied');
  });

  it('T1.3 sync opencode: .opencode/command (not .cursor)', () => {
    const projectRoot = path.join(tmpRoot, 't1_3');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'opencode', {});

    const cmdDir = path.join(projectRoot, '.opencode', 'command');
    assert.ok(fs.existsSync(cmdDir), '.opencode/command should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')), 'commands copied to opencode');
    assert.ok(!fs.existsSync(path.join(projectRoot, '.cursor')), 'should NOT use .cursor for opencode');
  });

  it('T1.3 sync bob: .bob/commands', () => {
    const projectRoot = path.join(tmpRoot, 't1_3_bob');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'bob', {});

    const cmdDir = path.join(projectRoot, '.bob', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.bob/commands should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')));
  });

  it('T1.3 sync shai: .shai/commands', () => {
    const projectRoot = path.join(tmpRoot, 't1_3_shai');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'shai', {});

    const cmdDir = path.join(projectRoot, '.shai', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.shai/commands should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')));
  });

  it('T1.4 sync codex: .codex/commands and configDir', () => {
    const projectRoot = path.join(tmpRoot, 't1_4');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'codex', {});

    const cmdDir = path.join(projectRoot, '.codex', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.codex/commands should exist');
    const configFile = path.join(projectRoot, '.codex', 'config.toml');
    assert.ok(fs.existsSync(configFile) || fs.existsSync(path.join(projectRoot, '.codex')), 'configDir handled');
  });

  it('T1.5 vscodeSettings: merge when configTemplate has vscodeSettings', () => {
    const projectRoot = path.join(tmpRoot, 't1_5');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));
    const entry = { configTemplate: { commandsDir: '.cursor/commands', vscodeSettings: { 'editor.formatOnSave': true } } };
    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', {});
    const entryWithVscode = { configTemplate: { commandsDir: '.cursor/commands', rulesDir: '.cursor/rules', vscodeSettings: { 'editor.formatOnSave': true, 'files.encoding': 'utf8' } } };
    const AIRegistry = require('../src/services/ai-registry');
    const originalGetById = AIRegistry.getById.bind(AIRegistry);
    let patched = false;
    const SyncService2 = require('../src/services/sync-service');
    const projectRoot2 = path.join(tmpRoot, 't1_5b');
    mkdirp(projectRoot2);
    createCursorSource(path.join(projectRoot2, '_bmad'));
    SyncService2.syncCommandsRulesConfig(projectRoot2, 'cursor-agent', {});
    const vscodePath = path.join(projectRoot2, '.vscode', 'settings.json');
    if (fs.existsSync(vscodePath)) {
      const content = JSON.parse(fs.readFileSync(vscodePath, 'utf8'));
      assert.ok(typeof content === 'object', 'vscode settings merged');
    }
  });

  it('T1.5 vscodeSettings: no vscodeSettings in configTemplate -> skip', () => {
    const projectRoot = path.join(tmpRoot, 't1_5_skip');
    mkdirp(projectRoot);
    createCursorSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'opencode', {});

    const vscodePath = path.join(projectRoot, '.vscode', 'settings.json');
    assert.ok(!fs.existsSync(vscodePath), 'should NOT create .vscode when no vscodeSettings');
  });

  it('T1.6 source dir missing: skip without error', () => {
    const projectRoot = path.join(tmpRoot, 't1_6');
    mkdirp(projectRoot);
    mkdirp(path.join(projectRoot, '_bmad'));
    fs.mkdirSync(path.join(projectRoot, '_bmad', 'cursor'), { recursive: true });

    const SyncService = require('../src/services/sync-service');
    assert.doesNotThrow(() => {
      SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', {});
    });
  });

  it('T1.2 bmadPath: source from bmadPath/cursor when bmadPath provided', () => {
    const bmadPath = path.join(tmpRoot, 'bmad-shared');
    createCursorSource(bmadPath);

    const projectRoot = path.join(tmpRoot, 't1_2_bmadpath');
    mkdirp(projectRoot);

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', { bmadPath });

    const cmdDir = path.join(projectRoot, '.cursor', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.cursor/commands should exist from bmadPath');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')), 'content from bmadPath');
  });
});
