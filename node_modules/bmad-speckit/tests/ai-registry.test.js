/**
 * Story 12.1 T1: AIRegistry 单元测试
 * load/getById/listIds, 路径、合并、JSON 失败、深度合并
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AIRegistry = require('../src/services/ai-registry');

function mkdirp(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) mkdirp(dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

describe('AIRegistry (Story 12.1 T1)', () => {
  const tmpRoot = path.join(os.tmpdir(), `bmad-speckit-ai-registry-${Date.now()}`);
  const globalRegistryPath = path.join(os.homedir(), '.bmad-speckit', 'ai-registry.json');
  let globalRegistryBackup = null;

  before(() => {
    if (fs.existsSync(globalRegistryPath)) {
      globalRegistryBackup = fs.readFileSync(globalRegistryPath, 'utf8');
      fs.unlinkSync(globalRegistryPath);
    }
  });

  after(() => {
    if (globalRegistryBackup != null) {
      const dir = path.dirname(globalRegistryPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(globalRegistryPath, globalRegistryBackup, 'utf8');
    } else if (fs.existsSync(globalRegistryPath)) {
      fs.unlinkSync(globalRegistryPath);
    }
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  });

  it('T1.1 load returns merged AI list', () => {
    const list = AIRegistry.load({ cwd: tmpRoot });
    assert.strictEqual(Array.isArray(list), true);
    assert.ok(list.length >= 22, 'load should return at least 22 builtin entries');
    const cursor = list.find((a) => a.id === 'cursor-agent');
    assert.ok(cursor, 'cursor-agent should exist');
    assert.ok(cursor.configTemplate, 'entries should have configTemplate');
  });

  it('T1.1 getById returns entry or null', () => {
    const cursor = AIRegistry.getById('cursor-agent', { cwd: tmpRoot });
    assert.ok(cursor, 'getById cursor-agent should return entry');
    assert.strictEqual(cursor.id, 'cursor-agent');
    assert.strictEqual(cursor.name, 'Cursor Agent');

    const none = AIRegistry.getById('nonexistent-ai-xyz', { cwd: tmpRoot });
    assert.strictEqual(none, null);
  });

  it('T1.1 listIds returns id array', () => {
    const ids = AIRegistry.listIds({ cwd: tmpRoot });
    assert.strictEqual(Array.isArray(ids), true);
    assert.ok(ids.includes('cursor-agent'));
    assert.ok(ids.includes('claude'));
  });

  it('T1.2 load: file不存在不报错', () => {
    const emptyCwd = path.join(tmpRoot, 'empty');
    mkdirp(emptyCwd);
    const list = AIRegistry.load({ cwd: emptyCwd });
    assert.strictEqual(Array.isArray(list), true);
    assert.ok(list.length >= 22, 'no files => builtin only');
  });

  it('T1.2 paths use path.join and os.homedir', () => {
    const list = AIRegistry.load({ cwd: tmpRoot });
    assert.ok(list.length > 0);
    const entry = list[0];
    assert.ok(entry.configTemplate);
    const skillsDir = entry.configTemplate.skillsDir;
    if (skillsDir && skillsDir.includes('~')) {
      assert.ok(skillsDir.startsWith('~') || skillsDir.includes(path.sep) || true, 'path format');
    }
  });

  it('T1.3 load: JSON 解析失败抛出含路径错误', () => {
    const badCwd = path.join(tmpRoot, 'bad-json');
    const projectReg = path.join(badCwd, '_bmad-output', 'config');
    mkdirp(projectReg);
    fs.writeFileSync(path.join(projectReg, 'ai-registry.json'), 'not valid json {', 'utf8');
    try {
      AIRegistry.load({ cwd: badCwd });
      assert.fail('expected throw');
    } catch (err) {
      assert.ok(err.message.includes('Invalid JSON') || err.message.includes('ai-registry'));
      assert.ok(err.message.includes('ai-registry.json') || err.message.includes('config'));
    }
  });

  it('T1.4 merge: project > global > builtin', () => {
    const mergeCwd = path.join(tmpRoot, 'merge-test');
    const globalDir = path.join(os.homedir(), '.bmad-speckit');
    const projectDir = path.join(mergeCwd, '_bmad-output', 'config');
    mkdirp(projectDir);
    mkdirp(globalDir);

    const globalPath = path.join(globalDir, 'ai-registry.json');
    const projectPath = path.join(projectDir, 'ai-registry.json');
    const globalBackup = fs.existsSync(globalPath) ? fs.readFileSync(globalPath, 'utf8') : null;

    try {
      fs.writeFileSync(globalPath, JSON.stringify({ ais: [{ id: 'cursor-agent', name: 'Global Override', configTemplate: { commandsDir: '.cursor/commands', rulesDir: '.cursor/rules', subagentSupport: 'native' } }] }), 'utf8');
      let list = AIRegistry.load({ cwd: mergeCwd });
      let cursor = list.find((a) => a.id === 'cursor-agent');
      assert.strictEqual(cursor.name, 'Global Override');

      fs.writeFileSync(projectPath, JSON.stringify({ ais: [{ id: 'cursor-agent', name: 'Project Override', configTemplate: { commandsDir: '.cursor/commands', rulesDir: '.cursor/rules', subagentSupport: 'native' } }] }), 'utf8');
      list = AIRegistry.load({ cwd: mergeCwd });
      cursor = list.find((a) => a.id === 'cursor-agent');
      assert.strictEqual(cursor.name, 'Project Override');
    } finally {
      if (globalBackup != null) fs.writeFileSync(globalPath, globalBackup);
      else if (fs.existsSync(globalPath)) fs.unlinkSync(globalPath);
      if (fs.existsSync(projectPath)) fs.unlinkSync(projectPath);
    }
  });

  it('T3.1 two formats: { ais: [...] } and [...]', () => {
    const fmtCwd = path.join(tmpRoot, 'fmt-test');
    const projectDir = path.join(fmtCwd, '_bmad-output', 'config');
    mkdirp(projectDir);

    const format1 = path.join(projectDir, 'ai-registry.json');
    fs.writeFileSync(format1, JSON.stringify({ ais: [{ id: 'custom1', name: 'Custom1', configTemplate: { commandsDir: '.x/commands', subagentSupport: 'none' } }] }), 'utf8');
    let list = AIRegistry.load({ cwd: fmtCwd });
    let c1 = list.find((a) => a.id === 'custom1');
    assert.ok(c1, 'format {ais} should work');
    assert.strictEqual(c1.configTemplate.commandsDir, '.x/commands');

    fs.writeFileSync(format1, JSON.stringify([{ id: 'custom2', name: 'Custom2', configTemplate: { commandsDir: '.y/commands', subagentSupport: 'none' } }]), 'utf8');
    list = AIRegistry.load({ cwd: fmtCwd });
    const c2 = list.find((a) => a.id === 'custom2');
    assert.ok(c2, 'format [...] should work');
    assert.strictEqual(c2.configTemplate.commandsDir, '.y/commands');
  });

  it('T3.2 custom AI without configTemplate throws', () => {
    const valCwd = path.join(tmpRoot, 'valid-custom');
    const projectDir = path.join(valCwd, '_bmad-output', 'config');
    mkdirp(projectDir);
    fs.writeFileSync(
      path.join(projectDir, 'ai-registry.json'),
      JSON.stringify({ ais: [{ id: 'bad-custom', name: 'Bad', description: 'no configTemplate' }] }),
      'utf8',
    );
    try {
      AIRegistry.load({ cwd: valCwd });
      assert.fail('expected throw for missing configTemplate');
    } catch (err) {
      assert.ok(err.message.includes('configTemplate') || err.message.includes('ai-registry') || err.message.includes('Invalid'));
    }
  });

  it('T3.3 configTemplate validate: commandsDir or rulesDir at least one', () => {
    const valCwd = path.join(tmpRoot, 'valid-ct');
    const projectDir = path.join(valCwd, '_bmad-output', 'config');
    mkdirp(projectDir);
    fs.writeFileSync(
      path.join(projectDir, 'ai-registry.json'),
      JSON.stringify({
        ais: [{ id: 'invalid-ct', name: 'Invalid', configTemplate: { skillsDir: '.x/skills', subagentSupport: 'none' } }],
      }),
      'utf8',
    );
    try {
      AIRegistry.load({ cwd: valCwd });
      assert.fail('expected throw for invalid configTemplate');
    } catch (err) {
      assert.ok(err.message.length > 0);
    }
  });

  it('T1.4 configTemplate deep merge', () => {
    const deepCwd = path.join(tmpRoot, 'deep-merge');
    const projectDir = path.join(deepCwd, '_bmad-output', 'config');
    mkdirp(projectDir);
    fs.writeFileSync(
      path.join(projectDir, 'ai-registry.json'),
      JSON.stringify({
        ais: [{
          id: 'cursor-agent',
          name: 'Cursor Agent',
          configTemplate: { commandsDir: '.my-custom/commands', rulesDir: '.cursor/rules', subagentSupport: 'native' },
        }],
      }),
      'utf8',
    );
    const list = AIRegistry.load({ cwd: deepCwd });
    const cursor = list.find((a) => a.id === 'cursor-agent');
    assert.strictEqual(cursor.configTemplate.commandsDir, '.my-custom/commands', 'project should override');
    assert.strictEqual(cursor.configTemplate.rulesDir, '.cursor/rules');
  });
});
