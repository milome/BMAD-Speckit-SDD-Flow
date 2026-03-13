/**
 * Story 12.1 T2.1-T2.3: ai-registry-builtin 单元测试
 * 验收: 22条、每条含 id/name/description/configTemplate、configTemplate 含 commandsDir/rulesDir/skillsDir/agentsDir|configDir/subagentSupport
 * spec-kit 对齐: opencode→.opencode/command, auggie→.augment/rules, bob→.bob/commands, shai→.shai/commands, codex→.codex/commands
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const builtin = require('../src/constants/ai-registry-builtin');

const SUBAGENT_VALID = ['native', 'mcp', 'limited', 'none'];
const _BUILTIN_IDS = [
  'cursor-agent', 'claude', 'gemini', 'copilot', 'qwen', 'opencode', 'codex', 'windsurf', 'kilocode',
  'auggie', 'roo', 'codebuddy', 'amp', 'shai', 'q', 'agy', 'bob', 'qodercli', 'cody', 'tabnine', 'kiro-cli', 'generic',
];

describe('ai-registry-builtin (Story 12.1 T2)', () => {
  it('exports array of 22 entries', () => {
    assert.strictEqual(Array.isArray(builtin), true);
    assert.strictEqual(builtin.length, 22);
  });

  it('each entry has id, name, description, configTemplate', () => {
    for (const entry of builtin) {
      assert.strictEqual(typeof entry.id, 'string', `entry ${entry.id} missing id`);
      assert.strictEqual(typeof entry.name, 'string', `entry ${entry.id} missing name`);
      assert.ok(entry.description === undefined || typeof entry.description === 'string', `entry ${entry.id} description`);
      assert.strictEqual(typeof entry.configTemplate, 'object', `entry ${entry.id} missing configTemplate`);
    }
  });

  it('each configTemplate has subagentSupport', () => {
    for (const entry of builtin) {
      assert.ok(entry.configTemplate.subagentSupport != null, `entry ${entry.id} missing subagentSupport`);
      assert.ok(
        SUBAGENT_VALID.includes(entry.configTemplate.subagentSupport) || entry.id === 'generic',
        `entry ${entry.id} invalid subagentSupport: ${entry.configTemplate.subagentSupport}`,
      );
    }
  });

  it('opencode uses .opencode/command (spec-kit)', () => {
    const e = builtin.find((x) => x.id === 'opencode');
    assert.ok(e, 'opencode not found');
    assert.strictEqual(e.configTemplate.commandsDir, '.opencode/command');
  });

  it('auggie uses .augment/rules only (no commandsDir)', () => {
    const e = builtin.find((x) => x.id === 'auggie');
    assert.ok(e, 'auggie not found');
    assert.strictEqual(e.configTemplate.rulesDir, '.augment/rules');
    assert.ok(!e.configTemplate.commandsDir || e.configTemplate.commandsDir === '');
  });

  it('bob uses .bob/commands', () => {
    const e = builtin.find((x) => x.id === 'bob');
    assert.ok(e, 'bob not found');
    assert.strictEqual(e.configTemplate.commandsDir, '.bob/commands');
  });

  it('shai uses .shai/commands', () => {
    const e = builtin.find((x) => x.id === 'shai');
    assert.ok(e, 'shai not found');
    assert.strictEqual(e.configTemplate.commandsDir, '.shai/commands');
  });

  it('codex uses .codex/commands and .codex/config.toml', () => {
    const e = builtin.find((x) => x.id === 'codex');
    assert.ok(e, 'codex not found');
    assert.strictEqual(e.configTemplate.commandsDir, '.codex/commands');
    assert.strictEqual(e.configTemplate.configDir, '.codex/config.toml');
  });

  it('commandsDir or rulesDir at least one (condition) - except cody/tabnine per spec §4.3', () => {
    const exempt = ['cody', 'tabnine', 'generic']; // spec: cody configDir only, tabnine skillsDir only, generic from registry
    for (const entry of builtin) {
      if (exempt.includes(entry.id)) continue;
      const hasCommands = entry.configTemplate.commandsDir && entry.configTemplate.commandsDir !== '';
      const hasRules = entry.configTemplate.rulesDir && entry.configTemplate.rulesDir !== '';
      assert.ok(hasCommands || hasRules, `entry ${entry.id} must have commandsDir or rulesDir`);
    }
  });

  it('agentsDir and configDir are mutually exclusive (at most one)', () => {
    for (const entry of builtin) {
      const hasAgents = entry.configTemplate.agentsDir && entry.configTemplate.agentsDir !== '';
      const hasConfig = entry.configTemplate.configDir && entry.configTemplate.configDir !== '';
      assert.ok(!hasAgents || !hasConfig, `entry ${entry.id} cannot have both agentsDir and configDir`);
    }
  });
});
