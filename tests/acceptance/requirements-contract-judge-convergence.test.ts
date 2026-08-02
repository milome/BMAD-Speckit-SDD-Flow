import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY,
  evaluateRequirementsJudgeConvergence,
  recordRequirementsJudgeSemanticAttempt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-convergence';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const h = (label: string) => sha256Stable({ label });

describe('requirements judge convergence', () => {
  it('permits one semantic call per unchanged snapshot and blocks the fourth attempt', () => {
    let state = {
      attemptKeyHash: h('attempt'),
      currentAuthorityHash: h('authority'),
      semanticAttemptCount: 0,
      semanticAttemptReceipts: [] as unknown[],
      rejectedFingerprints: [] as string[],
      noProgressCount: 0,
      disabledReason: null as string | null,
    };

    state = recordRequirementsJudgeSemanticAttempt(state, {
      attemptKeyHash: h('attempt'),
      authoritySnapshotHash: h('authority'),
      providerInvocationReceiptHash: h('provider-1'),
      resultFingerprint: h('fingerprint-1'),
    });
    state = recordRequirementsJudgeSemanticAttempt(state, {
      attemptKeyHash: h('attempt'),
      authoritySnapshotHash: h('authority-2'),
      providerInvocationReceiptHash: h('provider-2'),
      resultFingerprint: h('fingerprint-2'),
    });
    state = recordRequirementsJudgeSemanticAttempt(state, {
      attemptKeyHash: h('attempt'),
      authoritySnapshotHash: h('authority-3'),
      providerInvocationReceiptHash: h('provider-3'),
      resultFingerprint: h('fingerprint-3'),
    });

    expect(state.semanticAttemptCount).toBe(
      DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY.maxSemanticAttempts
    );
    expect(() =>
      recordRequirementsJudgeSemanticAttempt(state, {
        attemptKeyHash: h('attempt'),
        authoritySnapshotHash: h('authority-4'),
        providerInvocationReceiptHash: h('provider-4'),
        resultFingerprint: h('fingerprint-4'),
      })
    ).toThrow('requirements_judge_semantic_attempt_budget_exhausted');
  });

  it('blocks repeated gap without authority delta and repeated rejected fingerprint without proof', () => {
    const repeatedGap = evaluateRequirementsJudgeConvergence({
      previousAuthorityHash: h('authority'),
      currentAuthorityHash: h('authority'),
      previousGapFingerprint: h('gap'),
      currentGapFingerprint: h('gap'),
      claimedRepairChangedAuthority: false,
      rejectedFingerprint: h('gap'),
      rejectedFingerprintProofHash: null,
      noProgressCount: 1,
      elapsedNoProgressMs: 1,
      policy: DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY,
    });

    expect(repeatedGap.decision).toBe('block');
    expect(repeatedGap.issueCodes).toEqual(
      expect.arrayContaining([
        'repeated_gap_without_authority_delta',
        'repeated_rejected_fingerprint_without_proof',
      ])
    );
  });

  it('blocks claimed repair without changed authority and two no-progress attempts', () => {
    const result = evaluateRequirementsJudgeConvergence({
      previousAuthorityHash: h('authority'),
      currentAuthorityHash: h('authority'),
      previousGapFingerprint: h('gap-old'),
      currentGapFingerprint: h('gap-new'),
      claimedRepairChangedAuthority: true,
      rejectedFingerprint: null,
      rejectedFingerprintProofHash: null,
      noProgressCount: 2,
      elapsedNoProgressMs: 1,
      policy: DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY,
    });

    expect(result.decision).toBe('block');
    expect(result.issueCodes).toEqual(
      expect.arrayContaining(['claimed_repair_without_authority_delta', 'two_no_progress_attempts'])
    );
  });
});
