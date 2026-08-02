const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  buildDependencyCompatibilityReceipt,
  validateDependencyCompatibilityReceipt,
  writeDependencyCompatibilityReceipt,
} = require('../src/utils/goal-contract/partition-receipts.ts');

const hash = (value) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;
const fileHash = (filePath) =>
  `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'partition-compatibility-'));
}

function fixture() {
  const root = tempRoot();
  const sharedArtifactPath = 'shared/artifact.json';
  const predecessorArtifactPath = path.join(root, 'predecessor-artifact.json');
  const currentArtifactPath = path.join(root, 'current-artifact.json');
  fs.writeFileSync(predecessorArtifactPath, '{"version":1}\n', 'utf8');
  fs.writeFileSync(currentArtifactPath, '{"version":2,"compatible":true}\n', 'utf8');
  const predecessorPartition = {
    partitionId: `partition-${'a'.repeat(64)}`,
    ownedArtifactPaths: [sharedArtifactPath],
  };
  const dependentPartition = {
    partitionId: `partition-${'b'.repeat(64)}`,
    dependencyPartitionIds: [predecessorPartition.partitionId],
    compatibilityReceiptRequirements: [
      {
        artifactPath: sharedArtifactPath,
        predecessorPartitionId: predecessorPartition.partitionId,
        receiptPath: 'compatibility/shared-artifact.receipt.json',
      },
    ],
  };
  const predecessorCompletionReceiptPath = path.join(
    root,
    'predecessor-completion.receipt.json'
  );
  const predecessorCompletionReceipt = {
    schemaVersion: 'goal-contract-partition-completion-receipt/v1',
    partitionId: predecessorPartition.partitionId,
    masterSourceHash: hash('source'),
    sourceSnapshotHash: hash('snapshot'),
    partitionManifestHash: hash('manifest'),
    artifactHashes: {
      [sharedArtifactPath]: fileHash(predecessorArtifactPath),
    },
    acceptanceIds: ['AC-1'],
    decision: 'pass',
  };
  fs.writeFileSync(
    predecessorCompletionReceiptPath,
    `${JSON.stringify(predecessorCompletionReceipt, null, 2)}\n`,
    'utf8'
  );
  const input = {
    masterSourceHash: predecessorCompletionReceipt.masterSourceHash,
    sourceSnapshotHash: predecessorCompletionReceipt.sourceSnapshotHash,
    partitionManifestHash: predecessorCompletionReceipt.partitionManifestHash,
    dependentPartition,
    predecessorPartition,
    predecessorCompletionReceiptPath,
    predecessorCompletionReceipt,
    sharedArtifactPath,
    predecessorArtifactPath,
    predecessorArtifactHash: fileHash(predecessorArtifactPath),
    currentArtifactPath,
    compatibilityDomain: 'shared_json_contract',
    preservedAcceptanceIds: ['AC-1'],
    invalidatedAcceptanceIds: [],
    compatibilityCommands: [
      {
        commandId: 'compat-node',
        argv: [process.execPath, '-e', 'process.stdout.write("compatible")'],
      },
    ],
    cwd: root,
  };
  return {
    currentArtifactPath,
    dependentPartition,
    input,
    predecessorArtifactPath,
    predecessorCompletionReceiptPath,
    predecessorPartition,
    root,
    sharedArtifactPath,
  };
}

describe('dependency compatibility receipts', () => {
  it('binds observed predecessor/current artifact hashes and argv-safe command results', () => {
    const test = fixture();
    const receipt = buildDependencyCompatibilityReceipt(test.input);
    assert.equal(receipt.decision, 'pass');
    assert.equal(
      receipt.predecessorPartitionId,
      test.predecessorPartition.partitionId
    );
    assert.equal(
      receipt.predecessorArtifactHash,
      fileHash(test.predecessorArtifactPath)
    );
    assert.equal(receipt.currentArtifactHash, fileHash(test.currentArtifactPath));
    assert.equal(receipt.compatibilityCommands[0].exitCode, 0);
    assert.equal(
      receipt.compatibilityCommands[0].artifactHashes[test.sharedArtifactPath],
      receipt.currentArtifactHash
    );
    assert.equal(validateDependencyCompatibilityReceipt(receipt, test.input).decision, 'pass');
  });

  it('rejects cross-source, cross-partition, wrong-artifact and missing-command inputs', () => {
    const cases = [
      [
        'compatibility_predecessor_source_mismatch',
        (input) => {
          input.masterSourceHash = hash('other-source');
        },
      ],
      [
        'compatibility_predecessor_partition_mismatch',
        (input) => {
          input.predecessorCompletionReceipt.partitionId =
            `partition-${'c'.repeat(64)}`;
        },
      ],
      [
        'compatibility_shared_artifact_not_owned',
        (input) => {
          input.sharedArtifactPath = 'shared/other.json';
        },
      ],
      [
        'compatibility_predecessor_artifact_hash_mismatch',
        (input) => {
          input.predecessorArtifactHash = hash('wrong');
        },
      ],
      [
        'compatibility_command_missing',
        (input) => {
          input.compatibilityCommands = [];
        },
      ],
      [
        'compatibility_command_result_authority_forbidden',
        (input) => {
          input.compatibilityCommandResults = [];
        },
      ],
    ];
    for (const [reason, mutate] of cases) {
      const test = fixture();
      mutate(test.input);
      assert.throws(
        () => buildDependencyCompatibilityReceipt(test.input),
        new RegExp(reason, 'u'),
        reason
      );
    }
  });

  it('blocks invalidated acceptance, failed commands and replayed command artifacts', () => {
    const invalidated = fixture();
    invalidated.input.invalidatedAcceptanceIds = ['AC-1'];
    const invalidatedReceipt = buildDependencyCompatibilityReceipt(invalidated.input);
    assert.equal(invalidatedReceipt.decision, 'blocked');
    assert.ok(
      invalidatedReceipt.blockingReasons.includes(
        'compatibility_acceptance_invalidated'
      )
    );

    const failed = fixture();
    failed.input.compatibilityCommands[0].argv = [
      process.execPath,
      '-e',
      'process.exit(7)',
    ];
    const failedReceipt = buildDependencyCompatibilityReceipt(failed.input);
    assert.equal(failedReceipt.decision, 'blocked');
    assert.ok(
      failedReceipt.blockingReasons.includes('compatibility_command_failed')
    );

    const replayed = fixture();
    const replayedReceipt = structuredClone(
      buildDependencyCompatibilityReceipt(replayed.input)
    );
    replayedReceipt.compatibilityCommands[0].artifactHashes[
      replayed.sharedArtifactPath
    ] = hash('another-artifact');
    assert.throws(
      () => validateDependencyCompatibilityReceipt(replayedReceipt, replayed.input),
      /compatibility_command_artifact_hash_mismatch/u
    );
  });

  it('writes one immutable strict receipt without changing predecessor completion bytes', () => {
    const test = fixture();
    const targetPath = path.join(test.root, 'compatibility.receipt.json');
    const predecessorBytes = fs.readFileSync(
      test.predecessorCompletionReceiptPath,
      'utf8'
    );
    const first = writeDependencyCompatibilityReceipt({
      ...test.input,
      targetPath,
    });
    assert.equal(first.payload.decision, 'pass');
    assert.equal(
      fs.readFileSync(test.predecessorCompletionReceiptPath, 'utf8'),
      predecessorBytes
    );

    fs.writeFileSync(test.currentArtifactPath, '{"version":3}\n', 'utf8');
    assert.throws(
      () =>
        writeDependencyCompatibilityReceipt({
          ...test.input,
          targetPath,
        }),
      /partition_run_identity_collision/u
    );
    assert.equal(
      fs.readFileSync(test.predecessorCompletionReceiptPath, 'utf8'),
      predecessorBytes
    );
  });
});
