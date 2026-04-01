import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProjectRegistryFromSprintStatus, writeRuntimeContextRegistry, runtimeContextRegistryPath } from '../../scripts/runtime-context-registry';

describe('runtime-context workflow wiring', () => {
  it('can persist a sprint-derived registry in the runtime output area', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'workflow-wire-'));
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

      const file = runtimeContextRegistryPath(root);
      const raw = readFileSync(file, 'utf8');
      expect(raw).toContain('epic-14');
      expect(raw).toContain('14-1-runtime-context-refactor');
      expect(raw).toContain('_bmad-output/implementation-artifacts/sprint-status.yaml');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
