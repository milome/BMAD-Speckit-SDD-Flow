import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('bmad-master agent', () => {
  it('contains required gatekeeper elements', () => {
    const masterAgent = readFileSync('.claude/agents/bmad-master.md', 'utf8');
    expect(masterAgent).toContain('.claude/state/bmad-progress.yaml');
    expect(masterAgent).toContain('commit_request');
    expect(masterAgent).toContain('auditor-spec');
    expect(masterAgent).toContain('auditor-plan');
    expect(masterAgent).toContain('auditor-tasks');
    expect(masterAgent).toContain('禁止在未通过审计时放行 commit');
  });
});
