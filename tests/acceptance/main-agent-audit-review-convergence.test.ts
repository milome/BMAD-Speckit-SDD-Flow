import { describe, expect, it } from 'vitest';
import {
  evaluateAuditTriadConvergence,
  sha256Json,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/audit-triad-orchestrator';
import {
  createFixtureAuditTriadPlan,
  createFixtureAuditTriadRound,
} from '../helpers/audit-triad-fixture-runtime';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
} from '../helpers/requirement-fixture-runtime';

describe('Main Agent audit review convergence', () => {
  it('requires exactly three current no-gap rounds and closes only with score and runAuditorHost receipts', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const plan = createFixtureAuditTriadPlan({
        fixture,
        compiled,
        attemptId: 'audit-current',
      });
      const round = (roundId: string) => createFixtureAuditTriadRound(plan, roundId);

      const pass = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r1'), round('r2'), round('r3')],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(pass.ok).toBe(true);
      expect(pass.convergenceReceipt).toMatchObject({
        schemaVersion: 'audit-triad-convergence-receipt/v1',
        recordId: fixture.recordId,
        attemptId: 'audit-current',
        validNoGapRounds: 3,
      });

      const gapRound = { ...round('r4'), validatedGapRefs: ['GAP-001'] };
      const unresolvedGap = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r2'), round('r3'), gapRound],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(unresolvedGap.ok).toBe(false);
      expect(unresolvedGap.blockingReasons).toEqual(
        expect.arrayContaining([
          'round_3_validated_gap_unresolved',
          'main_agent_repair_receipt_missing',
        ])
      );
      const repairedButNotFedBack = evaluateAuditTriadConvergence({
        plan,
        rounds: [round('r2'), round('r3'), gapRound],
        repairReceiptRefs: ['repair-receipt.json'],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(repairedButNotFedBack.blockingReasons).toContain('repair_feedback_dispatch_missing');

      const staleAttempt = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          round('r1'),
          { ...round('r2'), currentAttemptHash: 'sha256:stale-attempt' },
          round('r3'),
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(staleAttempt.ok).toBe(false);
      expect(staleAttempt.blockingReasons).toContain('round_2_current_attempt_hash_mismatch');

      const staleEvidence = evaluateAuditTriadConvergence({
        plan,
        rounds: [
          round('r1'),
          round('r2'),
          { ...round('r3'), currentEvidenceHash: 'sha256:stale-evidence' },
        ],
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });
      expect(staleEvidence.ok).toBe(false);
      expect(staleEvidence.blockingReasons).toContain('round_3_current_evidence_hash_mismatch');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('preserves plan hash derivation when the current audit follows a verified repair', () => {
    const fixture = materializeRequirementFixture();
    try {
      const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture });
      const priorRepairReceiptRefs = [
        {
          path: `${fixture.recordId}/repair-receipt.json`,
          contentHash: sha256Json({
            recordId: fixture.recordId,
            requirementSetId: fixture.requirementSetId,
            runId: fixture.runId,
          }),
        },
      ];
      const plan = createFixtureAuditTriadPlan({
        fixture,
        compiled,
        attemptId: `${fixture.runId}-post-repair-audit`,
        overrides: { priorRepairReceiptRefs },
      });
      const feedbackDispatchRef = {
        path: `${fixture.recordId}/repair-feedback-dispatch.json`,
        contentHash: sha256Json({
          recordId: fixture.recordId,
          role: 'repair-feedback-dispatch-content',
        }),
        dispatchHash: sha256Json({
          recordId: fixture.recordId,
          role: 'repair-feedback-dispatch-payload',
        }),
      };
      const repairEvidenceWithoutHash = {
        schemaVersion: 'audit-triad-repair-evidence-binding/v1' as const,
        repairReceiptRefs: [
          {
            ...priorRepairReceiptRefs[0],
            receiptHash: sha256Json({
              recordId: fixture.recordId,
              role: 'main-agent-repair-receipt',
            }),
            remediationPacketId: `${fixture.runId}-remediation`,
            feedbackDispatchRef,
          },
        ],
        repairFeedbackDispatchRefs: [feedbackDispatchRef],
      };
      const rounds = ['first', 'second', 'third'].map((suffix) =>
        createFixtureAuditTriadRound(plan, `${plan.attemptId}-${suffix}`)
      );

      const decision = evaluateAuditTriadConvergence({
        plan,
        rounds,
        repairEvidence: {
          ...repairEvidenceWithoutHash,
          evidenceSetHash: sha256Json(repairEvidenceWithoutHash),
        },
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
      });

      expect(decision.ok, JSON.stringify(decision.blockingReasons, null, 2)).toBe(true);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
