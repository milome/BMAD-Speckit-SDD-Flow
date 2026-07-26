const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  assertCurrentPartitionPolicyBinding,
  loadPartitionPolicy,
} = require('../src/utils/goal-contract/partition-policy.ts');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const ASSET_DIR = path.join('_bmad', 'shared', 'goal-contract');
const POLICY_NAME = 'goal-contract-partition-policy.json';
const SCHEMA_NAME = 'goal-contract-partition-policy.schema.json';

function tempPackageRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'partition-policy-'));
  fs.mkdirSync(path.join(root, ASSET_DIR), { recursive: true });
  for (const name of [POLICY_NAME, SCHEMA_NAME]) {
    fs.copyFileSync(path.join(REPO_ROOT, ASSET_DIR, name), path.join(root, ASSET_DIR, name));
  }
  return root;
}

function readPolicy(root) {
  return JSON.parse(fs.readFileSync(path.join(root, ASSET_DIR, POLICY_NAME), 'utf8'));
}

function writePolicy(filePath, policy) {
  fs.writeFileSync(filePath, `${JSON.stringify(policy, null, 2)}\n`, 'utf8');
}

function reverseKeys(value) {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)])
  );
}

function compilationIdentities(suffix = 'current') {
  return {
    sourceSnapshotHash: `sha256:${createHash('sha256').update(`source:${suffix}`).digest('hex')}`,
    semanticModelHash: `sha256:${createHash('sha256').update(`semantic:${suffix}`).digest('hex')}`,
    executionProjectionHash: `sha256:${createHash('sha256')
      .update(`projection:${suffix}`)
      .digest('hex')}`,
  };
}

describe('goal-contract partition policy', () => {
  it('loads an authority-field-free package policy with semantic and byte bindings', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });

    assert.equal(loaded.policy.schemaVersion, 'goal-contract-partition-policy/v1');
    assert.match(loaded.partitionPolicyHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(loaded.partitionPolicyArtifactHash, /^sha256:[0-9a-f]{64}$/u);
    assert.ok(loaded.policyBytes > 0);
    assert.deepEqual(loaded.policy.limits.targetClosureMinutesPerPartition, {
      min: 120,
      max: 180,
    });
    assert.equal(loaded.policy.limits.maxClosureMinutesPerPartition, 240);
    assert.equal(
      Object.hasOwn(loaded.policy.limits, 'maxAtomicTasksPerPartition'),
      false
    );
    for (const field of ['partitionCount', 'taskAssignments', 'preferredCandidate']) {
      assert.equal(Object.hasOwn(loaded.policy, field), false);
    }
  });

  it('rejects caller-authored partition authority fields before schema validation', () => {
    const cases = [
      ['partitionCount', 2],
      ['taskAssignments', { 'TASK-001': 'PARTITION-001' }],
      ['preferredCandidate', 'candidate-1'],
      ['fixtureIdentity', 'fixture-1'],
    ];
    for (const [field, value] of cases) {
      const root = tempPackageRoot();
      const policy = readPolicy(root);
      policy[field] = value;
      writePolicy(path.join(root, ASSET_DIR, POLICY_NAME), policy);
      assert.throws(
        () => loadPartitionPolicy({ packageRoot: root }),
        (error) =>
          error.failureClass === 'partition_policy_authority_field_forbidden' &&
          error.forbiddenFields.includes(field)
      );
    }
  });

  it('rejects invalid numeric bounds and unknown properties', () => {
    const mutations = [
      (policy) => { policy.weights.dependencyCut = -1; },
      (policy) => { policy.weights.auditOverhead = 1.5; },
      (policy) => { policy.limits.maxSearchStates = 0; },
      (policy) => { policy.limits.maxClosureMinutesPerPartition = 241; },
      (policy) => { policy.limits.targetClosureMinutesPerPartition.max = 181; },
      (policy) => { policy.limits.maxAtomicTasksPerPartition = 4; },
      (policy) => { policy.unknownProperty = true; },
    ];
    for (const mutate of mutations) {
      const root = tempPackageRoot();
      const policy = readPolicy(root);
      mutate(policy);
      writePolicy(path.join(root, ASSET_DIR, POLICY_NAME), policy);
      assert.throws(
        () => loadPartitionPolicy({ packageRoot: root }),
        (error) => error.failureClass === 'partition_policy_schema_invalid'
      );
    }
  });

  it('hashes normalized semantics while binding canonical file path and exact bytes', () => {
    const root = tempPackageRoot();
    const original = loadPartitionPolicy({ packageRoot: root });
    const policy = readPolicy(root);
    const canonicalPath = path.join(root, ASSET_DIR, POLICY_NAME);
    writePolicy(canonicalPath, reverseKeys(policy));
    const reordered = loadPartitionPolicy({ packageRoot: root });

    assert.equal(reordered.partitionPolicyHash, original.partitionPolicyHash);
    assert.notEqual(reordered.partitionPolicyArtifactHash, original.partitionPolicyArtifactHash);
    assert.equal(reordered.policyPath, path.resolve(canonicalPath).replace(/\\/gu, '/'));
    const bytes = fs.readFileSync(canonicalPath);
    assert.equal(reordered.policyBytes, bytes.length);
    assert.equal(
      reordered.partitionPolicyArtifactHash,
      `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    );

    for (const mutate of [
      (value) => { value.limits.maxSearchStates += 1; },
      (value) => { value.weights.dependencyCut += 1; },
      (value) => { value.semanticDerivationAllowance = !value.semanticDerivationAllowance; },
    ]) {
      const changed = structuredClone(policy);
      mutate(changed);
      writePolicy(canonicalPath, changed);
      assert.notEqual(
        loadPartitionPolicy({ packageRoot: root }).partitionPolicyHash,
        original.partitionPolicyHash
      );
    }
  });

  it('rejects a byte-valid substitute policy path', () => {
    const root = tempPackageRoot();
    const explicitPath = path.join(root, 'explicit-policy.json');
    writePolicy(explicitPath, readPolicy(root));

    assert.throws(
      () => loadPartitionPolicy({ packageRoot: root, policyPath: explicitPath }),
      (error) =>
        error.failureClass === 'partition_policy_binding_mismatch' &&
        error.mismatchedFields.includes('policyPath')
    );
  });

  it('binds one current policy object to immutable compilation identities', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });
    const identities = compilationIdentities();
    const optimizerPolicy = assertCurrentPartitionPolicyBinding({
      policyBinding: loaded,
      ...identities,
    });

    assert.equal(optimizerPolicy.partitionPolicyHash, loaded.partitionPolicyHash);
    assert.equal(optimizerPolicy.policy, loaded.policy);
    assert.equal(optimizerPolicy.sourceSnapshotHash, identities.sourceSnapshotHash);
    assert.equal(optimizerPolicy.semanticModelHash, identities.semanticModelHash);
    assert.equal(
      optimizerPolicy.executionProjectionHash,
      identities.executionProjectionHash
    );

    const policyBytes = fs.readFileSync(path.join(root, ASSET_DIR, POLICY_NAME));
    fs.writeFileSync(path.join(root, ASSET_DIR, POLICY_NAME), policyBytes);
    assert.equal(
      assertCurrentPartitionPolicyBinding({
        policyBinding: loaded,
        ...identities,
      }),
      optimizerPolicy
    );
    assert.equal(loadPartitionPolicy({ packageRoot: root }), loaded);
  });

  it('rejects a policy changed after loading before optimization', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });
    const policy = readPolicy(root);
    policy.limits.maxSearchStates += 1;
    writePolicy(path.join(root, ASSET_DIR, POLICY_NAME), policy);

    assert.throws(
      () =>
        assertCurrentPartitionPolicyBinding({
          policyBinding: loaded,
          ...compilationIdentities(),
        }),
      (error) => error.failureClass === 'partition_policy_stale_before_optimization'
    );
  });

  it('rejects substituted bindings, policy paths and package roots', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });
    const otherRoot = tempPackageRoot();
    const otherBinding = loadPartitionPolicy({ packageRoot: otherRoot });
    const identities = compilationIdentities();
    const cases = [
      { policyBinding: { ...loaded }, ...identities },
      { policyBinding: loaded, policyPath: loaded.policyPath, ...identities },
      { policyBinding: otherBinding, packageRoot: otherRoot, ...identities },
    ];

    for (const input of cases) {
      assert.throws(
        () => assertCurrentPartitionPolicyBinding(input),
        (error) => error.failureClass === 'partition_policy_binding_mismatch'
      );
    }
  });

  it('rejects caller-authored policy hashes, bytes and objects', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });
    const base = {
      policyBinding: loaded,
      ...compilationIdentities(),
    };
    const cases = [
      ['partitionPolicyHash', loaded.partitionPolicyHash],
      ['partitionPolicyArtifactHash', loaded.partitionPolicyArtifactHash],
      ['policyBytes', loaded.policyBytes],
      ['policy', loaded.policy],
    ];

    for (const [field, value] of cases) {
      assert.throws(
        () => assertCurrentPartitionPolicyBinding({ ...base, [field]: value }),
        (error) =>
          error.failureClass === 'partition_policy_authority_override_forbidden' &&
          error.forbiddenFields.includes(field)
      );
    }
  });

  it('rejects a binding reused for another compilation identity', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });
    const current = compilationIdentities();
    assertCurrentPartitionPolicyBinding({
      policyBinding: loaded,
      ...current,
    });

    for (const field of [
      'sourceSnapshotHash',
      'semanticModelHash',
      'executionProjectionHash',
    ]) {
      assert.throws(
        () =>
          assertCurrentPartitionPolicyBinding({
            policyBinding: loaded,
            ...current,
            [field]: compilationIdentities(field)[field],
          }),
        (error) =>
          error.failureClass === 'partition_policy_compilation_identity_mismatch' &&
          error.mismatchedFields.includes(field)
      );
    }
  });

  it('rejects missing or malformed compilation identities before binding', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });
    const current = compilationIdentities();
    const cases = [
      { ...current, sourceSnapshotHash: undefined },
      { ...current, semanticModelHash: 'semantic-current' },
      { ...current, executionProjectionHash: 'sha256:not-hex' },
    ];

    for (const identities of cases) {
      assert.throws(
        () =>
          assertCurrentPartitionPolicyBinding({
            policyBinding: loaded,
            ...identities,
          }),
        (error) =>
          error.failureClass === 'partition_policy_compilation_identity_invalid' &&
          error.invalidFields.length === 1
      );
    }
  });
});
