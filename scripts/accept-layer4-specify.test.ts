import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('layer4 specify agent', () => {
  it('contains required elements', () => {
    const agent = readFileSync('.claude/agents/layers/bmad-layer4-speckit-specify.md', 'utf8');
    expect(agent).toContain('skills/speckit-workflow/SKILL.md');
    expect(agent).toContain('auditor-spec');
    expect(agent).toContain('禁止自行 commit');
    expect(agent).toContain('bmad-progress.yaml');
    expect(agent).toContain('需求映射表格');
  });
});
