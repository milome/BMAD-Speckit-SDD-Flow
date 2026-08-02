import { readFileSync } from 'node:fs';
import {
  sha256Stable,
  sha256Text,
  type TrustedSourceExtraction,
  type TrustedSourceSnapshot,
} from './requirements-contract-semantic-resolver';
import {
  type InteractionCandidateKind,
  type InteractionResolutionCandidate,
  type UnresolvedInteractionField,
} from './requirements-contract-interaction-resolver';

export interface ProductionInteractionSourceRoot {
  sourceRootId: string;
  rootClass: string;
  bodySchemaVersion: string;
  semanticBody: Record<string, unknown>;
  sourcePath: string;
  sourceContent: string;
  sourceSpan: {
    startLine: number;
    endLine: number;
  };
  authorityClass: string;
}

export interface ProductionInteractionCandidateExtractionResult {
  candidates: InteractionResolutionCandidate[];
  trustedSourceSnapshots: Record<string, TrustedSourceSnapshot>;
  unresolved: UnresolvedInteractionField[];
  extractor: {
    id: 'requirements-contract-production-interaction-candidate-extractor';
    hash: string;
  };
}

interface SupportedInteractionRoot {
  rootClass: string;
  interactionKind: Extract<
    InteractionCandidateKind,
    'participant' | 'step' | 'branch' | 'ordering' | 'temporal'
  >;
}

const SUPPORTED_INTERACTION_ROOTS = new Map<string, SupportedInteractionRoot>([
  [
    'requirements-contract-sequence-participant-root/v1',
    { rootClass: 'sequence_participant', interactionKind: 'participant' },
  ],
  [
    'requirements-contract-sequence-step-root/v1',
    { rootClass: 'sequence_step', interactionKind: 'step' },
  ],
  [
    'requirements-contract-sequence-branch-root/v1',
    { rootClass: 'sequence_branch', interactionKind: 'branch' },
  ],
  [
    'requirements-contract-sequence-ordering-root/v1',
    { rootClass: 'sequence_ordering', interactionKind: 'ordering' },
  ],
  [
    'requirements-contract-sequence-temporal-root/v1',
    { rootClass: 'sequence_temporal', interactionKind: 'temporal' },
  ],
]);
const PARTICIPANT_KINDS = new Set([
  'human_actor',
  'runtime_component',
  'data_store',
  'external_system',
  'queue_or_topic',
]);
const STEP_TYPES = new Set([
  'request',
  'response',
  'command',
  'query',
  'external_call',
  'persistence_read',
  'persistence_write',
  'event_publish',
  'event_consume',
  'state_transition',
  'authorization',
  'retry',
  'compensation',
  'idempotency',
  'user_visible_result',
]);
const SYNTHETIC_PARTICIPANTS = new Set(['user', 'agent', 'record', 'gate']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  );
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = new Set(keys);
  return (
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => expected.has(key))
  );
}

function isNullableNonNegativeInteger(value: unknown): boolean {
  return value === null || (Number.isSafeInteger(value) && Number(value) >= 0);
}

function validParticipant(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, ['id', 'kind', 'label', 'owningSystem', 'requirementRefs']) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.kind) &&
    PARTICIPANT_KINDS.has(value.kind) &&
    isNonEmptyString(value.label) &&
    isNonEmptyString(value.owningSystem) &&
    isStringArray(value.requirementRefs)
  );
}

function validStep(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, [
      'id',
      'order',
      'type',
      'from',
      'to',
      'operation',
      'owningSystem',
      'integrationBoundaryRef',
      'requirementRefs',
    ]) &&
    typeof value.id === 'string' &&
    /^MSG-[0-9]{3}$/u.test(value.id) &&
    Number.isSafeInteger(value.order) &&
    Number(value.order) > 0 &&
    isNonEmptyString(value.type) &&
    STEP_TYPES.has(value.type) &&
    isNonEmptyString(value.from) &&
    isNonEmptyString(value.to) &&
    isNonEmptyString(value.operation) &&
    isNonEmptyString(value.owningSystem) &&
    (value.integrationBoundaryRef === null ||
      isNonEmptyString(value.integrationBoundaryRef)) &&
    isStringArray(value.requirementRefs)
  );
}

function validBranch(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, [
      'id',
      'condition',
      'testScenarioRefs',
      'owningSystem',
      'requirementRefs',
    ]) &&
    typeof value.id === 'string' &&
    /^BR-[0-9]{3}$/u.test(value.id) &&
    isNonEmptyString(value.condition) &&
    isStringArray(value.testScenarioRefs) &&
    isNonEmptyString(value.owningSystem) &&
    isStringArray(value.requirementRefs)
  );
}

function validOrdering(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, [
      'id',
      'before',
      'after',
      'reason',
      'oracleRef',
      'testRefs',
      'owningSystem',
      'requirementRefs',
    ]) &&
    typeof value.id === 'string' &&
    /^ORD-[0-9]{3}$/u.test(value.id) &&
    isNonEmptyString(value.before) &&
    isNonEmptyString(value.after) &&
    value.before !== value.after &&
    isNonEmptyString(value.reason) &&
    isNonEmptyString(value.oracleRef) &&
    isStringArray(value.testRefs) &&
    isNonEmptyString(value.owningSystem) &&
    isStringArray(value.requirementRefs)
  );
}

function validTemporal(value: Record<string, unknown>): boolean {
  return (
    hasExactKeys(value, [
      'id',
      'stepRef',
      'correlationKey',
      'deadlineMs',
      'eventualConsistencyWindowMs',
      'duplicatePolicy',
      'orderingPolicy',
      'oracleRef',
      'testRefs',
      'owningSystem',
      'requirementRefs',
    ]) &&
    typeof value.id === 'string' &&
    /^TMP-[0-9]{3}$/u.test(value.id) &&
    isNonEmptyString(value.stepRef) &&
    isNonEmptyString(value.correlationKey) &&
    isNullableNonNegativeInteger(value.deadlineMs) &&
    isNullableNonNegativeInteger(value.eventualConsistencyWindowMs) &&
    (value.deadlineMs !== null || value.eventualConsistencyWindowMs !== null) &&
    isNonEmptyString(value.duplicatePolicy) &&
    isNonEmptyString(value.orderingPolicy) &&
    isNonEmptyString(value.oracleRef) &&
    isStringArray(value.testRefs) &&
    isNonEmptyString(value.owningSystem) &&
    isStringArray(value.requirementRefs)
  );
}

function validInteractionValue(
  interactionKind: SupportedInteractionRoot['interactionKind'],
  value: Record<string, unknown>
): boolean {
  if (interactionKind === 'participant') return validParticipant(value);
  if (interactionKind === 'step') return validStep(value);
  if (interactionKind === 'branch') return validBranch(value);
  if (interactionKind === 'ordering') return validOrdering(value);
  return validTemporal(value);
}

function isSyntheticParticipant(value: Record<string, unknown>): boolean {
  return [value.id, value.label]
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim().toLowerCase())
    .some((item) => SYNTHETIC_PARTICIPANTS.has(item));
}

function jsonPointerSegment(value: string): string {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1');
}

function exactLineExcerpt(
  content: string,
  startLine: number,
  endLine: number
): string | null {
  const lines: Array<{ body: string; ending: string }> = [];
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/gu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content)) !== null) {
    if (match[0] === '' && pattern.lastIndex === content.length) break;
    lines.push({ body: match[1], ending: match[2] });
    if (match[2] === '') break;
  }
  if (
    !Number.isSafeInteger(startLine) ||
    !Number.isSafeInteger(endLine) ||
    startLine < 1 ||
    endLine < startLine ||
    endLine > lines.length
  ) {
    return null;
  }
  return lines
    .slice(startLine - 1, endLine)
    .map((line, index, selected) => line.body + (index < selected.length - 1 ? line.ending : ''))
    .join('');
}

function unresolved(
  interactionKind: SupportedInteractionRoot['interactionKind'],
  fieldRef: string,
  reasonCode: string
): UnresolvedInteractionField {
  return {
    interactionKind,
    fieldRef,
    blocking: true,
    reasonCode,
  };
}

export function extractProductionInteractionCandidates(input: {
  sourceRoots: ProductionInteractionSourceRoot[];
}): ProductionInteractionCandidateExtractionResult {
  const extractor = {
    id: 'requirements-contract-production-interaction-candidate-extractor' as const,
    hash: sha256Text(readFileSync(__filename, 'utf8')),
  };
  const candidates: InteractionResolutionCandidate[] = [];
  const unresolvedFields: UnresolvedInteractionField[] = [];
  const sourceContentByPath = new Map<string, string>();
  const sourceExtractionsByPath = new Map<string, TrustedSourceExtraction[]>();

  for (const root of input.sourceRoots) {
    const supported = SUPPORTED_INTERACTION_ROOTS.get(root.bodySchemaVersion);
    if (!supported) continue;
    const fieldRef = `/resolvedInteractions/${supported.interactionKind}/${jsonPointerSegment(
      root.sourceRootId
    )}`;
    if (root.rootClass !== supported.rootClass) {
      unresolvedFields.push(
        unresolved(supported.interactionKind, fieldRef, 'interaction_root_class_mismatch')
      );
      continue;
    }
    if (root.authorityClass !== 'source_extracted') {
      unresolvedFields.push(
        unresolved(supported.interactionKind, fieldRef, 'interaction_source_authority_unsupported')
      );
      continue;
    }
    if (!isRecord(root.semanticBody) || !validInteractionValue(supported.interactionKind, root.semanticBody)) {
      unresolvedFields.push(
        unresolved(supported.interactionKind, fieldRef, 'malformed_interaction_source_root')
      );
      continue;
    }
    if (
      supported.interactionKind === 'participant' &&
      isSyntheticParticipant(root.semanticBody)
    ) {
      unresolvedFields.push(
        unresolved(supported.interactionKind, fieldRef, 'synthetic_participant_forbidden')
      );
      continue;
    }
    const excerpt = exactLineExcerpt(
      root.sourceContent,
      root.sourceSpan.startLine,
      root.sourceSpan.endLine
    );
    if (excerpt === null) {
      unresolvedFields.push(
        unresolved(supported.interactionKind, fieldRef, 'interaction_source_span_invalid')
      );
      continue;
    }
    const knownContent = sourceContentByPath.get(root.sourcePath);
    if (knownContent !== undefined && knownContent !== root.sourceContent) {
      throw new Error(`Interaction source path has conflicting content: ${root.sourcePath}`);
    }
    sourceContentByPath.set(root.sourcePath, root.sourceContent);
    const extractionPayload = {
      fieldRef,
      sourceSpan: root.sourceSpan,
      excerptHash: sha256Text(excerpt),
      valueHash: sha256Stable(root.semanticBody),
      parserId: extractor.id,
      parserHash: extractor.hash,
    };
    const extraction = {
      ...extractionPayload,
      observationHash: sha256Stable(extractionPayload),
    };
    sourceExtractionsByPath.set(root.sourcePath, [
      ...(sourceExtractionsByPath.get(root.sourcePath) ?? []),
      extraction,
    ]);
    candidates.push({
      interactionKind: supported.interactionKind,
      resolutionId: `INTERACTION-RESOLUTION-${root.sourceRootId}`,
      fieldRef,
      value: root.semanticBody,
      semanticKind: root.rootClass,
      resolutionAuthorityClass: 'source_extracted',
      premises: [
        {
          kind: 'source',
          sourcePath: root.sourcePath,
          sourceSpan: root.sourceSpan,
          excerpt,
          hash: sha256Text(root.sourceContent),
        },
      ],
      derivationRule: null,
      applicabilityProof: null,
      conflictingCandidates: [],
    });
  }

  const trustedSourceSnapshots: Record<string, TrustedSourceSnapshot> = {};
  for (const [sourcePath, content] of [...sourceContentByPath.entries()].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0
  )) {
    trustedSourceSnapshots[sourcePath] = {
      content,
      hash: sha256Text(content),
      extractions: [...(sourceExtractionsByPath.get(sourcePath) ?? [])].sort((left, right) =>
        left.fieldRef < right.fieldRef ? -1 : left.fieldRef > right.fieldRef ? 1 : 0
      ),
    };
  }

  return {
    candidates,
    trustedSourceSnapshots,
    unresolved: unresolvedFields,
    extractor,
  };
}
