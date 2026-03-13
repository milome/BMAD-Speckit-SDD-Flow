import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('layer4 tasks agent', () => {
  it('contains required elements', () => {
    const agent = readFileSync('.claude/agents/layers/bmad-layer4-speckit-tasks.md', 'utf8');
    expect(agent).toContain('auditor-tasks');
    expect(agent).toContain('TDD');
    expect(agent).toContain('RED');
    expect(agent).toContain('GREEN');
    expect(agent).toContain('REFACTOR');
    expect(agent).toContain('Lint');
  });
});
