import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildProjectRegistryFromSprintStatus } from '../../scripts/runtime-context-registry';

describe('runtime-context project sync', () => {
  it('derives active epic/story ids from sprint-status development_status', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'project-sync-'));
    try {
      const sprintStatusPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        'sprint-status.yaml'
      );
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
          '  epic-15: done',
        ].join('\n'),
        'utf8'
      );

      const registry = buildProjectRegistryFromSprintStatus(root, sprintStatusPath);
      expect(registry.projectRoot).toBe(root);
      expect(registry.sources.sprintStatusPath).toBe(
        '_bmad-output/implementation-artifacts/sprint-status.yaml'
      );
      expect(registry.activeScope.scopeType).toBe('project');
      expect(registry.project.activeEpicIds).toEqual(['epic-14', 'epic-15']);
      expect(registry.project.activeStoryIds).toEqual([
        '14-1-runtime-context-refactor',
        '14-2-registry-sync',
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
