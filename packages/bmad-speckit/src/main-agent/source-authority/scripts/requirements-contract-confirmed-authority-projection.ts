import { readFileSync } from 'node:fs';
import path from 'node:path';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020.js';
import { validateRequirementsEffectivePassReceipt } from './requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from './requirements-contract-semantic-resolver';

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const WRITER_ID = 'requirements-confirmation-ingest';
const SCHEMA_FILE = 'requirements-contract-confirmed-authority-projection.schema.json';

type JsonRecord = Record<string, unknown>;

interface ConfirmedAuthorityIdentity {
  path: string;
  semanticHash: string;
  contentHash: string;
}

export interface RequirementsEffectivePassReceiptRef {
  path: string;
  schemaVersion: 'requirements-effective-pass-receipt/v1';
  receiptHash: string;
  actorClass: 'requirements_critical_auditor_judge';
  judgeRole: 'requirements_critical_auditor';
  decision: 'pass';
}

export interface ConfirmedRequirementsAuthorityProjection {
  schemaVersion: 'requirements-contract-confirmed-authority-projection/v1';
  requirementRecordId: string;
  sourceSnapshotHash: string;
  implementationConfirmationSemanticHash: string;
  controlledConfirmationEventHash: string;
  confirmedAuthorityIdentity: ConfirmedAuthorityIdentity;
  RequirementsEffectivePassReceiptRef: RequirementsEffectivePassReceiptRef;
  writerId: typeof WRITER_ID;
  controlReceiptHash: string;
  authorityTupleHash: string;
  projectionHash: string;
}

export class RequirementsContractConfirmedAuthorityError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'RequirementsContractConfirmedAuthorityError';
    this.code = code;
  }
}

let validator: ValidateFunction | null = null;

function fail(code: string): never {
  throw new RequirementsContractConfirmedAuthorityError(code);
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function object(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function requireText(record: JsonRecord, key: string): string {
  const value = text(record[key]);
  if (!value) fail('confirmed_authority_field_invalid');
  return value;
}

function requireHash(record: JsonRecord, key: string): string {
  const value = requireText(record, key);
  if (!HASH_PATTERN.test(value)) fail('confirmed_authority_field_invalid');
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  return sha256Stable(left) === sha256Stable(right);
}

function projectionValidator(): ValidateFunction {
  if (validator) return validator;
  validator = new Ajv2020({ allErrors: true, strict: false }).compile(
    JSON.parse(readFileSync(path.resolve(__dirname, '..', 'schemas', SCHEMA_FILE), 'utf8'))
  );
  return validator;
}

function confirmedAuthorityIdentity(value: unknown): ConfirmedAuthorityIdentity {
  const identity = object(value);
  const nestedIdentity = object(identity.frozenConfirmationIrRef);
  const source =
    text(nestedIdentity.path) || text(nestedIdentity.semanticHash) ? nestedIdentity : identity;
  return {
    path: requireText(source, 'path'),
    semanticHash: requireHash(source, 'semanticHash'),
    contentHash: requireHash(source, 'contentHash'),
  };
}

function controlReceiptHash(receipt: JsonRecord): string {
  return sha256Stable(receipt);
}

function assertCurrentAuthority(
  projection: ConfirmedRequirementsAuthorityProjection,
  currentAuthority: JsonRecord
): void {
  if (projection.requirementRecordId !== currentAuthority.requirementRecordId) {
    fail('confirmed_authority_record_mismatch');
  }
  if (projection.sourceSnapshotHash !== currentAuthority.sourceSnapshotHash) {
    fail('confirmed_authority_source_stale');
  }
  if (
    projection.implementationConfirmationSemanticHash !==
    currentAuthority.implementationConfirmationSemanticHash
  ) {
    fail('confirmed_authority_implementation_confirmation_stale');
  }
  if (
    projection.controlledConfirmationEventHash !== currentAuthority.controlledConfirmationEventHash
  ) {
    fail('confirmed_authority_event_copied_or_replayed');
  }
  if (
    projection.RequirementsEffectivePassReceiptRef.receiptHash !==
    currentAuthority.requirementsEffectivePassReceiptHash
  ) {
    fail('confirmed_authority_effective_pass_stale');
  }
  if (projection.writerId !== (text(currentAuthority.writerId) || WRITER_ID)) {
    fail('confirmed_authority_uncontrolled_writer');
  }
  if (
    !sameJson(
      projection.confirmedAuthorityIdentity,
      confirmedAuthorityIdentity(currentAuthority.confirmedAuthorityIdentity)
    )
  ) {
    fail('confirmed_authority_identity_mismatch');
  }
}

export function compileRequirementsContractConfirmedAuthorityProjection(
  input: unknown
): ConfirmedRequirementsAuthorityProjection {
  if (!isRecord(input)) fail('confirmed_authority_field_invalid');
  const record = object(input.record);
  const event = object(input.confirmationEvent);
  const eventPayload = object(event.payload);
  const controlReceipt = object(input.controlReceipt);
  const currentAuthority = object(input.currentAuthority);
  const effectivePassReceipt = validateRequirementsEffectivePassReceipt(
    input.requirementsEffectivePassReceipt
  );

  if (event.eventType !== 'confirmation_recorded') fail('confirmed_authority_event_invalid');
  if (event.writerId !== WRITER_ID || controlReceipt.writerId !== WRITER_ID) {
    fail('confirmed_authority_uncontrolled_writer');
  }
  const eventHash = requireHash(event, 'eventHash');
  if (
    controlReceipt.eventHash !== eventHash ||
    record.lastAppliedEventHash !== eventHash ||
    record.eventChainHead !== eventHash
  ) {
    fail('confirmed_authority_event_copied_or_replayed');
  }
  if (event.payloadHash !== sha256Stable(eventPayload)) {
    fail('confirmed_authority_event_payload_hash_mismatch');
  }
  if (
    eventPayload.requirementsEffectivePassReceiptRef &&
    object(eventPayload.requirementsEffectivePassReceiptRef).receiptHash !==
      effectivePassReceipt.receiptHash
  ) {
    fail('confirmed_authority_effective_pass_stale');
  }

  const requirementRecordId = requireText(record, 'recordId');
  if (
    event.recordId !== requirementRecordId ||
    controlReceipt.recordId !== requirementRecordId ||
    eventPayload.recordId !== requirementRecordId
  ) {
    fail('confirmed_authority_record_mismatch');
  }
  const sourceSnapshotHash = requireHash(record, 'sourceDocumentHash');
  if (eventPayload.sourceDocumentHash !== sourceSnapshotHash) {
    fail('confirmed_authority_source_stale');
  }
  const implementationConfirmationSemanticHash = requireHash(
    record,
    'implementationConfirmationHash'
  );
  if (eventPayload.implementationConfirmationHash !== implementationConfirmationSemanticHash) {
    fail('confirmed_authority_implementation_confirmation_stale');
  }
  const identity = confirmedAuthorityIdentity(eventPayload.confirmedAuthorityIdentity);
  if (!sameJson(identity, confirmedAuthorityIdentity(eventPayload.frozenConfirmationIrRef))) {
    fail('confirmed_authority_identity_mismatch');
  }
  const receiptRef: RequirementsEffectivePassReceiptRef = {
    path: requireText(object(eventPayload.requirementsEffectivePassReceiptRef), 'path'),
    schemaVersion: 'requirements-effective-pass-receipt/v1',
    receiptHash: effectivePassReceipt.receiptHash,
    actorClass: effectivePassReceipt.actorClass,
    judgeRole: effectivePassReceipt.judgeRole,
    decision: effectivePassReceipt.decision,
  };
  if (
    object(eventPayload.requirementsEffectivePassReceiptRef).schemaVersion !==
      receiptRef.schemaVersion ||
    object(eventPayload.requirementsEffectivePassReceiptRef).receiptHash !== receiptRef.receiptHash
  ) {
    fail('confirmed_authority_effective_pass_stale');
  }

  const tuple = {
    requirementRecordId,
    sourceSnapshotHash,
    implementationConfirmationSemanticHash,
    controlledConfirmationEventHash: eventHash,
    confirmedAuthorityIdentity: identity,
    RequirementsEffectivePassReceiptRef: receiptRef,
  };
  const payload = {
    schemaVersion: 'requirements-contract-confirmed-authority-projection/v1' as const,
    ...tuple,
    writerId: WRITER_ID,
    controlReceiptHash: controlReceiptHash(controlReceipt),
    authorityTupleHash: sha256Stable(tuple),
  };
  const projection = {
    ...payload,
    projectionHash: sha256Stable(payload),
  };
  return validateRequirementsContractConfirmedAuthorityProjection(projection, currentAuthority);
}

export function validateRequirementsContractConfirmedAuthorityProjection(
  value: unknown,
  currentAuthority: unknown
): ConfirmedRequirementsAuthorityProjection {
  if (!projectionValidator()(value) || !isRecord(value) || !isRecord(currentAuthority)) {
    fail('confirmed_authority_projection_invalid');
  }
  const projection = value as unknown as ConfirmedRequirementsAuthorityProjection;
  const { projectionHash, ...payload } = projection;
  const tuple = {
    requirementRecordId: projection.requirementRecordId,
    sourceSnapshotHash: projection.sourceSnapshotHash,
    implementationConfirmationSemanticHash: projection.implementationConfirmationSemanticHash,
    controlledConfirmationEventHash: projection.controlledConfirmationEventHash,
    confirmedAuthorityIdentity: projection.confirmedAuthorityIdentity,
    RequirementsEffectivePassReceiptRef: projection.RequirementsEffectivePassReceiptRef,
  };
  if (projection.authorityTupleHash !== sha256Stable(tuple)) {
    fail('confirmed_authority_tuple_hash_mismatch');
  }
  if (projectionHash !== sha256Stable(payload)) {
    fail('confirmed_authority_projection_hash_mismatch');
  }
  assertCurrentAuthority(projection, currentAuthority);
  return projection;
}
