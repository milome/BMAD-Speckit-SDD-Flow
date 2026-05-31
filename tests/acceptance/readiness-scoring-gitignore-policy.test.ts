import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('readiness scoring gitignore policy', () => {
  it('blocks accidental runtime readiness scoring output under package data', () => {
    const gitignore = readFileSync('.gitignore', 'utf8');

    expect(gitignore).toContain('packages/scoring/data/*-readiness-*.json');
    expect(gitignore).toContain('packages/scoring/data/_patch-snapshots/');
  });
});
