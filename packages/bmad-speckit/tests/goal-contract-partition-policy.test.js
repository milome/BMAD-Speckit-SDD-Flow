const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
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

describe('goal-contract partition policy', () => {
  it('loads an authority-field-free package policy with semantic and byte bindings', () => {
    const root = tempPackageRoot();
    const loaded = loadPartitionPolicy({ packageRoot: root });

    assert.equal(loaded.policy.schemaVersion, 'goal-contract-partition-policy/v1');
    assert.match(loaded.partitionPolicyHash, /^sha256:[0-9a-f]{64}$/u);
    assert.match(loaded.partitionPolicyArtifactHash, /^sha256:[0-9a-f]{64}$/u);
    assert.ok(loaded.policyBytes > 0);
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

  it('hashes normalized semantics while binding explicit file path and exact bytes', () => {
    const root = tempPackageRoot();
    const original = loadPartitionPolicy({ packageRoot: root });
    const policy = readPolicy(root);
    const explicitPath = path.join(root, 'explicit-policy.json');
    writePolicy(explicitPath, reverseKeys(policy));
    const reordered = loadPartitionPolicy({ packageRoot: root, policyPath: explicitPath });

    assert.equal(reordered.partitionPolicyHash, original.partitionPolicyHash);
    assert.notEqual(reordered.partitionPolicyArtifactHash, original.partitionPolicyArtifactHash);
    assert.equal(reordered.policyPath, path.resolve(explicitPath).replace(/\\/gu, '/'));
    const bytes = fs.readFileSync(explicitPath);
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
      writePolicy(explicitPath, changed);
      assert.notEqual(
        loadPartitionPolicy({ packageRoot: root, policyPath: explicitPath }).partitionPolicyHash,
        original.partitionPolicyHash
      );
    }
  });
});
