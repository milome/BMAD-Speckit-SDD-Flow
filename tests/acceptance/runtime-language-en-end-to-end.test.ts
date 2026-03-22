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
      path.join(repoRoot, 'docs', 'plans', '2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md'),
      'utf8'
    );

    expect(architectureDoc).toContain('languagePolicy = en');
    expect(architectureDoc).toContain('审计报告');
    expect(architectureDoc).toContain('scoring explanation');
    expect(architectureDoc).toContain('trace');
    expect(architectureDoc).toContain('hook fail-loud');
    expect(architectureDoc).toContain('SFT narrative');
    expect(implPlan).toContain('languagePolicy = en');
    expect(implPlan).toContain('全链路英文输出门禁');
  });
});
