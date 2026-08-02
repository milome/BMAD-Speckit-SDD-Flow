const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv = require('ajv');

export type GoalContractPartitionMethodologyProfileModule = never;

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

function canonicalSemanticProfile(profile) {
  return {
    schemaVersion: profile.schemaVersion,
    profileId: profile.profileId,
    profileVersion: profile.profileVersion,
    canonicalizationVersion: profile.canonicalizationVersion,
    rules: [...profile.rules]
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId))
      .map(({ ruleId, classification, normativeRule, deterministicChecks }) => ({
        ruleId,
        classification,
        normativeRule,
        deterministicChecks: [...deterministicChecks].sort(),
      })),
    exclusions: [...profile.exclusions].sort(),
  };
}

function resolvePackageRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function validateProfile(profile, schemaPath) {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  const validate = new Ajv({ allErrors: true, strict: false }).compile(schema);
  if (!validate(profile)) {
    throw failure('methodology_profile_schema_invalid', {
      validationErrors: validate.errors || [],
    });
  }
  const ruleIds = profile.rules.map((rule) => rule.ruleId);
  if (new Set(ruleIds).size !== ruleIds.length) {
    throw failure('methodology_profile_rule_id_duplicate', {
      duplicateRuleIds: ruleIds.filter((ruleId, index) => ruleIds.indexOf(ruleId) !== index),
    });
  }
}

function loadPartitionMethodologyProfile({
  packageRoot = resolvePackageRoot(),
} = {}) {
  const profilePath = path.join(
    packageRoot,
    '_bmad',
    'shared',
    'goal-contract',
    'goal-contract-partition-methodology-profile.json'
  );
  const schemaPath = path.join(
    packageRoot,
    '_bmad',
    'shared',
    'goal-contract',
    'goal-contract-partition-methodology-profile.schema.json'
  );
  if (!fs.existsSync(profilePath) || !fs.existsSync(schemaPath)) {
    throw failure('methodology_profile_missing', { profilePath, schemaPath });
  }
  const rawProfile = fs.readFileSync(profilePath);
  const profile = JSON.parse(rawProfile.toString('utf8'));
  validateProfile(profile, schemaPath);
  const semantic = canonicalSemanticProfile(profile);
  return Object.freeze({
    profile: deepFreeze(profile),
    semantic: deepFreeze(semantic),
    methodologyProfileHash: sha256(Buffer.from(stableStringify(semantic), 'utf8')),
    methodologyProfileArtifactHash: sha256(rawProfile),
    methodologySourceBundleHash: profile.provenance.methodologySourceBundleHash,
    profilePath: profilePath.replace(/\\/gu, '/'),
  });
}

module.exports = {
  canonicalSemanticProfile,
  loadPartitionMethodologyProfile,
};
