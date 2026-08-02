const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  evaluatePartitionClosureFeasibilityRelease,
} = require('../src/utils/goal-contract/release-gate.ts');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');
const {
  sha256File,
} = require('../src/utils/large-document-writer/receipts.ts');

const HASH = `sha256:${'a'.repeat(64)}`;

function fixture({ blocked = false } = {}) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'goal-release-feasibility-')
  );
  const receiptRelativePath =
    'receipts/partition-closure-feasibility.receipt.json';
  const receiptPath = path.join(
    root,
    ...receiptRelativePath.split('/')
  );
  const partitionId = 'partition-p01';
  const blockingIssue = {
    issueCode: 'future_owned_artifact_dependency',
    partitionId,
    affectedArtifactPaths: ['src/consumer.ts'],
    affectedCommandIds: [],
    currentOwnerPartitionId: partitionId,
    blockingOwnerPartitionId: 'partition-p02',
    partitionDependencyPath: [partitionId, 'partition-p02'],
    minimalConflictChain: ['edge-import'],
    provenanceRefs: ['edge-import'],
    repairClass: 'source_task_colocation_required',
  };
  const semanticRecord = {
    partitionId,
    availableOwnerSet: ['baseline', partitionId],
    closureRelevantArtifactIds: ['artifact-consumer'],
    closureRelevantCommandIds: [],
    blockingIssues: blocked ? [blockingIssue] : [],
    decision: blocked ? 'blocked' : 'pass',
  };
  const partitionRecord = {
    ...semanticRecord,
    partitionClosureFeasibilityHash:
      hashControlPlaneValue(semanticRecord),
  };
  const payload = {
    schemaVersion:
      'goal-contract-partition-closure-feasibility-receipt/v1',
    partitionPlanBasisHash: HASH,
    partitionImpactGraphHash: HASH,
    repositoryTreeHash: HASH,
    partitionImpactPolicyHash: HASH,
    partitionImpactAnalyzerIdentityHash: HASH,
    partitionRecords: [partitionRecord],
    blockingIssues: blocked ? [blockingIssue] : [],
    decision: blocked ? 'blocked' : 'pass',
  };
  const receipt = {
    ...payload,
    receiptHash: hashControlPlaneValue(payload),
  };
  fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
  fs.writeFileSync(
    receiptPath,
    `${JSON.stringify(receipt, null, 2)}\n`,
    'utf8'
  );
  const manifest = {
    schemaVersion: 'goal-contract-partition-manifest/v2',
    manifestAuthorityMode: 'final_child_membership',
    partitionPlanBasisHash: HASH,
    partitionImpactGraphHash: HASH,
    partitionClosureFeasibilityReceiptPath: receiptRelativePath,
    partitionClosureFeasibilityReceiptHash: sha256File(receiptPath),
    partitionClosureFeasibilityDecision:
      blocked ? 'blocked' : 'pass',
    partitions: [
      {
        partitionId,
        partitionClosureFeasibilityHash:
          partitionRecord.partitionClosureFeasibilityHash,
      },
    ],
  };
  return {
    manifest,
    manifestPath: path.join(root, 'partition-manifest.json'),
    partitionId,
    receiptPath,
  };
}

describe('goal-contract partition release feasibility', () => {
  it('passes only a current hash-bound partition feasibility receipt', () => {
    const current = fixture();
    const result = evaluatePartitionClosureFeasibilityRelease({
      currentManifest: current.manifest,
      partitionId: current.partitionId,
      partitionManifestPath: current.manifestPath,
    });

    assert.equal(result.decision, 'pass');
    assert.equal(result.componentDecision, 'pass');
    assert.deepEqual(result.blockingReasons, []);
  });

  it('blocks release and preserves stable closure issue codes', () => {
    const current = fixture({ blocked: true });
    const result = evaluatePartitionClosureFeasibilityRelease({
      currentManifest: current.manifest,
      partitionId: current.partitionId,
      partitionManifestPath: current.manifestPath,
    });

    assert.equal(result.decision, 'blocked');
    assert.equal(result.componentDecision, 'blocked');
    assert.ok(
      result.blockingReasons.includes(
        'partition_closure_feasibility_blocked'
      )
    );
    assert.ok(
      result.blockingReasons.includes(
        'future_owned_artifact_dependency'
      )
    );
  });

  it('fails closed on missing or changed feasibility receipt bytes', () => {
    const missing = fixture();
    fs.unlinkSync(missing.receiptPath);
    const missingResult =
      evaluatePartitionClosureFeasibilityRelease({
        currentManifest: missing.manifest,
        partitionId: missing.partitionId,
        partitionManifestPath: missing.manifestPath,
      });
    assert.ok(
      missingResult.blockingReasons.includes(
        'partition_closure_feasibility_missing'
      )
    );

    const changed = fixture();
    fs.appendFileSync(changed.receiptPath, ' ', 'utf8');
    const changedResult =
      evaluatePartitionClosureFeasibilityRelease({
        currentManifest: changed.manifest,
        partitionId: changed.partitionId,
        partitionManifestPath: changed.manifestPath,
      });
    assert.ok(
      changedResult.blockingReasons.includes(
        'partition_closure_feasibility_not_current'
      )
    );
  });

  it('keeps legacy manifests outside the hardened feasibility gate', () => {
    const result = evaluatePartitionClosureFeasibilityRelease({
      currentManifest: {
        schemaVersion: 'goal-contract-partition-manifest/v1',
      },
      partitionId: 'partition-p01',
      partitionManifestPath: 'partition-manifest.json',
    });

    assert.equal(result.decision, 'pass');
    assert.equal(result.componentDecision, 'not_applicable');
    assert.deepEqual(result.blockingReasons, []);
  });
});
