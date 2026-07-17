import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  fileHash,
  slash,
  writeGovernedJson,
  type GovernedReadbackRef,
} from './requirements-contract-governed-write';

// AJV validates these schema-driven records before governed publication and replay.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

export interface CurrentDispatchPointerPublication {
  pointer: JsonRecord;
  pointerRef: GovernedReadbackRef;
  safeWriteReceiptRef: GovernedReadbackRef;
  previousPointer: JsonRecord | null;
}

export interface CurrentDispatchPointerExpectedIdentity {
  requirementSetId: string;
  implementationAttemptId: string;
  transactionId: string;
}

export interface CurrentDispatchPointerResolution {
  pointerPath: string;
  pointerHash: string;
  pointer: JsonRecord;
  modelPacket: JsonRecord;
  transactionManifest: JsonRecord;
}

export function assertCurrentDispatchPointerReplaySafe(
  targetPath: string,
  attemptSequence: number
): void {
  const resolved = path.resolve(targetPath);
  if (!fs.existsSync(resolved)) return;
  const current = JSON.parse(fs.readFileSync(resolved, 'utf8')) as JsonRecord;
  if (Number(current.attemptSequence) >= attemptSequence) {
    throw new Error('current_dispatch_pointer_replay_rejected');
  }
  assertValid(current);
}

function validator(schemaName = 'requirements-contract-current-dispatch-pointer.schema.json') {
  const schemaPath = path.resolve(
    __dirname,
    '..',
    'schemas',
    schemaName
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
}

function assertSchema(value: unknown, schemaName: string, issueCode: string): void {
  const validate = validator(schemaName);
  if (!validate(value)) {
    throw new Error(`${issueCode}:${JSON.stringify(validate.errors ?? [])}`);
  }
}

function assertValid(value: unknown): void {
  assertSchema(
    value,
    'requirements-contract-current-dispatch-pointer.schema.json',
    'current_dispatch_pointer_schema_invalid'
  );
}

function readJsonObject(filePath: string, issueCode: string): JsonRecord {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(issueCode);
    }
    return parsed as JsonRecord;
  } catch (error) {
    if (error instanceof Error && error.message === issueCode) throw error;
    throw new Error(issueCode);
  }
}

function sameFilePath(left: unknown, right: unknown): boolean {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    path.resolve(left) === path.resolve(right)
  );
}

function assertFileRef(
  ref: JsonRecord,
  label: string,
  readbackRequired = false
): void {
  const candidate = typeof ref.path === 'string' ? path.resolve(ref.path) : '';
  if (!candidate || !fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) {
    throw new Error(`current_dispatch_pointer_reference_missing:${label}`);
  }
  const observedHash = fileHash(candidate);
  if (
    observedHash !== ref.hash ||
    (readbackRequired &&
      (ref.readbackVerified !== true ||
        ref.readbackHash !== ref.hash ||
        observedHash !== ref.readbackHash))
  ) {
    throw new Error(`current_dispatch_pointer_reference_hash_mismatch:${label}`);
  }
}

function assertPointerReferences(pointer: JsonRecord): void {
  const fileRefs: Array<[string, JsonRecord]> = [
    ['requirementRecordRef', pointer.requirementRecordRef],
    ['attemptContextRef', pointer.attemptContextRef],
    ['stageRegistryRef', pointer.stageRegistryRef],
    ['installedStageRegistryRef', pointer.installedStageRegistryRef],
    ['confirmationReceiptRefs.requirements', pointer.confirmationReceiptRefs?.requirements],
    ['confirmationReceiptRefs.architecture', pointer.confirmationReceiptRefs?.architecture],
    ['confirmationPageRefs.requirements', pointer.confirmationPageRefs?.requirements],
    ['confirmationPageRefs.architecture', pointer.confirmationPageRefs?.architecture],
    ['consumerRef.marker', pointer.consumerRef?.marker],
    ['consumerRef.profile', pointer.consumerRef?.profile],
    [
      'packageRuntimeActionBindingManifestRef',
      pointer.packageRuntimeActionBindingManifestRef,
    ],
  ].filter((entry): entry is [string, JsonRecord] =>
    Boolean(entry[1]) && typeof entry[1] === 'object' && !Array.isArray(entry[1])
  );
  for (const [label, ref] of fileRefs) assertFileRef(ref, label);
  const readbackRefs: Array<[string, JsonRecord]> = [
    ['transactionManifestRef', pointer.transactionManifestRef],
    ['modelPacketRef', pointer.modelPacketRef],
    ['auditReceiptRef', pointer.auditReceiptRef],
    ['humanPromptRef', pointer.humanPromptRef],
    ['capabilityObservationRef', pointer.capabilityObservationRef],
    ...(pointer.goalExecutionRef
      ? ([['goalExecutionRef', pointer.goalExecutionRef]] as Array<[string, JsonRecord]>)
      : []),
  ].filter((entry): entry is [string, JsonRecord] =>
    Boolean(entry[1]) && typeof entry[1] === 'object' && !Array.isArray(entry[1])
  );
  for (const [label, ref] of readbackRefs) assertFileRef(ref, label, true);
  const sourceRef =
    pointer.sourceRef &&
    typeof pointer.sourceRef === 'object' &&
    !Array.isArray(pointer.sourceRef)
      ? pointer.sourceRef
      : null;
  if (!sourceRef) {
    throw new Error('current_dispatch_pointer_reference_missing:sourceRef');
  }
  assertFileRef(
    {
      path: sourceRef.path,
      hash: sourceRef.sourceDocumentHash,
    },
    'sourceRef'
  );
}

function assertPointerSafeWriteReceipt(pointerPath: string, pointerHash: string): void {
  const receiptPath = `${pointerPath}.safe-write-receipt.json`;
  if (!fs.existsSync(receiptPath) || !fs.statSync(receiptPath).isFile()) {
    throw new Error('current_dispatch_pointer_safe_write_receipt_missing');
  }
  const first = fs.readFileSync(receiptPath);
  const second = fs.readFileSync(receiptPath);
  if (!first.equals(second)) {
    throw new Error('current_dispatch_pointer_safe_write_receipt_readback_mismatch');
  }
  const receipt = readJsonObject(
    receiptPath,
    'current_dispatch_pointer_safe_write_receipt_invalid'
  );
  if (
    receipt.schemaVersion !== 'large-document-writer-safe-write/v1' ||
    !sameFilePath(receipt.targetPath, pointerPath) ||
    receipt.finalHash !== pointerHash
  ) {
    throw new Error('current_dispatch_pointer_safe_write_receipt_invalid');
  }
}

function assertExpectedIdentity(
  pointer: JsonRecord,
  expected: CurrentDispatchPointerExpectedIdentity
): void {
  for (const field of [
    'requirementSetId',
    'implementationAttemptId',
    'transactionId',
  ] as const) {
    if (pointer[field] !== expected[field]) {
      throw new Error(`current_dispatch_pointer_identity_mismatch:${field}`);
    }
  }
}

function assertPayloadBindings(input: {
  pointer: JsonRecord;
  modelPacket: JsonRecord;
  transactionManifest: JsonRecord;
}): void {
  const { pointer, modelPacket, transactionManifest } = input;
  assertSchema(
    transactionManifest,
    'requirements-contract-prompt-transaction-manifest.schema.json',
    'current_dispatch_pointer_transaction_manifest_schema_invalid'
  );
  const manifestBindings: Array<[string, unknown, unknown]> = [
    ['requirementSetId', transactionManifest.requirementSetId, pointer.requirementSetId],
    [
      'implementationAttemptId',
      transactionManifest.implementationAttemptId,
      pointer.implementationAttemptId,
    ],
    ['transactionId', transactionManifest.transactionId, pointer.transactionId],
    ['attemptSequence', transactionManifest.attemptSequence, pointer.attemptSequence],
    ['contractHash', transactionManifest.contractHash, pointer.contractHash],
    ['sourceHash', transactionManifest.sourceHash, pointer.sourceDocumentHash],
    ['semanticModelHash', transactionManifest.semanticModelHash, pointer.semanticModelHash],
    ['dispatchInputSetHash', transactionManifest.dispatchInputSetHash, pointer.dispatchInputSetHash],
    ['createdAt', transactionManifest.createdAt, pointer.createdAt],
    ['transactionStatus', transactionManifest.transactionStatus, 'pass'],
    ['executionDisposition', transactionManifest.executionDisposition, 'executable'],
  ];
  for (const [field, actual, expected] of manifestBindings) {
    if (actual !== expected) {
      throw new Error(`current_dispatch_pointer_transaction_manifest_mismatch:${field}`);
    }
  }
  if (
    !sameFilePath(
      transactionManifest.outputs?.transactionManifestPath,
      pointer.transactionManifestRef.path
    ) ||
    !sameFilePath(transactionManifest.outputs?.modelPacket?.path, pointer.modelPacketRef.path) ||
    transactionManifest.outputs?.modelPacket?.hash !== pointer.modelPacketRef.hash
  ) {
    throw new Error('current_dispatch_pointer_transaction_manifest_output_mismatch');
  }

  const promptTransaction = modelPacket.promptTransaction;
  const controlledExecutionContext = modelPacket.controlledExecutionContext;
  if (
    !promptTransaction ||
    typeof promptTransaction !== 'object' ||
    Array.isArray(promptTransaction) ||
    !controlledExecutionContext ||
    typeof controlledExecutionContext !== 'object' ||
    Array.isArray(controlledExecutionContext)
  ) {
    throw new Error('current_dispatch_pointer_model_packet_binding_missing');
  }
  const packetBindings: Array<[string, unknown, unknown]> = [
    ['packetId', modelPacket.packetId, pointer.packetId],
    ['transactionId', promptTransaction.transactionId, pointer.transactionId],
    [
      'manifestSchemaVersion',
      promptTransaction.manifestSchemaVersion,
      transactionManifest.schemaVersion,
    ],
    [
      'requirementSetId',
      controlledExecutionContext.requirementSetId,
      pointer.requirementSetId,
    ],
    [
      'implementationAttemptId',
      controlledExecutionContext.implementationAttemptId,
      pointer.implementationAttemptId,
    ],
    ['transactionId', controlledExecutionContext.transactionId, pointer.transactionId],
    ['contractHash', controlledExecutionContext.contractHash, pointer.contractHash],
  ];
  for (const [field, actual, expected] of packetBindings) {
    if (actual !== expected) {
      throw new Error(`current_dispatch_pointer_model_packet_mismatch:${field}`);
    }
  }
  if (!sameFilePath(promptTransaction.manifestPath, pointer.transactionManifestRef.path)) {
    throw new Error('current_dispatch_pointer_model_packet_manifest_path_mismatch');
  }
}

export function resolveCurrentDispatchPointer(input: {
  pointerPath: string;
  expected: CurrentDispatchPointerExpectedIdentity;
}): CurrentDispatchPointerResolution {
  const pointerPath = path.resolve(input.pointerPath);
  if (!fs.existsSync(pointerPath) || !fs.statSync(pointerPath).isFile()) {
    throw new Error('current_dispatch_pointer_missing');
  }
  const pointer = readJsonObject(pointerPath, 'current_dispatch_pointer_json_invalid');
  assertValid(pointer);
  assertExpectedIdentity(pointer, input.expected);
  assertPointerReferences(pointer);
  const pointerHash = fileHash(pointerPath);
  assertPointerSafeWriteReceipt(pointerPath, pointerHash);
  const modelPacket = readJsonObject(
    path.resolve(pointer.modelPacketRef.path),
    'current_dispatch_pointer_model_packet_json_invalid'
  );
  const transactionManifest = readJsonObject(
    path.resolve(pointer.transactionManifestRef.path),
    'current_dispatch_pointer_transaction_manifest_json_invalid'
  );
  assertPayloadBindings({ pointer, modelPacket, transactionManifest });
  return {
    pointerPath: slash(pointerPath),
    pointerHash,
    pointer,
    modelPacket,
    transactionManifest,
  };
}

export function publishCurrentDispatchPointer(input: {
  targetPath: string;
  expectedPreimageHash: string | null;
  pointer: JsonRecord;
}): CurrentDispatchPointerPublication {
  const targetPath = path.resolve(input.targetPath);
  const previousBytes = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
  const previousPointer = previousBytes
    ? (JSON.parse(previousBytes.toString('utf8')) as JsonRecord)
    : null;
  const observedPreimageHash = previousBytes ? fileHash(targetPath) : null;
  if (observedPreimageHash !== input.expectedPreimageHash) {
    throw new Error('current_dispatch_pointer_cas_mismatch');
  }
  assertCurrentDispatchPointerReplaySafe(targetPath, Number(input.pointer.attemptSequence));
  assertValid(input.pointer);
  assertPointerReferences(input.pointer);
  if (
    (observedPreimageHash === null && fs.existsSync(targetPath)) ||
    (observedPreimageHash !== null && fileHash(targetPath) !== observedPreimageHash)
  ) {
    throw new Error('current_dispatch_pointer_cas_mismatch');
  }
  const write = writeGovernedJson(targetPath, input.pointer);
  assertValid(JSON.parse(fs.readFileSync(targetPath, 'utf8')));
  return {
    pointer: input.pointer,
    pointerRef: write.targetRef,
    safeWriteReceiptRef: write.receiptRef,
    previousPointer,
  };
}

export function rollbackCurrentDispatchPointer(
  targetPath: string,
  publication: CurrentDispatchPointerPublication
): void {
  const resolved = path.resolve(targetPath);
  if (publication.previousPointer) {
    writeGovernedJson(resolved, publication.previousPointer);
    return;
  }
  for (const candidate of [resolved, `${resolved}.safe-write-receipt.json`]) {
    if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true });
  }
}

export function pointerFileRef(ref: GovernedReadbackRef) {
  return { path: slash(ref.path), hash: ref.hash };
}
