import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('runtime workflow wiring targets', () => {
  it('keeps runtime registry utilities discoverable from project init and sprint gate entrypoints', () => {
    const root = process.cwd();
    const initScript = readFileSync(path.join(root, 'scripts', 'init-to-root.js'), 'utf8');
    const sprintGate = readFileSync(path.join(root, 'scripts', 'check-sprint-ready.ps1'), 'utf8');
    const registryScript = readFileSync(path.join(root, 'scripts', 'runtime-context-registry.ts'), 'utf8');

    expect(registryScript).toContain('runtimeContextRegistryPath');
    expect(registryScript).toContain('buildProjectRegistryFromSprintStatus');
    expect(initScript).toContain('write-runtime-context');
    expect(sprintGate).toContain('sprint-status.yaml');
  });
});
