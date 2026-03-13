import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('install docs isolation model', () => {
  it('documents separate install flows for cursor and claude-code', () => {
    const doc = readFileSync('docs/INSTALLATION_AND_MIGRATION_GUIDE.md', 'utf8');
    expect(doc).toContain('cursor');
    expect(doc).toContain('claude-code');
    expect(doc).toContain('--agent');
    expect(doc).toContain('strict isolation');
  });
});
