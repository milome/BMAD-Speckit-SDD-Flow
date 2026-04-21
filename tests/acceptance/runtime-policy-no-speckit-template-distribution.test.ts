import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime-policy no speckit template distribution', () => {
  it('does not treat removed speckit template assets as formal runtime-context templates in implementation docs', () => {
    const repoRoot = process.cwd();
    const planDoc = readFileSync(
      path.join(
        repoRoot,
        'docs',
        'plans',
        '2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md'
      ),
      'utf8'
    );
    expect(planDoc).toContain('.speckit-state.yaml');
    expect(planDoc).toContain('不作为并发模式 fallback');
  });
});
