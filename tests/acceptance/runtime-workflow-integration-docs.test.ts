import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime workflow integration docs', () => {
  it('documents runtime context sync through tracked hook and registry references', () => {
    const root = process.cwd();
    const hooksReference = readFileSync(
      path.join(root, 'docs', 'reference', 'cursor-runtime-governance-hooks.md'),
      'utf8'
    );
    const registrySource = readFileSync(
      path.join(root, 'scripts', 'runtime-context-registry.ts'),
      'utf8'
    );

    expect(hooksReference).toContain('.cursor/hooks.json');
    expect(hooksReference).toContain('story-scoped runtime context');
    expect(registrySource).toContain('projectContextPath');
    expect(registrySource).toContain('runId');
  });
});
