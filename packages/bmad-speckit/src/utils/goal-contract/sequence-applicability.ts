const { createHash } = require('node:crypto');

export type GoalContractSequenceApplicabilityModule = never;

const REQUIRED_SIGNALS = Object.freeze([
  'crossParticipantInteraction',
  'interfaceBoundary',
  'observableOrdering',
  'stateTransition',
  'branchCoverage',
  'boundedRetry',
  'compensation',
  'temporalConstraint',
  'integrationFanIn',
]);
const FORBIDDEN_SEQUENCE_FIELDS = new Set([
  'atomicTasks',
  'taskDag',
  'partitionCount',
  'partitions',
]);
const RECEIPT_FIELDS = new Set([
  'blockingReasons',
  'decision',
  'evidenceRefs',
  'failureClass',
  'freshnessRoot',
  'methodologyProfileHash',
  'policyVersion',
  'producerAvailability',
  'reasonCodes',
  'receiptHash',
  'schemaVersion',
  'semanticModelHash',
  'sourceSnapshotHash',
  'traceGraphHash',
]);
const REQUIRED_RECEIPT_FIELDS = [
  'decision',
  'evidenceRefs',
  'policyVersion',
  'reasonCodes',
  'receiptHash',
  'schemaVersion',
  'semanticModelHash',
  'sourceSnapshotHash',
  'traceGraphHash',
];
const RECEIPT_DECISIONS = new Set([
  'not_applicable_with_proof',
  'required',
  'unresolved',
]);
const PRODUCER_AVAILABILITY = new Set([
  'available',
  'not_applicable',
  'unavailable',
]);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;

type SequenceArchitectureFacts = {
  [key: string]: boolean | string[] | undefined;
  evidenceRefs?: string[];
};

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function decideSequenceApplicability({
  sourceSnapshotHash,
  semanticModelHash,
  traceGraphHash,
  architectureFacts = {},
  policyVersion,
}: {
  sourceSnapshotHash: string;
  semanticModelHash: string;
  traceGraphHash: string;
  architectureFacts?: SequenceArchitectureFacts;
  policyVersion: string;
}) {
  const known = REQUIRED_SIGNALS.filter(
    (key) => typeof architectureFacts[key] === 'boolean'
  );
  const requiredSignals = REQUIRED_SIGNALS.filter(
    (key) => architectureFacts[key] === true
  );
  const evidenceRefs = [...new Set(architectureFacts.evidenceRefs || [])].sort();
  const decision =
    requiredSignals.length > 0
      ? 'required'
      : known.length === REQUIRED_SIGNALS.length && evidenceRefs.length > 0
        ? 'not_applicable_with_proof'
        : 'unresolved';
  const semanticPayload = {
    schemaVersion: 'goal-contract-sequence-applicability-receipt/v1',
    sourceSnapshotHash,
    semanticModelHash,
    traceGraphHash,
    policyVersion,
    decision,
    reasonCodes:
      requiredSignals.length > 0
        ? requiredSignals.map((signal) => `required:${signal}`).sort()
        : decision === 'not_applicable_with_proof'
          ? ['not_applicable:all_required_signals_false']
          : ['unresolved:insufficient_authority'],
    evidenceRefs,
  };
  return deepFreeze({
    ...semanticPayload,
    receiptHash: sha256Text(stableStringify(semanticPayload)),
  });
}

function findForbiddenFields(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_SEQUENCE_FIELDS.has(key)) found.push(key);
    findForbiddenFields(child, found);
  }
  return [...new Set(found)].sort();
}

function isUniqueStringArray(value, minimumLength = 0) {
  return (
    Array.isArray(value) &&
    value.length >= minimumLength &&
    value.every((entry) => typeof entry === 'string' && entry.length > 0) &&
    new Set(value).size === value.length
  );
}

function validateApplicabilityReceiptShape(applicabilityReceipt) {
  if (
    !applicabilityReceipt ||
    typeof applicabilityReceipt !== 'object' ||
    Array.isArray(applicabilityReceipt)
  ) {
    throw failure('sequence_applicability_receipt_schema_invalid', {
      invalidFields: ['$'],
    });
  }
  const invalidFields = [];
  for (const field of REQUIRED_RECEIPT_FIELDS) {
    if (!Object.hasOwn(applicabilityReceipt, field)) invalidFields.push(field);
  }
  for (const field of Object.keys(applicabilityReceipt)) {
    if (!RECEIPT_FIELDS.has(field)) invalidFields.push(field);
  }
  if (
    applicabilityReceipt.schemaVersion !==
    'goal-contract-sequence-applicability-receipt/v1'
  ) {
    invalidFields.push('schemaVersion');
  }
  for (const field of [
    'sourceSnapshotHash',
    'semanticModelHash',
    'traceGraphHash',
    'receiptHash',
  ]) {
    if (!SHA256_PATTERN.test(applicabilityReceipt[field] || '')) {
      invalidFields.push(field);
    }
  }
  if (
    applicabilityReceipt.methodologyProfileHash !== undefined &&
    !SHA256_PATTERN.test(applicabilityReceipt.methodologyProfileHash)
  ) {
    invalidFields.push('methodologyProfileHash');
  }
  if (
    typeof applicabilityReceipt.policyVersion !== 'string' ||
    applicabilityReceipt.policyVersion.length === 0
  ) {
    invalidFields.push('policyVersion');
  }
  if (!RECEIPT_DECISIONS.has(applicabilityReceipt.decision)) {
    invalidFields.push('decision');
  }
  if (!isUniqueStringArray(applicabilityReceipt.reasonCodes, 1)) {
    invalidFields.push('reasonCodes');
  }
  if (!isUniqueStringArray(applicabilityReceipt.evidenceRefs)) {
    invalidFields.push('evidenceRefs');
  }
  if (
    applicabilityReceipt.producerAvailability !== undefined &&
    !PRODUCER_AVAILABILITY.has(applicabilityReceipt.producerAvailability)
  ) {
    invalidFields.push('producerAvailability');
  }
  for (const field of ['failureClass', 'freshnessRoot']) {
    if (
      applicabilityReceipt[field] !== undefined &&
      (typeof applicabilityReceipt[field] !== 'string' ||
        applicabilityReceipt[field].length === 0)
    ) {
      invalidFields.push(field);
    }
  }
  if (
    applicabilityReceipt.blockingReasons !== undefined &&
    !isUniqueStringArray(applicabilityReceipt.blockingReasons)
  ) {
    invalidFields.push('blockingReasons');
  }
  if (invalidFields.length > 0) {
    throw failure('sequence_applicability_receipt_schema_invalid', {
      invalidFields: [...new Set(invalidFields)].sort(),
    });
  }
}

function validateApplicabilityReceiptHash(applicabilityReceipt) {
  const semanticPayload = Object.fromEntries(
    Object.entries(applicabilityReceipt).filter(
      ([field]) => field !== 'receiptHash'
    )
  );
  const expectedReceiptHash = sha256Text(stableStringify(semanticPayload));
  if (applicabilityReceipt.receiptHash !== expectedReceiptHash) {
    throw failure('sequence_applicability_receipt_hash_mismatch', {
      actualReceiptHash: applicabilityReceipt.receiptHash,
      expectedReceiptHash,
    });
  }
}

function validateApplicabilityReceiptRoots(
  applicabilityReceipt,
  {
    currentSourceSnapshotHash,
    currentSemanticModelHash,
    currentTraceGraphHash,
    currentPolicyVersion,
  }
) {
  const currentRoots = {
    sourceSnapshotHash: currentSourceSnapshotHash,
    semanticModelHash: currentSemanticModelHash,
    traceGraphHash: currentTraceGraphHash,
    policyVersion: currentPolicyVersion,
  };
  const invalidFields = Object.entries(currentRoots)
    .filter(([field, value]) =>
      field === 'policyVersion'
        ? typeof value !== 'string' || value.length === 0
        : !SHA256_PATTERN.test(value || '')
    )
    .map(([field]) => field)
    .sort();
  if (invalidFields.length > 0) {
    throw failure('sequence_applicability_current_roots_invalid', {
      invalidFields,
    });
  }
  const staleFields = Object.entries(currentRoots)
    .filter(([field, value]) => applicabilityReceipt[field] !== value)
    .map(([field]) => field)
    .sort();
  if (staleFields.length > 0) {
    throw failure('sequence_applicability_receipt_root_mismatch', {
      staleFields,
    });
  }
}

function validateSequenceConstraintInput({
  applicabilityReceipt,
  producerAvailable,
  sequenceConstraintInput,
  expectedSequenceContractHash = null,
  currentSourceSnapshotHash,
  currentSemanticModelHash,
  currentTraceGraphHash,
  currentPolicyVersion,
}) {
  validateApplicabilityReceiptShape(applicabilityReceipt);
  if (
    applicabilityReceipt?.decision === 'not_applicable_with_proof' &&
    applicabilityReceipt.evidenceRefs?.length === 0
  ) {
    throw failure('sequence_non_applicability_proof_incomplete');
  }
  validateApplicabilityReceiptHash(applicabilityReceipt);
  validateApplicabilityReceiptRoots(applicabilityReceipt, {
    currentSourceSnapshotHash,
    currentSemanticModelHash,
    currentTraceGraphHash,
    currentPolicyVersion,
  });
  if (applicabilityReceipt?.decision === 'unresolved') {
    throw failure('sequence_applicability_unresolved');
  }
  if (applicabilityReceipt?.decision === 'not_applicable_with_proof') {
    return null;
  }
  if (applicabilityReceipt?.decision !== 'required' || !producerAvailable) {
    throw failure('sequence_closure_required_unavailable');
  }
  if (!sequenceConstraintInput) {
    throw failure('sequence_closure_required_unavailable');
  }
  const forbiddenFields = findForbiddenFields(sequenceConstraintInput);
  if (forbiddenFields.length > 0) {
    throw failure('sequence_second_task_universe_forbidden', {
      forbiddenFields,
    });
  }
  const staleFields = [
    'sourceSnapshotHash',
    'semanticModelHash',
    'traceGraphHash',
  ].filter(
    (field) =>
      sequenceConstraintInput[field] !== applicabilityReceipt[field]
  );
  if (
    expectedSequenceContractHash &&
    sequenceConstraintInput.sequenceContractHash !== expectedSequenceContractHash
  ) {
    staleFields.push('sequenceContractHash');
  }
  if (staleFields.length > 0) {
    throw failure('sequence_constraint_hash_mismatch', { staleFields });
  }
  return deepFreeze(structuredClone(sequenceConstraintInput));
}

module.exports = {
  REQUIRED_SIGNALS,
  decideSequenceApplicability,
  validateSequenceConstraintInput,
};
