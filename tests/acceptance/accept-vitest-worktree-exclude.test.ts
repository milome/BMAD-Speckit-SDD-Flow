import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('vitest worktree hygiene', () => {
  it('excludes .worktrees from vitest discovery', () => {
    const config = readFileSync('vitest.config.ts', 'utf8');
    expect(config).toContain('.worktrees');
  });
});
