import { describe, expect, it } from 'vitest';
import {
  createRequirementsJudgeClockAnchor,
  evaluateRequirementsJudgeClockProgress,
  restoreRequirementsJudgeClockAnchor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-clock';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const h = (label: string) => sha256Stable({ label });

describe('requirements judge clock', () => {
  it('uses monotonic duration plus committed wall-clock anchor', () => {
    const anchor = createRequirementsJudgeClockAnchor({
      attemptKeyHash: h('attempt'),
      wallClockStartedAt: '2026-07-31T00:00:00.000Z',
      monotonicStartedMs: 100,
      committedReceiptHash: h('anchor-receipt'),
    });

    const progress = evaluateRequirementsJudgeClockProgress(anchor, {
      monotonicNowMs: 1_600,
      wallClockNow: '2026-07-31T00:01:00.000Z',
      noProgressThresholdMs: 2_000,
    });

    expect(progress.elapsedMonotonicMs).toBe(1_500);
    expect(progress.decision).toBe('continue');
  });

  it('prevents restart and wall-clock faults from creating progress', () => {
    const anchor = createRequirementsJudgeClockAnchor({
      attemptKeyHash: h('attempt'),
      wallClockStartedAt: '2026-07-31T00:00:00.000Z',
      monotonicStartedMs: 1_000,
      committedReceiptHash: h('anchor-receipt'),
    });

    expect(() =>
      evaluateRequirementsJudgeClockProgress(anchor, {
        monotonicNowMs: 900,
        wallClockNow: '2026-07-31T00:00:30.000Z',
        noProgressThresholdMs: 2_000,
      })
    ).toThrow('requirements_judge_clock_restart_fault');

    expect(() =>
      restoreRequirementsJudgeClockAnchor({
        ...anchor,
        committedReceiptHash: h('tampered'),
      })
    ).toThrow('requirements_judge_clock_anchor_hash_mismatch');
  });

  it('blocks elapsed no-progress threshold', () => {
    const anchor = createRequirementsJudgeClockAnchor({
      attemptKeyHash: h('attempt'),
      wallClockStartedAt: '2026-07-31T00:00:00.000Z',
      monotonicStartedMs: 100,
      committedReceiptHash: h('anchor-receipt'),
    });

    const progress = evaluateRequirementsJudgeClockProgress(anchor, {
      monotonicNowMs: 3_000,
      wallClockNow: '2026-07-31T00:00:03.000Z',
      noProgressThresholdMs: 2_000,
    });

    expect(progress.decision).toBe('block');
    expect(progress.issueCodes).toContain('elapsed_no_progress_threshold');
  });
});
