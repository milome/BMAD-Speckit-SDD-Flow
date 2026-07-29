const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
  authorityRecord,
  subordinateBinding,
} = require('./goal-contract-canonical-intent-fixture.js');
const {
  hashControlPlaneValue,
} = require('../src/utils/goal-contract/control-plane/canonical-hash.ts');

const SOURCE_KERNEL_PATH = path.resolve(
  __dirname,
  '../src/utils/goal-contract/control-plane/index.ts'
);
const DIST_KERNEL_PATH = path.resolve(
  __dirname,
  '../dist/utils/goal-contract/control-plane/index.js'
);
const SOURCE_SCHEMA_REGISTRY_PATH = path.resolve(
  __dirname,
  '../src/utils/goal-contract/control-plane/schema-registry.ts'
);
const DIST_SCHEMA_REGISTRY_PATH = path.resolve(
  __dirname,
  '../dist/utils/goal-contract/control-plane/schema-registry.js'
);
const CAMPAIGN_CLOSURE_SCHEMA =
  'goal-contract-campaign-closure-receipt.schema.json';

function failureClass(operation) {
  try {
    operation();
  } catch (error) {
    return error.failureClass;
  }
  return null;
}

describe('canonical Kernel source/dist runtime parity', () => {
  it('loads the dist facade without repository source fallback', () => {
    assert.equal(fs.existsSync(DIST_KERNEL_PATH), true);
    const resolved = require.resolve(DIST_KERNEL_PATH);
    assert.equal(
      resolved.replace(/\\/gu, '/').includes('/dist/'),
      true
    );
    const source = fs.readFileSync(DIST_KERNEL_PATH, 'utf8');
    assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/src\//u);
    assert.doesNotMatch(source, /packages\/bmad-speckit\/src/u);
  });

  it('exports the same public function inventory', () => {
    const source = require(SOURCE_KERNEL_PATH);
    const dist = require(DIST_KERNEL_PATH);
    const sourceFunctions = Object.keys(source)
      .filter((name) => typeof source[name] === 'function')
      .sort();
    const distFunctions = Object.keys(dist)
      .filter((name) => typeof dist[name] === 'function')
      .sort();

    assert.deepEqual(distFunctions, sourceFunctions);
  });

  it('preserves policy, source snapshot, and failure semantics', () => {
    const source = require(SOURCE_KERNEL_PATH);
    const dist = require(DIST_KERNEL_PATH);
    const binding = subordinateBinding();
    const policyRequest = {
      authorityRecord: authorityRecord(
        'composite_required',
        [binding],
        hashControlPlaneValue
      ),
    };
    assert.deepEqual(
      dist.compileSourceCompositionPolicy(policyRequest),
      source.compileSourceCompositionPolicy(policyRequest)
    );
    const snapshotRequest = {
      sourceKind: 'source_plan',
      sourceArtifactId: 'runtime-parity-source',
      sourceRole: 'primary_implementation_authority',
      namespace: 'PARITY',
      sourceOrder: 0,
      pathOrSegmentId: 'docs/plans/runtime-parity-source.md',
      rawBytes: Buffer.from(
        '# PARITY\n- PARITY-REQ: MUST remain deterministic.\n',
        'utf8'
      ),
    };
    assert.deepEqual(
      dist.compileSourceSnapshot(snapshotRequest),
      source.compileSourceSnapshot(snapshotRequest)
    );
    const invalid = {
      authorityRecord: {
        ...policyRequest.authorityRecord,
        declaredMode: 'unsupported_mode',
      },
    };
    assert.equal(
      failureClass(() => dist.compileSourceCompositionPolicy(invalid)),
      failureClass(() => source.compileSourceCompositionPolicy(invalid))
    );
  });

  it('loads byte-identical canonical schema authority', () => {
    const sourceRegistry = require(SOURCE_SCHEMA_REGISTRY_PATH);
    const distRegistry = require(DIST_SCHEMA_REGISTRY_PATH);
    assert.equal(
      distRegistry.goalContractSchemaArtifactHash(
        CAMPAIGN_CLOSURE_SCHEMA
      ),
      sourceRegistry.goalContractSchemaArtifactHash(
        CAMPAIGN_CLOSURE_SCHEMA
      )
    );
  });
});
