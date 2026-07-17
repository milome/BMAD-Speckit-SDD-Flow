import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const SCHEMA_DIRECTORY = path.resolve(__dirname, '..', 'schemas');
const RECOVERY_LINEAGE_SCHEMA = 'requirements-contract-recovery-lineage-receipt.schema.json';
const CONTROLLED_COMMAND_SCHEMA =
  'requirements-contract-controlled-command-receipt.schema.json';
const FINALIZATION_RECEIPT_SCHEMA =
  'requirements-contract-recovery-finalization-receipt.schema.json';
const STATE_DECISION_SCHEMA =
  'requirements-contract-recovery-finalization-state-decision-receipt.schema.json';

export interface RecoveryBootstrapOptions {
  cwd: string;
  contract: string;
  authority: string;
  architectureAuthority: string;
  attemptContext: string;
  qualifiedRedReceipt: string;
  consumerRoot: string;
  createIfAbsent: boolean;
  initialPublicationReceipt: string;
  out: string;
  json: boolean;
}

export interface RecoveryFinalizationOptions {
  cwd: string;
  contract: string;
  authority: string;
  architectureAuthority: string;
  attemptContext: string;
  recovery: string;
  initialPublicationReceipt: string;
  target: string;
  expectedTargetPreimageHash: string;
  qualifiedRedReceipt: string;
  commandReceipts: string[];
  expectedProvisionalHash: string;
  commandRunId: string;
  invocationSequence: number;
  finalizationRunId: string;
  transactionRoot: string;
  failureRoot: string;
  finalizationReceipt: string;
  json: boolean;
}

type JsonRecord = Record<string, any>;
type PathHash = { path: string; hash: string };

function sha256(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function fileHash(filePath: string): string {
  return sha256(readFileSync(filePath));
}

function commandIdFromHashBoundReceipt(
  cwd: string,
  receiptRef: JsonRecord,
  identity: {
    transactionId: string;
    implementationAttemptId: string;
    architectureAuditAttemptId: string;
    contractHash: string;
    inputSnapshotHash?: string;
  }
): string {
  if (typeof receiptRef?.path !== 'string' || typeof receiptRef?.hash !== 'string') {
    throw new Error('command receipt ref is incomplete');
  }
  const receiptPath = path.resolve(cwd, receiptRef.path);
  if (!existsSync(receiptPath) || fileHash(receiptPath) !== receiptRef.hash) {
    throw new Error(`command receipt ref hash mismatch: ${receiptRef.path}`);
  }
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  for (const key of [
    'transactionId',
    'implementationAttemptId',
    'architectureAuditAttemptId',
  ] as const) {
    if (receipt[key] !== identity[key]) throw new Error(`command receipt ${key} mismatch`);
  }
  if (receipt.contractHash !== identity.contractHash)
    throw new Error('command receipt contract hash mismatch');
  if (identity.inputSnapshotHash && receipt.inputSnapshotHash !== identity.inputSnapshotHash) {
    throw new Error('command receipt input snapshot hash mismatch');
  }
  const validate = schemaValidator(CONTROLLED_COMMAND_SCHEMA);
  if (!validate(receipt)) {
    throw new Error(`command receipt schema invalid: ${JSON.stringify(validate.errors)}`);
  }
  const commandId = String(receipt.commandId || '');
  if (!/^CMD-\d+$/u.test(commandId)) throw new Error('command receipt identity is invalid');
  return commandId;
}

function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function runGit(cwd: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function writeUtf8(filePath: string, value: unknown): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function atomicWriteJson(filePath: string, value: unknown): void {
  if (existsSync(filePath)) throw new Error(`refusing to overwrite existing artifact: ${filePath}`);
  const draft = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeUtf8(draft, value);
  renameSync(draft, filePath);
}

function renameWithRetry(source: string, target: string, maxAttempts = 20): void {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      renameSync(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if ((code === 'EPERM' || code === 'EBUSY') && attempt < maxAttempts - 1) {
        const delayMs = Math.min(50 * 1.5 ** attempt, 1000);
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
        continue;
      }
      throw error;
    }
  }
}

function safeReplaceJson(filePath: string, value: unknown) {
  if (!existsSync(filePath)) throw new Error(`replace target is absent: ${filePath}`);
  const backupPath = `${filePath}.backup-${process.pid}-${Date.now()}`;
  const draft = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const originalHash = fileHash(filePath);
  copyFileSync(filePath, backupPath);
  writeUtf8(draft, value);
  const tempHash = fileHash(draft);
  renameSync(draft, filePath);
  const finalHash = fileHash(filePath);
  if (finalHash !== tempHash) throw new Error('safe replacement hash mismatch');
  return {
    schemaVersion: 'requirements-contract-recovery-safe-write/v1',
    targetPath: filePath,
    mode: 'replace',
    tempPath: draft,
    tempHash,
    backupPath,
    originalHash,
    backupHash: fileHash(backupPath),
    finalHash,
    writtenAt: new Date().toISOString(),
  };
}

function consumerFileIndex(
  root: string
): Array<{ mode: string; blob: string; path: string }> {
  return runGit(root, ['ls-files', '--stage'])
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+) ([a-f0-9]{40}) 0\t(.+)$/u);
      if (!match) throw new Error(`consumer tracked-file row is invalid: ${line}`);
      return {
        mode: match[1],
        blob: match[2],
        path: match[3].replace(/\\/gu, '/'),
      };
    });
}

function verifyConsumer(
  root: string,
  expected: JsonRecord,
  existsBefore: boolean,
  partialCreationRecovery: string
) {
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const marker = JSON.parse(
    readFileSync(path.join(root, 'bmad-speckit-consumer-project.json'), 'utf8')
  );
  if (
    packageJson.name !== expected.projectName ||
    marker.projectName !== expected.projectName ||
    marker.schemaVersion !== expected.markerSchemaVersion
  ) {
    throw new Error(`consumer identity mismatch at ${root}`);
  }
  const repositoryRoot = path.resolve(runGit(root, ['rev-parse', '--show-toplevel']));
  if (repositoryRoot !== path.resolve(root)) throw new Error(`consumer Git root mismatch: ${root}`);
  const clean =
    runGit(root, [
      'status',
      '--porcelain=v1',
      '--untracked-files=all',
      '--ignored',
      '--ignore-submodules=none',
    ]) === '';
  if (!clean) throw new Error(`consumer root is not clean: ${root}`);
  const markerHash = fileHash(path.join(root, 'bmad-speckit-consumer-project.json'));
  const packageHash = fileHash(path.join(root, 'package.json'));
  const baselineCommit = runGit(root, ['rev-parse', 'HEAD']);
  const baselineTree = runGit(root, ['rev-parse', 'HEAD^{tree}']);
  const branch = runGit(root, ['branch', '--show-current']);
  const remotes = runGit(root, ['remote']).split('\n').filter(Boolean);
  const gitUserName = runGit(root, ['config', '--local', 'user.name']);
  const gitUserEmail = runGit(root, ['config', '--local', 'user.email']);
  const commitSubject = runGit(root, ['show', '-s', '--format=%s', 'HEAD']);
  const authorTimestamp = runGit(root, ['show', '-s', '--format=%aI', 'HEAD']);
  const committerTimestamp = runGit(root, ['show', '-s', '--format=%cI', 'HEAD']);
  const submodules = runGit(root, ['submodule', 'status', '--recursive']);
  const trackedFiles = consumerFileIndex(root);
  const trackedFileIndexCanonicalization =
    'mode + SP + gitBlob + SP + path, rows in git index order, LF separators, no trailing LF';
  const baselineFileIndexHash = sha256(
    trackedFiles.map((entry) => `${entry.mode} ${entry.blob} ${entry.path}`).join('\n')
  );
  if (
    marker.bootstrapId !== expected.bootstrapId ||
    markerHash !== expected.markerHash ||
    packageHash !== expected.packageHash ||
    baselineCommit !== expected.baselineCommit ||
    baselineTree !== expected.baselineTree ||
    branch !== expected.branch ||
    canonical(remotes) !== canonical(expected.remotes) ||
    gitUserName !== expected.gitUserName ||
    gitUserEmail !== expected.gitUserEmail ||
    commitSubject !== expected.commitSubject ||
    authorTimestamp !== expected.authorTimestamp ||
    committerTimestamp !== expected.committerTimestamp ||
    canonical(trackedFiles) !== canonical(expected.trackedFiles) ||
    trackedFileIndexCanonicalization !== expected.trackedFileIndexCanonicalization ||
    baselineFileIndexHash !== expected.baselineFileIndexHash ||
    submodules !== ''
  ) {
    throw new Error(`consumer baseline identity mismatch at ${root}`);
  }
  if (
    existsSync(path.join(root, 'node_modules')) ||
    existsSync(path.join(root, 'package-lock.json')) ||
    existsSync(path.join(root, 'npm-shrinkwrap.json'))
  ) {
    throw new Error(`consumer dependency state is not clean: ${root}`);
  }
  return {
    normalizedRoot: path.resolve(root),
    existsBefore,
    projectName: expected.projectName,
    markerSchemaVersion: expected.markerSchemaVersion,
    bootstrapId: marker.bootstrapId,
    markerHash,
    packageHash,
    repositoryRoot,
    clean,
    baselineCommit,
    baselineTree,
    branch,
    remotes,
    gitUserName,
    gitUserEmail,
    commitSubject,
    authorTimestamp,
    committerTimestamp,
    trackedFiles,
    trackedFileIndexCanonicalization,
    baselineFileIndexHash,
    partialCreationRecovery,
  };
}

function createOrVerifyConsumer(root: string, createIfAbsent: boolean, expected: JsonRecord) {
  const normalized = path.resolve(root);
  if (normalized !== path.resolve(expected.normalizedRoot)) {
    throw new Error(`consumer root is not authorized: ${normalized}`);
  }
  const existsBefore = existsSync(normalized);
  if (existsBefore !== expected.existsBefore) {
    throw new Error(`consumer pre-existence observation mismatch at ${normalized}`);
  }
  if (existsBefore) return verifyConsumer(normalized, expected, true, 'not_required');
  if (!createIfAbsent) throw new Error(`consumer root is absent: ${normalized}`);
  const parent = path.dirname(normalized);
  const bootstrapId = expected.bootstrapId;
  const staging = path.join(
    parent,
    `.${path.basename(normalized)}.staging-${Date.now()}-${process.pid}`
  );
  if (existsSync(staging)) throw new Error(`consumer staging path already exists: ${staging}`);
  mkdirSync(staging, { recursive: false });
  let promoted = false;
  try {
    writeUtf8(path.join(staging, 'package.json'), {
      name: expected.projectName,
      version: '0.0.0',
      private: true,
    });
    writeUtf8(path.join(staging, 'bmad-speckit-consumer-project.json'), {
      schemaVersion: expected.markerSchemaVersion,
      projectName: expected.projectName,
      bootstrapId,
    });
    runGit(staging, ['init', '--initial-branch=main']);
    runGit(staging, ['config', 'user.name', expected.gitUserName]);
    runGit(staging, ['config', 'user.email', expected.gitUserEmail]);
    runGit(staging, ['add', '--', 'package.json', 'bmad-speckit-consumer-project.json']);
    runGit(staging, ['commit', '-m', expected.commitSubject], {
      ...process.env,
      GIT_AUTHOR_DATE: expected.commitTimestamp,
      GIT_COMMITTER_DATE: expected.commitTimestamp,
    });
    verifyConsumer(staging, expected, false, 'not_required');
    renameWithRetry(staging, normalized);
    promoted = true;
    return verifyConsumer(normalized, expected, false, 'not_required');
  } catch (error) {
    const rollbackRoot = promoted ? normalized : staging;
    const markerPath = path.join(rollbackRoot, 'bmad-speckit-consumer-project.json');
    if (existsSync(markerPath)) {
      const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
      if (marker.bootstrapId === bootstrapId)
        rmSync(rollbackRoot, { recursive: true, force: true });
    }
    throw error;
  }
}

function revalidateConsumerObservation(
  root: string,
  expected: JsonRecord,
  priorObservation: JsonRecord
): JsonRecord {
  const current = verifyConsumer(
    path.resolve(root),
    expected,
    priorObservation.existsBefore,
    priorObservation.partialCreationRecovery
  );
  if (canonical(current) !== canonical(priorObservation)) {
    throw new Error(`consumer observation drifted at ${path.resolve(root)}`);
  }
  return current;
}

function removeUnpublishedBootstrapArtifacts(
  outputPath: string,
  publicationReceiptPath: string
): void {
  if (existsSync(outputPath)) rmSync(outputPath, { force: true });
  for (const artifactPath of [outputPath, publicationReceiptPath]) {
    const directory = path.dirname(artifactPath);
    if (!existsSync(directory)) continue;
    const draftPrefix = `${path.basename(artifactPath)}.tmp-${process.pid}-`;
    for (const entry of readdirSync(directory)) {
      if (entry.startsWith(draftPrefix)) {
        rmSync(path.join(directory, entry), { force: true });
      }
    }
  }
}

function currentCandidatePaths(cwd: string): string[] {
  const commands = [
    ['ls-files', '--modified', '--deleted', '--others', '--exclude-standard', '-z'],
    ['diff', '--cached', '--name-only', '-z'],
  ];
  const paths = new Set<string>();
  for (const args of commands) {
    const result = spawnSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(
        `git ${args.join(' ')} failed: ${result.error?.message ?? result.stderr.trim()}`
      );
    }
    for (const value of result.stdout.split('\0').filter(Boolean))
      paths.add(value.replace(/\\/gu, '/'));
  }
  return [...paths].sort();
}

function readJson(filePath: string): JsonRecord {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function repositoryPath(cwd: string, filePath: string): string {
  return path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/gu, '/');
}

function pathHash(cwd: string, filePath: string): PathHash {
  const absolute = path.resolve(cwd, filePath);
  return { path: repositoryPath(cwd, absolute), hash: fileHash(absolute) };
}

function schemaDocument(schemaName: string): JsonRecord {
  const schemaPath = path.join(SCHEMA_DIRECTORY, schemaName);
  if (!existsSync(schemaPath)) throw new Error(`recovery schema is absent: ${schemaName}`);
  return readJson(schemaPath);
}

function schemaValidator(schemaName: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schemaDocument(schemaName));
}

function recoverySchemaAuthority() {
  const schema = schemaDocument(RECOVERY_LINEAGE_SCHEMA);
  const transactionRoots = schema['x-transactionRoots'];
  const finalizationReceiptTarget = schema['x-finalizationReceiptTarget'];
  if (
    typeof transactionRoots?.transaction !== 'string' ||
    typeof transactionRoots?.failure !== 'string' ||
    typeof finalizationReceiptTarget?.path !== 'string' ||
    typeof finalizationReceiptTarget?.schemaVersion !== 'string'
  ) {
    throw new Error('recovery path authority is absent');
  }
  return {
    schema,
    transactionRoot: transactionRoots.transaction,
    failureRoot: transactionRoots.failure,
    finalizationReceiptTarget,
  };
}

function validateQualifiedRedReceipt(
  cwd: string,
  receiptPath: string,
  context: JsonRecord
): PathHash {
  const absolute = path.resolve(cwd, receiptPath);
  if (!existsSync(absolute)) throw new Error(`qualified RED receipt is absent: ${receiptPath}`);
  const receipt = readJson(absolute);
  const expected = {
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    redQualificationRunId: context.redQualificationRunId,
    contractHash: context.contractHash,
    predecessorContractHash: context.predecessorContractHash,
    predecessorFileSetManifestPath: context.predecessorFileSetManifest.path,
    predecessorFileSetManifestHash: context.predecessorFileSetManifest.hash,
    nestedExecutionManifestPath: context.nestedRedExecutionManifest.path,
    nestedExecutionManifestHash: context.nestedRedExecutionManifest.hash,
    testOverlayPath: context.redTestOverlay.path,
    testOverlayHash: context.redTestOverlay.hash,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (receipt[key] !== value) throw new Error(`qualified RED receipt ${key} mismatch`);
  }
  if (
    receipt.schemaVersion !== 'requirements-contract-qualified-red-receipt/v1' ||
    receipt.decision !== 'expected_red' ||
    receipt.passAuthority !== false ||
    receipt.targetAssertionReached !== true ||
    receipt.predecessorMismatchCount !== 0 ||
    receipt.zeroPredecessorProductionFileDrift !== true
  ) {
    throw new Error('qualified RED receipt decision is invalid');
  }
  const expectedPath = path.resolve(
    cwd,
    path.dirname(context.predecessorFileSetManifest.path),
    `${context.redQualificationRunId}.receipt.json`
  );
  if (expectedPath !== absolute) {
    throw new Error('qualified RED receipt path is not attempt-derived');
  }
  return pathHash(cwd, absolute);
}

function grandfatheredManifest(
  cwd: string,
  context: JsonRecord,
  qualifiedRedRef: string
): JsonRecord[] {
  const predecessorArtifact = readJson(path.resolve(cwd, context.recoveryTarget.path));
  const predecessor = new Map<string, JsonRecord>(
    (predecessorArtifact.grandfatheredCandidateManifest ?? []).map((entry: JsonRecord) => [
      entry.path,
      entry,
    ])
  );
  const recoverySchema = schemaDocument(RECOVERY_LINEAGE_SCHEMA);
  const ownerBindings = new Map<string, JsonRecord>(
    (recoverySchema['x-recoveryOwnerBindings'] ?? []).map((entry: JsonRecord) => [
      entry.path,
      entry,
    ])
  );
  const excludedPrefixes = (recoverySchema['x-excludedControlPathPrefixes'] ?? []).map(
    String
  );
  const manifest: JsonRecord[] = [];
  for (const candidatePath of currentCandidatePaths(cwd)) {
    if (excludedPrefixes.some((prefix: string) => candidatePath.startsWith(prefix))) continue;
    const before = predecessor.get(candidatePath);
    const binding = ownerBindings.get(candidatePath);
    if (!before && !binding) {
      throw new Error(`candidate path has no schema-owned recovery binding: ${candidatePath}`);
    }
    const absolute = path.join(cwd, candidatePath);
    const currentExists = existsSync(absolute) && statSync(absolute).isFile();
    const currentHash = currentExists ? fileHash(absolute) : null;
    const predecessorHash = before?.currentHash ?? before?.predecessorHash ?? null;
    const changeClass = !before
      ? 'new_current_candidate'
      : !currentExists
        ? 'deleted_predecessor_candidate'
        : predecessorHash === currentHash
          ? 'unchanged_predecessor_candidate'
          : 'changed_predecessor_candidate';
    manifest.push({
      path: candidatePath,
      predecessorExists: Boolean(before?.currentExists ?? before),
      predecessorHash,
      currentExists,
      currentHash,
      changeClass,
      targetRefs: binding?.targetRefs ?? before?.targetRefs,
      requirementRefs: binding?.sourceObligationRefs ?? before?.requirementRefs,
      acceptanceRefs: binding?.acceptanceRefs ?? before?.acceptanceRefs ?? [],
      traceRefs: binding?.traceRefs ?? before?.traceRefs ?? [],
      qualifiedRedRefs: binding ? [qualifiedRedRef] : before?.qualifiedRedRefs,
      verificationRefs: binding?.verificationRefs ?? before?.verificationRefs,
    });
  }
  if (manifest.length === 0) throw new Error('recovery candidate manifest is empty');
  return manifest.sort((left, right) => left.path.localeCompare(right.path));
}

export async function requirementsContractRecoveryBootstrapCommand(
  options: RecoveryBootstrapOptions
): Promise<number> {
  try {
    const cwd = path.resolve(options.cwd);
    const contract = path.resolve(cwd, options.contract);
    const authority = path.resolve(cwd, options.authority);
    const architectureAuthority = path.resolve(cwd, options.architectureAuthority);
    const attemptContextPath = path.resolve(cwd, options.attemptContext);
    const outputPath = path.resolve(cwd, options.out);
    const publicationReceiptPath = path.resolve(cwd, options.initialPublicationReceipt);
    if (existsSync(outputPath) || existsSync(publicationReceiptPath)) {
      throw new Error(`refusing to overwrite existing recovery artifact set: ${options.out}`);
    }
    const context = readJson(attemptContextPath);
    const recoveryAuthority = recoverySchemaAuthority();
    const expectedTransactionRoot = path.resolve(
      cwd,
      recoveryAuthority.transactionRoot,
      context.transactionId,
      context.implementationAttemptId,
      context.finalizationRunId
    );
    const expectedOutputPath = path.join(
      expectedTransactionRoot,
      'provisional',
      'recovery-lineage-receipt.json'
    );
    const expectedPublicationPath = path.join(
      expectedTransactionRoot,
      'provisional',
      'recovery-lineage-receipt.publication-receipt.json'
    );
    if (
      outputPath !== expectedOutputPath ||
      publicationReceiptPath !== expectedPublicationPath
    ) {
      throw new Error('provisional recovery paths are not attempt-derived');
    }
    const authorityBindings = context.authorityBindings ?? {};
    const primaryAuthority = authorityBindings.amend10;
    const architectureAuthorityBinding = authorityBindings.architectureWave;
    if (
      fileHash(contract) !== context.contractHash ||
      path.resolve(cwd, context.contractPath) !== contract ||
      !primaryAuthority ||
      path.resolve(cwd, primaryAuthority.path) !== authority ||
      fileHash(authority) !== primaryAuthority.hash ||
      !architectureAuthorityBinding ||
      path.resolve(cwd, architectureAuthorityBinding.path) !== architectureAuthority ||
      fileHash(architectureAuthority) !== architectureAuthorityBinding.hash ||
      context.passAuthority !== false
    ) {
      throw new Error('pre-edit attempt context is invalid');
    }
    if (
      path.resolve(cwd, context.recoveryTarget.path) === outputPath ||
      fileHash(path.resolve(cwd, context.recoveryTarget.path)) !==
        context.recoveryTarget.preimageHash
    ) {
      throw new Error('fixed recovery target preimage is invalid');
    }
    const qualifiedRedReceipt = validateQualifiedRedReceipt(
      cwd,
      options.qualifiedRedReceipt,
      context
    );
    const recoverySchema = recoveryAuthority.schema;
    const commandRoles = recoverySchema['x-commandRoles'];
    if (
      !commandRoles?.preEdit ||
      !commandRoles?.bootstrap ||
      !commandRoles?.postBootstrap
    ) {
      throw new Error('recovery command-role authority is absent');
    }
    const commandPlan = Object.values(context.commandPlan ?? {}) as JsonRecord[];
    const preEditPlan = commandPlan.find(
      (entry) => entry.commandId === commandRoles.preEdit
    );
    const bootstrapPlan = commandPlan
      .filter((entry) => entry.commandId === commandRoles.bootstrap)
      .sort((left, right) => right.invocationSequence - left.invocationSequence)[0];
    if (!preEditPlan || !bootstrapPlan) {
      throw new Error('recovery bootstrap command plan is incomplete');
    }
    const receiptIdentity = {
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      contractHash: context.contractHash,
      inputSnapshotHash: fileHash(attemptContextPath),
    };
    const preEditCommandId = commandIdFromHashBoundReceipt(
      cwd,
      {
        path: preEditPlan.receiptPath,
        hash: fileHash(path.resolve(cwd, preEditPlan.receiptPath)),
      },
      receiptIdentity
    );
    if (
      preEditCommandId !== commandRoles.preEdit ||
      bootstrapPlan.commandId !== commandRoles.bootstrap ||
      preEditCommandId === bootstrapPlan.commandId
    ) {
      throw new Error('bootstrap command identities are not distinct');
    }
    const initialConsumer = createOrVerifyConsumer(
      options.consumerRoot,
      options.createIfAbsent,
      context.consumerObservation
    );
    const payload: JsonRecord = {
      schemaVersion: 'requirements-contract-recovery-lineage-receipt/v1',
      state: 'provisional',
      contractHash: context.contractHash,
      authorityBindings: {
        primary: pathHash(cwd, authority),
        architectureWave: pathHash(cwd, architectureAuthority),
      },
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      preCandidateAuditAttemptId: context.preCandidateAuditAttemptId,
      finalAuditAttemptId: context.finalAuditAttemptId,
      finalizationRunId: context.finalizationRunId,
      requirementSetId: context.requirementSetId,
      preEditAttemptContext: pathHash(cwd, attemptContextPath),
      predecessorContractHash: context.predecessorContractHash,
      predecessorBaselineSnapshotHash: context.predecessorBaselineSnapshotHash,
      predecessorPassAuthorityDecision: 'revoked',
      historicalGapDecision: 'untrusted_observation_only',
      passAuthority: false,
      gitStatusHash: context.repositoryObservation.gitStatusHash,
      frozenUniverseHash: context.frozenUniverseHash,
      sourceHashBindings: context.sourceHashBindings,
      semanticModelHashBindings: context.semanticModelHashBindings,
      grandfatheredCandidateManifest: grandfatheredManifest(
        cwd,
        context,
        qualifiedRedReceipt.path
      ),
      consumer: initialConsumer,
      commandReceiptRefs: {
        [preEditCommandId]: {
          path: repositoryPath(cwd, preEditPlan.receiptPath),
          hash: fileHash(path.resolve(cwd, preEditPlan.receiptPath)),
        },
        [bootstrapPlan.commandId]: {
          applicability: 'current_invocation',
          commandRunId: bootstrapPlan.commandRunId,
          invocationSequence: bootstrapPlan.invocationSequence,
        },
      },
      qualifiedRedReceipt,
      pendingFinalization: {
        missingReceiptRoles: [commandRoles.postBootstrap],
        requiredReceiptCount: 1,
      },
      provisionalPublication: {
        receiptPath: repositoryPath(cwd, publicationReceiptPath),
        schemaVersion: 'requirements-contract-recovery-publication-receipt/v1',
      },
      fixedTarget: {
        path: context.recoveryTarget.path,
        preimageHash: context.recoveryTarget.preimageHash,
      },
      finalizationReceiptTarget: {
        ...recoveryAuthority.finalizationReceiptTarget,
      },
      createdAt: new Date().toISOString(),
    };
    payload.consumer = revalidateConsumerObservation(
      options.consumerRoot,
      context.consumerObservation,
      initialConsumer
    );
    const validate = schemaValidator(RECOVERY_LINEAGE_SCHEMA);
    if (!validate(payload))
      throw new Error(`recovery receipt schema invalid: ${JSON.stringify(validate.errors)}`);
    atomicWriteJson(outputPath, payload);
    const readback = JSON.parse(readFileSync(outputPath, 'utf8'));
    if (canonical(readback) !== canonical(payload))
      throw new Error('recovery receipt readback mismatch');
    try {
      revalidateConsumerObservation(
        options.consumerRoot,
        context.consumerObservation,
        payload.consumer
      );
    } catch (error) {
      removeUnpublishedBootstrapArtifacts(outputPath, publicationReceiptPath);
      throw error;
    }
    const publicationReceipt = {
      schemaVersion: 'requirements-contract-recovery-publication-receipt/v1',
      targetPath: repositoryPath(cwd, outputPath),
      targetHash: fileHash(outputPath),
      contractHash: context.contractHash,
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      finalizationRunId: context.finalizationRunId,
      explicitUtf8: true,
      createOnly: true,
      readbackVerified: true,
      createdAt: new Date().toISOString(),
    };
    atomicWriteJson(publicationReceiptPath, publicationReceipt);
    if (options.json) {
      process.stdout.write(
        `${JSON.stringify({
          decision: 'pass',
          passAuthority: false,
          artifactPath: repositoryPath(cwd, outputPath),
          artifactHash: fileHash(outputPath),
          publicationReceiptPath: repositoryPath(cwd, publicationReceiptPath),
          publicationReceiptHash: fileHash(publicationReceiptPath),
        })}\n`
      );
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json)
      process.stderr.write(`${JSON.stringify({ decision: 'block', error: message })}\n`);
    else process.stderr.write(`${message}\n`);
    return 1;
  }
}

function assertExactRoot(cwd: string, supplied: string, expectedRelative: string, label: string) {
  const actual = path.resolve(cwd, supplied);
  const expected = path.resolve(cwd, expectedRelative);
  if (actual !== expected) throw new Error(`${label} is not canonical`);
  let current = actual;
  while (current.startsWith(cwd) && current !== cwd) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`${label} traverses a symbolic link`);
    }
    current = path.dirname(current);
  }
  return actual;
}

interface CommandReceiptBinding {
  acceptanceRefs: string[];
  traceRefs: string[];
}

interface CommandReceiptAuthority {
  bindings: Record<string, CommandReceiptBinding>;
  finalizedRoles: string[];
  maxClockSkewMs: number;
}

function commandReceiptAuthority(): CommandReceiptAuthority {
  const schema = schemaDocument(RECOVERY_LINEAGE_SCHEMA);
  const commandRoles = schema['x-commandRoles'] as JsonRecord | undefined;
  const finalizedRoles = schema['x-finalizedCommandReceiptRoles'];
  const finalizerRole = schema['x-finalizerCommandRole'];
  const buildRole = schema['x-buildCommandRole'];
  const maxClockSkewMs = schema['x-maxClockSkewMs'];
  const bindings = schema['x-commandReceiptBindings'];
  if (
    !commandRoles ||
    !Array.isArray(finalizedRoles) ||
    typeof finalizerRole !== 'string' ||
    typeof buildRole !== 'string' ||
    !Number.isInteger(maxClockSkewMs) ||
    maxClockSkewMs < 0 ||
    !bindings ||
    typeof bindings !== 'object' ||
    Array.isArray(bindings)
  ) {
    throw new Error('controlled command receipt binding authority is invalid');
  }
  const roleValues = Object.values(commandRoles);
  if (
    roleValues.some((role) => typeof role !== 'string') ||
    canonical(finalizedRoles) !==
      canonical([commandRoles.preEdit, commandRoles.bootstrap, commandRoles.postBootstrap])
  ) {
    throw new Error('controlled command receipt role authority is invalid');
  }
  const expectedBindingKeys = [...new Set([...roleValues, finalizerRole, buildRole])].sort();
  if (canonical(Object.keys(bindings).sort()) !== canonical(expectedBindingKeys)) {
    throw new Error('controlled command receipt binding role set is invalid');
  }
  const parsedBindings: Record<string, CommandReceiptBinding> = {};
  for (const [commandId, rawBinding] of Object.entries(bindings as JsonRecord)) {
    const binding = rawBinding as JsonRecord;
    const acceptanceRefs = binding?.acceptanceRefs;
    const traceRefs = binding?.traceRefs;
    if (
      Object.keys(binding ?? {}).sort().join(',') !== 'acceptanceRefs,traceRefs' ||
      !Array.isArray(acceptanceRefs) ||
      !Array.isArray(traceRefs) ||
      acceptanceRefs.length === 0 ||
      acceptanceRefs.length !== traceRefs.length ||
      new Set(acceptanceRefs).size !== acceptanceRefs.length ||
      new Set(traceRefs).size !== traceRefs.length
    ) {
      throw new Error(`controlled command receipt binding is malformed: ${commandId}`);
    }
    let prior = -1;
    for (let index = 0; index < acceptanceRefs.length; index += 1) {
      const acceptanceMatch = /^AC-(\d+)$/u.exec(String(acceptanceRefs[index]));
      const traceMatch = /^TR-(\d+)$/u.exec(String(traceRefs[index]));
      if (
        !acceptanceMatch ||
        !traceMatch ||
        acceptanceMatch[1] !== traceMatch[1] ||
        Number(acceptanceMatch[1]) <= prior
      ) {
        throw new Error(`controlled command receipt binding is malformed: ${commandId}`);
      }
      prior = Number(acceptanceMatch[1]);
    }
    parsedBindings[commandId] = {
      acceptanceRefs: [...acceptanceRefs],
      traceRefs: [...traceRefs],
    };
  }
  return {
    bindings: parsedBindings,
    finalizedRoles: [...finalizedRoles],
    maxClockSkewMs,
  };
}

function controlledCommandReceipt(
  cwd: string,
  receiptPath: string,
  context: JsonRecord
): { commandId: string; commandRunId: string; invocationSequence: number; ref: PathHash } {
  const absolute = path.resolve(cwd, receiptPath);
  if (!existsSync(absolute)) throw new Error(`controlled command receipt is absent: ${receiptPath}`);
  const receipt = readJson(absolute);
  const validate = schemaValidator(CONTROLLED_COMMAND_SCHEMA);
  if (!validate(receipt)) {
    throw new Error(`controlled command receipt schema invalid: ${JSON.stringify(validate.errors)}`);
  }
  const expectedIdentity = {
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    activePhaseAuditAttemptId: context.architectureAuditAttemptId,
    contractHash: context.contractHash,
    inputSnapshotHash: fileHash(path.resolve(cwd, context.__attemptContextPath)),
  };
  for (const [key, value] of Object.entries(expectedIdentity)) {
    if (receipt[key] !== value) throw new Error(`controlled command receipt ${key} mismatch`);
  }
  const authority = commandReceiptAuthority();
  const binding = authority.bindings[receipt.commandId];
  if (
    !binding ||
    canonical(receipt.acceptanceRefs) !== canonical(binding.acceptanceRefs)
  ) {
    throw new Error('controlled command receipt acceptance binding mismatch');
  }
  if (canonical(receipt.traceRefs) !== canonical(binding.traceRefs)) {
    throw new Error('controlled command receipt trace binding mismatch');
  }
  if (
    receipt.exitCode !== 0 ||
    receipt.decision !== 'pass' ||
    receipt.publication?.readbackVerified !== true ||
    path.resolve(cwd, receipt.publication.targetPath) !== absolute
  ) {
    throw new Error('controlled command receipt does not grant command PASS');
  }
  const startedAt = new Date(receipt.startedAt).getTime();
  const endedAt = new Date(receipt.endedAt).getTime();
  const publishedAt = new Date(receipt.publication.publishedAt).getTime();
  const readbackAt = new Date(receipt.publication.readbackAt).getTime();
  if (startedAt > endedAt) {
    throw new Error('controlled command receipt timestamp order is invalid');
  }
  if (
    publishedAt < endedAt - authority.maxClockSkewMs ||
    readbackAt < publishedAt - authority.maxClockSkewMs
  ) {
    throw new Error('controlled command receipt publication timestamp order is invalid');
  }
  if (
    receipt.argvHash !== sha256(canonical(receipt.argv)) ||
    path.resolve(receipt.cwd) !== cwd ||
    receipt.hostIdentity.platform !== process.platform ||
    receipt.hostIdentity.architecture !== process.arch ||
    receipt.hostIdentity.nodeVersion !== process.version
  ) {
    throw new Error('controlled command receipt execution identity is invalid');
  }
  for (const [outputPathKey, outputHashKey] of [
    ['stdoutPath', 'stdoutHash'],
    ['stderrPath', 'stderrHash'],
  ] as const) {
    const outputPath = path.resolve(cwd, receipt[outputPathKey]);
    if (!existsSync(outputPath) || fileHash(outputPath) !== receipt[outputHashKey]) {
      throw new Error(`controlled command receipt ${outputPathKey} readback mismatch`);
    }
  }
  const plan = (Object.values(context.commandPlan ?? {}) as JsonRecord[]).find(
    (entry) =>
      entry.commandId === receipt.commandId &&
      entry.commandRunId === receipt.commandRunId &&
      entry.invocationSequence === receipt.invocationSequence &&
      path.resolve(cwd, entry.receiptPath) === absolute
  );
  if (!plan) throw new Error('controlled command receipt is not attempt-plan-derived');
  if (
    !Array.isArray(plan.argv) ||
    plan.argvHash !== sha256(canonical(plan.argv)) ||
    canonical(receipt.argv) !== canonical(plan.argv) ||
    receipt.argvHash !== plan.argvHash
  ) {
    throw new Error('controlled command receipt attempt-plan argv mismatch');
  }
  if (
    path.resolve(plan.cwd) !== cwd ||
    canonical(receipt.executorIdentity) !== canonical(plan.executorIdentity) ||
    canonical(receipt.hostIdentity) !== canonical(plan.hostIdentity)
  ) {
    throw new Error('controlled command receipt attempt-plan execution identity mismatch');
  }
  if (
    !Array.isArray(plan.orderedChildren) ||
    receipt.orderedChildren.length !== plan.orderedChildren.length
  ) {
    throw new Error('controlled command receipt attempt-plan ordered child mismatch');
  }
  let priorChildEndedAt = startedAt;
  for (let index = 0; index < plan.orderedChildren.length; index += 1) {
    const expectedChild = plan.orderedChildren[index] as JsonRecord;
    const child = receipt.orderedChildren[index] as JsonRecord;
    if (
      !Array.isArray(expectedChild.argv) ||
      expectedChild.argvHash !== sha256(canonical(expectedChild.argv)) ||
      canonical(child.argv) !== canonical(expectedChild.argv) ||
      child.argvHash !== expectedChild.argvHash ||
      path.resolve(child.cwd) !== path.resolve(expectedChild.cwd) ||
      child.exitCode !== expectedChild.exitCode
    ) {
      throw new Error('controlled command receipt attempt-plan ordered child mismatch');
    }
    const childStartedAt = new Date(child.startedAt).getTime();
    const childEndedAt = new Date(child.endedAt).getTime();
    if (
      childStartedAt > childEndedAt ||
      childStartedAt < priorChildEndedAt - authority.maxClockSkewMs ||
      childEndedAt > endedAt + authority.maxClockSkewMs
    ) {
      throw new Error('controlled command receipt child timestamp order is invalid');
    }
    priorChildEndedAt = childEndedAt;
    for (const [outputPathKey, outputHashKey] of [
      ['stdoutPath', 'stdoutHash'],
      ['stderrPath', 'stderrHash'],
    ] as const) {
      const outputPath = path.resolve(cwd, child[outputPathKey]);
      if (!existsSync(outputPath) || fileHash(outputPath) !== child[outputHashKey]) {
        throw new Error(
          `controlled command receipt child ${outputPathKey} readback mismatch`
        );
      }
    }
  }
  return {
    commandId: receipt.commandId,
    commandRunId: receipt.commandRunId,
    invocationSequence: receipt.invocationSequence,
    ref: pathHash(cwd, absolute),
  };
}

function readPathInventory(paths: Record<string, string>): JsonRecord[] {
  return Object.entries(paths)
    .map(([role, filePath]) => {
      const exists = existsSync(filePath);
      if (!exists) {
        return {
          role,
          path: filePath.replace(/\\/gu, '/'),
          exists: false,
        };
      }
      const stats = lstatSync(filePath);
      const pathType = stats.isDirectory() ? 'directory' : 'file';
      const hash =
        pathType === 'directory'
          ? sha256(canonical(readdirSync(filePath).sort()))
          : fileHash(filePath);
      return {
        role,
        path: filePath.replace(/\\/gu, '/'),
        exists: true,
        pathType,
        hash,
      };
    })
    .sort((left, right) => left.role.localeCompare(right.role));
}

function priorInvocationState(
  cwd: string,
  transactionRoot: string,
  currentIntentPath: string,
  context: JsonRecord
) {
  const invocationDirectory = path.join(transactionRoot, 'invocations');
  const observationDirectory = path.join(transactionRoot, 'observations');
  const intents = existsSync(invocationDirectory)
    ? readdirSync(invocationDirectory)
        .filter((name) => name.endsWith('.intent.json'))
        .map((name) => path.join(invocationDirectory, name))
        .filter((entry) => path.resolve(entry) !== path.resolve(currentIntentPath))
    : [];
  const decisions = existsSync(observationDirectory)
    ? readdirSync(observationDirectory)
        .filter((name) => name.endsWith('.state-decision.receipt.json'))
        .map((name) => path.join(observationDirectory, name))
    : [];
  const decisionKeys = new Set(
    decisions.map((entry) =>
      path.basename(entry).replace(/\.state-decision\.receipt\.json$/u, '')
    )
  );
  const intentByKey = new Map(
    intents.map((entry) => [
      path.basename(entry).replace(/\.intent\.json$/u, ''),
      entry,
    ])
  );
  if (decisions.some((entry) => !intentByKey.has(
    path.basename(entry).replace(/\.state-decision\.receipt\.json$/u, '')
  ))) {
    throw new Error('prior invocation binding mismatch');
  }
  const seenSequences = new Set<number>();
  const validateDecision = schemaValidator(STATE_DECISION_SCHEMA);
  for (const [key, intentPath] of intentByKey) {
    const match = key.match(/^(\d+)-(.+)$/u);
    if (!match) throw new Error('prior invocation binding mismatch');
    const invocationSequence = Number(match[1]);
    const commandRunId = match[2];
    if (
      !Number.isInteger(invocationSequence) ||
      invocationSequence <= 0 ||
      seenSequences.has(invocationSequence)
    ) {
      throw new Error('prior invocation binding mismatch');
    }
    seenSequences.add(invocationSequence);
    const intent = readJson(intentPath);
    if (
      intent.schemaVersion !==
        'requirements-contract-recovery-finalization-invocation-intent/v1' ||
      intent.requestedAction !== 'complete_or_observe_finalization' ||
      intent.transactionId !== context.transactionId ||
      intent.implementationAttemptId !== context.implementationAttemptId ||
      intent.architectureAuditAttemptId !== context.architectureAuditAttemptId ||
      intent.contractHash !== context.contractHash ||
      intent.finalizationRunId !== context.finalizationRunId ||
      intent.commandRunId !== commandRunId ||
      intent.invocationSequence !== invocationSequence ||
      intent.readbackVerified !== true
    ) {
      throw new Error('prior invocation binding mismatch');
    }
    const decisionPath = path.join(
      observationDirectory,
      `${key}.state-decision.receipt.json`
    );
    if (!existsSync(decisionPath)) continue;
    const decision = readJson(decisionPath);
    if (
      !validateDecision(decision) ||
      decision.transactionId !== context.transactionId ||
      decision.implementationAttemptId !== context.implementationAttemptId ||
      decision.architectureAuditAttemptId !== context.architectureAuditAttemptId ||
      decision.contractHash !== context.contractHash ||
      decision.finalizationRunId !== context.finalizationRunId ||
      decision.commandRunId !== commandRunId ||
      decision.invocationSequence !== invocationSequence
    ) {
      throw new Error('prior invocation binding mismatch');
    }
    validatePathHashBinding(
      cwd,
      decision.invocationIntent,
      intentPath,
      'prior invocation'
    );
  }
  const unmatched = intents.filter(
    (entry) => !decisionKeys.has(path.basename(entry).replace(/\.intent\.json$/u, ''))
  );
  return { intents, decisions, unmatched };
}

function validateFinalizerInvocation(
  context: JsonRecord,
  finalizerRole: string,
  transactionRoot: string,
  commandRunId: string,
  invocationSequence: number
): void {
  const initialPlan = (Object.values(context.commandPlan ?? {}) as JsonRecord[]).find(
    (entry) => entry.commandId === finalizerRole
  );
  if (!initialPlan) {
    throw new Error('finalizer command role is absent from the attempt plan');
  }
  if (invocationSequence === initialPlan.invocationSequence) {
    if (commandRunId !== initialPlan.commandRunId) {
      throw new Error('initial finalizer invocation identity mismatch');
    }
    return;
  }
  if (
    !Number.isInteger(invocationSequence) ||
    invocationSequence <= initialPlan.invocationSequence ||
    commandRunId === initialPlan.commandRunId
  ) {
    throw new Error('retry finalizer invocation identity is invalid');
  }
  const invocationDirectory = path.join(transactionRoot, 'invocations');
  const allocations = existsSync(invocationDirectory)
    ? readdirSync(invocationDirectory)
        .map((name) => name.match(/^(\d+)-(.+)\.intent\.json$/u))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => ({
          invocationSequence: Number(match[1]),
          commandRunId: match[2],
        }))
    : [];
  if (allocations.some((entry) => entry.commandRunId === commandRunId)) {
    throw new Error('retry finalizer command run identity was already allocated');
  }
  const maximumAllocatedSequence = Math.max(
    initialPlan.invocationSequence,
    ...allocations.map((entry) => entry.invocationSequence)
  );
  if (invocationSequence !== maximumAllocatedSequence + 1) {
    throw new Error('retry finalizer invocation sequence is not append-only');
  }
}

function classifyRecoveryState(
  cwd: string,
  paths: Record<string, string>,
  expectedTargetPreimageHash: string,
  currentIntentPath: string,
  context: JsonRecord
): string {
  const prior = priorInvocationState(
    cwd,
    paths.transactionRoot,
    currentIntentPath,
    context
  );
  const has = (role: string) => existsSync(paths[role]);
  const targetHash = fileHash(paths.target);
  if (has('finalizationReceipt')) return 'committed';
  if (targetHash !== expectedTargetPreimageHash) {
    if (!has('logicalIntent') || !has('backup') || !has('staged') || !has('prepareReceipt')) {
      return 'corrupt';
    }
    if (targetHash !== fileHash(paths.staged)) return 'corrupt';
    return has('targetPromotedReceipt') ? 'target_promoted' : 'promoted_unrecorded';
  }
  if (has('targetPromotedReceipt')) return 'corrupt';
  if (has('prepareReceipt')) {
    return has('logicalIntent') && has('backup') && has('staged') ? 'prepared' : 'corrupt';
  }
  if (has('staged')) {
    return has('logicalIntent') && has('backup') ? 'backup_and_staged' : 'corrupt';
  }
  if (has('backup')) return has('logicalIntent') ? 'backup_only' : 'corrupt';
  if (has('logicalIntent')) return 'corrupt';
  if (prior.unmatched.length > 0) return 'intent_recorded';
  if (prior.decisions.length > 0) return 'fresh_decided';
  return 'fresh';
}

function selectedTransition(state: string): string {
  const transitions: Record<string, string> = {
    fresh: 'complete_remaining_prefix',
    intent_recorded: 'complete_remaining_prefix',
    fresh_decided: 'complete_remaining_prefix',
    backup_only: 'resume_staged_write',
    backup_and_staged: 'resume_prepare_receipt',
    prepared: 'resume_target_promotion',
    promoted_unrecorded: 'resume_target_promoted_receipt',
    target_promoted: 'resume_commit_receipt',
    committed: 'observe_committed',
    corrupt: 'block',
  };
  return transitions[state] ?? 'block';
}

function writeCreateOnlyAndReadback(filePath: string, value: JsonRecord): PathHash {
  atomicWriteJson(filePath, value);
  const written = readJson(filePath);
  if (canonical(written) !== canonical(value)) {
    throw new Error(`create-only artifact readback mismatch: ${filePath}`);
  }
  return { path: filePath.replace(/\\/gu, '/'), hash: fileHash(filePath) };
}

function copyCreateOnlyAndReadback(source: string, target: string): PathHash {
  if (existsSync(target)) throw new Error(`refusing to overwrite create-only artifact: ${target}`);
  mkdirSync(path.dirname(target), { recursive: true });
  copyFileSync(source, target);
  if (fileHash(source) !== fileHash(target)) {
    throw new Error(`create-only copy readback mismatch: ${target}`);
  }
  return { path: target.replace(/\\/gu, '/'), hash: fileHash(target) };
}

function validatePathHashBinding(
  cwd: string,
  ref: JsonRecord,
  expectedPath: string,
  label: string
): void {
  if (typeof ref?.path !== 'string' || typeof ref?.hash !== 'string') {
    throw new Error(`${label} binding mismatch`);
  }
  const absolute = path.resolve(cwd, ref.path);
  if (
    absolute !== path.resolve(expectedPath) ||
    !existsSync(absolute) ||
    fileHash(absolute) !== ref.hash
  ) {
    throw new Error(`${label} binding mismatch`);
  }
}

function validateTransactionPathHashBinding(
  cwd: string,
  ref: JsonRecord,
  transactionRoot: string,
  label: string
): JsonRecord {
  if (typeof ref?.path !== 'string' || typeof ref?.hash !== 'string') {
    throw new Error(`${label} binding mismatch`);
  }
  const absolute = path.resolve(cwd, ref.path);
  const relative = path.relative(transactionRoot, absolute);
  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    !existsSync(absolute) ||
    fileHash(absolute) !== ref.hash
  ) {
    throw new Error(`${label} binding mismatch`);
  }
  return readJson(absolute);
}

function validatePrepareReceipt(
  cwd: string,
  paths: Record<string, string>,
  context: JsonRecord
): void {
  const receipt = readJson(paths.prepareReceipt);
  const identityMatches =
    receipt.schemaVersion === 'requirements-contract-recovery-finalization-phase-receipt/v1' &&
    receipt.phase === 'prepare' &&
    receipt.transactionId === context.transactionId &&
    receipt.implementationAttemptId === context.implementationAttemptId &&
    receipt.architectureAuditAttemptId === context.architectureAuditAttemptId &&
    receipt.contractHash === context.contractHash &&
    receipt.finalizationRunId === context.finalizationRunId &&
    receipt.readbackVerified === true;
  if (!identityMatches) throw new Error('prepare receipt binding mismatch');

  validatePathHashBinding(cwd, receipt.logicalIntent, paths.logicalIntent, 'prepare receipt');
  validatePathHashBinding(cwd, receipt.backup, paths.backup, 'prepare receipt');
  validatePathHashBinding(cwd, receipt.staged, paths.staged, 'prepare receipt');
  const invocationIntent = validateTransactionPathHashBinding(
    cwd,
    receipt.invocationIntent,
    paths.transactionRoot,
    'prepare receipt'
  );
  const stateDecision = validateTransactionPathHashBinding(
    cwd,
    receipt.stateDecision,
    paths.transactionRoot,
    'prepare receipt'
  );
  if (
    invocationIntent.transactionId !== context.transactionId ||
    invocationIntent.implementationAttemptId !== context.implementationAttemptId ||
    invocationIntent.architectureAuditAttemptId !== context.architectureAuditAttemptId ||
    invocationIntent.contractHash !== context.contractHash ||
    invocationIntent.finalizationRunId !== context.finalizationRunId ||
    stateDecision.transactionId !== context.transactionId ||
    stateDecision.implementationAttemptId !== context.implementationAttemptId ||
    stateDecision.architectureAuditAttemptId !== context.architectureAuditAttemptId ||
    stateDecision.contractHash !== context.contractHash ||
    stateDecision.finalizationRunId !== context.finalizationRunId ||
    stateDecision.commandRunId !== invocationIntent.commandRunId ||
    stateDecision.invocationSequence !== invocationIntent.invocationSequence ||
    canonical(stateDecision.invocationIntent) !== canonical(receipt.invocationIntent)
  ) {
    throw new Error('prepare receipt binding mismatch');
  }
}

function validateTargetPromotedReceipt(
  cwd: string,
  paths: Record<string, string>,
  context: JsonRecord
): void {
  const receipt = readJson(paths.targetPromotedReceipt);
  const identityMatches =
    receipt.schemaVersion === 'requirements-contract-recovery-finalization-phase-receipt/v1' &&
    receipt.phase === 'target_promoted' &&
    receipt.transactionId === context.transactionId &&
    receipt.implementationAttemptId === context.implementationAttemptId &&
    receipt.architectureAuditAttemptId === context.architectureAuditAttemptId &&
    receipt.contractHash === context.contractHash &&
    receipt.finalizationRunId === context.finalizationRunId &&
    receipt.readbackVerified === true;
  if (!identityMatches) throw new Error('target-promoted receipt binding mismatch');

  validatePathHashBinding(
    cwd,
    receipt.prepareReceipt,
    paths.prepareReceipt,
    'target-promoted receipt'
  );
  validatePathHashBinding(cwd, receipt.target, paths.target, 'target-promoted receipt');
  const invocationIntent = validateTransactionPathHashBinding(
    cwd,
    receipt.invocationIntent,
    paths.transactionRoot,
    'target-promoted receipt'
  );
  const stateDecision = validateTransactionPathHashBinding(
    cwd,
    receipt.stateDecision,
    paths.transactionRoot,
    'target-promoted receipt'
  );
  if (
    invocationIntent.transactionId !== context.transactionId ||
    invocationIntent.implementationAttemptId !== context.implementationAttemptId ||
    invocationIntent.architectureAuditAttemptId !== context.architectureAuditAttemptId ||
    invocationIntent.contractHash !== context.contractHash ||
    invocationIntent.finalizationRunId !== context.finalizationRunId ||
    stateDecision.commandRunId !== invocationIntent.commandRunId ||
    stateDecision.invocationSequence !== invocationIntent.invocationSequence ||
    canonical(stateDecision.invocationIntent) !== canonical(receipt.invocationIntent)
  ) {
    throw new Error('target-promoted receipt binding mismatch');
  }
}

function validateCommittedFinalizationReceipt(
  cwd: string,
  paths: Record<string, string>,
  context: JsonRecord,
  receipt: JsonRecord,
  qualifiedRedReceipt: PathHash,
  commandReceipts: Map<string, PathHash>,
  expectedTargetPreimageHash: string
): void {
  const validateFinalizationReceipt = schemaValidator(FINALIZATION_RECEIPT_SCHEMA);
  if (!validateFinalizationReceipt(receipt)) {
    throw new Error(
      `committed recovery receipt binding mismatch: ${JSON.stringify(
        validateFinalizationReceipt.errors
      )}`
    );
  }
  const commonIdentityMatches =
    receipt.contractHash === context.contractHash &&
    receipt.transactionId === context.transactionId &&
    receipt.implementationAttemptId === context.implementationAttemptId &&
    receipt.architectureAuditAttemptId === context.architectureAuditAttemptId &&
    receipt.finalizationRunId === context.finalizationRunId;
  if (!commonIdentityMatches) {
    throw new Error('committed recovery receipt binding mismatch');
  }

  validatePathHashBinding(
    cwd,
    receipt.authorityBindings?.primary,
    context.authorityBindings.amend10.path,
    'committed recovery receipt'
  );
  validatePathHashBinding(
    cwd,
    receipt.authorityBindings?.architectureWave,
    context.authorityBindings.architectureWave.path,
    'committed recovery receipt'
  );
  validatePathHashBinding(
    cwd,
    receipt.provisionalCandidate,
    paths.recovery,
    'committed recovery receipt'
  );
  validatePathHashBinding(
    cwd,
    receipt.initialPublicationReceipt,
    paths.initialPublicationReceipt,
    'committed recovery receipt'
  );
  validatePathHashBinding(
    cwd,
    receipt.logicalIntent,
    paths.logicalIntent,
    'committed recovery receipt'
  );
  validatePathHashBinding(
    cwd,
    receipt.prepareReceipt,
    paths.prepareReceipt,
    'committed recovery receipt'
  );
  validatePathHashBinding(
    cwd,
    receipt.targetPromotedReceipt,
    paths.targetPromotedReceipt,
    'committed recovery receipt'
  );
  validatePathHashBinding(cwd, receipt.staged, paths.staged, 'committed recovery receipt');
  validatePathHashBinding(cwd, receipt.backup, paths.backup, 'committed recovery receipt');
  if (
    canonical(receipt.qualifiedRedReceipt) !== canonical(qualifiedRedReceipt) ||
    canonical(receipt.acceptedCommandReceipts) !==
      canonical(Object.fromEntries(commandReceipts))
  ) {
    throw new Error('committed recovery receipt binding mismatch');
  }
  const inputReceiptSetHash = sha256(
    canonical({
      qualifiedRedReceipt,
      commandReceipts: Object.fromEntries(
        [...commandReceipts.entries()].sort(([left], [right]) => left.localeCompare(right))
      ),
    })
  );
  if (receipt.inputReceiptSetHash !== inputReceiptSetHash) {
    throw new Error('committed recovery receipt binding mismatch');
  }

  const committingInvocation = validateTransactionPathHashBinding(
    cwd,
    receipt.committingInvocationIntent,
    paths.transactionRoot,
    'committed recovery receipt'
  );
  const committingDecision = validateTransactionPathHashBinding(
    cwd,
    receipt.committingStateDecision,
    paths.transactionRoot,
    'committed recovery receipt'
  );
  if (
    receipt.commitCommandRunId !== committingInvocation.commandRunId ||
    receipt.commitInvocationSequence !== committingInvocation.invocationSequence ||
    committingDecision.commandRunId !== receipt.commitCommandRunId ||
    committingDecision.invocationSequence !== receipt.commitInvocationSequence ||
    canonical(committingDecision.invocationIntent) !==
      canonical(receipt.committingInvocationIntent)
  ) {
    throw new Error('committed recovery receipt binding mismatch');
  }

  const targetHash = fileHash(paths.target);
  if (
    receipt.fixedTarget?.path !== repositoryPath(cwd, paths.target) ||
    receipt.fixedTarget?.expectedPreimageHash !== expectedTargetPreimageHash ||
    receipt.fixedTarget?.finalHash !== targetHash ||
    receipt.fixedTarget?.readbackHash !== targetHash ||
    receipt.publication?.writer !== 'requirements-contract-recovery-finalize' ||
    receipt.publication?.explicitUtf8 !== true ||
    receipt.publication?.atomicTargetPromotion !== true ||
    receipt.publication?.readbackVerified !== true
  ) {
    throw new Error('committed recovery receipt binding mismatch');
  }
  validatePrepareReceipt(cwd, paths, context);
  validateTargetPromotedReceipt(cwd, paths, context);
}

function validateLogicalFinalizationIntent(
  cwd: string,
  paths: Record<string, string>,
  context: JsonRecord,
  provisionalRef: PathHash,
  stagedHash: string,
  inputReceiptSetHash: string,
  expectedTargetPreimageHash: string
): void {
  const intent = readJson(paths.logicalIntent);
  if (
    intent.schemaVersion !== 'requirements-contract-recovery-finalization-intent/v1' ||
    intent.transactionId !== context.transactionId ||
    intent.implementationAttemptId !== context.implementationAttemptId ||
    intent.architectureAuditAttemptId !== context.architectureAuditAttemptId ||
    intent.contractHash !== context.contractHash ||
    intent.finalizationRunId !== context.finalizationRunId ||
    canonical(intent.provisionalCandidate) !== canonical(provisionalRef) ||
    intent.fixedTarget?.path !== repositoryPath(cwd, paths.target) ||
    intent.fixedTarget?.expectedPreimageHash !== expectedTargetPreimageHash ||
    intent.stagedHash !== stagedHash ||
    intent.inputReceiptSetHash !== inputReceiptSetHash ||
    intent.finalizationReceiptTarget !== repositoryPath(cwd, paths.finalizationReceipt) ||
    intent.readbackVerified !== true
  ) {
    throw new Error('logical finalization intent binding mismatch');
  }
}

function finalizedRecoveryPayload(
  provisional: JsonRecord,
  commandReceipts: Map<string, PathHash>,
  provisionalRef: PathHash,
  publicationRef: PathHash
): JsonRecord {
  const {
    pendingFinalization: _pendingFinalization,
    provisionalPublication: _provisionalPublication,
    ...shared
  } = provisional;
  return {
    ...shared,
    state: 'finalized',
    commandReceiptRefs: Object.fromEntries(commandReceipts),
    provisionalCandidate: provisionalRef,
    initialPublicationReceipt: publicationRef,
  };
}

function recoveryTransactionPaths(
  cwd: string,
  context: JsonRecord,
  options: RecoveryFinalizationOptions
) {
  const recoveryAuthority = recoverySchemaAuthority();
  const transactionBase = assertExactRoot(
    cwd,
    options.transactionRoot,
    recoveryAuthority.transactionRoot,
    'recovery transaction root'
  );
  assertExactRoot(cwd, options.failureRoot, recoveryAuthority.failureRoot, 'recovery failure root');
  const transactionRoot = path.join(
    transactionBase,
    context.transactionId,
    context.implementationAttemptId,
    context.finalizationRunId
  );
  const invocationKey = `${options.invocationSequence}-${options.commandRunId}`;
  return {
    transactionRoot,
    recovery: path.join(transactionRoot, 'provisional', 'recovery-lineage-receipt.json'),
    initialPublicationReceipt: path.join(
      transactionRoot,
      'provisional',
      'recovery-lineage-receipt.publication-receipt.json'
    ),
    logicalIntent: path.join(transactionRoot, 'intent.json'),
    invocationIntent: path.join(transactionRoot, 'invocations', `${invocationKey}.intent.json`),
    stateDecision: path.join(
      transactionRoot,
      'observations',
      `${invocationKey}.state-decision.receipt.json`
    ),
    prepareReceipt: path.join(transactionRoot, 'phases', 'prepare.receipt.json'),
    targetPromotedReceipt: path.join(
      transactionRoot,
      'phases',
      'target-promoted.receipt.json'
    ),
    staged: path.join(transactionRoot, 'staged', 'recovery-lineage-receipt.json'),
    backup: path.join(transactionRoot, 'backup', 'recovery-lineage-receipt.json'),
    target: path.resolve(cwd, options.target),
    finalizationReceipt: path.resolve(cwd, options.finalizationReceipt),
  };
}

export async function finalizeRequirementsContractRecoveryLineageReceipt(
  options: RecoveryFinalizationOptions
) {
  const cwd = path.resolve(options.cwd);
  const attemptContextPath = path.resolve(cwd, options.attemptContext);
  const context = readJson(attemptContextPath);
  context.__attemptContextPath = attemptContextPath;
  const paths = recoveryTransactionPaths(cwd, context, options);
  if (
    path.resolve(cwd, options.recovery) !== paths.recovery ||
    path.resolve(cwd, options.initialPublicationReceipt) !==
      paths.initialPublicationReceipt ||
    path.resolve(cwd, context.recoveryTarget.path) !== paths.target ||
    context.recoveryTarget.preimageHash !== options.expectedTargetPreimageHash ||
    context.finalizationRunId !== options.finalizationRunId
  ) {
    throw new Error('recovery finalization paths or frozen identities mismatch');
  }
  if (
    path.resolve(cwd, options.contract) !== path.resolve(cwd, context.contractPath) ||
    fileHash(path.resolve(cwd, options.contract)) !== context.contractHash
  ) {
    throw new Error('recovery finalization contract binding mismatch');
  }
  const authorityBindings = context.authorityBindings ?? {};
  for (const [supplied, binding] of [
    [options.authority, authorityBindings.amend10],
    [options.architectureAuthority, authorityBindings.architectureWave],
  ] as const) {
    if (
      !binding ||
      path.resolve(cwd, supplied) !== path.resolve(cwd, binding.path) ||
      fileHash(path.resolve(cwd, supplied)) !== binding.hash
    ) {
      throw new Error('recovery finalization authority binding mismatch');
    }
  }
  if (
    !existsSync(paths.recovery) ||
    fileHash(paths.recovery) !== options.expectedProvisionalHash
  ) {
    throw new Error('provisional recovery candidate hash mismatch');
  }
  const publication = readJson(paths.initialPublicationReceipt);
  if (
    publication.targetPath !== repositoryPath(cwd, paths.recovery) ||
    publication.targetHash !== options.expectedProvisionalHash ||
    publication.readbackVerified !== true ||
    fileHash(paths.recovery) !== publication.targetHash
  ) {
    throw new Error('provisional recovery publication receipt mismatch');
  }
  const provisional = readJson(paths.recovery);
  const validateRecovery = schemaValidator(RECOVERY_LINEAGE_SCHEMA);
  if (!validateRecovery(provisional) || provisional.state !== 'provisional') {
    throw new Error(
      `provisional recovery candidate schema invalid: ${JSON.stringify(validateRecovery.errors)}`
    );
  }
  const qualifiedRedReceipt = validateQualifiedRedReceipt(
    cwd,
    options.qualifiedRedReceipt,
    context
  );
  const recoverySchema = schemaDocument(RECOVERY_LINEAGE_SCHEMA);
  const commandRoles = recoverySchema['x-commandRoles'];
  const expectedCommandRoles = commandReceiptAuthority().finalizedRoles;
  if (expectedCommandRoles.length === 0) {
    throw new Error('finalized recovery command-role authority is absent');
  }
  const validatedCommandReceipts = options.commandReceipts.map((receiptPath) =>
    controlledCommandReceipt(cwd, receiptPath, context)
  );
  const uniqueCommandReceipts = new Map<string, PathHash>();
  for (const validated of validatedCommandReceipts) {
    if (uniqueCommandReceipts.has(validated.commandId)) {
      throw new Error(`duplicate command receipt role: ${validated.commandId}`);
    }
    uniqueCommandReceipts.set(validated.commandId, validated.ref);
  }
  if (
    uniqueCommandReceipts.size !== expectedCommandRoles.length ||
    expectedCommandRoles.some((role) => !uniqueCommandReceipts.has(role))
  ) {
    throw new Error('controlled command receipt role set mismatch');
  }
  if (
    canonical(validatedCommandReceipts.map((receipt) => receipt.commandId)) !==
    canonical(expectedCommandRoles)
  ) {
    throw new Error('controlled command receipt role order mismatch');
  }
  const commandReceipts = new Map(
    expectedCommandRoles.map((role) => [role, uniqueCommandReceipts.get(role)!])
  );
  const finalizerRole = recoverySchema['x-finalizerCommandRole'];
  if (!commandRoles || typeof finalizerRole !== 'string') {
    throw new Error('finalizer command role authority is absent');
  }
  validateFinalizerInvocation(
    context,
    finalizerRole,
    paths.transactionRoot,
    options.commandRunId,
    options.invocationSequence
  );
  const invocationIntent = {
    schemaVersion: 'requirements-contract-recovery-finalization-invocation-intent/v1',
    requestedAction: 'complete_or_observe_finalization',
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    contractHash: context.contractHash,
    finalizationRunId: context.finalizationRunId,
    commandRunId: options.commandRunId,
    invocationSequence: options.invocationSequence,
    provisionalCandidate: pathHash(cwd, paths.recovery),
    fixedTarget: {
      path: repositoryPath(cwd, paths.target),
      expectedPreimageHash: options.expectedTargetPreimageHash,
    },
    createdAt: new Date().toISOString(),
    readbackVerified: true,
  };
  const invocationIntentRef = writeCreateOnlyAndReadback(
    paths.invocationIntent,
    invocationIntent
  );
  const observedState = classifyRecoveryState(
    cwd,
    paths,
    options.expectedTargetPreimageHash,
    paths.invocationIntent,
    context
  );
  const transition = selectedTransition(observedState);
  const prior = priorInvocationState(
    cwd,
    paths.transactionRoot,
    paths.invocationIntent,
    context
  );
  const stateDecision = {
    schemaVersion: 'requirements-contract-recovery-finalization-state-decision-receipt/v1',
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    contractHash: context.contractHash,
    finalizationRunId: context.finalizationRunId,
    commandRunId: options.commandRunId,
    invocationSequence: options.invocationSequence,
    invocationIntent: invocationIntentRef,
    observedState,
    observedPathInventory: readPathInventory(paths),
    priorUnmatchedInvocationIntents: prior.unmatched.map((entry) => pathHash(cwd, entry)),
    selectedTransition: transition,
    rejectionReason: transition === 'block' ? 'non_crash_reachable_transaction_state' : null,
    createdAt: new Date().toISOString(),
    readbackVerified: true,
  };
  const validateDecision = schemaValidator(STATE_DECISION_SCHEMA);
  if (!validateDecision(stateDecision)) {
    throw new Error(
      `recovery state decision schema invalid: ${JSON.stringify(validateDecision.errors)}`
    );
  }
  const stateDecisionRef = writeCreateOnlyAndReadback(paths.stateDecision, stateDecision);
  if (transition === 'block') throw new Error('recovery finalization transaction is corrupt');

  if (observedState === 'committed') {
    const committedReceipt = readJson(paths.finalizationReceipt);
    validateCommittedFinalizationReceipt(
      cwd,
      paths,
      context,
      committedReceipt,
      qualifiedRedReceipt,
      commandReceipts,
      options.expectedTargetPreimageHash
    );
    return {
      decision: 'pass' as const,
      passAuthority: false,
      outcome: 'idempotent_observation' as const,
      invocationIntent: pathHash(cwd, paths.invocationIntent),
      stateDecision: stateDecisionRef,
      observedFinalizationReceipt: pathHash(cwd, paths.finalizationReceipt),
      commitCommandRunId: committedReceipt.commitCommandRunId,
      commitInvocationSequence: committedReceipt.commitInvocationSequence,
    };
  }

  const provisionalRef = pathHash(cwd, paths.recovery);
  const publicationRef = pathHash(cwd, paths.initialPublicationReceipt);
  const finalizedPayload = finalizedRecoveryPayload(
    provisional,
    commandReceipts,
    provisionalRef,
    publicationRef
  );
  if (!validateRecovery(finalizedPayload)) {
    throw new Error(
      `finalized recovery candidate schema invalid: ${JSON.stringify(validateRecovery.errors)}`
    );
  }
  const stagedBytes = `${JSON.stringify(finalizedPayload, null, 2)}\n`;
  const stagedHash = sha256(stagedBytes);
  const inputReceiptSetHash = sha256(
    canonical({
      qualifiedRedReceipt,
      commandReceipts: Object.fromEntries(
        [...commandReceipts.entries()].sort(([left], [right]) => left.localeCompare(right))
      ),
    })
  );
  if (!existsSync(paths.logicalIntent)) {
    writeCreateOnlyAndReadback(paths.logicalIntent, {
      schemaVersion: 'requirements-contract-recovery-finalization-intent/v1',
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      contractHash: context.contractHash,
      finalizationRunId: context.finalizationRunId,
      provisionalCandidate: provisionalRef,
      fixedTarget: {
        path: repositoryPath(cwd, paths.target),
        expectedPreimageHash: options.expectedTargetPreimageHash,
      },
      stagedHash,
      inputReceiptSetHash,
      finalizationReceiptTarget: repositoryPath(cwd, paths.finalizationReceipt),
      createdAt: context.createdAt,
      readbackVerified: true,
    });
  }
  validateLogicalFinalizationIntent(
    cwd,
    paths,
    context,
    provisionalRef,
    stagedHash,
    inputReceiptSetHash,
    options.expectedTargetPreimageHash
  );
  if (!existsSync(paths.backup)) {
    if (fileHash(paths.target) !== options.expectedTargetPreimageHash) {
      throw new Error('fixed target preimage changed before backup');
    }
    copyCreateOnlyAndReadback(paths.target, paths.backup);
  }
  if (fileHash(paths.backup) !== options.expectedTargetPreimageHash) {
    throw new Error('fixed target backup does not match frozen preimage');
  }
  if (!existsSync(paths.staged)) {
    mkdirSync(path.dirname(paths.staged), { recursive: true });
    writeFileSync(paths.staged, stagedBytes, { encoding: 'utf8', flag: 'wx' });
  }
  if (fileHash(paths.staged) !== stagedHash) {
    throw new Error('staged recovery payload hash mismatch');
  }
  if (!existsSync(paths.prepareReceipt)) {
    const prepareReceipt = {
      schemaVersion: 'requirements-contract-recovery-finalization-phase-receipt/v1',
      phase: 'prepare',
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      contractHash: context.contractHash,
      finalizationRunId: context.finalizationRunId,
      logicalIntent: pathHash(cwd, paths.logicalIntent),
      invocationIntent: invocationIntentRef,
      stateDecision: stateDecisionRef,
      backup: pathHash(cwd, paths.backup),
      staged: pathHash(cwd, paths.staged),
      createdAt: new Date().toISOString(),
      readbackVerified: true,
    };
    writeCreateOnlyAndReadback(paths.prepareReceipt, prepareReceipt);
  }
  validatePrepareReceipt(cwd, paths, context);
  if (fileHash(paths.target) === options.expectedTargetPreimageHash) {
    const promotionDraft = `${paths.target}.tmp-${process.pid}-${Date.now()}`;
    copyFileSync(paths.staged, promotionDraft);
    if (fileHash(promotionDraft) !== stagedHash) {
      throw new Error('target promotion draft hash mismatch');
    }
    renameSync(promotionDraft, paths.target);
  }
  if (fileHash(paths.target) !== stagedHash) {
    throw new Error('fixed target promotion readback mismatch');
  }
  if (!existsSync(paths.targetPromotedReceipt)) {
    writeCreateOnlyAndReadback(paths.targetPromotedReceipt, {
      schemaVersion: 'requirements-contract-recovery-finalization-phase-receipt/v1',
      phase: 'target_promoted',
      transactionId: context.transactionId,
      implementationAttemptId: context.implementationAttemptId,
      architectureAuditAttemptId: context.architectureAuditAttemptId,
      contractHash: context.contractHash,
      finalizationRunId: context.finalizationRunId,
      prepareReceipt: pathHash(cwd, paths.prepareReceipt),
      invocationIntent: invocationIntentRef,
      stateDecision: stateDecisionRef,
      target: pathHash(cwd, paths.target),
      createdAt: new Date().toISOString(),
      readbackVerified: true,
    });
  }
  validateTargetPromotedReceipt(cwd, paths, context);
  if (existsSync(paths.finalizationReceipt)) {
    throw new Error('recovery finalization receipt collision');
  }
  const finalizationReceipt = {
    schemaVersion: 'requirements-contract-recovery-finalization-receipt/v1',
    contractHash: context.contractHash,
    authorityBindings: {
      primary: pathHash(cwd, options.authority),
      architectureWave: pathHash(cwd, options.architectureAuthority),
    },
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    finalizationRunId: context.finalizationRunId,
    commitCommandRunId: options.commandRunId,
    commitInvocationSequence: options.invocationSequence,
    provisionalCandidate: provisionalRef,
    initialPublicationReceipt: publicationRef,
    qualifiedRedReceipt,
    acceptedCommandReceipts: Object.fromEntries(commandReceipts),
    inputReceiptSetHash,
    logicalIntent: pathHash(cwd, paths.logicalIntent),
    committingInvocationIntent: invocationIntentRef,
    committingStateDecision: stateDecisionRef,
    prepareReceipt: pathHash(cwd, paths.prepareReceipt),
    targetPromotedReceipt: pathHash(cwd, paths.targetPromotedReceipt),
    staged: pathHash(cwd, paths.staged),
    backup: pathHash(cwd, paths.backup),
    fixedTarget: {
      path: repositoryPath(cwd, paths.target),
      expectedPreimageHash: options.expectedTargetPreimageHash,
      finalHash: fileHash(paths.target),
      readbackHash: fileHash(paths.target),
    },
    publication: {
      writer: 'requirements-contract-recovery-finalize',
      explicitUtf8: true,
      atomicTargetPromotion: true,
      readbackVerified: true,
      committedAt: new Date().toISOString(),
    },
  };
  const validateFinalizationReceipt = schemaValidator(FINALIZATION_RECEIPT_SCHEMA);
  if (!validateFinalizationReceipt(finalizationReceipt)) {
    throw new Error(
      `recovery finalization receipt schema invalid: ${JSON.stringify(
        validateFinalizationReceipt.errors
      )}`
    );
  }
  const finalizationReceiptRef = writeCreateOnlyAndReadback(
    paths.finalizationReceipt,
    finalizationReceipt
  );
  return {
    decision: 'pass' as const,
    passAuthority: false,
    outcome: 'committed' as const,
    artifactPath: repositoryPath(cwd, paths.target),
    artifactHash: fileHash(paths.target),
    invocationIntent: invocationIntentRef,
    stateDecision: stateDecisionRef,
    finalizationReceipt: finalizationReceiptRef,
  };
}

function archiveRecoveryFinalizationFailure(
  options: RecoveryFinalizationOptions,
  error: unknown
): { block: PathHash; archive: PathHash } {
  const cwd = path.resolve(options.cwd);
  const context = readJson(path.resolve(cwd, options.attemptContext));
  const authority = recoverySchemaAuthority();
  const failureBase = assertExactRoot(
    cwd,
    path.resolve(cwd, authority.failureRoot),
    authority.failureRoot,
    'recovery failure root'
  );
  const invocationRoot = path.join(
    failureBase,
    context.transactionId,
    context.implementationAttemptId,
    context.finalizationRunId,
    `${options.invocationSequence}-${options.commandRunId}`
  );
  const archivePath = path.join(invocationRoot, 'failure-archive.json');
  const blockPath = path.join(invocationRoot, 'block.receipt.json');
  if (existsSync(archivePath) || existsSync(blockPath)) {
    if (!existsSync(archivePath) || !existsSync(blockPath)) {
      throw new Error('recovery failure evidence is partially committed');
    }
    const block = readJson(blockPath);
    if (
      block.commandRunId !== options.commandRunId ||
      block.invocationSequence !== options.invocationSequence ||
      block.failureArchive?.hash !== fileHash(archivePath)
    ) {
      throw new Error('recovery failure evidence identity mismatch');
    }
    return {
      archive: pathHash(cwd, archivePath),
      block: pathHash(cwd, blockPath),
    };
  }
  const transactionRoot = path.join(
    path.resolve(cwd, authority.transactionRoot),
    context.transactionId,
    context.implementationAttemptId,
    context.finalizationRunId
  );
  const invocationKey = `${options.invocationSequence}-${options.commandRunId}`;
  const paths = {
    transactionRoot,
    recovery: path.join(transactionRoot, 'provisional', 'recovery-lineage-receipt.json'),
    initialPublicationReceipt: path.join(
      transactionRoot,
      'provisional',
      'recovery-lineage-receipt.publication-receipt.json'
    ),
    logicalIntent: path.join(transactionRoot, 'intent.json'),
    invocationIntent: path.join(
      transactionRoot,
      'invocations',
      `${invocationKey}.intent.json`
    ),
    stateDecision: path.join(
      transactionRoot,
      'observations',
      `${invocationKey}.state-decision.receipt.json`
    ),
    prepareReceipt: path.join(transactionRoot, 'phases', 'prepare.receipt.json'),
    targetPromotedReceipt: path.join(
      transactionRoot,
      'phases',
      'target-promoted.receipt.json'
    ),
    staged: path.join(transactionRoot, 'staged', 'recovery-lineage-receipt.json'),
    backup: path.join(transactionRoot, 'backup', 'recovery-lineage-receipt.json'),
    target: path.resolve(cwd, options.target),
    finalizationReceipt: path.resolve(cwd, options.finalizationReceipt),
  };
  let lastDurableState = 'unavailable';
  if (existsSync(paths.target)) {
    try {
      lastDurableState = classifyRecoveryState(
        paths,
        options.expectedTargetPreimageHash,
        paths.invocationIntent
      );
    } catch {
      lastDurableState = 'unavailable';
    }
  }
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const archive = {
    schemaVersion: 'requirements-contract-recovery-finalization-failure-archive/v1',
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    contractHash: context.contractHash,
    finalizationRunId: context.finalizationRunId,
    commandRunId: options.commandRunId,
    invocationSequence: options.invocationSequence,
    recoveryAction: 'complete_or_observe_finalization',
    lastDurableState,
    error: {
      name: normalizedError.name,
      messageHash: sha256(normalizedError.message),
    },
    observedPathInventory: readPathInventory(paths),
    createdAt: new Date().toISOString(),
  };
  const archiveRef = writeCreateOnlyAndReadback(archivePath, archive);
  const block = {
    schemaVersion: 'requirements-contract-recovery-finalization-block-receipt/v1',
    transactionId: context.transactionId,
    implementationAttemptId: context.implementationAttemptId,
    architectureAuditAttemptId: context.architectureAuditAttemptId,
    contractHash: context.contractHash,
    finalizationRunId: context.finalizationRunId,
    commandRunId: options.commandRunId,
    invocationSequence: options.invocationSequence,
    decision: 'block',
    passAuthority: false,
    outcome: 'blocked',
    recoveryAction: 'complete_or_observe_finalization',
    lastDurableState,
    failureArchive: archiveRef,
    createdAt: new Date().toISOString(),
  };
  const blockRef = writeCreateOnlyAndReadback(blockPath, block);
  return { archive: archiveRef, block: blockRef };
}

export async function requirementsContractRecoveryFinalizeCommand(
  options: RecoveryFinalizationOptions
): Promise<number> {
  try {
    const result = await finalizeRequirementsContractRecoveryLineageReceipt(options);
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    try {
      archiveRecoveryFinalizationFailure(options, error);
    } catch (archiveError) {
      const archiveMessage =
        archiveError instanceof Error ? archiveError.message : String(archiveError);
      process.stderr.write(`recovery failure evidence error: ${archiveMessage}\n`);
    }
    if (options.json) {
      process.stderr.write(
        `${JSON.stringify({ decision: 'block', passAuthority: false, error: message })}\n`
      );
    } else {
      process.stderr.write(`${message}\n`);
    }
    return 1;
  }
}
