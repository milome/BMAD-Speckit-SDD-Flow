import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cross install order', () => {
  it('documents both installation orders for strict isolation', () => {
    const doc = readFileSync('docs/INSTALLATION_AND_MIGRATION_GUIDE.md', 'utf8');
    expect(doc).toContain('cursor->claude-code');
    expect(doc).toContain('claude-code->cursor');
  });
});
