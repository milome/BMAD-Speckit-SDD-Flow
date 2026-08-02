const { describe, it } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const INIT_TO_ROOT = path.join(ROOT, 'scripts', 'init-to-root.js');
const MAX_CODEX_DESCRIPTION_LENGTH = 1024;
const REQUIRED_DESCRIPTION_FRAGMENTS = {
  'bmad-help': [
    'upstream BMAD workflow',
    'catalog',
    'Do not use for generic next-step',
    'active RequirementRecord',
  ],
  'bmad-speckit': [
    'natural-language',
    'next-step',
    'active RequirementRecord',
    '下一步',
    '继续',
    '现在该做什么',
  ],
  bmads: [
    'natural-language',
    'next-step',
    'active RequirementRecord',
    '下一步',
    '继续',
    '现在该做什么',
  ],
  'bmad-story-assistant': [
    'Epic/Story',
    'Create Story',
    'Story audit',
    'Dev Story',
    'post-implementation audit',
    'party-mode',
    'ralph-method',
    'TDD traffic lights',
    'Codex worker',
    'code-reviewer',
    'commit gate',
  ],
  'speckit-workflow': [
    '/speckit.specify',
    '/speckit.plan',
    'IMPLEMENTATION_GAPS',
    'tasks.md',
    'tasks-v*.md',
    'requirement mapping',
    'clarify/checklist/analyze',
    'code-review',
    'audit closed loops',
    'TDD red-green-refactor',
    'ralph-wiggum',
    'active regression testing',
  ],
};

function readSkillDescription(skillPath) {
  const lines = fs.readFileSync(skillPath, 'utf8').replace(/^\uFEFF/u, '').split(/\r?\n/u);
  assert.strictEqual(lines[0], '---', `${skillPath} must start with YAML frontmatter`);
  const endIndex = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  assert.ok(endIndex > 0, `${skillPath} must close YAML frontmatter`);
  const frontmatter = lines.slice(1, endIndex);
  const descriptionIndex = frontmatter.findIndex((line) => line.startsWith('description:'));
  assert.ok(descriptionIndex >= 0, `${skillPath} must contain description frontmatter`);

  const inline = frontmatter[descriptionIndex].replace(/^description:\s*/u, '').trim();
  if (inline === '|') {
    const blockLines = [];
    for (let i = descriptionIndex + 1; i < frontmatter.length; i += 1) {
      const line = frontmatter[i];
      if (!/^\s/u.test(line)) break;
      blockLines.push(line.replace(/^\s+/u, ''));
    }
    return blockLines.join('\n');
  }

  return inline.replace(/^['"]|['"]$/gu, '');
}

function collectSkillFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSkillFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'SKILL.md') {
      files.push(fullPath);
    }
  }
  return files;
}

describe('Codex skill description limit', () => {
  it('keeps every materialized Codex SKILL.md description within the 1024 character platform limit', () => {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-skill-limit-'));

    try {
      const result = spawnSync(process.execPath, [INIT_TO_ROOT, projectRoot, '--agent', 'codex'], {
        cwd: ROOT,
        encoding: 'utf8',
      });

      assert.strictEqual(
        result.status,
        0,
        `init-to-root should succeed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
      );

      const skillRoot = path.join(projectRoot, '.codex', 'skills');
      const overLimit = [];
      const missingFragments = [];
      for (const skillPath of collectSkillFiles(skillRoot)) {
        const description = readSkillDescription(skillPath);
        const skill = path.relative(skillRoot, path.dirname(skillPath)).replace(/\\/gu, '/');
        if (description.length > MAX_CODEX_DESCRIPTION_LENGTH) {
          overLimit.push({
            skill,
            length: description.length,
          });
        }
        for (const fragment of REQUIRED_DESCRIPTION_FRAGMENTS[skill] || []) {
          if (!description.includes(fragment)) {
            missingFragments.push({ skill, fragment });
          }
        }
      }
      assert.deepStrictEqual(overLimit, []);
      assert.deepStrictEqual(missingFragments, []);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });
});
