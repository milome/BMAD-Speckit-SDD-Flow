import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRalphTrackingFiles } from '../../scripts/ralph-method/write-tracking-files';
import { verifyTddTrace } from '../../scripts/ralph-method/verify-tdd-trace';
import type { RalphUserStory } from '../../scripts/ralph-method/types';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-verify-tdd-'));
  tempRoots.push(root);
  return root;
}

function makeStories(): RalphUserStory[] {
  return [
    {
      id: 'US-001',
      title: 'Implement runtime flow',
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
  ];
}

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

describe('verifyTddTrace', () => {
  it('passes when a completed production US has TDD-RED -> TDD-GREEN -> TDD-REFACTOR in order without pending markers', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const progressPath = result.paths.progressPath;
    const validContent = fs
      .readFileSync(progressPath, 'utf8')
      .replace('Status: PENDING', 'Status: PASSED')
      .replace('[TDD-RED] _pending_', '[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed')
      .replace('[TDD-GREEN] _pending_', '[TDD-GREEN] T1 pytest tests/runtime.test.ts -v => 1 passed')
      .replace('[TDD-REFACTOR] _pending_', '[TDD-REFACTOR] T1 No refactor needed ✓');
    fs.writeFileSync(progressPath, validContent, 'utf8');

    const verification = verifyTddTrace({
      prdPath: result.paths.prdPath,
      progressPath,
    });

    expect(verification.status).toBe('pass');
    expect(verification.summary.checkedStories).toBe(1);
    expect(verification.summary.failingStories).toBe(0);
  });

  it('fails when TDD-REFACTOR is missing for a completed production US', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const progressPath = result.paths.progressPath;
    const invalidContent = fs
      .readFileSync(progressPath, 'utf8')
      .replace('Status: PENDING', 'Status: PASSED')
      .replace('[TDD-RED] _pending_', '[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed')
      .replace('[TDD-GREEN] _pending_', '[TDD-GREEN] T1 pytest tests/runtime.test.ts -v => 1 passed')
      .replace('[TDD-REFACTOR] _pending_', '');
    fs.writeFileSync(progressPath, invalidContent, 'utf8');

    const verification = verifyTddTrace({
      prdPath: result.paths.prdPath,
      progressPath,
    });

    expect(verification.status).toBe('fail');
    expect(verification.errors.join('\n')).toMatch(/TDD-REFACTOR/);
  });

  it('fails when phase order is TDD-GREEN before TDD-RED', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const progressPath = result.paths.progressPath;
    const invalidContent = fs
      .readFileSync(progressPath, 'utf8')
      .replace('Status: PENDING', 'Status: PASSED')
      .replace('[TDD-RED] _pending_', '[TDD-GREEN] T1 pytest tests/runtime.test.ts -v => 1 passed')
      .replace('[TDD-GREEN] _pending_', '[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed')
      .replace('[TDD-REFACTOR] _pending_', '[TDD-REFACTOR] T1 No refactor needed ✓');
    fs.writeFileSync(progressPath, invalidContent, 'utf8');

    const verification = verifyTddTrace({
      prdPath: result.paths.prdPath,
      progressPath,
    });

    expect(verification.status).toBe('fail');
    expect(verification.errors.join('\n')).toMatch(/order/);
  });

  it('fails when pending placeholders remain on a completed production US', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const progressPath = result.paths.progressPath;
    const invalidContent = fs
      .readFileSync(progressPath, 'utf8')
      .replace('Status: PENDING', 'Status: PASSED')
      .replace('[TDD-RED] _pending_', '[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed');
    fs.writeFileSync(progressPath, invalidContent, 'utf8');

    const verification = verifyTddTrace({
      prdPath: result.paths.prdPath,
      progressPath,
    });

    expect(verification.status).toBe('fail');
    expect(verification.errors.join('\n')).toMatch(/Pending placeholder remains/);
  });
});
