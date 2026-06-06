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
const MANIFEST_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/candidate-manifest.json';
const CLASSIFICATION_PATH =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/classification-compression.json';
const EVIDENCE_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/evidence.json';
const SUMMARY_PATH = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.8/summary.md';
const PACKAGE_TEST_PATH = 'packages/bmad-speckit/tests/main-agent-wave-3-8-runtime-actions.test.js';
const ACCEPTANCE_TEST_PATH = 'tests/acceptance/main-agent-runtime-migration-wave-3-8-contract.test.ts';
const WAVE_ID = 'main-agent-runtime-migration-wave-3.8';
const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.7';
const CONTRACT_PATH = 'docs/plans/2026-06-05-main-agent-p1-p4-runtime-migration-goal-execution-plan.md';
const EXPECTED_P3_TOTAL = 38;
const EXPECTED_RUNTIME_COUNT = 21;
const EXPECTED_EXCLUSION_COUNT = 17;
const RUNTIME_ROUTE = 'package_runtime_module';
const EXCLUSION_ROUTES = new Set(['repo_internal_reclassify', 'deprecated_no_migration']);

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

function actionSlugFor(scriptPath) {
  const slug = slugFromScript(scriptPath);
  return slug.startsWith('main-agent-') ? slug.slice('main-agent-'.length) : slug;
}

function targetPathsFor(scriptPath, routeDecision = RUNTIME_ROUTE) {
  const actionSlug = actionSlugFor(scriptPath);
  if (routeDecision !== RUNTIME_ROUTE) return [scriptPath];
  return [
    `packages/bmad-speckit/src/main-agent/actions/${actionSlug}.js`,
    `packages/bmad-speckit/dist/main-agent/actions/${actionSlug}.js`,
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/dist/main-agent/runtime.js',
    'packages/bmad-speckit/bin/bmad-speckit.js',
  ];
}

function camelActionFor(actionSlug) {
  const [first = '', ...rest] = actionSlug.split('-').filter(Boolean);
  const identifier = [
    first,
    ...rest.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`),
  ].join('');
  return `${identifier}Action`;
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
    if (current !== 'P3') continue;
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
  if (!Array.isArray(actual) || !actual.includes(expected)) errors.push(`${label} missing ${expected}`);
}

function validateManifest(errors) {
  const matrixText = readText(MATRIX_PATH, errors);
  const manifest = readJson(MANIFEST_PATH, errors);
  if (!matrixText || !manifest) return { manifest, p3Rows: [] };
  const p3Rows = parsePriorityMatrix(matrixText);
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  expectEqual(errors, 'manifest.waveId', manifest.waveId, WAVE_ID);
  expectEqual(errors, 'manifest.contractPath', manifest.contractPath, CONTRACT_PATH);
  expectEqual(errors, 'manifest.refinesWaveId', manifest.refinesWaveId, REFINES_WAVE_ID);
  expectEqual(errors, 'manifest.selection.priority', manifest.selection?.priority, 'P3');
  expectEqual(errors, 'manifest.selection.matrixTotal', manifest.selection?.matrixTotal, EXPECTED_P3_TOTAL);
  expectEqual(errors, 'manifest.selection.remaining', manifest.selection?.remaining, EXPECTED_P3_TOTAL);
  expectEqual(errors, 'manifest.deletionAllowed', manifest.deletionAllowed, false);
  expectEqual(errors, 'manifest.entries length', entries.length, EXPECTED_P3_TOTAL);
  expectEqual(errors, 'P3 matrix total', p3Rows.length, EXPECTED_P3_TOTAL);
  const expectedPaths = p3Rows.map((row) => row.script);
  const actualPaths = entries.map((entry) => entry.originalPath);
  for (const expectedPath of expectedPaths) {
    if (!actualPaths.includes(expectedPath)) errors.push(`manifest missing P3 script ${expectedPath}`);
  }
  for (const entry of entries) {
    if (!expectedPaths.includes(entry.originalPath)) errors.push(`manifest includes unexpected P3 script ${entry.originalPath}`);
    expectEqual(errors, `${entry.originalPath} routeDecision`, entry.routeDecision, 'blocked_until_classification_compression');
    expectEqual(errors, `${entry.originalPath} deletionAllowed`, entry.deletionAllowed, false);
    if (!fs.existsSync(repoPath(entry.originalPath))) errors.push(`original root script missing: ${entry.originalPath}`);
  }
  return { manifest, p3Rows };
}

function validateClassification(manifest, p3Rows, errors) {
  const compression = readJson(CLASSIFICATION_PATH, errors);
  if (!compression) return { compression, runtimeEntries: [], excludedEntries: [] };
  const entries = Array.isArray(compression.entries) ? compression.entries : [];
  expectEqual(errors, 'classification.schemaVersion', compression.schemaVersion, 'main-agent-runtime-classification-compression/v1');
  expectEqual(errors, 'classification.waveId', compression.waveId, WAVE_ID);
  expectEqual(errors, 'classification.contractPath', compression.contractPath, CONTRACT_PATH);
  expectEqual(errors, 'classification.entries length', entries.length, EXPECTED_P3_TOTAL);
  const manifestPaths = new Set((manifest?.entries || []).map((entry) => entry.originalPath));
  const p3Paths = new Set(p3Rows.map((row) => row.script));
  const runtimeEntries = entries.filter((entry) => entry.routeDecision === RUNTIME_ROUTE);
  const excludedEntries = entries.filter((entry) => EXCLUSION_ROUTES.has(entry.routeDecision));
  expectEqual(errors, 'classification.selectedPackageRuntimeCount', compression.selectedPackageRuntimeCount, EXPECTED_RUNTIME_COUNT);
  expectEqual(errors, 'classification.deterministicExclusionCount', compression.deterministicExclusionCount, EXPECTED_EXCLUSION_COUNT);
  expectEqual(errors, 'runtime entry count', runtimeEntries.length, EXPECTED_RUNTIME_COUNT);
  expectEqual(errors, 'excluded entry count', excludedEntries.length, EXPECTED_EXCLUSION_COUNT);
  for (const entry of entries) {
    if (!manifestPaths.has(entry.originalPath)) errors.push(`classification missing manifest path ${entry.originalPath}`);
    if (!p3Paths.has(entry.originalPath)) errors.push(`classification contains non-P3 path ${entry.originalPath}`);
    if (!entry.directCallerEvidence || !entry.consumerReachability || !entry.reason) {
      errors.push(`classification entry lacks evidence fields: ${entry.originalPath}`);
    }
    expectEqual(errors, `${entry.originalPath} deletionAllowed`, entry.deletionAllowed, false);
    if (entry.routeDecision === RUNTIME_ROUTE) {
      expectEqual(errors, `${entry.originalPath} actionSlug`, entry.actionSlug, actionSlugFor(entry.originalPath));
      for (const targetPath of targetPathsFor(entry.originalPath, RUNTIME_ROUTE)) {
        expectArrayIncludes(errors, `${entry.originalPath} targetPaths`, entry.targetPaths, targetPath);
      }
    } else if (!EXCLUSION_ROUTES.has(entry.routeDecision)) {
      errors.push(`invalid routeDecision for ${entry.originalPath}: ${entry.routeDecision}`);
    } else {
      if (entry.publicCommandsAfterMigration?.length) {
        errors.push(`excluded entry must not declare public package command: ${entry.originalPath}`);
      }
    }
  }
  return { compression, runtimeEntries, excludedEntries };
}

function validateActionFiles(runtimeEntries, errors) {
  const forbidden = [
    /scripts[\\/].*\.ts/u,
    /runRepoScript\(/u,
    /\btsx\b/u,
    /(^|[^A-Za-z0-9_-])ts-node(?:\.cmd)?($|[^A-Za-z0-9_-])/iu,
    /compiled[\\/]main-agent-orchestration\.cjs/u,
  ];
  for (const entry of runtimeEntries) {
    const actionTargets = targetPathsFor(entry.originalPath, RUNTIME_ROUTE).filter(
      (item) => item.includes('/actions/') && item.endsWith('.js')
    );
    for (const target of actionTargets) {
      const full = repoPath(target);
      if (!fs.existsSync(full)) {
        errors.push(`missing runtime target: ${target}`);
        continue;
      }
      const text = fs.readFileSync(full, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) errors.push(`${target} contains forbidden pattern ${pattern}`);
      }
      if (!text.includes('createPackageRuntimeReportAction')) errors.push(`${target} must use package runtime report helper`);
      if (!text.includes(camelActionFor(entry.actionSlug))) errors.push(`${target} missing export ${camelActionFor(entry.actionSlug)}`);
    }
  }
}

function validateRuntimeRegistration(runtimeEntries, errors) {
  for (const runtimePath of [
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/dist/main-agent/runtime.js',
  ]) {
    if (!fs.existsSync(repoPath(runtimePath))) {
      errors.push(`missing runtime file: ${runtimePath}`);
      continue;
    }
    const text = fs.readFileSync(repoPath(runtimePath), 'utf8');
    for (const entry of runtimeEntries) {
      if (!text.includes(`'${entry.actionSlug}'`)) errors.push(`${runtimePath} missing action ${entry.actionSlug}`);
      if (!text.includes(camelActionFor(entry.actionSlug))) errors.push(`${runtimePath} missing handler ${camelActionFor(entry.actionSlug)}`);
    }
  }
}

function validateBuildScript(runtimeEntries, errors) {
  const text = readText('packages/bmad-speckit/scripts/build-main-agent-dist.cjs', errors);
  if (!text) return;
  for (const entry of runtimeEntries) {
    const target = `actions/${entry.actionSlug}.js`;
    if (!text.includes(target)) errors.push(`build script missing ${target}`);
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

function validatePackageCliDispatch(runtimeEntries, errors) {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'main-agent-wave-3-8-cli-'));
  try {
    for (const entry of runtimeEntries) {
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
      expectEqual(errors, `${entry.actionSlug} usedCompiledFallback`, body.data?.report?.consumerRuntimeProof?.usedCompiledFallback, false);
      expectEqual(errors, `${entry.actionSlug} usedTypeScriptRunner`, body.data?.report?.consumerRuntimeProof?.usedTypeScriptRunner, false);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function validateRegistryWave(classificationEntries, runtimeEntries, errors) {
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
  if (!Array.isArray(wave.entries) || wave.entries.length !== EXPECTED_P3_TOTAL) {
    errors.push(`registry wave must contain exactly ${EXPECTED_P3_TOTAL} entries`);
    return;
  }
  const runtimePaths = new Set(runtimeEntries.map((entry) => entry.originalPath));
  for (const expected of classificationEntries) {
    const entry = wave.entries.find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`registry missing entry for ${expected.originalPath}`);
      continue;
    }
    expectEqual(errors, `${expected.originalPath} migrationStrategy`, entry.migrationStrategy, expected.routeDecision);
    expectEqual(errors, `${expected.originalPath} migrationStatus`, entry.migrationStatus, 'validated');
    expectEqual(errors, `${expected.originalPath} validationStatus`, entry.validationStatus, 'passed');
    expectEqual(errors, `${expected.originalPath} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `${expected.originalPath} deletionApprovalRef`, entry.deletionApprovalRef, null);
    expectArrayIncludes(errors, `${expected.originalPath} evidenceRefs`, entry.evidenceRefs, EVIDENCE_PATH);
    if (runtimePaths.has(expected.originalPath)) {
      expectEqual(errors, `${expected.originalPath} callerSwitchStatus`, entry.callerSwitchStatus, 'switched');
      expectArrayIncludes(errors, `${expected.originalPath} publicCommandsAfterMigration`, entry.publicCommandsAfterMigration, `bmad-speckit main-agent ${expected.actionSlug}`);
    } else {
      expectEqual(errors, `${expected.originalPath} callerSwitchStatus`, entry.callerSwitchStatus, 'not_applicable');
      expectEqual(errors, `${expected.originalPath} publicCommandsAfterMigration length`, entry.publicCommandsAfterMigration?.length, 0);
    }
  }
}

function validateEvidence(classificationEntries, errors) {
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
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== EXPECTED_P3_TOTAL) {
    errors.push(`evidence must contain exactly ${EXPECTED_P3_TOTAL} entries`);
    return;
  }
  for (const expected of classificationEntries) {
    const entry = evidence.entries.find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`evidence missing ${expected.originalPath}`);
      continue;
    }
    expectEqual(errors, `evidence ${expected.originalPath} routeDecision`, entry.routeDecision, expected.routeDecision);
    expectEqual(errors, `evidence ${expected.originalPath} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `evidence ${expected.originalPath} result`, entry.result, 'passed');
  }
}

function validateCommandHash(command, errors) {
  if (!command.commandId) errors.push('evidence command missing commandId');
  if (!command.command) errors.push(`${command.commandId || '<unknown>'} command missing command`);
  expectEqual(errors, `${command.commandId || command.command} exitCode`, command.exitCode, 0);
  if (!String(command.stdoutHash || '').startsWith('sha256:')) errors.push(`${command.commandId || command.command} stdoutHash missing sha256 prefix`);
  if (!String(command.stderrHash || '').startsWith('sha256:')) errors.push(`${command.commandId || command.command} stderrHash missing sha256 prefix`);
}

function validateSummary(errors) {
  const text = readText(SUMMARY_PATH, errors);
  if (!text) return;
  for (const required of [
    'selectedPackageRuntimeCount: 21',
    'deterministicExclusionCount: 17',
    'usedRootScript: false',
    'usedTsx: false',
    'usedTsNode: false',
    'usedCompiledFallback: false',
    'rootScriptsDeleted: false',
    'rootScriptDeletionApproved: false',
    'It does not assert that every source repository scripts/* consumer can run directly in consumer projects.',
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

function validateFullMode(classificationEntries, runtimeEntries, errors) {
  for (const relativePath of [PACKAGE_TEST_PATH, ACCEPTANCE_TEST_PATH]) {
    if (!fs.existsSync(repoPath(relativePath))) errors.push(`missing post-migration artifact: ${relativePath}`);
  }
  validateActionFiles(runtimeEntries, errors);
  validateRuntimeRegistration(runtimeEntries, errors);
  validateBuildScript(runtimeEntries, errors);
  validatePackageCliDispatch(runtimeEntries, errors);
  validateRegistryWave(classificationEntries, runtimeEntries, errors);
  validateEvidence(classificationEntries, errors);
  validateSummary(errors);
  validateNoRootScriptDeletion(errors);
}

function main() {
  const classificationOnly = process.argv.includes('--classification-only');
  const errors = [];
  const { manifest, p3Rows } = validateManifest(errors);
  const { compression, runtimeEntries } = validateClassification(manifest, p3Rows, errors);
  const classificationEntries = Array.isArray(compression?.entries) ? compression.entries : [];
  if (!classificationOnly) validateFullMode(classificationEntries, runtimeEntries, errors);
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    mode: classificationOnly ? 'classification-only' : 'full',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    p3Total: p3Rows.length,
    selectedPackageRuntimeCount: runtimeEntries.length,
    deterministicExclusionCount: classificationEntries.filter((entry) => EXCLUSION_ROUTES.has(entry.routeDecision)).length,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
