const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
  stableControlPlaneStringify,
  verifyReceiptSelfHash,
} = require(
  __filename.endsWith('.ts') ? './canonical-hash.ts' : './canonical-hash'
);
const {
  verifyActivationReceipt,
} = require(
  __filename.endsWith('.ts')
    ? './campaign-activation.ts'
    : './campaign-activation'
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
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts')
    ? './schema-registry.ts'
    : './schema-registry'
);
const {
  evaluateSubcontractInvalidation,
} = require(
  __filename.endsWith('.ts')
    ? './subcontract-closure.ts'
    : './subcontract-closure'
);

const REPAIR_AUTHORITY_SCHEMA =
  'goal-contract-campaign-repair-authority-receipt.schema.json';
const CLOSURE_SCHEMA =
  'goal-contract-subcontract-closure-receipt.schema.json';
const LEASE_SCHEMA =
  'goal-contract-subcontract-execution-lease.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

// Schema validation establishes the shape before dynamic records are consumed.
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
    throw failure('campaign_repair_authority_request_invalid', { field });
  }
  return value;
}

function requireHash(value: unknown, field: string): string {
  const hash = requireText(value, field);
  if (!HASH_PATTERN.test(hash)) {
    throw failure('campaign_repair_authority_request_invalid', { field });
  }
  return hash;
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function equalCanonical(left: unknown, right: unknown): boolean {
  return (
    stableControlPlaneStringify(left) ===
    stableControlPlaneStringify(right)
  );
}

function canonicalClone(value: unknown, field: string): SchemaRecord {
  if (!isRecord(value)) {
    throw failure('campaign_repair_authority_request_invalid', { field });
  }
  try {
    return JSON.parse(stableControlPlaneStringify(value));
  } catch (error) {
    throw failure('campaign_repair_authority_request_invalid', {
      field,
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
}

function normalizeRelativePath(
  value: unknown,
  failureClass: string,
  field = 'path'
): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure(failureClass, { field });
  }
  const slashPath = value.replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(slashPath) ||
    /^[A-Za-z]:\//u.test(slashPath) ||
    slashPath.split('/').includes('..')
  ) {
    throw failure(failureClass, { field, path: value });
  }
  const normalized = path.posix.normalize(slashPath);
  if (normalized === '.' || normalized.startsWith('../')) {
    throw failure(failureClass, { field, path: value });
  }
  return normalized;
}

function verifyBase(
  activationCandidate: unknown,
  manifestCandidate: unknown
): { activation: SchemaRecord; manifest: SchemaRecord } {
  let activation;
  try {
    activation = verifyActivationReceipt(activationCandidate);
  } catch (error) {
    throw failure('campaign_repair_authority_base_stale', {
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  if (
    !isRecord(manifestCandidate) ||
    !Array.isArray(manifestCandidate.topologicalOrder) ||
    !Array.isArray(manifestCandidate.partitions)
  ) {
    throw failure('campaign_repair_authority_base_stale', {
      reason: 'partition_manifest_invalid',
    });
  }
  const manifest = manifestCandidate;
  for (const field of [
    'partitionManifestHash',
    'partitionPlanHash',
    'partitionSetHash',
    'sourceCompositionPolicyHash',
    'sourceAuthorityBundleHash',
  ]) {
    if (activation[field] !== manifest[field]) {
      throw failure('campaign_repair_authority_base_stale', { field });
    }
  }
  if (activation.decision !== 'pass') {
    throw failure('campaign_repair_authority_base_stale', {
      field: 'decision',
    });
  }
  return { activation, manifest };
}

function partitionIndex(manifest: SchemaRecord): {
  byId: Map<string, SchemaRecord>;
  order: Map<string, number>;
} {
  const byId = new Map<string, SchemaRecord>();
  const order = new Map<string, number>();
  manifest.topologicalOrder.forEach(
    (partitionId: unknown, index: number) => {
    if (
      typeof partitionId !== 'string' ||
      partitionId.length === 0 ||
      order.has(partitionId)
    ) {
      throw failure('campaign_repair_authority_base_stale', {
        reason: 'partition_order_invalid',
      });
    }
      order.set(partitionId, index);
    }
  );
  for (const partition of manifest.partitions) {
    if (
      !isRecord(partition) ||
      !order.has(partition.partitionId) ||
      byId.has(partition.partitionId)
    ) {
      throw failure('campaign_repair_authority_base_stale', {
        reason: 'partition_membership_invalid',
      });
    }
    requireHash(partition.childContractHash, 'childContractHash');
    byId.set(partition.partitionId, partition);
  }
  if (byId.size !== order.size) {
    throw failure('campaign_repair_authority_base_stale', {
      reason: 'partition_membership_incomplete',
    });
  }
  return { byId, order };
}

function normalizeChangedPaths(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw failure('campaign_repair_authority_request_invalid', {
      field: 'changedPaths',
    });
  }
  return [
    ...new Set(
      value.map((entry) =>
        normalizeRelativePath(
          entry,
          'campaign_repair_authority_request_invalid',
          'changedPaths'
        )
      )
    ),
  ].sort();
}

function verifyBoundReceipts({
  receipts,
  bindingKind,
  schemaName,
  allowedPartitionIds,
  activation,
  manifest,
  byId,
  order,
}: {
  receipts: unknown;
  bindingKind:
    | 'preserved_closure'
    | 'invalidated_closure'
    | 'invalidated_lease';
  schemaName: string;
  allowedPartitionIds: Set<string>;
  activation: SchemaRecord;
  manifest: SchemaRecord;
  byId: Map<string, SchemaRecord>;
  order: Map<string, number>;
}): SchemaRecord[] {
  if (!Array.isArray(receipts)) {
    throw failure('campaign_repair_authority_request_invalid', {
      field: bindingKind,
    });
  }
  const seen = new Set<string>();
  const bindings = receipts.map((candidate) => {
    if (!isRecord(candidate)) {
      throw failure('campaign_repair_authority_binding_invalid', {
        bindingKind,
      });
    }
    try {
      validateGoalContractSchema(schemaName, candidate);
    } catch (error) {
      throw failure('campaign_repair_authority_binding_invalid', {
        bindingKind,
        reason: (error as { failureClass?: string }).failureClass,
      });
    }
    if (!verifyReceiptSelfHash(candidate) || candidate.decision !== 'pass') {
      throw failure('campaign_repair_authority_binding_invalid', {
        bindingKind,
        partitionId: candidate.partitionId,
      });
    }
    const partition = byId.get(candidate.partitionId);
    if (
      !partition ||
      !allowedPartitionIds.has(candidate.partitionId) ||
      seen.has(candidate.partitionId)
    ) {
      throw failure('campaign_repair_authority_binding_invalid', {
        bindingKind,
        partitionId: candidate.partitionId,
      });
    }
    const expectedBindings = {
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
      childContractHash: partition.childContractHash,
    };
    for (const [field, expected] of Object.entries(expectedBindings)) {
      if (candidate[field] !== expected) {
        throw failure('campaign_repair_authority_binding_invalid', {
          bindingKind,
          partitionId: candidate.partitionId,
          field,
        });
      }
    }
    if (
      bindingKind === 'invalidated_lease' &&
      (candidate.selectionHash !== partition.selectionSetHash ||
        candidate.leaseOrdinal !==
          (order.get(candidate.partitionId) as number) + 1)
    ) {
      throw failure('campaign_repair_authority_binding_invalid', {
        bindingKind,
        partitionId: candidate.partitionId,
        field: 'selectionHash',
      });
    }
    seen.add(candidate.partitionId);
    const ordinal = (order.get(candidate.partitionId) as number) + 1;
    if (bindingKind === 'invalidated_lease') {
      return {
        ordinal,
        partitionId: candidate.partitionId,
        leaseReceiptHash: candidate.receiptHash,
      };
    }
    if (bindingKind === 'invalidated_closure') {
      return {
        ordinal,
        partitionId: candidate.partitionId,
        closureReceiptHash: candidate.receiptHash,
        subcontractEvidenceHash: candidate.subcontractEvidenceHash,
      };
    }
    return {
      ordinal,
      partitionId: candidate.partitionId,
      closureReceiptHash: candidate.receiptHash,
    };
  });
  const orderedBindings = bindings.sort(
    (left, right) =>
      (order.get(left.partitionId) as number) -
      (order.get(right.partitionId) as number)
  );
  if (
    bindingKind === 'preserved_closure' &&
    seen.size !== allowedPartitionIds.size
  ) {
    throw failure('campaign_repair_authority_binding_invalid', {
      bindingKind,
      reason: 'preserved_partition_closure_incomplete',
    });
  }
  return orderedBindings;
}

function currentOwnedPaths(manifest: SchemaRecord): Set<string> {
  const owned = new Set<string>();
  for (const partition of manifest.partitions) {
    const paths = [
      ...(partition.governedPaths || partition.ownedArtifactPaths || []),
      ...(partition.childContractPath
        ? [partition.childContractPath]
        : []),
    ];
    for (const candidate of paths) {
      owned.add(
        normalizeRelativePath(
          candidate,
          'campaign_repair_authority_base_stale',
          'partitionOwnedPath'
        )
      );
    }
  }
  return owned;
}

function normalizeTextSet(
  value: unknown,
  field: string,
  allowedValues: unknown
): string[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((entry) => typeof entry !== 'string' || entry.length === 0)
  ) {
    throw failure('campaign_repair_scope_addition_invalid', { field });
  }
  const normalized = [...new Set(value)].sort();
  const allowed = new Set(
    Array.isArray(allowedValues) ? allowedValues : []
  );
  if (
    normalized.length !== value.length ||
    normalized.some((entry) => !allowed.has(entry))
  ) {
    throw failure('campaign_repair_scope_addition_invalid', { field });
  }
  return normalized;
}

function normalizeAdditions(
  value: unknown,
  invalidatedPartitionIds: Set<string>,
  manifest: SchemaRecord,
  byId: Map<string, SchemaRecord>,
  order: Map<string, number>
): SchemaRecord[] {
  if (!Array.isArray(value)) {
    throw failure('campaign_repair_scope_addition_invalid');
  }
  const ownedPaths = currentOwnedPaths(manifest);
  const addedPaths = new Set<string>();
  const addedPartitions = new Set<string>();
  const additions = value.map((candidate) => {
    if (
      !isRecord(candidate) ||
      !invalidatedPartitionIds.has(candidate.partitionId) ||
      addedPartitions.has(candidate.partitionId) ||
      candidate.reasonCode !== 'missing_governed_path' ||
      !Array.isArray(candidate.paths) ||
      candidate.paths.length === 0
    ) {
      throw failure('campaign_repair_scope_addition_invalid', {
        partitionId: isRecord(candidate)
          ? candidate.partitionId
          : undefined,
      });
    }
    const paths = candidate.paths
      .map((entry) =>
        normalizeRelativePath(
          entry,
          'campaign_repair_scope_addition_invalid'
        )
      )
      .sort();
    if (new Set(paths).size !== paths.length) {
      throw failure('campaign_repair_scope_addition_conflict', {
        partitionId: candidate.partitionId,
      });
    }
    for (const governedPath of paths) {
      if (ownedPaths.has(governedPath) || addedPaths.has(governedPath)) {
        throw failure('campaign_repair_scope_addition_conflict', {
          partitionId: candidate.partitionId,
          path: governedPath,
        });
      }
      addedPaths.add(governedPath);
    }
    addedPartitions.add(candidate.partitionId);
    return {
      partitionId: candidate.partitionId,
      paths,
        reasonCode: 'missing_governed_path',
        taskIds: normalizeTextSet(
          candidate.taskIds,
          'taskIds',
          byId.get(candidate.partitionId)?.primaryTaskIds
        ),
        specSpanRefs: normalizeTextSet(
          candidate.specSpanRefs,
          'specSpanRefs',
          byId.get(candidate.partitionId)?.specSpanRefs
        ),
        baselineExists: candidate.baselineExists,
        baselineArtifactHash: candidate.baselineArtifactHash,
      };
  });
  for (const addition of additions) {
    if (typeof addition.baselineExists !== 'boolean') {
      throw failure('campaign_repair_scope_addition_invalid', {
        field: 'baselineExists',
      });
    }
    if (
      (addition.baselineExists === true &&
        (typeof addition.baselineArtifactHash !== 'string' ||
          !HASH_PATTERN.test(addition.baselineArtifactHash))) ||
      (addition.baselineExists === false &&
        addition.baselineArtifactHash !== null)
    ) {
      throw failure('campaign_repair_scope_addition_invalid', {
        field: 'baselineArtifactHash',
      });
    }
  }
  return additions.sort(
    (left, right) =>
      (order.get(left.partitionId) as number) -
      (order.get(right.partitionId) as number)
  );
}

function normalizeRepairAuthorization(value: unknown): SchemaRecord {
  const authorization = canonicalClone(value, 'repairAuthorization');
  if (
    !['user_explicit', 'main_agent_controlled_dispatch'].includes(
      authorization.authorizationKind
    )
  ) {
    throw failure('campaign_repair_authorization_invalid', {
      field: 'authorizationKind',
    });
  }
  requireText(authorization.authorizerIdentity, 'authorizerIdentity');
  requireHash(
    authorization.authorizationSourceHash,
    'authorizationSourceHash'
  );
  requireHash(
    authorization.authorizationStatementHash,
    'authorizationStatementHash'
  );
  if (
    Object.keys(authorization).some(
      (field) =>
        ![
          'authorizerIdentity',
          'authorizationKind',
          'authorizationSourceHash',
          'authorizationStatementHash',
        ].includes(field)
    )
  ) {
    throw failure('campaign_repair_authorization_invalid', {
      reason: 'unknown_field',
    });
  }
  return authorization;
}

function baseChildReleaseBindings(
  activation: SchemaRecord,
  manifest: SchemaRecord
): SchemaRecord[] {
  if (
    !Array.isArray(activation.childReleaseReceiptHashes) ||
    activation.childReleaseReceiptHashes.length !==
      manifest.topologicalOrder.length
  ) {
    throw failure('campaign_repair_authority_base_stale', {
      field: 'childReleaseReceiptHashes',
    });
  }
  return manifest.topologicalOrder.map(
    (partitionId: string, index: number) => ({
      ordinal: index + 1,
      partitionId,
      childReleaseReceiptHash:
        activation.childReleaseReceiptHashes[index],
    })
  );
}

function compileGoalCampaignRepairAuthority(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('campaign_repair_authority_request_invalid');
  }
  const { activation, manifest } = verifyBase(
    request.baseActivationReceipt,
    request.partitionManifest
  );
  const repairAttemptId = requireText(
    request.repairAttemptId,
    'repairAttemptId'
  );
  if (repairAttemptId === activation.attemptId) {
    throw failure('campaign_repair_attempt_replay');
  }
  const baselineAuthority = canonicalClone(
    request.baselineAuthority,
    'baselineAuthority'
  );
  const currentAuthority = canonicalClone(
    request.currentAuthority,
    'currentAuthority'
  );
  const changedPaths = normalizeChangedPaths(request.changedPaths);
  const evaluation = evaluateSubcontractInvalidation({
    partitionManifest: manifest,
    baselineAuthority,
    currentAuthority,
    changedPaths,
  });
  const { byId, order } = partitionIndex(manifest);
  const preservedPartitionIds = [...evaluation.preservedPartitionIds];
  const invalidatedPartitionIds = [...evaluation.invalidatedPartitionIds];
  if (
    preservedPartitionIds.length + invalidatedPartitionIds.length !==
      manifest.topologicalOrder.length ||
    new Set([...preservedPartitionIds, ...invalidatedPartitionIds]).size !==
      manifest.topologicalOrder.length
  ) {
    throw failure(
      'campaign_repair_authority_invalidation_mismatch',
      { reason: 'partition_coverage_incomplete' }
    );
  }
  const preservedClosureBindings = verifyBoundReceipts({
    receipts: request.preservedClosureReceipts,
    bindingKind: 'preserved_closure',
    schemaName: CLOSURE_SCHEMA,
    allowedPartitionIds: new Set(preservedPartitionIds),
    activation,
    manifest,
    byId,
    order,
  });
  const invalidatedLeaseBindings = verifyBoundReceipts({
    receipts: request.invalidatedLeaseReceipts,
    bindingKind: 'invalidated_lease',
    schemaName: LEASE_SCHEMA,
    allowedPartitionIds: new Set(invalidatedPartitionIds),
    activation,
    manifest,
    byId,
    order,
  });
  const invalidatedClosureBindings = verifyBoundReceipts({
    receipts: request.invalidatedClosureReceipts,
    bindingKind: 'invalidated_closure',
    schemaName: CLOSURE_SCHEMA,
    allowedPartitionIds: new Set(invalidatedPartitionIds),
    activation,
    manifest,
    byId,
    order,
  });
  const governedPathAdditions = normalizeAdditions(
    request.governedPathAdditions,
    new Set(invalidatedPartitionIds),
    manifest,
    byId,
    order
  );
  const repairAuthorization = normalizeRepairAuthorization(
    request.repairAuthorization
  );
  const repairAuthorizationHash =
    hashControlPlaneValue(repairAuthorization);
  const payload = {
    schemaVersion:
      'goal-contract-campaign-repair-authority-receipt/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    baseActivationReceiptHash: activation.receiptHash,
    baseAttemptId: activation.attemptId,
    repairAttemptId,
    basePartitionManifestDocumentHash: requireHash(
      request.partitionManifestDocumentHash,
      'partitionManifestDocumentHash'
    ),
    partitionManifestHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    baselineAuthority,
    currentAuthority,
    changedPaths,
    campaignWide: evaluation.campaignWide,
    changedAuthorityFields: [...evaluation.changedAuthorityFields],
    invalidationDecision: evaluation.decision,
    preservedPartitionIds,
    invalidatedPartitionIds,
    baseChildReleaseBindings: baseChildReleaseBindings(
      activation,
      manifest
    ),
    preservedClosureBindings,
    invalidatedLeaseBindings,
    invalidatedClosureBindings,
    governedPathAdditions,
    repairAuthorization,
    repairAuthorizationHash,
    authorizationCount: 1,
    modelInvocationCount: 0,
    createdAt: requireText(request.createdAt, 'createdAt'),
    decision: 'pass',
  };
  const receipt = {
    ...payload,
    receiptHash: hashReceiptPayload(payload),
  };
  if (receipt.repairAuthorizationHash === receipt.receiptHash) {
    throw failure('campaign_repair_authorization_invalid', {
      reason: 'authorization_hash_aliases_receipt_hash',
    });
  }
  validateGoalContractSchema(REPAIR_AUTHORITY_SCHEMA, receipt);
  return Object.freeze(receipt);
}

function verifyBindingPartitions(
  bindings: SchemaRecord[],
  allowed: Set<string>,
  order: Map<string, number>,
  requireExactCoverage = false
): boolean {
  const seen = new Set<string>();
  let priorIndex = -1;
  for (const binding of bindings) {
    const currentIndex = order.get(binding.partitionId);
    if (
      currentIndex === undefined ||
      currentIndex <= priorIndex ||
      binding.ordinal !== currentIndex + 1 ||
      !allowed.has(binding.partitionId) ||
      seen.has(binding.partitionId)
    ) {
      return false;
    }
    priorIndex = currentIndex;
    seen.add(binding.partitionId);
  }
  return !requireExactCoverage || seen.size === allowed.size;
}

function verifyGoalCampaignRepairAuthority(
  receiptCandidate: unknown,
  context: unknown = {}
) {
  if (!isRecord(receiptCandidate)) {
    throw failure('campaign_repair_authority_hash_invalid');
  }
  try {
    validateGoalContractSchema(
      REPAIR_AUTHORITY_SCHEMA,
      receiptCandidate
    );
  } catch {
    throw failure('campaign_repair_authority_hash_invalid');
  }
  const receipt = receiptCandidate;
  if (!verifyReceiptSelfHash(receipt)) {
    throw failure('campaign_repair_authority_hash_invalid');
  }
  if (!isRecord(context)) {
    throw failure('campaign_repair_authority_request_invalid');
  }
  const { activation, manifest } = verifyBase(
    context.baseActivationReceipt,
    context.partitionManifest
  );
  const expectedRepairAttemptId = requireText(
    context.expectedRepairAttemptId,
    'expectedRepairAttemptId'
  );
  if (
    receipt.repairAttemptId === receipt.baseAttemptId ||
    receipt.repairAttemptId === activation.attemptId
  ) {
    throw failure('campaign_repair_attempt_replay');
  }
  if (receipt.repairAttemptId !== expectedRepairAttemptId) {
    throw failure('campaign_repair_attempt_mismatch');
  }
  const expectedDocumentHash = requireHash(
    context.partitionManifestDocumentHash,
    'partitionManifestDocumentHash'
  );
  const baseBindings = {
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    baseActivationReceiptHash: activation.receiptHash,
    baseAttemptId: activation.attemptId,
    basePartitionManifestDocumentHash: expectedDocumentHash,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
  };
  for (const [field, expected] of Object.entries(baseBindings)) {
    if (receipt[field] !== expected) {
      throw failure('campaign_repair_authority_base_stale', { field });
    }
  }
  const changedPaths = normalizeChangedPaths(receipt.changedPaths);
  if (!equalCanonical(changedPaths, receipt.changedPaths)) {
    throw failure('campaign_repair_authority_hash_invalid');
  }
  const evaluation = evaluateSubcontractInvalidation({
    partitionManifest: manifest,
    baselineAuthority: receipt.baselineAuthority,
    currentAuthority: receipt.currentAuthority,
    changedPaths,
  });
  for (const [field, expected] of Object.entries({
    campaignWide: evaluation.campaignWide,
    changedAuthorityFields: evaluation.changedAuthorityFields,
    invalidationDecision: evaluation.decision,
    preservedPartitionIds: evaluation.preservedPartitionIds,
    invalidatedPartitionIds: evaluation.invalidatedPartitionIds,
  })) {
    if (!equalCanonical(receipt[field], expected)) {
      throw failure(
        'campaign_repair_authority_invalidation_mismatch',
        { field }
      );
    }
  }
  const { byId, order } = partitionIndex(manifest);
  if (
    !equalCanonical(
      receipt.baseChildReleaseBindings,
      baseChildReleaseBindings(activation, manifest)
    )
  ) {
    throw failure('campaign_repair_authority_binding_invalid', {
      bindingKind: 'base_child_release',
    });
  }
  if (
    !verifyBindingPartitions(
      receipt.preservedClosureBindings,
      new Set(receipt.preservedPartitionIds),
      order,
      true
    ) ||
    !verifyBindingPartitions(
      receipt.invalidatedLeaseBindings,
      new Set(receipt.invalidatedPartitionIds),
      order
    ) ||
    !verifyBindingPartitions(
      receipt.invalidatedClosureBindings,
      new Set(receipt.invalidatedPartitionIds),
      order
    )
  ) {
    throw failure('campaign_repair_authority_binding_invalid');
  }
  const repairAuthorization = normalizeRepairAuthorization(
    receipt.repairAuthorization
  );
  if (
    receipt.repairAuthorizationHash !==
      hashControlPlaneValue(repairAuthorization) ||
    receipt.repairAuthorizationHash === receipt.receiptHash
  ) {
    throw failure('campaign_repair_authorization_invalid');
  }
  const normalizedAdditions = normalizeAdditions(
    receipt.governedPathAdditions,
    new Set(receipt.invalidatedPartitionIds),
    manifest,
    byId,
    order
  );
  if (!equalCanonical(normalizedAdditions, receipt.governedPathAdditions)) {
    throw failure('campaign_repair_scope_addition_invalid');
  }
  return receipt;
}

function readReceiptDirectory({
  directory,
  schemaName,
}: {
  directory: string;
  schemaName: string;
}): SchemaRecord[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter(
      (entry: { isFile(): boolean; name: string }) =>
        entry.isFile() && entry.name.endsWith('.receipt.json')
    )
    .map((entry: { name: string }) =>
      readCommittedReceipt({
        targetPath: path.resolve(directory, entry.name),
        schemaName,
      })
    );
}

function loadPartitionManifestDocument(authorityRoot: string): {
  manifest: SchemaRecord;
  documentHash: string;
} {
  const targetPath = path.resolve(
    authorityRoot,
    'partition-manifest.json'
  );
  let bytes;
  let manifest;
  try {
    bytes = fs.readFileSync(targetPath);
    manifest = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw failure('campaign_repair_authority_base_stale', {
      reason: 'partition_manifest_document_invalid',
      targetPath: targetPath.replace(/\\/gu, '/'),
    });
  }
  if (!isRecord(manifest)) {
    throw failure('campaign_repair_authority_base_stale', {
      reason: 'partition_manifest_document_invalid',
    });
  }
  return { manifest, documentHash: sha256(bytes) };
}

function commitGoalCampaignRepairAuthority(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('campaign_repair_authority_request_invalid');
  }
  const injectedFields = [
    'baseActivationReceipt',
    'partitionManifest',
    'partitionManifestDocumentHash',
    'preservedClosureReceipts',
    'invalidatedLeaseReceipts',
    'invalidatedClosureReceipts',
  ].filter((field) => Object.hasOwn(request, field));
  if (injectedFields.length > 0) {
    throw failure('campaign_repair_authority_injection', {
      injectedFields,
    });
  }
  const receiptRoot = requireText(request.receiptRoot, 'receiptRoot');
  const authorityRoot = requireText(
    request.authorityRoot,
    'authorityRoot'
  );
  const campaignId = requireText(request.campaignId, 'campaignId');
  if (!/^goal-campaign-[0-9a-f]{64}$/u.test(campaignId)) {
    throw failure('campaign_repair_authority_request_invalid', {
      field: 'campaignId',
    });
  }
  const activation = readCommittedReceipt({
    targetPath: path.resolve(
      receiptRoot,
      'campaigns',
      campaignId,
      'activation.receipt.json'
    ),
    schemaName:
      'goal-contract-campaign-activation-receipt.schema.json',
  });
  if (activation.campaignId !== campaignId) {
    throw failure('campaign_repair_authority_base_stale', {
      field: 'campaignId',
    });
  }
  const { manifest, documentHash } =
    loadPartitionManifestDocument(authorityRoot);
  const changedPaths = normalizeChangedPaths(request.changedPaths);
  const baselineAuthority = canonicalClone(
    request.baselineAuthority,
    'baselineAuthority'
  );
  const currentAuthority = canonicalClone(
    request.currentAuthority,
    'currentAuthority'
  );
  const evaluation = evaluateSubcontractInvalidation({
    partitionManifest: manifest,
    baselineAuthority,
    currentAuthority,
    changedPaths,
  });
  const knownPartitions = new Set(manifest.topologicalOrder);
  const campaignRoot = path.resolve(
    receiptRoot,
    'campaigns',
    campaignId
  );
  const closures = readReceiptDirectory({
    directory: path.resolve(campaignRoot, 'closures'),
    schemaName: CLOSURE_SCHEMA,
  });
  const leases = readReceiptDirectory({
    directory: path.resolve(campaignRoot, 'leases'),
    schemaName: LEASE_SCHEMA,
  });
  for (const artifact of [...closures, ...leases]) {
    if (!knownPartitions.has(artifact.partitionId)) {
      throw failure('campaign_repair_authority_binding_invalid', {
        partitionId: artifact.partitionId,
        reason: 'artifact_partition_unknown',
      });
    }
  }
  const preserved = new Set(evaluation.preservedPartitionIds);
  const invalidated = new Set(evaluation.invalidatedPartitionIds);
  const receipt = compileGoalCampaignRepairAuthority({
    baseActivationReceipt: activation,
    partitionManifest: manifest,
    partitionManifestDocumentHash: documentHash,
    baselineAuthority,
    currentAuthority,
    changedPaths,
    governedPathAdditions: request.governedPathAdditions,
    preservedClosureReceipts: closures.filter((candidate) =>
      preserved.has(candidate.partitionId)
    ),
    invalidatedLeaseReceipts: leases.filter((candidate) =>
      invalidated.has(candidate.partitionId)
    ),
    invalidatedClosureReceipts: closures.filter((candidate) =>
      invalidated.has(candidate.partitionId)
    ),
    repairAttemptId: request.repairAttemptId,
    repairAuthorization: request.repairAuthorization,
    createdAt: request.createdAt,
  });
  const committed = commitCreateOnceReceipt({
    receiptRoot,
    relativePath:
      `campaigns/${campaignId}/repair/authority.receipt.json`,
    schemaName: REPAIR_AUTHORITY_SCHEMA,
    receipt,
    recovery: request.recovery === true,
  });
  return Object.freeze({
    receiptPath: committed.path,
    receipt: committed.receipt,
    recovered: committed.recovered,
  });
}

module.exports = {
  commitGoalCampaignRepairAuthority,
  compileGoalCampaignRepairAuthority,
  verifyGoalCampaignRepairAuthority,
};
