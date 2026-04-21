import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('isolation matrix', () => {
  it('documents runtime boundaries for cursor and claude-code', () => {
    const doc = readFileSync('docs/how-to/runtime-governance-auto-inject-cursor-claude.md', 'utf8');
    expect(doc).toContain('.cursor/hooks.json');
    expect(doc).toContain('.claude/settings.json');
    expect(doc).toContain('runtime context / registry bootstrap');
    expect(doc).toContain('hooks');
    expect(doc).toContain('shared canonical logic');
  });
});
