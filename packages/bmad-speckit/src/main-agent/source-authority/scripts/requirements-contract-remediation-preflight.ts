import { requirementsContractDomainHash } from './requirements-contract-hash-domains';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const MATERIALIZABLE = new Set(['replace_atom', 'split_atom', 'rebind_constraint', 'replace_oracle']);

export function evaluateRequirementsContractRemediationCandidate(input: {
  beforeSemanticHash: string;
  repairSteps: unknown[];
}) {
  if (!SHA256.test(input.beforeSemanticHash) || !Array.isArray(input.repairSteps)) {
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
    if (!MATERIALIZABLE.has(String(value.operation)) || typeof value.targetNodeId !== 'string' ||
      !value.targetNodeId || value.expectedBeforeHash !== input.beforeSemanticHash) {
      issueCodes.push('requirements_remediation_not_materializable');
      continue;
    }
    changedSemanticNodeIds.push(value.targetNodeId);
  }
  const uniqueNodeIds = [...new Set(changedSemanticNodeIds)].sort();
  if (uniqueNodeIds.length === 0 && issueCodes.length === 0) {
    return {
      decision: 'no_progress' as const,
      beforeSemanticHash: input.beforeSemanticHash,
      afterSemanticHash: null,
      changedSemanticNodeIds: [],
      plannedUniqueBytes: 0,
      issueCodes: ['judge_remediation_no_semantic_progress'],
    };
  }
  if (issueCodes.length > 0) {
    return {
      decision: 'blocked' as const,
      beforeSemanticHash: input.beforeSemanticHash,
      afterSemanticHash: null,
      changedSemanticNodeIds: uniqueNodeIds,
      plannedUniqueBytes: 0,
      issueCodes: [...new Set(issueCodes)].sort(),
    };
  }
  const afterSemanticHash = requirementsContractDomainHash('requirements-remediation-candidate/v1', {
    beforeSemanticHash: input.beforeSemanticHash,
    changedSemanticNodeIds: uniqueNodeIds,
    repairSteps: input.repairSteps,
  });
  return {
    decision: 'publish' as const,
    beforeSemanticHash: input.beforeSemanticHash,
    afterSemanticHash,
    changedSemanticNodeIds: uniqueNodeIds,
    plannedUniqueBytes: 0,
    issueCodes: [],
  };
}
