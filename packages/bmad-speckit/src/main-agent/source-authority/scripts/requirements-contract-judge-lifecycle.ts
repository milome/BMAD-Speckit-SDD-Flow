import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonicalJson } from './requirements-contract-governed-write';
import { sha256Stable } from './requirements-contract-semantic-resolver';

type JsonRecord = Record<string, unknown>;

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const RESPONSE_KEYS = new Set([
  'schemaVersion',
  'judgeRequestHash',
  'verdict',
  'findings',
  'advisoryObservations',
  'checkedDimensionIds',
  'dimensionResults',
  'reviewedArtifactRefs',
  'reviewedMustRefs',
  'insufficientAuditReasons',
]);
const ACTIVE_REQUEST_KEYS = new Set([
  'schemaVersion',
  'version',
  'previousVersion',
  'semanticRevisionId',
  'auditPolicyHash',
  'providerSelectionHash',
  'judgeRequestHash',
  'requestPath',
  'status',
  'acceptedEvaluation',
  'attemptCount',
  'lastAttemptPath',
  'lastIssueCode',
  'responseRef',
  'aggregateRef',
  'effectivePassRef',
  'remediationPlanRef',
  'remediationDeltaRef',
]);

export type RequirementsContractJudgeActiveStatus =
  | 'audit_pending'
  | 'dispatch_pending'
  | 'retry_scheduled'
  | 'audited_pass'
  | 'audited_fail'
  | 'superseded';

export interface RequirementsContractJudgeArtifactRef {
  path: string;
  hash: string;
}

export interface RequirementsContractJudgeActiveRequest {
  schemaVersion: 'requirements-contract-judge-active-request/v1';
  version: number;
  previousVersion: number | null;
  semanticRevisionId: string;
  auditPolicyHash: string;
  providerSelectionHash: string;
  judgeRequestHash: string;
  requestPath: string;
  status: RequirementsContractJudgeActiveStatus;
  acceptedEvaluation: boolean;
  attemptCount: number;
  lastAttemptPath: string | null;
  lastIssueCode: string | null;
  responseRef: RequirementsContractJudgeArtifactRef | null;
  aggregateRef: RequirementsContractJudgeArtifactRef | null;
  effectivePassRef: RequirementsContractJudgeArtifactRef | null;
  remediationPlanRef: RequirementsContractJudgeArtifactRef | null;
  remediationDeltaRef: RequirementsContractJudgeArtifactRef | null;
}

export function classifyAcceptedJudgeFailureContinuation(input: {
  request: { remediation?: unknown };
  activeRequest: Pick<RequirementsContractJudgeActiveRequest, 'remediationDeltaRef'>;
}): 'compile' | 'resume_commit' | 'limit' {
  if (input.request.remediation !== null && input.request.remediation !== undefined) {
    return 'limit';
  }
  return input.activeRequest.remediationDeltaRef ? 'resume_commit' : 'compile';
}

export function closedRemediationHaltResult(input: {
  issueCode: string;
  authoringRequestId: string;
  authoringAttemptId: string;
  judgeRequestHash: string;
  automaticRemediationCount: number;
}) {
  const payload = {
    schemaVersion: 'requirements-contract-cli-result/v1' as const,
    status: 'authoring_blocked' as const,
    issueCode: input.issueCode,
    authoringRequestId: input.authoringRequestId,
    authoringAttemptId: input.authoringAttemptId,
    judgeRequestHash: input.judgeRequestHash,
    automaticRemediationCount: input.automaticRemediationCount,
    resumable: false,
    nextAction: null,
  };
  return {
    ...payload,
    resultHash: sha256Stable({ domain: 'requirements-contract-cli-result/v1', payload }),
    exitCode: 0,
    errors: [],
  };
}

function record(value: unknown, code: string): JsonRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  return value as JsonRecord;
}

function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(code);
  }
  if (new Set(value).size !== value.length) throw new Error(code);
  return [...value].sort((left, right) => left.localeCompare(right, 'en'));
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  const leftSorted = [...new Set(left)].sort((a, b) => a.localeCompare(b, 'en'));
  const rightSorted = [...new Set(right)].sort((a, b) => a.localeCompare(b, 'en'));
  return leftSorted.length === rightSorted.length && leftSorted.every((value, i) => value === rightSorted[i]);
}

function requireHash(value: unknown, code: string): string {
  const hash = String(value ?? '');
  if (!HASH_PATTERN.test(hash)) throw new Error(code);
  return hash;
}

function hashPathSegment(hash: string): string {
  return hash.replace(':', '-');
}

function assertLogicalFinding(value: unknown): JsonRecord {
  const finding = record(value, 'requirements_contract_judge_finding_invalid');
  const allowed = new Set([
    'findingId',
    'severity',
    'summary',
    'affectedMustRefs',
    'affectedArtifactRefs',
    'logicalEvidenceRefs',
  ]);
  if (Object.keys(finding).some((key) => !allowed.has(key))) {
    throw new Error('requirements_contract_judge_finding_field_set_invalid');
  }
  if (typeof finding.findingId !== 'string' || !finding.findingId.trim()) {
    throw new Error('requirements_contract_judge_finding_id_invalid');
  }
  if (!['Blocker', 'Major', 'Minor'].includes(String(finding.severity))) {
    throw new Error('requirements_contract_judge_finding_severity_invalid');
  }
  if (typeof finding.summary !== 'string' || !finding.summary.trim()) {
    throw new Error('requirements_contract_judge_finding_summary_invalid');
  }
  stringArray(finding.affectedMustRefs, 'requirements_contract_judge_finding_must_refs_invalid');
  stringArray(
    finding.affectedArtifactRefs,
    'requirements_contract_judge_finding_artifact_refs_invalid'
  );
  stringArray(
    finding.logicalEvidenceRefs,
    'requirements_contract_judge_finding_logical_refs_invalid'
  );
  if (Object.hasOwn(finding, 'sourceSpanRefs')) {
    throw new Error('requirements_contract_judge_physical_source_refs_forbidden');
  }
  return finding;
}

export function validateRequirementsContractJudgeResponse(input: {
  response: unknown;
  judgeRequestHash: string;
  requiredDimensionIds: string[];
  requiredArtifactRefs: string[];
  requiredMustRefs: string[];
}): JsonRecord {
  const response = record(input.response, 'requirements_contract_judge_response_invalid');
  if (
    Object.keys(response).length !== RESPONSE_KEYS.size ||
    Object.keys(response).some((key) => !RESPONSE_KEYS.has(key))
  ) {
    throw new Error('requirements_contract_judge_response_field_set_invalid');
  }
  if (response.schemaVersion !== 'requirements-contract-judge-response/v2') {
    throw new Error('requirements_contract_judge_response_schema_version_invalid');
  }
  requireHash(input.judgeRequestHash, 'requirements_contract_judge_request_hash_invalid');
  if (response.judgeRequestHash !== input.judgeRequestHash) {
    throw new Error('requirements_contract_judge_response_request_mismatch');
  }
  if (!['pass', 'fail'].includes(String(response.verdict))) {
    throw new Error('requirements_contract_judge_response_verdict_invalid');
  }
  if (!Array.isArray(response.findings)) {
    throw new Error('requirements_contract_judge_findings_invalid');
  }
  const findings = response.findings.map(assertLogicalFinding);
  if (!Array.isArray(response.advisoryObservations)) {
    throw new Error('requirements_contract_judge_advisories_invalid');
  }
  const checkedDimensionIds = stringArray(
    response.checkedDimensionIds,
    'requirements_contract_judge_dimensions_invalid'
  );
  const reviewedArtifactRefs = stringArray(
    response.reviewedArtifactRefs,
    'requirements_contract_judge_artifact_refs_invalid'
  );
  const reviewedMustRefs = stringArray(
    response.reviewedMustRefs,
    'requirements_contract_judge_must_refs_invalid'
  );
  const insufficientAuditReasons = stringArray(
    response.insufficientAuditReasons,
    'requirements_contract_judge_insufficient_reasons_invalid'
  );
  if (!Array.isArray(response.dimensionResults)) {
    throw new Error('requirements_contract_judge_dimension_results_invalid');
  }
  const dimensionResults = response.dimensionResults.map((value) => {
    const result = record(value, 'requirements_contract_judge_dimension_result_invalid');
    const keys = new Set(['dimensionId', 'decision', 'findingRefs']);
    if (Object.keys(result).length !== keys.size || Object.keys(result).some((key) => !keys.has(key))) {
      throw new Error('requirements_contract_judge_dimension_result_invalid');
    }
    if (typeof result.dimensionId !== 'string' || !result.dimensionId.trim()) {
      throw new Error('requirements_contract_judge_dimension_result_invalid');
    }
    if (!['pass', 'fail', 'insufficient'].includes(String(result.decision))) {
      throw new Error('requirements_contract_judge_dimension_result_invalid');
    }
    stringArray(result.findingRefs, 'requirements_contract_judge_dimension_finding_refs_invalid');
    return result;
  });
  const resultDimensionIds = dimensionResults.map((result) => String(result.dimensionId));
  if (
    !sameSet(checkedDimensionIds, input.requiredDimensionIds) ||
    !sameSet(resultDimensionIds, input.requiredDimensionIds) ||
    !sameSet(reviewedArtifactRefs, input.requiredArtifactRefs) ||
    !sameSet(reviewedMustRefs, input.requiredMustRefs) ||
    insufficientAuditReasons.length > 0 ||
    dimensionResults.some((result) => result.decision === 'insufficient')
  ) {
    throw new Error('judge_audit_incomplete');
  }
  const blocking = findings.filter((finding) => ['Blocker', 'Major'].includes(String(finding.severity)));
  const requiredMustRefs = new Set(input.requiredMustRefs);
  const requiredArtifactRefs = new Set(input.requiredArtifactRefs);
  if (findings.some((finding) =>
    (finding.affectedMustRefs as string[]).some((ref) => !requiredMustRefs.has(ref))
  )) {
    throw new Error('requirements_contract_judge_finding_must_ref_unknown');
  }
  if (findings.some((finding) =>
    (finding.affectedArtifactRefs as string[]).some((ref) => !requiredArtifactRefs.has(ref))
  )) {
    throw new Error('requirements_contract_judge_finding_artifact_ref_unknown');
  }
  if (response.verdict === 'pass' && blocking.length > 0) {
    throw new Error('requirements_contract_judge_pass_with_blocking_finding');
  }
  if (response.verdict === 'pass' && findings.length > 0) {
    throw new Error('requirements_contract_judge_pass_with_findings');
  }
  if (response.verdict === 'fail' && blocking.length === 0) {
    throw new Error('requirements_contract_judge_fail_without_blocking_finding');
  }
  return response;
}

export function createRequirementsContractJudgeActiveRequest(input: {
  version: number;
  previousVersion: number | null;
  semanticRevisionId: string;
  auditPolicyHash: string;
  providerSelectionHash: string;
  judgeRequestHash: string;
  requestPath: string;
}): RequirementsContractJudgeActiveRequest {
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new Error('requirements_contract_judge_active_version_invalid');
  }
  requireHash(input.auditPolicyHash, 'requirements_contract_judge_audit_policy_hash_invalid');
  requireHash(input.providerSelectionHash, 'requirements_contract_judge_selection_hash_invalid');
  requireHash(input.judgeRequestHash, 'requirements_contract_judge_request_hash_invalid');
  if (input.requestPath !== `quality/requests/${hashPathSegment(input.judgeRequestHash)}/judge-request.json`) {
    throw new Error('requirements_contract_judge_request_path_identity_mismatch');
  }
  return {
    schemaVersion: 'requirements-contract-judge-active-request/v1',
    ...input,
    status: 'dispatch_pending',
    acceptedEvaluation: false,
    attemptCount: 0,
    lastAttemptPath: null,
    lastIssueCode: null,
    responseRef: null,
    aggregateRef: null,
    effectivePassRef: null,
    remediationPlanRef: null,
    remediationDeltaRef: null,
  };
}

export function validateRequirementsContractJudgeActiveRequest(
  value: RequirementsContractJudgeActiveRequest
): void {
  if (
    Object.keys(value).length !== ACTIVE_REQUEST_KEYS.size ||
    Object.keys(value).some((key) => !ACTIVE_REQUEST_KEYS.has(key))
  ) {
    throw new Error('requirements_contract_judge_active_request_field_set_invalid');
  }
  if (!Number.isSafeInteger(value.version) || value.version < 1) {
    throw new Error('requirements_contract_judge_active_version_invalid');
  }
  if (
    (value.version === 1 && value.previousVersion !== null) ||
    (value.version > 1 && value.previousVersion !== value.version - 1)
  ) {
    throw new Error('requirements_contract_judge_active_previous_version_invalid');
  }
  if (!Number.isSafeInteger(value.attemptCount) || value.attemptCount < 0) {
    throw new Error('requirements_contract_judge_active_attempt_count_invalid');
  }
}

export function advanceRequirementsContractJudgeActiveRequest(
  current: RequirementsContractJudgeActiveRequest,
  updates: Partial<Omit<RequirementsContractJudgeActiveRequest, 'schemaVersion' | 'version' | 'previousVersion'>>
): RequirementsContractJudgeActiveRequest {
  validateRequirementsContractJudgeActiveRequest(current);
  const next = {
    ...current,
    ...updates,
    version: current.version + 1,
    previousVersion: current.version,
  };
  validateRequirementsContractJudgeActiveRequest(next);
  return next;
}

export function compareAndSwapRequirementsContractJudgeActiveRequest(input: {
  recordRoot: string;
  expected: RequirementsContractJudgeActiveRequest | null;
  next: RequirementsContractJudgeActiveRequest;
}): void {
  validateRequirementsContractJudgeActiveRequest(input.next);
  if (input.expected === null) {
    if (input.next.version !== 1 || input.next.previousVersion !== null) {
      throw new Error('requirements_contract_judge_active_initial_version_invalid');
    }
  } else {
    validateRequirementsContractJudgeActiveRequest(input.expected);
    if (
      input.next.version !== input.expected.version + 1 ||
      input.next.previousVersion !== input.expected.version
    ) {
      throw new Error('requirements_contract_judge_active_version_transition_invalid');
    }
  }
  const targetPath = path.join(input.recordRoot, 'quality', 'active-request.json');
  const lockPath = `${targetPath}.lock`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  let lock: number | null = null;
  const tempPath = `${targetPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    lock = fs.openSync(lockPath, 'wx', 0o600);
    const current = fs.existsSync(targetPath)
      ? (JSON.parse(fs.readFileSync(targetPath, 'utf8')) as RequirementsContractJudgeActiveRequest)
      : null;
    if (current !== null) validateRequirementsContractJudgeActiveRequest(current);
    if (canonicalJson(current) !== canonicalJson(input.expected)) {
      throw new Error('requirements_contract_judge_active_cas_conflict');
    }
    fs.writeFileSync(tempPath, canonicalJson(input.next), { encoding: 'utf8', mode: 0o600 });
    const readback = JSON.parse(fs.readFileSync(tempPath, 'utf8')) as RequirementsContractJudgeActiveRequest;
    validateRequirementsContractJudgeActiveRequest(readback);
    if (canonicalJson(readback) !== canonicalJson(input.next)) {
      throw new Error('requirements_contract_judge_active_readback_mismatch');
    }
    fs.renameSync(tempPath, targetPath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
    if (lock !== null) {
      fs.closeSync(lock);
      if (fs.existsSync(lockPath)) fs.rmSync(lockPath, { force: true });
    }
  }
}

export function applyRequirementsContractJudgeLifecycleEvent(
  current: RequirementsContractJudgeActiveRequest,
  event:
    | {
        type: 'transport_failed';
        attemptOrdinal: number;
        attemptPath: string;
        issueCode: string;
        retryScheduled?: boolean;
      }
    | {
        type: 'response_rejected';
        attemptOrdinal: number;
        attemptPath: string;
        issueCode: string;
        retryScheduled: boolean;
      }
    | { type: 'dispatch_scheduled' }
    | {
        type: 'response_accepted';
        attemptOrdinal: number;
        attemptPath: string;
        responsePath: string;
        responseHash: string;
        verdict: 'pass' | 'fail';
      }
): RequirementsContractJudgeActiveRequest {
  validateRequirementsContractJudgeActiveRequest(current);
  if (current.acceptedEvaluation || ['audited_pass', 'audited_fail', 'superseded'].includes(current.status)) {
    throw new Error('requirements_contract_judge_request_already_evaluated');
  }
  if (event.type === 'dispatch_scheduled') {
    if (!['audit_pending', 'retry_scheduled'].includes(current.status)) {
      throw new Error('requirements_contract_judge_dispatch_transition_invalid');
    }
    return advanceRequirementsContractJudgeActiveRequest(current, {
      status: 'dispatch_pending',
      lastIssueCode: null,
    });
  }
  if (event.attemptOrdinal !== current.attemptCount + 1) {
    throw new Error('requirements_contract_judge_attempt_ordinal_not_contiguous');
  }
  const expectedAttemptPath = `quality/requests/${hashPathSegment(current.judgeRequestHash)}/dispatch-attempts/${event.attemptOrdinal}.json`;
  if (event.attemptPath !== expectedAttemptPath) {
    throw new Error('requirements_contract_judge_attempt_path_identity_mismatch');
  }
  if (event.type === 'transport_failed' || event.type === 'response_rejected') {
    return advanceRequirementsContractJudgeActiveRequest(current, {
      status: event.retryScheduled ? 'retry_scheduled' : 'audit_pending',
      attemptCount: event.attemptOrdinal,
      lastAttemptPath: event.attemptPath,
      lastIssueCode: event.issueCode,
    });
  }
  requireHash(event.responseHash, 'requirements_contract_judge_response_hash_invalid');
  if (event.responsePath !== `quality/requests/${hashPathSegment(current.judgeRequestHash)}/judge-response.json`) {
    throw new Error('requirements_contract_judge_response_path_identity_mismatch');
  }
  return advanceRequirementsContractJudgeActiveRequest(current, {
    status: event.verdict === 'pass' ? 'audited_pass' : 'audited_fail',
    acceptedEvaluation: true,
    attemptCount: event.attemptOrdinal,
    lastAttemptPath: event.attemptPath,
    lastIssueCode: null,
    responseRef: { path: event.responsePath, hash: event.responseHash },
  });
}
