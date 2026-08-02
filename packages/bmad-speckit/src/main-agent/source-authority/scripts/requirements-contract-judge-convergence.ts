import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface RequirementsJudgeConvergencePolicy {
  requiredCleanRounds: 1;
  maxSemanticAttempts: 3;
  noProgressAttemptLimit: 2;
  elapsedNoProgressThresholdMs: number;
}

export interface RequirementsJudgeSemanticAttemptReceipt {
  schemaVersion: 'requirements-contract-judge-semantic-attempt-receipt/v1';
  attemptKeyHash: string;
  authoritySnapshotHash: string;
  providerInvocationReceiptHash: string;
  resultFingerprint: string;
  semanticAttemptOrdinal: number;
  decisionFieldOrigin: 'package_calculated';
  decision: 'recorded';
  receiptHash: string;
}

export interface RequirementsJudgeConvergenceState {
  attemptKeyHash: string;
  currentAuthorityHash: string;
  semanticAttemptCount: number;
  semanticAttemptReceipts: RequirementsJudgeSemanticAttemptReceipt[];
  rejectedFingerprints: string[];
  noProgressCount: number;
  disabledReason: string | null;
}

export interface RequirementsJudgeConvergenceEvaluation {
  schemaVersion: 'requirements-contract-judge-convergence-evaluation/v1';
  issueCodes: string[];
  decision: 'continue' | 'block';
  evaluationHash: string;
}

export const DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY: RequirementsJudgeConvergencePolicy = {
  requiredCleanRounds: 1,
  maxSemanticAttempts: 3,
  noProgressAttemptLimit: 2,
  elapsedNoProgressThresholdMs: 30 * 60 * 1000,
};

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function requireHash(value: unknown, code: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) throw new Error(code);
  return value;
}

function normalizePolicy(
  policy: RequirementsJudgeConvergencePolicy | undefined
): RequirementsJudgeConvergencePolicy {
  return policy ?? DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY;
}

export function recordRequirementsJudgeSemanticAttempt(
  state: RequirementsJudgeConvergenceState,
  attempt: {
    attemptKeyHash: string;
    authoritySnapshotHash: string;
    providerInvocationReceiptHash: string;
    resultFingerprint: string;
  },
  policy: RequirementsJudgeConvergencePolicy = DEFAULT_REQUIREMENTS_CONVERGENCE_POLICY
): RequirementsJudgeConvergenceState {
  if (state.disabledReason) throw new Error('requirements_judge_convergence_disabled');
  if (state.attemptKeyHash !== attempt.attemptKeyHash) {
    throw new Error('requirements_judge_semantic_attempt_key_stale');
  }
  if (
    state.currentAuthorityHash === attempt.authoritySnapshotHash &&
    state.semanticAttemptCount > 0
  ) {
    throw new Error('requirements_judge_semantic_attempt_unchanged_snapshot_reused');
  }
  if (state.semanticAttemptCount >= policy.maxSemanticAttempts) {
    throw new Error('requirements_judge_semantic_attempt_budget_exhausted');
  }
  const payload = {
    schemaVersion: 'requirements-contract-judge-semantic-attempt-receipt/v1' as const,
    attemptKeyHash: requireHash(attempt.attemptKeyHash, 'requirements_judge_attempt_hash_invalid'),
    authoritySnapshotHash: requireHash(
      attempt.authoritySnapshotHash,
      'requirements_judge_authority_hash_invalid'
    ),
    providerInvocationReceiptHash: requireHash(
      attempt.providerInvocationReceiptHash,
      'requirements_judge_provider_receipt_hash_invalid'
    ),
    resultFingerprint: requireHash(
      attempt.resultFingerprint,
      'requirements_judge_result_fingerprint_invalid'
    ),
    semanticAttemptOrdinal: state.semanticAttemptCount + 1,
    decisionFieldOrigin: 'package_calculated' as const,
    decision: 'recorded' as const,
  };
  const receipt = { ...payload, receiptHash: sha256Stable(payload) };
  return {
    ...state,
    currentAuthorityHash: attempt.authoritySnapshotHash,
    semanticAttemptCount: state.semanticAttemptCount + 1,
    semanticAttemptReceipts: [...state.semanticAttemptReceipts, receipt],
  };
}

export function evaluateRequirementsJudgeConvergence(input: {
  previousAuthorityHash: string;
  currentAuthorityHash: string;
  previousGapFingerprint: string | null;
  currentGapFingerprint: string | null;
  claimedRepairChangedAuthority: boolean;
  rejectedFingerprint: string | null;
  rejectedFingerprintProofHash: string | null;
  noProgressCount: number;
  elapsedNoProgressMs: number;
  policy?: RequirementsJudgeConvergencePolicy;
}): RequirementsJudgeConvergenceEvaluation {
  const policy = normalizePolicy(input.policy);
  const issueCodes: string[] = [];
  if (
    input.previousGapFingerprint &&
    input.currentGapFingerprint &&
    input.previousGapFingerprint === input.currentGapFingerprint &&
    input.previousAuthorityHash === input.currentAuthorityHash
  ) {
    issueCodes.push('repeated_gap_without_authority_delta');
  }
  if (
    input.claimedRepairChangedAuthority &&
    input.previousAuthorityHash === input.currentAuthorityHash
  ) {
    issueCodes.push('claimed_repair_without_authority_delta');
  }
  if (input.noProgressCount >= policy.noProgressAttemptLimit) {
    issueCodes.push('two_no_progress_attempts');
  }
  if (input.rejectedFingerprint && !input.rejectedFingerprintProofHash) {
    issueCodes.push('repeated_rejected_fingerprint_without_proof');
  }
  if (input.elapsedNoProgressMs >= policy.elapsedNoProgressThresholdMs) {
    issueCodes.push('elapsed_no_progress_threshold');
  }
  const payload = {
    schemaVersion: 'requirements-contract-judge-convergence-evaluation/v1' as const,
    issueCodes: [...new Set(issueCodes)].sort((left, right) => left.localeCompare(right)),
    decision: issueCodes.length === 0 ? ('continue' as const) : ('block' as const),
  };
  return { ...payload, evaluationHash: sha256Stable(payload) };
}
