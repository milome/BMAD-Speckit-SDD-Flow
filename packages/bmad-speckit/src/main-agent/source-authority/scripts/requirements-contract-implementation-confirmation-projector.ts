import { isCanonicalJsonValue } from './requirements-contract-semantic-resolver';
import {
  implementationConfirmationHashFor,
  type ImplementationConfirmation,
} from './requirements-contract-implementation-confirmation-codec';

type AuthorityClass =
  | 'source_grounded'
  | 'rule_derived'
  | 'repository_derived'
  | 'policy_inherited'
  | 'human_confirmed';

export interface ConfirmationProjectionContext {
  mode: 'confirmation-ready';
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

interface ProvenanceRow {
  fieldRef: string;
  authorityClass: AuthorityClass;
  provenanceRefs: string[];
  decisionReceiptRef: string | null;
}

export const CONFIRMATION_PROJECTION_CONTRACT = {
  schemaVersion: 'confirmation-projection-contract/v1',
  identity: 'CLOSED_BY_AMEND_13',
  authority: 'none',
  members: [
    {
      assetId: 'implementation_confirmation_schema',
      role: 'implementation_confirmation_schema',
      path: 'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-contract-implementation-confirmation.schema.json',
      assetKind: 'schema',
      authority: 'deterministic_contract',
    },
    {
      assetId: 'implementation_confirmation_projector',
      role: 'implementation_confirmation_projector',
      path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-projector.ts',
      assetKind: 'projector',
      authority: 'none',
    },
    {
      assetId: 'confirmation_render_input_schema',
      role: 'confirmation_render_input_schema',
      path: 'packages/bmad-speckit/src/main-agent/source-authority/schemas/requirements-confirmation-render-input-v2.schema.json',
      assetKind: 'schema',
      authority: 'deterministic_contract',
    },
    {
      assetId: 'confirmation_renderer',
      role: 'confirmation_renderer',
      path: '_bmad/skills/requirements-contract-authoring/scripts/render-requirements-confirmation-html.ts',
      assetKind: 'renderer',
      authority: 'none',
    },
    {
      assetId: 'implementation_confirmation_reference',
      role: 'implementation_confirmation_reference',
      path: '_bmad/skills/requirements-contract-authoring/references/implementation-confirmation-reference.md',
      assetKind: 'reference',
      authority: 'none',
    },
  ],
  supportingAssets: [
    {
      assetId: 'implementation_confirmation_validator',
      role: 'implementation_confirmation_validator',
      path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-validator.ts',
      assetKind: 'validator',
      authority: 'deterministic_contract',
    },
    {
      assetId: 'implementation_confirmation_codec',
      role: 'implementation_confirmation_codec',
      path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-implementation-confirmation-codec.ts',
      assetKind: 'codec',
      authority: 'deterministic_contract',
    },
    {
      assetId: 'confirmation_render_input_projector',
      role: 'confirmation_render_input_projector',
      path: 'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-render-input.ts',
      assetKind: 'projector',
      authority: 'none',
    },
    {
      assetId: 'confirmation_renderer_specification',
      role: 'confirmation_renderer_specification',
      path: '_bmad/skills/requirements-contract-authoring/references/html-confirmation-renderer-spec.md',
      assetKind: 'reference',
      authority: 'none',
    },
  ],
} as const;

export const REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS = [
  'status',
  'entryFlow',
  'entryFlowClass',
  'workflowAdapter',
  'contractAuthoringRequired',
  'confirmationLanguage',
  'confirmationProfile',
  'requiredViewPacks',
  'optionalViewPacks',
  'confirmedAt',
  'confirmedBy',
  'confirmationRender',
  'preConfirmationDrilldown',
  'applicability',
  'must',
  'notDone',
  'mustNot',
  'evidence',
  'openQuestions',
  'failurePaths',
  'edgeCases',
  'acceptanceTests',
  'e2eSuites',
  'traceRows',
  'sequenceViews',
  'flowViews',
  'edgeCaseViews',
  'boundaryViews',
  'targetModificationPaths',
  'requirementBoundary',
  'artifactAutomationPlan',
  'requiredCommands',
  'suggestedCommands',
  'requiredContractChecks',
  'implementationTasks',
  'closeoutReadinessPreview',
] as const;

export const CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS = [
  'governanceEventTypeRegistryPolicy',
  'governanceEventTypeRegistry',
  'controlledIngestWriterRegistry',
  'activeRequirementResolution',
  'functionalResumeFailureCaseRegistry',
  'scoringDashboardSft',
  'scriptsAndHooks',
  'currentTargetMap',
  'aiTddContractExecutionManifestProjection',
] as const;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const AUTHORITY_CLASSES = new Set<AuthorityClass>([
  'source_grounded',
  'rule_derived',
  'repository_derived',
  'policy_inherited',
  'human_confirmed',
]);
const INPUT_KEYS = [
  'mode',
  'source',
  'semanticIr',
  'provenance',
  'decisionReceipts',
  'context',
] as const;
const EXPECTED_SET_KEYS = [
  'requirements',
  'evidence',
  'acceptance',
  'traces',
  'failures',
  'edges',
  'targets',
  'commands',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return (
    keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) &&
    Object.keys(value).every((key) => keys.includes(key))
  );
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function uniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(nonEmpty) && new Set(value).size === value.length;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function projectionError(code: string): never {
  throw new Error(code);
}

function parseContext(value: unknown): ConfirmationProjectionContext {
  if (
    !isRecord(value) ||
    !exactKeys(value, [
      'mode',
      'sourceDocumentHash',
      'semanticModelHash',
      'attemptBindings',
      'conservation',
      'auditReconciliation',
      'expectedSets',
    ]) ||
    value.mode !== 'confirmation-ready' ||
    !HASH_PATTERN.test(String(value.sourceDocumentHash)) ||
    !HASH_PATTERN.test(String(value.semanticModelHash)) ||
    !isRecord(value.attemptBindings) ||
    !exactKeys(value.attemptBindings, [
      'transactionId',
      'implementationAttemptId',
      'auditAttemptId',
    ]) ||
    !Object.values(value.attemptBindings).every(nonEmpty) ||
    !isRecord(value.conservation) ||
    !exactKeys(value.conservation, [
      'decision',
      'sourceDocumentHash',
      'semanticModelHash',
      'implementationAttemptId',
      'receiptRefs',
    ]) ||
    value.conservation.decision !== 'pass' ||
    !HASH_PATTERN.test(String(value.conservation.sourceDocumentHash)) ||
    !HASH_PATTERN.test(String(value.conservation.semanticModelHash)) ||
    !nonEmpty(value.conservation.implementationAttemptId) ||
    !uniqueStrings(value.conservation.receiptRefs) ||
    value.conservation.receiptRefs.length === 0 ||
    !isRecord(value.auditReconciliation) ||
    !exactKeys(value.auditReconciliation, [
      'required',
      'auditDecision',
      'reconciliationDecision',
      'implementationAttemptId',
      'auditAttemptId',
      'receiptRefs',
    ]) ||
    value.auditReconciliation.required !== true ||
    value.auditReconciliation.auditDecision !== 'pass' ||
    value.auditReconciliation.reconciliationDecision !== 'pass' ||
    !nonEmpty(value.auditReconciliation.implementationAttemptId) ||
    !nonEmpty(value.auditReconciliation.auditAttemptId) ||
    !uniqueStrings(value.auditReconciliation.receiptRefs) ||
    value.auditReconciliation.receiptRefs.length === 0 ||
    !isRecord(value.expectedSets) ||
    !exactKeys(value.expectedSets, EXPECTED_SET_KEYS) ||
    !EXPECTED_SET_KEYS.every((key) => uniqueStrings(value.expectedSets[key]))
  ) {
    projectionError('confirmation_projection_context_invalid');
  }
  return value as unknown as ConfirmationProjectionContext;
}

export function validateRequirementsContractConfirmationProjectionContext(
  value: unknown
): value is ConfirmationProjectionContext {
  try {
    parseContext(value);
    return true;
  } catch {
    return false;
  }
}

function receiptRefs(decisionReceipts: unknown[]): Set<string> {
  const refs = new Set<string>();
  for (const receipt of decisionReceipts) {
    if (!isRecord(receipt) || !isCanonicalJsonValue(receipt)) {
      projectionError('confirmation_projection_decision_receipt_invalid');
    }
    for (const key of ['receiptRef', 'decisionReceiptRef', 'receiptId', 'id']) {
      if (nonEmpty(receipt[key])) refs.add(receipt[key]);
    }
  }
  return refs;
}

function parseSemanticFields(value: unknown): Map<string, unknown> {
  if (!Array.isArray(value)) {
    projectionError('confirmation_projection_semantic_fields_invalid');
  }
  const result = new Map<string, unknown>();
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ['fieldRef', 'value']) ||
      !nonEmpty(entry.fieldRef) ||
      !isCanonicalJsonValue(entry.value)
    ) {
      projectionError('confirmation_projection_semantic_field_invalid');
    }
    if (result.has(entry.fieldRef)) {
      projectionError(`duplicate_semantic_value:${entry.fieldRef}`);
    }
    result.set(entry.fieldRef, entry.value);
  }
  return result;
}

function parseProvenance(
  value: unknown,
  knownReceiptRefs: Set<string>
): Map<string, ProvenanceRow> {
  if (!Array.isArray(value)) {
    projectionError('confirmation_projection_provenance_invalid');
  }
  const result = new Map<string, ProvenanceRow>();
  for (const entry of value) {
    if (
      !isRecord(entry) ||
      !exactKeys(entry, ['fieldRef', 'authorityClass', 'provenanceRefs', 'decisionReceiptRef']) ||
      !nonEmpty(entry.fieldRef) ||
      !AUTHORITY_CLASSES.has(entry.authorityClass as AuthorityClass) ||
      !uniqueStrings(entry.provenanceRefs) ||
      entry.provenanceRefs.length === 0 ||
      !(entry.decisionReceiptRef === null || nonEmpty(entry.decisionReceiptRef))
    ) {
      projectionError('confirmation_projection_provenance_row_invalid');
    }
    if (nonEmpty(entry.decisionReceiptRef) && !knownReceiptRefs.has(entry.decisionReceiptRef)) {
      projectionError(`decision_receipt_not_found:${entry.decisionReceiptRef}`);
    }
    if (result.has(entry.fieldRef)) {
      projectionError(`duplicate_provenance:${entry.fieldRef}`);
    }
    result.set(entry.fieldRef, entry as unknown as ProvenanceRow);
  }
  return result;
}

function applies(value: unknown, domain: string): boolean {
  return isRecord(value) && isRecord(value[domain]) && value[domain].applies === true;
}

function runtimeRegistryRequired(value: unknown): boolean {
  return (
    isRecord(value) &&
    isRecord(value.runtimeRecovery) &&
    value.runtimeRecovery.requiresFunctionalResumeFailureCaseRegistry === true
  );
}

function conditionalFieldPolicy(applicability: unknown): Map<string, boolean> {
  const governance = applies(applicability, 'governanceEvents');
  const runtime = applies(applicability, 'runtimeRecovery');
  return new Map<string, boolean>([
    ['governanceEventTypeRegistryPolicy', governance],
    ['governanceEventTypeRegistry', governance],
    ['controlledIngestWriterRegistry', governance],
    ['activeRequirementResolution', runtime],
    ['functionalResumeFailureCaseRegistry', runtime || runtimeRegistryRequired(applicability)],
    ['scoringDashboardSft', applies(applicability, 'scoringDashboardSft')],
    ['scriptsAndHooks', applies(applicability, 'scriptsAndHooks')],
    ['currentTargetMap', applies(applicability, 'currentTargetMap')],
    ['aiTddContractExecutionManifestProjection', applies(applicability, 'aiTddContractGate')],
  ]);
}

export function projectRequirementsContractImplementationConfirmation(
  inputValue: unknown
): ImplementationConfirmation {
  if (!isRecord(inputValue) || !exactKeys(inputValue, INPUT_KEYS)) {
    projectionError('confirmation_projection_input_invalid');
  }
  if (inputValue.mode !== 'confirmation-ready') {
    projectionError('confirmation_projection_mode_invalid');
  }
  if (
    !isRecord(inputValue.source) ||
    !exactKeys(inputValue.source, ['recordId', 'requirementSetId', 'sourceDocumentHash']) ||
    !nonEmpty(inputValue.source.recordId) ||
    !nonEmpty(inputValue.source.requirementSetId) ||
    !HASH_PATTERN.test(String(inputValue.source.sourceDocumentHash))
  ) {
    projectionError('confirmation_projection_source_invalid');
  }
  if (
    !isRecord(inputValue.semanticIr) ||
    !exactKeys(inputValue.semanticIr, ['semanticModelHash', 'fields']) ||
    !HASH_PATTERN.test(String(inputValue.semanticIr.semanticModelHash))
  ) {
    projectionError('confirmation_projection_semantic_ir_invalid');
  }
  if (!Array.isArray(inputValue.decisionReceipts)) {
    projectionError('confirmation_projection_decision_receipts_invalid');
  }

  const context = parseContext(inputValue.context);
  if (
    context.sourceDocumentHash !== inputValue.source.sourceDocumentHash ||
    context.semanticModelHash !== inputValue.semanticIr.semanticModelHash ||
    context.conservation.sourceDocumentHash !== context.sourceDocumentHash ||
    context.conservation.semanticModelHash !== context.semanticModelHash ||
    context.conservation.implementationAttemptId !==
      context.attemptBindings.implementationAttemptId ||
    context.auditReconciliation.implementationAttemptId !==
      context.attemptBindings.implementationAttemptId ||
    context.auditReconciliation.auditAttemptId !== context.attemptBindings.auditAttemptId
  ) {
    projectionError('confirmation_projection_upstream_binding_mismatch');
  }

  const knownReceiptRefs = receiptRefs(inputValue.decisionReceipts);
  const fields = parseSemanticFields(inputValue.semanticIr.fields);
  const provenance = parseProvenance(inputValue.provenance, knownReceiptRefs);
  const allowedFields = new Set<string>([
    ...REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS,
    ...CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS,
  ]);
  for (const fieldRef of fields.keys()) {
    if (!allowedFields.has(fieldRef)) {
      projectionError(`unauthorized_semantic_value:${fieldRef}`);
    }
  }
  for (const fieldRef of REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS) {
    if (!fields.has(fieldRef)) {
      projectionError(`missing_required_semantic_value:${fieldRef}`);
    }
  }
  for (const fieldRef of provenance.keys()) {
    if (!allowedFields.has(fieldRef)) {
      projectionError(`unauthorized_provenance:${fieldRef}`);
    }
  }

  for (const fieldRef of REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS) {
    if (!provenance.has(fieldRef)) {
      projectionError(`missing_required_provenance:${fieldRef}`);
    }
  }

  const policy = conditionalFieldPolicy(fields.get('applicability'));
  for (const fieldRef of CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS) {
    const required = policy.get(fieldRef) === true;
    if (required && !fields.has(fieldRef)) {
      projectionError(`missing_required_semantic_value:${fieldRef}`);
    }
    if (required && !provenance.has(fieldRef)) {
      projectionError(`missing_required_provenance:${fieldRef}`);
    }
    if (!required && (fields.has(fieldRef) || provenance.has(fieldRef))) {
      projectionError(`inapplicable_semantic_value:${fieldRef}`);
    }
  }
  if (fields.size !== provenance.size) {
    projectionError('confirmation_projection_field_provenance_bijection_failed');
  }

  const projected: ImplementationConfirmation = {
    contractSchemaVersion: 1,
    recordId: inputValue.source.recordId,
    requirementSetId: inputValue.source.requirementSetId,
    sourceDocumentHash: inputValue.source.sourceDocumentHash,
  };
  for (const fieldRef of REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS) {
    projected[fieldRef] = clone(fields.get(fieldRef));
  }
  for (const fieldRef of CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS) {
    if (fields.has(fieldRef)) projected[fieldRef] = clone(fields.get(fieldRef));
  }
  projected.implementationConfirmationHash = implementationConfirmationHashFor(projected);
  return projected;
}
