const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
function modulePath(relativePath: string): string {
  return `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
}
const {
  validateGoalContractSchema,
} = require(modulePath('./schema-registry'));
const LIFECYCLE_AUTHORITY_SCHEMA =
  'goal-contract-lifecycle-authority-binding.schema.json';
const IMPACT_BINDINGS = Object.freeze([
  ['graphHash', 'partitionImpactGraphHash'],
  ['feasibilityHash', 'partitionClosureFeasibilityReceiptHash'],
  ['driftHash', 'driftHash'],
]);

// Schema validation establishes the shape before dynamic records are consumed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaRecord = Record<string, any>;

function failure(
  field: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error('lifecycle_authority_mismatch'), {
    failureClass: 'lifecycle_authority_mismatch',
    errorCode: 'ER-GH-003',
    field,
    ...details,
  });
}

function isRecord(value: unknown): value is SchemaRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function requireHash(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw failure(field, { reason: 'hash_invalid', actual: value });
  }
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    throw failure(field, { reason: 'text_invalid', actual: value });
  }
  return value;
}

function validateLifecycleAuthorityBindingSchema(binding: SchemaRecord) {
  try {
    validateGoalContractSchema(LIFECYCLE_AUTHORITY_SCHEMA, binding);
  } catch (error) {
    throw failure('bindingSchema', {
      reason: 'schema_invalid',
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
}

function lifecycleAuthorityFieldsFromManifest(
  partitionManifest: unknown,
  { allowLegacy = true } = {}
): Readonly<Record<string, string>> {
  if (!isRecord(partitionManifest)) {
    throw failure('partitionManifest', { reason: 'record_invalid' });
  }
  const present = IMPACT_BINDINGS.filter(([, manifestField]) =>
    Object.hasOwn(partitionManifest, manifestField)
  );
  if (present.length === 0) {
    if (!allowLegacy) {
      throw failure('graphHash', { reason: 'legacy_manifest_forbidden' });
    }
    return Object.freeze({});
  }
  if (present.length !== IMPACT_BINDINGS.length) {
    throw failure('graphHash', {
      reason: 'manifest_impact_binding_partial',
      presentFields: present.map(([, manifestField]) => manifestField),
    });
  }
  return Object.freeze(
    Object.fromEntries(
      IMPACT_BINDINGS.map(([bindingField, manifestField]) => [
        bindingField,
        requireHash(partitionManifest[manifestField], manifestField),
      ])
    )
  );
}

function compileLifecycleAuthorityBinding(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('request', { reason: 'record_invalid' });
  }
  const partitionManifest = request.partitionManifest;
  const scope =
    request.scope ||
    (request.partitionId !== undefined ||
    request.childContractHash !== undefined
      ? 'partition'
      : 'campaign');
  if (!['campaign', 'partition'].includes(scope)) {
    throw failure('scope', { reason: 'scope_invalid', actual: scope });
  }
  const impactFields = lifecycleAuthorityFieldsFromManifest(
    partitionManifest,
    { allowLegacy: false }
  );
  const binding: SchemaRecord = {
    schemaVersion: 'goal-contract-lifecycle-authority-binding/v1',
    scope,
    partitionManifestHash: requireHash(
      partitionManifest.partitionManifestHash,
      'partitionManifestHash'
    ),
    campaignId: requireText(request.campaignId, 'campaignId'),
    attemptId: requireText(request.attemptId, 'attemptId'),
    ...impactFields,
  };
  if (scope === 'partition') {
    binding.partitionId = requireText(request.partitionId, 'partitionId');
    binding.childContractHash = requireHash(
      request.childContractHash,
      'childContractHash'
    );
  } else if (
    request.partitionId !== undefined ||
    request.childContractHash !== undefined
  ) {
    throw failure('scope', { reason: 'campaign_partition_fields_forbidden' });
  }
  if (request.nodeAttemptId !== undefined) {
    if (scope !== 'partition') {
      throw failure('nodeAttemptId', {
        reason: 'campaign_node_attempt_forbidden',
      });
    }
    binding.nodeAttemptId = requireText(
      request.nodeAttemptId,
      'nodeAttemptId'
    );
  }
  validateLifecycleAuthorityBindingSchema(binding);
  return Object.freeze(binding);
}

function verifyLifecycleAuthorityBinding(request: unknown = {}) {
  if (!isRecord(request) || !isRecord(request.record)) {
    throw failure('record', { reason: 'record_invalid' });
  }
  const record = request.record;
  const partitionManifest = request.partitionManifest;
  const impactFields = lifecycleAuthorityFieldsFromManifest(
    partitionManifest,
    { allowLegacy: request.allowLegacy !== false }
  );
  const currentBinding = Object.keys(impactFields).length > 0;
  if (!currentBinding) {
    for (const [field] of IMPACT_BINDINGS) {
      if (Object.hasOwn(record, field)) {
        throw failure(field, {
          reason: 'legacy_record_extension_forbidden',
          actual: record[field],
        });
      }
    }
    if (Object.hasOwn(record, 'nodeAttemptId')) {
      throw failure('nodeAttemptId', {
        reason: 'legacy_record_extension_forbidden',
        actual: record.nodeAttemptId,
      });
    }
    return Object.freeze({
      mode: 'legacy',
      impactFields,
    });
  }
  const attemptField =
    request.attemptField === undefined
      ? 'attemptId'
      : requireText(request.attemptField, 'attemptField');
  const expected: SchemaRecord = {
    partitionManifestHash: requireHash(
      partitionManifest.partitionManifestHash,
      'partitionManifestHash'
    ),
    campaignId: requireText(request.campaignId, 'campaignId'),
    [attemptField]: requireText(request.attemptId, attemptField),
  };
  const partitionScoped =
    request.partitionId !== undefined ||
    request.childContractHash !== undefined;
  if (partitionScoped) {
    expected.partitionId = requireText(request.partitionId, 'partitionId');
    expected.childContractHash = requireHash(
      request.childContractHash,
      'childContractHash'
    );
  }
  for (const [field, value] of Object.entries(expected)) {
    if (record[field] !== value) {
      throw failure(field, {
        reason: 'field_mismatch',
        expected: value,
        actual: record[field],
      });
    }
  }
  for (const [field] of IMPACT_BINDINGS) {
    if (record[field] !== impactFields[field]) {
      throw failure(field, {
        reason: 'field_mismatch',
        expected: impactFields[field],
        actual: record[field],
      });
    }
  }
  if (request.nodeAttemptId === undefined) {
    if (Object.hasOwn(record, 'nodeAttemptId')) {
      throw failure('nodeAttemptId', {
        reason: 'unexpected_node_attempt',
        actual: record.nodeAttemptId,
      });
    }
  } else {
    const expectedNodeAttemptId = requireText(
      request.nodeAttemptId,
      'nodeAttemptId'
    );
    if (!partitionScoped || record.nodeAttemptId !== expectedNodeAttemptId) {
      throw failure('nodeAttemptId', {
        reason: 'field_mismatch',
        expected: expectedNodeAttemptId,
        actual: record.nodeAttemptId,
      });
    }
  }
  validateLifecycleAuthorityBindingSchema({
    schemaVersion: 'goal-contract-lifecycle-authority-binding/v1',
    scope: partitionScoped ? 'partition' : 'campaign',
    partitionManifestHash: expected.partitionManifestHash,
    campaignId: expected.campaignId,
    attemptId: expected[attemptField],
    ...impactFields,
    ...(partitionScoped
      ? {
          partitionId: expected.partitionId,
          childContractHash: expected.childContractHash,
        }
      : {}),
    ...(request.nodeAttemptId === undefined
      ? {}
      : { nodeAttemptId: record.nodeAttemptId }),
  });
  return Object.freeze({
    mode: currentBinding ? 'current' : 'legacy',
    impactFields,
  });
}

function verifyLifecyclePredecessorOrigin(request: unknown = {}) {
  if (!isRecord(request) || !isRecord(request.record)) {
    throw failure('predecessorOrigin', { reason: 'request_invalid' });
  }
  const origin = requireText(request.predecessorOrigin, 'predecessorOrigin');
  let attemptId;
  if (origin === 'base') {
    attemptId = requireText(request.campaignAttemptId, 'campaignAttemptId');
  } else if (origin === 'preserved_base') {
    attemptId = requireText(request.baseAttemptId, 'baseAttemptId');
  } else if (origin === 'repaired') {
    attemptId = requireText(request.repairAttemptId, 'repairAttemptId');
  } else {
    throw failure('predecessorOrigin', {
      reason: 'origin_invalid',
      actual: origin,
    });
  }
  if (request.record.attemptId !== attemptId) {
    throw failure('attemptId', {
      reason: 'predecessor_origin_mismatch',
      expected: attemptId,
      actual: request.record.attemptId,
      predecessorOrigin: origin,
    });
  }
  return verifyLifecycleAuthorityBinding({
    record: request.record,
    partitionManifest: request.partitionManifest,
    campaignId: request.campaignId,
    attemptId,
    partitionId: request.partitionId,
    childContractHash: request.childContractHash,
    nodeAttemptId: request.nodeAttemptId,
    allowLegacy: request.allowLegacy,
  });
}

module.exports = {
  compileLifecycleAuthorityBinding,
  lifecycleAuthorityFieldsFromManifest,
  verifyLifecycleAuthorityBinding,
  verifyLifecyclePredecessorOrigin,
};
