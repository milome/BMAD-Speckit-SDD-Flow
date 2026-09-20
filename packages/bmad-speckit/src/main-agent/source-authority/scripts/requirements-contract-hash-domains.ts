import { createHash } from 'node:crypto';

const CONFIRMATION_BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'confirmationProjectionHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function sha256(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256Bytes(value: string | Buffer): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function normalizeTextForHash(value: string): string {
  const withoutBom = value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
  return withoutBom.replace(/\r\n?/gu, '\n').normalize('NFC');
}

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return normalizeTextForHash(value);
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalize(child)])
  );
}

export function canonicalRequirementsJson(value: unknown): string {
  return `${JSON.stringify(normalize(value))}\n`;
}

function canonicalObjectJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function withoutKeys(
  value: Record<string, unknown>,
  excluded: ReadonlySet<string>,
  recursive = false
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !excluded.has(key))
      .map(([key, child]) => [
        key,
        recursive && child && typeof child === 'object' && !Array.isArray(child)
          ? withoutKeys(child as Record<string, unknown>, excluded, true)
          : child,
      ])
  );
}

function hashDomain(domain: string, payload: unknown): string {
  return sha256(`${domain}\n${canonicalRequirementsJson(payload)}`);
}

export const REQUIREMENTS_AUTHORING_HASH_DOMAINS = {
  scopeSemanticHash: 'scopeSemanticHash/v3',
  packetSemanticHash: 'requirements-packet-semantic/v1',
  buildHash: 'requirements-authoring-build/v2',
  sourceBindingHash: 'sourceBindingHash/v1',
  semanticRevisionId: 'semanticRevisionId/v1',
  bindingRevisionId: 'bindingRevisionId/v1',
  artifactBytesHash: 'artifactBytesHash/v1',
  judgeRequestHash: 'judgeRequestHash/v2',
  remediationPlanHash: 'requirements-remediation-plan/v1',
  remediationDeltaHash: 'requirements-remediation-delta/v1',
  checkpointManifestHash: 'requirements-contract-authoring-checkpoint-manifest/v1',
  buildManifestHash: 'requirements-contract-build-manifest/v1',
  lintReportHash: 'requirements-contract-lint-report/v1',
} as const;

const LEGACY_SCOPE_SEMANTIC_HASH_DOMAIN = 'scopeSemanticHash/v2';

const HASH_EXCLUDED_PROVENANCE_KEYS = new Set([
  'createdAt',
  'timestamp',
  'transportAttempt',
  'transportAttemptId',
  'providerProse',
  'secret',
  'secretValue',
]);

function withoutHashExcludedProvenance(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutHashExcludedProvenance);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !HASH_EXCLUDED_PROVENANCE_KEYS.has(key))
      .map(([key, child]) => [key, withoutHashExcludedProvenance(child)])
  );
}

export function requirementsContractDomainHash(domain: string, payload: unknown): string {
  return hashDomain(domain, payload);
}

function withoutReceiptRefs(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutReceiptRefs);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'decisionReceiptRefs' && key !== 'derivationReceiptRefs')
      .map(([key, child]) => [key, withoutReceiptRefs(child)])
  );
}

const SCOPE_NON_SEMANTIC_KEYS = new Set([
  'sourcePath',
  'path',
  'createdAt',
  'updatedAt',
  'capturedAt',
  'timestamp',
  'language',
  'renderer',
  'rendererId',
  'derivedProjection',
  'derivedProjections',
  'projectionRefs',
  'receiptRefs',
]);

function projectScopeSemanticValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(projectScopeSemanticValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SCOPE_NON_SEMANTIC_KEYS.has(key))
      .map(([key, child]) => [key, projectScopeSemanticValue(child)])
  );
}

export function canonicalScopeSemanticPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return payload;
  const value = payload as Record<string, unknown>;
  const hasSemanticPayloadShape = [
    'semantics',
    'evidenceClaims',
    'specSpanRegistry',
    'executionConstraints',
  ].every((key) => key in value);
  if (!hasSemanticPayloadShape) return payload;
  return {
    semantics: projectScopeSemanticValue(withoutReceiptRefs(value.semantics)),
    evidenceClaims: projectScopeSemanticValue(withoutReceiptRefs(value.evidenceClaims)),
    specSpanRegistry: projectScopeSemanticValue(withoutReceiptRefs(value.specSpanRegistry)),
    executionConstraints: projectScopeSemanticValue(withoutReceiptRefs(value.executionConstraints)),
  };
}

export function scopeSemanticHash(payload: unknown): string {
  return hashDomain(
    REQUIREMENTS_AUTHORING_HASH_DOMAINS.scopeSemanticHash,
    canonicalScopeSemanticPayload(payload)
  );
}

export function legacyScopeSemanticHash(payload: unknown): string {
  return hashDomain(LEGACY_SCOPE_SEMANTIC_HASH_DOMAIN, payload);
}

function requiredRecord(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(code);
  return normalizeTextForHash(value);
}

function sortedStringSet(value: unknown, code: string): string[] {
  if (!Array.isArray(value)) throw new Error(code);
  return [...new Set(value.map((item) => requiredString(item, code)))].sort((left, right) =>
    left.localeCompare(right)
  );
}

export function packetSemanticHash(value: unknown): string {
  const packet = requiredRecord(value, 'requirements_packet_semantic_invalid');
  if (!Array.isArray(packet.musts)) throw new Error('requirements_packet_musts_invalid');
  const musts = packet.musts.map((mustValue) => {
    const must = requiredRecord(mustValue, 'requirements_packet_must_invalid');
    if (!Array.isArray(must.atoms)) throw new Error('requirements_packet_atoms_invalid');
    return {
      mustId: requiredString(must.mustId, 'requirements_packet_must_id_invalid'),
      atoms: must.atoms.map((atomValue) => {
        const atom = requiredRecord(atomValue, 'requirements_packet_atom_invalid');
        return {
          atomId: requiredString(atom.atomId, 'requirements_packet_atom_id_invalid'),
          action: requiredString(atom.action, 'requirements_packet_atom_action_invalid'),
          oracle: requiredString(atom.oracle, 'requirements_packet_atom_oracle_invalid'),
          dependencies: sortedStringSet(
            atom.dependencies,
            'requirements_packet_atom_dependencies_invalid'
          ),
          coverageRefs: sortedStringSet(
            atom.coverageRefs,
            'requirements_packet_atom_coverage_invalid'
          ),
        };
      }).sort((left, right) => left.atomId.localeCompare(right.atomId)),
    };
  }).sort((left, right) => left.mustId.localeCompare(right.mustId));
  return hashDomain(REQUIREMENTS_AUTHORING_HASH_DOMAINS.packetSemanticHash, { musts });
}

export function buildHash(value: unknown): string {
  const build = requiredRecord(value, 'requirements_build_hash_input_invalid');
  if (!Array.isArray(build.artifacts)) throw new Error('requirements_build_artifacts_invalid');
  const artifacts = build.artifacts.map((artifactValue) => {
    const artifact = requiredRecord(artifactValue, 'requirements_build_artifact_invalid');
    return {
      role: requiredString(artifact.role, 'requirements_build_artifact_role_invalid'),
      schemaVersion: requiredString(
        artifact.schemaVersion,
        'requirements_build_artifact_schema_invalid'
      ),
      semanticHash: requiredString(
        artifact.semanticHash,
        'requirements_build_artifact_semantic_hash_invalid'
      ),
      blobHash: requiredString(artifact.blobHash, 'requirements_build_artifact_blob_hash_invalid'),
      ...(typeof artifact.mediaType === 'string' ? {
        mediaType: requiredString(artifact.mediaType, 'requirements_build_artifact_media_type_invalid'),
      } : {}),
      ...(Number.isSafeInteger(artifact.byteLength) ? { byteLength: artifact.byteLength } : {}),
    };
  }).sort((left, right) =>
    `${left.role}\0${left.schemaVersion}\0${left.semanticHash}\0${left.blobHash}\0${left.mediaType ?? ''}\0${left.byteLength ?? ''}`.localeCompare(
      `${right.role}\0${right.schemaVersion}\0${right.semanticHash}\0${right.blobHash}\0${right.mediaType ?? ''}\0${right.byteLength ?? ''}`
    )
  );
  return hashDomain(REQUIREMENTS_AUTHORING_HASH_DOMAINS.buildHash, {
    scopeSemanticHash: requiredString(
      build.scopeSemanticHash,
      'requirements_build_scope_semantic_hash_invalid'
    ),
    sourceBindingHash: requiredString(
      build.sourceBindingHash,
      'requirements_build_source_binding_hash_invalid'
    ),
    compilerIdentity: requiredString(
      build.compilerIdentity,
      'requirements_build_compiler_identity_invalid'
    ),
    artifacts,
    ...(typeof build.projectionSetHash === 'string' ? { projectionSetHash: requiredString(build.projectionSetHash, 'requirements_build_projection_set_hash_invalid') } : {}),
    ...(typeof build.checkpointSummaryHash === 'string' ? { checkpointSummaryHash: requiredString(build.checkpointSummaryHash, 'requirements_build_checkpoint_summary_hash_invalid') } : {}),
    ...(typeof build.validationHash === 'string' ? { validationHash: requiredString(build.validationHash, 'requirements_build_validation_hash_invalid') } : {}),
  });
}

export function sourceBindingHash(payload: unknown): string {
  return hashDomain(REQUIREMENTS_AUTHORING_HASH_DOMAINS.sourceBindingHash, payload);
}

function identityFromHash(prefix: string, domain: string, payload: unknown): string {
  return `${prefix}-${hashDomain(domain, payload).slice('sha256:'.length).toUpperCase()}`;
}

export function semanticRevisionId(input: {
  recordId: string;
  parentSemanticRevisionId: string | null;
  scopeSemanticHash: string;
  compilerVersion: string;
}): string {
  return identityFromHash(
    'SEMREV',
    REQUIREMENTS_AUTHORING_HASH_DOMAINS.semanticRevisionId,
    input
  );
}

export function bindingRevisionId(input: {
  recordId: string;
  semanticRevisionId: string;
  parentBindingRevisionId: string | null;
  sourceBindingHash: string;
}): string {
  return identityFromHash(
    'BINDREV',
    REQUIREMENTS_AUTHORING_HASH_DOMAINS.bindingRevisionId,
    input
  );
}

export function artifactBytesHash(input: {
  role: string;
  mediaType: string;
  bytes: Buffer | string;
}): string {
  const prefix = Buffer.from(
    `${REQUIREMENTS_AUTHORING_HASH_DOMAINS.artifactBytesHash}\n${input.role}\n${input.mediaType}\n`,
    'utf8'
  );
  const bytes = Buffer.isBuffer(input.bytes) ? input.bytes : Buffer.from(input.bytes, 'utf8');
  return `sha256:${createHash('sha256').update(prefix).update(bytes).digest('hex')}`;
}

export function judgeRequestHash(payloadWithoutSelfHash: unknown): string {
  return hashDomain(
    REQUIREMENTS_AUTHORING_HASH_DOMAINS.judgeRequestHash,
    withoutHashExcludedProvenance(payloadWithoutSelfHash)
  );
}

export function requirementsContractHashDomainRegistry() {
  return {
    schemaVersion: 'requirements-contract-hash-domains/v2',
    sourceAuthority: 'requirements-source-authority/v1',
    confirmationProjection: 'requirements-confirmation-projection/v1',
    sourceDocument: 'requirements-source-document/v1',
    recipes: {
      sourceBytesHash: {
        domain: 'requirements-source-bytes/v1',
        recipe: 'sha256_raw_bytes',
      },
      normalizedTextHash: {
        domain: 'requirements-normalized-text/v1',
        recipe: 'strip_utf8_bom_lf_nfc_then_sha256_utf8',
      },
      canonicalObjectHash: {
        domain: 'requirements-canonical-object/v1',
        recipe: 'recursive_string_lf_nfc_sorted_json_then_sha256_utf8',
      },
      semanticModelHash: {
        domain: 'requirements-semantic-model/v1',
        recipe: 'canonical_object_hash',
      },
      projectionSetHash: {
        domain: 'requirements-projection-set/v2',
        recipe: 'canonical_object_hash',
      },
      distManifestHash: {
        domain: 'bmad-speckit-dist-manifest/v1',
        recipe: 'canonical_object_hash',
      },
      tarballBytesHash: {
        domain: 'bmad-speckit-tarball-bytes/v1',
        recipe: 'sha256_raw_bytes',
      },
      installedRuntimeHash: {
        domain: 'bmad-speckit-installed-runtime/v1',
        recipe: 'canonical_object_hash',
      },
    },
  } as const;
}

export function sourceBytesHash(value: string | Buffer): string {
  return sha256Bytes(value);
}

export function normalizedTextHash(value: string): string {
  return sha256(normalizeTextForHash(value));
}

export function canonicalObjectHash(value: unknown): string {
  return sha256(canonicalObjectJson(value));
}

export function semanticModelHash(value: unknown): string {
  return canonicalObjectHash(value);
}

export function projectionSetHash(value: unknown): string {
  return hashDomain(
    requirementsContractHashDomainRegistry().recipes.projectionSetHash.domain,
    value
  );
}

export function distManifestHash(value: unknown): string {
  return canonicalObjectHash(value);
}

export function tarballBytesHash(value: string | Buffer): string {
  return sha256Bytes(value);
}

export function installedRuntimeHash(value: unknown): string {
  return canonicalObjectHash(value);
}

export function sourceAuthorityHash(source: Record<string, unknown>): string {
  const { implementationConfirmation: _implementationConfirmation, ...authority } = source;
  return hashDomain(requirementsContractHashDomainRegistry().sourceAuthority, authority);
}

export function confirmationProjectionHash(
  confirmation: Record<string, unknown>
): string {
  return hashDomain(
    requirementsContractHashDomainRegistry().confirmationProjection,
    withoutKeys(confirmation, CONFIRMATION_BOOKKEEPING_FIELDS)
  );
}

export function sourceDocumentHash(source: Record<string, unknown>): string {
  return hashDomain(
    requirementsContractHashDomainRegistry().sourceDocument,
    withoutKeys(source, new Set(['sourceDocumentHash']), true)
  );
}
