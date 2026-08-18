import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  compileControlledGoalCloseoutArtifacts,
  evaluateControlledGoalCloseoutGate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-delivery-closeout-gate';
import {
  compileExecutionFinalCandidate,
  type ExecutionFinalCandidate,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-candidate';
import { compileExecutionFinalJudgeEffectivePass } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';
import { canonicalGoalExecutionBytes } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/subcontract-evidence';
import { stableHash } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-verification-evidence-normalizer';

const hash = (character: string) => `sha256:${character.repeat(64)}`;
const CLOSEOUT_ATTEMPT_ID = 'closeout-attempt-001';
const IMPLEMENTATION_ATTEMPT_ID = 'implementation-attempt-001';
const CONTEXT_HASH = hash('1');
const CAMPAIGN_CLOSURE_HASH = hash('2');
const AGGREGATE_HASH = hash('3');
const TASK_REPORT_BYTES = Buffer.from('{"packetId":"packet-001","status":"done"}\n', 'utf8');
const TASK_REPORT_HASH = `sha256:${createHash('sha256').update(TASK_REPORT_BYTES).digest('hex')}`;

function executionFinalCandidate(
  profile: 'requirements_backed' | 'standalone' = 'requirements_backed'
): ExecutionFinalCandidate {
  return compileExecutionFinalCandidate({
    profile,
    goalId: 'GOAL-0123456789ABCDEF',
    goalExecutionIRHash: hash('4'),
    ...(profile === 'requirements_backed'
      ? {
          requirementsLineage: {
            requirementsSemanticIRHash: hash('5'),
            architecturePremiseAuthorityHash: hash('6'),
            readinessDecisionHash: hash('7'),
          },
        }
      : {
          standaloneLineage: {
            standaloneGoalSemanticIRHash: hash('5'),
            authoringEffectivePassHash: hash('6'),
          },
        }),
    activeRunPointerHash: hash('8'),
    activationRecordHash: hash('9'),
    executionPackageHashes: [hash('a')],
    campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
    implementationContextHash: hash('b'),
    artifacts: [
      {
        artifactId: 'artifact:task-report',
        artifactKind: 'task_report',
        path: 'goal/TaskReport.json',
        hash: TASK_REPORT_HASH,
      },
    ],
    obligationIds: ['OBL-001'],
    executionResults: [
      {
        executionResultId: 'result:goal',
        executionAuthorityId: 'direct:goal',
        closureHash: hash('c'),
      },
    ],
    commands: [{ commandId: 'command:test', normalizedInvocationHash: hash('d') }],
    evidence: [
      {
        evidenceId: 'evidence:test',
        evidenceKind: 'command_observation',
        path: 'goal/evidence.json',
        hash: hash('e'),
      },
    ],
    deliveryClaims: [
      {
        deliveryClaimId: 'claim:task-report',
        claimHash: hash('f'),
        evidenceIds: ['evidence:test'],
      },
    ],
  });
}

function closeoutInput(
  overrides: Record<string, unknown> = {},
  candidate = executionFinalCandidate()
) {
  const effectivePassReceipt = compileExecutionFinalJudgeEffectivePass({
    acceptedResult: {
      schemaVersion: 'ExecutionFinalAcceptedResult/v1',
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      candidateRef: {
        path: 'goal/execution-final-candidate.json',
        hash: candidate.executionFinalCandidateHash,
      },
      requestRef: { path: 'goal/final-judge/request.json', hash: hash('0') },
      responseRef: { path: 'goal/final-judge/response.json', hash: hash('1') },
      aggregateRef: { path: 'goal/final-judge/aggregate.json', hash: AGGREGATE_HASH },
      campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
      decision: 'pass',
      coverageDisposition: 'coverage_satisfied',
    },
    aggregateHash: AGGREGATE_HASH,
    campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
  });
  const candidateBytes = canonicalGoalExecutionBytes(candidate);
  const candidateBytesHash = `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`;
  return {
    closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
    contextHash: CONTEXT_HASH,
    taskReportArtifactHash: TASK_REPORT_HASH,
    candidateBytes,
    taskReportBytes: TASK_REPORT_BYTES,
    closureReceipt: {
      status: 'campaign_closed',
      closeoutAttemptId: CLOSEOUT_ATTEMPT_ID,
      contextHash: CONTEXT_HASH,
      taskReportArtifactHash: TASK_REPORT_HASH,
      receiptHash: hash('2'),
    },
    campaignClosureReceipt: {
      schemaVersion: 'goal-contract-campaign-closure-receipt/v1',
      decision: 'pass',
      campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
    },
    executionFinalCandidate: candidate,
    executionFinalJudgeCampaign: {
      schemaVersion: 'main-agent-execution-final-judge-aggregate/v1',
      executionFinalCandidateHash: candidate.executionFinalCandidateHash,
      candidateBytesHash,
      decision: 'pass',
      aggregateHash: AGGREGATE_HASH,
    },
    effectivePassReceipt,
    verifiedSixModelStatuses: candidate.requiredDimensionIds
      .filter((modelId) => modelId !== 'delivery_confirmation')
      .map((modelId, index) => ({
        schemaVersion: 'requirements-contract-verified-six-model-status/v1',
        recordId: candidate.goalId,
        requirementSetId: candidate.goalId,
        modelId,
        effectiveStatus: 'pass',
        projectionStatus: 'pass',
        projectionIntegrity: 'valid',
        authorityClass:
          candidate.profile === 'standalone' ? 'standalone_goal_authority' : 'deterministic_gate',
        decisionReceiptRef:
          candidate.profile === 'standalone'
            ? null
            : `runtime/status-decisions/${IMPLEMENTATION_ATTEMPT_ID}/${modelId}.json`,
        decisionReceiptHash: candidate.profile === 'standalone' ? null : hash(String(index)),
        currentAttemptId: IMPLEMENTATION_ATTEMPT_ID,
        blockerRefs: [],
        evidenceRefs: [`evidence:${modelId}`],
      })),
    currentImplementationAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    ...overrides,
  };
}

describe('Goal delivery closeout authority gate', () => {
  it('fails closed before rendering a standalone closeout request without a requirement record', () => {
    const candidate = executionFinalCandidate('standalone');

    expect(() => evaluateControlledGoalCloseoutGate(closeoutInput({}, candidate))).toThrow(
      'main_agent_goal_controlled_closeout_requirement_record_required'
    );
  });

  it('accepts only the fully bound Task 7C authority chain', () => {
    const input = closeoutInput();
    const result = evaluateControlledGoalCloseoutGate(input);
    expect(result).toMatchObject({
      status: 'awaiting_user_acceptance',
      executionFinalCandidateHash: input.executionFinalCandidate.executionFinalCandidateHash,
      executionFinalJudgeCampaignHash: AGGREGATE_HASH,
      campaignClosureHash: CAMPAIGN_CLOSURE_HASH,
      taskReportArtifactHash: TASK_REPORT_HASH,
    });
  });

  it('rejects a stale closeout attempt in an otherwise current authority chain', () => {
    const input = closeoutInput();
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        ...input,
        closureReceipt: {
          ...input.closureReceipt,
          closeoutAttemptId: 'stale-attempt',
        },
      })
    ).toThrow('main_agent_goal_task_report_provenance_mismatch');
  });

  it('rejects an execution EffectivePass that is not a current pass', () => {
    const input = closeoutInput();
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        ...input,
        effectivePassReceipt: {
          ...input.effectivePassReceipt,
          effectivePass: false,
        },
      })
    ).toThrow('main_agent_goal_task_report_provenance_mismatch');
  });

  it('compiles the sole gate receipt, controlled request identity, and confirmation page', () => {
    const input = closeoutInput();
    const compiled = compileControlledGoalCloseoutArtifacts({
      ...input,
      artifactRoot: 'goal/runtime/execution-final/finalization',
      recordId: input.executionFinalCandidate.goalId,
      taskReportRef: {
        path: 'goal/TaskReport.json',
        hash: TASK_REPORT_HASH,
      },
    });
    expect(compiled.gateReceipt).toMatchObject({
      schemaVersion: 'GoalDeliveryCloseoutGateReceipt/v1',
      status: 'pass',
      executionFinalCandidateHash: input.executionFinalCandidate.executionFinalCandidateHash,
      candidateBytesHash: input.executionFinalJudgeCampaign.candidateBytesHash,
      taskReportRef: { path: 'goal/TaskReport.json', hash: TASK_REPORT_HASH },
    });
    expect(compiled.request).toMatchObject({
      schemaVersion: 'ControlledCloseoutRequest/v1',
      status: 'awaiting_user_acceptance',
      recordId: input.executionFinalCandidate.goalId,
      executionFinalCandidateHash: input.executionFinalCandidate.executionFinalCandidateHash,
      intent: 'accept_or_reject_goal_delivery',
      deliveryGateReceiptRef: compiled.gateReceiptRef,
      pageRef: compiled.pageRef,
    });
    expect(compiled.request.exactAcceptText).toContain('decision=accept');
    expect(compiled.request.exactRejectText).toContain('decision=reject');
    expect(compiled.pageHtml).toContain(compiled.request.exactAcceptText);
    expect(compiled.pageHtml).toContain(compiled.request.exactRejectText);
    expect(compiled.request.closeoutAcceptanceRequestHash).toBe(
      stableHash({
        schemaVersion: 'ControlledCloseoutRequestIdentity/v1',
        deliveryGateReceiptRef: compiled.request.deliveryGateReceiptRef,
        executionFinalCandidateHash: compiled.request.executionFinalCandidateHash,
        requestId: compiled.request.requestId,
        pageId: compiled.request.pageId,
        intent: compiled.request.intent,
        exactAcceptText: compiled.request.exactAcceptText,
        exactRejectText: compiled.request.exactRejectText,
      })
    );
    const { controlledCloseoutRequestHash, ...requestArtifactPayload } = compiled.request;
    expect(controlledCloseoutRequestHash).toBe(stableHash(requestArtifactPayload));
    expect(compiled.requestRef.hash).toBe(controlledCloseoutRequestHash);
    expect(compiled.requestRef.hash).not.toBe(compiled.request.closeoutAcceptanceRequestHash);
    expect(JSON.stringify(compiled.request)).not.toMatch(
      /providerRef|actorClass|timestamp|createdAt|requestedAt/u
    );
  });

  it('rejects TaskReport bytes and candidateBytesHash as candidate authority', () => {
    const input = closeoutInput();
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        ...input,
        candidateBytes: TASK_REPORT_BYTES,
        executionFinalJudgeCampaign: {
          ...input.executionFinalJudgeCampaign,
          candidateBytesHash: TASK_REPORT_HASH,
        },
      })
    ).toThrow();
  });

  it('rejects TaskReport bytes that do not match the declared artifact hash', () => {
    expect(() =>
      evaluateControlledGoalCloseoutGate(
        closeoutInput({ taskReportBytes: Buffer.from('tampered', 'utf8') })
      )
    ).toThrow();
  });

  it('rejects a missing current upstream six-model prerequisite', () => {
    const input = closeoutInput();
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        ...input,
        verifiedSixModelStatuses: input.verifiedSixModelStatuses.filter(
          (status) => status.modelId !== 'requirement_confirmation'
        ),
      })
    ).toThrow();
  });

  it('rejects a shallow six-model status without its authority proof', () => {
    const input = closeoutInput();
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        ...input,
        verifiedSixModelStatuses: input.verifiedSixModelStatuses.map((status) => ({
          schemaVersion: status.schemaVersion,
          modelId: status.modelId,
          effectiveStatus: status.effectiveStatus,
          currentAttemptId: status.currentAttemptId,
        })),
      })
    ).toThrow();
  });

  it('rejects a campaign closure that is not the candidate-bound closure', () => {
    expect(() =>
      evaluateControlledGoalCloseoutGate(
        closeoutInput({
          campaignClosureReceipt: {
            schemaVersion: 'goal-contract-campaign-closure-receipt/v1',
            decision: 'pass',
            campaignClosureHash: hash('9'),
          },
        })
      )
    ).toThrow();
  });

  it('rejects a Judge aggregate bound to a different typed candidate', () => {
    const input = closeoutInput();
    expect(() =>
      evaluateControlledGoalCloseoutGate({
        ...input,
        executionFinalJudgeCampaign: {
          ...input.executionFinalJudgeCampaign,
          executionFinalCandidateHash: hash('9'),
        },
      })
    ).toThrow();
  });

  it.each([
    {
      bindingField: 'executionFinalCandidateHash',
      authorityField: 'ledgerHeadHash',
      value: hash('a'),
    },
    { bindingField: 'aggregateHash', authorityField: 'authorityStateHash', value: hash('b') },
    { bindingField: 'campaignClosureHash', authorityField: 'authorityStateHash', value: hash('c') },
  ])(
    'rejects $authorityField as an EffectivePass.$bindingField substitution',
    ({ bindingField, authorityField, value }) => {
      const input = closeoutInput();
      expect(() =>
        evaluateControlledGoalCloseoutGate({
          ...input,
          effectivePassReceipt: {
            ...input.effectivePassReceipt,
            [authorityField]: value,
            [bindingField]: value,
          },
        })
      ).toThrow();
    }
  );

  it.each([
    {
      modelId: 'audit_review',
      effectiveStatus: 'stale',
      currentAttemptId: IMPLEMENTATION_ATTEMPT_ID,
    },
    { modelId: 'execution_closure', effectiveStatus: 'pass', currentAttemptId: 'stale-attempt' },
  ])('rejects non-current six-model prerequisite $modelId', (replacement) => {
    const input = closeoutInput();
    const statuses = input.verifiedSixModelStatuses.map((status) =>
      status.modelId === replacement.modelId ? { ...status, ...replacement } : status
    );
    expect(() =>
      evaluateControlledGoalCloseoutGate({ ...input, verifiedSixModelStatuses: statuses })
    ).toThrow();
  });
});
