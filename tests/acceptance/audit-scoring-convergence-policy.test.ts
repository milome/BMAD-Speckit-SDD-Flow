import { describe, expect, it } from 'vitest';
import {
  evaluateAuditScoringConvergence,
  type AuditScoringConvergenceInput,
} from '../../scripts/audit-scoring-convergence-policy';
import { resolveExecutionDisciplineProfile } from '../../scripts/execution-discipline-profiles';

const policy = resolveExecutionDisciplineProfile('standalone_tasks').auditScoringConvergencePolicy;

function validInput(overrides: Partial<AuditScoringConvergenceInput> = {}): AuditScoringConvergenceInput {
  return {
    policy,
    stage: 'tasks',
    auditVerdict: 'pass',
    criticalAuditorVerdict: 'no_new_valid_gap',
    auditReportHash: 'sha256:audit',
    scoreAttemptAuditReportHash: 'sha256:audit',
    auditDimensionContractId: 'tasks_decomposition',
    writer: 'runAuditorHost',
    scoreReceipt: {
      scoreRecordPath: '_bmad-output/scoring/score.json',
      scoreRecordHash: 'sha256:score',
      scoreWriteStatus: 'written',
      dimensionContractId: 'tasks_decomposition',
      dimensionMode: 'tasks',
      expectedDimensions: [
        'Task Atomicity',
        'Task Dependency Order',
        'Task Evidence Binding',
        'Task Execution Readiness',
      ],
      dimensionScores: [
        { dimension: 'Task Atomicity', score: 92 },
        { dimension: 'Task Dependency Order', score: 90 },
        { dimension: 'Task Evidence Binding', score: 88 },
        { dimension: 'Task Execution Readiness', score: 85 },
      ],
      thresholdPassed: true,
      vetoTriggered: false,
      iterationCount: 0,
    },
    ...overrides,
  };
}

describe('audit scoring convergence policy', () => {
  it('grants no-gap round credit only when audit and score evidence both satisfy the policy', () => {
    const decision = evaluateAuditScoringConvergence(validInput());

    expect(decision.roundCreditGranted).toBe(true);
    expect(decision.blockedByScoreMaterialization).toBe(false);
    expect(decision.roundCreditBlockers).toEqual([]);
    expect(decision.nextAction).toBe('none');
  });

  it('blocks prose-only audit PASS when score receipt is missing', () => {
    const decision = evaluateAuditScoringConvergence(
      validInput({
        scoreReceipt: null,
      })
    );

    expect(decision.roundCreditGranted).toBe(false);
    expect(decision.blockedByScoreMaterialization).toBe(true);
    expect(decision.roundCreditBlockers).toContain('score_receipt_missing_or_failed');
  });

  it('reruns audit with score contract when score block uses the wrong dimension contract', () => {
    const decision = evaluateAuditScoringConvergence(
      validInput({
        scoreAttemptAuditReportHash: 'sha256:other',
        scoreReceipt: {
          ...validInput().scoreReceipt!,
          dimensionContractId: 'prd_document',
          dimensionMode: 'prd',
        },
      })
    );

    expect(decision.roundCreditGranted).toBe(false);
    expect(decision.roundCreditBlockers).toContain('dimension_contract_mismatch');
    expect(decision.nextAction).toBe('rerun_audit_with_score_contract');
  });

  it('reruns score materialization when audit hash and dimension contract already match', () => {
    const decision = evaluateAuditScoringConvergence(
      validInput({
        scoreReceipt: {
          ...validInput().scoreReceipt!,
          scoreWriteStatus: 'failed',
          scoreRecordHash: null,
        },
      })
    );

    expect(decision.roundCreditGranted).toBe(false);
    expect(decision.blockedByScoreMaterialization).toBe(true);
    expect(decision.roundCreditBlockers).toContain('score_receipt_missing_or_failed');
    expect(decision.nextAction).toBe('rerun_score_materialization');
  });

  it('blocks veto, missing iteration count, and forbidden writer paths', () => {
    const decision = evaluateAuditScoringConvergence(
      validInput({
        stage: 'implementation_readiness',
        writer: 'runAuditorHost',
        scoreReceipt: {
          ...validInput().scoreReceipt!,
          vetoTriggered: true,
          iterationCount: null,
        },
      })
    );

    expect(decision.roundCreditGranted).toBe(false);
    expect(decision.roundCreditBlockers).toContain('score_veto_triggered');
    expect(decision.roundCreditBlockers).toContain('iteration_count_missing_or_invalid');
    expect(decision.roundCreditBlockers).toContain('score_writer_forbidden_for_stage');
  });

  it('blocks when Critical Auditor no-new-gap signal is missing', () => {
    const decision = evaluateAuditScoringConvergence(
      validInput({
        criticalAuditorVerdict: 'new_gap',
      })
    );

    expect(decision.roundCreditGranted).toBe(false);
    expect(decision.roundCreditBlockers).toContain('critical_auditor_no_new_gap_missing');
  });

  it('requires three valid audit+score rounds for three no-gap credits', () => {
    const rounds = [
      evaluateAuditScoringConvergence(validInput()),
      evaluateAuditScoringConvergence(
        validInput({
          scoreReceipt: {
            ...validInput().scoreReceipt!,
            thresholdPassed: false,
          },
        })
      ),
      evaluateAuditScoringConvergence(validInput()),
      evaluateAuditScoringConvergence(validInput()),
      evaluateAuditScoringConvergence(validInput()),
    ];

    let consecutive = 0;
    for (const round of rounds) {
      consecutive = round.roundCreditGranted ? consecutive + 1 : 0;
    }

    expect(rounds[1]!.roundCreditBlockers).toContain('score_threshold_not_passed');
    expect(consecutive).toBe(3);
  });
});
