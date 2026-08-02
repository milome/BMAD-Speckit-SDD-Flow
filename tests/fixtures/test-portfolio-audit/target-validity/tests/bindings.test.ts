import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const TARGET_ROWS = [{ path: 'src/array-target.ts' }];

function readFixture(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function readNestedFixture(relativePath: string): string {
  const targetPath = path.join(ROOT, relativePath);
  return readFileSync(targetPath, 'utf8');
}

describe('target bindings', () => {
  it('reads targets without importing their modules', () => {
    expect(readFixture('.github/workflows/target-validity.yml')).not.toHaveLength(0);
    expect(
      readFixture('_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json')
    ).not.toHaveLength(0);
    expect(readFixture('src/generated-active.ts')).not.toHaveLength(0);
    expect(readFixture('src/generator-source.ts')).not.toHaveLength(0);
    expect(readNestedFixture('src/registry-active.ts')).not.toHaveLength(0);
    expect(readFixture('src/script-entry.ts')).not.toHaveLength(0);
    expect(readFixture('src/workflow-entry.ts')).not.toHaveLength(0);
    for (const target of TARGET_ROWS) {
      expect(readFileSync(path.join(ROOT, target.path), 'utf8')).not.toHaveLength(0);
    }
  });
});
