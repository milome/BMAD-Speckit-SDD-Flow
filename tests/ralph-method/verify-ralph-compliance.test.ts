import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRalphTrackingFiles } from '../../scripts/ralph-method/write-tracking-files';
import {
  verifyPassConsistency,
  verifyRalphCompliance,
} from '../../scripts/ralph-method/verify-ralph-compliance';
import type { RalphPrdDocument, RalphUserStory } from '../../scripts/ralph-method/types';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ralph-verify-compliance-'));
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
    {
      id: 'US-002',
      title: 'Document behavior',
      description: 'Document behavior.',
      acceptanceCriteria: ['Docs updated'],
      priority: 2,
      passes: false,
      involvesProductionCode: false,
      tddSteps: [{ phase: 'DONE', passes: false }],
    },
  ];
}

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function writePrd(filePath: string, document: RalphPrdDocument): void {
  fs.writeFileSync(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

describe('verifyPassConsistency / verifyRalphCompliance', () => {
  it('fails when production US passes=true but tddSteps are not all passed', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const prd = JSON.parse(fs.readFileSync(result.paths.prdPath, 'utf8')) as RalphPrdDocument;
    prd.userStories[0]!.passes = true;
    writePrd(result.paths.prdPath, prd);

    const verification = verifyPassConsistency({
      prdPath: result.paths.prdPath,
      progressPath: result.paths.progressPath,
    });

    expect(verification.status).toBe('fail');
    expect(verification.errors.join('\n')).toMatch(/tddSteps/);
  });

  it('passes when production and documentation stories have matching step completion', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const prd = JSON.parse(fs.readFileSync(result.paths.prdPath, 'utf8')) as RalphPrdDocument;
    prd.userStories[0]!.passes = true;
    prd.userStories[0]!.tddSteps.forEach((step) => {
      step.passes = true;
    });
    prd.userStories[1]!.passes = true;
    prd.userStories[1]!.tddSteps[0]!.passes = true;
    writePrd(result.paths.prdPath, prd);

    const progress = fs
      .readFileSync(result.paths.progressPath, 'utf8')
      .replace('Status: PENDING', 'Status: PASSED')
      .replace('[TDD-RED] _pending_', '[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed')
      .replace('[TDD-GREEN] _pending_', '[TDD-GREEN] T1 pytest tests/runtime.test.ts -v => 1 passed')
      .replace('[TDD-REFACTOR] _pending_', '[TDD-REFACTOR] T1 No refactor needed ✓')
      .replace('## US-002: Document behavior\nStatus: PENDING\n[DONE] _pending_', '## US-002: Document behavior\nStatus: PASSED\n[DONE] T2 Documentation updated ✓')
      .replace('Completed: 0', 'Completed: 2')
      .replace('Current story: 1', 'Current story: 2')
      .replace(
        '# Story log\n',
        '# Story log\n\n[2026-04-19 23:00] US-001: Implement runtime flow - PASSED\n[2026-04-19 23:01] US-002: Document behavior - PASSED\n'
      );
    fs.writeFileSync(result.paths.progressPath, progress, 'utf8');

    const verification = verifyRalphCompliance({
      prdPath: result.paths.prdPath,
      progressPath: result.paths.progressPath,
    });

    expect(verification.status).toBe('pass');
    expect(verification.summary.failingStories).toBe(0);
  });

  it('fails compliance when progress counters disagree with prd passes', () => {
    const root = makeTempRoot();
    const result = createRalphTrackingFiles({
      projectRoot: root,
      preferredBaseDir: root,
      branchName: 'ralph/runtime-flow',
      taskDescription: 'Implement runtime flow',
      userStories: makeStories(),
    });

    const prd = JSON.parse(fs.readFileSync(result.paths.prdPath, 'utf8')) as RalphPrdDocument;
    prd.userStories[0]!.passes = true;
    prd.userStories[0]!.tddSteps.forEach((step) => {
      step.passes = true;
    });
    writePrd(result.paths.prdPath, prd);

    const progress = fs
      .readFileSync(result.paths.progressPath, 'utf8')
      .replace('Status: PENDING', 'Status: PASSED')
      .replace('[TDD-RED] _pending_', '[TDD-RED] T1 pytest tests/runtime.test.ts -v => 1 failed')
      .replace('[TDD-GREEN] _pending_', '[TDD-GREEN] T1 pytest tests/runtime.test.ts -v => 1 passed')
      .replace('[TDD-REFACTOR] _pending_', '[TDD-REFACTOR] T1 No refactor needed ✓')
      .replace('Completed: 0', 'Completed: 2');
    fs.writeFileSync(result.paths.progressPath, progress, 'utf8');

    const verification = verifyRalphCompliance({
      prdPath: result.paths.prdPath,
      progressPath: result.paths.progressPath,
    });

    expect(verification.status).toBe('fail');
    expect(verification.errors.join('\n')).toMatch(/Completed:/);
  });
});
