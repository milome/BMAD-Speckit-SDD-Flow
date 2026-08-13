/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  evaluateAuditTriadConvergence,
  sha256Json as sha256AuditTriadJson,
  type AuditTriadExecutionPlan,
  type AuditTriadRepairEvidenceBinding,
  type AuditTriadRoundReceipt,
} from './audit-triad-orchestrator';
import { validateAuditTriadProducerArtifacts } from './audit-triad-producer-artifact-validator';
import {
  appendControlEventAndReplay,
  canonicalizeRequirementRecord,
  eventLogPathForRecord,
  receiptPathForEvent,
  sha256Json,
  sha256Text,
} from './requirement-record-control-store';
import { openReconfirmationRequests } from './reconfirmation-runtime';
import {
  createRuntimeStatusProjectionUpdate,
  runtimeStatusProjectionArtifactWrites,
  runtimeStatusProjectionRecordPatch,
  type RuntimeStatusProjectionUpdate,
} from './requirements-contract-runtime-status-decision-receipt';
import { resolveVerifiedSixModelStatus } from './verified-six-model-status-facade';
import { validateSourcePrdLintTransitionFromFiles } from './requirements-contract-validation-facade';

type JsonObject = Record<string, unknown>;
type AuditReviewDecision = 'pass' | 'blocked';

export interface AuditReviewGateArtifactSnapshot {
  role: string;
  path: string;
  contentHash: string;
}

export interface AuditReviewGateCommitBundle {
  schemaVersion: 'audit-review-gate-commit-bundle/v1';
  decision: AuditReviewDecision;
  blockingReasons: string[];
  plan: {
    path: string;
    contentHash: string;
    value: AuditTriadExecutionPlan;
  };
  roundInputs: AuditReviewGateArtifactSnapshot[];
  repairInputs: AuditReviewGateArtifactSnapshot[];
  frozenInputs: AuditReviewGateArtifactSnapshot[];
  report: {
    path: string;
    contentHash: string;
    content: string;
    value: JsonObject;
  };
  runtimeStatus: {
    path: string;
    contentHash: string;
    content: string;
    value: JsonObject;
  };
  control: {
    transactionId: string;
    eventId: string;
    eventHash: string;
    beforeRecordHash: string;
    afterRecordHash: string;
    commitReceiptPath: string;
    commitReceiptContentHash: string;
    eventLogPath: string;
  };
}

interface AuditReviewGateSnapshot {
  schemaVersion: 'audit-review-gate-snapshot/v1';
  gateInvocationId: string;
  eventId: string;
  recordId: string;
  requirementSetId: string;
  attemptId: string;
  implementationAttemptId: string;
  evaluatedAt: string;
  evaluatedBy: string;
  decision: AuditReviewDecision;
  blockingReasons: string[];
  plan: AuditReviewGateCommitBundle['plan'];
  roundInputs: AuditReviewGateArtifactSnapshot[];
  repairInputs: AuditReviewGateArtifactSnapshot[];
  frozenInputs: AuditReviewGateArtifactSnapshot[];
  report: AuditReviewGateCommitBundle['report'];
  runtimeStatus: AuditReviewGateCommitBundle['runtimeStatus'];
  snapshotHash: string;
}

interface ParsedArgs {
  requirementRecord?: string;
  attemptId?: string;
  plan?: string;
  rounds?: string;
  round?: string[];
  repairReceipt?: string[];
  repairFeedbackDispatch?: string[];
  reportPath?: string;
  evaluatedBy?: string;
  evaluatedAt?: string;
  json?: boolean;
  help?: boolean;
}

export interface MainAuditReviewGateDeps {
  beforeControlCommit?: () => void;
  onCommitted?: (bundle: Readonly<AuditReviewGateCommitBundle>) => void;
  writeOutput?: (value: string) => void;
}

function isDirectMainAgentAuditReviewGateCli(entry: string | undefined): boolean {
  return /(^|[\\/])main-agent-audit-review-gate(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { round: [], repairReceipt: [], repairFeedbackDispatch: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg
        .slice(2)
        .replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase()) as keyof ParsedArgs;
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      if (key === 'round' || key === 'repairReceipt' || key === 'repairFeedbackDispatch') {
        (out[key] as string[]).push(value);
      } else {
        (out as Record<string, string | string[] | boolean | undefined>)[key] = value;
      }
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nested(value: unknown): JsonObject {
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

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function readJsonSnapshot(file: string): {
  value: JsonObject;
  contentHash: string;
} {
  const content = fs.readFileSync(file);
  const parsed = JSON.parse(content.toString('utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return {
    value: parsed as JsonObject,
    contentHash: `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`,
  };
}

function readJsonArray(file: string): JsonObject[] {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (Array.isArray(parsed)) return parsed as JsonObject[];
  if (parsed && typeof parsed === 'object') {
    const wrapped = parsed as JsonObject;
    const rounds = objects(wrapped.rounds);
    return rounds.length > 0 ? rounds : [wrapped];
  }
  throw new Error(`JSON object or array expected: ${file}`);
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value as Readonly<T>;
}

function immutableJsonSnapshot<T>(value: T): Readonly<T> {
  return deepFreeze(JSON.parse(JSON.stringify(value)) as T);
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function auditReviewGateSnapshotPayload(
  snapshot: Omit<AuditReviewGateSnapshot, 'snapshotHash'> | AuditReviewGateSnapshot
): Omit<AuditReviewGateSnapshot, 'snapshotHash'> {
  return {
    schemaVersion: 'audit-review-gate-snapshot/v1',
    gateInvocationId: snapshot.gateInvocationId,
    eventId: snapshot.eventId,
    recordId: snapshot.recordId,
    requirementSetId: snapshot.requirementSetId,
    attemptId: snapshot.attemptId,
    implementationAttemptId: snapshot.implementationAttemptId,
    evaluatedAt: snapshot.evaluatedAt,
    evaluatedBy: snapshot.evaluatedBy,
    decision: snapshot.decision,
    blockingReasons: snapshot.blockingReasons,
    plan: snapshot.plan,
    roundInputs: snapshot.roundInputs,
    repairInputs: snapshot.repairInputs,
    frozenInputs: snapshot.frozenInputs,
    report: snapshot.report,
    runtimeStatus: snapshot.runtimeStatus,
  };
}

function materializeAuditReviewGateSnapshot(
  payload: Omit<AuditReviewGateSnapshot, 'snapshotHash'>
): { snapshot: AuditReviewGateSnapshot; content: string; contentHash: string } {
  const snapshot: AuditReviewGateSnapshot = {
    ...payload,
    snapshotHash: sha256Json(auditReviewGateSnapshotPayload(payload)),
  };
  const content = `${JSON.stringify(snapshot, null, 2)}\n`;
  return {
    snapshot,
    content,
    contentHash: sha256Text(content),
  };
}

function readAuditReviewGateSnapshot(snapshotPath: string): {
  snapshot: AuditReviewGateSnapshot;
  contentHash: string;
} {
  const contentHash = sha256File(snapshotPath);
  const snapshot = readJson(snapshotPath) as unknown as AuditReviewGateSnapshot;
  if (
    snapshot.schemaVersion !== 'audit-review-gate-snapshot/v1' ||
    !text(snapshot.gateInvocationId) ||
    !text(snapshot.eventId) ||
    !text(snapshot.recordId) ||
    !text(snapshot.requirementSetId) ||
    !text(snapshot.attemptId) ||
    !text(snapshot.implementationAttemptId) ||
    !text(snapshot.evaluatedAt) ||
    !text(snapshot.evaluatedBy) ||
    (snapshot.decision !== 'pass' && snapshot.decision !== 'blocked') ||
    !Array.isArray(snapshot.blockingReasons) ||
    !Array.isArray(snapshot.roundInputs) ||
    !Array.isArray(snapshot.repairInputs) ||
    !Array.isArray(snapshot.frozenInputs) ||
    !text(snapshot.snapshotHash) ||
    snapshot.snapshotHash !== sha256Json(auditReviewGateSnapshotPayload(snapshot))
  ) {
    throw new Error('audit_review_gate_snapshot_invalid');
  }
  return { snapshot, contentHash };
}

function sameResolvedPath(left: string, right: string): boolean {
  return path.resolve(left) === path.resolve(right);
}

function assertArtifactSnapshotCurrent(
  snapshot: AuditReviewGateArtifactSnapshot,
  issuePrefix: string
): void {
  if (
    !text(snapshot.role) ||
    !text(snapshot.path) ||
    !text(snapshot.contentHash) ||
    !fs.existsSync(snapshot.path) ||
    sha256File(snapshot.path) !== snapshot.contentHash
  ) {
    throw new Error(`${issuePrefix}:${text(snapshot.role) || 'unknown'}`);
  }
}

function readLastControlEvent(eventLogPath: string): JsonObject {
  if (!fs.existsSync(eventLogPath)) {
    throw new Error('audit_review_gate_event_log_missing');
  }
  const lines = fs
    .readFileSync(eventLogPath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    throw new Error('audit_review_gate_event_log_empty');
  }
  return JSON.parse(lines.at(-1)!) as JsonObject;
}

function assertControlEventHash(event: JsonObject): void {
  const eventHash = text(event.eventHash);
  const unsigned = { ...event };
  delete unsigned.eventHash;
  if (!eventHash || eventHash !== sha256Json(unsigned)) {
    throw new Error('audit_review_gate_event_hash_invalid');
  }
}

function committedAuditReviewGateBundle(input: {
  recordPath: string;
  record: JsonObject;
  snapshotPath: string;
  gateInvocationId: string;
  eventId: string;
}): AuditReviewGateCommitBundle | null {
  const safeEventId = input.eventId.replace(/[^a-z0-9_.-]/giu, '_');
  const commitReceiptPath = receiptPathForEvent(input.recordPath, safeEventId);
  const snapshotExists = fs.existsSync(input.snapshotPath);
  const receiptExists = fs.existsSync(commitReceiptPath);
  if (!snapshotExists && !receiptExists) return null;
  if (!snapshotExists || !receiptExists) {
    throw new Error('audit_review_gate_committed_snapshot_incomplete');
  }

  const { snapshot, contentHash: snapshotContentHash } = readAuditReviewGateSnapshot(
    input.snapshotPath
  );
  if (
    snapshot.gateInvocationId !== input.gateInvocationId ||
    snapshot.eventId !== input.eventId ||
    snapshot.recordId !== text(input.record.recordId) ||
    snapshot.requirementSetId !==
      (text(input.record.requirementSetId) || text(input.record.recordId))
  ) {
    throw new Error('audit_review_gate_snapshot_identity_mismatch');
  }
  const commitReceipt = readJson(commitReceiptPath);
  const transactionId = text(commitReceipt.transactionId);
  const eventHash = text(commitReceipt.eventHash);
  const beforeRecordHash = text(commitReceipt.beforeRecordHash);
  const afterRecordHash = text(commitReceipt.afterRecordHash);
  if (
    text(commitReceipt.receiptType) !== 'control_event_committed' ||
    !transactionId ||
    text(commitReceipt.eventId) !== input.eventId ||
    text(commitReceipt.eventType) !== 'audit_review_result_recorded' ||
    text(commitReceipt.writerId) !== 'audit-review-gate-writer' ||
    !eventHash ||
    !beforeRecordHash ||
    !afterRecordHash ||
    text(input.record.lastAppliedEventId) !== input.eventId ||
    text(input.record.lastAppliedEventHash) !== eventHash ||
    text(input.record.recordHash) !== afterRecordHash
  ) {
    throw new Error('audit_review_gate_control_commit_mismatch');
  }

  const eventLogPath = eventLogPathForRecord(input.recordPath);
  const event = readLastControlEvent(eventLogPath);
  assertControlEventHash(event);
  const eventPayload = nested(event.payload);
  if (
    text(event.eventId) !== input.eventId ||
    text(event.eventHash) !== eventHash ||
    text(event.afterRecordHash) !== afterRecordHash ||
    text(eventPayload.gateInvocationId) !== input.gateInvocationId ||
    !sameResolvedPath(text(eventPayload.gateSnapshotPath), input.snapshotPath) ||
    text(eventPayload.gateSnapshotContentHash) !== snapshotContentHash ||
    text(eventPayload.reportHash) !== snapshot.report.contentHash
  ) {
    throw new Error('audit_review_gate_event_snapshot_binding_mismatch');
  }
  const committedArtifactPaths = strings(commitReceipt.artifactPaths).map((artifactPath) =>
    path.resolve(artifactPath)
  );
  for (const artifactPath of [
    input.snapshotPath,
    snapshot.report.path,
    snapshot.runtimeStatus.path,
  ]) {
    if (!committedArtifactPaths.includes(path.resolve(artifactPath))) {
      throw new Error('audit_review_gate_control_artifact_binding_missing');
    }
  }
  for (const frozenInput of snapshot.frozenInputs) {
    assertArtifactSnapshotCurrent(frozenInput, 'audit_review_gate_frozen_input_changed');
  }
  assertArtifactSnapshotCurrent(
    {
      role: 'audit_review_report',
      path: snapshot.report.path,
      contentHash: snapshot.report.contentHash,
    },
    'audit_review_gate_committed_output_changed'
  );
  assertArtifactSnapshotCurrent(
    {
      role: 'audit_review_runtime_status_receipt',
      path: snapshot.runtimeStatus.path,
      contentHash: snapshot.runtimeStatus.contentHash,
    },
    'audit_review_gate_committed_output_changed'
  );

  return {
    schemaVersion: 'audit-review-gate-commit-bundle/v1',
    decision: snapshot.decision,
    blockingReasons: [...snapshot.blockingReasons],
    plan: snapshot.plan,
    roundInputs: snapshot.roundInputs,
    repairInputs: snapshot.repairInputs,
    frozenInputs: snapshot.frozenInputs,
    report: snapshot.report,
    runtimeStatus: snapshot.runtimeStatus,
    control: {
      transactionId,
      eventId: input.eventId,
      eventHash,
      beforeRecordHash,
      afterRecordHash,
      commitReceiptPath,
      commitReceiptContentHash: sha256File(commitReceiptPath),
      eventLogPath,
    },
  };
}

function emitAuditReviewGateBundle(
  bundle: AuditReviewGateCommitBundle,
  args: ParsedArgs,
  deps: MainAuditReviewGateDeps
): number {
  deps.onCommitted?.(immutableJsonSnapshot(bundle));
  const output = {
    ok: true,
    reportPath: normalizePathForRecord(bundle.report.path),
    decision: bundle.decision,
    blockingReasons: bundle.blockingReasons,
    controlEventId: bundle.control.eventId,
    controlEventHash: bundle.control.eventHash,
    eventLogPath: normalizePathForRecord(bundle.control.eventLogPath),
    receiptPath: normalizePathForRecord(bundle.control.commitReceiptPath),
  };
  (deps.writeOutput ?? process.stdout.write.bind(process.stdout))(
    args.json ? `${JSON.stringify(output, null, 2)}\n` : `audit_review=${bundle.decision}\n`
  );
  return bundle.decision === 'pass' ? 0 : 1;
}

interface FrozenAuditRepairInput {
  role: string;
  path: string;
  contentHash: string;
}

interface AuditRepairEvidenceValidation {
  binding: AuditTriadRepairEvidenceBinding | null;
  issueCodes: string[];
  frozenInputs: FrozenAuditRepairInput[];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean) : [];
}

function artifactRefs(value: unknown): Array<{ path: string; contentHash: string }> {
  return objects(value)
    .map((item) => ({
      path: text(item.path),
      contentHash: text(item.contentHash),
    }))
    .filter((ref) => ref.path || ref.contentHash);
}

function projectRootFromRecordPath(recordPath: string): string {
  let current = path.dirname(path.resolve(recordPath));
  for (;;) {
    if (path.basename(current) === '_bmad-output') {
      return path.dirname(current);
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('audit_review_project_root_not_derivable');
    }
    current = parent;
  }
}

function resolveProjectArtifactPath(projectRoot: string, artifactPath: string): string {
  const resolved = path.isAbsolute(artifactPath)
    ? path.resolve(artifactPath)
    : path.resolve(projectRoot, artifactPath);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('audit_review_repair_artifact_outside_project');
  }
  return resolved;
}

function projectRelativeArtifactPath(projectRoot: string, artifactPath: string): string {
  return normalizePathForRecord(path.relative(projectRoot, artifactPath));
}

function sameJson(left: unknown, right: unknown): boolean {
  return sha256AuditTriadJson(left) === sha256AuditTriadJson(right);
}

function validateAuditRepairEvidence(input: {
  recordPath: string;
  record: JsonObject;
  plan: AuditTriadExecutionPlan;
  repairReceiptPaths: string[];
  repairFeedbackDispatchPaths: string[];
}): AuditRepairEvidenceValidation {
  const projectRoot = projectRootFromRecordPath(input.recordPath);
  if (
    input.plan.priorRepairReceiptRefs.length === 0 &&
    input.repairReceiptPaths.length === 0 &&
    input.repairFeedbackDispatchPaths.length === 0
  ) {
    return { binding: null, issueCodes: [], frozenInputs: [] };
  }
  const issueCodes: string[] = [];
  const frozenInputs: FrozenAuditRepairInput[] = [];
  const resolvedReceiptPaths = input.repairReceiptPaths.map((item) => path.resolve(item));
  const resolvedFeedbackPaths = input.repairFeedbackDispatchPaths.map((item) => path.resolve(item));
  const suppliedReceiptByIdentity = new Map(
    resolvedReceiptPaths.map((item) => [physicalPathIdentity(item), item])
  );
  const suppliedFeedbackByIdentity = new Map(
    resolvedFeedbackPaths.map((item) => [physicalPathIdentity(item), item])
  );
  if (suppliedReceiptByIdentity.size !== resolvedReceiptPaths.length) {
    issueCodes.push('audit_repair_receipt_path_duplicate');
  }
  if (suppliedFeedbackByIdentity.size !== resolvedFeedbackPaths.length) {
    issueCodes.push('audit_repair_feedback_path_duplicate');
  }
  if (resolvedReceiptPaths.length !== input.plan.priorRepairReceiptRefs.length) {
    issueCodes.push('audit_repair_receipt_set_mismatch');
  }

  const receiptBindings: AuditTriadRepairEvidenceBinding['repairReceiptRefs'] = [];
  for (const [index, planRef] of input.plan.priorRepairReceiptRefs.entries()) {
    let expectedPath: string;
    try {
      expectedPath = resolveProjectArtifactPath(projectRoot, planRef.path);
    } catch {
      issueCodes.push(`audit_repair_receipt_${index + 1}_outside_project`);
      continue;
    }
    const suppliedPath = suppliedReceiptByIdentity.get(physicalPathIdentity(expectedPath));
    if (!suppliedPath || !fs.existsSync(suppliedPath)) {
      issueCodes.push(`audit_repair_receipt_${index + 1}_missing`);
      continue;
    }
    let snapshot: ReturnType<typeof readJsonSnapshot>;
    try {
      snapshot = readJsonSnapshot(suppliedPath);
    } catch {
      issueCodes.push(`audit_repair_receipt_${index + 1}_invalid_json`);
      continue;
    }
    frozenInputs.push({
      role: `repair_receipt_${index + 1}`,
      path: suppliedPath,
      contentHash: snapshot.contentHash,
    });
    const receipt = snapshot.value;
    const receiptHash = text(receipt.receiptHash);
    const { receiptHash: _ignoredReceiptHash, ...receiptWithoutHash } = receipt;
    const receiptPriorRefs = artifactRefs(receipt.priorRepairReceiptRefs);
    const feedbackRef = nested(receipt.feedbackDispatchRef);
    const feedbackPath = text(feedbackRef.path);
    let resolvedFeedbackPath = '';
    try {
      resolvedFeedbackPath = resolveProjectArtifactPath(projectRoot, feedbackPath);
    } catch {
      issueCodes.push(`audit_repair_receipt_${index + 1}_feedback_outside_project`);
    }
    const expectedRepairedTargetBundleHash = sha256AuditTriadJson({
      sourceDocumentHash: input.plan.sourceDocumentHash,
      semanticModelHash: input.plan.semanticModelHash,
      implementationConfirmationHash: input.plan.implementationConfirmationHash,
      projectionSetHash: input.plan.projectionSetHash,
      checkedProjectionQualityRuleCodes: input.plan.checkedProjectionQualityRuleCodes,
      qualityRuleSetHash: input.plan.qualityRuleSetHash,
      modelPacketHash: input.plan.modelPacketHash ?? null,
      auditReceiptHash: input.plan.auditReceiptHash ?? null,
      goalExecutionHash: input.plan.goalExecutionHash ?? null,
      vetoItemIds: input.plan.vetoItemIds,
      priorRepairReceiptRefs: receiptPriorRefs,
    });
    const receiptIssues = [
      text(receipt.schemaVersion) === 'audit-main-agent-repair-receipt/v1' ? '' : 'schema_invalid',
      snapshot.contentHash === planRef.contentHash ? '' : 'content_hash_mismatch',
      receiptHash === sha256AuditTriadJson(receiptWithoutHash) ? '' : 'self_hash_mismatch',
      text(receipt.recordId) === text(input.plan.recordId) ? '' : 'record_mismatch',
      text(receipt.requirementSetId) ===
      (text(input.record.requirementSetId) || text(input.record.recordId))
        ? ''
        : 'requirement_set_mismatch',
      text(receipt.remediationPacketId) ? '' : 'remediation_packet_missing',
      text(receipt.repairedSemanticModelHash) === input.plan.semanticModelHash
        ? ''
        : 'semantic_model_hash_mismatch',
      text(receipt.repairedProjectionSetHash) === input.plan.projectionSetHash
        ? ''
        : 'projection_set_hash_mismatch',
      text(receipt.qualityRuleSetHash) === input.plan.qualityRuleSetHash
        ? ''
        : 'quality_rule_set_hash_mismatch',
      text(receipt.repairedModelPacketHash) === text(input.plan.modelPacketHash)
        ? ''
        : 'model_packet_hash_mismatch',
      text(receipt.repairedAuditReceiptHash) === text(input.plan.auditReceiptHash)
        ? ''
        : 'audit_receipt_hash_mismatch',
      text(receipt.repairedGoalExecutionHash) === text(input.plan.goalExecutionHash)
        ? ''
        : 'goal_execution_hash_mismatch',
      text(receipt.repairedAuditTargetBundleHash) === expectedRepairedTargetBundleHash
        ? ''
        : 'target_bundle_hash_mismatch',
      strings(receipt.changedHashFields).length > 0 ? '' : 'changed_hash_fields_missing',
      feedbackPath ? '' : 'feedback_path_missing',
      text(feedbackRef.contentHash) ? '' : 'feedback_content_hash_missing',
      text(feedbackRef.dispatchHash) ? '' : 'feedback_dispatch_hash_missing',
    ].filter(Boolean);
    issueCodes.push(...receiptIssues.map((issue) => `audit_repair_receipt_${index + 1}_${issue}`));
    if (receiptIssues.length === 0 && resolvedFeedbackPath) {
      receiptBindings.push({
        path: projectRelativeArtifactPath(projectRoot, expectedPath),
        contentHash: snapshot.contentHash,
        receiptHash,
        remediationPacketId: text(receipt.remediationPacketId),
        feedbackDispatchRef: {
          path: projectRelativeArtifactPath(projectRoot, resolvedFeedbackPath),
          contentHash: text(feedbackRef.contentHash),
          dispatchHash: text(feedbackRef.dispatchHash),
        },
      });
    }
  }

  const expectedFeedbackRefs = receiptBindings.map((binding) => binding.feedbackDispatchRef);
  if (resolvedFeedbackPaths.length !== expectedFeedbackRefs.length) {
    issueCodes.push('audit_repair_feedback_set_mismatch');
  }
  const feedbackBindings: AuditTriadRepairEvidenceBinding['repairFeedbackDispatchRefs'] = [];
  for (const [index, expectedRef] of expectedFeedbackRefs.entries()) {
    let expectedPath: string;
    try {
      expectedPath = resolveProjectArtifactPath(projectRoot, expectedRef.path);
    } catch {
      issueCodes.push(`audit_repair_feedback_${index + 1}_outside_project`);
      continue;
    }
    const suppliedPath = suppliedFeedbackByIdentity.get(physicalPathIdentity(expectedPath));
    if (!suppliedPath || !fs.existsSync(suppliedPath)) {
      issueCodes.push(`audit_repair_feedback_${index + 1}_missing`);
      continue;
    }
    let snapshot: ReturnType<typeof readJsonSnapshot>;
    try {
      snapshot = readJsonSnapshot(suppliedPath);
    } catch {
      issueCodes.push(`audit_repair_feedback_${index + 1}_invalid_json`);
      continue;
    }
    frozenInputs.push({
      role: `repair_feedback_dispatch_${index + 1}`,
      path: suppliedPath,
      contentHash: snapshot.contentHash,
    });
    const dispatch = snapshot.value;
    const dispatchHash = text(dispatch.dispatchHash);
    const { dispatchHash: _ignoredDispatchHash, ...dispatchWithoutHash } = dispatch;
    const receiptBinding = receiptBindings[index];
    const receiptPath = resolveProjectArtifactPath(projectRoot, receiptBinding.path);
    const receipt = readJson(receiptPath);
    const feedbackRef = nested(receipt.feedbackDispatchRef);
    const dispatchIssues = [
      text(dispatch.schemaVersion) === 'audit-repair-feedback-dispatch/v1' ? '' : 'schema_invalid',
      snapshot.contentHash === expectedRef.contentHash ? '' : 'content_hash_mismatch',
      dispatchHash === expectedRef.dispatchHash ? '' : 'dispatch_hash_ref_mismatch',
      dispatchHash === sha256AuditTriadJson(dispatchWithoutHash) ? '' : 'self_hash_mismatch',
      text(dispatch.recordId) === text(input.plan.recordId) ? '' : 'record_mismatch',
      text(dispatch.auditEpochId) === text(receipt.sourceAuditEpochId)
        ? ''
        : 'audit_epoch_mismatch',
      text(dispatch.auditTargetBundleHash) === text(receipt.sourceAuditTargetBundleHash)
        ? ''
        : 'audit_target_bundle_mismatch',
      text(dispatch.semanticModelHash) === text(receipt.sourceSemanticModelHash)
        ? ''
        : 'semantic_model_hash_mismatch',
      text(dispatch.projectionSetHash) === text(receipt.sourceProjectionSetHash)
        ? ''
        : 'projection_set_hash_mismatch',
      text(dispatch.qualityRuleSetHash) === text(receipt.qualityRuleSetHash)
        ? ''
        : 'quality_rule_set_hash_mismatch',
      sameJson(
        artifactRefs(dispatch.priorRepairReceiptRefs),
        artifactRefs(receipt.priorRepairReceiptRefs)
      )
        ? ''
        : 'prior_receipt_refs_mismatch',
      sameJson(strings(dispatch.validatedGapRefs), strings(receipt.validatedGapRefs))
        ? ''
        : 'validated_gap_refs_mismatch',
      sameJson(nested(dispatch.roundReceiptRef), nested(receipt.sourceRoundReceiptRef))
        ? ''
        : 'round_receipt_ref_mismatch',
      sameJson(nested(dispatch.judgeReceiptRef), nested(receipt.sourceJudgeReceiptRef))
        ? ''
        : 'judge_receipt_ref_mismatch',
      text(feedbackRef.contentHash) === snapshot.contentHash ? '' : 'receipt_content_hash_mismatch',
      text(feedbackRef.dispatchHash) === dispatchHash ? '' : 'receipt_dispatch_hash_mismatch',
    ].filter(Boolean);
    issueCodes.push(
      ...dispatchIssues.map((issue) => `audit_repair_feedback_${index + 1}_${issue}`)
    );
    if (dispatchIssues.length === 0) {
      feedbackBindings.push({
        path: projectRelativeArtifactPath(projectRoot, expectedPath),
        contentHash: snapshot.contentHash,
        dispatchHash,
      });
    }
  }

  if (
    suppliedReceiptByIdentity.size !== input.plan.priorRepairReceiptRefs.length ||
    suppliedFeedbackByIdentity.size !== expectedFeedbackRefs.length
  ) {
    issueCodes.push('audit_repair_evidence_contains_unexpected_paths');
  }
  const uniqueIssueCodes = Array.from(new Set(issueCodes));
  if (
    uniqueIssueCodes.length > 0 ||
    receiptBindings.length !== input.plan.priorRepairReceiptRefs.length ||
    feedbackBindings.length !== expectedFeedbackRefs.length
  ) {
    return { binding: null, issueCodes: uniqueIssueCodes, frozenInputs };
  }
  const bindingWithoutHash = {
    schemaVersion: 'audit-triad-repair-evidence-binding/v1' as const,
    repairReceiptRefs: receiptBindings,
    repairFeedbackDispatchRefs: feedbackBindings,
  };
  return {
    binding: {
      ...bindingWithoutHash,
      evidenceSetHash: sha256AuditTriadJson(bindingWithoutHash),
    },
    issueCodes: [],
    frozenInputs,
  };
}

function physicalPathIdentity(value: string): string {
  let existing = path.resolve(value);
  const missingSegments: string[] = [];
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return path.resolve(value);
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  return path.resolve(fs.realpathSync.native(existing), ...missingSegments);
}

function assertUniqueAuditPaths(entries: Array<{ role: string; path: string }>): void {
  const seen = new Map<string, string>();
  for (const entry of entries.filter((item) => text(item.path))) {
    const identity = physicalPathIdentity(entry.path);
    const existingRole = seen.get(identity);
    if (existingRole) {
      throw new Error(
        `audit_review_artifact_path_conflict:${existingRole}:${entry.role}:${normalizePathForRecord(
          identity
        )}`
      );
    }
    seen.set(identity, entry.role);
  }
}

function defaultAuditTriadDir(recordPath: string, attemptId: string): string {
  return path.join(path.dirname(recordPath), 'audit-triad', attemptId);
}

function defaultPlanPath(recordPath: string, attemptId: string): string {
  return path.join(defaultAuditTriadDir(recordPath, attemptId), 'audit-triad-execution-plan.json');
}

function defaultRoundsPath(recordPath: string, attemptId: string): string {
  return path.join(defaultAuditTriadDir(recordPath, attemptId), 'rounds.json');
}

function defaultReportPath(recordPath: string, attemptId: string): string {
  return path.join(defaultAuditTriadDir(recordPath, attemptId), 'audit-review-report.json');
}

function resolveAttemptId(args: ParsedArgs, record: JsonObject): string {
  if (args.attemptId) return args.attemptId;
  const latestIteration = objects(record.executionIterations).at(-1);
  const fromIteration =
    text(latestIteration?.runId) ||
    text(latestIteration?.executionIterationId) ||
    text(nested(record.closeout).currentAttemptId);
  if (fromIteration) return fromIteration;
  throw new Error('missing required args: attemptId');
}

function currentModelPassIssues(
  record: JsonObject,
  model: 'execution_closure',
  attemptId: string
): string[] {
  const verified = resolveVerifiedSixModelStatus({
    record,
    modelId: model,
    currentImplementationAttemptId: attemptId,
  });
  return verified.effectiveStatus === 'pass'
    ? []
    : [`${model}_not_passed:${verified.effectiveStatus}`, ...verified.blockerRefs];
}

function currentHashes(
  record: JsonObject,
  reportHash: string,
  plan: AuditTriadExecutionPlan,
  repairEvidence: AuditTriadRepairEvidenceBinding | null
): JsonObject {
  return {
    sourceDocumentHash: text(record.sourceDocumentHash),
    semanticModelHash: text(record.semanticModelHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    auditReviewReportHash: reportHash,
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    projectionSetHash: plan.projectionSetHash,
    qualityRuleSetHash: plan.qualityRuleSetHash,
    criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
    criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
    requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    currentAttemptHash: plan.currentAttemptHash,
    currentEvidenceHash: plan.currentEvidenceHash,
    ...(plan.modelPacketHash ? { modelPacketHash: plan.modelPacketHash } : {}),
    ...(repairEvidence ? { repairEvidenceSetHash: repairEvidence.evidenceSetHash } : {}),
  };
}

function resolveRoundPaths(args: ParsedArgs, recordPath: string, attemptId: string): string[] {
  return [
    ...(args.round ?? []),
    ...(args.rounds ? [args.rounds] : []),
    ...(!args.rounds && (args.round ?? []).length === 0
      ? [defaultRoundsPath(recordPath, attemptId)]
      : []),
  ].map((item) => path.resolve(item));
}

function readRoundsWithFrozenInputs(input: {
  paths: string[];
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  reservedPaths: Array<{ role: string; path: string }>;
}): {
  rounds: AuditTriadRoundReceipt[];
  frozenInputs: FrozenAuditRepairInput[];
  producerArtifactIssueCodes: string[];
} {
  const rounds: AuditTriadRoundReceipt[] = [];
  const frozenInputs: FrozenAuditRepairInput[] = [];
  const producerArtifactIssueCodes: string[] = [];
  for (const [sourceIndex, item] of input.paths.entries()) {
    const sourceRounds = readJsonArray(item) as unknown as AuditTriadRoundReceipt[];
    const contentHash = sha256File(item);
    frozenInputs.push({
      role: `round_${sourceIndex + 1}`,
      path: item,
      contentHash,
    });
    for (const [roundOffset, round] of sourceRounds.entries()) {
      const validation = validateAuditTriadProducerArtifacts({
        projectRoot: input.projectRoot,
        plan: input.plan,
        round,
        roundIndex: rounds.length + roundOffset + 1,
        reservedPaths: [
          ...input.reservedPaths,
          ...frozenInputs.map((frozen) => ({
            role: frozen.role,
            path: frozen.path,
          })),
        ],
      });
      producerArtifactIssueCodes.push(...validation.issueCodes);
      frozenInputs.push(...validation.frozenInputs);
    }
    rounds.push(...sourceRounds);
  }
  return {
    rounds,
    frozenInputs,
    producerArtifactIssueCodes: [...new Set(producerArtifactIssueCodes)],
  };
}

function evaluate(input: {
  record: JsonObject;
  attemptId: string;
  implementationAttemptId: string;
  plan: AuditTriadExecutionPlan;
  rounds: AuditTriadRoundReceipt[];
  repairReceiptRefs: string[];
  repairFeedbackDispatchRefs: string[];
  repairEvidence: AuditTriadRepairEvidenceBinding | null;
  producerArtifactIssueCodes: string[];
}): {
  decision: AuditReviewDecision;
  blockingReasons: string[];
  checks: JsonObject[];
  convergenceReceipt?: JsonObject;
} {
  const checks: JsonObject[] = [];
  const blockingReasons: string[] = [];
  const openReconfirmations = openReconfirmationRequests(input.record);
  checks.push({
    id: 'no-open-reconfirmation-request',
    passed: openReconfirmations.length === 0,
    openRequestIds: openReconfirmations.map((request) => text(request.requestId)).filter(Boolean),
  });
  if (openReconfirmations.length > 0) {
    blockingReasons.push('open_reconfirmation_request_exists');
  }
  const executionIssues = currentModelPassIssues(
    input.record,
    'execution_closure',
    input.implementationAttemptId
  );
  checks.push({
    id: 'execution-closure-current-pass',
    passed: executionIssues.length === 0,
    implementationAttemptId: input.implementationAttemptId,
    blockingReasons: executionIssues,
  });
  blockingReasons.push(...executionIssues);

  const allowedCurrentModels = new Set(['execution_closure', 'audit_review']);
  const currentMentalModel = text(input.record.currentMentalModel);
  if (!allowedCurrentModels.has(currentMentalModel)) {
    blockingReasons.push(`audit_review_entry_model_invalid:${currentMentalModel || '<missing>'}`);
  }
  checks.push({
    id: 'audit-review-entry-model-valid',
    passed: allowedCurrentModels.has(currentMentalModel),
    currentMentalModel,
  });

  const planIssues = [
    text(input.plan.recordId) === text(input.record.recordId)
      ? ''
      : 'audit_triad_plan_record_mismatch',
    text(input.plan.attemptId) === input.attemptId ? '' : 'audit_triad_plan_attempt_mismatch',
    text(input.plan.sourceDocumentHash) === text(input.record.sourceDocumentHash)
      ? ''
      : 'audit_triad_plan_source_hash_mismatch',
    text(input.plan.implementationConfirmationHash) ===
    text(input.record.implementationConfirmationHash)
      ? ''
      : 'audit_triad_plan_confirmation_hash_mismatch',
    text(input.plan.semanticModelHash) === text(input.record.semanticModelHash)
      ? ''
      : 'audit_triad_plan_semantic_model_hash_mismatch',
  ].filter(Boolean);
  checks.push({
    id: 'audit-triad-plan-current',
    passed: planIssues.length === 0,
    stageProfileId: input.plan.stageProfileId,
    blockingReasons: planIssues,
  });
  blockingReasons.push(...planIssues);

  const convergence = evaluateAuditTriadConvergence({
    plan: input.plan,
    rounds: input.rounds,
    repairReceiptRefs: input.repairReceiptRefs,
    repairFeedbackDispatchRefs: input.repairFeedbackDispatchRefs,
    ...(input.repairEvidence ? { repairEvidence: input.repairEvidence } : {}),
    scoreReceiptRequired: true,
    runAuditorHostReceiptRequired: true,
  });
  checks.push({
    id: 'audit-triad-convergence-current',
    passed: convergence.ok,
    roundCount: input.rounds.length,
    blockingReasons: convergence.blockingReasons,
  });
  blockingReasons.push(...convergence.blockingReasons);
  checks.push({
    id: 'audit-triad-producer-artifacts-valid',
    passed: input.producerArtifactIssueCodes.length === 0,
    blockingReasons: input.producerArtifactIssueCodes,
  });
  blockingReasons.push(...input.producerArtifactIssueCodes);

  const uniqueBlockingReasons = [...new Set(blockingReasons.filter(Boolean))];
  return {
    decision: uniqueBlockingReasons.length === 0 ? 'pass' : 'blocked',
    blockingReasons: uniqueBlockingReasons,
    checks,
    convergenceReceipt: convergence.convergenceReceipt,
  };
}

function createAuditReviewRuntimeStatus(
  record: JsonObject,
  input: {
    attemptId: string;
    implementationAttemptId: string;
    plan: AuditTriadExecutionPlan;
    planPath: string;
    planHash: string;
    decision: AuditReviewDecision;
    blockingReasons: string[];
    reportPath: string;
    reportHash: string;
    evaluatedAt: string;
    evaluatedBy: string;
    repairEvidence: AuditTriadRepairEvidenceBinding | null;
    roundInputs: FrozenAuditRepairInput[];
  }
): RuntimeStatusProjectionUpdate {
  const gateCheckId = `audit-review:${input.attemptId}`;
  const resultPayload = {
    payloadKind: 'model_result',
    model: 'audit_review',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    status: input.decision,
    resultRecordedAt: input.evaluatedAt,
    resultRecordedBy: input.evaluatedBy,
    blockingReasons: input.blockingReasons,
    sourceRefs: [
      { sourceType: 'execution_iteration', id: input.implementationAttemptId },
      { sourceType: 'gate_check', id: gateCheckId },
      { sourceType: 'audit_review_report', id: normalizePathForRecord(input.reportPath) },
    ],
    currentHashes: currentHashes(record, input.reportHash, input.plan, input.repairEvidence),
  };
  return createRuntimeStatusProjectionUpdate({
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    modelId: 'audit_review',
    implementationAttemptId: input.implementationAttemptId,
    sourceDocumentHash: text(record.sourceDocumentHash),
    implementationConfirmationHash: text(record.implementationConfirmationHash),
    semanticModelHash: text(record.semanticModelHash),
    stageInputs: [
      {
        role: 'audit_triad_execution_plan',
        path: normalizePathForRecord(input.planPath),
        hash: input.planHash,
      },
      ...input.roundInputs.map((roundInput) => ({
        role: `audit_triad_${roundInput.role}`,
        path: normalizePathForRecord(roundInput.path),
        hash: roundInput.contentHash,
      })),
      ...(input.repairEvidence?.repairReceiptRefs ?? []).map((ref) => ({
        role: 'audit_main_agent_repair_receipt',
        path: ref.path,
        hash: ref.contentHash,
      })),
      ...(input.repairEvidence?.repairFeedbackDispatchRefs ?? []).map((ref) => ({
        role: 'audit_repair_feedback_dispatch',
        path: ref.path,
        hash: ref.contentHash,
      })),
    ],
    deterministicGateOutputs: [
      {
        role: 'audit_review_report',
        path: normalizePathForRecord(input.reportPath),
        hash: input.reportHash,
      },
    ],
    blockerRefs: input.blockingReasons,
    evidenceRefs: [
      normalizePathForRecord(input.reportPath),
      ...input.roundInputs.map((roundInput) => normalizePathForRecord(roundInput.path)),
      ...(input.repairEvidence?.repairReceiptRefs ?? []).map((ref) => ref.path),
      ...(input.repairEvidence?.repairFeedbackDispatchRefs ?? []).map((ref) => ref.path),
    ],
    authorityClass: 'deterministic_gate',
    decision: input.decision === 'pass' ? 'pass' : 'block',
    effectiveStatus: input.decision === 'pass' ? 'pass' : 'blocked',
    createdAt: input.evaluatedAt,
    receiptPath: `runtime/status-decisions/${input.implementationAttemptId}/audit_review.json`,
    projection: resultPayload,
  });
}

function updateRecord(
  record: JsonObject,
  input: {
    attemptId: string;
    implementationAttemptId: string;
    decision: AuditReviewDecision;
    blockingReasons: string[];
    checks: JsonObject[];
    reportPath: string;
    evaluatedAt: string;
    evaluatedBy: string;
    runtimeStatus: RuntimeStatusProjectionUpdate;
  }
): JsonObject {
  const gateCheckId = `audit-review:${input.attemptId}`;
  const gateCheck = {
    eventType: 'gate_check_recorded',
    checkId: gateCheckId,
    gate: 'Audit Review Gate',
    decision: input.decision,
    blockingReasons: input.blockingReasons,
    checks: input.checks,
    reportPath: normalizePathForRecord(input.reportPath),
    sourceRefs: [
      { sourceType: 'execution_iteration', id: input.attemptId },
      { sourceType: 'audit_triad_execution_plan', id: input.attemptId },
    ],
    recordedAt: input.evaluatedAt,
    recordedBy: input.evaluatedBy,
  };
  const transition =
    input.decision === 'pass'
      ? {
          eventType: 'mental_model_transition_recorded',
          fromModel: 'execution_closure',
          toModel: 'audit_review',
          sourceRefs: [{ sourceType: 'model_result', id: 'execution_closure' }],
          recordedAt: input.evaluatedAt,
          recordedBy: input.evaluatedBy,
        }
      : null;
  return {
    ...record,
    gateChecks: [...objects(record.gateChecks), gateCheck],
    ...runtimeStatusProjectionRecordPatch({
      record,
      modelId: 'audit_review',
      update: input.runtimeStatus,
    }),
    currentAttemptId: input.implementationAttemptId,
    currentMentalModel: 'audit_review',
    currentStage: 'audit_review',
    stage: text(record.stage) || 'audit_review',
    mentalModelTransitions: [
      ...objects(record.mentalModelTransitions),
      ...(transition ? [transition] : []),
    ],
    lastEventType: 'audit_review_result_recorded',
    updatedAt: input.evaluatedAt,
  };
}

export function mainAuditReviewGate(argv: string[], deps: MainAuditReviewGateDeps = {}): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(
      'Usage: main-agent-audit-review-gate --requirement-record <json> --attempt-id <id> [--plan <json>] [--rounds <json-array>] [--round <json>] [--json]'
    );
    return 0;
  }
  if (!args.requirementRecord) throw new Error('missing required args: requirementRecord');
  const recordPath = path.resolve(args.requirementRecord);
  const record = readJson(recordPath);
  const attemptId = resolveAttemptId(args, record);
  const implementationAttemptId =
    text(record.currentAttemptId) || text(record.implementationAttemptId) || text(record.runId);
  if (!implementationAttemptId) {
    throw new Error('audit_review_implementation_attempt_missing');
  }
  const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
  const evaluatedBy = args.evaluatedBy ?? 'agent';
  const planPath = path.resolve(args.plan ?? defaultPlanPath(recordPath, attemptId));
  const roundPaths = resolveRoundPaths(args, recordPath, attemptId);
  const reportPath = path.resolve(args.reportPath ?? defaultReportPath(recordPath, attemptId));
  const runtimeStatusReceiptPath = path.resolve(
    path.dirname(recordPath),
    'runtime',
    'status-decisions',
    implementationAttemptId,
    'audit_review.json'
  );
  const auditPathEntries = [
    { role: 'requirement_record', path: recordPath },
    ...(text(record.sourcePath)
      ? [{ role: 'requirement_source', path: path.resolve(text(record.sourcePath)) }]
      : []),
    { role: 'audit_triad_execution_plan', path: planPath },
    ...roundPaths.map((roundPath, index) => ({
      role: `audit_triad_round_${index + 1}`,
      path: roundPath,
    })),
    ...(args.repairReceipt ?? []).map((repairPath, index) => ({
      role: `repair_receipt_${index + 1}`,
      path: path.resolve(repairPath),
    })),
    ...(args.repairFeedbackDispatch ?? []).map((dispatchPath, index) => ({
      role: `repair_feedback_dispatch_${index + 1}`,
      path: path.resolve(dispatchPath),
    })),
    { role: 'audit_review_report', path: reportPath },
    { role: 'audit_review_runtime_status_receipt', path: runtimeStatusReceiptPath },
  ];
  assertUniqueAuditPaths(auditPathEntries);
  const planSnapshot = readJsonSnapshot(planPath);
  const plan = planSnapshot.value as unknown as AuditTriadExecutionPlan;
  const planHash = planSnapshot.contentHash;
  const roundInputs = readRoundsWithFrozenInputs({
    paths: roundPaths,
    projectRoot: projectRootFromRecordPath(recordPath),
    plan,
    reservedPaths: auditPathEntries,
  });
  const rounds = roundInputs.rounds;
  const repairEvidenceValidation = validateAuditRepairEvidence({
    recordPath,
    record,
    plan,
    repairReceiptPaths: args.repairReceipt ?? [],
    repairFeedbackDispatchPaths: args.repairFeedbackDispatch ?? [],
  });
  const gateInvocationHash = sha256Json({
    schemaVersion: 'audit-review-gate-invocation/v1',
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    attemptId,
    implementationAttemptId,
    evaluatedBy,
    plan: {
      path: normalizePathForRecord(planPath),
      contentHash: planHash,
    },
    frozenInputs: [...roundInputs.frozenInputs, ...repairEvidenceValidation.frozenInputs].map(
      (input) => ({
        role: input.role,
        path: normalizePathForRecord(path.resolve(input.path)),
        contentHash: input.contentHash,
      })
    ),
    reportPath: normalizePathForRecord(reportPath),
    runtimeStatusReceiptPath: normalizePathForRecord(runtimeStatusReceiptPath),
    auditEpochId: plan.auditEpochId,
    auditTargetBundleHash: plan.auditTargetBundleHash,
    semanticModelHash: plan.semanticModelHash,
    projectionSetHash: plan.projectionSetHash,
    qualityRuleSetHash: plan.qualityRuleSetHash,
  });
  const gateInvocationId = `AUDIT-GATE-${gateInvocationHash.slice(
    'sha256:'.length,
    'sha256:'.length + 24
  )}`;
  const eventId = `audit-review-${gateInvocationHash.slice(
    'sha256:'.length,
    'sha256:'.length + 24
  )}`;
  const gateSnapshotPath = path.join(
    path.dirname(reportPath),
    'gate-commits',
    gateInvocationId,
    'audit-review-gate-snapshot.json'
  );
  assertUniqueAuditPaths([
    ...auditPathEntries,
    { role: 'audit_review_gate_snapshot', path: gateSnapshotPath },
  ]);
  const recoveredBundle = committedAuditReviewGateBundle({
    recordPath,
    record,
    snapshotPath: gateSnapshotPath,
    gateInvocationId,
    eventId,
  });
  if (recoveredBundle) {
    return emitAuditReviewGateBundle(recoveredBundle, args, deps);
  }
  const sourcePrdLintTransition = validateSourcePrdLintTransitionFromFiles({
    transition: 'audit-review',
    requirementRecordPath: recordPath,
    currentSourcePath: text(record.sourcePath),
  });
  const baseEvaluation = evaluate({
    record,
    attemptId,
    implementationAttemptId,
    plan,
    rounds,
    repairReceiptRefs: args.repairReceipt ?? [],
    repairFeedbackDispatchRefs: args.repairFeedbackDispatch ?? [],
    repairEvidence: repairEvidenceValidation.binding,
    producerArtifactIssueCodes: roundInputs.producerArtifactIssueCodes,
  });
  const repairEvidenceEvaluation =
    repairEvidenceValidation.issueCodes.length === 0
      ? baseEvaluation
      : {
          ...baseEvaluation,
          decision: 'blocked' as const,
          blockingReasons: [
            ...new Set([...baseEvaluation.blockingReasons, ...repairEvidenceValidation.issueCodes]),
          ],
          checks: [
            ...baseEvaluation.checks,
            {
              id: 'audit-repair-evidence-valid',
              passed: false,
              blockingReasons: repairEvidenceValidation.issueCodes,
            },
          ],
        };
  const evaluation =
    sourcePrdLintTransition.decision === 'pass'
      ? repairEvidenceEvaluation
      : {
          ...repairEvidenceEvaluation,
          decision: 'blocked' as const,
          blockingReasons: [
            ...new Set([
              ...repairEvidenceEvaluation.blockingReasons,
              ...sourcePrdLintTransition.issueCodes,
            ]),
          ],
        };
  const report = {
    reportType: 'audit_review_report',
    generatedAt: evaluatedAt,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    attemptId,
    implementationAttemptId,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    auditTriadExecutionPlanRef: {
      path: normalizePathForRecord(planPath),
      contentHash: planHash,
      stageProfileId: plan.stageProfileId,
      auditEpochId: plan.auditEpochId,
      auditTargetBundleHash: plan.auditTargetBundleHash,
      semanticModelHash: plan.semanticModelHash,
      projectionSetHash: plan.projectionSetHash,
      checkedProjectionQualityRuleCodes: plan.checkedProjectionQualityRuleCodes,
      qualityRuleSetHash: plan.qualityRuleSetHash,
      criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
      criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
      requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
    },
    roundCount: rounds.length,
    repairEvidence: repairEvidenceValidation.binding,
    convergenceReceipt: evaluation.convergenceReceipt ?? null,
  };
  const reportText = `${JSON.stringify(report, null, 2)}\n`;
  const reportHash = sha256Text(reportText);
  const runtimeStatus = createAuditReviewRuntimeStatus(record, {
    attemptId,
    implementationAttemptId,
    plan,
    planPath,
    planHash,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    reportPath,
    reportHash,
    evaluatedAt,
    evaluatedBy,
    repairEvidence: repairEvidenceValidation.binding,
    roundInputs: roundInputs.frozenInputs,
  });
  const runtimeStatusWrites = runtimeStatusProjectionArtifactWrites(runtimeStatus);
  const runtimeStatusWrite = runtimeStatusWrites[0];
  if (!runtimeStatusWrite || !runtimeStatus.receiptRef) {
    throw new Error('audit_review_runtime_status_snapshot_missing');
  }
  const roundInputSnapshots = roundPaths.map((roundPath, index) => {
    const snapshot = roundInputs.frozenInputs.find(
      (input) => path.resolve(input.path) === path.resolve(roundPath)
    );
    if (!snapshot) {
      throw new Error(`audit_review_round_snapshot_missing:${index + 1}`);
    }
    return snapshot;
  });
  const frozenInputs: AuditReviewGateArtifactSnapshot[] = [
    {
      role: 'audit_triad_execution_plan',
      path: planPath,
      contentHash: planHash,
    },
    ...roundInputs.frozenInputs,
    ...repairEvidenceValidation.frozenInputs,
  ];
  const gateSnapshot = materializeAuditReviewGateSnapshot({
    schemaVersion: 'audit-review-gate-snapshot/v1',
    gateInvocationId,
    eventId,
    recordId: text(record.recordId),
    requirementSetId: text(record.requirementSetId) || text(record.recordId),
    attemptId,
    implementationAttemptId,
    evaluatedAt,
    evaluatedBy,
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    plan: {
      path: planPath,
      contentHash: planHash,
      value: plan,
    },
    roundInputs: roundInputSnapshots,
    repairInputs: repairEvidenceValidation.frozenInputs,
    frozenInputs,
    report: {
      path: reportPath,
      contentHash: reportHash,
      content: reportText,
      value: report,
    },
    runtimeStatus: {
      path: runtimeStatusReceiptPath,
      contentHash: runtimeStatusWrite.contentHash,
      content: runtimeStatusWrite.content,
      value: runtimeStatus.receiptRef.receipt as unknown as JsonObject,
    },
  });
  const payload = {
    gateInvocationId,
    gateSnapshotPath: normalizePathForRecord(gateSnapshotPath),
    gateSnapshotContentHash: gateSnapshot.contentHash,
    attemptId,
    implementationAttemptId,
    planPath: normalizePathForRecord(planPath),
    decision: evaluation.decision,
    blockingReasons: evaluation.blockingReasons,
    checks: evaluation.checks,
    repairEvidence: repairEvidenceValidation.binding,
    reportPath: normalizePathForRecord(reportPath),
    reportHash,
    evaluatedAt,
    evaluatedBy,
  };
  deps.beforeControlCommit?.();
  if (sha256File(planPath) !== planHash) {
    throw new Error('audit_review_input_changed:plan');
  }
  for (const input of roundInputs.frozenInputs) {
    if (!fs.existsSync(input.path) || sha256File(input.path) !== input.contentHash) {
      throw new Error(`audit_review_input_changed:${input.role}`);
    }
  }
  for (const input of repairEvidenceValidation.frozenInputs) {
    if (!fs.existsSync(input.path) || sha256File(input.path) !== input.contentHash) {
      throw new Error(`audit_review_input_changed:${input.role}`);
    }
  }
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'audit-review-gate-writer',
    eventType: 'audit_review_result_recorded',
    eventId,
    recordedAt: evaluatedAt,
    expectedBeforeRecordHash: sha256Json(canonicalizeRequirementRecord(record)),
    payload,
    artifactWrites: [
      {
        path: reportPath,
        content: reportText,
        contentHash: reportHash,
      },
      ...runtimeStatusWrites,
      {
        path: gateSnapshotPath,
        content: gateSnapshot.content,
        contentHash: gateSnapshot.contentHash,
      },
    ],
    reduce: (currentRecord) =>
      updateRecord(currentRecord, {
        attemptId,
        implementationAttemptId,
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        reportPath,
        evaluatedAt,
        evaluatedBy,
        runtimeStatus,
      }),
  });
  const bundle = committedAuditReviewGateBundle({
    recordPath,
    record: readJson(recordPath),
    snapshotPath: gateSnapshotPath,
    gateInvocationId,
    eventId,
  });
  if (
    !bundle ||
    bundle.control.eventHash !== commit.event.eventHash ||
    bundle.control.afterRecordHash !== commit.afterRecordHash
  ) {
    throw new Error('audit_review_control_commit_snapshot_invalid');
  }
  return emitAuditReviewGateBundle(bundle, args, deps);
}

if (require.main === module && isDirectMainAgentAuditReviewGateCli(process.argv[1])) {
  try {
    process.exitCode = mainAuditReviewGate(process.argv.slice(2));
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
