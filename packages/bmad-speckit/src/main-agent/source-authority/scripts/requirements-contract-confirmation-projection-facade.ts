import {
  extractRequirementsContractImplementationConfirmation,
  serializeRequirementsContractImplementationConfirmation,
  type ImplementationConfirmation,
} from './requirements-contract-implementation-confirmation-codec';
import {
  CONFIRMATION_PROJECTION_CONTRACT,
  CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS,
  projectRequirementsContractImplementationConfirmation,
  REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS,
} from './requirements-contract-implementation-confirmation-projector';
import {
  validateRequirementsContractImplementationConfirmation,
} from './requirements-contract-implementation-confirmation-validator';
import {
  sha256Stable,
  sha256Text,
  stableStringify,
} from './requirements-contract-semantic-resolver';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const IDENTITY_FIELDS = new Set([
  'contractSchemaVersion',
  'recordId',
  'requirementSetId',
  'sourceDocumentHash',
  'implementationConfirmationHash',
]);
const STAGING_ONLY_FIELDS = new Set([
  'outOfScope',
  'mustExecutionDecompositionMatrix',
  'atomicImplementationTaskList',
  'mustToAtomicTaskMap',
  'atomicTaskToTraceMap',
  'atomicTaskToAcceptanceMap',
  'atomicTaskToEvidenceMap',
  'atomicTaskToTargetPathMap',
  'atomicTaskToCommandMap',
  'acceptanceCriteria',
  'e2eScenarios',
  'businessViews',
  'architectureImpacts',
]);
const CANONICAL_FIELDS = new Set([
  ...REQUIRED_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS,
  ...CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS,
]);
const CONFIRMATION_SCHEMA = require('../schemas/requirements-contract-implementation-confirmation.schema.json') as Record<
  string,
  unknown
>;
const ROW_ARRAY_FIELDS = new Set([
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
  'requiredCommands',
  'suggestedCommands',
  'requiredContractChecks',
  'implementationTasks',
]);
const MERGEABLE_TEXT_FIELDS = new Set(['oracle', 'text', 'assertion', 'expectedBehavior']);

export type ExpectedSets = {
  requirements: string[];
  evidence: string[];
  acceptance: string[];
  traces: string[];
  failures: string[];
  edges: string[];
  targets: string[];
  commands: string[];
};

export interface ProductionImplementationConfirmationProjectionInput {
  source: {
    recordId: string;
    requirementSetId: string;
    sourceDocumentHash: string;
  };
  semanticModelHash: string;
  confirmation: ImplementationConfirmation;
  decisionReceipts: Record<string, unknown>[];
  attemptBindings: {
    transactionId: string;
    implementationAttemptId: string;
    auditAttemptId: string;
  };
  expectedSets: ExpectedSets;
  conservationReceiptRefs: string[];
  auditReceiptRefs: string[];
}

export interface ProductionImplementationConfirmationProjectionResult {
  confirmation: ImplementationConfirmation;
  serializedConfirmation: string;
  projectionReceipt: Record<string, unknown>;
}

export function expectedSetsFromConfirmation(
  confirmation: ImplementationConfirmation
): ExpectedSets {
  const ids = (field: string): string[] =>
    Array.isArray(confirmation[field])
      ? confirmation[field]
          .filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
          )
          .map((entry) => text(entry.id))
          .filter(Boolean)
          .filter((id, index, values) => values.indexOf(id) === index)
      : [];
  return {
    requirements: ids('must'),
    evidence: ids('evidence'),
    acceptance: ids('acceptanceTests'),
    traces: ids('traceRows'),
    failures: ids('failurePaths'),
    edges: ids('edgeCases'),
    targets: ids('targetModificationPaths'),
    commands: ids('requiredCommands'),
  };
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nonEmptyStrings(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0) &&
    new Set(value).size === value.length
  );
}

function assertHash(value: string, label: string): void {
  if (!HASH_PATTERN.test(value)) {
    throw new Error(`confirmation_projection_${label}_invalid`);
  }
}

function assertAttemptBindings(
  value: ProductionImplementationConfirmationProjectionInput['attemptBindings']
): void {
  if (
    !text(value.transactionId) ||
    !text(value.implementationAttemptId) ||
    !text(value.auditAttemptId)
  ) {
    throw new Error('confirmation_projection_attempt_bindings_invalid');
  }
}

function decisionReceiptReference(receipt: Record<string, unknown>): string {
  for (const field of ['receiptRef', 'decisionReceiptRef', 'receiptId', 'id', 'receiptHash']) {
    const value = text(receipt[field]);
    if (value) return value;
  }
  return '';
}

function normalizeDecisionReceipts(
  receipts: Record<string, unknown>[]
): Array<Record<string, unknown> & { receiptId: string }> {
  if (!Array.isArray(receipts) || receipts.length === 0) {
    throw new Error('confirmation_projection_decision_receipts_required');
  }
  return receipts.map((receipt, index) => {
    if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
      throw new Error('confirmation_projection_decision_receipt_invalid');
    }
    const receiptId = decisionReceiptReference(receipt);
    if (!receiptId) {
      throw new Error(`confirmation_projection_decision_receipt_reference_missing:${index}`);
    }
    return { ...receipt, receiptId };
  });
}

function recordObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function mergeUniqueArrayValues(left: unknown[], right: unknown[]): unknown[] {
  const merged: unknown[] = [];
  for (const value of [...left, ...right]) {
    if (!merged.some((candidate) => stableStringify(candidate) === stableStringify(value))) {
      merged.push(value);
    }
  }
  return merged;
}

function mergeDuplicateRows(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  const rows = value.filter((row) => row && typeof row === 'object' && !Array.isArray(row));
  if (rows.length !== value.length || !rows.some((row) => text(row.id))) {
    return value;
  }
  const mergedById = new Map<string, Record<string, unknown>>();
  for (const row of rows as Record<string, unknown>[]) {
    const id = text(row.id);
    const existing = mergedById.get(id);
    if (!existing) {
      mergedById.set(id, { ...row });
      continue;
    }
    for (const [key, nextValue] of Object.entries(row)) {
      if (key === 'id' || nextValue === undefined) continue;
      const previousValue = existing[key];
      if (Array.isArray(previousValue) && Array.isArray(nextValue)) {
        existing[key] = mergeUniqueArrayValues(previousValue, nextValue);
      } else if (
        MERGEABLE_TEXT_FIELDS.has(key) &&
        typeof previousValue === 'string' &&
        typeof nextValue === 'string' &&
        previousValue !== nextValue
      ) {
        existing[key] = `${previousValue} | ${nextValue}`;
      } else if (previousValue === undefined || previousValue === null) {
        existing[key] = nextValue;
      }
    }
  }
  return [...mergedById.values()];
}

function normalizeStagingConfirmation(
  confirmation: ImplementationConfirmation
): ImplementationConfirmation {
  const normalized = structuredClone(confirmation);
  if (
    !Array.isArray(normalized.implementationTasks) &&
    Array.isArray(normalized.atomicImplementationTaskList)
  ) {
    normalized.implementationTasks = normalized.atomicImplementationTaskList.map((row) => {
      const source = recordObject(row);
      const requirementRef = text(source.derivedFromMustRef);
      return {
        id: text(source.id),
        title: text(source.title) || text(source.text),
        requirementRefs: requirementRef ? [requirementRef] : [],
        targetPaths: stringArray(source.targetFiles),
        traceRefs: stringArray(source.traceRows),
        evidenceRefs: stringArray(source.evidenceRefs),
      };
    });
  }
  const currentTargetMap = recordObject(normalized.currentTargetMap);
  if (
    Object.prototype.hasOwnProperty.call(normalized, 'currentTargetMap') &&
    !Array.isArray(currentTargetMap.pathRegistry)
  ) {
    const artifactPaths = Array.isArray(currentTargetMap.artifactPaths)
      ? currentTargetMap.artifactPaths.map(recordObject)
      : [];
    currentTargetMap.pathRegistry = artifactPaths.map((source, index) => ({
      id: `CT-PATH-${String(index + 1).padStart(3, '0')}`,
      category: 'source_authorized_target',
      fixedPath: text(source.path),
      sourceOfTruthRole: 'implementation',
      description: text(source.targetRole) || 'Source-authorized implementation target.',
      traceRows: stringArray(source.traceRows),
      evidenceRefs: stringArray(source.evidenceRefs),
    }));
    normalized.currentTargetMap = currentTargetMap;
  }
  const aiTddProjection = recordObject(normalized.aiTddContractExecutionManifestProjection);
  if (
    Object.prototype.hasOwnProperty.call(normalized, 'aiTddContractExecutionManifestProjection') &&
    aiTddProjection.applies === true
  ) {
    const tasks = Array.isArray(normalized.implementationTasks)
      ? normalized.implementationTasks.map(recordObject)
      : [];
    const traces = Array.isArray(normalized.traceRows)
      ? normalized.traceRows.map(recordObject)
      : [];
    const commands = Array.isArray(normalized.requiredCommands)
      ? normalized.requiredCommands.map(recordObject)
      : [];
    const targets = Array.isArray(normalized.targetModificationPaths)
      ? normalized.targetModificationPaths.map(recordObject)
      : [];
    const evidence = Array.isArray(normalized.evidence)
      ? normalized.evidence.map(recordObject)
      : [];
    const failurePaths = Array.isArray(normalized.failurePaths)
      ? normalized.failurePaths.map(recordObject)
      : [];
    const acceptanceTests = Array.isArray(normalized.acceptanceTests)
      ? normalized.acceptanceTests.map(recordObject)
      : [];
    const sequenceViews = Array.isArray(normalized.sequenceViews)
      ? normalized.sequenceViews.map(recordObject)
      : [];
    const currentMap = recordObject(normalized.currentTargetMap);
    const canonicalArtifacts = Array.isArray(currentMap.canonicalArtifacts)
      ? currentMap.canonicalArtifacts.map(recordObject)
      : [];
    const existingArtifacts = Array.isArray(currentMap.existingArtifacts)
      ? currentMap.existingArtifacts.map(recordObject)
      : [];
    normalized.aiTddContractExecutionManifestProjection = {
      schemaVersion:
        text(aiTddProjection.schemaVersion) ||
        'ai-tdd-contract-execution-manifest-projection/v1',
      applies: true,
      requiredSections: stringArray(aiTddProjection.requiredSections),
      atomicImplementationTaskLineage: tasks.map((task) => ({
        taskId: text(task.id),
        requirementRefs: stringArray(task.requirementRefs),
        traceRefs: stringArray(task.traceRefs),
      })),
      errorCaseCoverage: failurePaths.map((failure) => ({
        failurePathRef: text(failure.id),
        negRefs: stringArray(failure.linkedNegIds),
        acceptanceRefs: acceptanceTests
          .filter((acceptance) => stringArray(acceptance.covers).some((id) =>
            stringArray(failure.linkedNegIds).includes(id)
          ))
          .map((acceptance) => text(acceptance.id)),
        viewRefs: sequenceViews
          .filter((view) => stringArray(view.covers).some((id) =>
            stringArray(failure.linkedNegIds).includes(id)
          ))
          .map((view) => text(view.id)),
      })),
      commandTargets: commands.map((command) => ({
        commandRef: text(command.id),
        targetFiles: stringArray(command.targetFiles).length
          ? stringArray(command.targetFiles)
          : targets.map((target) => text(target.path)).filter(Boolean),
        traceRefs: stringArray(command.traceRows),
        evidenceRefs: stringArray(command.evidenceRefs),
      })),
      traceClosure: traces.map((trace) => ({
        traceRef: text(trace.id),
        acceptanceRefs: stringArray(trace.acceptanceRefs),
      })),
      canonicalSurfaces: canonicalArtifacts.map((artifact) => ({
        artifactRef: text(artifact.id),
        traceRefs: stringArray(artifact.traceRows),
        evidenceRefs: stringArray(artifact.evidenceRefs),
      })),
      legacyDenial: existingArtifacts.map((artifact) => ({
        legacyRef: text(artifact.id),
        policy:
          text(artifact.completionProofPolicy) ||
          text(artifact.targetTreatment) ||
          'not_a_canonical_completion_authority',
        evidenceRefs: stringArray(artifact.evidenceRefs),
      })),
      closeoutProof: [
        {
          proofRef: 'CLOSEOUT-001',
          requiredCommands: commands.map((command) => text(command.id)),
        },
      ],
      evidenceTrustStates: evidence.map((row) => ({
        evidenceRef: text(row.id),
        oracle: text(row.oracle) || text(row.text),
        commandRefs: stringArray(row.requiredCommandRefs),
      })),
    };
  }
  for (const fieldRef of ROW_ARRAY_FIELDS) {
    if (fieldRef in normalized) {
      normalized[fieldRef] = mergeDuplicateRows(normalized[fieldRef]);
    }
  }
  for (const [fieldRef, defaultValue] of [
    ['acceptanceTests', 'acceptance'],
    ['e2eSuites', 'e2e'],
  ] as const) {
    if (Array.isArray(normalized[fieldRef])) {
      for (const row of normalized[fieldRef] as unknown[]) {
        const normalizedRow = recordObject(row);
        if (!text(normalizedRow.suiteType)) normalizedRow.suiteType = defaultValue;
      }
    }
  }
  if (Array.isArray(normalized.traceRows)) {
    for (const row of normalized.traceRows as unknown[]) {
      const traceRow = recordObject(row);
      if (!Object.prototype.hasOwnProperty.call(traceRow, 'blockingReason')) {
        traceRow.blockingReason = null;
      }
    }
  }
  return normalized;
}

function uniqueStrings(value: string[]): string[] {
  return [...new Set(value)];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
    : [];
}

function schemaRef(root: Record<string, unknown>, ref: string): Record<string, unknown> {
  if (!ref.startsWith('#/')) return {};
  let current: unknown = root;
  for (const segment of ref.slice(2).split('/')) {
    current = recordObject(current)[segment.replace(/~1/gu, '/').replace(/~0/gu, '~')];
  }
  return recordObject(current);
}

function schemaAccepts(
  value: unknown,
  schema: Record<string, unknown>,
  root: Record<string, unknown>
): boolean {
  const resolved = schema.$ref ? schemaRef(root, String(schema.$ref)) : schema;
  if (Array.isArray(resolved.oneOf)) {
    return resolved.oneOf.some((candidate) =>
      schemaAccepts(value, recordObject(candidate), root)
    );
  }
  if (Array.isArray(resolved.anyOf)) {
    return resolved.anyOf.some((candidate) =>
      schemaAccepts(value, recordObject(candidate), root)
    );
  }
  if (Object.prototype.hasOwnProperty.call(resolved, 'const')) {
    return stableStringify(value) === stableStringify(resolved.const);
  }
  if (Array.isArray(resolved.enum) && !resolved.enum.includes(value)) return false;
  const type = resolved.type;
  if (type === 'null') return value === null;
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return true;
}

function projectValueBySchema(
  value: unknown,
  schemaValue: unknown,
  root: Record<string, unknown>
): unknown {
  const rawSchema = recordObject(schemaValue);
  const schema = rawSchema.$ref ? schemaRef(root, String(rawSchema.$ref)) : rawSchema;
  if (Array.isArray(schema.oneOf)) {
    const candidate = schema.oneOf
      .map((entry) => recordObject(entry))
      .find((entry) => schemaAccepts(value, entry, root));
    return candidate ? projectValueBySchema(value, candidate, root) : value;
  }
  if (Array.isArray(schema.anyOf)) {
    const candidate = schema.anyOf
      .map((entry) => recordObject(entry))
      .find((entry) => schemaAccepts(value, entry, root));
    return candidate ? projectValueBySchema(value, candidate, root) : value;
  }
  if (Array.isArray(schema.allOf)) {
    const baseSchema = { ...schema };
    delete baseSchema.allOf;
    return projectValueBySchema(value, baseSchema, root);
  }
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const properties = recordObject(schema.properties);
    const additionalProperties = schema.additionalProperties;
    const projected: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (Object.prototype.hasOwnProperty.call(properties, key)) {
        const next = projectValueBySchema(child, properties[key], root);
        if (next !== undefined) projected[key] = next;
      } else if (additionalProperties === true) {
        projected[key] = child;
      } else if (additionalProperties && typeof additionalProperties === 'object') {
        const next = projectValueBySchema(child, additionalProperties, root);
        if (next !== undefined) projected[key] = next;
      }
    }
    return projected;
  }
  if (schema.type === 'array' && Array.isArray(value)) {
    const items = schema.items;
    const projected = items
      ? value.map((entry) => projectValueBySchema(entry, items, root))
      : value;
    if (
      schema.uniqueItems === true &&
      projected.every((entry) => typeof entry === 'string')
    ) {
      return [...new Set(projected)];
    }
    return projected;
  }
  if (schema.type && !schemaAccepts(value, schema, root)) {
    return undefined;
  }
  return value;
}

function canonicalTargetChangeType(value: unknown): string {
  const normalized = text(value).toLowerCase().replace(/-/gu, '_');
  if (
    ['code', 'test', 'schema', 'reference', 'configuration'].includes(normalized)
  ) {
    return normalized;
  }
  if (['modify', 'add', 'create', 'delete', 'remove', 'update', 'replace'].includes(normalized)) {
    return 'code';
  }
  if (['validate', 'validation', 'validation_only'].includes(normalized)) {
    return 'test';
  }
  if (['generated', 'output', 'generated_output', 'runtime', 'runtime_output'].includes(normalized)) {
    return 'reference';
  }
  return text(value);
}

function projectConfirmationToCanonicalSchema(
  confirmation: ImplementationConfirmation
): ImplementationConfirmation {
  const normalized = structuredClone(confirmation);
  if (Array.isArray(normalized.targetModificationPaths)) {
    normalized.targetModificationPaths = normalized.targetModificationPaths.map((row) => {
      const target = recordObject(row);
      return {
        ...target,
        changeType: canonicalTargetChangeType(target.changeType),
      };
    });
  }
  return recordObject(projectValueBySchema(normalized, CONFIRMATION_SCHEMA, CONFIRMATION_SCHEMA));
}

function semanticFields(confirmation: ImplementationConfirmation): {
  fields: Array<{ fieldRef: string; value: unknown }>;
  stagingOnlyFields: string[];
  omittedInapplicableFields: string[];
} {
  const fields: Array<{ fieldRef: string; value: unknown }> = [];
  const stagingOnlyFields: string[] = [];
  const omittedInapplicableFields: string[] = [];
  const applicability = recordObject(confirmation.applicability);
  const fieldDomains: Record<string, string> = {
    governanceEventTypeRegistryPolicy: 'governanceEvents',
    governanceEventTypeRegistry: 'governanceEvents',
    controlledIngestWriterRegistry: 'governanceEvents',
    activeRequirementResolution: 'runtimeRecovery',
    functionalResumeFailureCaseRegistry: 'runtimeRecovery',
    scoringDashboardSft: 'scoringDashboardSft',
    scriptsAndHooks: 'scriptsAndHooks',
    currentTargetMap: 'currentTargetMap',
    aiTddContractExecutionManifestProjection: 'aiTddContractGate',
  };
  const conditionalApplies = (fieldRef: string): boolean => {
    const domain = recordObject(applicability[fieldDomains[fieldRef]]);
    if (fieldRef === 'functionalResumeFailureCaseRegistry') {
      return (
        domain.applies === true ||
        recordObject(applicability.runtimeRecovery)
          .requiresFunctionalResumeFailureCaseRegistry === true
      );
    }
    return domain.applies === true;
  };

  for (const [fieldRef, value] of Object.entries(confirmation)) {
    if (IDENTITY_FIELDS.has(fieldRef)) continue;
    if (STAGING_ONLY_FIELDS.has(fieldRef)) {
      stagingOnlyFields.push(fieldRef);
      continue;
    }
    if (!CANONICAL_FIELDS.has(fieldRef)) {
      throw new Error(`confirmation_projection_undeclared_field:${fieldRef}`);
    }
    if (
      (CONDITIONAL_IMPLEMENTATION_CONFIRMATION_SEMANTIC_FIELDS as readonly string[]).includes(
        fieldRef
      ) &&
      !conditionalApplies(fieldRef)
    ) {
      omittedInapplicableFields.push(fieldRef);
      continue;
    }
    fields.push({ fieldRef, value });
  }

  if (
    Object.prototype.hasOwnProperty.call(confirmation, 'outOfScope') &&
    stableStringify(confirmation.outOfScope) !== stableStringify(confirmation.mustNot)
  ) {
    throw new Error('confirmation_projection_out_of_scope_alias_mismatch');
  }

  return {
    fields,
    stagingOnlyFields: stagingOnlyFields.sort(),
    omittedInapplicableFields: omittedInapplicableFields.sort(),
  };
}

function buildProjectionContext(
  input: ProductionImplementationConfirmationProjectionInput
): Record<string, unknown> {
  return {
    mode: 'confirmation-ready',
    sourceDocumentHash: input.source.sourceDocumentHash,
    semanticModelHash: input.semanticModelHash,
    attemptBindings: input.attemptBindings,
    conservation: {
      decision: 'pass',
      sourceDocumentHash: input.source.sourceDocumentHash,
      semanticModelHash: input.semanticModelHash,
      implementationAttemptId: input.attemptBindings.implementationAttemptId,
      receiptRefs: input.conservationReceiptRefs,
    },
    auditReconciliation: {
      required: true,
      auditDecision: 'pass',
      reconciliationDecision: 'pass',
      implementationAttemptId: input.attemptBindings.implementationAttemptId,
      auditAttemptId: input.attemptBindings.auditAttemptId,
      receiptRefs: input.auditReceiptRefs,
    },
    expectedSets: Object.fromEntries(
      Object.entries(input.expectedSets).map(([key, value]) => [key, uniqueStrings(value)])
    ),
  };
}

export function projectProductionImplementationConfirmation(
  input: ProductionImplementationConfirmationProjectionInput
): ProductionImplementationConfirmationProjectionResult {
  assertHash(input.source.sourceDocumentHash, 'source_document_hash');
  assertHash(input.semanticModelHash, 'semantic_model_hash');
  if (!text(input.source.recordId) || !text(input.source.requirementSetId)) {
    throw new Error('confirmation_projection_source_identity_invalid');
  }
  assertAttemptBindings(input.attemptBindings);
  if (
    !nonEmptyStrings(input.conservationReceiptRefs) ||
    !nonEmptyStrings(input.auditReceiptRefs)
  ) {
    throw new Error('confirmation_projection_receipt_bindings_invalid');
  }

  const decisionReceipts = normalizeDecisionReceipts(input.decisionReceipts);
  const receiptRefs = new Set(decisionReceipts.map((receipt) => receipt.receiptId));
  for (const receiptRef of [
    ...input.conservationReceiptRefs,
    ...input.auditReceiptRefs,
  ]) {
    if (!receiptRefs.has(receiptRef)) {
      throw new Error(`confirmation_projection_receipt_not_found:${receiptRef}`);
    }
  }

  const normalizedConfirmation = normalizeStagingConfirmation(input.confirmation);
  const stagingProjection = semanticFields(normalizedConfirmation);
  const canonicalConfirmation = projectConfirmationToCanonicalSchema(normalizedConfirmation);
  const semanticProjection = semanticFields(canonicalConfirmation);
  const fields = semanticProjection.fields;
  const primaryReceiptRef = decisionReceipts[0].receiptId;
  const context = buildProjectionContext(input);
  const projected = projectRequirementsContractImplementationConfirmation({
    mode: 'confirmation-ready',
    source: input.source,
    semanticIr: {
      semanticModelHash: input.semanticModelHash,
      fields,
    },
    provenance: fields.map(({ fieldRef }) => ({
      fieldRef,
      authorityClass: 'rule_derived',
      provenanceRefs: [
        `canonical-semantic-ir:${input.semanticModelHash}:${fieldRef}`,
      ],
      decisionReceiptRef: primaryReceiptRef,
    })),
    decisionReceipts,
    context,
  });
  const validation = validateRequirementsContractImplementationConfirmation(
    projected,
    context
  );
  if (validation.promotionDecision !== 'pass') {
    throw new Error(
      `confirmation_projection_validation_blocked:${[
        ...validation.structural.issues,
        ...validation.semantic.issues,
      ].join(',')}`
    );
  }

  const serializedConfirmation =
    serializeRequirementsContractImplementationConfirmation(projected);
  const roundTrip = extractRequirementsContractImplementationConfirmation(
    serializedConfirmation
  ).value;
  if (stableStringify(roundTrip) !== stableStringify(projected)) {
    throw new Error('confirmation_projection_codec_round_trip_failed');
  }

  const receiptPreimage = {
    schemaVersion: 'requirements-contract-confirmation-projection-receipt/v1',
    projectionRecipeVersion: CONFIRMATION_PROJECTION_CONTRACT.schemaVersion,
    projectorId: 'requirements-contract-implementation-confirmation-projector',
    validatorId: 'requirements-contract-implementation-confirmation-validator',
    codecId: 'requirements-contract-implementation-confirmation-codec',
    validationDecision: 'pass',
    sourceDocumentHash: input.source.sourceDocumentHash,
    semanticModelHash: input.semanticModelHash,
    implementationConfirmationHash: projected.implementationConfirmationHash,
    projectionContextHash: sha256Stable(context),
    decisionReceiptSetHash: sha256Stable(
      decisionReceipts.map((receipt) => receipt.receiptId).sort()
    ),
    serializedConfirmationHash: sha256Text(serializedConfirmation),
    stagingEnvelopeHash: sha256Stable({
      stagingOnlyFields: stagingProjection.stagingOnlyFields.map((fieldRef) => ({
        fieldRef,
        value: input.confirmation[fieldRef],
      })),
      omittedInapplicableFields: semanticProjection.omittedInapplicableFields,
    }),
    attemptBindings: input.attemptBindings,
    stagingOnlyFields: stagingProjection.stagingOnlyFields,
    omittedInapplicableFields: semanticProjection.omittedInapplicableFields,
  };
  return {
    confirmation: projected,
    serializedConfirmation,
    projectionReceipt: {
      ...receiptPreimage,
      projectionReceiptHash: sha256Stable(receiptPreimage),
    },
  };
}
