import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('layer4 plan agent', () => {
  it('contains required elements', () => {
    const agent = readFileSync('.claude/agents/layers/bmad-layer4-speckit-plan.md', 'utf8');
    expect(agent).toContain('auditor-plan');
    expect(agent).toContain('集成测试');
    expect(agent).toContain('端到端功能测试');
    expect(agent).toContain('禁止自行 commit');
  });
});
