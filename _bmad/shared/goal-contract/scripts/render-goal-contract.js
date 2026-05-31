#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT,
  extractSections,
  extractSlots,
  normalizeRepoPath,
  profileHashFor,
  sha256,
  templateHashFor,
} = require('./extract-goal-contract-profile');

const RENDERER_VERSION = 'req-trace-goal-contract-renderer/v1';

function block(code, details) {
  const error = new Error(`${code}: ${details}`);
  error.code = code;
  error.details = details;
  return error;
}

function assertSupportedProfile(profile) {
  const major = Number(String(profile.profileVersion ?? '0.0.0').split('.')[0]);
  const supported = profile.compatibility?.supportedMajorVersions ?? [];
  if (!supported.includes(major)) {
    throw block('GOAL_CONTRACT_PROFILE_UNSUPPORTED', `profileVersion=${profile.profileVersion}`);
  }
}

function validateProfileHashes(templateText, profile) {
  const templateHash = templateHashFor(templateText);
  const profileHash = profileHashFor(profile);
  const mismatches = [];
  if (profile.templateHash !== templateHash) mismatches.push('templateHash');
  if (profile.profileHash !== profileHash) mismatches.push('profileHash');
  if (mismatches.length > 0) {
    throw block('GOAL_CONTRACT_PROFILE_HASH_MISMATCH', mismatches.join(', '));
  }
}

function slotText(value, name) {
  if (typeof value === 'function') return String(value(name) ?? '');
  if (Array.isArray(value)) return value.join('\n');
  return String(value ?? '');
}

function replaceSlots(templateText, profile, slotData) {
  const slotInfo = extractSlots(templateText);
  if (slotInfo.duplicateSlots.length > 0) {
    throw block('GOAL_CONTRACT_INCOMPLETE', `duplicate slots: ${slotInfo.duplicateSlots.join(', ')}`);
  }
  if (slotInfo.unclosedSlots.length > 0) {
    throw block('GOAL_CONTRACT_INCOMPLETE', `unclosed slots: ${slotInfo.unclosedSlots.join(', ')}`);
  }

  const templateSlots = new Map(slotInfo.slots.map((slot) => [slot.name, slot]));
  const missingRequiredSlots = [];
  for (const slotName of profile.requiredSlots ?? []) {
    if (!templateSlots.has(slotName)) {
      missingRequiredSlots.push(slotName);
      continue;
    }
    const rendered = slotText(slotData[slotName], slotName).trim();
    if (!rendered) missingRequiredSlots.push(slotName);
  }
  if (missingRequiredSlots.length > 0) {
    throw block('GOAL_CONTRACT_INCOMPLETE', `missing required slots: ${missingRequiredSlots.join(', ')}`);
  }

  let document = templateText;
  for (const slot of [...slotInfo.slots].sort((a, b) => b.openIndex - a.openIndex)) {
    const openMatch = /<!--\s*goal-slot:[A-Za-z0-9_-]+[^>]*-->/.exec(document.slice(slot.openIndex));
    if (!openMatch) throw block('GOAL_CONTRACT_INCOMPLETE', `slot open marker shifted: ${slot.name}`);
    const openStart = slot.openIndex;
    const openEnd = openStart + openMatch[0].length;
    const closeMarker = `<!-- /goal-slot:${slot.name} -->`;
    const closeStart = document.indexOf(closeMarker, openEnd);
    if (closeStart < 0) throw block('GOAL_CONTRACT_INCOMPLETE', `slot close marker shifted: ${slot.name}`);
    const rendered = slotText(slotData[slot.name], slot.name).trimEnd();
    document = `${document.slice(0, openEnd)}\n${rendered}\n${document.slice(closeStart)}`;
  }

  return { document, slotInfo };
}

function auditRenderedDocument(document, profile, slotInfo, templateText) {
  const renderedSections = extractSections(document);
  const missingRequiredSections = (profile.requiredSections ?? []).filter((section) => !renderedSections.includes(section));
  const missingInvariantFragments = (profile.invariantFragments ?? []).filter((fragment) => !document.includes(fragment));
  const requiredSlots = new Set(profile.requiredSlots ?? []);
  const renderedRequiredSlots = slotInfo.slots
    .filter((slot) => requiredSlots.has(slot.name))
    .map((slot) => slot.name);
  return {
    templatePath: profile.templatePath,
    templateHash: templateHashFor(templateText),
    profileVersion: profile.profileVersion,
    profileHash: profileHashFor(profile),
    rendererVersion: RENDERER_VERSION,
    compatibilityDecision: 'pass',
    requiredSlotsPassed: renderedRequiredSlots.length === requiredSlots.size,
    missingRequiredSlots: [...requiredSlots].filter((slot) => !renderedRequiredSlots.includes(slot)),
    requiredSectionsPassed: missingRequiredSections.length === 0,
    missingRequiredSections,
    invariantFragmentsPassed: missingInvariantFragments.length === 0,
    missingInvariantFragments,
    contentHash: sha256(document),
  };
}

function renderGoalContract({ templateText, profile, slotData, validateHashes = true }) {
  if (!profile) throw block('GOAL_CONTRACT_PROFILE_MISSING', 'profile is required');
  assertSupportedProfile(profile);
  if (validateHashes) validateProfileHashes(templateText, profile);
  const { document, slotInfo } = replaceSlots(templateText, profile, slotData ?? {});
  const audit = auditRenderedDocument(document, profile, slotInfo, templateText);
  if (!audit.requiredSectionsPassed || !audit.invariantFragmentsPassed || !audit.requiredSlotsPassed) {
    throw block('GOAL_CONTRACT_INCOMPLETE', JSON.stringify(audit));
  }
  return { document, audit };
}

function main(argv = process.argv.slice(2)) {
  const args = Object.fromEntries(
    argv
      .map((arg, index) => [arg, argv[index + 1]])
      .filter(([arg]) => String(arg).startsWith('--'))
      .map(([arg, value]) => [String(arg).slice(2), value])
  );
  const templatePath = path.resolve(
    args.template || path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md')
  );
  const profilePath = path.resolve(
    args.profile || path.join(ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json')
  );
  const slotDataPath = args['slot-data'] ? path.resolve(args['slot-data']) : null;
  const outPath = args.out ? path.resolve(args.out) : null;
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const slotData = slotDataPath ? JSON.parse(fs.readFileSync(slotDataPath, 'utf8')) : {};
  const result = renderGoalContract({ templateText, profile, slotData, validateHashes: args['no-hash-check'] !== 'true' });
  if (outPath) fs.writeFileSync(outPath, result.document, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ documentPath: outPath ? normalizeRepoPath(outPath) : null, audit: result.audit }, null, 2)}\n`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 3;
  }
}

module.exports = {
  RENDERER_VERSION,
  renderGoalContract,
};
