const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  assertRawNonAuthoritativeContainmentRoot,
  computePartitionGenerationKey,
  activateStandalonePartitionGeneration,
  goalContractAuthorityWriterBinding,
  preflightRequirementRecordPartitionAuthoritySupersession,
  resolveCanonicalPartitionOutputPaths,
  writeImmutableAuthorityFile,
} = require('../src/utils/goal-contract/control-plane/index.ts');

const HASHES = Object.freeze({
  sourceHash: `sha256:${'1'.repeat(64)}`,
  templateHash: `sha256:${'2'.repeat(64)}`,
  profileHash: `sha256:${'3'.repeat(64)}`,
  compilerIdentityHash: `sha256:${'4'.repeat(64)}`,
  methodologyProfileHash: `sha256:${'5'.repeat(64)}`,
  partitionPolicyHash: `sha256:${'6'.repeat(64)}`,
  sourceCompositionPolicyHash: `sha256:${'7'.repeat(64)}`,
});
const hash = (value) =>
  `sha256:${createHash('sha256').update(value).digest('hex')}`;

function writeAuthorizedRequirementRecord(
  repositoryRoot,
  requirementSetId,
  sourceHash
) {
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
    'requirement-architecture-confirmation'
  );
  const writers = [
    goalContractAuthorityWriterBinding({
      registryHash: hash('goal-contract-writer-registry-source'),
      architectureConfirmationHash,
    }),
  ];
  const record = {
    schemaVersion: 'requirement-record/v1',
    recordId: requirementSetId,
    requirementSetId,
    status: 'user_confirmed',
    sourcePath: 'docs/design/requirement-source.md',
    sourceDocumentHash,
    implementationConfirmationHash,
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        recordId: requirementSetId,
        requirementSetId,
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
    controlledIngestWriterRegistry: writers,
    controlledIngestWriterRegistryHash: hash(
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
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
  fs.mkdirSync(path.dirname(recordPath), { recursive: true });
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify(record, null, 2)}\n`,
    'utf8'
  );
  return recordPath;
}

describe('goal contract partition output authority paths', () => {
  it('resolves one deterministic standalone generation under the canonical runtime root', () => {
    const repositoryRoot = path.resolve('C:/workspace/repository');
    const generationKey = computePartitionGenerationKey(HASHES);
    const resolved = resolveCanonicalPartitionOutputPaths({
      repositoryRoot,
      ...HASHES,
    });

    assert.match(generationKey, /^sha256:[0-9a-f]{64}$/u);
    assert.equal(resolved.authorityMode, 'standalone_bootstrap');
    assert.equal(resolved.sourceHash, HASHES.sourceHash);
    assert.equal(resolved.generationKey, generationKey);
    assert.equal(
      resolved.authorityRoot,
      path.join(
        repositoryRoot,
        '_bmad-output',
        'runtime',
        'goal-contract-partition-bootstrap',
        '1'.repeat(64)
      )
    );
    assert.equal(
      resolved.unitRoot,
      path.join(resolved.authorityRoot, 'generations', generationKey.slice(7))
    );
    assert.equal(
      resolved.activePointerPath,
      path.join(resolved.authorityRoot, 'active-generation.json')
    );
    assert.equal(
      resolved.partitionPlanPath,
      path.join(resolved.unitRoot, 'partition-plan.json')
    );
    assert.equal(
      resolved.partitionManifestPath,
      path.join(resolved.unitRoot, 'partition-manifest.json')
    );
    assert.equal(resolved.childrenDir, path.join(resolved.unitRoot, 'children'));
    assert.equal(resolved.receiptsDir, path.join(resolved.unitRoot, 'receipts'));
    assert.equal(resolved.evidenceDir, path.join(resolved.unitRoot, 'evidence'));
    assert.equal(resolved.lifecycleDir, path.join(resolved.unitRoot, 'lifecycle'));

    assert.deepEqual(
      resolveCanonicalPartitionOutputPaths({
        repositoryRoot,
        ...HASHES,
      }),
      resolved
    );
  });

  it('isolates generations when any policy tuple member changes', () => {
    const repositoryRoot = path.resolve('C:/workspace/repository');
    const original = resolveCanonicalPartitionOutputPaths({
      repositoryRoot,
      ...HASHES,
    });
    const changed = resolveCanonicalPartitionOutputPaths({
      repositoryRoot,
      ...HASHES,
      compilerIdentityHash: `sha256:${'8'.repeat(64)}`,
    });

    assert.notEqual(changed.generationKey, original.generationKey);
    assert.notEqual(changed.unitRoot, original.unitRoot);
    assert.equal(changed.authorityRoot, original.authorityRoot);
  });

  it('resolves RequirementRecord runs without crossing the requirement set boundary', () => {
    const repositoryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'partition-output-authority-')
    );
    const partitionRunId = `partition-run-${'a'.repeat(64)}`;
    writeAuthorizedRequirementRecord(
      repositoryRoot,
      'REQ-GH-004',
      HASHES.sourceHash
    );
    const resolved = resolveCanonicalPartitionOutputPaths({
      repositoryRoot,
      ...HASHES,
      requirementSetId: 'REQ-GH-004',
      partitionRunId,
    });

    assert.equal(resolved.authorityMode, 'requirement_record');
    assert.equal(resolved.requirementSetId, 'REQ-GH-004');
    assert.equal(resolved.partitionRunId, partitionRunId);
    assert.equal(
      resolved.authorityRoot,
      path.join(
        repositoryRoot,
        '_bmad-output',
        'runtime',
        'requirement-records',
        'REQ-GH-004',
        'goal-contract'
      )
    );
    assert.equal(
      resolved.unitRoot,
      path.join(resolved.authorityRoot, 'partition-runs', partitionRunId)
    );
    assert.equal(
      resolved.activePointerPath,
      path.join(resolved.authorityRoot, 'active-partition-run.json')
    );
  });

  it('preflights the exact RequirementRecord writer binding without writing output bytes', () => {
    const repositoryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'partition-output-authority-')
    );
    const recordPath = writeAuthorizedRequirementRecord(
      repositoryRoot,
      'REQ-GH-004',
      HASHES.sourceHash
    );
    const result =
      preflightRequirementRecordPartitionAuthoritySupersession({
        repositoryRoot,
        recordPath,
        requirementSetId: 'REQ-GH-004',
        sourceHash: HASHES.sourceHash,
      });

    assert.equal(result.recordPath.replace(/\\/gu, '/'), recordPath.replace(/\\/gu, '/'));
    assert.equal(fs.existsSync(result.authorityRoot), false);
  });

  it('rejects caller-selected roots and path escapes in governed mode', () => {
    const repositoryRoot = path.resolve('C:/workspace/repository');
    const canonical = resolveCanonicalPartitionOutputPaths({
      repositoryRoot,
      ...HASHES,
    });

    assert.throws(
      () =>
        resolveCanonicalPartitionOutputPaths({
          repositoryRoot,
          ...HASHES,
          authorityRootOverride: path.join(repositoryRoot, 'custom-output'),
        }),
      (error) =>
        error.failureClass ===
        'partition_governed_authority_override_rejected'
    );
    assert.throws(
      () =>
        resolveCanonicalPartitionOutputPaths({
          repositoryRoot,
          ...HASHES,
          authorityRootOverride: '../_bmad-output/runtime',
        }),
      (error) =>
        error.failureClass ===
        'partition_governed_authority_override_rejected'
    );
    assert.deepEqual(
      resolveCanonicalPartitionOutputPaths({
        repositoryRoot,
        ...HASHES,
        authorityRootOverride: canonical.authorityRoot,
      }),
      canonical
    );
    assert.throws(
      () =>
        resolveCanonicalPartitionOutputPaths({
          repositoryRoot,
          ...HASHES,
          requirementSetId: '../REQ-ESCAPE',
          partitionRunId: `partition-run-${'a'.repeat(64)}`,
        }),
      (error) => error.failureClass === 'partition_requirement_set_id_invalid'
    );
  });

  it('allows ordinary raw roots but rejects canonical authority and RequirementRecord roots', () => {
    const repositoryRoot = path.resolve('C:/workspace/repository');
    const rawRoot = path.join(repositoryRoot, 'diagnostics', 'goal-contract');

    assert.equal(
      assertRawNonAuthoritativeContainmentRoot({
        repositoryRoot,
        containmentRoot: rawRoot,
      }),
      rawRoot
    );
    assert.throws(
      () =>
        assertRawNonAuthoritativeContainmentRoot({
          repositoryRoot,
          containmentRoot: path.join(
            repositoryRoot,
            '_bmad-output',
            'runtime',
            'goal-contract-partition-bootstrap',
            'diagnostic'
          ),
        }),
      (error) =>
        error.failureClass === 'partition_raw_authority_root_overlap'
    );
    assert.throws(
      () =>
        assertRawNonAuthoritativeContainmentRoot({
          repositoryRoot,
          containmentRoot: path.join(
            repositoryRoot,
            '_bmad-output',
            'runtime',
            'requirement-records',
            'REQ-OTHER',
            'diagnostic'
          ),
        }),
      (error) =>
        error.failureClass ===
        'partition_raw_cross_requirement_placement'
    );
  });

  it('keeps immutable generation files append-once and idempotent', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'partition-output-authority-')
    );
    const authority = resolveCanonicalPartitionOutputPaths({
      repositoryRoot: root,
      ...HASHES,
    });
    const targetPath = path.join(authority.unitRoot, 'partition-plan.json');

    const first = writeImmutableAuthorityFile({
      authority,
      targetPath,
      bytes: '{"version":1}\n',
    });
    const second = writeImmutableAuthorityFile({
      authority,
      targetPath,
      bytes: '{"version":1}\n',
    });

    assert.equal(first.created, true);
    assert.equal(second.idempotent, true);
    assert.throws(
      () =>
        writeImmutableAuthorityFile({
          authority,
          targetPath,
          bytes: '{"version":2}\n',
        }),
      (error) =>
        error.failureClass === 'partition_immutable_bytes_conflict'
    );
  });

  it('rejects an incomplete manifest even when caller-listed artifacts exist', () => {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), 'partition-output-authority-')
    );
    const authority = resolveCanonicalPartitionOutputPaths({
      repositoryRoot: root,
      ...HASHES,
    });
    const manifestBytes =
      '{"partitionManifestHash":"sha256:manifest","schemaVersion":"goal-contract-partition-manifest/v2"}\n';
    const planBytes = '{"partitionPlanHash":"sha256:plan"}\n';

    assert.throws(
      () =>
        activateStandalonePartitionGeneration({
          authority,
          partitionPlanBytes: planBytes,
          partitionManifestBytes: manifestBytes,
          childContractPaths: ['children/p01-root-goal-execution-plan.md'],
          requiredReceiptPaths: ['receipts/global-coverage.receipt.json'],
        }),
      (error) => error.failureClass === 'partition_generation_incomplete'
    );

    writeImmutableAuthorityFile({
      authority,
      targetPath: authority.partitionPlanPath,
      bytes: planBytes,
    });
    writeImmutableAuthorityFile({
      authority,
      targetPath: authority.partitionManifestPath,
      bytes: manifestBytes,
    });
    writeImmutableAuthorityFile({
      authority,
      targetPath: path.join(
        authority.unitRoot,
        'children/p01-root-goal-execution-plan.md'
      ),
      bytes: '# child\n',
    });
    writeImmutableAuthorityFile({
      authority,
      targetPath: path.join(
        authority.unitRoot,
        'receipts/global-coverage.receipt.json'
      ),
      bytes: '{}\n',
    });
    writeImmutableAuthorityFile({
      authority,
      targetPath: path.join(authority.unitRoot, 'evidence/evidence.json'),
      bytes: '{}\n',
    });
    writeImmutableAuthorityFile({
      authority,
      targetPath: path.join(authority.unitRoot, 'lifecycle/state.json'),
      bytes: '{}\n',
    });

    assert.throws(
      () =>
        activateStandalonePartitionGeneration({
          authority,
          partitionPlanBytes: planBytes,
          partitionManifestBytes: manifestBytes,
          childContractPaths: [
            'children/p01-root-goal-execution-plan.md',
          ],
          requiredReceiptPaths: [
            'receipts/global-coverage.receipt.json',
          ],
        }),
      (error) =>
        error.failureClass === 'partition_manifest_schema_invalid'
    );
    assert.equal(fs.existsSync(authority.activePointerPath), false);
  });

});
