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
  scopeSemanticHash: 'scopeSemanticHash/v2',
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

export function scopeSemanticHash(payload: unknown): string {
  return hashDomain(REQUIREMENTS_AUTHORING_HASH_DOMAINS.scopeSemanticHash, payload);
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
        domain: 'requirements-projection-set/v1',
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
  return canonicalObjectHash(value);
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
