import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import {
  type RequirementsContractIntakeReceipt,
  validateRequirementsContractIntakeReceipt,
} from './requirements-contract-intake-receipt';
import {
  createRequirementsContractFileIntakeReceiptV2,
  type RequirementsContractFileIntakeReceipt,
  type RequirementsContractFileIntakeReceiptV2,
  validateRequirementsContractFileIntakeReceipt,
} from './requirements-contract-file-intake-receipt';
import type { RequirementsContentRef } from './requirements-contract-content-store';
import { sourceBytesHash } from './requirements-contract-hash-domains';
import { sha256Stable } from './requirements-contract-semantic-resolver';
import {
  buildUtf8LineIndex,
  lineRangeToByteRange,
  sliceAndHashSourceRange,
} from './requirements-contract-utf8-source-index';

type LineageDisposition = 'source_root' | 'duplicate' | 'superseded' | 'rejected' | 'excluded';

interface ClassificationInputBase {
  spanId: string;
  disposition: LineageDisposition;
  classificationRule: string;
}

interface SourceRootClassificationInput extends ClassificationInputBase {
  disposition: 'source_root';
  sourceRootRefs: string[];
}

interface DuplicateClassificationInput extends ClassificationInputBase {
  disposition: 'duplicate';
  duplicateOfSourceRootRef: string;
  decisionHash: string;
}

interface SupersededClassificationInput extends ClassificationInputBase {
  disposition: 'superseded';
  supersededBySpanId: string;
  decisionHash: string;
}

interface RejectedClassificationInput extends ClassificationInputBase {
  disposition: 'rejected';
  decisionReceiptRef: string;
  decisionHash: string;
}

interface ExcludedClassificationInput extends ClassificationInputBase {
  disposition: 'excluded';
  exclusionRuleRef: string;
  exclusionReason: string;
  decisionHash: string;
}

type ClassificationInput =
  | SourceRootClassificationInput
  | DuplicateClassificationInput
  | SupersededClassificationInput
  | RejectedClassificationInput
  | ExcludedClassificationInput;

export type IntentLineageClassification = ClassificationInput & {
  sourceHash: string;
  classificationHash: string;
};

export interface RequirementsContractIntentLineageLedger {
  schemaVersion: 'requirements-contract-intent-lineage-ledger/v1';
  requirementSetId: string;
  intakeReceiptPath: string;
  intakeReceiptHash: string;
  materialSpanIds: string[];
  classifications: IntentLineageClassification[];
  classificationSetHash: string;
  ledgerHash: string;
}

export interface RequirementsSourceRange {
  startUtf8Byte: number;
  endUtf8ByteExclusive: number;
  startLine: number;
  endLine: number;
  contentHash: string;
}

interface IntentLineageMaterialRootBase {
  sourceRootId: string;
  sourceRange: RequirementsSourceRange;
  semanticNodeRefs: string[];
}

export type IntentLineageMaterialRootV2 =
  | (IntentLineageMaterialRootBase & { disposition: 'source_root' })
  | (IntentLineageMaterialRootBase & {
      disposition: 'duplicate';
      duplicateOfSourceRootRef: string;
    })
  | (IntentLineageMaterialRootBase & {
      disposition: 'superseded';
      supersededBySourceRootRef: string;
    })
  | (IntentLineageMaterialRootBase & {
      disposition: 'rejected';
      decisionReceiptRef: string;
    });

export interface IntentLineageExcludedRange {
  startUtf8Byte: number;
  endUtf8ByteExclusive: number;
  startLine: number;
  endLine: number;
  exclusionRuleRef: string;
  reasonCode: string;
}

export interface RequirementsContractIntentLineageLedgerV2 {
  schemaVersion: 'requirements-contract-intent-lineage-ledger/v2';
  requirementSetId: string;
  sourceId: string;
  sourceBlobRef: RequirementsContentRef;
  materialRoots: IntentLineageMaterialRootV2[];
  excludedRanges: IntentLineageExcludedRange[];
  coverageHash: string;
  ledgerHash: string;
}

interface CreateIntentLineageLedgerInput {
  intakeReceiptPath: string;
  intakeReceipt: RequirementsContractIntakeReceipt | RequirementsContractFileIntakeReceipt;
  classifications: ClassificationInput[];
}

const SCHEMA_FILE = 'requirements-contract-intent-lineage-ledger.schema.json';
const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const DISPOSITIONS = new Set<LineageDisposition>([
  'source_root',
  'duplicate',
  'superseded',
  'rejected',
  'excluded',
]);
let ledgerValidator: ValidateFunction | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => keys.includes(key));
}

function nonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
}

function validHash(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw new Error(`${label} must be a SHA-256 hash`);
  }
}

function uniqueNonEmptyStrings(value: unknown, label: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== 'string' || item.trim().length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw new Error(`${label} must contain unique non-empty strings`);
  }
}

function schemaValidator(): ValidateFunction {
  if (ledgerValidator) return ledgerValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ledgerValidator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return ledgerValidator;
}

function classificationKeys(disposition: LineageDisposition): readonly string[] {
  const base = ['spanId', 'disposition', 'classificationRule'];
  switch (disposition) {
    case 'source_root':
      return [...base, 'sourceRootRefs'];
    case 'duplicate':
      return [...base, 'duplicateOfSourceRootRef', 'decisionHash'];
    case 'superseded':
      return [...base, 'supersededBySpanId', 'decisionHash'];
    case 'rejected':
      return [...base, 'decisionReceiptRef', 'decisionHash'];
    case 'excluded':
      return [...base, 'exclusionRuleRef', 'exclusionReason', 'decisionHash'];
  }
}

function parsedClassification(value: unknown): ClassificationInput {
  if (!isRecord(value) || !DISPOSITIONS.has(value.disposition as LineageDisposition)) {
    throw new Error('Unknown Intent Lineage disposition');
  }
  const disposition = value.disposition as LineageDisposition;
  if (!exactKeys(value, classificationKeys(disposition))) {
    throw new Error('Intent Lineage classification contains mixed or undeclared facts');
  }
  nonEmptyString(value.spanId, 'classification.spanId');
  nonEmptyString(value.classificationRule, 'classification.classificationRule');
  switch (disposition) {
    case 'source_root':
      uniqueNonEmptyStrings(value.sourceRootRefs, 'classification.sourceRootRefs');
      break;
    case 'duplicate':
      nonEmptyString(value.duplicateOfSourceRootRef, 'classification.duplicateOfSourceRootRef');
      validHash(value.decisionHash, 'classification.decisionHash');
      break;
    case 'superseded':
      nonEmptyString(value.supersededBySpanId, 'classification.supersededBySpanId');
      validHash(value.decisionHash, 'classification.decisionHash');
      break;
    case 'rejected':
      nonEmptyString(value.decisionReceiptRef, 'classification.decisionReceiptRef');
      validHash(value.decisionHash, 'classification.decisionHash');
      break;
    case 'excluded':
      nonEmptyString(value.exclusionRuleRef, 'classification.exclusionRuleRef');
      nonEmptyString(value.exclusionReason, 'classification.exclusionReason');
      validHash(value.decisionHash, 'classification.decisionHash');
      break;
  }
  return value as unknown as ClassificationInput;
}

function parsedInput(value: unknown): CreateIntentLineageLedgerInput {
  if (
    !isRecord(value) ||
    !exactKeys(value, ['intakeReceiptPath', 'intakeReceipt', 'classifications']) ||
    !Array.isArray(value.classifications)
  ) {
    throw new Error('Malformed Intent Lineage Ledger input');
  }
  nonEmptyString(value.intakeReceiptPath, 'intakeReceiptPath');
  if (
    !validateRequirementsContractIntakeReceipt(value.intakeReceipt) &&
    !validateRequirementsContractFileIntakeReceipt(value.intakeReceipt)
  ) {
    throw new Error('Intent Lineage requires a valid Intake Receipt');
  }
  return value as unknown as CreateIntentLineageLedgerInput;
}

function materializeClassification(
  input: ClassificationInput,
  sourceHash: string
): IntentLineageClassification {
  const payload = { ...input, sourceHash };
  return {
    ...payload,
    classificationHash: sha256Stable(payload),
  } as IntentLineageClassification;
}

function validateClassificationRelations(classifications: IntentLineageClassification[]): void {
  const spanIds = new Set(classifications.map((row) => row.spanId));
  const sourceRootRefs = new Set(
    classifications.flatMap((row) => row.disposition === 'source_root' ? row.sourceRootRefs : [])
  );
  for (const row of classifications) {
    if (row.disposition === 'duplicate' && !sourceRootRefs.has(row.duplicateOfSourceRootRef)) {
      throw new Error('Duplicate classification references an unknown Source Root');
    }
    if (row.disposition === 'superseded') {
      if (!spanIds.has(row.supersededBySpanId)) {
        throw new Error('Superseded classification references an unknown span');
      }
      if (row.supersededBySpanId === row.spanId) {
        throw new Error('A span cannot be superseded by itself');
      }
    }
  }
}

export function createRequirementsContractIntentLineageLedger(
  inputValue: unknown
): RequirementsContractIntentLineageLedger {
  const input = parsedInput(inputValue);
  const materialSpans = input.intakeReceipt.excerpts.map((excerpt) => ({
    spanId: excerpt.excerptId,
    sourceHash: excerpt.contentHash,
  }));
  const sourceHashBySpanId = new Map(materialSpans.map((span) => [span.spanId, span.sourceHash]));
  const classificationBySpanId = new Map<string, ClassificationInput>();
  for (const value of input.classifications) {
    const classification = parsedClassification(value);
    if (!sourceHashBySpanId.has(classification.spanId)) {
      throw new Error(`Intent Lineage classification references unknown span ${classification.spanId}`);
    }
    if (classificationBySpanId.has(classification.spanId)) {
      throw new Error(`Material span ${classification.spanId} must be classified exactly once`);
    }
    classificationBySpanId.set(classification.spanId, classification);
  }
  const unclassified = materialSpans
    .filter((span) => !classificationBySpanId.has(span.spanId))
    .map((span) => span.spanId);
  if (unclassified.length > 0) {
    throw new Error(`Intent Lineage contains unclassified material spans: ${unclassified.join(', ')}`);
  }
  const classifications = materialSpans.map((span) => {
    const inputClassification = classificationBySpanId.get(span.spanId);
    if (!inputClassification) throw new Error(`Unclassified material span ${span.spanId}`);
    return materializeClassification(inputClassification, span.sourceHash);
  });
  validateClassificationRelations(classifications);
  const payload = {
    schemaVersion: 'requirements-contract-intent-lineage-ledger/v1' as const,
    requirementSetId: input.intakeReceipt.requirementSetId,
    intakeReceiptPath: input.intakeReceiptPath,
    intakeReceiptHash: input.intakeReceipt.receiptHash,
    materialSpanIds: materialSpans.map((span) => span.spanId),
    classifications,
    classificationSetHash: sha256Stable(classifications),
  };
  const ledger = { ...payload, ledgerHash: sha256Stable(payload) };
  if (!validateRequirementsContractIntentLineageLedger(ledger)) {
    throw new Error('Generated Intent Lineage Ledger failed schema or hash validation');
  }
  return ledger;
}

type SourceRangeInput = Omit<RequirementsSourceRange, 'contentHash'> & {
  contentHash?: string;
};

type MaterialRootInput = {
  sourceRootId: string;
  semanticNodeRefs: string[];
  sourceRange: SourceRangeInput;
} & (
  | { disposition: 'source_root' }
  | { disposition: 'duplicate'; duplicateOfSourceRootRef: string }
  | { disposition: 'superseded'; supersededBySourceRootRef: string }
  | { disposition: 'rejected'; decisionReceiptRef: string }
);

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value;
}

function assertRangeCoordinates(
  range: Omit<RequirementsSourceRange, 'contentHash'>,
  sourceByteLength: number
): void {
  if (
    !Number.isSafeInteger(range.startUtf8Byte) ||
    !Number.isSafeInteger(range.endUtf8ByteExclusive) ||
    !Number.isSafeInteger(range.startLine) ||
    !Number.isSafeInteger(range.endLine) ||
    range.startUtf8Byte < 0 ||
    range.endUtf8ByteExclusive <= range.startUtf8Byte ||
    range.endUtf8ByteExclusive > sourceByteLength ||
    range.startLine < 1 ||
    range.endLine < range.startLine
  ) {
    throw new Error('requirements_intent_lineage_range_invalid');
  }
}

function assertUtf8LineRange(
  sourceBytes: Buffer,
  lineIndex: ReturnType<typeof buildUtf8LineIndex>,
  range: Omit<RequirementsSourceRange, 'contentHash'>
): void {
  assertRangeCoordinates(range, sourceBytes.length);
  const exact = lineRangeToByteRange(lineIndex, range.startLine, range.endLine);
  if (
    exact.startUtf8Byte !== range.startUtf8Byte ||
    exact.endUtf8ByteExclusive !== range.endUtf8ByteExclusive
  ) {
    throw new Error('requirements_intent_lineage_UTF-8_range_invalid');
  }
  sliceAndHashSourceRange(sourceBytes, range);
}

export function coalesceIntentLineageRanges(
  ranges: readonly IntentLineageExcludedRange[]
): IntentLineageExcludedRange[] {
  const sorted = ranges.map((range) => ({ ...range })).sort((left, right) =>
    left.startUtf8Byte - right.startUtf8Byte ||
    left.endUtf8ByteExclusive - right.endUtf8ByteExclusive
  );
  const result: IntentLineageExcludedRange[] = [];
  for (const range of sorted) {
    requiredString(range.exclusionRuleRef, 'requirements_intent_lineage_exclusion_rule_invalid');
    requiredString(range.reasonCode, 'requirements_intent_lineage_reason_code_invalid');
    if (result.length === 0) {
      result.push(range);
      continue;
    }
    const previous = result[result.length - 1]!;
    if (range.startUtf8Byte < previous.endUtf8ByteExclusive) {
      throw new Error('requirements_intent_lineage_excluded_range_overlap');
    }
    if (
      range.startUtf8Byte === previous.endUtf8ByteExclusive &&
      range.startLine === previous.endLine + 1 &&
      range.exclusionRuleRef === previous.exclusionRuleRef &&
      range.reasonCode === previous.reasonCode
    ) {
      previous.endUtf8ByteExclusive = range.endUtf8ByteExclusive;
      previous.endLine = range.endLine;
      continue;
    }
    result.push(range);
  }
  return result;
}

export function validateIntentLineageCoverage(input: {
  sourceBytes?: Buffer;
  sourceByteLength?: number;
  materialRanges: readonly SourceRangeInput[];
  excludedRanges: readonly IntentLineageExcludedRange[];
}): void {
  const sourceByteLength = input.sourceBytes?.length ?? input.sourceByteLength;
  if (!Number.isSafeInteger(sourceByteLength) || Number(sourceByteLength) < 1) {
    throw new Error('requirements_intent_lineage_source_length_invalid');
  }
  const byteLength = Number(sourceByteLength);
  const lineIndex = input.sourceBytes ? buildUtf8LineIndex(input.sourceBytes) : null;
  const validateRange = (range: SourceRangeInput | IntentLineageExcludedRange): void => {
    assertRangeCoordinates(range, byteLength);
    if (input.sourceBytes && lineIndex) assertUtf8LineRange(input.sourceBytes, lineIndex, range);
  };
  for (const range of input.materialRanges) validateRange(range);
  for (const range of input.excludedRanges) validateRange(range);

  const materialUnion: Array<{ start: number; end: number; kind: 'material' }> = [];
  const sortedMaterial = input.materialRanges
    .map((range) => ({ start: range.startUtf8Byte, end: range.endUtf8ByteExclusive }))
    .sort((left, right) => left.start - right.start || left.end - right.end);
  for (const range of sortedMaterial) {
    const previous = materialUnion[materialUnion.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      materialUnion.push({ ...range, kind: 'material' });
    }
  }
  const excluded = [...input.excludedRanges]
    .sort((left, right) => left.startUtf8Byte - right.startUtf8Byte)
    .map((range) => ({
      start: range.startUtf8Byte,
      end: range.endUtf8ByteExclusive,
      kind: 'excluded' as const,
    }));
  for (let index = 1; index < excluded.length; index += 1) {
    if (excluded[index]!.start < excluded[index - 1]!.end) {
      throw new Error('requirements_intent_lineage_excluded_range_overlap');
    }
  }

  const coverage = [...materialUnion, ...excluded]
    .sort((left, right) => left.start - right.start || left.end - right.end);
  let cursor = 0;
  for (const segment of coverage) {
    if (segment.start > cursor) throw new Error('requirements_intent_lineage_coverage_gap');
    if (segment.start < cursor) throw new Error('requirements_intent_lineage_coverage_overlap');
    cursor = segment.end;
  }
  if (cursor !== byteLength) throw new Error('requirements_intent_lineage_coverage_gap');
}

export function deriveIntentLineageExcludedRanges(input: {
  sourceBytes: Buffer;
  materialRanges: readonly SourceRangeInput[];
  exclusionRuleRef: string;
  reasonCode: string;
}): IntentLineageExcludedRange[] {
  const lineIndex = buildUtf8LineIndex(input.sourceBytes);
  const materialUnion: Array<{ start: number; end: number }> = [];
  const sortedMaterial = input.materialRanges
    .map((range) => {
      assertUtf8LineRange(input.sourceBytes, lineIndex, range);
      return { start: range.startUtf8Byte, end: range.endUtf8ByteExclusive };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
  for (const range of sortedMaterial) {
    const previous = materialUnion[materialUnion.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      materialUnion.push({ ...range });
    }
  }
  const lineByStartOffset = new Map(
    lineIndex.lineStartOffsets.map((offset, index) => [offset, index + 1])
  );
  const excludedRanges: IntentLineageExcludedRange[] = [];
  let cursor = 0;
  const pushExcluded = (start: number, end: number): void => {
    if (start === end) return;
    const startLine = lineByStartOffset.get(start);
    const endLine = end === input.sourceBytes.length
      ? lineIndex.lineStartOffsets.length
      : lineByStartOffset.get(end) === undefined
        ? undefined
        : Number(lineByStartOffset.get(end)) - 1;
    if (!startLine || !endLine || endLine < startLine) {
      throw new Error('requirements_intent_lineage_excluded_boundary_invalid');
    }
    excludedRanges.push({
      startUtf8Byte: start,
      endUtf8ByteExclusive: end,
      startLine,
      endLine,
      exclusionRuleRef: requiredString(
        input.exclusionRuleRef,
        'requirements_intent_lineage_exclusion_rule_invalid'
      ),
      reasonCode: requiredString(
        input.reasonCode,
        'requirements_intent_lineage_reason_code_invalid'
      ),
    });
  };
  for (const range of materialUnion) {
    pushExcluded(cursor, range.start);
    cursor = range.end;
  }
  pushExcluded(cursor, input.sourceBytes.length);
  return excludedRanges;
}

function materialRootFromInput(
  value: MaterialRootInput,
  receiptRange: RequirementsContractFileIntakeReceiptV2['materialExcerpts'][number]['range'],
  sourceBytes: Buffer
): IntentLineageMaterialRootV2 {
  const sourceRootId = requiredString(
    value.sourceRootId,
    'requirements_intent_lineage_source_root_id_invalid'
  );
  if (!['source_root', 'duplicate', 'superseded', 'rejected'].includes(value.disposition)) {
    throw new Error('requirements_intent_lineage_disposition_invalid');
  }
  if (
    value.sourceRange.startUtf8Byte !== receiptRange.startUtf8Byte ||
    value.sourceRange.endUtf8ByteExclusive !== receiptRange.endUtf8ByteExclusive ||
    value.sourceRange.startLine !== receiptRange.startLine ||
    value.sourceRange.endLine !== receiptRange.endLine
  ) {
    throw new Error(`requirements_intent_lineage_receipt_range_mismatch:${sourceRootId}`);
  }
  const contentHash = sliceAndHashSourceRange(sourceBytes, value.sourceRange);
  if (receiptRange.contentHash !== contentHash) {
    throw new Error(`requirements_intent_lineage_content_hash_mismatch:${sourceRootId}`);
  }
  if (
    !Array.isArray(value.semanticNodeRefs) ||
    value.semanticNodeRefs.some((ref) => typeof ref !== 'string' || !ref.trim()) ||
    new Set(value.semanticNodeRefs).size !== value.semanticNodeRefs.length
  ) {
    throw new Error('requirements_intent_lineage_semantic_node_refs_invalid');
  }
  const base = {
    sourceRootId,
    sourceRange: { ...value.sourceRange, contentHash },
    semanticNodeRefs: [...value.semanticNodeRefs],
  };
  switch (value.disposition) {
    case 'source_root':
      return { ...base, disposition: 'source_root' };
    case 'duplicate':
      return {
        ...base,
        disposition: 'duplicate',
        duplicateOfSourceRootRef: requiredString(
          value.duplicateOfSourceRootRef,
          'requirements_intent_lineage_duplicate_ref_invalid'
        ),
      };
    case 'superseded':
      return {
        ...base,
        disposition: 'superseded',
        supersededBySourceRootRef: requiredString(
          value.supersededBySourceRootRef,
          'requirements_intent_lineage_superseded_ref_invalid'
        ),
      };
    case 'rejected':
      return {
        ...base,
        disposition: 'rejected',
        decisionReceiptRef: requiredString(
          value.decisionReceiptRef,
          'requirements_intent_lineage_decision_ref_invalid'
        ),
      };
  }
}

export function createRequirementsContractIntentLineageLedgerV2(input: {
  receipt: RequirementsContractFileIntakeReceiptV2;
  sourceBytes: Buffer;
  materialRoots: MaterialRootInput[];
  excludedRanges: IntentLineageExcludedRange[];
}): RequirementsContractIntentLineageLedgerV2 {
  if (
    input.receipt.schemaVersion !== 'requirements-contract-file-intake-receipt/v2' ||
    !validateRequirementsContractFileIntakeReceipt(input.receipt)
  ) {
    throw new Error('requirements_intent_lineage_v2_receipt_invalid');
  }
  if (
    !Buffer.isBuffer(input.sourceBytes) ||
    input.sourceBytes.length !== input.receipt.sourceByteLength ||
    sourceBytesHash(input.sourceBytes) !== input.receipt.sourceBytesHash ||
    input.receipt.sourceBlobRef.contentHash !== input.receipt.sourceBytesHash
  ) {
    throw new Error('requirements_intent_lineage_source_binding_invalid');
  }
  const receiptRangeByRootId = new Map(
    input.receipt.materialExcerpts.map((excerpt) => [excerpt.sourceRootId, excerpt.range])
  );
  const materialRoots = input.materialRoots.map((root) => {
    const receiptRange = receiptRangeByRootId.get(root.sourceRootId);
    if (!receiptRange) {
      throw new Error(`requirements_intent_lineage_unknown_source_root:${root.sourceRootId}`);
    }
    return materialRootFromInput(root, receiptRange, input.sourceBytes);
  });
  const rootIds = materialRoots.map((root) => root.sourceRootId);
  if (
    new Set(rootIds).size !== rootIds.length ||
    rootIds.length !== receiptRangeByRootId.size ||
    [...receiptRangeByRootId.keys()].some((sourceRootId) => !rootIds.includes(sourceRootId))
  ) {
    throw new Error('requirements_intent_lineage_material_root_set_mismatch');
  }
  const knownRootIds = new Set(rootIds);
  for (const root of materialRoots) {
    if (
      root.disposition === 'duplicate' &&
      !knownRootIds.has(root.duplicateOfSourceRootRef)
    ) {
      throw new Error('requirements_intent_lineage_duplicate_ref_unknown');
    }
    if (
      root.disposition === 'superseded' &&
      (!knownRootIds.has(root.supersededBySourceRootRef) ||
        root.supersededBySourceRootRef === root.sourceRootId)
    ) {
      throw new Error('requirements_intent_lineage_superseded_ref_unknown');
    }
  }
  const relationEdges = materialRoots.flatMap((root) => {
    if (root.disposition === 'duplicate') return [[root.sourceRootId, root.duplicateOfSourceRootRef]] as const;
    if (root.disposition === 'superseded') return [[root.sourceRootId, root.supersededBySourceRootRef]] as const;
    return [] as const;
  });
  const graph = new Map<string, string[]>(rootIds.map((id) => [id, []]));
  for (const [from, to] of relationEdges) graph.get(from)!.push(to);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new Error('requirements_intent_lineage_relation_cycle');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of rootIds) visit(id);
  const excludedRanges = coalesceIntentLineageRanges(input.excludedRanges);
  validateIntentLineageCoverage({
    sourceBytes: input.sourceBytes,
    materialRanges: materialRoots.map((root) => root.sourceRange),
    excludedRanges,
  });
  const coverageHash = sha256Stable({
    sourceBytesHash: input.receipt.sourceBytesHash,
    materialRanges: materialRoots.map((root) => root.sourceRange),
    excludedRanges,
  });
  const payload = {
    schemaVersion: 'requirements-contract-intent-lineage-ledger/v2' as const,
    requirementSetId: input.receipt.requirementSetId,
    sourceId: input.receipt.sourceId,
    sourceBlobRef: input.receipt.sourceBlobRef,
    materialRoots,
    excludedRanges,
    coverageHash,
  };
  const ledger = { ...payload, ledgerHash: sha256Stable(payload) };
  if (!validateRequirementsContractIntentLineageLedger(ledger)) {
    throw new Error('Generated Intent Lineage Ledger v2 failed schema or hash validation');
  }
  return ledger;
}

function legacyMaterialRootId(spanId: string): string {
  return `LEGACY-${sha256Stable(spanId).slice('sha256:'.length, 'sha256:'.length + 24).toUpperCase()}`;
}

export function migrateIntentLineageV1ToV2(input: {
  recordRoot: string;
  intakeReceipt: RequirementsContractFileIntakeReceipt;
  ledger: RequirementsContractIntentLineageLedger;
}): RequirementsContractIntentLineageLedgerV2 {
  if (
    input.intakeReceipt.schemaVersion !== 'requirements-contract-file-intake-receipt/v1' ||
    !validateRequirementsContractFileIntakeReceipt(input.intakeReceipt) ||
    input.ledger.schemaVersion !== 'requirements-contract-intent-lineage-ledger/v1' ||
    !validateRequirementsContractIntentLineageLedger(input.ledger) ||
    input.ledger.intakeReceiptHash !== input.intakeReceipt.receiptHash
  ) {
    throw new Error('requirements_intent_lineage_v1_migration_requires_verified_ledger');
  }
  const sourceText = input.intakeReceipt.excerpts.map((excerpt) => excerpt.content).join('');
  const sourceBytes = Buffer.from(sourceText, 'utf8');
  const excerptBySpanId = new Map(
    input.intakeReceipt.excerpts.map((excerpt) => [excerpt.excerptId, excerpt])
  );
  const rootIdsBySpanId = new Map<string, string[]>();
  for (const classification of input.ledger.classifications) {
    rootIdsBySpanId.set(
      classification.spanId,
      classification.disposition === 'source_root'
        ? classification.sourceRootRefs
        : classification.disposition === 'excluded'
          ? []
          : [legacyMaterialRootId(classification.spanId)]
    );
  }
  const materialByRootId = new Map<string, {
    sourceRootId: string;
    disposition: IntentLineageMaterialRootV2['disposition'];
    startLine: number;
    endLine: number;
    semanticNodeRefs: string[];
    duplicateOfSourceRootRef?: string;
    supersededBySourceRootRef?: string;
    decisionReceiptRef?: string;
  }>();
  const excludedRanges: IntentLineageExcludedRange[] = [];
  for (const classification of input.ledger.classifications) {
    const excerpt = excerptBySpanId.get(classification.spanId);
    if (!excerpt) throw new Error('requirements_intent_lineage_v1_migration_span_missing');
    const range = {
      startUtf8Byte: excerpt.boundary.startUtf8Byte,
      endUtf8ByteExclusive: excerpt.boundary.endUtf8ByteExclusive,
      startLine: excerpt.boundary.startLine,
      endLine: excerpt.boundary.endLine,
    };
    if (classification.disposition === 'excluded') {
      excludedRanges.push({
        ...range,
        exclusionRuleRef: classification.exclusionRuleRef,
        reasonCode: classification.exclusionReason,
      });
      continue;
    }
    for (const sourceRootId of rootIdsBySpanId.get(classification.spanId) ?? []) {
      const previous = materialByRootId.get(sourceRootId);
      if (previous && range.startLine > previous.endLine + 1) {
        throw new Error('requirements_intent_lineage_v1_migration_noncontiguous_root');
      }
      const base = previous ?? {
        sourceRootId,
        disposition: classification.disposition,
        startLine: range.startLine,
        endLine: range.endLine,
        semanticNodeRefs:
          classification.disposition === 'source_root'
            ? [...classification.sourceRootRefs]
            : [sourceRootId],
      };
      base.startLine = Math.min(base.startLine, range.startLine);
      base.endLine = Math.max(base.endLine, range.endLine);
      if (classification.disposition === 'duplicate') {
        base.duplicateOfSourceRootRef = classification.duplicateOfSourceRootRef;
      } else if (classification.disposition === 'superseded') {
        base.supersededBySourceRootRef =
          rootIdsBySpanId.get(classification.supersededBySpanId)?.[0] ??
          legacyMaterialRootId(classification.supersededBySpanId);
      } else if (classification.disposition === 'rejected') {
        base.decisionReceiptRef = classification.decisionReceiptRef;
      }
      materialByRootId.set(sourceRootId, base);
    }
  }
  const declaredRoots = [...materialByRootId.values()];
  const v2Receipt = createRequirementsContractFileIntakeReceiptV2({
    recordRoot: input.recordRoot,
    requirementSetId: input.intakeReceipt.requirementSetId,
    entrySource: input.intakeReceipt.entrySource,
    requestedArtifactRole: input.intakeReceipt.requestedArtifactRole,
    sourcePath: input.intakeReceipt.sourcePath,
    sourceContent: sourceText,
    materialRoots: declaredRoots.map((root) => ({
      sourceRootId: root.sourceRootId,
      startLine: root.startLine,
      endLine: root.endLine,
    })),
    capturedAt: input.intakeReceipt.capturedAt,
  });
  const rangeByRootId = new Map(
    v2Receipt.materialExcerpts.map((excerpt) => [excerpt.sourceRootId, excerpt.range])
  );
  return createRequirementsContractIntentLineageLedgerV2({
    receipt: v2Receipt,
    sourceBytes,
    materialRoots: declaredRoots.map((root) => ({
      ...root,
      sourceRange: rangeByRootId.get(root.sourceRootId)!,
    })) as MaterialRootInput[],
    excludedRanges,
  });
}

function validateIntentLineageLedgerV2(
  value: Record<string, unknown>
): value is Record<string, unknown> & RequirementsContractIntentLineageLedgerV2 {
  if (
    value.schemaVersion !== 'requirements-contract-intent-lineage-ledger/v2' ||
    !isRecord(value.sourceBlobRef) ||
    !Array.isArray(value.materialRoots) ||
    !Array.isArray(value.excludedRanges)
  ) {
    return false;
  }
  const materialRoots = value.materialRoots as IntentLineageMaterialRootV2[];
  const excludedRanges = value.excludedRanges as IntentLineageExcludedRange[];
  const rootIds = materialRoots.map((root) => root.sourceRootId);
  if (new Set(rootIds).size !== rootIds.length) return false;
  try {
    validateIntentLineageCoverage({
      sourceByteLength: Number(value.sourceBlobRef.byteLength),
      materialRanges: materialRoots.map((root) => root.sourceRange),
      excludedRanges,
    });
  } catch {
    return false;
  }
  const knownRootIds = new Set(rootIds);
  for (const root of materialRoots) {
    if (
      root.disposition === 'duplicate' &&
      !knownRootIds.has(root.duplicateOfSourceRootRef)
    ) {
      return false;
    }
    if (
      root.disposition === 'superseded' &&
      (!knownRootIds.has(root.supersededBySourceRootRef) ||
        root.supersededBySourceRootRef === root.sourceRootId)
    ) {
      return false;
    }
  }
  const relationGraph = new Map<string, string[]>(rootIds.map((id) => [id, []]));
  for (const root of materialRoots) {
    if (root.disposition === 'duplicate') relationGraph.get(root.sourceRootId)!.push(root.duplicateOfSourceRootRef);
    if (root.disposition === 'superseded') relationGraph.get(root.sourceRootId)!.push(root.supersededBySourceRootRef);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    if (!(relationGraph.get(id) ?? []).every(visit)) return false;
    visiting.delete(id);
    visited.add(id);
    return true;
  };
  if (!rootIds.every(visit)) return false;
  const expectedCoverageHash = sha256Stable({
    sourceBytesHash: value.sourceBlobRef.contentHash,
    materialRanges: materialRoots.map((root) => root.sourceRange),
    excludedRanges,
  });
  if (value.coverageHash !== expectedCoverageHash) return false;
  const { ledgerHash, ...payload } = value;
  return ledgerHash === sha256Stable(payload);
}

export function validateRequirementsContractIntentLineageLedger(value: unknown): boolean {
  if (
    !schemaValidator()(value) ||
    !isRecord(value)
  ) {
    return false;
  }
  if (value.schemaVersion === 'requirements-contract-intent-lineage-ledger/v2') {
    return validateIntentLineageLedgerV2(value);
  }
  if (
    !Array.isArray(value.materialSpanIds) ||
    !Array.isArray(value.classifications)
  ) {
    return false;
  }
  const materialSpanIds = value.materialSpanIds as string[];
  const classifications = value.classifications as Array<Record<string, unknown>>;
  if (
    classifications.length !== materialSpanIds.length ||
    classifications.some((row, index) => row.spanId !== materialSpanIds[index])
  ) {
    return false;
  }
  for (const row of classifications) {
    const { classificationHash, ...payload } = row;
    if (classificationHash !== sha256Stable(payload)) return false;
  }
  try {
    validateClassificationRelations(
      classifications as unknown as IntentLineageClassification[]
    );
  } catch {
    return false;
  }
  if (value.classificationSetHash !== sha256Stable(classifications)) return false;
  const { ledgerHash, ...payload } = value;
  return ledgerHash === sha256Stable(payload);
}
