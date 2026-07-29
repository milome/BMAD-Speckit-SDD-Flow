const {
  hashControlPlaneValue,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);

const POLICY_SCHEMA = 'goal-contract-source-composition-policy.schema.json';
const VALID_MODES = new Set(['single_source', 'composite_required']);
const VALID_AUTHORITY_KINDS = new Set([
  'deterministic_source_authority_adapter',
  'imported_approved_contract',
]);

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...details });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function stringArray(value, field, required = true) {
  if (value === undefined && !required) return [];
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw failure('source_composition_policy_invalid', {
      reason: `${field}_invalid`,
    });
  }
  return [...value].sort();
}

function normalizeBinding(value) {
  if (!isRecord(value)) {
    throw failure('source_composition_policy_invalid', {
      reason: 'binding_not_object',
    });
  }
  const unknown = Object.keys(value).filter(
    (key) =>
      ![
        'role',
        'namespace',
        'sourceArtifactId',
        'parentTaskRefs',
        'requiredRequirementIds',
        'requiredTaskIds',
      ].includes(key)
  );
  if (unknown.length > 0) {
    throw failure('source_composition_policy_invalid', {
      reason: 'binding_unknown_fields',
      fields: unknown.sort(),
    });
  }
  if (value.role !== 'subordinate_component_specification') {
    throw failure('source_composition_policy_invalid', {
      reason: 'binding_role_invalid',
    });
  }
  if (
    typeof value.namespace !== 'string' ||
    value.namespace.length === 0 ||
    typeof value.sourceArtifactId !== 'string' ||
    value.sourceArtifactId.length === 0
  ) {
    throw failure('source_composition_policy_invalid', {
      reason: 'binding_identity_invalid',
    });
  }
  const binding = {
    role: value.role,
    namespace: value.namespace,
    sourceArtifactId: value.sourceArtifactId,
    parentTaskRefs: stringArray(value.parentTaskRefs, 'parentTaskRefs'),
    requiredRequirementIds: stringArray(
      value.requiredRequirementIds,
      'requiredRequirementIds'
    ),
    requiredTaskIds: stringArray(value.requiredTaskIds, 'requiredTaskIds'),
  };
  if (
    binding.requiredRequirementIds.length === 0 ||
    binding.requiredTaskIds.length === 0
  ) {
    throw failure('source_composition_policy_invalid', {
      reason: 'binding_required_ids_empty',
      sourceArtifactId: binding.sourceArtifactId,
    });
  }
  return binding;
}

function normalizeBindings(value) {
  if (!Array.isArray(value)) {
    throw failure('source_composition_policy_invalid', {
      reason: 'required_subordinate_bindings_invalid',
    });
  }
  const bindings = value.map(normalizeBinding);
  const identities = bindings.map(
    (item) => `${item.role}|${item.namespace}|${item.sourceArtifactId}`
  );
  if (new Set(identities).size !== identities.length) {
    throw failure('source_composition_policy_invalid', {
      reason: 'required_binding_duplicate',
    });
  }
  return bindings.sort((left, right) =>
    `${left.role}|${left.namespace}|${left.sourceArtifactId}`.localeCompare(
      `${right.role}|${right.namespace}|${right.sourceArtifactId}`,
      'en'
    )
  );
}

function expectedAuthorityEvidenceHash(record) {
  return hashControlPlaneValue({
    authoritySourceId: record.authoritySourceId,
    mode: record.declaredMode,
    requiredSubordinateBindings: normalizeBindings(
      record.requiredSubordinateBindings ?? []
    ),
  });
}

function normalizeAuthorityRecord(record) {
  if (!isRecord(record)) {
    throw failure('source_composition_policy_authority_rejected');
  }
  const unknown = Object.keys(record).filter(
    (key) =>
      ![
        'authorityKind',
        'authoritySourceId',
        'declaredMode',
        'requiredSubordinateBindings',
        'declaredRequiredBindingsHash',
        'authorityEvidenceHash',
      ].includes(key)
  );
  if (unknown.length > 0) {
    throw failure('source_composition_policy_authority_rejected', {
      fields: unknown.sort(),
    });
  }
  const authorityKind = record.authorityKind;
  if (
    typeof authorityKind !== 'string' ||
    !VALID_AUTHORITY_KINDS.has(authorityKind) ||
    typeof record.authoritySourceId !== 'string' ||
    record.authoritySourceId.length === 0
  ) {
    throw failure('source_composition_policy_authority_rejected');
  }
  const declaredMode = record.declaredMode;
  if (
    typeof declaredMode !== 'string' ||
    !VALID_MODES.has(declaredMode)
  ) {
    throw failure('source_composition_policy_invalid', {
      mode: declaredMode,
    });
  }
  const requiredSubordinateBindings = normalizeBindings(
    record.requiredSubordinateBindings ?? []
  );
  if (
    typeof record.declaredRequiredBindingsHash !== 'string' ||
    record.declaredRequiredBindingsHash !==
      hashControlPlaneValue(requiredSubordinateBindings)
  ) {
    throw failure('source_composition_policy_replay_rejected', {
      reason: 'declared_required_bindings_hash_mismatch',
    });
  }
  if (
    typeof record.authorityEvidenceHash !== 'string' ||
    record.authorityEvidenceHash !== expectedAuthorityEvidenceHash(record)
  ) {
    throw failure('source_composition_policy_replay_rejected', {
      reason: 'authority_evidence_hash_mismatch',
    });
  }
  return {
    authorityKind,
    authoritySourceId: record.authoritySourceId,
    declaredMode,
    declaredRequiredBindingsHash: record.declaredRequiredBindingsHash,
    authorityEvidenceHash: record.authorityEvidenceHash,
    requiredSubordinateBindings,
  };
}

function policyPayload(policy) {
  return {
    schemaVersion: policy.schemaVersion,
    mode: policy.mode,
    policyAuthorityBinding: policy.policyAuthorityBinding,
    requiredSubordinateBindings: policy.requiredSubordinateBindings,
    conflictPolicy: policy.conflictPolicy,
  };
}

function verifySourceCompositionPolicy(policy) {
  if (!isRecord(policy)) {
    throw failure('source_composition_policy_invalid');
  }
  const policyAuthorityBinding = isRecord(
    policy.policyAuthorityBinding
  )
    ? policy.policyAuthorityBinding
    : {};
  if (
    policy.mode === 'single_source' &&
    policyAuthorityBinding.declaredMode === 'composite_required'
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  if (
    policy.mode === 'composite_required' &&
    policyAuthorityBinding.declaredMode === 'single_source'
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  validateGoalContractSchema(POLICY_SCHEMA, policy);
  const authority = normalizeAuthorityRecord({
    ...policyAuthorityBinding,
    requiredSubordinateBindings: policy.requiredSubordinateBindings,
  });
  if (authority.declaredMode !== policy.mode) {
    throw failure(
      authority.declaredMode === 'composite_required'
        ? 'source_composition_downgrade_rejected'
        : 'source_composition_policy_mismatch'
    );
  }
  if (
    hashControlPlaneValue(policy.requiredSubordinateBindings) !==
    authority.declaredRequiredBindingsHash
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  const expectedHash = hashControlPlaneValue(policyPayload(policy));
  if (expectedHash !== policy.sourceCompositionPolicyHash) {
    throw failure('source_composition_policy_replay_rejected', {
      reason: 'policy_hash_mismatch',
    });
  }
  return policy;
}

function compileSourceCompositionPolicy(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('source_composition_policy_invalid');
  }
  const callerAuthFields = [
    'declaredMode',
    'declaredRequiredBindingsHash',
    'authorityEvidenceHash',
    'policyAuthorityBinding',
  ];
  if (callerAuthFields.some((field) => Object.hasOwn(request, field))) {
    throw failure('source_composition_policy_authority_rejected');
  }
  const authorityRecord =
    request.authorityRecord ?? request.policyAuthorityRecord;
  if (!authorityRecord) {
    throw failure('source_composition_policy_authority_rejected');
  }
  const authority = normalizeAuthorityRecord(authorityRecord);
  if (
    request.mode !== undefined &&
    request.mode !== authority.declaredMode
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  const requestedBindings =
    request.requiredSubordinateBindings ??
    authority.requiredSubordinateBindings;
  const requiredSubordinateBindings = normalizeBindings(requestedBindings);
  if (
    hashControlPlaneValue(requiredSubordinateBindings) !==
    authority.declaredRequiredBindingsHash
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  if (
    authority.declaredMode === 'single_source' &&
    requiredSubordinateBindings.length > 0
  ) {
    throw failure('source_composition_policy_mismatch');
  }
  if (
    authority.declaredMode === 'composite_required' &&
    requiredSubordinateBindings.length === 0
  ) {
    throw failure('source_composition_policy_invalid');
  }
  const policy = {
    schemaVersion: 'goal-contract-source-composition-policy/v1',
    mode: authority.declaredMode,
    policyAuthorityBinding: {
      authorityKind: authority.authorityKind,
      authoritySourceId: authority.authoritySourceId,
      declaredMode: authority.declaredMode,
      declaredRequiredBindingsHash: authority.declaredRequiredBindingsHash,
      authorityEvidenceHash: authority.authorityEvidenceHash,
    },
    requiredSubordinateBindings,
    conflictPolicy: 'fail_closed',
  };
  const result = {
    ...policy,
    sourceCompositionPolicyHash: hashControlPlaneValue(policyPayload(policy)),
  };
  return verifySourceCompositionPolicy(result);
}

module.exports = {
  compileSourceCompositionPolicy,
  verifySourceCompositionPolicy,
};
