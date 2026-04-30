#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const MAPPING_RELATIVE_PATH = '_bmad-output/runtime/governance/user_story_mapping.json';
const MAPPING_PATH = path.join(ROOT, ...MAPPING_RELATIVE_PATH.split('/'));
const FIXTURE_TIMESTAMP = '2026-04-30T00:00:00.000Z';

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function isUsableMapping(value) {
  return (
    value &&
    typeof value === 'object' &&
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

function readExistingMapping() {
  if (!fs.existsSync(MAPPING_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function buildFixture() {
  return {
    version: 1,
    updatedAt: FIXTURE_TIMESTAMP,
    source: MAPPING_RELATIVE_PATH,
    items: [
      {
        requirementId: 'REQ-CI-GOVERNANCE-MAPPING-FIXTURE',
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

const force = process.argv.includes('--force') || process.env.CI === 'true';
const existing = readExistingMapping();

if (!force && isUsableMapping(existing)) {
  console.log(`[governance-fixture] existing mapping is usable: ${MAPPING_RELATIVE_PATH}`);
  process.exit(0);
}

writeJson(MAPPING_PATH, buildFixture());
console.log(`[governance-fixture] wrote ${MAPPING_RELATIVE_PATH}`);
