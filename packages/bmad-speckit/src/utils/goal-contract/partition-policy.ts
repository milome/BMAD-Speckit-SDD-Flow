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
const POLICY_AUTHORITY_OVERRIDE_FIELDS = [
  'partitionPolicyArtifactHash',
  'partitionPolicyHash',
  'policy',
  'policyBytes',
];
const POLICY_BINDING_OVERRIDE_FIELDS = ['packageRoot', 'policyPath'];
const COMPILATION_IDENTITY_FIELDS = [
  'sourceSnapshotHash',
  'semanticModelHash',
  'executionProjectionHash',
];
const policyBindingCache = new Map();
const policyBindingMetadata = new WeakMap();
const optimizerPolicyBindings = new WeakMap();

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
  const target = policy.limits.targetClosureMinutesPerPartition;
  if (
    target.min > target.max ||
    target.max > policy.limits.maxClosureMinutesPerPartition
  ) {
    throw failure('partition_policy_schema_invalid', {
      validationErrors: [
        {
          keyword: 'closureMinuteRange',
          message:
            'target closure minutes must be ordered and fit within the hard maximum',
        },
      ],
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
  const canonicalPolicyPath = path.join(
    packageRoot,
    '_bmad',
    'shared',
    'goal-contract',
    'goal-contract-partition-policy.json'
  );
  const resolvedPath = policyPath ? path.resolve(policyPath) : canonicalPolicyPath;
  if (normalizePath(resolvedPath) !== normalizePath(canonicalPolicyPath)) {
    throw failure('partition_policy_binding_mismatch', {
      mismatchedFields: ['policyPath'],
      expectedPolicyPath: normalizePath(canonicalPolicyPath),
      actualPolicyPath: normalizePath(resolvedPath),
    });
  }
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
  const partitionPolicyArtifactHash = sha256(rawPolicy);
  const schemaArtifactHash = sha256(fs.readFileSync(schemaPath));
  const cacheKey = stableStringify({
    policyPath: normalizePath(resolvedPath),
    schemaPath: normalizePath(schemaPath),
    partitionPolicyArtifactHash,
    schemaArtifactHash,
  });
  const cached = policyBindingCache.get(cacheKey);
  if (cached) return cached;
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
  const binding = Object.freeze({
    policy: deepFreeze(policy),
    policyPath: normalizePath(resolvedPath),
    policyBytes: rawPolicy.length,
    partitionPolicyHash: sha256(
      Buffer.from(stableStringify(canonicalPolicy), 'utf8')
    ),
    partitionPolicyArtifactHash,
  });
  policyBindingMetadata.set(binding, {
    packageRoot: normalizePath(packageRoot),
    policyPath: normalizePath(resolvedPath),
    schemaPath: normalizePath(schemaPath),
    policy: binding.policy,
    policyBytes: binding.policyBytes,
    partitionPolicyHash: binding.partitionPolicyHash,
    partitionPolicyArtifactHash: binding.partitionPolicyArtifactHash,
  });
  policyBindingCache.set(cacheKey, binding);
  return binding;
}

function assertCurrentPartitionPolicyBinding(
  input: Record<string, unknown> = {}
) {
  const forbiddenFields = POLICY_AUTHORITY_OVERRIDE_FIELDS.filter((field) =>
    Object.hasOwn(input, field)
  );
  if (forbiddenFields.length > 0) {
    throw failure('partition_policy_authority_override_forbidden', {
      forbiddenFields,
    });
  }
  const bindingOverrideFields = POLICY_BINDING_OVERRIDE_FIELDS.filter((field) =>
    Object.hasOwn(input, field)
  );
  const policyBinding = input.policyBinding as ReturnType<
    typeof loadPartitionPolicy
  >;
  const metadata = policyBindingMetadata.get(policyBinding);
  if (bindingOverrideFields.length > 0 || !metadata) {
    throw failure('partition_policy_binding_mismatch', {
      mismatchedFields: bindingOverrideFields.length
        ? bindingOverrideFields
        : ['policyBinding'],
    });
  }
  const bindingMismatches = [
    ['policy', policyBinding.policy, metadata.policy],
    ['policyPath', policyBinding.policyPath, metadata.policyPath],
    ['policyBytes', policyBinding.policyBytes, metadata.policyBytes],
    [
      'partitionPolicyHash',
      policyBinding.partitionPolicyHash,
      metadata.partitionPolicyHash,
    ],
    [
      'partitionPolicyArtifactHash',
      policyBinding.partitionPolicyArtifactHash,
      metadata.partitionPolicyArtifactHash,
    ],
  ]
    .filter(([, actual, expected]) => actual !== expected)
    .map(([field]) => field);
  if (bindingMismatches.length > 0) {
    throw failure('partition_policy_binding_mismatch', {
      mismatchedFields: bindingMismatches,
    });
  }

  const current = loadPartitionPolicy({
    packageRoot: metadata.packageRoot,
    policyPath: metadata.policyPath,
  });
  const staleFields = [
    'policyBytes',
    'partitionPolicyHash',
    'partitionPolicyArtifactHash',
  ].filter((field) => current[field] !== policyBinding[field]);
  if (staleFields.length > 0) {
    throw failure('partition_policy_stale_before_optimization', {
      staleFields,
      expected: Object.fromEntries(
        staleFields.map((field) => [field, policyBinding[field]])
      ),
      actual: Object.fromEntries(staleFields.map((field) => [field, current[field]])),
    });
  }
  if (current !== policyBinding) {
    throw failure('partition_policy_binding_mismatch', {
      mismatchedFields: ['policyBinding'],
    });
  }

  const invalidFields = COMPILATION_IDENTITY_FIELDS.filter(
    (field) => !/^sha256:[0-9a-f]{64}$/u.test(String(input[field] || ''))
  );
  if (invalidFields.length > 0) {
    throw failure('partition_policy_compilation_identity_invalid', {
      invalidFields,
    });
  }
  const identities = Object.fromEntries(
    COMPILATION_IDENTITY_FIELDS.map((field) => [field, input[field]])
  );
  const existing = optimizerPolicyBindings.get(policyBinding);
  if (existing) {
    const mismatchedFields = COMPILATION_IDENTITY_FIELDS.filter(
      (field) => existing.identities[field] !== identities[field]
    );
    if (mismatchedFields.length > 0) {
      throw failure('partition_policy_compilation_identity_mismatch', {
        mismatchedFields,
        expected: existing.identities,
        actual: identities,
      });
    }
    return existing.binding;
  }

  const binding = Object.freeze({
    ...policyBinding,
    ...identities,
  });
  optimizerPolicyBindings.set(policyBinding, {
    identities: Object.freeze(identities),
    binding,
  });
  return binding;
}

module.exports = {
  assertNoPartitionAuthorityFields,
  assertCurrentPartitionPolicyBinding,
  canonicalizePartitionPolicy,
  loadPartitionPolicy,
};
