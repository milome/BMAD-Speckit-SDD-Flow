import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { computeContentHash, computeStringHash, getGitHeadHash, getGitHeadHashFull } from '../hash';

describe('computeStringHash', () => {
  it('returns consistent SHA-256 for same input', () => {
    const h1 = computeStringHash('hello world');
    const h2 = computeStringHash('hello world');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('returns different hash for different input', () => {
    const h1 = computeStringHash('aaa');
    const h2 = computeStringHash('bbb');
    expect(h1).not.toBe(h2);
  });

  it('returns hex string', () => {
    const h = computeStringHash('test');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('computeContentHash', () => {
  it('computes hash from file content', () => {
    const tmpDir = path.join(os.tmpdir(), `hash-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, 'test.txt');
    fs.writeFileSync(filePath, 'file content for hash', 'utf-8');

    const hash = computeContentHash(filePath);
    const expected = computeStringHash('file content for hash');
    expect(hash).toBe(expected);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('getGitHeadHash', () => {
  it('returns a string of length 8 in a git repo', () => {
    const hash = getGitHeadHash();
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(8);
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('returns undefined for non-git directory', () => {
    const tmpDir = path.join(os.tmpdir(), `no-git-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const hash = getGitHeadHash(tmpDir);
    expect(hash).toBeUndefined();

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});

describe('getGitHeadHashFull', () => {
  it('returns full 40-char hash in a git repo', () => {
    const hash = getGitHeadHashFull();
    expect(hash).toBeDefined();
    expect(hash).toHaveLength(40);
    expect(hash).toMatch(/^[0-9a-f]{40}$/);
  });
});
