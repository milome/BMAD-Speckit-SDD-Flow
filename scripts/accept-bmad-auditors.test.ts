import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('auditor agents', () => {
  it('spec auditor contains required elements', () => {
    const content = readFileSync('.claude/agents/auditors/auditor-spec.md', 'utf8');
    expect(content).toContain('audit-prompts.md');
    expect(content).toContain('parse-and-write-score.ts');
    expect(content).toContain('PASS');
    expect(content).toContain('FAIL');
  });

  it('plan auditor contains required elements', () => {
    const content = readFileSync('.claude/agents/auditors/auditor-plan.md', 'utf8');
    expect(content).toContain('audit-prompts.md');
    expect(content).toContain('PASS');
    expect(content).toContain('FAIL');
  });

  it('tasks auditor contains required elements', () => {
    const content = readFileSync('.claude/agents/auditors/auditor-tasks.md', 'utf8');
    expect(content).toContain('audit-prompts.md');
    expect(content).toContain('TDD');
    expect(content).toContain('PASS');
    expect(content).toContain('FAIL');
  });

  it('implement auditor contains required elements', () => {
    const content = readFileSync('.claude/agents/auditors/auditor-implement.md', 'utf8');
    expect(content).toContain('audit-prompts.md');
    expect(content).toContain('--stage implement');
    expect(content).toContain('PASS');
    expect(content).toContain('FAIL');
  });
});
