import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractRemediationPlan,
  requirementsRemediationStepHash,
  validateRequirementsContractRemediationPlan,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-plan';
import { createRequirementsContractAuthoringIdentity } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-identity';
import { createRequirementsContractRemediationDelta } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements remediation plan hash', () => {
  it('sorts mixed routes and set-like fields into a stable before-state plan', () => {
    const input = {
      remediatesRequestHash: hash('1'), remediationAggregateHash: hash('2'),
      repairSteps: [
        { stepId: 'STEP-2', route: 'projection_repair' as const, findingDispositionRefs: ['F-2'], authorityBasisRefs: ['A-2'], affectedIds: ['MUST-2'], earliestAffectedStage: 'cp05', latestValidPredecessorCheckpoint: 'cp04', expectedChangedArtifactRoles: ['confirmation_projection'], initialDisposition: 'authorized' },
        { stepId: 'STEP-1', route: 'compiler_gap' as const, findingDispositionRefs: ['F-1'], authorityBasisRefs: ['A-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', expectedChangedArtifactRoles: ['semantic_ir'], initialDisposition: 'authorized' },
      ],
      authorityBasisRefs: ['A-2', 'A-1'], findingDispositionRefs: ['F-2', 'F-1'], affectedIds: ['MUST-2', 'MUST-1'],
      earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', beforeState: { semanticIrHash: hash('3') },
      expectedChangedArtifactRoles: ['semantic_ir', 'confirmation_projection'], compilerIdentity: 'compiler/v1',
    };
    const left = createRequirementsContractRemediationPlan(input);
    const right = createRequirementsContractRemediationPlan({ ...input, authorityBasisRefs: [...input.authorityBasisRefs].reverse() });
    expect(left.remediationPlanHash).toBe(right.remediationPlanHash);
    expect(left.repairSteps.map((step) => step.route)).toEqual(['compiler_gap', 'projection_repair']);
    expect(validateRequirementsContractRemediationPlan(left)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(left).not.toHaveProperty('afterState');
  });

  it('rejects a finding owned by more than one repair step', () => {
    const plan = createRequirementsContractRemediationPlan({
      remediatesRequestHash: hash('1'), remediationAggregateHash: hash('2'),
      repairSteps: [{ stepId: 'STEP-1', route: 'compiler_gap', findingDispositionRefs: ['F-1'], authorityBasisRefs: ['A-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', expectedChangedArtifactRoles: ['semantic_ir'], initialDisposition: 'authorized' }],
      authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', beforeState: { semanticIrHash: hash('3') }, expectedChangedArtifactRoles: ['semantic_ir'], compilerIdentity: 'compiler/v1',
    });
    const duplicated = { ...plan, repairSteps: [...plan.repairSteps, { ...plan.repairSteps[0]!, stepId: 'STEP-2' }] };
    expect(validateRequirementsContractRemediationPlan(duplicated).issueCodes).toContain('remediation_plan_finding_coverage_invalid');
  });

  it('accepts only validated canonical plan and delta artifacts for lifecycle identity', () => {
    const plan = createRequirementsContractRemediationPlan({
      remediatesRequestHash: hash('1'), remediationAggregateHash: hash('2'),
      repairSteps: [{ stepId: 'STEP-1', route: 'compiler_gap', findingDispositionRefs: ['F-1'], authorityBasisRefs: ['A-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', expectedChangedArtifactRoles: ['semantic_ir'], initialDisposition: 'authorized' }],
      authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01', beforeState: { semanticIrHash: hash('3') }, expectedChangedArtifactRoles: ['semantic_ir'], compilerIdentity: 'compiler/v1',
    });
    const delta = createRequirementsContractRemediationDelta({
      remediationPlanHash: plan.remediationPlanHash, remediatesRequestHash: hash('1'), remediationAggregateHash: hash('2'),
      executedRepairStepRefs: [{ stepId: 'STEP-1', stepHash: requirementsRemediationStepHash(plan.repairSteps[0]!), finalDisposition: 'executed' }], deferredRepairStepRefs: [],
      authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01',
      beforeState: { semanticIrHash: hash('3') }, afterState: { semanticIrHash: hash('5') }, changedArtifactRoles: ['semantic_ir'], compilerIdentity: 'compiler/v1',
    }, {
      remediationPlan: plan,
      readback: {
        authoringAttemptId: 'ATTEMPT-1', stagingRoot: 'authoring/staging/ATTEMPT-1',
        authorityBasisRefs: ['A-1'], findingDispositionRefs: ['F-1'], latestValidPredecessorCheckpoint: 'cp01',
        beforeState: { semanticIrHash: hash('3') }, afterState: { semanticIrHash: hash('5') },
        changedArtifacts: [{ role: 'semantic_ir', recordRelativePath: 'authoring/staging/ATTEMPT-1/semantic-ir.json', artifactHash: hash('5') }],
      },
    });
    const identityInput = {
      recordId: 'REQ-001', requestNonce: 'request-1', grillGraphHash: hash('6'), attemptNonce: 'attempt-1',
      parentSemanticRevisionId: null, scopeSemanticHash: hash('7'), compilerVersion: 'compiler/v1',
      judgeRequestPayload: { packetHash: hash('8') }, remediationPlan: plan, remediationDelta: delta,
    };
    const identity = createRequirementsContractAuthoringIdentity(identityInput);
    expect(identity.remediationPlanHash).toBe(plan.remediationPlanHash);
    expect(identity.remediationDeltaHash).toBe(delta.remediationDeltaHash);
    expect(() => createRequirementsContractAuthoringIdentity({
      ...identityInput,
      remediationPlan: { ...plan, remediationPlanHash: hash('9') },
    })).toThrow('remediation_plan_hash_mismatch');
  });
});
