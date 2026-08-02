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

function canonicalJson(value: unknown): string {
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
  return sha256(`${domain}\n${canonicalJson(payload)}`);
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
