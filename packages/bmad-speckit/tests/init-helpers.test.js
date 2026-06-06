/**
 * Unit tests for init.js helper functions: parseAIList, validateAIIds, syncAllAIs
 * and add-agent.js, utils/json.js
 */
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

function mkdirp(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

describe('parseAIList', () => {
  const { parseAIList } = require('../src/commands/init');

  it('returns empty for null/undefined/non-string', () => {
    assert.deepStrictEqual(parseAIList(null), []);
    assert.deepStrictEqual(parseAIList(undefined), []);
    assert.deepStrictEqual(parseAIList(123), []);
    assert.deepStrictEqual(parseAIList(''), []);
  });

  it('parses single AI', () => {
    assert.deepStrictEqual(parseAIList('claude'), ['claude']);
  });

  it('parses comma-separated AIs with trim', () => {
    assert.deepStrictEqual(parseAIList('cursor-agent, claude'), ['cursor-agent', 'claude']);
    assert.deepStrictEqual(parseAIList(' a , b , c '), ['a', 'b', 'c']);
  });

  it('filters empty segments from double commas', () => {
    assert.deepStrictEqual(parseAIList('a,,b'), ['a', 'b']);
    assert.deepStrictEqual(parseAIList(',a,'), ['a']);
  });
});

describe('validateAIIds', () => {
  const { validateAIIds } = require('../src/commands/init');

  it('separates valid and invalid IDs', () => {
    const cwd = process.cwd();
    const result = validateAIIds(['claude', 'nonexistent-ai-xyz'], cwd);
    assert.ok(result.valid.includes('claude'));
    assert.ok(result.invalid.includes('nonexistent-ai-xyz'));
  });

  it('handles empty array', () => {
    const result = validateAIIds([], process.cwd());
    assert.deepStrictEqual(result.valid, []);
    assert.deepStrictEqual(result.invalid, []);
  });
});

describe('syncAllAIs', () => {
  const { syncAllAIs } = require('../src/commands/init');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syncAllAIs-'));
    const bmad = path.join(tmpDir, '_bmad');
    mkdirp(path.join(bmad, 'commands'));
    fs.writeFileSync(path.join(bmad, 'commands', 'test.md'), 'cmd', 'utf8');
    mkdirp(path.join(bmad, 'skills', 'test-skill'));
    fs.writeFileSync(path.join(bmad, 'skills', 'test-skill', 'SKILL.md'), 'skill', 'utf8');
    mkdirp(path.join(bmad, 'cursor', 'rules'));
    fs.writeFileSync(path.join(bmad, 'cursor', 'rules', 'r.md'), 'rule', 'utf8');
    mkdirp(path.join(bmad, 'claude', 'rules'));
    fs.writeFileSync(path.join(bmad, 'claude', 'rules', 'r.md'), 'rule', 'utf8');
    mkdirp(path.join(bmad, 'claude', 'hooks'));
    mkdirp(path.join(bmad, 'claude', 'state', 'stories'));
    fs.writeFileSync(path.join(bmad, 'claude', 'settings.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(bmad, 'claude', 'CLAUDE.md.template'), '# {{PROJECT_NAME}}', 'utf8');
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it('syncs multiple AIs sequentially and aggregates results', () => {
    const result = syncAllAIs(tmpDir, ['cursor-agent', 'claude'], { noAiSkills: true });
    assert.ok(Array.isArray(result.published));
    assert.ok(Array.isArray(result.skippedReasons));
    assert.ok(Array.isArray(result.errors));
    assert.strictEqual(result.errors.length, 0);
  });

  it('isolates per-AI errors without aborting', () => {
    const result = syncAllAIs(tmpDir, ['nonexistent-ai-id-xyz', 'cursor-agent'], { noAiSkills: true });
    assert.ok(result.errors.length <= 1);
  });

  it('returns empty results when AIs are not in registry (graceful skip)', () => {
    const result = syncAllAIs(tmpDir, ['nonexistent-1', 'nonexistent-2'], { noAiSkills: true });
    assert.ok(Array.isArray(result.published));
    assert.ok(Array.isArray(result.errors));
  });

  it('syncs codex in ESM consumer projects without treating speckit mirror helper as ESM', () => {
    fs.writeFileSync(path.join(tmpDir, 'package.json'), '{"type":"module"}\n', 'utf8');
    const mirrorDir = path.join(tmpDir, '_bmad', 'speckit', 'scripts', 'node');
    mkdirp(mirrorDir);
    fs.writeFileSync(
      path.join(mirrorDir, 'speckit-mirror.js'),
      [
        "const fs = require('node:fs');",
        "const path = require('node:path');",
        "function syncSpecifyMirror({ projectRoot }) {",
        "  fs.mkdirSync(path.join(projectRoot, '.specify', 'memory'), { recursive: true });",
        "}",
        "module.exports = { syncSpecifyMirror };",
        '',
      ].join('\n'),
      'utf8'
    );

    const result = syncAllAIs(tmpDir, ['codex'], { noAiSkills: true });

    assert.strictEqual(result.errors.length, 0);
    assert.ok(fs.existsSync(path.join(tmpDir, '.specify', 'memory')));
  });

  it('publishes requirements contract skill with package runtime confirmation guidance', () => {
    const sourceSkill = path.resolve(__dirname, '..', '..', '..', '_bmad', 'skills', 'requirements-contract-authoring', 'SKILL.md');
    const targetSkillDir = path.join(tmpDir, '_bmad', 'skills', 'requirements-contract-authoring');
    mkdirp(targetSkillDir);
    fs.copyFileSync(sourceSkill, path.join(targetSkillDir, 'SKILL.md'));

    const result = syncAllAIs(tmpDir, ['codex'], {});
    const publishedSkill = fs.readFileSync(
      path.join(tmpDir, '.codex', 'skills', 'requirements-contract-authoring', 'SKILL.md'),
      'utf8'
    );

    assert.strictEqual(result.errors.length, 0);
    assert.match(publishedSkill, /bmad-speckit main-agent confirm-scope/);
    assert.doesNotMatch(publishedSkill, /scripts[\\/]main-agent-orchestration\.ts/);
  });

  it('publishes runtime entry skills and commands with consumer-safe package CLI commands', () => {
    const sourceBmadRoot = path.resolve(__dirname, '..', '..', '..', '_bmad');
    const copyBmadFile = (relativePath) => {
      const source = path.join(sourceBmadRoot, relativePath);
      const target = path.join(tmpDir, '_bmad', relativePath);
      mkdirp(path.dirname(target));
      fs.copyFileSync(source, target);
    };

    for (const relativePath of [
      path.join('commands', 'bmads.md'),
      path.join('skills', 'bmads', 'SKILL.md'),
      path.join('skills', 'bmad-speckit', 'SKILL.md'),
      path.join('skills', 'bmad-help', 'SKILL.md'),
      path.join('skills', 'main-agent-runtime-migration', 'SKILL.md'),
    ]) {
      copyBmadFile(relativePath);
    }

    const result = syncAllAIs(tmpDir, ['codex', 'claude', 'cursor-agent'], {});

    assert.strictEqual(result.errors.length, 0);
    const publishedFiles = [
      path.join('.codex', 'commands', 'bmads.md'),
      path.join('.codex', 'skills', 'bmads', 'SKILL.md'),
      path.join('.codex', 'skills', 'bmad-speckit', 'SKILL.md'),
      path.join('.codex', 'skills', 'bmad-help', 'SKILL.md'),
      path.join('.codex', 'skills', 'main-agent-runtime-migration', 'SKILL.md'),
      path.join('.claude', 'commands', 'bmads.md'),
      path.join('.claude', 'skills', 'bmads', 'SKILL.md'),
      path.join('.claude', 'skills', 'bmad-speckit', 'SKILL.md'),
      path.join('.claude', 'skills', 'bmad-help', 'SKILL.md'),
      path.join('.claude', 'skills', 'main-agent-runtime-migration', 'SKILL.md'),
      path.join('.cursor', 'commands', 'bmads.md'),
      path.join('.cursor', 'skills', 'bmads', 'SKILL.md'),
      path.join('.cursor', 'skills', 'bmad-speckit', 'SKILL.md'),
      path.join('.cursor', 'skills', 'bmad-help', 'SKILL.md'),
      path.join('.cursor', 'skills', 'main-agent-runtime-migration', 'SKILL.md'),
    ];

    for (const relativePath of publishedFiles) {
      const content = fs.readFileSync(path.join(tmpDir, relativePath), 'utf8');
      assert.doesNotMatch(
        content,
        /packages[\\/]bmad-speckit[\\/]bin[\\/]bmad-speckit\.js/,
        `${relativePath} must not point consumer projects at the source-repository CLI path`
      );
      assert.match(
        content,
        /bmad-speckit/,
        `${relativePath} must refer to the installed package runtime`
      );
    }

    for (const relativePath of publishedFiles.filter((file) => !file.includes('main-agent-runtime-migration'))) {
      const content = fs.readFileSync(path.join(tmpDir, relativePath), 'utf8');
      assert.match(
        content,
        /npx --no-install bmad-speckit (?:bmads|bmad-help)/,
        `${relativePath} must document the installed package CLI entry`
      );
    }
  });

  it('publishes Codex, Claude, and Cursor platform skills with YAML frontmatter as the first line', () => {
    const skillNames = [
      'bmad-code-reviewer-lifecycle',
      'bmad-rca-helper',
      'bmad-standalone-tasks-doc-review',
    ];
    const platforms = [
      { ai: 'codex', source: 'codex', target: '.codex' },
      { ai: 'claude', source: 'claude', target: '.claude' },
      { ai: 'cursor-agent', source: 'cursor', target: '.cursor' },
    ];

    for (const platform of platforms) {
      const sourceRoot = path.resolve(__dirname, '..', '..', '..', '_bmad', platform.source, 'skills');
      for (const skill of skillNames) {
        const sourceSkillDir = path.join(sourceRoot, skill);
        const targetSkillDir = path.join(tmpDir, '_bmad', platform.source, 'skills', skill);
        mkdirp(targetSkillDir);
        fs.copyFileSync(path.join(sourceSkillDir, 'SKILL.md'), path.join(targetSkillDir, 'SKILL.md'));
      }
    }

    const result = syncAllAIs(tmpDir, platforms.map((platform) => platform.ai), {});

    assert.strictEqual(result.errors.length, 0);
    for (const platform of platforms) {
      for (const skill of skillNames) {
        const publishedSkill = fs.readFileSync(
          path.join(tmpDir, platform.target, 'skills', skill, 'SKILL.md'),
          'utf8'
        );
        const lines = publishedSkill.split(/\r?\n/u);
        assert.strictEqual(lines[0], '---', `${platform.target}/${skill} must start with YAML frontmatter`);
        assert.ok(
          lines.findIndex((line, index) => index > 0 && line.trim() === '---') > 0,
          `${platform.target}/${skill} must close YAML frontmatter`
        );
        assert.doesNotMatch(publishedSkill, /^<!--\s*BLOCK_LABEL_POLICY=/u);
        assert.match(publishedSkill, new RegExp(`name:\\s*["']?${skill}`));
      }
    }
  });
});

describe('readJsonSafe', () => {
  const { readJsonSafe } = require('../src/utils/json');
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readJsonSafe-'));
  });

  afterEach(() => {
    rmrf(tmpDir);
  });

  it('reads valid JSON', () => {
    const p = path.join(tmpDir, 'test.json');
    fs.writeFileSync(p, '{"a":1}', 'utf8');
    assert.deepStrictEqual(readJsonSafe(p), { a: 1 });
  });

  it('returns null for missing file', () => {
    assert.strictEqual(readJsonSafe(path.join(tmpDir, 'nope.json')), null);
  });

  it('returns null for invalid JSON', () => {
    const p = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(p, '{not json}', 'utf8');
    assert.strictEqual(readJsonSafe(p), null);
  });
});
