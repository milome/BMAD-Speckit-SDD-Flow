const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  issueSubcontractExecutionLease,
} = require('../src/utils/goal-contract/control-plane/campaign-activation.ts');
const {
  commitGoalCampaignRepairAuthority,
} = require('../src/utils/goal-contract/control-plane/campaign-repair-authority.ts');
const {
  commitCreateOnceReceipt,
} = require('../src/utils/goal-contract/control-plane/campaign-receipt-store.ts');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const ACTIVATION_SCHEMA =
  'goal-contract-campaign-activation-receipt.schema.json';
const CLOSURE_SCHEMA =
  'goal-contract-subcontract-closure-receipt.schema.json';
const LEASE_SCHEMA =
  'goal-contract-subcontract-execution-lease.schema.json';
const hash = (value) => hashControlPlaneValue({ value });
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function signed(payload) {
  return { ...payload, receiptHash: hashReceiptPayload(payload) };
}

function releaseReceipt(manifest, partition) {
  return {
    schemaVersion: 'goal-contract-partition-release-gate-receipt/v1',
    partitionId: partition.partitionId,
    partitionManifestAuthorityHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    goalContractHash: partition.childContractHash,
    childContractHash: partition.childContractHash,
    selectionSetHash: partition.selectionSetHash,
    childCompilationReceiptHash:
      partition.childCompilationReceiptHash,
    decision: 'pass',
    blockingReasons: [],
  };
}

function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-campaign-repair-lifecycle-')
  );
  const receiptRoot = path.join(root, 'receipts');
  const authorityRoot = path.join(root, 'authority');
  const ownerId = partitionId('owner');
  const repairId = partitionId('repair');
  const sourceCompositionPolicyHash = hash('composition-policy');
  const sourceAuthorityBundleHash = hash('source-authority');
  const goalContractHash = hash('goal-contract');
  const partitionPlanHash = hash('partition-plan');
  const partitionSetHash = hash('partition-set');
  const partitionPolicyHash = hash('partition-policy');
  const partitions = [
    {
      partitionId: ownerId,
      childContractHash: hash('owner-child'),
      selectionSetHash: hash('owner-selection'),
      childCompilationReceiptHash: hash('owner-compilation'),
      governedPaths: ['src/owner.ts'],
      dependencyPartitionIds: [],
    },
    {
      partitionId: repairId,
      childContractHash: hash('repair-child'),
      selectionSetHash: hash('repair-selection'),
      childCompilationReceiptHash: hash('repair-compilation'),
      governedPaths: ['src/repair.ts'],
      primaryTaskIds: ['TASK-REPAIR'],
      specSpanRefs: ['spec-span-repair'],
      dependencyPartitionIds: [ownerId],
    },
  ];
  const orderedChildContractHashes = partitions.map(
    ({ childContractHash }) => childContractHash
  );
  const partitionManifestHash = hashControlPlaneValue({
    goalContractHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    partitionPolicyHash,
    partitionPlanHash,
    partitionSetHash,
    orderedChildContractHashes,
  });
  const manifest = {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    manifestAuthorityMode: 'final_child_membership',
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: hash('snapshot-set'),
    sourceAuthorityBundleHash,
    intentAuthorityAttestationHash: hash('attestation'),
    goalContractHash,
    compilerIdentityHash: hash('compiler'),
    partitionPolicyHash,
    partitionPlanHash,
    partitionManifestHash,
    partitionSetHash,
    partitionCount: partitions.length,
    topologicalOrder: partitions.map(({ partitionId: id }) => id),
    orderedChildContractHashes,
    subordinateCoverageReceiptHashes: [],
    coverage: {
      uncoveredObligationIds: [],
      duplicateObligationIds: [],
      unmappedObligationIds: [],
      scopeEscapeObligationIds: [],
    },
    partitions,
  };
  fs.mkdirSync(authorityRoot, { recursive: true });
  fs.writeFileSync(
    path.join(authorityRoot, 'partition-manifest.json'),
    `${JSON.stringify(manifest)}\n`,
    'utf8'
  );
  const baseAttemptId = 'attempt-base';
  const baseCampaignActivationHash = hash('base-activation');
  const baseExecutionAuthorization = {
    authorizerIdentity: 'user:repair-lifecycle-base',
    authorizationKind: 'user_explicit',
    authorizedSourceCompositionPolicyHash:
      sourceCompositionPolicyHash,
    authorizedGoalContractHash: goalContractHash,
    authorizedPartitionManifestHash: partitionManifestHash,
    authorizedPartitionSetHash: partitionSetHash,
    authorizationSourceHash: hash('base-authorization-source'),
    authorizationStatementHash: hash('base-authorization-statement'),
  };
  const baseActivation = signed({
    schemaVersion: 'goal-contract-campaign-activation-receipt/v1',
    campaignId:
      `goal-campaign-${baseCampaignActivationHash.slice(7)}`,
    campaignActivationHash: baseCampaignActivationHash,
    attemptId: baseAttemptId,
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      manifest.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash,
    authorityAttestationHash:
      manifest.intentAuthorityAttestationHash,
    goalContractHash,
    partitionPlanHash,
    partitionManifestHash,
    partitionSetHash,
    partitionPolicyHash,
    compilerIdentityHash: manifest.compilerIdentityHash,
    subordinateCoverageReceiptHashes: [],
    childReleaseReceiptHashes: partitions.map((partition) =>
      hashControlPlaneValue(releaseReceipt(manifest, partition))
    ),
    executionAuthorization: baseExecutionAuthorization,
    executionAuthorizationHash:
      hashControlPlaneValue(baseExecutionAuthorization),
    authorizationCount: 1,
    modelInvocationCount: 0,
    activatedAt: '2026-07-31T03:00:00.000Z',
    decision: 'pass',
  });
  commitCreateOnceReceipt({
    receiptRoot,
    relativePath:
      `campaigns/${baseActivation.campaignId}/activation.receipt.json`,
    schemaName: ACTIVATION_SCHEMA,
    receipt: baseActivation,
  });
  const ownerClosure = signed({
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    campaignId: baseActivation.campaignId,
    campaignActivationHash:
      baseActivation.campaignActivationHash,
    activationReceiptHash: baseActivation.receiptHash,
    leaseReceiptHash: hash('owner-lease'),
    attemptId: baseAttemptId,
    partitionId: ownerId,
    partitionManifestHash,
    partitionPlanHash,
    partitionSetHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    childContractHash: partitions[0].childContractHash,
    closureScopeMode: 'governed_files',
    subordinateCoverageReceiptHashes: [],
    orderedVerificationEvidenceHashes: [hash('owner-evidence')],
    governedFileManifestHash: hash('owner-governed-files'),
    dependencyClosureHash: hash('owner-dependencies'),
    productionReachabilityReceiptHash: hash('owner-reachability'),
    integrationVerificationReceiptHash: hash('owner-integration'),
    subcontractEvidenceHash: hash('owner-subcontract-evidence'),
    childClosureHash: hash('owner-child-closure'),
    predecessorClosureReceiptHashes: [],
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    closedAt: '2026-07-31T03:10:00.000Z',
    decision: 'pass',
  });
  commitCreateOnceReceipt({
    receiptRoot,
    relativePath:
      `campaigns/${baseActivation.campaignId}/closures/` +
      `0001-${ownerId}.receipt.json`,
    schemaName: CLOSURE_SCHEMA,
    receipt: ownerClosure,
  });
  const invalidatedLease = signed({
    schemaVersion: 'goal-contract-subcontract-execution-lease/v1',
    campaignId: baseActivation.campaignId,
    campaignActivationHash:
      baseActivation.campaignActivationHash,
    activationReceiptHash: baseActivation.receiptHash,
    attemptId: baseAttemptId,
    partitionId: repairId,
    partitionManifestHash,
    partitionSetHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    partitionPlanHash,
    childContractHash: partitions[1].childContractHash,
    selectionHash: partitions[1].selectionSetHash,
    closureScopeMode: 'governed_files',
    predecessorClosureReceiptHashes: [ownerClosure.receiptHash],
    leaseOrdinal: 2,
    authorizationCount: 1,
    modelInvocationCount: 0,
    issuedAt: '2026-07-31T03:20:00.000Z',
    decision: 'pass',
  });
  commitCreateOnceReceipt({
    receiptRoot,
    relativePath:
      `campaigns/${baseActivation.campaignId}/leases/` +
      `0002-${repairId}.receipt.json`,
    schemaName: LEASE_SCHEMA,
    receipt: invalidatedLease,
  });
  return {
    root,
    authorityRoot,
    receiptRoot,
    manifest,
    partitions,
    ownerId,
    repairId,
    baseActivation,
    ownerClosure,
    invalidatedLease,
    childReleaseGateReceipts: partitions.map((partition) =>
      releaseReceipt(manifest, partition)
    ),
  };
}

describe('goal campaign repair lifecycle', () => {
  it('commits a repair overlay and leases only invalidated work', () => {
    const current = fixture();
    const repairAttemptId = 'attempt-repair-001';
    const repairRequest = {
      receiptRoot: current.receiptRoot,
      authorityRoot: current.authorityRoot,
      campaignId: current.baseActivation.campaignId,
      baselineAuthority: {
        sourceCompositionMode: 'single_source',
        sourceCompositionPolicyHash:
          current.baseActivation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.baseActivation.sourceAuthorityBundleHash,
      },
      currentAuthority: {
        sourceCompositionMode: 'single_source',
        sourceCompositionPolicyHash:
          current.baseActivation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.baseActivation.sourceAuthorityBundleHash,
      },
      changedPaths: ['src/repair.ts'],
      governedPathAdditions: [
        {
          partitionId: current.repairId,
          paths: ['src/new-schema.json'],
          reasonCode: 'missing_governed_path',
          taskIds: ['TASK-REPAIR'],
          specSpanRefs: ['spec-span-repair'],
          baselineExists: false,
          baselineArtifactHash: null,
        },
      ],
      repairAttemptId,
      repairAuthorization: {
        authorizerIdentity: 'user:repair-lifecycle',
        authorizationKind: 'user_explicit',
        authorizationSourceHash: hash('repair-authorization-source'),
        authorizationStatementHash: hash('repair-authorization-statement'),
      },
      createdAt: '2026-07-31T04:00:00.000Z',
    };
    const repair = commitGoalCampaignRepairAuthority(repairRequest);
    assert.ok(fs.existsSync(repair.receiptPath));
    assert.deepStrictEqual(
      repair.receipt.preservedClosureBindings,
      [
        {
          ordinal: 1,
          partitionId: current.ownerId,
          closureReceiptHash: current.ownerClosure.receiptHash,
        },
      ]
    );
    assert.deepStrictEqual(
      repair.receipt.invalidatedLeaseBindings,
      [
        {
          ordinal: 2,
          partitionId: current.repairId,
          leaseReceiptHash: current.invalidatedLease.receiptHash,
        },
      ]
    );
    assert.strictEqual(
      repair.receipt.basePartitionManifestDocumentHash,
      `sha256:${require('node:crypto')
        .createHash('sha256')
        .update(
          fs.readFileSync(
            path.join(current.authorityRoot, 'partition-manifest.json')
          )
        )
        .digest('hex')}`
    );
    const recovered = commitGoalCampaignRepairAuthority({
      ...repairRequest,
      recovery: true,
    });
    assert.strictEqual(recovered.recovered, true);
    assert.deepStrictEqual(recovered.receipt, repair.receipt);
    assert.throws(
      () =>
        commitGoalCampaignRepairAuthority({
          ...repairRequest,
          baseActivationReceipt: current.baseActivation,
          recovery: true,
        }),
      { failureClass: 'campaign_repair_authority_injection' }
    );

    const lease = issueSubcontractExecutionLease({
      receiptRoot: current.receiptRoot,
      activationReceipt: current.baseActivation,
      repairAuthorityReceipt: repair.receipt,
      partitionManifest: current.manifest,
      partitionId: current.repairId,
      predecessorClosureReceipts: [current.ownerClosure],
      attemptId: repairAttemptId,
      issuedAt: '2026-07-31T04:20:00.000Z',
    });
    assert.strictEqual(
      lease.receipt.schemaVersion,
      'goal-contract-subcontract-execution-lease/v2'
    );
    assert.strictEqual(lease.receipt.baseAttemptId, 'attempt-base');
    assert.strictEqual(
      lease.receipt.repairAttemptId,
      repairAttemptId
    );
    assert.strictEqual(
      lease.receipt.repairAuthorityReceiptHash,
      repair.receipt.receiptHash
    );
    assert.deepStrictEqual(
      lease.receipt.predecessorClosureBindings,
      [
        {
          partitionId: current.ownerId,
          origin: 'preserved_base',
          closureReceiptHash: current.ownerClosure.receiptHash,
        },
      ]
    );

    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: current.receiptRoot,
          activationReceipt: current.baseActivation,
          partitionManifest: current.manifest,
          partitionId: current.repairId,
          predecessorClosureReceipts: [current.ownerClosure],
          attemptId: current.baseActivation.attemptId,
          issuedAt: '2026-07-31T04:21:00.000Z',
        }),
      { failureClass: 'campaign_repair_authority_required' }
    );
    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: current.receiptRoot,
          activationReceipt: current.baseActivation,
          repairAuthorityReceipt: repair.receipt,
          partitionManifest: current.manifest,
          partitionId: current.ownerId,
          predecessorClosureReceipts: [],
          attemptId: repairAttemptId,
          issuedAt: '2026-07-31T04:22:00.000Z',
        }),
      { failureClass: 'campaign_repair_partition_preserved' }
    );
  });
});
