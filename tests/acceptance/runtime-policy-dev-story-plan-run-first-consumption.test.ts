import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildProjectRegistryFromSprintStatus,
  buildStoryContextsFromSprintStatus,
  buildRunContext,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime-policy dev-story plan run-first consumption', () => {
  it('resolves dev_story plan run through registry-first consumption with workflow-stage-specific trigger semantics', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dev-story-plan-'));
    try {
      const configSource = path.join(process.cwd(), '_bmad', '_config');
      const configTarget = path.join(root, '_bmad', '_config');
      mkdirSync(path.dirname(configTarget), { recursive: true });
      cpSync(configSource, configTarget, { recursive: true });

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
      const runContext = buildRunContext(root, {
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        storySlug: 'runtime-context-refactor',
        runId: 'run-dev-plan-001',
        lifecycleStage: 'dev_story',
        workflowStage: 'plan',
      });
      registry.runContexts['run-dev-plan-001'] = runContext;
      registry.activeScope = {
        scopeType: 'run',
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        runId: 'run-dev-plan-001',
      };
      writeRuntimeContextRegistry(root, registry);
      mkdirSync(path.dirname(runContext.path), { recursive: true });
      writeFileSync(
        runContext.path,
        JSON.stringify(
          {
            version: 1,
            flow: 'story',
            stage: 'plan',
            sourceMode: 'full_bmad',
            contextScope: 'story',
            epicId: 'epic-14',
            storyId: '14-1-runtime-context-refactor',
            storySlug: 'runtime-context-refactor',
            runId: 'run-dev-plan-001',
            artifactRoot: '_bmad-output/implementation-artifacts/epic-14/14-1-runtime-context-refactor',
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ) + '\n',
        'utf8'
      );

      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      const chunks: string[] = [];
      const originalWrite = process.stdout.write.bind(process.stdout);
      (process.stdout as any).write = (chunk: any) => {
        chunks.push(String(chunk));
        return true;
      };
      try {
        const code = mainEmitRuntimePolicy(['--cwd', root]);
        expect(code).toBe(0);
      } finally {
        (process.stdout as any).write = originalWrite;
      }

      const output = chunks.join('');
      expect(output).toContain('"runId":"run-dev-plan-001"');
      expect(output).toContain('"stage":"plan"');
      expect(output).toContain('"strictness":"standard"');
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
