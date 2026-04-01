import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildProjectRegistryFromSprintStatus,
  buildStoryContextsFromSprintStatus,
  buildRunContext,
  writeRuntimeContextRegistry,
  runtimeContextRegistryPath,
} from '../../scripts/runtime-context-registry';
import { writeRuntimeContextFromSprintStatus } from '../../scripts/runtime-context';

describe('runtime-context story lifecycle wiring', () => {
  it('keeps project registry, project context, story contexts, and active run aligned for a story lifecycle transition', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'story-lifecycle-wire-'));
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
          '  14-1-runtime-context-refactor: in-progress',
        ].join('\n'),
        'utf8'
      );

      const registry = buildProjectRegistryFromSprintStatus(root, sprintStatusPath);
      registry.storyContexts = buildStoryContextsFromSprintStatus(root, sprintStatusPath);
      registry.runContexts['run-dev-003'] = buildRunContext(root, {
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        storySlug: 'runtime-context-refactor',
        runId: 'run-dev-003',
        lifecycleStage: 'dev_story',
        workflowStage: 'implement',
      });
      registry.activeScope = {
        scopeType: 'run',
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        runId: 'run-dev-003',
      };

      writeRuntimeContextRegistry(root, registry);
      writeRuntimeContextFromSprintStatus(root, sprintStatusPath);

      const registryRaw = readFileSync(runtimeContextRegistryPath(root), 'utf8');
      expect(registryRaw).toContain('run-dev-003');
      expect(registryRaw).toContain('14-1-runtime-context-refactor');
      expect(registryRaw).toContain('"scopeType": "run"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
