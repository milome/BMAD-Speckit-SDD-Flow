const assert = require('node:assert');
const { describe, it } = require('node:test');

const {
  hashControlPlaneValue,
  hashReceiptPayload,
  verifyReceiptSelfHash,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  compileGoalCampaignRepairAuthority,
  verifyGoalCampaignRepairAuthority,
} = require('../src/utils/goal-contract/control-plane/campaign-repair-authority.ts');

const hash = (value) => hashControlPlaneValue({ value });
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function signed(payload) {
  return { ...payload, receiptHash: hashReceiptPayload(payload) };
}

function activationFixture({
  attemptId,
  partitionManifestHash,
  partitionPlanHash,
  partitionSetHash,
}) {
  const campaignActivationHash = hash(`activation:${attemptId}`);
  const sourceCompositionPolicyHash = hash('composition-policy');
  const sourceAuthorityBundleHash = hash('source-authority');
  const goalContractHash = hash('goal-contract');
  const executionAuthorization = {
    authorizerIdentity: 'user:repair-authority-test',
    authorizationKind: 'user_explicit',
    authorizedSourceCompositionPolicyHash:
      sourceCompositionPolicyHash,
    authorizedGoalContractHash: goalContractHash,
    authorizedPartitionManifestHash: partitionManifestHash,
    authorizedPartitionSetHash: partitionSetHash,
    authorizationSourceHash: hash('authorization-source'),
    authorizationStatementHash: hash('authorization-statement'),
  };
  return signed({
    schemaVersion: 'goal-contract-campaign-activation-receipt/v1',
    campaignId: `goal-campaign-${campaignActivationHash.slice(7)}`,
    campaignActivationHash,
    attemptId,
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: hash('snapshot-set'),
    sourceAuthorityBundleHash,
    authorityAttestationHash: hash('attestation'),
    goalContractHash,
    partitionPlanHash,
    partitionManifestHash,
    partitionSetHash,
    partitionPolicyHash: hash('partition-policy'),
    compilerIdentityHash: hash('compiler'),
    subordinateCoverageReceiptHashes: [],
    childReleaseReceiptHashes: [
      hash('release-owner'),
      hash('release-repair'),
      hash('release-dependent'),
    ],
    executionAuthorization,
    executionAuthorizationHash:
      hashControlPlaneValue(executionAuthorization),
    authorizationCount: 1,
    modelInvocationCount: 0,
    activatedAt: '2026-07-31T01:00:00.000Z',
    decision: 'pass',
  });
}

function closureFixture({
  activation,
  partition,
  leaseReceiptHash,
  predecessorClosureReceiptHashes = [],
}) {
  const payload = {
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    leaseReceiptHash,
    attemptId: activation.attemptId,
    partitionId: partition.partitionId,
    partitionManifestHash: activation.partitionManifestHash,
    partitionPlanHash: activation.partitionPlanHash,
    partitionSetHash: activation.partitionSetHash,
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: activation.sourceAuthorityBundleHash,
    childContractHash: partition.childContractHash,
    closureScopeMode: 'governed_files',
    subordinateCoverageReceiptHashes: [],
    orderedVerificationEvidenceHashes: [hash('verification')],
    governedFileManifestHash: hash('governed-files'),
    dependencyClosureHash: hash('dependencies'),
    productionReachabilityReceiptHash: hash('reachability'),
    integrationVerificationReceiptHash: hash('integration'),
    subcontractEvidenceHash: hash('evidence'),
    childClosureHash: hash('child-closure'),
    predecessorClosureReceiptHashes,
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    closedAt: '2026-07-31T01:10:00.000Z',
    decision: 'pass',
  };
  return signed(payload);
}

function leaseFixture({ activation, partition, leaseOrdinal }) {
  return signed({
    schemaVersion: 'goal-contract-subcontract-execution-lease/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId: activation.attemptId,
    partitionId: partition.partitionId,
    partitionManifestHash: activation.partitionManifestHash,
    partitionSetHash: activation.partitionSetHash,
    sourceCompositionPolicyHash:
      activation.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: activation.sourceAuthorityBundleHash,
    partitionPlanHash: activation.partitionPlanHash,
    childContractHash: partition.childContractHash,
    selectionHash: partition.selectionSetHash,
    closureScopeMode: 'governed_files',
    predecessorClosureReceiptHashes: [],
    leaseOrdinal,
    authorizationCount: 1,
    modelInvocationCount: 0,
    issuedAt: '2026-07-31T01:20:00.000Z',
    decision: 'pass',
  });
}

function fixture() {
  const ownerId = partitionId('owner');
  const repairId = partitionId('repair');
  const dependentId = partitionId('dependent');
  const partitionManifestHash = hash('manifest');
  const partitionPlanHash = hash('plan');
  const partitionSetHash = hash('set');
  const partitions = [
    {
      partitionId: ownerId,
      childContractHash: hash('owner-child'),
      selectionSetHash: hash('owner-selection'),
      governedPaths: ['src/owner.ts'],
      dependencyPartitionIds: [],
    },
    {
      partitionId: repairId,
      childContractHash: hash('repair-child'),
      selectionSetHash: hash('repair-selection'),
      governedPaths: ['src/repair.ts'],
      primaryTaskIds: ['TASK-REPAIR'],
      specSpanRefs: ['spec-span-repair'],
      dependencyPartitionIds: [ownerId],
    },
    {
      partitionId: dependentId,
      childContractHash: hash('dependent-child'),
      selectionSetHash: hash('dependent-selection'),
      governedPaths: ['src/dependent.ts'],
      dependencyPartitionIds: [repairId],
    },
  ];
  const manifest = {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    partitionManifestHash,
    partitionPlanHash,
    partitionSetHash,
    sourceCompositionPolicyHash: hash('composition-policy'),
    sourceAuthorityBundleHash: hash('source-authority'),
    topologicalOrder: partitions.map(({ partitionId: id }) => id),
    partitions,
  };
  const activation = activationFixture({
    attemptId: 'attempt-base',
    partitionManifestHash,
    partitionPlanHash,
    partitionSetHash,
  });
  const ownerLease = leaseFixture({
    activation,
    partition: partitions[0],
    leaseOrdinal: 1,
  });
  const ownerClosure = closureFixture({
    activation,
    partition: partitions[0],
    leaseReceiptHash: ownerLease.receiptHash,
  });
  const invalidatedLease = leaseFixture({
    activation,
    partition: partitions[1],
    leaseOrdinal: 2,
  });
  const invalidatedClosure = closureFixture({
    activation,
    partition: partitions[1],
    leaseReceiptHash: invalidatedLease.receiptHash,
    predecessorClosureReceiptHashes: [ownerClosure.receiptHash],
  });
  return {
    activation,
    manifest,
    ownerLease,
    ownerClosure,
    invalidatedLease,
    invalidatedClosure,
    ownerId,
    repairId,
    dependentId,
  };
}

function compileRequest(overrides = {}) {
  const current = fixture();
  return {
    ...current,
    request: {
      baseActivationReceipt: current.activation,
      partitionManifest: current.manifest,
      baselineAuthority: {
        sourceCompositionMode: 'single_source',
        sourceCompositionPolicyHash:
          current.activation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.activation.sourceAuthorityBundleHash,
      },
      currentAuthority: {
        sourceCompositionMode: 'single_source',
        sourceCompositionPolicyHash:
          current.activation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.activation.sourceAuthorityBundleHash,
      },
      partitionManifestDocumentHash: hash('manifest-document'),
      changedPaths: ['src/repair.ts'],
      governedPathAdditions: [
        {
          partitionId: current.repairId,
          paths: ['src/new-schema.json'],
          reasonCode: 'missing_governed_path',
          taskIds: ['TASK-REPAIR'],
          specSpanRefs: ['spec-span-repair'],
          baselineExists: true,
          baselineArtifactHash: hash('new-schema-baseline'),
        },
      ],
      preservedClosureReceipts: [current.ownerClosure],
      baseLeaseReceipts: [
        current.ownerLease,
        current.invalidatedLease,
      ],
      invalidatedLeaseReceipts: [current.invalidatedLease],
      invalidatedClosureReceipts: [current.invalidatedClosure],
      repairAttemptId: 'attempt-repair-001',
      repairAuthorization: {
        authorizerIdentity: 'user:repair-authority-test',
        authorizationKind: 'user_explicit',
        authorizationSourceHash: hash('repair-authorization-source'),
        authorizationStatementHash: hash('repair-authorization-statement'),
      },
      createdAt: '2026-07-31T02:00:00.000Z',
      ...overrides,
    },
  };
}

describe('goal campaign repair authority', () => {
  it('derives the selective invalidation closure and binds carried-forward receipts', () => {
    const {
      request,
      activation,
      manifest,
      ownerId,
      repairId,
      dependentId,
      ownerClosure,
      invalidatedLease,
      invalidatedClosure,
    } = compileRequest();

    const receipt = compileGoalCampaignRepairAuthority(request);

    assert.deepStrictEqual(receipt.preservedPartitionIds, [ownerId]);
    assert.deepStrictEqual(receipt.invalidatedPartitionIds, [
      repairId,
      dependentId,
    ]);
    assert.deepStrictEqual(receipt.preservedClosureBindings, [
      {
        ordinal: 1,
        partitionId: ownerId,
        closureReceiptHash: ownerClosure.receiptHash,
      },
    ]);
    assert.deepStrictEqual(receipt.invalidatedLeaseBindings, [
      {
        ordinal: 2,
        partitionId: repairId,
        leaseReceiptHash: invalidatedLease.receiptHash,
      },
    ]);
    assert.deepStrictEqual(receipt.invalidatedClosureBindings, [
      {
        ordinal: 2,
        partitionId: repairId,
        closureReceiptHash: invalidatedClosure.receiptHash,
        subcontractEvidenceHash:
          invalidatedClosure.subcontractEvidenceHash,
      },
    ]);
    assert.deepStrictEqual(receipt.baseChildReleaseBindings, [
      {
        ordinal: 1,
        partitionId: ownerId,
        childReleaseReceiptHash:
          activation.childReleaseReceiptHashes[0],
      },
      {
        ordinal: 2,
        partitionId: repairId,
        childReleaseReceiptHash:
          activation.childReleaseReceiptHashes[1],
      },
      {
        ordinal: 3,
        partitionId: dependentId,
        childReleaseReceiptHash:
          activation.childReleaseReceiptHashes[2],
      },
    ]);
    assert.deepStrictEqual(
      [
        ...receipt.preservedPartitionIds,
        ...receipt.invalidatedPartitionIds,
      ].sort(),
      manifest.topologicalOrder.toSorted()
    );
    assert.strictEqual(
      receipt.basePartitionManifestDocumentHash,
      hash('manifest-document')
    );
    assert.strictEqual(
      receipt.repairAuthorizationHash,
      hashControlPlaneValue(request.repairAuthorization)
    );
    assert.notStrictEqual(
      receipt.repairAuthorizationHash,
      receipt.receiptHash
    );
    assert.strictEqual(
      Object.hasOwn(receipt, 'authorizationStatementHash'),
      false
    );
    assert.strictEqual(verifyReceiptSelfHash(receipt), true);
    assert.deepStrictEqual(receipt.governedPathAdditions, [
      {
        partitionId: repairId,
        paths: ['src/new-schema.json'],
        reasonCode: 'missing_governed_path',
        taskIds: ['TASK-REPAIR'],
        specSpanRefs: ['spec-span-repair'],
        baselineExists: true,
        baselineArtifactHash: hash('new-schema-baseline'),
      },
    ]);
    assert.deepStrictEqual(
      verifyGoalCampaignRepairAuthority(receipt, {
        baseActivationReceipt: activation,
        partitionManifest: manifest,
        partitionManifestDocumentHash: hash('manifest-document'),
        expectedRepairAttemptId: 'attempt-repair-001',
      }),
      receipt
    );
  });

  it('rejects tamper and cross-manifest replay', () => {
    const { request, activation, manifest } = compileRequest();
    const receipt = compileGoalCampaignRepairAuthority(request);
    const tampered = structuredClone(receipt);
    tampered.governedPathAdditions[0].paths[0] =
      'src/tampered-schema.json';

    assert.throws(
      () =>
        verifyGoalCampaignRepairAuthority(tampered, {
          baseActivationReceipt: activation,
          partitionManifest: manifest,
          partitionManifestDocumentHash: hash('manifest-document'),
          expectedRepairAttemptId: 'attempt-repair-001',
        }),
      { failureClass: 'campaign_repair_authority_hash_invalid' }
    );
    assert.throws(
      () =>
        verifyGoalCampaignRepairAuthority(receipt, {
          baseActivationReceipt: activation,
          partitionManifest: {
            ...manifest,
            partitionManifestHash: hash('other-manifest'),
          },
          partitionManifestDocumentHash: hash('manifest-document'),
          expectedRepairAttemptId: 'attempt-repair-001',
        }),
      { failureClass: 'campaign_repair_authority_base_stale' }
    );

    const forgedAuthorization = structuredClone(receipt);
    forgedAuthorization.repairAuthorization.authorizationSourceHash =
      hash('forged-repair-authorization-source');
    forgedAuthorization.receiptHash =
      hashReceiptPayload(forgedAuthorization);
    assert.throws(
      () =>
        verifyGoalCampaignRepairAuthority(forgedAuthorization, {
          baseActivationReceipt: activation,
          partitionManifest: manifest,
          partitionManifestDocumentHash: hash('manifest-document'),
          expectedRepairAttemptId: 'attempt-repair-001',
        }),
      { failureClass: 'campaign_repair_authorization_invalid' }
    );

    const forgedLeaseBinding = compileRequest();
    const forgedClosure = structuredClone(
      forgedLeaseBinding.ownerClosure
    );
    forgedClosure.leaseReceiptHash = hash('forged-owner-lease');
    forgedClosure.receiptHash = hashReceiptPayload(forgedClosure);
    forgedLeaseBinding.request.preservedClosureReceipts = [
      forgedClosure,
    ];
    assert.throws(
      () =>
        compileGoalCampaignRepairAuthority(
          forgedLeaseBinding.request
        ),
      { failureClass: 'campaign_repair_authority_binding_invalid' }
    );

    const mismatchedInvalidatedLease = compileRequest();
    const {
      receiptHash: _ignoredInvalidatedLeaseHash,
      ...invalidatedLeasePayload
    } = mismatchedInvalidatedLease.invalidatedLease;
    mismatchedInvalidatedLease.request.invalidatedLeaseReceipts = [
      signed({
        ...invalidatedLeasePayload,
        issuedAt: '2026-07-31T01:21:00.000Z',
      }),
    ];
    assert.throws(
      () =>
        compileGoalCampaignRepairAuthority(
          mismatchedInvalidatedLease.request
        ),
      { failureClass: 'campaign_repair_authority_binding_invalid' }
    );
  });

  it('rejects stale attempts and scope additions outside invalidated ownership', () => {
    const stale = compileRequest({ repairAttemptId: 'attempt-base' });
    assert.throws(
      () => compileGoalCampaignRepairAuthority(stale.request),
      { failureClass: 'campaign_repair_attempt_replay' }
    );

    const preserved = compileRequest();
    preserved.request.governedPathAdditions = [
      {
        partitionId: preserved.ownerId,
        paths: ['src/new-owner.ts'],
        reasonCode: 'missing_governed_path',
        taskIds: ['TASK-OWNER'],
        specSpanRefs: ['spec-span-owner'],
        baselineExists: false,
        baselineArtifactHash: null,
      },
    ];
    assert.throws(
      () => compileGoalCampaignRepairAuthority(preserved.request),
      { failureClass: 'campaign_repair_scope_addition_invalid' }
    );

    const conflicting = compileRequest();
    conflicting.request.governedPathAdditions = [
      {
        partitionId: conflicting.repairId,
        paths: ['src/owner.ts'],
        reasonCode: 'missing_governed_path',
        taskIds: ['TASK-REPAIR'],
        specSpanRefs: ['spec-span-repair'],
        baselineExists: true,
        baselineArtifactHash: hash('owner-baseline'),
      },
    ];
    assert.throws(
      () => compileGoalCampaignRepairAuthority(conflicting.request),
      { failureClass: 'campaign_repair_scope_addition_conflict' }
    );

    const missingPreserved = compileRequest();
    missingPreserved.request.preservedClosureReceipts = [];
    assert.throws(
      () =>
        compileGoalCampaignRepairAuthority(missingPreserved.request),
      { failureClass: 'campaign_repair_authority_binding_invalid' }
    );

    const unrelatedTask = compileRequest();
    unrelatedTask.request.governedPathAdditions[0].taskIds = [
      'TASK-OTHER',
    ];
    assert.throws(
      () => compileGoalCampaignRepairAuthority(unrelatedTask.request),
      { failureClass: 'campaign_repair_scope_addition_invalid' }
    );

    const inconsistentBaseline = compileRequest();
    inconsistentBaseline.request.governedPathAdditions[0].baselineExists =
      false;
    assert.throws(
      () =>
        compileGoalCampaignRepairAuthority(
          inconsistentBaseline.request
        ),
      { failureClass: 'campaign_repair_scope_addition_invalid' }
    );
  });
});
