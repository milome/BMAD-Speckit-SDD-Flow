import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bmad state skeleton', () => {
  it('creates _bmad/claude/state directory skeleton with .gitkeep', () => {
    expect(existsSync('_bmad/claude/state/.gitkeep')).toBe(true);
    expect(existsSync('_bmad/claude/state/stories/.gitkeep')).toBe(true);
    expect(existsSync('_bmad/claude/state/locks/.gitkeep')).toBe(true);
    expect(existsSync('_bmad/claude/state/handoffs/.gitkeep')).toBe(true);
  });

  it('has epic progress template', () => {
    expect(existsSync('_bmad/claude/state/epics/TEMPLATE-epic-progress.yaml')).toBe(true);
    const content = readFileSync('_bmad/claude/state/epics/TEMPLATE-epic-progress.yaml', 'utf8');
    expect(content).toContain('epic:');
  });
});
