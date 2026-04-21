import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime-policy no speckit template distribution', () => {
  it('does not treat removed speckit template assets as runtime-context inputs in tracked references', () => {
    const repoRoot = process.cwd();
    const runtimeContextRef = readFileSync(
      path.join(repoRoot, 'docs', 'reference', 'runtime-context.md'),
      'utf8'
    );
    const migrationGuide = readFileSync(
      path.join(repoRoot, 'docs', 'how-to', 'migration.md'),
      'utf8'
    );
    expect(runtimeContextRef).toContain('`.speckit-state.yaml` 已完全移除');
    expect(runtimeContextRef).toContain('不允许再回退');
    expect(migrationGuide).toContain('.speckit-state.yaml');
    expect(migrationGuide).toContain('不应创建、分发或复制该文件作为运行时治理依赖');
  });
});
