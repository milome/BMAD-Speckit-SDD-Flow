const assert = require('node:assert');
const { describe, it } = require('node:test');

const controlPlane = require('../src/utils/goal-contract/control-plane/index.ts');
const {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

function hash(label) {
  return hashControlPlaneValue({ label });
}

function input(overrides = {}) {
  return {
    repositoryTreeHash: hash('repository-tree'),
    partitionPlanBasisHash: hash('partition-plan-basis'),
    partitionSetHash: hash('partition-set'),
    partitionImpactGraphHash: hash('impact-graph'),
    partitionClosureFeasibilityReceiptHash: hash(
      'closure-feasibility-receipt'
    ),
    ...overrides,
  };
}

describe('goal-contract partition impact drift baseline', () => {
  it('freezes one deterministic empty generation baseline', () => {
    const compilePartitionImpactDriftBaseline =
      controlPlane.compilePartitionImpactDriftBaseline;
    assert.equal(
      typeof compilePartitionImpactDriftBaseline,
      'function'
    );

    const first = compilePartitionImpactDriftBaseline(input());
    const second = compilePartitionImpactDriftBaseline(input());

    assert.equal(
      first.schemaVersion,
      'goal-contract-partition-impact-drift-receipt/v1'
    );
    assert.equal(first.mode, 'generation_baseline');
    assert.equal(first.decision, 'baseline_frozen');
    assert.deepEqual(first.changedArtifactIds, []);
    assert.deepEqual(first.impactedPartitionIds, []);
    assert.match(first.driftHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(first.semanticDecisionHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(first.receiptHash, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(
      stableControlPlaneStringify(first),
      stableControlPlaneStringify(second)
    );
    assert.equal(Object.isFrozen(first), true);
  });

  it('rejects caller-supplied decision and self-hash authority', () => {
    const compilePartitionImpactDriftBaseline =
      controlPlane.compilePartitionImpactDriftBaseline;

    assert.throws(
      () =>
        compilePartitionImpactDriftBaseline(
          input({ decision: 'baseline_frozen' })
        ),
      (error) =>
        error.failureClass ===
        'partition_impact_drift_authority_injection'
    );
    assert.throws(
      () =>
        compilePartitionImpactDriftBaseline(
          input({ driftHash: hash('forged') })
        ),
      (error) =>
        error.failureClass ===
        'partition_impact_drift_authority_injection'
    );
  });
});
