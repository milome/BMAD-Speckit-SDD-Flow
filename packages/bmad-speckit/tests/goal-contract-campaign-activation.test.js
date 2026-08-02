const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  activateGoalCampaign,
  issueSubcontractExecutionLease,
} = require('../src/utils/goal-contract/control-plane/campaign-activation.ts');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  compileCompositeSourceAuthorityBundle,
} = require('../src/utils/goal-contract/control-plane/composite-source-authority-bundle.ts');
const {
  compileIntentAuthorityEnvelope,
} = require('../src/utils/goal-contract/control-plane/intent-authority.ts');
const {
  compileSourceCompositionPolicy,
} = require('../src/utils/goal-contract/control-plane/source-composition-policy.ts');
const {
  compileOrderedSourceSnapshotSet,
} = require('../src/utils/goal-contract/control-plane/source-snapshot.ts');
const {
  authorityRecord,
  readFixtureMetadata,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');

const hash = (value) => hashControlPlaneValue({ value });
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function sourceText(title, ids) {
  return [
    `# ${title}`,
    '',
    ...ids.map((id) => `- ${id}: MUST remain frozen.`),
    '',
  ].join('\n');
}

function executionAuthorization(fixture) {
  return {
    authorizerIdentity: 'user:campaign-activation-test',
    authorizationKind: 'user_explicit',
    authorizedSourceCompositionPolicyHash:
      fixture.sourceCompositionPolicy.sourceCompositionPolicyHash,
    authorizedGoalContractHash: fixture.goalContractBundle.goalContractHash,
    authorizedPartitionManifestHash:
      fixture.partitionManifest.partitionManifestHash,
    authorizedPartitionSetHash:
      fixture.partitionManifest.partitionSetHash,
    authorizationSourceHash: hash('authorization-source'),
    authorizationStatementHash: hash('authorization-statement'),
  };
}

function releaseReceipt(fixture, partition) {
  return {
    schemaVersion: 'goal-contract-partition-release-gate-receipt/v1',
    partitionId: partition.partitionId,
    masterSourceHash: fixture.partitionManifest.masterSourceHash,
    sourceSnapshotHash: fixture.partitionManifest.sourceSnapshotHash,
    sourceCompositionPolicyHash:
      fixture.partitionManifest.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      fixture.partitionManifest.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      fixture.partitionManifest.sourceAuthorityBundleHash,
    methodologyProfileHash: hash('methodology'),
    methodologyProfileArtifactHash: hash('methodology-artifact'),
    executionProjectionHash:
      fixture.partitionManifest.executionProjectionHash,
    partitionAnalysisReceiptHash:
      fixture.partitionManifest.partitionAnalysisReceiptHash,
    partitionManifestHash: hash('partition-manifest-document'),
    partitionManifestAuthorityHash:
      fixture.partitionManifest.partitionManifestHash,
    partitionPlanHash: fixture.partitionManifest.partitionPlanHash,
    partitionSetHash: fixture.partitionManifest.partitionSetHash,
    globalCoverageReceiptHash: hash('global-coverage'),
    selectionReceiptHash: hash(
      `selection-receipt:${partition.partitionId}`
    ),
    selectionSetHash: partition.selectionSetHash,
    childCoverageReceiptHash: hash(`child-coverage:${partition.partitionId}`),
    childGenerationReceiptHash: hash(
      `generation-receipt:${partition.partitionId}`
    ),
    childCompilationReceiptHash:
      partition.childCompilationReceiptHash,
    childContractHash: partition.childContractHash,
    goalContractHash: partition.childContractHash,
    sequenceMode: 'disabled',
    sequenceApplicability: 'not_applicable_with_proof',
    sequenceCoverage: 'excluded',
    sequenceClosureStatus: 'not_requested',
    childContractAuthority: 'core_only',
    predecessorCompletionReceiptHashes: [],
    compatibilityReceiptHashes: [],
    componentDecisions: {
      source: 'pass',
      manifest: 'pass',
      globalCoverage: 'pass',
      childGeneration: 'pass',
    },
    completedAt: '2026-07-29T00:00:00.000Z',
    decision: 'pass',
    blockingReasons: [],
  };
}

function campaignFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-campaign-'));
  const metadata = readFixtureMetadata();
  const binding = subordinateBinding();
  const primaryPath = path.join(root, 'primary.md');
  const subordinatePath = path.join(root, 'component.md');
  const primaryIds = ['PRIMARY-REQ', binding.parentTaskRefs[0]];
  const subordinateIds = [
    ...binding.requiredRequirementIds,
    ...binding.requiredTaskIds,
  ];
  fs.writeFileSync(
    primaryPath,
    sourceText(metadata.primaryNamespace, primaryIds),
    'utf8'
  );
  fs.writeFileSync(
    subordinatePath,
    sourceText(binding.namespace, subordinateIds),
    'utf8'
  );

  const sourceCompositionPolicy = compileSourceCompositionPolicy({
    authorityRecord: authorityRecord(
      'composite_required',
      [binding],
      hashControlPlaneValue
    ),
  });
  const orderedSourceSnapshotSet = compileOrderedSourceSnapshotSet({
    sources: [
      {
        sourceKind: 'source_plan',
        sourceArtifactId: metadata.primarySourceArtifactId,
        sourceRole: 'primary_implementation_authority',
        namespace: metadata.primaryNamespace,
        sourceOrder: 0,
        pathOrSegmentId: primaryPath,
        rawBytes: fs.readFileSync(primaryPath),
      },
      {
        sourceKind: 'source_plan',
        sourceArtifactId: binding.sourceArtifactId,
        sourceRole: binding.role,
        namespace: binding.namespace,
        sourceOrder: 1,
        pathOrSegmentId: subordinatePath,
        rawBytes: fs.readFileSync(subordinatePath),
      },
    ],
  });
  const compositeSourceAuthorityBundle =
    compileCompositeSourceAuthorityBundle({
      sourceCompositionPolicy,
      orderedSourceSnapshotSet,
      primarySource: {
        role: 'primary_implementation_authority',
        namespace: metadata.primaryNamespace,
        sourceArtifactId: metadata.primarySourceArtifactId,
        ownedSemanticDomains: ['Campaign authority'],
        parentTaskRefs: [],
      },
      subordinateSources: [
        {
          ...binding,
          ownedSemanticDomains: ['Component authority'],
        },
      ],
    });
  const canonicalIntentSemanticHash = hash('canonical-intent');
  const canonicalIntentBundleHash = hash('canonical-bundle');
  const specSpanRegistryHash = hash('spec-span-registry');
  const intentAuthorityEnvelope = compileIntentAuthorityEnvelope({
    subject: {
      sourceSnapshotHash:
        orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
      canonicalIntentSemanticHash,
      specSpanRegistryHash,
    },
    compositeSourceAuthorityBundle,
    authorityBasis: {
      kind: 'direct_source_declaration',
      sourceDeclarationHash:
        orderedSourceSnapshotSet.sourceSnapshots[0].sourceSnapshotHash,
      declaringUserAuthorityIdentity:
        'user:campaign-activation-test',
      entryScenario: 'standalone_goal_contract',
    },
  });
  const goalContractSemanticHash = hash('goal-contract-semantics');
  const compilerIdentityHash = hash('compiler-identity');
  const goalContractHash = hashControlPlaneValue({
    schemaVersion: 'goal-contract-authority/v1',
    goalContractSemanticHash,
    authorityAttestationHash:
      intentAuthorityEnvelope.authorityAttestationHash,
    sourceCompositionPolicyHash:
      sourceCompositionPolicy.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash:
      compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
    compilerIdentityHash,
  });
  const subordinateCoverageReceipts =
    compositeSourceAuthorityBundle.subordinateCoverage.receipts ||
    [compositeSourceAuthorityBundle.subordinateCoverage];
  const goalContractBundle = {
    schemaVersion: 'goal-contract-bundle/v1',
    sourceCompositionPolicyHash:
      sourceCompositionPolicy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash,
    canonicalIntentBundleHash,
    authorityAttestationHash:
      intentAuthorityEnvelope.authorityAttestationHash,
    specSpanRegistryHash,
    goalContractSemanticHash,
    goalContractHash,
    compilerIdentityHash,
    subordinateSourceCoverageReceipts:
      subordinateCoverageReceipts,
  };

  const partitionPlanHash = hash('partition-plan');
  const partitionSetHash = hash('partition-set');
  const partitionPolicyHash = hash('partition-policy');
  const partitions = ['owner', 'consumer'].map((seed, index) => ({
    partitionId: partitionId(seed),
    childContractHash: hash(`child:${seed}`),
    childCompilationReceiptHash: hash(`generation:${seed}`),
    selectionSetHash: hash(`selection:${seed}`),
    partitionRole: 'implementation',
    primaryTaskIds: [`task-${seed}`],
    governedPaths: [`src/${seed}.ts`],
    dependencyPartitionIds:
      index === 0 ? [] : [partitionId('owner')],
    executionLeaseRequired: true,
  }));
  const orderedChildContractHashes = partitions.map(
    ({ childContractHash }) => childContractHash
  );
  const partitionManifestHash = hashControlPlaneValue({
    goalContractHash,
    sourceCompositionPolicyHash:
      sourceCompositionPolicy.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash:
      compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
    partitionPolicyHash,
    partitionPlanHash,
    partitionSetHash,
    orderedChildContractHashes,
  });
  const partitionManifest = {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    manifestAuthorityMode: 'final_child_membership',
    masterSourceHash:
      orderedSourceSnapshotSet.sourceSnapshots[0].sourceSnapshotHash,
    sourceSnapshotHash:
      orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
    sourceCompositionMode: 'composite_required',
    sourceCompositionPolicyHash:
      sourceCompositionPolicy.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      orderedSourceSnapshotSet.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash:
      compositeSourceAuthorityBundle.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash,
    canonicalIntentBundleHash,
    specSpanRegistryHash,
    intentAuthorityAttestationHash:
      intentAuthorityEnvelope.authorityAttestationHash,
    subordinateCoverageReceiptHashes:
      subordinateCoverageReceipts.map(({ receiptHash }) => receiptHash),
    goalContractSemanticHash,
    goalContractHash,
    compilerIdentityHash,
    executionProjectionHash: hash('execution-projection'),
    partitionPolicyHash,
    partitionPlanHash,
    partitionSetHash,
    partitionCount: partitions.length,
    topologicalOrder: partitions.map(({ partitionId: id }) => id),
    orderedChildContractHashes,
    partitionAnalysisReceiptHash: partitionPlanHash,
    coverage: {
      uncoveredObligationIds: [],
      duplicateObligationIds: [],
      unmappedObligationIds: [],
      scopeEscapeObligationIds: [],
    },
    partitions,
    partitionManifestHash,
  };
  const fixture = {
    root,
    primaryPath,
    subordinatePath,
    sourceCompositionPolicy,
    orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle,
    intentAuthorityEnvelope,
    goalContractBundle,
    subordinateCoverageReceipts,
    partitionManifest,
    attemptId: 'attempt-campaign-current',
    activatedAt: '2026-07-29T00:01:00.000Z',
    issuedAt: '2026-07-29T00:02:00.000Z',
  };
  fixture.childReleaseGateReceipts = partitions.map((partition) =>
    releaseReceipt(fixture, partition)
  );
  fixture.executionAuthorization = executionAuthorization(fixture);
  return fixture;
}

function activationRequest(fixture, overrides = {}) {
  return {
    receiptRoot: path.join(fixture.root, 'receipts'),
    sourceCompositionPolicy: fixture.sourceCompositionPolicy,
    orderedSourceSnapshotSet: fixture.orderedSourceSnapshotSet,
    compositeSourceAuthorityBundle:
      fixture.compositeSourceAuthorityBundle,
    intentAuthorityEnvelope: fixture.intentAuthorityEnvelope,
    goalContractBundle: fixture.goalContractBundle,
    subordinateCoverageReceipts:
      fixture.subordinateCoverageReceipts,
    partitionManifest: fixture.partitionManifest,
    childReleaseGateReceipts:
      fixture.childReleaseGateReceipts,
    executionAuthorization: fixture.executionAuthorization,
    attemptId: fixture.attemptId,
    activatedAt: fixture.activatedAt,
    ...overrides,
  };
}

describe('Goal Campaign activation and execution leases', () => {
  it('activates one frozen campaign with one authorization', () => {
    const fixture = campaignFixture();
    const activated = activateGoalCampaign(activationRequest(fixture));

    assert.equal(activated.receipt.decision, 'pass');
    assert.equal(activated.receipt.authorizationCount, 1);
    assert.equal(activated.receipt.modelInvocationCount, 0);
    assert.equal(
      activated.receipt.partitionManifestHash,
      fixture.partitionManifest.partitionManifestHash
    );
    assert.equal(fs.existsSync(activated.receiptPath), true);
  });

  it('rejects caller authority injection and requires explicit recovery', () => {
    const fixture = campaignFixture();
    const request = activationRequest(fixture);
    const activated = activateGoalCampaign(request);

    for (const [field, value] of [
      ['campaignId', activated.receipt.campaignId],
      [
        'campaignActivationHash',
        activated.receipt.campaignActivationHash,
      ],
      ['receiptPath', activated.receiptPath],
    ]) {
      assert.throws(
        () => activateGoalCampaign({ ...request, [field]: value }),
        (error) =>
          error.failureClass === 'campaign_activation_authority_injection'
      );
    }
    assert.throws(
      () => activateGoalCampaign(request),
      (error) =>
        error.failureClass === 'campaign_activation_duplicate'
    );
    const recovered = activateGoalCampaign({
      ...request,
      recovery: true,
    });
    assert.equal(recovered.recovered, true);
    assert.equal(
      recovered.receipt.receiptHash,
      activated.receipt.receiptHash
    );
  });

  it('fails closed for stale component bytes and source-policy downgrade', () => {
    const fixture = campaignFixture();
    fs.appendFileSync(
      fixture.subordinatePath,
      '\ncomponent mutation\n',
      'utf8'
    );
    assert.throws(
      () => activateGoalCampaign(activationRequest(fixture)),
      (error) => error.failureClass === 'subordinate_source_stale'
    );

    const downgraded = structuredClone(fixture.sourceCompositionPolicy);
    downgraded.mode = 'single_source';
    assert.throws(
      () =>
        activateGoalCampaign(
          activationRequest(fixture, {
            sourceCompositionPolicy: downgraded,
          })
        ),
      (error) =>
        error.failureClass === 'source_composition_downgrade_rejected'
    );
  });

  it('rejects missing or blocked child release authority', () => {
    const fixture = campaignFixture();
    assert.throws(
      () =>
        activateGoalCampaign(
          activationRequest(fixture, {
            childReleaseGateReceipts:
              fixture.childReleaseGateReceipts.slice(0, 1),
          })
        ),
      (error) =>
        error.failureClass === 'campaign_child_release_incomplete'
    );
    const blocked = structuredClone(
      fixture.childReleaseGateReceipts
    );
    blocked[0].decision = 'blocked';
    blocked[0].blockingReasons = ['fixture_blocked'];
    assert.throws(
      () =>
        activateGoalCampaign(
          activationRequest(fixture, {
            childReleaseGateReceipts: blocked,
          })
        ),
      (error) =>
        error.failureClass === 'campaign_child_release_blocked'
    );
  });

  it('issues leases in dependency order without new authorization', () => {
    const fixture = campaignFixture();
    const activated = activateGoalCampaign(activationRequest(fixture));
    const [owner, consumer] = fixture.partitionManifest.partitions;

    const ownerLease = issueSubcontractExecutionLease({
      receiptRoot: path.join(fixture.root, 'receipts'),
      activationReceipt: activated.receipt,
      partitionManifest: fixture.partitionManifest,
      partitionId: owner.partitionId,
      predecessorClosureReceipts: [],
      attemptId: fixture.attemptId,
      issuedAt: fixture.issuedAt,
    });
    assert.equal(ownerLease.receipt.leaseOrdinal, 1);
    assert.equal(ownerLease.receipt.authorizationCount, 1);
    assert.equal(ownerLease.receipt.modelInvocationCount, 0);
    assert.equal(ownerLease.receipt.closureScopeMode, 'governed_files');

    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: path.join(fixture.root, 'receipts'),
          activationReceipt: activated.receipt,
          partitionManifest: fixture.partitionManifest,
          partitionId: consumer.partitionId,
          predecessorClosureReceipts: [],
          attemptId: fixture.attemptId,
          issuedAt: fixture.issuedAt,
        }),
      (error) =>
        error.failureClass === 'subcontract_predecessor_closure_missing'
    );
    const closurePayload = {
      schemaVersion:
        'goal-contract-subcontract-closure-receipt/v1',
      partitionId: owner.partitionId,
      partitionManifestHash:
        fixture.partitionManifest.partitionManifestHash,
      childContractHash: owner.childContractHash,
      attemptId: fixture.attemptId,
      decision: 'pass',
    };
    const predecessorClosureReceipt = {
      ...closurePayload,
      receiptHash: hashReceiptPayload(closurePayload),
    };
    const consumerLease = issueSubcontractExecutionLease({
      receiptRoot: path.join(fixture.root, 'receipts'),
      activationReceipt: activated.receipt,
      partitionManifest: fixture.partitionManifest,
      partitionId: consumer.partitionId,
      predecessorClosureReceipts: [predecessorClosureReceipt],
      attemptId: fixture.attemptId,
      issuedAt: fixture.issuedAt,
    });
    assert.deepEqual(
      consumerLease.receipt.predecessorClosureReceiptHashes,
      [predecessorClosureReceipt.receiptHash]
    );
  });

  it('requires the activation receipt to be committed at its derived path', () => {
    const fixture = campaignFixture();
    const activated = activateGoalCampaign(activationRequest(fixture));
    fs.rmSync(activated.receiptPath);

    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: path.join(fixture.root, 'receipts'),
          activationReceipt: activated.receipt,
          partitionManifest: fixture.partitionManifest,
          partitionId:
            fixture.partitionManifest.topologicalOrder[0],
          predecessorClosureReceipts: [],
          attemptId: fixture.attemptId,
          issuedAt: fixture.issuedAt,
        }),
      (error) =>
        error.failureClass ===
        'subcontract_activation_receipt_not_committed'
    );
  });

  it('rejects partial temp receipts and recovers committed bytes', () => {
    const fixture = campaignFixture();
    const request = activationRequest(fixture);
    const activated = activateGoalCampaign(request);
    const receiptBytes = fs.readFileSync(activated.receiptPath);
    fs.rmSync(activated.receiptPath);
    fs.writeFileSync(`${activated.receiptPath}.tmp`, receiptBytes.subarray(0, 8));

    assert.throws(
      () => activateGoalCampaign({ ...request, recovery: true }),
      (error) =>
        error.failureClass === 'control_plane_partial_receipt'
    );
    fs.rmSync(`${activated.receiptPath}.tmp`);
    fs.writeFileSync(activated.receiptPath, receiptBytes);
    const recovered = activateGoalCampaign({
      ...request,
      recovery: true,
    });
    assert.equal(recovered.recovered, true);
  });
});
