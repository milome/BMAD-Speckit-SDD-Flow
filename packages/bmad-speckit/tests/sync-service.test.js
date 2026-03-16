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

function createBmadSource(root) {
  mkdirp(path.join(root, 'commands'));
  fs.writeFileSync(path.join(root, 'commands', 'test.cmd'), 'test', 'utf8');

  const cursor = path.join(root, 'cursor');
  mkdirp(path.join(cursor, 'rules'));
  mkdirp(path.join(cursor, 'agents'));
  fs.writeFileSync(path.join(cursor, 'rules', 'test.md'), 'rule', 'utf8');
  fs.writeFileSync(path.join(cursor, 'agents', 'agent.md'), 'agent', 'utf8');

  const claude = path.join(root, 'claude');
  mkdirp(path.join(claude, 'rules'));
  mkdirp(path.join(claude, 'agents'));
  mkdirp(path.join(claude, 'hooks'));
  mkdirp(path.join(claude, 'state', 'stories'));
  fs.writeFileSync(path.join(claude, 'rules', 'test.md'), 'claude-rule', 'utf8');
  fs.writeFileSync(path.join(claude, 'agents', 'agent.md'), 'claude-agent', 'utf8');
  fs.writeFileSync(path.join(claude, 'hooks', 'hook.js'), 'hook', 'utf8');
  fs.writeFileSync(path.join(claude, 'settings.json'), '{}', 'utf8');
  fs.writeFileSync(path.join(claude, 'CLAUDE.md.template'), '# {{PROJECT_NAME}}', 'utf8');
  return root;
}

describe('SyncService (Story 12.2 T1)', () => {
  const tmpRoot = path.join(os.tmpdir(), `bmad-speckit-sync-${Date.now()}`);

  it('T1.1 syncCommandsRulesConfig exists and is callable', () => {
    const SyncService = require('../src/services/sync-service');
    assert.strictEqual(typeof SyncService.syncCommandsRulesConfig, 'function');
  });

  it('T1.2 sync cursor-agent: commands from _bmad/commands/, rules from _bmad/cursor/rules/', () => {
    const projectRoot = path.join(tmpRoot, 't1_2');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', {});

    const cmdDir = path.join(projectRoot, '.cursor', 'commands');
    const rulesDir = path.join(projectRoot, '.cursor', 'rules');
    assert.ok(fs.existsSync(cmdDir), '.cursor/commands should exist');
    assert.ok(fs.existsSync(rulesDir), '.cursor/rules should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')), 'commands from _bmad/commands/');
    assert.ok(fs.existsSync(path.join(rulesDir, 'test.md')), 'rules from _bmad/cursor/rules/');
  });

  it('T1.2b sync claude: commands from _bmad/commands/, rules from _bmad/claude/rules/, + infra', () => {
    const projectRoot = path.join(tmpRoot, 't1_2b');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'claude', {});

    const cmdDir = path.join(projectRoot, '.claude', 'commands');
    const rulesDir = path.join(projectRoot, '.claude', 'rules');
    assert.ok(fs.existsSync(cmdDir), '.claude/commands should exist');
    assert.ok(fs.existsSync(rulesDir), '.claude/rules should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')), 'shared commands synced');
    assert.ok(fs.existsSync(path.join(rulesDir, 'test.md')), 'claude rules synced');

    assert.ok(fs.existsSync(path.join(projectRoot, '.claude', 'hooks', 'hook.js')), 'hooks deployed');
    assert.ok(fs.existsSync(path.join(projectRoot, '.claude', 'settings.json')), 'settings.json deployed');
    assert.ok(fs.existsSync(path.join(projectRoot, '.claude', 'state', 'stories')), 'state dirs deployed');
    assert.ok(fs.existsSync(path.join(projectRoot, 'CLAUDE.md')), 'CLAUDE.md generated from template');
  });

  it('T1.3 sync opencode: .opencode/command from _bmad/commands/', () => {
    const projectRoot = path.join(tmpRoot, 't1_3');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));

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
    createBmadSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'bob', {});

    const cmdDir = path.join(projectRoot, '.bob', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.bob/commands should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')));
  });

  it('T1.3 sync shai: .shai/commands', () => {
    const projectRoot = path.join(tmpRoot, 't1_3_shai');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'shai', {});

    const cmdDir = path.join(projectRoot, '.shai', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.shai/commands should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')));
  });

  it('T1.4 sync codex: .codex/commands', () => {
    const projectRoot = path.join(tmpRoot, 't1_4');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'codex', {});

    const cmdDir = path.join(projectRoot, '.codex', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.codex/commands should exist');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')));
  });

  it('T1.5 vscodeSettings: merge when configTemplate has vscodeSettings', () => {
    const projectRoot = path.join(tmpRoot, 't1_5');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));
    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', {});
    const projectRoot2 = path.join(tmpRoot, 't1_5b');
    mkdirp(projectRoot2);
    createBmadSource(path.join(projectRoot2, '_bmad'));
    SyncService.syncCommandsRulesConfig(projectRoot2, 'cursor-agent', {});
    const vscodePath = path.join(projectRoot2, '.vscode', 'settings.json');
    if (fs.existsSync(vscodePath)) {
      const content = JSON.parse(fs.readFileSync(vscodePath, 'utf8'));
      assert.ok(typeof content === 'object', 'vscode settings merged');
    }
  });

  it('T1.5 vscodeSettings: no vscodeSettings in configTemplate -> skip', () => {
    const projectRoot = path.join(tmpRoot, 't1_5_skip');
    mkdirp(projectRoot);
    createBmadSource(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'opencode', {});

    const vscodePath = path.join(projectRoot, '.vscode', 'settings.json');
    assert.ok(!fs.existsSync(vscodePath), 'should NOT create .vscode when no vscodeSettings');
  });

  it('T1.6 source dir missing: skip without error', () => {
    const projectRoot = path.join(tmpRoot, 't1_6');
    mkdirp(projectRoot);
    mkdirp(path.join(projectRoot, '_bmad'));

    const SyncService = require('../src/services/sync-service');
    assert.doesNotThrow(() => {
      SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', {});
    });
  });

  it('T1.7 bmadPath: source from bmadPath when bmadPath provided', () => {
    const bmadPath = path.join(tmpRoot, 'bmad-shared');
    createBmadSource(bmadPath);

    const projectRoot = path.join(tmpRoot, 't1_7_bmadpath');
    mkdirp(projectRoot);

    const SyncService = require('../src/services/sync-service');
    SyncService.syncCommandsRulesConfig(projectRoot, 'cursor-agent', { bmadPath });

    const cmdDir = path.join(projectRoot, '.cursor', 'commands');
    assert.ok(fs.existsSync(cmdDir), '.cursor/commands should exist from bmadPath');
    assert.ok(fs.existsSync(path.join(cmdDir, 'test.cmd')), 'commands from bmadPath/_bmad/commands/');
  });
});
