import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('claude docs symmetry', () => {
  it('documents claude-specific runtime checks alongside cursor checks', () => {
    const doc = readFileSync('CLAUDE.md', 'utf8');
    expect(doc).toContain('.claude/state');
    expect(doc).toContain('.claude/hooks');
    expect(doc).toContain('test:claude-isolation');
  });
});
