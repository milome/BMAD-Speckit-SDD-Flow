const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
  verifyReceiptSelfHash,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
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
} = require(
  __filename.endsWith('.ts')
    ? './lifecycle-authority-binding.ts'
    : './lifecycle-authority-binding'
);

const EVIDENCE_SCHEMA =
  'goal-contract-subcontract-evidence.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const FORBIDDEN_AUTHORITY_FIELDS = new Set([
  'modelResponseText',
  'score',
  'verdict',
  'readonlyObservation',
  'dashboardState',
  'copiedPass',
  'closeoutApproved',
  'historicalReceipt',
  'releaseDecision',
  'activationDecision',
  'leaseDecision',
  'childClosureDecision',
  'campaignClosureDecision',
]);
const REQUIRED_EVIDENCE_CATEGORIES = Object.freeze([
  'targeted_positive',
  'targeted_negative',
  'tamper',
  'stale',
  'replay',
  'crash_recovery',
  'lint',
  'typecheck',
  'dependency_closure',
  'production_reachability',
  'forbidden_seam_scan',
]);
const GOVERNED_CLASSIFICATIONS = new Set([
  'created',
  'modified',
  'renamed',
  'deleted',
  'generated',
  'tested',
  'packaged',
  'consumed',
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

function requireHash(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw failure('subcontract_evidence_invalid', { field });
  }
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('subcontract_evidence_invalid', { field });
  }
  return value;
}

function uniqueStrings(value: unknown, field: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== 'string' || item.length === 0) ||
    new Set(value).size !== value.length
  ) {
    throw failure('subcontract_evidence_invalid', { field });
  }
  return [...value].sort();
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function normalizeRepositoryPath(
  repositoryRoot: string,
  relativePath: unknown
): { relativePath: string; absolutePath: string } {
  const value = requireText(relativePath, 'path').replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(value) ||
    /^[A-Za-z]:\//u.test(value) ||
    value.split('/').includes('..')
  ) {
    throw failure('subcontract_governed_path_escape', {
      path: relativePath,
    });
  }
  const normalized = path.posix.normalize(value);
  const root = fs.realpathSync(repositoryRoot);
  const absolutePath = path.resolve(root, ...normalized.split('/'));
  if (
    absolutePath !== root &&
    !absolutePath.startsWith(`${root}${path.sep}`)
  ) {
    throw failure('subcontract_governed_path_escape', {
      path: relativePath,
    });
  }
  if (fs.existsSync(absolutePath)) {
    const real = fs.realpathSync(absolutePath);
    if (real !== root && !real.startsWith(`${root}${path.sep}`)) {
      throw failure('subcontract_governed_path_symlink_escape', {
        path: relativePath,
      });
    }
  }
  return { relativePath: normalized, absolutePath };
}

function verifyTaskEvidence({
  repositoryRoot,
  allowedPaths,
  closureScopeMode,
  record,
}: {
  repositoryRoot: string;
  allowedPaths: Set<string>;
  closureScopeMode: string;
  record: unknown;
}) {
  if (!isRecord(record)) {
    throw failure('subcontract_task_evidence_invalid');
  }
  if (Object.hasOwn(record, 'taskEvidenceHash')) {
    throw failure('subcontract_evidence_authority_injection', {
      field: 'taskEvidenceHash',
    });
  }
  if (record.exitCode !== 0) {
    throw failure('subcontract_command_evidence_failed', {
      taskId: record.taskId,
      exitCode: record.exitCode,
    });
  }
  const governedPaths = uniqueStrings(
    record.governedPaths,
    'governedPaths'
  ).map((entry) => normalizeRepositoryPath(repositoryRoot, entry).relativePath);
  if (governedPaths.some((entry) => !allowedPaths.has(entry))) {
    throw failure('subcontract_governed_path_unauthorized', {
      taskId: record.taskId,
    });
  }
  const log = normalizeRepositoryPath(repositoryRoot, record.logPath);
  if (
    !fs.existsSync(log.absolutePath) ||
    sha256(fs.readFileSync(log.absolutePath)) !== record.logHash
  ) {
    throw failure('subcontract_evidence_log_stale', {
      taskId: record.taskId,
      logPath: log.relativePath,
    });
  }
  const sourceHashBefore = requireHash(
    record.sourceHashBefore,
    'sourceHashBefore'
  );
  const sourceHashAfter = requireHash(
    record.sourceHashAfter,
    'sourceHashAfter'
  );
  if (
    closureScopeMode === 'integration_only' &&
    governedPaths.length > 0
  ) {
    throw failure('subcontract_integration_scope_nonempty');
  }
  if (
    closureScopeMode === 'integration_only' &&
    sourceHashBefore !== sourceHashAfter
  ) {
    throw failure('subcontract_integration_source_mutation', {
      taskId: record.taskId,
    });
  }
  const payload = {
    taskId: requireText(record.taskId, 'taskId'),
    obligationRefs: uniqueStrings(record.obligationRefs, 'obligationRefs'),
    specSpanRefs: uniqueStrings(record.specSpanRefs, 'specSpanRefs'),
    governedPaths,
    sourceHashBefore,
    sourceHashAfter,
    exactCommand: requireText(record.exactCommand, 'exactCommand'),
    workingDirectory: requireText(
      record.workingDirectory,
      'workingDirectory'
    ),
    startedAt: requireText(record.startedAt, 'startedAt'),
    endedAt: requireText(record.endedAt, 'endedAt'),
    exitCode: 0,
    logPath: log.relativePath,
    logHash: requireHash(record.logHash, 'logHash'),
  };
  return Object.freeze({
    ...payload,
    taskEvidenceHash: hashControlPlaneValue(payload),
  });
}

function compileGovernedFileManifest({
  repositoryRoot,
  allowedPaths,
  closureScopeMode,
  records,
}: {
  repositoryRoot: string;
  allowedPaths: string[];
  closureScopeMode: string;
  records: unknown;
}) {
  if (!Array.isArray(records)) {
    throw failure('subcontract_governed_path_omitted');
  }
  if (closureScopeMode === 'integration_only' && records.length > 0) {
    throw failure('subcontract_integration_scope_nonempty');
  }
  const byPath = new Map<string, Record<string, unknown>>();
  for (const record of records) {
    if (!isRecord(record)) {
      throw failure('subcontract_governed_file_invalid');
    }
    const normalized = normalizeRepositoryPath(repositoryRoot, record.path);
    if (!allowedPaths.includes(normalized.relativePath)) {
      throw failure('subcontract_governed_path_unauthorized', {
        path: normalized.relativePath,
      });
    }
    if (byPath.has(normalized.relativePath)) {
      throw failure('subcontract_governed_path_duplicate', {
        path: normalized.relativePath,
      });
    }
    const classifications = uniqueStrings(
      record.classifications,
      'classifications'
    );
    if (
      classifications.length === 0 ||
      classifications.some(
        (classification) => !GOVERNED_CLASSIFICATIONS.has(classification)
      )
    ) {
      throw failure('subcontract_governed_file_invalid', {
        path: normalized.relativePath,
      });
    }
    const existsAfter = record.existsAfter === true;
    if (existsAfter !== fs.existsSync(normalized.absolutePath)) {
      throw failure('subcontract_evidence_stale', {
        path: normalized.relativePath,
      });
    }
    const sourceHashAfter = requireHash(
      record.sourceHashAfter,
      'sourceHashAfter'
    );
    if (
      existsAfter &&
      sha256(fs.readFileSync(normalized.absolutePath)) !== sourceHashAfter
    ) {
      throw failure('subcontract_evidence_stale', {
        path: normalized.relativePath,
      });
    }
    byPath.set(normalized.relativePath, {
      path: normalized.relativePath,
      classifications,
      sourceHashBefore: requireHash(
        record.sourceHashBefore,
        'sourceHashBefore'
      ),
      sourceHashAfter,
      existsAfter,
    });
  }
  const missing = allowedPaths.filter((entry) => !byPath.has(entry));
  if (missing.length > 0) {
    throw failure('subcontract_governed_path_omitted', {
      missingPaths: missing,
    });
  }
  return [...byPath.values()].sort((left, right) =>
    String(left.path).localeCompare(String(right.path), 'en')
  );
}

function compileDependencyClosure(
  partition: SchemaRecord,
  records: unknown
) {
  if (!Array.isArray(records)) {
    throw failure('subcontract_dependency_incomplete');
  }
  const dependencies = partition.dependencyPartitionIds || [];
  const byPartition = new Map(
    records
      .filter(isRecord)
      .map((record) => [record.partitionId, record])
  );
  if (records.length !== dependencies.length) {
    throw failure('subcontract_dependency_incomplete');
  }
  return dependencies.map((dependencyId) => {
    const record = byPartition.get(dependencyId);
    if (!record) throw failure('subcontract_dependency_incomplete');
    const artifactHashes = record.artifactHashes;
    if (!isRecord(artifactHashes)) {
      throw failure('subcontract_dependency_incomplete');
    }
    for (const value of Object.values(artifactHashes)) {
      requireHash(value, 'artifactHash');
    }
    return {
      partitionId: dependencyId,
      closureReceiptHash: requireHash(
        record.closureReceiptHash,
        'closureReceiptHash'
      ),
      artifactHashes: Object.fromEntries(
        Object.entries(artifactHashes).sort(([left], [right]) =>
          left.localeCompare(right, 'en')
        )
      ),
      compatibilityReceiptHashes: uniqueStrings(
        record.compatibilityReceiptHashes,
        'compatibilityReceiptHashes'
      ),
    };
  });
}

function compileReachability(records: unknown, closureScopeMode: string) {
  if (closureScopeMode === 'integration_only') {
    if (!Array.isArray(records) || records.length > 0) {
      throw failure('subcontract_integration_scope_nonempty');
    }
    return [];
  }
  if (!Array.isArray(records) || records.length === 0) {
    throw failure('subcontract_production_reachability_invalid');
  }
  return records.map((record) => {
    if (
      !isRecord(record) ||
      record.entryKind !== 'production' ||
      record.decision !== 'pass'
    ) {
      throw failure('subcontract_production_reachability_invalid');
    }
    const changedImplementationSymbols = uniqueStrings(
      record.changedImplementationSymbols,
      'changedImplementationSymbols'
    );
    const reachableSymbols = uniqueStrings(
      record.reachableSymbols,
      'reachableSymbols'
    );
    if (
      changedImplementationSymbols.length === 0 ||
      changedImplementationSymbols.some(
        (symbol) => !reachableSymbols.includes(symbol)
      )
    ) {
      throw failure('subcontract_production_reachability_invalid');
    }
    return {
      publicEntry: requireText(record.publicEntry, 'publicEntry'),
      entryKind: 'production',
      changedImplementationSymbols,
      reachableSymbols,
      traversedPaths: uniqueStrings(
        record.traversedPaths,
        'traversedPaths'
      ),
      decision: 'pass',
    };
  });
}

function compileIntegrationVerification({
  partition,
  taskEvidenceRecords,
  closureScopeMode,
  records,
}: {
  partition: SchemaRecord;
  taskEvidenceRecords: SchemaRecord[];
  closureScopeMode: string;
  records: unknown;
}) {
  if (closureScopeMode === 'governed_files') {
    if (records !== undefined && (!Array.isArray(records) || records.length > 0)) {
      throw failure('subcontract_integration_scope_nonempty');
    }
    return [];
  }
  if (!Array.isArray(records) || records.length !== 1 || !isRecord(records[0])) {
    throw failure('subcontract_integration_verification_incomplete');
  }
  const expectedDependencies = uniqueStrings(
    partition.dependencyPartitionIds,
    'dependencyPartitionIds'
  );
  const expectedTaskEvidenceRefs = taskEvidenceRecords
    .map(({ taskId }) => taskId)
    .sort();
  const record = records[0];
  const coveredDependencyPartitionIds = uniqueStrings(
    record.coveredDependencyPartitionIds,
    'coveredDependencyPartitionIds'
  );
  const taskEvidenceRefs = uniqueStrings(
    record.taskEvidenceRefs,
    'taskEvidenceRefs'
  );
  if (
    record.verificationTarget !== 'partition_dependencies' ||
    record.decision !== 'pass' ||
    JSON.stringify(coveredDependencyPartitionIds) !==
      JSON.stringify(expectedDependencies) ||
    JSON.stringify(taskEvidenceRefs) !==
      JSON.stringify(expectedTaskEvidenceRefs)
  ) {
    throw failure('subcontract_integration_verification_incomplete');
  }
  const payload = {
    verificationTarget: 'partition_dependencies',
    coveredDependencyPartitionIds,
    taskEvidenceRefs,
    decision: 'pass',
  };
  return [
    Object.freeze({
      ...payload,
      integrationVerificationHash: hashControlPlaneValue(payload),
    }),
  ];
}

function compileCategories(records: unknown, closureScopeMode: string) {
  if (!Array.isArray(records)) {
    throw failure('subcontract_evidence_category_missing');
  }
  const byCategory = new Map(
    records
      .filter(isRecord)
      .map((record) => [record.category, record])
  );
  if (
    byCategory.size !== records.length ||
    REQUIRED_EVIDENCE_CATEGORIES.some(
      (category) => !byCategory.has(category)
    ) ||
    records.some(
      (record) => !REQUIRED_EVIDENCE_CATEGORIES.includes(record.category)
    )
  ) {
    throw failure('subcontract_evidence_category_missing');
  }
  return REQUIRED_EVIDENCE_CATEGORIES.map((category) => {
    const record = byCategory.get(category);
    const applicability = record.applicability;
    const decision = record.decision;
    if (
      !(
        (applicability === 'applicable' && decision === 'pass') ||
        (applicability === 'not_applicable_with_proof' &&
          decision === 'not_applicable')
      )
    ) {
      throw failure('subcontract_evidence_category_failed', {
        category,
      });
    }
    if (
      category === 'production_reachability' &&
      ((closureScopeMode === 'integration_only' &&
        (applicability !== 'not_applicable_with_proof' ||
          decision !== 'not_applicable')) ||
        (closureScopeMode === 'governed_files' &&
          (applicability !== 'applicable' || decision !== 'pass')))
    ) {
      throw failure('subcontract_evidence_category_failed', {
        category,
      });
    }
    return {
      category,
      applicability,
      decision,
      evidenceHash: requireHash(record.evidenceHash, 'evidenceHash'),
    };
  });
}

function compileSubcontractEvidence(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('subcontract_evidence_invalid');
  }
  const forbiddenFields = Object.keys(request).filter((field) =>
    FORBIDDEN_AUTHORITY_FIELDS.has(field)
  );
  if (forbiddenFields.length > 0) {
    throw failure('subcontract_model_authority_rejected', {
      forbiddenFields,
    });
  }
  const repositoryRoot = fs.realpathSync(
    requireText(request.repositoryRoot, 'repositoryRoot')
  );
  const activation = request.activationReceipt;
  const lease = request.leaseReceipt;
  const manifest = request.partitionManifest;
  if (!isRecord(activation) || !isRecord(lease) || !isRecord(manifest)) {
    throw failure('subcontract_evidence_invalid');
  }
  const partitionId = requireText(request.partitionId, 'partitionId');
  const partition = manifest.partitions?.find(
    (candidate) => candidate.partitionId === partitionId
  );
  if (!partition) {
    throw failure('subcontract_manifest_membership_missing');
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
    attemptId: lease.attemptId,
    partitionId,
    childContractHash: partition.childContractHash,
    nodeAttemptId: lease.nodeAttemptId,
  });
  const closureScopeMode = deriveClosureScopeMode(partition);
  for (const [actual, expected, field] of [
    [lease.partitionId, partitionId, 'partitionId'],
    [
      request.sourceCompositionPolicyHash,
      activation.sourceCompositionPolicyHash,
      'sourceCompositionPolicyHash',
    ],
    [
      request.sourceAuthorityBundleHash,
      activation.sourceAuthorityBundleHash,
      'sourceAuthorityBundleHash',
    ],
    [
      lease.partitionManifestHash,
      activation.partitionManifestHash,
      'partitionManifestHash',
    ],
    [
      manifest.partitionManifestHash,
      activation.partitionManifestHash,
      'partitionManifestHash',
    ],
    [
      partition.childContractHash,
      lease.childContractHash,
      'childContractHash',
    ],
  ]) {
    if (actual !== expected) {
      throw failure('subcontract_evidence_stale', { field });
    }
  }
  const expectedSubordinate =
    partition.subordinateCoverageReceiptHashes || [];
  const subordinateCoverageReceiptHashes = uniqueStrings(
    request.subordinateCoverageReceiptHashes,
    'subordinateCoverageReceiptHashes'
  );
  if (
    JSON.stringify([...expectedSubordinate].sort()) !==
    JSON.stringify(subordinateCoverageReceiptHashes)
  ) {
    throw failure('subcontract_evidence_stale', {
      field: 'subordinateCoverageReceiptHashes',
    });
  }
  const governedPaths = uniqueStrings(
    partition.governedPaths || partition.ownedArtifactPaths,
    'partition.governedPaths'
  ).map((entry) => normalizeRepositoryPath(repositoryRoot, entry).relativePath);
  const allowedPaths = new Set(governedPaths);
  if (
    !Array.isArray(request.taskEvidenceRecords) ||
    request.taskEvidenceRecords.length === 0
  ) {
    throw failure('subcontract_task_evidence_invalid');
  }
  const taskEvidenceRecords = request.taskEvidenceRecords
    .map((record) =>
      verifyTaskEvidence({
        repositoryRoot,
        allowedPaths,
        closureScopeMode,
        record,
      })
    )
    .sort((left, right) => left.taskId.localeCompare(right.taskId, 'en'));
  const governedFileManifest = compileGovernedFileManifest({
    repositoryRoot,
    allowedPaths: governedPaths,
    closureScopeMode,
    records: request.governedFileRecords,
  });
  const dependencyClosureRecords = compileDependencyClosure(
    partition,
    request.dependencyClosureRecords
  );
  const productionReachabilityRecords = compileReachability(
    request.productionReachabilityRecords,
    closureScopeMode
  );
  const integrationVerificationRecords = compileIntegrationVerification({
    partition,
    taskEvidenceRecords,
    closureScopeMode,
    records: request.integrationVerificationRecords,
  });
  const evidenceCategoryRecords = compileCategories(
    request.evidenceCategoryRecords,
    closureScopeMode
  );
  for (const field of [
    'subcontractModelAuditCount',
    'reviewerInvocationCount',
    'auditorInvocationCount',
    'judgeSemanticAttemptCount',
  ]) {
    if (request[field] !== 0) {
      throw failure('subcontract_model_counter_nonzero', { field });
    }
  }
  const governedFileManifestHash = hashControlPlaneValue(
    governedFileManifest
  );
  const dependencyClosureHash = hashControlPlaneValue(
    dependencyClosureRecords
  );
  const productionReachabilityReceiptHash = hashControlPlaneValue(
    productionReachabilityRecords
  );
  const integrationVerificationReceiptHash = hashControlPlaneValue(
    integrationVerificationRecords
  );
  const orderedVerificationEvidenceHashes = [
    ...taskEvidenceRecords.map(({ taskEvidenceHash }) => taskEvidenceHash),
    ...integrationVerificationRecords.map(
      ({ integrationVerificationHash }) => integrationVerificationHash
    ),
    ...evidenceCategoryRecords.map(({ evidenceHash }) => evidenceHash),
  ];
  const payload = {
    schemaVersion: 'goal-contract-subcontract-evidence/v1',
    campaignId: requireText(activation.campaignId, 'campaignId'),
    campaignActivationHash: requireHash(
      activation.campaignActivationHash,
      'campaignActivationHash'
    ),
    activationReceiptHash: requireHash(
      activation.receiptHash,
      'activationReceiptHash'
    ),
    leaseReceiptHash: requireHash(lease.receiptHash, 'leaseReceiptHash'),
    attemptId: requireText(lease.attemptId, 'attemptId'),
    partitionId,
    partitionManifestHash: requireHash(
      manifest.partitionManifestHash,
      'partitionManifestHash'
    ),
    partitionPlanHash: requireHash(
      lease.partitionPlanHash,
      'partitionPlanHash'
    ),
    childContractHash: requireHash(
      lease.childContractHash,
      'childContractHash'
    ),
    ...lifecycleAuthorityFieldsFromManifest(manifest),
    ...(lease.nodeAttemptId === undefined
      ? {}
      : {
          nodeAttemptId: requireText(
            lease.nodeAttemptId,
            'nodeAttemptId'
          ),
        }),
    sourceCompositionPolicyHash: requireHash(
      request.sourceCompositionPolicyHash,
      'sourceCompositionPolicyHash'
    ),
    sourceAuthorityBundleHash: requireHash(
      request.sourceAuthorityBundleHash,
      'sourceAuthorityBundleHash'
    ),
    subordinateCoverageReceiptHashes,
    closureScopeMode,
    taskEvidenceRecords,
    governedFileManifest,
    governedFileManifestHash,
    dependencyClosureRecords,
    dependencyClosureHash,
    productionReachabilityRecords,
    productionReachabilityReceiptHash,
    integrationVerificationRecords,
    integrationVerificationReceiptHash,
    evidenceCategoryRecords,
    orderedVerificationEvidenceHashes,
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    compiledAt: requireText(request.compiledAt, 'compiledAt'),
    decision: 'pass',
  };
  const evidence = {
    ...payload,
    evidenceHash: hashReceiptPayload(payload, 'evidenceHash'),
  };
  validateGoalContractSchema(EVIDENCE_SCHEMA, evidence);
  return Object.freeze(evidence);
}

function verifySubcontractEvidence(evidence: unknown) {
  validateGoalContractSchema(EVIDENCE_SCHEMA, evidence);
  if (!verifyReceiptSelfHash(evidence, 'evidenceHash')) {
    throw failure('subcontract_evidence_hash_invalid');
  }
  return evidence;
}

module.exports = {
  REQUIRED_EVIDENCE_CATEGORIES,
  compileSubcontractEvidence,
  verifySubcontractEvidence,
};
