import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime workflow entrypoint contract', () => {
  it('implementation plan explicitly binds runtime context sync to BMAD workflow entry points', () => {
    const root = process.cwd();
    const implPlan = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md'),
      'utf8'
    );

    expect(implPlan).toContain('story-scoped');
    expect(implPlan).toContain('runId');
    expect(implPlan).toContain('Cursor native hooks');
    expect(implPlan).toContain('RuntimePolicy');
  });
});
