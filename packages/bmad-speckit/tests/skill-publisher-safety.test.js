const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SkillPublisher = require('../src/services/skill-publisher');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function writeSkill(projectRoot, name = 'sentinel-skill') {
  const skillDir = path.join(projectRoot, '_bmad', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `${name}\n`, 'utf8');
}

function writeRegistry(projectRoot, entry) {
  writeJson(path.join(projectRoot, '_bmad-output', 'config', 'ai-registry.json'), [entry]);
}

describe('SkillPublisher safety boundaries', () => {
  it('resolves project scope skillsDir inside projectRoot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-publisher-project-'));
    try {
      const destination = SkillPublisher.resolveSkillsDestination(
        root,
        { skillsDir: '.cursor/skills', skillScope: 'project' },
      );

      assert.strictEqual(destination.scope, 'project');
      assert.strictEqual(destination.escapedProjectRoot, false);
      assert.strictEqual(destination.resolvedPath, path.resolve(root, '.cursor/skills'));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects project scope skillsDir that escapes projectRoot', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-publisher-escape-'));
    try {
      writeSkill(root);
      writeRegistry(root, {
        id: 'escape-ai',
        configTemplate: {
          commandsDir: '.x/commands',
          skillsDir: '../outside/skills',
          skillScope: 'project',
          subagentSupport: 'none',
        },
      });

      const result = SkillPublisher.publish(root, 'escape-ai');
      assert.deepStrictEqual(result.published, []);
      assert.ok(result.skippedReasons.some((reason) => reason.includes('escapes project root')));
      assert.strictEqual(fs.existsSync(path.resolve(root, '..', 'outside', 'skills')), false);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('treats tilde skillsDir as user-global scope', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-publisher-global-scope-'));
    try {
      const destination = SkillPublisher.resolveSkillsDestination(root, {
        skillsDir: '~/.claude/skills',
        skillScope: 'user-global',
      });

      assert.strictEqual(destination.scope, 'user-global');
      assert.strictEqual(destination.escapedProjectRoot, true);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects user-global publishing without allowGlobalSkillWrites', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-publisher-global-reject-'));
    const homeRoot = path.join(root, 'home');
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    try {
      process.env.HOME = homeRoot;
      process.env.USERPROFILE = homeRoot;
      writeSkill(root);
      writeRegistry(root, {
        id: 'global-ai',
        configTemplate: {
          commandsDir: '.x/commands',
          skillsDir: '~/.claude/skills',
          skillScope: 'user-global',
          subagentSupport: 'none',
        },
      });

      const result = SkillPublisher.publish(root, 'global-ai');
      assert.deepStrictEqual(result.published, []);
      assert.ok(result.skippedReasons.some((reason) => reason.includes('global skill writes require')));
      assert.strictEqual(fs.existsSync(path.join(homeRoot, '.claude', 'skills')), false);
    } finally {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('requires a reason when user-global publishing is allowed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-publisher-global-reason-'));
    const homeRoot = path.join(root, 'home');
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    try {
      process.env.HOME = homeRoot;
      process.env.USERPROFILE = homeRoot;
      writeSkill(root, 'global-skill');
      writeRegistry(root, {
        id: 'global-ai',
        configTemplate: {
          commandsDir: '.x/commands',
          skillsDir: '~/.claude/skills',
          skillScope: 'user-global',
          subagentSupport: 'none',
        },
      });

      const missingReason = SkillPublisher.publish(root, 'global-ai', {
        allowGlobalSkillWrites: true,
      });
      assert.deepStrictEqual(missingReason.published, []);
      assert.strictEqual(fs.existsSync(path.join(homeRoot, '.claude', 'skills')), false);

      const result = SkillPublisher.publish(root, 'global-ai', {
        allowGlobalSkillWrites: true,
        globalSkillWriteReason: 'test explicit global authorization',
      });
      assert.deepStrictEqual(result.published, ['global-skill']);
      assert.strictEqual(fs.existsSync(path.join(homeRoot, '.claude', 'skills', 'global-skill', 'SKILL.md')), true);
    } finally {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
