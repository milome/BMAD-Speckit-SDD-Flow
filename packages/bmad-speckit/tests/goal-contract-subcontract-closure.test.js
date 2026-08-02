const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  canonicalReceiptBytes,
  commitCreateOnceReceipt,
} = require('../src/utils/goal-contract/control-plane/campaign-receipt-store.ts');
const {
  closeSubcontract,
  evaluateSubcontractInvalidation,
} = require('../src/utils/goal-contract/control-plane/subcontract-closure.ts');
const {
  compileSubcontractEvidence,
  REQUIRED_EVIDENCE_CATEGORIES,
} = require('../src/utils/goal-contract/control-plane/subcontract-evidence.ts');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const ACTIVATION_SCHEMA =
  'goal-contract-campaign-activation-receipt.schema.json';
const LEASE_SCHEMA =
  'goal-contract-subcontract-execution-lease.schema.json';
const hash = (value) => hashControlPlaneValue({ value });
const sha256 = (bytes) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function signed(payload) {
  return { ...payload, receiptHash: hashReceiptPayload(payload) };
}

function fixture() {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'subcontract-closure-')
  );
  const receiptRoot = path.join(repositoryRoot, 'receipts');
  const campaignActivationHash = hash('campaign-activation');
  const campaignId =
    `goal-campaign-${campaignActivationHash.slice(7)}`;
  const attemptId = 'attempt-current';
  const ownerId = partitionId('owner');
  const dependentId = partitionId('dependent');
  const childPath = path.join(repositoryRoot, 'children', 'owner.md');
  const governedPath = path.join(repositoryRoot, 'src', 'owned.ts');
  const logPath = path.join(repositoryRoot, 'logs', 'targeted.log');
  fs.mkdirSync(path.dirname(childPath), { recursive: true });
  fs.mkdirSync(path.dirname(governedPath), { recursive: true });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(childPath, '# Frozen child\n', 'utf8');
  fs.writeFileSync(governedPath, 'export const owned = true;\n', 'utf8');
  fs.writeFileSync(logPath, 'pass\n', 'utf8');
  const childContractHash = sha256(fs.readFileSync(childPath));
  const governedHash = sha256(fs.readFileSync(governedPath));
  const logHash = sha256(fs.readFileSync(logPath));
  const partitionManifestHash = hash('partition-manifest');
  const partitionSetHash = hash('partition-set');
  const partitionPlanHash = hash('partition-plan');
  const sourceCompositionPolicyHash = hash('composition-policy');
  const sourceAuthorityBundleHash = hash('source-authority');
  const activation = signed({
    schemaVersion: 'goal-contract-campaign-activation-receipt/v1',
    campaignId,
    campaignActivationHash,
    attemptId,
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: hash('snapshot-set'),
    sourceAuthorityBundleHash,
    authorityAttestationHash: hash('attestation'),
    goalContractHash: hash('goal-contract'),
    partitionPlanHash,
    partitionManifestHash,
    partitionSetHash,
    partitionPolicyHash: hash('partition-policy'),
    compilerIdentityHash: hash('compiler'),
    subordinateCoverageReceiptHashes: [hash('subordinate-coverage')],
    childReleaseReceiptHashes: [hash('release-owner'), hash('release-dependent')],
    executionAuthorization: {
      authorizerIdentity: 'user:closure-test',
      authorizationKind: 'user_explicit',
      authorizedSourceCompositionPolicyHash:
        sourceCompositionPolicyHash,
      authorizedGoalContractHash: hash('goal-contract'),
      authorizedPartitionManifestHash: partitionManifestHash,
      authorizedPartitionSetHash: partitionSetHash,
      authorizationSourceHash: hash('authorization-source'),
      authorizationStatementHash: hash('authorization-statement'),
    },
    executionAuthorizationHash: hashControlPlaneValue({
      authorizerIdentity: 'user:closure-test',
      authorizationKind: 'user_explicit',
      authorizedSourceCompositionPolicyHash:
        sourceCompositionPolicyHash,
      authorizedGoalContractHash: hash('goal-contract'),
      authorizedPartitionManifestHash: partitionManifestHash,
      authorizedPartitionSetHash: partitionSetHash,
      authorizationSourceHash: hash('authorization-source'),
      authorizationStatementHash: hash('authorization-statement'),
    }),
    authorizationCount: 1,
    modelInvocationCount: 0,
    activatedAt: '2026-07-29T02:00:00.000Z',
    decision: 'pass',
  });
  const activationCommit = commitCreateOnceReceipt({
    receiptRoot,
    relativePath: `campaigns/${campaignId}/activation.receipt.json`,
    schemaName: ACTIVATION_SCHEMA,
    receipt: activation,
  });
  const lease = signed({
    schemaVersion: 'goal-contract-subcontract-execution-lease/v1',
    campaignId,
    campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId,
    partitionId: ownerId,
    partitionManifestHash,
    partitionSetHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    partitionPlanHash,
    childContractHash,
    selectionHash: hash('selection'),
    closureScopeMode: 'governed_files',
    predecessorClosureReceiptHashes: [],
    leaseOrdinal: 1,
    authorizationCount: 1,
    modelInvocationCount: 0,
    issuedAt: '2026-07-29T02:01:00.000Z',
    decision: 'pass',
  });
  const leaseCommit = commitCreateOnceReceipt({
    receiptRoot,
    relativePath:
      `campaigns/${campaignId}/leases/0001-${ownerId}.receipt.json`,
    schemaName: LEASE_SCHEMA,
    receipt: lease,
  });
  const partitionManifest = {
    partitionManifestHash,
    partitionSetHash,
    partitionPlanHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    topologicalOrder: [ownerId, dependentId],
    partitions: [
      {
        partitionId: ownerId,
        childContractHash,
        childContractPath: 'children/owner.md',
        selectionSetHash: lease.selectionHash,
        dependencyPartitionIds: [],
        governedPaths: ['src/owned.ts'],
        subordinateCoverageReceiptHashes:
          activation.subordinateCoverageReceiptHashes,
      },
      {
        partitionId: dependentId,
        childContractHash: hash('dependent-child'),
        selectionSetHash: hash('dependent-selection'),
        dependencyPartitionIds: [ownerId],
        governedPaths: ['src/dependent.ts'],
      },
    ],
  };
  const evidence = compileSubcontractEvidence({
    repositoryRoot,
    activationReceipt: activation,
    leaseReceipt: lease,
    partitionManifest,
    partitionId: ownerId,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    subordinateCoverageReceiptHashes:
      activation.subordinateCoverageReceiptHashes,
    taskEvidenceRecords: [
      {
        taskId: 'task-owner',
        obligationRefs: ['obligation-owner'],
        specSpanRefs: ['span-owner'],
        governedPaths: ['src/owned.ts'],
        sourceHashBefore: hash('before'),
        sourceHashAfter: governedHash,
        exactCommand: 'node --test targeted.test.js',
        workingDirectory: repositoryRoot,
        startedAt: '2026-07-29T02:02:00.000Z',
        endedAt: '2026-07-29T02:02:01.000Z',
        exitCode: 0,
        logPath: 'logs/targeted.log',
        logHash,
      },
    ],
    governedFileRecords: [
      {
        path: 'src/owned.ts',
        classifications: ['modified', 'tested', 'consumed'],
        sourceHashBefore: hash('before'),
        sourceHashAfter: governedHash,
        existsAfter: true,
      },
    ],
    dependencyClosureRecords: [],
    productionReachabilityRecords: [
      {
        publicEntry: 'package:main',
        entryKind: 'production',
        changedImplementationSymbols: ['owned'],
        reachableSymbols: ['owned'],
        traversedPaths: ['src/owned.ts'],
        decision: 'pass',
      },
    ],
    evidenceCategoryRecords: REQUIRED_EVIDENCE_CATEGORIES.map(
      (category) => ({
        category,
        applicability: 'applicable',
        decision: 'pass',
        evidenceHash: hash(`category:${category}`),
      })
    ),
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    compiledAt: '2026-07-29T02:03:00.000Z',
  });
  return {
    repositoryRoot,
    receiptRoot,
    childPath,
    governedPath,
    activation,
    activationCommit,
    lease,
    leaseCommit,
    partitionManifest,
    evidence,
  };
}

describe('mechanical subcontract closure', () => {
  it('resolves successor child contracts from an independent authority root', () => {
    const current = fixture();
    const authorityRoot = path.join(current.repositoryRoot, 'successor-authority');
    const successorChildPath = path.join(
      authorityRoot,
      current.partitionManifest.partitions[0].childContractPath
    );
    fs.mkdirSync(path.dirname(successorChildPath), { recursive: true });
    fs.renameSync(current.childPath, successorChildPath);

    const closed = closeSubcontract({
      repositoryRoot: current.repositoryRoot,
      authorityRoot,
      receiptRoot: current.receiptRoot,
      activationReceipt: current.activation,
      leaseReceipt: current.lease,
      partitionManifest: current.partitionManifest,
      partitionId: current.lease.partitionId,
      subcontractEvidence: current.evidence,
      closedAt: '2026-07-29T02:04:00.000Z',
    });

    assert.equal(closed.receipt.decision, 'pass');
  });

  it('closes only from committed current authority and deterministic evidence', () => {
    const current = fixture();
    const closed = closeSubcontract({
      repositoryRoot: current.repositoryRoot,
      receiptRoot: current.receiptRoot,
      activationReceipt: current.activation,
      leaseReceipt: current.lease,
      partitionManifest: current.partitionManifest,
      partitionId: current.lease.partitionId,
      subcontractEvidence: current.evidence,
      closedAt: '2026-07-29T02:04:00.000Z',
    });

    assert.equal(closed.receipt.decision, 'pass');
    assert.equal(closed.receipt.subcontractModelAuditCount, 0);
    assert.match(closed.receipt.childClosureHash, /^sha256:/u);
    assert.equal(fs.existsSync(closed.receiptPath), true);
  });

  it('closes integration-only scope from current predecessor artifacts and verification evidence', () => {
    const current = fixture();
    const ownerClosed = closeSubcontract({
      repositoryRoot: current.repositoryRoot,
      receiptRoot: current.receiptRoot,
      activationReceipt: current.activation,
      leaseReceipt: current.lease,
      partitionManifest: current.partitionManifest,
      partitionId: current.lease.partitionId,
      subcontractEvidence: current.evidence,
      closedAt: '2026-07-29T02:04:00.000Z',
    });
    const integration = current.partitionManifest.partitions[1];
    const integrationChildPath = path.join(
      current.repositoryRoot,
      'children',
      'integration.md'
    );
    const integrationLogPath = path.join(
      current.repositoryRoot,
      'logs',
      'integration.log'
    );
    fs.writeFileSync(integrationChildPath, '# Integration child\n', 'utf8');
    fs.writeFileSync(integrationLogPath, 'integration: pass\n', 'utf8');
    integration.childContractPath = 'children/integration.md';
    integration.childContractHash = sha256(
      fs.readFileSync(integrationChildPath)
    );
    integration.partitionRole = 'final_integration';
    integration.primaryTaskIds = ['task-integration'];
    integration.governedPaths = [];
    integration.subordinateCoverageReceiptHashes =
      current.activation.subordinateCoverageReceiptHashes;

    const integrationLease = signed({
      schemaVersion: 'goal-contract-subcontract-execution-lease/v1',
      campaignId: current.activation.campaignId,
      campaignActivationHash:
        current.activation.campaignActivationHash,
      activationReceiptHash: current.activation.receiptHash,
      attemptId: current.activation.attemptId,
      partitionId: integration.partitionId,
      partitionManifestHash:
        current.partitionManifest.partitionManifestHash,
      partitionSetHash: current.partitionManifest.partitionSetHash,
      sourceCompositionPolicyHash:
        current.activation.sourceCompositionPolicyHash,
      sourceAuthorityBundleHash:
        current.activation.sourceAuthorityBundleHash,
      partitionPlanHash: current.partitionManifest.partitionPlanHash,
      childContractHash: integration.childContractHash,
      selectionHash: integration.selectionSetHash,
      closureScopeMode: 'integration_only',
      predecessorClosureReceiptHashes: [
        ownerClosed.receipt.receiptHash,
      ],
      leaseOrdinal: 2,
      authorizationCount: 1,
      modelInvocationCount: 0,
      issuedAt: '2026-07-29T02:05:00.000Z',
      decision: 'pass',
    });
    commitCreateOnceReceipt({
      receiptRoot: current.receiptRoot,
      relativePath:
        `campaigns/${current.activation.campaignId}/leases/` +
        `0002-${integration.partitionId}.receipt.json`,
      schemaName: LEASE_SCHEMA,
      receipt: integrationLease,
    });
    const sourceTreeIdentity = hash('integration-source-tree');
    const integrationEvidence = compileSubcontractEvidence({
      repositoryRoot: current.repositoryRoot,
      activationReceipt: current.activation,
      leaseReceipt: integrationLease,
      partitionManifest: current.partitionManifest,
      partitionId: integration.partitionId,
      sourceCompositionPolicyHash:
        current.activation.sourceCompositionPolicyHash,
      sourceAuthorityBundleHash:
        current.activation.sourceAuthorityBundleHash,
      subordinateCoverageReceiptHashes:
        current.activation.subordinateCoverageReceiptHashes,
      taskEvidenceRecords: [
        {
          taskId: 'task-integration',
          obligationRefs: ['obligation-integration'],
          specSpanRefs: ['span-integration'],
          governedPaths: [],
          sourceHashBefore: sourceTreeIdentity,
          sourceHashAfter: sourceTreeIdentity,
          exactCommand: 'npm run integration',
          workingDirectory: current.repositoryRoot,
          startedAt: '2026-07-29T02:05:01.000Z',
          endedAt: '2026-07-29T02:05:02.000Z',
          exitCode: 0,
          logPath: 'logs/integration.log',
          logHash: sha256(fs.readFileSync(integrationLogPath)),
        },
      ],
      governedFileRecords: [],
      dependencyClosureRecords: [
        {
          partitionId: current.lease.partitionId,
          closureReceiptHash: ownerClosed.receipt.receiptHash,
          artifactHashes: {
            'src/owned.ts': sha256(
              fs.readFileSync(current.governedPath)
            ),
          },
          compatibilityReceiptHashes: [],
        },
      ],
      productionReachabilityRecords: [],
      integrationVerificationRecords: [
        {
          verificationTarget: 'partition_dependencies',
          coveredDependencyPartitionIds: [
            current.lease.partitionId,
          ],
          taskEvidenceRefs: ['task-integration'],
          decision: 'pass',
        },
      ],
      evidenceCategoryRecords: REQUIRED_EVIDENCE_CATEGORIES.map(
        (category) => ({
          category,
          applicability:
            category === 'production_reachability'
              ? 'not_applicable_with_proof'
              : 'applicable',
          decision:
            category === 'production_reachability'
              ? 'not_applicable'
              : 'pass',
          evidenceHash: hash(`integration-category:${category}`),
        })
      ),
      subcontractModelAuditCount: 0,
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      compiledAt: '2026-07-29T02:05:03.000Z',
    });
    const integrationClosed = closeSubcontract({
      repositoryRoot: current.repositoryRoot,
      receiptRoot: current.receiptRoot,
      activationReceipt: current.activation,
      leaseReceipt: integrationLease,
      partitionManifest: current.partitionManifest,
      partitionId: integration.partitionId,
      subcontractEvidence: integrationEvidence,
      closedAt: '2026-07-29T02:06:00.000Z',
    });

    assert.equal(
      integrationClosed.receipt.closureScopeMode,
      'integration_only'
    );
    assert.match(
      integrationClosed.receipt.integrationVerificationReceiptHash,
      /^sha256:/u
    );
  });

  it('rejects stale governed and child bytes', () => {
    const governed = fixture();
    fs.appendFileSync(governed.governedPath, 'mutation\n', 'utf8');
    assert.throws(
      () =>
        closeSubcontract({
          repositoryRoot: governed.repositoryRoot,
          receiptRoot: governed.receiptRoot,
          activationReceipt: governed.activation,
          leaseReceipt: governed.lease,
          partitionManifest: governed.partitionManifest,
          partitionId: governed.lease.partitionId,
          subcontractEvidence: governed.evidence,
          closedAt: '2026-07-29T02:04:00.000Z',
        }),
      (error) => error.failureClass === 'subcontract_evidence_stale'
    );

    const child = fixture();
    fs.appendFileSync(child.childPath, 'mutation\n', 'utf8');
    assert.throws(
      () =>
        closeSubcontract({
          repositoryRoot: child.repositoryRoot,
          receiptRoot: child.receiptRoot,
          activationReceipt: child.activation,
          leaseReceipt: child.lease,
          partitionManifest: child.partitionManifest,
          partitionId: child.lease.partitionId,
          subcontractEvidence: child.evidence,
          closedAt: '2026-07-29T02:04:00.000Z',
        }),
      (error) =>
        error.failureClass === 'subcontract_child_contract_stale'
    );
  });

  it('rejects uncommitted leases and recovers committed closure bytes', () => {
    const current = fixture();
    fs.rmSync(current.leaseCommit.path);
    assert.throws(
      () =>
        closeSubcontract({
          repositoryRoot: current.repositoryRoot,
          receiptRoot: current.receiptRoot,
          activationReceipt: current.activation,
          leaseReceipt: current.lease,
          partitionManifest: current.partitionManifest,
          partitionId: current.lease.partitionId,
          subcontractEvidence: current.evidence,
          closedAt: '2026-07-29T02:04:00.000Z',
        }),
      (error) =>
        error.failureClass === 'subcontract_lease_not_committed'
    );

    const recovery = fixture();
    const input = {
      repositoryRoot: recovery.repositoryRoot,
      receiptRoot: recovery.receiptRoot,
      activationReceipt: recovery.activation,
      leaseReceipt: recovery.lease,
      partitionManifest: recovery.partitionManifest,
      partitionId: recovery.lease.partitionId,
      subcontractEvidence: recovery.evidence,
      closedAt: '2026-07-29T02:04:00.000Z',
    };
    const closed = closeSubcontract(input);
    assert.throws(
      () => closeSubcontract(input),
      (error) =>
        error.failureClass === 'subcontract_closure_duplicate'
    );
    const recovered = closeSubcontract({ ...input, recovery: true });
    assert.equal(recovered.recovered, true);
    assert.deepEqual(
      canonicalReceiptBytes(recovered.receipt),
      canonicalReceiptBytes(closed.receipt)
    );
  });

  it('rejects self-resigned evidence with forged internal hashes', () => {
    const current = fixture();
    const { evidenceHash: _evidenceHash, ...payload } = current.evidence;
    const tamperedPayload = {
      ...payload,
      governedFileManifestHash: hash('forged-governed-manifest'),
    };
    const tamperedEvidence = {
      ...tamperedPayload,
      evidenceHash: hashReceiptPayload(tamperedPayload, 'evidenceHash'),
    };

    assert.throws(
      () =>
        closeSubcontract({
          repositoryRoot: current.repositoryRoot,
          receiptRoot: current.receiptRoot,
          activationReceipt: current.activation,
          leaseReceipt: current.lease,
          partitionManifest: current.partitionManifest,
          partitionId: current.lease.partitionId,
          subcontractEvidence: tamperedEvidence,
          closedAt: '2026-07-29T02:04:00.000Z',
        }),
      (error) =>
        error.failureClass === 'subcontract_evidence_hash_mismatch'
    );
  });

  it('invalidates only owner and dependents for implementation changes', () => {
    const current = fixture();
    const result = evaluateSubcontractInvalidation({
      partitionManifest: current.partitionManifest,
      baselineAuthority: {
        sourceCompositionPolicyHash:
          current.activation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.activation.sourceAuthorityBundleHash,
      },
      currentAuthority: {
        sourceCompositionPolicyHash:
          current.activation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.activation.sourceAuthorityBundleHash,
      },
      changedPaths: ['src/owned.ts'],
    });
    assert.equal(result.campaignWide, false);
    assert.deepEqual(
      result.invalidatedPartitionIds,
      current.partitionManifest.topologicalOrder
    );
  });

  it('rejects composite authority downgrade before selective invalidation', () => {
    const current = fixture();
    assert.throws(
      () =>
        evaluateSubcontractInvalidation({
          partitionManifest: current.partitionManifest,
          baselineAuthority: {
            sourceCompositionMode: 'composite_required',
            sourceCompositionPolicyHash:
              current.activation.sourceCompositionPolicyHash,
            sourceAuthorityBundleHash:
              current.activation.sourceAuthorityBundleHash,
            subordinateCoverageReceiptHashes: [
              hash('subordinate-coverage'),
            ],
          },
          currentAuthority: {
            sourceCompositionMode: 'single_source',
            sourceCompositionPolicyHash:
              current.activation.sourceCompositionPolicyHash,
            sourceAuthorityBundleHash:
              current.activation.sourceAuthorityBundleHash,
            subordinateCoverageReceiptHashes: [],
          },
          changedPaths: ['src/owned.ts'],
        }),
      (error) =>
        error.failureClass ===
        'source_composition_downgrade_rejected'
    );
  });

  it('fails closed when a changed path has no declared owner', () => {
    const current = fixture();
    assert.throws(
      () =>
        evaluateSubcontractInvalidation({
          partitionManifest: current.partitionManifest,
          baselineAuthority: {
            sourceCompositionPolicyHash:
              current.activation.sourceCompositionPolicyHash,
            sourceAuthorityBundleHash:
              current.activation.sourceAuthorityBundleHash,
          },
          currentAuthority: {
            sourceCompositionPolicyHash:
              current.activation.sourceCompositionPolicyHash,
            sourceAuthorityBundleHash:
              current.activation.sourceAuthorityBundleHash,
          },
          changedPaths: ['src/unowned.ts'],
        }),
      (error) =>
        error.failureClass === 'subcontract_dependency_incomplete'
    );
  });

  it('invalidates the whole campaign for source authority mutation', () => {
    const current = fixture();
    const result = evaluateSubcontractInvalidation({
      partitionManifest: current.partitionManifest,
      baselineAuthority: {
        sourceCompositionMode: 'composite_required',
        sourceCompositionPolicyHash:
          current.activation.sourceCompositionPolicyHash,
        sourceAuthorityBundleHash:
          current.activation.sourceAuthorityBundleHash,
      },
      currentAuthority: {
        sourceCompositionMode: 'composite_required',
        sourceCompositionPolicyHash: hash('mutated-policy'),
        sourceAuthorityBundleHash:
          current.activation.sourceAuthorityBundleHash,
      },
      changedPaths: [],
    });
    assert.equal(result.campaignWide, true);
    assert.deepEqual(
      result.invalidatedPartitionIds,
      current.partitionManifest.topologicalOrder
    );
  });
});
