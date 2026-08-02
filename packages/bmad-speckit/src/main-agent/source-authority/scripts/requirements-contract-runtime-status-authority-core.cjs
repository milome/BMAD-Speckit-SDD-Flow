const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

const SIX_MODEL_IDS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
];
const SCHEMA_FILE = 'requirements-contract-runtime-status-decision-receipt.schema.json';
let receiptValidator = null;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function sha256Stable(value) {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function schemaValidator() {
  if (receiptValidator) return receiptValidator;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  receiptValidator = ajv.compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return receiptValidator;
}

function validateRuntimeStatusDecisionReceipt(value) {
  if (!schemaValidator()(value) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const { receiptHash, ...payload } = value;
  return receiptHash === sha256Stable(payload);
}

function createRuntimeStatusDecisionReceipt(input) {
  const payload = {
    schemaVersion: 'requirements-contract-runtime-status-decision-receipt/v1',
    ...input,
  };
  const receipt = {
    ...payload,
    receiptHash: sha256Stable(payload),
  };
  if (!validateRuntimeStatusDecisionReceipt(receipt)) {
    const validate = schemaValidator();
    validate(receipt);
    throw new Error(
      `Runtime status decision receipt is invalid: ${JSON.stringify(validate.errors || [])}`
    );
  }
  return receipt;
}

function text(value) {
  return String(value ?? '').trim();
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function projectionFor(record, modelId) {
  return object(object(record.sixModelResults)?.[modelId]);
}

function receiptRefsFromRecord(record) {
  if (!Array.isArray(record.runtimeStatusDecisionReceipts)) return [];
  return record.runtimeStatusDecisionReceipts
    .map((entry) => object(entry))
    .filter(Boolean)
    .map((entry) => ({ path: text(entry.path), receipt: entry.receipt }))
    .filter((entry) => entry.path.length > 0);
}

function artifactBindingBlockers(record, receiptPath, receipt) {
  if (!Array.isArray(record.artifactIndex)) return ['runtime_status_artifact_index_missing'];
  const artifacts = record.artifactIndex.map((entry) => object(entry)).filter(Boolean);
  const recordId = text(record.recordId);
  const requirementSetId = text(record.requirementSetId);
  const blockers = [];
  const bindings = [
    {
      path: receiptPath,
      hash: receipt.receiptHash,
      missing: 'runtime_status_receipt_artifact_missing',
      duplicate: 'runtime_status_receipt_artifact_duplicate',
      mismatch: 'runtime_status_receipt_artifact_hash_mismatch',
    },
    ...[...receipt.stageInputs, ...receipt.deterministicGateOutputs].map((binding) => ({
      path: binding.path,
      hash: binding.hash,
      missing: `runtime_status_bound_artifact_missing:${binding.path}`,
      duplicate: `runtime_status_bound_artifact_duplicate:${binding.path}`,
      mismatch: `runtime_status_bound_artifact_hash_mismatch:${binding.path}`,
    })),
  ];

  for (const binding of bindings) {
    const matches = artifacts.filter((artifact) => text(artifact.path) === binding.path);
    if (matches.length === 0) {
      blockers.push(binding.missing);
      continue;
    }
    if (matches.length !== 1) {
      blockers.push(binding.duplicate);
      continue;
    }
    const artifact = matches[0];
    const artifactHash = text(artifact.contentHash) || text(artifact.hash);
    if (
      artifactHash !== binding.hash ||
      text(artifact.status) !== 'active' ||
      (text(artifact.recordId) && text(artifact.recordId) !== recordId) ||
      (text(artifact.requirementSetId) &&
        text(artifact.requirementSetId) !== requirementSetId)
    ) {
      blockers.push(binding.mismatch);
    }
  }
  return [...new Set(blockers)];
}

function missingStatus(input) {
  return {
    schemaVersion: 'requirements-contract-verified-six-model-status/v1',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    modelId: input.modelId,
    effectiveStatus: 'not_established',
    projectionStatus: input.projectionStatus,
    projectionIntegrity: input.integrity || 'missing',
    authorityClass: null,
    decisionReceiptRef: null,
    decisionReceiptHash: null,
    currentAttemptId: input.currentAttemptId,
    blockerRefs: [input.blocker],
    evidenceRefs: [],
  };
}

function bindingMismatch(receipt, record, currentAttemptId, modelId) {
  const mismatches = [];
  if (receipt.modelId !== modelId) mismatches.push('runtime_status_receipt_model_mismatch');
  if (receipt.recordId !== text(record.recordId)) {
    mismatches.push('runtime_status_receipt_record_mismatch');
  }
  if (receipt.requirementSetId !== text(record.requirementSetId)) {
    mismatches.push('runtime_status_receipt_requirement_set_mismatch');
  }
  if (receipt.sourceDocumentHash !== text(record.sourceDocumentHash)) {
    mismatches.push('runtime_status_receipt_source_hash_mismatch');
  }
  if (receipt.implementationConfirmationHash !== text(record.implementationConfirmationHash)) {
    mismatches.push('runtime_status_receipt_confirmation_hash_mismatch');
  }
  if (receipt.semanticModelHash !== text(record.semanticModelHash)) {
    mismatches.push('runtime_status_receipt_semantic_model_hash_mismatch');
  }
  if (receipt.implementationAttemptId !== currentAttemptId) {
    mismatches.push('runtime_status_receipt_attempt_stale');
  }
  return mismatches;
}

function resolveVerifiedSixModelStatus(input) {
  const record = input.record || {};
  const recordId = text(record.recordId) || 'requirement-record';
  const requirementSetId = text(record.requirementSetId) || recordId;
  const currentAttemptId = text(input.currentImplementationAttemptId);
  const projection = projectionFor(record, input.modelId);
  const projectionStatus = projection ? text(projection.status) || null : null;
  if (!projection) {
    return missingStatus({
      recordId,
      requirementSetId,
      modelId: input.modelId,
      projectionStatus,
      currentAttemptId,
      blocker: 'six_model_projection_missing',
    });
  }

  const receiptPath = text(projection.decisionReceiptRef);
  const receiptHash = text(projection.decisionReceiptHash);
  const refs = input.decisionReceipts || receiptRefsFromRecord(record);
  const matchingRef = refs.find((entry) => entry.path === receiptPath);
  if (!receiptPath || !receiptHash || !matchingRef) {
    return missingStatus({
      recordId,
      requirementSetId,
      modelId: input.modelId,
      projectionStatus,
      currentAttemptId,
      blocker: 'runtime_status_decision_receipt_missing',
    });
  }
  if (!validateRuntimeStatusDecisionReceipt(matchingRef.receipt)) {
    return missingStatus({
      recordId,
      requirementSetId,
      modelId: input.modelId,
      projectionStatus,
      currentAttemptId,
      blocker: 'runtime_status_decision_receipt_invalid',
      integrity: 'invalid',
    });
  }

  const receipt = matchingRef.receipt;
  const artifactBlockers = artifactBindingBlockers(record, receiptPath, receipt);
  if (artifactBlockers.length > 0) {
    return {
      schemaVersion: 'requirements-contract-verified-six-model-status/v1',
      recordId,
      requirementSetId,
      modelId: input.modelId,
      effectiveStatus: 'blocked',
      projectionStatus,
      projectionIntegrity: 'invalid',
      authorityClass: null,
      decisionReceiptRef: receiptPath,
      decisionReceiptHash: receipt.receiptHash,
      currentAttemptId,
      blockerRefs: artifactBlockers,
      evidenceRefs: [],
    };
  }
  const mismatches = bindingMismatch(receipt, record, currentAttemptId, input.modelId);
  if (mismatches.includes('runtime_status_receipt_attempt_stale')) {
    return {
      schemaVersion: 'requirements-contract-verified-six-model-status/v1',
      recordId,
      requirementSetId,
      modelId: input.modelId,
      effectiveStatus: 'stale',
      projectionStatus,
      projectionIntegrity: 'stale',
      authorityClass: receipt.authorityClass,
      decisionReceiptRef: receiptPath,
      decisionReceiptHash: receipt.receiptHash,
      currentAttemptId,
      blockerRefs: mismatches,
      evidenceRefs: receipt.evidenceRefs,
    };
  }

  const projectionMismatches = [
    ...(receipt.receiptHash !== receiptHash
      ? ['runtime_status_projection_receipt_hash_mismatch']
      : []),
    ...(text(projection.currentAttemptId) !== currentAttemptId
      ? ['runtime_status_projection_attempt_mismatch']
      : []),
    ...(text(projection.sourceDocumentHash) !== receipt.sourceDocumentHash
      ? ['runtime_status_projection_source_hash_mismatch']
      : []),
    ...(text(projection.implementationConfirmationHash) !==
    receipt.implementationConfirmationHash
      ? ['runtime_status_projection_confirmation_hash_mismatch']
      : []),
    ...(text(projection.semanticModelHash) !== receipt.semanticModelHash
      ? ['runtime_status_projection_semantic_model_hash_mismatch']
      : []),
    ...(projectionStatus !== receipt.effectiveStatus
      ? ['runtime_status_projection_decision_mismatch']
      : []),
  ];
  if (mismatches.length > 0 || projectionMismatches.length > 0) {
    return {
      schemaVersion: 'requirements-contract-verified-six-model-status/v1',
      recordId,
      requirementSetId,
      modelId: input.modelId,
      effectiveStatus: receipt.decision === 'stale' ? 'stale' : 'blocked',
      projectionStatus,
      projectionIntegrity: 'mismatch',
      authorityClass: receipt.authorityClass,
      decisionReceiptRef: receiptPath,
      decisionReceiptHash: receipt.receiptHash,
      currentAttemptId,
      blockerRefs: [...mismatches, ...projectionMismatches],
      evidenceRefs: receipt.evidenceRefs,
    };
  }

  return {
    schemaVersion: 'requirements-contract-verified-six-model-status/v1',
    recordId,
    requirementSetId,
    modelId: input.modelId,
    effectiveStatus: receipt.effectiveStatus,
    projectionStatus,
    projectionIntegrity: 'valid',
    authorityClass: receipt.authorityClass,
    decisionReceiptRef: receiptPath,
    decisionReceiptHash: receipt.receiptHash,
    currentAttemptId,
    blockerRefs: receipt.blockerRefs,
    evidenceRefs: receipt.evidenceRefs,
  };
}

function resolveVerifiedSixModelPanorama(input) {
  return SIX_MODEL_IDS.map((modelId) =>
    resolveVerifiedSixModelStatus({
      ...input,
      modelId,
    })
  );
}

module.exports = {
  SIX_MODEL_IDS,
  createRuntimeStatusDecisionReceipt,
  validateRuntimeStatusDecisionReceipt,
  resolveVerifiedSixModelStatus,
  resolveVerifiedSixModelPanorama,
  sha256Stable,
};
