import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureStoryRuntimeContext, ensureRunRuntimeContext } from '../../scripts/runtime-context';
import { readRuntimeContextRegistry, runtimeContextRegistryPath } from '../../scripts/runtime-context-registry';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const CREATE_STORY = path.join(
  REPO_ROOT,
  '_bmad/bmm/workflows/4-implementation/create-story/instructions.xml'
);
const DEV_STORY = path.join(
  REPO_ROOT,
  '_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml'
);

describe('runtime-context standalone_story auto trigger', () => {
  it('creates story/run runtime state automatically for standalone story mode', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'standalone-auto-'));
    try {
      const story = ensureStoryRuntimeContext(root, {
        sourceMode: 'standalone_story',
        epicId: 'epic-standalone',
        storyId: 'standalone-1',
        stage: 'story_create',
      });
      const run = ensureRunRuntimeContext(root, {
        sourceMode: 'standalone_story',
        epicId: 'epic-standalone',
        storyId: 'standalone-1',
        runId: 'run-standalone-001',
        stage: 'implement',
      });

      const registry = readRuntimeContextRegistry(root);
      const raw = readFileSync(runtimeContextRegistryPath(root), 'utf8');

      expect(story.sourceMode).toBe('standalone_story');
      expect(run.sourceMode).toBe('standalone_story');
      expect(raw).toContain('standalone-1');
      expect(raw).toContain('run-standalone-001');
      expect(registry.activeScope.scopeType).toBe('run');
      expect(registry.runContexts['run-standalone-001'].path).toContain('run-standalone-001.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('standalone_story upstream contains --story-key in create-story and ensure-run in dev-story (S14)', () => {
    const createStory = readFileSync(CREATE_STORY, 'utf8');
    expect(createStory.includes('--story-key')).toBe(true);
    const devStory = readFileSync(DEV_STORY, 'utf8');
    expect(devStory.includes('bmad-speckit ensure-run-runtime-context')).toBe(true);
  });
});
