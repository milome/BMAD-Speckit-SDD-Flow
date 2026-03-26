import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  buildProjectRegistryFromSprintStatus,
  buildEpicContextsFromSprintStatus,
  buildStoryContextsFromSprintStatus,
  buildRunContext,
  writeRuntimeContextRegistry,
  runtimeContextRegistryPath,
} from '../../scripts/runtime-context-registry';
import { writeRuntimeContextFromSprintStatus } from '../../scripts/runtime-context';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime-context milestone: full runtime chain', () => {
  it('builds project/epic/story/run registry data and resolves policy for story lifecycle stages in one integrated flow', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-milestone-'));
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
          '  14-2-registry-sync: backlog',
        ].join('\n'),
        'utf8'
      );

      const registry = buildProjectRegistryFromSprintStatus(root, sprintStatusPath);
      registry.epicContexts = buildEpicContextsFromSprintStatus(root, sprintStatusPath);
      registry.storyContexts = buildStoryContextsFromSprintStatus(root, sprintStatusPath);
      writeRuntimeContextRegistry(root, registry);
      writeRuntimeContextFromSprintStatus(root, sprintStatusPath);

      const lifecycleRuns = [
        {
          runId: 'milestone-story-create-001',
          lifecycleStage: 'story_create' as const,
          workflowStage: undefined,
          expectedStage: 'story_create',
          expectedTrigger: undefined,
          expectedStrictness: 'standard',
        },
        {
          runId: 'milestone-story-audit-001',
          lifecycleStage: 'story_audit' as const,
          workflowStage: undefined,
          expectedStage: 'story_audit',
          expectedTrigger: undefined,
          expectedStrictness: 'standard',
        },
        {
          runId: 'milestone-dev-implement-001',
          lifecycleStage: 'dev_story' as const,
          workflowStage: 'implement' as const,
          expectedStage: 'implement',
          expectedTrigger: 'speckit_5_2',
          expectedStrictness: 'strict',
        },
        {
          runId: 'milestone-post-audit-001',
          lifecycleStage: 'post_audit' as const,
          workflowStage: undefined,
          expectedStage: 'post_audit',
          expectedTrigger: 'bmad_story_stage4',
          expectedStrictness: 'strict',
        },
      ];

      for (const scenario of lifecycleRuns) {
        const runContext = buildRunContext(root, {
          epicId: 'epic-14',
          storyId: '14-1-runtime-context-refactor',
          storySlug: 'runtime-context-refactor',
          runId: scenario.runId,
          lifecycleStage: scenario.lifecycleStage,
          ...(scenario.workflowStage ? { workflowStage: scenario.workflowStage } : {}),
        });
        registry.runContexts[scenario.runId] = runContext;
        registry.activeScope = {
          scopeType: 'run',
          epicId: 'epic-14',
          storyId: '14-1-runtime-context-refactor',
          runId: scenario.runId,
        };
        writeRuntimeContextRegistry(root, registry);
        mkdirSync(path.dirname(runContext.path), { recursive: true });
        writeFileSync(
          runContext.path,
          JSON.stringify(
            {
              version: 1,
              flow: 'story',
              stage: scenario.expectedStage,
              sourceMode: 'full_bmad',
              contextScope: 'story',
              epicId: 'epic-14',
              storyId: '14-1-runtime-context-refactor',
              storySlug: 'runtime-context-refactor',
              runId: scenario.runId,
              artifactRoot: '_bmad-output/implementation-artifacts/epic-14/14-1-runtime-context-refactor',
              updatedAt: new Date().toISOString(),
            },
            null,
            2
          ) + '\n',
          'utf8'
        );

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
        expect(output).toContain(`"runId":"${scenario.runId}"`);
        expect(output).toContain(`"stage":"${scenario.expectedStage}"`);
        expect(output).toContain(`"strictness":"${scenario.expectedStrictness}"`);
        if (scenario.expectedTrigger) {
          expect(output).toContain(`"triggerStage":"${scenario.expectedTrigger}"`);
        }
      }

      const registryRaw = readFileSync(runtimeContextRegistryPath(root), 'utf8');
      expect(registryRaw).toContain('epic-14');
      expect(registryRaw).toContain('14-1-runtime-context-refactor');
      expect(registryRaw).toContain('14-2-registry-sync');
      expect(registryRaw).toContain('"scopeType": "run"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
