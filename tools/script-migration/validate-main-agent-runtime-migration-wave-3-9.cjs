#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const MATRIX_PATH = 'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md';
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const MANIFEST_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/candidate-manifest.json';
const EVIDENCE_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/evidence.json';
const SUMMARY_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.9/summary.md';
const PACKAGE_TEST_PATH = 'packages/bmad-speckit/tests/main-agent-wave-3-9-durable-helpers.test.js';
const ACCEPTANCE_TEST_PATH = 'tests/acceptance/main-agent-runtime-migration-wave-3-9-contract.test.ts';
const BUILD_SCRIPT_PATH = 'packages/bmad-speckit/scripts/build-main-agent-dist.cjs';
const WAVE_ID = 'main-agent-runtime-migration-wave-3.9';
const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.8';
const ENTRY_REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.2';
const CONTRACT_PATH = 'docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md';
const EXPECTED_P4_TOTAL = 14;
const HELPER_ROUTE = 'durable_helper_copy';
const DESCRIPTOR_HELPER = 'durable-helper-report';

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function readText(relativePath, errors) {
  const filePath = repoPath(relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(filePath, 'utf8');
}

function readJson(relativePath, errors) {
  const text = readText(relativePath, errors);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`invalid JSON: ${relativePath}: ${error.message}`);
    return null;
  }
}

function readYaml(relativePath, errors) {
  const text = readText(relativePath, errors);
  if (!text) return null;
  try {
    return yaml.load(text);
  } catch (error) {
    errors.push(`invalid YAML: ${relativePath}: ${error.message}`);
    return null;
  }
}

function helperSlugFor(scriptPath) {
  return path.basename(scriptPath).replace(/\.(?:ts|js|cjs)$/u, '');
}

function entryIdFor(scriptPath) {
  return helperSlugFor(scriptPath).replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function exportNameFor(helperId) {
  const [first = '', ...rest] = helperId.split('-').filter(Boolean);
  return `${[
    first,
    ...rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`),
  ].join('')}Helper`;
}

function targetPathsFor(scriptPath) {
  const helperId = entryIdFor(scriptPath);
  return {
    helperId,
    exportName: exportNameFor(helperId),
    source: `packages/bmad-speckit/src/main-agent/helpers/${helperId}.js`,
    dist: `packages/bmad-speckit/dist/main-agent/helpers/${helperId}.js`,
    all: [
      `packages/bmad-speckit/src/main-agent/helpers/${helperId}.js`,
      `packages/bmad-speckit/dist/main-agent/helpers/${helperId}.js`,
    ],
  };
}

function parsePriorityMatrix(matrixText) {
  const rows = [];
  let current = null;
  for (const line of matrixText.split(/\r?\n/u)) {
    const heading = line.match(/^## (P[0-9])$/u);
    if (heading) {
      current = heading[1];
      continue;
    }
    if (current !== 'P4') continue;
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length !== 5) continue;
    const script = cells[0].replace(/`/gu, '');
    if (!script.startsWith('scripts/')) continue;
    rows.push({
      script,
      classification: cells[1].replace(/`/gu, ''),
      strategy: cells[2].replace(/`/gu, ''),
      score: Number(cells[3]),
      targetWave: cells[4].replace(/`/gu, ''),
    });
  }
  return rows;
}

function expectEqual(errors, label, actual, expected) {
  if (actual !== expected) errors.push(`${label} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
}

function expectArrayIncludes(errors, label, actual, expected) {
  if (!Array.isArray(actual) || !actual.includes(expected)) {
    errors.push(`${label} missing ${expected}`);
  }
}

function validateManifest(errors) {
  const matrixText = readText(MATRIX_PATH, errors);
  const manifest = readJson(MANIFEST_PATH, errors);
  if (!matrixText || !manifest) return { manifest, p4Rows: [] };
  const p4Rows = parsePriorityMatrix(matrixText);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  expectEqual(errors, 'manifest.waveId', manifest.waveId, WAVE_ID);
  expectEqual(errors, 'manifest.contractPath', manifest.contractPath, CONTRACT_PATH);
  expectEqual(errors, 'manifest.refinesWaveId', manifest.refinesWaveId, REFINES_WAVE_ID);
  expectEqual(errors, 'manifest.selection.priority', manifest.selection?.priority, 'P4');
  expectEqual(errors, 'manifest.selection.matrixTotal', manifest.selection?.matrixTotal, EXPECTED_P4_TOTAL);
  expectEqual(errors, 'manifest.selection.alreadyValidated', manifest.selection?.alreadyValidated, 0);
  expectEqual(errors, 'manifest.selection.remaining', manifest.selection?.remaining, EXPECTED_P4_TOTAL);
  expectEqual(errors, 'manifest.deletionAllowed', manifest.deletionAllowed, false);
  expectEqual(errors, 'manifest.deletionApprovalRef', manifest.deletionApprovalRef, null);
  expectEqual(errors, 'P4 matrix total', p4Rows.length, EXPECTED_P4_TOTAL);
  expectEqual(errors, 'manifest.entries length', entries.length, EXPECTED_P4_TOTAL);

  const expectedPaths = p4Rows.map((row) => row.script);
  const actualPaths = entries.map((entry) => entry.originalPath);
  for (const expectedPath of expectedPaths) {
    if (!actualPaths.includes(expectedPath)) errors.push(`manifest missing P4 script ${expectedPath}`);
  }
  for (const actualPath of actualPaths) {
    if (!expectedPaths.includes(actualPath)) errors.push(`manifest includes unexpected P4 script ${actualPath}`);
  }

  for (const row of p4Rows) {
    const entry = entries.find((candidate) => candidate.originalPath === row.script);
    if (!entry) continue;
    const targetPaths = targetPathsFor(row.script);
    expectEqual(errors, `${row.script} entryId`, entry.entryId, entryIdFor(row.script));
    expectEqual(errors, `${row.script} priority`, entry.priority, 'P4');
    expectEqual(errors, `${row.script} originalPathStatus`, entry.originalPathStatus, 'retained');
    expectEqual(errors, `${row.script} originalClassBeforeMigration`, entry.originalClassBeforeMigration, row.classification);
    expectEqual(errors, `${row.script} migrationStrategy`, entry.migrationStrategy, HELPER_ROUTE);
    expectEqual(errors, `${row.script} helperId`, entry.helperId, targetPaths.helperId);
    expectEqual(errors, `${row.script} exportName`, entry.exportName, targetPaths.exportName);
    expectEqual(errors, `${row.script} publicCommandsAfterMigration length`, entry.publicCommandsAfterMigration?.length, 0);
    expectEqual(errors, `${row.script} callerSwitchStatus`, entry.callerSwitchStatus, 'not_applicable');
    expectEqual(errors, `${row.script} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `${row.script} deletionApprovalRef`, entry.deletionApprovalRef, null);
    expectArrayIncludes(errors, `${row.script} targetSourcePaths`, entry.targetSourcePaths, targetPaths.source);
    expectArrayIncludes(errors, `${row.script} targetDistPaths`, entry.targetDistPaths, targetPaths.dist);
    for (const targetPath of targetPaths.all) {
      expectArrayIncludes(errors, `${row.script} targetPaths`, entry.targetPaths, targetPath);
    }
    if (!fs.existsSync(repoPath(row.script))) errors.push(`original root script missing: ${row.script}`);
  }
  return { manifest, p4Rows };
}

function validateHelperFiles(entries, errors) {
  const forbidden = [
    /scripts[\\/].*\.(?:ts|js|cjs)/u,
    /runRepoScript\(/u,
    /\btsx\b/u,
    /\bts-node\b/u,
    /compiled[\\/]main-agent-orchestration\.cjs/u,
  ];
  for (const helperId of [DESCRIPTOR_HELPER]) {
    for (const target of [
      `packages/bmad-speckit/src/main-agent/helpers/${helperId}.js`,
      `packages/bmad-speckit/dist/main-agent/helpers/${helperId}.js`,
    ]) {
      if (!fs.existsSync(repoPath(target))) errors.push(`missing helper descriptor target: ${target}`);
    }
  }
  for (const entry of entries) {
    for (const target of [entry.targetSourcePaths?.[0], entry.targetDistPaths?.[0]].filter(Boolean)) {
      const full = repoPath(target);
      if (!fs.existsSync(full)) {
        errors.push(`missing helper target: ${target}`);
        continue;
      }
      const text = fs.readFileSync(full, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) errors.push(`${target} contains forbidden pattern ${pattern}`);
      }
      if (!text.includes('createDurableHelperDescriptor')) errors.push(`${target} must use durable helper descriptor`);
      if (!text.includes(entry.exportName)) errors.push(`${target} missing export ${entry.exportName}`);
      if (!text.includes(`helperId: '${entry.helperId}'`)) errors.push(`${target} missing helperId ${entry.helperId}`);
    }
  }
}

function validateHelperDescriptors(entries, errors) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-9-helper-'));
  try {
    for (const entry of entries) {
      const modulePath = repoPath(entry.targetSourcePaths?.[0] || '');
      if (!fs.existsSync(modulePath)) continue;
      const helperModule = require(modulePath);
      const helper = helperModule[entry.exportName];
      if (typeof helper !== 'function') {
        errors.push(`${entry.targetSourcePaths?.[0]} missing callable ${entry.exportName}`);
        continue;
      }
      const descriptor = helper({ cwd: tempRoot });
      expectEqual(errors, `${entry.helperId} schemaVersion`, descriptor.schemaVersion, 'main-agent-durable-helper/v1');
      expectEqual(errors, `${entry.helperId} helperId`, descriptor.helperId, entry.helperId);
      expectEqual(errors, `${entry.helperId} mode`, descriptor.mode, HELPER_ROUTE);
      expectEqual(errors, `${entry.helperId} targetSurface`, descriptor.targetSurface, 'package_main_agent_helper');
      expectEqual(errors, `${entry.helperId} publicCliAction`, descriptor.publicCliAction, false);
      expectEqual(errors, `${entry.helperId} supportedConsumerInvocation`, descriptor.supportedConsumerInvocation, null);
      expectEqual(errors, `${entry.helperId} usedRootScript`, descriptor.consumerRuntimeProof?.usedRootScript, false);
      expectEqual(errors, `${entry.helperId} usedCompiledFallback`, descriptor.consumerRuntimeProof?.usedCompiledFallback, false);
      expectEqual(errors, `${entry.helperId} usedTypeScriptRunner`, descriptor.consumerRuntimeProof?.usedTypeScriptRunner, false);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function validateBuildScript(entries, errors) {
  const text = readText(BUILD_SCRIPT_PATH, errors);
  if (!text) return;
  if (!text.includes(`helpers/${DESCRIPTOR_HELPER}.js`)) errors.push(`${BUILD_SCRIPT_PATH} missing descriptor helper`);
  for (const entry of entries) {
    const target = `helpers/${entry.helperId}.js`;
    if (!text.includes(target)) errors.push(`${BUILD_SCRIPT_PATH} missing ${target}`);
  }
}

function runCliAction(action, cwd) {
  return spawnSync(
    process.execPath,
    ['packages/bmad-speckit/bin/bmad-speckit.js', 'main-agent', action, '--cwd', cwd, '--json'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 20 * 1024 * 1024,
    }
  );
}

function validateNoPublicCliActions(entries, errors) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-9-cli-'));
  try {
    for (const entry of entries) {
      const result = runCliAction(entry.helperId, tempRoot);
      if (result.status !== 2) {
        errors.push(`P4 helper must not be public CLI action: ${entry.helperId}: ${result.stderr || result.stdout}`);
        continue;
      }
      let body;
      try {
        body = JSON.parse(result.stdout);
      } catch (error) {
        errors.push(`P4 helper unsupported response JSON parse failed for ${entry.helperId}: ${error.message}`);
        continue;
      }
      expectEqual(errors, `${entry.helperId} unsupported schemaVersion`, body.schemaVersion, 'main-agent-package-runtime/v1');
      expectEqual(errors, `${entry.helperId} unsupported action`, body.action, entry.helperId);
      expectEqual(errors, `${entry.helperId} unsupported status`, body.status, 'unsupported_main_agent_action');
      expectEqual(errors, `${entry.helperId} unsupported exitCode`, body.exitCode, 2);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function validateRegistryWave(manifestEntries, errors) {
  const registry = readYaml(REGISTRY_PATH, errors);
  if (!registry) return;
  const wave = registry.waves?.find((candidate) => candidate.waveId === WAVE_ID);
  if (!wave) {
    errors.push(`registry missing wave ${WAVE_ID}`);
    return;
  }
  expectEqual(errors, 'registry wave contractPath', wave.contractPath, CONTRACT_PATH);
  expectEqual(errors, 'registry wave refinesWaveId', wave.refinesWaveId, REFINES_WAVE_ID);
  expectEqual(errors, 'registry wave status', wave.status, 'validated');
  if (!Array.isArray(wave.entries) || wave.entries.length !== EXPECTED_P4_TOTAL) {
    errors.push(`registry wave must contain exactly ${EXPECTED_P4_TOTAL} entries`);
    return;
  }
  for (const expected of manifestEntries) {
    const entry = wave.entries.find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`registry missing entry for ${expected.originalPath}`);
      continue;
    }
    expectEqual(errors, `${expected.entryId} refinesWaveId`, entry.refinesWaveId, ENTRY_REFINES_WAVE_ID);
    expectEqual(errors, `${expected.entryId} migrationStrategy`, entry.migrationStrategy, HELPER_ROUTE);
    expectEqual(errors, `${expected.entryId} migrationStatus`, entry.migrationStatus, 'validated');
    expectEqual(errors, `${expected.entryId} callerSwitchStatus`, entry.callerSwitchStatus, 'not_applicable');
    expectEqual(errors, `${expected.entryId} publicCommandsAfterMigration length`, entry.publicCommandsAfterMigration?.length, 0);
    expectEqual(errors, `${expected.entryId} validationStatus`, entry.validationStatus, 'passed');
    expectEqual(errors, `${expected.entryId} oldPathDisposition`, entry.oldPathDisposition, 'retained_source_dev_only');
    expectEqual(errors, `${expected.entryId} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `${expected.entryId} deletionApprovalRef`, entry.deletionApprovalRef, null);
    expectArrayIncludes(errors, `${expected.entryId} evidenceRefs`, entry.evidenceRefs, EVIDENCE_PATH);
    for (const targetPath of expected.targetPaths || []) {
      expectArrayIncludes(errors, `${expected.entryId} targetPaths`, entry.targetPaths, targetPath);
    }
  }
}

function validateEvidence(manifestEntries, errors) {
  const evidence = readJson(EVIDENCE_PATH, errors);
  if (!evidence) return;
  expectEqual(errors, 'evidence.schemaVersion', evidence.schemaVersion, 'main-agent-runtime-migration-evidence/v1');
  expectEqual(errors, 'evidence.waveId', evidence.waveId, WAVE_ID);
  expectEqual(errors, 'evidence.contractPath', evidence.contractPath, CONTRACT_PATH);
  expectEqual(errors, 'evidence.result', evidence.result, 'passed');
  expectEqual(errors, 'evidence.noRootScriptDeletion', evidence.noRootScriptDeletion, true);
  expectEqual(errors, 'evidence.rootScriptDeletionApproved', evidence.rootScriptDeletionApproved, false);
  if (!Array.isArray(evidence.commandsRun) || evidence.commandsRun.length === 0) {
    errors.push('evidence.commandsRun must be non-empty');
  } else {
    for (const command of evidence.commandsRun) validateCommandHash(command, errors);
  }
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== manifestEntries.length) {
    errors.push(`evidence must contain exactly ${manifestEntries.length} entries`);
    return;
  }
  for (const expected of manifestEntries) {
    const entry = evidence.entries.find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`evidence missing ${expected.originalPath}`);
      continue;
    }
    expectEqual(errors, `evidence ${expected.entryId} helperId`, entry.helperId, expected.helperId);
    expectEqual(errors, `evidence ${expected.entryId} migrationStrategy`, entry.migrationStrategy, HELPER_ROUTE);
    expectEqual(errors, `evidence ${expected.entryId} publicCliAction`, entry.publicCliAction, false);
    expectEqual(errors, `evidence ${expected.entryId} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `evidence ${expected.entryId} result`, entry.result, 'passed');
    for (const targetPath of expected.targetPaths || []) {
      expectArrayIncludes(errors, `evidence ${expected.entryId} targetPaths`, entry.targetPaths, targetPath);
    }
  }
}

function validateCommandHash(command, errors) {
  if (!command.commandId) errors.push('evidence command missing commandId');
  if (!command.command) errors.push(`${command.commandId || '<unknown>'} command missing command`);
  expectEqual(errors, `${command.commandId || command.command} exitCode`, command.exitCode, 0);
  if (!String(command.stdoutHash || '').startsWith('sha256:')) {
    errors.push(`${command.commandId || command.command} stdoutHash missing sha256 prefix`);
  }
  if (!String(command.stderrHash || '').startsWith('sha256:')) {
    errors.push(`${command.commandId || command.command} stderrHash missing sha256 prefix`);
  }
}

function validateSummary(errors) {
  const text = readText(SUMMARY_PATH, errors);
  if (!text) return;
  for (const required of [
    'P4 durable helpers are copied as package-local helper surfaces.',
    'No P4 helper is exposed as a public main-agent CLI action.',
    'It does not assert that every source repository scripts/* consumer can run directly in consumer projects.',
    'usedRootScript: false',
    'usedTsx: false',
    'usedTsNode: false',
    'usedCompiledFallback: false',
    'rootScriptsDeleted: false',
    'rootScriptDeletionApproved: false',
  ]) {
    if (!text.includes(required)) errors.push(`summary missing ${required}`);
  }
}

function validateNoRootScriptDeletion(errors) {
  const result = spawnSync('git', ['status', '--short', '--', 'scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    errors.push(`git status scripts failed: ${result.stderr || result.stdout}`);
    return;
  }
  const badLines = result.stdout.split(/\r?\n/u).filter((line) => /^( D|D |R )\s+scripts[\\/]/u.test(line));
  if (badLines.length > 0) errors.push(`root script deletion or rename detected: ${badLines.join('; ')}`);
}

function validateFullMode(manifest, errors) {
  if (!manifest || !Array.isArray(manifest.entries)) return;
  for (const relativePath of [PACKAGE_TEST_PATH, ACCEPTANCE_TEST_PATH]) {
    if (!fs.existsSync(repoPath(relativePath))) errors.push(`missing post-migration artifact: ${relativePath}`);
  }
  validateHelperFiles(manifest.entries, errors);
  validateHelperDescriptors(manifest.entries, errors);
  validateBuildScript(manifest.entries, errors);
  validateNoPublicCliActions(manifest.entries, errors);
  validateRegistryWave(manifest.entries, errors);
  validateEvidence(manifest.entries, errors);
  validateSummary(errors);
  validateNoRootScriptDeletion(errors);
}

function main() {
  const manifestOnly = process.argv.includes('--manifest-only');
  const errors = [];
  const { manifest, p4Rows } = validateManifest(errors);
  if (!manifestOnly) validateFullMode(manifest, errors);
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    mode: manifestOnly ? 'manifest-only' : 'full',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    p4Total: p4Rows.length,
    durableHelperCount: Array.isArray(manifest?.entries) ? manifest.entries.length : 0,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
