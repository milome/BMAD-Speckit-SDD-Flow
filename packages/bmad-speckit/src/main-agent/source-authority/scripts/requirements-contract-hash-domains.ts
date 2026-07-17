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

function normalize(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\r\n?/gu, '\n');
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
    schemaVersion: 'requirements-contract-hash-domains/v1',
    sourceAuthority: 'requirements-source-authority/v1',
    confirmationProjection: 'requirements-confirmation-projection/v1',
    sourceDocument: 'requirements-source-document/v1',
  } as const;
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
