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
        '2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md'
      ),
      'utf8'
    );
    expect(planDoc).toContain('已完全移除，不再作为 runtime context');
    expect(planDoc).toContain('.speckit-state.yaml');
  });
});
