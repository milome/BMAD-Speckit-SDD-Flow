/**
 * structure-validate unit tests (Story 10.5 - T1.1)
 * Run: node --test tests/structure-validate.test.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

let validateBmadStructure;
try {
  const sv = require('../src/utils/structure-validate');
  validateBmadStructure = sv.validateBmadStructure || sv;
} catch (e) {
  validateBmadStructure = null;
}

const tmpDir = path.join(os.tmpdir(), `bmad-speckit-sv-${Date.now()}`);

describe('T1.1: validateBmadStructure - module exists', () => {
  it('module exists and exports validateBmadStructure', () => {
    assert.ok(validateBmadStructure, 'structure-validate module should exist');
    assert.strictEqual(typeof validateBmadStructure, 'function');
  });
});

describe('T1.1: validateBmadStructure - path does not exist', () => {
  it('returns valid: false for nonexistent path', () => {
    if (!validateBmadStructure) return;
    const result = validateBmadStructure(path.join(tmpDir, 'nonexistent'));
    assert.strictEqual(result.valid, false);
    assert.ok(Array.isArray(result.missing) || typeof result.missing !== 'undefined');
  });
});

describe('T1.1: validateBmadStructure - structure不符合 (empty or missing dirs)', () => {
  it('returns valid: false for empty directory', () => {
    if (!validateBmadStructure) return;
    const empty = path.join(tmpDir, 'empty');
    fs.mkdirSync(empty, { recursive: true });
    const result = validateBmadStructure(empty);
    assert.strictEqual(result.valid, false);
    assert.ok(Array.isArray(result.missing) && result.missing.length > 0);
  });

  it('returns valid: false when only one of core/cursor/speckit/skills exists', () => {
    if (!validateBmadStructure) return;
    const one = path.join(tmpDir, 'one');
    fs.mkdirSync(one, { recursive: true });
    fs.mkdirSync(path.join(one, 'core'), { recursive: true });
    const result = validateBmadStructure(one);
    assert.strictEqual(result.valid, false);
  });
});

describe('T1.1: validateBmadStructure - structure符合', () => {
  it('returns valid: true when at least two of core/cursor/speckit/skills exist (no cursor so no commands/rules check)', () => {
    if (!validateBmadStructure) return;
    const valid = path.join(tmpDir, 'valid');
    fs.mkdirSync(path.join(valid, 'core'), { recursive: true });
    fs.mkdirSync(path.join(valid, 'speckit'), { recursive: true });
    const result = validateBmadStructure(valid);
    assert.strictEqual(result.valid, true);
  });

  it('returns valid: true when cursor exists and has commands/ and rules/', () => {
    if (!validateBmadStructure) return;
    const withCursor = path.join(tmpDir, 'withCursor');
    fs.mkdirSync(path.join(withCursor, 'core'), { recursive: true });
    fs.mkdirSync(path.join(withCursor, 'cursor', 'commands'), { recursive: true });
    fs.mkdirSync(path.join(withCursor, 'cursor', 'rules'), { recursive: true });
    const result = validateBmadStructure(withCursor);
    assert.strictEqual(result.valid, true);
  });
});
