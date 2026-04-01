import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureProjectRuntimeContext, ensureStoryRuntimeContext } from '../../scripts/runtime-context';
import { readRuntimeContextRegistry, runtimeContextRegistryPath } from '../../scripts/runtime-context-registry';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const STEP04 = path.join(
  REPO_ROOT,
  '_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/steps/step-04-final-validation.md'
);
const CREATE_STORY = path.join(
  REPO_ROOT,
  '_bmad/bmm/workflows/4-implementation/create-story/instructions.xml'
);

describe('runtime-context seeded_solutioning auto trigger', () => {
  it('creates registry/context automatically for seeded solutioning without manual registry assembly', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'seeded-auto-'));
    try {
      mkdirSync(path.join(root, '_bmad-output', 'planning-artifacts'), { recursive: true });
      writeFileSync(
        path.join(root, '_bmad-output', 'planning-artifacts', 'architecture.md'),
        '# architecture\n',
        'utf8'
      );
      writeFileSync(
        path.join(root, '_bmad-output', 'planning-artifacts', 'epics.md'),
        '# epics\n',
        'utf8'
      );

      const projectContext = ensureProjectRuntimeContext(root, { sourceMode: 'seeded_solutioning' });
      const storyContext = ensureStoryRuntimeContext(root, {
        sourceMode: 'seeded_solutioning',
        epicId: 'epic-20',
        storyId: '20-1-seeded-story',
        stage: 'story_create',
      });

      const registry = readRuntimeContextRegistry(root);
      expect(projectContext.sourceMode).toBe('seeded_solutioning');
      expect(storyContext.sourceMode).toBe('seeded_solutioning');
      expect(readFileSync(runtimeContextRegistryPath(root), 'utf8')).toContain('20-1-seeded-story');
      expect(registry.activeScope.scopeType).toBe('story');
      expect(registry.storyContexts['20-1-seeded-story'].path).toContain('20-1-seeded-story.json');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('seeded_solutioning upstream contains sync in step-04 and --story-key in create-story (S13)', () => {
    const step04 = readFileSync(STEP04, 'utf8');
    expect(step04.includes('bmad-speckit sync-runtime-context-from-sprint')).toBe(true);
    const createStory = readFileSync(CREATE_STORY, 'utf8');
    expect(createStory.includes('--story-key')).toBe(true);
  });
});
