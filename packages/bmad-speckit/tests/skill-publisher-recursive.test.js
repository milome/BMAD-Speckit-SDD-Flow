const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SkillPublisher = require('../src/services/skill-publisher');

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeFile(file, content) {
  mkdirp(path.dirname(file));
  fs.writeFileSync(file, content, 'utf8');
}

describe('SkillPublisher recursive workflow skill publishing', () => {
  it('publishes workflow-based skills like bmad-create-prd into target skillsDir', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-publisher-recursive-'));
    const projectRoot = path.join(root, 'project');
    const homeRoot = path.join(root, 'home');
    const bmadRoot = path.join(projectRoot, '_bmad');
    const destRoot = path.join(homeRoot, '.claude', 'skills');

    mkdirp(path.join(bmadRoot, '_config'));
    mkdirp(destRoot);

    writeFile(
      path.join(projectRoot, '_bmad-output', 'config', 'ai-registry.json'),
      JSON.stringify([
        {
          id: 'test-ai',
          name: 'Test AI',
          configTemplate: {
            commandsDir: '.claude/commands',
            rulesDir: '.claude/rules',
            skillsDir: '~/.claude/skills',
            sourceDir: 'claude',
          },
        },
      ]),
    );

    writeFile(
      path.join(bmadRoot, 'bmm', 'workflows', '2-plan-workflows', 'bmad-create-prd', 'SKILL.md'),
      ['---', 'name: bmad-create-prd', 'description: test skill', '---', '', 'Follow ./workflow.md'].join('\n'),
    );
    writeFile(
      path.join(bmadRoot, 'bmm', 'workflows', '2-plan-workflows', 'bmad-create-prd', 'workflow.md'),
      '# workflow\n',
    );

    const previousHome = process.env.USERPROFILE;
    process.env.USERPROFILE = homeRoot;
    try {
      const result = SkillPublisher.publish(projectRoot, 'test-ai');
      const installedSkill = path.join(destRoot, 'bmad-create-prd', 'SKILL.md');
      const installedWorkflow = path.join(destRoot, 'bmad-create-prd', 'workflow.md');

      assert.ok(result.published.includes('bmad-create-prd'), 'published skills should include bmad-create-prd');
      assert.ok(fs.existsSync(installedSkill), 'recursive workflow skill should be installed');
      assert.ok(fs.existsSync(installedWorkflow), 'workflow companion files should be installed');
    } finally {
      process.env.USERPROFILE = previousHome;
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
