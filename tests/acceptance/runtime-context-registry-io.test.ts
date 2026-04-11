import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  runtimeContextRegistryPath,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('runtime-context-registry io', () => {
  it('creates, writes, and reads registry under _bmad-output/runtime/registry.json', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-registry-'));
    try {
      const registry = defaultRuntimeContextRegistry(root);
      writeRuntimeContextRegistry(root, registry);

      const registryPath = runtimeContextRegistryPath(root);
      expect(registryPath).toContain('_bmad-output');
      expect(registryPath).toContain(path.join('runtime', 'registry.json'));
      expect(existsSync(registryPath)).toBe(true);

      const loaded = readRuntimeContextRegistry(root);
      expect(loaded.version).toBe(1);
      expect(loaded.projectRoot).toBe(root);
      expect(loaded.projectContextPath).toContain(
        path.join('_bmad-output', 'runtime', 'context', 'project.json')
      );
      expect(loaded.sources.storyArtifactsRoot).toBe('_bmad-output/implementation-artifacts');
      expect(loaded.sources.specsRoot).toBe('specs');
      expect(loaded.auditIndex.bugfix).toEqual({});
      expect(loaded.auditIndex.standalone_tasks).toEqual({});
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
