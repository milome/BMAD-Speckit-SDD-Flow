import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultRuntimeContextRegistry, writeRuntimeContextRegistry } from '../../scripts/runtime-context-registry';
import { projectContextPath, writeRuntimeContext } from '../../scripts/runtime-context';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime-policy registry-first consumption', () => {
  it('resolves context from registry activeScope without requiring BMAD_RUNTIME_CONTEXT_FILE', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'registry-first-'));
    try {
      const configSource = path.join(process.cwd(), '_bmad', '_config');
      const configTarget = path.join(root, '_bmad', '_config');
      mkdirSync(path.dirname(configTarget), { recursive: true });
      cpSync(configSource, configTarget, { recursive: true });

      const contextFile = projectContextPath(root);
      mkdirSync(path.dirname(contextFile), { recursive: true });
      writeRuntimeContext(root, {
        version: 1,
        flow: 'story',
        stage: 'post_audit',
        sourceMode: 'full_bmad',
        contextScope: 'project',
        epicId: 'epic-14',
        storyId: '14-1-runtime-context-refactor',
        updatedAt: new Date().toISOString(),
      });

      const registry = defaultRuntimeContextRegistry(root);
      registry.projectContextPath = path.join('_bmad-output', 'runtime', 'context', 'project.json');
      registry.activeScope = {
        scopeType: 'project',
        resolvedContextPath: registry.projectContextPath,
        reason: 'project scope active',
      };
      writeRuntimeContextRegistry(root, registry);

      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      const code = mainEmitRuntimePolicy(['--cwd', root]);

      expect(code).toBe(0);
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
