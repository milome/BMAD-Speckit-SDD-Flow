import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('extension agents', () => {
  it('all agents follow protocol', () => {
    const standalone = readFileSync('.claude/agents/layers/bmad-standalone-tasks.md', 'utf8');
    const bugAgent = readFileSync('.claude/agents/layers/bmad-bug-agent.md', 'utf8');
    const reviewer = readFileSync('.claude/agents/layers/bmad-code-reviewer-lifecycle.md', 'utf8');

    for (const content of [standalone, bugAgent, reviewer]) {
      expect(content).toContain('bmad-progress.yaml');
      expect(content).toContain('audit-result-schema.md');
      expect(content).toContain('禁止自行 commit');
    }
  });
});
