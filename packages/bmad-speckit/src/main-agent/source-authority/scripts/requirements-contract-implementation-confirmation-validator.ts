import Ajv2020, { type AnySchema } from 'ajv/dist/2020.js';
import {
  implementationConfirmationHashFor,
  type ImplementationConfirmation,
} from './requirements-contract-implementation-confirmation-codec';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const IMPLEMENTATION_CONFIRMATION_SCHEMA = require('../schemas/requirements-contract-implementation-confirmation.schema.json') as AnySchema;

export const CONFIRMATION_PROJECTION_RECEIPT_HASH_FIELDS = [
  'sourceDocumentHash',
  'semanticModelHash',
  'implementationConfirmationSchemaHash',
  'implementationConfirmationProjectorHash',
  'implementationConfirmationValidatorHash',
  'implementationConfirmationCodecHash',
  'implementationConfirmationHash',
  'confirmationRenderInputSchemaHash',
  'confirmationRenderInputProjectorHash',
  'renderInputHash',
  'confirmationRendererHash',
  'confirmationPageHash',
] as const;

export type ConfirmationProjectionReceiptBindings = Record<
  (typeof CONFIRMATION_PROJECTION_RECEIPT_HASH_FIELDS)[number],
  string
>;

interface ValidationDecision {
  decision: 'pass' | 'block';
  issues: string[];
}

interface ConfirmationValidationResult {
  structural: ValidationDecision;
  semantic: ValidationDecision;
  promotionDecision: 'pass' | 'block';
}

interface ConfirmationValidationContext {
  sourceDocumentHash: string;
  semanticModelHash: string;
  attemptBindings: {
    transactionId: string;
    implementationAttemptId: string;
    auditAttemptId: string;
  };
  conservation: {
    decision: 'pass';
    sourceDocumentHash: string;
    semanticModelHash: string;
    implementationAttemptId: string;
    receiptRefs: string[];
  };
  auditReconciliation: {
    required: true;
    auditDecision: 'pass';
    reconciliationDecision: 'pass';
    implementationAttemptId: string;
    auditAttemptId: string;
    receiptRefs: string[];
  };
  expectedSets: {
    requirements: string[];
    evidence: string[];
    acceptance: string[];
    traces: string[];
    failures: string[];
    edges: string[];
    targets: string[];
    commands: string[];
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function structuralDecision(value: unknown): ValidationDecision {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addFormat('date-time', (candidate: string) => !Number.isNaN(Date.parse(candidate)));
  const validate = ajv.compile(IMPLEMENTATION_CONFIRMATION_SCHEMA);
  const valid = validate(value);
  return {
    decision: valid ? 'pass' : 'block',
    issues: valid
      ? []
      : (validate.errors ?? []).map((error) => {
          const location = error.instancePath || '/';
          return `${location}:${error.keyword}`;
        }),
  };
}

function exactSet(expected: unknown, actual: unknown): boolean {
  if (
    !Array.isArray(expected) ||
    !Array.isArray(actual) ||
    !expected.every((value) => typeof value === 'string') ||
    !actual.every((value) => typeof value === 'string')
  ) {
    return false;
  }
  return (
    expected.length === actual.length && expected.every((value, index) => value === actual[index])
  );
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string');
}

function semanticDecision(
  confirmation: ImplementationConfirmation,
  context: unknown
): ValidationDecision {
  if (!isRecord(context)) {
    return { decision: 'block', issues: ['confirmation_validation_context_invalid'] };
  }
  const current = context as unknown as ConfirmationValidationContext;
  const issues: string[] = [];

  if (confirmation.sourceDocumentHash !== current.sourceDocumentHash) {
    issues.push('source_document_hash_mismatch');
  }
  if (current.conservation?.decision !== 'pass') {
    issues.push('conservation_not_pass');
  }
  if (current.conservation?.sourceDocumentHash !== current.sourceDocumentHash) {
    issues.push('conservation_source_document_hash_mismatch');
  }
  if (current.conservation?.semanticModelHash !== current.semanticModelHash) {
    issues.push('conservation_semantic_model_hash_mismatch');
  }
  if (
    current.conservation?.implementationAttemptId !==
    current.attemptBindings?.implementationAttemptId
  ) {
    issues.push('conservation_attempt_binding_mismatch');
  }
  if (
    current.auditReconciliation?.required !== true ||
    current.auditReconciliation.auditDecision !== 'pass' ||
    current.auditReconciliation.reconciliationDecision !== 'pass'
  ) {
    issues.push('audit_reconciliation_not_pass');
  }
  if (
    current.auditReconciliation?.implementationAttemptId !==
    current.attemptBindings?.implementationAttemptId
  ) {
    issues.push('audit_reconciliation_attempt_binding_mismatch');
  }
  if (current.auditReconciliation?.auditAttemptId !== current.attemptBindings?.auditAttemptId) {
    issues.push('audit_reconciliation_audit_attempt_binding_mismatch');
  }

  if (
    typeof confirmation.implementationConfirmationHash !== 'string' ||
    confirmation.implementationConfirmationHash !== implementationConfirmationHashFor(confirmation)
  ) {
    issues.push('implementation_confirmation_hash_mismatch');
  }

  const expected = current.expectedSets;
  const setChecks: Array<[string, unknown, unknown]> = [
    ['requirements', expected?.requirements, ids(confirmation.must)],
    ['evidence', expected?.evidence, ids(confirmation.evidence)],
    ['acceptance', expected?.acceptance, ids(confirmation.acceptanceTests)],
    ['traces', expected?.traces, ids(confirmation.traceRows)],
    ['failures', expected?.failures, ids(confirmation.failurePaths)],
    ['edges', expected?.edges, ids(confirmation.edgeCases)],
    ['targets', expected?.targets, ids(confirmation.targetModificationPaths)],
    ['commands', expected?.commands, ids(confirmation.requiredCommands)],
  ];
  for (const [name, expectedIds, actualIds] of setChecks) {
    if (!exactSet(expectedIds, actualIds)) {
      issues.push(`expected_set_mismatch:${name}`);
    }
  }

  return {
    decision: issues.length === 0 ? 'pass' : 'block',
    issues,
  };
}

export function validateRequirementsContractImplementationConfirmation(
  value: unknown,
  context: unknown
): ConfirmationValidationResult {
  const structural = structuralDecision(value);
  const semantic =
    structural.decision === 'pass'
      ? semanticDecision(value as ImplementationConfirmation, context)
      : {
          decision: 'block' as const,
          issues: ['structural_validation_failed'],
        };
  return {
    structural,
    semantic,
    promotionDecision:
      structural.decision === 'pass' && semantic.decision === 'pass' ? 'pass' : 'block',
  };
}

export function validateConfirmationProjectionReceiptBindings(value: unknown): ValidationDecision {
  const issues: string[] = [];
  if (!isRecord(value)) {
    return { decision: 'block', issues: ['confirmation_receipt_bindings_invalid'] };
  }
  for (const field of CONFIRMATION_PROJECTION_RECEIPT_HASH_FIELDS) {
    if (!HASH_PATTERN.test(String(value[field]))) {
      issues.push(`missing_or_invalid_hash:${field}`);
    }
  }
  return {
    decision: issues.length === 0 ? 'pass' : 'block',
    issues,
  };
}
