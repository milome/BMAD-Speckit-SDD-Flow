import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('cross install order', () => {
  it('documents both installation orders for strict isolation', () => {
    const doc = readFileSync('docs/tutorials/getting-started.md', 'utf8');
    expect(doc).toContain('--agent cursor');
    expect(doc).toContain('--agent claude-code');
  });
});
