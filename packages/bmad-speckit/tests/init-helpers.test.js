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
