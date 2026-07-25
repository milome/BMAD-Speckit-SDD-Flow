const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

export type GoalContractPartitionPolicyModule = never;

const AUTHORITY_FIELDS = new Set([
  'decision',
  'fixtureId',
  'fixtureIdentity',
  'partitionCount',
  'partitions',
  'preferredCandidate',
  'selectedCandidate',
  'selectionReceipt',
  'selectionReceiptHash',
  'taskAssignment',
  'taskAssignments',
  'tasks',
]);

function failure(failureClass, extra = {}) {
  return Object.assign(new Error(failureClass), { failureClass, ...extra });
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function normalizePath(filePath) {
  return path.resolve(filePath).replace(/\\/gu, '/');
}

function resolvePackageRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function findPartitionAuthorityFields(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, child] of Object.entries(value)) {
    if (AUTHORITY_FIELDS.has(key)) found.push(key);
    findPartitionAuthorityFields(child, found);
  }
  return [...new Set(found)].sort();
}

function assertNoPartitionAuthorityFields(policy) {
  const forbiddenFields = findPartitionAuthorityFields(policy);
  if (forbiddenFields.length > 0) {
    throw failure('partition_policy_authority_field_forbidden', {
      forbiddenFields,
    });
  }
}

function validatePartitionPolicy(policy, schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(policy)) {
    throw failure('partition_policy_schema_invalid', {
      validationErrors: validate.errors || [],
    });
  }
  return policy;
}

function canonicalizePartitionPolicy(policy) {
  return structuredClone(policy);
}

function loadPartitionPolicy({
  packageRoot = resolvePackageRoot(),
  policyPath = null,
}: {
  packageRoot?: string;
  policyPath?: string | null;
} = {}) {
  const resolvedPath = policyPath
    ? path.resolve(policyPath)
    : path.join(
        packageRoot,
        '_bmad',
        'shared',
        'goal-contract',
        'goal-contract-partition-policy.json'
      );
  const schemaPath = path.join(
    packageRoot,
    '_bmad',
    'shared',
    'goal-contract',
    'goal-contract-partition-policy.schema.json'
  );
  if (!fs.existsSync(resolvedPath) || !fs.existsSync(schemaPath)) {
    throw failure('partition_policy_missing', {
      policyPath: normalizePath(resolvedPath),
      schemaPath: normalizePath(schemaPath),
    });
  }
  const rawPolicy = fs.readFileSync(resolvedPath);
  let policy;
  try {
    policy = JSON.parse(rawPolicy.toString('utf8'));
  } catch (error) {
    throw failure('partition_policy_schema_invalid', {
      parseError: error instanceof Error ? error.message : String(error),
    });
  }
  assertNoPartitionAuthorityFields(policy);
  validatePartitionPolicy(policy, schemaPath);
  const canonicalPolicy = canonicalizePartitionPolicy(policy);
  return Object.freeze({
    policy: deepFreeze(policy),
    policyPath: normalizePath(resolvedPath),
    policyBytes: rawPolicy.length,
    partitionPolicyHash: sha256(
      Buffer.from(stableStringify(canonicalPolicy), 'utf8')
    ),
    partitionPolicyArtifactHash: sha256(rawPolicy),
  });
}

module.exports = {
  assertNoPartitionAuthorityFields,
  canonicalizePartitionPolicy,
  loadPartitionPolicy,
};
