const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { syncAllAIs } = require('../src/commands/init');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

function writeSkill(projectRoot, name = 'global-skill') {
  const skillDir = path.join(projectRoot, '_bmad', 'skills', name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `${name}\n`, 'utf8');
}

function writeGlobalAiRegistry(projectRoot) {
  writeJson(path.join(projectRoot, '_bmad-output', 'config', 'ai-registry.json'), {
    ais: [
      {
        id: 'global-ai',
        name: 'Global AI',
        configTemplate: {
          commandsDir: '.global/commands',
          skillsDir: '~/.global-ai/skills',
          skillScope: 'user-global',
          subagentSupport: 'none',
        },
      },
    ],
  });
}

describe('init command global skill authorization propagation', () => {
  it('does not allow user-global publishing by default', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'init-command-global-default-'));
    const homeRoot = path.join(root, 'home');
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    try {
      process.env.HOME = homeRoot;
      process.env.USERPROFILE = homeRoot;
      writeSkill(root);
      writeGlobalAiRegistry(root);

      const result = syncAllAIs(root, ['global-ai'], {});
      assert.deepStrictEqual(result.published, []);
      assert.ok(result.skippedReasons.some((reason) => reason.includes('global skill writes require')));
      assert.strictEqual(fs.existsSync(path.join(homeRoot, '.global-ai', 'skills')), false);
    } finally {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('allows user-global publishing only when explicit authorization is provided', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'init-command-global-allowed-'));
    const homeRoot = path.join(root, 'home');
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    try {
      process.env.HOME = homeRoot;
      process.env.USERPROFILE = homeRoot;
      writeSkill(root);
      writeGlobalAiRegistry(root);

      const result = syncAllAIs(root, ['global-ai'], {
        allowGlobalSkillWrites: true,
        globalSkillWriteReason: 'test explicit global authorization',
      });
      assert.deepStrictEqual(result.published, ['global-skill']);
      assert.strictEqual(fs.existsSync(path.join(homeRoot, '.global-ai', 'skills', 'global-skill', 'SKILL.md')), true);
    } finally {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
