const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  compileSubcontractEvidence,
  REQUIRED_EVIDENCE_CATEGORIES,
} = require('../src/utils/goal-contract/control-plane/subcontract-evidence.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const hash = (value) => hashControlPlaneValue({ value });
const sha256 = (bytes) =>
  `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const partitionId = (value) =>
  `partition-${hashControlPlaneValue({ partition: value }).slice(7)}`;

function fixture() {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'subcontract-evidence-')
  );
  const governedPath = path.join(repositoryRoot, 'src', 'owned.ts');
  const logPath = path.join(repositoryRoot, 'logs', 'targeted.log');
  fs.mkdirSync(path.dirname(governedPath), { recursive: true });
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(governedPath, 'export const owned = true;\n', 'utf8');
  fs.writeFileSync(logPath, 'tests: pass\n', 'utf8');
  const governedHash = sha256(fs.readFileSync(governedPath));
  const logHash = sha256(fs.readFileSync(logPath));
  const ownerPartitionId = partitionId('owner');
  const taskId = `task-${hash('task').slice(7, 23)}`;
  const obligationId = `obligation-${hash('obligation').slice(7, 23)}`;
  const specSpanId = `span-${hash('span').slice(7, 23)}`;
  const activationReceipt = {
    campaignId: `goal-campaign-${hash('campaign').slice(7)}`,
    campaignActivationHash: hash('activation'),
    receiptHash: hash('activation-receipt'),
    attemptId: 'attempt-current',
    sourceCompositionPolicyHash: hash('composition-policy'),
    sourceAuthorityBundleHash: hash('source-authority'),
    partitionManifestHash: hash('manifest'),
    partitionSetHash: hash('partition-set'),
  };
  const leaseReceipt = {
    partitionId: ownerPartitionId,
    childContractHash: hash('child'),
    partitionManifestHash: activationReceipt.partitionManifestHash,
    partitionPlanHash: hash('partition-plan'),
    selectionHash: hash('selection'),
    sourceCompositionPolicyHash:
      activationReceipt.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash:
      activationReceipt.sourceAuthorityBundleHash,
    receiptHash: hash('lease'),
    attemptId: activationReceipt.attemptId,
    predecessorClosureReceiptHashes: [],
  };
  const evidenceCategoryRecords = REQUIRED_EVIDENCE_CATEGORIES.map(
    (category) => ({
      category,
      applicability: 'applicable',
      decision: 'pass',
      evidenceHash: hash(`category:${category}`),
    })
  );
  return {
    repositoryRoot,
    governedPath,
    logPath,
    activationReceipt,
    leaseReceipt,
    input: {
      repositoryRoot,
      activationReceipt,
      leaseReceipt,
      partitionManifest: {
        partitionManifestHash:
          activationReceipt.partitionManifestHash,
        partitions: [
          {
            partitionId: ownerPartitionId,
            childContractHash: leaseReceipt.childContractHash,
            governedPaths: ['src/owned.ts'],
            primaryTaskIds: [taskId],
            namespacedObligations: [
              {
                declaredSourceId: obligationId,
                specSpanRefs: [specSpanId],
              },
            ],
            specSpanRefs: [specSpanId],
            subordinateCoverageReceiptHashes: [
              hash('subordinate-coverage'),
            ],
            dependencyPartitionIds: [],
          },
        ],
      },
      partitionId: ownerPartitionId,
      sourceCompositionPolicyHash:
        activationReceipt.sourceCompositionPolicyHash,
      sourceAuthorityBundleHash:
        activationReceipt.sourceAuthorityBundleHash,
      subordinateCoverageReceiptHashes: [
        hash('subordinate-coverage'),
      ],
      taskEvidenceRecords: [
        {
          taskId,
          obligationRefs: [obligationId],
          specSpanRefs: [specSpanId],
          governedPaths: ['src/owned.ts'],
          sourceHashBefore: hash('before'),
          sourceHashAfter: governedHash,
          exactCommand: 'node --test targeted.test.js',
          workingDirectory: repositoryRoot,
          startedAt: '2026-07-29T01:00:00.000Z',
          endedAt: '2026-07-29T01:00:01.000Z',
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
      evidenceCategoryRecords,
      subcontractModelAuditCount: 0,
      reviewerInvocationCount: 0,
      auditorInvocationCount: 0,
      judgeSemanticAttemptCount: 0,
      compiledAt: '2026-07-29T01:00:02.000Z',
    },
  };
}

function integrationFixture() {
  const current = fixture();
  const partition = current.input.partitionManifest.partitions[0];
  const dependencyId = partitionId('integration-dependency');
  const taskId = current.input.taskEvidenceRecords[0].taskId;
  const sourceTreeIdentity = hash('integration-source-tree');

  partition.partitionRole = 'final_integration';
  partition.governedPaths = [];
  partition.dependencyPartitionIds = [dependencyId];
  current.input.taskEvidenceRecords[0].governedPaths = [];
  current.input.taskEvidenceRecords[0].sourceHashBefore = sourceTreeIdentity;
  current.input.taskEvidenceRecords[0].sourceHashAfter = sourceTreeIdentity;
  current.input.governedFileRecords = [];
  current.input.dependencyClosureRecords = [
    {
      partitionId: dependencyId,
      closureReceiptHash: hash('dependency-closure'),
      artifactHashes: {
        'src/dependency.ts': hash('dependency-artifact'),
      },
      compatibilityReceiptHashes: [],
    },
  ];
  current.input.productionReachabilityRecords = [];
  current.input.integrationVerificationRecords = [
    {
      verificationTarget: 'partition_dependencies',
      coveredDependencyPartitionIds: [dependencyId],
      taskEvidenceRefs: [taskId],
      decision: 'pass',
    },
  ];
  const productionReachability = current.input.evidenceCategoryRecords.find(
    (record) => record.category === 'production_reachability'
  );
  productionReachability.applicability = 'not_applicable_with_proof';
  productionReachability.decision = 'not_applicable';
  return current;
}

describe('deterministic subcontract evidence', () => {
  it('compiles complete current evidence with four zero model counters', () => {
    const current = fixture();
    const evidence = compileSubcontractEvidence(current.input);

    assert.equal(evidence.decision, 'pass');
    assert.equal(evidence.taskEvidenceRecords.length, 1);
    assert.match(evidence.taskEvidenceRecords[0].taskEvidenceHash, /^sha256:/u);
    assert.match(evidence.governedFileManifestHash, /^sha256:/u);
    assert.match(evidence.dependencyClosureHash, /^sha256:/u);
    assert.match(evidence.productionReachabilityReceiptHash, /^sha256:/u);
    assert.equal(evidence.subcontractModelAuditCount, 0);
    assert.equal(evidence.reviewerInvocationCount, 0);
    assert.equal(evidence.auditorInvocationCount, 0);
    assert.equal(evidence.judgeSemanticAttemptCount, 0);
  });

  it('compiles integration-only evidence without fabricating governed files or production reachability', () => {
    const current = integrationFixture();
    const evidence = compileSubcontractEvidence(current.input);

    assert.equal(evidence.closureScopeMode, 'integration_only');
    assert.deepEqual(evidence.governedFileManifest, []);
    assert.deepEqual(evidence.productionReachabilityRecords, []);
    assert.equal(evidence.integrationVerificationRecords.length, 1);
    assert.match(
      evidence.integrationVerificationReceiptHash,
      /^sha256:/u
    );
  });

  it('fails closed for invalid integration-only scope and proof', () => {
    const wrongRole = integrationFixture();
    wrongRole.input.partitionManifest.partitions[0].partitionRole =
      'implementation';
    assert.throws(
      () => compileSubcontractEvidence(wrongRole.input),
      (error) =>
        error.failureClass === 'subcontract_zero_governed_scope_invalid'
    );

    const mutated = integrationFixture();
    mutated.input.taskEvidenceRecords[0].sourceHashAfter =
      hash('mutated-source-tree');
    assert.throws(
      () => compileSubcontractEvidence(mutated.input),
      (error) =>
        error.failureClass === 'subcontract_integration_source_mutation'
    );

    const missingProof = integrationFixture();
    missingProof.input.integrationVerificationRecords = [];
    assert.throws(
      () => compileSubcontractEvidence(missingProof.input),
      (error) =>
        error.failureClass ===
        'subcontract_integration_verification_incomplete'
    );

    const forgedGovernedScope = integrationFixture();
    forgedGovernedScope.input.governedFileRecords = [
      {
        path: 'src/owned.ts',
        classifications: ['tested'],
        sourceHashBefore: hash('before'),
        sourceHashAfter: hash('after'),
        existsAfter: true,
      },
    ];
    assert.throws(
      () => compileSubcontractEvidence(forgedGovernedScope.input),
      (error) =>
        error.failureClass === 'subcontract_integration_scope_nonempty'
    );
  });

  it('rejects missing categories, non-zero commands, and stale logs', () => {
    const missing = fixture();
    missing.input.evidenceCategoryRecords.pop();
    assert.throws(
      () => compileSubcontractEvidence(missing.input),
      (error) =>
        error.failureClass === 'subcontract_evidence_category_missing'
    );

    const failed = fixture();
    failed.input.taskEvidenceRecords[0].exitCode = 1;
    assert.throws(
      () => compileSubcontractEvidence(failed.input),
      (error) =>
        error.failureClass === 'subcontract_command_evidence_failed'
    );

    const stale = fixture();
    fs.appendFileSync(stale.logPath, 'mutated\n', 'utf8');
    assert.throws(
      () => compileSubcontractEvidence(stale.input),
      (error) =>
        error.failureClass === 'subcontract_evidence_log_stale'
    );
  });

  it('rejects unauthorized paths, traversal, and governed omission', () => {
    const traversal = fixture();
    traversal.input.taskEvidenceRecords[0].governedPaths = ['../escape.ts'];
    assert.throws(
      () => compileSubcontractEvidence(traversal.input),
      (error) =>
        error.failureClass === 'subcontract_governed_path_escape'
    );

    const unauthorized = fixture();
    unauthorized.input.governedFileRecords[0].path = 'src/other.ts';
    assert.throws(
      () => compileSubcontractEvidence(unauthorized.input),
      (error) =>
        error.failureClass === 'subcontract_governed_path_unauthorized'
    );

    const omitted = fixture();
    omitted.input.governedFileRecords = [];
    assert.throws(
      () => compileSubcontractEvidence(omitted.input),
      (error) =>
        error.failureClass === 'subcontract_governed_path_omitted'
    );
  });

  it('rejects dead or fixture-only production reachability', () => {
    for (const entryKind of ['fixture', 'test_seam', 'dead_export']) {
      const current = fixture();
      current.input.productionReachabilityRecords[0].entryKind =
        entryKind;
      assert.throws(
        () => compileSubcontractEvidence(current.input),
        (error) =>
          error.failureClass ===
          'subcontract_production_reachability_invalid'
      );
    }
  });

  it('rejects model, verdict, score, and control-decision authority', () => {
    for (const [field, value] of [
      ['modelResponseText', 'PASS'],
      ['score', 100],
      ['verdict', 'approved'],
      ['readonlyObservation', 'clean'],
      ['closeoutApproved', true],
      ['releaseDecision', 'pass'],
      ['activationDecision', 'pass'],
      ['leaseDecision', 'pass'],
      ['childClosureDecision', 'pass'],
      ['campaignClosureDecision', 'pass'],
    ]) {
      const current = fixture();
      assert.throws(
        () =>
          compileSubcontractEvidence({
            ...current.input,
            [field]: value,
          }),
        (error) =>
          error.failureClass === 'subcontract_model_authority_rejected'
      );
    }
  });
});
