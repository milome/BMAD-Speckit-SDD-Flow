const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { describe, it } = require('node:test');

const {
  buildPartitionSlotData,
} = require('../src/utils/goal-contract/slot-data-builder.ts');
const {
  writePartitionChildGenerationReceipt,
} = require('../src/utils/goal-contract/goal-contract-receipts.ts');

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
const hash = (value) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'partition-generation-'));
}

function writeSource(root) {
  const source = path.join(root, 'source.md');
  fs.writeFileSync(
    source,
    '# Plan\n\n## Implementation Task Breakdown\n\n- [ ] TASK-1: MUST compile the selected child.\n\n## Acceptance Criteria\n\n- [ ] AC-1: MUST pass the selected child.\n\n## Required Test Commands\n\n- [ ] CMD-1: Run node --version.\n\n## Completion Evidence Packet\n\n- [ ] EVD-1: MUST bind selected bytes.\n',
    'utf8'
  );
  return source;
}

function runSourceCommand(args) {
  return spawnSync(
    process.execPath,
    ['-e', SOURCE_RUNNER, SOURCE_COMMAND, ...args],
    { cwd: path.dirname(SOURCE_COMMAND), encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
  );
}

function activeRun(root) {
  const source = writeSource(root);
  const activeManifestPath = path.join(root, 'active-manifest.json');
  const receiptsDir = path.join(root, '.goal-contract-receipts');
  const compile = runSourceCommand([
    'partition', '--entry', 'standalone_goal_contract',
    '--source', source, '--out', activeManifestPath, '--json',
  ]);
  assert.equal(compile.status, 0, compile.stderr || compile.stdout);
  const receipt = JSON.parse(compile.stdout);
  const manifest = JSON.parse(fs.readFileSync(activeManifestPath, 'utf8'));
  assert.equal(receipt.partitionManifestHash, hash(fs.readFileSync(activeManifestPath)));
  return { activeManifestPath, manifest, receiptsDir, source };
}

describe('partition-bound goal contract generation', () => {
  it('binds one current selected partition and writes strict child receipts', () => {
    const root = tempRoot();
    const run = activeRun(root);
    const partition = run.manifest.partitions[0];
    const child = path.join(root, 'child-goal-execution-plan.md');
    const result = runSourceCommand([
      'generate', '--entry', 'standalone_goal_contract',
      '--source', run.source,
      '--partition-manifest', run.activeManifestPath,
      '--partition-id', partition.partitionId,
      '--out', child, '--json',
    ]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.partitionId, partition.partitionId);
    assert.equal(receipt.selectedAtomicTaskCount, partition.primaryTaskIds.length);
    assert.equal(receipt.inheritedConstraintCount, partition.inheritedConstraintIds.length);
    assert.ok(fs.existsSync(receipt.coverageReceiptPath));
    assert.ok(fs.existsSync(receipt.generationReceiptPath));
    const generationReceipt = JSON.parse(
      fs.readFileSync(receipt.generationReceiptPath, 'utf8')
    );
    const text = fs.readFileSync(child, 'utf8');
    for (const field of [
      'masterSourcePath', 'masterSourceHash', 'sourceSnapshotHash',
      'methodologyProfileHash', 'methodologyProfileArtifactHash',
      'executionProjectionHash', 'taskDagHash', 'partitionPolicyHash',
      'partitionPolicyArtifactHash', 'partitionManifestPath',
      'partitionManifestHash', 'partitionAnalysisReceiptHash',
      'partitionSetHash', 'partitionId', 'partitionRole', 'selectionReceiptPath',
      'selectionReceiptHash', 'selectionSetHash', 'dependencyPartitionIds',
      'globalCoverageReceiptPath', 'globalCoverageReceiptHash',
    ]) assert.match(text, new RegExp(`^${field}:`, 'mu'));
    for (const field of [
      'sequenceMode',
      'sequenceApplicability',
      'sequenceCoverage',
      'sequenceClosureStatus',
      'childContractAuthority',
    ]) {
      assert.equal(receipt[field], run.manifest[field]);
      assert.equal(generationReceipt[field], run.manifest[field]);
      assert.match(
        text,
        new RegExp(`^${field}: ${run.manifest[field]}$`, 'mu')
      );
    }
    assert.throws(
      () =>
        writePartitionChildGenerationReceipt({
          ...generationReceipt,
          targetPath: path.join(root, 'missing-sequence-state.json'),
          sequenceMode: undefined,
        }),
      (error) =>
        error.failureClass ===
          'partition_child_generation_sequence_state_missing' &&
        error.field === 'sequenceMode'
    );
  });

  it('renders only selected executable records and isolates inherited constraints', () => {
    const result = buildPartitionSlotData({
      source: { sourcePlanPath: 'source.md', sourcePlanHash: hash('source'), sourceBytes: 1, sourceLines: 1 },
      profile: { profileVersion: '1.0.0', profileHash: hash('profile') },
      selectedScope: {
        partition: { partitionId: `partition-${'a'.repeat(64)}`, partitionRole: 'implementation', dependencyPartitionIds: [] },
        primarySourceObligations: [{ id: 'source-selected', summary: 'Selected.' }],
        primaryAtomicTasks: [{ taskId: 'task-selected', title: 'Selected task', sourceIds: ['source-selected'], dependencyIds: [] }],
        completionPredicates: [{ predicateId: 'acceptance-selected', statement: 'Selected passes.', sourceIds: ['source-selected'], evidenceContractIds: ['evidence-selected'] }],
        evidenceContracts: [{ evidenceContractId: 'evidence-selected', producerTaskIds: ['task-selected'], freshnessRule: 'current' }],
        commands: [{ commandId: 'command-selected', literal: 'node --version' }],
        inheritedConstraints: [{ constraintId: 'constraint-selected', executable: false }],
        excludedAtomicTaskIds: ['task-excluded'],
        excludedAcceptanceIds: ['acceptance-excluded'],
        excludedCommandIds: ['command-excluded'],
      },
      receiptPaths: {
        outPath: 'child.md',
        coverageReceiptPath: 'child.coverage.json',
        generationReceiptPath: 'child.generation.json',
      },
      bindings: {
        partitionManifestPath: 'active-manifest.json',
        partitionManifestHash: hash('manifest'),
        partitionSetHash: hash('set'),
        selectionReceiptPath: 'selection.json',
        selectionReceiptHash: hash('selection'),
        globalCoverageReceiptPath: 'global.json',
        globalCoverageReceiptHash: hash('global'),
        sourceSnapshotHash: hash('snapshot'),
        methodologyProfileHash: hash('methodology'),
        methodologyProfileArtifactHash: hash('methodology-artifact'),
        executionProjectionHash: hash('projection'),
        taskDagHash: hash('dag'),
        partitionPolicyHash: hash('policy'),
        partitionPolicyArtifactHash: hash('policy-artifact'),
        partitionAnalysisReceiptHash: hash('analysis'),
        sequenceMode: 'disabled',
        sequenceApplicability: 'required',
        sequenceCoverage: 'excluded',
        sequenceClosureStatus: 'not_requested',
        childContractAuthority: 'core_only',
      },
    });
    const rendered = JSON.stringify(result.slotData);
    assert.match(rendered, /task-selected/u);
    assert.match(rendered, /acceptance-selected/u);
    assert.match(rendered, /command-selected/u);
    assert.match(rendered, /constraint-selected/u);
    assert.match(rendered, /non-executable/u);
    assert.doesNotMatch(rendered, /task-excluded|acceptance-excluded|command-excluded/u);
    for (const line of [
      'sequenceMode: disabled',
      'sequenceApplicability: required',
      'sequenceCoverage: excluded',
      'sequenceClosureStatus: not_requested',
      'childContractAuthority: core_only',
    ]) {
      assert.match(result.slotData.frontMatter, new RegExp(`^${line}$`, 'mu'));
    }
  });

  it('rejects a stale or tampered active manifest before rendering', () => {
    const root = tempRoot();
    const run = activeRun(root);
    const tampered = JSON.parse(fs.readFileSync(run.activeManifestPath, 'utf8'));
    tampered.selectedCandidateId = 'candidate-tampered';
    fs.writeFileSync(run.activeManifestPath, `${JSON.stringify(tampered)}\n`, 'utf8');
    const child = path.join(root, 'must-not-exist-goal-execution-plan.md');
    const result = runSourceCommand([
      'generate', '--entry', 'standalone_goal_contract',
      '--source', run.source,
      '--partition-manifest', run.activeManifestPath,
      '--partition-id', run.manifest.partitions[0].partitionId,
      '--out', child, '--json',
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(child), false);
    assert.match(JSON.parse(result.stdout).failureClass, /partition_manifest/u);
  });
});
