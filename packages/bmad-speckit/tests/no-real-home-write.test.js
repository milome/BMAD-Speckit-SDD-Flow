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

function writeSentinelSkill(projectRoot, skillName) {
  const skillDir = path.join(projectRoot, '_bmad', 'skills', skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), `${skillName}\n`, 'utf8');
}

describe('default init skill publishing never writes to real home', () => {
  it('publishes the sentinel skill only into the temp project-local skills surfaces', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'no-real-home-write-'));
    const realHome = os.homedir();
    const projectRoot = path.join(root, 'project');
    const fakeHome = path.join(root, 'fake-home');
    const fakeAppData = path.join(root, 'fake-appdata');
    const fakeLocalAppData = path.join(root, 'fake-localappdata');
    const sentinel = `sentinel-skill-${Date.now()}`;
    const previousHome = process.env.HOME;
    const previousUserProfile = process.env.USERPROFILE;
    const previousAppData = process.env.APPDATA;
    const previousLocalAppData = process.env.LOCALAPPDATA;

    try {
      fs.mkdirSync(projectRoot, { recursive: true });
      fs.mkdirSync(fakeHome, { recursive: true });
      fs.mkdirSync(fakeAppData, { recursive: true });
      fs.mkdirSync(fakeLocalAppData, { recursive: true });

      process.env.HOME = fakeHome;
      process.env.USERPROFILE = fakeHome;
      process.env.APPDATA = fakeAppData;
      process.env.LOCALAPPDATA = fakeLocalAppData;

      fs.mkdirSync(path.join(projectRoot, '_bmad', 'commands'), { recursive: true });
      fs.writeFileSync(path.join(projectRoot, '_bmad', 'commands', 'placeholder.md'), '# placeholder\n', 'utf8');
      writeSentinelSkill(projectRoot, sentinel);
      const cursorResult = syncAllAIs(projectRoot, ['cursor-agent'], {});
      const claudeResult = syncAllAIs(projectRoot, ['claude'], {});
      const codexResult = syncAllAIs(projectRoot, ['codex'], {});

      assert.deepStrictEqual(cursorResult.published, [sentinel]);
      assert.deepStrictEqual(claudeResult.published, [sentinel]);
      assert.deepStrictEqual(codexResult.published, [sentinel]);

      assert.strictEqual(fs.existsSync(path.join(projectRoot, '.cursor', 'skills', sentinel, 'SKILL.md')), true);
      assert.strictEqual(fs.existsSync(path.join(projectRoot, '.claude', 'skills', sentinel, 'SKILL.md')), true);
      assert.strictEqual(fs.existsSync(path.join(projectRoot, '.codex', 'skills', sentinel, 'SKILL.md')), true);

      assert.strictEqual(fs.existsSync(path.join(realHome, '.cursor', 'skills', sentinel)), false);
      assert.strictEqual(fs.existsSync(path.join(realHome, '.claude', 'skills', sentinel)), false);
      assert.strictEqual(fs.existsSync(path.join(realHome, '.codex', 'skills', sentinel)), false);
    } finally {
      process.env.HOME = previousHome;
      process.env.USERPROFILE = previousUserProfile;
      process.env.APPDATA = previousAppData;
      process.env.LOCALAPPDATA = previousLocalAppData;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
