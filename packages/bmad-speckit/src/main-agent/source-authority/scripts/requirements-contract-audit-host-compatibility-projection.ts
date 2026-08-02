import { createHash } from 'node:crypto';

type JsonObject = Record<string, unknown>;

export interface AuditHostCompatibilityAuthoritativeReceiptRef {
  path: string;
  contentHash: string;
  receiptHash: string;
}

export interface AuditHostCompatibilityProjectionInput {
  auditStatus: 'PASS' | 'FAIL' | 'UNKNOWN';
  stage: string;
  artifactPath: string;
  reportPath: string;
  governanceClosure: JsonObject;
  closeoutEnvelope: JsonObject;
  scoreWriteResult?: 'ok' | 'failed' | null;
  handoffPersisted?: boolean;
  authoritativeReceiptRef?: AuditHostCompatibilityAuthoritativeReceiptRef;
  scoreReceiptRef?: AuditHostCompatibilityAuthoritativeReceiptRef;
  compatibilityCloseoutApproved?: boolean;
  scoreRecord?: JsonObject | null;
  scoreError?: string;
  updatedAt: string;
}

export interface AuditHostCompatibilityProjection {
  closeoutApproved: boolean;
  canMainAgentContinue: boolean;
  latestGateDecision: 'pass' | 'true_blocker';
  projectionDerivationReceipt: {
    schemaVersion: 'audit-host-compatibility-projection-derivation/v1';
    authorityMode: 'authoritative_receipt';
    authoritativeReceiptRef: AuditHostCompatibilityAuthoritativeReceiptRef;
    projectionHash: string;
    scoreEvidenceHash: string | null;
  };
  latestCloseoutPatch: JsonObject;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value as JsonObject)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify((value as JsonObject)[key])}`)
    .join(',')}}`;
}

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function isReceiptRef(value: unknown): value is AuditHostCompatibilityAuthoritativeReceiptRef {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
  return (
    typeof record.path === 'string' &&
    record.path.trim().length > 0 &&
    /^sha256:[a-f0-9]{64}$/u.test(String(record.contentHash ?? '')) &&
    /^sha256:[a-f0-9]{64}$/u.test(String(record.receiptHash ?? ''))
  );
}

function resultCode(value: unknown): string {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? String((value as JsonObject).resultCode ?? '')
    : '';
}

export function deriveAuditHostCompatibilityProjection(
  input: AuditHostCompatibilityProjectionInput
): AuditHostCompatibilityProjection {
  if (!isReceiptRef(input.authoritativeReceiptRef)) {
    throw new Error('audit_host_projection_authoritative_receipt_ref_missing');
  }
  if (input.compatibilityCloseoutApproved !== undefined) {
    throw new Error('audit_host_projection_compatibility_boolean_forbidden');
  }
  if (input.auditStatus !== 'PASS' && input.auditStatus !== 'FAIL' && input.auditStatus !== 'UNKNOWN') {
    throw new Error('audit_host_projection_audit_status_invalid');
  }
  const approved = input.auditStatus === 'PASS' && resultCode(input.closeoutEnvelope) === 'approved';
  const scoreEvidenceHash = input.scoreReceiptRef ? sha256Json(input.scoreReceiptRef) : null;
  const projectionBody = {
    auditStatus: input.auditStatus,
    stage: input.stage,
    artifactPath: input.artifactPath,
    reportPath: input.reportPath,
    governanceClosure: input.governanceClosure,
    closeoutEnvelope: input.closeoutEnvelope,
    authoritativeReceiptHash: input.authoritativeReceiptRef.receiptHash,
    scoreEvidenceHash,
    approved,
  };
  const latestCloseoutPatch: JsonObject = {
    canMainAgentContinue: approved,
    updatedAt: input.updatedAt,
    auditStatus: input.auditStatus,
    closeoutApproved: approved,
    governanceClosure: input.governanceClosure,
    closeoutEnvelope: input.closeoutEnvelope,
    scoreWriteResult: input.scoreWriteResult ?? null,
    handoffPersisted: input.handoffPersisted ?? true,
    authoritativeReceiptRef: input.authoritativeReceiptRef,
    projectionDerivationHash: sha256Json(projectionBody),
  };
  if (input.scoreError) latestCloseoutPatch.scoreError = input.scoreError;
  if (input.scoreRecord) {
    for (const [source, target] of [
      ['readiness_baseline_run_id', 'readinessBaselineRunId'],
      ['drift_signals', 'driftSignals'],
      ['drifted_dimensions', 'driftedDimensions'],
      ['drift_severity', 'driftSeverity'],
      ['re_readiness_required', 'reReadinessRequired'],
      ['blocking_reason', 'blockingReason'],
      ['effective_verdict', 'effectiveVerdict'],
    ] as const) {
      if (input.scoreRecord[source] !== undefined) latestCloseoutPatch[target] = input.scoreRecord[source];
    }
  }
  return {
    closeoutApproved: approved,
    canMainAgentContinue: approved,
    latestGateDecision: approved ? 'pass' : 'true_blocker',
    projectionDerivationReceipt: {
      schemaVersion: 'audit-host-compatibility-projection-derivation/v1',
      authorityMode: 'authoritative_receipt',
      authoritativeReceiptRef: input.authoritativeReceiptRef,
      projectionHash: sha256Json(projectionBody),
      scoreEvidenceHash,
    },
    latestCloseoutPatch,
  };
}
