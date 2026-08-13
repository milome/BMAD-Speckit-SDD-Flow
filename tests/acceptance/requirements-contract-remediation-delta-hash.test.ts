import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractRemediationDelta,
  validateRequirementsContractRemediationDelta,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-delta';
import {
  createRequirementsContractRemediationPlan,
  requirementsRemediationStepHash,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-plan';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements remediation delta hash', () => {
  const plan = createRequirementsContractRemediationPlan({
    remediatesRequestHash: hash('2'), remediationAggregateHash: hash('3'),
    repairSteps: [{
      stepId: 'STEP-1', route: 'compiler_gap', findingDispositionRefs: ['F-1'],
      authorityBasisRefs: ['AUTH-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02',
      latestValidPredecessorCheckpoint: 'cp01', expectedChangedArtifactRoles: ['semantic_ir'],
      initialDisposition: 'authorized',
    }],
    authorityBasisRefs: ['AUTH-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'],
    earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01',
    beforeState: { semanticIrHash: hash('5') }, expectedChangedArtifactRoles: ['semantic_ir'],
    compilerIdentity: 'compiler/v1',
  });
  const input = {
    remediationPlanHash: plan.remediationPlanHash, remediatesRequestHash: hash('2'), remediationAggregateHash: hash('3'),
    executedRepairStepRefs: [{ stepId: 'STEP-1', stepHash: requirementsRemediationStepHash(plan.repairSteps[0]!), finalDisposition: 'executed' as const }], deferredRepairStepRefs: [],
    authorityBasisRefs: ['AUTH-1'], findingDispositionRefs: ['F-1'], affectedIds: ['MUST-1'], earliestAffectedStage: 'cp02', latestValidPredecessorCheckpoint: 'cp01',
    beforeState: { semanticIrHash: hash('5') }, afterState: { semanticIrHash: hash('6') }, changedArtifactRoles: ['semantic_ir'], compilerIdentity: 'compiler/v1',
  };
  const context = {
    remediationPlan: plan,
    readback: {
      authoringAttemptId: 'ATTEMPT-2',
      stagingRoot: 'authoring/staging/ATTEMPT-2',
      authorityBasisRefs: ['AUTH-1'],
      findingDispositionRefs: ['F-1'],
      latestValidPredecessorCheckpoint: 'cp01',
      beforeState: { semanticIrHash: hash('5') },
      afterState: { semanticIrHash: hash('6') },
      changedArtifacts: [{
        role: 'semantic_ir',
        recordRelativePath: 'authoring/staging/ATTEMPT-2/semantic-ir.json',
        artifactHash: hash('6'),
      }],
    },
  };

  it('binds an actual non-empty before/after change to the remediation plan', () => {
    const delta = createRequirementsContractRemediationDelta(input, context);
    expect(validateRequirementsContractRemediationDelta(delta, context)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(delta.remediationDeltaHash).toMatch(/^sha256:/u);
    expect(delta.executedRepairStepRefs).toHaveLength(1);
  });

  it('rejects zero executed steps, equivalent state and non-owned staging', () => {
    expect(() => createRequirementsContractRemediationDelta({ ...input, executedRepairStepRefs: [] }, context)).toThrow('remediation_delta_executed_step_required');
    expect(() => createRequirementsContractRemediationDelta({ ...input, afterState: input.beforeState }, context)).toThrow('remediation_delta_empty');
    expect(() => createRequirementsContractRemediationDelta(input, {
      ...context,
      readback: { ...context.readback, stagingRoot: '../escape' },
    })).toThrow('remediation_delta_staging_ownership_invalid');
  });

  it('cross-checks step, finding, authority, checkpoint and changed-artifact readback', () => {
    expect(() => createRequirementsContractRemediationDelta({
      ...input,
      executedRepairStepRefs: [{ ...input.executedRepairStepRefs[0]!, stepHash: hash('4') }],
    }, context)).toThrow('remediation_delta_step_hash_mismatch');
    expect(() => createRequirementsContractRemediationDelta({ ...input, findingDispositionRefs: ['F-OTHER'] }, context)).toThrow('remediation_delta_finding_coverage_invalid');
    expect(() => createRequirementsContractRemediationDelta({ ...input, authorityBasisRefs: ['AUTH-OTHER'] }, context)).toThrow('remediation_delta_authority_basis_mismatch');
    expect(() => createRequirementsContractRemediationDelta({ ...input, latestValidPredecessorCheckpoint: 'cp00' }, context)).toThrow('remediation_delta_checkpoint_mismatch');
    expect(() => createRequirementsContractRemediationDelta(input, {
      ...context,
      readback: {
        ...context.readback,
        changedArtifacts: [{ ...context.readback.changedArtifacts[0]!, role: 'confirmation_projection' }],
      },
    })).toThrow('remediation_delta_changed_artifact_mismatch');
  });
});
