import * as fs from 'node:fs';
import * as path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type { OrchestrationFlow } from './orchestration-dispatch-contract';
import { REQUIREMENTS_CONTRACT_DISPATCH_HOST_REGISTRY } from './requirements-contract-stage-registry';
import { fileHash, slash } from './requirements-contract-governed-write';

// Runtime schemas validate these records before authority resolution consumes them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

export interface PromptTransactionPublishOptions {
  cwd: string;
  requirementRecord: string;
  outDir: string;
  promptLanguage: string;
  humanPromptProfile: string;
  packetId: string;
  taskReportPath: string;
  attemptContext: string;
  stageRegistry: string;
  requirementsConfirmationReceipt: string;
  architectureConfirmationReceipt: string;
  consumerRoot: string;
  currentDispatchPointer: string;
  evidenceOut: string;
  json?: boolean;
}

export interface PromptPublicationAuthority {
  cwd: string;
  identity: {
    contractHash: string;
    transactionId: string;
    requirementSetId: string;
    implementationAttemptId: string;
    attemptSequence: number;
    sourceDocumentHash: string;
    implementationConfirmationHash: string;
    semanticModelHash: string;
    sourceAmendmentHashes: string[];
  };
  controlledExecutionContext: {
    requirementSetId: string;
    transactionId: string;
    implementationAttemptId: string;
    architectureAuditAttemptId: string;
    activePhaseAuditAttemptId: string;
    contractHash: string;
    inputSnapshotHash: string;
    commandCwd: string;
    commandReceiptRoot: string;
  };
  flow: OrchestrationFlow;
  executionHost: 'codex' | 'claude-code' | 'cursor-ide' | 'cursor-cli' | 'generic';
  paths: {
    requirementRecord: string;
    source: string;
    outDir: string;
    taskReport: string;
    attemptContext: string;
    stageRegistry: string;
    requirementsConfirmationReceipt: string;
    architectureConfirmationReceipt: string;
    consumerRoot: string;
    consumerMarker: string;
    consumerProfile: string;
    currentDispatchPointer: string;
    evidenceOut: string;
  };
  refs: {
    requirementRecord: { path: string; hash: string };
    attemptContext: { path: string; hash: string };
    stageRegistry: { path: string; hash: string };
    requirementsConfirmationReceipt: { path: string; hash: string };
    architectureConfirmationReceipt: { path: string; hash: string };
    requirementsConfirmationPage: { path: string; hash: string };
    architectureConfirmationPage: { path: string; hash: string };
    consumerMarker: { path: string; hash: string };
    consumerProfile: { path: string; hash: string };
    packageRuntimeActionBindingManifest: { path: string; hash: string };
  };
  universeHashes: JsonRecord;
  consumerMarker: JsonRecord;
  consumerProfile: JsonRecord;
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const FORBIDDEN_MATRIX_KEYS = new Set([
  'stagefivestarmatrixhash',
  'fivestarmatrixhash',
  'stagematrixhash',
]);

function object(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readJson(filePath: string): JsonRecord {
  return object(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function normalizedPath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePath(left: string, right: string): boolean {
  return normalizedPath(left) === normalizedPath(right);
}

function resolveFile(cwd: string, supplied: string, label: string): string {
  const resolved = path.resolve(cwd, supplied);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    throw new Error(`${label}_missing:${slash(resolved)}`);
  }
  if (!stat.isFile()) throw new Error(`${label}_not_regular_file:${slash(resolved)}`);
  return resolved;
}

function schemaValidator(schemaName: string) {
  const schemaPath = path.resolve(__dirname, '..', 'schemas', schemaName);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

function assertSchema(schemaName: string, value: unknown, label: string): void {
  const validate = schemaValidator(schemaName);
  if (!validate(value)) {
    throw new Error(`${label}_schema_invalid:${JSON.stringify(validate.errors ?? [])}`);
  }
}

function assertHash(value: unknown, label: string): string {
  const candidate = text(value);
  if (!HASH_PATTERN.test(candidate)) throw new Error(`${label}_invalid`);
  return candidate;
}

function assertNoMatrixInput(value: unknown, prefix = 'input'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoMatrixInput(item, `${prefix}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value as JsonRecord)) {
    const normalized = key.replace(/[^A-Za-z0-9]/gu, '').toLowerCase();
    if (FORBIDDEN_MATRIX_KEYS.has(normalized)) {
      throw new Error(`stage_five_star_matrix_input_forbidden:${prefix}.${key}`);
    }
    assertNoMatrixInput(child, `${prefix}.${key}`);
  }
}

function fileRef(cwd: string, refValue: unknown, label: string) {
  const ref = object(refValue);
  const resolved = resolveFile(cwd, text(ref.path), `${label}_path`);
  const expectedHash = assertHash(ref.hash, `${label}_hash`);
  const actualHash = fileHash(resolved);
  if (actualHash !== expectedHash) throw new Error(`${label}_hash_mismatch`);
  return { path: slash(resolved), hash: actualHash };
}

function assertRefMatches(ref: { path: string; hash: string }, expectedPath: string, label: string) {
  if (!samePath(ref.path, expectedPath)) throw new Error(`${label}_path_mismatch`);
}

function assertReceiptIdentity(
  receipt: JsonRecord,
  kind: 'requirements' | 'architecture',
  identity: PromptPublicationAuthority['identity'],
  cwd: string
): { path: string; hash: string } {
  assertSchema(
    'requirements-contract-confirmation-receipt.schema.json',
    receipt,
    `${kind}_confirmation_receipt`
  );
  if (
    receipt.confirmationKind !== kind ||
    receipt.transactionId !== identity.transactionId ||
    receipt.requirementSetId !== identity.requirementSetId ||
    receipt.implementationAttemptId !== identity.implementationAttemptId ||
    receipt.sourceDocumentHash !== identity.sourceDocumentHash ||
    receipt.semanticModelHash !== identity.semanticModelHash
  ) {
    throw new Error(`${kind}_confirmation_receipt_identity_mismatch`);
  }
  return fileRef(cwd, receipt.pageRef, `${kind}_confirmation_page`);
}

function assertContained(root: string, target: string, label: string): void {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(target);
  if (
    resolvedTarget === resolvedRoot ||
    !normalizedPath(resolvedTarget).startsWith(`${normalizedPath(resolvedRoot)}${path.sep}`)
  ) {
    throw new Error(`${label}_outside_consumer_root`);
  }
}

export function resolvePromptPublicationAuthority(
  options: PromptTransactionPublishOptions
): PromptPublicationAuthority {
  const cwd = path.resolve(options.cwd);
  const recordPath = resolveFile(cwd, options.requirementRecord, 'requirement_record');
  const contextPath = resolveFile(cwd, options.attemptContext, 'attempt_context');
  const record = readJson(recordPath);
  const context = readJson(contextPath);
  assertNoMatrixInput(record, 'requirementRecord');
  assertNoMatrixInput(context, 'attemptContext');

  const requirementSetId = text(record.requirementSetId) || text(record.recordId);
  const implementationAttemptId =
    text(record.currentAttemptId) || text(record.implementationAttemptId) || text(record.runId);
  const identity = {
    contractHash: assertHash(context.contractHash, 'contract_hash'),
    transactionId: text(context.transactionId),
    requirementSetId,
    implementationAttemptId,
    attemptSequence: Number(context.attemptSequence),
    sourceDocumentHash: assertHash(record.sourceDocumentHash, 'source_document_hash'),
    implementationConfirmationHash: assertHash(
      record.implementationConfirmationHash,
      'implementation_confirmation_hash'
    ),
    semanticModelHash: assertHash(record.semanticModelHash, 'semantic_model_hash'),
    sourceAmendmentHashes: Array.isArray(record.sourceAmendmentHashes)
      ? record.sourceAmendmentHashes.map((value: unknown, index: number) =>
          assertHash(value, `source_amendment_hash_${index}`)
        )
      : [],
  };
  if (
    !identity.transactionId ||
    !identity.requirementSetId ||
    !identity.implementationAttemptId ||
    !Number.isInteger(identity.attemptSequence) ||
    identity.attemptSequence < 1 ||
    identity.sourceAmendmentHashes.length === 0
  ) {
    throw new Error('prompt_publication_identity_incomplete');
  }
  for (const key of [
    'transactionId',
    'requirementSetId',
    'implementationAttemptId',
    'sourceDocumentHash',
    'semanticModelHash',
  ] as const) {
    if (context[key] !== identity[key]) throw new Error(`attempt_context_${key}_mismatch`);
  }
  const architectureAuditAttemptId = text(context.architectureAuditAttemptId);
  if (!architectureAuditAttemptId) {
    throw new Error('attempt_context_architectureAuditAttemptId_missing');
  }
  const controlledExecutionContext = {
    requirementSetId: identity.requirementSetId,
    transactionId: identity.transactionId,
    implementationAttemptId: identity.implementationAttemptId,
    architectureAuditAttemptId,
    activePhaseAuditAttemptId: architectureAuditAttemptId,
    contractHash: identity.contractHash,
    inputSnapshotHash: fileHash(contextPath),
    commandCwd: cwd,
    commandReceiptRoot: path.join(
      cwd,
      'docs',
      'plans',
      'evidence',
      'loop-engineering-remediation',
      'command-runs',
      identity.transactionId,
      identity.implementationAttemptId,
      architectureAuditAttemptId
    ),
  };

  const sourcePath = resolveFile(cwd, text(record.sourcePath), 'resolved_source_prd');
  const expectedOutDir = path.join(
    path.dirname(recordPath),
    'trace-execution',
    identity.implementationAttemptId
  );
  const expectedTaskReport = path.join(
    cwd,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    identity.requirementSetId,
    `${identity.implementationAttemptId}.json`
  );
  if (
    !samePath(options.outDir, expectedOutDir) ||
    options.packetId !== identity.implementationAttemptId ||
    !samePath(options.taskReportPath, expectedTaskReport) ||
    options.promptLanguage !== 'auto' ||
    options.humanPromptProfile !== 'full'
  ) {
    throw new Error('caller_derived_prompt_parameter_mismatch');
  }

  const requirementsReceiptPath = resolveFile(
    cwd,
    options.requirementsConfirmationReceipt,
    'requirements_confirmation_receipt'
  );
  const architectureReceiptPath = resolveFile(
    cwd,
    options.architectureConfirmationReceipt,
    'architecture_confirmation_receipt'
  );
  const requirementsRef = fileRef(
    cwd,
    context.requirementsConfirmationReceiptRef,
    'attempt_requirements_confirmation_receipt'
  );
  const architectureRef = fileRef(
    cwd,
    context.architectureConfirmationReceiptRef,
    'attempt_architecture_confirmation_receipt'
  );
  assertRefMatches(requirementsRef, requirementsReceiptPath, 'requirements_confirmation_receipt');
  assertRefMatches(architectureRef, architectureReceiptPath, 'architecture_confirmation_receipt');
  const requirementsPageRef = assertReceiptIdentity(
    readJson(requirementsReceiptPath),
    'requirements',
    identity,
    cwd
  );
  const architecturePageRef = assertReceiptIdentity(
    readJson(architectureReceiptPath),
    'architecture',
    identity,
    cwd
  );

  const consumerRoot = path.resolve(cwd, options.consumerRoot);
  if (!fs.statSync(consumerRoot).isDirectory()) throw new Error('consumer_root_not_directory');
  const markerRef = fileRef(cwd, context.consumerMarkerRef, 'consumer_marker');
  const profileRef = fileRef(cwd, context.consumerProjectProfileRef, 'consumer_project_profile');
  const markerPath = path.join(consumerRoot, 'bmad-speckit-consumer-project.json');
  const profilePath = path.join(
    consumerRoot,
    '_bmad-output',
    'runtime',
    'context',
    'consumer-project-profile.json'
  );
  assertRefMatches(markerRef, markerPath, 'consumer_marker');
  assertRefMatches(profileRef, profilePath, 'consumer_project_profile');
  const consumerMarker = readJson(markerPath);
  const consumerProfile = readJson(profilePath);
  assertNoMatrixInput(consumerProfile, 'consumerProjectProfile');
  assertSchema(
    'requirements-contract-consumer-project-profile.schema.json',
    consumerProfile,
    'consumer_project_profile'
  );
  if (
    consumerMarker.schemaVersion !== 'bmad-speckit-consumer-project/v1' ||
    consumerMarker.projectName !== consumerProfile.projectName
  ) {
    throw new Error('consumer_identity_mismatch');
  }
  const host = REQUIREMENTS_CONTRACT_DISPATCH_HOST_REGISTRY.find(
    (entry) => entry.entryId === consumerProfile.hostRegistryEntryId
  );
  if (!host || host.executionHost !== consumerProfile.executionHost) {
    throw new Error('consumer_host_registry_mismatch');
  }
  const probeArtifactRef = fileRef(
    cwd,
    consumerProfile.capabilityProbeArtifactRef,
    'consumer_capability_probe_artifact'
  );
  assertContained(consumerRoot, probeArtifactRef.path, 'consumer_capability_probe_artifact');
  if (
    !Array.isArray(consumerProfile.capabilityProbeArgv) ||
    !consumerProfile.capabilityProbeArgv.some((value: unknown) =>
      samePath(text(value), probeArtifactRef.path)
    )
  ) {
    throw new Error('consumer_capability_probe_artifact_not_in_argv');
  }
  const actionBindingManifestRef = fileRef(
    cwd,
    consumerProfile.packageRuntimeActionBindingManifestRef,
    'package_runtime_action_binding_manifest'
  );
  assertContained(
    consumerRoot,
    actionBindingManifestRef.path,
    'package_runtime_action_binding_manifest'
  );

  const stageRegistryPath = resolveFile(cwd, options.stageRegistry, 'stage_registry');
  if (!/^requirements-contract-stage-registry\.(?:ts|js)$/u.test(path.basename(stageRegistryPath))) {
    throw new Error('stage_registry_identity_mismatch');
  }
  const universeHashes = object(context.universeHashes);
  if (
    Object.keys(universeHashes).length === 0 ||
    Object.values(universeHashes).some((value) => !HASH_PATTERN.test(text(value)))
  ) {
    throw new Error('attempt_universe_hashes_invalid');
  }

  return {
    cwd,
    identity,
    controlledExecutionContext,
    flow: (text(record.flow) || text(record.entryFlow) || 'standalone_tasks') as OrchestrationFlow,
    executionHost: consumerProfile.executionHost,
    paths: {
      requirementRecord: recordPath,
      source: sourcePath,
      outDir: path.resolve(expectedOutDir),
      taskReport: path.resolve(expectedTaskReport),
      attemptContext: contextPath,
      stageRegistry: stageRegistryPath,
      requirementsConfirmationReceipt: requirementsReceiptPath,
      architectureConfirmationReceipt: architectureReceiptPath,
      consumerRoot,
      consumerMarker: markerPath,
      consumerProfile: profilePath,
      currentDispatchPointer: path.resolve(cwd, options.currentDispatchPointer),
      evidenceOut: path.resolve(cwd, options.evidenceOut),
    },
    refs: {
      requirementRecord: { path: slash(recordPath), hash: fileHash(recordPath) },
      attemptContext: { path: slash(contextPath), hash: fileHash(contextPath) },
      stageRegistry: { path: slash(stageRegistryPath), hash: fileHash(stageRegistryPath) },
      requirementsConfirmationReceipt: requirementsRef,
      architectureConfirmationReceipt: architectureRef,
      requirementsConfirmationPage: requirementsPageRef,
      architectureConfirmationPage: architecturePageRef,
      consumerMarker: markerRef,
      consumerProfile: profileRef,
      packageRuntimeActionBindingManifest: actionBindingManifestRef,
    },
    universeHashes,
    consumerMarker,
    consumerProfile,
  };
}
