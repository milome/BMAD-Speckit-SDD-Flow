import {
  REVIEWER_REQUIRED_ROLLOUT_PROOFS,
  type ReviewerRequiredRolloutProofId,
} from './reviewer-contract';

export const REVIEWER_ROLLOUT_GATE_VERSION = 'reviewer_rollout_gate_v1' as const;

export type ReviewerRolloutGateStatus = 'blocked' | 'ready';

export interface ReviewerRolloutGate {
  version: typeof REVIEWER_ROLLOUT_GATE_VERSION;
  status: ReviewerRolloutGateStatus;
  requiredProofs: readonly ReviewerRequiredRolloutProofId[];
  completeProofs: readonly ReviewerRequiredRolloutProofId[];
  blockingProofs: readonly ReviewerRequiredRolloutProofId[];
  cleanupAllowed: boolean;
  canClaimFullIsomorphism: boolean;
  summary: string;
}

export function buildReviewerRolloutGate(input?: {
  completeProofs?: ReviewerRequiredRolloutProofId[];
}): ReviewerRolloutGate {
  const completeProofs = [...new Set(input?.completeProofs ?? [])].filter((proof) =>
    REVIEWER_REQUIRED_ROLLOUT_PROOFS.includes(proof)
  ) as ReviewerRequiredRolloutProofId[];
  const blockingProofs = REVIEWER_REQUIRED_ROLLOUT_PROOFS.filter(
    (proof) => !completeProofs.includes(proof)
  );
  const ready = blockingProofs.length === 0;

  return {
    version: REVIEWER_ROLLOUT_GATE_VERSION,
    status: ready ? 'ready' : 'blocked',
    requiredProofs: REVIEWER_REQUIRED_ROLLOUT_PROOFS,
    completeProofs,
    blockingProofs,
    cleanupAllowed: ready,
    canClaimFullIsomorphism: ready,
    summary: ready
      ? 'All reviewer rollout proofs are complete; legacy fallback cleanup and full-isomorphism claims are allowed.'
      : `Blocked until proofs are complete: ${blockingProofs.join(', ')}`,
  };
}
