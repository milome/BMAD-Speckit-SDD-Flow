import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  appendTaskProgress,
  evaluateSupervisedWorker,
} from '../../scripts/supervised-worker-runtime';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
} from '../helpers/requirement-fixture-runtime';

describe('Main Agent supervised worker timeout semantics', () => {
  it('treats 120s as heartbeat timeout only and does not mark progress as completion', () => {
    const fixture = materializeRequirementFixture();
    try {
      appendTaskProgress(fixture.root, {
        packetId: 'implement-current',
        attemptId: 'implement-current',
        recordId: fixture.recordId,
        status: 'progressing',
        heartbeatAt: '2026-05-30T00:02:10.000Z',
        progressSeq: 1,
        currentStep: 'running real tests',
      });
      const progressDecision = evaluateSupervisedWorker({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        packetId: 'implement-current',
        attemptId: 'implement-current',
        startedAtIso: '2026-05-30T00:00:00.000Z',
        nowIso: '2026-05-30T00:02:20.000Z',
        lastProgressSeq: 0,
        hardBudgetMs: 600_000,
      });
      expect(progressDecision.decision).toBe('progressing');
      expect(progressDecision.reasonCode).toBe('progress_observed');

      const staleDecision = evaluateSupervisedWorker({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        packetId: 'implement-current',
        attemptId: 'implement-current',
        startedAtIso: '2026-05-30T00:00:00.000Z',
        nowIso: '2026-05-30T00:05:10.000Z',
        lastProgressSeq: 1,
        hardBudgetMs: 600_000,
      });
      expect(staleDecision.decision).toBe('stale_recovery');
      expect(staleDecision.reasonCode).toBe('heartbeat_timeout');
      expect(fs.existsSync(path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'runtime-mode',
        'implement-current',
        'runtime-blocker.json'
      ))).toBe(false);

      const blockedDecision = evaluateSupervisedWorker({
        projectRoot: fixture.root,
        recordId: fixture.recordId,
        packetId: 'implement-current',
        attemptId: 'implement-current',
        startedAtIso: '2026-05-30T00:00:00.000Z',
        nowIso: '2026-05-30T01:10:00.000Z',
        lastProgressSeq: 1,
        hardBudgetMs: 3_600_000,
      });
      expect(blockedDecision.decision).toBe('blocked');
      expect(blockedDecision.reasonCode).toBe('hard_budget_exhausted');
      expect(blockedDecision.nextRequiredAction).toBe('block_attempt');
      const blockerPath = path.join(
        fixture.root,
        '_bmad-output',
        'runtime',
        'requirement-records',
        fixture.recordId,
        'runtime-mode',
        'implement-current',
        'runtime-blocker.json'
      );
      expect(fs.existsSync(blockerPath)).toBe(true);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
