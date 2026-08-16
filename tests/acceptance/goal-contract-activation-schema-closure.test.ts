import { describe, expect, it } from 'vitest';
import { validateGoalContractSchema } from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/schema-registry';

const HASH = `sha256:${'a'.repeat(64)}`;
const hashRef = (path: string) => ({ path, hash: HASH });
const packageArtifact = (role: string) => ({ role, path: `package/${role}`, hash: HASH });
const resultArtifact = (role: string) => ({
  role,
  artifactRef: `/run/${role}`,
  artifactHash: HASH,
});

function expectInvalid(schemaName: string, value: unknown): void {
  expect(() => validateGoalContractSchema(schemaName, value)).toThrow('canonical_schema_invalid');
}

function directCandidate() {
  return {
    schemaVersion: 'GoalContractCandidateRun/v1',
    candidateRunId: 'RUN-AAAAAAAAAAAAAAAA',
    profile: 'requirements_backed',
    goalId: 'GOAL-AAAAAAAAAAAAAAAA',
    goalExecutionIRHash: HASH,
    executionMode: 'direct_goal',
    partitionOutcome: 'not_applicable',
    goalExecutionAuthorityRef: hashRef('goal/goal-execution-ir.json'),
    eligibilityRef: hashRef('eligibility.json'),
    executionPackageRefs: [hashRef('package/direct-execution-package.json')],
    candidateRunHash: HASH,
  };
}

function activationRecord() {
  const { candidateRunHash: _candidateRunHash, ...candidate } = directCandidate();
  return {
    ...candidate,
    schemaVersion: 'GoalContractActivationRecord/v1',
    candidateRunRef: hashRef('candidate-run.json'),
    activationRecordHash: HASH,
  };
}

function directPackage() {
  return {
    schemaVersion: 'GoalContractDirectExecutionPackage/v1',
    profile: 'requirements_backed',
    goalId: 'GOAL-AAAAAAAAAAAAAAAA',
    goalExecutionIRHash: HASH,
    executionMode: 'direct_goal',
    goalExecutionAuthorityRef: hashRef('goal/goal-execution-ir.json'),
    eligibilityRef: hashRef('eligibility.json'),
    artifacts: [
      packageArtifact('model_packet'),
      packageArtifact('human_prompt'),
      packageArtifact('audit_receipt'),
      packageArtifact('goal_execution_projection'),
    ],
    directExecutionPackageHash: HASH,
  };
}

function directSuccessResult() {
  return {
    schemaVersion: 'goal-contract-activation-result/v1',
    profile: 'requirements_backed',
    status: 'activated',
    issueCode: null,
    executionMode: 'direct_goal',
    partitionOutcome: 'not_applicable',
    artifacts: [
      resultArtifact('goal_execution_authority'),
      resultArtifact('execution_eligibility'),
      resultArtifact('candidate_run'),
      resultArtifact('activation_record'),
      resultArtifact('direct_execution_package'),
      resultArtifact('active_run_pointer'),
    ],
  };
}

describe('goal-contract activation schema closure', () => {
  it.each([
    ['goal-contract-candidate-run.schema.json', directCandidate()],
    ['goal-contract-activation-record.schema.json', activationRecord()],
  ])('rejects a direct %s that carries a partition manifest', (schemaName, value) => {
    expectInvalid(schemaName, {
      ...value,
      selectedPartitionManifestRef: hashRef('partition/manifest.json'),
    });
  });

  it.each([
    ['goal-contract-candidate-run.schema.json', directCandidate()],
    ['goal-contract-activation-record.schema.json', activationRecord()],
  ])('requires a manifest for a partitioned %s', (schemaName, value) => {
    expectInvalid(schemaName, {
      ...value,
      executionMode: 'partitioned_goal',
      partitionOutcome: 'complete_valid',
    });
  });

  it.each([
    'goal-contract-direct-execution-package.schema.json',
    'goal-contract-child-execution-package.schema.json',
  ])('requires every four-artifact package role exactly once in %s', (schemaName) => {
    const value = directPackage();
    if (schemaName.includes('child')) {
      Object.assign(value, {
        schemaVersion: 'GoalContractChildExecutionPackage/v1',
        executionMode: 'partitioned_goal',
        partitionId: 'PART-001',
        childContractRef: hashRef('child-execution-contract.json'),
        childExecutionPackageHash: HASH,
      });
      delete (value as { directExecutionPackageHash?: string }).directExecutionPackageHash;
      delete (value as { goalExecutionAuthorityRef?: unknown }).goalExecutionAuthorityRef;
      delete (value as { eligibilityRef?: unknown }).eligibilityRef;
    }
    value.artifacts = Array.from({ length: 4 }, () => packageArtifact('model_packet'));
    expectInvalid(schemaName, value);
  });

  it('accepts a profile-typed successful result and rejects duplicate required roles', () => {
    const valid = directSuccessResult();
    expect(() =>
      validateGoalContractSchema('goal-contract-activation-result.schema.json', valid)
    ).not.toThrow();
    expectInvalid('goal-contract-activation-result.schema.json', {
      ...valid,
      artifacts: Array.from({ length: 6 }, () => resultArtifact('goal_execution_authority')),
    });
  });

  it('requires blocked results to carry no artifacts and a profile-compatible successor issue', () => {
    const requirementsBlocked = {
      schemaVersion: 'goal-contract-activation-result/v1',
      profile: 'requirements_backed',
      status: 'blocked',
      issueCode: 'requirements_successor_required:goal_task_decomposition',
      executionMode: null,
      partitionOutcome: null,
      artifacts: [],
    };
    expect(() =>
      validateGoalContractSchema('goal-contract-activation-result.schema.json', requirementsBlocked)
    ).not.toThrow();
    expectInvalid('goal-contract-activation-result.schema.json', {
      ...requirementsBlocked,
      artifacts: [resultArtifact('goal_execution_authority')],
    });
    expectInvalid('goal-contract-activation-result.schema.json', {
      ...requirementsBlocked,
      profile: 'standalone',
    });
  });
});
