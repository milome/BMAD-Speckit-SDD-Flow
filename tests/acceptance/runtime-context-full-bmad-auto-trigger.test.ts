import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureProjectRuntimeContext } from '../../scripts/runtime-context';
import { readRuntimeContextRegistry, runtimeContextRegistryPath } from '../../scripts/runtime-context-registry';

describe('runtime-context full_bmad auto trigger', () => {
  it('creates project registry/context automatically from sprint-status without manual registry assembly', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'full-bmad-auto-'));
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

      const context = ensureProjectRuntimeContext(root, { hasSprintStatus: true as any });
      const registry = readRuntimeContextRegistry(root);

      expect(context.sourceMode).toBe('full_bmad');
      expect(readFileSync(runtimeContextRegistryPath(root), 'utf8')).toContain('epic-14');
      expect(registry.project.activeEpicIds).toContain('epic-14');
      expect(registry.project.activeStoryIds).toContain('14-1-runtime-context-refactor');
      expect(registry.activeScope.scopeType).toBe('project');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
