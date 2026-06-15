const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertIncludes(content, fragments, context) {
  const missing = fragments.filter((fragment) => !content.includes(fragment));
  assert.deepStrictEqual(missing, [], `${context} is missing required fragments`);
}

describe('Codex skill reference contracts', () => {
  it('keeps bmad-story-assistant entry hard rules in a required reference', () => {
    const skillPath = '_bmad/codex/skills/bmad-story-assistant/SKILL.en.md';
    const referencePath = '_bmad/codex/skills/bmad-story-assistant/references/entry-rules.md';

    assert.ok(fs.existsSync(path.join(ROOT, referencePath)), `${referencePath} must exist`);

    const skill = read(skillPath);
    assertIncludes(
      skill,
      ['## Required References', '[entry-rules.md](references/entry-rules.md)'],
      skillPath
    );

    const reference = read(referencePath);
    assertIncludes(
      reference,
      [
        'Phase zero',
        'party-mode',
        'Do not skip',
        '20 / 50 / 100',
        'SubagentStart',
        'Codex worker',
        'code-reviewer',
        'general-purpose',
      ],
      referencePath
    );
  });

  it('keeps speckit-workflow required references visible at the top of SKILL.en.md', () => {
    const skillPath = '_bmad/codex/skills/speckit-workflow/SKILL.en.md';
    const skill = read(skillPath);
    const requiredReferencesIndex = skill.indexOf('## Required References');

    assert.ok(requiredReferencesIndex >= 0, `${skillPath} must include Required References`);
    assert.ok(
      requiredReferencesIndex < skill.indexOf('## Runtime Governance for this round'),
      'Required References must appear before execution details'
    );

    const requiredReferences = [
      'references/audit-prompts.md',
      'references/audit-document-iteration-rules.md',
      'references/mapping-tables.md',
      'references/task-execution-tdd.md',
      'references/qa-agent-rules.md',
      'references/audit-post-impl-rules.md',
      'references/lint-requirement-matrix.md',
    ];

    for (const reference of requiredReferences) {
      assert.ok(fs.existsSync(path.join(ROOT, '_bmad/codex/skills/speckit-workflow', reference)));
      assert.ok(skill.includes(`](${reference})`), `${skillPath} must cite ${reference}`);
    }
  });
});
