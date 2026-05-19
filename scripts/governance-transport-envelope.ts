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
  return { ok: mismatches.length === 0, mismatches: [...new Set(mismatches)] };
}

export function assertGovernanceTransportEnvelope(input: unknown): asserts input is GovernanceTransportEnvelope {
  const validation = validateGovernanceTransportEnvelope(input);
  if (!validation.ok) {
    throw new Error(`invalid GovernanceTransportEnvelope: ${validation.mismatches.join(', ')}`);
  }
}
