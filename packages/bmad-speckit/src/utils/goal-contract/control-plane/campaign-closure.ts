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
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);
const {
  lifecycleAuthorityFieldsFromManifest,
  verifyLifecycleAuthorityBinding,
} = require(
  __filename.endsWith('.ts')
    ? './lifecycle-authority-binding.ts'
    : './lifecycle-authority-binding'
);
const {
  verifyGoalCampaignRepairAuthority,
} = require(
  __filename.endsWith('.ts')
    ? './campaign-repair-authority.ts'
    : './campaign-repair-authority'
);

const ACTIVATION_SCHEMA =
  'goal-contract-campaign-activation-receipt.schema.json';
const CHILD_CLOSURE_SCHEMA =
  'goal-contract-subcontract-closure-receipt.schema.json';
const COMPATIBILITY_SCHEMA =
  'goal-contract-dependency-compatibility-receipt.schema.json';
const CAMPAIGN_CLOSURE_SCHEMA =
  'goal-contract-campaign-closure-receipt.schema.json';
const REPAIR_AUTHORITY_SCHEMA =
  'goal-contract-campaign-repair-authority-receipt.schema.json';
const HASH_PATTERN = /^sha256:[0-9a-f]{64}$/u;

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
    throw failure('goal_campaign_closure_request_invalid', { field });
  }
  return value;
}

function requireHash(value: unknown, field: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) {
    throw failure('goal_campaign_closure_request_invalid', { field });
  }
  return value;
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

function resolveRepositoryPath(
  repositoryRoot: string,
  value: unknown,
  field: string
): string {
  const root = fs.realpathSync(repositoryRoot);
  const text = requireText(value, field).replace(/\\/gu, '/');
  if (
    path.posix.isAbsolute(text) ||
    /^[A-Za-z]:\//u.test(text) ||
    text.split('/').includes('..')
  ) {
    throw failure('goal_campaign_compatibility_receipt_stale', {
      field,
      reason: 'path_escape',
    });
  }
  const targetPath = path.resolve(
    root,
    ...path.posix.normalize(text).split('/')
  );
  if (
    targetPath !== root &&
    !targetPath.startsWith(`${root}${path.sep}`)
  ) {
    throw failure('goal_campaign_compatibility_receipt_stale', {
      field,
      reason: 'path_escape',
    });
  }
  if (fs.existsSync(targetPath)) {
    const realPath = fs.realpathSync(targetPath);
    if (
      realPath !== root &&
      !realPath.startsWith(`${root}${path.sep}`)
    ) {
      throw failure('goal_campaign_compatibility_receipt_stale', {
        field,
        reason: 'symlink_escape',
      });
    }
  }
  return targetPath;
}

function readMatchingReceipt({
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
  let receipt;
  try {
    receipt = readCommittedReceipt({ targetPath, schemaName });
  } catch (error) {
    throw failure(failureClass, {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  if (!equalCanonical(receipt, candidate)) {
    throw failure(failureClass, {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: 'receipt_bytes_mismatch',
    });
  }
  return receipt;
}

function verifyActivationAndManifest({
  activation,
  manifest,
}: {
  activation: SchemaRecord;
  manifest: SchemaRecord;
}): void {
  if (
    !Array.isArray(manifest.partitions) ||
    !Array.isArray(manifest.topologicalOrder) ||
    manifest.partitions.length !== manifest.topologicalOrder.length
  ) {
    throw failure('goal_campaign_manifest_stale');
  }
  for (const [actual, expected, field] of [
    [
      manifest.sourceCompositionPolicyHash,
      activation.sourceCompositionPolicyHash,
      'sourceCompositionPolicyHash',
    ],
    [
      manifest.sourceAuthorityBundleHash,
      activation.sourceAuthorityBundleHash,
      'sourceAuthorityBundleHash',
    ],
    [manifest.goalContractHash, activation.goalContractHash, 'goalContractHash'],
    [
      manifest.partitionPlanHash,
      activation.partitionPlanHash,
      'partitionPlanHash',
    ],
    [
      manifest.partitionManifestHash,
      activation.partitionManifestHash,
      'partitionManifestHash',
    ],
    [
      manifest.partitionSetHash,
      activation.partitionSetHash,
      'partitionSetHash',
    ],
  ]) {
    if (actual !== expected) {
      throw failure('goal_campaign_manifest_stale', {
        field,
        expected,
        actual,
      });
    }
  }
  if (
    activation.decision !== 'pass' ||
    activation.authorizationCount !== 1 ||
    activation.modelInvocationCount !== 0
  ) {
    throw failure('goal_campaign_activation_stale');
  }
  verifyLifecycleAuthorityBinding({
    record: activation,
    partitionManifest: manifest,
    campaignId: activation.campaignId,
    attemptId: activation.attemptId,
  });
}

function classifyChildSet(
  manifest: SchemaRecord,
  candidates: unknown
): SchemaRecord[] {
  if (!Array.isArray(candidates)) {
    throw failure('goal_campaign_child_missing');
  }
  const records = candidates.filter(isRecord);
  if (records.length !== candidates.length) {
    throw failure('goal_campaign_child_stale');
  }
  const expectedIds = manifest.topologicalOrder;
  const actualIds = records.map(({ partitionId }) => partitionId);
  if (new Set(actualIds).size !== actualIds.length) {
    throw failure('goal_campaign_child_duplicate');
  }
  if (actualIds.some((partitionId) => !expectedIds.includes(partitionId))) {
    throw failure('goal_campaign_child_unknown');
  }
  if (records.length < expectedIds.length) {
    throw failure('goal_campaign_child_missing');
  }
  if (records.length > expectedIds.length) {
    throw failure('goal_campaign_child_unknown');
  }
  if (!equalCanonical(actualIds, expectedIds)) {
    throw failure('goal_campaign_child_reordered');
  }
  return records;
}

function resolveRepairAuthority({
  receiptRoot,
  activation,
  manifest,
  candidate,
  partitionManifestDocumentHash,
}: {
  receiptRoot: string;
  activation: SchemaRecord;
  manifest: SchemaRecord;
  candidate: unknown;
  partitionManifestDocumentHash: unknown;
}): SchemaRecord | null {
  if (candidate === undefined) return null;
  if (!isRecord(candidate)) {
    throw failure('goal_campaign_repair_authority_stale');
  }
  const repairAuthority = readMatchingReceipt({
    targetPath: path.resolve(
      receiptRoot,
      'campaigns',
      activation.campaignId,
      'repair',
      'authority.receipt.json'
    ),
    schemaName: REPAIR_AUTHORITY_SCHEMA,
    candidate,
    failureClass: 'goal_campaign_repair_authority_stale',
  });
  verifyGoalCampaignRepairAuthority(repairAuthority, {
    baseActivationReceipt: activation,
    partitionManifest: manifest,
    expectedRepairAttemptId: repairAuthority.repairAttemptId,
    partitionManifestDocumentHash: requireHash(
      partitionManifestDocumentHash,
      'partitionManifestDocumentHash'
    ),
  });
  const expected = new Set(manifest.topologicalOrder);
  const preserved = new Set(repairAuthority.preservedPartitionIds);
  const invalidated = new Set(repairAuthority.invalidatedPartitionIds);
  if (
    preserved.size + invalidated.size !== expected.size ||
    [...expected].some(
      (partitionId) =>
        preserved.has(partitionId) === invalidated.has(partitionId)
    )
  ) {
    throw failure('goal_campaign_repair_authority_stale', {
      reason: 'partition_coverage_invalid',
    });
  }
  return repairAuthority;
}

function verifyChildClosures({
  receiptRoot,
  activation,
  manifest,
  candidates,
  repairAuthority,
}: {
  receiptRoot: string;
  activation: SchemaRecord;
  manifest: SchemaRecord;
  candidates: SchemaRecord[];
  repairAuthority: SchemaRecord | null;
}): {
  closures: SchemaRecord[];
  byPartition: Map<string, SchemaRecord>;
} {
  const closures = [];
  const byPartition = new Map();
  for (let index = 0; index < candidates.length; index += 1) {
    const partitionId = manifest.topologicalOrder[index];
    const partition = manifest.partitions.find(
      (candidate) => candidate.partitionId === partitionId
    );
    if (!isRecord(partition)) {
      throw failure('goal_campaign_manifest_stale', { partitionId });
    }
    const repaired =
      repairAuthority?.invalidatedPartitionIds.includes(partitionId) ===
      true;
    const closure = readMatchingReceipt({
      targetPath: path.resolve(
        receiptRoot,
        'campaigns',
        activation.campaignId,
        ...(repaired ? ['repair', 'closures'] : ['closures']),
        `${String(index + 1).padStart(4, '0')}-${partitionId}.receipt.json`
      ),
      schemaName: CHILD_CLOSURE_SCHEMA,
      candidate: candidates[index],
      failureClass: 'goal_campaign_child_stale',
    });
    for (const [actual, expected, field] of [
      [closure.campaignId, activation.campaignId, 'campaignId'],
      [
        closure.campaignActivationHash,
        activation.campaignActivationHash,
        'campaignActivationHash',
      ],
      [
        closure.activationReceiptHash,
        activation.receiptHash,
        'activationReceiptHash',
      ],
      [
        closure.attemptId,
        repaired
          ? repairAuthority?.repairAttemptId
          : activation.attemptId,
        'attemptId',
      ],
      [closure.partitionId, partitionId, 'partitionId'],
      [
        closure.partitionManifestHash,
        manifest.partitionManifestHash,
        'partitionManifestHash',
      ],
      [
        closure.partitionPlanHash,
        manifest.partitionPlanHash,
        'partitionPlanHash',
      ],
      [
        closure.partitionSetHash,
        manifest.partitionSetHash,
        'partitionSetHash',
      ],
      [
        closure.sourceCompositionPolicyHash,
        manifest.sourceCompositionPolicyHash,
        'sourceCompositionPolicyHash',
      ],
      [
        closure.sourceAuthorityBundleHash,
        manifest.sourceAuthorityBundleHash,
        'sourceAuthorityBundleHash',
      ],
      [
        closure.childContractHash,
        partition.childContractHash,
        'childContractHash',
      ],
    ]) {
      if (actual !== expected) {
        throw failure('goal_campaign_child_stale', {
          partitionId,
          field,
        });
      }
    }
    if (repairAuthority && !repaired) {
      const preservedBinding =
        repairAuthority.preservedClosureBindings.find(
          (binding) => binding.partitionId === partitionId
        );
      if (
        !preservedBinding ||
        preservedBinding.ordinal !== index + 1 ||
        preservedBinding.closureReceiptHash !== closure.receiptHash
      ) {
        throw failure('goal_campaign_repair_authority_stale', {
          partitionId,
          reason: 'preserved_closure_binding_mismatch',
        });
      }
    }
    verifyLifecycleAuthorityBinding({
      record: closure,
      partitionManifest: manifest,
      campaignId: activation.campaignId,
      attemptId: closure.attemptId,
      partitionId,
      childContractHash: partition.childContractHash,
      nodeAttemptId: closure.nodeAttemptId,
    });
    for (const field of [
      'subcontractModelAuditCount',
      'reviewerInvocationCount',
      'auditorInvocationCount',
      'judgeSemanticAttemptCount',
    ]) {
      if (closure[field] !== 0) {
        throw failure('goal_campaign_child_model_counter_nonzero', {
          partitionId,
          field,
        });
      }
    }
    if (closure.decision !== 'pass') {
      throw failure('goal_campaign_child_stale', {
        partitionId,
        field: 'decision',
      });
    }
    closures.push(closure);
    byPartition.set(partitionId, closure);
  }
  for (const partition of manifest.partitions) {
    const closure = byPartition.get(partition.partitionId);
    const dependencies = partition.dependencyPartitionIds || [];
    const expectedPredecessors = dependencies.map((dependencyId) => {
      const predecessor = byPartition.get(dependencyId);
      if (!predecessor) {
        throw failure('goal_campaign_predecessor_closure_stale', {
          partitionId: partition.partitionId,
          dependencyId,
        });
      }
      return predecessor.receiptHash;
    });
    if (
      !equalCanonical(
        closure.predecessorClosureReceiptHashes,
        expectedPredecessors
      )
    ) {
      throw failure('goal_campaign_predecessor_closure_stale', {
        partitionId: partition.partitionId,
      });
    }
  }
  return { closures, byPartition };
}

function verifyCompatibilityReceipts({
  repositoryRoot,
  manifest,
  childClosures,
}: {
  repositoryRoot: string;
  manifest: SchemaRecord;
  childClosures: Map<string, SchemaRecord>;
}): string[] {
  const hashes = [];
  for (const partitionId of manifest.topologicalOrder) {
    const partition = manifest.partitions.find(
      (candidate) => candidate.partitionId === partitionId
    );
    const requirements = partition.compatibilityReceiptRequirements || [];
    if (!Array.isArray(requirements)) {
      throw failure('goal_campaign_compatibility_receipt_stale', {
        partitionId,
      });
    }
    for (const requirement of requirements) {
      if (!isRecord(requirement)) {
        throw failure('goal_campaign_compatibility_receipt_stale', {
          partitionId,
        });
      }
      const receiptPath = resolveRepositoryPath(
        repositoryRoot,
        requirement.receiptPath,
        'compatibilityReceiptPath'
      );
      let bytes;
      let receipt;
      try {
        bytes = fs.readFileSync(receiptPath);
        receipt = JSON.parse(bytes.toString('utf8'));
        validateGoalContractSchema(COMPATIBILITY_SCHEMA, receipt);
      } catch (error) {
        throw failure('goal_campaign_compatibility_receipt_stale', {
          partitionId,
          reason:
            (error as { failureClass?: string }).failureClass ||
            'receipt_invalid',
        });
      }
      const predecessor = childClosures.get(
        requirement.predecessorPartitionId
      );
      if (
        !predecessor ||
        receipt.decision !== 'pass' ||
        receipt.blockingReasons.length > 0 ||
        receipt.invalidatedAcceptanceIds.length > 0 ||
        receipt.partitionManifestHash !== manifest.partitionManifestHash ||
        receipt.dependentPartitionId !== partitionId ||
        receipt.predecessorPartitionId !==
          requirement.predecessorPartitionId ||
        receipt.predecessorCompletionReceiptHash !==
          predecessor.receiptHash ||
        receipt.predecessorOwnedArtifactPath !==
          requirement.artifactPath ||
        receipt.predecessorArtifactHash !== receipt.currentArtifactHash ||
        receipt.compatibilityCommands.some(
          ({ exitCode }) => exitCode !== 0
        )
      ) {
        throw failure('goal_campaign_compatibility_receipt_stale', {
          partitionId,
          receiptPath: receiptPath.replace(/\\/gu, '/'),
        });
      }
      const artifactPath = resolveRepositoryPath(
        repositoryRoot,
        requirement.artifactPath,
        'compatibilityArtifactPath'
      );
      if (
        !fs.existsSync(artifactPath) ||
        sha256(fs.readFileSync(artifactPath)) !==
          receipt.currentArtifactHash
      ) {
        throw failure('goal_campaign_compatibility_receipt_stale', {
          partitionId,
          artifactPath: artifactPath.replace(/\\/gu, '/'),
        });
      }
      hashes.push(sha256(bytes));
    }
  }
  if (new Set(hashes).size !== hashes.length) {
    throw failure('goal_campaign_compatibility_receipt_duplicate');
  }
  return hashes;
}

function closeGoalCampaign(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('goal_campaign_closure_request_invalid');
  }
  const forbiddenFields = [
    'subcontractClosureSetHash',
    'goalCampaignClosureHash',
    'receiptHash',
    'receiptPath',
    'decision',
  ].filter((field) => Object.hasOwn(request, field));
  if (forbiddenFields.length > 0) {
    throw failure('goal_campaign_closure_authority_injection', {
      forbiddenFields,
    });
  }
  const repositoryRoot = fs.realpathSync(
    requireText(request.repositoryRoot, 'repositoryRoot')
  );
  const receiptRoot = path.resolve(
    requireText(request.receiptRoot, 'receiptRoot')
  );
  const activationCandidate = request.activationReceipt;
  const manifest = request.partitionManifest;
  if (!isRecord(activationCandidate) || !isRecord(manifest)) {
    throw failure('goal_campaign_closure_request_invalid');
  }
  const activation = readMatchingReceipt({
    targetPath: path.resolve(
      receiptRoot,
      'campaigns',
      requireText(activationCandidate.campaignId, 'campaignId'),
      'activation.receipt.json'
    ),
    schemaName: ACTIVATION_SCHEMA,
    candidate: activationCandidate,
    failureClass: 'goal_campaign_activation_stale',
  });
  verifyActivationAndManifest({ activation, manifest });
  const repairAuthority = resolveRepairAuthority({
    receiptRoot,
    activation,
    manifest,
    candidate: request.repairAuthorityReceipt,
    partitionManifestDocumentHash:
      request.partitionManifestDocumentHash,
  });
  const candidates = classifyChildSet(
    manifest,
    request.childClosureReceipts
  );
  const childSet = verifyChildClosures({
    receiptRoot,
    activation,
    manifest,
    candidates,
    repairAuthority,
  });
  const compatibilityReceiptHashes = verifyCompatibilityReceipts({
    repositoryRoot,
    manifest,
    childClosures: childSet.byPartition,
  });
  const orderedChildClosureReceiptHashes = childSet.closures.map(
    ({ receiptHash }) => receiptHash
  );
  const finalExecutionProjectionHash = requireHash(
    request.finalExecutionProjectionHash,
    'finalExecutionProjectionHash'
  );
  const lifecycleAuthorityFields =
    lifecycleAuthorityFieldsFromManifest(manifest);
  const attemptId =
    repairAuthority?.repairAttemptId ?? activation.attemptId;
  const repairProvenance = repairAuthority
    ? {
        baseAttemptId: repairAuthority.baseAttemptId,
        repairAttemptId: repairAuthority.repairAttemptId,
        repairAuthorityReceiptHash: repairAuthority.receiptHash,
      }
    : {};
  const subcontractClosureSetHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-subcontract-closure-set/v1',
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    ...repairProvenance,
    topologicallyOrderedChildClosureReceiptHashes:
      orderedChildClosureReceiptHashes,
  });
  const goalCampaignClosureHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-campaign-closure/v1',
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    campaignActivationHash: activation.campaignActivationHash,
    partitionManifestHash: manifest.partitionManifestHash,
    attemptId,
    ...repairProvenance,
    ...lifecycleAuthorityFields,
    subcontractClosureSetHash,
    finalExecutionProjectionHash,
  });
  const payload = {
    schemaVersion: 'goal-contract-campaign-closure-receipt/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId,
    ...repairProvenance,
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: activation.sourceAuthorityBundleHash,
    goalContractHash: activation.goalContractHash,
    partitionPlanHash: activation.partitionPlanHash,
    partitionManifestHash: activation.partitionManifestHash,
    partitionSetHash: activation.partitionSetHash,
    ...lifecycleAuthorityFields,
    finalExecutionProjectionHash,
    orderedChildClosureReceiptHashes,
    compatibilityReceiptHashes,
    subcontractClosureSetHash,
    goalCampaignClosureHash,
    modelInvocationCount: 0,
    closedAt: requireText(request.closedAt, 'closedAt'),
    decision: 'pass',
  };
  const receipt = {
    ...payload,
    receiptHash: hashReceiptPayload(payload),
  };
  validateGoalContractSchema(CAMPAIGN_CLOSURE_SCHEMA, receipt);
  let committed;
  try {
    committed = commitCreateOnceReceipt({
      receiptRoot,
      relativePath:
        `campaigns/${activation.campaignId}/closure.receipt.json`,
      schemaName: CAMPAIGN_CLOSURE_SCHEMA,
      receipt,
      recovery: request.recovery === true,
    });
  } catch (error) {
    if (
      (error as { failureClass?: string }).failureClass ===
      'control_plane_duplicate_receipt'
    ) {
      throw failure('goal_campaign_closure_duplicate');
    }
    throw error;
  }
  return Object.freeze({
    receiptPath: committed.path,
    receipt: committed.receipt,
    recovered: committed.recovered,
  });
}

module.exports = {
  closeGoalCampaign,
};
