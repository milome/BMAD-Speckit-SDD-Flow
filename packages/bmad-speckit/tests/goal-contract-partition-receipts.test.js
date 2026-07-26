const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');
const { spawnSync } = require('node:child_process');

const { partition } = require('../src/commands/goal-contract.ts');
const {
  finalizePartitionRun,
  readValidatedPartitionReceipt,
  writeValidatedPartitionReceipt,
} = require('../src/utils/goal-contract/partition-receipts.ts');

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
