#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MAPPING_RELATIVE_PATH = '_bmad-output/runtime/requirement-records/index.json';
const MAPPING_PATH = path.join(ROOT, ...MAPPING_RELATIVE_PATH.split('/'));
const REQUIREMENT_ID = 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE';
const RECORD_RELATIVE_PATH = `_bmad-output/runtime/requirement-records/${REQUIREMENT_ID}/requirement-record.json`;
const RECORD_PATH = path.join(ROOT, ...RECORD_RELATIVE_PATH.split('/'));
const FIXTURE_TIMESTAMP = '2026-04-30T00:00:00.000Z';

function fixturePaths(root = ROOT) {
  return {
    mappingPath: path.join(root, ...MAPPING_RELATIVE_PATH.split('/')),
    recordPath: path.join(root, ...RECORD_RELATIVE_PATH.split('/')),
  };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function isUsableMapping(value, recordPath = RECORD_PATH) {
  return (
    value &&
    typeof value === 'object' &&
    fs.existsSync(recordPath) &&
    value.active &&
    typeof value.active === 'object' &&
    typeof value.active.recordPath === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.requirementId === 'string' &&
        Array.isArray(item.allowedWriteScope)
    )
  );
}

function readExistingMapping(mappingPath = MAPPING_PATH) {
  if (!fs.existsSync(mappingPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  } catch {
    return null;
  }
}

function buildFixture() {
  return {
    version: 1,
    updatedAt: FIXTURE_TIMESTAMP,
    source: MAPPING_RELATIVE_PATH,
    active: {
      requirementSetId: REQUIREMENT_ID,
      recordId: REQUIREMENT_ID,
      recordPath: RECORD_RELATIVE_PATH,
    },
    records: [
      {
        requirementSetId: REQUIREMENT_ID,
        recordId: REQUIREMENT_ID,
        recordPath: RECORD_RELATIVE_PATH,
      },
    ],
    items: [
      {
        requirementId: REQUIREMENT_ID,
        sourceType: 'ci_fixture',
        epicId: 'E-CI',
        storyId: 'S-CI',
        flow: 'story',
        sprintId: 'SPRINT-CI',
        allowedWriteScope: ['scripts/**', 'tests/acceptance/**', '_bmad/_config/**'],
        status: 'planned',
        acceptanceRefs: ['AC-CI-GOVERNANCE-MAPPING-FIXTURE'],
        lastPacketId: null,
        updatedAt: FIXTURE_TIMESTAMP,
      },
    ],
  };
}

function buildRequirementRecord() {
  return {
    schemaVersion: 1,
    recordId: REQUIREMENT_ID,
    requirementSetId: REQUIREMENT_ID,
    status: 'user_confirmed',
    sourceDocumentHash:
      'sha256:1111111111111111111111111111111111111111111111111111111111111111',
    implementationConfirmationHash:
      'sha256:2222222222222222222222222222222222222222222222222222222222222222',
    architectureConfirmationHash:
      'sha256:3333333333333333333333333333333333333333333333333333333333333333',
    confirmationHistory: [
      {
        eventType: 'confirmation_recorded',
        confirmedAt: FIXTURE_TIMESTAMP,
        confirmedBy: 'ci-fixture',
        sourceDocumentHash:
          'sha256:1111111111111111111111111111111111111111111111111111111111111111',
        implementationConfirmationHash:
          'sha256:2222222222222222222222222222222222222222222222222222222222222222',
        confirmationPageHash:
          'sha256:4444444444444444444444444444444444444444444444444444444444444444',
      },
    ],
    traceRows: ['TRACE-CI-GOVERNANCE-MAPPING-FIXTURE'],
    executionIterations: [],
    requirementClosures: [],
    gateChecks: [],
    contractChecks: [],
    deliveryEvidence: {
      requiredCommands: [],
    },
    artifactIndex: [],
    updatedAt: FIXTURE_TIMESTAMP,
  };
}

function writeGovernanceUserStoryMappingFixture(root = ROOT) {
  const { mappingPath, recordPath } = fixturePaths(root);
  writeJson(mappingPath, buildFixture());
  writeJson(recordPath, buildRequirementRecord());
  return { mappingPath, recordPath };
}

function ensureGovernanceUserStoryMappingFixture(options = {}) {
  const root = options.root || ROOT;
  const force = options.force ?? process.env.CI === 'true';
  const log = options.log === undefined ? console.log : options.log;
  const { mappingPath, recordPath } = fixturePaths(root);
  const existing = readExistingMapping(mappingPath);

  if (!force && isUsableMapping(existing, recordPath)) {
    if (log) log(`[governance-fixture] existing mapping is usable: ${MAPPING_RELATIVE_PATH}`);
    return { written: false, mappingPath, recordPath };
  }

  writeGovernanceUserStoryMappingFixture(root);
  if (log) log(`[governance-fixture] wrote ${MAPPING_RELATIVE_PATH}`);
  return { written: true, mappingPath, recordPath };
}

if (require.main === module) {
  ensureGovernanceUserStoryMappingFixture({ force: process.argv.includes('--force') || process.env.CI === 'true' });
}

module.exports = {
  MAPPING_RELATIVE_PATH,
  RECORD_RELATIVE_PATH,
  REQUIREMENT_ID,
  buildFixture,
  buildRequirementRecord,
  ensureGovernanceUserStoryMappingFixture,
  fixturePaths,
  isUsableMapping,
  readExistingMapping,
  writeGovernanceUserStoryMappingFixture,
};
