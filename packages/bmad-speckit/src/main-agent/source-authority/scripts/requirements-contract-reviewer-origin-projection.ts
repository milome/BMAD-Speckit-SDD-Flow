import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { sha256Stable } from './requirements-contract-semantic-resolver';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SCHEMA_FILE = 'requirements-contract-reviewer-origin-projection.schema.json';
const FORBIDDEN_AUTHORITY_KEYS = [
  'approval',
  'approved',
  'closeoutapproved',
  'score',
  'remediationdisposition',
  'remediationdecision',
  'remediationauthority',
  'writeauthority',
  'writepermission',
  'anotherreviewrequest',
  'anotherreviewercall',
  'reviewerretryrequest',
  'finalization',
  'finalizationauthority',
  'finalize',
  'effectivepass',
  'finaljudge',
];
const MESSAGE_ORDER_KEYS = ['messageorder', 'messageordinal', 'findingorder', 'responseorder'];

type RecordValue = Record<string, unknown>;

interface CanonicalLocation {
  path: string;
  line: number;
}

interface CanonicalFinding {
  findingId: string;
  fingerprint: string;
  canonicalRule: string;
  canonicalLocation: CanonicalLocation;
}

export interface ReviewerOriginReference {
  actorClass: 'bounded_code_reviewer';
  reviewerIdentity: 'bmad_code_reviewer';
  campaignId: string;
  campaignLineageKey: string;
  scopeSnapshotHash: string;
  reviewerAttemptKey: string;
  findingId: string;
  findingFingerprint: string;
  canonicalRule: string;
  canonicalLocation: CanonicalLocation;
  originId: string;
  sourceLedgerHash: string;
  requestHash: string;
  responseHash: string;
  identityReceiptHash: string;
  coverageReceiptHash: string;
  originHash: string;
}

export interface ReviewerCampaignInput {
  schemaVersion: 'requirements-contract-reviewer-origin-projection/v1';
  actorClass: 'bounded_code_reviewer';
  reviewerIdentity: 'bmad_code_reviewer';
  campaignId: string;
  campaignLineageKey: string;
  scopeSnapshotHash: string;
  reviewerAttemptKey: string;
  sourceLedgerHash: string;
  requestHash: string;
  responseHash: string;
  identityReceiptHash: string;
  coverageReceiptHash: string;
  origins: ReviewerOriginReference[];
  originSetHash: string;
  projectionHash: string;
}

export class RequirementsContractReviewerOriginError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractReviewerOriginError';
    this.code = code;
  }
}

let validator: ValidateFunction | null = null;

function fail(code: string): never {
  throw new RequirementsContractReviewerOriginError(code);
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizedKey(key: string): string {
  return key.replace(/[-_]/gu, '').toLowerCase();
}

function rejectForbiddenAuthority(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(rejectForbiddenAuthority);
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const normalized = normalizedKey(key);
    if (MESSAGE_ORDER_KEYS.includes(normalized)) {
      fail('reviewer_origin_message_order_identity_forbidden');
    }
    if (FORBIDDEN_AUTHORITY_KEYS.some((forbidden) => normalized.includes(forbidden))) {
      fail('reviewer_origin_authority_field_forbidden');
    }
    rejectForbiddenAuthority(child);
  }
}

function requiredText(record: RecordValue, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('reviewer_origin_field_invalid');
  }
  return value.trim();
}

function requiredHash(record: RecordValue, key: string): string {
  const value = requiredText(record, key);
  if (!HASH_PATTERN.test(value)) fail('reviewer_origin_field_invalid');
  return value;
}

function requiredLocation(value: unknown): CanonicalLocation {
  if (!isRecord(value)) fail('reviewer_origin_field_invalid');
  const line = value.line;
  if (!Number.isInteger(line) || (line as number) < 1) {
    fail('reviewer_origin_field_invalid');
  }
  return { path: requiredText(value, 'path'), line: line as number };
}

function resultFinding(value: unknown): CanonicalFinding {
  if (!isRecord(value)) fail('reviewer_origin_field_invalid');
  const line = value.line;
  if (!Number.isInteger(line) || (line as number) < 1) {
    fail('reviewer_origin_field_invalid');
  }
  return {
    findingId: requiredText(value, 'findingId'),
    fingerprint: requiredHash(value, 'fingerprint'),
    canonicalRule: requiredText(value, 'category'),
    canonicalLocation: { path: requiredText(value, 'path'), line: line as number },
  };
}

function ledgerFinding(value: unknown): CanonicalFinding {
  if (!isRecord(value)) fail('reviewer_origin_field_invalid');
  const keys = Object.keys(value).sort();
  if (
    JSON.stringify(keys) !==
    JSON.stringify(['canonicalLocation', 'canonicalRule', 'findingId', 'fingerprint'])
  ) {
    fail('reviewer_origin_field_invalid');
  }
  return {
    findingId: requiredText(value, 'findingId'),
    fingerprint: requiredHash(value, 'fingerprint'),
    canonicalRule: requiredText(value, 'canonicalRule'),
    canonicalLocation: requiredLocation(value.canonicalLocation),
  };
}

function findingMap(value: unknown, parser: (item: unknown) => CanonicalFinding) {
  if (!Array.isArray(value)) fail('reviewer_origin_field_invalid');
  const findings = value.map(parser);
  const byId = new Map(findings.map((item) => [item.findingId, item]));
  if (byId.size !== findings.length) fail('reviewer_origin_duplicate');
  return { findings, byId };
}

function assertReviewerIdentity(record: RecordValue): void {
  if (
    record.actorClass !== 'bounded_code_reviewer' ||
    record.reviewerIdentity !== 'bmad_code_reviewer'
  ) {
    fail('reviewer_origin_identity_invalid');
  }
}

function sameLocation(left: CanonicalLocation, right: CanonicalLocation): boolean {
  return left.path === right.path && left.line === right.line;
}

function schemaValidator(): ValidateFunction {
  if (validator) return validator;
  validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return validator;
}

function validateAuthorityBinding(record: RecordValue, authority: RecordValue): void {
  if (record.campaignId !== authority.campaignId) fail('reviewer_origin_campaign_replay');
  for (const field of ['campaignLineageKey', 'scopeSnapshotHash', 'reviewerAttemptKey']) {
    if (record[field] !== authority[field]) fail('reviewer_origin_scope_replay');
  }
  if (record.sourceLedgerHash !== authority.sourceLedgerHash) {
    fail('reviewer_origin_ledger_stale');
  }
}

export function compileRequirementsContractReviewerOriginProjection(
  input: unknown
): ReviewerCampaignInput {
  if (!isRecord(input)) fail('reviewer_origin_field_invalid');
  if (
    Object.keys(input).some(
      (key) => !['normalizedResult', 'sourceLedger', 'currentAuthority'].includes(key)
    )
  ) {
    fail('reviewer_origin_field_invalid');
  }
  rejectForbiddenAuthority(input);
  if (
    !isRecord(input.normalizedResult) ||
    !isRecord(input.sourceLedger) ||
    !isRecord(input.currentAuthority)
  ) {
    fail('reviewer_origin_field_invalid');
  }
  const result = input.normalizedResult;
  const ledger = input.sourceLedger;
  const currentAuthority = input.currentAuthority;
  assertReviewerIdentity(result);
  assertReviewerIdentity(ledger);
  if (
    result.schemaVersion !== 'reviewer-discovery-result/v2' ||
    result.profile !== 'parent_goal_implementation_discovery' ||
    ledger.schemaVersion !== 'reviewer-finding-source-ledger/v1'
  ) {
    fail('reviewer_origin_field_invalid');
  }
  const resultCode = requiredText(result, 'resultCode');
  if (!['discovery_clean', 'findings_present'].includes(resultCode)) {
    fail('reviewer_origin_result_not_projectable');
  }

  const resultSet = findingMap(result.findings, resultFinding);
  const ledgerSet = findingMap(ledger.findings, ledgerFinding);
  if (
    (resultCode === 'discovery_clean' && resultSet.findings.length !== 0) ||
    (resultCode === 'findings_present' && resultSet.findings.length === 0)
  ) {
    fail('reviewer_origin_result_invalid');
  }
  if (
    resultSet.findings.length !== ledgerSet.findings.length ||
    resultSet.findings.some((item) => !ledgerSet.byId.has(item.findingId))
  ) {
    fail('reviewer_origin_unknown');
  }
  for (const resultItem of resultSet.findings) {
    const ledgerItem = ledgerSet.byId.get(resultItem.findingId)!;
    if (
      resultItem.fingerprint !== ledgerItem.fingerprint ||
      resultItem.canonicalRule !== ledgerItem.canonicalRule ||
      !sameLocation(resultItem.canonicalLocation, ledgerItem.canonicalLocation)
    ) {
      fail('reviewer_origin_copied_finding');
    }
  }

  const campaignId = requiredText(ledger, 'campaignId');
  const campaignLineageKey = requiredHash(ledger, 'campaignLineageKey');
  const scopeSnapshotHash = requiredHash(ledger, 'scopeSnapshotHash');
  const reviewerAttemptKey = requiredHash(ledger, 'reviewerAttemptKey');
  if (result.campaignId !== campaignId) fail('reviewer_origin_campaign_replay');
  if (result.scopeSnapshotHash !== scopeSnapshotHash || result.attemptKey !== reviewerAttemptKey) {
    fail('reviewer_origin_scope_replay');
  }
  const sourceLedgerHash = requiredHash(ledger, 'sourceLedgerHash');
  const requestHash = requiredHash(ledger, 'requestHash');
  const responseHash = requiredHash(ledger, 'responseHash');
  const identityReceiptHash = requiredHash(ledger, 'identityReceiptHash');
  const coverageReceiptHash = requiredHash(ledger, 'coverageReceiptHash');
  const { sourceLedgerHash: ignoredSourceLedgerHash, ...ledgerPayload } = ledger;
  void ignoredSourceLedgerHash;
  if (
    sourceLedgerHash !==
    sha256Stable({
      ...ledgerPayload,
      findings: [...ledgerSet.findings].sort((left, right) =>
        left.findingId.localeCompare(right.findingId)
      ),
    })
  ) {
    fail('reviewer_origin_ledger_hash_mismatch');
  }

  const authorityRecord = {
    campaignId,
    campaignLineageKey,
    scopeSnapshotHash,
    reviewerAttemptKey,
    sourceLedgerHash,
  };
  validateAuthorityBinding(authorityRecord, currentAuthority);
  for (const field of [
    'requestHash',
    'responseHash',
    'identityReceiptHash',
    'coverageReceiptHash',
  ]) {
    if (ledger[field] !== currentAuthority[field]) fail('reviewer_origin_receipt_replay');
  }

  const origins = [...resultSet.findings]
    .sort((left, right) => left.findingId.localeCompare(right.findingId))
    .map((finding) => {
      const identity = {
        actorClass: 'bounded_code_reviewer' as const,
        reviewerIdentity: 'bmad_code_reviewer' as const,
        campaignId,
        campaignLineageKey,
        scopeSnapshotHash,
        reviewerAttemptKey,
        findingId: finding.findingId,
        findingFingerprint: finding.fingerprint,
        canonicalRule: finding.canonicalRule,
        canonicalLocation: finding.canonicalLocation,
      };
      const payload = {
        ...identity,
        originId: sha256Stable(identity),
        sourceLedgerHash,
        requestHash,
        responseHash,
        identityReceiptHash,
        coverageReceiptHash,
      };
      return { ...payload, originHash: sha256Stable(payload) };
    });
  const payload = {
    schemaVersion: 'requirements-contract-reviewer-origin-projection/v1' as const,
    actorClass: 'bounded_code_reviewer' as const,
    reviewerIdentity: 'bmad_code_reviewer' as const,
    campaignId,
    campaignLineageKey,
    scopeSnapshotHash,
    reviewerAttemptKey,
    sourceLedgerHash,
    requestHash,
    responseHash,
    identityReceiptHash,
    coverageReceiptHash,
    origins,
    originSetHash: sha256Stable(origins.map((origin) => origin.originHash)),
  };
  return validateRequirementsContractReviewerOriginProjection(
    { ...payload, projectionHash: sha256Stable(payload) },
    currentAuthority
  );
}

export function validateRequirementsContractReviewerOriginProjection(
  value: unknown,
  currentAuthority: unknown
): ReviewerCampaignInput {
  if (!schemaValidator()(value) || !isRecord(value) || !isRecord(currentAuthority)) {
    fail('reviewer_origin_projection_invalid');
  }
  const projection = value as unknown as ReviewerCampaignInput;
  for (const field of [
    'requestHash',
    'responseHash',
    'identityReceiptHash',
    'coverageReceiptHash',
  ] as const) {
    if (projection[field] !== currentAuthority[field]) {
      fail('reviewer_origin_receipt_replay');
    }
  }
  const ids = projection.origins.map((origin) => origin.findingId);
  const originIds = projection.origins.map((origin) => origin.originId);
  if (
    new Set(ids).size !== ids.length ||
    new Set(originIds).size !== originIds.length ||
    JSON.stringify(ids) !== JSON.stringify([...ids].sort())
  ) {
    fail('reviewer_origin_duplicate');
  }
  for (const origin of projection.origins) {
    const {
      originHash,
      sourceLedgerHash,
      requestHash,
      responseHash,
      identityReceiptHash,
      coverageReceiptHash,
      originId,
      ...identity
    } = origin;
    if (
      originId !== sha256Stable(identity) ||
      originHash !==
        sha256Stable({
          ...identity,
          originId,
          sourceLedgerHash,
          requestHash,
          responseHash,
          identityReceiptHash,
          coverageReceiptHash,
        })
    ) {
      fail('reviewer_origin_hash_mismatch');
    }
    for (const field of [
      'campaignId',
      'campaignLineageKey',
      'scopeSnapshotHash',
      'reviewerAttemptKey',
      'sourceLedgerHash',
      'requestHash',
      'responseHash',
      'identityReceiptHash',
      'coverageReceiptHash',
    ]) {
      if (origin[field as keyof ReviewerOriginReference] !== currentAuthority[field]) {
        fail('reviewer_origin_receipt_replay');
      }
    }
  }
  if (
    projection.originSetHash !== sha256Stable(projection.origins.map((origin) => origin.originHash))
  ) {
    fail('reviewer_origin_set_hash_mismatch');
  }
  const { projectionHash, ...payload } = projection;
  if (projectionHash !== sha256Stable(payload)) {
    fail('reviewer_origin_projection_hash_mismatch');
  }
  validateAuthorityBinding(projection as unknown as RecordValue, currentAuthority);
  return projection;
}
