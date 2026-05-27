#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  extractTemplateProfile,
  normalizeRepoPath,
  profileHashFor,
  sha256,
} = require('./extract-goal-contract-profile');

const SHARED_DIR = path.join(ROOT, '_bmad', 'shared', 'goal-contract');
const TEMPLATE_PATH = path.join(SHARED_DIR, 'goal-execution-contract-template.md');
const PROFILE_PATH = path.join(SHARED_DIR, 'goal-contract-profile.json');
const LOCK_PATH = path.join(SHARED_DIR, 'goal-contract-profile.lock.json');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function majorVersion(version) {
  return Number(String(version ?? '0.0.0').split('.')[0]);
}

function classifyProfileChange(beforeProfile, afterProfile) {
  const requiredKeys = ['requiredSections', 'requiredFrontMatterFields', 'requiredSlots', 'invariantFragments'];
  const requiredChanged = requiredKeys.some(
    (key) => JSON.stringify(beforeProfile?.[key] ?? []) !== JSON.stringify(afterProfile?.[key] ?? [])
  );
  const authorityChanged =
    JSON.stringify(beforeProfile?.compatibility?.semverPolicy ?? {}) !==
    JSON.stringify(afterProfile?.compatibility?.semverPolicy ?? {});
  const optionalChanged =
    JSON.stringify(beforeProfile?.optionalSlots ?? []) !== JSON.stringify(afterProfile?.optionalSlots ?? []);
  if (requiredChanged || authorityChanged) return 'major';
  if (optionalChanged) return 'minor';
  return 'patch';
}

function updateGoalContractProfile({ now = new Date().toISOString() } = {}) {
  const templateText = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const profile = readJson(PROFILE_PATH);
  const extracted = extractTemplateProfile(templateText);
  profile.templatePath = normalizeRepoPath(TEMPLATE_PATH);
  profile.templateHash = sha256(templateText);
  profile.profileHash = profileHashFor(profile);
  writeJson(PROFILE_PATH, profile);

  const lock = fs.existsSync(LOCK_PATH) ? readJson(LOCK_PATH) : {};
  lock.schemaVersion = lock.schemaVersion ?? 'goal-contract-profile-lock/v1';
  lock.profileId = profile.profileId;
  lock.profileVersion = profile.profileVersion;
  lock.templatePath = profile.templatePath;
  lock.templateHash = profile.templateHash;
  lock.profileHash = profile.profileHash;
  lock.minimumRendererVersion = profile.compatibility?.minimumRendererVersion ?? lock.minimumRendererVersion ?? '1.0.0';
  lock.updatedAt = now;
  writeJson(LOCK_PATH, lock);

  return {
    profileVersion: profile.profileVersion,
    profileMajorVersion: majorVersion(profile.profileVersion),
    templateHash: profile.templateHash,
    profileHash: profile.profileHash,
    requiredSections: extracted.sections,
    requiredSlots: extracted.slots.filter((slot) => slot.required).map((slot) => slot.name),
  };
}

function main() {
  const result = updateGoalContractProfile();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main();
}

module.exports = {
  classifyProfileChange,
  updateGoalContractProfile,
};
