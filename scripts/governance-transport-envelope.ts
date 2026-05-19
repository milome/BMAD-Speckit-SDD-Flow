export type GovernanceTransportHostKind = 'claude' | 'cursor' | 'codex' | 'worker' | 'no_hook';
export type GovernanceTransportHostMode = 'hooks_enabled' | 'no_hook' | 'worker' | 'manual_replay';
export type GovernanceTransportPayloadKind = 'decision' | 'status' | 'artifactRefs';

export interface GovernanceTransportEnvelope {
  hostKind: GovernanceTransportHostKind;
  hostMode: GovernanceTransportHostMode;
  entry: string;
  runId: string;
  recordId: string;
  requirementSetId: string;
  stage: string;
  packetId: string;
  eventType: string;
  payloadKind: GovernanceTransportPayloadKind;
  decision?: string;
  status?: string;
  sourceRefs?: Array<Record<string, unknown>>;
  artifactRefs?: Array<Record<string, unknown>>;
  payload?: Record<string, unknown>;
}

export interface GovernanceTransportValidation {
  ok: boolean;
  mismatches: string[];
}

const DECISION_EVENT_TYPES = new Set([
  'gate_check_recorded',
  'contract_check_recorded',
  'architecture_check_recorded',
  'architecture_confirmation_recorded',
  'architecture_confirmation_state_checked',
  'audit_iteration_recorded',
  'hook_capability_probe_recorded',
  'hook_trust_degraded',
  'hook_trust_receipt_recorded',
  'score_materialization_recorded',
  'score_evaluation_recorded',
  'closeout_attempt_recorded',
]);

const STATUS_EVENT_TYPES = new Set([
  'execution_iteration_recorded',
  'requirement_closure_recorded',
  'rerun_loop_recorded',
  'workflow_acknowledgement_recorded',
]);

const ARTIFACT_EVENT_TYPES = new Set([
  'artifact_indexed',
  'confirmation_view_rendered',
  'confirmation_summary_rendered',
  'confirmation_render_reported',
]);

const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;

const DECISION_VALUES = new Set([
  'pass',
  'fail',
  'blocked',
  'not_applicable',
  'skipped_by_policy',
  'reconfirm_required',
  'architecture_confirmation_required',
  'full_architecture_confirmed',
  'lightweight_architecture_confirmed',
  'architecture_reaudit_blocked',
]);

const STATUS_VALUES = new Set([
  'pending',
  'running',
  'done',
  'partial',
  'blocked',
  'failed',
  'timeout',
  'cancelled',
  'rerun_required',
  'open',
  'pass',
  'fail',
  'in_progress',
  'no_progress',
  'resolved',
  'abandoned_by_user_confirmation',
  'superseded',
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function containsForbiddenResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsForbiddenResult);
  const objectValue = value as Record<string, unknown>;
  return (
    Object.prototype.hasOwnProperty.call(objectValue, 'result') ||
    Object.values(objectValue).some(containsForbiddenResult)
  );
}

function expectedPayloadKind(eventType: string): GovernanceTransportPayloadKind | null {
  if (DECISION_EVENT_TYPES.has(eventType)) return 'decision';
  if (STATUS_EVENT_TYPES.has(eventType)) return 'status';
  if (ARTIFACT_EVENT_TYPES.has(eventType)) return 'artifactRefs';
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isObject(value) ? value : null;
}

function hasArtifactRef(value: unknown): boolean {
  const ref = asRecord(value);
  if (!ref) return false;
  return Boolean(text(ref.path) && SHA256_PATTERN.test(text(ref.contentHash ?? ref.hash)));
}

function codexVersionSupportsHooks(version: string): boolean {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)/u);
  if (!match) return false;
  const [, majorRaw, minorRaw, patchRaw] = match;
  const major = Number(majorRaw);
  const minor = Number(minorRaw);
  const patch = Number(patchRaw);
  if (major > 0) return true;
  if (major < 0) return false;
  if (minor > 130) return true;
  if (minor < 130) return false;
  return patch >= 0;
}

function validateCodexHookTrust(envelope: Record<string, unknown>): string[] {
  if (text(envelope.hostKind) !== 'codex' || text(envelope.hostMode) !== 'hooks_enabled') {
    return [];
  }
  const mismatches: string[] = [];
  const payload = asRecord(envelope.payload);
  if (!payload) return ['codex_hook_trust_payload_missing'];
  if (!codexVersionSupportsHooks(text(payload.codexVersion))) {
    mismatches.push(`codex_version_hooks_unsupported:${text(payload.codexVersion) || '<missing>'}`);
  }
  if (payload.hooksFeatureStable !== true) mismatches.push('codex_hooks_feature_stable_not_true');
  if (text(payload.hookTrust) !== 'trusted') {
    mismatches.push(`codex_hook_trust_not_trusted:${text(payload.hookTrust) || '<missing>'}`);
  }
  if (!hasArtifactRef(payload.capabilityProbeReceiptRef)) {
    mismatches.push('codex_capability_probe_receipt_ref_missing');
  }
  if (!hasArtifactRef(payload.sessionStartSmokeReceiptRef)) {
    mismatches.push('codex_session_start_smoke_receipt_ref_missing');
  }
  if (!hasArtifactRef(payload.hookTrustReceiptRef)) {
    mismatches.push('codex_hook_trust_receipt_ref_missing');
  }
  if (!SHA256_PATTERN.test(text(payload.managedHookConfigHash))) {
    mismatches.push('codex_managed_hook_config_hash_missing');
  }
  if (!SHA256_PATTERN.test(text(payload.runtimePolicySnapshotHash))) {
    mismatches.push('codex_runtime_policy_snapshot_hash_missing');
  }
  return mismatches;
}

export function validateGovernanceTransportEnvelope(input: unknown): GovernanceTransportValidation {
  const mismatches: string[] = [];
  if (!isObject(input)) return { ok: false, mismatches: ['envelope_object_required'] };
  const envelope = input as Record<string, unknown>;
  for (const field of [
    'hostKind',
    'hostMode',
    'entry',
    'runId',
    'recordId',
    'requirementSetId',
    'stage',
    'packetId',
    'eventType',
    'payloadKind',
  ]) {
    if (!text(envelope[field])) mismatches.push(`envelope_${field}_missing`);
  }
  if (containsForbiddenResult(envelope)) mismatches.push('envelope_result_forbidden');
  const eventType = text(envelope.eventType);
  const payloadKind = text(envelope.payloadKind);
  const expectedKind = expectedPayloadKind(eventType);
  if (!expectedKind) mismatches.push(`envelope_event_type_unsupported:${eventType || '<missing>'}`);
  if (expectedKind && payloadKind !== expectedKind) {
    mismatches.push(`envelope_payload_kind_mismatch:${eventType}:${payloadKind || '<missing>'}`);
  }
  if (payloadKind === 'decision') {
    if (!DECISION_VALUES.has(text(envelope.decision))) {
      mismatches.push(`envelope_decision_invalid:${text(envelope.decision) || '<missing>'}`);
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'status')) mismatches.push('envelope_status_forbidden_for_decision');
  }
  if (payloadKind === 'status') {
    if (!STATUS_VALUES.has(text(envelope.status))) {
      mismatches.push(`envelope_status_invalid:${text(envelope.status) || '<missing>'}`);
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'decision')) {
      mismatches.push('envelope_decision_forbidden_for_status');
    }
  }
  if (payloadKind === 'artifactRefs') {
    if (!Array.isArray(envelope.artifactRefs) || envelope.artifactRefs.length === 0) {
      mismatches.push('envelope_artifact_refs_missing');
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'decision')) {
      mismatches.push('envelope_decision_forbidden_for_artifact_refs');
    }
    if (Object.prototype.hasOwnProperty.call(envelope, 'status')) {
      mismatches.push('envelope_status_forbidden_for_artifact_refs');
    }
  }
  if (eventType === 'rerun_loop_recorded' && (!Array.isArray(envelope.sourceRefs) || envelope.sourceRefs.length === 0)) {
    mismatches.push('envelope_rerun_source_refs_missing');
  }
  mismatches.push(...validateCodexHookTrust(envelope));
  return { ok: mismatches.length === 0, mismatches: [...new Set(mismatches)] };
}

export function assertGovernanceTransportEnvelope(input: unknown): asserts input is GovernanceTransportEnvelope {
  const validation = validateGovernanceTransportEnvelope(input);
  if (!validation.ok) {
    throw new Error(`invalid GovernanceTransportEnvelope: ${validation.mismatches.join(', ')}`);
  }
}
