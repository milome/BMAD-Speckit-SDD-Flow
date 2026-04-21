import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime workflow entrypoint contract', () => {
  it('tracked runtime context sources explicitly bind story/run scope to workflow entry points', () => {
    const root = process.cwd();
    const runtimeContextRef = readFileSync(
      path.join(root, 'docs', 'reference', 'runtime-context.md'),
      'utf8'
    );
    const registrySource = readFileSync(
      path.join(root, 'scripts', 'runtime-context-registry.ts'),
      'utf8'
    );

    expect(runtimeContextRef).toContain('story-scoped 模式');
    expect(runtimeContextRef).toContain('story-scoped 运行上下文');
    expect(registrySource).toContain('runContexts');
    expect(registrySource).toContain('activeScope');
    expect(registrySource).toContain("scopeType: 'run'");
  });
});
