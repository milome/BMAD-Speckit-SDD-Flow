import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildProjectRegistryFromSprintStatus,
  buildEpicContextsFromSprintStatus,
  buildStoryContextsFromSprintStatus,
  writeRuntimeContextRegistry,
  runtimeContextRegistryPath,
} from '../../scripts/runtime-context-registry';

describe('runtime-context epic/story readiness linkage', () => {
  it('keeps epic and story readiness data together inside registry for create-story routing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'epic-story-ready-'));
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
          '  14-2-registry-sync: backlog',
          '  epic-15: backlog',
        ].join('\n'),
        'utf8'
      );

      const registry = buildProjectRegistryFromSprintStatus(root, sprintStatusPath);
      registry.epicContexts = buildEpicContextsFromSprintStatus(root, sprintStatusPath);
      registry.storyContexts = buildStoryContextsFromSprintStatus(root, sprintStatusPath);
      writeRuntimeContextRegistry(root, registry);

      const raw = readFileSync(runtimeContextRegistryPath(root), 'utf8');
      expect(raw).toContain('"epic-14"');
      expect(raw).toContain('"status": "in-progress"');
      expect(raw).toContain('14-1-runtime-context-refactor');
      expect(raw).toContain('ready-for-dev');
      expect(raw).toContain('14-2-registry-sync');
      expect(raw).toContain('backlog');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
