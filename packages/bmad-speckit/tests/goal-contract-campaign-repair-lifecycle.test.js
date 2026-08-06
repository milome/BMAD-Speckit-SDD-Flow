const assert = require('node:assert');
const { createHash } = require('node:crypto');
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
  closeSubcontract,
} = require('../src/utils/goal-contract/control-plane/subcontract-closure.ts');
const {
  compileSubcontractEvidence,
  REQUIRED_EVIDENCE_CATEGORIES,
} = require('../src/utils/goal-contract/control-plane/subcontract-evidence.ts');
const {
  canonicalReceiptBytes,
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
const LIFECYCLE_BINDING_SCHEMA =
  'goal-contract-lifecycle-authority-binding.schema.json';
const hash = (value) => hashControlPlaneValue({ value });
const sha256 = (bytes) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function signed(payload) {
  return { ...payload, receiptHash: hashReceiptPayload(payload) };
}

function resignedEvidence(evidence, overrides) {
  const { evidenceHash: _ignoredEvidenceHash, ...payload } = evidence;
  const nextPayload = { ...payload, ...overrides };
  return {
    ...nextPayload,
    evidenceHash: hashReceiptPayload(nextPayload, 'evidenceHash'),
  };
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
  const ownerChildPath = path.join(authorityRoot, 'children', 'owner.md');
  const repairChildPath = path.join(authorityRoot, 'children', 'repair.md');
  const dependentChildPath = path.join(
    authorityRoot,
    'children',
    'dependent.md'
  );
  const repairSourcePath = path.join(root, 'src', 'repair.ts');
  const dependentSourcePath = path.join(
    root,
    'src',
    'dependent.ts'
  );
  const repairLogPath = path.join(root, 'logs', 'repair.log');
  const dependentLogPath = path.join(
    root,
    'logs',
    'dependent.log'
  );
  fs.mkdirSync(path.dirname(ownerChildPath), { recursive: true });
  fs.mkdirSync(path.dirname(repairSourcePath), { recursive: true });
  fs.mkdirSync(path.dirname(repairLogPath), { recursive: true });
  fs.writeFileSync(ownerChildPath, '# Owner child\n', 'utf8');
  fs.writeFileSync(repairChildPath, '# Repair child\n', 'utf8');
  fs.writeFileSync(dependentChildPath, '# Dependent child\n', 'utf8');
  fs.writeFileSync(repairSourcePath, 'export const repaired = true;\n', 'utf8');
  fs.writeFileSync(
    dependentSourcePath,
    'export const dependent = true;\n',
    'utf8'
  );
  fs.writeFileSync(repairLogPath, 'repair: pass\n', 'utf8');
  fs.writeFileSync(dependentLogPath, 'dependent: pass\n', 'utf8');
  const ownerId = partitionId('owner');
  const repairId = partitionId('repair');
  const dependentId = partitionId('dependent');
  const sourceCompositionPolicyHash = hash('composition-policy');
  const sourceAuthorityBundleHash = hash('source-authority');
  const goalContractHash = hash('goal-contract');
  const partitionPlanHash = hash('partition-plan');
  const partitionSetHash = hash('partition-set');
  const partitionPolicyHash = hash('partition-policy');
  const graphHash = hash('partition-impact-graph');
  const feasibilityHash = hash('partition-closure-feasibility');
  const driftHash = hash('partition-impact-drift');
  const repositoryTreeHash = hash('repository-tree');
  const partitionImpactPolicyHash = hash('partition-impact-policy');
  const partitionImpactAnalyzerIdentityHash = hash(
    'partition-impact-analyzer'
  );
  const partitionImpactGraphDocumentHash = hash(
    'partition-impact-graph-document'
  );
  const partitionImpactDriftReceiptHash = hash(
    'partition-impact-drift'
  );
  const lifecycleAuthorityFields = {
    graphHash,
    feasibilityHash,
    driftHash,
  };
  const partitions = [
    {
      partitionId: ownerId,
      childContractHash: sha256(fs.readFileSync(ownerChildPath)),
      childContractPath: 'children/owner.md',
      selectionSetHash: hash('owner-selection'),
      childCompilationReceiptHash: hash('owner-compilation'),
      governedPaths: ['src/owner.ts'],
      dependencyPartitionIds: [],
    },
    {
      partitionId: repairId,
      childContractHash: sha256(fs.readFileSync(repairChildPath)),
      childContractPath: 'children/repair.md',
      selectionSetHash: hash('repair-selection'),
      childCompilationReceiptHash: hash('repair-compilation'),
      governedPaths: ['src/repair.ts'],
      primaryTaskIds: ['TASK-REPAIR'],
      specSpanRefs: ['spec-span-repair'],
      dependencyPartitionIds: [ownerId],
    },
    {
      partitionId: dependentId,
      childContractHash: sha256(fs.readFileSync(dependentChildPath)),
      childContractPath: 'children/dependent.md',
      selectionSetHash: hash('dependent-selection'),
      childCompilationReceiptHash: hash('dependent-compilation'),
      governedPaths: ['src/dependent.ts'],
      primaryTaskIds: ['TASK-DEPENDENT'],
      specSpanRefs: ['spec-span-dependent'],
      dependencyPartitionIds: [repairId],
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
    repositoryTreeHash,
    partitionImpactPolicyHash,
    partitionImpactAnalyzerIdentityHash,
    partitionImpactGraphHash: graphHash,
    partitionImpactGraphDocumentHash,
    partitionClosureFeasibilityReceiptHash: feasibilityHash,
    partitionImpactDriftReceiptHash,
    driftHash,
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
    repositoryTreeHash,
    partitionImpactPolicyHash,
    partitionImpactAnalyzerIdentityHash,
    partitionImpactGraphHash: graphHash,
    partitionImpactGraphDocumentHash,
    partitionClosureFeasibilityReceiptHash: feasibilityHash,
    partitionImpactDriftReceiptHash,
    driftHash,
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
    ...lifecycleAuthorityFields,
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
  const ownerLease = signed({
    schemaVersion: 'goal-contract-subcontract-execution-lease/v1',
    campaignId: baseActivation.campaignId,
    campaignActivationHash:
      baseActivation.campaignActivationHash,
    activationReceiptHash: baseActivation.receiptHash,
    attemptId: baseAttemptId,
    partitionId: ownerId,
    partitionManifestHash,
    partitionSetHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    partitionPlanHash,
    childContractHash: partitions[0].childContractHash,
    ...lifecycleAuthorityFields,
    nodeAttemptId: 'node-owner-001',
    selectionHash: partitions[0].selectionSetHash,
    closureScopeMode: 'governed_files',
    predecessorClosureReceiptHashes: [],
    leaseOrdinal: 1,
    authorizationCount: 1,
    modelInvocationCount: 0,
    issuedAt: '2026-07-31T03:05:00.000Z',
    decision: 'pass',
  });
  commitCreateOnceReceipt({
    receiptRoot,
    relativePath:
      `campaigns/${baseActivation.campaignId}/leases/` +
      `0001-${ownerId}.receipt.json`,
    schemaName: LEASE_SCHEMA,
    receipt: ownerLease,
  });
  const ownerClosure = signed({
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    campaignId: baseActivation.campaignId,
    campaignActivationHash:
      baseActivation.campaignActivationHash,
    activationReceiptHash: baseActivation.receiptHash,
    leaseReceiptHash: ownerLease.receiptHash,
    attemptId: baseAttemptId,
    partitionId: ownerId,
    partitionManifestHash,
    partitionPlanHash,
    partitionSetHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    childContractHash: partitions[0].childContractHash,
    ...lifecycleAuthorityFields,
    nodeAttemptId: ownerLease.nodeAttemptId,
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
    ...lifecycleAuthorityFields,
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
    dependentId,
    baseActivation,
    ownerLease,
    ownerClosure,
    invalidatedLease,
    lifecycleAuthorityFields,
    repairSourceHash: sha256(fs.readFileSync(repairSourcePath)),
    repairLogHash: sha256(fs.readFileSync(repairLogPath)),
    dependentSourceHash: sha256(
      fs.readFileSync(dependentSourcePath)
    ),
    dependentLogHash: sha256(fs.readFileSync(dependentLogPath)),
    childReleaseGateReceipts: partitions.map((partition) =>
      releaseReceipt(manifest, partition)
    ),
  };
}

describe('goal campaign repair lifecycle', () => {
  it('validates current lifecycle bindings through the canonical schema registry', () => {
    const registryPath = require.resolve(
      '../src/utils/goal-contract/control-plane/schema-registry.ts'
    );
    const bindingPath = require.resolve(
      '../src/utils/goal-contract/control-plane/lifecycle-authority-binding.ts'
    );
    const registryModule = require.cache[registryPath];
    const bindingModule = require.cache[bindingPath];
    const registry = require(
      '../src/utils/goal-contract/control-plane/schema-registry.ts'
    );
    const calls = [];
    require.cache[registryPath].exports = {
      ...registry,
      validateGoalContractSchema(schemaName, value) {
        calls.push({ schemaName, value });
        return registry.validateGoalContractSchema(schemaName, value);
      },
    };
    delete require.cache[bindingPath];
    try {
      const {
        verifyLifecycleAuthorityBinding,
      } = require(
        '../src/utils/goal-contract/control-plane/lifecycle-authority-binding.ts'
      );
      const partitionManifest = {
        partitionManifestHash: hash('manifest'),
        partitionImpactGraphHash: hash('graph'),
        partitionClosureFeasibilityReceiptHash: hash('feasibility'),
        driftHash: hash('drift'),
      };
      verifyLifecycleAuthorityBinding({
        record: {
          partitionManifestHash: partitionManifest.partitionManifestHash,
          campaignId: 'campaign-current',
          attemptId: 'attempt-current',
          graphHash: partitionManifest.partitionImpactGraphHash,
          feasibilityHash:
            partitionManifest.partitionClosureFeasibilityReceiptHash,
          driftHash: partitionManifest.driftHash,
        },
        partitionManifest,
        campaignId: 'campaign-current',
        attemptId: 'attempt-current',
      });
      assert.deepEqual(
        calls.map(({ schemaName }) => schemaName),
        [LIFECYCLE_BINDING_SCHEMA]
      );
    } finally {
      require.cache[registryPath].exports = registryModule.exports;
      delete require.cache[bindingPath];
      if (bindingModule) require.cache[bindingPath] = bindingModule;
    }
  });

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

    const { receiptHash: _ignoredReceiptHash, ...ownerClosurePayload } =
      current.ownerClosure;
    const crossOriginOwnerClosure = signed({
      ...ownerClosurePayload,
      attemptId: repairAttemptId,
    });
    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: current.receiptRoot,
          activationReceipt: current.baseActivation,
          repairAuthorityReceipt: repair.receipt,
          partitionManifest: current.manifest,
          partitionId: current.repairId,
          predecessorClosureReceipts: [crossOriginOwnerClosure],
          attemptId: repairAttemptId,
          nodeAttemptId: 'node-repair-001',
          issuedAt: '2026-07-31T04:19:00.000Z',
        }),
      { failureClass: 'subcontract_predecessor_closure_stale' }
    );
    const malformedOwnerClosure = {
      ...current.ownerClosure,
      predecessorClosureReceiptHashes: [undefined],
    };
    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: current.receiptRoot,
          activationReceipt: current.baseActivation,
          repairAuthorityReceipt: repair.receipt,
          partitionManifest: current.manifest,
          partitionId: current.repairId,
          predecessorClosureReceipts: [malformedOwnerClosure],
          attemptId: repairAttemptId,
          nodeAttemptId: 'node-repair-001',
          issuedAt: '2026-07-31T04:19:15.000Z',
        }),
      { failureClass: 'subcontract_predecessor_closure_stale' }
    );
    for (const [field, value] of [
      ['nodeAttemptId', 'node-owner-forged'],
      ['leaseReceiptHash', hash('forged-owner-lease')],
    ]) {
      const forgedOwnerClosure = signed({
        ...ownerClosurePayload,
        [field]: value,
      });
      assert.throws(
        () =>
          issueSubcontractExecutionLease({
            receiptRoot: current.receiptRoot,
            activationReceipt: current.baseActivation,
            repairAuthorityReceipt: repair.receipt,
            partitionManifest: current.manifest,
            partitionId: current.repairId,
            predecessorClosureReceipts: [forgedOwnerClosure],
            attemptId: repairAttemptId,
            nodeAttemptId: 'node-repair-001',
            issuedAt: '2026-07-31T04:19:30.000Z',
          }),
        { failureClass: 'subcontract_predecessor_closure_stale' }
      );
    }

    const ownerLeasePath = path.join(
      current.receiptRoot,
      'campaigns',
      current.baseActivation.campaignId,
      'leases',
      `0001-${current.ownerId}.receipt.json`
    );
    const ownerClosurePath = path.join(
      current.receiptRoot,
      'campaigns',
      current.baseActivation.campaignId,
      'closures',
      `0001-${current.ownerId}.receipt.json`
    );
    const {
      receiptHash: _ignoredOwnerLeaseHash,
      ...ownerLeasePayload
    } = current.ownerLease;
    const reissuedOwnerLease = signed({
      ...ownerLeasePayload,
      issuedAt: '2026-07-31T03:05:30.000Z',
    });
    const reclosedOwnerClosure = signed({
      ...ownerClosurePayload,
      leaseReceiptHash: reissuedOwnerLease.receiptHash,
      closedAt: '2026-07-31T03:10:30.000Z',
    });
    const repairLeasePath = path.join(
      current.receiptRoot,
      'campaigns',
      current.baseActivation.campaignId,
      'repair',
      'leases',
      `0002-${current.repairId}.receipt.json`
    );
    fs.writeFileSync(
      ownerLeasePath,
      canonicalReceiptBytes(reissuedOwnerLease)
    );
    fs.writeFileSync(
      ownerClosurePath,
      canonicalReceiptBytes(reclosedOwnerClosure)
    );
    try {
      assert.throws(
        () =>
          issueSubcontractExecutionLease({
            receiptRoot: current.receiptRoot,
            activationReceipt: current.baseActivation,
            repairAuthorityReceipt: repair.receipt,
            partitionManifest: current.manifest,
            partitionId: current.repairId,
            predecessorClosureReceipts: [reclosedOwnerClosure],
            attemptId: repairAttemptId,
            nodeAttemptId: 'node-repair-reissued-owner',
            issuedAt: '2026-07-31T04:19:45.000Z',
          }),
        { failureClass: 'subcontract_predecessor_closure_stale' }
      );
    } finally {
      fs.writeFileSync(
        ownerLeasePath,
        canonicalReceiptBytes(current.ownerLease)
      );
      fs.writeFileSync(
        ownerClosurePath,
        canonicalReceiptBytes(current.ownerClosure)
      );
      fs.rmSync(repairLeasePath, { force: true });
    }

    const lease = issueSubcontractExecutionLease({
      receiptRoot: current.receiptRoot,
      activationReceipt: current.baseActivation,
      repairAuthorityReceipt: repair.receipt,
      partitionManifest: current.manifest,
      partitionId: current.repairId,
      predecessorClosureReceipts: [current.ownerClosure],
      attemptId: repairAttemptId,
      nodeAttemptId: 'node-repair-001',
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
    assert.strictEqual(lease.receipt.nodeAttemptId, 'node-repair-001');
    assert.strictEqual(
      lease.receipt.graphHash,
      current.lifecycleAuthorityFields.graphHash
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

    const evidence = compileSubcontractEvidence({
      repositoryRoot: current.root,
      activationReceipt: current.baseActivation,
      leaseReceipt: lease.receipt,
      partitionManifest: current.manifest,
      partitionId: current.repairId,
      sourceCompositionPolicyHash:
        current.baseActivation.sourceCompositionPolicyHash,
      sourceAuthorityBundleHash:
        current.baseActivation.sourceAuthorityBundleHash,
      subordinateCoverageReceiptHashes: [],
      taskEvidenceRecords: [
        {
          taskId: 'TASK-REPAIR',
          obligationRefs: ['GH-T07'],
          specSpanRefs: ['spec-span-repair'],
          governedPaths: ['src/repair.ts'],
          sourceHashBefore: hash('repair-before'),
          sourceHashAfter: current.repairSourceHash,
          exactCommand: 'node --test repair.test.js',
          workingDirectory: current.root,
          startedAt: '2026-07-31T04:21:00.000Z',
          endedAt: '2026-07-31T04:21:01.000Z',
          exitCode: 0,
          logPath: 'logs/repair.log',
          logHash: current.repairLogHash,
        },
      ],
      governedFileRecords: [
        {
          path: 'src/repair.ts',
          classifications: ['modified', 'tested', 'consumed'],
          sourceHashBefore: hash('repair-before'),
          sourceHashAfter: current.repairSourceHash,
          existsAfter: true,
        },
      ],
      dependencyClosureRecords: [
        {
          partitionId: current.ownerId,
          closureReceiptHash: current.ownerClosure.receiptHash,
          artifactHashes: {},
          compatibilityReceiptHashes: [],
        },
      ],
      productionReachabilityRecords: [
        {
          publicEntry: 'package:main',
          entryKind: 'production',
          changedImplementationSymbols: ['repaired'],
          reachableSymbols: ['repaired'],
          traversedPaths: ['src/repair.ts'],
          decision: 'pass',
        },
      ],
      evidenceCategoryRecords: REQUIRED_EVIDENCE_CATEGORIES.map(
        (category) => ({
          category,
          applicability: 'applicable',
          decision: 'pass',
          evidenceHash: hash(`repair-category:${category}`),
        })
      ),
      subcontractModelAuditCount: 0,
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      compiledAt: '2026-07-31T04:22:00.000Z',
    });
    assert.deepStrictEqual(
      {
        graphHash: evidence.graphHash,
        feasibilityHash: evidence.feasibilityHash,
        driftHash: evidence.driftHash,
        nodeAttemptId: evidence.nodeAttemptId,
      },
      {
        ...current.lifecycleAuthorityFields,
        nodeAttemptId: 'node-repair-001',
      }
    );
    const closureRequest = {
      repositoryRoot: current.root,
      authorityRoot: current.authorityRoot,
      receiptRoot: current.receiptRoot,
      activationReceipt: current.baseActivation,
      repairAuthorityReceipt: repair.receipt,
      leaseReceipt: lease.receipt,
      partitionManifest: current.manifest,
      partitionId: current.repairId,
      subcontractEvidence: evidence,
      closedAt: '2026-07-31T04:23:00.000Z',
    };
    const closed = closeSubcontract(closureRequest);
    assert.strictEqual(closed.receipt.attemptId, repairAttemptId);
    assert.strictEqual(closed.receipt.nodeAttemptId, 'node-repair-001');
    assert.match(
      closed.receiptPath.replace(/\\/gu, '/'),
      /\/repair\/closures\//u
    );
    for (const field of [
      'graphHash',
      'feasibilityHash',
      'driftHash',
      'nodeAttemptId',
    ]) {
      const forgedEvidence = resignedEvidence(evidence, {
        [field]:
          field === 'nodeAttemptId'
            ? 'node-repair-002'
            : hash(`forged:${field}`),
      });
      assert.throws(
        () =>
          closeSubcontract({
            ...closureRequest,
            subcontractEvidence: forgedEvidence,
          }),
        {
          failureClass: 'lifecycle_authority_mismatch',
          errorCode: 'ER-GH-003',
        }
      );
    }
    const {
      receiptHash: _ignoredClosedReceiptHash,
      ...closedPayload
    } = closed.receipt;
    const forgedRepairedPredecessor = signed({
      ...closedPayload,
      nodeAttemptId: 'node-repair-forged',
    });
    assert.throws(
      () =>
        issueSubcontractExecutionLease({
          receiptRoot: current.receiptRoot,
          activationReceipt: current.baseActivation,
          repairAuthorityReceipt: repair.receipt,
          partitionManifest: current.manifest,
          partitionId: current.dependentId,
          predecessorClosureReceipts: [
            forgedRepairedPredecessor,
          ],
          attemptId: repairAttemptId,
          nodeAttemptId: 'node-dependent-001',
          issuedAt: '2026-07-31T04:24:00.000Z',
        }),
      { failureClass: 'subcontract_predecessor_closure_stale' }
    );
    const dependentLease = issueSubcontractExecutionLease({
      receiptRoot: current.receiptRoot,
      activationReceipt: current.baseActivation,
      repairAuthorityReceipt: repair.receipt,
      partitionManifest: current.manifest,
      partitionId: current.dependentId,
      predecessorClosureReceipts: [closed.receipt],
      attemptId: repairAttemptId,
      nodeAttemptId: 'node-dependent-001',
      issuedAt: '2026-07-31T04:25:00.000Z',
    });
    assert.deepStrictEqual(
      dependentLease.receipt.predecessorClosureBindings,
      [
        {
          partitionId: current.repairId,
          origin: 'repaired',
          closureReceiptHash: closed.receipt.receiptHash,
        },
      ]
    );
    const dependentEvidence = compileSubcontractEvidence({
      repositoryRoot: current.root,
      activationReceipt: current.baseActivation,
      leaseReceipt: dependentLease.receipt,
      partitionManifest: current.manifest,
      partitionId: current.dependentId,
      sourceCompositionPolicyHash:
        current.baseActivation.sourceCompositionPolicyHash,
      sourceAuthorityBundleHash:
        current.baseActivation.sourceAuthorityBundleHash,
      subordinateCoverageReceiptHashes: [],
      taskEvidenceRecords: [
        {
          taskId: 'TASK-DEPENDENT',
          obligationRefs: ['GH-T07'],
          specSpanRefs: ['spec-span-dependent'],
          governedPaths: ['src/dependent.ts'],
          sourceHashBefore: hash('dependent-before'),
          sourceHashAfter: current.dependentSourceHash,
          exactCommand: 'node --test dependent.test.js',
          workingDirectory: current.root,
          startedAt: '2026-07-31T04:26:00.000Z',
          endedAt: '2026-07-31T04:26:01.000Z',
          exitCode: 0,
          logPath: 'logs/dependent.log',
          logHash: current.dependentLogHash,
        },
      ],
      governedFileRecords: [
        {
          path: 'src/dependent.ts',
          classifications: ['modified', 'tested', 'consumed'],
          sourceHashBefore: hash('dependent-before'),
          sourceHashAfter: current.dependentSourceHash,
          existsAfter: true,
        },
      ],
      dependencyClosureRecords: [
        {
          partitionId: current.repairId,
          closureReceiptHash: closed.receipt.receiptHash,
          artifactHashes: {},
          compatibilityReceiptHashes: [],
        },
      ],
      productionReachabilityRecords: [
        {
          publicEntry: 'package:main',
          entryKind: 'production',
          changedImplementationSymbols: ['dependent'],
          reachableSymbols: ['dependent'],
          traversedPaths: ['src/dependent.ts'],
          decision: 'pass',
        },
      ],
      evidenceCategoryRecords: REQUIRED_EVIDENCE_CATEGORIES.map(
        (category) => ({
          category,
          applicability: 'applicable',
          decision: 'pass',
          evidenceHash: hash(`dependent-category:${category}`),
        })
      ),
      subcontractModelAuditCount: 0,
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      compiledAt: '2026-07-31T04:27:00.000Z',
    });
    const dependentClosureRequest = {
      repositoryRoot: current.root,
      authorityRoot: current.authorityRoot,
      receiptRoot: current.receiptRoot,
      activationReceipt: current.baseActivation,
      repairAuthorityReceipt: repair.receipt,
      leaseReceipt: dependentLease.receipt,
      partitionManifest: current.manifest,
      partitionId: current.dependentId,
      subcontractEvidence: dependentEvidence,
      closedAt: '2026-07-31T04:28:00.000Z',
    };

    const dependentClosurePath = path.join(
      current.receiptRoot,
      'campaigns',
      current.baseActivation.campaignId,
      'repair',
      'closures',
      `0003-${current.dependentId}.receipt.json`
    );
    const {
      receiptHash: _ignoredDependentLeaseHash,
      ...dependentLeasePayload
    } = dependentLease.receipt;
    const duplicateBindingLease = signed({
      ...dependentLeasePayload,
      predecessorClosureBindings: [
        ...dependentLease.receipt.predecessorClosureBindings,
        {
          ...dependentLease.receipt.predecessorClosureBindings[0],
          origin: 'preserved_base',
        },
      ],
    });
    fs.writeFileSync(
      dependentLease.receiptPath,
      canonicalReceiptBytes(duplicateBindingLease)
    );
    try {
      assert.throws(
        () =>
          closeSubcontract({
            ...dependentClosureRequest,
            leaseReceipt: duplicateBindingLease,
            subcontractEvidence: resignedEvidence(
              dependentEvidence,
              {
                leaseReceiptHash: duplicateBindingLease.receiptHash,
              }
            ),
          }),
        { failureClass: 'subcontract_predecessor_closure_stale' }
      );
    } finally {
      fs.writeFileSync(
        dependentLease.receiptPath,
        canonicalReceiptBytes(dependentLease.receipt)
      );
      fs.rmSync(dependentClosurePath, { force: true });
    }

    const {
      receiptHash: _ignoredRepairLeaseHash,
      ...repairLeasePayload
    } = lease.receipt;
    const wrongAttemptRepairLease = signed({
      ...repairLeasePayload,
      attemptId: current.baseActivation.attemptId,
    });
    const {
      receiptHash: _ignoredRepairClosureHash,
      ...repairClosurePayload
    } = closed.receipt;
    const reboundRepairClosure = signed({
      ...repairClosurePayload,
      leaseReceiptHash: wrongAttemptRepairLease.receiptHash,
    });
    const reboundDependentLease = signed({
      ...dependentLeasePayload,
      predecessorClosureReceiptHashes: [
        reboundRepairClosure.receiptHash,
      ],
      predecessorClosureBindings: [
        {
          ...dependentLease.receipt.predecessorClosureBindings[0],
          closureReceiptHash: reboundRepairClosure.receiptHash,
        },
      ],
    });
    const reboundDependencyClosureRecords =
      dependentEvidence.dependencyClosureRecords.map((record) => ({
        ...record,
        closureReceiptHash: reboundRepairClosure.receiptHash,
      }));
    const reboundDependentEvidence = resignedEvidence(
      dependentEvidence,
      {
        leaseReceiptHash: reboundDependentLease.receiptHash,
        dependencyClosureRecords: reboundDependencyClosureRecords,
        dependencyClosureHash: hashControlPlaneValue(
          reboundDependencyClosureRecords
        ),
      }
    );
    fs.writeFileSync(
      lease.receiptPath,
      canonicalReceiptBytes(wrongAttemptRepairLease)
    );
    fs.writeFileSync(
      closed.receiptPath,
      canonicalReceiptBytes(reboundRepairClosure)
    );
    fs.writeFileSync(
      dependentLease.receiptPath,
      canonicalReceiptBytes(reboundDependentLease)
    );
    try {
      assert.throws(
        () =>
          closeSubcontract({
            ...dependentClosureRequest,
            leaseReceipt: reboundDependentLease,
            subcontractEvidence: reboundDependentEvidence,
          }),
        { failureClass: 'subcontract_predecessor_closure_stale' }
      );
    } finally {
      fs.writeFileSync(
        lease.receiptPath,
        canonicalReceiptBytes(lease.receipt)
      );
      fs.writeFileSync(
        closed.receiptPath,
        canonicalReceiptBytes(closed.receipt)
      );
      fs.writeFileSync(
        dependentLease.receiptPath,
        canonicalReceiptBytes(dependentLease.receipt)
      );
      fs.rmSync(dependentClosurePath, { force: true });
    }

    const dependentClosed = closeSubcontract(
      dependentClosureRequest
    );
    assert.match(
      dependentClosed.receiptPath.replace(/\\/gu, '/'),
      /\/repair\/closures\//u
    );
    const crossOriginDependentLease = signed({
      ...dependentLeasePayload,
      predecessorClosureBindings: [
        {
          ...dependentLease.receipt.predecessorClosureBindings[0],
          origin: 'preserved_base',
        },
      ],
    });
    fs.writeFileSync(
      dependentLease.receiptPath,
      canonicalReceiptBytes(crossOriginDependentLease)
    );
    assert.throws(
      () =>
        closeSubcontract({
          ...dependentClosureRequest,
          leaseReceipt: crossOriginDependentLease,
          subcontractEvidence: resignedEvidence(
            dependentEvidence,
            {
              leaseReceiptHash:
                crossOriginDependentLease.receiptHash,
            }
          ),
          closedAt: '2026-07-31T04:29:00.000Z',
        }),
      { failureClass: 'subcontract_predecessor_closure_stale' }
    );
    assert.throws(
      () =>
        closeSubcontract({
          repositoryRoot: current.root,
          authorityRoot: current.authorityRoot,
          receiptRoot: current.receiptRoot,
          activationReceipt: current.baseActivation,
          repairAuthorityReceipt: repair.receipt,
          leaseReceipt: current.invalidatedLease,
          partitionManifest: current.manifest,
          partitionId: current.repairId,
          subcontractEvidence: evidence,
          closedAt: '2026-07-31T04:24:00.000Z',
        }),
      { failureClass: 'campaign_repair_authority_required' }
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
