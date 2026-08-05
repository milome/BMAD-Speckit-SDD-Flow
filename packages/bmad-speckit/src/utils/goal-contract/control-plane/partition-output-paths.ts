const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require(
  `${__dirname}/canonical-hash${__filename.endsWith('.ts') ? '.ts' : ''}`
);
const { validateGoalContractSchema } = require(
  `${__dirname}/schema-registry${__filename.endsWith('.ts') ? '.ts' : ''}`
);
const { readValidatedPartitionReceipt } = require(
  `${__dirname}/../partition-receipts${__filename.endsWith('.ts') ? '.ts' : ''}`
);
const {
  buildPartitionPlanGlobalCoverageReceipt,
  buildPartitionPlanSelectionReceipt,
} = require(
  `${__dirname}/../partition-selector${__filename.endsWith('.ts') ? '.ts' : ''}`
);

export type GoalContractPartitionOutputPathsModule = never;

const OUTPUT_AUTHORITY_SCHEMA =
  'goal-contract-partition-output-authority.schema.json';
const GOAL_AUTHORITY_WRITER_ID =
  'goal-contract-authority-supersession';
const GOAL_AUTHORITY_EVENT_TYPE =
  'goal_contract_partition_authority_superseded';
const GOAL_AUTHORITY_PAYLOAD_CONTRACT =
  'goal-contract-partition-authority-supersession/v1';
const GOAL_AUTHORITY_WRITTEN_FIELD =
  'nativeGoalHandoff.goalContractPartitionAuthority';
const GOAL_AUTHORITY_RECEIPT_PATH =
  '_bmad-output/runtime/requirement-records/<requirement-set-id>/events/receipts/<event-id>.json';
const GOAL_AUTHORITY_ALLOWED_PATHS = Object.freeze([
  '_bmad-output/runtime/requirement-records/<requirement-set-id>/requirement-record.json',
  '_bmad-output/runtime/requirement-records/<requirement-set-id>/events/control-events.jsonl',
  GOAL_AUTHORITY_RECEIPT_PATH,
  '_bmad-output/runtime/requirement-records/<requirement-set-id>/goal-contract/partition-runs/<partition-run-id>',
  '_bmad-output/runtime/requirement-records/<requirement-set-id>/goal-contract/active-partition-run.json',
  '_bmad-output/runtime/requirement-records/<requirement-set-id>/goal-contract/pointer-projection-blocked.json',
]);
const GENERATION_KEY_FIELDS = Object.freeze([
  'sourceHash',
  'templateHash',
  'profileHash',
  'compilerIdentityHash',
  'methodologyProfileHash',
  'partitionPolicyHash',
  'sourceCompositionPolicyHash',
  'partitionImpactGraphHash',
]);

function failure(
  failureClass: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function sha256Bytes(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizePath(value: string): string {
  return path.resolve(value).replace(/\\/gu, '/');
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function isSameOrWithin(root: string, target: string): boolean {
  return path.resolve(root) === path.resolve(target) ||
    isWithin(root, target);
}

function pathsOverlap(left: string, right: string): boolean {
  return isSameOrWithin(left, right) ||
    isSameOrWithin(right, left);
}

function requireSha256(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/u.test(value)
  ) {
    throw failure('partition_generation_identity_invalid', { field });
  }
  return value;
}

function computePartitionGenerationKey(input: Record<string, unknown>): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw failure('partition_generation_identity_invalid');
  }
  const tuple = Object.fromEntries(
    GENERATION_KEY_FIELDS.map((field) => [
      field,
      requireSha256(input[field], field),
    ])
  );
  return hashControlPlaneValue(tuple);
}

function requireRequirementSetId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  ) {
    throw failure('partition_requirement_set_id_invalid');
  }
  return value;
}

function requirePartitionRunId(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !/^partition-run-[0-9a-f]{64}$/u.test(value)
  ) {
    throw failure('partition_run_id_invalid');
  }
  return value;
}

function currentGoalAuthorityWriterScript() {
  const sourceMode = __filename.endsWith('.ts');
  const scriptPath = sourceMode
    ? 'packages/bmad-speckit/src/utils/goal-contract/control-plane/authority-supersession.ts'
    : 'dist/utils/goal-contract/control-plane/authority-supersession.js';
  const absolutePath = path.join(
    __dirname,
    `authority-supersession.${sourceMode ? 'ts' : 'js'}`
  );
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw failure('partition_authority_writer_not_authorized', {
      reason: 'writer_script_missing',
      scriptPath,
    });
  }
  return Object.freeze({
    scriptPath,
    scriptContentHash: sha256Bytes(fs.readFileSync(absolutePath)),
  });
}

function goalContractAuthorityWriterBinding(
  input: Record<string, unknown>
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw failure('partition_authority_writer_binding_invalid');
  }
  const registryHash = requireSha256(
    input.registryHash,
    'registryHash'
  );
  const architectureConfirmationHash = requireSha256(
    input.architectureConfirmationHash,
    'architectureConfirmationHash'
  );
  const script = currentGoalAuthorityWriterScript();
  const eventTypes = Object.freeze([GOAL_AUTHORITY_EVENT_TYPE]);
  const allowedWriteApis = Object.freeze([
    'appendControlEventAndReplay',
  ]);
  const payloadContractRefs = Object.freeze([
    GOAL_AUTHORITY_PAYLOAD_CONTRACT,
  ]);
  const writesControlFields = Object.freeze([
    GOAL_AUTHORITY_WRITTEN_FIELD,
  ]);
  const writerHashMaterial = {
    writerId: GOAL_AUTHORITY_WRITER_ID,
    scriptPath: script.scriptPath,
    scriptContentHash: script.scriptContentHash,
    ownerModel: 'implementation_readiness',
    allowedWriteApis,
    allowedPaths: GOAL_AUTHORITY_ALLOWED_PATHS,
    allowedEventTypes: eventTypes,
    payloadContractRefs,
    writesControlFields,
    receiptPath: GOAL_AUTHORITY_RECEIPT_PATH,
    beforeAfterHashRequired: true,
    canModifyWriterRegistry: false,
    registryHash,
    architectureConfirmationHash,
  };
  return Object.freeze({
    writerId: GOAL_AUTHORITY_WRITER_ID,
    eventTypes,
    writerHash: hashControlPlaneValue(writerHashMaterial),
    scriptPath: script.scriptPath,
    scriptContentHash: script.scriptContentHash,
    ownerModel: 'implementation_readiness',
    allowedWriteApis,
    allowedPaths: GOAL_AUTHORITY_ALLOWED_PATHS,
    payloadContractRefs,
    writesControlFields,
    receiptPath: GOAL_AUTHORITY_RECEIPT_PATH,
    beforeAfterHashRequired: true,
    canModifyWriterRegistry: false,
    registryHash,
    architectureConfirmationHash,
  });
}

function preflightRequirementRecordPartitionAuthoritySupersession(
  input: Record<string, unknown>
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.repositoryRoot !== 'string'
  ) {
    throw failure('partition_authority_record_invalid');
  }
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const requirementSetId = requireRequirementSetId(
    input.requirementSetId
  );
  const sourceHash = requireSha256(input.sourceHash, 'sourceHash');
  const expectedRecordPath = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'requirement-record.json'
  );
  const recordPath = path.resolve(
    typeof input.recordPath === 'string'
      ? input.recordPath
      : expectedRecordPath
  );
  if (recordPath !== path.resolve(expectedRecordPath)) {
    throw failure('partition_requirement_record_path_invalid', {
      expectedRecordPath: normalizePath(expectedRecordPath),
      recordPath: normalizePath(recordPath),
    });
  }
  if (!fs.existsSync(recordPath) || !fs.statSync(recordPath).isFile()) {
    throw failure('partition_authority_record_missing', {
      recordPath: normalizePath(recordPath),
    });
  }
  let record: Record<string, unknown>;
  try {
    record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
  } catch {
    throw failure('partition_authority_record_invalid', {
      recordPath: normalizePath(recordPath),
    });
  }
  if (
    record.requirementSetId !== requirementSetId ||
    !record.nativeGoalHandoff ||
    typeof record.nativeGoalHandoff !== 'object'
  ) {
    throw failure('partition_authority_record_invalid', {
      recordPath: normalizePath(recordPath),
    });
  }
  const handoff = record.nativeGoalHandoff as Record<string, unknown>;
  const sourceIdentity =
    handoff.masterImplementationPlanHash ??
    (
      handoff.goalContractSourceIdentity as
        | Record<string, unknown>
        | undefined
    )?.masterImplementationPlanHash;
  if (sourceIdentity !== sourceHash) {
    throw failure('partition_authority_source_identity_mismatch', {
      expectedSourceHash: sourceIdentity,
      actualSourceHash: sourceHash,
    });
  }
  const writers = Array.isArray(
    record.controlledIngestWriterRegistry
  )
    ? record.controlledIngestWriterRegistry.filter(
        (writer) =>
          writer &&
          typeof writer === 'object' &&
          !Array.isArray(writer)
      )
    : [];
  const registryHash = record.controlledIngestWriterRegistryHash;
  const expectedRegistryHash = sha256Bytes(
    JSON.stringify({
      schemaVersion: 'controlled-ingest-writer-registry/v1',
      sourceDocumentHash: record.sourceDocumentHash,
      implementationConfirmationHash:
        record.implementationConfirmationHash,
      writers,
    })
  );
  const matchingWriters = writers.filter(
    (writer) =>
      (writer as Record<string, unknown>).writerId ===
      GOAL_AUTHORITY_WRITER_ID
  ) as Record<string, unknown>[];
  const architectureState =
    record.architectureConfirmationState as
      | Record<string, unknown>
      | undefined;
  const architectureConfirmationHash =
    architectureState?.currentArchitectureConfirmationHash;
  if (
    record.controlledIngestWriterRegistryRequired !== true ||
    !/^sha256:[0-9a-f]{64}$/u.test(String(registryHash ?? '')) ||
    registryHash !== expectedRegistryHash ||
    matchingWriters.length !== 1 ||
    !/^sha256:[0-9a-f]{64}$/u.test(
      String(architectureConfirmationHash ?? '')
    )
  ) {
    throw failure('partition_authority_writer_not_authorized', {
      reason: 'writer_registry_invalid',
    });
  }
  const writer = matchingWriters[0];
  if (
    !/^sha256:[0-9a-f]{64}$/u.test(
      String(writer.registryHash ?? '')
    )
  ) {
    throw failure('partition_authority_writer_not_authorized', {
      reason: 'writer_binding_invalid',
    });
  }
  const expectedWriter = goalContractAuthorityWriterBinding({
    registryHash: writer.registryHash,
    architectureConfirmationHash,
  });
  if (
    writer.architectureConfirmationHash !==
      architectureConfirmationHash ||
    stableControlPlaneStringify(writer) !==
      stableControlPlaneStringify(expectedWriter)
  ) {
    throw failure('partition_authority_writer_not_authorized', {
      reason: 'writer_binding_invalid',
    });
  }
  return Object.freeze({
    record: Object.freeze(record),
    recordPath,
    authorityRoot: path.join(
      path.dirname(recordPath),
      'goal-contract'
    ),
    writer: expectedWriter,
  });
}

function resolveCanonicalPartitionOutputPaths(
  input: Record<string, unknown>
) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw failure('partition_output_authority_request_invalid');
  }
  if (
    typeof input.repositoryRoot !== 'string' ||
    input.repositoryRoot.length === 0
  ) {
    throw failure('partition_repository_root_invalid');
  }
  const sourceHash = requireSha256(input.sourceHash, 'sourceHash');
  const generationKey = computePartitionGenerationKey(input);
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const requirementRecordMode =
    input.requirementSetId !== undefined ||
    input.partitionRunId !== undefined;
  const requirementSetId = requirementRecordMode
    ? requireRequirementSetId(input.requirementSetId)
    : null;
  const partitionRunId = requirementRecordMode
    ? requirePartitionRunId(input.partitionRunId)
    : null;
  const authorityRoot = requirementRecordMode
    ? path.join(
        repositoryRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requirementSetId,
        'goal-contract'
      )
    : path.join(
        repositoryRoot,
        '_bmad-output',
        'runtime',
        'goal-contract-partition-bootstrap',
        sourceHash.slice('sha256:'.length)
      );
  if (input.authorityRootOverride !== undefined) {
    if (
      typeof input.authorityRootOverride !== 'string' ||
      path.resolve(repositoryRoot, input.authorityRootOverride) !==
        authorityRoot
    ) {
      throw failure(
        'partition_governed_authority_override_rejected',
        { expectedAuthorityRoot: authorityRoot }
      );
    }
  }
  if (requirementRecordMode) {
    preflightRequirementRecordPartitionAuthoritySupersession({
      repositoryRoot,
      requirementSetId,
      sourceHash,
      recordPath: path.join(
        repositoryRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        requirementSetId,
        'requirement-record.json'
      ),
    });
  }
  const unitRoot = requirementRecordMode
    ? path.join(authorityRoot, 'partition-runs', partitionRunId)
    : path.join(
        authorityRoot,
        'generations',
        generationKey.slice('sha256:'.length)
      );
  return Object.freeze({
    repositoryRoot,
    authorityMode: requirementRecordMode
      ? 'requirement_record'
      : 'standalone_bootstrap',
    sourceHash,
    generationKey,
    ...(requirementRecordMode
      ? { requirementSetId, partitionRunId }
      : {}),
    authorityRoot,
    unitRoot,
    activePointerPath: path.join(
      authorityRoot,
      requirementRecordMode
        ? 'active-partition-run.json'
        : 'active-generation.json'
    ),
    partitionPlanPath: path.join(unitRoot, 'partition-plan.json'),
    partitionManifestPath: path.join(unitRoot, 'partition-manifest.json'),
    childrenDir: path.join(unitRoot, 'children'),
    receiptsDir: path.join(unitRoot, 'receipts'),
    evidenceDir: path.join(unitRoot, 'evidence'),
    lifecycleDir: path.join(unitRoot, 'lifecycle'),
  });
}

function assertRawNonAuthoritativeContainmentRoot(
  input: Record<string, unknown>
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.repositoryRoot !== 'string' ||
    typeof input.containmentRoot !== 'string'
  ) {
    throw failure('partition_raw_output_request_invalid');
  }
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const containmentRoot = path.resolve(
    repositoryRoot,
    input.containmentRoot
  );
  const candidatePaths = [
    containmentRoot,
    ...(Array.isArray(input.paths)
      ? input.paths
          .filter((value): value is string => typeof value === 'string')
          .map((value) => path.resolve(repositoryRoot, value))
      : []),
  ];
  const runtimeRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime'
  );
  const requirementRecordsRoot = path.join(
    runtimeRoot,
    'requirement-records'
  );
  if (
    candidatePaths.some((candidate) =>
      isSameOrWithin(requirementRecordsRoot, candidate)
    )
  ) {
    throw failure('partition_raw_cross_requirement_placement', {
      containmentRoot: normalizePath(containmentRoot),
    });
  }
  const bootstrapRoot = path.join(
    runtimeRoot,
    'goal-contract-partition-bootstrap'
  );
  if (
    candidatePaths.some((candidate) =>
      isSameOrWithin(bootstrapRoot, candidate)
    ) ||
    (
      isSameOrWithin(runtimeRoot, containmentRoot) &&
      (
        isSameOrWithin(containmentRoot, requirementRecordsRoot) ||
        isSameOrWithin(containmentRoot, bootstrapRoot)
      )
    )
  ) {
    throw failure('partition_raw_authority_root_overlap', {
      containmentRoot: normalizePath(containmentRoot),
    });
  }
  return containmentRoot;
}

function resolveRawPartitionOutputPaths(
  input: Record<string, unknown>
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.repositoryRoot !== 'string' ||
    typeof input.outPath !== 'string' ||
    input.outPath.length === 0
  ) {
    throw failure('partition_raw_output_request_invalid');
  }
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const outputPath = path.resolve(repositoryRoot, input.outPath);
  const containmentRoot = path.resolve(
    repositoryRoot,
    typeof input.outRoot === 'string' && input.outRoot.length > 0
      ? input.outRoot
      : path.dirname(outputPath)
  );
  const receiptsDir = path.resolve(
    repositoryRoot,
    typeof input.receiptsDir === 'string' &&
      input.receiptsDir.length > 0
      ? input.receiptsDir
      : path.join(containmentRoot, '.goal-contract-receipts')
  );
  if (
    !isSameOrWithin(containmentRoot, outputPath) ||
    !isSameOrWithin(containmentRoot, receiptsDir)
  ) {
    throw failure('partition_raw_output_path_escape', {
      containmentRoot: normalizePath(containmentRoot),
      outputPath: normalizePath(outputPath),
      receiptsDir: normalizePath(receiptsDir),
    });
  }
  assertRawNonAuthoritativeContainmentRoot({
    repositoryRoot,
    containmentRoot,
    paths: [outputPath, receiptsDir],
  });
  if (pathsOverlap(outputPath, receiptsDir)) {
    throw failure('partition_output_path_overlap', {
      receiptsDir: normalizePath(receiptsDir),
      activeManifestPath: normalizePath(outputPath),
    });
  }
  return Object.freeze({
    authorityMode: 'raw_non_authoritative',
    containmentRoot,
    outputPath,
    receiptsDir,
  });
}

function writeImmutableAuthorityFile(input: Record<string, unknown>) {
  const authority = input?.authority as Record<string, unknown>;
  if (
    !authority ||
    typeof authority.unitRoot !== 'string' ||
    typeof input.targetPath !== 'string' ||
    (!Buffer.isBuffer(input.bytes) && typeof input.bytes !== 'string')
  ) {
    throw failure('partition_authority_write_request_invalid');
  }
  const targetPath = path.resolve(input.targetPath);
  if (!isWithin(authority.unitRoot, targetPath)) {
    throw failure('partition_authority_artifact_path_invalid', {
      targetPath: normalizePath(targetPath),
    });
  }
  const bytes = Buffer.isBuffer(input.bytes)
    ? input.bytes
    : Buffer.from(input.bytes, 'utf8');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  try {
    fs.writeFileSync(targetPath, bytes, { flag: 'wx' });
    return Object.freeze({
      targetPath: normalizePath(targetPath),
      contentHash: sha256Bytes(bytes),
      created: true,
      idempotent: false,
    });
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  const existing = fs.readFileSync(targetPath);
  if (!existing.equals(bytes)) {
    throw failure('partition_immutable_bytes_conflict', {
      targetPath: normalizePath(targetPath),
      existingHash: sha256Bytes(existing),
      requestedHash: sha256Bytes(bytes),
    });
  }
  return Object.freeze({
    targetPath: normalizePath(targetPath),
    contentHash: sha256Bytes(existing),
    created: false,
    idempotent: true,
  });
}

function requireRelativeAuthorityArtifact(
  authority: Record<string, unknown>,
  relativePath: unknown
): string {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    path.isAbsolute(relativePath) ||
    /^[A-Za-z]:[\\/]/u.test(relativePath) ||
    relativePath.split(/[\\/]/u).includes('..')
  ) {
    throw failure('partition_authority_artifact_path_invalid');
  }
  const targetPath = path.resolve(
    authority.unitRoot as string,
    relativePath
  );
  if (!isWithin(authority.unitRoot as string, targetPath)) {
    throw failure('partition_authority_artifact_path_invalid');
  }
  return targetPath;
}

function requireAuthorityChildArtifact(
  authority: Record<string, unknown>,
  childContractPath: unknown
): string {
  const unitRelativePath = requireRelativeAuthorityArtifact(
    authority,
    childContractPath
  );
  if (typeof authority.repositoryRoot !== 'string') {
    return unitRelativePath;
  }
  const repositoryRelativePath = path.resolve(
    authority.repositoryRoot,
    String(childContractPath)
  );
  if (authority.repositoryRootRelativeChildren === true) {
    if (
      !isWithin(
        authority.unitRoot as string,
        repositoryRelativePath
      )
    ) {
      throw failure('canonical_partition_child_path_invalid', {
        childContractPath,
      });
    }
    return repositoryRelativePath;
  }
  return isWithin(authority.unitRoot as string, repositoryRelativePath)
    ? repositoryRelativePath
    : unitRelativePath;
}

function comparableRealPath(value: string): string {
  const normalized = path.resolve(value);
  return process.platform === 'win32'
    ? normalized.toLowerCase()
    : normalized;
}

function assertCanonicalAuthorityPath(
  rootPath: string,
  targetPath: string
) {
  const relativePath = path.relative(
    path.resolve(rootPath),
    path.resolve(targetPath)
  );
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw failure('canonical_partition_authority_symlink_rejected', {
      targetPath: normalizePath(targetPath),
    });
  }
  let realRoot;
  let realTarget;
  try {
    realRoot = fs.realpathSync.native(rootPath);
    realTarget = fs.realpathSync.native(targetPath);
  } catch {
    throw failure('canonical_partition_authority_symlink_rejected', {
      targetPath: normalizePath(targetPath),
    });
  }
  const expectedRealTarget = path.resolve(
    realRoot,
    relativePath
  );
  if (
    !isSameOrWithin(realRoot, realTarget) ||
    comparableRealPath(realTarget) !==
      comparableRealPath(expectedRealTarget)
  ) {
    throw failure('canonical_partition_authority_symlink_rejected', {
      targetPath: normalizePath(targetPath),
    });
  }
}

function readCanonicalAuthorityJson(
  authority: Record<string, unknown>,
  relativePath: string,
  incompleteFailureClass: string,
  invalidJsonFailureClass: string
) {
  const targetPath = requireRelativeAuthorityArtifact(authority, relativePath);
  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    throw failure(incompleteFailureClass, {
      targetPath: normalizePath(targetPath),
    });
  }
  assertCanonicalAuthorityPath(
    authority.unitRoot as string,
    targetPath
  );
  const bytes = fs.readFileSync(targetPath);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw failure(invalidJsonFailureClass, {
      targetPath: normalizePath(targetPath),
    });
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    bytes.toString('utf8') !== `${stableControlPlaneStringify(value)}\n`
  ) {
    throw failure(invalidJsonFailureClass, {
      targetPath: normalizePath(targetPath),
      reason: 'noncanonical_bytes',
    });
  }
  return Object.freeze({ targetPath, bytes, value });
}

function validateAuthoritySchema(
  schemaName: string,
  value: unknown,
  failureClass: string
) {
  try {
    validateGoalContractSchema(schemaName, value);
  } catch (error) {
    if (error?.failureClass === 'canonical_schema_invalid') {
      throw failure(failureClass, {
        validationErrors: error.validationErrors || [],
      });
    }
    throw error;
  }
}

function assertAuthorityBinding(
  actual: unknown,
  expected: unknown,
  failureClass: string,
  field: string
) {
  if (actual !== expected) {
    throw failure(failureClass, { field, actual, expected });
  }
}

function assertAuthorityPathBinding(
  actual: unknown,
  expected: unknown,
  failureClass: string,
  field: string
) {
  if (
    typeof actual !== 'string' ||
    typeof expected !== 'string'
  ) {
    throw failure(failureClass, { field, actual, expected });
  }
  let actualRealPath;
  let expectedRealPath;
  try {
    actualRealPath = fs.realpathSync.native(actual);
    expectedRealPath = fs.realpathSync.native(expected);
  } catch {
    throw failure(failureClass, { field, actual, expected });
  }
  if (
    comparableRealPath(actualRealPath) !==
    comparableRealPath(expectedRealPath)
  ) {
    throw failure(failureClass, { field, actual, expected });
  }
}

function normalizeRelativeArtifactSet(
  authority: Record<string, unknown>,
  values: unknown,
  failureClass: string
): string[] {
  if (!Array.isArray(values)) {
    throw failure(failureClass);
  }
  const normalized = values.map((relativePath) => {
    requireRelativeAuthorityArtifact(authority, relativePath);
    return String(relativePath).replace(/\\/gu, '/');
  });
  if (new Set(normalized).size !== normalized.length) {
    throw failure(failureClass, { reason: 'duplicate_path' });
  }
  return normalized.sort();
}

function normalizeChildArtifactSet(
  authority: Record<string, unknown>,
  values: unknown,
  failureClass: string
): string[] {
  if (!Array.isArray(values)) {
    throw failure(failureClass);
  }
  const normalized = values.map((childContractPath) => {
    requireAuthorityChildArtifact(authority, childContractPath);
    return String(childContractPath).replace(/\\/gu, '/');
  });
  if (new Set(normalized).size !== normalized.length) {
    throw failure(failureClass, { reason: 'duplicate_path' });
  }
  return normalized.sort();
}

function semanticPartitionManifestHash(
  manifest: Record<string, unknown>
): string {
  const impactAuthority =
    typeof manifest.partitionImpactGraphHash === 'string';
  return hashControlPlaneValue({
    goalContractHash: manifest.goalContractHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash:
      manifest.sourceAuthorityBundleHash,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    ...(manifest.aggregateValidation
      ? {
          taskExecutionRoleAuthorityHash:
            manifest.taskExecutionRoleAuthorityHash,
          aggregateValidation: manifest.aggregateValidation,
        }
      : {}),
    ...(impactAuthority
      ? {
          repositoryTreeHash: manifest.repositoryTreeHash,
          partitionImpactPolicyHash:
            manifest.partitionImpactPolicyHash,
          partitionImpactAnalyzerIdentityHash:
            manifest.partitionImpactAnalyzerIdentityHash,
          partitionImpactGraphHash:
            manifest.partitionImpactGraphHash,
          partitionImpactGraphDocumentHash:
            manifest.partitionImpactGraphDocumentHash,
          partitionClosureFeasibilityReceiptHash:
            manifest.partitionClosureFeasibilityReceiptHash,
          partitionImpactDriftReceiptHash:
            manifest.partitionImpactDriftReceiptHash,
          driftHash: manifest.driftHash,
        }
      : {}),
    orderedChildContractHashes:
      manifest.orderedChildContractHashes,
  });
}

function validateImmutablePartitionAuthorityUnit(
  input: Record<string, unknown>
) {
  const authority = input?.authority as Record<string, unknown>;
  const incompleteFailureClass =
    typeof input.incompleteFailureClass === 'string'
      ? input.incompleteFailureClass
      : 'partition_generation_incomplete';
  if (
    !authority ||
    typeof authority.unitRoot !== 'string' ||
    !fs.existsSync(authority.unitRoot) ||
    !fs.statSync(authority.unitRoot).isDirectory()
  ) {
    throw failure(incompleteFailureClass);
  }

  const manifestArtifact = readCanonicalAuthorityJson(
    authority,
    'partition-manifest.json',
    incompleteFailureClass,
    'partition_manifest_invalid_json'
  );
  validateAuthoritySchema(
    'goal-contract-partition-manifest.schema.json',
    manifestArtifact.value,
    'partition_manifest_schema_invalid'
  );
  const manifest = manifestArtifact.value as Record<string, unknown>;
  const planArtifact = readCanonicalAuthorityJson(
    authority,
    'partition-plan.json',
    incompleteFailureClass,
    'partition_plan_invalid_json'
  );
  validateAuthoritySchema(
    'goal-contract-partition-plan.schema.json',
    planArtifact.value,
    'partition_plan_schema_invalid'
  );
  const partitionPlan = planArtifact.value as Record<string, unknown>;
  const partitionPlanMaterial = structuredClone(partitionPlan);
  delete partitionPlanMaterial.partitionPlanHash;
  const partitionPlanHash = hashControlPlaneValue(partitionPlanMaterial);
  assertAuthorityBinding(
    partitionPlan.partitionPlanHash,
    partitionPlanHash,
    'partition_plan_hash_mismatch',
    'partitionPlanHash'
  );
  const analysisPath = String(manifest.partitionAnalysisReceiptPath || '');
  const analysisArtifact = readCanonicalAuthorityJson(
    authority,
    analysisPath,
    incompleteFailureClass,
    'partition_analysis_receipt_invalid_json'
  );
  validateAuthoritySchema(
    'goal-contract-partition-analysis-receipt.schema.json',
    analysisArtifact.value,
    'partition_analysis_receipt_schema_invalid'
  );
  const analysisReceipt =
    analysisArtifact.value as Record<string, unknown>;
  const partitionAnalysisReceiptHash = sha256Bytes(
    analysisArtifact.bytes
  );
  const partitionManifestDocumentHash = sha256Bytes(
    manifestArtifact.bytes
  );
  const partitionManifestHash = semanticPartitionManifestHash(manifest);
  assertAuthorityBinding(
    manifest.partitionManifestHash,
    partitionManifestHash,
    'partition_manifest_hash_mismatch',
    'partitionManifestHash'
  );
  assertAuthorityBinding(
    manifest.partitionAnalysisReceiptHash,
    partitionAnalysisReceiptHash,
    'partition_manifest_currentness_mismatch',
    'partitionAnalysisReceiptHash'
  );
  const expectedPartitionRunId =
    `partition-run-${hashControlPlaneValue({
      partitionPlanHash,
      orderedChildContractHashes:
        manifest.orderedChildContractHashes,
    }).slice('sha256:'.length)}`;
  assertAuthorityBinding(
    manifest.partitionRunId,
    expectedPartitionRunId,
    'partition_manifest_currentness_mismatch',
    'partitionRunId'
  );
  assertAuthorityBinding(
    manifest.manifestId,
    `partition-manifest-${partitionManifestHash.slice(
      'sha256:'.length
    )}`,
    'partition_manifest_currentness_mismatch',
    'manifestId'
  );
  assertAuthorityBinding(
    stableControlPlaneStringify(manifest.topologicalOrder),
    stableControlPlaneStringify(partitionPlan.topologicalOrder),
    'partition_authority_plan_manifest_mismatch',
    'topologicalOrder'
  );

  for (const field of [
    'goalContractHash',
    'sourceCompositionPolicyHash',
    'sourceAuthorityBundleHash',
    'partitionPolicyHash',
    'partitionPlanHash',
    'partitionSetHash',
    'repositoryTreeHash',
    'partitionImpactPolicyHash',
    'partitionImpactAnalyzerIdentityHash',
    'partitionImpactGraphHash',
    'partitionImpactGraphDocumentHash',
    'partitionClosureFeasibilityReceiptHash',
    'partitionImpactDriftReceiptHash',
    'driftHash',
  ]) {
    if (manifest[field] !== undefined || partitionPlan[field] !== undefined) {
      assertAuthorityBinding(
        manifest[field],
        partitionPlan[field],
        'partition_authority_plan_manifest_mismatch',
        field
      );
    }
  }
  for (const field of [
    'partitionRunId',
    'partitionPlanHash',
    'partitionSetHash',
    'sourceSnapshotHash',
    'methodologyProfileHash',
    'executionProjectionHash',
    'taskDagHash',
    'partitionPolicyHash',
    'optimizerVersion',
    'selectedCandidateId',
    'repositoryTreeHash',
    'partitionImpactPolicyHash',
    'partitionImpactAnalyzerIdentityHash',
    'partitionImpactGraphHash',
    'partitionImpactGraphDocumentHash',
    'partitionClosureFeasibilityReceiptHash',
    'partitionImpactDriftReceiptHash',
    'driftHash',
  ]) {
    if (manifest[field] !== undefined || analysisReceipt[field] !== undefined) {
      assertAuthorityBinding(
        manifest[field],
        analysisReceipt[field],
        'partition_manifest_currentness_mismatch',
        field
      );
    }
  }

  const childContractHashes = [];
  const manifestChildContractPaths = [];
  const requiredReceiptPaths = [
    analysisPath,
    String(manifest.globalCoverageReceiptPath || ''),
  ];
  for (const field of [
    'partitionImpactGraphPath',
    'partitionClosureFeasibilityReceiptPath',
    'partitionImpactDriftReceiptPath',
  ]) {
    if (typeof manifest[field] === 'string') {
      requiredReceiptPaths.push(manifest[field] as string);
    }
  }

  const partitions = manifest.partitions as Record<string, unknown>[];
  for (const partition of partitions) {
    const partitionId = String(partition.partitionId);
    const childContractPath = String(partition.childContractPath || '');
    const childPath = requireAuthorityChildArtifact(
      authority,
      childContractPath
    );
    if (!fs.existsSync(childPath) || !fs.statSync(childPath).isFile()) {
      throw failure(incompleteFailureClass, {
        targetPath: normalizePath(childPath),
      });
    }
    assertCanonicalAuthorityPath(
      authority.unitRoot as string,
      childPath
    );
    const childHash = sha256Bytes(fs.readFileSync(childPath));
    assertAuthorityBinding(
      childHash,
      partition.childContractHash,
      'partition_child_contract_hash_mismatch',
      partitionId
    );
    manifestChildContractPaths.push(childContractPath);
    childContractHashes.push(
      Object.freeze({
        path: path
          .relative(authority.unitRoot as string, childPath)
          .replace(/\\/gu, '/'),
        hash: childHash,
      })
    );
    requiredReceiptPaths.push(
      String(partition.selectionReceiptPath || ''),
      `receipts/children/${partitionId}.compilation.json`,
      `receipts/children/${partitionId}.coverage.json`,
      `receipts/children/${partitionId}.generation.json`,
      `receipts/children/${partitionId}.membership.json`
    );
  }
  assertAuthorityBinding(
    stableControlPlaneStringify(
      childContractHashes.map(({ hash }) => hash)
    ),
    stableControlPlaneStringify(manifest.orderedChildContractHashes),
    'partition_child_contract_hash_mismatch',
    'orderedChildContractHashes'
  );

  const globalPath = String(manifest.globalCoverageReceiptPath || '');
  const globalTarget = requireRelativeAuthorityArtifact(
    authority,
    globalPath
  );
  if (!fs.existsSync(globalTarget)) {
    throw failure(incompleteFailureClass, {
      targetPath: normalizePath(globalTarget),
    });
  }
  assertCanonicalAuthorityPath(
    authority.unitRoot as string,
    globalTarget
  );
  const globalCoverage = readValidatedPartitionReceipt(
    globalTarget,
    'goal-contract-partition-global-coverage-receipt/v1'
  );
  const globalCoverageHash = sha256Bytes(fs.readFileSync(globalTarget));
  const expectedGlobalCoverage =
    buildPartitionPlanGlobalCoverageReceipt({
      partitionPlan,
      candidateManifest: manifest,
    });
  if (
    stableControlPlaneStringify(globalCoverage) !==
    stableControlPlaneStringify(expectedGlobalCoverage)
  ) {
    throw failure('partition_global_coverage_binding_mismatch');
  }

  for (const partition of partitions) {
    const partitionId = String(partition.partitionId);
    const selectionPath = String(partition.selectionReceiptPath || '');
    const selectionTarget = requireRelativeAuthorityArtifact(
      authority,
      selectionPath
    );
    if (!fs.existsSync(selectionTarget)) {
      throw failure(incompleteFailureClass, {
        targetPath: normalizePath(selectionTarget),
      });
    }
    assertCanonicalAuthorityPath(
      authority.unitRoot as string,
      selectionTarget
    );
    const selection = readValidatedPartitionReceipt(
      selectionTarget,
      'goal-contract-partition-selection-receipt/v1'
    );
    const selectionHash = sha256Bytes(fs.readFileSync(selectionTarget));
    const expectedSelection = buildPartitionPlanSelectionReceipt({
      partitionPlan,
      partitionManifest: manifest,
      partitionId,
    });
    if (
      stableControlPlaneStringify(selection) !==
      stableControlPlaneStringify(expectedSelection)
    ) {
      throw failure('partition_selection_binding_mismatch', {
        partitionId,
      });
    }

    const compilationPath =
      `receipts/children/${partitionId}.compilation.json`;
    const compilationArtifact = readCanonicalAuthorityJson(
      authority,
      compilationPath,
      incompleteFailureClass,
      'partition_child_compilation_receipt_invalid'
    );
    const compilation =
      compilationArtifact.value as Record<string, unknown>;
    for (const [field, expected] of Object.entries({
      schemaVersion:
        'goal-contract-pending-child-compilation-receipt/v1',
      membershipStatus: 'pending',
      partitionId,
      childContractPath: partition.childContractPath,
      childContractHash: partition.childContractHash,
      partitionPlanHash,
      partitionSetHash: manifest.partitionSetHash,
      selectionHash: partition.selectionSetHash,
      receiptHash: partition.childCompilationReceiptHash,
    })) {
      assertAuthorityBinding(
        compilation[field],
        expected,
        'partition_child_compilation_binding_mismatch',
        `${partitionId}.${field}`
      );
    }

    const coveragePath =
      `receipts/children/${partitionId}.coverage.json`;
    const coverageTarget = requireRelativeAuthorityArtifact(
      authority,
      coveragePath
    );
    if (!fs.existsSync(coverageTarget)) {
      throw failure(incompleteFailureClass, {
        targetPath: normalizePath(coverageTarget),
      });
    }
    assertCanonicalAuthorityPath(
      authority.unitRoot as string,
      coverageTarget
    );
    const coverage = readValidatedPartitionReceipt(
      coverageTarget,
      'goal-contract-partition-child-coverage-receipt/v1'
    );
    const coverageHash = sha256Bytes(fs.readFileSync(coverageTarget));
    for (const [field, expected] of Object.entries({
      decision: 'pass',
      partitionId,
      partitionManifestHash: partitionManifestDocumentHash,
      selectionReceiptHash: selectionHash,
      globalCoverageReceiptHash: globalCoverageHash,
    })) {
      assertAuthorityBinding(
        coverage[field],
        expected,
        'partition_child_coverage_binding_mismatch',
        `${partitionId}.${field}`
      );
    }

    const generationPath =
      `receipts/children/${partitionId}.generation.json`;
    const generationTarget = requireRelativeAuthorityArtifact(
      authority,
      generationPath
    );
    if (!fs.existsSync(generationTarget)) {
      throw failure(incompleteFailureClass, {
        targetPath: normalizePath(generationTarget),
      });
    }
    assertCanonicalAuthorityPath(
      authority.unitRoot as string,
      generationTarget
    );
    const generation = readValidatedPartitionReceipt(
      generationTarget,
      'goal-contract-partition-child-generation-receipt/v1'
    );
    for (const [field, expected] of Object.entries({
      decision: 'pass',
      partitionId,
      partitionManifestHash: partitionManifestDocumentHash,
      partitionAnalysisReceiptHash: sha256Bytes(analysisArtifact.bytes),
      partitionSetHash: manifest.partitionSetHash,
      goalContractHash: partition.childContractHash,
      selectionReceiptHash: selectionHash,
      selectionSetHash: partition.selectionSetHash,
      globalCoverageReceiptHash: globalCoverageHash,
      coverageReceiptHash: coverageHash,
    })) {
      assertAuthorityBinding(
        generation[field],
        expected,
        'partition_child_generation_binding_mismatch',
        `${partitionId}.${field}`
      );
    }

    const membershipPath =
      `receipts/children/${partitionId}.membership.json`;
    const membershipArtifact = readCanonicalAuthorityJson(
      authority,
      membershipPath,
      incompleteFailureClass,
      'partition_child_membership_receipt_invalid'
    );
    const membership =
      membershipArtifact.value as Record<string, unknown>;
    for (const [field, expected] of Object.entries({
      schemaVersion:
        'goal-contract-child-manifest-membership-receipt/v1',
      membershipStatus: 'final',
      partitionId,
      childContractPath: partition.childContractPath,
      childContractHash: partition.childContractHash,
      childCompilationReceiptHash:
        partition.childCompilationReceiptHash,
      partitionPlanHash,
      partitionManifestHash,
    })) {
      assertAuthorityBinding(
        membership[field],
        expected,
        'partition_child_membership_binding_mismatch',
        `${partitionId}.${field}`
      );
    }
    if (!verifyReceiptSelfHash(membership)) {
      throw failure('partition_child_membership_binding_mismatch', {
        field: `${partitionId}.receiptHash`,
      });
    }
  }

  const impactArtifacts = [
    {
      pathField: 'partitionImpactGraphPath',
      schemaName: 'goal-contract-partition-impact-graph.schema.json',
      documentHashField: 'partitionImpactGraphDocumentHash',
      semanticHashField: 'impactGraphHash',
      manifestSemanticHashField: 'partitionImpactGraphHash',
      failureClass: 'partition_impact_graph_binding_mismatch',
    },
    {
      pathField: 'partitionClosureFeasibilityReceiptPath',
      schemaName:
        'goal-contract-partition-closure-feasibility-receipt.schema.json',
      documentHashField: 'partitionClosureFeasibilityReceiptHash',
      failureClass:
        'partition_closure_feasibility_binding_mismatch',
    },
    {
      pathField: 'partitionImpactDriftReceiptPath',
      schemaName:
        'goal-contract-partition-impact-drift-receipt.schema.json',
      documentHashField: 'partitionImpactDriftReceiptHash',
      semanticHashField: 'driftHash',
      manifestSemanticHashField: 'driftHash',
      failureClass: 'partition_impact_drift_binding_mismatch',
    },
  ];
  for (const binding of impactArtifacts) {
    if (typeof manifest[binding.pathField] !== 'string') continue;
    const artifact = readCanonicalAuthorityJson(
      authority,
      manifest[binding.pathField] as string,
      incompleteFailureClass,
      binding.failureClass
    );
    validateAuthoritySchema(
      binding.schemaName,
      artifact.value,
      binding.failureClass
    );
    assertAuthorityBinding(
      sha256Bytes(artifact.bytes),
      manifest[binding.documentHashField],
      binding.failureClass,
      binding.documentHashField
    );
    if (binding.semanticHashField) {
      assertAuthorityBinding(
        artifact.value[binding.semanticHashField],
        manifest[binding.manifestSemanticHashField],
        binding.failureClass,
        binding.semanticHashField
      );
    }
  }

  const renderEvidenceArtifact = readCanonicalAuthorityJson(
    authority,
    'evidence/render-evidence.json',
    incompleteFailureClass,
    'partition_render_evidence_invalid'
  );
  const renderEvidence =
    renderEvidenceArtifact.value as Record<string, unknown>;
  for (const [field, expected] of Object.entries({
    schemaVersion: 'goal-contract-partition-render-evidence/v1',
    sourceHash:
      input.expectedSourceHash || manifest.masterSourceHash,
    partitionPlanHash,
    partitionManifestHash,
    partitionManifestDocumentHash,
  })) {
    assertAuthorityBinding(
      renderEvidence[field],
      expected,
      'partition_render_evidence_binding_mismatch',
      field
    );
  }
  if (
    input.expectedGenerationKey !== undefined &&
    renderEvidence.generationKey !== input.expectedGenerationKey
  ) {
    throw failure('partition_render_evidence_binding_mismatch', {
      field: 'generationKey',
    });
  }

  const lifecycleArtifact = readCanonicalAuthorityJson(
    authority,
    'lifecycle/activation-state.json',
    incompleteFailureClass,
    'partition_lifecycle_state_invalid'
  );
  const lifecycle =
    lifecycleArtifact.value as Record<string, unknown>;
  for (const [field, expected] of Object.entries({
    schemaVersion: 'goal-contract-partition-lifecycle-state/v1',
    state: 'validated_pending_execution',
    generationKey: renderEvidence.generationKey,
    partitionManifestHash,
  })) {
    assertAuthorityBinding(
      lifecycle[field],
      expected,
      'partition_lifecycle_state_binding_mismatch',
      field
    );
  }

  if (
    input.expectedPartitionRunId !== undefined &&
    manifest.partitionRunId !== input.expectedPartitionRunId
  ) {
    throw failure('partition_authority_run_binding_mismatch', {
      field: 'partitionRunId',
    });
  }
  for (const [field, expected] of Object.entries({
    partitionPlanHash: input.expectedPartitionPlanHash,
    partitionManifestHash: input.expectedPartitionManifestHash,
    partitionManifestDocumentHash:
      input.expectedPartitionManifestDocumentHash,
    partitionSetHash: input.expectedPartitionSetHash,
  })) {
    if (expected !== undefined) {
      const actual = {
        partitionPlanHash,
        partitionManifestHash,
        partitionManifestDocumentHash,
        partitionSetHash: manifest.partitionSetHash,
      }[field];
      assertAuthorityBinding(
        actual,
        expected,
        'partition_authority_payload_hash_mismatch',
        field
      );
    }
  }

  const derivedChildPaths = manifestChildContractPaths;
  const derivedReceiptPaths = normalizeRelativeArtifactSet(
    authority,
    requiredReceiptPaths,
    'partition_authority_artifact_set_invalid'
  );
  if (input.childContractPaths !== undefined) {
    const callerChildPaths = normalizeChildArtifactSet(
      authority,
      input.childContractPaths,
      'partition_authority_artifact_set_invalid'
    );
    if (
      stableControlPlaneStringify(callerChildPaths) !==
      stableControlPlaneStringify([...derivedChildPaths].sort())
    ) {
      throw failure('partition_authority_artifact_set_mismatch', {
        artifactType: 'children',
      });
    }
  }
  if (input.requiredReceiptPaths !== undefined) {
    const callerReceiptPaths = normalizeRelativeArtifactSet(
      authority,
      input.requiredReceiptPaths,
      'partition_authority_artifact_set_invalid'
    );
    if (
      stableControlPlaneStringify(callerReceiptPaths) !==
      stableControlPlaneStringify(derivedReceiptPaths)
    ) {
      throw failure('partition_authority_artifact_set_mismatch', {
        artifactType: 'receipts',
      });
    }
  }
  const requiredReceiptHashes = derivedReceiptPaths.map((relativePath) => {
    const targetPath = requireRelativeAuthorityArtifact(
      authority,
      relativePath
    );
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      throw failure(incompleteFailureClass, {
        targetPath: normalizePath(targetPath),
      });
    }
    return Object.freeze({
      path: relativePath,
      hash: sha256Bytes(fs.readFileSync(targetPath)),
    });
  });

  return Object.freeze({
    partitionPlanHash,
    partitionManifestHash,
    partitionManifestDocumentHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionRunId: manifest.partitionRunId,
    childContractHashes: Object.freeze(childContractHashes),
    requiredReceiptHashes: Object.freeze(requiredReceiptHashes),
    manifest: Object.freeze(manifest),
  });
}

function loadCanonicalPartitionAuthorityForRelease(
  input: Record<string, unknown>
) {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    typeof input.repositoryRoot !== 'string' ||
    typeof input.partitionManifestPath !== 'string' ||
    typeof input.goalPath !== 'string'
  ) {
    throw failure('canonical_partition_release_request_invalid');
  }
  const partitionManifestPath = path.resolve(
    input.partitionManifestPath
  );
  const repositoryRoot = path.resolve(input.repositoryRoot);
  const unitRoot = path.dirname(partitionManifestPath);
  const generationsRoot = path.dirname(unitRoot);
  const authorityRoot = path.dirname(generationsRoot);
  if (
    path.basename(generationsRoot) !== 'generations' ||
    partitionManifestPath !==
      path.join(unitRoot, 'partition-manifest.json')
  ) {
    throw failure('canonical_partition_authority_root_invalid');
  }
  const activePointerPath = path.join(
    authorityRoot,
    'active-generation.json'
  );
  let pointer: Record<string, unknown>;
  let pointerBytes: Buffer;
  try {
    pointerBytes = fs.readFileSync(activePointerPath);
    pointer = JSON.parse(pointerBytes.toString('utf8'));
  } catch {
    throw failure('canonical_partition_active_pointer_invalid', {
      activePointerPath: normalizePath(activePointerPath),
    });
  }
  validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, pointer);
  const expectedAuthorityRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'goal-contract-partition-bootstrap',
    String(pointer.sourceHash).slice('sha256:'.length)
  );
  const expectedUnitRoot = path.join(
    expectedAuthorityRoot,
    'generations',
    String(pointer.generationKey).slice('sha256:'.length)
  );
  if (
    comparableRealPath(authorityRoot) !==
      comparableRealPath(expectedAuthorityRoot) ||
    comparableRealPath(unitRoot) !==
      comparableRealPath(expectedUnitRoot)
  ) {
    throw failure('canonical_partition_authority_root_invalid', {
      authorityRoot: normalizePath(authorityRoot),
      expectedAuthorityRoot: normalizePath(
        expectedAuthorityRoot
      ),
      unitRoot: normalizePath(unitRoot),
      expectedUnitRoot: normalizePath(expectedUnitRoot),
    });
  }
  assertCanonicalAuthorityPath(
    authorityRoot,
    activePointerPath
  );
  const authority = Object.freeze({
    authorityMode: 'standalone_bootstrap',
    sourceHash: pointer.sourceHash,
    generationKey: pointer.generationKey,
    repositoryRoot,
    repositoryRootRelativeChildren: true,
    authorityRoot,
    unitRoot,
    activePointerPath,
    partitionPlanPath: path.join(unitRoot, 'partition-plan.json'),
    partitionManifestPath,
  });
  const validated = validateImmutablePartitionAuthorityUnit({
    authority,
    expectedSourceHash: pointer.sourceHash,
    expectedGenerationKey: pointer.generationKey,
    expectedPartitionPlanHash: input.expectedPartitionPlanHash,
    expectedPartitionManifestHash: pointer.partitionManifestHash,
    expectedPartitionManifestDocumentHash:
      pointer.partitionManifestDocumentHash,
  });
  for (const [field, expected] of Object.entries({
    authorityMode: 'standalone_bootstrap',
    generationRoot: normalizePath(unitRoot),
    partitionPlanPath: normalizePath(authority.partitionPlanPath),
    partitionPlanHash: validated.partitionPlanHash,
    partitionManifestPath: normalizePath(partitionManifestPath),
    partitionManifestHash: validated.partitionManifestHash,
    partitionManifestDocumentHash:
      validated.partitionManifestDocumentHash,
  })) {
    if (
      [
        'generationRoot',
        'partitionPlanPath',
        'partitionManifestPath',
      ].includes(field)
    ) {
      assertAuthorityPathBinding(
        pointer[field],
        expected,
        'canonical_partition_active_pointer_mismatch',
        field
      );
    } else {
      assertAuthorityBinding(
        pointer[field],
        expected,
        'canonical_partition_active_pointer_mismatch',
        field
      );
    }
  }
  assertAuthorityBinding(
    stableControlPlaneStringify(pointer.childContractHashes),
    stableControlPlaneStringify(validated.childContractHashes),
    'canonical_partition_active_pointer_mismatch',
    'childContractHashes'
  );
  assertAuthorityBinding(
    stableControlPlaneStringify(pointer.requiredReceiptHashes),
    stableControlPlaneStringify(validated.requiredReceiptHashes),
    'canonical_partition_active_pointer_mismatch',
    'requiredReceiptHashes'
  );

  const manifest = validated.manifest as Record<string, unknown>;
  const partitionPlan = JSON.parse(
    fs.readFileSync(authority.partitionPlanPath, 'utf8')
  ) as Record<string, unknown>;
  const resolvedGoalPath = path.resolve(input.goalPath);
  const partition = (
    manifest.partitions as Record<string, unknown>[]
  ).find((candidate) => {
    try {
      return (
        requireAuthorityChildArtifact(
          authority,
          String(candidate.childContractPath || '')
        ) === resolvedGoalPath
      );
    } catch {
      return false;
    }
  });
  if (
    !partition ||
    !fs.existsSync(resolvedGoalPath) ||
    sha256Bytes(fs.readFileSync(resolvedGoalPath)) !==
      partition.childContractHash
  ) {
    throw failure('canonical_partition_child_membership_invalid', {
      goalPath: normalizePath(resolvedGoalPath),
    });
  }
  const generationPath = requireRelativeAuthorityArtifact(
    authority,
    `receipts/children/${partition.partitionId}.generation.json`
  );
  const generation = readValidatedPartitionReceipt(
    generationPath,
    'goal-contract-partition-child-generation-receipt/v1'
  ) as Record<string, unknown>;
  for (const [field, expected] of Object.entries({
    decision: 'pass',
    masterSourceHash: manifest.masterSourceHash,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    methodologyProfileHash: manifest.methodologyProfileHash,
    executionProjectionHash: manifest.executionProjectionHash,
    taskDagHash: manifest.taskDagHash,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionAnalysisReceiptHash:
      manifest.partitionAnalysisReceiptHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionId: partition.partitionId,
    goalContractHash: partition.childContractHash,
  })) {
    assertAuthorityBinding(
      generation[field],
      expected,
      'canonical_partition_generation_binding_mismatch',
      field
    );
  }
  for (const field of [
    'methodologyProfileArtifactHash',
    'partitionPolicyArtifactHash',
  ]) {
    requireSha256(generation[field], field);
  }
  const artifactHashes = Object.freeze(
    Object.fromEntries(
      [
        ...validated.childContractHashes,
        ...validated.requiredReceiptHashes,
        {
          path: 'partition-plan.json',
          hash: sha256Bytes(
            fs.readFileSync(authority.partitionPlanPath)
          ),
        },
        {
          path: 'partition-manifest.json',
          hash: validated.partitionManifestDocumentHash,
        },
      ].map((artifact) => [artifact.path, artifact.hash])
    )
  );
  const currentPointerBytes =
    fs.readFileSync(activePointerPath);
  if (!currentPointerBytes.equals(pointerBytes)) {
    throw failure('canonical_partition_active_pointer_changed', {
      activePointerPath: normalizePath(activePointerPath),
    });
  }
  return Object.freeze({
    authorityMode: 'canonical_governed',
    repositoryRoot: authority.repositoryRoot,
    authorityRoot: normalizePath(unitRoot),
    activePointerPath: normalizePath(activePointerPath),
    activePointerHash: sha256Bytes(pointerBytes),
    artifactHashes,
    partitionPlan,
    partitionPlanHash: validated.partitionPlanHash,
    methodology: Object.freeze({
      methodologyProfileHash: generation.methodologyProfileHash,
      methodologyProfileArtifactHash:
        generation.methodologyProfileArtifactHash,
    }),
    optimizerPolicyBinding: Object.freeze({
      partitionPolicyHash: generation.partitionPolicyHash,
      partitionPolicyArtifactHash:
        generation.partitionPolicyArtifactHash,
    }),
    projection: Object.freeze({
      executionProjectionHash: generation.executionProjectionHash,
      taskDagHash: generation.taskDagHash,
      sequenceConstraintBinding: Object.freeze({
        sequenceMode: partitionPlan.sequenceMode,
        applicabilityDecision:
          partitionPlan.sequenceApplicability,
        sequenceCoverage: partitionPlan.sequenceCoverage,
        sequenceClosureStatus:
          partitionPlan.sequenceClosureStatus,
        childContractAuthority:
          partitionPlan.childContractAuthority,
      }),
    }),
    compiled: Object.freeze({
      manifest,
      partitionManifestHash:
        validated.partitionManifestDocumentHash,
    }),
  });
}

function assertImmutableAuthorityUnit(
  input: Record<string, unknown>
) {
  const authority = input?.authority as Record<string, unknown>;
  if (
    !authority ||
    typeof authority.unitRoot !== 'string' ||
    !Array.isArray(input.expectedArtifacts)
  ) {
    throw failure('partition_generation_validation_request_invalid');
  }
  if (!fs.existsSync(authority.unitRoot)) {
    return Object.freeze({ exists: false });
  }
  if (!fs.statSync(authority.unitRoot).isDirectory()) {
    throw failure('partition_generation_incomplete');
  }
  for (const artifact of input.expectedArtifacts) {
    if (
      !artifact ||
      typeof artifact !== 'object' ||
      typeof artifact.relativePath !== 'string' ||
      (!Buffer.isBuffer(artifact.bytes) && typeof artifact.bytes !== 'string')
    ) {
      throw failure('partition_generation_validation_request_invalid');
    }
    const targetPath = requireRelativeAuthorityArtifact(
      authority,
      artifact.relativePath
    );
    const bytes = Buffer.isBuffer(artifact.bytes)
      ? artifact.bytes
      : Buffer.from(artifact.bytes, 'utf8');
    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      throw failure('partition_generation_incomplete', {
        targetPath: normalizePath(targetPath),
      });
    }
    const existing = fs.readFileSync(targetPath);
    if (!existing.equals(bytes)) {
      throw failure('partition_immutable_bytes_conflict', {
        targetPath: normalizePath(targetPath),
        existingHash: sha256Bytes(existing),
        requestedHash: sha256Bytes(bytes),
      });
    }
  }
  return Object.freeze({ exists: true });
}

function activateStandalonePartitionGeneration(
  input: Record<string, unknown>
) {
  const authority = input?.authority as Record<string, unknown>;
  if (
    !authority ||
    authority.authorityMode !== 'standalone_bootstrap' ||
    typeof authority.unitRoot !== 'string' ||
    typeof authority.activePointerPath !== 'string' ||
    typeof authority.partitionPlanPath !== 'string' ||
    typeof authority.partitionManifestPath !== 'string' ||
    (!Buffer.isBuffer(input.partitionPlanBytes) &&
      typeof input.partitionPlanBytes !== 'string') ||
    (!Buffer.isBuffer(input.partitionManifestBytes) &&
      typeof input.partitionManifestBytes !== 'string') ||
    !Array.isArray(input.childContractPaths) ||
    !Array.isArray(input.requiredReceiptPaths)
  ) {
    throw failure('partition_generation_activation_request_invalid');
  }
  const planBytes = Buffer.isBuffer(input.partitionPlanBytes)
    ? input.partitionPlanBytes
    : Buffer.from(input.partitionPlanBytes, 'utf8');
  const manifestBytes = Buffer.isBuffer(input.partitionManifestBytes)
    ? input.partitionManifestBytes
    : Buffer.from(input.partitionManifestBytes, 'utf8');
  if (
    !fs.existsSync(authority.partitionPlanPath as string) ||
    !fs.existsSync(authority.partitionManifestPath as string) ||
    !fs.readFileSync(authority.partitionPlanPath as string).equals(planBytes) ||
    !fs
      .readFileSync(authority.partitionManifestPath as string)
      .equals(manifestBytes)
  ) {
    throw failure('partition_generation_incomplete');
  }
  const validated = validateImmutablePartitionAuthorityUnit({
    authority,
    childContractPaths: input.childContractPaths,
    requiredReceiptPaths: input.requiredReceiptPaths,
    expectedSourceHash: authority.sourceHash,
    expectedGenerationKey: authority.generationKey,
    expectedPartitionManifestHash: input.partitionManifestHash,
    expectedPartitionManifestDocumentHash:
      input.partitionManifestDocumentHash,
  });
  const pointer = {
    schemaVersion: 'goal-contract-partition-active-generation/v1',
    authorityMode: 'standalone_bootstrap',
    sourceHash: authority.sourceHash,
    generationKey: authority.generationKey,
    generationRoot: normalizePath(authority.unitRoot),
    partitionPlanPath: normalizePath(authority.partitionPlanPath),
    partitionPlanHash: validated.partitionPlanHash,
    partitionManifestPath: normalizePath(
      authority.partitionManifestPath
    ),
    partitionManifestHash: validated.partitionManifestHash,
    partitionManifestDocumentHash:
      validated.partitionManifestDocumentHash,
    childContractHashes: validated.childContractHashes,
    requiredReceiptHashes: validated.requiredReceiptHashes,
  };
  validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, pointer);
  const pointerBytes = `${stableControlPlaneStringify(pointer)}\n`;
  fs.mkdirSync(path.dirname(authority.activePointerPath), {
    recursive: true,
  });
  const tempPath = path.join(
    path.dirname(authority.activePointerPath),
    `.${path.basename(authority.activePointerPath)}.${process.pid}.tmp`
  );
  fs.writeFileSync(tempPath, pointerBytes, { flag: 'wx' });
  try {
    fs.renameSync(tempPath, authority.activePointerPath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath);
  }
  if (fs.readFileSync(authority.activePointerPath, 'utf8') !== pointerBytes) {
    throw failure('partition_active_pointer_reread_mismatch');
  }
  return Object.freeze({
    activated: true,
    pointerPath: normalizePath(authority.activePointerPath),
    pointerHash: sha256Bytes(pointerBytes),
    pointerBytes,
    pointer: Object.freeze(pointer),
  });
}

module.exports = {
  activateStandalonePartitionGeneration,
  assertRawNonAuthoritativeContainmentRoot,
  assertImmutableAuthorityUnit,
  computePartitionGenerationKey,
  goalContractAuthorityWriterBinding,
  loadCanonicalPartitionAuthorityForRelease,
  preflightRequirementRecordPartitionAuthoritySupersession,
  resolveCanonicalPartitionOutputPaths,
  resolveRawPartitionOutputPaths,
  semanticPartitionManifestHash,
  validateImmutablePartitionAuthorityUnit,
  writeImmutableAuthorityFile,
};
