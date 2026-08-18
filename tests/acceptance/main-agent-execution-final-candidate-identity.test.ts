import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { compileExecutionFinalCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-candidate';
import { ingestMainAgentControlledCloseout } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-governed-goal-integration';
import { canonicalGoalExecutionBytes } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/subcontract-evidence';

const HASH = `sha256:${'1'.repeat(64)}`;
const OTHER_HASH = `sha256:${'2'.repeat(64)}`;

function executionFinalCandidate() {
  return compileExecutionFinalCandidate({
    profile: 'standalone',
    goalId: 'GOAL-0123456789ABCDEF',
    goalExecutionIRHash: HASH,
    standaloneLineage: {
      standaloneGoalSemanticIRHash: OTHER_HASH,
    },
    activeRunPointerHash: HASH,
    activationRecordHash: HASH,
    executionPackageHashes: [HASH],
    campaignClosureHash: HASH,
    implementationContextHash: HASH,
    artifacts: [
      {
        artifactId: 'artifact:task-report',
        artifactKind: 'task_report',
        path: 'goal/TaskReport.json',
        hash: HASH,
      },
    ],
    obligationIds: ['OBL-001'],
    executionResults: [
      {
        executionResultId: 'result:goal',
        executionAuthorityId: 'direct:goal',
        closureHash: HASH,
      },
    ],
    commands: [{ commandId: 'command:test', normalizedInvocationHash: HASH }],
    evidence: [
      {
        evidenceId: 'evidence:test',
        evidenceKind: 'command_observation',
        path: 'goal/evidence.json',
        hash: HASH,
      },
    ],
    deliveryClaims: [
      {
        deliveryClaimId: 'claim:task-report',
        claimHash: HASH,
        evidenceIds: ['evidence:test'],
      },
    ],
  });
}

function closeoutInput(candidateBytes: Buffer, executionFinalCandidate: unknown) {
  const candidateBytesHash = `sha256:${createHash('sha256').update(candidateBytes).digest('hex')}`;
  const candidateHash =
    executionFinalCandidate &&
    typeof executionFinalCandidate === 'object' &&
    'executionFinalCandidateHash' in executionFinalCandidate
      ? (executionFinalCandidate as { executionFinalCandidateHash: unknown })
          .executionFinalCandidateHash
      : HASH;
  return {
    closeoutAttemptId: 'closeout-attempt-001',
    contextHash: HASH,
    producerReceipt: {
      status: 'campaign_closed',
      closeoutAttemptId: 'closeout-attempt-001',
      contextHash: HASH,
      taskReportArtifactHash: candidateBytesHash,
      receiptHash: HASH,
    },
    candidateBytes,
    executionFinalCandidate,
    executionFinalJudgeCampaign: {
      campaignId: 'dynamic-goal-campaign',
      closeoutAttemptId: 'closeout-attempt-001',
      candidateBytesHash,
      executionFinalCandidateHash: candidateHash,
      campaignClosureHash: HASH,
      decision: 'pass',
      aggregateHash: HASH,
    },
    effectivePassReceipt: {
      campaignId: 'dynamic-goal-campaign',
      effectivePass: true,
      closeoutAttemptId: 'closeout-attempt-001',
      executionFinalCandidateHash: candidateHash,
      campaignClosureHash: HASH,
      aggregateHash: HASH,
      effectivePassReceiptHash: HASH,
    },
  };
}

describe('ExecutionFinalCandidate identity', () => {
  it('ships the closed candidate schema on the source authority surface', () => {
    const schemaPath = path.join(
      process.cwd(),
      'packages',
      'bmad-speckit',
      'src',
      'main-agent',
      'source-authority',
      'schemas',
      'main-agent-execution-final-candidate.schema.json'
    );
    expect(fs.existsSync(schemaPath)).toBe(true);
    if (!fs.existsSync(schemaPath)) return;

    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, any>;
    expect(schema).toMatchObject({
      title: 'Execution Final Candidate',
      type: 'object',
      additionalProperties: false,
    });
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'requiredDimensionIds',
        'requiredArtifactIds',
        'requiredObligationIds',
        'requiredExecutionResultIds',
        'requiredCommandIds',
        'requiredEvidenceIds',
        'requiredDeliveryClaimIds',
        'executionFinalCandidateHash',
      ])
    );
  });

  it('rejects TaskReport bytes as final candidate authority', () => {
    const candidateBytes = Buffer.from(
      '{"schemaVersion":"goal-subcontract-campaign-task-report/v3"}\n',
      'utf8'
    );
    const candidateBytesHash = `sha256:${createHash('sha256')
      .update(candidateBytes)
      .digest('hex')}`;

    expect(() =>
      ingestMainAgentControlledCloseout({
        closeoutAttemptId: 'closeout-attempt-001',
        contextHash: HASH,
        producerReceipt: {
          status: 'campaign_closed',
          closeoutAttemptId: 'closeout-attempt-001',
          contextHash: HASH,
          taskReportArtifactHash: candidateBytesHash,
          receiptHash: HASH,
        },
        candidateBytes,
        executionFinalJudgeCampaign: {
          campaignId: 'dynamic-goal-campaign',
          closeoutAttemptId: 'closeout-attempt-001',
          candidateBytesHash,
          decision: 'pass',
          aggregateHash: HASH,
        },
        effectivePassReceipt: {
          campaignId: 'dynamic-goal-campaign',
          effectivePass: true,
          closeoutAttemptId: 'closeout-attempt-001',
          effectivePassReceiptHash: HASH,
        },
      })
    ).toThrowError('main_agent_execution_final_candidate_required');
  });

  it('rejects an arbitrary object as ExecutionFinalCandidate authority', () => {
    const candidateBytes = Buffer.from('{}\n', 'utf8');

    expect(() =>
      ingestMainAgentControlledCloseout(
        closeoutInput(candidateBytes, {
          schemaVersion: 'ExecutionFinalCandidate/v1',
        })
      )
    ).toThrowError('execution_final_candidate_invalid');
  });

  it('rejects valid candidate authority whose bytes are not canonical', () => {
    const candidate = executionFinalCandidate();

    expect(() =>
      ingestMainAgentControlledCloseout(
        closeoutInput(Buffer.from('{"status":"done"}\n', 'utf8'), candidate)
      )
    ).toThrowError('main_agent_execution_final_candidate_bytes_mismatch');
  });

  it('rejects a campaign hash that is not bound to the validated candidate', () => {
    const candidate = executionFinalCandidate();
    const input = closeoutInput(canonicalGoalExecutionBytes(candidate), candidate);

    expect(() =>
      ingestMainAgentControlledCloseout({
        ...input,
        executionFinalJudgeCampaign: {
          ...input.executionFinalJudgeCampaign,
          executionFinalCandidateHash: OTHER_HASH,
        },
      })
    ).toThrowError('main_agent_execution_final_candidate_binding_mismatch');
  });

  it('hashes semantic authority and artifact integrity but excludes transport and prose', () => {
    const base = {
      profile: 'requirements_backed',
      goalId: 'GOAL-0123456789ABCDEF',
      goalExecutionIRHash: `sha256:${'2'.repeat(64)}`,
      requirementsLineage: {
        requirementsSemanticIRHash: `sha256:${'3'.repeat(64)}`,
        architecturePremiseAuthorityHash: `sha256:${'4'.repeat(64)}`,
        readinessDecisionHash: `sha256:${'5'.repeat(64)}`,
      },
      activeRunPointerHash: `sha256:${'6'.repeat(64)}`,
      activationRecordHash: `sha256:${'7'.repeat(64)}`,
      executionPackageHashes: [`sha256:${'8'.repeat(64)}`],
      campaignClosureHash: `sha256:${'9'.repeat(64)}`,
      implementationContextHash: `sha256:${'a'.repeat(64)}`,
      artifacts: [
        {
          artifactId: 'artifact:owned-source',
          artifactKind: 'implementation',
          path: 'src/owned.ts',
          hash: `sha256:${'b'.repeat(64)}`,
        },
      ],
      obligationIds: ['OBL-002', 'OBL-001'],
      executionResults: [
        {
          executionResultId: 'execution-result:direct',
          executionAuthorityId: 'direct:GOAL-0123456789ABCDEF',
          closureHash: `sha256:${'c'.repeat(64)}`,
        },
      ],
      commands: [
        {
          commandId: 'command:test',
          normalizedInvocationHash: `sha256:${'d'.repeat(64)}`,
        },
      ],
      evidence: [
        {
          evidenceId: 'evidence:test',
          evidenceKind: 'command_observation',
          path: 'goal/runtime/evidence.json',
          hash: `sha256:${'e'.repeat(64)}`,
        },
      ],
      deliveryClaims: [
        {
          deliveryClaimId: 'delivery-claim:task-report-integrity',
          claimHash: `sha256:${'f'.repeat(64)}`,
          evidenceIds: ['evidence:test'],
        },
      ],
      providerRef: 'provider-a',
      actorBindingHash: HASH,
      attemptId: 'attempt-a',
      outputRoot: 'output/a',
      createdAt: '2026-08-18T00:00:00.000Z',
      citationBindingRef: 'citation/a',
      taskReportProse: 'first rendering',
    };

    const candidate = compileExecutionFinalCandidate(base);
    expect(candidate).toMatchObject({
      schemaVersion: 'ExecutionFinalCandidate/v1',
      requiredDimensionIds: [
        'architecture_confirmation',
        'audit_review',
        'delivery_confirmation',
        'execution_closure',
        'implementation_readiness',
        'requirement_confirmation',
      ],
      requiredArtifactIds: ['artifact:owned-source'],
      requiredObligationIds: ['OBL-001', 'OBL-002'],
      requiredExecutionResultIds: ['execution-result:direct'],
      requiredCommandIds: ['command:test'],
      requiredEvidenceIds: ['evidence:test'],
      requiredDeliveryClaimIds: ['delivery-claim:task-report-integrity'],
    });
    expect(candidate.executionFinalCandidateHash).toMatch(/^sha256:[0-9a-f]{64}$/u);

    const semanticMutation = compileExecutionFinalCandidate({
      ...base,
      campaignClosureHash: `sha256:${'0'.repeat(64)}`,
    });
    expect(semanticMutation.executionFinalCandidateHash).not.toBe(
      candidate.executionFinalCandidateHash
    );

    const metadataMutation = compileExecutionFinalCandidate({
      ...base,
      providerRef: 'provider-b',
      actorBindingHash: `sha256:${'0'.repeat(64)}`,
      attemptId: 'attempt-b',
      outputRoot: 'output/b',
      createdAt: '2026-08-19T00:00:00.000Z',
      citationBindingRef: 'citation/b',
      taskReportProse: 'second rendering',
      artifacts: [{ ...base.artifacts[0], path: 'relocated/owned.ts' }],
      evidence: [{ ...base.evidence[0], path: 'relocated/evidence.json' }],
    });
    expect(metadataMutation.executionFinalCandidateHash).toBe(
      candidate.executionFinalCandidateHash
    );
  });
});
