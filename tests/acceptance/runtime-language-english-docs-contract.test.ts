import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime language english docs contract', () => {
  it('keeps english-mode requirements explicit across architecture, registry, and implementation plan docs', () => {
    const root = process.cwd();
    const architectureDoc = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-22-runtime-governance-正式架构设计文档-bmad原生上下文同步版.md'),
      'utf8'
    );
    const registryDoc = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-22-runtime-context-registry-详细设计文档.md'),
      'utf8'
    );
    const implDoc = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-21-runtime-governance-story-scoped-dual-host-implementation-plan.md'),
      'utf8'
    );

    expect(architectureDoc).toContain('languagePolicy');
    expect(architectureDoc).toContain('hook');
    expect(registryDoc).toContain('runtime/context');
    expect(registryDoc).toContain('story');
    expect(implDoc).toContain('language');
    expect(implDoc).toContain('RuntimePolicy');
  });
});
