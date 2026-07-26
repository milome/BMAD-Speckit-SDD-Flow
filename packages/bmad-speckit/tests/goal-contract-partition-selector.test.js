const assert = require('node:assert');
const { createHash } = require('node:crypto');
const { describe, it } = require('node:test');

const {
  buildGlobalPartitionCoverageReceipt,
  selectPartitionScope,
} = require('../src/utils/goal-contract/partition-selector.ts');

const hash = (value) =>
  `sha256:${createHash('sha256').update(String(value)).digest('hex')}`;
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

function fixture() {
  const ids = {
    first: `partition-${'a'.repeat(64)}`,
    second: `partition-${'b'.repeat(64)}`,
  };
  const projection = {
    sourceSnapshotHash: hash('snapshot'),
    methodologyProfileHash: hash('methodology'),
    executionProjectionHash: hash('projection'),
    traceSlices: [
      { sliceId: 'slice-a', sourceIds: ['source-a'], taskIds: ['task-a'], completionPredicateIds: ['acceptance-a'], evidenceContractIds: ['evidence-a'], sequenceConstraintIds: [] },
      { sliceId: 'slice-b', sourceIds: ['source-b'], taskIds: ['task-b'], completionPredicateIds: ['acceptance-b'], evidenceContractIds: ['evidence-b'], sequenceConstraintIds: ['constraint-b'] },
    ],
    atomicTasks: [
      { taskId: 'task-a', title: 'A', sourceIds: ['source-a'], ownerSliceId: 'slice-a', dependencyIds: [], sequenceConstraintIds: [] },
      { taskId: 'task-b', title: 'B', sourceIds: ['source-b'], ownerSliceId: 'slice-b', dependencyIds: ['task-a'], sequenceConstraintIds: ['constraint-b'] },
    ],
    completionPredicates: [
      { predicateId: 'acceptance-a', sliceId: 'slice-a', sourceIds: ['source-a'], statement: 'A passes', positive: true, evidenceContractIds: ['evidence-a'] },
      { predicateId: 'acceptance-b', sliceId: 'slice-b', sourceIds: ['source-b'], statement: 'B passes', positive: true, evidenceContractIds: ['evidence-b'] },
    ],
    evidenceContracts: [
      { evidenceContractId: 'evidence-a', producerTaskIds: ['task-a'], admissibleTypes: ['behavior'], freshnessRule: 'current' },
      { evidenceContractId: 'evidence-b', producerTaskIds: ['task-b'], admissibleTypes: ['behavior'], freshnessRule: 'current' },
    ],
    sequenceConstraintBinding: {
      constraints: [{ constraintId: 'constraint-b', constraintType: 'ordering', taskIds: ['task-b'], semantic: {} }],
    },
    integrationJoinGraph: { joins: [{ joinId: 'join-b', ownerTaskId: 'task-b', inputTaskIds: ['task-a'] }] },
  };
  const makePartition = (semantic, ordinal) => ({
    ...semantic,
    displayOrdinal: ordinal,
    displayTitle: `Partition ${ordinal}`,
    selectionSetHash: hash(stable(semantic)),
    selectionReceiptPath: `partition-runs/partition-run-${'c'.repeat(64)}/partitions/${semantic.partitionId}/selection.receipt.json`,
  });
  const first = makePartition({
    partitionId: ids.first, primaryComponentIds: ['component-a'], primaryTraceSliceIds: ['slice-a'], primaryTaskIds: ['task-a'],
    outcome: 'A', primaryEpicIds: [], primarySourceObligationIds: ['source-a'], inheritedConstraintIds: [], acceptanceIds: ['acceptance-a'],
    commandIds: ['command-a'], evidenceContractIds: ['evidence-a'], completionPredicateIds: ['acceptance-a'], dependencyPartitionIds: [],
    partitionRole: 'implementation', partitionRoleDerived: true, ownedArtifactPaths: ['src/shared.ts'], sharedArtifactDependencies: [],
    compatibilityReceiptRequirements: [], blockedConditions: [], failureClasses: [],
  }, 1);
  const second = makePartition({
    partitionId: ids.second, primaryComponentIds: ['component-b'], primaryTraceSliceIds: ['slice-b'], primaryTaskIds: ['task-b'],
    outcome: 'B', primaryEpicIds: [], primarySourceObligationIds: ['source-b'], inheritedConstraintIds: ['constraint-b'], acceptanceIds: ['acceptance-b'],
    commandIds: ['command-b'], evidenceContractIds: ['evidence-b'], completionPredicateIds: ['acceptance-b'], dependencyPartitionIds: [ids.first],
    partitionRole: 'final_integration', partitionRoleDerived: true, ownedArtifactPaths: [], sharedArtifactDependencies: [{ path: 'src/shared.ts', dependencyPartitionIds: [ids.first] }],
    compatibilityReceiptRequirements: [{ artifactPath: 'src/shared.ts', predecessorPartitionId: ids.first, receiptPath: 'compatibility.json' }],
    blockedConditions: [], failureClasses: [],
  }, 2);
  const manifest = {
    masterSourceHash: hash('source'), sourceSnapshotHash: projection.sourceSnapshotHash, methodologyProfileHash: projection.methodologyProfileHash,
    executionProjectionHash: projection.executionProjectionHash, partitionPolicyHash: hash('policy'), partitionSetHash: hash('set'),
    partitionRunId: `partition-run-${'c'.repeat(64)}`, topologicalOrder: [ids.first, ids.second], partitions: [first, second],
  };
  return { ids, manifest, projection };
}

describe('partition selector', () => {
  it('proves exact global ownership and selects each graph-bound scope', () => {
    const { ids, manifest, projection } = fixture();
    const coverage = buildGlobalPartitionCoverageReceipt({ executionProjection: projection, candidateManifest: manifest });
    assert.equal(coverage.decision, 'pass');
    for (const field of ['unmappedSourceObligations', 'duplicatePrimarySourceObligations', 'unmappedTraceSlices', 'duplicatePrimaryTraceSlices', 'unmappedAtomicTasks', 'duplicatePrimaryAtomicTasks', 'unresolvedDependencies', 'unownedSharedArtifacts']) {
      assert.deepEqual(coverage[field], []);
    }
    for (const partitionId of [ids.first, ids.second]) {
      const selected = selectPartitionScope({ executionProjection: projection, partitionManifest: manifest, partitionId });
      const expected = manifest.partitions.find((item) => item.partitionId === partitionId);
      assert.deepEqual(selected.primaryAtomicTasks.map((item) => item.taskId), expected.primaryTaskIds);
      assert.equal(selected.inheritedConstraints.every((item) => item.executable === false), true);
      assert.equal(selected.excludedAtomicTaskIds.includes(expected.primaryTaskIds[0]), false);
      assert.equal(selected.selectionReceipt.partitionId, partitionId);
    }
  });

  it('fails closed for ownership, dependency, shared-artifact and selection identity drift', () => {
    const base = fixture();
    const cases = [
      ['duplicate_primary_atomic_task', (m) => m.partitions[1].primaryTaskIds.push('task-a')],
      ['unknown_primary_atomic_task', (m) => m.partitions[0].primaryTaskIds.push('task-unknown')],
      ['partition_dependency_future', (m) => m.partitions[0].dependencyPartitionIds.push(base.ids.second)],
      ['partition_dependency_cycle', (m) => m.partitions[0].dependencyPartitionIds.push(base.ids.second)],
      ['shared_artifact_owner_missing', (m) => { m.partitions[0].ownedArtifactPaths = []; }],
      ['final_integration_partition_missing', (m) => { m.partitions[1].partitionRole = 'implementation'; }],
    ];
    for (const [reason, mutate] of cases) {
      const { manifest, projection } = fixture();
      mutate(manifest);
      const coverage = buildGlobalPartitionCoverageReceipt({ executionProjection: projection, candidateManifest: manifest });
      assert.equal(coverage.decision, 'blocked');
      assert.ok(coverage.blockingReasons.includes(reason), `${reason}: ${coverage.blockingReasons}`);
    }
    assert.throws(() => selectPartitionScope({ executionProjection: base.projection, partitionManifest: base.manifest, partitionId: `partition-${'d'.repeat(64)}` }), /partition_id_unknown/u);
    base.manifest.partitions[0].selectionSetHash = hash('tampered');
    assert.throws(() => selectPartitionScope({ executionProjection: base.projection, partitionManifest: base.manifest, partitionId: base.ids.first }), /partition_selection_set_hash_mismatch/u);
  });
});
