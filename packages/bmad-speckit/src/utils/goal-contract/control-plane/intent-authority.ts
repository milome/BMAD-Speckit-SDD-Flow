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

const INTENT_AUTHORITY_SCHEMA =
  'goal-contract-intent-authority-envelope.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const CONFIRMED_ENTRY_SCENARIOS = new Set([
  'confirmed_requirements',
  'req_trace',
  'main_agent',
  'main_agent_dispatch',
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

function requiredHash(value, field) {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw failure('authority_missing', { field });
  }
  return value;
}

function requiredString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('authority_missing', { field });
  }
  return value;
}

function normalizeBasis(value) {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    throw failure('authority_missing');
  }
  if (value.kind === 'direct_source_declaration') {
    const allowed = new Set([
      'kind',
      'sourceDeclarationHash',
      'declaringUserAuthorityIdentity',
      'entryScenario',
    ]);
    if (Object.keys(value).some((field) => !allowed.has(field))) {
      throw failure('authority_kind_mismatch');
    }
    return {
      kind: value.kind,
      sourceDeclarationHash: requiredHash(
        value.sourceDeclarationHash,
        'sourceDeclarationHash'
      ),
      declaringUserAuthorityIdentity: requiredString(
        value.declaringUserAuthorityIdentity,
        'declaringUserAuthorityIdentity'
      ),
      entryScenario: requiredString(value.entryScenario, 'entryScenario'),
    };
  }
  if (value.kind === 'implementation_confirmation') {
    const allowed = new Set([
      'kind',
      'requirementRecordId',
      'confirmationHash',
      'confirmationSchemaVersion',
      'confirmedAuthorityIdentity',
    ]);
    if (Object.keys(value).some((field) => !allowed.has(field))) {
      throw failure('authority_kind_mismatch');
    }
    return {
      kind: value.kind,
      requirementRecordId: requiredString(
        value.requirementRecordId,
        'requirementRecordId'
      ),
      confirmationHash: requiredHash(
        value.confirmationHash,
        'confirmationHash'
      ),
      confirmationSchemaVersion: requiredString(
        value.confirmationSchemaVersion,
        'confirmationSchemaVersion'
      ),
      confirmedAuthorityIdentity: requiredString(
        value.confirmedAuthorityIdentity,
        'confirmedAuthorityIdentity'
      ),
    };
  }
  if (value.kind === 'imported_approved_contract') {
    const allowed = new Set([
      'kind',
      'importedContractHash',
      'approvalReceiptHash',
      'approvalAuthorityIdentity',
    ]);
    if (Object.keys(value).some((field) => !allowed.has(field))) {
      throw failure('authority_kind_mismatch');
    }
    return {
      kind: value.kind,
      importedContractHash: requiredHash(
        value.importedContractHash,
        'importedContractHash'
      ),
      approvalReceiptHash: requiredHash(
        value.approvalReceiptHash,
        'approvalReceiptHash'
      ),
      approvalAuthorityIdentity: requiredString(
        value.approvalAuthorityIdentity,
        'approvalAuthorityIdentity'
      ),
    };
  }
  throw failure('authority_kind_unsupported', {
    authorityKind: value.kind,
  });
}

function normalizeSubject(subject, bundle) {
  if (!isRecord(subject) || !isRecord(bundle)) {
    throw failure('authority_missing');
  }
  const boundPolicyHash = requiredHash(
    bundle.sourceCompositionPolicyHash,
    'sourceCompositionPolicyHash'
  );
  const boundSnapshotSetHash = requiredHash(
    bundle.orderedSourceSnapshotSetHash,
    'orderedSourceSnapshotSetHash'
  );
  const boundBundleHash = requiredHash(
    bundle.sourceAuthorityBundleHash,
    'sourceAuthorityBundleHash'
  );
  for (const [field, expected] of [
    ['sourceCompositionPolicyHash', boundPolicyHash],
    ['orderedSourceSnapshotSetHash', boundSnapshotSetHash],
    ['sourceAuthorityBundleHash', boundBundleHash],
  ]) {
    if (subject[field] !== undefined && subject[field] !== expected) {
      throw failure('authority_subject_mismatch', { field });
    }
  }
  return {
    sourceSnapshotHash: requiredHash(
      subject.sourceSnapshotHash,
      'sourceSnapshotHash'
    ),
    canonicalIntentSemanticHash: requiredHash(
      subject.canonicalIntentSemanticHash,
      'canonicalIntentSemanticHash'
    ),
    specSpanRegistryHash: requiredHash(
      subject.specSpanRegistryHash,
      'specSpanRegistryHash'
    ),
    sourceCompositionPolicyHash: boundPolicyHash,
    orderedSourceSnapshotSetHash: boundSnapshotSetHash,
    sourceAuthorityBundleHash: boundBundleHash,
  };
}

function envelopePayload(envelope) {
  return {
    schemaVersion: envelope.schemaVersion,
    subject: envelope.subject,
    authorityBasis: envelope.authorityBasis,
  };
}

function verifyIntentAuthorityEnvelope(envelope) {
  if (
    !isRecord(envelope) ||
    hashControlPlaneValue(envelopePayload(envelope)) !==
    envelope.authorityAttestationHash
  ) {
    throw failure('authority_attestation_mismatch');
  }
  validateGoalContractSchema(INTENT_AUTHORITY_SCHEMA, envelope);
  return envelope;
}

function compileIntentAuthorityEnvelope(request: unknown = {}) {
  if (!isRecord(request)) throw failure('authority_missing');
  if (
    Object.hasOwn(request, 'authorityAttestationHash') ||
    Object.hasOwn(request, 'issuedAt') ||
    Object.hasOwn(request, 'issuer')
  ) {
    throw failure('authority_provenance_forbidden');
  }
  const authorityBasis = normalizeBasis(request.authorityBasis);
  const rawEntryScenario = request.entryScenario;
  if (
    rawEntryScenario !== undefined &&
    typeof rawEntryScenario !== 'string'
  ) {
    throw failure('authority_kind_mismatch');
  }
  const requestedEntryScenario =
    typeof rawEntryScenario === 'string'
      ? rawEntryScenario
      : undefined;
  const entryScenario =
    requestedEntryScenario ??
    (authorityBasis.kind === 'direct_source_declaration'
      ? authorityBasis.entryScenario
      : null);
  if (
    authorityBasis.kind === 'direct_source_declaration' &&
    CONFIRMED_ENTRY_SCENARIOS.has(entryScenario)
  ) {
    throw failure('authority_fallback_forbidden');
  }
  if (
    authorityBasis.kind === 'implementation_confirmation' &&
    requestedEntryScenario !== undefined &&
    !CONFIRMED_ENTRY_SCENARIOS.has(requestedEntryScenario)
  ) {
    throw failure('authority_fallback_forbidden');
  }
  if (
    requestedEntryScenario !== undefined &&
    authorityBasis.kind === 'direct_source_declaration' &&
    requestedEntryScenario !== authorityBasis.entryScenario
  ) {
    throw failure('authority_kind_mismatch');
  }
  const partial = {
    schemaVersion: 'goal-contract-intent-authority-envelope/v1',
    subject: normalizeSubject(
      request.subject,
      request.compositeSourceAuthorityBundle
    ),
    authorityBasis,
  };
  return verifyIntentAuthorityEnvelope({
    ...partial,
    authorityAttestationHash: hashControlPlaneValue(
      envelopePayload(partial)
    ),
  });
}

module.exports = {
  compileIntentAuthorityEnvelope,
  verifyIntentAuthorityEnvelope,
};
