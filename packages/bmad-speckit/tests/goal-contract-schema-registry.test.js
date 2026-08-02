const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  goalContractSchemaArtifactHash,
  loadGoalContractSchema,
  resolveGoalContractSchema,
  validateGoalContractSchema,
} = require('../src/utils/goal-contract/control-plane/schema-registry.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ASSET_DIR = path.join('_bmad', 'shared', 'goal-contract');
const MANIFEST_SCHEMA = 'goal-contract-partition-manifest.schema.json';
const OUTPUT_AUTHORITY_SCHEMA =
  'goal-contract-partition-output-authority.schema.json';
const LIFECYCLE_AUTHORITY_SCHEMA =
  'goal-contract-lifecycle-authority-binding.schema.json';
const SUPERVISOR_READINESS_SCHEMA =
  'goal-contract-supervisor-readiness-projection.schema.json';
const HASH = `sha256:${'a'.repeat(64)}`;

function tempPackageRoot(prefix = 'goal-contract-schema-') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(root, ASSET_DIR), { recursive: true });
  return root;
}

function writeSchema(root, name, schema) {
  const schemaPath = path.join(root, ASSET_DIR, name);
  const text = typeof schema === 'string' ? schema : `${JSON.stringify(schema, null, 2)}\n`;
  fs.writeFileSync(schemaPath, text, 'utf8');
  return schemaPath;
}

describe('goal-contract schema registry', () => {
  it('ignores a consumer working-directory bait asset root', () => {
    const baitRoot = tempPackageRoot('goal-contract-consumer-bait-');
    writeSchema(baitRoot, MANIFEST_SCHEMA, {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'string',
    });
    const sourcePath = path.join(REPO_ROOT, ASSET_DIR, MANIFEST_SCHEMA);
    const originalCwd = process.cwd();
    process.chdir(baitRoot);
    try {
      assert.equal(resolveGoalContractSchema(MANIFEST_SCHEMA), sourcePath);
      assert.equal(
        loadGoalContractSchema(MANIFEST_SCHEMA).schemaArtifactHash,
        `sha256:${createHash('sha256')
          .update(fs.readFileSync(sourcePath))
          .digest('hex')}`
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('loads byte-identical schema bindings from source and packaged roots', () => {
    const packagedRoot = tempPackageRoot('goal-contract-dist-schema-');
    const sourcePath = path.join(REPO_ROOT, ASSET_DIR, MANIFEST_SCHEMA);
    const packagedPath = path.join(packagedRoot, ASSET_DIR, MANIFEST_SCHEMA);
    fs.copyFileSync(sourcePath, packagedPath);

    const source = loadGoalContractSchema(MANIFEST_SCHEMA, { packageRoot: REPO_ROOT });
    const packaged = loadGoalContractSchema(MANIFEST_SCHEMA, { packageRoot: packagedRoot });
    const exactHash = `sha256:${createHash('sha256')
      .update(fs.readFileSync(sourcePath))
      .digest('hex')}`;

    assert.equal(resolveGoalContractSchema(MANIFEST_SCHEMA, { packageRoot: REPO_ROOT }), sourcePath);
    assert.equal(source.schemaArtifactHash, exactHash);
    assert.equal(packaged.schemaArtifactHash, exactHash);
    assert.equal(source.schemaBytes, packaged.schemaBytes);
    assert.equal(
      goalContractSchemaArtifactHash(MANIFEST_SCHEMA, { packageRoot: packagedRoot }),
      exactHash
    );
  });

  it('validates values and reports missing, malformed, and invalid schemas', () => {
    const root = tempPackageRoot();
    const name = 'fixture.schema.json';
    writeSchema(root, name, {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1 } },
    });

    assert.deepEqual(
      validateGoalContractSchema(name, { name: 'kernel' }, { packageRoot: root }),
      { name: 'kernel' }
    );
    assert.throws(
      () => validateGoalContractSchema(name, { name: '' }, { packageRoot: root }),
      (error) => error.failureClass === 'canonical_schema_invalid'
    );
    assert.throws(
      () => loadGoalContractSchema('missing.schema.json', { packageRoot: root }),
      (error) => error.failureClass === 'canonical_schema_missing'
    );
    writeSchema(root, 'malformed.schema.json', '{');
    assert.throws(
      () => loadGoalContractSchema('malformed.schema.json', { packageRoot: root }),
      (error) => error.failureClass === 'canonical_schema_invalid'
    );
  });

  it('invalidates validator cache identity when schema bytes change', () => {
    const root = tempPackageRoot();
    const name = 'cache.schema.json';
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      type: 'string',
    };
    writeSchema(root, name, schema);
    const before = loadGoalContractSchema(name, { packageRoot: root });
    writeSchema(root, name, { ...schema, $comment: 'changed bytes' });
    const after = loadGoalContractSchema(name, { packageRoot: root });

    assert.notEqual(after.schemaArtifactHash, before.schemaArtifactHash);
    assert.notEqual(after, before);
    assert.equal(validateGoalContractSchema(name, 'valid', { packageRoot: root }), 'valid');
  });

  it('validates standalone authority and RequirementRecord projection pointers', () => {
    const standalonePointer = {
      schemaVersion: 'goal-contract-partition-active-generation/v1',
      authorityMode: 'standalone_bootstrap',
      sourceHash: HASH,
      generationKey: HASH,
      generationRoot:
        'C:/workspace/_bmad-output/runtime/goal-contract-partition-bootstrap/source/generations/generation',
      partitionPlanPath:
        'C:/workspace/_bmad-output/runtime/goal-contract-partition-bootstrap/source/generations/generation/partition-plan.json',
      partitionPlanHash: HASH,
      partitionManifestPath:
        'C:/workspace/_bmad-output/runtime/goal-contract-partition-bootstrap/source/generations/generation/partition-manifest.json',
      partitionManifestHash: HASH,
      partitionManifestDocumentHash: HASH,
      childContractHashes: [
        {
          path: 'children/p01-root-goal-execution-plan.md',
          hash: HASH,
        },
      ],
      requiredReceiptHashes: [
        {
          path: 'receipts/global-coverage.receipt.json',
          hash: HASH,
        },
      ],
    };
    const requirementRecordPointer = {
      schemaVersion:
        'goal-contract-partition-active-requirement-record-run/v1',
      authorityMode: 'requirement_record',
      requirementSetId: 'REQ-GH-004',
      sourceHash: HASH,
      partitionRunId: `partition-run-${'b'.repeat(64)}`,
      authorityRoot:
        'C:/workspace/_bmad-output/runtime/requirement-records/REQ-GH-004/goal-contract',
      recordPath:
        'C:/workspace/_bmad-output/runtime/requirement-records/REQ-GH-004/requirement-record.json',
      recordHash: HASH,
      recordRevision: 3,
      eventChainHead: HASH,
      eventId: 'goal-contract-partition-authority:REQ-GH-004',
      eventChainProjection: HASH,
      partitionPlanHash: HASH,
      partitionManifestHash: HASH,
      partitionManifestDocumentHash: HASH,
      partitionSetHash: HASH,
      pointerProjectionHash: HASH,
    };

    assert.deepEqual(
      validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, standalonePointer),
      standalonePointer
    );
    assert.deepEqual(
      validateGoalContractSchema(
        OUTPUT_AUTHORITY_SCHEMA,
        requirementRecordPointer
      ),
      requirementRecordPointer
    );
    assert.throws(
      () =>
        validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, {
          ...standalonePointer,
          sourceHash: 'sha256:invalid',
        }),
      (error) => error.failureClass === 'canonical_schema_invalid'
    );
    assert.throws(
      () =>
        validateGoalContractSchema(OUTPUT_AUTHORITY_SCHEMA, {
          ...requirementRecordPointer,
          authorityMode: 'standalone_bootstrap',
        }),
      (error) => error.failureClass === 'canonical_schema_invalid'
    );
  });

  it('binds the output authority schema into the Kernel schema identity', () => {
    const kernel = require(
      '../src/utils/goal-contract/control-plane/index.ts'
    );

    assert.equal(
      typeof kernel.goalContractKernelSchemaArtifactHashes,
      'function'
    );
    assert.equal(
      kernel.goalContractKernelSchemaArtifactHashes()[
        OUTPUT_AUTHORITY_SCHEMA
      ],
      goalContractSchemaArtifactHash(OUTPUT_AUTHORITY_SCHEMA)
    );
    for (const schemaName of [
      'goal-contract-partition-closure-feasibility-receipt.schema.json',
      'goal-contract-partition-impact-drift-receipt.schema.json',
      'goal-contract-partition-impact-graph.schema.json',
      'goal-contract-partition-impact-policy.schema.json',
      LIFECYCLE_AUTHORITY_SCHEMA,
      SUPERVISOR_READINESS_SCHEMA,
    ]) {
      assert.equal(
        kernel.goalContractKernelSchemaArtifactHashes()[
          schemaName
        ],
        goalContractSchemaArtifactHash(schemaName)
      );
    }
  });
});
