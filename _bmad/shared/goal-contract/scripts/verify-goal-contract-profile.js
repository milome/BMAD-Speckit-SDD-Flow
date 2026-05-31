#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  extractTemplateProfile,
  normalizeRepoPath,
  profileHashFor,
  templateHashFor,
} = require('./extract-goal-contract-profile');

const SHARED_DIR = path.join(ROOT, '_bmad', 'shared', 'goal-contract');
const TEMPLATE_PATH = path.join(SHARED_DIR, 'goal-execution-contract-template.md');
const PROFILE_PATH = path.join(SHARED_DIR, 'goal-contract-profile.json');
const LOCK_PATH = path.join(SHARED_DIR, 'goal-contract-profile.lock.json');
const SKILL_REFERENCE_TEMPLATE = path.join(
  ROOT,
  '_bmad',
  'skills',
  'goal-execution-contract-generator',
  'references',
  'goal-execution-contract-template.md'
);
const SKILL_REFERENCE_PROFILE = path.join(
  ROOT,
  '_bmad',
  'skills',
  'goal-execution-contract-generator',
  'references',
  'goal-contract-profile.json'
);

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function canonicalizeForComparison(text) {
  return text
    .replace(/^\uFEFF/u, '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+$/u, '');
}

function compareFiles(left, right, issues, code) {
  if (!fs.existsSync(right)) {
    issues.push(`${code}:missing:${normalizeRepoPath(right)}`);
    return;
  }
  const leftText = canonicalizeForComparison(fs.readFileSync(left, 'utf8'));
  const rightText = canonicalizeForComparison(fs.readFileSync(right, 'utf8'));
  if (leftText !== rightText) issues.push(`${code}:drift:${normalizeRepoPath(right)}`);
}

function verifyGoalContractProfile({
  templatePath = TEMPLATE_PATH,
  profilePath = PROFILE_PATH,
  lockPath = LOCK_PATH,
  checkSkillReference = true,
} = {}) {
  const issues = [];
  if (!fs.existsSync(templatePath)) issues.push(`TEMPLATE_MISSING:${normalizeRepoPath(templatePath)}`);
  if (!fs.existsSync(profilePath)) issues.push(`PROFILE_MISSING:${normalizeRepoPath(profilePath)}`);
  if (!fs.existsSync(lockPath)) issues.push(`LOCK_MISSING:${normalizeRepoPath(lockPath)}`);
  if (issues.length > 0) return { ok: false, issues };

  const templateText = fs.readFileSync(templatePath, 'utf8');
  const profile = readJson(profilePath);
  const lock = readJson(lockPath);
  const extracted = extractTemplateProfile(templateText);
  const profileHash = profileHashFor(profile);
  const templateHash = templateHashFor(templateText);

  for (const field of [
    'schemaVersion',
    'profileId',
    'profileVersion',
    'contractVersion',
    'templatePath',
    'templateHash',
    'profileHash',
    'requiredSections',
    'requiredFrontMatterFields',
    'requiredSlots',
    'optionalSlots',
    'invariantFragments',
    'compatibility',
  ]) {
    if (profile[field] === undefined || profile[field] === null) issues.push(`PROFILE_FIELD_MISSING:${field}`);
  }
  if (profile.templatePath !== normalizeRepoPath(templatePath)) issues.push('PROFILE_TEMPLATE_PATH_MISMATCH');
  if (profile.templateHash !== templateHash) issues.push('PROFILE_TEMPLATE_HASH_MISMATCH');
  if (profile.profileHash !== profileHash) issues.push('PROFILE_HASH_MISMATCH');
  if (lock.templateHash !== templateHash) issues.push('LOCK_TEMPLATE_HASH_MISMATCH');
  if (lock.profileHash !== profileHash) issues.push('LOCK_PROFILE_HASH_MISMATCH');
  if (lock.profileVersion !== profile.profileVersion) issues.push('LOCK_PROFILE_VERSION_MISMATCH');

  for (const section of profile.requiredSections ?? []) {
    if (!extracted.sections.includes(section)) issues.push(`REQUIRED_SECTION_MISSING:${section}`);
  }
  const templateSlotNames = extracted.slots.map((slot) => slot.name);
  for (const slot of profile.requiredSlots ?? []) {
    if (!templateSlotNames.includes(slot)) issues.push(`REQUIRED_SLOT_MISSING:${slot}`);
  }
  for (const duplicate of extracted.duplicateSlots) issues.push(`DUPLICATE_SLOT:${duplicate}`);
  for (const unclosed of extracted.unclosedSlots) issues.push(`UNCLOSED_SLOT:${unclosed}`);
  for (const fragment of profile.invariantFragments ?? []) {
    if (!templateText.includes(fragment) && !['model_packet.json is the machine-readable execution authority', 'goal_execution.md is not execution authority', '/goal completion is not closeout proof'].includes(fragment)) {
      issues.push(`INVARIANT_NOT_DECLARED_OR_RENDERABLE:${fragment}`);
    }
  }

  if (profile.governanceRules?.profileIsGenerationSource !== false) {
    issues.push('PROFILE_MUST_NOT_BE_GENERATION_SOURCE');
  }
  if (profile.governanceRules?.templateIsHumanCanonical !== true) {
    issues.push('TEMPLATE_MUST_BE_HUMAN_CANONICAL');
  }

  if (checkSkillReference) {
    compareFiles(templatePath, SKILL_REFERENCE_TEMPLATE, issues, 'SKILL_REFERENCE_TEMPLATE');
    compareFiles(profilePath, SKILL_REFERENCE_PROFILE, issues, 'SKILL_REFERENCE_PROFILE');
  }

  return {
    ok: issues.length === 0,
    issues,
    templateHash,
    profileHash,
    profileVersion: profile.profileVersion,
  };
}

function main() {
  const result = verifyGoalContractProfile();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 3;
}

if (require.main === module) {
  main();
}

module.exports = {
  verifyGoalContractProfile,
};
