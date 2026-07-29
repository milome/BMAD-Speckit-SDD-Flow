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
  closeGoalCampaign,
} = require('../src/utils/goal-contract/control-plane/campaign-closure.ts');
const {
  hashControlPlaneValue,
  hashReceiptPayload,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const ACTIVATION_SCHEMA =
  'goal-contract-campaign-activation-receipt.schema.json';
const CLOSURE_SCHEMA =
  'goal-contract-subcontract-closure-receipt.schema.json';
const hash = (value) => hashControlPlaneValue({ value });
const sha256 = (bytes) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function signed(payload) {
  return { ...payload, receiptHash: hashReceiptPayload(payload) };
}

function writeCanonicalJson(targetPath, value) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(
    targetPath,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
}

function fixture() {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-campaign-closure-')
  );
  const receiptRoot = path.join(repositoryRoot, 'receipts');
  const ownerId = partitionId('owner');
  const dependentId = partitionId('dependent');
  const partitionManifestHash = hash('partition-manifest');
  const partitionSetHash = hash('partition-set');
  const partitionPlanHash = hash('partition-plan');
  const sourceCompositionPolicyHash = hash('composition-policy');
  const sourceAuthorityBundleHash = hash('source-authority');
  const goalContractHash = hash('goal-contract');
  const campaignActivationHash = hash('campaign-activation');
  const campaignId =
    `goal-campaign-${campaignActivationHash.slice(7)}`;
  const attemptId = 'attempt-current';
  const sharedArtifactPath = path.join(
    repositoryRoot,
    'src',
    'shared.ts'
  );
  fs.mkdirSync(path.dirname(sharedArtifactPath), { recursive: true });
  fs.writeFileSync(
    sharedArtifactPath,
    'export const shared = true;\n',
    'utf8'
  );
  const sharedArtifactHash = sha256(
    fs.readFileSync(sharedArtifactPath)
  );
  const activation = signed({
    schemaVersion: 'goal-contract-campaign-activation-receipt/v1',
    campaignId,
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
      hash('release-dependent'),
    ],
    executionAuthorization: {
      authorizerIdentity: 'user:campaign-closure-test',
      authorizationKind: 'user_explicit',
      authorizedSourceCompositionPolicyHash:
        sourceCompositionPolicyHash,
      authorizedGoalContractHash: goalContractHash,
      authorizedPartitionManifestHash: partitionManifestHash,
      authorizedPartitionSetHash: partitionSetHash,
      authorizationSourceHash: hash('authorization-source'),
      authorizationStatementHash: hash('authorization-statement'),
    },
    executionAuthorizationHash: hash('execution-authorization'),
    authorizationCount: 1,
    modelInvocationCount: 0,
    activatedAt: '2026-07-29T03:00:00.000Z',
    decision: 'pass',
  });
  commitCreateOnceReceipt({
    receiptRoot,
    relativePath: `campaigns/${campaignId}/activation.receipt.json`,
    schemaName: ACTIVATION_SCHEMA,
    receipt: activation,
  });
  const partitions = [
    {
      partitionId: ownerId,
      childContractHash: hash('owner-child'),
      dependencyPartitionIds: [],
      compatibilityReceiptRequirements: [],
    },
    {
      partitionId: dependentId,
      childContractHash: hash('dependent-child'),
      dependencyPartitionIds: [ownerId],
      compatibilityReceiptRequirements: [
        {
          artifactPath: 'src/shared.ts',
          predecessorPartitionId: ownerId,
          receiptPath: 'compatibility/shared.receipt.json',
        },
      ],
    },
  ];
  const manifest = {
    partitionManifestHash,
    partitionSetHash,
    partitionPlanHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    goalContractHash,
    topologicalOrder: partitions.map(({ partitionId }) => partitionId),
    partitions,
  };
  const ownerClosure = signed({
    schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
    campaignId,
    campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    leaseReceiptHash: hash('owner-lease'),
    attemptId,
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
    governedFileManifestHash: hash('owner-governed'),
    dependencyClosureHash: hash('owner-dependency'),
    productionReachabilityReceiptHash: hash('owner-reachability'),
    integrationVerificationReceiptHash: hashControlPlaneValue([]),
    subcontractEvidenceHash: hash('owner-subcontract-evidence'),
    childClosureHash: hash('owner-child-closure'),
    predecessorClosureReceiptHashes: [],
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    closedAt: '2026-07-29T03:01:00.000Z',
    decision: 'pass',
  });
  const { receiptHash: _ownerReceiptHash, ...ownerClosurePayload } =
    ownerClosure;
  const dependentClosure = signed({
    ...ownerClosurePayload,
    leaseReceiptHash: hash('dependent-lease'),
    partitionId: dependentId,
    childContractHash: partitions[1].childContractHash,
    orderedVerificationEvidenceHashes: [hash('dependent-evidence')],
    governedFileManifestHash: hash('dependent-governed'),
    dependencyClosureHash: hash('dependent-dependency'),
    productionReachabilityReceiptHash: hash('dependent-reachability'),
    subcontractEvidenceHash: hash('dependent-subcontract-evidence'),
    childClosureHash: hash('dependent-child-closure'),
    predecessorClosureReceiptHashes: [ownerClosure.receiptHash],
    closedAt: '2026-07-29T03:02:00.000Z',
  });
  for (const [index, closure] of [
    ownerClosure,
    dependentClosure,
  ].entries()) {
    commitCreateOnceReceipt({
      receiptRoot,
      relativePath:
        `campaigns/${campaignId}/closures/` +
        `${String(index + 1).padStart(4, '0')}-${closure.partitionId}.receipt.json`,
      schemaName: CLOSURE_SCHEMA,
      receipt: closure,
    });
  }
  const compatibilityReceipt = {
    schemaVersion: 'goal-contract-dependency-compatibility-receipt/v1',
    masterSourceHash: hash('master-source'),
    sourceSnapshotHash: hash('source-snapshot'),
    partitionManifestHash,
    dependentPartitionId: dependentId,
    predecessorPartitionId: ownerId,
    predecessorCompletionReceiptHash: ownerClosure.receiptHash,
    predecessorOwnedArtifactPath: 'src/shared.ts',
    predecessorArtifactHash: sharedArtifactHash,
    currentArtifactHash: sharedArtifactHash,
    compatibilityDomain: 'runtime_contract',
    preservedAcceptanceIds: ['acceptance-shared'],
    invalidatedAcceptanceIds: [],
    compatibilityCommands: [
      {
        commandId: `command-${sharedArtifactHash.slice(7, 23)}`,
        argv: ['node', '--version'],
        cwd: repositoryRoot,
        exitCode: 0,
        stdoutHash: hash('stdout'),
        stderrHash: hash('stderr'),
        artifactHashes: {
          'src/shared.ts': sharedArtifactHash,
        },
      },
    ],
    decision: 'pass',
    blockingReasons: [],
  };
  const compatibilityPath = path.join(
    repositoryRoot,
    'compatibility',
    'shared.receipt.json'
  );
  writeCanonicalJson(compatibilityPath, compatibilityReceipt);
  return {
    repositoryRoot,
    receiptRoot,
    activation,
    manifest,
    closures: [ownerClosure, dependentClosure],
    compatibilityReceipt,
    compatibilityPath,
    finalExecutionProjectionHash: hash('final-execution-projection'),
  };
}

function closureInput(current) {
  return {
    repositoryRoot: current.repositoryRoot,
    receiptRoot: current.receiptRoot,
    activationReceipt: current.activation,
    partitionManifest: current.manifest,
    childClosureReceipts: current.closures,
    finalExecutionProjectionHash:
      current.finalExecutionProjectionHash,
    closedAt: '2026-07-29T03:03:00.000Z',
  };
}

describe('mechanical Goal Campaign closure', () => {
  it('closes a complete topologically ordered child set', () => {
    const current = fixture();
    const closed = closeGoalCampaign(closureInput(current));

    assert.equal(closed.receipt.decision, 'pass');
    assert.deepEqual(
      closed.receipt.orderedChildClosureReceiptHashes,
      current.closures.map(({ receiptHash }) => receiptHash)
    );
    assert.equal(closed.receipt.compatibilityReceiptHashes.length, 1);
    assert.match(closed.receipt.subcontractClosureSetHash, /^sha256:/u);
    assert.match(closed.receipt.goalCampaignClosureHash, /^sha256:/u);
    assert.equal(fs.existsSync(closed.receiptPath), true);
  });

  it('rejects missing, duplicate, unknown, and reordered children', () => {
    const missing = fixture();
    assert.throws(
      () =>
        closeGoalCampaign({
          ...closureInput(missing),
          childClosureReceipts: missing.closures.slice(0, 1),
        }),
      (error) => error.failureClass === 'goal_campaign_child_missing'
    );

    const duplicate = fixture();
    assert.throws(
      () =>
        closeGoalCampaign({
          ...closureInput(duplicate),
          childClosureReceipts: [
            duplicate.closures[0],
            duplicate.closures[0],
          ],
        }),
      (error) => error.failureClass === 'goal_campaign_child_duplicate'
    );

    const unknown = fixture();
    const unknownChild = {
      ...unknown.closures[1],
      partitionId: partitionId('unknown'),
    };
    assert.throws(
      () =>
        closeGoalCampaign({
          ...closureInput(unknown),
          childClosureReceipts: [
            unknown.closures[0],
            unknownChild,
          ],
        }),
      (error) => error.failureClass === 'goal_campaign_child_unknown'
    );

    const reordered = fixture();
    assert.throws(
      () =>
        closeGoalCampaign({
          ...closureInput(reordered),
          childClosureReceipts: [...reordered.closures].reverse(),
        }),
      (error) => error.failureClass === 'goal_campaign_child_reordered'
    );
  });

  it('rejects stale predecessor and compatibility evidence', () => {
    const predecessor = fixture();
    const staleDependentPayload = {
      ...predecessor.closures[1],
      predecessorClosureReceiptHashes: [hash('stale-predecessor')],
    };
    delete staleDependentPayload.receiptHash;
    const staleDependent = signed(staleDependentPayload);
    const staleDependentPath = path.join(
      predecessor.receiptRoot,
      'campaigns',
      predecessor.activation.campaignId,
      'closures',
      `0002-${staleDependent.partitionId}.receipt.json`
    );
    fs.writeFileSync(
      staleDependentPath,
      canonicalReceiptBytes(staleDependent)
    );
    assert.throws(
      () =>
        closeGoalCampaign({
          ...closureInput(predecessor),
          childClosureReceipts: [
            predecessor.closures[0],
            staleDependent,
          ],
        }),
      (error) =>
        error.failureClass ===
        'goal_campaign_predecessor_closure_stale'
    );

    const compatibility = fixture();
    compatibility.compatibilityReceipt.currentArtifactHash =
      hash('stale-artifact');
    writeCanonicalJson(
      compatibility.compatibilityPath,
      compatibility.compatibilityReceipt
    );
    assert.throws(
      () => closeGoalCampaign(closureInput(compatibility)),
      (error) =>
        error.failureClass ===
        'goal_campaign_compatibility_receipt_stale'
    );
  });

  it('rejects duplicate closure and recovers identical committed bytes', () => {
    const current = fixture();
    const input = closureInput(current);
    const closed = closeGoalCampaign(input);
    assert.throws(
      () => closeGoalCampaign(input),
      (error) => error.failureClass === 'goal_campaign_closure_duplicate'
    );
    const recovered = closeGoalCampaign({ ...input, recovery: true });
    assert.equal(recovered.recovered, true);
    assert.equal(
      recovered.receipt.receiptHash,
      closed.receipt.receiptHash
    );
  });
});
