import { sha256Stable } from './requirements-contract-semantic-resolver';

export type JsonRecord = Record<string, unknown>;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

export class RequirementsContractEvidenceNormalizerError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractEvidenceNormalizerError';
    this.code = code;
  }
}

function fail(code: string): never {
  throw new RequirementsContractEvidenceNormalizerError(code);
}

export function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function requireText(record: JsonRecord, key: string, code = 'field_invalid'): string {
  const value = text(record[key]);
  if (!value) fail(code);
  return value;
}

export function requireHash(record: JsonRecord, key: string, code = 'hash_invalid'): string {
  const value = requireText(record, key, code);
  if (!HASH_PATTERN.test(value)) fail(code);
  return value;
}

export function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(text)
        .filter(Boolean)
    : [];
}

export function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function requireNonEmptyUniqueStrings(
  value: unknown,
  code = 'string_set_invalid'
): string[] {
  const normalized = strings(value);
  if (normalized.length === 0 || new Set(normalized).size !== normalized.length) {
    fail(code);
  }
  return uniqueSorted(normalized);
}

export function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return JSON.stringify(uniqueSorted(left)) === JSON.stringify(uniqueSorted(right));
}

export function stableHash(value: unknown): string {
  return sha256Stable(value);
}

export function assertNoForbiddenKeys(
  value: unknown,
  forbiddenKeys: readonly string[],
  code: string
): void {
  if (Array.isArray(value)) {
    value.forEach((item) => assertNoForbiddenKeys(item, forbiddenKeys, code));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[-_]/gu, '').toLowerCase();
    if (forbiddenKeys.some((forbidden) => normalized.includes(forbidden))) {
      fail(code);
    }
    assertNoForbiddenKeys(child, forbiddenKeys, code);
  }
}

export function canonicalHashList(records: readonly JsonRecord[], hashField: string): string[] {
  return uniqueSorted(records.map((record) => requireHash(record, hashField)));
}
