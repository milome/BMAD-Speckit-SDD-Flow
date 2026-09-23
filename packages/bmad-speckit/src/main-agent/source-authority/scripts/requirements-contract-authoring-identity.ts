const SHA256 = /^sha256:[a-f0-9]{64}$/u;
const AUTHORING_IDENTITY_V2_HASH_FIELDS = [
  'scopeSemanticHash',
  'sourceBindingHash',
  'projectionSetHash',
  'buildHash',
  'judgeInputSemanticHash',
  'auditPolicyHash',
  'auditBindingHash',
] as const;

export interface RequirementsContractAuthoringIdentityV2 {
  schemaVersion: 'requirements-contract-authoring-identity/v2';
  scopeSemanticHash: string;
  sourceBindingHash: string;
  projectionSetHash: string;
  buildHash: string;
  judgeInputSemanticHash: string;
  auditPolicyHash: string;
  auditBindingHash: string;
}

export function createRequirementsContractAuthoringIdentityV2(
  input: Omit<RequirementsContractAuthoringIdentityV2, 'schemaVersion'>
): RequirementsContractAuthoringIdentityV2 {
  const keys = Object.keys(input).sort();
  const expectedKeys = [...AUTHORING_IDENTITY_V2_HASH_FIELDS].sort();
  if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('requirements_authoring_identity_v2_field_set_invalid');
  }
  for (const field of AUTHORING_IDENTITY_V2_HASH_FIELDS) {
    if (!SHA256.test(input[field])) {
      throw new Error(`requirements_authoring_identity_v2_${field}_invalid`);
    }
  }
  return {
    schemaVersion: 'requirements-contract-authoring-identity/v2',
    ...input,
  };
}


export function classifyRequirementsContractStaleness(input: {
  previousScopeSemanticHash: string;
  nextScopeSemanticHash: string;
  previousSourceBindingHash: string;
  nextSourceBindingHash: string;
}): 'current' | 'semantic_revision_stale' | 'citation_binding_stale' {
  if (input.previousScopeSemanticHash !== input.nextScopeSemanticHash) {
    return 'semantic_revision_stale';
  }
  if (input.previousSourceBindingHash !== input.nextSourceBindingHash) {
    return 'citation_binding_stale';
  }
  return 'current';
}
