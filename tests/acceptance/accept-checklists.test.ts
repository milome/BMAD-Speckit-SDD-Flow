import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('dry-run checklist', () => {
  it('checklist document exists', () => {
    expect(existsSync('docs/plans/2026-03-13-bmad-claude-cli-dry-run-checklist.md')).toBe(true);
  });
});

describe('pilot checklist', () => {
  it('checklist document exists', () => {
    expect(existsSync('docs/plans/2026-03-13-bmad-claude-cli-pilot-story-checklist.md')).toBe(true);
  });
});
