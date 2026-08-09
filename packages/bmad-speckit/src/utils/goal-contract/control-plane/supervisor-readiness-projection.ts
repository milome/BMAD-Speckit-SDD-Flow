const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function modulePath(relativePath: string): string {
  return `${relativePath}${__filename.endsWith('.ts') ? '.ts' : ''}`;
}

const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require(modulePath('./canonical-hash'));
const {
  readRequirementRecordPartitionAuthorityProjection,
} = require(modulePath('./authority-supersession'));
const {
  validateImmutablePartitionAuthorityUnit,
} = require(modulePath('./partition-output-paths'));
const {
  validateGoalContractSchema,
} = require(modulePath('./schema-registry'));

const OUTPUT_AUTHORITY_SCHEMA =
  'goal-contract-partition-output-authority.schema.json';
const PROJECTION_SCHEMA =
  'goal-contract-supervisor-readiness-projection.schema.json';
const MAX_LIFECYCLE_RECORDS = 4096;
const MAX_LIFECYCLE_FILE_BYTES = 1024 * 1024;
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const SOURCE_HASH_SEGMENT = /^sha256:([0-9a-f]{64})$/u;
const REQUIREMENT_SET_ID_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

const LIFECYCLE_SCHEMAS = Object.freeze({
  'goal-contract-partition-release-gate-receipt/v1': Object.freeze({
    kind: 'release',
    schemaName:
      'goal-contract-partition-release-gate-receipt.schema.json',
  }),
  'goal-contract-campaign-activation-receipt/v1': Object.freeze({
    kind: 'activation',
    schemaName:
      'goal-contract-campaign-activation-receipt.schema.json',
    hashField: 'receiptHash',
  }),
  'goal-contract-subcontract-execution-lease/v1': Object.freeze({
    kind: 'lease',
    schemaName:
      'goal-contract-subcontract-execution-lease.schema.json',
    hashField: 'receiptHash',
  }),
  'goal-contract-subcontract-execution-lease/v2': Object.freeze({
    kind: 'lease',
    schemaName:
      'goal-contract-subcontract-execution-lease.schema.json',
    hashField: 'receiptHash',
  }),
  'goal-contract-subcontract-evidence/v1': Object.freeze({
    kind: 'evidence',
    schemaName: 'goal-contract-subcontract-evidence.schema.json',
    hashField: 'evidenceHash',
  }),
  'goal-contract-subcontract-closure-receipt/v1': Object.freeze({
    kind: 'closure',
    schemaName:
      'goal-contract-subcontract-closure-receipt.schema.json',
    hashField: 'receiptHash',
  }),
  'goal-contract-campaign-closure-receipt/v1': Object.freeze({
    kind: 'campaignClosure',
    schemaName:
      'goal-contract-campaign-closure-receipt.schema.json',
    hashField: 'receiptHash',
  }),
});

// Schema validation establishes the shape before dynamic records are consumed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaRecord = Record<string, any>;

type ArtifactRecord = Readonly<{
  absolutePath: string;
  relativePath: string;
  bytes: Buffer;
  value: SchemaRecord;
  ref: Readonly<{ path: string; hash: string }>;
}>;

function failure(
  failureClass: string,
  details: Record<string, unknown> = {}
): Error {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function isRecord(value: unknown): value is SchemaRecord {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function normalizePath(value: string): string {
  return path.resolve(value).replace(/\\/gu, '/');
}

function projectChildContractPath(value: unknown): string {
  if (typeof value !== 'string') {
    throw failure('supervisor_readiness_projection_schema_invalid', {
      field: 'childContractPath',
    });
  }
  const segments = value.replace(/\\/gu, '/').split('/');
  const childrenIndex = segments.lastIndexOf('children');
  if (
    childrenIndex < 0 ||
    childrenIndex === segments.length - 1 ||
    segments
      .slice(childrenIndex + 1)
      .some((segment) => ['', '.', '..'].includes(segment))
  ) {
    throw failure('supervisor_readiness_projection_schema_invalid', {
      field: 'childContractPath',
    });
  }
  return segments.slice(childrenIndex).join('/');
}

function sha256Bytes(value: Buffer | string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function isSameOrWithin(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative))
  );
}

function requireSourceHash(value: unknown): string {
  if (typeof value !== 'string' || !SOURCE_HASH_SEGMENT.test(value)) {
    throw failure('supervisor_readiness_request_invalid', {
      field: 'sourceHash',
    });
  }
  return value;
}

function requireRepositoryRoot(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('supervisor_readiness_request_invalid', {
      field: 'repositoryRoot',
    });
  }
  return path.resolve(value);
}

function assertNoAuthorityOverride(input: SchemaRecord): void {
  const forbiddenFields = [
    'activePointerPath',
    'authorityRoot',
    'authorityUnitRoot',
    'generationRoot',
    'lifecycleRoot',
    'manifestPath',
    'partitionManifestPath',
    'partitionPlanPath',
    'unitRoot',
  ].filter((field) => Object.hasOwn(input, field));
  if (forbiddenFields.length > 0) {
    throw failure('supervisor_readiness_authority_override_rejected', {
      forbiddenFields,
    });
  }
}

function readJson(
  targetPath: string,
  failureClass: string
): SchemaRecord {
  let value;
  try {
    value = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  } catch {
    throw failure(failureClass, {
      targetPath: normalizePath(targetPath),
    });
  }
  if (!isRecord(value)) {
    throw failure(failureClass, {
      targetPath: normalizePath(targetPath),
    });
  }
  return value;
}

function assertExactPath(
  actual: unknown,
  expected: string,
  failureClass: string
): void {
  if (
    typeof actual !== 'string' ||
    path.resolve(actual) !== path.resolve(expected)
  ) {
    throw failure(failureClass, {
      expectedPath: normalizePath(expected),
      actualPath:
        typeof actual === 'string' ? normalizePath(actual) : actual,
    });
  }
}

function assertHash(
  actual: unknown,
  expected: unknown,
  failureClass: string,
  field: string
): void {
  if (
    typeof actual !== 'string' ||
    !HASH_PATTERN.test(actual) ||
    actual !== expected
  ) {
    throw failure(failureClass, {
      field,
      expected,
      actual,
    });
  }
}

function assertValue(
  actual: unknown,
  expected: unknown,
  failureClass: string,
  field: string
): void {
  if (actual !== expected) {
    throw failure(failureClass, {
      field,
      expected,
      actual,
    });
  }
}

function assertArtifactBindings(
  actual: unknown,
  expected: unknown,
  field: string
): void {
  if (
    stableControlPlaneStringify(actual) !==
    stableControlPlaneStringify(expected)
  ) {
    throw failure('supervisor_readiness_active_authority_mismatch', {
      field,
    });
  }
}

function assertCanonicalAuthorityFile(
  authorityRoot: string,
  targetPath: string,
  missingFailureClass: string
): void {
  let metadata;
  let realTarget;
  try {
    metadata = fs.lstatSync(targetPath);
    realTarget = fs.realpathSync(targetPath);
  } catch {
    throw failure(missingFailureClass, {
      targetPath: normalizePath(targetPath),
    });
  }
  if (
    metadata.isSymbolicLink() ||
    !metadata.isFile() ||
    !isSameOrWithin(authorityRoot, realTarget) ||
    path.resolve(realTarget) !== path.resolve(targetPath)
  ) {
    throw failure('supervisor_readiness_authority_path_escape', {
      targetPath: normalizePath(targetPath),
    });
  }
}

function standaloneAuthority(
  repositoryRoot: string,
  sourceHash: string
) {
  const sourceSegment = SOURCE_HASH_SEGMENT.exec(sourceHash)?.[1];
  const authorityRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'goal-contract-partition-bootstrap',
    sourceSegment
  );
  const activePointerPath = path.join(
    authorityRoot,
    'active-generation.json'
  );
  assertCanonicalAuthorityFile(
    authorityRoot,
    activePointerPath,
    'supervisor_readiness_active_pointer_missing'
  );
  const pointer = readJson(
    activePointerPath,
    'supervisor_readiness_active_pointer_missing'
  );
  try {
    validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, pointer);
  } catch (error) {
    throw failure('supervisor_readiness_active_pointer_invalid', {
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
  if (
    pointer.authorityMode !== 'standalone_bootstrap' ||
    pointer.sourceHash !== sourceHash ||
    typeof pointer.generationKey !== 'string' ||
    !HASH_PATTERN.test(pointer.generationKey)
  ) {
    throw failure('supervisor_readiness_active_authority_mismatch');
  }
  const unitRoot = path.join(
    authorityRoot,
    'generations',
    pointer.generationKey.slice('sha256:'.length)
  );
  if (
    typeof pointer.generationRoot !== 'string' ||
    !isSameOrWithin(authorityRoot, pointer.generationRoot) ||
    path.resolve(pointer.generationRoot) !== path.resolve(unitRoot)
  ) {
    throw failure('supervisor_readiness_authority_path_escape', {
      field: 'generationRoot',
    });
  }
  assertExactPath(
    pointer.partitionPlanPath,
    path.join(unitRoot, 'partition-plan.json'),
    'supervisor_readiness_active_authority_mismatch'
  );
  assertExactPath(
    pointer.partitionManifestPath,
    path.join(unitRoot, 'partition-manifest.json'),
    'supervisor_readiness_active_authority_mismatch'
  );
  let validated;
  try {
    validated = validateImmutablePartitionAuthorityUnit({
      authority: {
        unitRoot,
        repositoryRoot,
        repositoryRootRelativeChildren: true,
      },
      expectedSourceHash: sourceHash,
      expectedGenerationKey: pointer.generationKey,
      expectedPartitionPlanHash: pointer.partitionPlanHash,
      expectedPartitionManifestHash: pointer.partitionManifestHash,
      expectedPartitionManifestDocumentHash:
        pointer.partitionManifestDocumentHash,
    });
  } catch (error) {
    throw failure('supervisor_readiness_active_authority_mismatch', {
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
  assertArtifactBindings(
    pointer.childContractHashes,
    validated.childContractHashes,
    'childContractHashes'
  );
  assertArtifactBindings(
    pointer.requiredReceiptHashes,
    validated.requiredReceiptHashes,
    'requiredReceiptHashes'
  );
  return Object.freeze({
    authorityMode: 'standalone_bootstrap',
    sourceHash,
    generationKey: pointer.generationKey,
    activePointerPath,
    unitRoot,
    pointer,
    validated,
  });
}

function requirementRecordAuthority(
  repositoryRoot: string,
  sourceHash: string,
  requirementSetId: unknown
) {
  if (
    typeof requirementSetId !== 'string' ||
    !REQUIREMENT_SET_ID_PATTERN.test(requirementSetId)
  ) {
    throw failure('supervisor_readiness_request_invalid', {
      field: 'requirementSetId',
    });
  }
  const requirementRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId
  );
  const recordPath = path.join(
    requirementRoot,
    'requirement-record.json'
  );
  const authorityRoot = path.join(requirementRoot, 'goal-contract');
  const activePointerPath = path.join(
    authorityRoot,
    'active-partition-run.json'
  );
  assertCanonicalAuthorityFile(
    authorityRoot,
    activePointerPath,
    'supervisor_readiness_active_authority_mismatch'
  );
  let pointer;
  try {
    pointer =
      readRequirementRecordPartitionAuthorityProjection({
        recordPath,
      });
  } catch (error) {
    throw failure('supervisor_readiness_active_authority_mismatch', {
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
  assertExactPath(
    pointer.pointerPath,
    activePointerPath,
    'supervisor_readiness_active_authority_mismatch'
  );
  assertExactPath(
    pointer.authorityRoot,
    authorityRoot,
    'supervisor_readiness_authority_path_escape'
  );
  assertExactPath(
    pointer.recordPath,
    recordPath,
    'supervisor_readiness_active_authority_mismatch'
  );
  if (
    pointer.authorityMode !== 'requirement_record' ||
    pointer.requirementSetId !== requirementSetId ||
    pointer.sourceHash !== sourceHash
  ) {
    throw failure('supervisor_readiness_active_authority_mismatch');
  }
  const unitRoot = path.join(
    authorityRoot,
    'partition-runs',
    pointer.partitionRunId
  );
  if (!isSameOrWithin(authorityRoot, unitRoot)) {
    throw failure('supervisor_readiness_authority_path_escape', {
      field: 'partitionRunId',
    });
  }
  let validated;
  try {
    validated = validateImmutablePartitionAuthorityUnit({
      authority: { unitRoot },
      incompleteFailureClass:
        'supervisor_readiness_active_authority_mismatch',
      expectedSourceHash: sourceHash,
      expectedPartitionRunId: pointer.partitionRunId,
      expectedPartitionPlanHash: pointer.partitionPlanHash,
      expectedPartitionManifestHash: pointer.partitionManifestHash,
      expectedPartitionManifestDocumentHash:
        pointer.partitionManifestDocumentHash,
      expectedPartitionSetHash: pointer.partitionSetHash,
    });
  } catch (error) {
    throw failure('supervisor_readiness_active_authority_mismatch', {
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
  return Object.freeze({
    authorityMode: 'requirement_record',
    requirementSetId,
    sourceHash,
    activePointerPath: pointer.pointerPath,
    unitRoot,
    pointer,
    validated,
  });
}

function readLifecycleArtifact(
  unitRoot: string,
  targetPath: string
): ArtifactRecord | null {
  const lifecycleRoot = path.join(unitRoot, 'lifecycle');
  const metadata = fs.lstatSync(targetPath);
  if (metadata.isSymbolicLink()) {
    throw failure('supervisor_readiness_authority_path_escape', {
      targetPath: normalizePath(targetPath),
    });
  }
  if (!metadata.isFile()) return null;
  if (
    !targetPath.endsWith('.json') ||
    metadata.size > MAX_LIFECYCLE_FILE_BYTES
  ) {
    throw failure('supervisor_readiness_lifecycle_reference_invalid', {
      targetPath: normalizePath(targetPath),
    });
  }
  const realTarget = fs.realpathSync(targetPath);
  if (!isSameOrWithin(lifecycleRoot, realTarget)) {
    throw failure('supervisor_readiness_authority_path_escape', {
      targetPath: normalizePath(targetPath),
    });
  }
  const bytes = fs.readFileSync(targetPath);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw failure('supervisor_readiness_lifecycle_reference_invalid', {
      targetPath: normalizePath(targetPath),
    });
  }
  if (!isRecord(value)) {
    throw failure('supervisor_readiness_lifecycle_reference_invalid', {
      targetPath: normalizePath(targetPath),
    });
  }
  if (
    value.schemaVersion ===
    'goal-contract-partition-lifecycle-state/v1'
  ) {
    return null;
  }
  const binding = LIFECYCLE_SCHEMAS[value.schemaVersion];
  if (!binding) {
    throw failure(
      'supervisor_readiness_lifecycle_reference_unsupported',
      {
        targetPath: normalizePath(targetPath),
        schemaVersion: value.schemaVersion,
      }
    );
  }
  try {
    validateGoalContractSchema(binding.schemaName, value);
  } catch (error) {
    throw failure('supervisor_readiness_lifecycle_reference_invalid', {
      targetPath: normalizePath(targetPath),
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
  if (
    binding.hashField &&
    !verifyReceiptSelfHash(value, binding.hashField)
  ) {
    throw failure('supervisor_readiness_lifecycle_reference_stale', {
      targetPath: normalizePath(targetPath),
      field: binding.hashField,
    });
  }
  const relativePath = path
    .relative(unitRoot, targetPath)
    .replace(/\\/gu, '/');
  if (
    !relativePath.startsWith('lifecycle/') ||
    relativePath.split('/').includes('..')
  ) {
    throw failure('supervisor_readiness_authority_path_escape', {
      targetPath: normalizePath(targetPath),
    });
  }
  return Object.freeze({
    absolutePath: targetPath,
    relativePath,
    bytes,
    value,
    ref: Object.freeze({
      path: relativePath,
      hash: sha256Bytes(bytes),
    }),
  });
}

function scanLifecycleRecords(unitRoot: string) {
  const lifecycleRoot = path.join(unitRoot, 'lifecycle');
  if (
    !fs.existsSync(lifecycleRoot) ||
    !fs.statSync(lifecycleRoot).isDirectory()
  ) {
    throw failure('supervisor_readiness_lifecycle_reference_missing', {
      lifecycleRoot: normalizePath(lifecycleRoot),
    });
  }
  const records: ArtifactRecord[] = [];
  const pending = [lifecycleRoot];
  while (pending.length > 0) {
    const directory = pending.pop() as string;
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const targetPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw failure('supervisor_readiness_authority_path_escape', {
          targetPath: normalizePath(targetPath),
        });
      }
      if (entry.isDirectory()) {
        pending.push(targetPath);
        continue;
      }
      const artifact = readLifecycleArtifact(unitRoot, targetPath);
      if (artifact) records.push(artifact);
      if (records.length > MAX_LIFECYCLE_RECORDS) {
        throw failure('supervisor_readiness_lifecycle_reference_invalid', {
          reason: 'record_limit_exceeded',
        });
      }
    }
  }
  return Object.freeze(records);
}

function uniqueGlobalRecord(
  records: readonly ArtifactRecord[],
  kind: string
): ArtifactRecord {
  const matches = records.filter(
    (record) => LIFECYCLE_SCHEMAS[record.value.schemaVersion].kind === kind
  );
  if (matches.length === 0) {
    throw failure('supervisor_readiness_lifecycle_reference_missing', {
      referenceKind: kind,
    });
  }
  if (matches.length !== 1) {
    throw failure('supervisor_readiness_lifecycle_reference_duplicate', {
      referenceKind: kind,
    });
  }
  return matches[0];
}

function partitionRecordMap(
  records: readonly ArtifactRecord[],
  kind: string,
  partitionIds: ReadonlySet<string>
): ReadonlyMap<string, ArtifactRecord> {
  const result = new Map<string, ArtifactRecord>();
  for (const record of records) {
    if (LIFECYCLE_SCHEMAS[record.value.schemaVersion].kind !== kind) {
      continue;
    }
    const partitionId = record.value.partitionId;
    if (
      typeof partitionId !== 'string' ||
      !partitionIds.has(partitionId)
    ) {
      throw failure('supervisor_readiness_cross_partition_reference', {
        referenceKind: kind,
        partitionId,
      });
    }
    if (result.has(partitionId)) {
      throw failure('supervisor_readiness_lifecycle_reference_duplicate', {
        referenceKind: kind,
        partitionId,
      });
    }
    result.set(partitionId, record);
  }
  for (const partitionId of partitionIds) {
    if (!result.has(partitionId)) {
      throw failure('supervisor_readiness_lifecycle_reference_missing', {
        referenceKind: kind,
        partitionId,
      });
    }
  }
  return result;
}

function assertManifestTopology(manifest: SchemaRecord) {
  if (
    manifest.schemaVersion !== 'goal-contract-partition-manifest/v2' ||
    manifest.manifestAuthorityMode !== 'final_child_membership' ||
    !Array.isArray(manifest.partitions) ||
    !Array.isArray(manifest.topologicalOrder) ||
    manifest.partitions.length !== manifest.topologicalOrder.length
  ) {
    throw failure('supervisor_readiness_manifest_v2_required');
  }
  const byId = new Map(
    manifest.partitions.map((partition: SchemaRecord) => [
      partition.partitionId,
      partition,
    ])
  );
  if (
    byId.size !== manifest.partitions.length ||
    manifest.topologicalOrder.some(
      (partitionId: string) => !byId.has(partitionId)
    ) ||
    new Set(manifest.topologicalOrder).size !==
      manifest.topologicalOrder.length
  ) {
    throw failure('supervisor_readiness_manifest_topology_invalid');
  }
  const orderById = new Map(
    manifest.topologicalOrder.map(
      (partitionId: string, index: number) => [partitionId, index]
    )
  );
  for (const partition of manifest.partitions) {
    const dependencyPartitionIds = partition.dependencyPartitionIds;
    const partitionOrder = orderById.get(partition.partitionId);
    if (
      !Array.isArray(dependencyPartitionIds) ||
      new Set(dependencyPartitionIds).size !==
        dependencyPartitionIds.length ||
      dependencyPartitionIds.some(
        (dependencyPartitionId: string) =>
          !orderById.has(dependencyPartitionId) ||
          (orderById.get(dependencyPartitionId) as number) >=
            (partitionOrder as number)
      )
    ) {
      throw failure('supervisor_readiness_manifest_topology_invalid', {
        partitionId: partition.partitionId,
      });
    }
  }
  return Object.freeze({ byId });
}

function assertGlobalLifecycleBinding(
  record: SchemaRecord,
  manifest: SchemaRecord,
  activation: SchemaRecord
): void {
  for (const [field, expected] of Object.entries({
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId: activation.attemptId,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    graphHash: manifest.partitionImpactGraphHash,
    feasibilityHash:
      manifest.partitionClosureFeasibilityReceiptHash,
    driftHash: manifest.driftHash,
  })) {
    if (record[field] !== undefined || expected !== undefined) {
      assertValue(
        record[field],
        expected,
        'supervisor_readiness_lifecycle_reference_stale',
        field
      );
    }
  }
}

function assertPartitionLifecycleBinding(
  record: SchemaRecord,
  kind: string,
  partition: SchemaRecord,
  manifest: SchemaRecord,
  activation: SchemaRecord
): void {
  const requiredImpactFields = new Set([
    'graphHash',
    'feasibilityHash',
    'driftHash',
  ]);
  for (const [field, expected] of Object.entries({
    partitionId: partition.partitionId,
    childContractHash: partition.childContractHash,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    graphHash: manifest.partitionImpactGraphHash,
    feasibilityHash:
      manifest.partitionClosureFeasibilityReceiptHash,
    driftHash: manifest.driftHash,
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId: activation.attemptId,
  })) {
    if (!Object.hasOwn(record, field)) {
      if (requiredImpactFields.has(field) && expected !== undefined) {
        throw failure(
          'supervisor_readiness_lifecycle_reference_stale',
          {
            referenceKind: kind,
            partitionId: partition.partitionId,
            field,
            expected,
            actual: undefined,
          }
        );
      }
      continue;
    }
    if (record[field] !== expected) {
      const crossPartition =
        field === 'partitionId' ||
        field === 'childContractHash';
      throw failure(
        crossPartition
          ? 'supervisor_readiness_cross_partition_reference'
          : 'supervisor_readiness_lifecycle_reference_stale',
        {
          referenceKind: kind,
          partitionId: partition.partitionId,
          field,
          expected,
          actual: record[field],
        }
      );
    }
  }
  if (record.decision !== 'pass') {
    throw failure('supervisor_readiness_lifecycle_reference_stale', {
      referenceKind: kind,
      partitionId: partition.partitionId,
      field: 'decision',
    });
  }
}

function buildProjection(authority: SchemaRecord) {
  const validated = authority.validated;
  const manifest = validated.manifest;
  const { byId } = assertManifestTopology(manifest);
  assertHash(
    manifest.masterSourceHash,
    authority.sourceHash,
    'supervisor_readiness_active_authority_mismatch',
    'masterSourceHash'
  );
  const records = scanLifecycleRecords(authority.unitRoot);
  const activationArtifact = uniqueGlobalRecord(
    records,
    'activation'
  );
  const campaignClosureArtifact = uniqueGlobalRecord(
    records,
    'campaignClosure'
  );
  const activation = activationArtifact.value;
  const campaignClosure = campaignClosureArtifact.value;
  for (const [field, expected] of Object.entries({
    goalContractHash: manifest.goalContractHash,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    graphHash: manifest.partitionImpactGraphHash,
    feasibilityHash:
      manifest.partitionClosureFeasibilityReceiptHash,
    driftHash: manifest.driftHash,
  })) {
    assertValue(
      activation[field],
      expected,
      'supervisor_readiness_lifecycle_reference_stale',
      field
    );
  }
  if (activation.decision !== 'pass') {
    throw failure('supervisor_readiness_lifecycle_reference_stale', {
      referenceKind: 'activation',
      field: 'decision',
    });
  }
  assertGlobalLifecycleBinding(
    campaignClosure,
    manifest,
    activation
  );
  assertValue(
    campaignClosure.goalContractHash,
    manifest.goalContractHash,
    'supervisor_readiness_lifecycle_reference_stale',
    'goalContractHash'
  );
  if (campaignClosure.decision !== 'pass') {
    throw failure('supervisor_readiness_lifecycle_reference_stale', {
      referenceKind: 'campaignClosure',
      field: 'decision',
    });
  }
  const partitionIds = new Set<string>(
    manifest.topologicalOrder
  );
  const releases = partitionRecordMap(records, 'release', partitionIds);
  const leases = partitionRecordMap(records, 'lease', partitionIds);
  const evidence = partitionRecordMap(records, 'evidence', partitionIds);
  const closures = partitionRecordMap(records, 'closure', partitionIds);

  const releaseSemanticHashes = manifest.partitions.map(
    (partition: SchemaRecord) => {
      const artifact = releases.get(partition.partitionId) as ArtifactRecord;
      const receipt = artifact.value;
      for (const [field, expected] of Object.entries({
        partitionId: partition.partitionId,
        masterSourceHash: manifest.masterSourceHash,
        sourceSnapshotHash: manifest.sourceSnapshotHash,
        partitionManifestHash:
          validated.partitionManifestDocumentHash,
        partitionManifestAuthorityHash:
          manifest.partitionManifestHash,
        partitionPlanHash: manifest.partitionPlanHash,
        partitionSetHash: manifest.partitionSetHash,
        sourceCompositionPolicyHash:
          manifest.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          manifest.sourceAuthorityBundleHash,
        goalContractHash: partition.childContractHash,
        childContractHash: partition.childContractHash,
        selectionSetHash: partition.selectionSetHash,
        childCompilationReceiptHash:
          partition.childCompilationReceiptHash,
      })) {
        if (receipt[field] !== expected) {
          throw failure(
            field === 'partitionId' || field === 'childContractHash'
              ? 'supervisor_readiness_cross_partition_reference'
              : 'supervisor_readiness_lifecycle_reference_stale',
            {
              referenceKind: 'release',
              partitionId: partition.partitionId,
              field,
              expected,
              actual: receipt[field],
            }
          );
        }
      }
      if (
        receipt.decision !== 'pass' ||
        !Array.isArray(receipt.blockingReasons) ||
        receipt.blockingReasons.length !== 0
      ) {
        throw failure('supervisor_readiness_lifecycle_reference_stale', {
          referenceKind: 'release',
          partitionId: partition.partitionId,
          field: 'decision',
        });
      }
      return hashControlPlaneValue(receipt);
    }
  );
  assertArtifactBindings(
    activation.childReleaseReceiptHashes,
    releaseSemanticHashes,
    'childReleaseReceiptHashes'
  );

  const rows = manifest.topologicalOrder.map(
    (partitionId: string, dagOrder: number) => {
      const partition = byId.get(partitionId) as SchemaRecord;
      const leaseArtifact = leases.get(partitionId) as ArtifactRecord;
      const evidenceArtifact = evidence.get(
        partitionId
      ) as ArtifactRecord;
      const closureArtifact = closures.get(
        partitionId
      ) as ArtifactRecord;
      const lease = leaseArtifact.value;
      const evidenceRecord = evidenceArtifact.value;
      const closure = closureArtifact.value;
      const expectedPredecessorClosureReceiptHashes =
        partition.dependencyPartitionIds.map(
          (dependencyPartitionId: string) =>
            (
              closures.get(
                dependencyPartitionId
              ) as ArtifactRecord
            ).value.receiptHash
        );
      assertPartitionLifecycleBinding(
        lease,
        'lease',
        partition,
        manifest,
        activation
      );
      assertPartitionLifecycleBinding(
        evidenceRecord,
        'evidence',
        partition,
        manifest,
        activation
      );
      assertPartitionLifecycleBinding(
        closure,
        'closure',
        partition,
        manifest,
        activation
      );
      for (const record of [lease, closure]) {
        if (
          stableControlPlaneStringify(
            record.predecessorClosureReceiptHashes
          ) !==
          stableControlPlaneStringify(
            expectedPredecessorClosureReceiptHashes
          )
        ) {
          throw failure(
            'supervisor_readiness_lifecycle_reference_stale',
            {
              partitionId,
              field: 'predecessorClosureReceiptHashes',
              expected: expectedPredecessorClosureReceiptHashes,
              actual: record.predecessorClosureReceiptHashes,
            }
          );
        }
      }
      assertValue(
        lease.leaseOrdinal,
        dagOrder + 1,
        'supervisor_readiness_lifecycle_reference_stale',
        'leaseOrdinal'
      );
      assertHash(
        evidenceRecord.leaseReceiptHash,
        lease.receiptHash,
        'supervisor_readiness_lifecycle_reference_stale',
        'leaseReceiptHash'
      );
      assertHash(
        closure.leaseReceiptHash,
        lease.receiptHash,
        'supervisor_readiness_lifecycle_reference_stale',
        'closure.leaseReceiptHash'
      );
      assertHash(
        closure.subcontractEvidenceHash,
        evidenceRecord.evidenceHash,
        'supervisor_readiness_lifecycle_reference_stale',
        'subcontractEvidenceHash'
      );
      return Object.freeze({
        rootGoalId: manifest.goalContractHash,
        partitionId,
        partitionManifestHash: manifest.partitionManifestHash,
        childContractPath: projectChildContractPath(
          partition.childContractPath
        ),
        childContractHash: partition.childContractHash,
        dagOrder,
        childReleaseRef: releases.get(partitionId)?.ref,
        activationRef: activationArtifact.ref,
        leaseRef: leaseArtifact.ref,
        evidenceRef: evidenceArtifact.ref,
        childClosureRef: closureArtifact.ref,
        campaignClosureRef: campaignClosureArtifact.ref,
      });
    }
  );
  assertArtifactBindings(
    campaignClosure.orderedChildClosureReceiptHashes,
    rows.map(
      (row: SchemaRecord) =>
        (closures.get(row.partitionId) as ArtifactRecord).value
          .receiptHash
    ),
    'orderedChildClosureReceiptHashes'
  );

  const projection = Object.freeze({
    schemaVersion:
      'goal-contract-supervisor-readiness-projection/v1',
    authorityMode: authority.authorityMode,
    sourceHash: authority.sourceHash,
    ...(authority.generationKey === undefined
      ? {}
      : { generationKey: authority.generationKey }),
    ...(authority.requirementSetId === undefined
      ? {}
      : { requirementSetId: authority.requirementSetId }),
    activePointerPath: normalizePath(authority.activePointerPath),
    authorityUnitRoot: normalizePath(authority.unitRoot),
    partitionRunId: validated.partitionRunId,
    partitionManifestHash: validated.partitionManifestHash,
    partitionManifestDocumentHash:
      validated.partitionManifestDocumentHash,
    lifecycleRoot: normalizePath(
      path.join(authority.unitRoot, 'lifecycle')
    ),
    partitions: Object.freeze(rows),
  });
  try {
    validateGoalContractSchema(PROJECTION_SCHEMA, projection);
  } catch (error) {
    throw failure('supervisor_readiness_projection_schema_invalid', {
      cause: (error as { failureClass?: string }).failureClass,
    });
  }
  return projection;
}

function resolveSupervisorReadinessProjection(
  input: unknown = {}
) {
  if (!isRecord(input)) {
    throw failure('supervisor_readiness_request_invalid');
  }
  assertNoAuthorityOverride(input);
  const repositoryRoot = requireRepositoryRoot(input.repositoryRoot);
  const sourceHash = requireSourceHash(input.sourceHash);
  const authority =
    input.requirementSetId === undefined
      ? standaloneAuthority(repositoryRoot, sourceHash)
      : requirementRecordAuthority(
          repositoryRoot,
          sourceHash,
          input.requirementSetId
        );
  return buildProjection(authority);
}

module.exports = {
  resolveSupervisorReadinessProjection,
};
