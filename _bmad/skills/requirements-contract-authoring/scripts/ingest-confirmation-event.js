#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('./load-js-yaml');
const {
  STALE_BOOKKEEPING_REPAIR_REQUIRED,
  classifyConfirmationDrift,
} = require('./confirmation_drift_classifier');

const BOOKKEEPING_FIELDS = new Set([
  'status',
  'confirmedAt',
  'confirmedBy',
  'sourceDocumentHash',
  'implementationConfirmationHash',
  'reconfirmationRequest',
  'confirmationRender',
]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
      continue;
    }
    if (arg === '--json') {
      args.json = true;
      continue;
    }
    if (!arg.startsWith('--')) throw new Error(`Unexpected positional argument: ${arg}`);
    const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const value = argv[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
    args[key] = value;
    i += 1;
  }
  return args;
}

function sha256(content) {
  return `sha256:${crypto.createHash('sha256').update(content, 'utf8').digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function semanticConfirmationForHash(confirmation) {
  const semantic = {};
  for (const [key, value] of Object.entries(confirmation ?? {})) {
    if (!BOOKKEEPING_FIELDS.has(key)) semantic[key] = value;
  }
  return semantic;
}

function sourceDocumentHashFor(sourceText, blockText, confirmation) {
  const normalizedBlock = `implementationConfirmation:${stableStringify(
    semanticConfirmationForHash(confirmation)
  )}`;
  return sha256(sourceText.replace(blockText, normalizedBlock));
}

function implementationConfirmationHashFor(confirmation) {
  return sha256(stableStringify(semanticConfirmationForHash(confirmation)));
}

function normalizePathForReport(value) {
  return String(value ?? '').replace(/\\/g, '/');
}

function repoRelativePath(value) {
  const absolute = path.resolve(value);
  const relative = path.relative(process.cwd(), absolute).replace(/\\/g, '/');
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : normalizePathForReport(absolute);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function syncRequirementRecordIndex(recordPath, record, event) {
  const indexPath = path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'index.json');
  const now = event.confirmedAt ?? new Date().toISOString();
  const recordId = String(record.recordId ?? event.recordId ?? '').trim();
  const requirementSetId = String(record.requirementSetId ?? event.requirementSetId ?? recordId).trim();
  if (!recordId || !requirementSetId) return null;
  let index = { version: 1, source: '_bmad-output/runtime/requirement-records/index.json' };
  if (fs.existsSync(indexPath)) {
    try {
      index = readJson(indexPath);
    } catch {
      index = { version: 1, source: '_bmad-output/runtime/requirement-records/index.json' };
    }
  }
  const recordRef = {
    requirementSetId,
    recordId,
    recordPath: repoRelativePath(recordPath),
    flow: event.entryFlow ?? record.entryFlow ?? 'standalone_tasks',
    status: record.status ?? 'user_confirmed',
    updatedAt: now,
  };
  const records = Array.isArray(index.records) ? index.records : [];
  const nextRecords = [
    recordRef,
    ...records.filter(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        item.recordId !== recordId ||
        item.requirementSetId !== requirementSetId
    ),
  ];
  const items = Array.isArray(index.items) ? index.items : [];
  const itemRef = {
    requirementId: requirementSetId,
    sourceType: 'controlled_requirement_record',
    flow: event.entryFlow ?? record.entryFlow ?? 'standalone_tasks',
    status: record.status ?? 'user_confirmed',
    recordId,
    requirementSetId,
    recordPath: recordRef.recordPath,
    sourcePath: repoRelativePath(event.sourcePath ?? record.sourcePath ?? ''),
    sourceDocumentHash: record.sourceDocumentHash,
    implementationConfirmationHash: record.implementationConfirmationHash,
    confirmationPageHash: record.confirmationPageHash,
    updatedAt: now,
  };
  const nextItems = [
    itemRef,
    ...items.filter(
      (item) =>
        !item ||
        typeof item !== 'object' ||
        item.requirementId !== requirementSetId ||
        item.recordId !== recordId
    ),
  ];
  const nextIndex = {
    ...index,
    version: 1,
    updatedAt: now,
    source: '_bmad-output/runtime/requirement-records/index.json',
    active: {
      requirementSetId,
      recordId,
      recordPath: recordRef.recordPath,
    },
    records: nextRecords,
    items: nextItems,
  };
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.writeFileSync(indexPath, `${JSON.stringify(nextIndex, null, 2)}\n`, 'utf8');
  return normalizePathForReport(indexPath);
}

function extractImplementationConfirmation(sourceText) {
  const lines = sourceText.replace(/\r\n/g, '\n').split('\n');
  const start = lines.findIndex((line) => /^implementationConfirmation:\s*$/u.test(line));
  if (start < 0) throw new Error('missing implementationConfirmation block');
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') continue;
    if (/^\S/u.test(line) && !/^implementationConfirmation:\s*$/u.test(line)) {
      end = i;
      break;
    }
  }
  const blockText = lines.slice(start, end).join('\n');
  const parsed = yaml.load(blockText);
  if (!parsed || typeof parsed !== 'object' || !parsed.implementationConfirmation) {
    throw new Error('implementationConfirmation block is not valid YAML');
  }
  return { start, end, blockText, confirmation: parsed.implementationConfirmation, lines };
}

function parseConfirmationText(text) {
  const values = {};
  for (const key of ['sourceDocumentHash', 'implementationConfirmationHash', 'confirmationPageHash']) {
    const match = String(text ?? '').match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'i'));
    if (!match) throw new Error(`confirmation text missing ${key}`);
    values[key] = match[1];
  }
  const requestMatch = String(text ?? '').match(/requestId=([A-Za-z0-9._:-]+)/i);
  if (requestMatch) values.requestId = requestMatch[1].trim();
  return values;
}

function parseCloseoutConfirmationText(text) {
  const values = {};
  for (const key of [
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'closeoutConfirmationPageHash',
    'deliveryCloseoutReportHash',
  ]) {
    const match = String(text ?? '').match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'i'));
    if (!match) throw new Error(`closeout confirmation text missing ${key}`);
    values[key] = match[1];
  }
  const attemptMatch = String(text ?? '').match(/closeoutAttemptId=([^\s]+)/i);
  if (!attemptMatch) throw new Error('closeout confirmation text missing closeoutAttemptId');
  values.closeoutAttemptId = attemptMatch[1].trim();
  if (!String(text ?? '').includes('确认最终验收并关闭需求')) {
    throw new Error('closeout confirmation text missing closeout acceptance phrase');
  }
  return values;
}

function validateArgs(args) {
  if (args.action === 'repair-bookkeeping') {
    const required = ['source', 'requirementRecord'];
    const missing = required.filter((key) => !args[key]);
    if (missing.length) throw new Error(`missing required args: ${missing.join(', ')}`);
    return;
  }
  if (args.action === 'confirm-closeout-acceptance') {
    const required = ['source', 'renderReport', 'confirmedBy'];
    const missing = required.filter((key) => !args[key]);
    if (missing.length) throw new Error(`missing required args: ${missing.join(', ')}`);
    if (!args.confirmationText && !args.confirmationTextFile) {
      throw new Error('missing required args: confirmationText or confirmationTextFile');
    }
    if (args.confirmationText && args.confirmationTextFile) {
      throw new Error('provide only one of confirmationText or confirmationTextFile');
    }
    return;
  }
  const required = ['source', 'renderReport', 'confirmedBy'];
  const missing = required.filter((key) => !args[key]);
  if (missing.length) throw new Error(`missing required args: ${missing.join(', ')}`);
  if (!args.confirmationText && !args.confirmationTextFile) {
    throw new Error('missing required args: confirmationText or confirmationTextFile');
  }
  if (args.confirmationText && args.confirmationTextFile) {
    throw new Error('provide only one of confirmationText or confirmationTextFile');
  }
}

function confirmationTextFromArgs(args) {
  if (args.confirmationTextFile) {
    return fs.readFileSync(path.resolve(args.confirmationTextFile), 'utf8');
  }
  return String(args.confirmationText ?? '');
}

function updateSourceDocument(sourceText, extracted, update) {
  const confirmationPhrase =
    typeof update.confirmInstruction === 'string' && update.confirmInstruction.trim()
      ? update.confirmInstruction
      : update.confirmationText;
  const nextConfirmation = {
    ...extracted.confirmation,
    status: 'user_confirmed',
    confirmedAt: update.confirmedAt,
    confirmedBy: update.confirmedBy,
    sourceDocumentHash: update.sourceDocumentHash,
    implementationConfirmationHash: update.implementationConfirmationHash,
    reconfirmationRequest: null,
    confirmationRender: {
      ...(extracted.confirmation.confirmationRender ?? {}),
      htmlPath: update.htmlPath,
      summaryPath: update.summaryPath,
      reportPath: update.reportPath,
      htmlHash: update.confirmationPageHash,
      confirmationPhrase,
    },
  };
  const dumped = yaml.dump(
    { implementationConfirmation: nextConfirmation },
    { lineWidth: 120, noRefs: true, sortKeys: false }
  ).trimEnd();
  const trailingBlankLines = extracted.blockText.match(/\n+$/u)?.[0].length ?? 0;
  const replacementLines = dumped.split('\n');
  for (let i = 0; i < trailingBlankLines; i += 1) {
    replacementLines.push('');
  }
  const lines = [...extracted.lines];
  lines.splice(extracted.start, extracted.end - extracted.start, ...replacementLines);
  return lines.join('\n');
}

function updateSourceBookkeeping(sourceText, extracted, update) {
  const nextConfirmation = {
    ...extracted.confirmation,
    status: 'user_confirmed',
    confirmedAt: update.confirmedAt,
    confirmedBy: update.confirmedBy,
    sourceDocumentHash: update.sourceDocumentHash,
    implementationConfirmationHash: update.implementationConfirmationHash,
    reconfirmationRequest: null,
    confirmationRender: {
      ...(extracted.confirmation.confirmationRender ?? {}),
      htmlPath: update.htmlPath ?? extracted.confirmation.confirmationRender?.htmlPath ?? null,
      summaryPath: update.summaryPath ?? extracted.confirmation.confirmationRender?.summaryPath ?? null,
      reportPath: update.reportPath ?? extracted.confirmation.confirmationRender?.reportPath ?? null,
      htmlHash: update.confirmationPageHash ?? extracted.confirmation.confirmationRender?.htmlHash ?? null,
      confirmationPhrase:
        update.confirmationPhrase ?? extracted.confirmation.confirmationRender?.confirmationPhrase ?? null,
    },
  };
  const dumped = yaml.dump(
    { implementationConfirmation: nextConfirmation },
    { lineWidth: 120, noRefs: true, sortKeys: false }
  ).trimEnd();
  const trailingBlankLines = extracted.blockText.match(/\n+$/u)?.[0].length ?? 0;
  const replacementLines = dumped.split('\n');
  for (let i = 0; i < trailingBlankLines; i += 1) {
    replacementLines.push('');
  }
  const lines = [...extracted.lines];
  lines.splice(extracted.start, extracted.end - extracted.start, ...replacementLines);
  return lines.join('\n');
}

function buildRequirementRecord(existing, event, projectionEvent = null) {
  const record = existing && typeof existing === 'object' ? existing : {};
  const confirmationHistory = Array.isArray(record.confirmationHistory)
    ? [...record.confirmationHistory]
    : [];
  if (event) confirmationHistory.push(event);
  const confirmationProjectionHistory = Array.isArray(record.confirmationProjectionHistory)
    ? [...record.confirmationProjectionHistory]
    : [];
  if (projectionEvent) confirmationProjectionHistory.push(projectionEvent);
  if (!event) {
    return {
      ...record,
      latestConfirmationProjectionHash: projectionEvent?.newProjectionHash ?? record.latestConfirmationProjectionHash,
      confirmationProjectionHistory,
      lastEventType: projectionEvent ? 'confirmation_projection_refreshed' : record.lastEventType,
      updatedAt: projectionEvent?.observedAt ?? record.updatedAt,
    };
  }
  return {
    ...record,
    recordId: record.recordId ?? event.recordId,
    requirementSetId: record.requirementSetId ?? event.requirementSetId,
    sourcePath: record.sourcePath ?? event.sourcePath,
    status: 'user_confirmed',
    entryFlow: event.entryFlow,
    entryFlowClass: event.entryFlowClass,
    workflowAdapter: event.workflowAdapter,
    contractAuthoringRequired: event.contractAuthoringRequired,
    globalContractTraceabilityPolicy: event.globalContractTraceabilityPolicy,
    traceStatusPolicy: event.traceStatusPolicy,
    sourceDocumentHash: event.sourceDocumentHash,
    implementationConfirmationHash: event.implementationConfirmationHash,
    confirmationPageHash: event.confirmationPageHash,
    latestConfirmationProjectionHash: projectionEvent?.newProjectionHash ?? event.confirmationPageHash,
    confirmationHistory,
    confirmationProjectionHistory,
    lastEventType: 'confirmation_recorded',
    updatedAt: event.confirmedAt,
  };
}

function openRuntimeReconfirmationRequests(record) {
  return Array.isArray(record?.reconfirmationRequests)
    ? record.reconfirmationRequests.filter((request) =>
        ['blocking_open', 'open', 'in_progress'].includes(String(request?.status ?? '').trim())
      )
    : [];
}

function closeRuntimeReconfirmationRequest(record, requestId, event) {
  if (!requestId) return record;
  const openRequests = openRuntimeReconfirmationRequests(record);
  const matching = openRequests.find((request) => String(request?.requestId ?? '') === requestId);
  if (!matching) {
    throw new Error(`reconfirmation_request_not_open:${requestId}`);
  }
  const confirmationEventId = `confirmation_recorded:${event.confirmedAt}:${event.recordId}`;
  return {
    ...record,
    status: 'user_confirmed',
    currentMentalModel: 'requirement_confirmation',
    currentStage: 'requirement_confirmation',
    reconfirmationRequests: (Array.isArray(record.reconfirmationRequests)
      ? record.reconfirmationRequests
      : []
    ).map((request) =>
      String(request?.requestId ?? '') === requestId
        ? {
            ...request,
            status: 'controlled_confirmed',
            closedAt: event.confirmedAt,
            closedBy: event.confirmedBy,
            confirmationEventId,
          }
        : request
    ),
    sixModelResults: {
      ...(record.sixModelResults && typeof record.sixModelResults === 'object'
        ? record.sixModelResults
        : {}),
      requirement_confirmation: {
        ...((record.sixModelResults?.requirement_confirmation &&
        typeof record.sixModelResults.requirement_confirmation === 'object')
          ? record.sixModelResults.requirement_confirmation
          : {}),
        payloadKind: 'model_result',
        model: 'requirement_confirmation',
        recordId: event.recordId,
        requirementSetId: event.requirementSetId,
        sourceDocumentHash: event.sourceDocumentHash,
        implementationConfirmationHash: event.implementationConfirmationHash,
        status: 'pass',
        resultRecordedAt: event.confirmedAt,
        resultRecordedBy: event.confirmedBy,
        blockingReasons: [],
        sourceRefs: [{ sourceType: 'reconfirmation_request', id: requestId }],
        currentHashes: {
          sourceDocumentHash: event.sourceDocumentHash,
          implementationConfirmationHash: event.implementationConfirmationHash,
          confirmationPageHash: event.confirmationPageHash,
        },
      },
    },
  };
}

function closeoutAttempts(record) {
  return Array.isArray(record?.closeout?.attempts) ? record.closeout.attempts : [];
}

function latestCloseoutAttempt(record, currentAttemptId) {
  const attempts = closeoutAttempts(record);
  if (currentAttemptId) {
    const matched = attempts.find((attempt) => String(attempt?.closeoutAttemptId ?? attempt?.attemptId ?? '') === currentAttemptId);
    if (matched) return matched;
  }
  return attempts.at(-1) ?? null;
}

function hasCloseoutUserAcceptanceRequestProof(record, currentAttemptId, attempt, report) {
  if (!record || !currentAttemptId) return false;
  const closeoutAttemptMatches = String(record?.closeout?.currentAttemptId ?? '') === currentAttemptId;
  const closeoutDecisionPass = String(record?.closeout?.decision ?? '').toLowerCase() === 'pass';
  const attemptDecisionPass = String(attempt?.decision ?? '').toLowerCase() === 'pass';
  const acceptanceRequest = record?.closeout?.acceptanceRequest ?? {};
  return (
    closeoutAttemptMatches &&
    (closeoutDecisionPass || attemptDecisionPass) &&
    record.status === 'awaiting_user_acceptance' &&
    String(record.currentMentalModel ?? '') === 'delivery_confirmation' &&
    String(record.currentStage ?? '') === 'delivery_confirmation' &&
    String(record.lastEventType ?? '') === 'delivery_confirmation_user_acceptance_requested' &&
    String(acceptanceRequest.status ?? '') === 'awaiting_user_acceptance' &&
    String(acceptanceRequest.closeoutAttemptId ?? '') === currentAttemptId &&
    String(acceptanceRequest.closeoutConfirmationPageHash ?? '') === String(report.closeoutConfirmationPageHash ?? '') &&
    String(acceptanceRequest.deliveryCloseoutReportHash ?? '') === String(report.deliveryCloseoutReportHash ?? '')
  );
}

function confirmCloseoutAcceptance(args) {
  const sourcePath = path.resolve(args.source);
  const reportPath = path.resolve(args.renderReport);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  const report = readJson(reportPath);
  const confirmationText = confirmationTextFromArgs(args);
  const provided = parseCloseoutConfirmationText(confirmationText);
  const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, extracted.confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);
  const recordId = args.recordId ?? report.recordId ?? extracted.confirmation.recordId;
  const requirementSetId = args.requirementSetId ?? report.requirementSetId ?? extracted.confirmation.requirementSetId ?? recordId;
  const recordPath = path.resolve(
    args.requirementRecord ??
      path.join(
        process.cwd(),
        '_bmad-output',
        'runtime',
        'requirement-records',
        String(recordId ?? 'unrecorded'),
        'requirement-record.json'
      )
  );
  const existingRecord = fs.existsSync(recordPath) ? readJson(recordPath) : {};
  const attempt = latestCloseoutAttempt(existingRecord, provided.closeoutAttemptId);
  const mismatches = [];
  if (report.mode !== 'closeout-review') mismatches.push('render_report_not_closeout_review');
  if (report.sourceDocumentHash !== sourceDocumentHash) mismatches.push('render_report_source_hash_mismatch');
  if (report.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('render_report_implementation_confirmation_hash_mismatch');
  }
  if (provided.sourceDocumentHash !== sourceDocumentHash) mismatches.push('confirmation_text_source_hash_mismatch');
  if (provided.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('confirmation_text_implementation_hash_mismatch');
  }
  if (provided.closeoutConfirmationPageHash !== report.closeoutConfirmationPageHash) {
    mismatches.push('closeout_confirmation_page_hash_mismatch');
  }
  if (provided.deliveryCloseoutReportHash !== report.deliveryCloseoutReportHash) {
    mismatches.push('delivery_closeout_report_hash_mismatch');
  }
  const currentAttemptId = report.closeoutDeliveryVerdict?.currentAttemptId ?? report.finalAcceptanceReview?.currentAttemptId ?? '';
  if (provided.closeoutAttemptId !== currentAttemptId) mismatches.push('closeout_attempt_mismatch');
  if (report.closeoutDeliveryVerdict?.ready !== true) mismatches.push('closeout_delivery_verdict_not_ready');
  if (report.finalAcceptanceReview?.ready !== true) mismatches.push('final_acceptance_review_not_ready');
  if (!hasCloseoutUserAcceptanceRequestProof(existingRecord, provided.closeoutAttemptId, attempt, report)) {
    mismatches.push('closeout_user_acceptance_request_proof_missing');
  }
  if (mismatches.length) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
    return 3;
  }

  const confirmedAt = args.confirmedAt ?? new Date().toISOString();
  const beforeHash = fs.existsSync(recordPath) ? sha256(fs.readFileSync(recordPath, 'utf8')) : null;
  const event = {
    eventType: 'closeout_acceptance_confirmed',
    recordId,
    requirementSetId,
    confirmedAt,
    confirmedBy: args.confirmedBy,
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    closeoutAttemptId: provided.closeoutAttemptId,
    closeoutConfirmationPageHash: provided.closeoutConfirmationPageHash,
    deliveryCloseoutReportHash: provided.deliveryCloseoutReportHash,
    confirmationText,
    renderReportPath: normalizePathForReport(reportPath),
    htmlPath: normalizePathForReport(report.artifactRef?.path ?? report.closeoutProjectionIdentity?.renderedPath ?? ''),
    machineCloseoutEventType: 'record_closed',
  };
  const nextRecord = {
    ...existingRecord,
    recordId: existingRecord.recordId ?? recordId,
    requirementSetId: existingRecord.requirementSetId ?? requirementSetId,
    status: 'closed',
    currentMentalModel: 'delivery_confirmation',
    currentStage: 'delivery_confirmation',
    sixModelResults: {
      ...(existingRecord.sixModelResults && typeof existingRecord.sixModelResults === 'object'
        ? existingRecord.sixModelResults
        : {}),
      delivery_confirmation: {
        ...((existingRecord.sixModelResults?.delivery_confirmation &&
        typeof existingRecord.sixModelResults.delivery_confirmation === 'object')
          ? existingRecord.sixModelResults.delivery_confirmation
          : {}),
        payloadKind: 'model_result',
        model: 'delivery_confirmation',
        recordId,
        requirementSetId,
        sourceDocumentHash,
        implementationConfirmationHash,
        status: 'pass',
        resultRecordedAt: confirmedAt,
        resultRecordedBy: args.confirmedBy,
        blockingReasons: [],
      },
    },
    closeout: {
      ...(existingRecord.closeout && typeof existingRecord.closeout === 'object' && !Array.isArray(existingRecord.closeout)
        ? existingRecord.closeout
        : {}),
      currentAttemptId: provided.closeoutAttemptId,
      decision: 'pass',
      acceptanceRequest: {
        ...(existingRecord.closeout?.acceptanceRequest &&
        typeof existingRecord.closeout.acceptanceRequest === 'object'
          ? existingRecord.closeout.acceptanceRequest
          : {}),
        status: 'user_accepted_closeout',
        acceptedAt: confirmedAt,
        acceptedBy: args.confirmedBy,
      },
      updatedAt: confirmedAt,
    },
    closeoutAcceptance: {
      status: 'user_accepted_closeout',
      confirmedAt,
      confirmedBy: args.confirmedBy,
      closeoutAttemptId: provided.closeoutAttemptId,
      closeoutConfirmationPageHash: provided.closeoutConfirmationPageHash,
      deliveryCloseoutReportHash: provided.deliveryCloseoutReportHash,
      renderReportPath: normalizePathForReport(reportPath),
    },
    closeoutAcceptanceHistory: [
      ...(Array.isArray(existingRecord.closeoutAcceptanceHistory) ? existingRecord.closeoutAcceptanceHistory : []),
      event,
    ],
    lastEventType: 'record_closed',
    lastAppliedEventId: `record_closed:${provided.closeoutAttemptId}`,
    updatedAt: confirmedAt,
  };
  const afterHash = sha256(JSON.stringify(nextRecord));
  event.beforeRecordHash = beforeHash;
  event.afterRecordHash = afterHash;
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');

  const eventLogPath = path.resolve(
    args.eventLog ?? path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'mentor-events.jsonl')
  );
  appendJsonl(eventLogPath, event);
  const artifactIndexPath = path.resolve(
    args.artifactIndex ?? path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'artifact-index.jsonl')
  );
  appendJsonl(artifactIndexPath, {
    artifactType: 'requirement_record',
    sourceOfTruthRole: 'control',
    recordId,
    requirementSetId,
    path: normalizePathForReport(recordPath),
    eventType: 'closeout_acceptance_confirmed',
    contentHash: afterHash,
  });
  const result = {
    ok: true,
    event,
    requirementRecordPath: normalizePathForReport(recordPath),
    eventLogPath: normalizePathForReport(eventLogPath),
    artifactIndexPath: normalizePathForReport(artifactIndexPath),
    sourceUpdated: false,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    console.log(`closeout_acceptance_confirmed=${recordId}`);
    console.log(`requirement-record.json=${normalizePathForReport(recordPath)}`);
  }
  return 0;
}

function buildGlobalContractTraceabilityPolicy(confirmation) {
  const taskRegistryPolicy =
    confirmation.taskRegistryPolicy && typeof confirmation.taskRegistryPolicy === 'object'
      ? confirmation.taskRegistryPolicy
      : {};
  return {
    schemaVersion: 'global-contract-traceability-policy/v1',
    appliesToEntryFlows: ['bugfix', 'standalone_tasks', 'story'],
    contractAuthoringRequired: true,
    taskBindingRequired: true,
    taskBindingDimensions: ['MUST', 'NEG', 'OUT', 'EVD', 'TRACE'],
    missingBindingBehavior: 'fail_closed',
    sourceDocumentHashRequired: true,
    implementationConfirmationHashRequired: true,
    reconfirmOnTraceSemanticChange: true,
    allowUnboundImplementationTask: false,
    taskRegistryField: String(taskRegistryPolicy.canonicalTaskRegistryField ?? 'implementationTasks'),
    traceTaskRefsMustResolveTo: String(taskRegistryPolicy.traceTaskRefsMustResolveTo ?? 'implementationTasks[].id'),
    readinessFailureWhenUnresolved: taskRegistryPolicy.readinessFailureWhenUnresolved !== false,
    closeoutFailureWhenUnresolved: taskRegistryPolicy.closeoutFailureWhenUnresolved !== false,
  };
}

function buildTraceStatusPolicy() {
  return {
    schemaVersion: 'trace-status-policy/v1',
    allowedStatuses: [
      'PENDING',
      'PASS',
      'FAIL',
      'BLOCKED',
      'LINKED_DOWNSTREAM',
      'USER_APPROVED_DEFERRED',
      'USER_APPROVED_OUT_OF_SCOPE',
    ],
    terminalFullCloseoutStatuses: ['PASS', 'FAIL', 'BLOCKED'],
    linkedDownstreamRequiredFields: [
      'downstreamRecordId',
      'downstreamStoryRef',
      'downstreamSourceDocumentPath',
      'downstreamSourceDocumentHash',
      'downstreamScopeSummary',
      'downstreamRequirementIds',
      'downstreamAuditEvidenceRefs',
    ],
    userApprovedDeferredRequiredFields: [
      'userApprovalRef',
      'approvedAt',
      'approvedBy',
      'impactSummary',
      'followUpRecordId',
      'followUpDueCondition',
    ],
    userApprovedOutOfScopeRequiredFields: [
      'userApprovalRef',
      'approvedAt',
      'approvedBy',
      'impactSummary',
      'confirmationDeltaRef',
    ],
    bareDeferredForbidden: true,
    bareOutOfScopeForbidden: true,
    fullCloseoutForUserScopedStatusesForbidden: true,
  };
}

function appendJsonl(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function latestConfirmationRecord(record) {
  return Array.isArray(record?.confirmationHistory)
    ? record.confirmationHistory
        .filter((item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded')
        .at(-1)
    : null;
}

function latestProjectionRecord(record) {
  return Array.isArray(record?.confirmationProjectionHistory)
    ? record.confirmationProjectionHistory
        .filter((item) => item && typeof item === 'object' && item.eventType === 'confirmation_projection_refreshed')
        .at(-1)
    : null;
}

function normalizeHash(value) {
  const normalized = String(value ?? '').trim();
  return /^sha256:[a-f0-9]{64}$/i.test(normalized) ? normalized : null;
}

function addHashCandidate(candidates, value) {
  const normalized = normalizeHash(value);
  if (normalized && !candidates.includes(normalized)) candidates.push(normalized);
}

function priorProjectionHashCandidates(extractedConfirmation, existingRecord) {
  const candidates = [];
  addHashCandidate(candidates, extractedConfirmation?.confirmationRender?.htmlHash);
  addHashCandidate(candidates, existingRecord?.latestConfirmationProjectionHash);
  const latestProjection = latestProjectionRecord(existingRecord);
  addHashCandidate(candidates, latestProjection?.newProjectionHash);
  addHashCandidate(candidates, latestProjection?.oldProjectionHash);
  addHashCandidate(candidates, existingRecord?.confirmationPageHash);
  const latestConfirmation = latestConfirmationRecord(existingRecord);
  addHashCandidate(candidates, latestConfirmation?.confirmationPageHash);
  return candidates;
}

function repairBookkeeping(args) {
  const sourcePath = path.resolve(args.source);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, extracted.confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);
  const recordPath = path.resolve(args.requirementRecord);
  const existingRecord = fs.existsSync(recordPath) ? readJson(recordPath) : {};
  const driftClassification = classifyConfirmationDrift({
    confirmation: extracted.confirmation,
    requirementRecord: existingRecord,
    renderReport: null,
    currentHashes: {
      sourceDocumentHash,
      implementationConfirmationHash,
    },
  });

  if (driftClassification.kind !== STALE_BOOKKEEPING_REPAIR_REQUIRED) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          mismatches: ['bookkeeping_repair_not_allowed'],
          classification: driftClassification,
        },
        null,
        2
      )
    );
    return 3;
  }

  const confirmedAt = args.confirmedAt ?? new Date().toISOString();
  const latestConfirmation = latestConfirmationRecord(existingRecord);
  const latestProjection = latestProjectionRecord(existingRecord);
  const latestProjectionHash =
    existingRecord.latestConfirmationProjectionHash ??
    latestProjection?.newProjectionHash ??
    existingRecord.confirmationPageHash ??
    latestConfirmation?.confirmationPageHash ??
    extracted.confirmation.confirmationRender?.htmlHash ??
    null;
  const reportPath =
    latestProjection?.renderReportRef ??
    latestConfirmation?.renderReportPath ??
    extracted.confirmation.confirmationRender?.reportPath ??
    null;
  const htmlPath =
    latestProjection?.htmlPath ??
    latestConfirmation?.htmlPath ??
    extracted.confirmation.confirmationRender?.htmlPath ??
    null;
  const summaryPath =
    extracted.confirmation.confirmationRender?.summaryPath ??
    (reportPath ? path.join(path.dirname(reportPath), 'confirmation-summary.json') : null);
  const confirmationPhrase =
    extracted.confirmation.confirmationRender?.confirmationPhrase ??
    latestConfirmation?.confirmationText ??
    null;
  const beforeBookkeeping = {
    status: extracted.confirmation.status ?? null,
    confirmedAt: extracted.confirmation.confirmedAt ?? null,
    confirmedBy: extracted.confirmation.confirmedBy ?? null,
    sourceDocumentHash: extracted.confirmation.sourceDocumentHash ?? null,
    implementationConfirmationHash: extracted.confirmation.implementationConfirmationHash ?? null,
    reconfirmationRequest: extracted.confirmation.reconfirmationRequest ?? null,
    confirmationRender: extracted.confirmation.confirmationRender ?? null,
  };

  const nextSource = updateSourceBookkeeping(sourceText, extracted, {
    confirmedAt: latestConfirmation?.confirmedAt ?? extracted.confirmation.confirmedAt ?? confirmedAt,
    confirmedBy: latestConfirmation?.confirmedBy ?? extracted.confirmation.confirmedBy ?? args.confirmedBy ?? 'controlled_bookkeeping_repair',
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash: latestProjectionHash,
    htmlPath,
    summaryPath,
    reportPath,
    confirmationPhrase,
  });
  if (args.updateSource !== 'false') {
    fs.writeFileSync(sourcePath, nextSource, 'utf8');
  }

  const repairEvent = {
    eventType: 'confirmation_bookkeeping_repaired',
    recordId: existingRecord.recordId ?? extracted.confirmation.recordId ?? args.recordId ?? 'unrecorded',
    requirementSetId:
      existingRecord.requirementSetId ??
      extracted.confirmation.requirementSetId ??
      args.requirementSetId ??
      existingRecord.recordId ??
      extracted.confirmation.recordId ??
      'unrecorded',
    repairedAt: confirmedAt,
    repairedBy: args.confirmedBy ?? 'controlled_bookkeeping_repair',
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    latestProjectionHash,
    classifier: driftClassification,
    beforeBookkeeping,
    afterBookkeeping: {
      status: 'user_confirmed',
      sourceDocumentHash,
      implementationConfirmationHash,
      reconfirmationRequest: null,
      confirmationRender: {
        htmlPath,
        summaryPath,
        reportPath,
        htmlHash: latestProjectionHash,
        confirmationPhrase,
      },
    },
  };

  const nextRecord = {
    ...existingRecord,
    status: 'user_confirmed',
    sourceDocumentHash,
    implementationConfirmationHash,
    latestConfirmationProjectionHash: latestProjectionHash ?? existingRecord.latestConfirmationProjectionHash,
    reconfirmationRequest: null,
    bookkeepingRepairHistory: [
      ...(Array.isArray(existingRecord.bookkeepingRepairHistory)
        ? existingRecord.bookkeepingRepairHistory
        : []),
      repairEvent,
    ],
    lastEventType: 'confirmation_bookkeeping_repaired',
    updatedAt: confirmedAt,
  };
  const shouldWrite = args.updateSource !== 'false';
  if (shouldWrite) {
    fs.mkdirSync(path.dirname(recordPath), { recursive: true });
    fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');
  }

  const eventLogPath = path.resolve(
    args.eventLog ??
      path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'mentor-events.jsonl')
  );
  if (shouldWrite) appendJsonl(eventLogPath, repairEvent);

  const artifactIndexPath = path.resolve(
    args.artifactIndex ??
      path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'artifact-index.jsonl')
  );
  if (shouldWrite) {
    appendJsonl(artifactIndexPath, {
      artifactType: 'requirement_record',
      sourceOfTruthRole: 'control',
      recordId: repairEvent.recordId,
      requirementSetId: repairEvent.requirementSetId,
      path: normalizePathForReport(recordPath),
      eventType: 'confirmation_bookkeeping_repaired',
      contentHash: sha256(JSON.stringify(nextRecord)),
    });
  }

  const result = {
    ok: true,
    event: repairEvent,
    requirementRecordPath: normalizePathForReport(recordPath),
    eventLogPath: normalizePathForReport(eventLogPath),
    artifactIndexPath: normalizePathForReport(artifactIndexPath),
    sourceUpdated: shouldWrite,
    dryRun: !shouldWrite,
  };
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    console.log(`confirmation_bookkeeping_repaired=${repairEvent.recordId}`);
    console.log(`requirement-record.json=${normalizePathForReport(recordPath)}`);
  }
  return 0;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(`Usage: node ingest-confirmation-event.js --source <source.md> --render-report <confirmation-render-report.json> --confirmation-text <exact text> --confirmed-by <user> [--record-id <id>] [--requirement-record <path>] [--json]
       node ingest-confirmation-event.js --action repair-bookkeeping --source <source.md> --requirement-record <path> [--confirmed-by <agent>] [--json]
       node ingest-confirmation-event.js --action confirm-closeout-acceptance --source <source.md> --render-report <closeout-render-report.json> --confirmation-text <exact closeout text> --confirmed-by <user> [--requirement-record <path>] [--json]`);
    return 0;
  }
  validateArgs(args);
  if (args.action === 'repair-bookkeeping') {
    return repairBookkeeping(args);
  }
  if (args.action === 'confirm-closeout-acceptance') {
    return confirmCloseoutAcceptance(args);
  }

  const sourcePath = path.resolve(args.source);
  const reportPath = path.resolve(args.renderReport);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractImplementationConfirmation(sourceText);
  const report = readJson(reportPath);
  const confirmationText = confirmationTextFromArgs(args);
  const provided = parseConfirmationText(confirmationText);
  const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, extracted.confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(extracted.confirmation);

  const mismatches = [];
  if (report.confirmability !== 'confirmable') mismatches.push('render_report_not_confirmable');
  if (report.sourceDocumentHash !== sourceDocumentHash) mismatches.push('render_report_source_hash_mismatch');
  if (report.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('render_report_implementation_confirmation_hash_mismatch');
  }
  const recordPath = path.resolve(
    args.requirementRecord ??
      path.join(
        process.cwd(),
        '_bmad-output',
        'runtime',
        'requirement-records',
        String(args.recordId ?? report.recordId ?? extracted.confirmation.recordId ?? 'unrecorded'),
        'requirement-record.json'
      )
  );
  const existingRecord = fs.existsSync(recordPath) ? readJson(recordPath) : {};
  const priorConfirmedPageHashes = priorProjectionHashCandidates(
    extracted.confirmation,
    existingRecord
  );
  const confirmationPageHashMatchesReport = report.confirmationPageHash === provided.confirmationPageHash;
  const confirmationPageHashMatchesPriorConfirmedProjection =
    priorConfirmedPageHashes.includes(provided.confirmationPageHash);
  const projectionHashChanged = !confirmationPageHashMatchesReport;
  if (
    projectionHashChanged &&
    !confirmationPageHashMatchesPriorConfirmedProjection
  ) {
    mismatches.push('confirmation_page_hash_mismatch');
  }
  if (provided.sourceDocumentHash !== sourceDocumentHash) mismatches.push('confirmation_text_source_hash_mismatch');
  if (provided.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('confirmation_text_implementation_hash_mismatch');
  }
  if (mismatches.length) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
    return 3;
  }

  const confirmedAt = args.confirmedAt ?? new Date().toISOString();
  const recordId = args.recordId ?? report.recordId ?? extracted.confirmation.recordId;
  const requirementSetId = args.requirementSetId ?? report.requirementSetId ?? extracted.confirmation.requirementSetId;
  const confirmationPageHash = provided.confirmationPageHash;
  const summaryPath = path.join(path.dirname(reportPath), 'confirmation-summary.json');
  const htmlPath = report.artifactRef?.path ?? report.outPath ?? path.join(path.dirname(reportPath), 'confirmation.html');
  const event = {
    eventType: 'confirmation_recorded',
    recordId,
    requirementSetId,
    confirmedAt,
    confirmedBy: args.confirmedBy,
    sourcePath: normalizePathForReport(sourcePath),
    sourceDocumentHash,
    sourceDocumentHashScope: report.sourceDocumentHashScope ?? 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash,
    implementationConfirmationHashScope:
      report.implementationConfirmationHashScope ?? 'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash,
    confirmationText,
    renderReportPath: normalizePathForReport(reportPath),
    htmlPath: normalizePathForReport(htmlPath),
    entryFlow: extracted.confirmation.entryFlow,
    entryFlowClass: extracted.confirmation.entryFlowClass,
    workflowAdapter: extracted.confirmation.workflowAdapter,
    contractAuthoringRequired: extracted.confirmation.contractAuthoringRequired === true,
    globalContractTraceabilityPolicy: buildGlobalContractTraceabilityPolicy(extracted.confirmation),
    traceStatusPolicy: buildTraceStatusPolicy(),
  };
  const requestId = args.requestId ?? provided.requestId ?? report.requestId ?? report.reconfirmationRequest?.requestId ?? null;
  if (requestId) event.requestId = requestId;
  const projectionEvent = projectionHashChanged
    ? {
        eventType: 'confirmation_projection_refreshed',
        recordId,
        requirementSetId,
        observedAt: confirmedAt,
        producer: 'ingest-confirmation-event.js',
        sourceDocumentHash,
        implementationConfirmationHash,
        oldProjectionHash: provided.confirmationPageHash,
        newProjectionHash: report.confirmationPageHash,
        renderReportRef: normalizePathForReport(reportPath),
        htmlPath: normalizePathForReport(htmlPath),
        artifactRefs: [
          {
            artifactType: 'confirmation_view',
            sourceOfTruthRole: 'projection',
            path: normalizePathForReport(htmlPath),
            hash: report.confirmationPageHash,
          },
          {
            artifactType: 'confirmation_render_report',
            sourceOfTruthRole: 'projection',
            path: normalizePathForReport(reportPath),
            hash: report.actualReportHash ?? null,
          },
        ],
        reason: 'confirmation_page_hash_only_changed',
      }
    : null;

  const isProjectionOnlyRefresh = Boolean(projectionEvent);
  if (!isProjectionOnlyRefresh && args.updateSource !== 'false') {
    const nextSource = updateSourceDocument(sourceText, extracted, {
      ...event,
      reportPath: normalizePathForReport(reportPath),
      summaryPath: normalizePathForReport(summaryPath),
      confirmInstruction: report.confirmInstruction,
    });
    fs.writeFileSync(sourcePath, nextSource, 'utf8');
  }

  if (isProjectionOnlyRefresh) {
    const existingConfirmations = Array.isArray(existingRecord.confirmationHistory)
      ? existingRecord.confirmationHistory
      : [];
    const latestConfirmation = existingConfirmations
      .filter((item) => item && typeof item === 'object' && item.eventType === 'confirmation_recorded')
      .at(-1);
    const projectionRefreshAllowed =
      latestConfirmation &&
      latestConfirmation.sourceDocumentHash === sourceDocumentHash &&
      latestConfirmation.implementationConfirmationHash === implementationConfirmationHash &&
      priorConfirmedPageHashes.includes(provided.confirmationPageHash);
    if (!projectionRefreshAllowed) {
      console.error(
        JSON.stringify(
          { ok: false, mismatches: ['projection_refresh_without_current_semantic_confirmation'] },
          null,
          2
        )
      );
      return 3;
    }
  }
  const baseNextRecord = buildRequirementRecord(
    existingRecord,
    isProjectionOnlyRefresh ? null : event,
    projectionEvent
  );
  const nextRecord =
    !isProjectionOnlyRefresh && requestId
      ? closeRuntimeReconfirmationRequest(baseNextRecord, requestId, event)
      : baseNextRecord;
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(recordPath, `${JSON.stringify(nextRecord, null, 2)}\n`, 'utf8');
  const requirementRecordIndexPath = isProjectionOnlyRefresh
    ? null
    : syncRequirementRecordIndex(recordPath, nextRecord, event);

  const eventLogPath = path.resolve(
    args.eventLog ??
      path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'mentor-events.jsonl')
  );
  if (!isProjectionOnlyRefresh) appendJsonl(eventLogPath, event);
  if (projectionEvent) appendJsonl(eventLogPath, projectionEvent);

  const artifactIndexPath = path.resolve(
    args.artifactIndex ??
      path.join(process.cwd(), '_bmad-output', 'runtime', 'requirement-records', 'artifact-index.jsonl')
  );
  if (!isProjectionOnlyRefresh) {
    appendJsonl(artifactIndexPath, {
      artifactType: 'requirement_record',
      sourceOfTruthRole: 'control',
      recordId,
      requirementSetId,
      path: normalizePathForReport(recordPath),
      eventType: 'confirmation_recorded',
      contentHash: sha256(JSON.stringify(nextRecord)),
    });
  }
  if (projectionEvent) {
    appendJsonl(artifactIndexPath, {
      artifactType: 'confirmation_view',
      sourceOfTruthRole: 'projection',
      recordId,
      requirementSetId,
      path: normalizePathForReport(htmlPath),
      eventType: 'confirmation_projection_refreshed',
      contentHash: report.confirmationPageHash,
    });
  }

  const result = {
    ok: true,
    event: isProjectionOnlyRefresh ? null : event,
    projectionEvent,
    requirementRecordPath: normalizePathForReport(recordPath),
    requirementRecordIndexPath,
    eventLogPath: normalizePathForReport(eventLogPath),
    artifactIndexPath: normalizePathForReport(artifactIndexPath),
    sourceUpdated: !isProjectionOnlyRefresh && args.updateSource !== 'false',
  };
  if (args.json) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (isProjectionOnlyRefresh) {
    console.log(`confirmation_projection_refreshed=${recordId}`);
    console.log(`requirement-record.json=${normalizePathForReport(recordPath)}`);
  }
  else {
    console.log(`confirmation_recorded=${recordId}`);
    console.log(`requirement-record.json=${normalizePathForReport(recordPath)}`);
  }
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
