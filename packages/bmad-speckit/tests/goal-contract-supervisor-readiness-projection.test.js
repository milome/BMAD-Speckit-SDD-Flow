const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { before, describe, it } = require('node:test');

const {
  hashControlPlaneValue,
  hashReceiptPayload,
  stableControlPlaneStringify,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  commitRequirementRecordPartitionAuthoritySupersession,
} = require('../src/utils/goal-contract/control-plane/authority-supersession.ts');
const {
  goalContractAuthorityWriterBinding,
} = require('../src/utils/goal-contract/control-plane/partition-output-paths.ts');
const {
  compileSourceCompositionPolicy,
} = require('../src/utils/goal-contract/control-plane/source-composition-policy.ts');
const {
  validateGoalContractSchema,
} = require('../src/utils/goal-contract/control-plane/schema-registry.ts');
const {
  resolveSupervisorReadinessProjection,
} = require('../src/utils/goal-contract/control-plane/supervisor-readiness-projection.ts');
const controlPlane = require('../src/utils/goal-contract/control-plane/index.ts');

const PACKAGE_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');
const SOURCE_COMMAND = path.join(
  PACKAGE_ROOT,
  'src',
  'commands',
  'goal-contract.ts'
);
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const PROJECTION_SCHEMA =
  'goal-contract-supervisor-readiness-projection.schema.json';
const PARTITION_PROJECTION_FIELDS = Object.freeze(
  [
    'activationRef',
    'campaignClosureRef',
    'childClosureRef',
    'childContractHash',
    'childContractPath',
    'childReleaseRef',
    'dagOrder',
    'evidenceRef',
    'leaseRef',
    'partitionId',
    'partitionManifestHash',
    'rootGoalId',
  ].sort()
);

let baseline;

const normalizePath = (value) =>
  path.resolve(value).replace(/\\/gu, '/');
const sha256 = (value) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const hash = (value) => hashControlPlaneValue({ value });
const canonicalText = (value) =>
  `${stableControlPlaneStringify(value)}\n`;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canonicalText(value), 'utf8');
}

function signed(payload, hashField = 'receiptHash') {
  return {
    ...payload,
    [hashField]: hashReceiptPayload(payload, hashField),
  };
}

function standaloneSourceCompositionPolicyHash(sourcePlanHash) {
  const requiredSubordinateBindings = [];
  const authoritySourceId =
    `standalone-source-authority:${sourcePlanHash}`;
  return compileSourceCompositionPolicy({
    authorityRecord: {
      authorityKind: 'deterministic_source_authority_adapter',
      authoritySourceId,
      declaredMode: 'single_source',
      requiredSubordinateBindings,
      declaredRequiredBindingsHash: hashControlPlaneValue(
        requiredSubordinateBindings
      ),
      authorityEvidenceHash: hashControlPlaneValue({
        authoritySourceId,
        mode: 'single_source',
        requiredSubordinateBindings,
      }),
    },
  }).sourceCompositionPolicyHash;
}

function runSourceCommand(
  args,
  {
    cwd,
    env = {},
    sourceCommand = SOURCE_COMMAND,
  }
) {
  return spawnSync(
    process.execPath,
    ['-e', SOURCE_RUNNER, sourceCommand, ...args],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      env: { ...process.env, ...env },
    }
  );
}

function writeStructuredSourcePlan(root) {
  const sourcePath = path.join(root, 'source-plan.md');
  const tasks = [
    ['FIX-T01', 'Freeze source authority', 'packages/example/src/freeze.ts'],
    ['FIX-T02', 'Normalize source obligations', 'packages/example/src/normalize.ts'],
    ['FIX-T03', 'Compile impact graph', 'packages/example/src/impact.ts'],
    ['FIX-T04', 'Prove closure feasibility', 'packages/example/src/feasibility.ts'],
    ['FIX-T05', 'Finalize partition authority', 'packages/example/src/manifest.ts'],
  ];
  fs.writeFileSync(
    sourcePath,
    [
      '# Structured Partition Source Plan',
      '',
      '## Task Dependency DAG and File Ownership',
      '',
      '```text',
      'FIX-T01 -> FIX-T02 -> FIX-T03 -> FIX-T04 -> FIX-T05',
      '```',
      '',
      ...tasks.flatMap(([taskId, title, governedPath]) => [
        `### ${taskId}: ${title}`,
        '',
        '**Files**',
        '',
        `- Modify \`${governedPath}\`.`,
        '',
        `Acceptance: ${taskId} produces its declared observable outcome.`,
        '',
      ]),
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-FIX-001: MUST bind the exact source bytes.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-FIX-001: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writeFrozenContract(root, sourcePlanPath) {
  const sourcePlanHash = sha256(fs.readFileSync(sourcePlanPath));
  const goalContractPath = path.join(root, 'frozen-goal-contract.md');
  const coverageReceiptPath = path.join(root, 'source-coverage.json');
  const generationReceiptPath = path.join(root, 'generation.json');
  const frontMatter = [
    '---',
    'goalContractVersion: goal-execution-contract/v1',
    'contractMode: frozen',
    'rewritePolicy: forbidden',
    `sourcePlanPath: ${normalizePath(sourcePlanPath)}`,
    `sourcePlanHash: ${sourcePlanHash}`,
    `coverageReceiptPath: ${normalizePath(coverageReceiptPath)}`,
    `generationReceiptPath: ${normalizePath(generationReceiptPath)}`,
    '---',
  ];
  fs.writeFileSync(
    goalContractPath,
    [
      '# Goal Execution Contract',
      '',
      '<!-- goal-slot:frontMatter required dynamic=frontMatter -->',
      ...frontMatter,
      '<!-- /goal-slot:frontMatter -->',
      '',
      '# Frozen Goal Contract',
      '',
    ].join('\n'),
    'utf8'
  );
  const goalContractDocumentHash = sha256(
    fs.readFileSync(goalContractPath)
  );
  writeJson(coverageReceiptPath, {
    schemaVersion: 'goal-contract-source-coverage-receipt/v1',
    decision: 'pass',
    sourcePlanPath: normalizePath(sourcePlanPath),
    sourcePlanHash,
    goalContractDocumentHash,
    unmappedSourceObligations: [],
  });
  writeJson(generationReceiptPath, {
    schemaVersion: 'goal-contract-generation-receipt/v1',
    sourcePlanPath: normalizePath(sourcePlanPath),
    sourcePlanHash,
    goalContractDocumentHash,
    sourceCompositionPolicyHash:
      standaloneSourceCompositionPolicyHash(sourcePlanHash),
    compilationReceipt: {
      profileBytesHash: sha256(
        fs.readFileSync(
          path.join(
            REPO_ROOT,
            '_bmad',
            'shared',
            'goal-contract',
            'goal-contract-profile.json'
          )
        )
      ),
      templateBytesHash: sha256(
        fs.readFileSync(
          path.join(
            REPO_ROOT,
            '_bmad',
            'shared',
            'goal-contract',
            'goal-execution-contract-template.md'
          )
        )
      ),
    },
  });
  return { goalContractPath, sourcePlanHash };
}

function createBaselineAuthority() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'supervisor-readiness-baseline-')
  );
  const sourcePath = writeStructuredSourcePlan(root);
  const frozen = writeFrozenContract(root, sourcePath);
  const generated = runSourceCommand(
    [
      'partition',
      '--governed',
      '--entry',
      'standalone_goal_contract',
      '--source',
      sourcePath,
      '--goal-contract',
      frozen.goalContractPath,
      '--sequence-mode',
      'disabled',
      '--json',
    ],
    {
      cwd: root,
    }
  );
  assert.equal(
    generated.status,
    0,
    generated.stderr || generated.stdout
  );
  const payload = JSON.parse(generated.stdout);
  return {
    ...payload,
    pointer: JSON.parse(
      fs.readFileSync(payload.activePointerPath, 'utf8')
    ),
  };
}

function requiredReceiptHash(pointer, relativePath) {
  const binding = pointer.requiredReceiptHashes.find(
    (candidate) => candidate.path === relativePath
  );
  assert.ok(binding, `missing receipt hash for ${relativePath}`);
  return binding.hash;
}

function releaseReceipt({
  manifest,
  partition,
  pointer,
  ordinal,
}) {
  return {
    schemaVersion: 'goal-contract-partition-release-gate-receipt/v1',
    partitionId: partition.partitionId,
    masterSourceHash: manifest.masterSourceHash,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    sourceCompositionPolicyHash: manifest.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      manifest.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    methodologyProfileHash: manifest.methodologyProfileHash,
    methodologyProfileArtifactHash: hash('methodology-profile-artifact'),
    executionProjectionHash: manifest.executionProjectionHash,
    partitionAnalysisReceiptHash:
      manifest.partitionAnalysisReceiptHash,
    partitionManifestHash: pointer.partitionManifestDocumentHash,
    partitionManifestAuthorityHash: manifest.partitionManifestHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionSetHash: manifest.partitionSetHash,
    globalCoverageReceiptHash: requiredReceiptHash(
      pointer,
      manifest.globalCoverageReceiptPath
    ),
    selectionReceiptHash: requiredReceiptHash(
      pointer,
      partition.selectionReceiptPath
    ),
    selectionSetHash: partition.selectionSetHash,
    childCoverageReceiptHash: requiredReceiptHash(
      pointer,
      `receipts/children/${partition.partitionId}.coverage.json`
    ),
    childGenerationReceiptHash: requiredReceiptHash(
      pointer,
      `receipts/children/${partition.partitionId}.generation.json`
    ),
    childCompilationReceiptHash:
      partition.childCompilationReceiptHash,
    childContractHash: partition.childContractHash,
    goalContractHash: partition.childContractHash,
    sequenceMode: manifest.sequenceMode,
    sequenceApplicability: manifest.sequenceApplicability,
    sequenceCoverage: manifest.sequenceCoverage,
    sequenceClosureStatus: manifest.sequenceClosureStatus,
    childContractAuthority: manifest.childContractAuthority,
    predecessorCompletionReceiptHashes: [],
    compatibilityReceiptHashes: [],
    componentDecisions: {
      scope: 'pass',
      dependencies: ordinal === 1 ? 'not_applicable' : 'pass',
    },
    completedAt: '2026-08-02T00:00:00.000Z',
    decision: 'pass',
    blockingReasons: [],
  };
}

function evidenceRecord({
  repositoryRoot,
  manifest,
  partition,
  activation,
  lease,
  ordinal,
}) {
  const governedPath =
    partition.governedPaths[0] ||
    `packages/example/src/partition-${ordinal}.ts`;
  const governedTarget = path.join(repositoryRoot, governedPath);
  const logPath = `logs/partition-${ordinal}.log`;
  const logTarget = path.join(repositoryRoot, logPath);
  fs.mkdirSync(path.dirname(governedTarget), { recursive: true });
  fs.mkdirSync(path.dirname(logTarget), { recursive: true });
  fs.writeFileSync(
    governedTarget,
    `export const partition${ordinal} = true;\n`,
    'utf8'
  );
  fs.writeFileSync(logTarget, 'targeted tests: pass\n', 'utf8');
  const taskEvidence = {
    taskId: partition.primaryTaskIds[0],
    obligationRefs: [
      partition.obligationRefs[0] ||
        partition.primarySourceObligationIds[0],
    ],
    specSpanRefs: [
      partition.specSpanRefs[0] || `spec-span-${ordinal}`,
    ],
    governedPaths: [governedPath],
    sourceHashBefore: hash(`before-${ordinal}`),
    sourceHashAfter: sha256(fs.readFileSync(governedTarget)),
    exactCommand: 'node --version',
    workingDirectory: normalizePath(repositoryRoot),
    startedAt: '2026-08-02T00:01:00.000Z',
    endedAt: '2026-08-02T00:01:01.000Z',
    exitCode: 0,
    logPath,
    logHash: sha256(fs.readFileSync(logTarget)),
  };
  taskEvidence.taskEvidenceHash =
    hashControlPlaneValue(taskEvidence);
  const governedFileManifest = [
    {
      path: governedPath,
      classifications: ['modified', 'tested', 'consumed'],
      sourceHashBefore: taskEvidence.sourceHashBefore,
      sourceHashAfter: taskEvidence.sourceHashAfter,
      existsAfter: true,
    },
  ];
  const productionReachabilityRecords = [
    {
      publicEntry: `package:partition-${ordinal}`,
      entryKind: 'production',
      changedImplementationSymbols: [`partition${ordinal}`],
      reachableSymbols: [`partition${ordinal}`],
      traversedPaths: [governedPath],
      decision: 'pass',
    },
  ];
  const evidenceCategoryRecords = [
    {
      category: 'targeted_tests',
      applicability: 'applicable',
      decision: 'pass',
      evidenceHash: hash(`category-${ordinal}`),
    },
  ];
  const payload = {
    schemaVersion: 'goal-contract-subcontract-evidence/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    leaseReceiptHash: lease.receiptHash,
    attemptId: lease.attemptId,
    partitionId: partition.partitionId,
    partitionManifestHash: manifest.partitionManifestHash,
    graphHash: manifest.partitionImpactGraphHash,
    feasibilityHash:
      manifest.partitionClosureFeasibilityReceiptHash,
    driftHash: manifest.driftHash,
    partitionPlanHash: manifest.partitionPlanHash,
    childContractHash: partition.childContractHash,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    subordinateCoverageReceiptHashes:
      partition.subordinateCoverageReceiptHashes,
    closureScopeMode: 'governed_files',
    taskEvidenceRecords: [taskEvidence],
    governedFileManifest,
    governedFileManifestHash:
      hashControlPlaneValue(governedFileManifest),
    dependencyClosureRecords: [],
    dependencyClosureHash: hashControlPlaneValue([]),
    productionReachabilityRecords,
    productionReachabilityReceiptHash:
      hashControlPlaneValue(productionReachabilityRecords),
    integrationVerificationRecords: [],
    integrationVerificationReceiptHash: hashControlPlaneValue([]),
    evidenceCategoryRecords,
    orderedVerificationEvidenceHashes: [
      taskEvidence.taskEvidenceHash,
      evidenceCategoryRecords[0].evidenceHash,
    ],
    subcontractModelAuditCount: 0,
    reviewerInvocationCount: 0,
    auditorInvocationCount: 0,
    judgeSemanticAttemptCount: 0,
    compiledAt: '2026-08-02T00:01:02.000Z',
    decision: 'pass',
  };
  return signed(payload, 'evidenceHash');
}

function writeLifecycle(
  root,
  unitRoot,
  pointer,
  {
    releaseTransform = (receipt) => receipt,
    leaseTransform = (payload) => payload,
    closureTransform = (payload) => payload,
  } = {}
) {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(unitRoot, 'partition-manifest.json'), 'utf8')
  );
  const lifecycleRoot = path.join(unitRoot, 'lifecycle');
  const partitionsById = new Map(
    manifest.partitions.map((partition) => [
      partition.partitionId,
      partition,
    ])
  );
  const orderedPartitions = manifest.topologicalOrder.map((partitionId) =>
    partitionsById.get(partitionId)
  );
  const releaseRecords = manifest.partitions.map((partition, index) =>
    releaseTransform(
      releaseReceipt({
        manifest,
        partition,
        pointer,
        ordinal: index + 1,
      }),
      { index, manifest, partition }
    )
  );
  const releaseHashes = new Map(
    releaseRecords.map((receipt) => [
      receipt.partitionId,
      hashControlPlaneValue(receipt),
    ])
  );
  const campaignActivationHash = hash('campaign-activation');
  const executionAuthorization = {
    authorizerIdentity: 'user:supervisor-readiness',
    authorizationKind: 'user_explicit',
    authorizedSourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    authorizedGoalContractHash: manifest.goalContractHash,
    authorizedPartitionManifestHash: manifest.partitionManifestHash,
    authorizedPartitionSetHash: manifest.partitionSetHash,
    authorizationSourceHash: hash('authorization-source'),
    authorizationStatementHash: hash('authorization-statement'),
  };
  const activation = signed({
    schemaVersion: 'goal-contract-campaign-activation-receipt/v1',
    campaignId: `goal-campaign-${campaignActivationHash.slice(7)}`,
    campaignActivationHash,
    attemptId: 'attempt-supervisor-readiness',
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      manifest.orderedSourceSnapshotSetHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    authorityAttestationHash: manifest.intentAuthorityAttestationHash,
    goalContractHash: manifest.goalContractHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionManifestHash: manifest.partitionManifestHash,
    graphHash: manifest.partitionImpactGraphHash,
    feasibilityHash:
      manifest.partitionClosureFeasibilityReceiptHash,
    driftHash: manifest.driftHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionPolicyHash: manifest.partitionPolicyHash,
    compilerIdentityHash: hash('compiler-identity'),
    subordinateCoverageReceiptHashes:
      manifest.subordinateCoverageReceiptHashes,
    childReleaseReceiptHashes: manifest.partitions.map(
      (partition) => releaseHashes.get(partition.partitionId)
    ),
    executionAuthorization,
    executionAuthorizationHash:
      hashControlPlaneValue(executionAuthorization),
    authorizationCount: 1,
    modelInvocationCount: 0,
    activatedAt: '2026-08-02T00:00:01.000Z',
    decision: 'pass',
  });
  const campaignRoot = path.join(
    lifecycleRoot,
    'campaigns',
    activation.campaignId
  );
  const refs = {
    release: new Map(),
    lease: new Map(),
    evidence: new Map(),
    closure: new Map(),
  };
  releaseRecords.forEach((receipt, index) => {
    const target = path.join(
      lifecycleRoot,
      'releases',
      `${String(index + 1).padStart(4, '0')}-${receipt.partitionId}.receipt.json`
    );
    writeJson(target, receipt);
    refs.release.set(receipt.partitionId, target);
  });
  const activationPath = path.join(
    campaignRoot,
    'activation.receipt.json'
  );
  writeJson(activationPath, activation);
  const closures = new Map();
  orderedPartitions.forEach((partition, index) => {
    const predecessorClosureReceiptHashes =
      partition.dependencyPartitionIds.map(
        (partitionId) => closures.get(partitionId).receiptHash
      );
    const lease = signed(
      leaseTransform(
        {
          schemaVersion:
            'goal-contract-subcontract-execution-lease/v1',
          campaignId: activation.campaignId,
          campaignActivationHash:
            activation.campaignActivationHash,
          activationReceiptHash: activation.receiptHash,
          attemptId: activation.attemptId,
          partitionId: partition.partitionId,
          partitionManifestHash: manifest.partitionManifestHash,
          graphHash: manifest.partitionImpactGraphHash,
          feasibilityHash:
            manifest.partitionClosureFeasibilityReceiptHash,
          driftHash: manifest.driftHash,
          partitionSetHash: manifest.partitionSetHash,
          sourceCompositionPolicyHash:
            manifest.sourceCompositionPolicyHash,
          sourceAuthorityBundleHash:
            manifest.sourceAuthorityBundleHash,
          partitionPlanHash: manifest.partitionPlanHash,
          childContractHash: partition.childContractHash,
          selectionHash: partition.selectionSetHash,
          closureScopeMode: 'governed_files',
          predecessorClosureReceiptHashes,
          leaseOrdinal: index + 1,
          authorizationCount: 1,
          modelInvocationCount: 0,
          issuedAt: '2026-08-02T00:00:02.000Z',
          decision: 'pass',
        },
        { index, manifest, partition }
      )
    );
    const leasePath = path.join(
      campaignRoot,
      'leases',
      `${String(index + 1).padStart(4, '0')}-${partition.partitionId}.receipt.json`
    );
    writeJson(leasePath, lease);
    refs.lease.set(partition.partitionId, leasePath);
    const evidence = evidenceRecord({
      repositoryRoot: root,
      manifest,
      partition,
      activation,
      lease,
      ordinal: index + 1,
    });
    const evidencePath = path.join(
      campaignRoot,
      'evidence',
      `${String(index + 1).padStart(4, '0')}-${partition.partitionId}.receipt.json`
    );
    writeJson(evidencePath, evidence);
    refs.evidence.set(partition.partitionId, evidencePath);
    const closure = signed(
      closureTransform(
        {
          schemaVersion:
            'goal-contract-subcontract-closure-receipt/v1',
          campaignId: activation.campaignId,
          campaignActivationHash:
            activation.campaignActivationHash,
          activationReceiptHash: activation.receiptHash,
          leaseReceiptHash: lease.receiptHash,
          attemptId: activation.attemptId,
          partitionId: partition.partitionId,
          partitionManifestHash: manifest.partitionManifestHash,
          graphHash: manifest.partitionImpactGraphHash,
          feasibilityHash:
            manifest.partitionClosureFeasibilityReceiptHash,
          driftHash: manifest.driftHash,
          partitionPlanHash: manifest.partitionPlanHash,
          partitionSetHash: manifest.partitionSetHash,
          sourceCompositionPolicyHash:
            manifest.sourceCompositionPolicyHash,
          sourceAuthorityBundleHash:
            manifest.sourceAuthorityBundleHash,
          childContractHash: partition.childContractHash,
          closureScopeMode: 'governed_files',
          subordinateCoverageReceiptHashes:
            partition.subordinateCoverageReceiptHashes,
          orderedVerificationEvidenceHashes:
            evidence.orderedVerificationEvidenceHashes,
          governedFileManifestHash:
            evidence.governedFileManifestHash,
          dependencyClosureHash: evidence.dependencyClosureHash,
          productionReachabilityReceiptHash:
            evidence.productionReachabilityReceiptHash,
          integrationVerificationReceiptHash:
            evidence.integrationVerificationReceiptHash,
          subcontractEvidenceHash: evidence.evidenceHash,
          childClosureHash: hash(`child-closure-${index + 1}`),
          predecessorClosureReceiptHashes,
          subcontractModelAuditCount: 0,
          reviewerInvocationCount: 0,
          auditorInvocationCount: 0,
          judgeSemanticAttemptCount: 0,
          closedAt: '2026-08-02T00:00:04.000Z',
          decision: 'pass',
        },
        { index, manifest, partition }
      )
    );
    const closurePath = path.join(
      campaignRoot,
      'closures',
      `${String(index + 1).padStart(4, '0')}-${partition.partitionId}.receipt.json`
    );
    writeJson(closurePath, closure);
    refs.closure.set(partition.partitionId, closurePath);
    closures.set(partition.partitionId, closure);
  });
  const campaignClosure = signed({
    schemaVersion: 'goal-contract-campaign-closure-receipt/v1',
    campaignId: activation.campaignId,
    campaignActivationHash: activation.campaignActivationHash,
    activationReceiptHash: activation.receiptHash,
    attemptId: activation.attemptId,
    sourceCompositionPolicyHash:
      manifest.sourceCompositionPolicyHash,
    sourceAuthorityBundleHash: manifest.sourceAuthorityBundleHash,
    goalContractHash: manifest.goalContractHash,
    partitionPlanHash: manifest.partitionPlanHash,
    partitionManifestHash: manifest.partitionManifestHash,
    graphHash: manifest.partitionImpactGraphHash,
    feasibilityHash:
      manifest.partitionClosureFeasibilityReceiptHash,
    driftHash: manifest.driftHash,
    partitionSetHash: manifest.partitionSetHash,
    finalExecutionProjectionHash: hash('final-execution-projection'),
    orderedChildClosureReceiptHashes: orderedPartitions.map(
      (partition) => closures.get(partition.partitionId).receiptHash
    ),
    compatibilityReceiptHashes: [],
    subcontractClosureSetHash: hash('subcontract-closure-set'),
    goalCampaignClosureHash: hash('goal-campaign-closure'),
    modelInvocationCount: 0,
    closedAt: '2026-08-02T00:00:05.000Z',
    decision: 'pass',
  });
  const campaignClosurePath = path.join(
    campaignRoot,
    'closure.receipt.json'
  );
  writeJson(campaignClosurePath, campaignClosure);
  return {
    manifest,
    lifecycleRoot,
    activationPath,
    campaignClosurePath,
    refs,
  };
}

function cloneStandaloneFixture(lifecycleOptions) {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'supervisor-readiness-standalone-')
  );
  const authorityRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'goal-contract-partition-bootstrap',
    baseline.sourceHash.slice(7)
  );
  const unitRoot = path.join(
    authorityRoot,
    'generations',
    baseline.generationKey.slice(7)
  );
  fs.mkdirSync(path.dirname(unitRoot), { recursive: true });
  fs.cpSync(baseline.unitRoot, unitRoot, { recursive: true });
  const activePointerPath = path.join(
    authorityRoot,
    'active-generation.json'
  );
  const pointer = {
    ...baseline.pointer,
    generationRoot: normalizePath(unitRoot),
    partitionPlanPath: normalizePath(
      path.join(unitRoot, 'partition-plan.json')
    ),
    partitionManifestPath: normalizePath(
      path.join(unitRoot, 'partition-manifest.json')
    ),
  };
  writeJson(activePointerPath, pointer);
  const lifecycle = writeLifecycle(
    repositoryRoot,
    unitRoot,
    pointer,
    lifecycleOptions
  );
  return {
    repositoryRoot,
    sourceHash: baseline.sourceHash,
    authorityRoot,
    unitRoot,
    activePointerPath,
    pointer,
    ...lifecycle,
  };
}

function requirementRecordFixture(repositoryRoot, sourceHash) {
  const requirementSetId = 'REQ-GH-T09';
  const recordPath = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    requirementSetId,
    'requirement-record.json'
  );
  const sourceDocumentHash = hash('requirement-source');
  const implementationConfirmationHash = hash(
    'requirement-confirmation'
  );
  const architectureConfirmationHash = hash(
    'architecture-confirmation'
  );
  const writers = [
    goalContractAuthorityWriterBinding({
      registryHash: hash('writer-registry'),
      architectureConfirmationHash,
    }),
  ];
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId: requirementSetId,
    requirementSetId,
    status: 'user_confirmed',
    sourcePath: 'docs/design/requirements.md',
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: requirementSetId,
        requirementSetId,
        confirmedAt: '2026-08-02T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/requirements.md',
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash: hash('confirmation-page'),
        confirmationText: 'confirmed',
        renderReportPath: 'confirmation/render-report.json',
        htmlPath: 'confirmation/confirmation.html',
      },
    ],
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry: writers,
    controlledIngestWriterRegistryHash: sha256(
      JSON.stringify({
        schemaVersion: 'controlled-ingest-writer-registry/v1',
        sourceDocumentHash,
        implementationConfirmationHash,
        writers,
      })
    ),
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash:
        architectureConfirmationHash,
    },
    nativeGoalHandoff: {
      masterImplementationPlanHash: sourceHash,
    },
    updatedAt: '2026-08-02T00:00:00.000Z',
  };
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8'
  );
  return { requirementSetId, recordPath };
}

function cloneRequirementRecordFixture() {
  const repositoryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), 'supervisor-readiness-requirement-')
  );
  const record = requirementRecordFixture(
    repositoryRoot,
    baseline.sourceHash
  );
  const authorityRoot = path.join(
    repositoryRoot,
    '_bmad-output',
    'runtime',
    'requirement-records',
    record.requirementSetId,
    'goal-contract'
  );
  const unitRoot = path.join(
    authorityRoot,
    'partition-runs',
    baseline.partitionManifest.partitionRunId
  );
  fs.mkdirSync(path.dirname(unitRoot), { recursive: true });
  fs.cpSync(baseline.unitRoot, unitRoot, { recursive: true });
  const pointer = {
    ...baseline.pointer,
    generationRoot: normalizePath(unitRoot),
    partitionPlanPath: normalizePath(
      path.join(unitRoot, 'partition-plan.json')
    ),
    partitionManifestPath: normalizePath(
      path.join(unitRoot, 'partition-manifest.json')
    ),
  };
  const lifecycle = writeLifecycle(
    repositoryRoot,
    unitRoot,
    pointer
  );
  commitRequirementRecordPartitionAuthoritySupersession({
    repositoryRoot,
    recordPath: record.recordPath,
    sourceHash: baseline.sourceHash,
    partitionRunId: baseline.partitionManifest.partitionRunId,
    authorityRoot,
    partitionPlanHash: baseline.partitionPlanHash,
    partitionManifestHash: baseline.partitionManifestHash,
    partitionManifestDocumentHash:
      baseline.partitionManifestDocumentHash,
    partitionSetHash: baseline.partitionManifest.partitionSetHash,
    eventChainProjection: hash('event-chain-projection'),
    eventId: 'goal-contract-partition-authority:REQ-GH-T09',
    recordedAt: '2026-08-02T00:00:10.000Z',
  });
  return {
    repositoryRoot,
    sourceHash: baseline.sourceHash,
    authorityRoot,
    unitRoot,
    activePointerPath: path.join(
      authorityRoot,
      'active-partition-run.json'
    ),
    ...record,
    ...lifecycle,
  };
}

function replaceFileWithSymlink(testContext, filePath) {
  const targetPath = `${filePath}.canonical`;
  fs.renameSync(filePath, targetPath);
  try {
    fs.symlinkSync(targetPath, filePath, 'file');
    return true;
  } catch (error) {
    if (
      process.platform === 'win32' &&
      error &&
      typeof error === 'object' &&
      (error.code === 'EPERM' || error.code === 'EACCES')
    ) {
      testContext.skip(`Windows file symlink capability unavailable: ${error.code}`);
      return false;
    }
    throw error;
  }
}

function snapshotAuthorityFiles(root) {
  const records = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const target = path.join(directory, entry.name);
      const metadata = fs.lstatSync(target);
      if (metadata.isDirectory()) {
        visit(target);
      } else if (metadata.isFile()) {
        records.push({
          path: normalizePath(path.relative(root, target)),
          stat: {
            mode: metadata.mode,
            size: metadata.size,
            mtimeMs: metadata.mtimeMs,
            ctimeMs: metadata.ctimeMs,
          },
          hash: sha256(fs.readFileSync(target)),
        });
      }
    }
  }
  visit(root);
  return records.sort((left, right) =>
    left.path.localeCompare(right.path)
  );
}

before(() => {
  baseline = createBaselineAuthority();
});

describe('goal contract supervisor readiness projection', () => {
  it('exposes readiness resolution through the canonical control-plane facade', () => {
    assert.equal(
      controlPlane.resolveSupervisorReadinessProjection,
      resolveSupervisorReadinessProjection
    );
  });

  it('resolves a complete standalone projection in manifest topology order without mutating authority bytes', () => {
    const fixture = cloneStandaloneFixture();
    const beforeAuthority = snapshotAuthorityFiles(
      fixture.authorityRoot
    );

    const projection = resolveSupervisorReadinessProjection({
      repositoryRoot: fixture.repositoryRoot,
      sourceHash: fixture.sourceHash,
    });

    assert.deepEqual(
      projection.partitions.map((partition) => partition.partitionId),
      fixture.manifest.topologicalOrder
    );
    assert.deepEqual(
      projection.partitions.map((partition) => partition.dagOrder),
      fixture.manifest.topologicalOrder.map((_, index) => index)
    );
    assert.ok(
      fixture.manifest.partitions.some(
        (partition) => partition.dependencyPartitionIds.length > 0
      ),
      'fixture must exercise a manifest DAG chain'
    );
    assert.equal(
      projection.partitions.every(
        (partition) =>
          partition.rootGoalId === fixture.manifest.goalContractHash
      ),
      true
    );
    for (const row of projection.partitions) {
      assert.equal(Object.keys(row).length, 12);
      assert.deepEqual(
        Object.keys(row).sort(),
        PARTITION_PROJECTION_FIELDS
      );
    }
    assert.deepEqual(
      validateGoalContractSchema(PROJECTION_SCHEMA, projection),
      projection
    );
    assert.deepEqual(
      snapshotAuthorityFiles(fixture.authorityRoot),
      beforeAuthority
    );
  });

  it('resolves the RequirementRecord active projection only when it matches the committed record', () => {
    const fixture = cloneRequirementRecordFixture();
    const requirementRoot = path.dirname(fixture.recordPath);
    const beforeAuthority = snapshotAuthorityFiles(requirementRoot);

    const projection = resolveSupervisorReadinessProjection({
      repositoryRoot: fixture.repositoryRoot,
      sourceHash: fixture.sourceHash,
      requirementSetId: fixture.requirementSetId,
    });

    assert.equal(projection.authorityMode, 'requirement_record');
    assert.equal(
      projection.partitionRunId,
      baseline.partitionManifest.partitionRunId
    );
    assert.equal(
      projection.requirementSetId,
      fixture.requirementSetId
    );
    assert.deepEqual(
      snapshotAuthorityFiles(requirementRoot),
      beforeAuthority
    );
  });

  it('rejects caller-owned authority path overrides', () => {
    const fixture = cloneStandaloneFixture();
    for (const [field, value] of [
      ['activePointerPath', fixture.activePointerPath],
      ['unitRoot', fixture.unitRoot],
      [
        'manifestPath',
        path.join(fixture.unitRoot, 'partition-manifest.json'),
      ],
    ]) {
      assert.throws(
        () =>
          resolveSupervisorReadinessProjection({
            repositoryRoot: fixture.repositoryRoot,
            sourceHash: fixture.sourceHash,
            [field]: value,
          }),
        (error) =>
          error.failureClass ===
            'supervisor_readiness_authority_override_rejected' &&
          error.forbiddenFields.includes(field),
        field
      );
    }
  });

  it('rejects a missing lifecycle reference', () => {
    const fixture = cloneStandaloneFixture();
    const firstPartitionId = fixture.manifest.topologicalOrder[0];
    fs.rmSync(fixture.refs.evidence.get(firstPartitionId));

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_lifecycle_reference_missing'
    );
  });

  it('rejects stale lifecycle bytes even when the local schema remains valid', () => {
    const fixture = cloneStandaloneFixture();
    const firstPartitionId = fixture.manifest.topologicalOrder[0];
    const target = fixture.refs.lease.get(firstPartitionId);
    const lease = JSON.parse(fs.readFileSync(target, 'utf8'));
    const { receiptHash: _ignored, ...payload } = lease;
    writeJson(
      target,
      signed({
        ...payload,
        partitionPlanHash: hash('stale-partition-plan'),
      })
    );

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_lifecycle_reference_stale'
    );
  });

  it('rejects duplicate lifecycle authority for one partition', () => {
    const fixture = cloneStandaloneFixture();
    const firstPartitionId = fixture.manifest.topologicalOrder[0];
    const source = fixture.refs.lease.get(firstPartitionId);
    const duplicate = path.join(
      path.dirname(source),
      `duplicate-${firstPartitionId}.receipt.json`
    );
    fs.copyFileSync(source, duplicate);

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_lifecycle_reference_duplicate'
    );
  });

  it('rejects a lifecycle record bound to another child authority', () => {
    const fixture = cloneStandaloneFixture();
    const [firstPartitionId] = fixture.manifest.topologicalOrder;
    const target = fixture.refs.lease.get(firstPartitionId);
    const lease = JSON.parse(fs.readFileSync(target, 'utf8'));
    const { receiptHash: _ignored, ...payload } = lease;
    writeJson(
      target,
      signed({
        ...payload,
        childContractHash: hash('foreign-child-authority'),
      })
    );

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_cross_partition_reference'
    );
  });

  it('rejects an active pointer whose generation root escapes the canonical authority root', () => {
    const fixture = cloneStandaloneFixture();
    const pointer = JSON.parse(
      fs.readFileSync(fixture.activePointerPath, 'utf8')
    );
    writeJson(fixture.activePointerPath, {
      ...pointer,
      generationRoot: normalizePath(
        path.join(fixture.repositoryRoot, 'escaped-generation')
      ),
    });

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_authority_path_escape'
    );
  });

  it('rejects pointer and immutable manifest hash mismatch', () => {
    const fixture = cloneStandaloneFixture();
    const pointer = JSON.parse(
      fs.readFileSync(fixture.activePointerPath, 'utf8')
    );
    writeJson(fixture.activePointerPath, {
      ...pointer,
      partitionManifestHash: hash('stale-manifest'),
    });

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_active_authority_mismatch'
    );
  });

  it('rejects predecessor closure hashes that disagree with the manifest DAG', () => {
    const stalePredecessorHash = hash('stale-predecessor-closure');
    const transforms = {
      leaseTransform(payload, { partition }) {
        return partition.dependencyPartitionIds.length === 0
          ? payload
          : {
              ...payload,
              predecessorClosureReceiptHashes: [
                stalePredecessorHash,
              ],
            };
      },
      closureTransform(payload, { partition }) {
        return partition.dependencyPartitionIds.length === 0
          ? payload
          : {
              ...payload,
              predecessorClosureReceiptHashes: [
                stalePredecessorHash,
              ],
            };
      },
    };
    const fixture = cloneStandaloneFixture(transforms);

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_lifecycle_reference_stale'
    );
  });

  it('rejects a lease ordinal that disagrees with manifest topological order', () => {
    const fixture = cloneStandaloneFixture({
      leaseTransform(payload, { index }) {
        return index === 0
          ? { ...payload, leaseOrdinal: index + 2 }
          : payload;
      },
    });

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_lifecycle_reference_stale'
    );
  });

  for (const field of [
    'masterSourceHash',
    'sourceSnapshotHash',
    'partitionManifestHash',
  ]) {
    it(`rejects a release receipt with stale ${field}`, () => {
      const fixture = cloneStandaloneFixture({
        releaseTransform(receipt, { index }) {
          return index === 0
            ? {
                ...receipt,
                [field]: hash(`stale-release-${field}`),
              }
            : receipt;
        },
      });

      assert.throws(
        () =>
          resolveSupervisorReadinessProjection({
            repositoryRoot: fixture.repositoryRoot,
            sourceHash: fixture.sourceHash,
          }),
        (error) =>
          error.failureClass ===
          'supervisor_readiness_lifecycle_reference_stale'
      );
    });
  }

  it('rejects a standalone active-generation symlink as canonical authority', (t) => {
    const fixture = cloneStandaloneFixture();
    if (!replaceFileWithSymlink(t, fixture.activePointerPath)) return;

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_authority_path_escape'
    );
  });

  it('rejects a RequirementRecord active-partition-run symlink as canonical authority', (t) => {
    const fixture = cloneRequirementRecordFixture();
    if (!replaceFileWithSymlink(t, fixture.activePointerPath)) return;

    assert.throws(
      () =>
        resolveSupervisorReadinessProjection({
          repositoryRoot: fixture.repositoryRoot,
          sourceHash: fixture.sourceHash,
          requirementSetId: fixture.requirementSetId,
        }),
      (error) =>
        error.failureClass ===
        'supervisor_readiness_authority_path_escape'
    );
  });

  it('rejects POSIX and Windows traversal in projection-relative paths', () => {
    const fixture = cloneStandaloneFixture();
    const projection = resolveSupervisorReadinessProjection({
      repositoryRoot: fixture.repositoryRoot,
      sourceHash: fixture.sourceHash,
    });

    for (const separator of ['/', '\\']) {
      const candidate = structuredClone(projection);
      candidate.partitions[0].childContractPath =
        `children/safe${separator}..${separator}escaped.md`;
      candidate.partitions[0].leaseRef.path =
        `lifecycle/safe${separator}..${separator}escaped.json`;
      assert.throws(() =>
        validateGoalContractSchema(PROJECTION_SCHEMA, candidate)
      );
    }
  });
});
