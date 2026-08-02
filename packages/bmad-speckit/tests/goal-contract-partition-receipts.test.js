const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const { spawnSync } = require('node:child_process');

const { partition } = require('../src/commands/goal-contract.ts');
const {
  assertCurrentPartitionRuntimeEpoch,
  buildDependencyCompatibilityReceipt,
  buildUnavailableSequenceApplicabilityReceipt,
  derivePartitionCapabilityState,
  finalizePartitionRun,
  readValidatedPartitionReceipt,
  resolveAssetRoot,
  writeSequenceApplicabilityReceipt,
  writeSequenceApplicabilityBoundaryReceipt,
  writeValidatedPartitionReceipt,
} = require('../src/utils/goal-contract/partition-receipts.ts');
const {
  stableStringify,
} = require('../src/utils/large-document-writer/receipts.ts');
const {
  decideSequenceApplicability,
  hashSequenceApplicabilityPayload,
} = require('../src/utils/goal-contract/sequence-applicability.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SCHEMA_ROOT = path.join(REPO_ROOT, '_bmad', 'shared', 'goal-contract');
const SOURCE_COMMAND = path.resolve(
  __dirname,
  '..',
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
const SCHEMA_IDS = [
  'goal-contract-partition-global-coverage-receipt',
  'goal-contract-partition-selection-receipt',
  'goal-contract-dependency-compatibility-receipt',
  'goal-contract-partition-child-coverage-receipt',
  'goal-contract-partition-child-generation-receipt',
  'goal-contract-partition-release-gate-receipt',
];
const hash = (value) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'partition-receipts-'));
}

function writeRuntimeBuildEvidence(root) {
  const packageRoot = path.join(root, 'package');
  const assetRelativePath =
    '_bmad/shared/goal-contract/goal-contract-partition-policy.json';
  const assetPath = path.join(packageRoot, assetRelativePath);
  fs.mkdirSync(path.dirname(assetPath), { recursive: true });
  fs.writeFileSync(assetPath, '{"policyVersion":"test"}\n', 'utf8');
  const assetHash = createHash('sha256')
    .update(fs.readFileSync(assetPath))
    .digest('hex');
  const packageAssetEntries = [
    {
      source: assetRelativePath,
      target: assetRelativePath,
      sourceHash: assetHash,
      targetHash: assetHash,
      owner: 'package-root-_bmad',
    },
  ];
  const receipt = {
    schemaVersion: 'bmad-speckit-runtime-build-authority/v1',
    decision: 'pass',
    packageAssetCount: packageAssetEntries.length,
    packageAssetSetHash: `sha256:${createHash('sha256')
      .update(JSON.stringify(packageAssetEntries))
      .digest('hex')}`,
    packageAssetEntries,
  };
  const receiptPath = path.join(
    packageRoot,
    'dist',
    'main-agent',
    'runtime-build-authority-receipt.json'
  );
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return { packageRoot, receiptPath };
}

function writeSource(root) {
  const source = path.join(root, 'source.md');
  fs.writeFileSync(
    source,
    '# Plan\n\n## Implementation Task Breakdown\n\n- [ ] TASK-1: MUST compile.\n\n## Acceptance Criteria\n\n- [ ] AC-1: MUST pass.\n\n## Required Test Commands\n\n- [ ] CMD-1: Run `node --version`.\n\n## Completion Evidence Packet\n\n- [ ] EVD-1: MUST bind bytes.\n',
    'utf8'
  );
  return source;
}

function stagedRun(root) {
  const receiptsDir = path.join(root, 'receipts');
  const activeManifestPath = path.join(root, 'active-manifest.json');
  const result = spawnSync(
    process.execPath,
    [
      '-e',
      SOURCE_RUNNER,
      SOURCE_COMMAND,
      'partition',
      '--entry', 'standalone_goal_contract',
      '--source', writeSource(root),
      '--out', activeManifestPath,
      '--receipts-dir', receiptsDir,
      '--json',
    ],
    { cwd: path.dirname(SOURCE_COMMAND), encoding: 'utf8' }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(result.stdout);
  const promotedRoot = path.join(
    receiptsDir,
    'partition-runs',
    receipt.runId
  );
  const stageRoot = path.join(
    receiptsDir,
    '.partition-staging',
    receipt.runId
  );
  fs.mkdirSync(path.dirname(stageRoot), { recursive: true });
  fs.cpSync(promotedRoot, stageRoot, { recursive: true });
  fs.rmSync(promotedRoot, { recursive: true, force: true });
  fs.rmSync(activeManifestPath, { force: true });
  const analysisReceiptPath = path.join(
    stageRoot,
    'partition-analysis.receipt.json'
  );
  const manifestPath = path.join(stageRoot, 'partition-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const receiptPath of [
    manifest.globalCoverageReceiptPath,
    ...manifest.partitions.map((item) => item.selectionReceiptPath),
  ]) {
    const relativePath = receiptPath.replace(
      `partition-runs/${receipt.runId}/`,
      ''
    );
    fs.rmSync(path.join(stageRoot, relativePath), { force: true });
  }
  return {
    activeManifestPath,
    receiptsDir,
    staged: {
      partitionRunId: receipt.runId,
      analysisReceiptPath,
      analysisReceiptHash: hash(fs.readFileSync(analysisReceiptPath)),
      manifestPath,
      partitionManifestHash: hash(fs.readFileSync(manifestPath)),
      manifest,
    },
  };
}

function passReceipts(staged) {
  const manifest = staged.manifest;
  const globalCoverage = {
    schemaVersion: 'goal-contract-partition-global-coverage-receipt/v1',
    masterSourceHash: manifest.masterSourceHash,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    methodologyProfileHash: manifest.methodologyProfileHash,
    executionProjectionHash: manifest.executionProjectionHash,
    partitionManifestHash: staged.partitionManifestHash,
    partitionIds: manifest.topologicalOrder,
    unmappedSourceObligations: [],
    duplicatePrimarySourceObligations: [],
    unmappedTraceSlices: [],
    duplicatePrimaryTraceSlices: [],
    unmappedAtomicTasks: [],
    duplicatePrimaryAtomicTasks: [],
    unresolvedDependencies: [],
    unownedSharedArtifacts: [],
    finalIntegrationPartitionIds: manifest.partitions
      .filter((item) => item.partitionRole === 'final_integration')
      .map((item) => item.partitionId),
    decision: 'pass',
    blockingReasons: [],
  };
  const selections = manifest.partitions.map((item) => ({
    schemaVersion: 'goal-contract-partition-selection-receipt/v1',
    masterSourceHash: manifest.masterSourceHash,
    sourceSnapshotHash: manifest.sourceSnapshotHash,
    methodologyProfileHash: manifest.methodologyProfileHash,
    executionProjectionHash: manifest.executionProjectionHash,
    partitionPolicyHash: manifest.partitionPolicyHash,
    partitionManifestHash: staged.partitionManifestHash,
    partitionSetHash: manifest.partitionSetHash,
    partitionId: item.partitionId,
    partitionRole: item.partitionRole,
    selectionSetHash: item.selectionSetHash,
    selectedPrimarySourceObligationIds: item.primarySourceObligationIds,
    selectedPrimaryTraceSliceIds: item.primaryTraceSliceIds,
    selectedPrimaryAtomicTaskIds: item.primaryTaskIds,
    selectedAcceptanceIds: item.acceptanceIds,
    selectedCommandIds: item.commandIds,
    selectedEvidenceContractIds: item.evidenceContractIds,
    inheritedConstraintIds: item.inheritedConstraintIds,
    excludedSourceObligationIds: [],
    excludedTraceSliceIds: [],
    excludedAtomicTaskIds: [],
    excludedAcceptanceIds: [],
    excludedCommandIds: [],
    excludedEvidenceContractIds: [],
    dependencyPartitionIds: item.dependencyPartitionIds,
    decision: 'pass',
    blockingReasons: [],
  }));
  return { globalCoverage, selections };
}

describe('strict partition receipts', () => {
  it('builds compatibility evidence from a modern subcontract closure and evidence pair', () => {
    const root = tempRoot();
    const sharedArtifactPath = 'src/shared.ts';
    const artifactPath = path.join(root, sharedArtifactPath);
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, 'export const shared = true;\n', 'utf8');
    const artifactHash = hash(fs.readFileSync(artifactPath));
    const predecessorPartitionId = `partition-${'1'.repeat(64)}`;
    const dependentPartitionId = `partition-${'2'.repeat(64)}`;
    const partitionManifestHash = hash('partition-manifest');
    const subcontractEvidence = {
      schemaVersion: 'goal-contract-subcontract-evidence/v1',
      partitionId: predecessorPartitionId,
      partitionManifestHash,
      governedFileManifest: [
        {
          path: sharedArtifactPath,
          sourceHashAfter: artifactHash,
          existsAfter: true,
        },
      ],
      decision: 'pass',
      evidenceHash: hash('subcontract-evidence'),
    };
    const predecessorClosure = {
      schemaVersion: 'goal-contract-subcontract-closure-receipt/v1',
      partitionId: predecessorPartitionId,
      partitionManifestHash,
      subcontractEvidenceHash: subcontractEvidence.evidenceHash,
      decision: 'pass',
      receiptHash: hash('subcontract-closure'),
    };
    const predecessorCompletionReceiptPath = path.join(
      root,
      'predecessor-closure.json'
    );
    fs.writeFileSync(
      predecessorCompletionReceiptPath,
      `${JSON.stringify(predecessorClosure, null, 2)}\n`,
      'utf8'
    );

    const receipt = buildDependencyCompatibilityReceipt({
      predecessorPartition: {
        partitionId: predecessorPartitionId,
        ownedArtifactPaths: [sharedArtifactPath],
      },
      dependentPartition: {
        partitionId: dependentPartitionId,
        dependencyPartitionIds: [predecessorPartitionId],
        compatibilityReceiptRequirements: [
          {
            artifactPath: sharedArtifactPath,
            predecessorPartitionId,
            receiptPath: 'compatibility/shared.receipt.json',
          },
        ],
      },
      sharedArtifactPath,
      predecessorCompletionReceipt: predecessorClosure,
      predecessorCompletionReceiptPath,
      predecessorSubcontractEvidence: subcontractEvidence,
      predecessorArtifactPath: artifactPath,
      predecessorArtifactHash: artifactHash,
      currentArtifactPath: artifactPath,
      masterSourceHash: hash('master-source'),
      sourceSnapshotHash: hash('source-snapshot'),
      partitionManifestHash,
      compatibilityDomain: 'runtime_contract',
      preservedAcceptanceIds: ['acceptance-shared'],
      invalidatedAcceptanceIds: [],
      compatibilityCommands: [
        {
          commandId: `command-${artifactHash.slice(7, 23)}`,
          argv: [process.execPath, '--version'],
        },
      ],
      cwd: root,
    });

    assert.equal(
      receipt.predecessorCompletionReceiptHash,
      predecessorClosure.receiptHash
    );
    assert.equal(receipt.predecessorArtifactHash, artifactHash);
    assert.equal(receipt.currentArtifactHash, artifactHash);
    assert.equal(receipt.decision, 'pass');
  });

  it('publishes six closed JSON Schema 2020-12 receipt contracts', () => {
    for (const id of SCHEMA_IDS) {
      const schema = JSON.parse(
        fs.readFileSync(path.join(SCHEMA_ROOT, `${id}.schema.json`), 'utf8')
      );
      assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
      assert.equal(schema.additionalProperties, false);
      assert.equal(schema.properties.schemaVersion.const, `${id}/v1`);
      assert.ok(schema.required.includes('decision'));
      assert.ok(schema.required.includes('blockingReasons'));
    }
  });

  it('reads new Sequence execution state and defaults legacy mode to auto', () => {
    const root = tempRoot();
    const decidedReceipt = decideSequenceApplicability({
      sourceSnapshotHash: `sha256:${'a'.repeat(64)}`,
      semanticModelHash: `sha256:${'b'.repeat(64)}`,
      traceGraphHash: `sha256:${'c'.repeat(64)}`,
      architectureFacts: {
        interfaceBoundary: true,
        evidenceRefs: ['SOURCE-1'],
      },
      policyVersion: '1.0.0',
    });
    const legacySemanticPayload = { ...decidedReceipt };
    delete legacySemanticPayload.receiptHash;
    const legacyReceipt = {
      ...legacySemanticPayload,
      receiptHash:
        hashSequenceApplicabilityPayload(legacySemanticPayload),
    };
    const currentSemanticPayload = {
      ...legacySemanticPayload,
      sequenceMode: 'disabled',
      sequenceApplicability: 'required',
      sequenceCoverage: 'excluded',
      sequenceClosureStatus: 'not_requested',
      childContractAuthority: 'core_only',
    };
    const currentReceipt = {
      ...currentSemanticPayload,
      receiptHash:
        hashSequenceApplicabilityPayload(currentSemanticPayload),
    };
    const currentPath = path.join(root, 'current-sequence.json');
    writeValidatedPartitionReceipt({
      schemaId: currentReceipt.schemaVersion,
      targetPath: currentPath,
      payload: currentReceipt,
    });
    assert.deepEqual(
      readValidatedPartitionReceipt(
        currentPath,
        'goal-contract-sequence-applicability-receipt/v1'
      ),
      currentReceipt
    );

    const legacyPath = path.join(root, 'legacy-sequence.json');
    writeValidatedPartitionReceipt({
      schemaId: legacyReceipt.schemaVersion,
      targetPath: legacyPath,
      payload: legacyReceipt,
    });
    assert.equal(
      readValidatedPartitionReceipt(
        legacyPath,
        'goal-contract-sequence-applicability-receipt/v1'
      ).sequenceMode,
      'auto'
    );
  });

  it('fails closed instead of resolving package assets from a consumer bait root', () => {
    const root = tempRoot();
    const packageRoot = path.join(
      root,
      'consumer',
      'node_modules',
      'bmad-speckit'
    );
    const dirname = path.join(packageRoot, 'dist', 'utils', 'goal-contract');
    fs.mkdirSync(
      path.join(root, 'consumer', '_bmad', 'shared', 'goal-contract'),
      { recursive: true }
    );

    assert.throws(
      () =>
        resolveAssetRoot({
          filename: path.join(dirname, 'partition-receipts.js'),
          dirname,
        }),
      (error) => error.failureClass === 'partition_package_asset_root_missing'
    );
  });

  it('persists required-unavailable Sequence evidence and derives capability state from paths', () => {
    const root = tempRoot();
    const runtimeBuild = writeRuntimeBuildEvidence(root);
    const applicabilityReceipt = decideSequenceApplicability({
      sourceSnapshotHash: `sha256:${'a'.repeat(64)}`,
      semanticModelHash: `sha256:${'b'.repeat(64)}`,
      traceGraphHash: `sha256:${'c'.repeat(64)}`,
      architectureFacts: {
        interfaceBoundary: true,
        evidenceRefs: ['SOURCE-1'],
      },
      policyVersion: '1.0.0',
    });
    const methodologyProfileHash = `sha256:${'d'.repeat(64)}`;
    const payload = buildUnavailableSequenceApplicabilityReceipt({
      applicabilityReceipt,
      methodologyProfileHash,
    });
    assert.equal(payload.decision, 'required');
    assert.equal(payload.producerAvailability, 'unavailable');
    assert.equal(payload.failureClass, 'sequence_closure_required_unavailable');
    assert.deepEqual(payload.blockingReasons, [
      'canonical_sequence_closure_producer_unavailable',
    ]);
    const written = writeSequenceApplicabilityBoundaryReceipt({
      applicabilityReceipt,
      methodologyProfileHash,
      receiptsDir: path.join(root, 'receipts'),
    });
    const secondWritten = writeSequenceApplicabilityBoundaryReceipt({
      applicabilityReceipt: decideSequenceApplicability({
        sourceSnapshotHash: `sha256:${'e'.repeat(64)}`,
        semanticModelHash: `sha256:${'f'.repeat(64)}`,
        traceGraphHash: `sha256:${'1'.repeat(64)}`,
        architectureFacts: {
          interfaceBoundary: true,
          evidenceRefs: ['SOURCE-2'],
        },
        policyVersion: '1.0.0',
      }),
      methodologyProfileHash,
      receiptsDir: path.join(root, 'second-receipts'),
    });
    const forcedApplicabilityReceipt = decideSequenceApplicability({
      sourceSnapshotHash: `sha256:${'2'.repeat(64)}`,
      semanticModelHash: `sha256:${'3'.repeat(64)}`,
      traceGraphHash: `sha256:${'4'.repeat(64)}`,
      architectureFacts: {
        crossParticipantInteraction: false,
        interfaceBoundary: false,
        observableOrdering: false,
        stateTransition: false,
        branchCoverage: false,
        boundedRetry: false,
        compensation: false,
        temporalConstraint: false,
        integrationFanIn: false,
        evidenceRefs: ['SOURCE-3'],
      },
      policyVersion: '1.0.0',
    });
    const forcedPayload = buildUnavailableSequenceApplicabilityReceipt({
      applicabilityReceipt: forcedApplicabilityReceipt,
      methodologyProfileHash,
      sequenceMode: 'required',
    });
    assert.equal(forcedPayload.decision, 'not_applicable_with_proof');
    assert.equal(forcedPayload.sequenceMode, 'required');
    const forcedWritten = writeSequenceApplicabilityBoundaryReceipt({
      applicabilityReceipt: forcedApplicabilityReceipt,
      methodologyProfileHash,
      receiptsDir: path.join(root, 'forced-receipts'),
      sequenceMode: 'required',
    });
    assert.deepEqual(
      readValidatedPartitionReceipt(
        written.path,
        'goal-contract-sequence-applicability-receipt/v1'
      ),
      { sequenceMode: 'auto', ...payload }
    );
    assert.equal(
      derivePartitionCapabilityState({
        packageRoot: runtimeBuild.packageRoot,
        runtimeBuildAuthorityReceiptPath: runtimeBuild.receiptPath,
        selfHostingApplicabilityReceiptPaths: [
          forcedWritten.path,
          secondWritten.path,
        ],
      }),
      'Sequence-Required Capability Pending'
    );
    assert.throws(
      () =>
        derivePartitionCapabilityState({
          p01ThroughP04Current: true,
          p05aCoreCurrent: true,
          currentMasterPlanApplicability: 'required',
          p05bCurrent: false,
      }),
      (error) => error.failureClass === 'partition_capability_evidence_paths_missing'
    );

    const hashTampered = JSON.parse(fs.readFileSync(written.path, 'utf8'));
    hashTampered.receiptHash = `sha256:${'0'.repeat(64)}`;
    fs.writeFileSync(written.path, stableStringify(hashTampered), 'utf8');
    assert.throws(
      () =>
        readValidatedPartitionReceipt(
          written.path,
          'goal-contract-sequence-applicability-receipt/v1'
        ),
      (error) =>
        error.failureClass === 'sequence_applicability_receipt_hash_mismatch'
    );

    const freshnessTampered = JSON.parse(
      fs.readFileSync(secondWritten.path, 'utf8')
    );
    freshnessTampered.freshnessRoot = hash('stale-freshness-root');
    delete freshnessTampered.receiptHash;
    freshnessTampered.receiptHash =
      hashSequenceApplicabilityPayload(freshnessTampered);
    fs.writeFileSync(
      secondWritten.path,
      stableStringify(freshnessTampered),
      'utf8'
    );
    assert.throws(
      () =>
        readValidatedPartitionReceipt(
          secondWritten.path,
          'goal-contract-sequence-applicability-receipt/v1'
        ),
      (error) =>
        error.failureClass ===
        'sequence_applicability_receipt_freshness_mismatch'
    );
  });

  it('persists successful Sequence applicability evidence immutably', () => {
    const root = tempRoot();
    const applicabilityReceipt = decideSequenceApplicability({
      sourceSnapshotHash: `sha256:${'5'.repeat(64)}`,
      semanticModelHash: `sha256:${'6'.repeat(64)}`,
      traceGraphHash: `sha256:${'7'.repeat(64)}`,
      architectureFacts: {
        crossParticipantInteraction: false,
        interfaceBoundary: false,
        observableOrdering: false,
        stateTransition: false,
        branchCoverage: false,
        boundedRetry: false,
        compensation: false,
        temporalConstraint: false,
        integrationFanIn: false,
        evidenceRefs: ['SOURCE-4'],
      },
      policyVersion: '1.0.0',
    });
    const written = writeSequenceApplicabilityReceipt({
      applicabilityReceipt,
      receiptsDir: path.join(root, 'receipts'),
    });

    assert.deepEqual(
      readValidatedPartitionReceipt(
        written.path,
        'goal-contract-sequence-applicability-receipt/v1'
      ),
      { sequenceMode: 'auto', ...applicabilityReceipt }
    );
    assert.deepEqual(
      writeSequenceApplicabilityReceipt({
        applicabilityReceipt,
        receiptsDir: path.join(root, 'receipts'),
      }),
      written
    );
  });

  it('rejects a current directory with a stale runtime epoch marker', () => {
    const root = tempRoot();
    const installedRoot = path.join(root, 'consumer', 'node_modules', 'package');
    const marker = path.join(
      installedRoot,
      'dist',
      'main-agent',
      'runtime-build-authority-receipt.json'
    );
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(marker, '{}\n', 'utf8');
    const startedAt = Date.now();
    fs.utimesSync(marker, new Date(startedAt - 10_000), new Date(startedAt - 10_000));
    fs.utimesSync(
      installedRoot,
      new Date(startedAt + 1_000),
      new Date(startedAt + 1_000)
    );

    assert.throws(
      () =>
        assertCurrentPartitionRuntimeEpoch({
          runRoot: root,
          startedAt,
          artifacts: [
            {
              path: installedRoot,
              type: 'directory',
              freshnessMarker:
                'dist/main-agent/runtime-build-authority-receipt.json',
            },
          ],
        }),
      (error) =>
        error.failureClass === 'partition_runtime_epoch_marker_stale'
    );
  });

  it('writes canonical self-hashed receipts and rejects caller-authored authority', () => {
    const root = tempRoot();
    const targetPath = path.join(root, 'selection.json');
    const payload = {
      schemaVersion: 'goal-contract-partition-selection-receipt/v1',
      masterSourceHash: hash('source'),
      sourceSnapshotHash: hash('snapshot'),
      methodologyProfileHash: hash('methodology'),
      executionProjectionHash: hash('projection'),
      partitionPolicyHash: hash('policy'),
      partitionManifestHash: hash('manifest'),
      partitionSetHash: hash('set'),
      partitionId: `partition-${'a'.repeat(64)}`,
      partitionRole: 'implementation',
      selectionSetHash: hash('selection'),
      selectedPrimarySourceObligationIds: ['source-a'],
      selectedPrimaryTraceSliceIds: ['slice-a'],
      selectedPrimaryAtomicTaskIds: ['task-a'],
      selectedAcceptanceIds: ['acceptance-a'],
      selectedCommandIds: ['command-a'],
      selectedEvidenceContractIds: ['evidence-a'],
      inheritedConstraintIds: [],
      excludedSourceObligationIds: [],
      excludedTraceSliceIds: [],
      excludedAtomicTaskIds: [],
      excludedAcceptanceIds: [],
      excludedCommandIds: [],
      excludedEvidenceContractIds: [],
      dependencyPartitionIds: [],
      decision: 'pass',
      blockingReasons: [],
    };
    const receipt = writeValidatedPartitionReceipt({
      schemaId: payload.schemaVersion,
      targetPath,
      payload,
    });
    assert.match(receipt.receiptHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(hash(fs.readFileSync(targetPath)), receipt.receiptHash);
    assert.deepEqual(readValidatedPartitionReceipt(targetPath), payload);
    for (const invalid of [
      { ...payload, receiptHash: hash('forged') },
      { ...payload, unknown: true },
      { ...payload, selectedPrimaryAtomicTaskIds: ['task-a', 'task-a'] },
      { ...payload, blockingReasons: ['forged-pass'] },
      { ...payload, decision: 'blocked' },
    ]) {
      assert.throws(() =>
        writeValidatedPartitionReceipt({ schemaId: payload.schemaVersion, targetPath, payload: invalid })
      );
    }
  });

  it('promotes an immutable run before atomically exposing exact staged manifest bytes', async () => {
    const state = await stagedRun(tempRoot());
    const prior = Buffer.from('prior-active\n');
    fs.writeFileSync(state.activeManifestPath, prior);
    const receipts = passReceipts(state.staged);
    assert.throws(() =>
      finalizePartitionRun({
        ...state,
        ...receipts,
        writeReceipt: () => {
          throw new Error('simulated-crash');
        },
      })
    );
    assert.deepEqual(fs.readFileSync(state.activeManifestPath), prior);
    const finalized = finalizePartitionRun({ ...state, ...receipts });
    assert.equal(finalized.activeManifestHash, state.staged.partitionManifestHash);
    assert.deepEqual(
      fs.readFileSync(state.activeManifestPath),
      fs.readFileSync(finalized.promotedManifestPath)
    );
  });

  it('rejects caller-supplied global coverage or selection authority', async () => {
    const root = tempRoot();
    for (const args of [
      ['--global-coverage-decision', 'pass'],
      ['--selection-decision', 'pass'],
    ]) {
      await assert.rejects(
        partition([
          '--entry', 'standalone_goal_contract',
          '--source', writeSource(root),
          '--out', path.join(root, `${args[0].slice(2)}.json`),
          ...args,
        ]),
        (error) => error.failureClass === 'partition_authority_argument_forbidden'
      );
    }
  });

  it('rejects incomplete, duplicate, blocked or cross-manifest selections', async () => {
    const state = await stagedRun(tempRoot());
    const { globalCoverage, selections } = passReceipts(state.staged);
    const invalidSets = [
      selections.slice(1),
      [...selections, selections[0]],
      selections.map((item, index) =>
        index === 0 ? { ...item, partitionManifestHash: hash('other') } : item
      ),
      selections.map((item, index) =>
        index === 0
          ? { ...item, decision: 'blocked', blockingReasons: ['selection-blocked'] }
          : item
      ),
    ];
    for (const invalidSelections of invalidSets) {
      assert.throws(() =>
        finalizePartitionRun({
          ...state,
          globalCoverage,
          selections: invalidSelections,
        })
      );
    }
    assert.equal(fs.existsSync(state.activeManifestPath), false);
  });
});
