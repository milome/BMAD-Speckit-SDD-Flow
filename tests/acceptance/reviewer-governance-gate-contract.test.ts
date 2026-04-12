import { describe, expect, it } from 'vitest';
import {
  REVIEWER_COMPATIBILITY_GUARDS,
  REVIEWER_GOVERNANCE_GATE_CONTRACT,
  REVIEWER_REQUIRED_ROLLOUT_PROOFS,
  REVIEWER_STRICT_ALIGNMENT_EVIDENCE,
} from '../../scripts/reviewer-contract';
import { buildReviewerRouteExplainability } from '../../scripts/reviewer-registry';

describe('reviewer governance gate contract', () => {
  it('freezes governance gate requirements instead of leaving them in planning docs only', () => {
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT.implementationReadinessStatusRequired).toBe(true);
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT.implementationReadinessGateName).toBe(
      'implementation-readiness'
    );
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT.gatesLoopRequired).toBe(true);
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT.rerunGatesRequired).toBe(true);
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT.packetExecutionClosureRequired).toBe(true);
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT.packetExecutionClosureStatuses).toStrictEqual([
      'awaiting_rerun_gate',
      'retry_pending',
      'gate_passed',
      'escalated',
    ]);
  });

  it('freezes codex no-op and rollback proof as required rollout evidence', () => {
    expect(REVIEWER_COMPATIBILITY_GUARDS).toStrictEqual({
      codexNoopRequired: true,
      codexBehaviorChangeAllowed: false,
    });
    expect(REVIEWER_REQUIRED_ROLLOUT_PROOFS).toStrictEqual([
      'parity_proof',
      'consumer_install_proof',
      'rollback_proof',
      'codex_noop_proof',
    ]);
    expect(REVIEWER_STRICT_ALIGNMENT_EVIDENCE).toEqual(
      expect.arrayContaining(['governance_closure_parity', 'codex_noop_proof', 'rollback_proof'])
    );
  });

  it('keeps reviewer contract projection on cursor/claude only before a separately approved codex host rollout', () => {
    const explainability = buildReviewerRouteExplainability();
    expect(Object.keys(explainability.hosts)).toStrictEqual(['cursor', 'claude']);
    expect(explainability.reviewerIdentity).toBe('bmad_code_reviewer');
  });
});
