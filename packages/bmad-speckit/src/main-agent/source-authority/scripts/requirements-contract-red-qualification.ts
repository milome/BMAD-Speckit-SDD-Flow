import { sha256Stable } from './requirements-contract-semantic-resolver';

export type RequirementsContractRedClassification =
  | 'EXPECTED_RED'
  | 'INVALID_RED'
  | 'ALREADY_GREEN'
  | 'INCONCLUSIVE';

export interface RequirementsContractRedQualificationInput {
  requirementId: string;
  testId: string;
  semanticModelHash: string;
  baselineSnapshotHash: string;
  testSourceHash: string;
  fixtureHash: string;
  oracleHash: string;
  sequenceContractHash?: string;
  exitCode: number;
  failurePhase: 'assertion' | 'compile' | 'fixture' | 'environment' | 'setup';
  assertionSiteMatched: boolean;
  expectedFailure: string;
  observedFailure: string;
}

export interface RequirementsContractRedQualification
  extends RequirementsContractRedQualificationInput {
  schemaVersion: 'requirements-contract-red-qualification/v1';
  classification: RequirementsContractRedClassification;
  blockingReasons: string[];
  qualificationHash: string;
}

export function qualifyRequirementsContractRed(
  input: RequirementsContractRedQualificationInput
): RequirementsContractRedQualification {
  const blockingReasons: string[] = [];
  let classification: RequirementsContractRedClassification;
  if (input.exitCode === 0) {
    classification = 'ALREADY_GREEN';
    blockingReasons.push('red_test_already_green');
  } else if (input.failurePhase !== 'assertion') {
    classification = 'INVALID_RED';
    blockingReasons.push(`invalid_red_failure_phase:${input.failurePhase}`);
  } else if (!input.assertionSiteMatched) {
    classification = 'INCONCLUSIVE';
    blockingReasons.push('red_assertion_site_not_matched');
  } else if (
    input.expectedFailure.trim().length === 0 ||
    input.observedFailure.trim().length === 0
  ) {
    classification = 'INCONCLUSIVE';
    blockingReasons.push('red_failure_observation_missing');
  } else {
    classification = 'EXPECTED_RED';
  }
  const preimage = {
    schemaVersion: 'requirements-contract-red-qualification/v1' as const,
    ...input,
    classification,
    blockingReasons,
  };
  return { ...preimage, qualificationHash: sha256Stable(preimage) };
}

export interface RequirementsContractRedFreeze {
  schemaVersion: 'requirements-contract-red-freeze/v1';
  qualificationHash: string;
  semanticModelHash: string;
  baselineSnapshotHash: string;
  testSourceHash: string;
  fixtureHash: string;
  oracleHash: string;
  sequenceContractHash: string | null;
  freezeHash: string;
}

export function freezeQualifiedRequirementsContractRed(
  qualification: RequirementsContractRedQualification
): RequirementsContractRedFreeze {
  if (qualification.classification !== 'EXPECTED_RED') {
    throw new Error('red_freeze_expected_red_required');
  }
  const preimage = {
    schemaVersion: 'requirements-contract-red-freeze/v1' as const,
    qualificationHash: qualification.qualificationHash,
    semanticModelHash: qualification.semanticModelHash,
    baselineSnapshotHash: qualification.baselineSnapshotHash,
    testSourceHash: qualification.testSourceHash,
    fixtureHash: qualification.fixtureHash,
    oracleHash: qualification.oracleHash,
    sequenceContractHash: qualification.sequenceContractHash ?? null,
  };
  return { ...preimage, freezeHash: sha256Stable(preimage) };
}

export function validateQualifiedRequirementsContractRedFreeze(
  freeze: RequirementsContractRedFreeze,
  current: {
    semanticModelHash: string;
    baselineSnapshotHash: string;
    testSourceHash: string;
    fixtureHash: string;
    oracleHash: string;
    sequenceContractHash?: string;
  }
): { ok: boolean; issues: string[] } {
  const issues: string[] = [];
  const fields = [
    ['semanticModelHash', 'semantic_model_hash'],
    ['baselineSnapshotHash', 'baseline_snapshot_hash'],
    ['testSourceHash', 'test_source_hash'],
    ['fixtureHash', 'fixture_hash'],
    ['oracleHash', 'oracle_hash'],
  ] as const;
  for (const [field, code] of fields) {
    if (freeze[field] !== current[field]) issues.push(`red_freeze_${code}_mismatch`);
  }
  if (freeze.sequenceContractHash !== (current.sequenceContractHash ?? null)) {
    issues.push('red_freeze_sequence_contract_hash_mismatch');
  }
  const { freezeHash: _freezeHash, ...preimage } = freeze;
  if (freeze.freezeHash !== sha256Stable(preimage)) issues.push('red_freeze_hash_mismatch');
  return { ok: issues.length === 0, issues };
}

export function evaluateRequirementsContractRedSemanticMutations(input: {
  qualificationHash: string;
  mutations: Array<{
    mutationId: string;
    mutationType: string;
    mandatory: boolean;
    killed: boolean;
  }>;
}) {
  const seen = new Set<string>();
  for (const mutation of input.mutations) {
    if (seen.has(mutation.mutationId)) {
      throw new Error(`semantic_mutation_duplicate_id:${mutation.mutationId}`);
    }
    seen.add(mutation.mutationId);
  }
  const requiredMutations = input.mutations.filter((mutation) => mutation.mandatory);
  const killedMutations = requiredMutations.filter((mutation) => mutation.killed);
  const survivingMandatoryMutationIds = requiredMutations
    .filter((mutation) => !mutation.killed)
    .map((mutation) => mutation.mutationId)
    .sort();
  const preimage = {
    schemaVersion: 'requirements-contract-semantic-mutation-report/v1' as const,
    qualificationHash: input.qualificationHash,
    mutations: input.mutations,
    requiredMutationCount: requiredMutations.length,
    killedMutationCount: killedMutations.length,
    survivingMandatoryMutationIds,
    decision: survivingMandatoryMutationIds.length === 0 ? ('pass' as const) : ('block' as const),
  };
  return { ...preimage, reportHash: sha256Stable(preimage) };
}
