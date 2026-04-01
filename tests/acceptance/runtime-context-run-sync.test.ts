import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildRunContext } from '../../scripts/runtime-context-registry';

describe('runtime-context run sync', () => {
  it('builds run context for dev_story and post_audit with lifecycle/workflow stages', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'run-sync-'));
    try {
      const devRun = buildRunContext(root, {
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        storySlug: 'runtime-context-refactor',
        runId: 'run-dev-001',
        lifecycleStage: 'dev_story',
        workflowStage: 'implement',
      });

      expect(devRun.scopeType).toBe('run');
      expect(devRun.lifecycleStage).toBe('dev_story');
      expect(devRun.workflowStage).toBe('implement');
      expect(devRun.runId).toBe('run-dev-001');
      expect(devRun.path).toContain(path.join('_bmad-output', 'runtime', 'context', 'runs'));

      const auditRun = buildRunContext(root, {
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        storySlug: 'runtime-context-refactor',
        runId: 'run-audit-001',
        lifecycleStage: 'post_audit',
      });

      expect(auditRun.scopeType).toBe('run');
      expect(auditRun.lifecycleStage).toBe('post_audit');
      expect(auditRun.workflowStage).toBeUndefined();
      expect(auditRun.runId).toBe('run-audit-001');
      expect(auditRun.path).toContain('run-audit-001.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
