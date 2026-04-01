import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureProjectRuntimeContext } from '../../scripts/runtime-context';
import { readRuntimeContextRegistry } from '../../scripts/runtime-context-registry';

describe('runtime-context full_bmad mode', () => {
  it('ensureProjectRuntimeContext uses full_bmad when sprint-status exists', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'full-bmad-mode-'));
    try {
      const sprintPath = path.join(
        root,
        '_bmad-output',
        'implementation-artifacts',
        'sprint-status.yaml'
      );
      mkdirSync(path.dirname(sprintPath), { recursive: true });
      writeFileSync(
        sprintPath,
        [
          'generated: "2026-03-22"',
          'project: T',
          'tracking_system: file-system',
          'story_location: "{project-root}/_bmad-output/implementation-artifacts"',
          'development_status:',
          '  epic-1: backlog',
          '  1-1-a: backlog',
        ].join('\n'),
        'utf8'
      );

      const ctx = ensureProjectRuntimeContext(root, { hasSprintStatus: true });
      expect(ctx.sourceMode).toBe('full_bmad');
      const reg = readRuntimeContextRegistry(root);
      expect(reg.project.activeEpicIds).toContain('epic-1');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
