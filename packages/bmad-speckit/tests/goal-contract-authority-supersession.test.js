const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { describe, it } = require('node:test');
const Ajv2020 = require('ajv/dist/2020');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  activateStandalonePartitionGeneration,
  goalContractAuthorityWriterBinding,
  preflightRequirementRecordPartitionAuthoritySupersession,
} = require('../src/utils/goal-contract/control-plane/partition-output-paths.ts');
const {
  activateGoalCampaignFromSuccessorAuthority,
} = require('../src/utils/goal-contract/control-plane/campaign-activation.ts');

const MODULE_PATH =
  '../src/utils/goal-contract/control-plane/authority-supersession.ts';
const SOURCE_COMMAND = path.resolve(
  __dirname,
  '..',
  'src',
  'commands',
  'goal-contract.ts'
);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SOURCE_RUNNER = [
  'const { goalContractCommand } = require(process.argv[1]);',
  'Promise.resolve(goalContractCommand({}, process.argv.slice(2)))',
  '.then((code)=>{process.exitCode=code;})',
  '.catch((error)=>{console.error(error);process.exitCode=1;});',
].join('');
const {
  commitRequirementRecordPartitionAuthoritySupersession,
  recoverRequirementRecordPartitionAuthorityProjection,
  readRequirementRecordPartitionAuthorityProjection,
  loadAuthoritySupersessionForRelease,
  prepareRequirementRecordPartitionAuthoritySupersession,
  prepareAuthoritySupersession,
  promoteAuthoritySupersessionAttempt,
  projectRequirementRecordPartitionAuthority,
  stageAuthoritySupersessionAttempt,
  verifyAuthoritySupersessionReceipt,
} = require(MODULE_PATH);
const {
  partitionCompilerIdentityAssetPaths,
} = require('../src/commands/goal-contract.ts');

const hash = (value) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const sha256Json = (value) => hash(JSON.stringify(value));
const canonicalText = (value) =>
  `${JSON.stringify(value, null, 2)}\n`;
const partitionId = (value) =>
  `partition-${createHash('sha256').update(value).digest('hex')}`;

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, canonicalText(value), 'utf8');
}

function runSourceCommand(args, { cwd = path.dirname(SOURCE_COMMAND) } = {}) {
  return spawnSync(
    process.execPath,
    ['-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
    }
  );
}

function requirementRecordFixture({
  root,
  sourceHash,
  authorized = true,
  tamperWriterBinding = false,
  invalidWriterRegistryHash = false,
}) {
  const recordId = 'REQ-GH-004';
  const recordPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'requirement-record.json'
  );
  const sourceDocumentHash = hash('requirement-source');
  const implementationConfirmationHash = hash('requirement-confirmation');
  const architectureConfirmationHash = hash(
    'requirement-architecture-confirmation'
  );
  let controlledIngestWriterRegistry = authorized
    ? [
        goalContractAuthorityWriterBinding({
          registryHash: hash('goal-contract-writer-registry-source'),
          architectureConfirmationHash,
        }),
      ]
    : [];
  if (tamperWriterBinding) {
    controlledIngestWriterRegistry = [
      {
        ...controlledIngestWriterRegistry[0],
        scriptContentHash: hash('stale-writer-script'),
      },
    ];
  }
  if (invalidWriterRegistryHash) {
    controlledIngestWriterRegistry = [
      {
        ...controlledIngestWriterRegistry[0],
        registryHash: 'invalid-registry-hash',
      },
    ];
  }
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId,
    requirementSetId: recordId,
    status: 'user_confirmed',
    sourcePath: 'docs/design/requirement-source.md',
    sourceDocumentHash,
    implementationConfirmationHash,
    semanticModelHash: hash('requirement-semantics'),
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId,
        requirementSetId: recordId,
        confirmedAt: '2026-08-01T00:00:00.000Z',
        confirmedBy: 'user',
        sourcePath: 'docs/design/requirement-source.md',
        sourceDocumentHash,
        implementationConfirmationHash,
        confirmationPageHash: hash('confirmation-page'),
        confirmationText: 'confirmed',
        renderReportPath: 'confirmation/render-report.json',
        htmlPath: 'confirmation/confirmation.html',
      },
    ],
    controlledIngestWriterRegistryRequired: true,
    controlledIngestWriterRegistry,
    controlledIngestWriterRegistryHash: sha256Json({
      schemaVersion: 'controlled-ingest-writer-registry/v1',
      sourceDocumentHash,
      implementationConfirmationHash,
      writers: controlledIngestWriterRegistry,
    }),
    architectureConfirmationState: {
      status: 'active',
      currentArchitectureConfirmationHash:
        architectureConfirmationHash,
    },
    nativeGoalHandoff: {
      masterImplementationPlanHash: sourceHash,
    },
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  writeJson(recordPath, record);
  return {
    repositoryRoot: path.resolve(root),
    record,
    recordPath,
    authorityRoot: path.join(
      root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      recordId,
      'goal-contract'
    ),
  };
}

function requirementRecordAuthorityInput(fixture, sourceHash) {
  return {
    repositoryRoot: fixture.repositoryRoot,
    recordPath: fixture.recordPath,
    sourceHash,
    partitionRunId: `partition-run-${'a'.repeat(64)}`,
    authorityRoot: fixture.authorityRoot,
    partitionPlanHash: hash('requirement-record-partition-plan'),
    partitionManifestHash: hash('requirement-record-partition-manifest'),
    partitionManifestDocumentHash: hash(
      'requirement-record-partition-manifest-document'
    ),
    partitionSetHash: hash('requirement-record-partition-set'),
    eventChainProjection: hash('requirement-record-event-chain-projection'),
    recordedAt: '2026-08-01T00:00:01.000Z',
  };
}

function writePartitionSourcePlan(root) {
  const sourcePath = path.join(root, 'partition-source-plan.md');
  fs.writeFileSync(
    sourcePath,
    [
      '# Partition Source Plan',
      '',
      '## Implementation Task Breakdown',
      '',
      '- [ ] TASK-001: MUST create deterministic partition input.',
      '',
      '## Acceptance Criteria',
      '',
      '- [ ] AC-001: MUST prove exact source coverage.',
      '',
      '## Completion Evidence Packet',
      '',
      '- [ ] EVD-001: MUST bind the exact source bytes.',
      '',
      '## Required Test Commands',
      '',
      '- [ ] CMD-001: Run `node --version`.',
      '',
    ].join('\n'),
    'utf8'
  );
  return sourcePath;
}

function writeFrozenPartitionContract(root, sourcePlanPath) {
  const sourcePlanHash = hash(fs.readFileSync(sourcePlanPath));
  const goalContractPath = path.join(
    root,
    'partition-frozen-goal-contract.md'
  );
  const coverageReceiptPath = path.join(
    root,
    'partition-source-coverage.json'
  );
  const generationReceiptPath = path.join(
    root,
    'partition-generation.json'
  );
  fs.writeFileSync(
    goalContractPath,
    [
      '---',
      'goalContractVersion: goal-execution-contract/v1',
      'contractMode: frozen',
      'rewritePolicy: forbidden',
      `sourcePlanPath: ${sourcePlanPath.replace(/\\/gu, '/')}`,
      `sourcePlanHash: ${sourcePlanHash}`,
      `coverageReceiptPath: ${coverageReceiptPath.replace(/\\/gu, '/')}`,
      `generationReceiptPath: ${generationReceiptPath.replace(/\\/gu, '/')}`,
      '---',
      '',
      '# Frozen Goal Contract',
      '',
    ].join('\n'),
    'utf8'
  );
  const goalContractDocumentHash = hash(
    fs.readFileSync(goalContractPath)
  );
  writeJson(coverageReceiptPath, {
    schemaVersion: 'goal-contract-source-coverage-receipt/v1',
    decision: 'pass',
    sourcePlanPath: sourcePlanPath.replace(/\\/gu, '/'),
    sourcePlanHash,
    goalContractDocumentHash,
    unmappedSourceObligations: [],
  });
  writeJson(generationReceiptPath, {
    schemaVersion: 'goal-contract-generation-receipt/v1',
    sourcePlanPath: sourcePlanPath.replace(/\\/gu, '/'),
    sourcePlanHash,
    goalContractDocumentHash,
    compilationReceipt: {
      profileBytesHash: hash(
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
      templateBytesHash: hash(
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

function stageValidRequirementRecordAuthority(root) {
  const sourcePath = writePartitionSourcePlan(root);
  const frozen = writeFrozenPartitionContract(root, sourcePath);
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
    { cwd: root }
  );
  assert.equal(
    generated.status,
    0,
    generated.stderr || generated.stdout
  );
  const payload = JSON.parse(generated.stdout);
  const fixture = requirementRecordFixture({
    root,
    sourceHash: frozen.sourcePlanHash,
  });
  const partitionRunId = payload.partitionManifest.partitionRunId;
  const runRoot = path.join(
    fixture.authorityRoot,
    'partition-runs',
    partitionRunId
  );
  fs.mkdirSync(path.dirname(runRoot), { recursive: true });
  fs.cpSync(payload.unitRoot, runRoot, { recursive: true });
  return {
    fixture,
    standalone: payload,
    input: {
      repositoryRoot: fixture.repositoryRoot,
      recordPath: fixture.recordPath,
      sourceHash: frozen.sourcePlanHash,
      partitionRunId,
      authorityRoot: fixture.authorityRoot,
      partitionPlanHash: payload.partitionPlanHash,
      partitionManifestHash: payload.partitionManifestHash,
      partitionManifestDocumentHash:
        payload.partitionManifestDocumentHash,
      partitionSetHash: payload.partitionManifest.partitionSetHash,
      eventChainProjection: hash(
        'requirement-record-event-chain-projection'
      ),
      recordedAt: '2026-08-01T00:00:01.000Z',
    },
  };
}

function requiredAuthorityReceiptPaths(manifest) {
  return [
    manifest.partitionAnalysisReceiptPath,
    manifest.globalCoverageReceiptPath,
    manifest.partitionImpactGraphPath,
    manifest.partitionClosureFeasibilityReceiptPath,
    manifest.partitionImpactDriftReceiptPath,
    ...manifest.partitions.flatMap((partition) => [
      partition.selectionReceiptPath,
      `receipts/children/${partition.partitionId}.compilation.json`,
      `receipts/children/${partition.partitionId}.coverage.json`,
      `receipts/children/${partition.partitionId}.generation.json`,
      `receipts/children/${partition.partitionId}.membership.json`,
    ]),
  ];
}

function coverageRecord({
  id,
  partition,
  dependencyPartitionIds = [],
  ownedArtifactPaths,
}) {
  return {
    partitionId: partition,
    primaryTaskIds: [`task-${id}`],
    primaryTraceSliceIds: [`trace-${id}`],
    primarySourceObligationIds: [`source-${id}`],
    completionPredicateIds: [`acceptance-${id}`],
    acceptanceIds: [`acceptance-${id}`],
    commandIds: [`command-${id}`],
    evidenceContractIds: [`evidence-${id}`],
    dependencyPartitionIds,
    inheritedConstraintIds: [],
    ownedArtifactPaths,
    sharedArtifactDependencies: [],
    compatibilityReceiptRequirements: [],
    partitionRole: 'implementation',
    specSpanRefs: [],
    subordinateCoverageReceiptHashes: [],
  };
}

function fixture({
  successorCommandIds = [],
  coverageCommandIds = null,
} = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'authority-supersession-')
  );
  const parentPlanPath = path.join(root, 'parent-plan.md');
  fs.writeFileSync(parentPlanPath, '# Frozen plan\n', 'utf8');
  const parentPlanHash = hash(fs.readFileSync(parentPlanPath));
  const governedA = path.join(root, 'src', 'a.ts');
  const governedB = path.join(root, 'src', 'b.ts');
  fs.mkdirSync(path.dirname(governedA), { recursive: true });
  fs.writeFileSync(governedA, 'export const a = 1;\n', 'utf8');
  fs.writeFileSync(governedB, 'export const b = 2;\n', 'utf8');

  const oldA = partitionId('old-a');
  const oldB = partitionId('old-b');
  const newA = partitionId('new-a');
  const newB = partitionId('new-b');
  const oldRecords = [
    coverageRecord({
      id: 'a',
      partition: oldA,
      ownedArtifactPaths: [path.relative(root, governedA).replace(/\\/gu, '/')],
    }),
    coverageRecord({
      id: 'b',
      partition: oldB,
      dependencyPartitionIds: [oldA],
      ownedArtifactPaths: [path.relative(root, governedB).replace(/\\/gu, '/')],
    }),
  ];
  const newRecords = [
    coverageRecord({
      id: 'a',
      partition: newA,
      ownedArtifactPaths: oldRecords[0].ownedArtifactPaths,
    }),
    coverageRecord({
      id: 'b',
      partition: newB,
      dependencyPartitionIds: [newA],
      ownedArtifactPaths: oldRecords[1].ownedArtifactPaths,
    }),
  ];
  newRecords[0].commandIds = [
    ...newRecords[0].commandIds,
    ...successorCommandIds,
  ].sort();
  const oldManifest = {
    schemaVersion: 'goal-contract-partition-manifest/v1',
    partitionSetHash: hash('old-partition-set'),
    topologicalOrder: [oldA, oldB],
    partitions: oldRecords,
  };
  const oldManifestPath = path.join(root, 'old-manifest.json');
  writeJson(oldManifestPath, oldManifest);
  const oldManifestHash = hash(fs.readFileSync(oldManifestPath));

  const oldChildren = oldRecords.map((record, index) => {
    const outputPath = path.join(root, 'old-children', `p${index + 1}.md`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
      outputPath,
      `# Old child ${index + 1}\n`,
      'utf8'
    );
    const outputHash = hash(fs.readFileSync(outputPath));
    return {
      ordinal: index + 1,
      partitionId: record.partitionId,
      primaryTaskIds: record.primaryTaskIds,
      outputPath,
      outputHash,
      goalContractHash: outputHash,
      decision: 'pass',
    };
  });
  const childrenSummary = {
    schemaVersion: 'goal-contract-partition-children-summary/v1',
    ok: true,
    expectedCount: oldChildren.length,
    generatedCount: oldChildren.length,
    sourceHash: parentPlanHash,
    manifestPath: oldManifestPath,
    manifestHash: oldManifestHash,
    partitionSetHash: oldManifest.partitionSetHash,
    failures: [],
    children: oldChildren,
  };
  const childrenSummaryPath = path.join(root, 'children-summary.json');
  writeJson(childrenSummaryPath, childrenSummary);

  const sourceCompositionPolicyHash = hash('composition-policy');
  const sourceAuthorityBundleHash = hash('source-authority');
  const selections = newRecords.map((record) => {
    const selection = {
      ...record,
      sourceCompositionPolicyHash,
      namespacedObligations: [],
      namespaceRefs: [],
      sourceArtifactRefs: [],
    };
    selection.selectionHash = hashControlPlaneValue(selection);
    return selection;
  });
  const partitionSetHash = hashControlPlaneValue(
    selections.map(
      ({ partitionId: id, selectionHash, dependencyPartitionIds }) => ({
        partitionId: id,
        selectionHash,
        dependencyPartitionIds,
      })
    )
  );
  const partitionPlan = {
    schemaVersion: 'goal-contract-partition-plan/v1',
    sourceCompositionMode: 'single_source',
    sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash: hash('ordered-sources'),
    orderedSourceBindings: [],
    sourceAuthorityBundleHash,
    canonicalIntentSemanticHash: hash('canonical-intent'),
    canonicalIntentBundleHash: hash('canonical-bundle'),
    specSpanRegistryHash: hash('spec-spans'),
    intentAuthorityAttestationHash: hash('attestation'),
    subordinateCoverageReceiptHashes: [],
    subordinateTaskMappings: [],
    namespaceOwnership: [],
    goalContractSemanticHash: hash('goal-semantics'),
    goalContractHash: hash('goal-contract'),
    methodologyProfileHash: hash('methodology'),
    executionProjectionHash: hash('projection'),
    taskDagHash: hash('task-dag'),
    integrationJoinGraphHash: hash('join-graph'),
    partitionPolicyHash: hash('partition-policy'),
    optimizerVersion: 'partition-optimizer/v1',
    selectedCandidateId: 'candidate-current',
    sequenceMode: 'disabled',
    sequenceApplicability: 'not_applicable_with_proof',
    sequenceCoverage: 'excluded',
    sequenceClosureStatus: 'not_requested',
    childContractAuthority: 'core_only',
    topologicalOrder: [newA, newB],
    partitions: newRecords,
    selections,
    coverageObligations: {
      sourceObligationIds: ['source-a', 'source-b'],
      traceSliceIds: ['trace-a', 'trace-b'],
      atomicTaskIds: ['task-a', 'task-b'],
      completionPredicateIds: ['acceptance-a', 'acceptance-b'],
      commandIds:
        coverageCommandIds ||
        newRecords.flatMap(({ commandIds }) => commandIds).sort(),
      evidenceContractIds: ['evidence-a', 'evidence-b'],
      subordinateDeclaredSourceIds: [],
    },
    dependencyEdges: [
      {
        fromPartitionId: newA,
        toPartitionId: newB,
      },
    ],
    ownerConsumerRecords: [],
    childProjectionInputs: selections.map((selection) => ({
      ...selection,
      goalContractHash: hash('goal-contract'),
      orderedSourceSnapshotSetHash: hash('ordered-sources'),
      sourceAuthorityBundleHash,
      partitionSetHash,
    })),
    partitionSetHash,
  };
  partitionPlan.partitionPlanHash =
    hashControlPlaneValue(partitionPlan);
  const childCompilationReceipts =
    partitionPlan.childProjectionInputs.map((selection, index) => {
      const childContractPath = `children/p${index + 1}.md`;
      const coverageReceiptPath =
        `receipts/children/${selection.partitionId}.coverage.json`;
      const generationReceiptPath =
        `receipts/children/${selection.partitionId}.generation.json`;
      const relativeCoveragePath = path.posix.relative(
        path.posix.dirname(childContractPath),
        coverageReceiptPath
      );
      const relativeGenerationPath = path.posix.relative(
        path.posix.dirname(childContractPath),
        generationReceiptPath
      );
      const planPartition = newRecords[index];
      const childContractBytes = [
        '---',
        'entryScenario: standalone_goal_contract',
        `masterSourcePath: ${parentPlanPath.replace(/\\/gu, '/')}`,
        `masterSourceHash: ${parentPlanHash}`,
        `sourceSnapshotHash: ${partitionPlan.orderedSourceSnapshotSetHash}`,
        `methodologyProfileHash: ${partitionPlan.methodologyProfileHash}`,
        `methodologyProfileArtifactHash: ${hash('methodology-artifact')}`,
        `executionProjectionHash: ${partitionPlan.executionProjectionHash}`,
        `taskDagHash: ${partitionPlan.taskDagHash}`,
        `partitionPolicyHash: ${partitionPlan.partitionPolicyHash}`,
        `partitionPolicyArtifactHash: ${hash('partition-policy-artifact')}`,
        `partitionPlanHash: ${partitionPlan.partitionPlanHash}`,
        `goalContractHash: ${partitionPlan.goalContractHash}`,
        `partitionSetHash: ${partitionSetHash}`,
        `sourceCompositionPolicyHash: ${sourceCompositionPolicyHash}`,
        `orderedSourceSnapshotSetHash: ${partitionPlan.orderedSourceSnapshotSetHash}`,
        `sourceAuthorityBundleHash: ${sourceAuthorityBundleHash}`,
        `partitionAnalysisReceiptHash: ${partitionPlan.partitionPlanHash}`,
        `partitionId: ${selection.partitionId}`,
        `partitionRole: ${planPartition.partitionRole}`,
        `selectionSetHash: ${selection.selectionHash}`,
        `dependencyPartitionIds: ${JSON.stringify(
          planPartition.dependencyPartitionIds
        )}`,
        `subordinateCoverageReceiptHashes: ${JSON.stringify(
          planPartition.subordinateCoverageReceiptHashes
        )}`,
        `obligationRefs: ${JSON.stringify([
          ...planPartition.primarySourceObligationIds,
          ...planPartition.primaryTraceSliceIds,
          ...planPartition.primaryTaskIds,
          ...planPartition.completionPredicateIds,
          ...planPartition.commandIds,
          ...planPartition.evidenceContractIds,
        ].sort())}`,
        'namespaceRefs: []',
        'sourceArtifactRefs: []',
        'specSpanRefs: []',
        `governedPaths: ${JSON.stringify(planPartition.ownedArtifactPaths)}`,
        `sequenceMode: ${partitionPlan.sequenceMode}`,
        `sequenceApplicability: ${partitionPlan.sequenceApplicability}`,
        `sequenceCoverage: ${partitionPlan.sequenceCoverage}`,
        `sequenceClosureStatus: ${partitionPlan.sequenceClosureStatus}`,
        `childContractAuthority: ${partitionPlan.childContractAuthority}`,
        `coverageReceiptPath: ${relativeCoveragePath}`,
        `generationReceiptPath: ${relativeGenerationPath}`,
        '---',
        `# New child ${index + 1}`,
        ...planPartition.primaryTaskIds,
        ...planPartition.completionPredicateIds,
        '',
      ].join('\n');
      return {
        schemaVersion:
          'goal-contract-pending-child-compilation-receipt/v1',
        membershipStatus: 'pending',
        displayOrdinal: index + 1,
        partitionId: selection.partitionId,
        childContractPath,
        childContractHash: hash(childContractBytes),
        partitionPlanHash: partitionPlan.partitionPlanHash,
        partitionSetHash,
        selectionHash: selection.selectionHash,
        receiptHash: hash(`pending-${index}`),
        childContractBytes,
      };
    });
  const orderedChildContractHashes = childCompilationReceipts.map(
    ({ childContractHash }) => childContractHash
  );
  const semanticManifestHash = hashControlPlaneValue({
    goalContractHash: partitionPlan.goalContractHash,
    sourceCompositionPolicyHash,
    sourceAuthorityBundleHash,
    partitionPolicyHash: partitionPlan.partitionPolicyHash,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash,
    orderedChildContractHashes,
  });
  const partitionRunId = `partition-run-${createHash('sha256')
    .update(partitionPlan.partitionPlanHash)
    .digest('hex')}`;
  const manifestPartitions = childCompilationReceipts.map(
    (receipt, index) => {
      const record = newRecords[index];
      const membership = {
        ...record,
        displayOrdinal: index + 1,
        displayTitle: `Partition ${index + 1}`,
        partitionPlanHash: partitionPlan.partitionPlanHash,
        sourceCompositionPolicyHash,
        goalContractHash: partitionPlan.goalContractHash,
        orderedSourceSnapshotSetHash:
          partitionPlan.orderedSourceSnapshotSetHash,
        sourceAuthorityBundleHash,
        obligationRefs: [
          ...record.primarySourceObligationIds,
          ...record.primaryTraceSliceIds,
          ...record.primaryTaskIds,
          ...record.completionPredicateIds,
          ...record.commandIds,
          ...record.evidenceContractIds,
        ].sort(),
        namespacedObligations: [],
        namespaceRefs: [],
        sourceArtifactRefs: [],
        governedPaths: record.ownedArtifactPaths,
        childContractPath: receipt.childContractPath,
        childContractHash: receipt.childContractHash,
        childCompilationReceiptHash: receipt.receiptHash,
        selectionSetHash: selections[index].selectionHash,
        selectionReceiptPath:
          `partition-runs/${partitionRunId}/partitions/` +
          `${receipt.partitionId}/selection.receipt.json`,
        executionLeaseRequired: true,
      };
      return {
        ...membership,
        childMembershipHash:
          hashControlPlaneValue(membership),
      };
    }
  );
  const partitionManifest = {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    manifestAuthorityMode: 'final_child_membership',
    partitionRunId,
    masterSourcePath: parentPlanPath,
    masterSourceHash: parentPlanHash,
    sourceSnapshotHash: partitionPlan.orderedSourceSnapshotSetHash,
    methodologyProfileHash: partitionPlan.methodologyProfileHash,
    sourceCompositionMode: partitionPlan.sourceCompositionMode,
    sourceCompositionPolicyHash:
      partitionPlan.sourceCompositionPolicyHash,
    orderedSourceSnapshotSetHash:
      partitionPlan.orderedSourceSnapshotSetHash,
    orderedSourceBindings:
      partitionPlan.orderedSourceBindings,
    sourceAuthorityBundleHash:
      partitionPlan.sourceAuthorityBundleHash,
    canonicalIntentSemanticHash:
      partitionPlan.canonicalIntentSemanticHash,
    canonicalIntentBundleHash:
      partitionPlan.canonicalIntentBundleHash,
    intentAuthorityAttestationHash:
      partitionPlan.intentAuthorityAttestationHash,
    goalContractSemanticHash:
      partitionPlan.goalContractSemanticHash,
    executionProjectionHash: partitionPlan.executionProjectionHash,
    taskDagHash: partitionPlan.taskDagHash,
    sequenceMode: partitionPlan.sequenceMode,
    sequenceApplicability: partitionPlan.sequenceApplicability,
    sequenceCoverage: partitionPlan.sequenceCoverage,
    sequenceClosureStatus: partitionPlan.sequenceClosureStatus,
    childContractAuthority: partitionPlan.childContractAuthority,
    partitionManifestHash: semanticManifestHash,
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionAnalysisReceiptPath:
      `partition-runs/${partitionRunId}/partition-plan.json`,
    partitionAnalysisReceiptHash: partitionPlan.partitionPlanHash,
    partitionSetHash,
    partitionCount: 2,
    topologicalOrder: [newA, newB],
    orderedChildContractHashes,
    goalContractHash: partitionPlan.goalContractHash,
    partitionPolicyHash: partitionPlan.partitionPolicyHash,
    optimizerVersion: partitionPlan.optimizerVersion,
    selectedCandidateId: partitionPlan.selectedCandidateId,
    specSpanRegistryHash: partitionPlan.specSpanRegistryHash,
    subordinateCoverageReceiptHashes: [],
    namespaceOwnership: partitionPlan.namespaceOwnership,
    subordinateTaskMappings:
      partitionPlan.subordinateTaskMappings,
    coverage: {
      requiredObligationIds:
        partitionPlan.coverageObligations.sourceObligationIds,
      coveredObligationIds:
        partitionPlan.coverageObligations.sourceObligationIds,
      uncoveredObligationIds: [],
      duplicateObligationIds: [],
      unmappedObligationIds: [],
      scopeEscapeObligationIds: [],
    },
    globalCoverageReceiptPath:
      `partition-runs/${partitionRunId}/global-coverage.receipt.json`,
    partitions: manifestPartitions,
  };
  const partitionManifestBytes = canonicalText(partitionManifest);
  const executionProjectionBundle = {
    schemaVersion: 'goal-contract-execution-projection-bundle/v1',
    partitionPlanHash: partitionPlan.partitionPlanHash,
    partitionSetHash,
    childCompilationReceipts,
    orderedChildContractHashes,
    partitionManifest,
    partitionManifestBytes,
    partitionManifestHash: semanticManifestHash,
    partitionManifestDocumentHash: hash(partitionManifestBytes),
    childMembershipReceipts: childCompilationReceipts.map(
      (receipt, index) => ({
        schemaVersion:
          'goal-contract-final-child-membership-receipt/v1',
        membershipStatus: 'final',
        displayOrdinal: index + 1,
        partitionId: receipt.partitionId,
        childContractHash: receipt.childContractHash,
        partitionManifestHash: semanticManifestHash,
        receiptHash: hash(`membership-${index}`),
      })
    ),
  };
  const checkpointPath = path.join(root, 'checkpoint-a.json');
  writeJson(checkpointPath, {
    schemaVersion: 'goal-contract-provisional-checkpoint/v1',
    attemptId: 'old-attempt',
    status: 'provisional_ready',
    parentPlanHash,
    partitionManifestHash: oldManifestHash,
    partitionSetHash: oldManifest.partitionSetHash,
    partitionId: oldA,
    childContractHash: oldChildren[0].outputHash,
    taskIds: ['task-a'],
    governedFiles: [
      {
        path: oldRecords[0].ownedArtifactPaths[0],
        bytes: fs.statSync(governedA).size,
        hash: hash(fs.readFileSync(governedA)),
      },
    ],
    commands: [],
  });
  const renderEvidence = childCompilationReceipts.map(
    (receipt, index) => ({
      partitionId: receipt.partitionId,
      displayOrdinal: index + 1,
      childContractPath: receipt.childContractPath,
      coverageReceiptPath:
        `receipts/children/${receipt.partitionId}.coverage.json`,
      generationReceiptPath:
        `receipts/children/${receipt.partitionId}.generation.json`,
      rendererAudit: {
        requiredSlotsPassed: true,
        requiredSectionsPassed: true,
        invariantFragmentsPassed: true,
      },
      deterministicPreflight: {
        decision: 'pass',
        checks: [],
      },
      commandPortabilityAudit: {
        status: 'PASS',
        issues: [],
      },
      coverageAudit: {
        decision: 'pass',
        unmappedSourceObligations: [],
      },
      implementationProofAudit: {
        decision: 'pass',
      },
    })
  );
  const releaseContext = {
    methodologyProfileArtifactHash: hash('methodology-artifact'),
    partitionPolicyArtifactHash: hash('partition-policy-artifact'),
    sequenceApplicabilityReceipt: {
      schemaVersion: 'goal-contract-sequence-applicability-receipt/v1',
      sourceSnapshotHash: partitionPlan.orderedSourceSnapshotSetHash,
      semanticModelHash: partitionPlan.goalContractSemanticHash,
      traceGraphHash: partitionPlan.integrationJoinGraphHash,
      policyVersion: 'fixture-policy/v1',
      decision: partitionPlan.sequenceApplicability,
      blockingReasons: [],
    },
    renderEvidence,
  };

  return {
    root,
    parentPlanPath,
    parentPlanHash,
    oldManifest,
    oldManifestPath,
    oldManifestHash,
    oldChildren,
    childrenSummaryPath,
    childrenSummaryHash: hash(fs.readFileSync(childrenSummaryPath)),
    checkpointPath,
    partitionPlan,
    partitionPlanBytes: canonicalText(partitionPlan),
    successorSelectionManifest: {
      partitions: structuredClone(newRecords),
    },
    executionProjectionBundle,
    releaseContext,
  };
}

function prepare(input, overrides = {}) {
  return prepareAuthoritySupersession({
    repositoryRoot: input.root,
    attemptId: 'bootstrap-supersession-001',
    supersededAuthority: {
      parentPlanPath: input.parentPlanPath,
      parentPlanHash: input.parentPlanHash,
      partitionManifestPath: input.oldManifestPath,
      partitionManifestHash: input.oldManifestHash,
      partitionSetHash: input.oldManifest.partitionSetHash,
      childrenSummaryPath: input.childrenSummaryPath,
      childrenSummaryHash: input.childrenSummaryHash,
    },
    successorAuthority: {
      partitionPlan: input.partitionPlan,
      partitionPlanBytes: input.partitionPlanBytes,
      executionProjectionBundle: input.executionProjectionBundle,
      successorSelectionManifest:
        input.successorSelectionManifest,
      compilerIdentityHash: hash('compiler-identity'),
      sourceIdentity: {
        sourcePath: input.parentPlanPath,
        sourceHash: input.parentPlanHash,
        sourceSnapshotHash: input.parentPlanHash,
      },
      releaseContext: input.releaseContext,
    },
    checkpointPaths: [input.checkpointPath],
    ...overrides,
  });
}

function successorActivationFixture() {
  const input = fixture();
  const prepared = prepare(input, {
    supersessionMode: 'source_grounded_hard_cut',
  });
  const finalRoot = path.join(
    input.root,
    'authority-v2-campaign-activation'
  );
  const staged = stageAuthoritySupersessionAttempt({
    prepared,
    finalRoot,
  });
  promoteAuthoritySupersessionAttempt({ staged });
  const manifest = JSON.parse(
    fs.readFileSync(path.join(finalRoot, 'partition-manifest.json'), 'utf8')
  );
  const childReleaseGateReceipts = manifest.partitions.map((partition) => {
    const result = runSourceCommand([
      'release-gate',
      '--goal',
      path.join(finalRoot, partition.childContractPath),
      '--source',
      input.parentPlanPath,
      '--partition-manifest',
      path.join(finalRoot, 'partition-manifest.json'),
      '--json',
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout);
  });
  const request = {
    authorityRoot: finalRoot,
    receiptRoot: path.join(input.root, 'campaign-receipts'),
    childReleaseGateReceipts,
    executionAuthorization: {
      authorizerIdentity: 'user:frozen-successor-test',
      authorizationKind: 'user_explicit',
      authorizedSourceCompositionPolicyHash:
        manifest.sourceCompositionPolicyHash,
      authorizedGoalContractHash: manifest.goalContractHash,
      authorizedPartitionManifestHash:
        manifest.partitionManifestHash,
      authorizedPartitionSetHash: manifest.partitionSetHash,
      authorizationSourceHash: hash('authorization-source'),
      authorizationStatementHash: hash('authorization-statement'),
    },
    attemptId: prepared.attemptId,
    activatedAt: '2026-07-29T15:30:00.000Z',
  };
  return {
    input,
    prepared,
    finalRoot,
    manifest,
    childReleaseGateReceipts,
    request,
  };
}

describe('goal contract authority supersession', () => {
  it('binds partition closure scope classification into compiler identity', () => {
    const assetPaths = partitionCompilerIdentityAssetPaths().map((assetPath) =>
      assetPath.replace(/\\/gu, '/')
    );

    assert.equal(
      assetPaths.some((assetPath) =>
        assetPath.endsWith(
          '/utils/goal-contract/control-plane/partition-closure-scope.ts'
        )
      ),
      true
    );
  });

  it('exposes the package-owned supersession lifecycle', () => {
    let lifecycle;
    assert.doesNotThrow(() => {
      lifecycle = require(MODULE_PATH);
    });
    for (const name of [
      'prepareAuthoritySupersession',
      'stageAuthoritySupersessionAttempt',
      'promoteAuthoritySupersessionAttempt',
      'verifyAuthoritySupersessionReceipt',
      'loadAuthoritySupersessionForRelease',
    ]) {
      assert.equal(typeof lifecycle[name], 'function', name);
    }
  });

  it('exposes RequirementRecord supersession and projection through the control-plane facade', () => {
    const controlPlane = require(
      '../src/utils/goal-contract/control-plane/index.ts'
    );
    for (const name of [
      'commitRequirementRecordPartitionAuthoritySupersession',
      'readRequirementRecordPartitionAuthorityProjection',
      'recoverRequirementRecordPartitionAuthorityProjection',
    ]) {
      assert.equal(typeof controlPlane[name], 'function', name);
    }
  });

  it('prepares and projects RequirementRecord authority only for the bound source identity', () => {
    const sourceHash = hash('goal-source');
    const record = {
      recordId: 'REQ-GH-004',
      requirementSetId: 'REQ-GH-004',
      nativeGoalHandoff: {
        masterImplementationPlanHash: sourceHash,
      },
    };
    const prepared = prepareRequirementRecordPartitionAuthoritySupersession({
      record,
      sourceHash,
      partitionRunId: `partition-run-${'a'.repeat(64)}`,
      authorityRoot: '_bmad-output/runtime/requirement-records/REQ-GH-004/goal-contract',
      partitionPlanHash: hash('partition-plan'),
      partitionManifestHash: hash('partition-manifest'),
      partitionManifestDocumentHash: hash('partition-manifest-document'),
      partitionSetHash: hash('partition-set'),
      eventChainProjection: hash('pointer-projection'),
    });
    const reduced = prepared.reduce(record);

    assert.equal(
      prepared.writerId,
      'goal-contract-authority-supersession'
    );
    assert.equal(
      prepared.eventType,
      'goal_contract_partition_authority_superseded'
    );
    assert.equal(
      reduced.nativeGoalHandoff.goalContractPartitionAuthority.sourceHash,
      sourceHash
    );
    assert.deepEqual(
      projectRequirementRecordPartitionAuthority(reduced),
      prepared.payload
    );
    assert.throws(
      () =>
        prepareRequirementRecordPartitionAuthoritySupersession({
          ...prepared.payload,
          record,
          sourceHash: hash('other-source'),
        }),
      (error) =>
        error.failureClass ===
        'partition_authority_source_identity_mismatch'
    );
  });

  it('preflights RequirementRecord authority without modifying record or run bytes', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const sourceHash = hash('goal-source');
    const fixture = requirementRecordFixture({
      root,
      sourceHash,
      authorized: false,
    });
    const before = fs.readFileSync(fixture.recordPath, 'utf8');

    assert.throws(
      () =>
        preflightRequirementRecordPartitionAuthoritySupersession(
          {
            ...requirementRecordAuthorityInput(fixture, sourceHash),
            requirementSetId: fixture.record.requirementSetId,
          }
        ),
      (error) =>
        error.failureClass === 'partition_authority_writer_not_authorized'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
    assert.equal(fs.existsSync(fixture.authorityRoot), false);
  });

  it('commits authorized RequirementRecord partition authority through the control store before projecting its sidecar', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const { fixture, input } =
      stageValidRequirementRecordAuthority(root);

    const committed = commitRequirementRecordPartitionAuthoritySupersession(
      input
    );

    const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
    const pointer = JSON.parse(
      fs.readFileSync(
        path.join(fixture.authorityRoot, 'active-partition-run.json'),
        'utf8'
      )
    );
    assert.equal(
      record.nativeGoalHandoff.goalContractPartitionAuthority.sourceHash,
      input.sourceHash
    );
    assert.equal(
      pointer.schemaVersion,
      'goal-contract-partition-active-requirement-record-run/v1'
    );
    assert.equal(pointer.recordPath.replace(/\\/gu, '/'), fixture.recordPath.replace(/\\/gu, '/'));
    assert.equal(pointer.recordHash, committed.afterRecordHash);
    assert.equal(pointer.recordRevision, record.recordRevision);
    assert.equal(pointer.eventChainHead, committed.event.eventHash);
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'pointer-projection-blocked.json')
      ),
      false
    );
  });

  it('rejects RequirementRecord authority when the canonical partition run is missing', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const sourceHash = hash('goal-source');
    const fixture = requirementRecordFixture({ root, sourceHash });
    const before = fs.readFileSync(fixture.recordPath, 'utf8');

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession(
          requirementRecordAuthorityInput(fixture, sourceHash)
        ),
      (error) =>
        error.failureClass === 'partition_authority_run_incomplete'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'active-partition-run.json')
      ),
      false
    );
  });

  it('rejects caller-listed standalone receipts that omit manifest-derived authority artifacts', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const { standalone } =
      stageValidRequirementRecordAuthority(root);
    const authority = {
      authorityMode: 'standalone_bootstrap',
      sourceHash: standalone.sourceHash,
      generationKey: standalone.generationKey,
      unitRoot: standalone.unitRoot,
      activePointerPath: standalone.activePointerPath,
      partitionPlanPath: standalone.partitionPlanPath,
      partitionManifestPath: standalone.partitionManifestPath,
    };
    fs.rmSync(standalone.activePointerPath, { force: true });
    const childContractPaths =
      standalone.partitionManifest.partitions.map(
        (partition) => partition.childContractPath
      );
    const requiredReceiptPaths = requiredAuthorityReceiptPaths(
      standalone.partitionManifest
    );

    assert.throws(
      () =>
        activateStandalonePartitionGeneration({
          authority,
          partitionPlanBytes: fs.readFileSync(
            standalone.partitionPlanPath
          ),
          partitionManifestBytes: fs.readFileSync(
            standalone.partitionManifestPath
          ),
          partitionManifestHash:
            standalone.partitionManifestHash,
          partitionManifestDocumentHash:
            standalone.partitionManifestDocumentHash,
          childContractPaths,
          requiredReceiptPaths: requiredReceiptPaths.slice(1),
        }),
      (error) =>
        error.failureClass ===
        'partition_authority_artifact_set_mismatch'
    );
    assert.equal(fs.existsSync(standalone.activePointerPath), false);
  });

  it('rejects tampered child bytes before committing RequirementRecord authority', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const { fixture, input } =
      stageValidRequirementRecordAuthority(root);
    const before = fs.readFileSync(fixture.recordPath, 'utf8');
    const runRoot = path.join(
      fixture.authorityRoot,
      'partition-runs',
      input.partitionRunId
    );
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(runRoot, 'partition-manifest.json'),
        'utf8'
      )
    );
    fs.appendFileSync(
      path.join(runRoot, manifest.partitions[0].childContractPath),
      '\n# tampered\n',
      'utf8'
    );

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession(input),
      (error) =>
        error.failureClass ===
        'partition_child_contract_hash_mismatch'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
  });

  it('rejects payload hashes that do not match the staged partition run', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const { fixture, input } =
      stageValidRequirementRecordAuthority(root);
    const before = fs.readFileSync(fixture.recordPath, 'utf8');

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession({
          ...input,
          partitionManifestHash: hash('mismatched-manifest'),
        }),
      (error) =>
        error.failureClass ===
        'partition_authority_payload_hash_mismatch'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
  });

  it('rejects a valid authority unit copied beneath a different partition run id', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const { fixture, input } =
      stageValidRequirementRecordAuthority(root);
    const before = fs.readFileSync(fixture.recordPath, 'utf8');
    const copiedRunId = `partition-run-${'b'.repeat(64)}`;
    fs.cpSync(
      path.join(
        fixture.authorityRoot,
        'partition-runs',
        input.partitionRunId
      ),
      path.join(
        fixture.authorityRoot,
        'partition-runs',
        copiedRunId
      ),
      { recursive: true }
    );

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession({
          ...input,
          partitionRunId: copiedRunId,
        }),
      (error) =>
        error.failureClass ===
        'partition_authority_run_binding_mismatch'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
  });

  it('rejects an unauthorized RequirementRecord writer without modifying the record or pointer', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const sourceHash = hash('goal-source');
    const fixture = requirementRecordFixture({
      root,
      sourceHash,
      authorized: false,
    });
    const before = fs.readFileSync(fixture.recordPath, 'utf8');

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession(
          requirementRecordAuthorityInput(fixture, sourceHash)
        ),
      (error) =>
        error.failureClass === 'partition_authority_writer_not_authorized'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'active-partition-run.json')
      ),
      false
    );
  });

  it('rejects a stale rich writer binding before committing the RequirementRecord', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const sourceHash = hash('goal-source');
    const fixture = requirementRecordFixture({
      root,
      sourceHash,
      tamperWriterBinding: true,
    });
    const before = fs.readFileSync(fixture.recordPath, 'utf8');

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession(
          requirementRecordAuthorityInput(fixture, sourceHash)
        ),
      (error) =>
        error.failureClass === 'partition_authority_writer_not_authorized'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'active-partition-run.json')
      ),
      false
    );
  });

  it('maps an invalid rich writer registry hash to unauthorized before committing the RequirementRecord', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const sourceHash = hash('goal-source');
    const fixture = requirementRecordFixture({
      root,
      sourceHash,
      invalidWriterRegistryHash: true,
    });
    const before = fs.readFileSync(fixture.recordPath, 'utf8');

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession(
          requirementRecordAuthorityInput(fixture, sourceHash)
        ),
      (error) =>
        error.failureClass === 'partition_authority_writer_not_authorized'
    );
    assert.equal(fs.readFileSync(fixture.recordPath, 'utf8'), before);
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'active-partition-run.json')
      ),
      false
    );
  });

  it('retains committed RequirementRecord authority, blocks pointer consumers, and recovers a failed sidecar projection deterministically', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'requirement-record-partition-authority-')
    );
    const { fixture, input } =
      stageValidRequirementRecordAuthority(root);

    assert.throws(
      () =>
        commitRequirementRecordPartitionAuthoritySupersession({
          ...input,
          writeProjection() {
            throw new Error('injected pointer projection failure');
          },
        }),
      (error) =>
        error.failureClass === 'partition_authority_pointer_projection_pending'
    );
    const committedRecord = JSON.parse(
      fs.readFileSync(fixture.recordPath, 'utf8')
    );
    assert.equal(
      committedRecord.nativeGoalHandoff.goalContractPartitionAuthority
        .partitionRunId,
      input.partitionRunId
    );
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'pointer-projection-blocked.json')
      ),
      true
    );
    assert.throws(
      () =>
        readRequirementRecordPartitionAuthorityProjection({
          recordPath: fixture.recordPath,
        }),
      (error) =>
        error.failureClass ===
        'partition_authority_pointer_projection_blocked'
    );

    const recovered = recoverRequirementRecordPartitionAuthorityProjection({
      recordPath: fixture.recordPath,
    });
    const pointer = JSON.parse(
      fs.readFileSync(recovered.pointerPath, 'utf8')
    );
    assert.equal(pointer.recordHash, committedRecord.recordHash);
    assert.equal(pointer.eventChainHead, committedRecord.eventChainHead);
    assert.equal(
      fs.existsSync(
        path.join(fixture.authorityRoot, 'pointer-projection-blocked.json')
      ),
      false
    );
  });

  it('stages and loads one successor-pinned release authority without source recompilation', () => {
    const input = fixture();
    const prepared = prepare(input, {
      supersessionMode: 'source_grounded_hard_cut',
    });
    const finalRoot = path.join(input.root, 'authority-v2-release');
    const staged = stageAuthoritySupersessionAttempt({
      prepared,
      finalRoot,
    });
    promoteAuthoritySupersessionAttempt({ staged });

    const firstPartition =
      input.executionProjectionBundle.partitionManifest.partitions[0];
    const loaded = loadAuthoritySupersessionForRelease({
      authorityRoot: finalRoot,
      partitionManifestPath: path.join(
        finalRoot,
        'partition-manifest.json'
      ),
      goalPath: path.join(
        finalRoot,
        firstPartition.childContractPath
      ),
    });

    assert.equal(loaded.authorityMode, 'successor_pinned');
    assert.equal(
      loaded.partitionPlanHash,
      input.partitionPlan.partitionPlanHash
    );
    assert.equal(
      loaded.partitionPlan.partitionSetHash,
      input.partitionPlan.partitionSetHash
    );
    assert.equal(
      loaded.compiled.manifest.partitionManifestHash,
      input.executionProjectionBundle.partitionManifestHash
    );
    for (const relativePath of [
      'release-authority.json',
      firstPartition.selectionReceiptPath,
      input.executionProjectionBundle.partitionManifest
        .globalCoverageReceiptPath,
      `receipts/children/${firstPartition.partitionId}.coverage.json`,
      `receipts/children/${firstPartition.partitionId}.generation.json`,
    ]) {
      assert.equal(
        fs.existsSync(path.join(finalRoot, relativePath)),
        true,
        relativePath
      );
    }
  });

  it('routes final v2 child release through its successor bundle instead of recompiling source', () => {
    const input = fixture();
    const prepared = prepare(input, {
      supersessionMode: 'source_grounded_hard_cut',
    });
    const finalRoot = path.join(
      input.root,
      'authority-v2-release-command'
    );
    const staged = stageAuthoritySupersessionAttempt({
      prepared,
      finalRoot,
    });
    promoteAuthoritySupersessionAttempt({ staged });
    const partition =
      input.executionProjectionBundle.partitionManifest.partitions[0];
    const result = runSourceCommand([
      'release-gate',
      '--goal',
      path.join(finalRoot, partition.childContractPath),
      '--source',
      input.parentPlanPath,
      '--partition-manifest',
      path.join(finalRoot, 'partition-manifest.json'),
      '--json',
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const release = JSON.parse(result.stdout);
    assert.equal(release.ok, true);
    assert.equal(release.decision, 'pass');
    assert.deepEqual(release.blockingReasons, []);
  });

  it('activates a verified frozen successor authority without recompiling source', () => {
    const activation = successorActivationFixture();
    const activated =
      activateGoalCampaignFromSuccessorAuthority(activation.request);

    assert.equal(activated.receipt.decision, 'pass');
    assert.equal(
      activated.receipt.partitionManifestHash,
      activation.manifest.partitionManifestHash
    );
    assert.equal(
      activated.receipt.compilerIdentityHash,
      activation.prepared.successorAuthority.compilerIdentityHash
    );
    assert.equal(fs.existsSync(activated.receiptPath), true);
  });

  it('exposes successor activation through the canonical control-plane facade', () => {
    const controlPlane = require(
      '../src/utils/goal-contract/control-plane/index.ts'
    );
    assert.equal(
      typeof controlPlane.activateGoalCampaignFromSuccessorAuthority,
      'function'
    );
  });

  it('rejects stale source bytes when activating a successor authority', () => {
    const activation = successorActivationFixture();
    fs.appendFileSync(
      activation.input.parentPlanPath,
      '\nsource mutation\n',
      'utf8'
    );
    assert.throws(
      () =>
        activateGoalCampaignFromSuccessorAuthority(activation.request),
      (error) => error.failureClass === 'primary_source_stale'
    );
  });

  it('rejects successor activation attempt replay', () => {
    const activation = successorActivationFixture();
    assert.throws(
      () =>
        activateGoalCampaignFromSuccessorAuthority({
          ...activation.request,
          attemptId: 'different-attempt',
        }),
      (error) =>
        error.failureClass ===
        'authority_supersession_replay_rejected'
    );
  });

  it('rejects blocked successor child release receipts', () => {
    const activation = successorActivationFixture();
    const blocked = structuredClone(
      activation.childReleaseGateReceipts
    );
    blocked[0].decision = 'blocked';
    blocked[0].blockingReasons = ['fixture_blocked'];
    assert.throws(
      () =>
        activateGoalCampaignFromSuccessorAuthority({
          ...activation.request,
          childReleaseGateReceipts: blocked,
        }),
      (error) =>
        error.failureClass === 'campaign_child_release_blocked'
    );
  });

  it('rejects tampered successor authority bytes before activation', () => {
    const activation = successorActivationFixture();
    fs.appendFileSync(
      path.join(activation.finalRoot, 'partition-plan.json'),
      '\n',
      'utf8'
    );
    assert.throws(
      () =>
        activateGoalCampaignFromSuccessorAuthority(activation.request),
      (error) =>
        error.failureClass ===
        'authority_supersession_stage_tampered'
    );
  });

  it('maps equivalent partitions and checkpoints without repeating implementation', () => {
    const input = fixture();
    const prepared = prepare(input);
    assert.equal(prepared.equivalence.decision, 'pass');
    assert.equal(prepared.partitionMappings.length, 2);
    assert.equal(prepared.checkpointMappings.length, 1);
    assert.equal(
      prepared.checkpointMappings[0].successorPartitionId,
      input.partitionPlan.topologicalOrder[0]
    );
    assert.equal(
      prepared.checkpointMappings[0].disposition,
      'revalidation_required'
    );
    assert.deepEqual(prepared.equivalence.specSpanRefs, {
      oldCount: 0,
      newCount: 0,
    });
    assert.deepEqual(prepared.equivalence.subordinateCoverage, {
      oldCount: 0,
      newCount: 0,
    });
  });

  it('hard cuts to source-grounded successor coverage without preserving v1 projection loss', () => {
    const input = fixture({
      successorCommandIds: ['command-restored-from-source'],
    });
    assert.throws(
      () => prepare(input),
      (error) =>
        error.failureClass ===
          'authority_supersession_coverage_not_equivalent' &&
        error.dimension === 'commands'
    );

    const prepared = prepare(input, {
      supersessionMode: 'source_grounded_hard_cut',
    });
    assert.equal(prepared.supersessionMode, 'source_grounded_hard_cut');
    assert.equal(prepared.activationMode, 'successor_only');
    assert.equal(
      prepared.sourceCoverageAuthority,
      'canonical_parent_source'
    );
    assert.equal(
      prepared.supersededDisposition,
      'superseded_non_executable'
    );
    assert.equal(prepared.sourceGroundedCoverage.decision, 'pass');
    assert.equal(
      prepared.sourceGroundedCoverage.dimensions.commands.requiredCount,
      3
    );
    assert.equal(
      prepared.sourceGroundedCoverage.dimensions.commands.coveredCount,
      3
    );
    assert.equal(prepared.equivalence.decision, 'diagnostic_only');
    assert.equal(
      prepared.checkpointMappings[0].disposition,
      'historical_evidence_only'
    );
  });

  it('rejects hard-cut successor scope that is absent from canonical source coverage', () => {
    const input = fixture({
      successorCommandIds: ['command-outside-source'],
      coverageCommandIds: ['command-a', 'command-b'],
    });
    assert.throws(
      () =>
        prepare(input, {
          supersessionMode: 'source_grounded_hard_cut',
        }),
      (error) =>
        error.failureClass ===
          'authority_supersession_source_grounded_coverage_invalid' &&
        error.dimension === 'commands' &&
        error.extra.includes('command-outside-source')
    );
  });

  it('stages hard-cut source coverage and successor-only disposition as bound receipts', () => {
    const input = fixture({
      successorCommandIds: ['command-restored-from-source'],
    });
    const prepared = prepare(input, {
      supersessionMode: 'source_grounded_hard_cut',
    });
    const finalRoot = path.join(input.root, 'authority-v2-hard-cut');
    const staged = stageAuthoritySupersessionAttempt({
      prepared,
      finalRoot,
    });
    promoteAuthoritySupersessionAttempt({ staged });

    const supersessionReceipt = JSON.parse(
      fs.readFileSync(
        path.join(finalRoot, 'authority-supersession.receipt.json'),
        'utf8'
      )
    );
    const sourceCoverageReceiptPath = path.join(
      finalRoot,
      'receipts',
      'source-grounded-coverage.receipt.json'
    );
    const legacyDiagnosticPath = path.join(
      finalRoot,
      'receipts',
      'legacy-comparison.diagnostic.json'
    );
    assert.equal(fs.existsSync(sourceCoverageReceiptPath), true);
    assert.equal(fs.existsSync(legacyDiagnosticPath), true);
    assert.equal(
      fs.existsSync(
        path.join(finalRoot, 'receipts', 'equivalence.receipt.json')
      ),
      false
    );
    const sourceCoverageReceipt = JSON.parse(
      fs.readFileSync(sourceCoverageReceiptPath, 'utf8')
    );
    assert.equal(
      supersessionReceipt.supersessionMode,
      'source_grounded_hard_cut'
    );
    assert.equal(
      supersessionReceipt.activationMode,
      'successor_only'
    );
    assert.equal(
      supersessionReceipt.sourceCoverageAuthority,
      'canonical_parent_source'
    );
    assert.equal(
      supersessionReceipt.supersededDisposition,
      'superseded_non_executable'
    );
    assert.equal(
      supersessionReceipt.sourceGroundedCoverageHash,
      sourceCoverageReceipt.receiptHash
    );
  });

  it('records historical checkpoint scope drift without granting it v2 closure authority', () => {
    const input = fixture();
    const checkpoint = JSON.parse(
      fs.readFileSync(input.checkpointPath, 'utf8')
    );
    const historicalOnlyPath = 'src/historical-only.ts';
    const historicalOnlyFile = path.join(
      input.root,
      historicalOnlyPath
    );
    fs.writeFileSync(
      historicalOnlyFile,
      'export const historical = true;\n',
      'utf8'
    );
    checkpoint.governedFiles.push({
      path: historicalOnlyPath,
      bytes: fs.statSync(historicalOnlyFile).size,
      hash: hash(fs.readFileSync(historicalOnlyFile)),
    });
    writeJson(input.checkpointPath, checkpoint);

    assert.throws(
      () => prepare(input),
      (error) =>
        error.failureClass ===
          'authority_supersession_checkpoint_scope_escape' &&
        error.path === historicalOnlyPath
    );
    const prepared = prepare(input, {
      supersessionMode: 'source_grounded_hard_cut',
    });
    assert.equal(
      prepared.checkpointMappings[0].disposition,
      'historical_evidence_only'
    );
    assert.deepEqual(
      prepared.checkpointMappings[0].historicalScopeEscapePaths,
      [historicalOnlyPath]
    );
  });

  it('normalizes rich checkpoints and carries byte drift into revalidation', () => {
    const input = fixture();
    const oldRecord = input.oldManifest.partitions[0];
    const governedPath = oldRecord.ownedArtifactPaths[0];
    const governedFile = path.join(input.root, governedPath);
    const checkpointHash = hash(fs.readFileSync(governedFile));
    const logPath = path.join(input.root, 'logs', 'rich-green.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, 'pass\n', 'utf8');
    writeJson(input.checkpointPath, {
      schemaVersion:
        'canonical-intent-control-plane-kernel-child-checkpoint/v1',
      partitionId: oldRecord.partitionId,
      primaryTaskIds: oldRecord.primaryTaskIds,
      authorityBindings: {
        parentPlan: { sha256: input.parentPlanHash },
        partitionManifest: { sha256: input.oldManifestHash },
        childContract: {
          sha256: input.oldChildren[0].outputHash,
        },
        partitionSetHash: input.oldManifest.partitionSetHash,
      },
      sourceTree: {
        governedFiles: [
          {
            path: governedPath,
            sha256: checkpointHash,
          },
        ],
      },
      verification: {
        commands: [
          {
            id: 'rich-green',
            exitCode: 0,
            log: {
              path: logPath,
              sha256: hash(fs.readFileSync(logPath)),
            },
          },
        ],
      },
    });
    fs.appendFileSync(governedFile, 'export const changed = true;\n');

    const prepared = prepare(input);
    const mapping = prepared.checkpointMappings[0];
    assert.equal(mapping.checkpointFormat, 'rich');
    assert.equal(mapping.taskBindingSource, 'checkpoint');
    assert.equal(mapping.governedByteSetCurrent, false);
    assert.deepEqual(mapping.staleGovernedPaths, [governedPath]);
    assert.equal(mapping.validatedCommandCount, 1);
    assert.equal(mapping.validatedLogCount, 1);
    assert.equal(mapping.disposition, 'revalidation_required');
  });

  it('normalizes evidence-packet checkpoints and preserves expected RED logs', () => {
    const input = fixture();
    const oldRecord = input.oldManifest.partitions[0];
    const governedPath = oldRecord.ownedArtifactPaths[0];
    const governedFile = path.join(input.root, governedPath);
    const redLogPath = path.join(input.root, 'logs', 'behavior-red.log');
    const greenLogPath = path.join(
      input.root,
      'logs',
      'behavior-green.log'
    );
    fs.mkdirSync(path.dirname(redLogPath), { recursive: true });
    fs.writeFileSync(redLogPath, 'expected failure\n', 'utf8');
    fs.writeFileSync(greenLogPath, 'pass\n', 'utf8');
    const packetPath = path.join(input.root, 'evidence-packet.json');
    writeJson(packetPath, {
      schemaVersion: 'kernel-evidence-packet/v1',
      authority: {
        parentPlan: { sha256: input.parentPlanHash },
        partitionManifest: { sha256: input.oldManifestHash },
        partitionSetHash: input.oldManifest.partitionSetHash,
      },
      partition: {
        partitionId: oldRecord.partitionId,
        childContractHash: input.oldChildren[0].outputHash,
      },
      governedFileManifest: [
        {
          path: governedPath,
          sha256: hash(fs.readFileSync(governedFile)),
        },
      ],
      tdd: {
        redEvidence: [path.basename(redLogPath)],
      },
      verification: {
        commands: [
          {
            path: redLogPath,
            failCount: 1,
            sha256: hash(fs.readFileSync(redLogPath)),
          },
          {
            path: greenLogPath,
            failCount: 0,
            sha256: hash(fs.readFileSync(greenLogPath)),
          },
        ],
      },
    });
    writeJson(input.checkpointPath, {
      schemaVersion:
        'canonical-intent-control-plane-kernel-child-checkpoint/v1',
      partitionId: oldRecord.partitionId,
      parentPlanHash: input.parentPlanHash,
      partitionManifestHash: input.oldManifestHash,
      partitionSetHash: input.oldManifest.partitionSetHash,
      childContractHash: input.oldChildren[0].outputHash,
      evidencePacket: {
        path: packetPath,
        sha256: hash(fs.readFileSync(packetPath)),
      },
    });

    const prepared = prepare(input);
    const mapping = prepared.checkpointMappings[0];
    assert.equal(mapping.checkpointFormat, 'evidence_packet');
    assert.equal(mapping.taskBindingSource, 'superseded_manifest');
    assert.equal(mapping.governedByteSetCurrent, true);
    assert.equal(mapping.validatedCommandCount, 1);
    assert.equal(mapping.expectedRedCommandCount, 1);
    assert.equal(mapping.validatedLogCount, 2);
    assert.equal(mapping.evidencePacketHash, hash(fs.readFileSync(packetPath)));
  });

  it('fails closed on old byte tamper or semantic coverage drift', () => {
    const tampered = fixture();
    fs.appendFileSync(tampered.oldChildren[0].outputPath, 'tampered', 'utf8');
    assert.throws(
      () => prepare(tampered),
      (error) =>
        error.failureClass === 'superseded_child_hash_mismatch'
    );

    const drifted = fixture();
    drifted.successorSelectionManifest.partitions[0]
      .completionPredicateIds = [];
    assert.throws(
      () => prepare(drifted),
      (error) =>
        error.failureClass ===
        'authority_supersession_coverage_not_equivalent' &&
        error.dimension === 'acceptance'
    );
  });

  it('stages all bytes before one atomic promotion and rejects replay', () => {
    const input = fixture();
    const prepared = prepare(input);
    const finalRoot = path.join(input.root, 'authority-v2');
    const staged = stageAuthoritySupersessionAttempt({
      prepared,
      finalRoot,
    });
    assert.equal(fs.existsSync(finalRoot), false);
    assert.equal(fs.existsSync(staged.stageRoot), true);

    const promoted = promoteAuthoritySupersessionAttempt({ staged });
    assert.equal(fs.existsSync(staged.stageRoot), false);
    assert.equal(fs.existsSync(finalRoot), true);
    assert.equal(promoted.decision, 'pass');
    assert.equal(promoted.idempotent, false);

    const verified = verifyAuthoritySupersessionReceipt({
      authorityRoot: finalRoot,
      expected: {
        attemptKey: prepared.attemptKey,
        supersededPartitionManifestHash: input.oldManifestHash,
        successorPartitionManifestHash:
          input.executionProjectionBundle.partitionManifestHash,
      },
    });
    assert.equal(verified.decision, 'pass');

    assert.throws(
      () =>
        verifyAuthoritySupersessionReceipt({
          authorityRoot: finalRoot,
          expected: {
            attemptKey: hash('different-attempt'),
          },
        }),
      (error) =>
        error.failureClass ===
        'authority_supersession_replay_rejected'
    );

    const replayedPromotion =
      promoteAuthoritySupersessionAttempt({ staged });
    assert.equal(replayedPromotion.idempotent, true);
  });

  it('validates the promoted receipt with the canonical schema', () => {
    const input = fixture();
    const prepared = prepare(input);
    const finalRoot = path.join(input.root, 'authority-v2');
    const staged = stageAuthoritySupersessionAttempt({
      prepared,
      finalRoot,
    });
    promoteAuthoritySupersessionAttempt({ staged });
    const schemaPath = path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '_bmad',
      'shared',
      'goal-contract',
      'goal-contract-authority-supersession-receipt.schema.json'
    );
    assert.equal(fs.existsSync(schemaPath), true);
    const validate = new Ajv2020({
      allErrors: true,
      strict: false,
    }).compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
    const receipt = JSON.parse(
      fs.readFileSync(
        path.join(finalRoot, 'authority-supersession.receipt.json'),
        'utf8'
      )
    );
    assert.equal(validate(receipt), true, JSON.stringify(validate.errors));
  });
});
