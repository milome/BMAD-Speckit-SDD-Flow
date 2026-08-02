const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  hashControlPlaneValue,
} = require(
  __filename.endsWith('.ts')
    ? './canonical-hash.ts'
    : './canonical-hash'
);
const {
  goalContractSchemaArtifactHash,
  validateGoalContractSchema,
} = require(
  __filename.endsWith('.ts')
    ? './schema-registry.ts'
    : './schema-registry'
);

export type GoalContractPartitionImpactPolicyModule = never;

const POLICY_NAME = 'goal-contract-partition-impact-policy.json';
const POLICY_SCHEMA_NAME =
  'goal-contract-partition-impact-policy.schema.json';

function failure(failureClass, details = {}) {
  return Object.assign(new Error(failureClass), {
    failureClass,
    ...details,
  });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function packageRoot(explicitRoot) {
  if (explicitRoot) return path.resolve(explicitRoot);
  let current = path.resolve(__dirname);
  const levels = __filename.endsWith('.ts') ? 6 : 4;
  for (let index = 0; index < levels; index += 1) {
    current = path.dirname(current);
  }
  return current;
}

function policyPath(root) {
  return path.join(
    root,
    '_bmad',
    'shared',
    'goal-contract',
    POLICY_NAME
  );
}

function sha256Buffer(value) {
  return `sha256:${createHash('sha256')
    .update(Buffer.from(value))
    .digest('hex')}`;
}

function loadPartitionImpactPolicy({ packageRoot: explicitRoot } = {}) {
  const root = packageRoot(explicitRoot);
  const target = policyPath(root);
  let bytes;
  let policy;
  try {
    bytes = fs.readFileSync(target);
    policy = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw failure('partition_impact_policy_invalid', {
      policyPath: target.replace(/\\/gu, '/'),
      reason: error instanceof Error ? error.message : String(error),
    });
  }
  try {
    validateGoalContractSchema(POLICY_SCHEMA_NAME, policy, {
      packageRoot: root,
    });
  } catch (error) {
    throw failure('partition_impact_policy_invalid', {
      policyPath: target.replace(/\\/gu, '/'),
      validationErrors: error.validationErrors || [],
    });
  }
  return deepFreeze({
    ...policy,
    partitionImpactPolicyArtifactHash: sha256Buffer(bytes),
    partitionImpactPolicySchemaHash:
      goalContractSchemaArtifactHash(POLICY_SCHEMA_NAME, {
        packageRoot: root,
      }),
    partitionImpactPolicyHash: hashControlPlaneValue(policy),
  });
}

module.exports = {
  loadPartitionImpactPolicy,
};
