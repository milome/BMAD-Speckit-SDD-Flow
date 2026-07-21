import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  runMainAgentCompiledPrompt,
  type CompiledPromptRunResult,
} from './main-agent-compiled-prompt-runner';
import {
  resolvePromptPublicationAuthority,
  type PromptTransactionPublishOptions,
  type PromptPublicationAuthority,
} from './requirements-contract-prompt-transaction-authority';
import { resolvePromptPublicationRuntimeBindings } from './requirements-contract-package-runtime-action-binding-manifest';
import { validateSourcePrdLintTransitionFromFiles } from './requirements-contract-validation-facade';
import {
  acquirePromptTransactionLock,
  releasePromptTransactionLock,
  type PromptTransactionLockDeps,
  type PromptTransactionLockHandle,
} from './requirements-contract-prompt-transaction-lock';
import {
  assertCurrentDispatchPointerReplaySafe,
  publishCurrentDispatchPointer,
  rollbackCurrentDispatchPointer,
  type CurrentDispatchPointerPublication,
} from './requirements-contract-current-dispatch-pointer';
import {
  canonicalJson,
  fileHash,
  sha256,
  slash,
  writeGovernedJson,
  writeGovernedText,
  type GovernedReadbackRef,
} from './requirements-contract-governed-write';
import { auditModelPacketParity } from './requirements-contract-model-packet-parity';

// Runtime schemas validate these records before publication uses dynamic fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;
type WriteResult = ReturnType<typeof writeGovernedJson>;
type RuntimeBindings = ReturnType<typeof resolvePromptPublicationRuntimeBindings>;

const ACTION = 'requirements-contract-prompt-transaction-publish';
const MANIFEST_SCHEMA_VERSION = 'requirements-contract-prompt-transaction-manifest/v1';
const ALWAYS_OUTPUTS = [
  'model_packet.json',
  'transaction-manifest.json',
  'audit_receipt.json',
  'human_prompt.txt',
] as const;
const GOAL_OUTPUT = 'goal_execution.md';
const ALL_OUTPUTS = [...ALWAYS_OUTPUTS, GOAL_OUTPUT];
const REQUIREMENT_RECORD_SNAPSHOT = path.join(
  'authority-inputs',
  'requirement-record.snapshot.json'
);

export interface PromptTransactionPublisherDeps {
  runCompiledPrompt?: typeof runMainAgentCompiledPrompt;
  now?: () => string;
  spawn?: typeof spawnSync;
  lockDeps?: PromptTransactionLockDeps;
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonRecord;
}

function samePath(left: string, right: string): boolean {
  const normalize = (value: string) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function requirementRecordSnapshotPath(outDir: string): string {
  return path.join(outDir, REQUIREMENT_RECORD_SNAPSHOT);
}

function assertSchema(schemaName: string, value: unknown, label: string): void {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
  if (!validate(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validate.errors ?? [])}`);
  }
}

function expectedProductionArgv(
  authority: PromptPublicationAuthority,
  generatorPath: string,
  goalCommandAvailable: boolean
): string[] {
  return [
    process.execPath,
    path.resolve(generatorPath),
    '--requirement-record',
    authority.paths.requirementRecord,
    '--source-document',
    authority.paths.source,
    '--out-dir',
    authority.paths.outDir,
    '--execution-host',
    authority.executionHost,
    '--prompt-language',
    'auto',
    '--human-prompt-profile',
    'full',
    '--json',
    '--goal-command-available',
    goalCommandAvailable ? 'true' : 'false',
    '--packet-id',
    authority.identity.implementationAttemptId,
    '--task-report-path',
    authority.paths.taskReport,
    '--requirement-set-id',
    authority.controlledExecutionContext.requirementSetId,
    '--transaction-id',
    authority.controlledExecutionContext.transactionId,
    '--implementation-attempt-id',
    authority.controlledExecutionContext.implementationAttemptId,
    '--architecture-audit-attempt-id',
    authority.controlledExecutionContext.architectureAuditAttemptId,
    '--active-phase-audit-attempt-id',
    authority.controlledExecutionContext.activePhaseAuditAttemptId,
    '--contract-hash',
    authority.controlledExecutionContext.contractHash,
    '--input-snapshot-hash',
    authority.controlledExecutionContext.inputSnapshotHash,
    '--command-cwd',
    authority.controlledExecutionContext.commandCwd,
    '--command-receipt-root',
    authority.controlledExecutionContext.commandReceiptRoot,
  ];
}

function assertFileRef(
  actualPath: string | null | undefined,
  actualHash: string | null | undefined,
  expectedPath: string,
  label: string
): void {
  if (!actualPath || !samePath(actualPath, expectedPath)) throw new Error(`${label}_path_mismatch`);
  if (!fs.existsSync(expectedPath) || fileHash(expectedPath) !== actualHash) {
    throw new Error(`${label}_hash_mismatch`);
  }
}

function assertRunnerResult(
  result: CompiledPromptRunResult,
  authority: PromptPublicationAuthority,
  productionArgv: string[],
  generatorRef: { path: string; hash: string },
  runnerRef: { path: string; hash: string },
  goalRequired: boolean
): NonNullable<CompiledPromptRunResult['compiledPromptRef']> {
  if (result.status !== 'pass' || !result.compiledPromptRef) {
    throw new Error(`compiled_prompt_not_pass:${result.blockingReasons.join(',')}`);
  }
  if (!result.outDir || !samePath(result.outDir, authority.paths.outDir)) {
    throw new Error('compiled_prompt_out_dir_mismatch');
  }
  if (
    result.confirmedSource.status !== 'confirmed' ||
    !samePath(result.confirmedSource.recordPath, authority.paths.requirementRecord) ||
    !samePath(result.confirmedSource.sourcePath, authority.paths.source) ||
    result.confirmedSource.sourceDocumentHash !== authority.identity.sourceDocumentHash ||
    result.confirmedSource.implementationConfirmationHash !==
      authority.identity.implementationConfirmationHash
  ) {
    throw new Error('compiled_prompt_confirmed_source_mismatch');
  }
  if (
    canonicalJson(result.productionArgv) !== canonicalJson(productionArgv) ||
    result.productionArgvHash !== sha256(canonicalJson(productionArgv))
  ) {
    throw new Error('compiled_prompt_production_argv_mismatch');
  }
  if (
    !result.generatorRef ||
    !samePath(result.generatorRef.path, generatorRef.path) ||
    result.generatorRef.hash !== generatorRef.hash
  ) {
    throw new Error('compiled_prompt_generator_identity_mismatch');
  }
  if (
    !result.runnerRef ||
    !samePath(result.runnerRef.path, runnerRef.path) ||
    result.runnerRef.hash !== runnerRef.hash
  ) {
    throw new Error('compiled_prompt_runner_identity_mismatch');
  }
  if (
    !result.executionReceipt ||
    result.executionReceipt.exitCode !== 0 ||
    !result.stdoutPath ||
    !result.stderrPath ||
    result.executionReceipt.stdoutHash !== fileHash(result.stdoutPath) ||
    result.executionReceipt.stderrHash !== fileHash(result.stderrPath)
  ) {
    throw new Error('compiled_prompt_execution_receipt_invalid');
  }
  const ref = result.compiledPromptRef;
  const modelPacketPath = path.join(authority.paths.outDir, 'model_packet.json');
  const humanPromptPath = path.join(authority.paths.outDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(authority.paths.outDir, 'audit_receipt.json');
  const goalExecutionPath = path.join(authority.paths.outDir, GOAL_OUTPUT);
  assertFileRef(ref.modelPacketPath, ref.modelPacketHash, modelPacketPath, 'model_packet');
  assertFileRef(ref.humanPromptPath, ref.humanPromptHash, humanPromptPath, 'human_prompt');
  assertFileRef(ref.auditReceiptPath, ref.auditReceiptHash, auditReceiptPath, 'audit_receipt');
  if (goalRequired) {
    assertFileRef(
      ref.goalExecutionPath,
      ref.goalExecutionHash,
      goalExecutionPath,
      'goal_execution'
    );
  } else if (ref.goalExecutionPath || ref.goalExecutionHash || fs.existsSync(goalExecutionPath)) {
    throw new Error('goal_execution_applicability_drift');
  }
  if (
    !samePath(ref.taskReportPath ?? '', authority.paths.taskReport) ||
    ref.sourceDocumentHash !== authority.identity.sourceDocumentHash ||
    ref.implementationConfirmationHash !== authority.identity.implementationConfirmationHash
  ) {
    throw new Error('compiled_prompt_ref_identity_mismatch');
  }
  const rawPacket = readJson(modelPacketPath);
  if (rawPacket.artifactRole !== 'execution_authority') {
    throw new Error('generator_raw_packet_authority_contract_mismatch');
  }
  const rawReceipt = readJson(auditReceiptPath);
  const expectedGoalMode = goalRequired ? 'native_goal_document_ref' : 'direct_prompt';
  if (
    rawReceipt.decision !== 'pass' ||
    rawReceipt.goalCommand?.mode !== expectedGoalMode
  ) {
    throw new Error('generator_raw_receipt_applicability_mismatch');
  }
  return ref;
}

function finalPacket(rawPacket: JsonRecord, authority: PromptPublicationAuthority) {
  return {
    ...rawPacket,
    artifactRole: 'non_authoritative_projection',
    authorityPolicy: {
      primaryAuthority: 'confirmed_source_and_requirement_record',
      modelPacketRole: 'non_authoritative_projection',
      humanPromptRole: 'non_authoritative_projection',
      transactionManifestRole: 'publication_integrity_manifest',
      auditReceiptRole: 'transaction_integrity_receipt_not_closeout_authority',
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
      sourceTraceMutationPolicy: 'confirmed_source_traceRows_status_must_not_be_rewritten',
    },
    promptTransaction: {
      transactionId: authority.identity.transactionId,
      manifestPath: slash(path.join(authority.paths.outDir, 'transaction-manifest.json')),
      manifestSchemaVersion: MANIFEST_SCHEMA_VERSION,
    },
  };
}

function collectAuthorityClaims(value: unknown, location = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectAuthorityClaims(item, `${location}[${index}]`));
  }
  if (!value || typeof value !== 'object') {
    if (
      typeof value === 'string' &&
      (/execution_authority/iu.test(value) ||
        (/model_packet\.json/iu.test(value) && /execution authority/iu.test(value)))
    ) {
      return [location];
    }
    return [];
  }
  const claims: string[] = [];
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const childLocation = `${location}.${key}`;
    if (
      (key === 'executionAuthorityClaim' && child === true) ||
      (key === 'artifactRole' && child === 'execution_authority')
    ) {
      claims.push(childLocation);
      continue;
    }
    claims.push(...collectAuthorityClaims(child, childLocation));
  }
  return claims;
}

function assertNoAuthorityClaims(value: unknown): void {
  const claims = collectAuthorityClaims(value);
  if (claims.length > 0) {
    throw new Error(`model_packet_authority_claim_detected:${claims.join(',')}`);
  }
}

function finalHumanPrompt(rawPrompt: string): string {
  const deauthorized = rawPrompt.replace(
    /model_packet\.json is the machine-readable execution authority\.?/giu,
    'model_packet.json is a non-authoritative execution projection.'
  );
  return [
    'Authority boundary: model_packet.json and human_prompt.txt are non-authoritative projections.',
    'Machine execution and closeout authority remain with the confirmed Source, Requirement Record/control store, current receipts, and deterministic gates.',
    '',
    deauthorized,
  ].join('\n');
}

function fileRef(ref: GovernedReadbackRef) {
  return { path: slash(ref.path), hash: ref.hash };
}

function outputWriteCase(name: string, write: WriteResult) {
  return {
    output: name,
    path: slash(write.targetRef.path),
    hash: write.targetRef.hash,
    safeWriteReceiptPath: slash(write.receiptRef.path),
    safeWriteReceiptHash: write.receiptRef.hash,
    readbackVerified: true,
  };
}

function staleLockRecoveryCases(
  outDir: string,
  lockHandle: PromptTransactionLockHandle
): JsonRecord[] {
  const recovery = lockHandle.staleRecovery;
  if (!recovery) return [];
  const expectedArchivePath = path.join(
    outDir,
    `.prompt-transaction.lock.stale.${recovery.staleLockId}`
  );
  if (!samePath(recovery.archivePath, expectedArchivePath)) {
    throw new Error('prompt_transaction_stale_lock_archive_authority_mismatch');
  }
  const archivedLock = readJson(expectedArchivePath);
  if (
    archivedLock.lockId !== recovery.staleLockId ||
    archivedLock.transactionId !== recovery.staleTransactionId
  ) {
    throw new Error('prompt_transaction_stale_lock_archive_binding_mismatch');
  }
  return [
    {
      staleLockId: recovery.staleLockId,
      staleTransactionId: recovery.staleTransactionId,
      archivePath: slash(expectedArchivePath),
      recoveredByLockId: lockHandle.record.lockId,
      recoveredByTransactionId: lockHandle.record.transactionId,
    },
  ];
}

function assertExactRunnerOutputSet(
  outDir: string,
  goalRequired: boolean,
  lockHandle: PromptTransactionLockHandle
): void {
  const recoveryCases = staleLockRecoveryCases(outDir, lockHandle);
  const expected = new Set<string>([
    ...(goalRequired ? ALL_OUTPUTS : ALWAYS_OUTPUTS),
    'compiler.stdout.log',
    'compiler.stderr.log',
    '.prompt-transaction.lock',
    'observations',
    '.quarantine',
    ...recoveryCases.map((recovery) => path.basename(String(recovery.archivePath))),
  ]);
  const unexpected = fs
    .readdirSync(outDir, { withFileTypes: true })
    .map((entry) => entry.name)
    .filter((name) => !expected.has(name));
  if (unexpected.length > 0) {
    throw new Error(`prompt_transaction_output_set_mismatch:${unexpected.sort().join(',')}`);
  }
}

function quarantineExecutableOutputs(
  outDir: string,
  staleTransactionId: string,
  additionalCandidates: string[] = []
): string {
  const quarantineRoot = path.join(outDir, '.quarantine', staleTransactionId);
  if (fs.existsSync(quarantineRoot)) {
    throw new Error('prompt_transaction_quarantine_identity_collision');
  }
  fs.mkdirSync(quarantineRoot, { recursive: true });
  const candidates = [
    ...ALL_OUTPUTS.flatMap((name) => [
      path.join(outDir, name),
      path.join(outDir, `${name}.safe-write-receipt.json`),
    ]),
    ...additionalCandidates,
  ];
  for (const entry of fs.readdirSync(outDir, { withFileTypes: true })) {
    if (
      entry.isDirectory() ||
      entry.name === '.prompt-transaction.lock' ||
      entry.name === 'compiler.stdout.log' ||
      entry.name === 'compiler.stderr.log'
    ) {
      continue;
    }
    candidates.push(path.join(outDir, entry.name));
  }
  for (const candidate of [...new Set(candidates)]) {
      if (!fs.existsSync(candidate)) continue;
      const target = path.join(quarantineRoot, path.basename(candidate));
      if (fs.existsSync(target)) {
        throw new Error('prompt_transaction_quarantine_target_collision');
      }
      fs.renameSync(candidate, target);
  }
  return quarantineRoot;
}

function publishBlockedFromExistingManifest(
  outDir: string,
  existingManifest: JsonRecord,
  blockingReason: string,
  createdAt: string
): void {
  const manifestPath = path.join(outDir, 'transaction-manifest.json');
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    transactionId: existingManifest.transactionId,
    requirementSetId: existingManifest.requirementSetId,
    implementationAttemptId: existingManifest.implementationAttemptId,
    attemptSequence: existingManifest.attemptSequence,
    sourceHash: existingManifest.sourceHash,
    sourceAmendmentHashes: existingManifest.sourceAmendmentHashes,
    semanticModelHash: existingManifest.semanticModelHash,
    contractHash: existingManifest.contractHash,
    requirementRecordRef: existingManifest.requirementRecordRef,
    attemptContextRef: existingManifest.attemptContextRef,
    sourceRef: existingManifest.sourceRef,
    stageRegistryRef: existingManifest.stageRegistryRef,
    installedStageRegistryRef: existingManifest.installedStageRegistryRef,
    architectureAuthorityDecision: existingManifest.architectureAuthorityDecision,
    confirmationReceiptRefs: existingManifest.confirmationReceiptRefs,
    implementationReadinessReceiptRef: existingManifest.implementationReadinessReceiptRef,
    confirmationPageRefs: existingManifest.confirmationPageRefs,
    consumerRef: existingManifest.consumerRef,
    universeHashes: existingManifest.universeHashes,
    createdAt,
    transactionStatus: 'blocked',
    hostDirective: 'unresolved',
    executionDisposition: 'non_executable',
    blockingReasons: [blockingReason],
    failedPhase: 'authority_resolution',
    outputs: {
      transactionManifestPath: slash(manifestPath),
      auditReceipt: {
        path: slash(auditReceiptPath),
        hashApplicability: 'downstream_external',
      },
    },
  };
  assertSchema(
    'requirements-contract-prompt-transaction-manifest.schema.json',
    manifest,
    'prompt_transaction_manifest'
  );
  const manifestWrite = writeGovernedText(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  writeGovernedJson(auditReceiptPath, {
    schemaVersion: 'requirements-contract-prompt-transaction-audit-receipt/v1',
    decision: 'BLOCK',
    transactionId: existingManifest.transactionId,
    requirementSetId: existingManifest.requirementSetId,
    implementationAttemptId: existingManifest.implementationAttemptId,
    blockingReasons: [blockingReason],
    failedPhase: 'authority_resolution',
    promptTransaction: {
      manifestPath: slash(manifestPath),
      manifestHash: manifestWrite.targetRef.hash,
    },
    authorityPolicy: {
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
    },
    createdAt,
  });
}

function invalidateExistingTransactionAfterAuthorityFailure(
  options: PromptTransactionPublishOptions,
  blockingReason: string,
  createdAt: string,
  lockDeps?: PromptTransactionLockDeps
): boolean {
  const outDir = path.resolve(options.cwd, options.outDir);
  const manifestPath = path.join(outDir, 'transaction-manifest.json');
  if (!fs.existsSync(manifestPath)) return false;
  const existingManifest = readJson(manifestPath);
  assertSchema(
    'requirements-contract-prompt-transaction-manifest.schema.json',
    existingManifest,
    'existing_prompt_transaction_manifest'
  );
  if (
    existingManifest.transactionStatus !== 'pass' ||
    existingManifest.executionDisposition !== 'executable'
  ) {
    return false;
  }
  const frozenRequirementRecordPath = requirementRecordSnapshotPath(outDir);
  if (
    !samePath(
      existingManifest.requirementRecordRef?.path ?? '',
      frozenRequirementRecordPath
    ) ||
    existingManifest.implementationAttemptId !== options.packetId ||
    !samePath(existingManifest.outputs?.transactionManifestPath ?? '', manifestPath)
  ) {
    throw new Error('authority_failure_existing_transaction_scope_mismatch');
  }
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  if (!samePath(existingManifest.outputs?.auditReceipt?.path ?? '', auditReceiptPath)) {
    throw new Error('authority_failure_existing_transaction_output_mismatch');
  }
  const lockHandle = acquirePromptTransactionLock(
    {
      outDir,
      transactionId: String(existingManifest.transactionId),
    },
    lockDeps
  );
  try {
    quarantineExecutableOutputs(outDir, String(existingManifest.transactionId), [
      path.resolve(options.cwd, options.currentDispatchPointer),
      `${path.resolve(options.cwd, options.currentDispatchPointer)}.safe-write-receipt.json`,
      path.resolve(options.cwd, options.evidenceOut),
      `${path.resolve(options.cwd, options.evidenceOut)}.safe-write-receipt.json`,
    ]);
    publishBlockedFromExistingManifest(outDir, existingManifest, blockingReason, createdAt);
    return true;
  } finally {
    releasePromptTransactionLock(lockHandle);
  }
}

function removePublicationEvidence(authority: PromptPublicationAuthority): void {
  for (const candidate of [
    authority.paths.evidenceOut,
    `${authority.paths.evidenceOut}.safe-write-receipt.json`,
  ]) {
    if (fs.existsSync(candidate)) fs.rmSync(candidate, { force: true });
  }
}

function matchingReplayPointer(authority: PromptPublicationAuthority): JsonRecord | null {
  if (!fs.existsSync(authority.paths.currentDispatchPointer)) return null;
  const pointer = readJson(authority.paths.currentDispatchPointer);
  return pointer.transactionId === authority.identity.transactionId &&
    pointer.implementationAttemptId === authority.identity.implementationAttemptId &&
    Number(pointer.attemptSequence) === authority.identity.attemptSequence
    ? pointer
    : null;
}

function publishBlockedTransaction(
  authority: PromptPublicationAuthority,
  runtimeBindings: RuntimeBindings,
  blockingReason: string,
  failedPhase: string,
  createdAt: string
): void {
  const manifestPath = path.join(authority.paths.outDir, 'transaction-manifest.json');
  const auditReceiptPath = path.join(authority.paths.outDir, 'audit_receipt.json');
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    transactionId: authority.identity.transactionId,
    requirementSetId: authority.identity.requirementSetId,
    implementationAttemptId: authority.identity.implementationAttemptId,
    attemptSequence: authority.identity.attemptSequence,
    sourceHash: authority.identity.sourceDocumentHash,
    sourceAmendmentHashes: authority.identity.sourceAmendmentHashes,
    semanticModelHash: authority.identity.semanticModelHash,
    contractHash: authority.identity.contractHash,
    requirementRecordRef: authority.refs.requirementRecord,
    attemptContextRef: authority.refs.attemptContext,
    sourceRef: {
      path: slash(authority.paths.source),
      sourceDocumentHash: authority.identity.sourceDocumentHash,
    },
    stageRegistryRef: authority.refs.stageRegistry,
    installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
    architectureAuthorityDecision: authority.architectureAuthorityDecision,
    confirmationReceiptRefs: {
      requirements: authority.refs.requirementsConfirmationReceipt,
      architecture: authority.refs.architectureConfirmationReceipt,
    },
    implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
    confirmationPageRefs: {
      requirements: authority.refs.requirementsConfirmationPage,
      architecture: authority.refs.architectureConfirmationPage,
    },
    consumerRef: {
      consumerId: authority.consumerProfile.consumerId,
      root: slash(authority.paths.consumerRoot),
      marker: authority.refs.consumerMarker,
      profile: authority.refs.consumerProfile,
      actionBindingManifest: runtimeBindings.manifestRef,
    },
    universeHashes: authority.universeHashes,
    createdAt,
    transactionStatus: 'blocked',
    hostDirective: 'unresolved',
    executionDisposition: 'non_executable',
    blockingReasons: [blockingReason],
    failedPhase,
    outputs: {
      transactionManifestPath: slash(manifestPath),
      auditReceipt: {
        path: slash(auditReceiptPath),
        hashApplicability: 'downstream_external',
      },
    },
  };
  assertSchema(
    'requirements-contract-prompt-transaction-manifest.schema.json',
    manifest,
    'prompt_transaction_manifest'
  );
  const manifestWrite = writeGovernedText(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  writeGovernedJson(auditReceiptPath, {
    schemaVersion: 'requirements-contract-prompt-transaction-audit-receipt/v1',
    decision: 'BLOCK',
    transactionId: authority.identity.transactionId,
    requirementSetId: authority.identity.requirementSetId,
    implementationAttemptId: authority.identity.implementationAttemptId,
    blockingReasons: [blockingReason],
    failedPhase,
    promptTransaction: {
      manifestPath: slash(manifestPath),
      manifestHash: manifestWrite.targetRef.hash,
    },
    authorityPolicy: {
      executionAuthorityClaim: false,
      closeoutAuthorityClaim: false,
    },
    createdAt,
  });
}

export async function requirementsContractPromptTransactionPublishCommand(
  options: PromptTransactionPublishOptions,
  deps: PromptTransactionPublisherDeps = {}
): Promise<number> {
  let authority: PromptPublicationAuthority | null = null;
  let pointerPublication: CurrentDispatchPointerPublication | null = null;
  let lockHandle: PromptTransactionLockHandle | null = null;
  let runtimeBindings: RuntimeBindings | null = null;
  let publicationTouchedOutputs = false;
  let currentDispatchPointerPreimageHash: string | null = null;
  try {
    authority = resolvePromptPublicationAuthority(options);
    const sourcePrdLintTransition = validateSourcePrdLintTransitionFromFiles({
      transition: 'packet-dispatch',
      requirementRecordPath: authority.paths.requirementRecord,
      currentSourcePath: authority.paths.source,
    });
    if (sourcePrdLintTransition.decision === 'block') {
      throw new Error(
        `source_prd_lint_transition_blocked:${sourcePrdLintTransition.issueCodes.join(',')}`
      );
    }
    lockHandle = acquirePromptTransactionLock(
      {
        outDir: authority.paths.outDir,
        transactionId: authority.identity.transactionId,
      },
      deps.lockDeps
    );
    runtimeBindings = resolvePromptPublicationRuntimeBindings(authority);
    assertCurrentDispatchPointerReplaySafe(
      authority.paths.currentDispatchPointer,
      authority.identity.attemptSequence
    );
    currentDispatchPointerPreimageHash = fs.existsSync(authority.paths.currentDispatchPointer)
      ? fileHash(authority.paths.currentDispatchPointer)
      : null;
    const capabilityResult = (deps.spawn ?? spawnSync)(
      runtimeBindings.capabilityProbeArgv[0],
      runtimeBindings.capabilityProbeArgv.slice(1),
      {
        cwd: authority.paths.consumerRoot,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024,
      }
    );
    if ((capabilityResult.status ?? 1) !== 0) throw new Error('capability_probe_exit_nonzero');
    const capability = JSON.parse(capabilityResult.stdout ?? '') as JsonRecord;
    assertSchema(
      'requirements-contract-consumer-cli-capability.schema.json',
      capability,
      'capability_observation'
    );
    if (capability.executionHost !== authority.executionHost) {
      throw new Error('capability_execution_host_mismatch');
    }
    const capabilityObservation = {
      schemaVersion: 'requirements-contract-consumer-cli-capability-observation/v1',
      transactionId: authority.identity.transactionId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      executionHost: capability.executionHost,
      goalCommandAvailable: capability.goalCommandAvailable,
      installedCliRef: runtimeBindings.installedCliRef,
      capabilityProbeArgv: runtimeBindings.capabilityProbeArgv,
      capabilityProbeArgvHash: sha256(canonicalJson(runtimeBindings.capabilityProbeArgv)),
      exitCode: capabilityResult.status,
      stdoutHash: sha256(capabilityResult.stdout ?? ''),
      stderrHash: sha256(capabilityResult.stderr ?? ''),
      observedAt: (deps.now ?? (() => new Date().toISOString()))(),
      readbackVerified: true,
    };
    assertSchema(
      'requirements-contract-consumer-cli-capability-observation.schema.json',
      capabilityObservation,
      'capability_observation'
    );
    const capabilityPath = path.join(
      authority.paths.outDir,
      'observations',
      'consumer-cli-capability.json'
    );
    const capabilityWrite = writeGovernedJson(capabilityPath, capabilityObservation);
    const goalRequired = capability.goalCommandAvailable === true;
    const productionArgv = expectedProductionArgv(
      authority,
      runtimeBindings.installedGeneratorRef.path,
      goalRequired
    );
    const runnerRef = runtimeBindings.installedRunnerRef;
    publicationTouchedOutputs = true;
    const runResult = (deps.runCompiledPrompt ?? runMainAgentCompiledPrompt)({
      projectRoot: authority.cwd,
      recordPath: authority.paths.requirementRecord,
      sourcePath: authority.paths.source,
      packetId: authority.identity.implementationAttemptId,
      flow: authority.flow,
      executionHost: authority.executionHost,
      goalCommandAvailable: goalRequired ? 'true' : 'false',
      reqTraceSkillDir: runtimeBindings.reqTraceSkillDir,
      outDir: authority.paths.outDir,
      taskReportPath: authority.paths.taskReport,
      promptLanguage: 'auto',
      humanPromptProfile: 'full',
      ...authority.controlledExecutionContext,
    });
    assertRunnerResult(
      runResult,
      authority,
      productionArgv,
      runtimeBindings.installedGeneratorRef,
      runnerRef,
      goalRequired
    );
    assertExactRunnerOutputSet(authority.paths.outDir, goalRequired, lockHandle);
    const rawPacket = readJson(path.join(authority.paths.outDir, 'model_packet.json'));
    const rawPrompt = fs.readFileSync(path.join(authority.paths.outDir, 'human_prompt.txt'), 'utf8');
    const rawReceipt = readJson(path.join(authority.paths.outDir, 'audit_receipt.json'));
    const rawGoal = goalRequired
      ? fs.readFileSync(path.join(authority.paths.outDir, GOAL_OUTPUT), 'utf8')
      : null;
    if (fileHash(authority.paths.requirementRecord) !== authority.refs.requirementRecord.hash) {
      throw new Error('prompt_transaction_requirement_record_changed_during_compile');
    }
    const requirementRecordSnapshotWrite = writeGovernedJson(
      requirementRecordSnapshotPath(authority.paths.outDir),
      readJson(authority.paths.requirementRecord)
    );
    const frozenRequirementRecordRef = fileRef(
      requirementRecordSnapshotWrite.targetRef
    );
    const dispatchInputSetHash = sha256(
      canonicalJson({
        identity: authority.identity,
        requirementRecordRef: frozenRequirementRecordRef,
        attemptContextRef: authority.refs.attemptContext,
        sourceRef: {
          path: slash(authority.paths.source),
          sourceDocumentHash: authority.identity.sourceDocumentHash,
        },
        stageRegistryRef: authority.refs.stageRegistry,
        installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
        architectureAuthorityDecision: authority.architectureAuthorityDecision,
        confirmationReceiptRefs: {
          requirements: authority.refs.requirementsConfirmationReceipt,
          architecture: authority.refs.architectureConfirmationReceipt,
        },
        implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
        confirmationPageRefs: {
          requirements: authority.refs.requirementsConfirmationPage,
          architecture: authority.refs.architectureConfirmationPage,
        },
        consumerRef: {
          root: slash(authority.paths.consumerRoot),
          marker: authority.refs.consumerMarker,
          profile: authority.refs.consumerProfile,
          actionBindingManifest: runtimeBindings.manifestRef,
        },
        universeHashes: authority.universeHashes,
        capabilityObservationRef: capabilityWrite.targetRef,
      })
    );
    const projectedPacket = finalPacket(rawPacket, authority);
    assertNoAuthorityClaims(projectedPacket);
    const packetParity = auditModelPacketParity({
      sourcePath: authority.paths.source,
      packet: projectedPacket,
    });
    if (packetParity.reverseHashEdges.length > 0) {
      throw new Error(
        `prompt_transaction_reverse_hash_edge_detected:${packetParity.reverseHashEdges.join(',')}`
      );
    }
    if (packetParity.projectionDriftCount > 0) {
      throw new Error(
        `model_packet_parity_failed:${[
          ...packetParity.taskMismatches.map((item) => `task:${item}`),
          ...packetParity.acceptanceMismatches.map((item) => `acceptance:${item}`),
          ...packetParity.sourceObligationMismatches.map(
            (item) => `source_obligation:${item}`
          ),
          ...packetParity.commandMismatches.map((item) => `command:${item}`),
          ...packetParity.stopConditionMismatches.map(
            (item) => `stop_condition:${item}`
          ),
          ...packetParity.amendmentMismatches.map((item) => `amendment:${item}`),
        ].join(',')}`
      );
    }
    const packetWrite = writeGovernedJson(
      path.join(authority.paths.outDir, 'model_packet.json'),
      projectedPacket
    );
    const humanWrite = writeGovernedText(
      path.join(authority.paths.outDir, 'human_prompt.txt'),
      finalHumanPrompt(rawPrompt)
    );
    const goalWrite = goalRequired
      ? writeGovernedText(path.join(authority.paths.outDir, GOAL_OUTPUT), rawGoal as string)
      : null;
    const createdAt = (deps.now ?? (() => new Date().toISOString()))();
    const manifestPath = path.join(authority.paths.outDir, 'transaction-manifest.json');
    const auditReceiptPath = path.join(authority.paths.outDir, 'audit_receipt.json');
    const outputs: JsonRecord = {
      modelPacket: fileRef(packetWrite.targetRef),
      transactionManifestPath: slash(manifestPath),
      auditReceipt: {
        path: slash(auditReceiptPath),
        hashApplicability: 'downstream_external',
      },
      humanPrompt: fileRef(humanWrite.targetRef),
    };
    if (goalWrite) outputs.goalExecution = fileRef(goalWrite.targetRef);
    const manifest = {
      schemaVersion: MANIFEST_SCHEMA_VERSION,
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      attemptSequence: authority.identity.attemptSequence,
      sourceHash: authority.identity.sourceDocumentHash,
      sourceAmendmentHashes: authority.identity.sourceAmendmentHashes,
      semanticModelHash: authority.identity.semanticModelHash,
      contractHash: authority.identity.contractHash,
      dispatchInputSetHash,
      requirementRecordRef: frozenRequirementRecordRef,
      attemptContextRef: authority.refs.attemptContext,
      sourceRef: {
        path: slash(authority.paths.source),
        sourceDocumentHash: authority.identity.sourceDocumentHash,
      },
      stageRegistryRef: authority.refs.stageRegistry,
      installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
      architectureAuthorityDecision: authority.architectureAuthorityDecision,
      confirmationReceiptRefs: {
        requirements: authority.refs.requirementsConfirmationReceipt,
        architecture: authority.refs.architectureConfirmationReceipt,
      },
      implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
      confirmationPageRefs: {
        requirements: authority.refs.requirementsConfirmationPage,
        architecture: authority.refs.architectureConfirmationPage,
      },
      consumerRef: {
        consumerId: authority.consumerProfile.consumerId,
        root: slash(authority.paths.consumerRoot),
        marker: authority.refs.consumerMarker,
        profile: authority.refs.consumerProfile,
        actionBindingManifest: runtimeBindings.manifestRef,
      },
      universeHashes: authority.universeHashes,
      capabilityObservationRef: capabilityWrite.targetRef,
      generatorRef: runtimeBindings.installedGeneratorRef,
      runnerRef,
      executionReceipt: runResult.executionReceipt,
      productionArgv,
      productionArgvHash: sha256(canonicalJson(productionArgv)),
      createdAt,
      transactionStatus: 'pass',
      hostDirective: goalRequired ? 'native_goal_document_ref' : 'direct_prompt',
      executionDisposition: 'executable',
      outputs,
    };
    assertSchema(
      'requirements-contract-prompt-transaction-manifest.schema.json',
      manifest,
      'prompt_transaction_manifest'
    );
    const manifestWrite = writeGovernedText(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`
    );
    const auditReceipt = {
      schemaVersion: 'requirements-contract-prompt-transaction-audit-receipt/v1',
      decision: 'PASS',
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      promptTransaction: {
        manifestPath: slash(manifestPath),
        manifestHash: manifestWrite.targetRef.hash,
        modelPacketHash: packetWrite.targetRef.hash,
        humanPromptHash: humanWrite.targetRef.hash,
        goalExecutionHash: goalWrite?.targetRef.hash ?? null,
      },
      authorityPolicy: {
        executionAuthorityClaim: false,
        closeoutAuthorityClaim: false,
      },
      generatorAudit: rawReceipt,
      createdAt,
    };
    const auditWrite = writeGovernedJson(auditReceiptPath, auditReceipt);
    const outputWrites = [
      ['model_packet.json', packetWrite],
      ['transaction-manifest.json', manifestWrite],
      ['audit_receipt.json', auditWrite],
      ['human_prompt.txt', humanWrite],
      ...(goalWrite ? ([[GOAL_OUTPUT, goalWrite]] as Array<[string, WriteResult]>) : []),
    ] as Array<[string, WriteResult]>;
    const outputSetExpected = goalRequired ? [...ALL_OUTPUTS] : [...ALWAYS_OUTPUTS];
    const outputSetObserved = ALL_OUTPUTS.filter((name) =>
      fs.existsSync(path.join(authority!.paths.outDir, name))
    );
    if (canonicalJson(outputSetObserved) !== canonicalJson(outputSetExpected)) {
      throw new Error('prompt_transaction_output_set_mismatch');
    }
    const pointer = {
      schemaVersion: 'requirements-contract-current-dispatch-pointer/v1',
      producer: 'requirements-contract-current-dispatch-pointer',
      action: ACTION,
      contractHash: authority.identity.contractHash,
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      attemptSequence: authority.identity.attemptSequence,
      packetId: authority.identity.implementationAttemptId,
      dispatchInputSetHash,
      requirementRecordRef: frozenRequirementRecordRef,
      attemptContextRef: authority.refs.attemptContext,
      sourceRef: {
        path: slash(authority.paths.source),
        sourceDocumentHash: authority.identity.sourceDocumentHash,
      },
      sourceDocumentHash: authority.identity.sourceDocumentHash,
      sourceAmendmentHashes: authority.identity.sourceAmendmentHashes,
      semanticModelHash: authority.identity.semanticModelHash,
      stageRegistryRef: authority.refs.stageRegistry,
      installedStageRegistryRef: runtimeBindings.installedStageRegistryRef,
      architectureAuthorityDecision: authority.architectureAuthorityDecision,
      confirmationReceiptRefs: {
        requirements: authority.refs.requirementsConfirmationReceipt,
        architecture: authority.refs.architectureConfirmationReceipt,
      },
      implementationReadinessReceiptRef: authority.refs.implementationReadinessReceipt,
      confirmationPageRefs: {
        requirements: authority.refs.requirementsConfirmationPage,
        architecture: authority.refs.architectureConfirmationPage,
      },
      consumerRef: {
        consumerId: authority.consumerProfile.consumerId,
        root: slash(authority.paths.consumerRoot),
        marker: authority.refs.consumerMarker,
        profile: authority.refs.consumerProfile,
      },
      universeHashes: authority.universeHashes,
      packageRuntimeActionBindingManifestRef: runtimeBindings.manifestRef,
      transactionManifestRef: manifestWrite.targetRef,
      modelPacketRef: packetWrite.targetRef,
      auditReceiptRef: auditWrite.targetRef,
      humanPromptRef: humanWrite.targetRef,
      goalExecutionRef: goalWrite?.targetRef ?? null,
      capabilityObservationRef: capabilityWrite.targetRef,
      activationState: 'active',
      decision: 'PASS',
      selectionMetrics: {
        directoryScanCount: 0,
        newestFileSelectionCount: 0,
        historicalFallbackCount: 0,
        missingBindingCount: 0,
        replayRejectedCount: 0,
        casMismatchCount: 0,
        currentDispatchPointerCoverage: 1,
      },
      supersededPointerRef: null,
      createdAt,
    };
    pointerPublication = publishCurrentDispatchPointer({
      authorityRoot: authority.cwd,
      targetPath: authority.paths.currentDispatchPointer,
      expectedPreimageHash: currentDispatchPointerPreimageHash,
      pointer,
    });
    const safeWriteReceiptRefs = outputWrites.map(([, write]) => write.receiptRef);
    const outputReadbacks = outputWrites.map(([, write]) => write.targetRef);
    const evidence = {
      schemaVersion: 'requirements-contract-g09-prompt-transaction-evidence/v1',
      evidenceId: 'EVD-09',
      producer: 'requirements-contract-prompt-transaction-publisher',
      action: ACTION,
      decision: 'PASS',
      contractHash: authority.identity.contractHash,
      transactionId: authority.identity.transactionId,
      requirementSetId: authority.identity.requirementSetId,
      implementationAttemptId: authority.identity.implementationAttemptId,
      dispatchInputSetHash,
      modelPacketPath: packetWrite.targetRef.path,
      modelPacketHash: packetWrite.targetRef.hash,
      transactionManifestPath: manifestWrite.targetRef.path,
      generationReceiptPath: auditWrite.targetRef.path,
      generationReceiptHash: auditWrite.targetRef.hash,
      humanPromptPath: humanWrite.targetRef.path,
      humanPromptHash: humanWrite.targetRef.hash,
      goalExecutionApplicability: goalRequired ? 'required' : 'not_applicable',
      goalExecutionPath: goalWrite?.targetRef.path ?? null,
      goalExecutionHash: goalWrite?.targetRef.hash ?? null,
      productionArgv,
      productionArgvHash: manifest.productionArgvHash,
      resolvedGeneratorPath: runtimeBindings.installedGeneratorRef.path,
      resolvedGeneratorHash: runtimeBindings.installedGeneratorRef.hash,
      resolvedRunnerPath: runnerRef.path,
      resolvedRunnerHash: runnerRef.hash,
      outputSetExpected,
      outputSetObserved,
      promptTransactionOutputSetMismatchCount: 0,
      promptTransactionArgvMismatchCount: 0,
      promptTransactionReverseHashEdgeCount: packetParity.reverseHashEdges.length,
      safeWriteReceiptRefs,
      modelPacketProjectionDriftCount: packetParity.projectionDriftCount,
      modelPacketAuthorityClaimCount: 0,
      modelPacketTaskParityCount: packetParity.taskMismatches.length,
      modelPacketAcceptanceParityCount: packetParity.acceptanceMismatches.length,
      modelPacketSourceObligationParityCount:
        packetParity.sourceObligationMismatches.length,
      modelPacketCommandParityCount: packetParity.commandMismatches.length,
      modelPacketStopConditionParityCount: packetParity.stopConditionMismatches.length,
      modelPacketAmendmentParityCount: packetParity.amendmentMismatches.length,
      promptTransactionLockPath: slash(
        path.join(authority.paths.outDir, '.prompt-transaction.lock')
      ),
      promptTransactionLockViolationCount: 0,
      promptTransactionStaleLockRecoveryCases: staleLockRecoveryCases(
        authority.paths.outDir,
        lockHandle
      ),
      promptTransactionStaleLockRecoveryMismatchCount: 0,
      promptTransactionQuarantineRoot: slash(path.join(authority.paths.outDir, '.quarantine')),
      promptTransactionQuarantineCases: [],
      promptTransactionOrphanTransientCount: 0,
      promptTransactionTransientActiveReadCount: 0,
      transactionManifestHash: manifestWrite.targetRef.hash,
      sourceHashBinding: {
        path: slash(authority.paths.source),
        sourceDocumentHash: authority.identity.sourceDocumentHash,
        requirementRecordRef: frozenRequirementRecordRef,
      },
      sourceAmendmentHashBindings: authority.identity.sourceAmendmentHashes,
      atomicPromotionCases: outputWrites.map(([name, write]) => outputWriteCase(name, write)),
      blockedReplayCases: [],
      concurrencyCases: [],
      autoCommitDefault: false,
      commandRunRef: {
        path: null,
        hash: null,
        hashApplicability: 'downstream_external',
      },
      transactionManifestRef: manifestWrite.targetRef,
      currentDispatchPointerRef: pointerPublication.pointerRef,
      capabilityObservationRef: capabilityWrite.targetRef,
      outputReadbacks,
      createdAt,
    };
    assertSchema(
      'requirements-contract-g09-prompt-transaction-evidence.schema.json',
      evidence,
      'g09_prompt_transaction_evidence'
    );
    writeGovernedJson(authority.paths.evidenceOut, evidence);
    releasePromptTransactionLock(lockHandle);
    lockHandle = null;
    if (options.json) process.stdout.write(`${JSON.stringify(evidence)}\n`);
    return 0;
  } catch (error) {
    let blockingReason = error instanceof Error ? error.message : String(error);
    const requiresPreLockInvalidation =
      !authority ||
      (authority !== null &&
        lockHandle === null &&
        blockingReason.startsWith('source_prd_lint_transition_blocked:'));
    if (requiresPreLockInvalidation) {
      try {
        invalidateExistingTransactionAfterAuthorityFailure(
          options,
          blockingReason,
          (deps.now ?? (() => new Date().toISOString()))(),
          deps.lockDeps
        );
      } catch (sanitizationError) {
        blockingReason = `${blockingReason};authority_resolution_sanitization_failed:${
          sanitizationError instanceof Error
            ? sanitizationError.message
            : String(sanitizationError)
        }`;
      }
    }
    if (authority) {
      const isMatchingPointerReplay =
        blockingReason === 'current_dispatch_pointer_replay_rejected' &&
        runtimeBindings !== null &&
        matchingReplayPointer(authority) !== null;
      const canPublishBlockedTransaction =
        blockingReason !== 'current_dispatch_pointer_replay_rejected' ||
        isMatchingPointerReplay;
      if (pointerPublication) {
        rollbackCurrentDispatchPointer(authority.paths.currentDispatchPointer, pointerPublication);
        pointerPublication = null;
      }
      if (runtimeBindings && lockHandle && canPublishBlockedTransaction) {
        const pointerCandidates = isMatchingPointerReplay
          ? [
              authority.paths.currentDispatchPointer,
              `${authority.paths.currentDispatchPointer}.safe-write-receipt.json`,
            ]
          : [];
        removePublicationEvidence(authority);
        quarantineExecutableOutputs(
          authority.paths.outDir,
          authority.identity.transactionId,
          pointerCandidates
        );
        publishBlockedTransaction(
          authority,
          runtimeBindings,
          blockingReason,
          isMatchingPointerReplay ? 'pointer_replay_preflight' : 'production_publication',
          (deps.now ?? (() => new Date().toISOString()))()
        );
        publicationTouchedOutputs = false;
      }
      if (lockHandle) {
        releasePromptTransactionLock(lockHandle);
        lockHandle = null;
      }
      if (publicationTouchedOutputs) {
        removePublicationEvidence(authority);
        quarantineExecutableOutputs(
          authority.paths.outDir,
          authority.identity.transactionId
        );
      }
    }
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({
          action: ACTION,
          decision: 'BLOCK',
          error: blockingReason,
        })}\n`
      );
    }
    return 1;
  }
}
