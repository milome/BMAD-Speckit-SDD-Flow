import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('isolation matrix', () => {
  it('documents runtime boundaries for cursor and claude-code', () => {
    const doc = readFileSync('docs/plans/2026-03-13-ai-agent-isolation-matrix.md', 'utf8');
    expect(doc).toContain('.cursor/');
    expect(doc).toContain('.claude/');
    expect(doc).toContain('state');
    expect(doc).toContain('hooks');
    expect(doc).toContain('checkpoints');
  });
});
