#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = 'docs/plans/2026-06-04-main-agent-runtime-migration-wave-3-3-and-3-4-goal-execution-plan.md';
const WAVE33_ID = 'main-agent-runtime-migration-wave-3.3';
const WAVE34_ID = 'main-agent-runtime-migration-wave-3.4';
const WAVE32_ID = 'main-agent-runtime-migration-wave-3.2';
const WAVE33_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE33_ID);
const WAVE34_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE34_ID);
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const TOUCHPOINTS_PATH = path.join(WAVE34_DIR, 'installed-surface-touchpoints.json');

const WAVE33 = [
  ['main-agent-codex-worker-adapter', 'scripts/main-agent-codex-worker-adapter.ts', 'codex-worker-adapter'],
  ['main-agent-compiled-prompt-runner', 'scripts/main-agent-compiled-prompt-runner.ts', 'compiled-prompt-runner'],
  ['main-agent-implementation-readiness-gate', 'scripts/main-agent-implementation-readiness-gate.ts', 'implementation-readiness-gate'],
].map(([entryId, originalPath, action]) => ({ entryId, originalPath, action }));

const WAVE34 = [
  ['main-agent-unified-ingress', 'scripts/main-agent-unified-ingress.ts', 'unified-ingress'],
  ['main-agent-delivery-closeout-gate', 'scripts/main-agent-delivery-closeout-gate.ts', 'delivery-closeout-gate'],
  ['main-agent-delivery-evidence-run', 'scripts/main-agent-delivery-evidence-run.ts', 'delivery-evidence-run'],
  ['main-agent-soak-runner', 'scripts/main-agent-soak-runner.ts', 'soak-runner'],
  ['main-agent-dual-host-pr-orchestrator', 'scripts/main-agent-dual-host-pr-orchestrator.ts', 'dual-host-pr-orchestrator'],
  ['main-agent-chaos-scenarios', 'scripts/main-agent-chaos-scenarios.ts', 'chaos-scenarios'],
].map(([entryId, originalPath, action]) => ({ entryId, originalPath, action }));

function slash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function repoPath(filePath) {
  return slash(path.relative(ROOT, filePath));
}

function readJson(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${repoPath(filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON ${repoPath(filePath)}: ${error.message}`);
    return null;
  }
}

function readYaml(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${repoPath(filePath)}`);
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid YAML ${repoPath(filePath)}: ${error.message}`);
    return null;
  }
}

function targetPaths(action) {
  return [
    `packages/bmad-speckit/src/main-agent/actions/${action}.js`,
    `packages/bmad-speckit/dist/main-agent/actions/${action}.js`,
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/dist/main-agent/runtime.js',
  ];
}

function validateOriginals(entries, errors) {
  for (const entry of entries) {
    if (!fs.existsSync(path.join(ROOT, entry.originalPath))) {
      errors.push(`original root script missing: ${entry.originalPath}`);
    }
  }
}

function validateActionFiles(entries, errors) {
  const forbidden = [
    /scripts[\\/].*\.ts/u,
    /runRepoScript\(/u,
    /\btsx\b/u,
    /(^|[^A-Za-z0-9_-])ts-node(?:\.cmd)?($|[^A-Za-z0-9_-])/iu,
    /compiled[\\/]main-agent-orchestration\.cjs/u,
  ];
  for (const entry of entries) {
    for (const target of targetPaths(entry.action)) {
      const full = path.join(ROOT, target);
      if (!fs.existsSync(full)) {
        errors.push(`missing target: ${target}`);
        continue;
      }
      const text = fs.readFileSync(full, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) errors.push(`${target} contains forbidden pattern ${pattern}`);
      }
    }
  }
}

function validateRuntimeRegistration(entries, errors) {
  const runtimePath = path.join(ROOT, 'packages', 'bmad-speckit', 'src', 'main-agent', 'runtime.js');
  const distRuntimePath = path.join(ROOT, 'packages', 'bmad-speckit', 'dist', 'main-agent', 'runtime.js');
  for (const runtimeFile of [runtimePath, distRuntimePath]) {
    if (!fs.existsSync(runtimeFile)) {
      errors.push(`missing runtime file: ${repoPath(runtimeFile)}`);
      continue;
    }
    const text = fs.readFileSync(runtimeFile, 'utf8');
    for (const entry of entries) {
      if (!text.includes(`'${entry.action}'`)) errors.push(`${repoPath(runtimeFile)} missing action ${entry.action}`);
      if (!text.includes(`${entry.action.replace(/-([a-z])/g, (_, char) => char.toUpperCase())}Action`)) {
        errors.push(`${repoPath(runtimeFile)} missing action handler for ${entry.action}`);
      }
    }
  }
}

function validateRegistryWave(registry, waveId, expectedEntries, previousWaveId, errors) {
  const wave = registry?.waves?.find((candidate) => candidate.waveId === waveId);
  if (!wave) {
    errors.push(`registry missing wave ${waveId}`);
    return;
  }
  if (wave.contractPath !== CONTRACT_PATH) errors.push(`${waveId} contractPath mismatch`);
  if (wave.refinesWaveId !== previousWaveId) errors.push(`${waveId} refinesWaveId must be ${previousWaveId}`);
  if (wave.status !== 'validated') errors.push(`${waveId} status must be validated`);
  if (!wave.completedAt) errors.push(`${waveId} completedAt must be set`);
  if (!Array.isArray(wave.entries) || wave.entries.length !== expectedEntries.length) {
    errors.push(`${waveId} must contain exactly ${expectedEntries.length} entries`);
    return;
  }
  for (const expected of expectedEntries) {
    const entry = wave.entries.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`${waveId} missing entry ${expected.entryId}`);
      continue;
    }
    const evidenceRef = `repo-governance/script-migrations/${waveId}/evidence.json`;
    if (entry.refinesWaveId !== WAVE32_ID) errors.push(`${expected.entryId} entry refinesWaveId must be ${WAVE32_ID}`);
    if (entry.originalPath !== expected.originalPath) errors.push(`${expected.entryId} originalPath mismatch`);
    if (entry.originalPathStatus !== 'retained') errors.push(`${expected.entryId} originalPathStatus must be retained`);
    if (entry.migrationStrategy !== 'package_runtime_module') errors.push(`${expected.entryId} migrationStrategy mismatch`);
    if (entry.migrationStatus !== 'validated') errors.push(`${expected.entryId} migrationStatus must be validated`);
    if (entry.callerSwitchStatus !== 'switched') errors.push(`${expected.entryId} callerSwitchStatus must be switched`);
    if (entry.validationStatus !== 'passed') errors.push(`${expected.entryId} validationStatus must be passed`);
    if (entry.oldPathDisposition !== 'retained_source_dev_only') {
      errors.push(`${expected.entryId} oldPathDisposition must be retained_source_dev_only`);
    }
    if (entry.deletionAllowed !== false) errors.push(`${expected.entryId} deletionAllowed must be false`);
    if (entry.deletionApprovalRef !== null) errors.push(`${expected.entryId} deletionApprovalRef must be null`);
    if (!entry.evidenceRefs?.includes(evidenceRef)) errors.push(`${expected.entryId} evidenceRefs missing ${evidenceRef}`);
    for (const target of targetPaths(expected.action)) {
      if (!entry.targetPaths?.includes(target)) errors.push(`${expected.entryId} targetPaths missing ${target}`);
    }
  }
}

function validateEvidence(waveId, waveDir, expectedEntries, errors) {
  const evidence = readJson(path.join(waveDir, 'evidence.json'), errors);
  if (!evidence) return;
  if (evidence.waveId !== waveId) errors.push(`${waveId} evidence waveId mismatch`);
  if (evidence.contractPath !== CONTRACT_PATH) errors.push(`${waveId} evidence contractPath mismatch`);
  if (evidence.result !== 'passed') errors.push(`${waveId} evidence result must be passed`);
  if (evidence.noRootScriptDeletion !== true) errors.push(`${waveId} evidence noRootScriptDeletion must be true`);
  if (evidence.rootScriptDeletionApproved !== false) errors.push(`${waveId} evidence rootScriptDeletionApproved must be false`);
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== expectedEntries.length) {
    errors.push(`${waveId} evidence must contain exactly ${expectedEntries.length} entries`);
    return;
  }
  for (const expected of expectedEntries) {
    const entry = evidence.entries.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`${waveId} evidence missing ${expected.entryId}`);
      continue;
    }
    if (entry.originalPath !== expected.originalPath) errors.push(`${waveId}/${expected.entryId} originalPath mismatch`);
    if (entry.deletionAllowed !== false) errors.push(`${waveId}/${expected.entryId} deletionAllowed must be false`);
    if (entry.result !== 'passed') errors.push(`${waveId}/${expected.entryId} result must be passed`);
    for (const target of targetPaths(expected.action)) {
      if (!entry.targetPaths?.includes(target)) errors.push(`${waveId}/${expected.entryId} targetPaths missing ${target}`);
    }
    for (const row of entry.commands || []) {
      if (row.exitCode !== 0) errors.push(`${waveId}/${expected.entryId}/${row.commandId || row.command} exitCode must be 0`);
      if (!String(row.stdoutHash || '').startsWith('sha256:')) {
        errors.push(`${waveId}/${expected.entryId}/${row.commandId || row.command} stdoutHash missing sha256 prefix`);
      }
      if (!String(row.stderrHash || '').startsWith('sha256:')) {
        errors.push(`${waveId}/${expected.entryId}/${row.commandId || row.command} stderrHash missing sha256 prefix`);
      }
    }
    for (const ref of entry.installMatrixEvidence || []) {
      if (!fs.existsSync(path.join(ROOT, ref))) errors.push(`${waveId}/${expected.entryId} missing install evidence ${ref}`);
    }
  }
}

function validateInstallReceipts(waveId, waveDir, errors) {
  for (const mode of ['save-dev', 'npx-package', 'no-save', 'init-codex']) {
    const receipt = readJson(path.join(waveDir, 'install-matrix', `${mode}.json`), errors);
    if (!receipt) continue;
    if (receipt.waveId !== waveId) errors.push(`${waveId}/${mode} waveId mismatch`);
    if (receipt.installMode !== mode) errors.push(`${waveId}/${mode} installMode mismatch`);
    if (receipt.result !== 'passed') errors.push(`${waveId}/${mode} result must be passed`);
    for (const field of ['usedRootScript', 'usedTsx', 'usedTsNode', 'usedCompiledFallback']) {
      if (receipt[field] !== false) errors.push(`${waveId}/${mode} ${field} must be false`);
    }
    if (!Array.isArray(receipt.commands) || receipt.commands.length === 0) {
      errors.push(`${waveId}/${mode} commands must be non-empty`);
    }
  }
}

function validateTouchpoints(errors) {
  const touchpoints = readJson(TOUCHPOINTS_PATH, errors);
  if (!touchpoints) return;
  if (touchpoints.waveId !== WAVE34_ID) errors.push('installed-surface-touchpoints waveId mismatch');
  if (!Array.isArray(touchpoints.entries) || touchpoints.entries.length !== WAVE34.length) {
    errors.push('installed-surface-touchpoints must contain exactly six entries');
    return;
  }
  const allowedSurfaceTypes = new Set(['skill', 'command', 'hook', 'template', 'npm_script', 'owner_registry', 'generated_surface', 'test_surface']);
  for (const expected of WAVE34) {
    const entry = touchpoints.entries.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`touchpoints missing ${expected.entryId}`);
      continue;
    }
    if (entry.originalPath !== expected.originalPath) errors.push(`touchpoint ${expected.entryId} originalPath mismatch`);
    if (entry.selectedRuntimeRoute !== 'package_runtime_module') {
      errors.push(`touchpoint ${expected.entryId} selectedRuntimeRoute must be package_runtime_module`);
    }
    if (!Array.isArray(entry.touchpoints) || entry.touchpoints.length === 0) {
      errors.push(`touchpoint ${expected.entryId} touchpoints must be non-empty`);
      continue;
    }
    for (const touchpoint of entry.touchpoints) {
      if (!allowedSurfaceTypes.has(touchpoint.surfaceType)) {
        errors.push(`touchpoint ${expected.entryId} invalid surfaceType ${touchpoint.surfaceType}`);
      }
      if (!touchpoint.currentInvocation) errors.push(`touchpoint ${expected.entryId} missing currentInvocation`);
      if (!touchpoint.postMigrationInvocation) errors.push(`touchpoint ${expected.entryId} missing postMigrationInvocation`);
      if (/scripts[\\/].*\.ts|\btsx\b|\bts-node\b/u.test(touchpoint.postMigrationInvocation)) {
        errors.push(`touchpoint ${expected.entryId} postMigrationInvocation is not consumer safe`);
      }
    }
  }
}

function validateNoRootScriptDeletion(errors) {
  const result = spawnSync('git', ['status', '--short', '--', 'scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
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

function validateSummary(waveId, waveDir, errors) {
  const summaryPath = path.join(waveDir, 'summary.md');
  if (!fs.existsSync(summaryPath)) {
    errors.push(`${waveId} summary.md missing`);
    return;
  }
  const text = fs.readFileSync(summaryPath, 'utf8');
  for (const required of [
    'Deletion is not approved',
    'usedRootScript: false',
    'usedTsx: false',
    'usedTsNode: false',
    'usedCompiledFallback: false',
    'rootScriptsDeleted: false',
    'rootScriptDeletionApproved: false',
  ]) {
    if (!text.includes(required)) errors.push(`${waveId} summary missing ${required}`);
  }
}

function main() {
  const errors = [];
  const registry = readYaml(REGISTRY_PATH, errors);
  const allEntries = [...WAVE33, ...WAVE34];

  validateOriginals(allEntries, errors);
  validateActionFiles(allEntries, errors);
  validateRuntimeRegistration(allEntries, errors);
  validateRegistryWave(registry, WAVE33_ID, WAVE33, WAVE32_ID, errors);
  validateRegistryWave(registry, WAVE34_ID, WAVE34, WAVE33_ID, errors);
  validateEvidence(WAVE33_ID, WAVE33_DIR, WAVE33, errors);
  validateEvidence(WAVE34_ID, WAVE34_DIR, WAVE34, errors);
  validateInstallReceipts(WAVE33_ID, WAVE33_DIR, errors);
  validateInstallReceipts(WAVE34_ID, WAVE34_DIR, errors);
  validateTouchpoints(errors);
  validateSummary(WAVE33_ID, WAVE33_DIR, errors);
  validateSummary(WAVE34_ID, WAVE34_DIR, errors);
  validateNoRootScriptDeletion(errors);

  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    contractPath: CONTRACT_PATH,
    waves: [WAVE33_ID, WAVE34_ID],
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
