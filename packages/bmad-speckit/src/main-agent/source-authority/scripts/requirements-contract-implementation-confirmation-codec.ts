import yaml from 'js-yaml';
import {
  isCanonicalJsonValue,
  sha256Stable,
  sha256Text,
  stableStringify,
} from './requirements-contract-semantic-resolver';

export type ImplementationConfirmation = Record<string, unknown>;

export interface ExtractedImplementationConfirmation {
  value: ImplementationConfirmation;
  blockText: string;
  startLine: number;
  endLine: number;
}

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

const PROJECTION_HASH_BOOKKEEPING_FIELDS = new Set(['derivedFromPacketHash', 'projectionStatus']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeValue(value: unknown): unknown {
  if (!isCanonicalJsonValue(value)) {
    throw new Error('implementation_confirmation_non_canonical_value');
  }
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, normalizeValue(value[key])])
  );
}

function stripProjectionHashBookkeeping(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripProjectionHashBookkeeping);
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PROJECTION_HASH_BOOKKEEPING_FIELDS.has(key))
      .map(([key, child]) => [key, stripProjectionHashBookkeeping(child)])
  );
}

function normalizePreConfirmationDrilldownForHash(semantic: Record<string, unknown>): void {
  const drilldown = semantic.preConfirmationDrilldown;
  if (!isRecord(drilldown)) return;

  const normalized = { ...drilldown };
  for (const refKey of ['semanticKernelRef', 'mustDecompositionPacketRef']) {
    const ref = normalized[refKey];
    if (isRecord(ref)) {
      const withoutHash = { ...ref };
      delete withoutHash.hash;
      normalized[refKey] = withoutHash;
    }
  }
  const auditor = normalized.criticalAuditor;
  if (isRecord(auditor)) {
    const withoutReceiptBookkeeping = { ...auditor };
    delete withoutReceiptBookkeeping.consecutiveNoNewGapRounds;
    delete withoutReceiptBookkeeping.latestReceiptHash;
    delete withoutReceiptBookkeeping.convergenceVerdict;
    normalized.criticalAuditor = withoutReceiptBookkeeping;
  }
  semantic.preConfirmationDrilldown = normalized;
}

export function semanticConfirmationForHash(
  confirmation: ImplementationConfirmation
): ImplementationConfirmation {
  const semantic: ImplementationConfirmation = {};
  for (const [key, value] of Object.entries(confirmation)) {
    if (!BOOKKEEPING_FIELDS.has(key)) {
      semantic[key] = stripProjectionHashBookkeeping(value);
    }
  }
  normalizePreConfirmationDrilldownForHash(semantic);
  return semantic;
}

export function implementationConfirmationHashFor(
  confirmation: ImplementationConfirmation
): string {
  return sha256Stable(semanticConfirmationForHash(confirmation));
}

export function sourceDocumentHashFor(
  sourceText: string,
  blockText: string,
  confirmation: ImplementationConfirmation
): string {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256Text(sourceText.replace(blockText, normalizedBlock));
}

export function serializeRequirementsContractImplementationConfirmation(
  value: ImplementationConfirmation
): string {
  const normalized = normalizeValue(value);
  if (!isRecord(normalized)) {
    throw new Error('implementation_confirmation_object_required');
  }
  return yaml.dump(
    { implementationConfirmation: normalized },
    {
      noRefs: true,
      noCompatMode: true,
      lineWidth: -1,
      sortKeys: true,
    }
  );
}

function fenceMarker(line: string): string | null {
  const match = line.match(/^\s{0,3}(`{3,}|~{3,})/u);
  return match ? match[1][0] : null;
}

export function extractRequirementsContractImplementationConfirmation(
  sourceText: string
): ExtractedImplementationConfirmation {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const markerLines: number[] = [];
  let activeFence: string | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = fenceMarker(line);
    if (fence) {
      if (activeFence === null) activeFence = fence;
      else if (activeFence === fence) activeFence = null;
      continue;
    }
    if (/^implementationConfirmation:\s*$/u.test(line)) {
      if (activeFence !== null) {
        throw new Error('implementation_confirmation_fenced_block');
      }
      markerLines.push(index);
    }
  }

  if (markerLines.length === 0) {
    throw new Error('implementation_confirmation_block_missing');
  }
  if (markerLines.length !== 1) {
    throw new Error('implementation_confirmation_duplicate_block');
  }

  const start = markerLines[0];
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line)) {
      end = index;
      break;
    }
  }

  const blockText = lines.slice(start, end).join('\n');
  let parsed: unknown;
  try {
    parsed = yaml.load(blockText, { schema: yaml.JSON_SCHEMA });
  } catch (error) {
    throw new Error(
      `implementation_confirmation_yaml_invalid:${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    !isRecord(parsed) ||
    Object.keys(parsed).length !== 1 ||
    !isRecord(parsed.implementationConfirmation)
  ) {
    throw new Error('implementation_confirmation_block_invalid');
  }

  return {
    value: normalizeValue(parsed.implementationConfirmation) as ImplementationConfirmation,
    blockText,
    startLine: start + 1,
    endLine: end,
  };
}
