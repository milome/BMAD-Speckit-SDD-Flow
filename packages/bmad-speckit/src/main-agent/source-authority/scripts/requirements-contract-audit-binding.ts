import { requirementsContractDomainHash } from './requirements-contract-hash-domains';

const SHA256 = /^sha256:[a-f0-9]{64}$/u;

export interface RequirementsContractAuditBinding {
  schemaVersion: 'requirements-contract-audit-binding/v1';
  scopeSemanticHash: string;
  judgeInputSemanticHash: string;
  auditPolicyHash: string;
  auditBindingHash: string;
}

export function createRequirementsContractAuditBinding(input: {
  scopeSemanticHash: string;
  semanticAuditSlices: Array<{ role: string; schemaVersion: string; semanticHash: string }>;
  mandatoryDimensionIds: string[];
  coverageSemanticHash: string;
  judgeProtocolVersion: string;
  systemPromptHash: string;
  rubricHash: string;
  responseSchemaHash: string;
}): RequirementsContractAuditBinding {
  const hashes = [
    input.scopeSemanticHash, input.coverageSemanticHash,
    input.systemPromptHash, input.rubricHash, input.responseSchemaHash,
    ...input.semanticAuditSlices.map((slice) => slice.semanticHash),
  ];
  if (hashes.some((value) => !SHA256.test(value))) {
    throw new Error('requirements_audit_binding_hash_input_invalid');
  }
  const semanticAuditSlices = input.semanticAuditSlices.map((slice) => {
    if (!slice.role.trim() || !slice.schemaVersion.trim()) {
      throw new Error('requirements_audit_binding_slice_invalid');
    }
    return { role: slice.role, schemaVersion: slice.schemaVersion, semanticHash: slice.semanticHash };
  }).sort((left, right) =>
    `${left.role}\0${left.schemaVersion}\0${left.semanticHash}`.localeCompare(
      `${right.role}\0${right.schemaVersion}\0${right.semanticHash}`
    )
  );
  const mandatoryDimensionIds = [...new Set(input.mandatoryDimensionIds)].sort();
  if (mandatoryDimensionIds.some((value) => typeof value !== 'string' || !value)) {
    throw new Error('requirements_audit_binding_dimension_invalid');
  }
  const auditPolicyHash = requirementsContractDomainHash('requirements-audit-policy/v1', {
    systemPromptHash: input.systemPromptHash,
    rubricHash: input.rubricHash,
    responseSchemaHash: input.responseSchemaHash,
  });
  const judgeInputSemanticHash = requirementsContractDomainHash(
    'requirements-judge-input-semantic/v1',
    {
      scopeSemanticHash: input.scopeSemanticHash,
      semanticAuditSlices,
      mandatoryDimensionIds,
      coverageSemanticHash: input.coverageSemanticHash,
      judgeProtocolVersion: input.judgeProtocolVersion,
    }
  );
  const bindingPayload = { judgeInputSemanticHash, auditPolicyHash };
  return {
    schemaVersion: 'requirements-contract-audit-binding/v1',
    scopeSemanticHash: input.scopeSemanticHash,
    ...bindingPayload,
    auditBindingHash: requirementsContractDomainHash('requirements-audit-binding/v1', bindingPayload),
  };
}
