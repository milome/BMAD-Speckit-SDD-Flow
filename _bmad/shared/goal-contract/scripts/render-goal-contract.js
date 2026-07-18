#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const {
  requireLargeDocumentWriter,
} = require('../../skill-runtime/resolve-bmad-runtime');
const {
  ROOT,
  extractSections,
  extractSlots,
  normalizeRepoPath,
  profileHashFor,
  sha256,
  templateHashFor,
} = require('./extract-goal-contract-profile');

const { safeWriteText } = requireLargeDocumentWriter();
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

function appendFrontMatterField(text, field, value) {
  if (new RegExp(`^${field}:`, 'mu').test(text)) return text;
  const line = `${field}: ${value}`;
  const fenceMatch = /\n```[\t ]*$/u.exec(text);
  if (!fenceMatch) return `${text.trimEnd()}\n${line}`;
  return `${text.slice(0, fenceMatch.index)}\n${line}${text.slice(fenceMatch.index)}`;
}

function withLegacySourceProofSlots(slotData, profile, generationMode) {
  if (generationMode === 'source_plan_strict') return slotData ?? {};
  const normalized = { ...(slotData ?? {}) };
  if ((profile.requiredSlots ?? []).includes('sourceCoverageMatrix') && !slotText(normalized.sourceCoverageMatrix, 'sourceCoverageMatrix').trim()) {
    normalized.sourceCoverageMatrix = [
      '| Source ID | Source Kind | Source Ref | Goal Tasks | Acceptance | Commands | Evidence |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| SRC001 | legacy_slot_projection | model_packet.json | G00 | AC-01 | legacy required commands | audit receipt |',
    ].join('\n');
  }

  if ((profile.requiredSlots ?? []).includes('frontMatter')) {
    let frontMatter = slotText(normalized.frontMatter, 'frontMatter');
    frontMatter = appendFrontMatterField(frontMatter, 'sourceBytes', '0');
    frontMatter = appendFrontMatterField(frontMatter, 'sourceLines', '0');
    frontMatter = appendFrontMatterField(frontMatter, 'coverageReceiptPath', 'legacy_slot_projection');
    frontMatter = appendFrontMatterField(frontMatter, 'generationReceiptPath', 'legacy_slot_projection');
    frontMatter = appendFrontMatterField(frontMatter, 'unmappedSourceObligations', '0');
    normalized.frontMatter = frontMatter;
  }
  return normalized;
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
  const projectionDimensions = profile.projectionDimensions ?? [];
  const renderedProjectionIds = projectionDimensions
    .filter((projection) => renderedSections.includes(projection.sectionTitle))
    .map((projection) => projection.id);
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
    projectionSectionCount: renderedProjectionIds.length,
    projectionIds: renderedProjectionIds,
    runtimeEvidenceAuthority: false,
    contentHash: sha256(document),
  };
}

function validateCoverage({ document, coverageReceipt, generationMode }) {
  if (generationMode !== 'source_plan_strict') return null;
  if (!coverageReceipt) {
    throw block('GOAL_CONTRACT_COVERAGE_RECEIPT_MISSING', 'coverageReceipt is required in source_plan_strict mode');
  }
  if (!Array.isArray(coverageReceipt.sourceObligations) || coverageReceipt.sourceObligations.length === 0) {
    throw block('GOAL_CONTRACT_COVERAGE_RECEIPT_EMPTY', 'coverageReceipt.sourceObligations must be non-empty');
  }
  const renderedSourceHash = /^sourcePlanHash:\s*(\S+)/mu.exec(document)?.[1] ?? null;
  if (coverageReceipt.sourcePlanHash && renderedSourceHash && coverageReceipt.sourcePlanHash !== renderedSourceHash) {
    throw block('GOAL_CONTRACT_SOURCE_HASH_MISMATCH', `${coverageReceipt.sourcePlanHash} !== ${renderedSourceHash}`);
  }
  if (!document.includes('## Source Coverage Matrix')) {
    throw block('GOAL_CONTRACT_COVERAGE_MATRIX_MISSING', 'Source Coverage Matrix section is required');
  }
  if (!/\|\s*SRC\d{3}\s*\|/u.test(document)) {
    throw block('GOAL_CONTRACT_COVERAGE_MATRIX_MISSING', 'Source Coverage Matrix rows are required');
  }
  const unmapped = coverageReceipt.unmappedSourceObligations ?? [];
  if (unmapped.length > 0) {
    throw block('GOAL_CONTRACT_SOURCE_OBLIGATION_UNMAPPED', unmapped.join(', '));
  }
  for (const obligation of coverageReceipt.sourceObligations ?? []) {
    if (!document.includes(obligation.id)) {
      throw block('GOAL_CONTRACT_COVERAGE_REF_INVALID', `${obligation.id} missing from rendered document`);
    }
    for (const ref of [
      ...(obligation.goalTaskRefs ?? []),
      ...(obligation.acceptanceRefs ?? []),
      ...(obligation.commandRefs ?? []),
      ...(obligation.evidenceRefs ?? []),
    ]) {
      if (!document.includes(ref)) {
        throw block('GOAL_CONTRACT_COVERAGE_REF_INVALID', `${obligation.id}:${ref}`);
      }
    }
  }
  return {
    coverageDecision: 'pass',
    sourceObligationCount: (coverageReceipt.sourceObligations ?? []).length,
    unmappedSourceObligations: [],
  };
}

function renderGoalContract({
  templateText,
  profile,
  slotData,
  validateHashes = true,
  coverageReceipt = null,
  generationMode = 'legacy_slot_projection',
}) {
  if (!profile) throw block('GOAL_CONTRACT_PROFILE_MISSING', 'profile is required');
  assertSupportedProfile(profile);
  if (validateHashes) validateProfileHashes(templateText, profile);
  const normalizedSlotData = withLegacySourceProofSlots(slotData, profile, generationMode);
  const { document, slotInfo } = replaceSlots(templateText, profile, normalizedSlotData);
  const audit = auditRenderedDocument(document, profile, slotInfo, templateText);
  const coverageAudit = validateCoverage({ document, coverageReceipt, generationMode });
  if (coverageAudit) Object.assign(audit, coverageAudit);
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
  const writeReceipt = outPath ? safeWriteText(outPath, result.document, { mode: 'upsert' }) : null;
  process.stdout.write(
    `${JSON.stringify({ documentPath: outPath ? normalizeRepoPath(outPath) : null, audit: result.audit, writeReceipt }, null, 2)}\n`
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
