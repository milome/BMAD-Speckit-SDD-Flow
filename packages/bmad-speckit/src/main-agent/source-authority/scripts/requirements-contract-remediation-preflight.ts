const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const MATERIALIZABLE_CLASSIFICATIONS = new Set(['compiler_gap', 'projection_repair']);

type SemanticIdentity = {
  scopeSemanticHash: string;
};

export function evaluateRequirementsContractRemediationCandidate(input: {
  currentSemanticIr: SemanticIdentity;
  candidateSemanticIr: SemanticIdentity;
  repairSteps: unknown[];
}) {
  const beforeSemanticHash = input.currentSemanticIr?.scopeSemanticHash;
  const afterSemanticHash = input.candidateSemanticIr?.scopeSemanticHash;
  if (
    !SHA256.test(beforeSemanticHash) ||
    !SHA256.test(afterSemanticHash) ||
    !Array.isArray(input.repairSteps)
  ) {
    throw new Error('requirements_remediation_preflight_input_invalid');
  }
  const issueCodes: string[] = [];
  const changedSemanticNodeIds: string[] = [];
  for (const step of input.repairSteps) {
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      issueCodes.push('requirements_remediation_not_materializable');
      continue;
    }
    const value = step as Record<string, unknown>;
    if (
      typeof value.findingId !== 'string' ||
      !value.findingId ||
      !MATERIALIZABLE_CLASSIFICATIONS.has(String(value.classification))
    ) {
      issueCodes.push('requirements_remediation_not_materializable');
      continue;
    }
    if (Array.isArray(value.affectedMustRefs)) {
      changedSemanticNodeIds.push(
        ...value.affectedMustRefs.filter((entry): entry is string => typeof entry === 'string')
      );
    }
  }
  const uniqueNodeIds = [...new Set(changedSemanticNodeIds)].sort();
  if (issueCodes.length > 0) {
    return {
      decision: 'blocked' as const,
      beforeSemanticHash,
      afterSemanticHash: null,
      changedSemanticNodeIds: uniqueNodeIds,
      plannedUniqueBytes: 0,
      issueCodes: [...new Set(issueCodes)].sort(),
    };
  }
  if (afterSemanticHash === beforeSemanticHash) {
    return {
      decision: 'no_progress' as const,
      beforeSemanticHash,
      afterSemanticHash: null,
      changedSemanticNodeIds: [],
      plannedUniqueBytes: 0,
      issueCodes: ['judge_remediation_no_semantic_progress'],
    };
  }
  return {
    decision: 'publish' as const,
    beforeSemanticHash,
    afterSemanticHash,
    changedSemanticNodeIds: uniqueNodeIds,
    plannedUniqueBytes: 0,
    issueCodes: [],
  };
}
