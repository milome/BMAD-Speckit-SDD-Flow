import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { sha256Stable } from './requirements-contract-semantic-resolver';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const HOSTS = new Set(['claude', 'cursor', 'codex']);
const SCHEMA_FILE = 'requirements-contract-reviewer-parent-projection.schema.json';
const ALLOWED_FIELDS = new Set([
  'actorClass',
  'reviewerProfileId',
  'campaignId',
  'scopeSnapshotPath',
  'scopeSnapshotHash',
  'implementationByteManifestHash',
  'evidenceManifestHash',
  'allowedEvidenceRefs',
  'mandatoryCoverageUnits',
  'semanticPromptHash',
  'promptTemplateHash',
  'resultSchemaHash',
  'policyHash',
  'hostId',
  'nativeAgentIdentity',
  'componentByteHash',
  'resolvedReviewerModelId',
  'resolvedReviewerProviderFamily',
  'readonlyMode',
  'invocationOrdinal',
  'reviewerAttemptKey',
  'expectedReceiptIdentityHash',
  'currentAuthority',
]);

type RecordValue = Record<string, unknown>;

export interface RequirementsContractReviewerParentProjection {
  schemaVersion: 'requirements-contract-reviewer-parent-projection/v1';
  actorClass: 'bounded_code_reviewer';
  reviewerProfileId: string;
  campaignId: string;
  scopeSnapshotPath: string;
  scopeSnapshotHash: string;
  implementationByteManifestHash: string;
  evidenceManifestHash: string;
  allowedEvidenceRefs: string[];
  mandatoryCoverageUnits: string[];
  semanticPromptHash: string;
  promptTemplateHash: string;
  resultSchemaHash: string;
  policyHash: string;
  hostId: 'claude' | 'cursor' | 'codex';
  nativeAgentIdentity: 'code-reviewer';
  componentByteHash: string;
  resolvedReviewerModelId: string;
  resolvedReviewerProviderFamily: string;
  readonlyMode: string;
  invocationOrdinal: 1;
  reviewerAttemptKey: string;
  expectedReceiptIdentityHash: string;
  projectionHash: string;
}

export class RequirementsContractReviewerProjectionError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractReviewerProjectionError';
    this.code = code;
  }
}

let validator: ValidateFunction | null = null;

function fail(code: string): never {
  throw new RequirementsContractReviewerProjectionError(code);
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requiredText(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('reviewer_projection_field_invalid');
  }
  return value.trim();
}

function requiredHash(record: RecordValue, key: string): string {
  const value = requiredText(record, key);
  if (!HASH_PATTERN.test(value)) fail('reviewer_projection_field_invalid');
  return value;
}

function stringSet(value: unknown): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    fail('reviewer_projection_field_invalid');
  }
  return [...value].sort();
}

function schemaValidator(): ValidateFunction {
  if (validator) return validator;
  validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return validator;
}

function rejectForbiddenFields(record: RecordValue): void {
  for (const key of Object.keys(record)) {
    if (key === 'expectedProjectionHash') {
      fail('reviewer_projection_expected_hash_forbidden');
    }
    if (/findings/iu.test(key)) {
      fail('reviewer_projection_caller_findings_forbidden');
    }
    if (/inferred.*identity/iu.test(key)) {
      fail('reviewer_projection_identity_inference_forbidden');
    }
    if (/final.*judge|peer.*output/iu.test(key)) {
      fail('reviewer_projection_peer_output_forbidden');
    }
    if (/fallback/iu.test(key)) {
      fail('reviewer_projection_fallback_forbidden');
    }
    if (!ALLOWED_FIELDS.has(key)) fail('reviewer_projection_field_invalid');
  }
}

function validateCurrentAuthority(projection: RecordValue, current: unknown): void {
  if (!isRecord(current)) fail('reviewer_projection_field_invalid');
  if (projection.campaignId !== current.campaignId) {
    fail('reviewer_projection_campaign_replay');
  }
  for (const field of [
    'scopeSnapshotHash',
    'implementationByteManifestHash',
    'evidenceManifestHash',
    'componentByteHash',
  ]) {
    if (projection[field] !== current[field]) {
      fail('reviewer_projection_scope_stale');
    }
  }
}

export function compileRequirementsContractReviewerParentProjection(
  input: unknown
): RequirementsContractReviewerParentProjection {
  if (!isRecord(input)) fail('reviewer_projection_field_invalid');
  rejectForbiddenFields(input);
  if (input.actorClass !== 'bounded_code_reviewer') {
    fail('reviewer_projection_actor_invalid');
  }
  if (input.invocationOrdinal !== 1) {
    fail('reviewer_projection_invocation_ordinal_invalid');
  }
  if (input.nativeAgentIdentity !== 'code-reviewer') {
    fail('reviewer_projection_identity_inference_forbidden');
  }
  if (typeof input.hostId !== 'string' || !HOSTS.has(input.hostId)) {
    fail('reviewer_projection_field_invalid');
  }
  validateCurrentAuthority(input, input.currentAuthority);
  const payload = {
    schemaVersion: 'requirements-contract-reviewer-parent-projection/v1' as const,
    actorClass: 'bounded_code_reviewer' as const,
    reviewerProfileId: requiredText(input, 'reviewerProfileId'),
    campaignId: requiredText(input, 'campaignId'),
    scopeSnapshotPath: requiredText(input, 'scopeSnapshotPath'),
    scopeSnapshotHash: requiredHash(input, 'scopeSnapshotHash'),
    implementationByteManifestHash: requiredHash(input, 'implementationByteManifestHash'),
    evidenceManifestHash: requiredHash(input, 'evidenceManifestHash'),
    allowedEvidenceRefs: stringSet(input.allowedEvidenceRefs),
    mandatoryCoverageUnits: stringSet(input.mandatoryCoverageUnits),
    semanticPromptHash: requiredHash(input, 'semanticPromptHash'),
    promptTemplateHash: requiredHash(input, 'promptTemplateHash'),
    resultSchemaHash: requiredHash(input, 'resultSchemaHash'),
    policyHash: requiredHash(input, 'policyHash'),
    hostId: input.hostId as 'claude' | 'cursor' | 'codex',
    nativeAgentIdentity: 'code-reviewer' as const,
    componentByteHash: requiredHash(input, 'componentByteHash'),
    resolvedReviewerModelId: requiredText(input, 'resolvedReviewerModelId'),
    resolvedReviewerProviderFamily: requiredText(input, 'resolvedReviewerProviderFamily'),
    readonlyMode: requiredText(input, 'readonlyMode'),
    invocationOrdinal: 1 as const,
    reviewerAttemptKey: requiredHash(input, 'reviewerAttemptKey'),
    expectedReceiptIdentityHash: requiredHash(input, 'expectedReceiptIdentityHash'),
  };
  return validateRequirementsContractReviewerParentProjection(
    { ...payload, projectionHash: sha256Stable(payload) },
    input.currentAuthority
  );
}

export function validateRequirementsContractReviewerParentProjection(
  value: unknown,
  currentAuthority: unknown
): RequirementsContractReviewerParentProjection {
  if (!schemaValidator()(value) || !isRecord(value)) {
    fail('reviewer_projection_invalid');
  }
  const { projectionHash, ...payload } = value;
  if (projectionHash !== sha256Stable(payload)) {
    fail('reviewer_projection_hash_mismatch');
  }
  validateCurrentAuthority(value, currentAuthority);
  return value as unknown as RequirementsContractReviewerParentProjection;
}
