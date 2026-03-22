import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildEpicContextsFromSprintStatus,
} from '../../scripts/runtime-context-registry';

describe('runtime-context epic sync', () => {
  it('derives epic contexts from sprint-status development_status', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'epic-sync-'));
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
          '  epic-15: done',
          '  15-1-other-story: done',
        ].join('\n'),
        'utf8'
      );

      const epicContexts = buildEpicContextsFromSprintStatus(root, sprintStatusPath);
      expect(Object.keys(epicContexts)).toEqual(['epic-14', 'epic-15']);
      expect(epicContexts['epic-14'].path).toContain(path.join('_bmad-output', 'runtime', 'context', 'epics', 'epic-14.json'));
      expect(epicContexts['epic-14'].status).toBe('in-progress');
      expect(epicContexts['epic-15'].status).toBe('done');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
