import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv from 'ajv';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
  type GovernedReadbackRef,
} from './requirements-contract-governed-write';

// AJV validates these schema-driven records before governed publication and replay.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;
type VerifiedFile = {
  path: string;
  realPath: string;
  hash: string;
  bytes: Buffer;
};

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
  const ajv =
    schemaName === 'requirements-contract-large-document-writer-safe-write-receipt.schema.json'
      ? new Ajv({ allErrors: true, strict: false })
      : new Ajv2020({ allErrors: true, strict: false });
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

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function resolveRealDirectory(rootPath: string, issueCode: string): string {
  try {
    const resolved = path.resolve(rootPath);
    if (!fs.statSync(resolved).isDirectory()) throw new Error(issueCode);
    return fs.realpathSync(resolved);
  } catch {
    throw new Error(issueCode);
  }
}

function sameFilePath(left: unknown, right: unknown): boolean {
  return (
    typeof left === 'string' &&
    typeof right === 'string' &&
    normalizedPath(left) === normalizedPath(right)
  );
}

function assertContainedRealPath(
  rootRealPath: string,
  targetRealPath: string,
  issueCode: string
): void {
  const relative = path.relative(rootRealPath, targetRealPath);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(issueCode);
  }
}

function readStableFile(
  filePath: string,
  missingIssueCode: string,
  readbackIssueCode: string
): VerifiedFile {
  const resolved = path.resolve(filePath);
  let realPath: string;
  try {
    if (!fs.statSync(resolved).isFile()) throw new Error(missingIssueCode);
    realPath = fs.realpathSync(resolved);
  } catch {
    throw new Error(missingIssueCode);
  }
  const first = fs.readFileSync(realPath);
  const second = fs.readFileSync(realPath);
  if (!first.equals(second)) {
    throw new Error(readbackIssueCode);
  }
  return {
    path: resolved,
    realPath,
    hash: sha256(first),
    bytes: first,
  };
}

function parseJsonObject(bytes: Buffer, issueCode: string): JsonRecord {
  try {
    const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(issueCode);
    }
    return parsed as JsonRecord;
  } catch (error) {
    if (error instanceof Error && error.message === issueCode) throw error;
    throw new Error(issueCode);
  }
}

function assertFileRef(
  ref: JsonRecord,
  label: string,
  rootRealPath: string,
  scope: 'authority' | 'consumer',
  readbackRequired = false
): VerifiedFile {
  if (!ref || typeof ref !== 'object' || Array.isArray(ref) || typeof ref.path !== 'string') {
    throw new Error(`current_dispatch_pointer_reference_missing:${label}`);
  }
  const verified = readStableFile(
    ref.path,
    `current_dispatch_pointer_reference_missing:${label}`,
    `current_dispatch_pointer_reference_readback_mismatch:${label}`
  );
  assertContainedRealPath(
    rootRealPath,
    verified.realPath,
    `current_dispatch_pointer_reference_outside_${scope}_root:${label}`
  );
  if (
    verified.hash !== ref.hash ||
    (readbackRequired &&
      (ref.readbackVerified !== true ||
        ref.readbackHash !== ref.hash ||
        verified.hash !== ref.readbackHash))
  ) {
    throw new Error(`current_dispatch_pointer_reference_hash_mismatch:${label}`);
  }
  return verified;
}

function assertPointerReferences(
  pointer: JsonRecord,
  authorityRootRealPath: string
): Map<string, VerifiedFile> {
  const consumerRootRealPath = resolveRealDirectory(
    pointer.consumerRef?.root,
    'current_dispatch_pointer_consumer_root_invalid'
  );
  const verified = new Map<string, VerifiedFile>();
  const authorityFileRefs: Array<[string, JsonRecord]> = [
    ['requirementRecordRef', pointer.requirementRecordRef],
    ['attemptContextRef', pointer.attemptContextRef],
    ['stageRegistryRef', pointer.stageRegistryRef],
    ['confirmationReceiptRefs.requirements', pointer.confirmationReceiptRefs?.requirements],
    ['confirmationReceiptRefs.architecture', pointer.confirmationReceiptRefs?.architecture],
    ['implementationReadinessReceiptRef', pointer.implementationReadinessReceiptRef],
    ['confirmationPageRefs.requirements', pointer.confirmationPageRefs?.requirements],
    ...(pointer.confirmationPageRefs?.architecture
      ? ([
          ['confirmationPageRefs.architecture', pointer.confirmationPageRefs.architecture],
        ] as Array<[string, JsonRecord]>)
      : []),
    ['transactionManifestRef', pointer.transactionManifestRef],
    ['modelPacketRef', pointer.modelPacketRef],
    ['auditReceiptRef', pointer.auditReceiptRef],
    ['humanPromptRef', pointer.humanPromptRef],
    ['capabilityObservationRef', pointer.capabilityObservationRef],
    ...(pointer.goalExecutionRef
      ? ([['goalExecutionRef', pointer.goalExecutionRef]] as Array<[string, JsonRecord]>)
      : []),
    ...(pointer.campaignRuntimeBindingRef
      ? ([['campaignRuntimeBindingRef', pointer.campaignRuntimeBindingRef]] as Array<[
          string,
          JsonRecord
        ]>)
      : []),
    ...(pointer.supersededPointerRef
      ? ([['supersededPointerRef', pointer.supersededPointerRef]] as Array<[string, JsonRecord]>)
      : []),
  ];
  for (const [label, ref] of authorityFileRefs) {
    verified.set(
      label,
      assertFileRef(
        ref,
        label,
        authorityRootRealPath,
        'authority',
        label.endsWith('Ref') &&
          [
            'transactionManifestRef',
            'modelPacketRef',
            'auditReceiptRef',
            'humanPromptRef',
            'capabilityObservationRef',
            'goalExecutionRef',
            'campaignRuntimeBindingRef',
          ].includes(label)
      )
    );
  }
  const consumerFileRefs: Array<[string, JsonRecord]> = [
    ['installedStageRegistryRef', pointer.installedStageRegistryRef],
    ['consumerRef.marker', pointer.consumerRef?.marker],
    ['consumerRef.profile', pointer.consumerRef?.profile],
    [
      'packageRuntimeActionBindingManifestRef',
      pointer.packageRuntimeActionBindingManifestRef,
    ],
  ];
  for (const [label, ref] of consumerFileRefs) {
    verified.set(
      label,
      assertFileRef(ref, label, consumerRootRealPath, 'consumer')
    );
  }
  const sourceRef =
    pointer.sourceRef &&
    typeof pointer.sourceRef === 'object' &&
    !Array.isArray(pointer.sourceRef)
      ? pointer.sourceRef
      : null;
  if (!sourceRef) {
    throw new Error('current_dispatch_pointer_reference_missing:sourceRef');
  }
  verified.set(
    'sourceRef',
    assertFileRef(
      {
        path: sourceRef.path,
        hash: sourceRef.sourceDocumentHash,
      },
      'sourceRef',
      authorityRootRealPath,
      'authority'
    )
  );
  return verified;
}

function assertPointerSafeWriteReceipt(
  pointerPath: string,
  pointerHash: string,
  authorityRootRealPath: string
): void {
  const receiptPath = `${pointerPath}.safe-write-receipt.json`;
  const receiptFile = readStableFile(
    receiptPath,
    'current_dispatch_pointer_safe_write_receipt_missing',
    'current_dispatch_pointer_safe_write_receipt_readback_mismatch'
  );
  assertContainedRealPath(
    authorityRootRealPath,
    receiptFile.realPath,
    'current_dispatch_pointer_safe_write_receipt_outside_authority_root'
  );
  const receipt = parseJsonObject(
    receiptFile.bytes,
    'current_dispatch_pointer_safe_write_receipt_invalid'
  );
  assertSchema(
    receipt,
    'requirements-contract-large-document-writer-safe-write-receipt.schema.json',
    'current_dispatch_pointer_safe_write_receipt_invalid'
  );
  if (
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

function assertSameBinding(field: string, actual: unknown, expected: unknown): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(`current_dispatch_pointer_transaction_manifest_mismatch:${field}`);
  }
}

function assertManifestOutputRef(
  field: string,
  actual: unknown,
  expected: JsonRecord | null
): void {
  if (expected === null) {
    if (actual !== undefined) {
      throw new Error(`current_dispatch_pointer_transaction_manifest_output_mismatch:${field}`);
    }
    return;
  }
  if (
    !actual ||
    typeof actual !== 'object' ||
    Array.isArray(actual) ||
    !sameFilePath((actual as JsonRecord).path, expected.path) ||
    (actual as JsonRecord).hash !== expected.hash
  ) {
    throw new Error(`current_dispatch_pointer_transaction_manifest_output_mismatch:${field}`);
  }
}

function containsExecutionAuthorityClaim(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsExecutionAuthorityClaim);
  return Object.entries(value as JsonRecord).some(
    ([key, child]) =>
      (key === 'executionAuthorityClaim' && child === true) ||
      (key === 'artifactRole' && child === 'execution_authority') ||
      containsExecutionAuthorityClaim(child)
  );
}

function assertModelPacketBindings(input: {
  pointer: JsonRecord;
  modelPacket: JsonRecord;
  transactionManifest: JsonRecord;
  requirementRecord: JsonRecord;
  authorityRootRealPath: string;
}): void {
  const {
    pointer,
    modelPacket,
    transactionManifest,
    requirementRecord,
    authorityRootRealPath,
  } = input;
  const promptTransaction = modelPacket.promptTransaction;
  const controlledExecutionContext = modelPacket.controlledExecutionContext;
  const authorityPolicy = modelPacket.authorityPolicy;
  const requiredStructures: Array<[string, unknown, 'array' | 'object']> = [
    ['traceOrder', modelPacket.traceOrder, 'array'],
    ['atomicImplementationTaskList', modelPacket.atomicImplementationTaskList, 'array'],
    ['mustToAtomicTaskMap', modelPacket.mustToAtomicTaskMap, 'object'],
    ['atomicTaskToTraceMap', modelPacket.atomicTaskToTraceMap, 'object'],
    ['requirements', modelPacket.requirements, 'object'],
    ['errorCaseCoverage', modelPacket.errorCaseCoverage, 'object'],
    ['executionHandoff', modelPacket.executionHandoff, 'object'],
    ['requiredCommands', modelPacket.requiredCommands, 'array'],
    ['contractExecutionManifest', modelPacket.contractExecutionManifest, 'object'],
  ];
  if (
    modelPacket.artifactRole !== 'non_authoritative_projection' ||
    containsExecutionAuthorityClaim(modelPacket)
  ) {
    throw new Error('current_dispatch_pointer_model_packet_authority_policy_invalid');
  }
  if (
    !authorityPolicy ||
    typeof authorityPolicy !== 'object' ||
    Array.isArray(authorityPolicy) ||
    authorityPolicy.primaryAuthority !== 'confirmed_source_and_requirement_record' ||
    authorityPolicy.modelPacketRole !== 'non_authoritative_projection' ||
    authorityPolicy.humanPromptRole !== 'non_authoritative_projection' ||
    authorityPolicy.transactionManifestRole !== 'publication_integrity_manifest' ||
    authorityPolicy.auditReceiptRole !==
      'transaction_integrity_receipt_not_closeout_authority' ||
    authorityPolicy.executionAuthorityClaim !== false ||
    authorityPolicy.closeoutAuthorityClaim !== false ||
    authorityPolicy.sourceTraceMutationPolicy !==
      'confirmed_source_traceRows_status_must_not_be_rewritten'
  ) {
    throw new Error('current_dispatch_pointer_model_packet_authority_policy_invalid');
  }
  for (const [field, value, kind] of requiredStructures) {
    const valid =
      kind === 'array'
        ? Array.isArray(value)
        : Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    if (!valid) {
      throw new Error(`current_dispatch_pointer_model_packet_structure_invalid:${field}`);
    }
  }
  if (
    !promptTransaction ||
    typeof promptTransaction !== 'object' ||
    Array.isArray(promptTransaction) ||
    canonicalJson(Object.keys(promptTransaction).sort()) !==
      canonicalJson(['manifestPath', 'manifestSchemaVersion', 'transactionId'])
  ) {
    throw new Error('current_dispatch_pointer_model_packet_binding_missing');
  }
  if (
    !controlledExecutionContext ||
    typeof controlledExecutionContext !== 'object' ||
    Array.isArray(controlledExecutionContext)
  ) {
    throw new Error('current_dispatch_pointer_model_packet_binding_missing');
  }
  const packetBindings: Array<[string, unknown, unknown]> = [
    ['packetId', modelPacket.packetId, pointer.packetId],
    ['sourceDocumentHash', modelPacket.sourceDocumentHash, pointer.sourceDocumentHash],
    [
      'implementationConfirmationHash',
      modelPacket.implementationConfirmationHash,
      requirementRecord.implementationConfirmationHash,
    ],
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
    [
      'inputSnapshotHash',
      controlledExecutionContext.inputSnapshotHash,
      pointer.attemptContextRef.hash,
    ],
  ];
  for (const [field, actual, expected] of packetBindings) {
    if (actual !== expected) {
      throw new Error(`current_dispatch_pointer_model_packet_mismatch:${field}`);
    }
  }
  const executionHandoff = modelPacket.executionHandoff as JsonRecord;
  if (executionHandoff.packetId !== pointer.packetId) {
    throw new Error('current_dispatch_pointer_model_packet_mismatch:executionHandoff.packetId');
  }
  const expectedTaskReportPath = path.join(
    authorityRootRealPath,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    String(pointer.requirementSetId),
    `${String(pointer.implementationAttemptId)}.json`
  );
  if (!sameFilePath(executionHandoff.taskReportPath, expectedTaskReportPath)) {
    throw new Error(
      'current_dispatch_pointer_model_packet_mismatch:executionHandoff.taskReportPath'
    );
  }
  if (!sameFilePath(promptTransaction.manifestPath, pointer.transactionManifestRef.path)) {
    throw new Error('current_dispatch_pointer_model_packet_manifest_path_mismatch');
  }
  if (!sameFilePath(controlledExecutionContext.commandCwd, authorityRootRealPath)) {
    throw new Error('current_dispatch_pointer_model_packet_mismatch:commandCwd');
  }
  const commandReceiptRoot = path.resolve(
    String(controlledExecutionContext.commandReceiptRoot ?? '')
  );
  const relativeCommandReceiptRoot = path.relative(authorityRootRealPath, commandReceiptRoot);
  if (
    !relativeCommandReceiptRoot ||
    relativeCommandReceiptRoot.startsWith('..') ||
    path.isAbsolute(relativeCommandReceiptRoot)
  ) {
    throw new Error('current_dispatch_pointer_model_packet_mismatch:commandReceiptRoot');
  }
}

function assertAuditReceiptBindings(input: {
  pointer: JsonRecord;
  auditReceipt: JsonRecord;
}): void {
  const { pointer, auditReceipt } = input;
  const transaction = auditReceipt.promptTransaction;
  if (
    auditReceipt.schemaVersion !==
      'requirements-contract-prompt-transaction-audit-receipt/v1' ||
    auditReceipt.decision !== 'PASS' ||
    auditReceipt.transactionId !== pointer.transactionId ||
    auditReceipt.requirementSetId !== pointer.requirementSetId ||
    auditReceipt.implementationAttemptId !== pointer.implementationAttemptId ||
    !transaction ||
    typeof transaction !== 'object' ||
    Array.isArray(transaction) ||
    !sameFilePath(transaction.manifestPath, pointer.transactionManifestRef.path) ||
    transaction.manifestHash !== pointer.transactionManifestRef.hash ||
    transaction.modelPacketHash !== pointer.modelPacketRef.hash ||
    transaction.humanPromptHash !== pointer.humanPromptRef.hash ||
    transaction.goalExecutionHash !== (pointer.goalExecutionRef?.hash ?? null) ||
    auditReceipt.authorityPolicy?.executionAuthorityClaim !== false ||
    auditReceipt.authorityPolicy?.closeoutAuthorityClaim !== false
  ) {
    throw new Error('current_dispatch_pointer_audit_receipt_binding_mismatch');
  }
}

function assertPayloadBindings(input: {
  pointer: JsonRecord;
  modelPacket: JsonRecord;
  transactionManifest: JsonRecord;
  auditReceipt: JsonRecord;
  requirementRecord: JsonRecord;
  attemptContext: JsonRecord;
  authorityRootRealPath: string;
}): void {
  const {
    pointer,
    modelPacket,
    transactionManifest,
    auditReceipt,
    requirementRecord,
    attemptContext,
    authorityRootRealPath,
  } = input;
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
    [
      'architectureAuthorityDecision',
      transactionManifest.architectureAuthorityDecision,
      pointer.architectureAuthorityDecision,
    ],
    ['createdAt', transactionManifest.createdAt, pointer.createdAt],
    ['transactionStatus', transactionManifest.transactionStatus, 'pass'],
    ['executionDisposition', transactionManifest.executionDisposition, 'executable'],
  ];
  for (const [field, actual, expected] of manifestBindings) {
    if (actual !== expected) {
      throw new Error(`current_dispatch_pointer_transaction_manifest_mismatch:${field}`);
    }
  }
  const refBindings: Array<[string, unknown, unknown]> = [
    ['requirementRecordRef', transactionManifest.requirementRecordRef, pointer.requirementRecordRef],
    ['attemptContextRef', transactionManifest.attemptContextRef, pointer.attemptContextRef],
    ['sourceRef', transactionManifest.sourceRef, pointer.sourceRef],
    ['stageRegistryRef', transactionManifest.stageRegistryRef, pointer.stageRegistryRef],
    [
      'installedStageRegistryRef',
      transactionManifest.installedStageRegistryRef,
      pointer.installedStageRegistryRef,
    ],
    [
      'confirmationReceiptRefs',
      transactionManifest.confirmationReceiptRefs,
      pointer.confirmationReceiptRefs,
    ],
    [
      'implementationReadinessReceiptRef',
      transactionManifest.implementationReadinessReceiptRef,
      pointer.implementationReadinessReceiptRef,
    ],
    [
      'confirmationPageRefs',
      transactionManifest.confirmationPageRefs,
      pointer.confirmationPageRefs,
    ],
    ['universeHashes', transactionManifest.universeHashes, pointer.universeHashes],
    [
      'capabilityObservationRef',
      transactionManifest.capabilityObservationRef,
      pointer.capabilityObservationRef,
    ],
  ];
  for (const [field, actual, expected] of refBindings) {
    assertSameBinding(field, actual, expected);
  }
  if (
    transactionManifest.consumerRef?.consumerId !== pointer.consumerRef.consumerId ||
    !sameFilePath(transactionManifest.consumerRef?.root, pointer.consumerRef.root) ||
    canonicalJson(transactionManifest.consumerRef?.marker) !==
      canonicalJson(pointer.consumerRef.marker) ||
    canonicalJson(transactionManifest.consumerRef?.profile) !==
      canonicalJson(pointer.consumerRef.profile) ||
    canonicalJson(transactionManifest.consumerRef?.actionBindingManifest) !==
      canonicalJson(pointer.packageRuntimeActionBindingManifestRef)
  ) {
    throw new Error('current_dispatch_pointer_transaction_manifest_mismatch:consumerRef');
  }
  if (
    !sameFilePath(
      transactionManifest.outputs?.transactionManifestPath,
      pointer.transactionManifestRef.path
    )
  ) {
    throw new Error(
      'current_dispatch_pointer_transaction_manifest_output_mismatch:transactionManifest'
    );
  }
  assertManifestOutputRef(
    'modelPacket',
    transactionManifest.outputs?.modelPacket,
    pointer.modelPacketRef
  );
  assertManifestOutputRef(
    'humanPrompt',
    transactionManifest.outputs?.humanPrompt,
    pointer.humanPromptRef
  );
  assertManifestOutputRef(
    'goalExecution',
    transactionManifest.outputs?.goalExecution,
    pointer.goalExecutionRef
  );
  if (
    !sameFilePath(transactionManifest.outputs?.auditReceipt?.path, pointer.auditReceiptRef.path)
  ) {
    throw new Error(
      'current_dispatch_pointer_transaction_manifest_output_mismatch:auditReceipt'
    );
  }
  const consumerRootRealPath = resolveRealDirectory(
    pointer.consumerRef.root,
    'current_dispatch_pointer_consumer_root_invalid'
  );
  for (const [label, ref] of [
    ['transactionManifest.generatorRef', transactionManifest.generatorRef],
    ['transactionManifest.runnerRef', transactionManifest.runnerRef],
    [
      'transactionManifest.consumerRef.actionBindingManifest',
      transactionManifest.consumerRef.actionBindingManifest,
    ],
  ] as Array<[string, JsonRecord]>) {
    assertFileRef(ref, label, consumerRootRealPath, 'consumer');
  }
  for (const [label, ref] of [
    ['transactionManifest.requirementRecordRef', transactionManifest.requirementRecordRef],
    ['transactionManifest.attemptContextRef', transactionManifest.attemptContextRef],
    ['transactionManifest.stageRegistryRef', transactionManifest.stageRegistryRef],
    [
      'transactionManifest.confirmationReceiptRefs.requirements',
      transactionManifest.confirmationReceiptRefs.requirements,
    ],
    [
      'transactionManifest.confirmationReceiptRefs.architecture',
      transactionManifest.confirmationReceiptRefs.architecture,
    ],
    [
      'transactionManifest.implementationReadinessReceiptRef',
      transactionManifest.implementationReadinessReceiptRef,
    ],
    [
      'transactionManifest.confirmationPageRefs.requirements',
      transactionManifest.confirmationPageRefs.requirements,
    ],
    ...(transactionManifest.confirmationPageRefs.architecture
      ? ([
          [
            'transactionManifest.confirmationPageRefs.architecture',
            transactionManifest.confirmationPageRefs.architecture,
          ],
        ] as Array<[string, JsonRecord]>)
      : []),
    [
      'transactionManifest.capabilityObservationRef',
      transactionManifest.capabilityObservationRef,
    ],
    ['transactionManifest.outputs.modelPacket', transactionManifest.outputs.modelPacket],
    ['transactionManifest.outputs.humanPrompt', transactionManifest.outputs.humanPrompt],
    ...(transactionManifest.outputs.goalExecution
      ? ([
          [
            'transactionManifest.outputs.goalExecution',
            transactionManifest.outputs.goalExecution,
          ],
        ] as Array<[string, JsonRecord]>)
      : []),
  ] as Array<[string, JsonRecord]>) {
    assertFileRef(ref, label, authorityRootRealPath, 'authority');
  }
  if (
    requirementRecord.requirementSetId !== pointer.requirementSetId ||
    (requirementRecord.currentAttemptId ?? requirementRecord.implementationAttemptId) !==
      pointer.implementationAttemptId ||
    requirementRecord.sourceDocumentHash !== pointer.sourceDocumentHash ||
    requirementRecord.semanticModelHash !== pointer.semanticModelHash
  ) {
    throw new Error('current_dispatch_pointer_requirement_record_binding_mismatch');
  }
  for (const field of [
    'transactionId',
    'requirementSetId',
    'implementationAttemptId',
    'contractHash',
    'sourceDocumentHash',
    'semanticModelHash',
  ]) {
    const expectedField = field === 'contractHash' ? 'contractHash' : field;
    if (attemptContext[field] !== pointer[expectedField]) {
      throw new Error(`current_dispatch_pointer_attempt_context_mismatch:${field}`);
    }
  }
  assertModelPacketBindings({
    pointer,
    modelPacket,
    transactionManifest,
    requirementRecord,
    authorityRootRealPath,
  });
  assertAuditReceiptBindings({ pointer, auditReceipt });
}

export function resolveCurrentDispatchPointer(input: {
  authorityRoot: string;
  pointerPath: string;
  expected: CurrentDispatchPointerExpectedIdentity;
}): CurrentDispatchPointerResolution {
  const authorityRootRealPath = resolveRealDirectory(
    input.authorityRoot,
    'current_dispatch_pointer_authority_root_invalid'
  );
  const pointerPath = path.resolve(input.pointerPath);
  const pointerFile = readStableFile(
    pointerPath,
    'current_dispatch_pointer_missing',
    'current_dispatch_pointer_readback_mismatch'
  );
  assertContainedRealPath(
    authorityRootRealPath,
    pointerFile.realPath,
    'current_dispatch_pointer_outside_authority_root'
  );
  const pointer = parseJsonObject(
    pointerFile.bytes,
    'current_dispatch_pointer_json_invalid'
  );
  assertValid(pointer);
  assertExpectedIdentity(pointer, input.expected);
  const verifiedRefs = assertPointerReferences(pointer, authorityRootRealPath);
  const pointerHash = pointerFile.hash;
  assertPointerSafeWriteReceipt(pointerPath, pointerHash, authorityRootRealPath);
  const modelPacket = parseJsonObject(
    verifiedRefs.get('modelPacketRef')!.bytes,
    'current_dispatch_pointer_model_packet_json_invalid'
  );
  const transactionManifest = parseJsonObject(
    verifiedRefs.get('transactionManifestRef')!.bytes,
    'current_dispatch_pointer_transaction_manifest_json_invalid'
  );
  const auditReceipt = parseJsonObject(
    verifiedRefs.get('auditReceiptRef')!.bytes,
    'current_dispatch_pointer_audit_receipt_json_invalid'
  );
  const requirementRecord = parseJsonObject(
    verifiedRefs.get('requirementRecordRef')!.bytes,
    'current_dispatch_pointer_requirement_record_json_invalid'
  );
  const attemptContext = parseJsonObject(
    verifiedRefs.get('attemptContextRef')!.bytes,
    'current_dispatch_pointer_attempt_context_json_invalid'
  );
  assertPayloadBindings({
    pointer,
    modelPacket,
    transactionManifest,
    auditReceipt,
    requirementRecord,
    attemptContext,
    authorityRootRealPath,
  });
  return {
    pointerPath: slash(pointerPath),
    pointerHash,
    pointer,
    modelPacket,
    transactionManifest,
  };
}

export function publishCurrentDispatchPointer(input: {
  authorityRoot: string;
  targetPath: string;
  expectedPreimageHash: string | null;
  pointer: JsonRecord;
}): CurrentDispatchPointerPublication {
  const authorityRootRealPath = resolveRealDirectory(
    input.authorityRoot,
    'current_dispatch_pointer_authority_root_invalid'
  );
  const targetPath = path.resolve(input.targetPath);
  let existingAncestor = targetPath;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) {
      throw new Error('current_dispatch_pointer_outside_authority_root');
    }
    existingAncestor = parent;
  }
  const prospectiveRealPath = path.resolve(
    fs.realpathSync(existingAncestor),
    path.relative(existingAncestor, targetPath)
  );
  assertContainedRealPath(
    authorityRootRealPath,
    prospectiveRealPath,
    'current_dispatch_pointer_outside_authority_root'
  );
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
  assertPointerReferences(input.pointer, authorityRootRealPath);
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
