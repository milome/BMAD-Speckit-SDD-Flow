/* eslint-disable no-console */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  validateSubagentEvidenceEnvelope,
  type SubagentEvidenceEnvelopeValidation,
} from './subagent-evidence-envelope';
import {
  appendControlEventAndReplay,
  eventLogPathForRecord,
} from './requirement-record-control-store';

type JsonObject = Record<string, unknown>;

interface ParsedArgs {
  evidence?: string;
  requirementRecord?: string;
  eventLog?: string;
  artifactIndex?: string;
  globalArtifactIndex?: string;
  confirmedAt?: string;
  recordedBy?: string;
  json?: boolean;
  help?: boolean;
}

const EXECUTION_STATUSES = new Set([
  'pending',
  'running',
  'done',
  'partial',
  'blocked',
  'failed',
  'timeout',
  'cancelled',
  'rerun_required',
]);
const CLOSURE_STATUSES = new Set(['open', 'pass', 'fail', 'blocked']);
const GATE_DECISIONS = new Set(['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy']);
const CONTRACT_DECISIONS = new Set(['pass', 'fail', 'blocked', 'not_applicable', 'skipped_by_policy']);
const ENTRY_FLOWS = new Set(['story', 'bugfix', 'standalone_tasks']);
const ENTRY_FLOW_CLASSES = new Set(['full_story_entry', 'corrective_entry', 'task_packet_entry']);
const WORKFLOW_ADAPTERS = new Set(['bmad', 'speckit', 'direct', 'legacy']);
const TRACEABILITY_DIMENSIONS = new Set(['MUST', 'NEG', 'OUT', 'EVD', 'TRACE']);
const TRACE_ALLOWED_STATUSES = new Set([
  'PENDING',
  'PASS',
  'FAIL',
  'BLOCKED',
  'LINKED_DOWNSTREAM',
  'USER_APPROVED_DEFERRED',
  'USER_APPROVED_OUT_OF_SCOPE',
]);
const LEGACY_WRITE_PATH_PREFIXES = [
  '_bmad-output/runtime/gates/',
  '_bmad-output/runtime/bmad-help-five-layer/',
  '_bmad-output/runtime/context/',
  '_bmad-output/runtime/governance/',
];
const RERUN_AUTHORITY_SOURCE_TYPES = new Set([
  'gate_check',
  'contract_check',
  'audit_iteration',
  'execution_iteration',
  'requirement_closure',
  'failure_record',
]);

function isDirectImplementationEvidenceIngestCli(entry: string | undefined): boolean {
  return /(^|[\\/])ingest-implementation-evidence(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--json') out.json = true;
    else if (arg.startsWith('--')) {
      const key = arg.slice(2).replace(/-([a-z])/gu, (_, letter: string) => letter.toUpperCase());
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`);
      (out as Record<string, string | boolean | undefined>)[key] = value;
      index += 1;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return out;
}

function requireArgs(args: ParsedArgs): void {
  const missing = ['evidence', 'requirementRecord'].filter((key) => !args[key as keyof ParsedArgs]);
  if (missing.length > 0) throw new Error(`missing required args: ${missing.join(', ')}`);
}

function readJson(file: string): JsonObject {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`JSON object expected: ${file}`);
  }
  return parsed as JsonObject;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function arrayOfObjects(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.filter((item): item is JsonObject => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function normalizePathForRecord(value: string): string {
  return value.replace(/\\/gu, '/');
}

function normalizeSourceOfTruthRole(value: unknown): string {
  const role = text(value);
  if (['control', 'evidence', 'projection', 'read_model'].includes(role)) return role;
  if (role === 'derived') return 'evidence';
  return 'evidence';
}

function sha256File(file: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}

function appendJsonl(file: string, value: JsonObject): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${JSON.stringify(value)}\n`, 'utf8');
}

function containsForbiddenField(value: unknown, field: string): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => containsForbiddenField(item, field));
  const obj = value as JsonObject;
  return Object.prototype.hasOwnProperty.call(obj, field) || Object.values(obj).some((item) => containsForbiddenField(item, field));
}

function legacyResultToDecision(value: unknown): string {
  const result = text(value).toLowerCase();
  const map: Record<string, string> = {
    ok: 'pass',
    passed: 'pass',
    pass: 'pass',
    success: 'pass',
    failed: 'fail',
    fail: 'fail',
    failure: 'fail',
    blocked: 'blocked',
    block: 'blocked',
    not_applicable: 'not_applicable',
    skipped_by_policy: 'skipped_by_policy',
  };
  return map[result] ?? result;
}

function normalizeGateChecks(packet: JsonObject): JsonObject[] {
  return arrayOfObjects(packet.gateChecks).map((gate) => {
    const decision = text(gate.decision) || legacyResultToDecision(gate.result);
    const { result: _legacyResult, ...rest } = gate;
    return { ...rest, decision };
  });
}

function normalizeContractChecks(packet: JsonObject): JsonObject[] {
  return arrayOfObjects(packet.contractChecks).map((contractCheck) => {
    const decision = text(contractCheck.decision) || legacyResultToDecision(contractCheck.result);
    const { result: _legacyResult, ...rest } = contractCheck;
    return { ...rest, decision };
  });
}

function closureInputs(packet: JsonObject): JsonObject[] {
  const explicitClosures = arrayOfObjects(packet.requirementClosures);
  if (text(packet.status) !== 'done') return explicitClosures;

  const explicitRequirementIds = new Set(explicitClosures.map((closure) => text(closure.requirementId)).filter(Boolean));
  const traceClosures = arrayOfStrings(packet.traceRows)
    .filter((traceRow) => !explicitRequirementIds.has(traceRow))
    .map((traceRow) => ({
      requirementId: traceRow,
      status: 'pass',
      closureSource: 'execution_trace_row_done',
    }));
  const evidenceClosures = arrayOfStrings(packet.evidenceRefs)
    .filter((evidenceRef) => !explicitRequirementIds.has(evidenceRef))
    .map((evidenceRef) => ({
      requirementId: evidenceRef,
      status: 'pass',
      closureSource: 'execution_evidence_ref_done',
    }));
  return [...explicitClosures, ...traceClosures, ...evidenceClosures];
}

function requireHashMatch(packet: JsonObject, record: JsonObject): string[] {
  const mismatches: string[] = [];
  for (const field of ['sourceDocumentHash', 'implementationConfirmationHash']) {
    if (text(packet[field]) !== text(record[field])) mismatches.push(`${field}_mismatch`);
  }
  const state = record.architectureConfirmationState as JsonObject | undefined;
  const architectureRequired =
    record.architectureConfirmationRequired === true ||
    (state && typeof state === 'object' && !Array.isArray(state)) ||
    arrayOfObjects(record.architectureConfirmations).length > 0 ||
    arrayOfObjects(record.architectureConfirmationStateChecks).length > 0;
  if (!architectureRequired) return mismatches;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    mismatches.push('architecture_confirmation_state_missing');
  } else if (text(state.status) !== 'active') {
    mismatches.push('architecture_confirmation_not_active');
  } else if (text(packet.architectureConfirmationHash) !== text(state.currentArchitectureConfirmationHash)) {
    mismatches.push('architecture_confirmation_hash_mismatch');
  }
  return mismatches;
}

function resolvedArchitectureConfirmationHash(packet: JsonObject, record: JsonObject): string {
  const state = record.architectureConfirmationState as JsonObject | undefined;
  return (
    text(packet.architectureConfirmationHash) ||
    text(state?.currentArchitectureConfirmationHash) ||
    text(packet.implementationConfirmationHash) ||
    text(record.implementationConfirmationHash) ||
    text(packet.sourceDocumentHash) ||
    text(record.sourceDocumentHash)
  );
}

function sourceRefs(packet: JsonObject): JsonObject[] {
  const refs: JsonObject[] = [];
  for (const id of arrayOfStrings(packet.traceRows)) refs.push({ sourceType: 'trace_row', id });
  for (const id of arrayOfStrings(packet.evidenceRefs)) refs.push({ sourceType: 'evidence', id });
  for (const run of arrayOfObjects(packet.commandRuns)) refs.push({ sourceType: 'command_run', id: text(run.commandId) });
  return refs.filter((ref) => text(ref.id));
}

function validateCommands(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  const runId = text(packet.runId);
  const closeoutAttemptId = text(packet.closeoutAttemptId);
  const commandRuns = arrayOfObjects(packet.commandRuns);
  if (!runId) mismatches.push('run_id_missing');
  if (commandRuns.length === 0) mismatches.push('command_runs_missing');
  for (const run of commandRuns) {
    if (!text(run.commandId)) mismatches.push('command_id_missing');
    if (!text(run.command)) mismatches.push('command_missing');
    if (typeof run.exitCode !== 'number') mismatches.push('command_exit_code_missing');
    if (!text(run.startedAt) || !text(run.completedAt)) mismatches.push('command_time_missing');
    if (text(run.runId) !== runId) mismatches.push('command_run_id_mismatch');
    if (closeoutAttemptId && text(run.closeoutAttemptId) !== closeoutAttemptId) {
      mismatches.push('command_closeout_attempt_id_mismatch');
    }
  }
  return mismatches;
}

function validateArtifacts(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  const validateArtifact = (artifact: JsonObject, prefix: string, passGradeOnly: boolean): void => {
    const artifactPath = text(artifact.path);
    const hash = text(artifact.hash ?? artifact.contentHash);
    const normalizedPath = normalizePathForRecord(artifactPath);
    const role = text(artifact.sourceOfTruthRole);
    if (!artifactPath) mismatches.push(`${prefix}_artifact_path_missing`);
    if (!hash) mismatches.push(`${prefix}_artifact_hash_missing`);
    if (!text(artifact.artifactType)) mismatches.push(`${prefix}_artifact_type_missing`);
    if (!role) mismatches.push(`${prefix}_artifact_source_of_truth_role_missing`);
    if (passGradeOnly && role !== 'evidence') mismatches.push(`${prefix}_artifact_source_of_truth_role_not_evidence`);
    if (!text(artifact.producer)) mismatches.push(`${prefix}_artifact_producer_missing`);
    if (!text(artifact.purpose)) mismatches.push(`${prefix}_artifact_purpose_missing`);
    if (arrayOfStrings(artifact.relatedRequirementIds).length === 0) {
      mismatches.push(`${prefix}_artifact_related_requirement_ids_missing`);
    }
    if (!text(artifact.status)) mismatches.push(`${prefix}_artifact_status_missing`);
    if (!text(artifact.inputVersion)) mismatches.push(`${prefix}_artifact_input_version_missing`);
    if (!text(artifact.outputVersion)) mismatches.push(`${prefix}_artifact_output_version_missing`);
    if (LEGACY_WRITE_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
      mismatches.push(`artifact_legacy_write_path_forbidden:${normalizedPath}`);
    }
    const absolute = path.isAbsolute(artifactPath) ? artifactPath : path.resolve(process.cwd(), artifactPath);
    if (artifactPath && fs.existsSync(absolute) && hash && sha256File(absolute) !== hash) {
      mismatches.push(`artifact_hash_mismatch:${artifactPath}`);
    }
  };
  for (const artifact of arrayOfObjects(packet.artifactRefs)) {
    validateArtifact(artifact, 'artifact_ref', false);
  }
  for (const artifact of arrayOfObjects(packet.extensionRefs)) {
    validateArtifact(artifact, 'extension_ref', false);
  }
  const delta = packet.implementationDelta as JsonObject | undefined;
  for (const artifact of arrayOfObjects(delta?.negativeAssertionArtifactRefs)) {
    validateArtifact(artifact, 'negative_assertion', true);
  }
  const deliveryEvidence = packet.deliveryEvidence as JsonObject | undefined;
  for (const command of arrayOfObjects(deliveryEvidence?.requiredCommands)) {
    for (const artifact of arrayOfObjects(command.artifactRefs)) {
      validateArtifact(artifact, 'required_command', true);
    }
  }
  return mismatches;
}

function validateImplementationDelta(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  const delta = packet.implementationDelta as JsonObject | undefined;
  if (!delta || typeof delta !== 'object' || Array.isArray(delta)) {
    mismatches.push('implementation_delta_missing');
    return mismatches;
  }
  if (arrayOfStrings(delta.filesChanged).length === 0) mismatches.push('implementation_delta_files_changed_missing');
  if (!text(delta.diffSummaryRef)) mismatches.push('implementation_delta_diff_summary_ref_missing');
  if (arrayOfObjects(delta.negativeAssertionArtifactRefs).length === 0) {
    mismatches.push('implementation_delta_negative_assertion_artifact_refs_missing');
  }
  if (delta.behaviorAffecting !== true) mismatches.push('implementation_delta_not_behavior_affecting');
  return mismatches;
}

function validateEntryFlowState(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  const state = packet.entryFlowState;
  if (state === undefined || state === null) return mismatches;
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    return ['entry_flow_state_invalid'];
  }
  const entryFlowState = state as JsonObject;
  const entryFlow = text(entryFlowState.entryFlow);
  const entryFlowClass = text(entryFlowState.entryFlowClass);
  const workflowAdapter = text(entryFlowState.workflowAdapter);
  if (!ENTRY_FLOWS.has(entryFlow)) mismatches.push('entry_flow_state_entry_flow_invalid');
  if (!ENTRY_FLOW_CLASSES.has(entryFlowClass)) mismatches.push('entry_flow_state_entry_flow_class_invalid');
  if (!WORKFLOW_ADAPTERS.has(workflowAdapter)) mismatches.push('entry_flow_state_workflow_adapter_invalid');
  if (entryFlowState.contractAuthoringRequired !== true) {
    mismatches.push('entry_flow_state_contract_authoring_required_not_true');
  }
  if (['bmad-story-assistant', 'speckit_story', 'speckit_tasks', 'speckit_implement'].includes(entryFlow)) {
    mismatches.push('entry_flow_state_forbidden_top_level_entry_flow');
  }
  if (entryFlow === 'story' && entryFlowClass !== 'full_story_entry') {
    mismatches.push('entry_flow_state_story_class_mismatch');
  }
  if (entryFlow === 'bugfix' && entryFlowClass !== 'corrective_entry') {
    mismatches.push('entry_flow_state_bugfix_class_mismatch');
  }
  if (entryFlow === 'standalone_tasks' && entryFlowClass !== 'task_packet_entry') {
    mismatches.push('entry_flow_state_standalone_class_mismatch');
  }
  return mismatches;
}

function validateGlobalContractTraceabilityPolicy(policy: JsonObject | undefined, prefix: string): string[] {
  const mismatches: string[] = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return [`${prefix}_global_contract_traceability_policy_missing`];
  }
  if (text(policy.schemaVersion) !== 'global-contract-traceability-policy/v1') {
    mismatches.push(`${prefix}_traceability_policy_schema_version_invalid`);
  }
  const flows = new Set(arrayOfStrings(policy.appliesToEntryFlows));
  for (const flow of ENTRY_FLOWS) {
    if (!flows.has(flow)) mismatches.push(`${prefix}_traceability_policy_missing_entry_flow:${flow}`);
  }
  if (policy.contractAuthoringRequired !== true) {
    mismatches.push(`${prefix}_traceability_policy_contract_authoring_not_required`);
  }
  if (policy.taskBindingRequired !== true) mismatches.push(`${prefix}_traceability_policy_task_binding_not_required`);
  const dimensions = new Set(arrayOfStrings(policy.taskBindingDimensions));
  for (const dimension of TRACEABILITY_DIMENSIONS) {
    if (!dimensions.has(dimension)) mismatches.push(`${prefix}_traceability_policy_missing_dimension:${dimension}`);
  }
  if (text(policy.missingBindingBehavior) !== 'fail_closed') {
    mismatches.push(`${prefix}_traceability_policy_missing_binding_not_fail_closed`);
  }
  if (policy.sourceDocumentHashRequired !== true) {
    mismatches.push(`${prefix}_traceability_policy_source_hash_not_required`);
  }
  if (policy.implementationConfirmationHashRequired !== true) {
    mismatches.push(`${prefix}_traceability_policy_implementation_hash_not_required`);
  }
  if (policy.reconfirmOnTraceSemanticChange !== true) {
    mismatches.push(`${prefix}_traceability_policy_reconfirm_on_trace_change_not_required`);
  }
  if (policy.allowUnboundImplementationTask !== false) {
    mismatches.push(`${prefix}_traceability_policy_allows_unbound_task`);
  }
  return mismatches;
}

function validateTraceStatusPolicy(policy: JsonObject | undefined, prefix: string): string[] {
  const mismatches: string[] = [];
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    return [`${prefix}_trace_status_policy_missing`];
  }
  if (text(policy.schemaVersion) !== 'trace-status-policy/v1') mismatches.push(`${prefix}_trace_status_policy_schema_version_invalid`);
  const allowed = new Set(arrayOfStrings(policy.allowedStatuses));
  for (const status of TRACE_ALLOWED_STATUSES) {
    if (!allowed.has(status)) mismatches.push(`${prefix}_trace_status_policy_missing_allowed_status:${status}`);
  }
  const terminal = new Set(arrayOfStrings(policy.terminalFullCloseoutStatuses));
  for (const status of ['PASS', 'FAIL', 'BLOCKED']) {
    if (!terminal.has(status)) mismatches.push(`${prefix}_trace_status_policy_missing_terminal_status:${status}`);
  }
  for (const status of ['LINKED_DOWNSTREAM', 'USER_APPROVED_DEFERRED', 'USER_APPROVED_OUT_OF_SCOPE']) {
    if (terminal.has(status)) mismatches.push(`${prefix}_trace_status_policy_user_scoped_status_can_full_closeout:${status}`);
  }
  if (arrayOfStrings(policy.linkedDownstreamRequiredFields).length < 7) {
    mismatches.push(`${prefix}_trace_status_policy_linked_downstream_fields_incomplete`);
  }
  if (arrayOfStrings(policy.userApprovedDeferredRequiredFields).length < 5) {
    mismatches.push(`${prefix}_trace_status_policy_user_deferred_fields_incomplete`);
  }
  if (arrayOfStrings(policy.userApprovedOutOfScopeRequiredFields).length < 4) {
    mismatches.push(`${prefix}_trace_status_policy_user_out_of_scope_fields_incomplete`);
  }
  if (policy.bareDeferredForbidden !== true) mismatches.push(`${prefix}_trace_status_policy_bare_deferred_not_forbidden`);
  if (policy.bareOutOfScopeForbidden !== true) mismatches.push(`${prefix}_trace_status_policy_bare_out_of_scope_not_forbidden`);
  if (policy.fullCloseoutForUserScopedStatusesForbidden !== true) {
    mismatches.push(`${prefix}_trace_status_policy_user_scoped_full_closeout_not_forbidden`);
  }
  return mismatches;
}

function validateRuntimePolicySnapshotRef(packet: JsonObject): string[] {
  const ref = packet.runtimePolicySnapshotRef;
  if (ref === undefined || ref === null) return [];
  const mismatches: string[] = [];
  if (!ref || typeof ref !== 'object' || Array.isArray(ref)) {
    return ['runtime_policy_snapshot_ref_invalid'];
  }
  const runtimePolicySnapshotRef = ref as JsonObject;
  const artifactPath = text(runtimePolicySnapshotRef.path);
  const hash = text(runtimePolicySnapshotRef.hash ?? runtimePolicySnapshotRef.contentHash);
  const role = text(runtimePolicySnapshotRef.sourceOfTruthRole);
  if (text(runtimePolicySnapshotRef.artifactType) !== 'runtime_policy_snapshot') {
    mismatches.push('runtime_policy_snapshot_ref_artifact_type_invalid');
  }
  if (!artifactPath) mismatches.push('runtime_policy_snapshot_ref_path_missing');
  if (!hash) mismatches.push('runtime_policy_snapshot_ref_hash_missing');
  if (role === 'control') mismatches.push('runtime_policy_snapshot_ref_must_not_be_control');
  if (!['evidence', 'projection', 'read_model'].includes(role)) {
    mismatches.push('runtime_policy_snapshot_ref_source_of_truth_role_invalid');
  }
  if (!text(runtimePolicySnapshotRef.producer)) mismatches.push('runtime_policy_snapshot_ref_producer_missing');
  if (!text(runtimePolicySnapshotRef.purpose)) mismatches.push('runtime_policy_snapshot_ref_purpose_missing');
  if (arrayOfStrings(runtimePolicySnapshotRef.relatedRequirementIds).length === 0) {
    mismatches.push('runtime_policy_snapshot_ref_related_requirement_ids_missing');
  }
  if (!text(runtimePolicySnapshotRef.status)) mismatches.push('runtime_policy_snapshot_ref_status_missing');
  if (!text(runtimePolicySnapshotRef.inputVersion)) mismatches.push('runtime_policy_snapshot_ref_input_version_missing');
  if (!text(runtimePolicySnapshotRef.outputVersion)) mismatches.push('runtime_policy_snapshot_ref_output_version_missing');
  const absolute = path.isAbsolute(artifactPath) ? artifactPath : path.resolve(process.cwd(), artifactPath);
  if (artifactPath && fs.existsSync(absolute) && hash && sha256File(absolute) !== hash) {
    mismatches.push(`runtime_policy_snapshot_ref_hash_mismatch:${artifactPath}`);
  }
  return mismatches;
}

function validateHookReconciliation(packet: JsonObject): string[] {
  const value = packet.hookReconciliation;
  if (value === undefined || value === null) return [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['hook_reconciliation_invalid'];
  }
  const hookReconciliation = value as JsonObject;
  const mismatches: string[] = [];
  const schemaVersion = text(hookReconciliation.schemaVersion);
  const hostKind = text(hookReconciliation.hostKind);
  const hostMode = text(hookReconciliation.hostMode);
  const hookTrust = text(hookReconciliation.hookTrust);
  const fallbackMode = text(hookReconciliation.fallbackMode);
  const sequenceLedger =
    hookReconciliation.sequenceLedger &&
    typeof hookReconciliation.sequenceLedger === 'object' &&
    !Array.isArray(hookReconciliation.sequenceLedger)
      ? (hookReconciliation.sequenceLedger as JsonObject)
      : undefined;
  const sequenceStatus = text(sequenceLedger?.status);
  const missingReceipts = arrayOfObjects(hookReconciliation.missingReceipts);
  const hashMismatches = arrayOfObjects(hookReconciliation.hashMismatches);
  const noHookFallbackRefs = arrayOfObjects(hookReconciliation.noHookFallbackRefs);

  if (schemaVersion !== 'hook-reconciliation/v1') mismatches.push('hook_reconciliation_schema_version_invalid');
  if (!['codex', 'cursor', 'claude', 'unknown'].includes(hostKind)) mismatches.push('hook_reconciliation_host_kind_invalid');
  if (!['hooks_enabled', 'no_hooks', 'unknown'].includes(hostMode)) mismatches.push('hook_reconciliation_host_mode_invalid');
  if (!['trusted', 'degraded', 'untrusted', 'unknown'].includes(hookTrust)) mismatches.push('hook_reconciliation_hook_trust_invalid');
  if (!['none', 'no_hooks', 'bounded_replay', 'blocked'].includes(fallbackMode)) {
    mismatches.push('hook_reconciliation_fallback_mode_invalid');
  }
  if (!sequenceLedger) {
    mismatches.push('hook_reconciliation_sequence_ledger_missing');
  } else if (!['clean', 'reconciled', 'gap', 'missing', 'stale', 'unknown'].includes(sequenceStatus)) {
    mismatches.push('hook_reconciliation_sequence_status_invalid');
  }
  for (const receipt of missingReceipts) {
    if (!text(receipt.receiptType)) mismatches.push('hook_reconciliation_missing_receipt_type_missing');
    if (!text(receipt.expectedEventId)) mismatches.push('hook_reconciliation_missing_receipt_expected_event_id_missing');
  }
  for (const mismatch of hashMismatches) {
    if (!text(mismatch.field)) mismatches.push('hook_reconciliation_hash_mismatch_field_missing');
    if (!text(mismatch.expected)) mismatches.push('hook_reconciliation_hash_mismatch_expected_missing');
    if (!text(mismatch.actual)) mismatches.push('hook_reconciliation_hash_mismatch_actual_missing');
  }
  for (const ref of noHookFallbackRefs) {
    if (!text(ref.sourceType)) mismatches.push('hook_reconciliation_fallback_ref_source_type_missing');
    if (!text(ref.id)) mismatches.push('hook_reconciliation_fallback_ref_id_missing');
  }
  if (
    ['degraded', 'untrusted'].includes(hookTrust) &&
    hookReconciliation.closeoutReconciled === true &&
    ['no_hooks', 'bounded_replay'].includes(fallbackMode) &&
    noHookFallbackRefs.length === 0
  ) {
    mismatches.push('hook_reconciliation_reconciled_fallback_refs_missing');
  }
  if (
    hookReconciliation.closeoutReconciled === true &&
    (missingReceipts.length > 0 ||
      hashMismatches.length > 0 ||
      !['clean', 'reconciled'].includes(sequenceStatus))
  ) {
    mismatches.push('hook_reconciliation_closeout_reconciled_with_open_gaps');
  }
  if (Object.prototype.hasOwnProperty.call(hookReconciliation, 'result')) {
    mismatches.push('hook_reconciliation_result_forbidden');
  }
  return mismatches;
}

function validateFailureRecords(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  for (const failure of arrayOfObjects(packet.failureRecords)) {
    if (text(failure.eventType) && text(failure.eventType) !== 'failure_recorded') {
      mismatches.push('failure_record_event_type_invalid');
    }
    if (!text(failure.failureId)) mismatches.push('failure_record_id_missing');
    if (!text(failure.type)) mismatches.push('failure_record_type_missing');
    if (!['open', 'in_progress', 'resolved', 'blocked', 'superseded'].includes(text(failure.status))) {
      mismatches.push('failure_record_status_invalid');
    }
    if (arrayOfObjects(failure.sourceRefs).length === 0) mismatches.push('failure_record_source_refs_missing');
    if (Object.prototype.hasOwnProperty.call(failure, 'result')) mismatches.push('failure_record_result_forbidden');
    if (Object.prototype.hasOwnProperty.call(failure, 'decision')) mismatches.push('failure_record_decision_forbidden');
  }
  return mismatches;
}

function validateRcaRecords(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  for (const rca of arrayOfObjects(packet.rcaRecords)) {
    if (text(rca.eventType) && text(rca.eventType) !== 'rca_created') {
      mismatches.push('rca_record_event_type_invalid');
    }
    if (!text(rca.rcaId)) mismatches.push('rca_record_id_missing');
    if (!text(rca.type)) mismatches.push('rca_record_type_missing');
    if (!['open', 'in_progress', 'resolved', 'blocked'].includes(text(rca.status))) {
      mismatches.push('rca_record_status_invalid');
    }
    if (arrayOfObjects(rca.sourceRefs).length === 0) mismatches.push('rca_record_source_refs_missing');
    if (Object.prototype.hasOwnProperty.call(rca, 'result')) mismatches.push('rca_record_result_forbidden');
    if (Object.prototype.hasOwnProperty.call(rca, 'decision')) mismatches.push('rca_record_decision_forbidden');
  }
  return mismatches;
}

function validateRerunLoops(packet: JsonObject): string[] {
  const mismatches: string[] = [];
  for (const loop of arrayOfObjects(packet.rerunLoops)) {
    if (!text(loop.rerunLoopId)) mismatches.push('rerun_loop_id_missing');
    if (!['open', 'in_progress', 'no_progress', 'resolved', 'blocked', 'abandoned_by_user_confirmation'].includes(text(loop.status))) {
      mismatches.push('rerun_loop_status_invalid');
    }
    const rerunSourceRefs = arrayOfObjects(loop.sourceRefs);
    if (rerunSourceRefs.length === 0) mismatches.push('rerun_loop_source_refs_missing');
    for (const sourceRef of rerunSourceRefs) {
      if (!RERUN_AUTHORITY_SOURCE_TYPES.has(text(sourceRef.sourceType))) {
        mismatches.push(`rerun_loop_source_ref_type_invalid:${text(sourceRef.sourceType) || '<missing>'}`);
      }
      if (!text(sourceRef.id)) mismatches.push('rerun_loop_source_ref_id_missing');
    }
    if (Object.prototype.hasOwnProperty.call(loop, 'result')) mismatches.push('rerun_loop_result_forbidden');
    if (Object.prototype.hasOwnProperty.call(loop, 'decision')) mismatches.push('rerun_loop_decision_forbidden');
    if (Object.prototype.hasOwnProperty.call(loop, 'trigger') && rerunSourceRefs.length === 0) {
      mismatches.push('rerun_loop_trigger_without_source_refs');
    }
  }
  return mismatches;
}

function validateSubagentEvidenceEnvelopePacket(packet: JsonObject, record: JsonObject): string[] {
  const envelope = packet.subagentEvidenceEnvelope;
  if (envelope === undefined || envelope === null) return [];
  const validation = validateSubagentEvidenceEnvelope(envelope, {
    record,
    projectRoot: process.cwd(),
    indexedArtifactRefs: [...arrayOfObjects(packet.artifactRefs), ...arrayOfObjects(packet.extensionRefs)],
    expectedParentCloseoutAttemptId: text(packet.closeoutAttemptId),
  });
  return validation.ok ? [] : validation.mismatches;
}

function validatePacket(packet: JsonObject, record: JsonObject): string[] {
  const entryFlowState =
    packet.entryFlowState && typeof packet.entryFlowState === 'object' && !Array.isArray(packet.entryFlowState)
      ? (packet.entryFlowState as JsonObject)
      : undefined;
  const effectiveTraceabilityPolicy =
    entryFlowState?.globalContractTraceabilityPolicy &&
    typeof entryFlowState.globalContractTraceabilityPolicy === 'object' &&
    !Array.isArray(entryFlowState.globalContractTraceabilityPolicy)
      ? (entryFlowState.globalContractTraceabilityPolicy as JsonObject)
      : (record.globalContractTraceabilityPolicy as JsonObject | undefined);
  const effectiveTraceStatusPolicy =
    entryFlowState?.traceStatusPolicy &&
    typeof entryFlowState.traceStatusPolicy === 'object' &&
    !Array.isArray(entryFlowState.traceStatusPolicy)
      ? (entryFlowState.traceStatusPolicy as JsonObject)
      : (record.traceStatusPolicy as JsonObject | undefined);
  const mismatches = [
    ...requireHashMatch(packet, record),
    ...validateCommands(packet),
    ...validateArtifacts(packet),
    ...validateImplementationDelta(packet),
    ...validateEntryFlowState(packet),
    ...validateGlobalContractTraceabilityPolicy(effectiveTraceabilityPolicy, 'effective'),
    ...validateTraceStatusPolicy(effectiveTraceStatusPolicy, 'effective'),
    ...validateRuntimePolicySnapshotRef(packet),
    ...validateHookReconciliation(packet),
    ...validateFailureRecords(packet),
    ...validateRcaRecords(packet),
    ...validateRerunLoops(packet),
    ...validateSubagentEvidenceEnvelopePacket(packet, record),
  ];
  const packetWithoutLegacyGateResults = {
    ...packet,
    gateChecks: normalizeGateChecks(packet),
    contractChecks: normalizeContractChecks(packet),
  };
  if (containsForbiddenField(packetWithoutLegacyGateResults, 'result')) mismatches.push('forbidden_result_field');
  if (containsForbiddenField(packet, 'fullDiff')) mismatches.push('forbidden_inline_full_diff');
  if (containsForbiddenField(packet, 'diffPatch')) mismatches.push('forbidden_inline_diff_patch');
  if (containsForbiddenField(packet, 'inlineDiff')) mismatches.push('forbidden_inline_diff');
  if (text(packet.eventType) && text(packet.eventType) !== 'execution_iteration_recorded') {
    mismatches.push('unsupported_event_type');
  }
  if (!EXECUTION_STATUSES.has(text(packet.status))) mismatches.push('execution_status_invalid');
  if (!text(packet.executionIterationId)) mismatches.push('execution_iteration_id_missing');
  if (sourceRefs(packet).length === 0) mismatches.push('source_refs_missing');
  for (const closure of arrayOfObjects(packet.requirementClosures)) {
    if (!text(closure.requirementId)) mismatches.push('closure_requirement_id_missing');
    if (!CLOSURE_STATUSES.has(text(closure.status))) mismatches.push('closure_status_invalid');
  }
  for (const gate of normalizeGateChecks(packet)) {
    if (!text(gate.gate)) mismatches.push('gate_missing');
    if (!GATE_DECISIONS.has(text(gate.decision))) mismatches.push('gate_decision_invalid');
  }
  for (const contractCheck of normalizeContractChecks(packet)) {
    if (!text(contractCheck.contract)) mismatches.push('contract_check_contract_missing');
    if (!CONTRACT_DECISIONS.has(text(contractCheck.decision))) mismatches.push('contract_check_decision_invalid');
  }
  const deliveryEvidence = packet.deliveryEvidence as JsonObject | undefined;
  for (const command of arrayOfObjects(deliveryEvidence?.requiredCommands)) {
    if (!text(command.commandId)) mismatches.push('required_command_id_missing');
    if (!text(command.command)) mismatches.push('required_command_missing');
    if (command.blockingIfMissing !== true) mismatches.push('required_command_not_blocking');
    if (arrayOfObjects(command.artifactRefs).length === 0) mismatches.push('required_command_artifact_refs_missing');
  }
  return [...new Set(mismatches)];
}

function commandRunRefs(packet: JsonObject): JsonObject[] {
  return arrayOfObjects(packet.commandRuns).map((run) => ({
    commandId: text(run.commandId),
    command: text(run.command),
    runId: text(run.runId),
    closeoutAttemptId: text(run.closeoutAttemptId),
    exitCode: run.exitCode,
    startedAt: text(run.startedAt),
    completedAt: text(run.completedAt),
    outputSummary: text(run.outputSummary),
  }));
}

function artifactEvents(packet: JsonObject, recordId: string, requirementSetId: string): JsonObject[] {
  return [...arrayOfObjects(packet.artifactRefs), ...arrayOfObjects(packet.extensionRefs)].map((artifact) => ({
    eventType: 'artifact_indexed',
    artifactType: text(artifact.artifactType) || 'implementation_evidence',
    sourceOfTruthRole: normalizeSourceOfTruthRole(artifact.sourceOfTruthRole),
    recordId,
    requirementSetId,
    path: normalizePathForRecord(text(artifact.path)),
    contentHash: text(artifact.hash ?? artifact.contentHash),
    producer: text(artifact.producer) || 'ingest-implementation-evidence',
    purpose: text(artifact.purpose),
    relatedRequirementIds: arrayOfStrings(artifact.relatedRequirementIds),
    status: text(artifact.status),
    inputVersion: text(artifact.inputVersion),
    outputVersion: text(artifact.outputVersion),
    traceRows: arrayOfStrings(packet.traceRows),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
  }));
}

function evidencePacketArtifact(packet: JsonObject, evidencePath: string, recordId: string, requirementSetId: string): JsonObject {
  return {
    eventType: 'artifact_indexed',
    artifactType: 'implementation_evidence_packet',
    sourceOfTruthRole: 'evidence',
    recordId,
    requirementSetId,
    path: normalizePathForRecord(evidencePath),
    contentHash: sha256File(evidencePath),
    producer: 'scripts/ingest-implementation-evidence.ts',
    purpose: 'externally indexed controlled implementation evidence packet',
    relatedRequirementIds: [
      ...arrayOfStrings(packet.traceRows),
      ...arrayOfStrings(packet.evidenceRefs),
    ].filter(Boolean),
    status: 'active',
    inputVersion: text(packet.closeoutAttemptId) || text(packet.runId) || 'controlled-ingest',
    outputVersion: text(packet.executionIterationId) || text(packet.runId) || 'controlled-ingest',
    traceRows: arrayOfStrings(packet.traceRows),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
  };
}

function normalizeHistoricalArtifactRef(
  artifact: JsonObject,
  recordId: string,
  requirementSetId: string,
  fallbackRelatedRequirementIds: string[] = []
): JsonObject {
  const pathValue = normalizePathForRecord(text(artifact.path));
  const relatedRequirementIds = arrayOfStrings(artifact.relatedRequirementIds).length
    ? arrayOfStrings(artifact.relatedRequirementIds)
    : [...arrayOfStrings(artifact.evidenceRefs), ...arrayOfStrings(artifact.traceRows), ...fallbackRelatedRequirementIds].filter(
        Boolean
      );
  return {
    ...artifact,
    eventType: text(artifact.eventType) || 'artifact_indexed',
    artifactType: text(artifact.artifactType) || 'historical_artifact',
    sourceOfTruthRole: normalizeSourceOfTruthRole(artifact.sourceOfTruthRole),
    recordId: text(artifact.recordId) || recordId,
    requirementSetId: text(artifact.requirementSetId) || requirementSetId,
    path: pathValue || '<missing-path>',
    contentHash: text(artifact.contentHash ?? artifact.hash) || undefined,
    producer: text(artifact.producer) || 'historical-controlled-ingest-normalization',
    purpose: text(artifact.purpose) || 'retained historical artifact; not valid as current pass evidence until rerun with pass-grade metadata',
    relatedRequirementIds,
    status: text(artifact.status) || 'archived',
    inputVersion: text(artifact.inputVersion) || 'pre-artifact-metadata-enforcement',
    outputVersion: text(artifact.outputVersion) || 'archived-historical-artifact',
    traceRows: arrayOfStrings(artifact.traceRows),
    evidenceRefs: arrayOfStrings(artifact.evidenceRefs),
  };
}

function normalizeHistoricalCommand(command: JsonObject, recordId: string, requirementSetId: string): JsonObject {
  const fallbackRelatedRequirementIds = [...arrayOfStrings(command.evidenceRefs), ...arrayOfStrings(command.traceRows)];
  return {
    ...command,
    artifactRefs: arrayOfObjects(command.artifactRefs).map((artifact) =>
      normalizeHistoricalArtifactRef(artifact, recordId, requirementSetId, fallbackRelatedRequirementIds)
    ),
  };
}

function updateRecord(record: JsonObject, packet: JsonObject, recordedAt: string, recordedBy: string, evidencePath = ''): JsonObject {
  const recordId = text(packet.recordId) || text(record.recordId);
  const requirementSetId = text(packet.requirementSetId) || text(record.requirementSetId);
  const refs = sourceRefs(packet);
  const commandRefs = commandRunRefs(packet);
  const artifactRefs = artifactEvents(packet, recordId, requirementSetId);
  const packetArtifact = evidencePath ? evidencePacketArtifact(packet, evidencePath, recordId, requirementSetId) : undefined;
  const extensionRefs = artifactEvents(
    { ...packet, artifactRefs: arrayOfObjects(packet.extensionRefs), extensionRefs: [] },
    recordId,
    requirementSetId
  );
  const executionEvent = {
    eventType: 'execution_iteration_recorded',
    recordId,
    requirementSetId,
    executionIterationId: text(packet.executionIterationId),
    runId: text(packet.runId),
    status: text(packet.status),
    traceRows: arrayOfStrings(packet.traceRows),
    taskRefs: arrayOfStrings(packet.taskRefs),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
    filesChanged: arrayOfStrings(packet.filesChanged),
    diffSummary: text(packet.diffSummary),
    commandRunRefs: commandRefs,
    evidenceArtifactRefs: artifactRefs,
    sourceRefs: refs,
    sourceDocumentHash: text(packet.sourceDocumentHash),
    implementationConfirmationHash: text(packet.implementationConfirmationHash),
    architectureConfirmationHash: resolvedArchitectureConfirmationHash(packet, record),
    recordedAt,
    recordedBy,
  };
  const subagentEnvelope =
    packet.subagentEvidenceEnvelope && typeof packet.subagentEvidenceEnvelope === 'object' && !Array.isArray(packet.subagentEvidenceEnvelope)
      ? (packet.subagentEvidenceEnvelope as JsonObject)
      : undefined;
  const subagentEnvelopeValidation: SubagentEvidenceEnvelopeValidation | undefined = subagentEnvelope
    ? validateSubagentEvidenceEnvelope(subagentEnvelope, {
        record,
        projectRoot: process.cwd(),
        indexedArtifactRefs: [...arrayOfObjects(packet.artifactRefs), ...arrayOfObjects(packet.extensionRefs)],
        expectedParentCloseoutAttemptId: text(packet.closeoutAttemptId),
      })
    : undefined;
  const subagentEnvelopeEvent = subagentEnvelope
    ? {
        eventType: 'subagent_evidence_envelope_recorded',
        recordId,
        requirementSetId,
        executionIterationId: `${text(packet.executionIterationId)}:subagent-evidence-envelope`,
        runId: text(packet.runId),
        status: subagentEnvelopeValidation?.status ?? text(subagentEnvelope.status),
        subagentEvidenceEnvelope: subagentEnvelope,
        subagentEvidenceEnvelopeHash: subagentEnvelopeValidation?.envelopeHash,
        traceRows: arrayOfStrings(subagentEnvelope.traceRows),
        taskRefs: arrayOfStrings(subagentEnvelope.taskRefs),
        evidenceRefs: arrayOfStrings(packet.evidenceRefs),
        coveredRequirementIds: arrayOfStrings(subagentEnvelope.coveredRequirementIds),
        commandRunRefs: commandRefs,
        evidenceArtifactRefs: arrayOfObjects(packet.artifactRefs),
        sourceRefs: subagentEnvelopeValidation?.sourceRefs ?? refs,
        sourceDocumentHash: text(subagentEnvelope.sourceDocumentHash),
        implementationConfirmationHash: text(subagentEnvelope.implementationConfirmationHash),
        architectureConfirmationHash: resolvedArchitectureConfirmationHash(subagentEnvelope, record),
        recordedAt,
        recordedBy,
      }
    : undefined;
  const closureEvents = closureInputs(packet).map((closure) => ({
    eventType: 'requirement_closure_recorded',
    recordId,
    requirementSetId,
    requirementId: text(closure.requirementId),
    status: text(closure.status),
    traceRows: arrayOfStrings(packet.traceRows),
    evidenceRefs: arrayOfStrings(packet.evidenceRefs),
    commandRunRefs: commandRefs,
    evidenceArtifactRefs: artifactRefs,
    sourceRefs: refs,
    recordedAt,
    recordedBy,
  }));
  const gateEvents = normalizeGateChecks(packet).map((gate) => ({
    eventType: 'gate_check_recorded',
    recordId,
    requirementSetId,
    checkId: text(gate.checkId) || `${text(packet.executionIterationId)}:${text(gate.gate)}`,
    gate: text(gate.gate),
    decision: text(gate.decision),
    sourceRefs: refs,
    commandRunRefs: commandRefs,
    recordedAt,
    recordedBy,
  }));
  const contractCheckEvents = normalizeContractChecks(packet).map((contractCheck) => ({
    eventType: 'contract_check_recorded',
    recordId,
    requirementSetId,
    checkId: text(contractCheck.checkId) || `${text(packet.executionIterationId)}:${text(contractCheck.contract)}`,
    contract: text(contractCheck.contract),
    decision: text(contractCheck.decision),
    sourceRefs: refs,
    recordedAt,
    recordedBy,
  }));
  const failureEvents = arrayOfObjects(packet.failureRecords).map((failure) => ({
    ...failure,
    eventType: 'failure_recorded',
    recordedAt: text(failure.recordedAt) || recordedAt,
    recordedBy: text(failure.recordedBy) || recordedBy,
  }));
  const rcaEvents = arrayOfObjects(packet.rcaRecords).map((rca) => ({
    ...rca,
    eventType: 'rca_created',
    recordedAt: text(rca.recordedAt) || recordedAt,
    recordedBy: text(rca.recordedBy) || recordedBy,
  }));
  const rerunLoopEvents = arrayOfObjects(packet.rerunLoops).map((loop) => ({
    rerunLoopId: text(loop.rerunLoopId),
    status: text(loop.status),
    sourceRefs: arrayOfObjects(loop.sourceRefs),
    blockerRefs: arrayOfObjects(loop.blockerRefs),
    recheckRefs: arrayOfObjects(loop.recheckRefs),
  }));
  const existingDeliveryEvidence =
    record.deliveryEvidence && typeof record.deliveryEvidence === 'object' && !Array.isArray(record.deliveryEvidence)
      ? (record.deliveryEvidence as JsonObject)
      : {};
  const packetDeliveryEvidence =
    packet.deliveryEvidence && typeof packet.deliveryEvidence === 'object' && !Array.isArray(packet.deliveryEvidence)
      ? (packet.deliveryEvidence as JsonObject)
      : {};
  const existingRequiredCommands = arrayOfObjects(existingDeliveryEvidence.requiredCommands).map((command) =>
    normalizeHistoricalCommand(command, recordId, requirementSetId)
  );
  const packetRequiredCommands = arrayOfObjects(packetDeliveryEvidence.requiredCommands);
  const packetRuntimePolicySnapshotRef =
    packet.runtimePolicySnapshotRef &&
    typeof packet.runtimePolicySnapshotRef === 'object' &&
    !Array.isArray(packet.runtimePolicySnapshotRef)
      ? (packet.runtimePolicySnapshotRef as JsonObject)
      : undefined;
  const packetHookReconciliation =
    packet.hookReconciliation &&
    typeof packet.hookReconciliation === 'object' &&
    !Array.isArray(packet.hookReconciliation)
      ? (packet.hookReconciliation as JsonObject)
      : undefined;
  const requiredCommandsById = new Map<string, JsonObject>();
  for (const command of existingRequiredCommands) requiredCommandsById.set(text(command.commandId), command);
  for (const command of packetRequiredCommands) requiredCommandsById.set(text(command.commandId), command);
  return {
    ...record,
    ...(packet.entryFlowState && typeof packet.entryFlowState === 'object' && !Array.isArray(packet.entryFlowState)
      ? {
          entryFlow: text((packet.entryFlowState as JsonObject).entryFlow),
          entryFlowClass: text((packet.entryFlowState as JsonObject).entryFlowClass),
          workflowAdapter: text((packet.entryFlowState as JsonObject).workflowAdapter),
          contractAuthoringRequired: (packet.entryFlowState as JsonObject).contractAuthoringRequired === true,
          ...((packet.entryFlowState as JsonObject).globalContractTraceabilityPolicy &&
          typeof (packet.entryFlowState as JsonObject).globalContractTraceabilityPolicy === 'object' &&
          !Array.isArray((packet.entryFlowState as JsonObject).globalContractTraceabilityPolicy)
            ? {
                globalContractTraceabilityPolicy: (packet.entryFlowState as JsonObject)
                  .globalContractTraceabilityPolicy,
              }
            : {}),
          ...((packet.entryFlowState as JsonObject).traceStatusPolicy &&
          typeof (packet.entryFlowState as JsonObject).traceStatusPolicy === 'object' &&
          !Array.isArray((packet.entryFlowState as JsonObject).traceStatusPolicy)
            ? {
                traceStatusPolicy: (packet.entryFlowState as JsonObject).traceStatusPolicy,
              }
            : {}),
        }
      : {}),
    ...(packetRuntimePolicySnapshotRef
      ? {
          runtimePolicySnapshotRef: {
            ...packetRuntimePolicySnapshotRef,
            path: normalizePathForRecord(text(packetRuntimePolicySnapshotRef.path)),
            contentHash: text(packetRuntimePolicySnapshotRef.contentHash ?? packetRuntimePolicySnapshotRef.hash),
          },
        }
      : {}),
    ...(packetHookReconciliation
      ? {
          hookReconciliation: {
            ...packetHookReconciliation,
            missingReceipts: arrayOfObjects(packetHookReconciliation.missingReceipts),
            hashMismatches: arrayOfObjects(packetHookReconciliation.hashMismatches),
            noHookFallbackRefs: arrayOfObjects(packetHookReconciliation.noHookFallbackRefs),
          },
        }
      : {}),
    executionIterations: [
      ...arrayOfObjects(record.executionIterations),
      executionEvent,
      ...(subagentEnvelopeEvent ? [subagentEnvelopeEvent] : []),
    ],
    requirementClosures: [...arrayOfObjects(record.requirementClosures), ...closureEvents],
    gateChecks: [...arrayOfObjects(record.gateChecks), ...gateEvents],
    contractChecks: [...arrayOfObjects(record.contractChecks), ...contractCheckEvents],
    failureRecords: [...arrayOfObjects(record.failureRecords), ...failureEvents],
    rcaRecords: [...arrayOfObjects(record.rcaRecords), ...rcaEvents],
    rerunLoops: [...arrayOfObjects(record.rerunLoops), ...rerunLoopEvents],
    artifactIndex: [
      ...arrayOfObjects(record.artifactIndex).map((artifact) =>
        normalizeHistoricalArtifactRef(artifact, recordId, requirementSetId)
      ),
      ...(packetArtifact ? [packetArtifact] : []),
      ...artifactRefs,
    ],
    extensionRefs: [
      ...arrayOfObjects(record.extensionRefs).map((artifact) =>
        normalizeHistoricalArtifactRef(artifact, recordId, requirementSetId)
      ),
      ...extensionRefs,
    ],
    deliveryEvidence: {
      ...existingDeliveryEvidence,
      ...packetDeliveryEvidence,
      requiredCommands: [...requiredCommandsById.values()].filter((command) => text(command.commandId)),
      historicalRunRefs: [
        ...arrayOfObjects(existingDeliveryEvidence.historicalRunRefs),
        ...arrayOfObjects(packetDeliveryEvidence.historicalRunRefs),
      ],
    },
    lastEventType: subagentEnvelopeEvent ? 'subagent_evidence_envelope_recorded' : 'execution_iteration_recorded',
    updatedAt: recordedAt,
  };
}

export function mainIngestImplementationEvidence(argv: string[]): number {
  const args = parseArgs(argv);
  if (args.help) {
    console.log('Usage: ingest-implementation-evidence --evidence <json> --requirement-record <json> [--json]');
    return 0;
  }
  requireArgs(args);
  const evidencePath = path.resolve(args.evidence!);
  const recordPath = path.resolve(args.requirementRecord!);
  const packet = readJson(evidencePath);
  const record = readJson(recordPath);
  const mismatches = validatePacket(packet, record);
  if (mismatches.length > 0) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2));
    return 3;
  }
  const recordedAt = args.confirmedAt ?? new Date().toISOString();
  const recordedBy = args.recordedBy ?? 'agent';
  const baseDir = path.dirname(recordPath);
  const eventLog = path.resolve(args.eventLog ?? eventLogPathForRecord(recordPath));
  const artifactIndex = path.resolve(args.artifactIndex ?? path.join(baseDir, 'artifact-index.jsonl'));
  const globalArtifactIndex = path.resolve(
    args.globalArtifactIndex ?? path.join(path.dirname(baseDir), 'artifact-index.jsonl')
  );
  const packetArtifact = evidencePacketArtifact(
    packet,
    normalizePathForRecord(evidencePath),
    text(packet.recordId) || text(record.recordId),
    text(packet.requirementSetId) || text(record.requirementSetId)
  );
  const commit = appendControlEventAndReplay({
    recordPath,
    writerId: 'implementation-evidence-ingest',
    eventType: 'implementation_evidence_ingested',
    recordedAt,
    payload: {
      packet,
      artifactRefs: [packetArtifact],
      recordedAt,
      recordedBy,
      evidencePath: normalizePathForRecord(evidencePath),
    },
    reduce: (currentRecord) =>
      updateRecord(currentRecord, packet, recordedAt, recordedBy, normalizePathForRecord(evidencePath)),
  });
  for (const artifact of [
    packetArtifact,
    ...artifactEvents(
      packet,
      text(packet.recordId) || text(record.recordId),
      text(packet.requirementSetId) || text(record.requirementSetId)
    ),
  ]) {
    appendJsonl(artifactIndex, artifact);
    appendJsonl(globalArtifactIndex, artifact);
  }
  const result = {
    ok: true,
    requirementRecordPath: normalizePathForRecord(recordPath),
    eventLogPath: normalizePathForRecord(eventLog),
    controlEventId: commit.event.eventId,
    controlEventHash: commit.event.eventHash,
    receiptPath: normalizePathForRecord(commit.receiptPath),
    artifactIndexPath: normalizePathForRecord(artifactIndex),
    globalArtifactIndexPath: normalizePathForRecord(globalArtifactIndex),
  };
  process.stdout.write(args.json ? `${JSON.stringify(result, null, 2)}\n` : `execution_iteration_recorded=${text(packet.executionIterationId)}\n`);
  return 0;
}

if (require.main === module && isDirectImplementationEvidenceIngestCli(process.argv[1])) {
  try {
    process.exitCode = mainIngestImplementationEvidence(process.argv.slice(2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
    process.exitCode = 2;
  }
}
