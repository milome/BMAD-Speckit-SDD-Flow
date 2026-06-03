#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.1';
const CONTRACT_PATH = 'docs/plans/2026-06-04-main-agent-runtime-migration-wave-3-1-goal-execution-plan.md';
const REFINES_WAVE_ID = 'main-agent-runtime-closure-wave-3';
const EXPECTED_HASH = '8499ef2f50f850a690d0aae3cf5191f661cf719b3517f4e87e3037602fc18a82';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INVENTORY_PATH = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  REFINES_WAVE_ID,
  'closure-inventory.json'
);
const PRIORITY_PATH = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  REFINES_WAVE_ID,
  'priority-matrix.md'
);
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const EVIDENCE_PATH = path.join(WAVE_DIR, 'evidence.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');
const INSTALL_MATRIX_DIR = path.join(WAVE_DIR, 'install-matrix');
const CLI_PATH = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

const EXPECTED = [
  {
    candidateId: 'wave-3-1-01',
    entryId: 'main-agent-release-gate',
    originalPath: 'scripts/main-agent-release-gate.ts',
    strategy: 'package_runtime_module',
    sourceTargets: [
      'packages/bmad-speckit/src/main-agent/actions/release-gate.js',
      'packages/bmad-speckit/src/main-agent/runtime.js',
    ],
    distTargets: [
      'packages/bmad-speckit/dist/main-agent/actions/release-gate.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
    ],
    command: 'main-agent:release-gate',
    action: 'release-gate',
  },
  {
    candidateId: 'wave-3-1-02',
    entryId: 'main-agent-quality-gate',
    originalPath: 'scripts/main-agent-quality-gate.ts',
    strategy: 'package_runtime_module',
    sourceTargets: [
      'packages/bmad-speckit/src/main-agent/actions/quality-gate.js',
      'packages/bmad-speckit/src/main-agent/runtime.js',
    ],
    distTargets: [
      'packages/bmad-speckit/dist/main-agent/actions/quality-gate.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
    ],
    command: 'main-agent:quality-gate',
    action: 'quality-gate',
  },
  {
    candidateId: 'wave-3-1-03',
    entryId: 'main-agent-delivery-truth-gate',
    originalPath: 'scripts/main-agent-delivery-truth-gate.ts',
    strategy: 'package_runtime_module',
    sourceTargets: [
      'packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js',
      'packages/bmad-speckit/src/main-agent/runtime.js',
    ],
    distTargets: [
      'packages/bmad-speckit/dist/main-agent/actions/delivery-truth-gate.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
    ],
    command: 'main-agent:delivery-truth-gate',
    action: 'delivery-truth-gate',
  },
  {
    candidateId: 'wave-3-1-04',
    entryId: 'run-auditor-host',
    originalPath: 'scripts/run-auditor-host.ts',
    strategy: 'runtime_emit_cjs',
    sourceTargets: ['packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs'],
    distTargets: ['packages/bmad-speckit/dist/main-agent/auditor-host/run-auditor-host.cjs'],
    command: 'run-auditor-host',
  },
  {
    candidateId: 'wave-3-1-05',
    entryId: 'write-runtime-context',
    originalPath: 'scripts/write-runtime-context.cjs',
    strategy: 'durable_helper_copy',
    sourceTargets: ['packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs'],
    distTargets: ['packages/bmad-speckit/dist/main-agent/helpers/write-runtime-context.cjs'],
    command: 'write-runtime-context',
  },
  {
    candidateId: 'wave-3-1-06',
    entryId: 'eval-questions',
    originalPath: 'scripts/eval-questions-cli.ts',
    strategy: 'public_cli_de_surface',
    sourceTargets: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    distTargets: [],
    command: 'eval-questions',
  },
  {
    candidateId: 'wave-3-1-07',
    entryId: 'main-agent-bmad-help-five-layer-matrix',
    originalPath: 'scripts/main-agent-bmad-help-five-layer-matrix.ts',
    strategy: 'public_cli_de_surface',
    sourceTargets: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    distTargets: [],
    command: 'main-agent:bmad-help-five-layer-matrix',
  },
  {
    candidateId: 'wave-3-1-08',
    entryId: 'main-agent-host-matrix-pr-orchestrate',
    originalPath: 'scripts/main-agent-host-matrix-pr-orchestrator.ts',
    strategy: 'public_cli_de_surface',
    sourceTargets: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    distTargets: [],
    command: 'main-agent:host-matrix-pr-orchestrate',
  },
  {
    candidateId: 'wave-3-1-09',
    entryId: 'bmads-auto',
    originalPath: 'scripts/bmads-auto-cli.ts',
    originalPathStatus: 'source_history_only',
    strategy: 'public_cli_de_surface',
    sourceTargets: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    distTargets: [],
    command: 'bmads-auto',
  },
];

const REQUIRED_PACKAGE_TESTS = [
  'packages/bmad-speckit/tests/main-agent-wave-3-1-runtime-gates.test.js',
  'packages/bmad-speckit/tests/main-agent-wave-3-1-no-root-ts-dispatch.test.js',
  'packages/bmad-speckit/tests/main-agent-wave-3-1-public-desurface.test.js',
];

const REQUIRED_COMMAND_IDS = [
  'CMD-03',
  'CMD-04',
  'CMD-05',
  'CMD-06',
  'CMD-07',
  'CMD-08',
  'CMD-11',
  'CMD-12',
];

function repoPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
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

function sha256File(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function expectedOriginalPathStatus(expected) {
  return expected.originalPathStatus || 'retained';
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

function commandBlock(source, command) {
  const start = source.indexOf(`.command('${command}'`);
  if (start < 0) return null;
  const next = source.indexOf('\nprogram', start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

function validateCandidateSet(inventory, errors) {
  if (sha256File(PRIORITY_PATH) !== EXPECTED_HASH) {
    errors.push(`sourcePlanHash mismatch for ${repoPath(PRIORITY_PATH)}`);
  }
  if (!inventory || !Array.isArray(inventory.nextWaveCandidates)) return;
  if (inventory.nextWaveCandidates.length !== EXPECTED.length) {
    errors.push(`nextWaveCandidates count must be ${EXPECTED.length}`);
  }
  for (const expected of EXPECTED) {
    const row = inventory.nextWaveCandidates.find(
      (candidate) => candidate.candidateId === expected.candidateId
    );
    if (!row) {
      errors.push(`missing nextWaveCandidate ${expected.candidateId}`);
      continue;
    }
    if (row.scriptPath !== expected.originalPath) {
      errors.push(`${expected.candidateId} scriptPath mismatch: ${row.scriptPath}`);
    }
    if (row.migrationStrategy !== expected.strategy) {
      errors.push(`${expected.candidateId} strategy mismatch: ${row.migrationStrategy}`);
    }
    if (row.deletionAllowed !== false) {
      errors.push(`${expected.candidateId} deletionAllowed must be false`);
    }
  }
}

function validateRegistry(registry, errors) {
  if (!registry || !Array.isArray(registry.waves)) {
    errors.push('registry waves missing');
    return;
  }
  if (registry.registryKind !== 'source_repo_script_migration_registry') {
    errors.push('registryKind mismatch');
  }
  if (registry.installSurface !== 'excluded') errors.push('registry installSurface must be excluded');
  if (registry.consumerRuntimeDependency !== false) {
    errors.push('registry consumerRuntimeDependency must be false');
  }
  const wave = registry.waves.find((candidate) => candidate.waveId === WAVE_ID);
  if (!wave) {
    errors.push(`registry missing ${WAVE_ID}`);
    return;
  }
  if (wave.contractPath !== CONTRACT_PATH) errors.push(`${WAVE_ID} contractPath mismatch`);
  if (wave.refinesWaveId !== REFINES_WAVE_ID) errors.push(`${WAVE_ID} refinesWaveId mismatch`);
  if (wave.status !== 'validated') errors.push(`${WAVE_ID} status must be validated`);
  if (!wave.completedAt) errors.push(`${WAVE_ID} completedAt must be set`);
  if (!Array.isArray(wave.entries) || wave.entries.length !== EXPECTED.length) {
    errors.push(`${WAVE_ID} must contain exactly ${EXPECTED.length} entries`);
    return;
  }
  for (const expected of EXPECTED) {
    const entry = wave.entries.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`registry missing entry ${expected.entryId}`);
      continue;
    }
    if (entry.refinesWaveId !== REFINES_WAVE_ID) errors.push(`${expected.entryId} refinesWaveId mismatch`);
    if (entry.originalPath !== expected.originalPath) errors.push(`${expected.entryId} originalPath mismatch`);
    const originalPathStatus = expectedOriginalPathStatus(expected);
    if (entry.originalPathStatus !== originalPathStatus) {
      errors.push(`${expected.entryId} originalPathStatus must be ${originalPathStatus}`);
    }
    if (
      originalPathStatus === 'source_history_only' &&
      (entry.migrationStrategy !== 'public_cli_de_surface' ||
        entry.deletionAllowed !== false ||
        entry.oldPathDisposition !== 'retained_source_dev_only')
    ) {
      errors.push(`${expected.entryId} source_history_only requires de-surface, no deletion, and source-dev-only disposition`);
    }
    if (entry.migrationStrategy !== expected.strategy) errors.push(`${expected.entryId} migrationStrategy mismatch`);
    if (entry.migrationStatus !== 'validated') errors.push(`${expected.entryId} migrationStatus must be validated`);
    if (entry.callerSwitchStatus !== 'switched') errors.push(`${expected.entryId} callerSwitchStatus must be switched`);
    if (entry.validationStatus !== 'passed') errors.push(`${expected.entryId} validationStatus must be passed`);
    if (entry.oldPathDisposition !== 'retained_source_dev_only') {
      errors.push(`${expected.entryId} oldPathDisposition must be retained_source_dev_only`);
    }
    if (entry.deletionAllowed !== false) errors.push(`${expected.entryId} deletionAllowed must be false`);
    if (entry.deletionApprovalRef !== null) errors.push(`${expected.entryId} deletionApprovalRef must be null`);
    if (!entry.evidenceRefs?.includes('repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/evidence.json')) {
      errors.push(`${expected.entryId} evidenceRefs missing Wave 3.1 evidence.json`);
    }
    for (const target of [...expected.sourceTargets, ...expected.distTargets]) {
      if (!entry.targetPaths?.includes(target)) errors.push(`${expected.entryId} targetPaths missing ${target}`);
    }
  }
}

function validateFiles(errors) {
  for (const expected of EXPECTED) {
    if (
      expectedOriginalPathStatus(expected) !== 'source_history_only' &&
      !fs.existsSync(path.join(ROOT, expected.originalPath))
    ) {
      errors.push(`original root script missing: ${expected.originalPath}`);
    }
    for (const target of [...expected.sourceTargets, ...expected.distTargets]) {
      if (!fs.existsSync(path.join(ROOT, target))) errors.push(`target missing: ${target}`);
    }
  }
  for (const testPath of REQUIRED_PACKAGE_TESTS) {
    if (!fs.existsSync(path.join(ROOT, testPath))) errors.push(`package test missing: ${testPath}`);
  }
}

function validateCliDispatch(errors) {
  if (!fs.existsSync(CLI_PATH)) {
    errors.push(`CLI missing: ${repoPath(CLI_PATH)}`);
    return;
  }
  const source = fs.readFileSync(CLI_PATH, 'utf8');
  for (const expected of EXPECTED) {
    const block = commandBlock(source, expected.command);
    if (!block) {
      errors.push(`CLI missing command block: ${expected.command}`);
      continue;
    }
    if (/runRepoScript\(/u.test(block)) errors.push(`${expected.command} still calls runRepoScript`);
    if (/ensure-governance-user-story-mapping-fixture\.js/u.test(block)) {
      errors.push(`${expected.command} still references root prerequisite`);
    }
    if (new RegExp(expected.originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'u').test(block)) {
      errors.push(`${expected.command} still references ${expected.originalPath}`);
    }
    if (/\btsx\b|\bts-node\b/u.test(block)) errors.push(`${expected.command} references TypeScript runner`);
    if (expected.strategy === 'package_runtime_module') {
      if (!block.includes("../dist/main-agent/index.js")) {
        errors.push(`${expected.command} does not dispatch through ../dist/main-agent/index.js`);
      }
      if (!block.includes(expected.action)) errors.push(`${expected.command} missing action ${expected.action}`);
    }
    if (expected.strategy === 'runtime_emit_cjs') {
      if (!block.includes('../dist/main-agent/auditor-host/run-auditor-host.cjs')) {
        errors.push(`${expected.command} does not dispatch through package auditor host runtime`);
      }
    }
    if (expected.strategy === 'durable_helper_copy') {
      if (!block.includes('../dist/main-agent/helpers/write-runtime-context.cjs')) {
        errors.push(`${expected.command} does not dispatch through package helper runtime`);
      }
    }
    if (expected.strategy === 'public_cli_de_surface' && !block.includes('emitDeprecatedAlias')) {
      errors.push(`${expected.command} is not a deprecated compatibility alias`);
    }
  }
}

function validateRuntimeFiles(errors) {
  const guardPaths = [
    'packages/bmad-speckit/src/main-agent/index.js',
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/src/main-agent/actions/release-gate.js',
    'packages/bmad-speckit/src/main-agent/actions/quality-gate.js',
    'packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js',
    'packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs',
    'packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs',
    'packages/bmad-speckit/dist/main-agent/index.js',
    'packages/bmad-speckit/dist/main-agent/runtime.js',
    'packages/bmad-speckit/dist/main-agent/actions/release-gate.js',
    'packages/bmad-speckit/dist/main-agent/actions/quality-gate.js',
    'packages/bmad-speckit/dist/main-agent/actions/delivery-truth-gate.js',
    'packages/bmad-speckit/dist/main-agent/auditor-host/run-auditor-host.cjs',
    'packages/bmad-speckit/dist/main-agent/helpers/write-runtime-context.cjs',
  ];
  const forbidden = [
    /scripts[\\/]main-agent-release-gate\.ts/u,
    /scripts[\\/]main-agent-quality-gate\.ts/u,
    /scripts[\\/]main-agent-delivery-truth-gate\.ts/u,
    /scripts[\\/]run-auditor-host\.ts/u,
    /scripts[\\/]write-runtime-context\.cjs/u,
    /scripts[\\/]eval-questions-cli\.ts/u,
    /scripts[\\/]main-agent-bmad-help-five-layer-matrix\.ts/u,
    /scripts[\\/]main-agent-host-matrix-pr-orchestrator\.ts/u,
    /scripts[\\/]bmads-auto-cli\.ts/u,
    /ensure-governance-user-story-mapping-fixture\.js/u,
    /runRepoScript\(/u,
    /\btsx\b/u,
    /\bts-node\b/u,
  ];
  for (const guardPath of guardPaths) {
    const full = path.join(ROOT, guardPath);
    if (!fs.existsSync(full)) {
      errors.push(`static guard path missing: ${guardPath}`);
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    for (const pattern of forbidden) {
      if (pattern.test(text)) errors.push(`${guardPath} contains forbidden pattern ${pattern}`);
    }
  }
}

function validateInstallMatrix(errors) {
  const requiredModes = ['save-dev', 'npx-package', 'no-save'];
  for (const mode of requiredModes) {
    const receiptPath = path.join(INSTALL_MATRIX_DIR, `${mode}.json`);
    const receipt = readJson(receiptPath, errors);
    if (!receipt) continue;
    if (receipt.waveId !== WAVE_ID) errors.push(`${mode} receipt waveId mismatch`);
    if (receipt.installMode !== mode) errors.push(`${mode} receipt installMode mismatch`);
    for (const field of ['usedRootScript', 'usedTsx', 'usedTsNode', 'usedCompiledFallback']) {
      if (receipt[field] !== false) errors.push(`${mode} receipt ${field} must be false`);
    }
    if (receipt.result !== 'passed') errors.push(`${mode} receipt result must be passed`);
    if (!Array.isArray(receipt.commands) || receipt.commands.length < 9) {
      errors.push(`${mode} receipt must include all Wave 3.1 command probes`);
      continue;
    }
    for (const row of receipt.commands) {
      if (row.exitCode !== 0) errors.push(`${mode}/${row.commandId} exitCode must be 0`);
      for (const hashField of ['stdoutHash', 'stderrHash']) {
        if (!String(row[hashField] || '').startsWith('sha256:')) {
          errors.push(`${mode}/${row.commandId} ${hashField} missing sha256 prefix`);
        }
      }
      for (const field of ['usedRootScript', 'usedTsx', 'usedTsNode']) {
        if (row[field] !== false) errors.push(`${mode}/${row.commandId} ${field} must be false`);
      }
      if (row.coveredAction && row.usedCompiledFallback !== false) {
        errors.push(`${mode}/${row.commandId} usedCompiledFallback must be false`);
      }
    }
  }
}

function validateEvidence(errors) {
  const evidence = readJson(EVIDENCE_PATH, errors);
  if (!evidence) return;
  if (evidence.waveId !== WAVE_ID) errors.push('evidence waveId mismatch');
  if (evidence.sourcePlanHash !== `sha256:${EXPECTED_HASH}`) errors.push('evidence sourcePlanHash mismatch');
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== EXPECTED.length) {
    errors.push(`evidence must contain ${EXPECTED.length} entries`);
  }
  const commands = evidence.commands || evidence.entries?.flatMap((entry) => entry.commands || []) || [];
  for (const commandId of REQUIRED_COMMAND_IDS) {
    const row = commands.find((candidate) => String(candidate.commandId || candidate.command || '').includes(commandId));
    if (!row) {
      errors.push(`evidence missing ${commandId}`);
      continue;
    }
    if (row.exitCode !== 0) errors.push(`evidence ${commandId} exitCode must be 0`);
    for (const hashField of ['stdoutHash', 'stderrHash']) {
      if (!String(row[hashField] || '').startsWith('sha256:')) {
        errors.push(`evidence ${commandId} ${hashField} missing sha256 prefix`);
      }
    }
  }
  for (const expected of EXPECTED) {
    const entry = evidence.entries?.find((candidate) => candidate.entryId === expected.entryId);
    if (!entry) {
      errors.push(`evidence missing entry ${expected.entryId}`);
      continue;
    }
    if (entry.originalPath !== expected.originalPath) errors.push(`evidence ${expected.entryId} originalPath mismatch`);
    if (entry.result !== 'passed') errors.push(`evidence ${expected.entryId} result must be passed`);
    if (entry.deletionAllowed !== false) errors.push(`evidence ${expected.entryId} deletionAllowed must be false`);
    for (const target of [...expected.sourceTargets, ...expected.distTargets]) {
      if (!entry.targetPaths?.includes(target)) errors.push(`evidence ${expected.entryId} targetPaths missing ${target}`);
    }
  }
  for (const mode of ['save-dev', 'npx-package', 'no-save']) {
    const ref = `repo-governance/script-migrations/${WAVE_ID}/install-matrix/${mode}.json`;
    if (!evidence.installMatrixEvidence?.includes(ref)) {
      errors.push(`evidence installMatrixEvidence missing ${ref}`);
    }
  }
}

function validateSummary(errors) {
  if (!fs.existsSync(SUMMARY_PATH)) {
    errors.push('summary.md missing');
    return;
  }
  const summary = fs.readFileSync(SUMMARY_PATH, 'utf8');
  for (const text of [
    `sourcePlanHash: sha256:${EXPECTED_HASH}`,
    'No root script deletion was performed or approved in Wave 3.1.',
    'rootScriptsDeleted: false',
    'rootScriptDeletionApproved: false',
    'nextWaveRecommendation: blocked_until_wave_3_1_acceptance_review_complete',
  ]) {
    if (!summary.includes(text)) errors.push(`summary.md missing required text: ${text}`);
  }
}

function validateNoRepoGovernanceRuntimeDependency(errors) {
  const roots = [
    path.join(ROOT, 'packages', 'bmad-speckit', 'bin'),
    path.join(ROOT, 'packages', 'bmad-speckit', 'src'),
    path.join(ROOT, 'packages', 'bmad-speckit', 'dist'),
  ];
  const offenders = [];
  for (const root of roots) {
    for (const filePath of listFiles(root)) {
      if (!/\.(cjs|mjs|js|json)$/u.test(filePath)) continue;
      if (fs.readFileSync(filePath, 'utf8').includes('repo-governance')) offenders.push(repoPath(filePath));
    }
  }
  if (offenders.length > 0) {
    errors.push(`package consumer runtime references repo-governance: ${offenders.join(', ')}`);
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

function main() {
  const errors = [];
  const inventory = readJson(INVENTORY_PATH, errors);
  const registry = readYaml(REGISTRY_PATH, errors);
  validateCandidateSet(inventory, errors);
  validateRegistry(registry, errors);
  validateFiles(errors);
  validateCliDispatch(errors);
  validateRuntimeFiles(errors);
  validateInstallMatrix(errors);
  validateEvidence(errors);
  validateSummary(errors);
  validateNoRepoGovernanceRuntimeDependency(errors);
  validateNoRootScriptDeletion(errors);

  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
