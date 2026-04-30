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

  it('freezes codex parity and rollback proof as required rollout evidence', () => {
    expect(REVIEWER_COMPATIBILITY_GUARDS).toStrictEqual({
      codexNoopRequired: false,
      codexBehaviorChangeAllowed: true,
    });
    expect(REVIEWER_REQUIRED_ROLLOUT_PROOFS).toStrictEqual([
      'parity_proof',
      'consumer_install_proof',
      'rollback_proof',
      'codex_parity_proof',
      'codex_closeout_proof',
      'codex_scoring_proof',
    ]);
    expect(REVIEWER_STRICT_ALIGNMENT_EVIDENCE).toEqual(
      expect.arrayContaining([
        'governance_closure_parity',
        'codex_parity_proof',
        'codex_closeout_proof',
        'codex_scoring_proof',
        'rollback_proof',
      ])
    );
  });

  it('keeps reviewer contract projection on cursor/claude/codex host routes', () => {
    const explainability = buildReviewerRouteExplainability();
    expect(Object.keys(explainability.hosts)).toStrictEqual(['cursor', 'claude', 'codex']);
    expect(explainability.reviewerIdentity).toBe('bmad_code_reviewer');
  });
});
