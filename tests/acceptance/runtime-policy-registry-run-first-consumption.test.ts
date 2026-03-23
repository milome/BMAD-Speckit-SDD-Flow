import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultRuntimeContextRegistry, writeRuntimeContextRegistry } from '../../scripts/runtime-context-registry';
import { projectContextPath, writeRuntimeContext } from '../../scripts/runtime-context';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime-policy registry run-first consumption', () => {
  it('prefers run scope over project scope when registry activeScope points to a run', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'registry-run-first-'));
    try {
      const configSource = path.join(process.cwd(), '_bmad', '_config');
      const configTarget = path.join(root, '_bmad', '_config');
      mkdirSync(path.dirname(configTarget), { recursive: true });
      cpSync(configSource, configTarget, { recursive: true });

      const projectFile = projectContextPath(root);
      mkdirSync(path.dirname(projectFile), { recursive: true });
      writeRuntimeContext(root, {
        version: 1,
        flow: 'story',
        stage: 'story_create',
        sourceMode: 'full_bmad',
        contextScope: 'project',
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        updatedAt: new Date().toISOString(),
      });

      const runFile = path.join(
        root,
        '_bmad-output',
        'runtime',
        'context',
        'runs',
        'epic-14',
        '14-1-runtime-context-refactor',
        'run-001.json'
      );
      mkdirSync(path.dirname(runFile), { recursive: true });
      writeFileSync(
        runFile,
        JSON.stringify(
          {
            version: 1,
            flow: 'story',
            stage: 'post_audit',
            sourceMode: 'full_bmad',
            contextScope: 'story',
            epicId: 'epic-14',
            storyId: '14-1-runtime-context-refactor',
            runId: 'run-001',
            updatedAt: new Date().toISOString(),
          },
          null,
          2
        ) + '\n',
        'utf8'
      );

      const registry = defaultRuntimeContextRegistry(root);
      registry.projectContextPath = path.join('_bmad-output', 'runtime', 'context', 'project.json');
      registry.runContexts['run-001'] = {
        path: runFile,
        storyId: '14-1-runtime-context-refactor',
        stage: 'post_audit',
      };
      registry.activeScope = {
        scopeType: 'run',
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        runId: 'run-001',
      };
      writeRuntimeContextRegistry(root, registry);

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
      expect(output).toContain('"stage":"post_audit"');
      expect(output).toContain('"triggerStage":"bmad_story_stage4"');
      expect(output).toContain('"runId":"run-001"');
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
