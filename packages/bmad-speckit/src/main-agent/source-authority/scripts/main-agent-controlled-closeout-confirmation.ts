import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import {
  isRecord,
  stableHash,
  text,
  type JsonRecord,
} from './requirements-contract-verification-evidence-normalizer';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
} from './requirements-contract-implementation-confirmation-codec';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  readControlStoreAuthoritatively,
  sha256Json,
} from './requirement-record-control-store';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
} from './requirements-contract-runtime-status-decision-receipt';
import { validateGoalExecutionAdmission } from '../../../utils/goal-contract/control-plane/frozen-goal-activation';

export interface MainAgentControlledCloseoutConfirmationResult {
  ok: boolean;
  status?:
    | 'record_closed'
    | 'record_closed_reused'
    | 'closeout_rejected'
    | 'closeout_rejected_reused'
    | 'blocked';
  exitCode: 0 | 2 | 3;
  acceptanceReceiptPath?: string;
  acceptanceReceipt?: JsonRecord;
  recordClosedReceipt?: JsonRecord;
  mismatches?: string[];
  error?: string;
  event?: JsonRecord;
  requirementRecordPath?: string;
  eventLogPath?: string;
  artifactIndexPath?: string;
  sourceUpdated?: false;
  issueCode?: string | null;
  recordRevision?: number;
  requestRef?: JsonRecord;
  deliveryGateReceiptRef?: JsonRecord;
  pageRef?: JsonRecord;
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

type HashRef = { path: string; hash: string };

function confinedHashRef(value: unknown): HashRef {
  if (!isRecord(value)) throw new Error('controlled_closeout_ref_invalid');
  const refPath = text(value.path);
  const refHash = text(value.hash);
  if (
    !refPath ||
    refPath.includes('\\') ||
    path.posix.isAbsolute(refPath) ||
    path.win32.isAbsolute(refPath) ||
    refPath.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
    !HASH_PATTERN.test(refHash)
  ) {
    throw new Error('controlled_closeout_ref_invalid');
  }
  return { path: refPath, hash: refHash };
}

function sameHashRef(left: unknown, right: unknown): boolean {
  try {
    const leftRef = confinedHashRef(left);
    const rightRef = confinedHashRef(right);
    return leftRef.path === rightRef.path && leftRef.hash === rightRef.hash;
  } catch {
    return false;
  }
}

function readConfinedArtifact(projectRoot: string, ref: HashRef): Buffer {
  const root = fs.realpathSync.native(path.resolve(projectRoot));
  const target = resolveProjectPath(root, ref.path);
  const stat = fs.lstatSync(target);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('controlled_closeout_artifact_invalid');
  }
  const canonicalTarget = fs.realpathSync.native(target);
  if (canonicalTarget !== root && !canonicalTarget.startsWith(`${root}${path.sep}`)) {
    throw new Error('controlled_closeout_artifact_invalid');
  }
  return fs.readFileSync(canonicalTarget);
}

function readConfinedJsonArtifact(projectRoot: string, ref: HashRef): JsonRecord {
  const parsed = JSON.parse(readConfinedArtifact(projectRoot, ref).toString('utf8')) as unknown;
  if (!isRecord(parsed)) throw new Error('controlled_closeout_artifact_invalid');
  return parsed;
}

function normalizeExactConfirmationText(value: unknown): string {
  return text(value).replace(/\r\n/gu, '\n');
}

function controlledRequestIdentity(request: JsonRecord) {
  return {
    schemaVersion: 'ControlledCloseoutRequestIdentity/v1',
    deliveryGateReceiptRef: confinedHashRef(request.deliveryGateReceiptRef),
    executionFinalCandidateHash: text(request.executionFinalCandidateHash),
    requestId: text(request.requestId),
    pageId: text(request.pageId),
    intent: request.intent,
    exactAcceptText: normalizeExactConfirmationText(request.exactAcceptText),
    exactRejectText: normalizeExactConfirmationText(request.exactRejectText),
  };
}

function validateControlledCloseoutArtifacts(input: {
  projectRoot: string;
  recordId: string;
  record: JsonRecord;
  currentRequest: JsonRecord;
}) {
  const requestRef = confinedHashRef(input.currentRequest.requestRef);
  const request = readConfinedJsonArtifact(input.projectRoot, requestRef);
  const expectedRequestKeys = [
    'schemaVersion',
    'status',
    'recordId',
    'deliveryGateReceiptRef',
    'executionFinalCandidateHash',
    'requestId',
    'pageId',
    'intent',
    'exactAcceptText',
    'exactRejectText',
    'pageRef',
    'closeoutAcceptanceRequestHash',
    'controlledCloseoutRequestHash',
  ].sort();
  const identity = controlledRequestIdentity(request);
  const requestHash = text(request.closeoutAcceptanceRequestHash);
  const artifactHash = text(request.controlledCloseoutRequestHash);
  const requestArtifactPayload = { ...request };
  delete requestArtifactPayload.controlledCloseoutRequestHash;
  if (
    request.schemaVersion !== 'ControlledCloseoutRequest/v1' ||
    request.status !== 'awaiting_user_acceptance' ||
    request.recordId !== input.recordId ||
    request.intent !== 'accept_or_reject_goal_delivery' ||
    Object.keys(request).sort().join('\u0000') !== expectedRequestKeys.join('\u0000') ||
    !HASH_PATTERN.test(identity.executionFinalCandidateHash) ||
    !identity.requestId ||
    !identity.pageId ||
    !identity.exactAcceptText ||
    !identity.exactRejectText ||
    identity.exactAcceptText === identity.exactRejectText ||
    stableHash(identity) !== requestHash ||
    !HASH_PATTERN.test(artifactHash) ||
    stableHash(requestArtifactPayload) !== artifactHash ||
    requestRef.hash !== artifactHash
  ) {
    throw new Error('controlled_closeout_request_invalid');
  }
  const gateRef = confinedHashRef(request.deliveryGateReceiptRef);
  const gate = readConfinedJsonArtifact(input.projectRoot, gateRef);
  const gatePayload = { ...gate };
  delete gatePayload.deliveryCloseoutGateReceiptHash;
  if (
    gate.schemaVersion !== 'GoalDeliveryCloseoutGateReceipt/v1' ||
    gate.status !== 'pass' ||
    gate.executionFinalCandidateHash !== identity.executionFinalCandidateHash ||
    gate.deliveryCloseoutGateReceiptHash !== gateRef.hash ||
    stableHash(gatePayload) !== gateRef.hash ||
    [
      gate.contextHash,
      gate.candidateBytesHash,
      gate.campaignClosureHash,
      gate.executionFinalJudgeCampaignHash,
      gate.effectivePassReceiptHash,
      gate.verifiedPrerequisiteStatusesHash,
    ].some((value) => !HASH_PATTERN.test(text(value)))
  ) {
    throw new Error('controlled_closeout_gate_invalid');
  }
  const pageRef = confinedHashRef(request.pageRef);
  const pageBytes = readConfinedArtifact(input.projectRoot, pageRef);
  if (sha256Text(pageBytes.toString('utf8')) !== pageRef.hash) {
    throw new Error('controlled_closeout_page_invalid');
  }
  if (
    input.currentRequest.requestId !== identity.requestId ||
    input.currentRequest.executionFinalCandidateHash !== identity.executionFinalCandidateHash ||
    !sameHashRef(input.currentRequest.requestRef, requestRef) ||
    !sameHashRef(input.currentRequest.deliveryGateReceiptRef, gateRef) ||
    !sameHashRef(input.currentRequest.pageRef, pageRef)
  ) {
    throw new Error('controlled_closeout_current_request_mismatch');
  }
  return { request, requestRef, identity, gate, gateRef, pageRef };
}

function resolveProjectPath(projectRoot: string, value: string): string {
  const root = path.resolve(projectRoot);
  const resolved = path.resolve(root, value);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('campaign_closeout_path_escape');
  }
  return resolved;
}

function readJsonObject(filePath: string): JsonRecord {
  const value = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(value)) throw new Error('controlled_closeout_acceptance_request_invalid');
  return value;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function appendJsonl(filePath: string, value: JsonRecord): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function writeJsonAtomic(filePath: string, value: JsonRecord): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

function parseRecordBackedCloseoutConfirmationText(value: string): {
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  closeoutConfirmationPageHash: string;
  deliveryCloseoutReportHash: string;
  closeoutAttemptId: string;
  decision: 'accept' | 'reject';
} {
  const fields = Object.fromEntries(
    [
      'sourceDocumentHash',
      'implementationConfirmationHash',
      'closeoutConfirmationPageHash',
      'deliveryCloseoutReportHash',
    ].map((key) => {
      const match = value.match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'iu'));
      if (!match) throw new Error(`closeout confirmation text missing ${key}`);
      return [key, match[1]];
    })
  ) as Record<string, string>;
  const attemptMatch = value.match(/closeoutAttemptId=([^\s]+)/iu);
  if (!attemptMatch) throw new Error('closeout confirmation text missing closeoutAttemptId');
  const decision = value.includes('确认最终验收并关闭需求')
    ? 'accept'
    : value.includes('拒绝最终验收并保持需求阻塞')
      ? 'reject'
      : null;
  if (!decision) throw new Error('closeout confirmation text missing closeout acceptance phrase');
  return {
    sourceDocumentHash: fields.sourceDocumentHash,
    implementationConfirmationHash: fields.implementationConfirmationHash,
    closeoutConfirmationPageHash: fields.closeoutConfirmationPageHash,
    deliveryCloseoutReportHash: fields.deliveryCloseoutReportHash,
    closeoutAttemptId: attemptMatch[1].trim(),
    decision,
  };
}

function latestCloseoutAttempt(record: JsonRecord, currentAttemptId: string): JsonRecord | null {
  const closeout = isRecord(record.closeout) ? record.closeout : {};
  const attempts = Array.isArray(closeout.attempts) ? closeout.attempts.filter(isRecord) : [];
  return (
    attempts.find(
      (attempt) => text(attempt.closeoutAttemptId ?? attempt.attemptId) === currentAttemptId
    ) ??
    attempts.at(-1) ??
    null
  );
}

function hasRecordBackedAcceptanceProof(input: {
  record: JsonRecord;
  closeoutAttemptId: string;
  attempt: JsonRecord | null;
  report: JsonRecord;
}): boolean {
  const closeout = isRecord(input.record.closeout) ? input.record.closeout : {};
  const acceptanceRequest = isRecord(closeout.acceptanceRequest) ? closeout.acceptanceRequest : {};
  const closeoutDecisionPass = text(closeout.decision).toLowerCase() === 'pass';
  const attemptDecisionPass = text(input.attempt?.decision).toLowerCase() === 'pass';
  return (
    text(closeout.currentAttemptId) === input.closeoutAttemptId &&
    (closeoutDecisionPass || attemptDecisionPass) &&
    input.record.status === 'awaiting_user_acceptance' &&
    input.record.currentMentalModel === 'delivery_confirmation' &&
    input.record.currentStage === 'delivery_confirmation' &&
    input.record.lastEventType === 'delivery_confirmation_user_acceptance_requested' &&
    acceptanceRequest.status === 'awaiting_user_acceptance' &&
    text(acceptanceRequest.closeoutAttemptId) === input.closeoutAttemptId &&
    acceptanceRequest.closeoutConfirmationPageHash === input.report.closeoutConfirmationPageHash &&
    acceptanceRequest.deliveryCloseoutReportHash === input.report.deliveryCloseoutReportHash
  );
}

export function confirmMainAgentRecordBackedCloseout(input: {
  projectRoot: string;
  sourcePath: string;
  renderReportPath: string;
  confirmationText: string;
  confirmedBy: string;
  confirmedAt?: string;
  recordId?: string;
  requirementSetId?: string;
  requirementRecordPath?: string;
  eventLogPath?: string;
  artifactIndexPath?: string;
}): MainAgentControlledCloseoutConfirmationResult {
  try {
    const sourcePath = path.resolve(input.projectRoot, input.sourcePath);
    const renderReportPath = path.resolve(input.projectRoot, input.renderReportPath);
    const sourceText = fs.readFileSync(sourcePath, 'utf8');
    const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
    const confirmation = extracted.value;
    const report = readJsonObject(renderReportPath);
    const provided = parseRecordBackedCloseoutConfirmationText(input.confirmationText);
    const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, confirmation);
    const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
    const recordId = text(input.recordId) || text(report.recordId) || text(confirmation.recordId);
    if (!recordId) throw new Error('closeout acceptance requires recordId');
    const requirementSetId =
      text(input.requirementSetId) ||
      text(report.requirementSetId) ||
      text(confirmation.requirementSetId) ||
      recordId;
    const recordPath = path.resolve(
      input.projectRoot,
      input.requirementRecordPath ??
        path.join(
          '_bmad-output',
          'runtime',
          'requirement-records',
          recordId,
          'requirement-record.json'
        )
    );
    const existingRecord = fs.existsSync(recordPath) ? readJsonObject(recordPath) : {};
    const attempt = latestCloseoutAttempt(existingRecord, provided.closeoutAttemptId);
    const closeoutDeliveryVerdict = isRecord(report.closeoutDeliveryVerdict)
      ? report.closeoutDeliveryVerdict
      : {};
    const finalAcceptanceReview = isRecord(report.finalAcceptanceReview)
      ? report.finalAcceptanceReview
      : {};
    const currentAttemptId =
      text(closeoutDeliveryVerdict.currentAttemptId) ||
      text(finalAcceptanceReview.currentAttemptId);
    const mismatches: string[] = [];
    if (report.mode !== 'closeout-review') mismatches.push('render_report_not_closeout_review');
    if (report.sourceDocumentHash !== sourceDocumentHash) {
      mismatches.push('render_report_source_hash_mismatch');
    }
    if (report.implementationConfirmationHash !== implementationConfirmationHash) {
      mismatches.push('render_report_implementation_confirmation_hash_mismatch');
    }
    if (provided.sourceDocumentHash !== sourceDocumentHash) {
      mismatches.push('confirmation_text_source_hash_mismatch');
    }
    if (provided.implementationConfirmationHash !== implementationConfirmationHash) {
      mismatches.push('confirmation_text_implementation_hash_mismatch');
    }
    if (provided.closeoutConfirmationPageHash !== report.closeoutConfirmationPageHash) {
      mismatches.push('closeout_confirmation_page_hash_mismatch');
    }
    if (provided.deliveryCloseoutReportHash !== report.deliveryCloseoutReportHash) {
      mismatches.push('delivery_closeout_report_hash_mismatch');
    }
    if (provided.closeoutAttemptId !== currentAttemptId) {
      mismatches.push('closeout_attempt_mismatch');
    }
    if (closeoutDeliveryVerdict.ready !== true) {
      mismatches.push('closeout_delivery_verdict_not_ready');
    }
    if (finalAcceptanceReview.ready !== true) {
      mismatches.push('final_acceptance_review_not_ready');
    }
    if (
      !hasRecordBackedAcceptanceProof({
        record: existingRecord,
        closeoutAttemptId: provided.closeoutAttemptId,
        attempt,
        report,
      })
    ) {
      mismatches.push('closeout_user_acceptance_request_proof_missing');
    }
    if (mismatches.length > 0) return { ok: false, exitCode: 3, mismatches };

    const confirmedAt = input.confirmedAt ?? new Date().toISOString();
    const beforeHash = fs.existsSync(recordPath)
      ? sha256Text(fs.readFileSync(recordPath, 'utf8'))
      : null;
    const eventLogPath = path.resolve(
      input.projectRoot,
      input.eventLogPath ??
        path.join('_bmad-output', 'runtime', 'requirement-records', 'mentor-events.jsonl')
    );
    const artifactIndexPath = path.resolve(
      input.projectRoot,
      input.artifactIndexPath ??
        path.join('_bmad-output', 'runtime', 'requirement-records', 'artifact-index.jsonl')
    );
    const commonEvent = {
      recordId,
      requirementSetId,
      confirmedAt,
      confirmedBy: input.confirmedBy,
      sourcePath: sourcePath.replace(/\\/gu, '/'),
      sourceDocumentHash,
      implementationConfirmationHash,
      closeoutAttemptId: provided.closeoutAttemptId,
      closeoutConfirmationPageHash: provided.closeoutConfirmationPageHash,
      deliveryCloseoutReportHash: provided.deliveryCloseoutReportHash,
      confirmationText: input.confirmationText,
      renderReportPath: renderReportPath.replace(/\\/gu, '/'),
    };
    if (provided.decision === 'reject') {
      const event: JsonRecord = {
        eventType: 'closeout_acceptance_rejected',
        ...commonEvent,
        machineCloseoutEventType: 'user_rejected_closeout',
      };
      const closeout = isRecord(existingRecord.closeout) ? existingRecord.closeout : {};
      const acceptanceRequest = isRecord(closeout.acceptanceRequest)
        ? closeout.acceptanceRequest
        : {};
      const nextRecord: JsonRecord = {
        ...existingRecord,
        recordId: existingRecord.recordId ?? recordId,
        requirementSetId: existingRecord.requirementSetId ?? requirementSetId,
        status: 'blocked',
        currentMentalModel: 'delivery_confirmation',
        currentStage: 'delivery_confirmation',
        closeout: {
          ...closeout,
          currentAttemptId: provided.closeoutAttemptId,
          acceptanceRequest: {
            ...acceptanceRequest,
            status: 'user_rejected_closeout',
            rejectedAt: confirmedAt,
            rejectedBy: input.confirmedBy,
          },
          updatedAt: confirmedAt,
        },
        closeoutAcceptance: {
          status: 'user_rejected_closeout',
          confirmedAt,
          confirmedBy: input.confirmedBy,
          closeoutAttemptId: provided.closeoutAttemptId,
          closeoutConfirmationPageHash: provided.closeoutConfirmationPageHash,
          deliveryCloseoutReportHash: provided.deliveryCloseoutReportHash,
          renderReportPath: renderReportPath.replace(/\\/gu, '/'),
        },
        closeoutAcceptanceHistory: [
          ...(Array.isArray(existingRecord.closeoutAcceptanceHistory)
            ? existingRecord.closeoutAcceptanceHistory
            : []),
          event,
        ],
        lastEventType: 'closeout_acceptance_rejected',
        lastAppliedEventId: `closeout_acceptance_rejected:${provided.closeoutAttemptId}`,
        updatedAt: confirmedAt,
      };
      const afterHash = sha256Text(JSON.stringify(nextRecord));
      event.beforeRecordHash = beforeHash;
      event.afterRecordHash = afterHash;
      writeJsonAtomic(recordPath, nextRecord);
      appendJsonl(eventLogPath, event);
      appendJsonl(artifactIndexPath, {
        artifactType: 'requirement_record',
        sourceOfTruthRole: 'control',
        recordId,
        requirementSetId,
        path: recordPath.replace(/\\/gu, '/'),
        eventType: event.eventType,
        contentHash: afterHash,
      });
      return {
        ok: true,
        status: 'blocked',
        exitCode: 0,
        event,
        requirementRecordPath: recordPath.replace(/\\/gu, '/'),
        eventLogPath: eventLogPath.replace(/\\/gu, '/'),
        artifactIndexPath: artifactIndexPath.replace(/\\/gu, '/'),
        sourceUpdated: false,
      };
    }

    const recordClosedReceiptPayload = {
      schemaVersion: 'requirements-contract-record-closed-receipt/v1',
      status: 'user_accepted_closeout',
      eventType: 'record_closed',
      recordId,
      requirementSetId,
      confirmedAt,
      confirmedBy: input.confirmedBy,
      sourceDocumentHash,
      implementationConfirmationHash,
      closeoutAttemptId: provided.closeoutAttemptId,
      closeoutConfirmationPageHash: provided.closeoutConfirmationPageHash,
      deliveryCloseoutReportHash: provided.deliveryCloseoutReportHash,
      renderReportPath: renderReportPath.replace(/\\/gu, '/'),
    };
    const recordClosedReceipt = {
      ...recordClosedReceiptPayload,
      receiptHash: stableHash(recordClosedReceiptPayload),
    };
    const artifactRef = isRecord(report.artifactRef) ? report.artifactRef : {};
    const closeoutProjectionIdentity = isRecord(report.closeoutProjectionIdentity)
      ? report.closeoutProjectionIdentity
      : {};
    const event: JsonRecord = {
      eventType: 'closeout_acceptance_confirmed',
      ...commonEvent,
      htmlPath: text(artifactRef.path ?? closeoutProjectionIdentity.renderedPath).replace(
        /\\/gu,
        '/'
      ),
      machineCloseoutEventType: 'record_closed',
      recordClosedReceiptHash: recordClosedReceipt.receiptHash,
    };
    const closeout = isRecord(existingRecord.closeout) ? existingRecord.closeout : {};
    const acceptanceRequest = isRecord(closeout.acceptanceRequest)
      ? closeout.acceptanceRequest
      : {};
    const sixModelResults = isRecord(existingRecord.sixModelResults)
      ? existingRecord.sixModelResults
      : {};
    const deliveryConfirmation = isRecord(sixModelResults.delivery_confirmation)
      ? sixModelResults.delivery_confirmation
      : {};
    const nextRecord: JsonRecord = {
      ...existingRecord,
      recordId: existingRecord.recordId ?? recordId,
      requirementSetId: existingRecord.requirementSetId ?? requirementSetId,
      status: 'closed',
      currentMentalModel: 'delivery_confirmation',
      currentStage: 'delivery_confirmation',
      sixModelResults: {
        ...sixModelResults,
        delivery_confirmation: {
          ...deliveryConfirmation,
          payloadKind: 'model_result',
          model: 'delivery_confirmation',
          recordId,
          requirementSetId,
          sourceDocumentHash,
          implementationConfirmationHash,
          status: 'pass',
          resultRecordedAt: confirmedAt,
          resultRecordedBy: input.confirmedBy,
          blockingReasons: [],
        },
      },
      closeout: {
        ...closeout,
        currentAttemptId: provided.closeoutAttemptId,
        decision: 'pass',
        acceptanceRequest: {
          ...acceptanceRequest,
          status: 'user_accepted_closeout',
          acceptedAt: confirmedAt,
          acceptedBy: input.confirmedBy,
        },
        updatedAt: confirmedAt,
      },
      closeoutAcceptance: recordClosedReceipt,
      closeoutAcceptanceHistory: [
        ...(Array.isArray(existingRecord.closeoutAcceptanceHistory)
          ? existingRecord.closeoutAcceptanceHistory
          : []),
        event,
      ],
      lastEventType: 'record_closed',
      lastAppliedEventId: `record_closed:${provided.closeoutAttemptId}`,
      updatedAt: confirmedAt,
    };
    const afterHash = sha256Text(JSON.stringify(nextRecord));
    event.beforeRecordHash = beforeHash;
    event.afterRecordHash = afterHash;
    writeJsonAtomic(recordPath, nextRecord);
    appendJsonl(eventLogPath, event);
    appendJsonl(artifactIndexPath, {
      artifactType: 'requirement_record',
      sourceOfTruthRole: 'control',
      recordId,
      requirementSetId,
      path: recordPath.replace(/\\/gu, '/'),
      eventType: 'closeout_acceptance_confirmed',
      contentHash: afterHash,
    });
    return {
      ok: true,
      status: 'record_closed',
      exitCode: 0,
      event,
      recordClosedReceipt,
      requirementRecordPath: recordPath.replace(/\\/gu, '/'),
      eventLogPath: eventLogPath.replace(/\\/gu, '/'),
      artifactIndexPath: artifactIndexPath.replace(/\\/gu, '/'),
      sourceUpdated: false,
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: 2,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function writeExclusiveJson(filePath: string, value: JsonRecord): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, filePath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

export function confirmMainAgentControlledCloseout(input: {
  projectRoot: string;
  requestPath: string;
  confirmationText: string;
  confirmedBy: string;
  confirmedAt?: string;
}): MainAgentControlledCloseoutConfirmationResult {
  try {
    const requestPath = resolveProjectPath(input.projectRoot, input.requestPath);
    const request = readJsonObject(requestPath);
    const confirmationText = input.confirmationText.trim();
    const expectedConfirmationTexts = [request.confirmationText, request.rejectionConfirmationText]
      .map(text)
      .filter(Boolean);
    const requestPayload = { ...request };
    delete requestPayload.acceptanceRequestHash;
    delete requestPayload.confirmationText;
    delete requestPayload.rejectionConfirmationText;
    const expectedRequestHash = text(request.acceptanceRequestHash);
    const provenance = isRecord(request.provenanceHashes) ? request.provenanceHashes : {};
    const hashFields = [
      request.contextHash,
      request.taskReportArtifactHash,
      provenance.contextHash,
      provenance.compileReceiptHash,
      provenance.childClosureSetHash,
      provenance.campaignReportHash,
      provenance.closureReceiptHash,
      provenance.executionFinalJudgeCampaignHash,
      provenance.effectivePassReceiptHash,
      provenance.deliveryCloseoutGateReceiptHash,
    ];
    const mismatches: string[] = [];
    if (request.schemaVersion !== 'main-agent-controlled-closeout-acceptance-request/v1') {
      mismatches.push('controlled_closeout_acceptance_request_schema_invalid');
    }
    if (request.status !== 'awaiting_user_acceptance') {
      mismatches.push('controlled_closeout_not_awaiting_user_acceptance');
    }
    if (!expectedRequestHash || stableHash(requestPayload) !== expectedRequestHash) {
      mismatches.push('controlled_closeout_acceptance_request_hash_mismatch');
    }
    if (!confirmationText || !expectedConfirmationTexts.includes(confirmationText)) {
      mismatches.push('controlled_closeout_confirmation_text_mismatch');
    }
    if (
      !text(request.closeoutAttemptId) ||
      hashFields.some((value) => !HASH_PATTERN.test(text(value)))
    ) {
      mismatches.push('controlled_closeout_acceptance_request_provenance_invalid');
    }
    const accepted = confirmationText.includes('确认当前 Goal closeout 并关闭记录');
    const rejected = confirmationText.includes('拒绝当前 Goal closeout 并保持阻塞');
    if (accepted === rejected) mismatches.push('controlled_closeout_acceptance_intent_invalid');
    if (mismatches.length > 0) return { ok: false, exitCode: 3, mismatches };

    const receiptPath = path.join(
      path.dirname(requestPath),
      accepted ? 'user-closeout-acceptance-receipt.json' : 'user-closeout-rejection-receipt.json'
    );
    const commonReceiptFields = {
      schemaVersion: 'main-agent-goal-record-closed-receipt/v1',
      status: accepted ? 'user_accepted_closeout' : 'user_rejected_closeout',
      eventType: accepted ? 'record_closed' : 'closeout_acceptance_rejected',
      closeoutAttemptId: request.closeoutAttemptId,
      confirmedBy: input.confirmedBy,
      acceptanceRequestHash: expectedRequestHash,
      contextHash: request.contextHash,
      taskReportArtifactHash: request.taskReportArtifactHash,
      effectivePassReceiptHash: provenance.effectivePassReceiptHash,
      deliveryCloseoutGateReceiptHash: provenance.deliveryCloseoutGateReceiptHash,
    };
    let receipt: JsonRecord;
    if (fs.existsSync(receiptPath)) {
      const existing = readJsonObject(receiptPath);
      const existingPayload = { ...existing };
      delete existingPayload.receiptHash;
      if (
        !Object.entries(commonReceiptFields).every(([key, value]) => existing[key] === value) ||
        existing.receiptHash !== stableHash(existingPayload)
      ) {
        throw new Error('closeout_confirmation_already_recorded');
      }
      receipt = existing;
    } else {
      const payload = {
        ...commonReceiptFields,
        confirmedAt: input.confirmedAt ?? new Date().toISOString(),
      };
      receipt = { ...payload, receiptHash: stableHash(payload) };
      writeExclusiveJson(receiptPath, receipt);
    }
    return {
      ok: true,
      status: accepted ? 'record_closed' : 'blocked',
      exitCode: 0,
      acceptanceReceiptPath: receiptPath.replace(/\\/gu, '/'),
      acceptanceReceipt: receipt,
      ...(accepted ? { recordClosedReceipt: receipt } : {}),
    };
  } catch (error) {
    return {
      ok: false,
      exitCode: 2,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function closeoutAdmission(input: { projectRoot: string; requestId: string; recordPath: string }) {
  return withControlStoreLockRetry(() =>
    readControlStoreAuthoritatively(input.recordPath, () =>
      validateGoalExecutionAdmission({
        phase: 'closeout',
        projectRoot: input.projectRoot,
        requestId: input.requestId,
        requirementRecordPath: input.recordPath,
      })
    )
  ) as unknown as {
    requirementRecord: JsonRecord;
    currentRequest: JsonRecord;
    replayState: 'accepted' | 'rejected' | null;
  };
}

function withControlStoreLockRetry<T>(operation: () => T): T {
  let lastError: unknown;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
      if (!(error instanceof Error) || error.message !== 'control_store_lock_held') throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('control_store_lock_wait_timeout');
}

function closeoutDecision(
  identity: ReturnType<typeof controlledRequestIdentity>,
  exactConfirmationText: string
): 'accept' | 'reject' {
  const provided = normalizeExactConfirmationText(exactConfirmationText);
  if (provided === identity.exactAcceptText) return 'accept';
  if (provided === identity.exactRejectText) return 'reject';
  throw new Error('controlled_closeout_confirmation_text_mismatch');
}

function terminalCloseoutResult(input: {
  replayState: 'accepted' | 'rejected' | null;
  decision: 'accept' | 'reject';
  record: JsonRecord;
  artifacts: ReturnType<typeof validateControlledCloseoutArtifacts>;
}): MainAgentControlledCloseoutConfirmationResult | null {
  if (!input.replayState) return null;
  if (
    input.replayState !== input.decision.replace('accept', 'accepted').replace('reject', 'rejected')
  ) {
    throw new Error('controlled_closeout_decision_conflict');
  }
  return {
    ok: true,
    status: input.decision === 'accept' ? 'record_closed_reused' : 'closeout_rejected_reused',
    exitCode: 0,
    issueCode: null,
    recordRevision: Number(input.record.recordRevision),
    requestRef: input.artifacts.requestRef,
    deliveryGateReceiptRef: input.artifacts.gateRef,
    pageRef: input.artifacts.pageRef,
    sourceUpdated: false,
  };
}

export function confirmMainAgentControlledCloseoutByRequestId(input: {
  projectRoot: string;
  requestId: string;
  exactConfirmationText: string;
  confirmedBy?: string;
  confirmedAt?: string;
}): MainAgentControlledCloseoutConfirmationResult {
  try {
    const projectRoot = path.resolve(input.projectRoot);
    const requestId = text(input.requestId);
    if (!/^[A-Za-z0-9._-]+$/u.test(requestId)) {
      throw new Error('controlled_closeout_request_id_invalid');
    }
    const recordPath = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requestId,
      'requirement-record.json'
    );
    let admitted = closeoutAdmission({ projectRoot, requestId, recordPath });
    let artifacts = validateControlledCloseoutArtifacts({
      projectRoot,
      recordId: requestId,
      record: admitted.requirementRecord,
      currentRequest: admitted.currentRequest,
    });
    const decision = closeoutDecision(artifacts.identity, input.exactConfirmationText);
    const replay = terminalCloseoutResult({
      replayState: admitted.replayState,
      decision,
      record: admitted.requirementRecord,
      artifacts,
    });
    if (replay) return replay;

    const confirmedAt = input.confirmedAt ?? new Date().toISOString();
    const statusUpdate = createRuntimeStatusProjectionUpdate({
      recordId: requestId,
      requirementSetId: text(admitted.requirementRecord.requirementSetId) || requestId,
      modelId: 'delivery_confirmation',
      implementationAttemptId: text(admitted.requirementRecord.currentAttemptId),
      sourceDocumentHash: text(admitted.requirementRecord.sourceDocumentHash),
      implementationConfirmationHash: text(
        admitted.requirementRecord.implementationConfirmationHash
      ),
      semanticModelHash: text(admitted.requirementRecord.semanticModelHash),
      stageInputs: [
        { role: 'delivery_closeout_gate', ...artifacts.gateRef },
        { role: 'controlled_closeout_page', ...artifacts.pageRef },
      ],
      deterministicGateOutputs: [{ role: 'controlled_closeout_request', ...artifacts.requestRef }],
      blockerRefs: decision === 'accept' ? [] : ['controlled_closeout_user_rejected'],
      evidenceRefs: [artifacts.gateRef.path, artifacts.requestRef.path, artifacts.pageRef.path],
      authorityClass: 'controlled_closeout',
      decision: decision === 'accept' ? 'pass' : 'block',
      effectiveStatus: decision === 'accept' ? 'pass' : 'blocked',
      createdAt: confirmedAt,
      receiptPath: `runtime/status-decisions/${text(
        admitted.requirementRecord.currentAttemptId
      )}/delivery_confirmation-${decision}.json`,
      projection: {
        blockingReasons: decision === 'accept' ? [] : ['controlled_closeout_user_rejected'],
      },
    });
    if (!statusUpdate.authorityEstablished || !statusUpdate.receiptRef) {
      throw new Error('controlled_closeout_runtime_status_invalid');
    }
    const eventType = decision === 'accept' ? 'record_closed' : 'closeout_acceptance_rejected';
    const beforeRecord = admitted.requirementRecord;
    const nextRevision = Number(beforeRecord.recordRevision) + 1;
    try {
      const commit = withControlStoreLockRetry(() =>
        appendControlEventAndReplay({
          recordPath,
          writerId: 'main-agent-controlled-closeout-confirmation',
          eventType,
          recordedAt: confirmedAt,
          expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(beforeRecord)),
          payload: {
            schemaVersion: 'ControlledCloseoutDecision/v1',
            requestId: artifacts.identity.requestId,
            recordId: requestId,
            decision,
            expectedRecordRevision: beforeRecord.recordRevision,
            committedRecordRevision: nextRevision,
            requestRef: artifacts.requestRef,
            deliveryGateReceiptRef: artifacts.gateRef,
            pageRef: artifacts.pageRef,
            executionFinalCandidateHash: artifacts.identity.executionFinalCandidateHash,
            exactConfirmationTextHash: sha256Text(
              normalizeExactConfirmationText(input.exactConfirmationText)
            ),
          },
          artifactWrites: runtimeStatusProjectionArtifactWrites(statusUpdate),
          reduce: (record) => {
            const closeout = isRecord(record.closeout) ? record.closeout : {};
            const currentRequest = isRecord(closeout.acceptanceRequest)
              ? closeout.acceptanceRequest
              : {};
            return {
              ...record,
              ...runtimeStatusProjectionRecordPatch({
                record,
                modelId: 'delivery_confirmation',
                update: statusUpdate,
              }),
              recordRevision: nextRevision,
              status: decision === 'accept' ? 'closed' : 'blocked',
              currentMentalModel: 'delivery_confirmation',
              currentStage: 'delivery_confirmation',
              closeout: {
                ...closeout,
                acceptanceRequest: {
                  ...currentRequest,
                  status:
                    decision === 'accept' ? 'user_accepted_closeout' : 'user_rejected_closeout',
                  decision,
                  committedRecordRevision: nextRevision,
                },
              },
              closeoutAcceptance: {
                schemaVersion: 'ControlledCloseoutDecision/v1',
                requestId: artifacts.identity.requestId,
                decision,
                requestRef: artifacts.requestRef,
                deliveryGateReceiptRef: artifacts.gateRef,
                pageRef: artifacts.pageRef,
                executionFinalCandidateHash: artifacts.identity.executionFinalCandidateHash,
                committedRecordRevision: nextRevision,
                confirmedAt,
                confirmedBy: input.confirmedBy ?? 'user',
              },
              lastEventType: eventType,
              updatedAt: confirmedAt,
            };
          },
        })
      );
      admitted = closeoutAdmission({ projectRoot, requestId, recordPath });
      artifacts = validateControlledCloseoutArtifacts({
        projectRoot,
        recordId: requestId,
        record: admitted.requirementRecord,
        currentRequest: admitted.currentRequest,
      });
      return {
        ok: true,
        status: decision === 'accept' ? 'record_closed' : 'closeout_rejected',
        exitCode: 0,
        issueCode: null,
        recordRevision: Number(admitted.requirementRecord.recordRevision),
        requestRef: artifacts.requestRef,
        deliveryGateReceiptRef: artifacts.gateRef,
        pageRef: artifacts.pageRef,
        event: commit.event as unknown as JsonRecord,
        requirementRecordPath: recordPath.replace(/\\/gu, '/'),
        eventLogPath: commit.eventLogPath.replace(/\\/gu, '/'),
        sourceUpdated: false,
      };
    } catch (error) {
      if (!String(error).includes('control_store_compare_and_swap_failed')) throw error;
      admitted = closeoutAdmission({ projectRoot, requestId, recordPath });
      artifacts = validateControlledCloseoutArtifacts({
        projectRoot,
        recordId: requestId,
        record: admitted.requirementRecord,
        currentRequest: admitted.currentRequest,
      });
      const concurrentReplay = terminalCloseoutResult({
        replayState: admitted.replayState,
        decision,
        record: admitted.requirementRecord,
        artifacts,
      });
      if (concurrentReplay) return concurrentReplay;
      throw error;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detail = error as {
      field?: unknown;
      path?: unknown;
      actual?: unknown;
      expected?: unknown;
    };
    const diagnosticContext = [
      typeof detail.field === 'string' ? detail.field : '',
      typeof detail.path === 'string' ? detail.path : '',
      detail.actual === undefined ? '' : `actual=${String(detail.actual)}`,
      detail.expected === undefined ? '' : `expected=${String(detail.expected)}`,
    ]
      .filter((value) => value.length > 0)
      .join(':');
    return {
      ok: false,
      status: 'blocked',
      exitCode: 3,
      issueCode: message,
      error: diagnosticContext ? `${message}:${diagnosticContext}` : message,
      sourceUpdated: false,
    };
  }
}
