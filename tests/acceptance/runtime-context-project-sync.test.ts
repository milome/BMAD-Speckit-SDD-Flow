import { describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import {
  defaultRuntimeContextFile,
  projectContextPath,
  writeRuntimeContext,
} from '../../scripts/runtime-context';

describe('runtime-context project sync', () => {
  it('keeps project context and registry aligned with sprint-status derived roots', () => {
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
        ].join('\n'),
        'utf8'
      );

      const registry = defaultRuntimeContextRegistry(root);
      writeRuntimeContextRegistry(root, registry);
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'story_create',
          sourceMode: 'full_bmad',
        })
      );

      const loadedRegistry = readRuntimeContextRegistry(root);
      expect(loadedRegistry.projectRoot).toBe(root);
      expect(loadedRegistry.sources.sprintStatusPath).toBe(
        '_bmad-output/implementation-artifacts/sprint-status.yaml'
      );
      expect(loadedRegistry.projectContextPath).toContain(
        path.join('_bmad-output', 'runtime', 'context', 'project.json')
      );
      expect(projectContextPath(root)).toContain(
        path.join('_bmad-output', 'runtime', 'context', 'project.json')
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
