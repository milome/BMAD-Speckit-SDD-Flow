import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cursor regression gate', () => {
  it('documents cursor non-regression as a release gate', () => {
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('test:cursor-regression');
  });
});
