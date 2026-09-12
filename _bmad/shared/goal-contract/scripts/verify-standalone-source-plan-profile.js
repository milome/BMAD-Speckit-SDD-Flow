#!/usr/bin/env node
/* eslint-disable no-console */
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats').default;

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const SHARED = path.join(ROOT, '_bmad', 'shared', 'goal-contract');
const TEMPLATE = path.join(SHARED, 'standalone-source-plan-template.md');
const PROFILE = path.join(SHARED, 'standalone-source-plan-profile.json');
const SCHEMAS = [
  'standalone-source-plan-profile.schema.json',
  'canonical-requirement-graph.schema.json',
  'standalone-source-plan-lint-result.schema.json',
];
const REFERENCES = [
  path.join(
    ROOT,
    '_bmad',
    'skills',
    'goal-execution-contract-generator',
    'references',
    'standalone-source-plan-template.md'
  ),
  path.join(
    ROOT,
    '_bmad',
    'skills',
    'goal-execution-contract-generator',
    'references',
    'standalone-source-plan-profile.json'
  ),
];

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])])
    );
  }
  return value;
}

function profileHash(profile) {
  const payload = { ...profile };
  delete payload.profileHash;
  return sha256(JSON.stringify(canonicalize(payload)));
}

function compileSchema(file, issues) {
  const schemaPath = path.join(SHARED, file);
  if (!fs.existsSync(schemaPath)) {
    issues.push(`SCHEMA_MISSING:${file}`);
    return null;
  }
  try {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    return ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
  } catch (error) {
    issues.push(`SCHEMA_INVALID:${file}:${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function verifyStandaloneSourcePlanProfile() {
  const issues = [];
  for (const file of [TEMPLATE, PROFILE, ...REFERENCES]) {
    if (!fs.existsSync(file)) issues.push(`ASSET_MISSING:${path.relative(ROOT, file)}`);
  }
  const validators = Object.fromEntries(
    SCHEMAS.map((file) => [file, compileSchema(file, issues)])
  );
  if (issues.length > 0) return { ok: false, issues, checkedReferences: [] };

  const templateBytes = fs.readFileSync(TEMPLATE);
  const profileBytes = fs.readFileSync(PROFILE);
  const profile = JSON.parse(profileBytes.toString('utf8'));
  const profileValidator = validators['standalone-source-plan-profile.schema.json'];
  if (!profileValidator(profile)) {
    issues.push(`PROFILE_SCHEMA_INVALID:${JSON.stringify(profileValidator.errors)}`);
  }
  const actualTemplateHash = sha256(templateBytes);
  const actualProfileHash = profileHash(profile);
  if (profile.templateHash !== actualTemplateHash) issues.push('TEMPLATE_HASH_MISMATCH');
  if (profile.profileHash !== actualProfileHash) issues.push('PROFILE_HASH_MISMATCH');
  if (!fs.readFileSync(REFERENCES[0]).equals(templateBytes)) issues.push('TEMPLATE_PROJECTION_DRIFT');
  if (!fs.readFileSync(REFERENCES[1]).equals(profileBytes)) issues.push('PROFILE_PROJECTION_DRIFT');

  return {
    schemaVersion: 'StandaloneSourcePlanProfileVerification/v1',
    ok: issues.length === 0,
    issues,
    templateHash: actualTemplateHash,
    profileHash: actualProfileHash,
    checkedSchemas: SCHEMAS,
    checkedReferences: REFERENCES.map((file) => path.relative(ROOT, file).replace(/\\/gu, '/')),
  };
}

if (require.main === module) {
  const result = verifyStandaloneSourcePlanProfile();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 3;
}

module.exports = { verifyStandaloneSourcePlanProfile };
