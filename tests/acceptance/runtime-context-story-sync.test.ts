import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildStoryContextsFromSprintStatus } from '../../scripts/runtime-context-registry';

describe('runtime-context story sync', () => {
  it('derives story contexts from sprint-status and binds artifact/spec roots', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'story-sync-'));
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
        ].join('\n'),
        'utf8'
      );

      const storyContexts = buildStoryContextsFromSprintStatus(root, sprintStatusPath);
      expect(Object.keys(storyContexts)).toEqual([
        '14-1-runtime-context-refactor',
        '14-2-registry-sync',
      ]);
      expect(storyContexts['14-1-runtime-context-refactor'].status).toBe('ready-for-dev');
      expect(storyContexts['14-1-runtime-context-refactor'].epicId).toBe('epic-14');
      expect(storyContexts['14-1-runtime-context-refactor'].artifactRoot).toContain(
        path.join('_bmad-output', 'implementation-artifacts')
      );
      expect(storyContexts['14-1-runtime-context-refactor'].specRoot).toContain(
        path.join('specs', 'epic-14')
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
