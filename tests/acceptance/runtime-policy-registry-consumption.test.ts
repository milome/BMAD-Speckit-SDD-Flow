import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { projectContextPath, writeRuntimeContext } from '../../scripts/runtime-context';
import { mainEmitRuntimePolicy } from '../../scripts/emit-runtime-policy';

describe('runtime-policy registry consumption', () => {
  it('uses registry-backed explicit context instead of root fallback', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'registry-consume-'));
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

      process.env.BMAD_RUNTIME_CONTEXT_FILE = contextFile;
      const code = mainEmitRuntimePolicy(['--cwd', root]);
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;

      expect(code).toBe(0);
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('consumes registry-backed contexts for non-full-bmad source modes too', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'registry-consume-alt-source-'));
    try {
      const configSource = path.join(process.cwd(), '_bmad', '_config');
      const configTarget = path.join(root, '_bmad', '_config');
      mkdirSync(path.dirname(configTarget), { recursive: true });
      cpSync(configSource, configTarget, { recursive: true });

      const registry = defaultRuntimeContextRegistry(root);
      registry.projectContextPath = path.join('_bmad-output', 'runtime', 'context', 'project.json');
      registry.activeScope = {
        scopeType: 'project',
        resolvedContextPath: registry.projectContextPath,
        reason: 'project scope active',
      };
      writeRuntimeContextRegistry(root, registry);

      const seededFile = projectContextPath(root);
      mkdirSync(path.dirname(seededFile), { recursive: true });
      writeRuntimeContext(root, {
        version: 1,
        flow: 'story',
        stage: 'story_create',
        sourceMode: 'seeded_solutioning',
        contextScope: 'project',
        epicId: 'epic-20',
        storyId: '20-1-seeded-story',
        updatedAt: new Date().toISOString(),
      });
      process.env.BMAD_RUNTIME_CONTEXT_FILE = seededFile;
      expect(mainEmitRuntimePolicy(['--cwd', root])).toBe(0);

      writeRuntimeContext(root, {
        version: 1,
        flow: 'story',
        stage: 'story_audit',
        sourceMode: 'standalone_story',
        contextScope: 'project',
        epicId: 'epic-standalone',
        storyId: 'standalone-1',
        updatedAt: new Date().toISOString(),
      });
      expect(mainEmitRuntimePolicy(['--cwd', root])).toBe(0);
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
