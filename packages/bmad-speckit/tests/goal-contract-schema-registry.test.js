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
});
