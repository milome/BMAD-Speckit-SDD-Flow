import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import {
  type RequirementsContractIntakeReceipt,
  validateRequirementsContractIntakeReceipt,
} from './requirements-contract-intake-receipt';
import {
  type RequirementsContractFileIntakeReceipt,
  validateRequirementsContractFileIntakeReceipt,
} from './requirements-contract-file-intake-receipt';
import { sha256Stable } from './requirements-contract-semantic-resolver';

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

export function validateRequirementsContractIntentLineageLedger(value: unknown): boolean {
  if (
    !schemaValidator()(value) ||
    !isRecord(value) ||
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
