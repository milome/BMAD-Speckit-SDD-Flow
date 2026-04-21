import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveRalphTrackingPaths } from '../../scripts/ralph-method/pathing';
import {
  appendTddTrace,
  createRalphTrackingFiles,
  markUserStoryPassed,
  recomputeProgressCounters,
} from '../../scripts/ralph-method/write-tracking-files';
import type { RalphUserStory } from '../../scripts/ralph-method/types';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-writer-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function makeStories(): RalphUserStory[] {
  return [
    {
      id: 'US-001',
      title: 'Implement production flow',
      description: 'Implement the runtime flow.',
      acceptanceCriteria: ['Flow exists', 'Tests pass'],
      priority: 1,
      passes: false,
      involvesProductionCode: true,
      tddSteps: [
        { phase: 'TDD-RED', passes: false },
        { phase: 'TDD-GREEN', passes: false },
        { phase: 'TDD-REFACTOR', passes: false },
      ],
    },
    {
      id: 'US-002',
      title: 'Document the behavior',
      description: 'Update docs.',
      acceptanceCriteria: ['Docs updated'],
      priority: 2,
      passes: false,
      involvesProductionCode: false,
      tddSteps: [{ phase: 'DONE', passes: false }],
    },
  ];
}

describe('ralph-method write-tracking-files', () => {
  it('derives prd/progress names from reference document stem', () => {
    const root = makeTempRoot();
    const paths = resolveRalphTrackingPaths({
      projectRoot: root,
      referenceDocumentPath: 'docs/BUGFIX_alpha.md',
    });

    expect(paths.stem).toBe('BUGFIX_alpha');
    expect(paths.prdPath).toBe(path.join(root, 'docs', 'prd.BUGFIX_alpha.json'));
    expect(paths.progressPath).toBe(path.join(root, 'docs', 'progress.BUGFIX_alpha.txt'));
  });

  it('creates prd and progress files with pending slots', () => {
    const root = makeTempRoot();
    const tasksPath = path.join(root, 'specs', 'story-1', 'tasks-E1-S1.md');
    fs.mkdirSync(path.dirname(tasksPath), { recursive: true });
    fs.writeFileSync(tasksPath, '# tasks\n', 'utf8');

    const result = createRalphTrackingFiles({
      projectRoot: root,
      tasksPath,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    expect(result.prdCreated).toBe(true);
    expect(result.progressCreated).toBe(true);
    expect(fs.existsSync(result.paths.prdPath)).toBe(true);
    expect(fs.existsSync(result.paths.progressPath)).toBe(true);

    const progress = fs.readFileSync(result.paths.progressPath, 'utf8');
    expect(progress).toContain('# Total stories: 2');
    expect(progress).toContain('Current story: 1');
    expect(progress).toContain('Completed: 0');
    expect(progress).toContain('[TDD-RED] _pending_');
    expect(progress).toContain('[TDD-GREEN] _pending_');
    expect(progress).toContain('[TDD-REFACTOR] _pending_');
    expect(progress).toContain('[DONE] _pending_');
  });

  it('updates production-story traces and recomputes counters', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const progressAfterTrace = appendTddTrace({
      progressPath: result.paths.progressPath,
      userStoryId: 'US-001',
      title: 'Implement production flow',
      phases: [
        { phase: 'TDD-RED', detail: 'T1 pytest tests/runtime.test.ts -v => 1 failed' },
        { phase: 'TDD-GREEN', detail: 'T1 pytest tests/runtime.test.ts -v => 1 passed' },
        { phase: 'TDD-REFACTOR', detail: 'T1 No refactor needed ✓' },
      ],
    });

    expect(progressAfterTrace).toContain('[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed');
    expect(progressAfterTrace).toContain('[TDD-GREEN] T1 pytest tests/runtime.test.ts -v => 1 passed');
    expect(progressAfterTrace).toContain('[TDD-REFACTOR] T1 No refactor needed ✓');
    expect(progressAfterTrace).toContain('Status: PASSED');
    expect(progressAfterTrace).toContain('Completed: 1');
    expect(progressAfterTrace).toContain('Current story: 2');
  });

  it('supports DONE-only documentation stories', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    markUserStoryPassed({ prdPath: result.paths.prdPath, userStoryId: 'US-002' });
    const finalProgress = appendTddTrace({
      progressPath: result.paths.progressPath,
      userStoryId: 'US-002',
      title: 'Document the behavior',
      phases: [{ phase: 'DONE', detail: 'T2 Documentation updated ✓' }],
    });

    const recomputed = recomputeProgressCounters(result.paths.prdPath, result.paths.progressPath);
    expect(finalProgress).toContain('[DONE] T2 Documentation updated ✓');
    expect(recomputed).toContain('Completed: 1');
    expect(recomputed).toContain('Current story: 2');
  });
});
