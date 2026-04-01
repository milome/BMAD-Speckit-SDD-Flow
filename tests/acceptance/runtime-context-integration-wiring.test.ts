import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProjectRegistryFromSprintStatus, writeRuntimeContextRegistry, runtimeContextRegistryPath } from '../../scripts/runtime-context-registry';
import { writeRuntimeContextFromSprintStatus, projectContextPath } from '../../scripts/runtime-context';

describe('runtime-context integration wiring', () => {
  it('produces both registry and project context from sprint-status in a real output tree', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-wire-'));
    try {
      const sprintStatusPath = path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml');
      mkdirSync(path.dirname(sprintStatusPath), { recursive: true });
      writeFileSync(
        sprintStatusPath,
        [
          'generated: "2026-03-22"',
          'project: MyApp',
          'tracking_system: file-system',
          'story_location: "{project-root}/_bmad-output/implementation-artifacts"',
          'development_status:',
          '  epic-14: in-progress',
          '  14-1-runtime-context-refactor: ready-for-dev',
        ].join('\n'),
        'utf8'
      );

      const registry = buildProjectRegistryFromSprintStatus(root, sprintStatusPath);
      writeRuntimeContextRegistry(root, registry);
      writeRuntimeContextFromSprintStatus(root, sprintStatusPath);

      const registryFile = runtimeContextRegistryPath(root);
      const contextFile = projectContextPath(root);
      const registryRaw = readFileSync(registryFile, 'utf8');
      const contextRaw = readFileSync(contextFile, 'utf8');

      expect(registryRaw).toContain('epic-14');
      expect(registryRaw).toContain('14-1-runtime-context-refactor');
      expect(contextRaw).toContain('"sourceMode": "full_bmad"');
      expect(contextRaw).toContain('"contextScope": "project"');
      expect(contextRaw).toContain('"storyId": "14-1-runtime-context-refactor"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
