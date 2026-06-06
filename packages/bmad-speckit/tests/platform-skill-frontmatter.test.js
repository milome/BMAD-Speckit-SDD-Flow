const { describe, it } = require('node:test');
const assert = require('node:assert');

const {
  normalizePlatformSkillFrontmatterContent,
} = require('../src/services/platform-skill-frontmatter');

function readDescription(content) {
  return content.match(/^description:\s*(.+)$/mu)?.[1]?.replace(/^['"]|['"]$/gu, '');
}

describe('platform skill frontmatter normalization', () => {
  it('short valid frontmatter is preserved', () => {
    const raw = [
      '---',
      'name: existing-skill',
      'description: Short description.',
      '---',
      '',
      '# Existing Skill',
      '',
    ].join('\n');

    assert.strictEqual(normalizePlatformSkillFrontmatterContent(raw, 'existing-skill'), raw);
  });

  it('normalizes existing overlong descriptions to curated summaries', () => {
    const longDescription = Array.from({ length: 120 }, () => 'long-description-fragment').join(' ');
    const raw = [
      '---',
      'name: bmad-story-assistant',
      'description: |',
      `  ${longDescription}`,
      '---',
      '',
      '# BMAD Story Assistant',
      '',
      'Body content remains available to the skill loader.',
    ].join('\n');

    const normalized = normalizePlatformSkillFrontmatterContent(raw, 'bmad-story-assistant');
    const description = readDescription(normalized);

    assert.ok(normalized.startsWith('---\nname: "bmad-story-assistant"\n'));
    assert.strictEqual(
      description,
      'Execute the BMAD story workflow by Epic/Story number: create story, audit, dev story, post-implementation audit, closeout validation, and Codex worker review dispatch when available.'
    );
    assert.ok(description.length <= 1024, 'description must stay within platform limit');
    assert.ok(!normalized.includes('description: |'), 'overlong block description should be compacted');
    assert.ok(normalized.includes('# BMAD Story Assistant'));
    assert.ok(normalized.includes('Body content remains available to the skill loader.'));
  });

  it('uses a safe generic summary for unknown overlong descriptions', () => {
    const raw = [
      '---',
      'name: unknown-skill',
      `description: ${Array.from({ length: 120 }, () => 'unknown-workflow-fragment').join(' ')}`,
      '---',
      '',
      '# Unknown Skill',
    ].join('\n');

    const normalized = normalizePlatformSkillFrontmatterContent(raw, 'unknown-skill');
    const description = readDescription(normalized);

    assert.strictEqual(
      description,
      'Platform skill unknown-skill. Use for the workflow described in the skill body; follow its trigger rules, steps, scripts, and verification requirements.'
    );
    assert.ok(description.length <= 1024);
    assert.ok(!description.includes('unknown-workflow-fragment'));
  });

  it('replaces known mechanically truncated summaries', () => {
    const raw = [
      '---',
      'name: speckit-workflow',
      `description: ${JSON.stringify('Improve the Speckit development process '.repeat(14) + 'for e')}`,
      '---',
      '',
      '# Speckit Workflow',
    ].join('\n');

    const normalized = normalizePlatformSkillFrontmatterContent(raw, 'speckit-workflow');
    const description = readDescription(normalized);

    assert.strictEqual(
      description,
      'Improve Speckit specify/plan/gaps/tasks/implement workflows with requirement mapping, audit closed-loop iteration, TDD red-green-refactor discipline, and validation gates.'
    );
  });
});
