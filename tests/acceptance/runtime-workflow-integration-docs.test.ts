import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime workflow integration docs', () => {
  it('documents runtime context sync at BMAD workflow entry points', () => {
    const root = process.cwd();
    const implPlan = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md'),
      'utf8'
    );

    expect(implPlan).toContain('sprint planning / sprint status');
    expect(implPlan).toContain('create epics and stories');
    expect(implPlan).toContain('create story');
    expect(implPlan).toContain('implement / post-audit');
    expect(implPlan).toContain('自动写 registry/context');
  });
});
