import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime english milestone artifact references', () => {
  it('keeps milestone tests discoverable from the implementation plan', () => {
    const root = process.cwd();
    const implPlan = readFileSync(
      path.join(root, 'docs', 'plans', '2026-03-22-runtime-governance-runtime-context-重构实施计划文档.md'),
      'utf8'
    );
    expect(implPlan).toContain('runtime-context-full-chain-milestone.test.ts');
    expect(implPlan).toContain('runtime-language-english-chain-milestone.test.ts');
  });
});
