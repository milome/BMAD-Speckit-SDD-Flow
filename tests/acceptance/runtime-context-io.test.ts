import { describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultRuntimeContextFile,
  projectContextPath,
  readRuntimeContext,
  writeRuntimeContext,
} from '../../scripts/runtime-context';

describe('runtime-context io', () => {
  it('writes and reads project context under _bmad-output/runtime/context/project.json', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-context-'));
    try {
      const payload = defaultRuntimeContextFile({
        flow: 'story',
        stage: 'story_create',
        sourceMode: 'full_bmad',
      });

      writeRuntimeContext(root, payload);

      const file = projectContextPath(root);
      expect(existsSync(file)).toBe(true);
      expect(file).toContain(path.join('_bmad-output', 'runtime', 'context', 'project.json'));

      process.env.BMAD_RUNTIME_CONTEXT_FILE = file;
      const loaded = readRuntimeContext(root);
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;

      expect(loaded.version).toBe(1);
      expect(loaded.stage).toBe('story_create');
      expect(loaded.flow).toBe('story');
      expect(loaded.sourceMode).toBe('full_bmad');

      const raw = readFileSync(file, 'utf8');
      expect(raw).toContain('story_create');
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('preserves seeded_solutioning and standalone_story source modes when writing and reading context', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'runtime-context-source-modes-'));
    try {
      const seededFile = projectContextPath(root);
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'story_create',
          sourceMode: 'seeded_solutioning',
        })
      );

      process.env.BMAD_RUNTIME_CONTEXT_FILE = seededFile;
      const seeded = readRuntimeContext(root);
      expect(seeded.sourceMode).toBe('seeded_solutioning');

      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'story_audit',
          sourceMode: 'standalone_story',
        })
      );

      const standalone = readRuntimeContext(root);
      expect(standalone.sourceMode).toBe('standalone_story');
      expect(standalone.stage).toBe('story_audit');
    } finally {
      delete process.env.BMAD_RUNTIME_CONTEXT_FILE;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
