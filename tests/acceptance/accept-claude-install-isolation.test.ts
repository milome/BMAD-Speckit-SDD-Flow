import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('claude isolation gate', () => {
  it('defines a dedicated claude validation entry', () => {
    const pkg = readFileSync('package.json', 'utf8');
    expect(pkg).toContain('test:claude-isolation');
  });
});
