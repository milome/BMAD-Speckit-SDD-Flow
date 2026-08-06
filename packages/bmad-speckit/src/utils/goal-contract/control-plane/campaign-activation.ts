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
  commitCreateOnceReceipt,
  readCommittedReceipt,
} = require(
  __filename.endsWith('.ts')
    ? './campaign-receipt-store.ts'
    : './campaign-receipt-store'
);
const {
  verifyCompositeSourceAuthorityBundle,
} = require(
  __filename.endsWith('.ts')
    ? './composite-source-authority-bundle.ts'
    : './composite-source-authority-bundle'
);
const {
  verifyIntentAuthorityEnvelope,
} = require(
  __filename.endsWith('.ts') ? './intent-authority.ts' : './intent-authority'
);
const {
  verifySourceCompositionPolicy,
} = require(
  __filename.endsWith('.ts')
    ? './source-composition-policy.ts'
    : './source-composition-policy'
);
const {
  verifyOrderedSourceSnapshotSet,
} = require(
  __filename.endsWith('.ts') ? './source-snapshot.ts' : './source-snapshot'
);
const {
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts') ? './schema-registry.ts' : './schema-registry'
);
const {
  verifyAuthoritySupersessionReceipt,
} = require(
  __filename.endsWith('.ts')
    ? './authority-supersession.ts'
    : './authority-supersession'
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
    throw failure('campaign_activation_request_invalid', { field });
  }
  return value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw failure('campaign_activation_request_invalid', { field });
  }
  return value;
}

function sha256(bytes: Buffer): string {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function readJsonFile(
  filePath: string,
  failureClass: string
): SchemaRecord {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw failure(failureClass, {
      path: path.resolve(filePath).replace(/\\/gu, '/'),
    });
  }
}

function equalOrdered(left: unknown[], right: unknown[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function exactHashSet(left: unknown[], right: unknown[]): boolean {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return equalOrdered(
    [...new Set(left)].sort(),
    [...new Set(right)].sort()
  );
}

function assertNoAuthorityInjection(request: Record<string, unknown>): void {
  const forbiddenFields = [
    'campaignId',
    'campaignActivationHash',
    'activationReceiptHash',
    'receiptPath',
  ].filter((field) => Object.hasOwn(request, field));
  if (forbiddenFields.length > 0) {
    throw failure('campaign_activation_authority_injection', {
      forbiddenFields,
    });
  }
}

function verifyCurrentSourceBytes(snapshotSet: SchemaRecord): void {
  for (const snapshot of snapshotSet.sourceSnapshots) {
    if (
      snapshot.sourceKind !== 'source_plan' ||
      typeof snapshot.sourcePath !== 'string'
    ) {
      continue;
    }
    const staleClass =
      snapshot.sourceRole === 'subordinate_component_specification'
        ? 'subordinate_source_stale'
        : 'primary_source_stale';
    if (!fs.existsSync(snapshot.sourcePath)) {
      throw failure(staleClass, {
        sourceArtifactId: snapshot.sourceArtifactId,
        reason: 'source_missing',
      });
    }
    const currentHash = sha256(fs.readFileSync(snapshot.sourcePath));
    if (currentHash !== snapshot.sourceSnapshotHash) {
      throw failure(staleClass, {
        sourceArtifactId: snapshot.sourceArtifactId,
        expectedHash: snapshot.sourceSnapshotHash,
        actualHash: currentHash,
      });
    }
  }
}

function subordinateReceiptList(bundle: SchemaRecord): SchemaRecord[] {
  const coverage = bundle.subordinateCoverage;
  return Array.isArray(coverage?.receipts)
    ? coverage.receipts
    : coverage
      ? [coverage]
      : [];
}

function verifySubordinateCoverage(
  bundle: SchemaRecord,
  receipts: unknown
): string[] {
  if (!Array.isArray(receipts)) {
    throw failure('subordinate_coverage_incomplete');
  }
  const expected = subordinateReceiptList(bundle);
  for (const receipt of receipts) {
    if (!isRecord(receipt) || !verifyReceiptSelfHash(receipt)) {
      throw failure('subordinate_source_stale');
    }
  }
  const expectedHashes = expected.map(({ receiptHash }) => receiptHash);
  const actualHashes = receipts.map(({ receiptHash }) => receiptHash);
  if (!exactHashSet(expectedHashes, actualHashes)) {
    throw failure('subordinate_coverage_incomplete', {
      expectedHashes,
      actualHashes,
    });
  }
  return [...actualHashes].sort();
}

function verifyGoalContractBundle(
  bundle: unknown,
  bindings: Record<string, string>
): SchemaRecord {
  if (
    !isRecord(bundle) ||
    bundle.schemaVersion !== 'goal-contract-bundle/v1'
  ) {
    throw failure('goal_contract_authority_missing');
  }
  for (const [field, expected] of Object.entries(bindings)) {
    if (bundle[field] !== expected) {
      throw failure('goal_contract_authority_mismatch', {
        field,
        expected,
        actual: bundle[field],
      });
    }
  }
  const expectedGoalHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-authority/v1',
    goalContractSemanticHash: bundle.goalContractSemanticHash,
    authorityAttestationHash: bundle.authorityAttestationHash,
    sourceCompositionPolicyHash:
      bundle.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: bundle.sourceAuthorityBundleHash,
    compilerIdentityHash: bundle.compilerIdentityHash,
  });
  if (bundle.goalContractHash !== expectedGoalHash) {
    throw failure('goal_contract_authority_mismatch', {
      field: 'goalContractHash',
    });
  }
  return bundle;
}

function verifyFinalManifest(
  manifest: unknown,
  bindings: Record<string, string>
): SchemaRecord {
  if (
    !isRecord(manifest) ||
    manifest.schemaVersion !== 'goal-contract-partition-manifest/v2' ||
    manifest.manifestAuthorityMode !== 'final_child_membership' ||
    !Array.isArray(manifest.partitions) ||
    !Array.isArray(manifest.topologicalOrder) ||
    !Array.isArray(manifest.orderedChildContractHashes)
  ) {
    throw failure('campaign_partition_manifest_not_final');
  }
  for (const [field, expected] of Object.entries(bindings)) {
    if (manifest[field] !== expected) {
      throw failure('campaign_authority_stale', {
        field,
        expected,
        actual: manifest[field],
      });
    }
  }
  if (
    manifest.partitionCount !== manifest.partitions.length ||
    !equalOrdered(
      manifest.topologicalOrder,
      manifest.partitions.map(({ partitionId }) => partitionId)
    ) ||
    !equalOrdered(
      manifest.orderedChildContractHashes,
      manifest.partitions.map(({ childContractHash }) => childContractHash)
    )
  ) {
    throw failure('campaign_partition_manifest_not_final');
  }
  const coverage = manifest.coverage;
  if (
    !isRecord(coverage) ||
    [
      'uncoveredObligationIds',
      'duplicateObligationIds',
      'unmappedObligationIds',
      'scopeEscapeObligationIds',
    ].some(
      (field) =>
        !Array.isArray(coverage[field]) || coverage[field].length > 0
    )
  ) {
    throw failure('campaign_global_coverage_incomplete');
  }
  const expectedManifestHash = hashControlPlaneValue({
    goalContractHash: manifest.goalContractHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
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
    ...(manifest.partitionImpactGraphHash
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
  if (manifest.partitionManifestHash !== expectedManifestHash) {
    throw failure('campaign_partition_manifest_stale');
  }
  return manifest;
}

function verifyChildReleaseReceipts(
  manifest: SchemaRecord,
  receipts: unknown
): string[] {
  if (
    !Array.isArray(receipts) ||
    receipts.length !== manifest.partitions.length
  ) {
    throw failure('campaign_child_release_incomplete');
  }
  const byPartition = new Map(
    receipts
      .filter(isRecord)
      .map((receipt) => [receipt.partitionId, receipt])
  );
  if (byPartition.size !== manifest.partitions.length) {
    throw failure('campaign_child_release_incomplete');
  }
  const hashes = [];
  for (const partition of manifest.partitions) {
    const receipt = byPartition.get(partition.partitionId);
    if (!receipt) throw failure('campaign_child_release_incomplete');
    if (
      receipt.decision !== 'pass' ||
      !Array.isArray(receipt.blockingReasons) ||
      receipt.blockingReasons.length > 0
    ) {
      throw failure('campaign_child_release_blocked', {
        partitionId: partition.partitionId,
      });
    }
    for (const [field, expected] of [
      [
        'partitionManifestAuthorityHash',
        manifest.partitionManifestHash,
      ],
      ['partitionPlanHash', manifest.partitionPlanHash],
      ['partitionSetHash', manifest.partitionSetHash],
      [
        'sourceCompositionPolicyHash',
        manifest.sourceCompositionPolicyHash,
      ],
      ['sourceAuthorityBundleHash', manifest.sourceAuthorityBundleHash],
      ['goalContractHash', partition.childContractHash],
      ['childContractHash', partition.childContractHash],
      ['selectionSetHash', partition.selectionSetHash],
      [
        'childCompilationReceiptHash',
        partition.childCompilationReceiptHash,
      ],
    ]) {
      if (receipt[field] !== expected) {
        throw failure('campaign_child_release_stale', {
          partitionId: partition.partitionId,
          field,
        });
      }
    }
    hashes.push(hashControlPlaneValue(receipt));
  }
  return hashes;
}

function normalizeExecutionAuthorization(
  authorization: unknown,
  expected: Record<string, string>
): Record<string, string> {
  if (!isRecord(authorization)) {
    throw failure('campaign_execution_authorization_invalid');
  }
  const allowedFields = new Set([
    'authorizerIdentity',
    'authorizationKind',
    'authorizedSourceCompositionPolicyHash',
    'authorizedGoalContractHash',
    'authorizedPartitionManifestHash',
    'authorizedPartitionSetHash',
    'authorizationSourceHash',
    'authorizationStatementHash',
  ]);
  if (
    Object.keys(authorization).some((field) => !allowedFields.has(field))
  ) {
    throw failure('campaign_activation_authority_injection');
  }
  const normalized = {
    authorizerIdentity: requireText(
      authorization.authorizerIdentity,
      'authorizerIdentity'
    ),
    authorizationKind: requireText(
      authorization.authorizationKind,
      'authorizationKind'
    ),
    authorizedSourceCompositionPolicyHash: requireHash(
      authorization.authorizedSourceCompositionPolicyHash,
      'authorizedSourceCompositionPolicyHash'
    ),
    authorizedGoalContractHash: requireHash(
      authorization.authorizedGoalContractHash,
      'authorizedGoalContractHash'
    ),
    authorizedPartitionManifestHash: requireHash(
      authorization.authorizedPartitionManifestHash,
      'authorizedPartitionManifestHash'
    ),
    authorizedPartitionSetHash: requireHash(
      authorization.authorizedPartitionSetHash,
      'authorizedPartitionSetHash'
    ),
    authorizationSourceHash: requireHash(
      authorization.authorizationSourceHash,
      'authorizationSourceHash'
    ),
    authorizationStatementHash: requireHash(
      authorization.authorizationStatementHash,
      'authorizationStatementHash'
    ),
  };
  if (
    !['user_explicit', 'main_agent_controlled_dispatch'].includes(
      normalized.authorizationKind
    )
  ) {
    throw failure('campaign_execution_authorization_invalid');
  }
  for (const [field, value] of Object.entries(expected)) {
    if (normalized[field] !== value) {
      throw failure('campaign_execution_authorization_stale', {
        field,
      });
    }
  }
  return normalized;
}

function commitCampaignActivationReceipt({
  request,
  sourceCompositionPolicyHash,
  orderedSourceSnapshotSetHash,
  sourceAuthorityBundleHash,
  authorityAttestationHash,
  goalContractHash,
  partitionPlanHash,
  partitionManifestHash,
  partitionSetHash,
  partitionPolicyHash,
  compilerIdentityHash,
  subordinateCoverageReceiptHashes,
  childReleaseReceiptHashes,
  executionAuthorization,
  lifecycleAuthorityFields,
  attemptId,
  activatedAt,
}: SchemaRecord) {
  const executionAuthorizationHash = hashControlPlaneValue(
    executionAuthorization
  );
  const campaignActivationHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-campaign-activation/v1',
    sourceCompositionPolicyHash,
    goalContractHash,
    partitionManifestHash,
    partitionSetHash,
    authorityAttestationHash,
    executionAuthorizationHash,
    attemptId,
    ...lifecycleAuthorityFields,
  });
  const campaignId = `goal-campaign-${campaignActivationHash.slice(7)}`;
  const payload = {
    schemaVersion: 'goal-contract-campaign-activation-receipt/v1',
    campaignId,
    campaignActivationHash,
    attemptId,
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash,
    authorityAttestationHash,
    goalContractHash,
    partitionPlanHash,
    partitionManifestHash,
    partitionSetHash,
    partitionPolicyHash,
    compilerIdentityHash,
    ...lifecycleAuthorityFields,
    subordinateCoverageReceiptHashes,
    childReleaseReceiptHashes,
    executionAuthorization,
    executionAuthorizationHash,
    authorizationCount: 1,
    modelInvocationCount: 0,
    activatedAt,
    decision: 'pass',
  };
  const receipt = {
    ...payload,
    receiptHash: hashReceiptPayload(payload),
  };
  validateGoalContractSchema(ACTIVATION_SCHEMA, receipt);
  let committed;
  try {
    committed = commitCreateOnceReceipt({
      receiptRoot: requireText(request.receiptRoot, 'receiptRoot'),
      relativePath:
        `campaigns/${campaignId}/activation.receipt.json`,
      schemaName: ACTIVATION_SCHEMA,
      receipt,
      recovery: request.recovery === true,
    });
  } catch (error) {
    if (
      (error as { failureClass?: string }).failureClass ===
      'control_plane_duplicate_receipt'
    ) {
      throw failure('campaign_activation_duplicate');
    }
    throw error;
  }
  return Object.freeze({
    receiptPath: committed.path,
    receipt: committed.receipt,
    recovered: committed.recovered,
  });
}

function activateGoalCampaign(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('campaign_activation_request_invalid');
  }
  assertNoAuthorityInjection(request);
  const policy = verifySourceCompositionPolicy(
    request.sourceCompositionPolicy
  );
  const snapshotSet = verifyOrderedSourceSnapshotSet(
    request.orderedSourceSnapshotSet
  );
  verifyCurrentSourceBytes(snapshotSet);
  const authorityBundle = verifyCompositeSourceAuthorityBundle(
    request.compositeSourceAuthorityBundle
  );
  const intentEnvelope = verifyIntentAuthorityEnvelope(
    request.intentAuthorityEnvelope
  );
  const rootBindings = {
    sourceCompositionPolicyHash:
      policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      snapshotSet.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      authorityBundle.sourceAuthorityBundleHash,
  };
  if (
    authorityBundle.sourceCompositionPolicyHash !==
      rootBindings.sourceCompositionPolicyHash ||
    authorityBundle.orderedSourceSnapshotSetHash !==
      rootBindings.orderedSourceSnapshotSetHash ||
    intentEnvelope.subject.sourceCompositionPolicyHash !==
      rootBindings.sourceCompositionPolicyHash ||
    intentEnvelope.subject.orderedSourceSnapshotSetHash !==
      rootBindings.orderedSourceSnapshotSetHash ||
    intentEnvelope.subject.sourceAuthorityBundleHash !==
      rootBindings.sourceAuthorityBundleHash
  ) {
    throw failure('campaign_authority_stale');
  }
  const goalContract = verifyGoalContractBundle(
    request.goalContractBundle,
    {
      ...rootBindings,
      authorityAttestationHash:
        intentEnvelope.authorityAttestationHash,
    }
  );
  const manifest = verifyFinalManifest(request.partitionManifest, {
    ...rootBindings,
    intentAuthorityAttestationHash:
      intentEnvelope.authorityAttestationHash,
    goalContractHash: goalContract.goalContractHash,
  });
  const subordinateCoverageReceiptHashes = verifySubordinateCoverage(
    authorityBundle,
    request.subordinateCoverageReceipts
  );
  if (
    !exactHashSet(
      subordinateCoverageReceiptHashes,
      manifest.subordinateCoverageReceiptHashes
    )
  ) {
    throw failure('subordinate_coverage_incomplete');
  }
  const childReleaseReceiptHashes = verifyChildReleaseReceipts(
    manifest,
    request.childReleaseGateReceipts
  );
  const executionAuthorization = normalizeExecutionAuthorization(
    request.executionAuthorization,
    {
      authorizedSourceCompositionPolicyHash:
        policy.sourceCompositionPolicyHash,
      authorizedGoalContractHash: goalContract.goalContractHash,
      authorizedPartitionManifestHash:
        manifest.partitionManifestHash,
      authorizedPartitionSetHash: manifest.partitionSetHash,
    }
  );
  const attemptId = requireText(request.attemptId, 'attemptId');
  const activatedAt = requireText(request.activatedAt, 'activatedAt');
  const lifecycleAuthorityFields =
    lifecycleAuthorityFieldsFromManifest(manifest);
  return commitCampaignActivationReceipt({
    request,
    sourceCompositionPolicyHash:
      policy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      snapshotSet.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      authorityBundle.sourceAuthorityBundleHash,
    authorityAttestationHash:
      intentEnvelope.authorityAttestationHash,
    goalContractHash: goalContract.goalContractHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionPolicyHash: manifest.partitionPolicyHash,
    compilerIdentityHash: goalContract.compilerIdentityHash,
    subordinateCoverageReceiptHashes,
    childReleaseReceiptHashes,
    executionAuthorization,
    lifecycleAuthorityFields,
    attemptId,
    activatedAt,
  });
}

function activateGoalCampaignFromSuccessorAuthority(
  request: unknown = {}
) {
  if (!isRecord(request)) {
    throw failure('campaign_activation_request_invalid');
  }
  assertNoAuthorityInjection(request);
  const authorityRoot = path.resolve(
    requireText(request.authorityRoot, 'authorityRoot')
  );
  const verified = verifyAuthoritySupersessionReceipt({
    authorityRoot,
  });
  const supersessionReceipt = verified.receipt;
  if (
    supersessionReceipt.activationMode !== 'successor_only' ||
    supersessionReceipt.supersededDisposition !==
      'superseded_non_executable'
  ) {
    throw failure('authority_supersession_not_executable');
  }
  const attemptId = requireText(request.attemptId, 'attemptId');
  if (attemptId !== supersessionReceipt.attemptId) {
    throw failure('authority_supersession_replay_rejected', {
      field: 'attemptId',
      expected: supersessionReceipt.attemptId,
      actual: attemptId,
    });
  }

  const sourceIdentity = supersessionReceipt.sourceIdentity;
  if (!isRecord(sourceIdentity)) {
    throw failure('campaign_successor_source_identity_invalid');
  }
  const sourcePath = path.resolve(
    requireText(sourceIdentity.sourcePath, 'sourceIdentity.sourcePath')
  );
  const expectedSourceHash = requireHash(
    sourceIdentity.sourceHash,
    'sourceIdentity.sourceHash'
  );
  const sourceSnapshotHash = requireHash(
    sourceIdentity.sourceSnapshotHash,
    'sourceIdentity.sourceSnapshotHash'
  );
  if (!fs.existsSync(sourcePath)) {
    throw failure('primary_source_stale', {
      sourcePath: sourcePath.replace(/\\/gu, '/'),
      reason: 'source_missing',
    });
  }
  const actualSourceHash = sha256(fs.readFileSync(sourcePath));
  if (actualSourceHash !== expectedSourceHash) {
    throw failure('primary_source_stale', {
      sourcePath: sourcePath.replace(/\\/gu, '/'),
      expectedHash: expectedSourceHash,
      actualHash: actualSourceHash,
    });
  }
  if (sourceSnapshotHash !== actualSourceHash) {
    throw failure('campaign_successor_source_identity_invalid', {
      expectedHash: actualSourceHash,
      actualHash: sourceSnapshotHash,
    });
  }

  const partitionPlanPath = path.join(
    authorityRoot,
    'partition-plan.json'
  );
  const partitionManifestPath = path.join(
    authorityRoot,
    'partition-manifest.json'
  );
  const partitionPlan = readJsonFile(
    partitionPlanPath,
    'campaign_successor_partition_plan_invalid'
  );
  const successorAuthority = supersessionReceipt.successorAuthority;
  if (!isRecord(successorAuthority)) {
    throw failure('campaign_successor_authority_invalid');
  }
  const semanticPartitionPlan = structuredClone(partitionPlan);
  delete semanticPartitionPlan.partitionPlanHash;
  if (
    partitionPlan.partitionPlanHash !==
      hashControlPlaneValue(semanticPartitionPlan)
  ) {
    throw failure('campaign_successor_partition_plan_invalid');
  }
  for (const [field, expected] of [
    ['partitionPlanHash', successorAuthority.partitionPlanHash],
    ['partitionSetHash', successorAuthority.partitionSetHash],
    [
      'sourceCompositionPolicyHash',
      successorAuthority.sourceCompositionPolicyHash,
    ],
    [
      'sourceAuthorityBundleHash',
      successorAuthority.sourceAuthorityBundleHash,
    ],
    ['specSpanRegistryHash', successorAuthority.specSpanRegistryHash],
    ['partitionPolicyHash', supersessionReceipt.partitionPolicyHash],
  ]) {
    if (partitionPlan[field] !== expected) {
      throw failure('campaign_authority_stale', {
        field,
        expected,
        actual: partitionPlan[field],
      });
    }
  }

  const manifestBytes = fs.readFileSync(partitionManifestPath);
  if (
    sha256(manifestBytes) !==
    successorAuthority.partitionManifestDocumentHash
  ) {
    throw failure('campaign_partition_manifest_stale');
  }
  const manifest = verifyFinalManifest(
    readJsonFile(
      partitionManifestPath,
      'campaign_successor_partition_manifest_invalid'
    ),
    {
      sourceCompositionPolicyHash:
        partitionPlan.sourceCompositionPolicyHash,
      orderedSourceSnapshotSetHash:
        requireHash(
          partitionPlan.orderedSourceSnapshotSetHash,
          'orderedSourceSnapshotSetHash'
        ),
      sourceAuthorityBundleHash:
        partitionPlan.sourceAuthorityBundleHash,
      intentAuthorityAttestationHash:
        requireHash(
          partitionPlan.intentAuthorityAttestationHash,
          'intentAuthorityAttestationHash'
        ),
      goalContractHash: requireHash(
        partitionPlan.goalContractHash,
        'goalContractHash'
      ),
      partitionPolicyHash: partitionPlan.partitionPolicyHash,
      partitionPlanHash: partitionPlan.partitionPlanHash,
      partitionManifestHash:
        successorAuthority.partitionManifestHash,
      partitionSetHash: partitionPlan.partitionSetHash,
      specSpanRegistryHash: partitionPlan.specSpanRegistryHash,
    }
  );
  if (
    !equalOrdered(
      manifest.orderedChildContractHashes,
      successorAuthority.orderedChildContractHashes
    )
  ) {
    throw failure('campaign_authority_stale');
  }
  const subordinateCoverageReceiptHashes =
    manifest.subordinateCoverageReceiptHashes;
  if (
    !Array.isArray(subordinateCoverageReceiptHashes) ||
    subordinateCoverageReceiptHashes.some(
      (receiptHash) => !HASH_PATTERN.test(receiptHash)
    )
  ) {
    throw failure('subordinate_coverage_incomplete');
  }
  const childReleaseReceiptHashes = verifyChildReleaseReceipts(
    manifest,
    request.childReleaseGateReceipts
  );
  const executionAuthorization = normalizeExecutionAuthorization(
    request.executionAuthorization,
    {
      authorizedSourceCompositionPolicyHash:
        manifest.sourceCompositionPolicyHash,
      authorizedGoalContractHash: manifest.goalContractHash,
      authorizedPartitionManifestHash:
        manifest.partitionManifestHash,
      authorizedPartitionSetHash: manifest.partitionSetHash,
    }
  );
  const lifecycleAuthorityFields =
    lifecycleAuthorityFieldsFromManifest(manifest);
  return commitCampaignActivationReceipt({
    request,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      manifest.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      manifest.sourceAuthorityBundleHash,
    authorityAttestationHash:
      manifest.intentAuthorityAttestationHash,
    goalContractHash: manifest.goalContractHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionPolicyHash: manifest.partitionPolicyHash,
    compilerIdentityHash: requireHash(
      supersessionReceipt.compilerIdentityHash,
      'compilerIdentityHash'
    ),
    subordinateCoverageReceiptHashes,
    childReleaseReceiptHashes,
    executionAuthorization,
    lifecycleAuthorityFields,
    attemptId,
    activatedAt: requireText(request.activatedAt, 'activatedAt'),
  });
}

function verifyActivationReceipt(receipt: unknown): SchemaRecord {
  validateGoalContractSchema(ACTIVATION_SCHEMA, receipt);
  if (!verifyReceiptSelfHash(receipt)) {
    throw failure('campaign_activation_receipt_invalid');
  }
  return receipt as SchemaRecord;
}

function verifyCommittedActivationReceipt({
  receiptRoot,
  activationReceipt,
}: {
  receiptRoot: string;
  activationReceipt: SchemaRecord;
}): SchemaRecord {
  const targetPath = path.resolve(
    receiptRoot,
    'campaigns',
    activationReceipt.campaignId,
    'activation.receipt.json'
  );
  if (!fs.existsSync(targetPath)) {
    throw failure('subcontract_activation_receipt_not_committed', {
      targetPath: targetPath.replace(/\\/gu, '/'),
    });
  }
  let committed;
  try {
    committed = readCommittedReceipt({
      targetPath,
      schemaName: ACTIVATION_SCHEMA,
    });
  } catch (error) {
    throw failure('subcontract_activation_receipt_not_committed', {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  if (
    stableControlPlaneStringify(committed) !==
    stableControlPlaneStringify(activationReceipt)
  ) {
    throw failure('subcontract_activation_receipt_not_committed', {
      targetPath: targetPath.replace(/\\/gu, '/'),
      reason: 'activation_bytes_mismatch',
    });
  }
  return committed;
}

function verifyCommittedRepairAuthorityReceipt({
  receiptRoot,
  activationReceipt,
  partitionManifest,
  repairAuthorityReceipt,
  expectedRepairAttemptId,
}: {
  receiptRoot: string;
  activationReceipt: SchemaRecord;
  partitionManifest: SchemaRecord;
  repairAuthorityReceipt?: unknown;
  expectedRepairAttemptId?: string;
}): SchemaRecord | null {
  const targetPath = path.resolve(
    receiptRoot,
    'campaigns',
    activationReceipt.campaignId,
    'repair',
    'authority.receipt.json'
  );
  if (!fs.existsSync(targetPath)) {
    if (repairAuthorityReceipt !== undefined) {
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
  if (
    repairAuthorityReceipt !== undefined &&
    stableControlPlaneStringify(committed) !==
      stableControlPlaneStringify(repairAuthorityReceipt)
  ) {
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
    baseActivationReceipt: activationReceipt,
    partitionManifest,
    expectedRepairAttemptId:
      expectedRepairAttemptId || committed.repairAttemptId,
    partitionManifestDocumentHash:
      committed.basePartitionManifestDocumentHash,
  });
}

function verifyCommittedRepairPredecessor({
  receiptRoot,
  activation,
  manifest,
  repairAuthority,
  dependency,
  dependencyIndex,
  predecessorOrigin,
  closureCandidate,
}: {
  receiptRoot: string;
  activation: SchemaRecord;
  manifest: SchemaRecord;
  repairAuthority: SchemaRecord;
  dependency: SchemaRecord;
  dependencyIndex: number;
  predecessorOrigin: string;
  closureCandidate: SchemaRecord;
}): SchemaRecord {
  const repaired = predecessorOrigin === 'repaired';
  const relativeDirectories = repaired
    ? ['repair', 'closures']
    : ['closures'];
  const fileName =
    `${String(dependencyIndex + 1).padStart(4, '0')}-` +
    `${dependency.partitionId}.receipt.json`;
  const closurePath = path.resolve(
    receiptRoot,
    'campaigns',
    activation.campaignId,
    ...relativeDirectories,
    fileName
  );
  let closure;
  try {
    closure = readCommittedReceipt({
      targetPath: closurePath,
      schemaName: CLOSURE_SCHEMA,
    });
  } catch (error) {
    throw failure('subcontract_predecessor_closure_stale', {
      dependencyId: dependency.partitionId,
      targetPath: closurePath.replace(/\\/gu, '/'),
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  if (
    stableControlPlaneStringify(closure) !==
    stableControlPlaneStringify(closureCandidate)
  ) {
    throw failure('subcontract_predecessor_closure_stale', {
      dependencyId: dependency.partitionId,
      reason: 'predecessor_closure_bytes_mismatch',
    });
  }
  const leasePath = path.resolve(
    receiptRoot,
    'campaigns',
    activation.campaignId,
    ...(repaired ? ['repair', 'leases'] : ['leases']),
    fileName
  );
  let lease;
  try {
    lease = readCommittedReceipt({
      targetPath: leasePath,
      schemaName: LEASE_SCHEMA,
    });
  } catch (error) {
    throw failure('subcontract_predecessor_closure_stale', {
      dependencyId: dependency.partitionId,
      targetPath: leasePath.replace(/\\/gu, '/'),
      reason: (error as { failureClass?: string }).failureClass,
    });
  }
  const expectedAttemptId = repaired
    ? repairAuthority.repairAttemptId
    : repairAuthority.baseAttemptId;
  if (
    closure.leaseReceiptHash !== lease.receiptHash ||
    lease.partitionId !== dependency.partitionId ||
    lease.attemptId !== expectedAttemptId ||
    lease.partitionManifestHash !== manifest.partitionManifestHash ||
    lease.childContractHash !== dependency.childContractHash ||
    lease.decision !== 'pass' ||
    (repaired &&
      (lease.schemaVersion !==
        'goal-contract-subcontract-execution-lease/v2' ||
        lease.baseAttemptId !== repairAuthority.baseAttemptId ||
        lease.repairAttemptId !== repairAuthority.repairAttemptId ||
        lease.repairAuthorityReceiptHash !== repairAuthority.receiptHash))
  ) {
    throw failure('subcontract_predecessor_closure_stale', {
      dependencyId: dependency.partitionId,
      reason: 'predecessor_lease_lineage_mismatch',
    });
  }
  if (!repaired) {
    const preservedBindings = Array.isArray(
      repairAuthority.preservedClosureBindings
    )
      ? repairAuthority.preservedClosureBindings.filter(
          (binding) =>
            binding.partitionId === dependency.partitionId
        )
      : [];
    if (
      preservedBindings.length !== 1 ||
      preservedBindings[0].ordinal !== dependencyIndex + 1 ||
      preservedBindings[0].closureReceiptHash !== closure.receiptHash
    ) {
      throw failure('subcontract_predecessor_closure_stale', {
        dependencyId: dependency.partitionId,
        reason: 'preserved_closure_authority_mismatch',
      });
    }
  }
  verifyLifecyclePredecessorOrigin({
    record: closure,
    partitionManifest: manifest,
    campaignId: activation.campaignId,
    campaignAttemptId: activation.attemptId,
    baseAttemptId: repairAuthority.baseAttemptId,
    repairAttemptId: repairAuthority.repairAttemptId,
    predecessorOrigin,
    partitionId: dependency.partitionId,
    childContractHash: dependency.childContractHash,
    nodeAttemptId: lease.nodeAttemptId,
  });
  return closure;
}

function hasValidPredecessorClosureSelfHash(
  closure: unknown
): boolean {
  try {
    return verifyReceiptSelfHash(closure);
  } catch {
    // Untrusted predecessor data must fail as stale, even if it cannot be canonicalized.
    return false;
  }
}

function issueSubcontractExecutionLease(request: unknown = {}) {
  if (!isRecord(request)) {
    throw failure('subcontract_execution_lease_request_invalid');
  }
  const forbiddenFields = [
    'leaseHash',
    'receiptHash',
    'receiptPath',
  ].filter((field) => Object.hasOwn(request, field));
  if (forbiddenFields.length > 0) {
    throw failure('subcontract_execution_lease_authority_injection', {
      forbiddenFields,
    });
  }
  const activationCandidate = verifyActivationReceipt(
    request.activationReceipt
  );
  const receiptRoot = requireText(request.receiptRoot, 'receiptRoot');
  const activation = verifyCommittedActivationReceipt({
    receiptRoot,
    activationReceipt: activationCandidate,
  });
  const manifest = verifyFinalManifest(request.partitionManifest, {
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      activation.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      activation.sourceAuthorityBundleHash,
    goalContractHash: activation.goalContractHash,
    partitionPlanHash: activation.partitionPlanHash,
    partitionManifestHash: activation.partitionManifestHash,
    partitionSetHash: activation.partitionSetHash,
  });
  const attemptId = requireText(request.attemptId, 'attemptId');
  const partitionIdValue = requireText(
    request.partitionId,
    'partitionId'
  );
  const index = manifest.topologicalOrder.indexOf(partitionIdValue);
  if (index < 0) {
    throw failure('subcontract_manifest_membership_missing');
  }
  const partition = manifest.partitions[index];
  verifyLifecycleAuthorityBinding({
    record: activation,
    partitionManifest: manifest,
    campaignId: activation.campaignId,
    attemptId: activation.attemptId,
  });
  const nodeAttemptId =
    request.nodeAttemptId === undefined
      ? undefined
      : requireText(request.nodeAttemptId, 'nodeAttemptId');
  const repairAuthorityReceipt =
    request.repairAuthorityReceipt === undefined
      ? undefined
      : request.repairAuthorityReceipt;
  const repairAuthority = verifyCommittedRepairAuthorityReceipt({
    receiptRoot,
    activationReceipt: activation,
    partitionManifest: manifest,
    repairAuthorityReceipt,
    expectedRepairAttemptId:
      repairAuthorityReceipt === undefined ? undefined : attemptId,
  });
  const repairMode = repairAuthorityReceipt !== undefined;
  const repairedPartitions = new Set(
    Array.isArray(repairAuthority?.invalidatedPartitionIds)
      ? repairAuthority.invalidatedPartitionIds
      : []
  );
  const preservedPartitions = new Set(
    Array.isArray(repairAuthority?.preservedPartitionIds)
      ? repairAuthority.preservedPartitionIds
      : []
  );
  if (repairMode && preservedPartitions.has(partitionIdValue)) {
    throw failure('campaign_repair_partition_preserved');
  }
  if (repairMode && !repairedPartitions.has(partitionIdValue)) {
    throw failure('campaign_repair_authority_required', {
      partitionId: partitionIdValue,
    });
  }
  if (!repairMode && repairAuthority && repairedPartitions.has(partitionIdValue)) {
    throw failure('campaign_repair_authority_required', {
      partitionId: partitionIdValue,
    });
  }
  if (!repairMode && attemptId !== activation.attemptId) {
    throw failure('subcontract_execution_attempt_mismatch');
  }
  const closureScopeMode = deriveClosureScopeMode(partition);
  const dependencies = partition.dependencyPartitionIds || [];
  for (const dependencyId of dependencies) {
    const dependencyIndex =
      manifest.topologicalOrder.indexOf(dependencyId);
    if (dependencyIndex < 0 || dependencyIndex >= index) {
      throw failure('subcontract_future_dependency', {
        partitionId: partitionIdValue,
        dependencyId,
      });
    }
  }
  const closures = request.predecessorClosureReceipts;
  if (!Array.isArray(closures)) {
    throw failure('subcontract_predecessor_closure_missing');
  }
  const byPartition = new Map(
    closures
      .filter(isRecord)
      .map((receipt) => [receipt.partitionId, receipt])
  );
  if (closures.length !== dependencies.length) {
    throw failure(
      closures.length < dependencies.length
        ? 'subcontract_predecessor_closure_missing'
        : 'subcontract_predecessor_closure_unexpected'
    );
  }
  const predecessorClosureBindings: SchemaRecord[] = [];
  const predecessorClosureReceiptHashes = dependencies.map(
    (dependencyId) => {
      const closure = byPartition.get(dependencyId);
      const dependency =
        manifest.partitions[
          manifest.topologicalOrder.indexOf(dependencyId)
        ];
      if (!closure) {
        throw failure('subcontract_predecessor_closure_missing', {
          dependencyId,
        });
      }
      let expectedClosureAttemptId = attemptId;
      let predecessorOrigin = 'repaired';
      if (repairMode) {
        if (preservedPartitions.has(dependencyId)) {
          expectedClosureAttemptId = repairAuthority.baseAttemptId;
          predecessorOrigin = 'preserved_base';
        } else if (!repairedPartitions.has(dependencyId)) {
          throw failure('campaign_repair_authority_required', {
            partitionId: dependencyId,
          });
        }
      }
      if (
        !hasValidPredecessorClosureSelfHash(closure) ||
        closure.decision !== 'pass' ||
        closure.attemptId !== expectedClosureAttemptId ||
        closure.partitionManifestHash !== manifest.partitionManifestHash ||
        closure.childContractHash !== dependency.childContractHash
      ) {
        throw failure('subcontract_predecessor_closure_stale', {
          dependencyId,
        });
      }
      const committedClosure = repairMode
        ? verifyCommittedRepairPredecessor({
            receiptRoot,
            activation,
            manifest,
            repairAuthority,
            dependency,
            dependencyIndex:
              manifest.topologicalOrder.indexOf(dependencyId),
            predecessorOrigin,
            closureCandidate: closure,
          })
        : closure;
      verifyLifecyclePredecessorOrigin({
        record: committedClosure,
        partitionManifest: manifest,
        campaignId: activation.campaignId,
        campaignAttemptId: activation.attemptId,
        baseAttemptId: repairAuthority?.baseAttemptId,
        repairAttemptId: attemptId,
        predecessorOrigin: repairMode ? predecessorOrigin : 'base',
        partitionId: dependencyId,
        childContractHash: dependency.childContractHash,
        nodeAttemptId: repairMode
          ? committedClosure.nodeAttemptId
          : closure.nodeAttemptId,
      });
      if (repairMode) {
        predecessorClosureBindings.push({
          partitionId: dependencyId,
          origin: predecessorOrigin,
          closureReceiptHash: committedClosure.receiptHash,
        });
      }
      return committedClosure.receiptHash;
    }
  );
  const issuedAt = requireText(request.issuedAt, 'issuedAt');
  const payload = {
    schemaVersion: repairMode
      ? 'goal-contract-subcontract-execution-lease/v2'
      : 'goal-contract-subcontract-execution-lease/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId,
    ...(repairMode
      ? {
          baseAttemptId: repairAuthority.baseAttemptId,
          repairAttemptId: repairAuthority.repairAttemptId,
          repairAuthorityReceiptHash: repairAuthority.receiptHash,
        }
      : {}),
    partitionId: partitionIdValue,
    partitionManifestHash: manifest.partitionManifestHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    partitionPlanHash: manifest.partitionPlanHash,
    childContractHash: partition.childContractHash,
    ...lifecycleAuthorityFieldsFromManifest(manifest),
    ...(nodeAttemptId === undefined ? {} : { nodeAttemptId }),
    selectionHash: partition.selectionSetHash,
    closureScopeMode,
    predecessorClosureReceiptHashes,
    ...(repairMode ? { predecessorClosureBindings } : {}),
    leaseOrdinal: index + 1,
    authorizationCount: 1,
    modelInvocationCount: 0,
    issuedAt,
    decision: 'pass',
  };
  const receipt = {
    ...payload,
    receiptHash: hashReceiptPayload(payload),
  };
  validateGoalContractSchema(LEASE_SCHEMA, receipt);
  let committed;
  try {
    committed = commitCreateOnceReceipt({
      receiptRoot,
      relativePath:
        (repairMode
          ? `campaigns/${activation.campaignId}/repair/leases/`
          : `campaigns/${activation.campaignId}/leases/`) +
        `${String(index + 1).padStart(4, '0')}-${partitionIdValue}.receipt.json`,
      schemaName: LEASE_SCHEMA,
      receipt,
      recovery: request.recovery === true,
    });
  } catch (error) {
    if (
      (error as { failureClass?: string }).failureClass ===
      'control_plane_duplicate_receipt'
    ) {
      throw failure('subcontract_execution_lease_duplicate');
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
  activateGoalCampaign,
  activateGoalCampaignFromSuccessorAuthority,
  issueSubcontractExecutionLease,
  verifyActivationReceipt,
};
