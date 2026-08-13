export type RequirementsContractCoreCheckpointStage = 'cp00' | 'cp01' | 'cp03' | 'cp04';

export type RequirementsContractCoreArtifactRole =
  | 'semantic-kernel'
  | 'must-decomposition-packet'
  | 'id-registry'
  | 'semantic-conservation'
  | 'binding-conservation'
  | 'semantic-ir'
  | 'source-binding'
  | 'resolved-evidence-index';

export interface RequirementsContractCoreCheckpointProfile {
  stage: RequirementsContractCoreCheckpointStage;
  checkpointId:
    | 'cp-00-semantic-kernel'
    | 'cp-01-must-decomposition-packet'
    | 'cp-03-packet-to-source-materialization'
    | 'cp-04-id-freeze';
  profileId:
    | 'requirements-contract-cp00-semantic-kernel/v1'
    | 'requirements-contract-cp01-must-decomposition/v1'
    | 'requirements-contract-cp03-semantic-conservation/v1'
    | 'requirements-contract-cp04-freeze-publication/v1';
  artifactRoles: readonly RequirementsContractCoreArtifactRole[];
}

const CORE_CHECKPOINT_PROFILES: Record<
  RequirementsContractCoreCheckpointStage,
  RequirementsContractCoreCheckpointProfile
> = {
  cp00: {
    stage: 'cp00',
    checkpointId: 'cp-00-semantic-kernel',
    profileId: 'requirements-contract-cp00-semantic-kernel/v1',
    artifactRoles: ['semantic-kernel'],
  },
  cp01: {
    stage: 'cp01',
    checkpointId: 'cp-01-must-decomposition-packet',
    profileId: 'requirements-contract-cp01-must-decomposition/v1',
    artifactRoles: ['must-decomposition-packet'],
  },
  cp03: {
    stage: 'cp03',
    checkpointId: 'cp-03-packet-to-source-materialization',
    profileId: 'requirements-contract-cp03-semantic-conservation/v1',
    artifactRoles: ['id-registry', 'semantic-conservation', 'binding-conservation'],
  },
  cp04: {
    stage: 'cp04',
    checkpointId: 'cp-04-id-freeze',
    profileId: 'requirements-contract-cp04-freeze-publication/v1',
    artifactRoles: ['semantic-ir', 'source-binding', 'resolved-evidence-index'],
  },
};

export function requirementsContractCoreCheckpointProfile(
  stage: RequirementsContractCoreCheckpointStage
): RequirementsContractCoreCheckpointProfile {
  return CORE_CHECKPOINT_PROFILES[stage];
}

export function requirementsContractCoreProfileAllowsArtifact(
  stage: RequirementsContractCoreCheckpointStage,
  artifactRole: RequirementsContractCoreArtifactRole
): boolean {
  return CORE_CHECKPOINT_PROFILES[stage].artifactRoles.includes(artifactRole);
}

export interface RequirementsContractAtomicMust {
  atomId: string;
  action: string;
  oracle: string;
  dependencies: string[];
  coverageSeed: string;
  originBindings: Array<{ sourceRootId: string; sourceSpanRef: string }>;
  authorityRefs: string[];
  spanRefs: string[];
  executionConstraintRefs: string[];
}

export interface RequirementsContractCp02AtomicClosureInput {
  atoms: RequirementsContractAtomicMust[];
  decisions: Array<{
    decisionId: string;
    affectedAtomIds: string[];
    authorityPremiseHashes: string[];
  }>;
  executionRegistry: {
    entries: Array<{
      kind: string;
      id: string;
      value: string;
    }>;
  };
}

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueNonEmpty(values: unknown): values is string[] {
  return Array.isArray(values) && values.every(nonEmpty) && new Set(values).size === values.length;
}

function nonEmptySet(values: unknown): values is string[] {
  return uniqueNonEmpty(values) && values.length > 0;
}

function dependencyGraphHasCycle(atoms: RequirementsContractAtomicMust[]): boolean {
  const dependencies = new Map(atoms.map((atom) => [atom.atomId, atom.dependencies]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (atomId: string): boolean => {
    if (visiting.has(atomId)) return true;
    if (visited.has(atomId)) return false;
    visiting.add(atomId);
    for (const dependency of dependencies.get(atomId) ?? []) {
      if (dependencies.has(dependency) && visit(dependency)) return true;
    }
    visiting.delete(atomId);
    visited.add(atomId);
    return false;
  };
  return atoms.some((atom) => visit(atom.atomId));
}

export function validateRequirementsContractCp02AtomicClosure(
  input: RequirementsContractCp02AtomicClosureInput
) {
  const issueCodes: string[] = [];
  const executionEntries = input.executionRegistry?.entries;
  const executionRefs = new Set<string>();
  if (!Array.isArray(executionEntries)) {
    issueCodes.push('requirements_cp02_execution_registry_invalid');
  } else {
    for (const entry of executionEntries) {
      if (!entry || !nonEmpty(entry.kind) || !nonEmpty(entry.id) || !nonEmpty(entry.value)) {
        issueCodes.push('requirements_cp02_execution_registry_invalid');
        continue;
      }
      const ref = `${entry.kind}:${entry.id}`;
      if (executionRefs.has(ref)) issueCodes.push('requirements_cp02_execution_registry_duplicate');
      executionRefs.add(ref);
    }
  }
  if (!Array.isArray(input.atoms) || input.atoms.length === 0) {
    issueCodes.push('requirements_cp02_atom_missing');
  } else {
    const atomIds = new Set<string>();
    for (const atom of input.atoms) {
      if (!nonEmpty(atom.atomId) || atomIds.has(atom.atomId)) {
        issueCodes.push('requirements_cp02_atom_identity_invalid');
      } else atomIds.add(atom.atomId);
      if (!nonEmpty(atom.action)) issueCodes.push('requirements_cp02_atom_action_missing');
      if (!nonEmpty(atom.oracle)) issueCodes.push('requirements_cp02_atom_oracle_missing');
      if (!uniqueNonEmpty(atom.dependencies)) issueCodes.push('requirements_cp02_dependency_invalid');
      if (!nonEmpty(atom.coverageSeed)) issueCodes.push('requirements_cp02_coverage_seed_missing');
      if (
        !Array.isArray(atom.originBindings) ||
        atom.originBindings.length === 0 ||
        atom.originBindings.some((binding) =>
          !nonEmpty(binding.sourceRootId) || !nonEmpty(binding.sourceSpanRef)
        )
      ) issueCodes.push('requirements_cp02_origin_binding_missing');
      if (!nonEmptySet(atom.authorityRefs)) issueCodes.push('requirements_cp02_authority_invalid');
      if (!nonEmptySet(atom.spanRefs)) issueCodes.push('requirements_cp02_span_invalid');
      if (!nonEmptySet(atom.executionConstraintRefs)) {
        issueCodes.push('requirements_cp02_execution_constraint_invalid');
      } else if (atom.executionConstraintRefs.some((ref) => !executionRefs.has(ref))) {
        issueCodes.push('requirements_cp02_execution_constraint_unknown');
      }
    }
    for (const atom of input.atoms) {
      if (atom.dependencies.some((dependency) => !atomIds.has(dependency))) {
        issueCodes.push('requirements_cp02_dependency_unknown');
      }
    }
    if (dependencyGraphHasCycle(input.atoms)) {
      issueCodes.push('requirements_cp02_dependency_cycle');
    }
  }
  if (!Array.isArray(input.decisions)) {
    issueCodes.push('requirements_cp02_decision_registry_invalid');
  } else {
    const atomIds = new Set((input.atoms ?? []).map((atom) => atom.atomId));
    const decisionIds = new Set<string>();
    for (const decision of input.decisions) {
      if (!nonEmpty(decision?.decisionId) || decisionIds.has(decision.decisionId)) {
        issueCodes.push('requirements_cp02_decision_identity_invalid');
      } else {
        decisionIds.add(decision.decisionId);
      }
      if (
        !nonEmptySet(decision?.affectedAtomIds) ||
        decision.affectedAtomIds.some((atomId) => !atomIds.has(atomId))
      ) {
        issueCodes.push('requirements_cp02_decision_atom_binding_invalid');
      }
      if (
        !nonEmptySet(decision?.authorityPremiseHashes) ||
        decision.authorityPremiseHashes.some((hash) => !SHA256.test(hash))
      ) {
        issueCodes.push('requirements_cp02_decision_authority_invalid');
      }
    }
  }
  return {
    decision: issueCodes.length === 0 ? 'pass' as const : 'block' as const,
    issueCodes: [...new Set(issueCodes)].sort(),
  };
}
