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
  indexed_active_record: 30,
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

function numericTimestamp(value) {
  const parsed = Date.parse(text(value));
  return Number.isFinite(parsed) ? parsed : 0;
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

function indexedActiveIdsFromIndex(index) {
  return unique([
    index?.active?.recordId,
    index?.active?.requirementSetId,
    index?.activeRecordId,
    index?.activeRequirementSetId,
    index?.currentRequirementSetId,
    ...asArray(index?.activeRecordIds),
  ].map((item) => (item ? String(item) : '')));
}

function idMatchesRecord(item, recordId, requirementSetId) {
  const ids = new Set([recordId, requirementSetId].filter(Boolean).map(String));
  return [
    item?.recordId,
    item?.requirementSetId,
    item?.requirementId,
    item?.id,
  ].some((candidate) => ids.has(String(candidate || '')));
}

function indexPointerMetadata(index, recordId, requirementSetId, isIndexedActive) {
  if (!isIndexedActive) {
    return {
      isIndexedActive: false,
      sourceType: '',
      updatedAt: '',
    };
  }
  const matchingItem =
    asArray(index?.items).find((item) => idMatchesRecord(item, recordId, requirementSetId)) ||
    asArray(index?.records).find((item) => idMatchesRecord(item, recordId, requirementSetId)) ||
    (idMatchesRecord(index?.active, recordId, requirementSetId) ? index.active : null);
  return {
    isIndexedActive: true,
    sourceType: text(matchingItem?.sourceType) || text(index?.active?.sourceType) || text(index?.sourceType),
    updatedAt: text(matchingItem?.updatedAt) || text(index?.active?.updatedAt) || text(index?.updatedAt),
  };
}

function userSelectedIdsFromOptions(options = {}) {
  return unique([
    options.recordId,
    options.requirementSetId,
    options.activeRecordId,
    options.activeRequirementSetId,
  ].map((item) => (item ? String(item) : '')));
}

function hasPostCloseRoute(record) {
  return Boolean(
    record.postCloseDefectIntake ||
      record.closureIntegrityIncident ||
      record.linkedBugfixRequirementId ||
      record.postCloseDefect ||
      record.postCloseRoute
  );
}

function isTerminalClosedRecord(record) {
  if (hasPostCloseRoute(record)) return false;
  const closeoutAcceptance =
    record.closeoutAcceptance && typeof record.closeoutAcceptance === 'object'
      ? record.closeoutAcceptance
      : {};
  const closeout = record.closeout && typeof record.closeout === 'object' ? record.closeout : {};
  const acceptanceRequest =
    closeout.acceptanceRequest && typeof closeout.acceptanceRequest === 'object'
      ? closeout.acceptanceRequest
      : {};
  return (
    text(record.status) === 'closed' ||
    text(record.lifecycleStatus) === 'closed' ||
    text(record.lastEventType) === 'record_closed' ||
    text(record.lastAppliedEventId).startsWith('record_closed:') ||
    text(closeoutAcceptance.status) === 'user_accepted_closeout' ||
    text(acceptanceRequest.status) === 'user_accepted_closeout'
  );
}

function classifyRecordActivity(record) {
  if (isTerminalClosedRecord(record)) {
    return {
      activityState: 'closed_history',
      isCurrentActionable: false,
      isTerminalClosed: true,
    };
  }
  return {
    activityState: 'current_actionable',
    isCurrentActionable: true,
    isTerminalClosed: false,
  };
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

function loadActiveRequirementRecords(projectRoot, options = {}) {
  const indexPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    'index.json'
  );
  const index = readJson(indexPath) || {};
  const indexedActiveIds = new Set(indexedActiveIdsFromIndex(index));
  const userSelectedIds = new Set(userSelectedIdsFromOptions(options));
  const paths = recordPathsFromIndex(projectRoot, index);
  const candidates = unique([...paths, ...scanRecordPaths(projectRoot)]);
  const records = [];
  const allRecords = [];
  const closedRecords = [];
  for (const recordPath of candidates) {
    const record = readJson(recordPath);
    if (!record || typeof record !== 'object') continue;
    const recordId = text(record.recordId) || text(record.requirementSetId) || recordIdFromPath(recordPath);
    const requirementSetId = text(record.requirementSetId);
    if (
      userSelectedIds.size > 0 &&
      !userSelectedIds.has(recordId) &&
      !userSelectedIds.has(requirementSetId)
    ) {
      continue;
    }
    const isExplicitSelection =
      userSelectedIds.has(recordId) || userSelectedIds.has(requirementSetId);
    const isIndexedActive =
      indexedActiveIds.has(recordId) || indexedActiveIds.has(requirementSetId);
    const indexPointer = indexPointerMetadata(index, recordId, requirementSetId, isIndexedActive);
    const activity = classifyRecordActivity(record);
    const entry = {
      record,
      recordPath,
      recordId,
      isExplicitSelection,
      isIndexedActive,
      indexPointer,
      ...activity,
    };
    allRecords.push(entry);
    if (activity.isCurrentActionable) records.push(entry);
    else closedRecords.push(entry);
  }
  return { index, records, allRecords, closedRecords };
}

function modelStatusEvidence(record, modelId, currentMentalModel = '') {
  const explicit = record.sixModelResults?.[modelId]?.status || record.sixModelResults?.[modelId];
  if (typeof explicit === 'string') {
    return { status: explicit, source: 'explicit sixModelResults' };
  }
  if (explicit && typeof explicit.status === 'string') {
    return { status: explicit.status, source: 'explicit sixModelResults' };
  }
  if (modelId === 'requirement_confirmation') {
    return record.sourceDocumentHash && record.implementationConfirmationHash
      ? {
          status: 'pass',
          source: 'inferred from sourceDocumentHash + implementationConfirmationHash',
        }
      : { status: 'not_established', source: 'missing source/implementation confirmation hash' };
  }
  if (modelId === 'architecture_confirmation') {
    if (/stale/iu.test(text(record.architectureConfirmationState))) {
      return { status: 'stale', source: 'architectureConfirmationState' };
    }
    return record.architectureConfirmationHash || record.architectureConfirmationState === 'active'
      ? { status: 'pass', source: 'inferred from architectureConfirmationHash' }
      : { status: 'not_established', source: 'missing architecture confirmation evidence' };
  }
  if (modelId === 'implementation_readiness') {
    const checks = asArray(record.gateChecks).concat(asArray(record.contractChecks));
    if (checks.some((check) => /fail|blocked/iu.test(text(check.status || check.result)))) {
      return { status: 'blocked', source: 'gateChecks/contractChecks' };
    }
    if (checks.some((check) => /pass|ready|ready_clean|repair_closed/iu.test(text(check.status || check.result)))) {
      return { status: 'pass', source: 'gateChecks/contractChecks' };
    }
    return { status: 'not_established', source: 'missing readiness gate evidence' };
  }
  if (modelId === 'delivery_confirmation' && deliveryAwaitingAcceptance(record)) {
    return { status: 'awaiting_user_acceptance', source: 'delivery acceptance request' };
  }
  if (modelId === currentMentalModel) {
    return { status: 'not_established', source: 'inferred current position' };
  }
  return { status: 'not_established', source: 'no model evidence found' };
}

function statusForModel(record, modelId) {
  return modelStatusEvidence(record, modelId).status;
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

function safetyReason(
  record,
  modelStatus,
  blockers,
  delivery,
  reconfirmation,
  isExplicitSelection,
  isIndexedActive
) {
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
  if (isIndexedActive) return 'indexed_active_record';
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
  const { record, recordPath, recordId, isExplicitSelection, isIndexedActive } = entry;
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
    isExplicitSelection,
    isIndexedActive
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
  const modelStatuses = {};
  for (const modelId of MODEL_IDS) {
    const evidence = modelStatusEvidence(record, modelId, currentMentalModel);
    modelStatuses[modelId] = {
      ...evidence,
      isCurrent: currentMentalModel === modelId,
    };
  }
  return {
    recordId,
    sourceOrTitle: sourceOrTitle(record),
    activityState: entry.activityState,
    isTerminalClosed: entry.isTerminalClosed,
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
    isIndexedActive,
    indexPointer: entry.indexPointer || {
      isIndexedActive,
      sourceType: '',
      updatedAt: '',
    },
    indexPointerStatus: isIndexedActive ? 'trusted_pointer' : 'not_index_pointer',
    hasSafetyBlocker,
    modelStatuses,
    recordPath: normalizePath(path.relative(process.cwd(), recordPath)),
    rawRecord: record,
  };
}

function isFixtureIndexPointer(record) {
  return /(?:^|[_-])ci[_-]?fixture(?:$|[_-])|fixture|test/iu.test(
    text(record.indexPointer?.sourceType)
  );
}

function annotateIndexPointerTrust(records, index) {
  const newestRecordTimestamp = Math.max(0, ...records.map((record) => numericTimestamp(record.updatedAt)));
  const indexTimestamp = numericTimestamp(index?.updatedAt);
  for (const record of records) {
    if (!record.isIndexedActive) {
      record.indexPointerStatus = 'not_index_pointer';
      record.selectionPriority = record.primaryPriority;
      continue;
    }
    const pointerTimestamp = numericTimestamp(record.indexPointer?.updatedAt) || indexTimestamp;
    const fixturePointer = isFixtureIndexPointer(record);
    const stalePointer =
      pointerTimestamp > 0 &&
      newestRecordTimestamp > pointerTimestamp &&
      numericTimestamp(record.updatedAt) < newestRecordTimestamp;
    const ignoredForSelection =
      record.primaryReasonToken === 'indexed_active_record' &&
      !record.isExplicitSelection &&
      (fixturePointer || stalePointer);
    if (ignoredForSelection) {
      record.indexPointerStatus = fixturePointer
        ? 'ignored_fixture_pointer'
        : 'ignored_stale_pointer';
      record.primaryReasonToken = 'active_record';
      record.primaryPriority = SAFETY_PRIORITY.active_record;
      record.selectionPriority = SAFETY_PRIORITY.active_record;
      continue;
    }
    record.indexPointerStatus = 'trusted_pointer';
    record.selectionPriority = record.primaryPriority;
  }
  return records;
}

function selectPrimaryRecord(records) {
  if (records.length === 0) return null;
  return [...records].sort((left, right) => {
    const leftPriority = left.selectionPriority ?? left.primaryPriority;
    const rightPriority = right.selectionPriority ?? right.primaryPriority;
    if (rightPriority !== leftPriority) {
      return rightPriority - leftPriority;
    }
    const updatedDelta = numericTimestamp(right.updatedAt) - numericTimestamp(left.updatedAt);
    if (updatedDelta !== 0) return updatedDelta;
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

function indexPointerWarnings(activeRecords) {
  return activeRecords
    .filter((record) => /^ignored_/u.test(record.indexPointerStatus))
    .map((record) => ({
      recordId: record.recordId,
      status: record.indexPointerStatus,
      sourceType: record.indexPointer?.sourceType || 'unknown',
      indexUpdatedAt: record.indexPointer?.updatedAt || 'unknown',
      recordUpdatedAt: record.updatedAt,
      message:
        record.indexPointerStatus === 'ignored_fixture_pointer'
          ? 'runtime index pointer comes from a fixture source and is not treated as user selection'
          : 'runtime index pointer is older than another current-actionable record and is not treated as user selection',
    }));
}

function resolveAiTddRuntimeDecision(projectRoot, options = {}) {
  const root = path.resolve(projectRoot || process.cwd());
  const manifests = loadAiTddProjectionManifests(root, { assetRoot: options.assetRoot });
  const { index, records, allRecords, closedRecords } = loadActiveRequirementRecords(root, options);
  const activeRecords = annotateIndexPointerTrust(records.map(summarizeRecord), index);
  const primaryRecord = selectPrimaryRecord(activeRecords);
  return {
    viewMode: VIEW_MODE,
    displayBudget: options.displayBudget || 'route',
    manifests,
    inventory: {
      loadableRecords: allRecords.length,
      currentActionableRecords: activeRecords.length,
      closedOrHistoricalRecords: closedRecords.length,
    },
    activeRecords,
    primaryRecord,
    primaryBecause: primaryRecord ? primaryRecord.primaryReasonToken : 'no_active_requirement',
    indexPointerWarnings: indexPointerWarnings(activeRecords),
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
