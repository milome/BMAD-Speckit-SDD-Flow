const fs = require('node:fs');
const path = require('node:path');
const { MODEL_IDS, loadAiTddProjectionManifests } = require('./projection-manifest');

const VIEW_MODE = 'AI-TDD Runtime Six-Model Panorama';

const SAFETY_PRIORITY = {
  awaiting_user_acceptance: 100,
  open_reconfirmation: 90,
  stale_hash: 80,
  stale_attempt: 70,
  delivery_closeout_blocker: 60,
  readiness_blocker: 50,
  explicit_user_selection: 40,
  active_record: 10,
};

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && String(value).trim() !== ''))];
}

function asArray(value) {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

function text(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : '';
}

function truthy(value) {
  return value === true || value === 'true' || value === 'pass' || value === 'passed';
}

function recordIdFromPath(recordPath) {
  return path.basename(path.dirname(recordPath));
}

function activeIdsFromIndex(index) {
  const ids = [];
  for (const item of [
    index?.active?.recordId,
    index?.active?.requirementSetId,
    index?.activeRecordId,
    index?.activeRequirementSetId,
    index?.currentRequirementSetId,
  ]) {
    if (item) ids.push(String(item));
  }
  for (const item of asArray(index?.activeRecordIds)) {
    if (item) ids.push(String(item));
  }
  for (const item of asArray(index?.records)) {
    if (item?.recordId) ids.push(String(item.recordId));
    else if (item?.requirementSetId) ids.push(String(item.requirementSetId));
  }
  return unique(ids);
}

function recordPathsFromIndex(projectRoot, index) {
  const root = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records');
  const paths = [];
  for (const item of [index?.active, ...asArray(index?.records)]) {
    if (item?.recordPath) paths.push(path.join(projectRoot, normalizePath(item.recordPath)));
    else if (item?.recordId) paths.push(path.join(root, String(item.recordId), 'requirement-record.json'));
    else if (item?.requirementSetId) {
      paths.push(path.join(root, String(item.requirementSetId), 'requirement-record.json'));
    }
  }
  for (const id of activeIdsFromIndex(index)) {
    paths.push(path.join(root, id, 'requirement-record.json'));
  }
  return unique(paths);
}

function scanRecordPaths(projectRoot) {
  const root = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(root, entry.name, 'requirement-record.json'))
    .filter((candidate) => fs.existsSync(candidate));
}

function loadActiveRequirementRecords(projectRoot) {
  const indexPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'index.json'
  );
  const index = readJson(indexPath) || {};
  const explicitIds = new Set(activeIdsFromIndex(index));
  const paths = recordPathsFromIndex(projectRoot, index);
  const candidates = paths.length > 0 ? paths : scanRecordPaths(projectRoot);
  const records = [];
  for (const recordPath of candidates) {
    const record = readJson(recordPath);
    if (!record || typeof record !== 'object') continue;
    const recordId = text(record.recordId) || text(record.requirementSetId) || recordIdFromPath(recordPath);
    if (
      explicitIds.size > 0 &&
      !explicitIds.has(recordId) &&
      !explicitIds.has(text(record.requirementSetId))
    ) {
      continue;
    }
    records.push({
      record,
      recordPath,
      recordId,
      isExplicitSelection:
        text(index.activeRecordId) === recordId ||
        text(index.active?.recordId) === recordId ||
        text(index.activeRequirementSetId) === recordId,
    });
  }
  return { index, records };
}

function statusForModel(record, modelId) {
  const explicit = record.sixModelResults?.[modelId]?.status || record.sixModelResults?.[modelId];
  if (typeof explicit === 'string') return explicit;
  if (explicit && typeof explicit.status === 'string') return explicit.status;
  if (modelId === 'requirement_confirmation') {
    return record.sourceDocumentHash && record.implementationConfirmationHash
      ? 'pass'
      : 'not_established';
  }
  if (modelId === 'architecture_confirmation') {
    if (/stale/iu.test(text(record.architectureConfirmationState))) return 'stale';
    return record.architectureConfirmationHash || record.architectureConfirmationState === 'active'
      ? 'pass'
      : 'not_established';
  }
  if (modelId === 'implementation_readiness') {
    const checks = asArray(record.gateChecks).concat(asArray(record.contractChecks));
    if (checks.some((check) => /fail|blocked/iu.test(text(check.status || check.result)))) {
      return 'blocked';
    }
    if (checks.some((check) => /pass|ready|ready_clean|repair_closed/iu.test(text(check.status || check.result)))) {
      return 'pass';
    }
    return 'not_established';
  }
  if (modelId === 'delivery_confirmation' && deliveryAwaitingAcceptance(record)) {
    return 'awaiting_user_acceptance';
  }
  return 'not_established';
}

function inferCurrentMentalModel(record) {
  const explicit = text(record.currentMentalModel);
  if (MODEL_IDS.includes(explicit)) return explicit;
  for (const modelId of MODEL_IDS) {
    const status = statusForModel(record, modelId);
    if (status !== 'pass') return modelId;
  }
  return 'delivery_confirmation';
}

function sourceOrTitle(record) {
  return (
    text(record.title) ||
    text(record.sourceDocumentPath) ||
    text(record.source?.path) ||
    text(record.contractSummary?.title) ||
    text(record.requirementSetId) ||
    text(record.recordId) ||
    'untitled requirement'
  );
}

function openBlockers(record) {
  const blockers = [];
  for (const item of asArray(record.blockers).concat(asArray(record.openBlockers))) {
    if (typeof item === 'string') blockers.push(item);
    else if (item && item.status !== 'closed') blockers.push(text(item.reason) || text(item.code));
  }
  for (const reason of asArray(record.blockingReasons)) blockers.push(String(reason));
  const checks = asArray(record.gateChecks).concat(asArray(record.contractChecks));
  for (const check of checks) {
    if (/fail|blocked/iu.test(text(check.status || check.result))) {
      blockers.push(text(check.code) || text(check.name) || 'readiness_blocker');
    }
  }
  return unique(blockers);
}

function reconfirmationState(record) {
  const reconfirmation = record.reconfirmation || record.reconfirmationState || {};
  const trigger =
    text(reconfirmation.triggerId) ||
    text(record.reconfirmationTrigger) ||
    text(record.reconfirmationRequiredReason);
  const required =
    reconfirmation.required === true ||
    record.reconfirmationRequired === true ||
    text(reconfirmation.status) === 'required' ||
    trigger !== '';
  return {
    required,
    triggerId: trigger || 'SOURCE_SEMANTIC_HASH_CHANGED',
  };
}

function deliveryInfo(record) {
  const closeout = record.closeout || {};
  const delivery = record.deliveryConfirmation || record.deliveryConfirmations || {};
  const latest = Array.isArray(delivery) ? delivery[delivery.length - 1] || {} : delivery;
  const currentAttemptId =
    text(closeout.currentAttemptId) ||
    text(latest.currentAttemptId) ||
    text(latest.attemptId) ||
    text(record.currentAttemptId);
  const status = text(closeout.status) || text(latest.status);
  const acceptanceRequest = closeout.acceptanceRequest || latest.acceptanceRequest || {};
  const awaiting =
    status === 'awaiting_user_acceptance' ||
    closeout.awaitingUserAcceptance === true ||
    latest.awaitingUserAcceptance === true ||
    acceptanceRequest.status === 'pending' ||
    record.awaitingUserAcceptance === true;
  const pagePath =
    text(closeout.confirmationPagePath) ||
    text(latest.confirmationPagePath) ||
    text(acceptanceRequest.confirmationPagePath) ||
    'closeout-confirmation-current.html';
  const renderReportPath =
    text(closeout.renderReportPath) ||
    text(latest.renderReportPath) ||
    text(acceptanceRequest.renderReportPath) ||
    'closeout-render-report.json';
  const deliveryCloseoutReportHash =
    text(closeout.deliveryCloseoutReportHash) ||
    text(closeout.reportHash) ||
    text(latest.deliveryCloseoutReportHash) ||
    text(acceptanceRequest.deliveryCloseoutReportHash);
  const exactInstruction =
    text(acceptanceRequest.exactInstruction) ||
    text(latest.exactInstruction) ||
    'confirm-closeout-acceptance';
  return {
    awaiting,
    status,
    currentAttemptId,
    pagePath,
    renderReportPath,
    deliveryCloseoutReportHash,
    exactInstruction,
    stalePage: closeout.pageStale === true || latest.pageStale === true,
    staleAttempt: closeout.attemptStale === true || latest.attemptStale === true,
    hashMismatch: closeout.hashMismatch === true || latest.hashMismatch === true,
    missingAcceptanceRequest:
      closeout.missingAcceptanceRequest === true ||
      latest.missingAcceptanceRequest === true ||
      (awaiting && Object.keys(acceptanceRequest).length === 0 && !record.awaitingUserAcceptance),
  };
}

function deliveryAwaitingAcceptance(record) {
  return deliveryInfo(record).awaiting;
}

function safetyReason(record, modelStatus, blockers, delivery, reconfirmation, isExplicitSelection) {
  if (delivery.awaiting) return 'awaiting_user_acceptance';
  if (reconfirmation.required) return 'open_reconfirmation';
  if (delivery.hashMismatch || /hash_mismatch|stale_hash/iu.test(blockers.join(' '))) return 'stale_hash';
  if (delivery.staleAttempt || /stale_attempt/iu.test(blockers.join(' '))) return 'stale_attempt';
  if (
    delivery.stalePage ||
    delivery.missingAcceptanceRequest ||
    /delivery|closeout|acceptance/iu.test(blockers.join(' '))
  ) {
    return 'delivery_closeout_blocker';
  }
  if (modelStatus === 'blocked' || /readiness/iu.test(blockers.join(' '))) return 'readiness_blocker';
  if (isExplicitSelection) return 'explicit_user_selection';
  return 'active_record';
}

function nextSafeActionFor(input) {
  if (input.delivery.awaiting) return 'confirm-closeout-acceptance';
  if (input.reconfirmation.required) return 'requirements-contract-authoring authoring-repair-preserve-existing';
  if (input.reason === 'delivery_closeout_blocker') return 'run_delivery_closeout';
  if (input.reason === 'readiness_blocker') return 'run_implementation_readiness_gate';
  if (input.currentMentalModel === 'requirement_confirmation') {
    return 'requirements-contract-authoring author-confirmation-ready-source';
  }
  if (input.currentMentalModel === 'architecture_confirmation') return 'prepare_architecture_confirmation';
  if (input.currentMentalModel === 'implementation_readiness') return 'run_implementation_readiness_gate';
  if (input.currentMentalModel === 'execution_closure') return 'req-trace-matrix-prompt-generator';
  if (input.currentMentalModel === 'audit_review') return 'dispatch_review';
  if (input.currentMentalModel === 'delivery_confirmation') return 'run_closeout';
  return 'inspect_requirement_record';
}

function canCompileGoalPacket(record, summary) {
  return (
    Boolean(record.sourceDocumentHash) &&
    Boolean(record.implementationConfirmationHash) &&
    ['implementation_readiness', 'execution_closure'].includes(summary.currentMentalModel) &&
    !summary.hasSafetyBlocker &&
    ['pass', 'not_established'].includes(summary.schemaModelStatus)
  );
}

function summarizeRecord(entry) {
  const { record, recordPath, recordId, isExplicitSelection } = entry;
  const currentMentalModel = inferCurrentMentalModel(record);
  const schemaModelStatus = statusForModel(record, currentMentalModel);
  const blockers = openBlockers(record);
  const delivery = deliveryInfo(record);
  const reconfirmation = reconfirmationState(record);
  const reason = safetyReason(
    record,
    schemaModelStatus,
    blockers,
    delivery,
    reconfirmation,
    isExplicitSelection
  );
  const hasSafetyBlocker = SAFETY_PRIORITY[reason] > SAFETY_PRIORITY.explicit_user_selection;
  const nextSafeAction = nextSafeActionFor({
    record,
    currentMentalModel,
    schemaModelStatus,
    blockers,
    delivery,
    reconfirmation,
    reason,
  });
  const displayState =
    delivery.awaiting || schemaModelStatus === 'awaiting_user_acceptance'
      ? 'awaiting_user_acceptance'
      : reconfirmation.required
        ? 'reconfirmation_required'
        : blockers.length > 0
          ? 'blocked'
          : schemaModelStatus;
  return {
    recordId,
    sourceOrTitle: sourceOrTitle(record),
    currentMentalModel,
    schemaModelStatus,
    displayState,
    blockerSummary: blockers.length > 0 ? blockers.join('; ') : 'none',
    nextSafeAction,
    updatedAt:
      text(record.updatedAt) ||
      text(record.currentAttemptId) ||
      text(record.sourceDocumentHash) ||
      text(record.implementationConfirmationHash) ||
      'unknown',
    currentAttemptId: delivery.currentAttemptId || text(record.currentAttemptId) || '',
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    delivery,
    reconfirmation,
    primaryReasonToken: reason,
    primaryPriority: SAFETY_PRIORITY[reason],
    isExplicitSelection,
    hasSafetyBlocker,
    recordPath: normalizePath(path.relative(process.cwd(), recordPath)),
    rawRecord: record,
  };
}

function selectPrimaryRecord(records) {
  if (records.length === 0) return null;
  return [...records].sort((left, right) => {
    if (right.primaryPriority !== left.primaryPriority) {
      return right.primaryPriority - left.primaryPriority;
    }
    return left.recordId.localeCompare(right.recordId);
  })[0];
}

function goalRouteRecommendation(activeRecords, primaryRecord) {
  if (activeRecords.length === 0 || !primaryRecord) {
    return {
      skill: 'goal-execution-contract-generator',
      reason: 'no_active_requirement_record',
    };
  }
  if (canCompileGoalPacket(primaryRecord.rawRecord, primaryRecord)) {
    return {
      skill: 'req-trace-matrix-prompt-generator',
      reason: 'active_requirement_record_current',
    };
  }
  return {
    skill: primaryRecord.nextSafeAction,
    reason: primaryRecord.primaryReasonToken,
  };
}

function resolveAiTddRuntimeDecision(projectRoot, options = {}) {
  const root = path.resolve(projectRoot || process.cwd());
  const manifests = loadAiTddProjectionManifests(root, { assetRoot: options.assetRoot });
  const { records } = loadActiveRequirementRecords(root);
  const activeRecords = records.map(summarizeRecord);
  const primaryRecord = selectPrimaryRecord(activeRecords);
  return {
    viewMode: VIEW_MODE,
    displayBudget: options.displayBudget || 'route',
    manifests,
    activeRecords,
    primaryRecord,
    primaryBecause: primaryRecord ? primaryRecord.primaryReasonToken : 'no_active_requirement',
    nextSafeAction: primaryRecord
      ? primaryRecord.nextSafeAction
      : 'requirements-contract-authoring author-confirmation-ready-source',
    goalRoute: goalRouteRecommendation(activeRecords, primaryRecord),
  };
}

module.exports = {
  VIEW_MODE,
  SAFETY_PRIORITY,
  loadActiveRequirementRecords,
  resolveAiTddRuntimeDecision,
};
