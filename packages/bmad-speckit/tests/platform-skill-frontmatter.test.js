const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  normalizePlatformSkillFrontmatterContent,
  normalizePlatformSkillFrontmatterFile,
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

  it('preserves CRLF bytes for valid Codex skill frontmatter', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'platform-skill-frontmatter-'));
    const skillPath = path.join(root, '.codex', 'skills', 'existing-skill', 'SKILL.md');
    const raw = [
      '---',
      'name: existing-skill',
      'description: Short description.',
      '---',
      '',
      '# Existing Skill',
      '',
    ].join('\r\n');

    try {
      fs.mkdirSync(path.dirname(skillPath), { recursive: true });
      fs.writeFileSync(skillPath, raw, 'utf8');

      assert.strictEqual(normalizePlatformSkillFrontmatterFile(skillPath), false);
      assert.strictEqual(fs.readFileSync(skillPath, 'utf8'), raw);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
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
      'Use when the user provides Epic/Story numbers such as Story 4.1 or asks to create, implement, audit, or close out a BMAD story. Triggers include Create Story, Story audit, Dev Story, post-implementation audit, closeout approved, party-mode tier selection 20/50/100, ralph-method, TDD traffic lights, Codex worker/code-reviewer dispatch, handoff/state/score writing, commit gate, Chinese deliverables, and copy-paste prompts.'
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
      'Use when the user runs or asks about /speckit.constitution, /speckit.specify, /speckit.plan, /speckit.tasks, /speckit.implement, IMPLEMENTATION_GAPS, tasks.md, tasks-v*.md, or Speckit workflows needing requirement mapping, clarify/checklist/analyze, code-review audit closed loops, TDD red-green-refactor, QA_Agent rules, ralph-wiggum, architecture fidelity, no fake implementation, active regression testing, and validation gates.'
    );
  });
});
