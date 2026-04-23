import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('standalone tasks claude adapter host guard', () => {
  it('guards against Cursor host misloading the Claude standalone-tasks adapter', () => {
    const content = readFileSync('_bmad/claude/skills/bmad-standalone-tasks/SKILL.md', 'utf8');
    expect(content).toContain('HOST_MISMATCH');
    expect(content).toContain('.cursor/skills/bmad-standalone-tasks/SKILL.md');
    expect(content).toMatch(/禁止.*Claude adapter.*Fallback.*降级逻辑/);
    expect(content).toContain('speckit-implement');
  });

  it('guards against Cursor host misloading the Claude standalone-tasks-doc-review adapter', () => {
    const content = readFileSync(
      '_bmad/claude/skills/bmad-standalone-tasks-doc-review/SKILL.md',
      'utf8'
    );
    expect(content).toContain('HOST_MISMATCH');
    expect(content).toContain('.cursor/skills/bmad-standalone-tasks-doc-review/SKILL.md');
    expect(content).toMatch(/禁止.*Claude adapter.*Fallback.*降级逻辑/);
  });
});
