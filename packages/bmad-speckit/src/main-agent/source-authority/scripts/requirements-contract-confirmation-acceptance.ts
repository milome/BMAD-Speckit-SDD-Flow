/* eslint-disable no-console */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  extractRequirementsContractImplementationConfirmation,
  implementationConfirmationHashFor,
  sourceDocumentHashFor,
  type ImplementationConfirmation,
} from './requirements-contract-implementation-confirmation-codec';
import {
  appendControlEventAndReplay,
  readJson,
  receiptPathForEvent,
  sha256Json,
  sha256Text,
  type ControlCommitResult,
  type ControlStoreCommitDeps,
} from './requirement-record-control-store';
import type { JsonObject } from './requirement-record-live-schema-gate';
import {
  projectControlledIngestWriterRegistry,
  type ControlledIngestWriterRegistrySnapshot,
} from './requirements-contract-controlled-ingest-writer-registry';
import {
  validateRequirementsEffectivePassReceipt,
  type RequirementsEffectivePassReceipt,
} from './requirements-contract-requirements-effective-pass-gate';

const CONFIRMATION_WRITER_ID = 'requirements-confirmation-ingest';
const MODELS = [
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
] as const;

type ConfirmationArgs = Record<string, string | undefined>;

export interface RequirementsContractConfirmationAcceptanceResult {
  ok: boolean;
  action: 'confirm-scope';
  exitCode: number;
  authority: 'main-agent-controlled-confirmation';
  requirementRecordPath: string;
  renderReportPath: string;
  eventLogPath?: string;
  receiptPath?: string;
  artifactIndexPaths?: string[];
  artifactPaths?: string[];
  sourceUpdated?: boolean;
  event?: JsonObject;
  mismatches?: string[];
  error?: string;
}

interface ConfirmationInput {
  root: string;
  args: ConfirmationArgs;
  controlStoreDeps?: ControlStoreCommitDeps;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function objects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is JsonObject =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
    : [];
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/');
}

function resolvePath(root: string, value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(root, value);
}

function readConfirmationText(root: string, args: ConfirmationArgs): string {
  if (text(args.confirmationTextFile)) {
    return fs.readFileSync(resolvePath(root, text(args.confirmationTextFile)), 'utf8');
  }
  return text(args.confirmationText);
}

function parseConfirmationHashes(confirmationText: string): JsonObject {
  if (!confirmationText.includes('确认以上范围进入下一阶段')) {
    throw new Error('confirmation_text_missing_exact_acceptance_phrase');
  }
  const result: JsonObject = {};
  for (const key of [
    'sourceDocumentHash',
    'implementationConfirmationHash',
    'confirmationPageHash',
  ]) {
    const match = confirmationText.match(new RegExp(`${key}=(sha256:[a-f0-9]{64})`, 'iu'));
    if (!match) throw new Error(`confirmation_text_missing_${key}`);
    result[key] = match[1];
  }
  const requestId = confirmationText.match(/requestId=([A-Za-z0-9._:-]+)/iu);
  if (requestId) result.requestId = requestId[1];
  return result;
}

function effectivePassReceiptRef(
  root: string,
  args: ConfirmationArgs,
  confirmation: ImplementationConfirmation
):
  | {
      ref: JsonObject;
      receipt: RequirementsEffectivePassReceipt;
    }
  | {
      mismatches: string[];
      error?: string;
    } {
  const receiptArg = text(args.requirementsEffectivePassReceipt);
  if (!receiptArg) return { mismatches: ['requirements_effective_pass_receipt_missing'] };
  const receiptPath = resolvePath(root, receiptArg);
  let receipt: RequirementsEffectivePassReceipt;
  try {
    receipt = validateRequirementsEffectivePassReceipt(readJson(receiptPath));
  } catch (error) {
    return {
      mismatches: ['requirements_effective_pass_receipt_invalid'],
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const drilldown = object(confirmation.preConfirmationDrilldown);
  const criticalAuditor = object(drilldown.criticalAuditor);
  const latestReceiptHash = text(criticalAuditor.latestReceiptHash);
  if (!latestReceiptHash) {
    return { mismatches: ['requirements_effective_pass_receipt_missing'] };
  }
  if (latestReceiptHash !== receipt.receiptHash) {
    return { mismatches: ['requirements_effective_pass_receipt_stale'] };
  }
  return {
    receipt,
    ref: {
      path: normalizePath(receiptPath),
      schemaVersion: receipt.schemaVersion,
      receiptHash: receipt.receiptHash,
      actorClass: receipt.actorClass,
      judgeRole: receipt.judgeRole,
      decision: receipt.decision,
    },
  };
}

function reportArtifactPath(root: string, reportPath: string, value: unknown): string {
  const candidate =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object' && !Array.isArray(value)
        ? text((value as JsonObject).path)
        : '';
  if (!candidate) return '';
  return path.isAbsolute(candidate) ? candidate : path.resolve(path.dirname(reportPath), candidate);
}

function buildGlobalContractTraceabilityPolicy(
  confirmation: ImplementationConfirmation
): JsonObject {
  const taskRegistryPolicy = object(confirmation.taskRegistryPolicy);
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
    taskRegistryField: text(taskRegistryPolicy.canonicalTaskRegistryField) || 'implementationTasks',
    traceTaskRefsMustResolveTo:
      text(taskRegistryPolicy.traceTaskRefsMustResolveTo) || 'implementationTasks[].id',
    readinessFailureWhenUnresolved: taskRegistryPolicy.readinessFailureWhenUnresolved !== false,
    closeoutFailureWhenUnresolved: taskRegistryPolicy.closeoutFailureWhenUnresolved !== false,
  };
}

function buildTraceStatusPolicy(): JsonObject {
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

function modelResult(
  recordId: string,
  requirementSetId: string,
  sourceDocumentHash: string,
  implementationConfirmationHash: string,
  confirmationPageHash: string,
  model: (typeof MODELS)[number],
  status: 'pass' | 'not_established',
  recordedAt: string,
  recordedBy: string,
  renderReportPath: string,
  htmlPath: string
): JsonObject {
  return {
    payloadKind: 'model_result',
    model,
    recordId,
    requirementSetId,
    sourceDocumentHash,
    implementationConfirmationHash,
    status,
    resultRecordedAt: recordedAt,
    resultRecordedBy: recordedBy,
    blockingReasons: status === 'pass' ? [] : [`${model}_not_established`],
    sourceRefs: [
      {
        sourceType: status === 'pass' ? 'confirmation_event' : 'six_model_initialization',
        id: status === 'pass' ? 'confirmation_recorded' : `${model}:not_established`,
      },
    ],
    currentHashes: {
      sourceDocumentHash,
      implementationConfirmationHash,
      confirmationPageHash,
    },
    ...(model === 'requirement_confirmation'
      ? {
          renderReportPath,
          htmlPath,
        }
      : {}),
  };
}

function initialDraftRecord(input: {
  recordId: string;
  requirementSetId: string;
  sourcePath: string;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmation: ImplementationConfirmation;
  writerRegistry: ControlledIngestWriterRegistrySnapshot;
  recordedAt: string;
}): JsonObject {
  const entryFlow = text(input.confirmation.entryFlow);
  const entryFlowClass = text(input.confirmation.entryFlowClass);
  const workflowAdapter = text(input.confirmation.workflowAdapter);
  return {
    schemaVersion: 'requirement-record/v1',
    recordId: input.recordId,
    requirementSetId: input.requirementSetId,
    sourcePath: normalizePath(input.sourcePath),
    status: 'draft',
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    confirmationHistory: [],
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry: input.writerRegistry.controlledIngestWriterRegistry,
    controlledIngestWriterRegistryHash: input.writerRegistry.controlledIngestWriterRegistryHash,
    ...(entryFlow ? { entryFlow } : {}),
    ...(entryFlowClass ? { entryFlowClass } : {}),
    ...(workflowAdapter ? { workflowAdapter } : {}),
    ...(input.confirmation.contractAuthoringRequired === true
      ? { contractAuthoringRequired: true }
      : {}),
    updatedAt: input.recordedAt,
  };
}

function prepareDraftRecord(input: {
  recordPath: string;
  draft: JsonObject;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
}): { record: JsonObject; bootstrap: boolean } {
  if (!fs.existsSync(input.recordPath)) {
    return { record: input.draft, bootstrap: true };
  }
  const existing = readJson(input.recordPath);
  const history = objects(existing.confirmationHistory);
  const status = text(existing.status);
  if (status === 'draft' && history.length === 0) {
    if (text(existing.recordId) && text(existing.recordId) !== text(input.draft.recordId)) {
      throw new Error('confirmation_record_id_mismatch');
    }
    if (
      text(existing.requirementSetId) &&
      text(existing.requirementSetId) !== text(input.draft.requirementSetId)
    ) {
      throw new Error('confirmation_requirement_set_id_mismatch');
    }
    if (
      text(existing.sourceDocumentHash) &&
      text(existing.sourceDocumentHash) !== input.sourceDocumentHash
    ) {
      throw new Error('confirmation_existing_source_hash_mismatch');
    }
    if (
      text(existing.implementationConfirmationHash) &&
      text(existing.implementationConfirmationHash) !== input.implementationConfirmationHash
    ) {
      throw new Error('confirmation_existing_implementation_hash_mismatch');
    }
    const merged = {
      ...input.draft,
      ...existing,
      controlledIngestWriterRegistryRequired: true,
      controlledIngestWriterRegistry: input.draft.controlledIngestWriterRegistry,
      controlledIngestWriterRegistryHash: input.draft.controlledIngestWriterRegistryHash,
      sourceDocumentHash: input.sourceDocumentHash,
      implementationConfirmationHash: input.implementationConfirmationHash,
    };
    return { record: merged, bootstrap: true };
  }
  return { record: existing, bootstrap: false };
}

function buildUpdatedSourceDocument(input: {
  sourceText: string;
  extracted: ReturnType<typeof extractRequirementsContractImplementationConfirmation>;
  sourceDocumentHash: string;
  implementationConfirmationHash: string;
  confirmationPageHash: string;
  reportPath: string;
  htmlPath: string;
  confirmationText: string;
  confirmedAt: string;
  confirmedBy: string;
}): string {
  const nextConfirmation: ImplementationConfirmation = {
    ...input.extracted.value,
    status: 'user_confirmed',
    confirmedAt: input.confirmedAt,
    confirmedBy: input.confirmedBy,
    sourceDocumentHash: input.sourceDocumentHash,
    implementationConfirmationHash: input.implementationConfirmationHash,
    reconfirmationRequest: null,
    confirmationRender: {
      ...object(input.extracted.value.confirmationRender),
      htmlPath: normalizePath(input.htmlPath),
      reportPath: normalizePath(input.reportPath),
      htmlHash: input.confirmationPageHash,
      confirmationPhrase: input.confirmationText,
    },
  };
  const replacement = yaml
    .dump(
      { implementationConfirmation: nextConfirmation },
      { lineWidth: 120, noRefs: true, sortKeys: false }
    )
    .trimEnd()
    .split('\n');
  const trailingBlankLines = input.extracted.blockText.match(/\n+$/u)?.[0].length ?? 0;
  for (let index = 0; index < trailingBlankLines; index += 1) replacement.push('');
  const lines = input.sourceText.replace(/\r\n/g, '\n').split('\n');
  const nextSource = lines
    .slice(0, input.extracted.startLine - 1)
    .concat(replacement, lines.slice(input.extracted.endLine))
    .join('\n');
  return nextSource;
}

function failure(
  input: {
    recordPath: string;
    reportPath: string;
  },
  mismatches: string[],
  error?: string
): RequirementsContractConfirmationAcceptanceResult {
  return {
    ok: false,
    action: 'confirm-scope',
    exitCode: 3,
    authority: 'main-agent-controlled-confirmation',
    requirementRecordPath: normalizePath(input.recordPath),
    renderReportPath: normalizePath(input.reportPath),
    mismatches,
    ...(error ? { error } : {}),
  };
}

export function runRequirementsContractConfirmationAcceptance(
  input: ConfirmationInput
): RequirementsContractConfirmationAcceptanceResult {
  const root = path.resolve(input.root);
  const args = input.args;
  const sourceArg = text(args.source);
  if (!sourceArg) throw new Error('confirm-scope requires --source <source-document.md>');
  const sourcePath = resolvePath(root, sourceArg);
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const extracted = extractRequirementsContractImplementationConfirmation(sourceText);
  const confirmation = extracted.value;
  const reportArg = text(args.renderReport);
  if (!reportArg) {
    throw new Error('confirm-scope requires --render-report <confirmation-render-report.json>');
  }
  const renderReportPath = resolvePath(root, reportArg);
  const report = readJson(renderReportPath);
  const confirmationText = readConfirmationText(root, args);
  if (!confirmationText) {
    throw new Error(
      'confirm-scope requires --confirmation-text <exact chat confirmation> or --confirmation-text-file <file>'
    );
  }

  const sourceDocumentHash = sourceDocumentHashFor(sourceText, extracted.blockText, confirmation);
  const implementationConfirmationHash = implementationConfirmationHashFor(confirmation);
  const recordId = text(args.recordId) || text(report.recordId) || text(confirmation.recordId);
  if (!recordId) throw new Error('confirm-scope requires recordId');
  const requirementSetId =
    text(args.requirementSetId) ||
    text(report.requirementSetId) ||
    text(confirmation.requirementSetId) ||
    recordId;
  const runtimeRoot = resolvePath(
    root,
    text(args.runtimeRoot) || '_bmad-output/runtime/requirement-records'
  );
  const recordPath = resolvePath(
    root,
    text(args.requirementRecord) || path.join(runtimeRoot, recordId, 'requirement-record.json')
  );
  const htmlPath = reportArtifactPath(root, renderReportPath, report.artifactRef ?? report.outPath);
  const provided = parseConfirmationHashes(confirmationText);
  const mismatches: string[] = [];
  if (
    (text(args.recordId) && text(args.recordId) !== text(report.recordId)) ||
    (text(args.recordId) && text(args.recordId) !== text(confirmation.recordId)) ||
    (text(report.recordId) &&
      text(confirmation.recordId) &&
      text(report.recordId) !== text(confirmation.recordId)) ||
    (text(args.requirementSetId) &&
      text(args.requirementSetId) !== text(report.requirementSetId)) ||
    (text(args.requirementSetId) &&
      text(args.requirementSetId) !== text(confirmation.requirementSetId)) ||
    (text(report.requirementSetId) &&
      text(confirmation.requirementSetId) &&
      text(report.requirementSetId) !== text(confirmation.requirementSetId))
  ) {
    mismatches.push('confirmation_record_identity_mismatch');
  }
  if (report.confirmability !== 'confirmable') {
    mismatches.push('render_report_not_confirmable');
  }
  if (objects(report.blockingIssues).length > 0) {
    mismatches.push('render_report_blocking_issues_present');
  }
  if (text(report.sourceDocumentHash) !== sourceDocumentHash) {
    mismatches.push('render_report_source_hash_mismatch');
  }
  if (text(report.implementationConfirmationHash) !== implementationConfirmationHash) {
    mismatches.push('render_report_implementation_confirmation_hash_mismatch');
  }
  if (provided.sourceDocumentHash !== sourceDocumentHash) {
    mismatches.push('confirmation_text_source_hash_mismatch');
  }
  if (provided.implementationConfirmationHash !== implementationConfirmationHash) {
    mismatches.push('confirmation_text_implementation_hash_mismatch');
  }
  const confirmationPageHash = text(provided.confirmationPageHash);
  if (confirmationPageHash !== text(report.confirmationPageHash)) {
    mismatches.push('confirmation_page_hash_mismatch');
  }
  if (htmlPath && fs.existsSync(htmlPath)) {
    const actualHtmlFileHash = sha256Text(fs.readFileSync(htmlPath, 'utf8'));
    if (text(report.actualHtmlFileHash) && text(report.actualHtmlFileHash) !== actualHtmlFileHash) {
      mismatches.push('render_report_actual_html_hash_mismatch');
    }
  } else {
    mismatches.push('confirmation_html_artifact_missing');
  }
  if (args.updateSource === 'false') mismatches.push('atomic_source_update_required');
  const effectivePass = effectivePassReceiptRef(root, args, confirmation);
  if ('mismatches' in effectivePass) {
    mismatches.push(...effectivePass.mismatches);
  }
  if (mismatches.length > 0) {
    return failure(
      { recordPath, reportPath: renderReportPath },
      mismatches,
      'mismatches' in effectivePass ? effectivePass.error : undefined
    );
  }

  const confirmedAt = text(args.confirmedAt) || new Date().toISOString();
  const confirmedBy = text(args.confirmedBy) || 'main-agent-orchestration';
  const updatedSourceText = buildUpdatedSourceDocument({
    sourceText,
    extracted,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    reportPath: renderReportPath,
    htmlPath,
    confirmationText,
    confirmedAt,
    confirmedBy,
  });
  const htmlText = fs.readFileSync(htmlPath, 'utf8');
  const renderReportText = fs.readFileSync(renderReportPath, 'utf8');
  let writerRegistry: ControlledIngestWriterRegistrySnapshot;
  try {
    writerRegistry = projectControlledIngestWriterRegistry(
      confirmation,
      sourceDocumentHash,
      implementationConfirmationHash
    );
  } catch (error) {
    return failure(
      { recordPath, reportPath: renderReportPath },
      ['controlled_ingest_writer_invalid'],
      error instanceof Error ? error.message : String(error)
    );
  }
  const draft = initialDraftRecord({
    recordId,
    requirementSetId,
    sourcePath,
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmation,
    writerRegistry,
    recordedAt: confirmedAt,
  });
  const prepared = prepareDraftRecord({
    recordPath,
    draft,
    sourceDocumentHash,
    implementationConfirmationHash,
  });
  const localArtifactIndexPath = path.join(path.dirname(recordPath), 'artifact-index.jsonl');
  const globalArtifactIndexPath = path.join(
    path.dirname(path.dirname(recordPath)),
    'artifact-index.jsonl'
  );
  const eventId = `confirmation_recorded:${confirmedAt}:${recordId}`;
  const eventPath = receiptPathForEvent(recordPath, eventId);
  const frozenIrPath = path.join(
    path.dirname(recordPath),
    'authority',
    'requirement-confirmation-ir.json'
  );
  const frozenIr: JsonObject = {
    schemaVersion: 'requirements-contract-confirmation-ir/v1',
    recordId,
    requirementSetId,
    sourcePath: normalizePath(sourcePath),
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationPageHash,
    renderReportPath: normalizePath(renderReportPath),
    htmlPath: normalizePath(htmlPath),
    implementationConfirmation: confirmation,
    controlledIngestWriterRegistryHash: writerRegistry.controlledIngestWriterRegistryHash,
    frozenAt: confirmedAt,
  };
  const frozenIrText = `${JSON.stringify(frozenIr, null, 2)}\n`;
  const frozenIrHash = sha256Json(frozenIr);
  const frozenIrContentHash = sha256Text(frozenIrText);
  const frozenConfirmation = object(
    frozenIr.implementationConfirmation
  ) as ImplementationConfirmation;
  const confirmedAuthorityIdentity: JsonObject = {
    schemaVersion: 'requirements-confirmed-authority-identity/v1',
    frozenConfirmationIrRef: {
      path: normalizePath(frozenIrPath),
      semanticHash: frozenIrHash,
      contentHash: frozenIrContentHash,
    },
  };
  if (!('ref' in effectivePass)) {
    throw new Error(effectivePass.error ?? 'requirements_effective_pass_receipt_missing');
  }
  const requirementsEffectivePassReceiptRef = effectivePass.ref;
  const confirmationAuthorityTupleInput: JsonObject = {
    schemaVersion: 'requirements-confirmation-authority-tuple-input/v1',
    requirementRecordId: recordId,
    sourceSnapshotHash: sourceDocumentHash,
    implementationConfirmationSemanticHash: implementationConfirmationHash,
    confirmedAuthorityIdentity,
    RequirementsEffectivePassReceiptRef: requirementsEffectivePassReceiptRef,
  };
  const authorityArtifactBindings = [
    {
      role: 'source_document',
      path: normalizePath(sourcePath),
      contentHash: sha256Text(updatedSourceText),
    },
    {
      role: 'confirmation_html',
      path: normalizePath(htmlPath),
      contentHash: sha256Text(htmlText),
    },
    {
      role: 'confirmation_render_report',
      path: normalizePath(renderReportPath),
      contentHash: sha256Text(renderReportText),
    },
  ];
  const eventPayload: JsonObject = {
    eventType: 'confirmation_recorded',
    eventId,
    recordId,
    requirementSetId,
    confirmedAt,
    confirmedBy,
    sourcePath: normalizePath(sourcePath),
    sourceDocumentHash,
    sourceDocumentHashScope:
      text(report.sourceDocumentHashScope) || 'semantic_source_excluding_confirmation_bookkeeping',
    implementationConfirmationHash,
    implementationConfirmationHashScope:
      text(report.implementationConfirmationHashScope) ||
      'semantic_implementation_confirmation_excluding_bookkeeping',
    confirmationPageHash,
    confirmationText,
    renderReportPath: normalizePath(renderReportPath),
    htmlPath: normalizePath(htmlPath),
    frozenConfirmationIrRef: {
      path: normalizePath(frozenIrPath),
      semanticHash: frozenIrHash,
      contentHash: frozenIrContentHash,
    },
    confirmedAuthorityIdentity,
    requirementsEffectivePassReceiptRef,
    confirmationAuthorityTupleInput,
    authorityArtifactBindings,
    entryFlow: text(confirmation.entryFlow) || 'standalone_tasks',
    ...(text(confirmation.entryFlowClass)
      ? { entryFlowClass: text(confirmation.entryFlowClass) }
      : {}),
    ...(text(confirmation.workflowAdapter)
      ? { workflowAdapter: text(confirmation.workflowAdapter) }
      : {}),
    ...(confirmation.contractAuthoringRequired === true ? { contractAuthoringRequired: true } : {}),
    globalContractTraceabilityPolicy: buildGlobalContractTraceabilityPolicy(confirmation),
    traceStatusPolicy: buildTraceStatusPolicy(),
    writerId: CONFIRMATION_WRITER_ID,
    writerRegistryHash: writerRegistry.controlledIngestWriterRegistryHash,
    writerHash: writerRegistry.confirmationWriter.writerHash,
    ...(text(provided.requestId) ? { requestId: text(provided.requestId) } : {}),
  };
  const artifactEntries: JsonObject[] = [
    {
      artifactType: 'requirement_record',
      sourceOfTruthRole: 'control',
      recordId,
      requirementSetId,
      path: normalizePath(recordPath),
      eventType: 'confirmation_recorded',
      contentHash: confirmationPageHash,
      receiptPath: normalizePath(eventPath),
    },
    {
      artifactType: 'requirement_confirmation_ir',
      sourceOfTruthRole: 'frozen_authoritative_ir',
      recordId,
      requirementSetId,
      path: normalizePath(frozenIrPath),
      semanticHash: frozenIrHash,
      contentHash: frozenIrContentHash,
      receiptPath: normalizePath(eventPath),
    },
    {
      artifactType: 'requirements_effective_pass_receipt',
      sourceOfTruthRole: 'evidence',
      recordId,
      requirementSetId,
      path: text(requirementsEffectivePassReceiptRef.path),
      contentHash: text(requirementsEffectivePassReceiptRef.receiptHash),
      receiptPath: normalizePath(eventPath),
    },
    ...authorityArtifactBindings.map((binding) => ({
      artifactType: binding.role,
      sourceOfTruthRole: 'acceptance_transaction_input',
      recordId,
      requirementSetId,
      path: binding.path,
      contentHash: binding.contentHash,
      receiptPath: normalizePath(eventPath),
    })),
  ];
  let commit: ControlCommitResult;
  try {
    commit = appendControlEventAndReplay(
      {
        recordPath,
        writerId: CONFIRMATION_WRITER_ID,
        eventType: 'confirmation_recorded',
        eventId,
        payload: eventPayload,
        recordedAt: confirmedAt,
        payloadSchemaVersion: 'confirmation_recorded/v1',
        bootstrapConfirmation: prepared.bootstrap,
        bootstrapRecord: prepared.record,
        artifactIndexUpdates: [
          { path: localArtifactIndexPath, entries: artifactEntries },
          {
            path: globalArtifactIndexPath,
            entries: artifactEntries.map((entry) => ({ ...entry, indexScope: 'global' })),
          },
        ],
        artifactWrites: [
          {
            path: sourcePath,
            content: updatedSourceText,
            contentHash: sha256Text(updatedSourceText),
            expectedBeforeHash: sha256Text(sourceText),
          },
          {
            path: htmlPath,
            content: htmlText,
            contentHash: sha256Text(htmlText),
            expectedBeforeHash: sha256Text(htmlText),
          },
          {
            path: renderReportPath,
            content: renderReportText,
            contentHash: sha256Text(renderReportText),
            expectedBeforeHash: sha256Text(renderReportText),
          },
          {
            path: frozenIrPath,
            content: frozenIrText,
            contentHash: frozenIrContentHash,
          },
        ],
        reduce: (record, payload) => {
          const sixModelResults: JsonObject = {};
          for (const model of MODELS) {
            sixModelResults[model] = modelResult(
              recordId,
              requirementSetId,
              sourceDocumentHash,
              implementationConfirmationHash,
              confirmationPageHash,
              model,
              model === 'requirement_confirmation' ? 'pass' : 'not_established',
              confirmedAt,
              confirmedBy,
              renderReportPath,
              htmlPath
            );
          }
          const historyEvent: JsonObject = {
            eventType: 'confirmation_recorded',
            recordId,
            requirementSetId,
            confirmedAt,
            confirmedBy,
            sourcePath: normalizePath(sourcePath),
            sourceDocumentHash,
            sourceDocumentHashScope:
              text(payload.sourceDocumentHashScope) ||
              'semantic_source_excluding_confirmation_bookkeeping',
            implementationConfirmationHash,
            implementationConfirmationHashScope:
              text(payload.implementationConfirmationHashScope) ||
              'semantic_implementation_confirmation_excluding_bookkeeping',
            confirmationPageHash,
            confirmationText,
            renderReportPath: normalizePath(renderReportPath),
            htmlPath: normalizePath(htmlPath),
            entryFlow: text(frozenConfirmation.entryFlow) || 'standalone_tasks',
            ...(text(frozenConfirmation.entryFlowClass)
              ? { entryFlowClass: text(frozenConfirmation.entryFlowClass) }
              : {}),
            ...(text(frozenConfirmation.workflowAdapter)
              ? { workflowAdapter: text(frozenConfirmation.workflowAdapter) }
              : {}),
            ...(frozenConfirmation.contractAuthoringRequired === true
              ? { contractAuthoringRequired: true }
              : {}),
            globalContractTraceabilityPolicy:
              buildGlobalContractTraceabilityPolicy(frozenConfirmation),
            traceStatusPolicy: buildTraceStatusPolicy(),
          };
          const history = [...objects(record.confirmationHistory), historyEvent];
          return {
            ...record,
            status: 'user_confirmed',
            recordId,
            requirementSetId,
            sourcePath: normalizePath(sourcePath),
            sourceDocumentHash,
            implementationConfirmationHash,
            confirmationPageHash,
            latestConfirmationProjectionHash: confirmationPageHash,
            confirmationHistory: history,
            sixModelResults,
            flow: text(frozenConfirmation.entryFlow) || text(record.flow) || 'standalone_tasks',
            stage: 'requirement_confirmation',
            currentStage: 'requirement_confirmation',
            currentMentalModel: 'requirement_confirmation',
            entryFlow:
              text(frozenConfirmation.entryFlow) || text(record.entryFlow) || 'standalone_tasks',
            ...(text(frozenConfirmation.entryFlowClass)
              ? { entryFlowClass: text(frozenConfirmation.entryFlowClass) }
              : {}),
            ...(text(frozenConfirmation.workflowAdapter)
              ? { workflowAdapter: text(frozenConfirmation.workflowAdapter) }
              : {}),
            ...(frozenConfirmation.contractAuthoringRequired === true
              ? { contractAuthoringRequired: true }
              : {}),
            globalContractTraceabilityPolicy:
              buildGlobalContractTraceabilityPolicy(frozenConfirmation),
            traceStatusPolicy: buildTraceStatusPolicy(),
            lastEventType: 'confirmation_recorded',
            updatedAt: confirmedAt,
          };
        },
      },
      input.controlStoreDeps
    );
  } catch (error) {
    return failure(
      { recordPath, reportPath: renderReportPath },
      ['control_store_commit_failed'],
      error instanceof Error ? error.message : String(error)
    );
  }

  const committedRecord = readJson(recordPath);
  return {
    ok: true,
    action: 'confirm-scope',
    exitCode: 0,
    authority: 'main-agent-controlled-confirmation',
    requirementRecordPath: normalizePath(recordPath),
    renderReportPath: normalizePath(renderReportPath),
    eventLogPath: normalizePath(commit.eventLogPath),
    receiptPath: normalizePath(commit.receiptPath),
    artifactIndexPaths: commit.artifactIndexPaths.map(normalizePath),
    artifactPaths: commit.artifactPaths.map(normalizePath),
    sourceUpdated: true,
    event: {
      ...eventPayload,
      afterRecordHash: text(committedRecord.recordHash),
      eventHash: commit.event.eventHash,
    },
  };
}

export function mainRequirementsContractConfirmationAcceptance(argv: string[]): number {
  const args: ConfirmationArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--json') continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected positional argument: ${token}`);
    const key = token.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${token}`);
    args[key] = value;
    index += 1;
  }
  const result = runRequirementsContractConfirmationAcceptance({
    root: text(args.cwd) || process.cwd(),
    args,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : result.exitCode;
}

if (
  require.main === module &&
  /(^|[\\/])requirements-contract-confirmation-acceptance\.[cm]?js$/u.test(process.argv[1] ?? '')
) {
  try {
    process.exitCode = mainRequirementsContractConfirmationAcceptance(process.argv.slice(2));
  } catch (error) {
    console.error(
      JSON.stringify(
        { ok: false, error: error instanceof Error ? error.message : String(error) },
        null,
        2
      )
    );
    process.exitCode = 2;
  }
}
