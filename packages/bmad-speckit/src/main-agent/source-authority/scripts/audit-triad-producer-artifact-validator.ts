import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  sha256Json,
  type AuditTriadExecutionPlan,
  type AuditTriadRoundReceipt,
} from './audit-triad-orchestrator';

type JsonObject = Record<string, unknown>;

export interface AuditTriadFrozenInput {
  role: string;
  path: string;
  contentHash: string;
}

export interface AuditTriadProducerArtifactValidation {
  issueCodes: string[];
  frozenInputs: AuditTriadFrozenInput[];
}

interface JsonArtifact {
  path: string;
  contentHash: string;
  value: JsonObject;
}

interface ValidationContext {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  round: AuditTriadRoundReceipt;
  roundIndex: number;
  prefix: string;
  issueCodes: string[];
  frozenInputs: AuditTriadFrozenInput[];
  seenPaths: Map<string, string>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function isSha256(value: unknown): boolean {
  return /^sha256:[a-f0-9]{64}$/u.test(text(value));
}

function sha256File(filePath: string): string {
  return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function withoutField(value: JsonObject, field: string): JsonObject {
  const copy = { ...value };
  delete copy[field];
  return copy;
}

function pathIdentity(value: string): string {
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

function resolveContainedPath(projectRoot: string, value: string): string | null {
  const resolved = path.isAbsolute(value)
    ? path.resolve(value)
    : path.resolve(projectRoot, value);
  const rootIdentity = pathIdentity(projectRoot);
  const candidateIdentity = pathIdentity(resolved);
  const relative = path.relative(rootIdentity, candidateIdentity);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function addIssue(context: ValidationContext, code: string): void {
  if (!context.issueCodes.includes(code)) context.issueCodes.push(code);
}

function reservePath(context: ValidationContext, role: string, filePath: string): boolean {
  const identity = pathIdentity(filePath);
  const existingRole = context.seenPaths.get(identity);
  if (existingRole && existingRole !== role) {
    addIssue(context, `${context.prefix}_${role}_path_aliases_${existingRole}`);
    return false;
  }
  context.seenPaths.set(identity, role);
  return true;
}

function freezeInput(
  context: ValidationContext,
  role: string,
  filePath: string,
  contentHash: string
): void {
  const normalized = path.resolve(filePath);
  if (
    !context.frozenInputs.some(
      (input) => path.resolve(input.path) === normalized
    )
  ) {
    context.frozenInputs.push({ role, path: normalized, contentHash });
  }
}

function readJsonArtifact(
  context: ValidationContext,
  role: string,
  artifactPath: unknown
): JsonArtifact | null {
  const pathValue = text(artifactPath);
  if (!pathValue) {
    addIssue(context, `${context.prefix}_${role}_path_missing`);
    return null;
  }
  const resolved = resolveContainedPath(context.projectRoot, pathValue);
  if (!resolved) {
    addIssue(context, `${context.prefix}_${role}_outside_project`);
    return null;
  }
  if (!reservePath(context, role, resolved)) return null;
  if (!fs.existsSync(resolved)) {
    addIssue(context, `${context.prefix}_${role}_artifact_missing`);
    return null;
  }
  const content = fs.readFileSync(resolved);
  const contentHash = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;
  freezeInput(context, role, resolved, contentHash);
  try {
    const parsed = JSON.parse(content.toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('json_object_required');
    }
    return { path: resolved, contentHash, value: parsed as JsonObject };
  } catch {
    addIssue(context, `${context.prefix}_${role}_invalid_json`);
    return null;
  }
}

function readFileArtifact(
  context: ValidationContext,
  role: string,
  artifactPath: unknown
): AuditTriadFrozenInput | null {
  const pathValue = text(artifactPath);
  if (!pathValue) {
    addIssue(context, `${context.prefix}_${role}_path_missing`);
    return null;
  }
  const resolved = resolveContainedPath(context.projectRoot, pathValue);
  if (!resolved) {
    addIssue(context, `${context.prefix}_${role}_outside_project`);
    return null;
  }
  if (!reservePath(context, role, resolved)) return null;
  if (!fs.existsSync(resolved)) {
    addIssue(context, `${context.prefix}_${role}_artifact_missing`);
    return null;
  }
  const contentHash = sha256File(resolved);
  freezeInput(context, role, resolved, contentHash);
  return { role, path: resolved, contentHash };
}

function validateSelfHash(
  context: ValidationContext,
  role: string,
  artifact: JsonArtifact,
  field: string
): void {
  const value = text(artifact.value[field]);
  if (!isSha256(value) || value !== sha256Json(withoutField(artifact.value, field))) {
    addIssue(context, `${context.prefix}_${role}_self_hash_invalid`);
  }
}

function validateBoundReceipt(
  context: ValidationContext,
  role: string,
  refValue: unknown,
  expectedSchemaVersion: string
): JsonArtifact | null {
  const ref = object(refValue);
  const artifact = readJsonArtifact(context, role, ref.path);
  if (!artifact) return null;
  if (text(artifact.value.schemaVersion) !== expectedSchemaVersion) {
    addIssue(context, `${context.prefix}_${role}_schema_invalid`);
  }
  if (text(ref.contentHash) !== artifact.contentHash) {
    addIssue(context, `${context.prefix}_${role}_content_hash_mismatch`);
  }
  if (
    !isSha256(ref.receiptHash) ||
    text(ref.receiptHash) !== text(artifact.value.receiptHash)
  ) {
    addIssue(context, `${context.prefix}_${role}_receipt_hash_ref_mismatch`);
  }
  validateSelfHash(context, role, artifact, 'receiptHash');
  return artifact;
}

function validatePathReceipt(
  context: ValidationContext,
  role: string,
  refValue: unknown,
  expectedSchemaVersion: string
): JsonArtifact | null {
  const artifact = readJsonArtifact(context, role, refValue);
  if (!artifact) return null;
  if (text(artifact.value.schemaVersion) !== expectedSchemaVersion) {
    addIssue(context, `${context.prefix}_${role}_schema_invalid`);
  }
  validateSelfHash(context, role, artifact, 'receiptHash');
  return artifact;
}

function requireEqual(
  context: ValidationContext,
  left: unknown,
  right: unknown,
  code: string
): void {
  const scalar = (value: unknown): string =>
    typeof value === 'string'
      ? value.trim()
      : typeof value === 'number' || typeof value === 'boolean'
        ? String(value)
        : '';
  if (scalar(left) !== scalar(right)) addIssue(context, `${context.prefix}_${code}`);
}

function requireJsonEqual(
  context: ValidationContext,
  left: unknown,
  right: unknown,
  code: string
): void {
  if (sha256Json(left) !== sha256Json(right)) addIssue(context, `${context.prefix}_${code}`);
}

function validateTransportFiles(
  context: ValidationContext,
  rolePrefix: string,
  value: JsonObject
): void {
  const stdout = readFileArtifact(context, `${rolePrefix}_stdout`, value.stdoutPath);
  const stderr = readFileArtifact(context, `${rolePrefix}_stderr`, value.stderrPath);
  if (stdout && text(value.stdoutHash) !== stdout.contentHash) {
    addIssue(context, `${context.prefix}_${rolePrefix}_stdout_hash_mismatch`);
  }
  if (stderr && text(value.stderrHash) !== stderr.contentHash) {
    addIssue(context, `${context.prefix}_${rolePrefix}_stderr_hash_mismatch`);
  }
}

function validateProviderCommitArtifacts(
  context: ValidationContext,
  provider: JsonArtifact | null
): void {
  if (!provider) return;
  const providerDir = path.dirname(provider.path);
  const result = readJsonArtifact(
    context,
    'provider_result',
    text(provider.value.resultPath)
      ? text(provider.value.resultPath)
      : path.join(providerDir, 'judge-provider-result.json')
  );
  const state = readJsonArtifact(
    context,
    'provider_state',
    path.join(providerDir, 'judge-provider-invocation-state.json')
  );
  const commit = readJsonArtifact(
    context,
    'provider_commit',
    path.join(providerDir, 'judge-provider-invocation-commit.json')
  );
  if (result) {
    if (text(result.value.schemaVersion) !== 'critical-auditor-judge-provider-result/v1') {
      addIssue(context, `${context.prefix}_provider_result_schema_invalid`);
    }
    requireEqual(
      context,
      provider.value.resultContentHash,
      result.contentHash,
      'provider_result_content_hash_mismatch'
    );
  }
  if (state) {
    validateSelfHash(context, 'provider_state', state, 'stateHash');
    requireEqual(context, state.value.status, 'committed', 'provider_state_not_committed');
    requireEqual(context, state.value.receiptHash, provider.value.receiptHash, 'provider_state_receipt_mismatch');
    requireEqual(context, state.value.receiptContentHash, provider.contentHash, 'provider_state_receipt_content_hash_mismatch');
    if (result) requireEqual(context, state.value.resultContentHash, result.contentHash, 'provider_state_result_mismatch');
  }
  if (commit) {
    validateSelfHash(context, 'provider_commit', commit, 'commitHash');
    requireEqual(context, commit.value.receiptHash, provider.value.receiptHash, 'provider_commit_receipt_mismatch');
    requireEqual(context, commit.value.receiptContentHash, provider.contentHash, 'provider_commit_receipt_content_hash_mismatch');
    if (state) requireEqual(context, commit.value.stateContentHash, sha256File(state.path), 'provider_commit_state_mismatch');
    if (result) requireEqual(context, commit.value.resultContentHash, result.contentHash, 'provider_commit_result_mismatch');
  }
}

function validateReadonlyState(
  context: ValidationContext,
  roundDir: string,
  request: JsonArtifact | null,
  response: JsonArtifact | null,
  host: JsonArtifact | null
): void {
  const state = readJsonArtifact(
    context,
    'readonly_auditor_state',
    path.join(roundDir, 'readonly-auditor-invocation-state.json')
  );
  if (!state) return;
  validateSelfHash(context, 'readonly_auditor_state', state, 'stateHash');
  requireEqual(context, state.value.status, 'committed', 'readonly_auditor_state_not_committed');
  if (request) requireEqual(context, state.value.requestHash, request.value.requestHash, 'readonly_auditor_state_request_mismatch');
  if (response) {
    requireEqual(context, state.value.responseHash, response.value.responseHash, 'readonly_auditor_state_response_mismatch');
    requireEqual(context, state.value.responseContentHash, response.contentHash, 'readonly_auditor_state_response_content_hash_mismatch');
  }
  if (host) {
    requireEqual(context, state.value.hostReceiptReceiptHash, host.value.receiptHash, 'readonly_auditor_state_host_receipt_mismatch');
    requireEqual(context, state.value.hostReceiptContentHash, host.contentHash, 'readonly_auditor_state_host_content_hash_mismatch');
  }
}

function validateRoundRequestArtifacts(
  context: ValidationContext,
  roundDir: string,
  host: JsonArtifact | null,
  judge: JsonArtifact | null
): {
  request: JsonArtifact | null;
  response: JsonArtifact | null;
  judgeRequest: JsonArtifact | null;
  binding: JsonArtifact | null;
} {
  const request = readJsonArtifact(
    context,
    'readonly_auditor_request',
    path.join(roundDir, 'readonly-auditor-request.json')
  );
  const response = readJsonArtifact(
    context,
    'readonly_auditor_response',
    path.join(roundDir, 'readonly-auditor-response.json')
  );
  const judgeRequest = readJsonArtifact(
    context,
    'judge_request',
    path.join(roundDir, 'judge-request.json')
  );
  const binding = readJsonArtifact(
    context,
    'run_auditor_host_binding',
    path.join(roundDir, 'run-auditor-host-binding.json')
  );
  if (request) {
    if (text(request.value.schemaVersion) !== 'audit-readonly-auditor-request/v1') {
      addIssue(context, `${context.prefix}_readonly_auditor_request_schema_invalid`);
    }
    requireEqual(context, request.value.requestHash, sha256Json(withoutField(request.value, 'requestHash')), 'readonly_auditor_request_self_hash_invalid');
  }
  if (response) {
    if (text(response.value.schemaVersion) !== 'audit-readonly-auditor-response/v1') {
      addIssue(context, `${context.prefix}_readonly_auditor_response_schema_invalid`);
    }
    requireEqual(context, response.value.responseHash, sha256Json(withoutField(response.value, 'responseHash')), 'readonly_auditor_response_self_hash_invalid');
  }
  if (judgeRequest) {
    if (text(judgeRequest.value.schemaVersion) !== 'critical-auditor-round-request/v1') {
      addIssue(context, `${context.prefix}_judge_request_schema_invalid`);
    }
    const expectedHash = { ...judgeRequest.value, requestHash: null };
    requireEqual(context, judgeRequest.value.requestHash, sha256Json(expectedHash), 'judge_request_self_hash_invalid');
  }
  if (request && response) {
    requireEqual(context, response.value.requestHash, request.value.requestHash, 'readonly_response_request_mismatch');
    requireEqual(context, response.value.auditEpochId, context.plan.auditEpochId, 'readonly_response_epoch_mismatch');
    requireEqual(context, response.value.auditTargetBundleHash, context.plan.auditTargetBundleHash, 'readonly_response_target_mismatch');
    requireEqual(context, response.value.roundIndex, context.roundIndex, 'readonly_response_round_index_mismatch');
    requireEqual(context, context.round.readonlyAuditorInvocationId, response.value.producerInvocationId, 'readonly_response_producer_mismatch');
    requireJsonEqual(context, context.round.perspectiveResults, response.value.perspectiveResults, 'readonly_response_perspectives_mismatch');
    requireJsonEqual(context, context.round.vetoItemResults, response.value.vetoItemResults, 'readonly_response_veto_results_mismatch');
  }
  if (judgeRequest && response) {
    requireEqual(context, judgeRequest.value.readonlyAuditorResponseHash, response.value.responseHash, 'judge_request_readonly_response_mismatch');
    requireEqual(context, judgeRequest.value.auditEpochId, context.plan.auditEpochId, 'judge_request_epoch_mismatch');
    requireEqual(context, judgeRequest.value.auditTargetBundleHash, context.plan.auditTargetBundleHash, 'judge_request_target_mismatch');
  }
  if (host) {
    requireEqual(context, host.value.auditEpochId, context.plan.auditEpochId, 'readonly_host_epoch_mismatch');
    requireEqual(context, host.value.auditTargetBundleHash, context.plan.auditTargetBundleHash, 'readonly_host_target_mismatch');
    requireEqual(context, host.value.roundIndex, context.roundIndex, 'readonly_host_round_index_mismatch');
    requireEqual(context, host.value.producerInvocationId, context.round.readonlyAuditorInvocationId, 'readonly_host_producer_mismatch');
    if (host.value.responseProduced !== true || Number(host.value.exitCode) !== 0) {
      addIssue(context, `${context.prefix}_readonly_host_execution_failed`);
    }
    validateTransportFiles(context, 'readonly_host_transport', host.value);
  }
  if (judge && judgeRequest) {
    requireEqual(context, judge.value.judgeRequestHash, judgeRequest.value.requestHash, 'judge_receipt_request_mismatch');
    if (response) requireEqual(context, judge.value.readonlyAuditorResponseHash, response.value.responseHash, 'judge_receipt_response_mismatch');
  }
  if (binding) {
    requireEqual(context, binding.value.roundId, context.round.roundId, 'run_auditor_host_binding_round_mismatch');
    requireEqual(context, binding.value.auditEpochId, context.plan.auditEpochId, 'run_auditor_host_binding_epoch_mismatch');
    requireEqual(context, binding.value.auditTargetBundleHash, context.plan.auditTargetBundleHash, 'run_auditor_host_binding_target_mismatch');
    requireEqual(context, binding.value.sourceDocumentHash, context.plan.sourceDocumentHash, 'run_auditor_host_binding_source_mismatch');
    requireEqual(context, binding.value.semanticModelHash, context.plan.semanticModelHash, 'run_auditor_host_binding_semantic_mismatch');
    requireEqual(context, binding.value.projectionSetHash, context.plan.projectionSetHash, 'run_auditor_host_binding_projection_mismatch');
    if (!text(binding.value.runAuditorHostInvocationId)) {
      addIssue(context, `${context.prefix}_run_auditor_host_binding_invocation_missing`);
    }
    if (request) requireEqual(context, binding.value.readonlyAuditorRequestHash, request.value.requestHash, 'run_auditor_host_binding_request_mismatch');
    if (response) requireEqual(context, binding.value.readonlyAuditorResponseHash, response.value.responseHash, 'run_auditor_host_binding_response_mismatch');
    if (judgeRequest) requireEqual(context, binding.value.judgeRequestHash, judgeRequest.value.requestHash, 'run_auditor_host_binding_judge_request_mismatch');
    if (judge) {
      requireJsonEqual(
        context,
        binding.value.judgeExecutionReceiptRef,
        context.round.judgeExecutionReceiptRef,
        'run_auditor_host_binding_judge_receipt_mismatch'
      );
    }
  }
  return { request, response, judgeRequest, binding };
}

function validateJudgeHostExecution(
  context: ValidationContext,
  roundValue: JsonObject,
  provider: JsonArtifact | null
): void {
  const execution = object(roundValue.judgeAdapterHostExecution);
  if (Object.keys(execution).length === 0) {
    addIssue(context, `${context.prefix}_judge_host_execution_missing`);
    return;
  }
  if (!isSha256(execution.commandHash)) {
    addIssue(context, `${context.prefix}_judge_host_command_hash_invalid`);
  }
  validateTransportFiles(context, 'judge_host_transport', execution);
  const adapterKind = text(execution.adapterKind);
  if (
    adapterKind !== 'package_cli_external_adapter' &&
    adapterKind !== 'committed_provider_invocation_recovery'
  ) {
    addIssue(context, `${context.prefix}_judge_host_adapter_invalid`);
  }
  if (adapterKind === 'package_cli_external_adapter' && Number(execution.exitCode) !== 0) {
    addIssue(context, `${context.prefix}_judge_host_execution_failed`);
  }
  const providerTransport = provider ? object(provider.value.transportEvidence) : {};
  if (provider) {
    requireEqual(context, provider.value.transportEvidenceHash, sha256Json(providerTransport), 'provider_transport_evidence_hash_invalid');
    requireEqual(context, providerTransport.command, 'claude', 'provider_transport_command_invalid');
    requireEqual(context, providerTransport.executorKind, 'native_spawn', 'provider_transport_executor_invalid');
    if (Number(providerTransport.exitCode) !== 0) {
      addIssue(context, `${context.prefix}_provider_transport_execution_failed`);
    }
  }
}

export function validateAuditTriadProducerArtifacts(input: {
  projectRoot: string;
  plan: AuditTriadExecutionPlan;
  round: AuditTriadRoundReceipt;
  roundIndex: number;
  reservedPaths?: Array<{ role: string; path: string }>;
}): AuditTriadProducerArtifactValidation {
  const context: ValidationContext = {
    projectRoot: path.resolve(input.projectRoot),
    plan: input.plan,
    round: input.round,
    roundIndex: input.roundIndex,
    prefix: `round_${input.roundIndex}`,
    issueCodes: [],
    frozenInputs: [],
    seenPaths: new Map<string, string>(),
  };
  for (const reserved of input.reservedPaths ?? []) {
    if (text(reserved.path)) {
      context.seenPaths.set(pathIdentity(reserved.path), reserved.role);
    }
  }

  const roundValue = input.round as unknown as JsonObject;
  const provider = validateBoundReceipt(
    context,
    'provider_invocation_receipt',
    input.round.providerInvocationReceiptRef,
    'critical-auditor-judge-invocation-receipt/v1'
  );
  const judge = validateBoundReceipt(
    context,
    'judge_execution_receipt',
    input.round.judgeExecutionReceiptRef,
    'audit-judge-execution-receipt/v1'
  );
  const host = validateBoundReceipt(
    context,
    'readonly_host_receipt',
    input.round.readonlyAuditorHostInvocationReceiptRef,
    'audit-readonly-auditor-host-invocation-receipt/v1'
  );
  const scoreWriter = validateBoundReceipt(
    context,
    'score_writer_receipt',
    input.round.scoreWriterInvocationReceiptRef,
    'run-auditor-host-score-writer-invocation-receipt/v1'
  );
  const scoreRefs = Array.isArray(input.round.scoreReceiptRefs)
    ? input.round.scoreReceiptRefs.map(text).filter(Boolean)
    : [];
  const hostRefs = Array.isArray(input.round.runAuditorHostReceiptRefs)
    ? input.round.runAuditorHostReceiptRefs.map(text).filter(Boolean)
    : [];
  if (scoreRefs.length !== 1) addIssue(context, `${context.prefix}_score_receipt_count_invalid`);
  if (hostRefs.length !== 1) addIssue(context, `${context.prefix}_run_auditor_host_receipt_count_invalid`);
  const score = validatePathReceipt(
    context,
    'score_receipt',
    scoreRefs[0],
    'run-auditor-host-score-receipt/v1'
  );
  const closeout = validatePathReceipt(
    context,
    'run_auditor_host_receipt',
    hostRefs[0],
    'run-auditor-host-closeout-receipt/v1'
  );

  const roundDir = judge
    ? path.dirname(judge.path)
    : host
      ? path.dirname(host.path)
      : provider
        ? path.dirname(provider.path)
        : '';
  const requestArtifacts = roundDir
    ? validateRoundRequestArtifacts(context, roundDir, host, judge)
    : { request: null, response: null, judgeRequest: null, binding: null };
  if (roundDir) {
    validateReadonlyState(
      context,
      roundDir,
      requestArtifacts.request,
      requestArtifacts.response,
      host
    );
  }
  validateJudgeHostExecution(context, roundValue, provider);
  validateProviderCommitArtifacts(context, provider);

  if (provider) {
    const evidence = object(input.round.independentProviderEvidence);
    requireEqual(context, provider.value.requestHash, input.round.criticalAuditorRequestHash, 'provider_request_hash_mismatch');
    requireEqual(context, provider.value.sourceDocumentHash, input.plan.sourceDocumentHash, 'provider_source_hash_mismatch');
    requireEqual(context, provider.value.semanticModelHash, input.plan.semanticModelHash, 'provider_semantic_hash_mismatch');
    requireEqual(context, provider.value.projectionSetHash, input.plan.projectionSetHash, 'provider_projection_hash_mismatch');
    requireEqual(context, provider.value.providerRunId, evidence.providerRunId, 'provider_run_id_mismatch');
    requireEqual(context, provider.value.responseHash, evidence.responseHash, 'provider_response_hash_mismatch');
  }
  if (judge) {
    requireEqual(context, judge.value.auditEpochId, input.plan.auditEpochId, 'judge_receipt_epoch_mismatch');
    requireEqual(context, judge.value.auditTargetBundleHash, input.plan.auditTargetBundleHash, 'judge_receipt_target_mismatch');
    requireEqual(context, judge.value.roundIndex, input.roundIndex, 'judge_receipt_round_index_mismatch');
    requireEqual(context, judge.value.verdict, input.round.verdict, 'judge_receipt_verdict_mismatch');
    requireJsonEqual(context, judge.value.validatedGapRefs, input.round.validatedGapRefs, 'judge_receipt_gap_refs_mismatch');
    requireJsonEqual(context, judge.value.independentProviderEvidence, input.round.independentProviderEvidence, 'judge_receipt_provider_evidence_mismatch');
    requireJsonEqual(context, judge.value.providerInvocationReceiptRef, input.round.providerInvocationReceiptRef, 'judge_receipt_provider_ref_mismatch');
    for (const [field, value] of [
      ['sourceDocumentHash', input.plan.sourceDocumentHash],
      ['semanticModelHash', input.plan.semanticModelHash],
      ['implementationConfirmationHash', input.plan.implementationConfirmationHash],
      ['projectionSetHash', input.plan.projectionSetHash],
      ['qualityRuleSetHash', input.plan.qualityRuleSetHash],
      ['currentAttemptHash', input.plan.currentAttemptHash],
      ['currentEvidenceHash', input.plan.currentEvidenceHash],
    ] as const) {
      requireEqual(context, judge.value[field], value, `judge_receipt_${field}_mismatch`);
    }
  }
  if (host) {
    requireEqual(context, host.value.responseHash, requestArtifacts.response?.value.responseHash, 'readonly_host_response_hash_mismatch');
  }
  if (requestArtifacts.binding) {
    const binding = requestArtifacts.binding.value;
    const bindingHash = sha256Json(binding);
    if (scoreWriter) requireEqual(context, scoreWriter.value.bindingHash, bindingHash, 'score_writer_binding_hash_mismatch');
    if (score) requireEqual(context, score.value.bindingHash, bindingHash, 'score_receipt_binding_hash_mismatch');
    if (closeout) requireEqual(context, closeout.value.bindingHash, bindingHash, 'run_auditor_host_binding_hash_mismatch');
    if (judge) {
      requireJsonEqual(context, binding.judgeExecutionReceiptRef, input.round.judgeExecutionReceiptRef, 'run_auditor_host_binding_judge_ref_mismatch');
      requireJsonEqual(context, binding.judgeProviderInvocationReceiptRef, input.round.providerInvocationReceiptRef, 'run_auditor_host_binding_provider_ref_mismatch');
    }
    const reportPath = path.join(path.dirname(requestArtifacts.binding.path), 'judge-authoritative-audit-report.md');
    const report = readFileArtifact(context, 'judge_authoritative_report', reportPath);
    if (report) requireEqual(context, binding.judgeAuthoritativeReportHash, report.contentHash, 'judge_authoritative_report_hash_mismatch');
  }
  if (scoreWriter) {
    requireEqual(context, scoreWriter.value.roundId, input.round.roundId, 'score_writer_round_mismatch');
    requireEqual(context, scoreWriter.value.producerIdentity && object(scoreWriter.value.producerIdentity).id, 'package-score-command', 'score_writer_identity_invalid');
    requireEqual(context, scoreWriter.value.producerIdentity && object(scoreWriter.value.producerIdentity).role, 'score_writer', 'score_writer_role_invalid');
    const scoreRecord = readJsonArtifact(context, 'score_record', scoreWriter.value.scoreRecordPath);
    if (scoreRecord) requireEqual(context, scoreWriter.value.scoreRecordHash, scoreRecord.contentHash, 'score_writer_score_record_hash_mismatch');
    const state = readJsonArtifact(
      context,
      'score_writer_state',
      path.join(path.dirname(scoreWriter.path), 'score-writer-invocation-state.json')
    );
    if (state) {
      validateSelfHash(context, 'score_writer_state', state, 'stateHash');
      requireEqual(context, state.value.status, 'committed', 'score_writer_state_not_committed');
      requireEqual(context, state.value.receiptHash, scoreWriter.value.receiptHash, 'score_writer_state_receipt_mismatch');
    }
    if (score) {
      requireJsonEqual(context, score.value.scoreWriterInvocationReceiptRef, input.round.scoreWriterInvocationReceiptRef, 'score_receipt_score_writer_ref_mismatch');
      requireEqual(context, score.value.scoreRecordHash, scoreWriter.value.scoreRecordHash, 'score_receipt_score_record_hash_mismatch');
    }
    if (closeout) {
      requireEqual(context, closeout.value.scoreReceiptPath, scoreRefs[0], 'run_auditor_host_score_receipt_path_mismatch');
      if (score) requireEqual(context, closeout.value.scoreReceiptHash, score.value.receiptHash, 'run_auditor_host_score_receipt_hash_mismatch');
      requireJsonEqual(context, closeout.value.scoreWriterInvocationReceiptRef, input.round.scoreWriterInvocationReceiptRef, 'run_auditor_host_score_writer_ref_mismatch');
      requireEqual(context, closeout.value.auditStatus, 'PASS', 'run_auditor_host_status_not_pass');
      if (closeout.value.closeoutApproved !== true) addIssue(context, `${context.prefix}_run_auditor_host_closeout_not_approved`);
    }
  }
  return {
    issueCodes: [...new Set(context.issueCodes)],
    frozenInputs: context.frozenInputs,
  };
}
