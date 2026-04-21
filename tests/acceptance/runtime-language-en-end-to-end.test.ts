import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime language en end-to-end', () => {
  it('documents english-only narrative requirement for all major output surfaces', () => {
    const repoRoot = process.cwd();
    const architectureDoc = readFileSync(
      path.join(repoRoot, 'docs', 'plans', '2026-03-22-runtime-governance-正式架构设计文档-bmad原生上下文同步版.md'),
      'utf8'
    );
    const implPlan = readFileSync(
      path.join(repoRoot, 'docs', 'plans', '2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md'),
      'utf8'
    );

    expect(architectureDoc).toContain('languagePolicy');
    expect(architectureDoc).toContain('审计报告');
    expect(architectureDoc).toContain('trace');
    expect(architectureDoc).toContain('SFT');
    expect(implPlan).toContain('language');
    expect(implPlan).toContain('RuntimePolicy');
  });
});
