const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
  stableControlPlaneStringify,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  commitCreateOnceReceipt,
  readCommittedReceipt,
} = require(
  __filename.endsWith('.ts')
    ? './campaign-receipt-store.ts'
    : './campaign-receipt-store'
);
const {
  verifySubcontractEvidence,
} = require(
  __filename.endsWith('.ts')
    ? './subcontract-evidence.ts'
    : './subcontract-evidence'
);
const {
  deriveClosureScopeMode,
} = require(
  __filename.endsWith('.ts')
    ? './partition-closure-scope.ts'
    : './partition-closure-scope'
);
const {
  lifecycleAuthorityFieldsFromManifest,
  verifyLifecycleAuthorityBinding,
  verifyLifecyclePredecessorOrigin,
} = require(
  __filename.endsWith('.ts')
    ? './lifecycle-authority-binding.ts'
    : './lifecycle-authority-binding'
);

const ACTIVATION_SCHEMA =
  'goal-contract-campaign-activation-receipt.schema.json';
const LEASE_SCHEMA =
  'goal-contract-subcontract-execution-lease.schema.json';
const CLOSURE_SCHEMA =
  'goal-contract-subcontract-closure-receipt.schema.json';
const REPAIR_AUTHORITY_SCHEMA =
  'goal-contract-campaign-repair-authority-receipt.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const AUTHORITY_INVALIDATION_FIELDS = Object.freeze([
  'sourceCompositionMode',
  'sourceCompositionPolicyHash',
  'policyAuthorityBindingHash',
  'orderedSourceSnapshotSetHash',
  'primarySourceSnapshotHash',
  'primarySourceHash',
  'subordinateSourceSnapshotHashes',
  'subordinateSourceHashes',
  'sourceAuthorityBundleHash',
  'namespaceOwnershipHash',
  'parentTaskContainmentHash',
  'requiredSubordinateSetHash',
  'requiredSubordinateBindings',
  'subordinateCoverageReceiptHashes',
]);

// Schema validation establishes the shape before these dynamic records are consumed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SchemaRecord = Record<string, any>;

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

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('subcontract_closure_request_invalid', { field });
  }
  return value;
}

function requireHash(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw failure('subcontract_closure_request_invalid', { field });
  }
  return value;
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function equalCanonical(left: unknown, right: unknown): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  return (
    stableControlPlaneStringify(left) ===
    stableControlPlaneStringify(right)
  );
}

function equalOrdered(left: unknown, right: unknown): boolean {
  return Array.isArray(left) && Array.isArray(right) && equalCanonical(left, right);
}

function normalizePathText(value: unknown, field = 'path'): string {
  const text = requireText(value, field).replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(text) ||
    /^[A-Za-z]:\//u.test(text) ||
    text.split('/').includes('..')
  ) {
    throw failure('subcontract_governed_path_escape', { path: value });
  }
  return path.posix.normalize(text);
}

function resolveRepositoryPath(
  repositoryRoot: string,
  pathValue: unknown,
  field = 'path'
): { relativePath: string; absolutePath: string } {
  const root = fs.realpathSync(repositoryRoot);
  const raw = requireText(pathValue, field);
  const normalizedInput = raw.replace(/\\/gu, '/');
  const absolutePath = path.isAbsolute(raw)
    ? path.resolve(raw)
    : path.resolve(
        root,
        ...normalizePathText(normalizedInput, field).split('/')
      );
  if (
    absolutePath !== root &&
    !absolutePath.startsWith(`${root}${path.sep}`)
  ) {
    throw failure('subcontract_governed_path_escape', { path: pathValue });
  }
  if (fs.existsSync(absolutePath)) {
    const realPath = fs.realpathSync(absolutePath);
    if (
      realPath !== root &&
      !realPath.startsWith(`${root}${path.sep}`)
    ) {
      throw failure('subcontract_governed_path_symlink_escape', {
        path: pathValue,
      });
    }
  }
  return {
    relativePath: path.relative(root, absolutePath).replace(/\\/gu, '/'),
    absolutePath,
  };
}

function readMatchingCommittedReceipt({
  targetPath,
  schemaName,
  candidate,
  failureClass,
}: {
  targetPath: string;
  schemaName: string;
  candidate: unknown;
  failureClass: string;
}): SchemaRecord {
  if (!fs.existsSync(targetPath)) {
    throw failure(failureClass, {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: 'receipt_missing',
    });
  }
  let committed;
  try {
    committed = readCommittedReceipt({ targetPath, schemaName });
  } catch (error) {
    throw failure(failureClass, {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  if (!equalCanonical(committed, candidate)) {
    throw failure(failureClass, {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: 'receipt_bytes_mismatch',
    });
  }
  return committed;
}

function verifyCommittedRepairAuthority({
  receiptRoot,
  activation,
  manifest,
  candidate,
}: {
  receiptRoot: string;
  activation: SchemaRecord;
  manifest: SchemaRecord;
  candidate: unknown;
}): SchemaRecord | null {
  const targetPath = path.resolve(
    receiptRoot,
    'campaigns',
    activation.campaignId,
    'repair',
    'authority.receipt.json'
  );
  if (!fs.existsSync(targetPath)) {
    if (candidate !== undefined) {
      throw failure('campaign_repair_authority_required', {
        reason: 'repair_authority_receipt_missing',
        targetPath: targetPath.replace(/\\/gu, '/'),
      });
    }
    return null;
  }
  let committed;
  try {
    committed = readCommittedReceipt({
      targetPath,
      schemaName: REPAIR_AUTHORITY_SCHEMA,
    });
  } catch (error) {
    throw failure('campaign_repair_authority_required', {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  if (candidate !== undefined && !equalCanonical(committed, candidate)) {
    throw failure('campaign_repair_authority_required', {
      reason: 'repair_authority_receipt_mismatch',
    });
  }
  const { verifyGoalCampaignRepairAuthority } = require(
    __filename.endsWith('.ts')
      ? './campaign-repair-authority.ts'
      : './campaign-repair-authority'
  );
  return verifyGoalCampaignRepairAuthority(committed, {
    baseActivationReceipt: activation,
    partitionManifest: manifest,
    expectedRepairAttemptId: committed.repairAttemptId,
    partitionManifestDocumentHash:
      committed.basePartitionManifestDocumentHash,
  });
}

function requireRepairClosureMode({
  repairAuthority,
  repairAuthorityCandidate,
  leaseCandidate,
  partitionId,
}: {
  repairAuthority: SchemaRecord | null;
  repairAuthorityCandidate: unknown;
  leaseCandidate: SchemaRecord;
  partitionId: string;
}): boolean {
  if (repairAuthority === null) {
    if (
      leaseCandidate.schemaVersion ===
      'goal-contract-subcontract-execution-lease/v2'
    ) {
      throw failure('campaign_repair_authority_required', {
        partitionId,
      });
    }
    return false;
  }
  const preserved = new Set(
    Array.isArray(repairAuthority.preservedPartitionIds)
      ? repairAuthority.preservedPartitionIds
      : []
  );
  const invalidated = new Set(
    Array.isArray(repairAuthority.invalidatedPartitionIds)
      ? repairAuthority.invalidatedPartitionIds
      : []
  );
  if (preserved.has(partitionId)) {
    throw failure('campaign_repair_partition_preserved', { partitionId });
  }
  if (
    !invalidated.has(partitionId) ||
    repairAuthorityCandidate === undefined ||
    leaseCandidate.schemaVersion !==
      'goal-contract-subcontract-execution-lease/v2'
  ) {
    throw failure('campaign_repair_authority_required', { partitionId });
  }
  return true;
}

function findManifestPartition(
  manifest: SchemaRecord,
  partitionId: string
): { partition: SchemaRecord; index: number } {
  if (
    !Array.isArray(manifest.partitions) ||
    !Array.isArray(manifest.topologicalOrder)
  ) {
    throw failure('subcontract_manifest_membership_missing');
  }
  const index = manifest.topologicalOrder.indexOf(partitionId);
  if (index < 0) {
    throw failure('subcontract_manifest_membership_missing', {
      partitionId,
    });
  }
  const partition = manifest.partitions.find(
    (candidate) => candidate.partitionId === partitionId
  );
  if (!isRecord(partition)) {
    throw failure('subcontract_manifest_membership_missing', {
      partitionId,
    });
  }
  return { partition, index };
}

function verifyRootBindings({
  activation,
  manifest,
  lease,
  partition,
  partitionId,
}: {
  activation: SchemaRecord;
  manifest: SchemaRecord;
  lease: SchemaRecord;
  partition: SchemaRecord;
  partitionId: string;
}): void {
  const closureScopeMode = deriveClosureScopeMode(partition);
  const repairLease =
    lease.schemaVersion ===
    'goal-contract-subcontract-execution-lease/v2';
  const expectedLeaseAttemptId = repairLease
    ? requireText(lease.repairAttemptId, 'repairAttemptId')
    : activation.attemptId;
  if (
    repairLease &&
    (lease.baseAttemptId !== activation.attemptId ||
      lease.attemptId !== expectedLeaseAttemptId)
  ) {
    throw failure('subcontract_closure_authority_stale', {
      field: 'attemptId',
    });
  }
  const bindings = [
    [lease.campaignId, activation.campaignId, 'campaignId'],
    [
      lease.campaignActivationHash,
      activation.campaignActivationHash,
      'campaignActivationHash',
    ],
    [
      lease.activationReceiptHash,
      activation.receiptHash,
      'activationReceiptHash',
    ],
    [lease.attemptId, expectedLeaseAttemptId, 'attemptId'],
    [lease.partitionId, partitionId, 'partitionId'],
    [
      manifest.partitionManifestHash,
      activation.partitionManifestHash,
      'partitionManifestHash',
    ],
    [
      lease.partitionManifestHash,
      activation.partitionManifestHash,
      'partitionManifestHash',
    ],
    [
      manifest.partitionSetHash,
      activation.partitionSetHash,
      'partitionSetHash',
    ],
    [lease.partitionSetHash, activation.partitionSetHash, 'partitionSetHash'],
    [
      manifest.partitionPlanHash,
      activation.partitionPlanHash,
      'partitionPlanHash',
    ],
    [lease.partitionPlanHash, activation.partitionPlanHash, 'partitionPlanHash'],
    [
      manifest.sourceCompositionPolicyHash,
      activation.sourceCompositionPolicyHash,
      'sourceCompositionPolicyHash',
    ],
    [
      lease.sourceCompositionPolicyHash,
      activation.sourceCompositionPolicyHash,
      'sourceCompositionPolicyHash',
    ],
    [
      manifest.sourceAuthorityBundleHash,
      activation.sourceAuthorityBundleHash,
      'sourceAuthorityBundleHash',
    ],
    [
      lease.sourceAuthorityBundleHash,
      activation.sourceAuthorityBundleHash,
      'sourceAuthorityBundleHash',
    ],
    [
      partition.childContractHash,
      lease.childContractHash,
      'childContractHash',
    ],
    [partition.selectionSetHash, lease.selectionHash, 'selectionHash'],
    [lease.closureScopeMode, closureScopeMode, 'closureScopeMode'],
  ];
  for (const [actual, expected, field] of bindings) {
    if (actual !== expected) {
      throw failure('subcontract_closure_authority_stale', {
        field,
        expected,
        actual,
      });
    }
  }
  verifyLifecycleAuthorityBinding({
    record: activation,
    partitionManifest: manifest,
    campaignId: activation.campaignId,
    attemptId: activation.attemptId,
  });
  verifyLifecycleAuthorityBinding({
    record: lease,
    partitionManifest: manifest,
    campaignId: activation.campaignId,
    attemptId: expectedLeaseAttemptId,
    partitionId,
    childContractHash: partition.childContractHash,
    nodeAttemptId: lease.nodeAttemptId,
  });
  if (
    activation.decision !== 'pass' ||
    lease.decision !== 'pass' ||
    activation.authorizationCount !== 1 ||
    lease.authorizationCount !== 1 ||
    activation.modelInvocationCount !== 0 ||
    lease.modelInvocationCount !== 0
  ) {
    throw failure('subcontract_closure_authority_stale');
  }
}

function verifyCurrentChildContract({
  authorityRoot,
  partition,
  lease,
}: {
  authorityRoot: string;
  partition: SchemaRecord;
  lease: SchemaRecord;
}): void {
  const child = resolveRepositoryPath(
    authorityRoot,
    partition.childContractPath,
    'childContractPath'
  );
  if (!fs.existsSync(child.absolutePath)) {
    throw failure('subcontract_child_contract_stale', {
      childContractPath: child.relativePath,
      reason: 'child_contract_missing',
    });
  }
  const currentHash = sha256(fs.readFileSync(child.absolutePath));
  if (
    currentHash !== partition.childContractHash ||
    currentHash !== lease.childContractHash
  ) {
    throw failure('subcontract_child_contract_stale', {
      childContractPath: child.relativePath,
      expectedHash: partition.childContractHash,
      actualHash: currentHash,
    });
  }
}

function verifyCurrentTaskEvidence(
  repositoryRoot: string,
  evidence: SchemaRecord
): void {
  if (!Array.isArray(evidence.taskEvidenceRecords)) {
    throw failure('subcontract_evidence_hash_mismatch', {
      field: 'taskEvidenceRecords',
    });
  }
  for (const record of evidence.taskEvidenceRecords) {
    if (!isRecord(record)) {
      throw failure('subcontract_evidence_hash_mismatch', {
        field: 'taskEvidenceRecords',
      });
    }
    const { taskEvidenceHash, ...payload } = record;
    if (hashControlPlaneValue(payload) !== taskEvidenceHash) {
      throw failure('subcontract_evidence_hash_mismatch', {
        field: 'taskEvidenceHash',
        taskId: record.taskId,
      });
    }
    const log = resolveRepositoryPath(
      repositoryRoot,
      record.logPath,
      'logPath'
    );
    if (
      !fs.existsSync(log.absolutePath) ||
      sha256(fs.readFileSync(log.absolutePath)) !== record.logHash
    ) {
      throw failure('subcontract_evidence_stale', {
        taskId: record.taskId,
        logPath: log.relativePath,
      });
    }
  }
}

function verifyCurrentGovernedFiles(
  repositoryRoot: string,
  evidence: SchemaRecord
): void {
  if (!Array.isArray(evidence.governedFileManifest)) {
    throw failure('subcontract_evidence_hash_mismatch', {
      field: 'governedFileManifest',
    });
  }
  for (const record of evidence.governedFileManifest) {
    if (!isRecord(record)) {
      throw failure('subcontract_evidence_hash_mismatch', {
        field: 'governedFileManifest',
      });
    }
    const governed = resolveRepositoryPath(
      repositoryRoot,
      record.path,
      'governedPath'
    );
    const exists = fs.existsSync(governed.absolutePath);
    if (exists !== record.existsAfter) {
      throw failure('subcontract_evidence_stale', {
        path: governed.relativePath,
      });
    }
    if (
      exists &&
      sha256(fs.readFileSync(governed.absolutePath)) !==
        record.sourceHashAfter
    ) {
      throw failure('subcontract_evidence_stale', {
        path: governed.relativePath,
      });
    }
  }
}

function verifyEvidenceInternalHashes(
  evidence: SchemaRecord
): void {
  const expected = {
    governedFileManifestHash: hashControlPlaneValue(
      evidence.governedFileManifest
    ),
    dependencyClosureHash: hashControlPlaneValue(
      evidence.dependencyClosureRecords
    ),
    productionReachabilityReceiptHash: hashControlPlaneValue(
      evidence.productionReachabilityRecords
    ),
    integrationVerificationReceiptHash: hashControlPlaneValue(
      evidence.integrationVerificationRecords
    ),
  };
  for (const [field, value] of Object.entries(expected)) {
    if (evidence[field] !== value) {
      throw failure('subcontract_evidence_hash_mismatch', { field });
    }
  }
  const orderedVerificationEvidenceHashes = [
    ...evidence.taskEvidenceRecords.map(
      ({ taskEvidenceHash }) => taskEvidenceHash
    ),
    ...evidence.integrationVerificationRecords.map(
      ({ integrationVerificationHash }) => integrationVerificationHash
    ),
    ...evidence.evidenceCategoryRecords.map(
      ({ evidenceHash }) => evidenceHash
    ),
  ];
  if (
    !equalOrdered(
      evidence.orderedVerificationEvidenceHashes,
      orderedVerificationEvidenceHashes
    )
  ) {
    throw failure('subcontract_evidence_hash_mismatch', {
      field: 'orderedVerificationEvidenceHashes',
    });
  }
}

function verifyEvidenceBindings({
  activation,
  lease,
  manifest,
  partition,
  evidence,
}: {
  activation: SchemaRecord;
  lease: SchemaRecord;
  manifest: SchemaRecord;
  partition: SchemaRecord;
  evidence: SchemaRecord;
}): void {
  const bindings = [
    [evidence.campaignId, activation.campaignId, 'campaignId'],
    [
      evidence.campaignActivationHash,
      activation.campaignActivationHash,
      'campaignActivationHash',
    ],
    [
      evidence.activationReceiptHash,
      activation.receiptHash,
      'activationReceiptHash',
    ],
    [evidence.leaseReceiptHash, lease.receiptHash, 'leaseReceiptHash'],
    [evidence.attemptId, lease.attemptId, 'attemptId'],
    [evidence.partitionId, lease.partitionId, 'partitionId'],
    [
      evidence.partitionManifestHash,
      manifest.partitionManifestHash,
      'partitionManifestHash',
    ],
    [
      evidence.partitionPlanHash,
      manifest.partitionPlanHash,
      'partitionPlanHash',
    ],
    [
      evidence.childContractHash,
      partition.childContractHash,
      'childContractHash',
    ],
    [
      evidence.sourceCompositionPolicyHash,
      activation.sourceCompositionPolicyHash,
      'sourceCompositionPolicyHash',
    ],
    [
      evidence.sourceAuthorityBundleHash,
      activation.sourceAuthorityBundleHash,
      'sourceAuthorityBundleHash',
    ],
    [evidence.closureScopeMode, lease.closureScopeMode, 'closureScopeMode'],
  ];
  for (const [actual, expected, field] of bindings) {
    if (actual !== expected) {
      throw failure('subcontract_evidence_stale', {
        field,
        expected,
        actual,
      });
    }
  }
  verifyLifecycleAuthorityBinding({
    record: evidence,
    partitionManifest: manifest,
    campaignId: activation.campaignId,
    attemptId: lease.attemptId,
    partitionId: lease.partitionId,
    childContractHash: partition.childContractHash,
    nodeAttemptId: lease.nodeAttemptId,
  });
  const subordinateCoverageReceiptHashes =
    partition.subordinateCoverageReceiptHashes || [];
  if (
    !equalOrdered(
      evidence.subordinateCoverageReceiptHashes,
      [...subordinateCoverageReceiptHashes].sort()
    )
  ) {
    throw failure('subcontract_evidence_stale', {
      field: 'subordinateCoverageReceiptHashes',
    });
  }
  for (const field of [
    'subcontractModelAuditCount',
    'reviewerInvocationCount',
    'auditorInvocationCount',
    'judgeSemanticAttemptCount',
  ]) {
    if (evidence[field] !== 0) {
      throw failure('subcontract_model_counter_nonzero', { field });
    }
  }
  if (evidence.decision !== 'pass') {
    throw failure('subcontract_evidence_stale', { field: 'decision' });
  }
}

function verifyPredecessorClosures({
  repositoryRoot,
  receiptRoot,
  activation,
  lease,
  manifest,
  partition,
  evidence,
}: {
  repositoryRoot: string;
  receiptRoot: string;
  activation: SchemaRecord;
  lease: SchemaRecord;
  manifest: SchemaRecord;
  partition: SchemaRecord;
  evidence: SchemaRecord;
}): void {
  const dependencies = partition.dependencyPartitionIds || [];
  const records = evidence.dependencyClosureRecords;
  const repairLease =
    lease.schemaVersion ===
    'goal-contract-subcontract-execution-lease/v2';
  const predecessorBindings = repairLease
    ? lease.predecessorClosureBindings
    : [];
  if (
    !Array.isArray(records) ||
    records.length !== dependencies.length ||
    !Array.isArray(lease.predecessorClosureReceiptHashes) ||
    lease.predecessorClosureReceiptHashes.length !== dependencies.length
  ) {
    throw failure('subcontract_dependency_incomplete');
  }
  if (
    repairLease &&
    (!Array.isArray(predecessorBindings) ||
      predecessorBindings.length !== dependencies.length)
  ) {
    throw failure('subcontract_predecessor_closure_stale', {
      reason: 'predecessor_binding_set_mismatch',
    });
  }
  for (let index = 0; index < dependencies.length; index += 1) {
    const dependencyId = dependencies[index];
    const record = records[index];
    const dependencyIndex =
      manifest.topologicalOrder.indexOf(dependencyId);
    if (
      dependencyIndex < 0 ||
      dependencyIndex >= manifest.topologicalOrder.indexOf(partition.partitionId) ||
      !isRecord(record) ||
      record.partitionId !== dependencyId ||
      record.closureReceiptHash !==
        lease.predecessorClosureReceiptHashes[index]
    ) {
      throw failure('subcontract_predecessor_closure_stale', {
        dependencyId,
      });
    }
    const predecessorBinding = repairLease
      ? predecessorBindings[index]
      : undefined;
    if (
      repairLease &&
      (!isRecord(predecessorBinding) ||
        predecessorBinding.partitionId !== dependencyId ||
        !['preserved_base', 'repaired'].includes(
          predecessorBinding.origin
        ) ||
        predecessorBinding.closureReceiptHash !==
          record.closureReceiptHash)
    ) {
      throw failure('subcontract_predecessor_closure_stale', {
        dependencyId,
      });
    }
    const closureDirectory =
      repairLease && predecessorBinding.origin === 'repaired'
        ? ['repair', 'closures']
        : ['closures'];
    const closurePath = path.resolve(
      receiptRoot,
      'campaigns',
      activation.campaignId,
      ...closureDirectory,
      `${String(dependencyIndex + 1).padStart(4, '0')}-${dependencyId}.receipt.json`
    );
    let committed;
    try {
      committed = readCommittedReceipt({
        targetPath: closurePath,
        schemaName: CLOSURE_SCHEMA,
      });
    } catch (error) {
      throw failure('subcontract_predecessor_closure_stale', {
        dependencyId,
        reason: (error as { failureClass?: string }).failureClass,
      });
    }
    const dependency = manifest.partitions.find(
      (candidate) => candidate.partitionId === dependencyId
    );
    if (
      !isRecord(dependency) ||
      (repairLease && !isRecord(predecessorBinding))
    ) {
      throw failure('subcontract_predecessor_closure_stale', {
        dependencyId,
      });
    }
    if (
      committed.receiptHash !== record.closureReceiptHash ||
      committed.partitionId !== dependencyId ||
      committed.partitionManifestHash !== manifest.partitionManifestHash ||
      committed.decision !== 'pass'
    ) {
      throw failure('subcontract_predecessor_closure_stale', {
        dependencyId,
      });
    }
    let predecessorLease;
    if (repairLease) {
      const predecessorLeasePath = path.resolve(
        receiptRoot,
        'campaigns',
        activation.campaignId,
        ...(predecessorBinding.origin === 'repaired'
          ? ['repair', 'leases']
          : ['leases']),
        `${String(dependencyIndex + 1).padStart(4, '0')}-${dependencyId}.receipt.json`
      );
      try {
        predecessorLease = readCommittedReceipt({
          targetPath: predecessorLeasePath,
          schemaName: LEASE_SCHEMA,
        });
      } catch (error) {
        throw failure('subcontract_predecessor_closure_stale', {
          dependencyId,
          targetPath: predecessorLeasePath.replace(/\\/gu, '/'),
          reason: (error as { failureClass?: string }).failureClass,
        });
      }
      if (
        committed.leaseReceiptHash !== predecessorLease.receiptHash ||
        predecessorLease.partitionId !== dependencyId ||
        predecessorLease.attemptId !==
          (predecessorBinding.origin === 'repaired'
            ? lease.repairAttemptId
            : lease.baseAttemptId) ||
        predecessorLease.partitionManifestHash !==
          manifest.partitionManifestHash ||
        predecessorLease.childContractHash !==
          dependency.childContractHash ||
        predecessorLease.decision !== 'pass' ||
        (predecessorBinding.origin === 'preserved_base' &&
          predecessorLease.schemaVersion !==
            'goal-contract-subcontract-execution-lease/v1') ||
        (predecessorBinding.origin === 'repaired' &&
          (predecessorLease.schemaVersion !==
            'goal-contract-subcontract-execution-lease/v2' ||
            predecessorLease.baseAttemptId !== lease.baseAttemptId ||
            predecessorLease.repairAttemptId !== lease.repairAttemptId ||
            predecessorLease.repairAuthorityReceiptHash !==
              lease.repairAuthorityReceiptHash))
      ) {
        throw failure('subcontract_predecessor_closure_stale', {
          dependencyId,
          reason: 'predecessor_lease_lineage_mismatch',
        });
      }
    }
    verifyLifecyclePredecessorOrigin({
      record: committed,
      partitionManifest: manifest,
      campaignId: activation.campaignId,
      campaignAttemptId: activation.attemptId,
      baseAttemptId: lease.baseAttemptId,
      repairAttemptId: lease.repairAttemptId,
      predecessorOrigin: predecessorBinding?.origin || 'base',
      partitionId: dependencyId,
      childContractHash: dependency.childContractHash,
      nodeAttemptId: repairLease
        ? predecessorLease.nodeAttemptId
        : committed.nodeAttemptId,
    });
    if (!isRecord(record.artifactHashes)) {
      throw failure('subcontract_dependency_incomplete', {
        dependencyId,
      });
    }
    for (const [artifactPath, artifactHash] of Object.entries(
      record.artifactHashes
    )) {
      requireHash(artifactHash, 'artifactHash');
      const artifact = resolveRepositoryPath(
        repositoryRoot,
        artifactPath,
        'artifactPath'
      );
      if (
        !fs.existsSync(artifact.absolutePath) ||
        sha256(fs.readFileSync(artifact.absolutePath)) !== artifactHash
      ) {
        throw failure('subcontract_dependency_artifact_stale', {
          dependencyId,
          artifactPath: artifact.relativePath,
        });
      }
    }
  }
}

function closeSubcontract(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('subcontract_closure_request_invalid');
  }
  const forbiddenFields = [
    'childClosureHash',
    'receiptHash',
    'receiptPath',
    'decision',
  ].filter((field) => Object.hasOwn(request, field));
  if (forbiddenFields.length > 0) {
    throw failure('subcontract_closure_authority_injection', {
      forbiddenFields,
    });
  }
  const repositoryRoot = fs.realpathSync(
    requireText(request.repositoryRoot, 'repositoryRoot')
  );
  const authorityRoot = fs.realpathSync(
    request.authorityRoot === undefined
      ? repositoryRoot
      : requireText(request.authorityRoot, 'authorityRoot')
  );
  const receiptRoot = path.resolve(
    requireText(request.receiptRoot, 'receiptRoot')
  );
  const activationCandidate = request.activationReceipt;
  const leaseCandidate = request.leaseReceipt;
  const manifest = request.partitionManifest;
  if (
    !isRecord(activationCandidate) ||
    !isRecord(leaseCandidate) ||
    !isRecord(manifest)
  ) {
    throw failure('subcontract_closure_request_invalid');
  }
  const partitionId = requireText(request.partitionId, 'partitionId');
  const { partition, index } = findManifestPartition(
    manifest,
    partitionId
  );
  const activation = readMatchingCommittedReceipt({
    targetPath: path.resolve(
      receiptRoot,
      'campaigns',
      requireText(activationCandidate.campaignId, 'campaignId'),
      'activation.receipt.json'
    ),
    schemaName: ACTIVATION_SCHEMA,
    candidate: activationCandidate,
    failureClass: 'subcontract_activation_receipt_not_committed',
  });
  const repairAuthorityCandidate = request.repairAuthorityReceipt;
  const repairAuthority = verifyCommittedRepairAuthority({
    receiptRoot,
    activation,
    manifest,
    candidate: repairAuthorityCandidate,
  });
  const repairMode = requireRepairClosureMode({
    repairAuthority,
    repairAuthorityCandidate,
    leaseCandidate,
    partitionId,
  });
  const lease = readMatchingCommittedReceipt({
    targetPath: path.resolve(
      receiptRoot,
      'campaigns',
      activation.campaignId,
      ...(repairMode ? ['repair', 'leases'] : ['leases']),
      `${String(index + 1).padStart(4, '0')}-${partitionId}.receipt.json`
    ),
    schemaName: LEASE_SCHEMA,
    candidate: leaseCandidate,
    failureClass: 'subcontract_lease_not_committed',
  });
  if (
    repairMode &&
    (lease.baseAttemptId !== repairAuthority.baseAttemptId ||
      lease.repairAttemptId !== repairAuthority.repairAttemptId ||
      lease.repairAuthorityReceiptHash !== repairAuthority.receiptHash)
  ) {
    throw failure('campaign_repair_authority_required', {
      partitionId,
      reason: 'repair_lease_authority_mismatch',
    });
  }
  verifyRootBindings({
    activation,
    manifest,
    lease,
    partition,
    partitionId,
  });
  verifyCurrentChildContract({ authorityRoot, partition, lease });
  const evidence = verifySubcontractEvidence(
    request.subcontractEvidence
  ) as SchemaRecord;
  verifyEvidenceBindings({
    activation,
    lease,
    manifest,
    partition,
    evidence,
  });
  verifyEvidenceInternalHashes(evidence);
  verifyCurrentTaskEvidence(repositoryRoot, evidence);
  verifyCurrentGovernedFiles(repositoryRoot, evidence);
  verifyPredecessorClosures({
    repositoryRoot,
    receiptRoot,
    activation,
    lease,
    manifest,
    partition,
    evidence,
  });

  const lifecycleAuthorityFields =
    lifecycleAuthorityFieldsFromManifest(manifest);
  const nodeAttemptFields =
    lease.nodeAttemptId === undefined
      ? {}
      : {
          nodeAttemptId: requireText(
            lease.nodeAttemptId,
            'nodeAttemptId'
          ),
        };
  const childClosureHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-child-closure/v1',
    campaignId: activation.campaignId,
    attemptId: lease.attemptId,
    partitionId,
    partitionManifestHash: manifest.partitionManifestHash,
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: activation.sourceAuthorityBundleHash,
    childContractHash: partition.childContractHash,
    ...lifecycleAuthorityFields,
    ...nodeAttemptFields,
    executionLeaseHash: lease.receiptHash,
    closureScopeMode: evidence.closureScopeMode,
    orderedVerificationEvidenceHashes:
      evidence.orderedVerificationEvidenceHashes,
    governedFileManifestHash: evidence.governedFileManifestHash,
    dependencyClosureHash: evidence.dependencyClosureHash,
    productionReachabilityReceiptHash:
      evidence.productionReachabilityReceiptHash,
    integrationVerificationReceiptHash:
      evidence.integrationVerificationReceiptHash,
  });
  const payload = {
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    leaseReceiptHash: lease.receiptHash,
    attemptId: lease.attemptId,
    partitionId,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: activation.sourceAuthorityBundleHash,
    childContractHash: partition.childContractHash,
    ...lifecycleAuthorityFields,
    ...nodeAttemptFields,
    closureScopeMode: evidence.closureScopeMode,
    subordinateCoverageReceiptHashes:
      evidence.subordinateCoverageReceiptHashes,
    orderedVerificationEvidenceHashes:
      evidence.orderedVerificationEvidenceHashes,
    governedFileManifestHash: evidence.governedFileManifestHash,
    dependencyClosureHash: evidence.dependencyClosureHash,
    productionReachabilityReceiptHash:
      evidence.productionReachabilityReceiptHash,
    integrationVerificationReceiptHash:
      evidence.integrationVerificationReceiptHash,
    subcontractEvidenceHash: evidence.evidenceHash,
    childClosureHash,
    predecessorClosureReceiptHashes:
      lease.predecessorClosureReceiptHashes,
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    closedAt: requireText(request.closedAt, 'closedAt'),
    decision: 'pass',
  };
  const receipt = {
    ...payload,
    receiptHash: hashReceiptPayload(payload),
  };
  let committed;
  try {
    committed = commitCreateOnceReceipt({
      receiptRoot,
      relativePath:
        `campaigns/${activation.campaignId}/` +
        (repairMode ? 'repair/closures/' : 'closures/') +
        `${String(index + 1).padStart(4, '0')}-${partitionId}.receipt.json`,
      schemaName: CLOSURE_SCHEMA,
      receipt,
      recovery: request.recovery === true,
    });
  } catch (error) {
    if (
      (error as { failureClass?: string }).failureClass ===
      'control_plane_duplicate_receipt'
    ) {
      throw failure('subcontract_closure_duplicate');
    }
    throw error;
  }
  return Object.freeze({
    receiptPath: committed.path,
    receipt: committed.receipt,
    recovered: committed.recovered,
  });
}

function subordinateSetRemoved(
  baseline: SchemaRecord,
  current: SchemaRecord
): boolean {
  for (const field of [
    'requiredSubordinateBindings',
    'subordinateSourceSnapshotHashes',
    'subordinateSourceHashes',
    'subordinateCoverageReceiptHashes',
  ]) {
    const baselineSet = baseline[field];
    if (
      Array.isArray(baselineSet) &&
      baselineSet.length > 0 &&
      (!Array.isArray(current[field]) || current[field].length === 0)
    ) {
      return true;
    }
  }
  return false;
}

function validateDependencyGraph(
  manifest: SchemaRecord
): Map<string, string[]> {
  if (
    !Array.isArray(manifest.partitions) ||
    !Array.isArray(manifest.topologicalOrder)
  ) {
    throw failure('subcontract_dependency_incomplete');
  }
  const ordered = manifest.topologicalOrder;
  const dependents = new Map(
    ordered.map((partitionId) => [partitionId, [] as string[]])
  );
  if (
    new Set(ordered).size !== ordered.length ||
    manifest.partitions.length !== ordered.length
  ) {
    throw failure('subcontract_dependency_incomplete');
  }
  for (const partition of manifest.partitions) {
    if (
      !isRecord(partition) ||
      !dependents.has(partition.partitionId) ||
      !Array.isArray(partition.dependencyPartitionIds)
    ) {
      throw failure('subcontract_dependency_incomplete');
    }
    const partitionIndex = ordered.indexOf(partition.partitionId);
    for (const dependencyId of partition.dependencyPartitionIds) {
      const dependencyIndex = ordered.indexOf(dependencyId);
      if (dependencyIndex < 0 || dependencyIndex >= partitionIndex) {
        throw failure('subcontract_dependency_incomplete', {
          partitionId: partition.partitionId,
          dependencyId,
        });
      }
      dependents.get(dependencyId).push(partition.partitionId);
    }
  }
  return dependents;
}

function evaluateSubcontractInvalidation(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('subcontract_invalidation_request_invalid');
  }
  const manifest = request.partitionManifest;
  const baseline = request.baselineAuthority;
  const current = request.currentAuthority;
  if (!isRecord(manifest) || !isRecord(baseline) || !isRecord(current)) {
    throw failure('subcontract_invalidation_request_invalid');
  }
  const dependents = validateDependencyGraph(manifest);
  const ordered = manifest.topologicalOrder as string[];
  if (
    baseline.sourceCompositionMode === 'composite_required' &&
    (current.sourceCompositionMode === 'single_source' ||
      subordinateSetRemoved(baseline, current))
  ) {
    throw failure('source_composition_downgrade_rejected');
  }
  const changedAuthorityFields = AUTHORITY_INVALIDATION_FIELDS.filter(
    (field) => !equalCanonical(baseline[field], current[field])
  );
  if (changedAuthorityFields.length > 0) {
    return Object.freeze({
      campaignWide: true,
      invalidatedPartitionIds: [...ordered],
      preservedPartitionIds: [],
      changedAuthorityFields,
      decision: 'campaign_wide_invalidation',
    });
  }
  if (
    !Array.isArray(request.changedPaths) ||
    request.changedPaths.some(
      (entry) => typeof entry !== 'string' || entry.length === 0
    )
  ) {
    throw failure('subcontract_invalidation_request_invalid', {
      field: 'changedPaths',
    });
  }
  const changedPaths = [
    ...new Set(request.changedPaths.map((entry) => normalizePathText(entry))),
  ].sort();
  const ownerIds = new Set<string>();
  for (const changedPath of changedPaths) {
    const owners = manifest.partitions.filter((partition) => {
      const governedPaths = [
        ...(partition.governedPaths || partition.ownedArtifactPaths || []),
        ...(partition.childContractPath
          ? [partition.childContractPath]
          : []),
      ].map((entry) => normalizePathText(entry));
      return governedPaths.includes(changedPath);
    });
    if (owners.length !== 1) {
      throw failure('subcontract_dependency_incomplete', {
        changedPath,
        ownerPartitionIds: owners.map(({ partitionId }) => partitionId),
      });
    }
    ownerIds.add(owners[0].partitionId);
  }
  const invalidated = new Set(ownerIds);
  const frontier = [...ownerIds];
  while (frontier.length > 0) {
    const ownerId = frontier.shift();
    for (const dependentId of dependents.get(ownerId) || []) {
      if (!invalidated.has(dependentId)) {
        invalidated.add(dependentId);
        frontier.push(dependentId);
      }
    }
  }
  const invalidatedPartitionIds = ordered.filter((partitionId) =>
    invalidated.has(partitionId)
  );
  return Object.freeze({
    campaignWide: false,
    invalidatedPartitionIds,
    preservedPartitionIds: ordered.filter(
      (partitionId) => !invalidated.has(partitionId)
    ),
    changedAuthorityFields: [],
    decision:
      invalidatedPartitionIds.length === 0
        ? 'preserved'
        : 'selective_invalidation',
  });
}

module.exports = {
  closeSubcontract,
  evaluateSubcontractInvalidation,
};
