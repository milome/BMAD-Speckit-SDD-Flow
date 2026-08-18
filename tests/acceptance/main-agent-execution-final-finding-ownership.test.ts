import { describe, expect, it } from 'vitest';

import { mergeMainAgentExecutionFinalJudgeCampaign } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-execution-final-judge-campaign';

const HASH = `sha256:${'2'.repeat(64)}`;

function executionFinalCandidate() {
  return {
    schemaVersion: 'ExecutionFinalCandidate/v1',
    profile: 'standalone',
    requiredDimensionIds: ['execution_closure', 'delivery_confirmation'],
    requiredArtifactIds: ['ART-001'],
    requiredObligationIds: ['OBL-001'],
    requiredExecutionResultIds: ['RESULT-001'],
    requiredCommandIds: ['CMD-001'],
    requiredEvidenceIds: ['EVD-001'],
    requiredDeliveryClaimIds: ['CLAIM-001'],
  };
}

function cleanReviewer() {
  return {
    sourceLedgerHash: HASH,
    terminalOutcome: 'clean' as const,
    findingIds: [],
  };
}

function deliveryClaimFinding() {
  return {
    findingId: 'FINDING-001',
    severity: 'high',
    dimensionId: 'delivery_confirmation',
    subjectKind: 'delivery_claim',
    subjectId: 'CLAIM-001',
    evidenceRefs: ['EVD-001'],
    issueCode: 'delivery_claim_not_proven',
    remediationOwner: 'delivery_claim',
  };
}

function findingsFinalJudge(findings: ReturnType<typeof deliveryClaimFinding>[]) {
  return {
    sourceLedgerHash: HASH,
    auditDecision: 'fail' as const,
    verdict: 'findings_present' as const,
    findingIds: findings.map((finding) => finding.findingId),
    coveredDimensionIds: ['execution_closure', 'delivery_confirmation'],
    coveredArtifactIds: ['ART-001'],
    coveredObligationIds: ['OBL-001'],
    coveredExecutionResultIds: ['RESULT-001'],
    coveredCommandIds: ['CMD-001'],
    coveredEvidenceIds: ['EVD-001'],
    coveredDeliveryClaimIds: ['CLAIM-001'],
    findings,
  };
}

function mergeFinding(finding: ReturnType<typeof deliveryClaimFinding>) {
  const campaign = {
    candidate: executionFinalCandidate(),
    reviewer: cleanReviewer(),
    finalJudge: findingsFinalJudge([finding]),
  };
  return mergeMainAgentExecutionFinalJudgeCampaign(campaign);
}

describe('Execution Final Judge finding ownership', () => {
  it('accepts a candidate-bound finding with a closed profile-consistent owner', () => {
    expect(mergeFinding(deliveryClaimFinding()).status).toBe('remediation_required');
  });

  it('blocks a finding whose subject is absent from the candidate', () => {
    const finding = { ...deliveryClaimFinding(), subjectId: 'CLAIM-UNKNOWN' };

    expect(mergeFinding(finding).status).toBe('blocked');
  });

  it('blocks a finding whose evidence is absent from the candidate', () => {
    const finding = { ...deliveryClaimFinding(), evidenceRefs: ['EVD-UNKNOWN'] };

    expect(mergeFinding(finding).status).toBe('blocked');
  });

  it('blocks a remediation owner outside the closed owner set', () => {
    const finding = { ...deliveryClaimFinding(), remediationOwner: 'human_operator' };

    expect(mergeFinding(finding).status).toBe('blocked');
  });

  it('blocks a profile-inconsistent owner for a standalone execution closure dimension', () => {
    const finding = {
      ...deliveryClaimFinding(),
      dimensionId: 'execution_closure',
      subjectKind: 'dimension',
      subjectId: 'execution_closure',
      issueCode: 'execution_closure_incomplete',
      remediationOwner: 'requirements_successor',
    };

    expect(mergeFinding(finding).status).toBe('blocked');
  });
});
