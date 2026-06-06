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
const MANIFEST_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/candidate-manifest.json';
const EVIDENCE_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/evidence.json';
const SUMMARY_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.7/summary.md';
const PACKAGE_TEST_PATH = 'packages/bmad-speckit/tests/main-agent-wave-3-7-runtime-actions.test.js';
const ACCEPTANCE_TEST_PATH = 'tests/acceptance/main-agent-runtime-migration-wave-3-7-contract.test.ts';
const WAVE_ID = 'main-agent-runtime-migration-wave-3.7';
const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.6';
const ENTRY_REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.2';
const CONTRACT_PATH = 'docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md';

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

function slugFromScript(scriptPath) {
  return path.basename(scriptPath).replace(/\.(?:ts|js|cjs)$/u, '');
}

function entryIdFor(scriptPath) {
  return slugFromScript(scriptPath).replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '');
}

function actionSlugFor(scriptPath) {
  const slug = slugFromScript(scriptPath);
  return slug.startsWith('main-agent-') ? slug.slice('main-agent-'.length) : slug;
}

function camelActionFor(actionSlug) {
  return `${actionSlug.replace(/-([a-z])/gu, (_, char) => char.toUpperCase())}Action`;
}

function targetPathsFor(scriptPath) {
  const actionSlug = actionSlugFor(scriptPath);
  return {
    action: actionSlug,
    source: `packages/bmad-speckit/src/main-agent/actions/${actionSlug}.js`,
    dist: `packages/bmad-speckit/dist/main-agent/actions/${actionSlug}.js`,
    all: [
      `packages/bmad-speckit/src/main-agent/actions/${actionSlug}.js`,
      `packages/bmad-speckit/dist/main-agent/actions/${actionSlug}.js`,
      'packages/bmad-speckit/src/main-agent/runtime.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
      'packages/bmad-speckit/bin/bmad-speckit.js',
    ],
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function registryValidatedScripts(registryText, ignoredWaveId) {
  const validated = new Set();
  const ignoredWavePattern = ignoredWaveId
    ? new RegExp(`waveId:\\s*${escapeRegExp(ignoredWaveId)}\\b`, 'u')
    : null;
  for (const waveBlock of registryText.split(/\n(?=  - waveId: )/u)) {
    if (ignoredWavePattern?.test(waveBlock)) continue;
    for (const block of waveBlock.split(/\n(?=\s+- entryId: )/u)) {
      const match = block.match(/originalPath:\s*'?([^'\r\n]+)'?/u);
      if (!match) continue;
      const originalPath = match[1].trim();
      if (originalPath.startsWith('scripts/') && /validationStatus:\s*passed/u.test(block)) {
        validated.add(originalPath);
      }
    }
  }
  return validated;
}

function parsePriorityMatrix(matrixText) {
  const rows = { P2: [] };
  let current = null;
  for (const line of matrixText.split(/\r?\n/u)) {
    const heading = line.match(/^## (P[0-9])$/u);
    if (heading) {
      current = heading[1];
      continue;
    }
    if (current !== 'P2') continue;
    const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
    if (cells.length !== 5) continue;
    const script = cells[0].replace(/`/gu, '');
    if (!script.startsWith('scripts/')) continue;
    rows.P2.push({
      script,
      classification: cells[1].replace(/`/gu, ''),
      strategy: cells[2].replace(/`/gu, ''),
      score: Number(cells[3]),
      targetWave: cells[4].replace(/`/gu, ''),
    });
  }
  return rows.P2;
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
  const registryText = readText(REGISTRY_PATH, errors);
  const manifest = readJson(MANIFEST_PATH, errors);
  if (!matrixText || !registryText || !manifest) return { manifest, expected: [] };

  const p2Rows = parsePriorityMatrix(matrixText);
  const validated = registryValidatedScripts(registryText, WAVE_ID);
  const expected = p2Rows.filter((row) => !validated.has(row.script));
  const validatedP2 = p2Rows.filter((row) => validated.has(row.script));
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];

  expectEqual(errors, 'manifest.waveId', manifest.waveId, WAVE_ID);
  expectEqual(errors, 'manifest.contractPath', manifest.contractPath, CONTRACT_PATH);
  expectEqual(errors, 'manifest.refinesWaveId', manifest.refinesWaveId, REFINES_WAVE_ID);
  expectEqual(errors, 'manifest.selection.priority', manifest.selection?.priority, 'P2');
  expectEqual(errors, 'manifest.selection.matrixTotal', manifest.selection?.matrixTotal, 8);
  expectEqual(errors, 'manifest.selection.alreadyValidated', manifest.selection?.alreadyValidated, 0);
  expectEqual(errors, 'manifest.selection.remaining', manifest.selection?.remaining, 8);
  expectEqual(errors, 'manifest.deletionAllowed', manifest.deletionAllowed, false);
  expectEqual(errors, 'manifest.deletionApprovalRef', manifest.deletionApprovalRef, null);
  expectEqual(errors, 'P2 matrix total', p2Rows.length, 8);
  expectEqual(errors, 'P2 validated count', validatedP2.length, 0);
  expectEqual(errors, 'P2 remaining count', expected.length, 8);
  expectEqual(errors, 'manifest.entries length', entries.length, expected.length);

  const expectedPaths = expected.map((row) => row.script);
  const actualPaths = entries.map((entry) => entry.originalPath);
  for (const pathName of expectedPaths) {
    if (!actualPaths.includes(pathName)) errors.push(`manifest missing P2 remaining script ${pathName}`);
  }
  for (const pathName of actualPaths) {
    if (!expectedPaths.includes(pathName)) errors.push(`manifest includes unexpected script ${pathName}`);
    if (validated.has(pathName)) errors.push(`manifest includes already validated script ${pathName}`);
  }

  for (const row of expected) {
    const entry = entries.find((candidate) => candidate.originalPath === row.script);
    if (!entry) continue;
    const targetPaths = targetPathsFor(row.script);
    expectEqual(errors, `${row.script} entryId`, entry.entryId, entryIdFor(row.script));
    expectEqual(errors, `${row.script} priority`, entry.priority, 'P2');
    expectEqual(errors, `${row.script} originalPathStatus`, entry.originalPathStatus, 'retained');
    expectEqual(errors, `${row.script} migrationStrategy`, entry.migrationStrategy, 'package_runtime_module');
    expectEqual(errors, `${row.script} migrationStatus`, entry.migrationStatus, 'planned');
    expectEqual(errors, `${row.script} actionSlug`, entry.actionSlug, actionSlugFor(row.script));
    expectEqual(errors, `${row.script} callerSwitchRequired`, entry.callerSwitchRequired, true);
    expectEqual(errors, `${row.script} callerSwitchStatus`, entry.callerSwitchStatus, 'pending');
    expectEqual(errors, `${row.script} validationStatus`, entry.validationStatus, 'pending');
    expectEqual(errors, `${row.script} oldPathDisposition`, entry.oldPathDisposition, 'retained_pending_migration');
    expectEqual(errors, `${row.script} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `${row.script} deletionApprovalRef`, entry.deletionApprovalRef, null);
    expectArrayIncludes(errors, `${row.script} targetSourcePaths`, entry.targetSourcePaths, targetPaths.source);
    expectArrayIncludes(errors, `${row.script} targetDistPaths`, entry.targetDistPaths, targetPaths.dist);
    for (const targetPath of targetPaths.all) {
      expectArrayIncludes(errors, `${row.script} targetPaths`, entry.targetPaths, targetPath);
    }
    expectArrayIncludes(errors, `${row.script} evidenceRefs`, entry.evidenceRefs, EVIDENCE_PATH);
    if (!fs.existsSync(repoPath(row.script))) errors.push(`original root script missing: ${row.script}`);
  }

  return { manifest, expected };
}

function validateActionFiles(entries, errors) {
  const forbidden = [
    /scripts[\\/].*\.ts/u,
    /runRepoScript\(/u,
    /\btsx\b/u,
    /\bts-node\b/u,
    /compiled[\\/]main-agent-orchestration\.cjs/u,
  ];
  const helperPaths = [
    'packages/bmad-speckit/src/main-agent/actions/package-runtime-report.js',
    'packages/bmad-speckit/dist/main-agent/actions/package-runtime-report.js',
  ];
  for (const target of helperPaths) {
    if (!fs.existsSync(repoPath(target))) errors.push(`missing helper target: ${target}`);
  }

  for (const entry of entries) {
    for (const target of [entry.targetSourcePaths?.[0], entry.targetDistPaths?.[0]].filter(Boolean)) {
      const full = repoPath(target);
      if (!fs.existsSync(full)) {
        errors.push(`missing target: ${target}`);
        continue;
      }
      const text = fs.readFileSync(full, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) errors.push(`${target} contains forbidden pattern ${pattern}`);
      }
      if (!text.includes('createPackageRuntimeReportAction')) {
        errors.push(`${target} must use package runtime report helper`);
      }
      if (!text.includes(camelActionFor(entry.actionSlug))) {
        errors.push(`${target} missing export ${camelActionFor(entry.actionSlug)}`);
      }
    }
  }
}

function validateRuntimeRegistration(entries, errors) {
  for (const runtimePath of [
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/dist/main-agent/runtime.js',
  ]) {
    if (!fs.existsSync(repoPath(runtimePath))) {
      errors.push(`missing runtime file: ${runtimePath}`);
      continue;
    }
    const text = fs.readFileSync(repoPath(runtimePath), 'utf8');
    for (const entry of entries) {
      if (!text.includes(`'${entry.actionSlug}'`)) errors.push(`${runtimePath} missing action ${entry.actionSlug}`);
      if (!text.includes(camelActionFor(entry.actionSlug))) {
        errors.push(`${runtimePath} missing action handler for ${entry.actionSlug}`);
      }
    }
  }
}

function validateBuildScript(entries, errors) {
  const buildPath = 'packages/bmad-speckit/scripts/build-main-agent-dist.cjs';
  const text = readText(buildPath, errors);
  if (!text) return;
  if (!text.includes('actions/package-runtime-report.js')) {
    errors.push(`${buildPath} missing package runtime report helper`);
  }
  for (const entry of entries) {
    const target = `actions/${entry.actionSlug}.js`;
    if (!text.includes(target)) errors.push(`${buildPath} missing ${target}`);
  }
}

function runCliAction(action, cwd) {
  const result = spawnSync(
    process.execPath,
    ['packages/bmad-speckit/bin/bmad-speckit.js', 'main-agent', action, '--cwd', cwd, '--json'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      maxBuffer: 20 * 1024 * 1024,
    }
  );
  return result;
}

function validatePackageCliDispatch(entries, errors) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-7-cli-'));
  try {
    for (const entry of entries) {
      const result = runCliAction(entry.actionSlug, tempRoot);
      if (result.status !== 0) {
        errors.push(`CLI dispatch failed for ${entry.actionSlug}: ${result.stderr || result.stdout}`);
        continue;
      }
      let body;
      try {
        body = JSON.parse(result.stdout);
      } catch (error) {
        errors.push(`CLI dispatch JSON parse failed for ${entry.actionSlug}: ${error.message}`);
        continue;
      }
      expectEqual(errors, `${entry.actionSlug} schemaVersion`, body.schemaVersion, 'main-agent-package-runtime/v1');
      expectEqual(errors, `${entry.actionSlug} action`, body.action, entry.actionSlug);
      expectEqual(errors, `${entry.actionSlug} status`, body.status, 'package_runtime_ready');
      expectEqual(errors, `${entry.actionSlug} exitCode`, body.exitCode, 0);
      expectEqual(errors, `${entry.actionSlug} usedRootScript`, body.data?.report?.consumerRuntimeProof?.usedRootScript, false);
      expectEqual(
        errors,
        `${entry.actionSlug} usedCompiledFallback`,
        body.data?.report?.consumerRuntimeProof?.usedCompiledFallback,
        false
      );
      expectEqual(
        errors,
        `${entry.actionSlug} usedTypeScriptRunner`,
        body.data?.report?.consumerRuntimeProof?.usedTypeScriptRunner,
        false
      );
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function validateRegistryWave(entries, errors) {
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
  if (!wave.startedAt) errors.push('registry wave startedAt must be set');
  if (!wave.completedAt) errors.push('registry wave completedAt must be set');
  if (!Array.isArray(wave.entries) || wave.entries.length !== entries.length) {
    errors.push(`registry wave must contain exactly ${entries.length} entries`);
    return;
  }
  for (const expected of entries) {
    const entry = wave.entries.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`registry missing entry ${expected.entryId}`);
      continue;
    }
    expectEqual(errors, `${expected.entryId} refinesWaveId`, entry.refinesWaveId, ENTRY_REFINES_WAVE_ID);
    expectEqual(errors, `${expected.entryId} originalPath`, entry.originalPath, expected.originalPath);
    expectEqual(errors, `${expected.entryId} originalPathStatus`, entry.originalPathStatus, 'retained');
    expectEqual(
      errors,
      `${expected.entryId} originalClassBeforeMigration`,
      entry.originalClassBeforeMigration,
      expected.originalClassBeforeMigration
    );
    expectEqual(errors, `${expected.entryId} migrationStrategy`, entry.migrationStrategy, 'package_runtime_module');
    expectEqual(errors, `${expected.entryId} migrationStatus`, entry.migrationStatus, 'validated');
    expectEqual(errors, `${expected.entryId} callerSwitchStatus`, entry.callerSwitchStatus, 'switched');
    expectEqual(errors, `${expected.entryId} validationStatus`, entry.validationStatus, 'passed');
    expectEqual(errors, `${expected.entryId} oldPathDisposition`, entry.oldPathDisposition, 'retained_source_dev_only');
    expectEqual(errors, `${expected.entryId} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `${expected.entryId} deletionApprovalRef`, entry.deletionApprovalRef, null);
    expectArrayIncludes(errors, `${expected.entryId} evidenceRefs`, entry.evidenceRefs, EVIDENCE_PATH);
    for (const targetPath of expected.targetPaths || []) {
      expectArrayIncludes(errors, `${expected.entryId} targetPaths`, entry.targetPaths, targetPath);
    }
    for (const command of entry.publicCommandsAfterMigration || []) {
      if (/scripts[\\/].*\.ts|\btsx\b|\bts-node\b/u.test(command)) {
        errors.push(`${expected.entryId} publicCommandsAfterMigration is not package runtime safe: ${command}`);
      }
    }
  }
}

function validateEvidence(entries, errors) {
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
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== entries.length) {
    errors.push(`evidence must contain exactly ${entries.length} entries`);
    return;
  }
  for (const expected of entries) {
    const entry = evidence.entries.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`evidence missing ${expected.entryId}`);
      continue;
    }
    expectEqual(errors, `evidence ${expected.entryId} originalPath`, entry.originalPath, expected.originalPath);
    expectEqual(errors, `evidence ${expected.entryId} actionSlug`, entry.actionSlug, expected.actionSlug);
    expectEqual(errors, `evidence ${expected.entryId} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `evidence ${expected.entryId} result`, entry.result, 'passed');
    for (const targetPath of expected.targetPaths || []) {
      expectArrayIncludes(errors, `evidence ${expected.entryId} targetPaths`, entry.targetPaths, targetPath);
    }
    if (!Array.isArray(entry.commands) || entry.commands.length === 0) {
      errors.push(`evidence ${expected.entryId} commands must be non-empty`);
    } else {
      for (const command of entry.commands) validateCommandHash(command, errors);
    }
    if (!Array.isArray(entry.installMatrixEvidence)) {
      errors.push(`evidence ${expected.entryId} installMatrixEvidence must be an array`);
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
    'Deletion is not approved',
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
  const badLines = result.stdout
    .split(/\r?\n/u)
    .filter((line) => /^( D|D |R )\s+scripts[\\/]/u.test(line));
  if (badLines.length > 0) errors.push(`root script deletion or rename detected: ${badLines.join('; ')}`);
}

function validateFullMode(manifest, errors) {
  if (!manifest || !Array.isArray(manifest.entries)) return;
  for (const relativePath of [PACKAGE_TEST_PATH, ACCEPTANCE_TEST_PATH]) {
    if (!fs.existsSync(repoPath(relativePath))) errors.push(`missing post-migration artifact: ${relativePath}`);
  }
  validateActionFiles(manifest.entries, errors);
  validateRuntimeRegistration(manifest.entries, errors);
  validateBuildScript(manifest.entries, errors);
  validatePackageCliDispatch(manifest.entries, errors);
  validateRegistryWave(manifest.entries, errors);
  validateEvidence(manifest.entries, errors);
  validateSummary(errors);
  validateNoRootScriptDeletion(errors);
}

function main() {
  const manifestOnly = process.argv.includes('--manifest-only');
  const errors = [];
  const { manifest, expected } = validateManifest(errors);
  if (!manifestOnly) validateFullMode(manifest, errors);
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    mode: manifestOnly ? 'manifest-only' : 'full',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    expectedRemainingCount: expected.length,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
