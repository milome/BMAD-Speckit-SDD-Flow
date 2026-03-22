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

function runScenario(
  root: string,
  workflowStage: 'constitution' | 'specify' | 'gaps',
  effectiveStage: 'specify' | 'gaps',
  runId: string
) {
  const registry = buildProjectRegistryFromSprintStatus(
    root,
    path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml')
  );
  registry.storyContexts = buildStoryContextsFromSprintStatus(
    root,
    path.join(root, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml')
  );
  const runContext = buildRunContext(root, {
    epicId: 'epic-14',
    storyId: '14-1-runtime-context-refactor',
    storySlug: 'runtime-context-refactor',
    runId,
    lifecycleStage: 'dev_story',
    workflowStage,
  });
  registry.runContexts[runId] = runContext;
  registry.activeScope = {
    scopeType: 'run',
    epicId: 'epic-14',
    storyId: '14-1-runtime-context-refactor',
    runId,
  };
  writeRuntimeContextRegistry(root, registry);
  mkdirSync(path.dirname(runContext.path), { recursive: true });
  writeFileSync(
    runContext.path,
    JSON.stringify(
      {
        version: 1,
        flow: 'story',
        stage: effectiveStage,
        sourceMode: 'full_bmad',
        contextScope: 'story',
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        storySlug: 'runtime-context-refactor',
        runId,
        artifactRoot: '_bmad-output/implementation-artifacts/epic-14/14-1-runtime-context-refactor',
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  process.env.BMAD_RUNTIME_CONTEXT_FILE = runContext.path;
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
  return chunks.join('');
}

describe('runtime-policy dev-story remaining workflow stages', () => {
  it('resolves constitution, specify, and gaps as valid dev_story workflow stages', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dev-story-more-'));
    try {
      const configSource = path.join(process.cwd(), '_bmad', '_config');
      const configTarget = path.join(root, '_bmad', '_config');
      mkdirSync(path.dirname(configTarget), { recursive: true });
      cpSync(configSource, configTarget, { recursive: true });

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
          '  14-1-runtime-context-refactor: in-progress',
        ].join('\n'),
        'utf8'
      );

      const constitution = runScenario(root, 'constitution', 'specify', 'run-dev-constitution-001');
      expect(constitution).toContain('"stage":"specify"');
      expect(constitution).toContain('"runId":"run-dev-constitution-001"');

      const specify = runScenario(root, 'specify', 'specify', 'run-dev-specify-001');
      expect(specify).toContain('"stage":"specify"');
      expect(specify).toContain('"runId":"run-dev-specify-001"');

      const gaps = runScenario(root, 'gaps', 'gaps', 'run-dev-gaps-001');
      expect(gaps).toContain('"stage":"gaps"');
      expect(gaps).toContain('"runId":"run-dev-gaps-001"');
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
