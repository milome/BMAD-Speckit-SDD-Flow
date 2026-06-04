#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.2';
const CONTRACT_PATH =
  'docs/plans/2026-06-04-main-agent-runtime-migration-wave-3-2-goal-execution-plan.md';
const SOURCE_PLAN_HASH = 'sha256:36c45498fe3296973659d871dacaf8ab539698d5450c8ff111be59fbf32d35b8';
const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.1';
const ENTRY_REFINES_WAVE_ID = 'main-agent-runtime-closure-wave-3';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INVENTORY_PATH = path.join(WAVE_DIR, 'caller-inventory.json');
const MATRIX_PATH = path.join(WAVE_DIR, 'classification-matrix.md');
const EVIDENCE_PATH = path.join(WAVE_DIR, 'evidence.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const INVENTORY_REF =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/caller-inventory.json';

const TARGETS = [
  ['main-agent-codex-worker-adapter', 'scripts/main-agent-codex-worker-adapter.ts'],
  ['main-agent-compiled-prompt-runner', 'scripts/main-agent-compiled-prompt-runner.ts'],
  ['main-agent-implementation-readiness-gate', 'scripts/main-agent-implementation-readiness-gate.ts'],
  ['main-agent-unified-ingress', 'scripts/main-agent-unified-ingress.ts'],
  ['main-agent-delivery-closeout-gate', 'scripts/main-agent-delivery-closeout-gate.ts'],
  ['main-agent-execution-closure-gate', 'scripts/main-agent-execution-closure-gate.ts'],
  ['main-agent-production-loop-ready-check', 'scripts/main-agent-production-loop-ready-check.ts'],
  ['main-agent-scoring-gates-check', 'scripts/main-agent-scoring-gates-check.ts'],
  ['main-agent-runtime-policy-snapshot-check', 'scripts/main-agent-runtime-policy-snapshot-check.ts'],
  ['main-agent-trace-status-policy-check', 'scripts/main-agent-trace-status-policy-check.ts'],
  ['main-agent-data-governance-gate', 'scripts/main-agent-data-governance-gate.ts'],
  ['main-agent-dataset-release-gate', 'scripts/main-agent-dataset-release-gate.ts'],
  ['main-agent-governed-data-products', 'scripts/main-agent-governed-data-products.ts'],
  ['main-agent-functional-resume-check', 'scripts/main-agent-functional-resume-check.ts'],
  ['main-agent-entryflow-traceability-check', 'scripts/main-agent-entryflow-traceability-check.ts'],
  ['main-agent-control-plane-isolation-check', 'scripts/main-agent-control-plane-isolation-check.ts'],
  ['main-agent-decision-field-check', 'scripts/main-agent-decision-field-check.ts'],
  ['main-agent-ai-tdd-closeout-remediation-adapter', 'scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts'],
  ['main-agent-audit-review-gate', 'scripts/main-agent-audit-review-gate.ts'],
  ['main-agent-bmad-artifact-hardcut', 'scripts/main-agent-bmad-artifact-hardcut.ts'],
  ['main-agent-delivery-evidence-run', 'scripts/main-agent-delivery-evidence-run.ts'],
  ['main-agent-soak-runner', 'scripts/main-agent-soak-runner.ts'],
  ['main-agent-development-journey-matrix', 'scripts/main-agent-development-journey-matrix.ts'],
  ['main-agent-dual-host-pr-orchestrator', 'scripts/main-agent-dual-host-pr-orchestrator.ts'],
  ['main-agent-chaos-scenarios', 'scripts/main-agent-chaos-scenarios.ts'],
].map(([entryId, originalPath]) => ({ entryId, originalPath }));

const SETTLED = new Set([
  'scripts/main-agent-release-gate.ts',
  'scripts/main-agent-quality-gate.ts',
  'scripts/main-agent-delivery-truth-gate.ts',
  'scripts/main-agent-bmad-help-five-layer-matrix.ts',
  'scripts/main-agent-host-matrix-pr-orchestrator.ts',
  'scripts/main-agent-orchestration.ts',
]);

const STRATEGIES = new Set([
  'package_runtime_module',
  'runtime_emit_cjs',
  'consumer_installed_helper',
  'repo_internal_reclassify',
  'public_cli_de_surface',
  'compatibility_alias',
  'blocked_requires_decision',
]);
const REACHABILITY = new Set([
  'consumer_runtime_reachable',
  'installed_surface_reachable',
  'source_repo_only',
  'blocked_by_ambiguous_call_graph',
]);

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

function expectArray(value, label, errors) {
  if (!Array.isArray(value)) errors.push(`${label} must be an array`);
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object || {}, field);
}

function validateCandidateSet(errors) {
  const scriptsDir = path.join(ROOT, 'scripts');
  const files = fs
    .readdirSync(scriptsDir)
    .filter((file) => /^main-agent-.*\.ts$/u.test(file))
    .map((file) => `scripts/${file}`)
    .sort();
  if (files.length !== 31) errors.push(`rootMainAgentTotal expected 31 got ${files.length}`);
  const targetSet = new Set(TARGETS.map((target) => target.originalPath));
  const computedTargets = files.filter((file) => !SETTLED.has(file));
  if (SETTLED.size !== 6) errors.push(`settledEntriesExcludedFromWave3.2 expected 6 got ${SETTLED.size}`);
  if (computedTargets.length !== 25) {
    errors.push(`wave3.2TargetEntries expected 25 got ${computedTargets.length}`);
  }
  for (const target of TARGETS) {
    if (!computedTargets.includes(target.originalPath)) errors.push(`target missing from computed set: ${target.originalPath}`);
    if (!fs.existsSync(path.join(ROOT, target.originalPath))) errors.push(`target original missing: ${target.originalPath}`);
  }
  for (const file of computedTargets) {
    if (!targetSet.has(file)) errors.push(`unexpected target in computed set: ${file}`);
  }
}

function validateInventory(inventory, errors) {
  if (!inventory) return;
  if (inventory.schemaVersion !== 'main-agent-wave-3-2-caller-inventory/v1') {
    errors.push('inventory schemaVersion mismatch');
  }
  if (inventory.waveId !== WAVE_ID) errors.push('inventory waveId mismatch');
  if (inventory.contractPath !== CONTRACT_PATH) errors.push('inventory contractPath mismatch');
  if (inventory.rootMainAgentTotal !== 31) errors.push('inventory rootMainAgentTotal must be 31');
  if (inventory.settledEntriesExcludedFromWave3_2 !== 6) {
    errors.push('inventory settledEntriesExcludedFromWave3_2 must be 6');
  }
  if (inventory.wave3_2TargetEntries !== 25) errors.push('inventory wave3_2TargetEntries must be 25');
  if (!Array.isArray(inventory.entries) || inventory.entries.length !== TARGETS.length) {
    errors.push(`inventory entries must contain ${TARGETS.length} rows`);
    return;
  }
  const byId = new Map(inventory.entries.map((entry) => [entry.entryId, entry]));
  for (const target of TARGETS) {
    const entry = byId.get(target.entryId);
    if (!entry) {
      errors.push(`inventory missing ${target.entryId}`);
      continue;
    }
    validateInventoryEntry(target, entry, errors);
  }
}

function validateInventoryEntry(target, entry, errors) {
  const required = [
    'entryId',
    'originalPath',
    'originalExists',
    'packageJsonScripts',
    'packageCliCommands',
    'packageRuntimeRefs',
    'installedSurfaceRefs',
    'acceptanceTestRefs',
    'sourceScriptRefs',
    'docsRefsCount',
    'consumerReachability',
    'requiresPackaging',
    'canBecomePackageModule',
    'recommendedMigrationStrategy',
    'recommendedTargetPaths',
    'minimumTests',
    'evidenceRefs',
    'deletionAllowed',
    'deletionApprovalRef',
  ];
  for (const field of required) {
    if (!hasOwn(entry, field)) errors.push(`${target.entryId} missing ${field}`);
  }
  if (entry.originalPath !== target.originalPath) errors.push(`${target.entryId} originalPath mismatch`);
  if (entry.originalExists !== true) errors.push(`${target.entryId} originalExists must be true`);
  for (const field of [
    'packageJsonScripts',
    'packageCliCommands',
    'packageRuntimeRefs',
    'installedSurfaceRefs',
    'acceptanceTestRefs',
    'sourceScriptRefs',
    'recommendedTargetPaths',
    'minimumTests',
    'evidenceRefs',
  ]) {
    expectArray(entry[field], `${target.entryId}.${field}`, errors);
  }
  if (typeof entry.docsRefsCount !== 'number') errors.push(`${target.entryId}.docsRefsCount must be number`);
  if (!REACHABILITY.has(entry.consumerReachability)) {
    errors.push(`${target.entryId} invalid consumerReachability: ${entry.consumerReachability}`);
  }
  if (!STRATEGIES.has(entry.recommendedMigrationStrategy)) {
    errors.push(`${target.entryId} invalid recommendedMigrationStrategy: ${entry.recommendedMigrationStrategy}`);
  }
  if (entry.deletionAllowed !== false) errors.push(`${target.entryId} deletionAllowed must be false`);
  if (entry.deletionApprovalRef !== null) errors.push(`${target.entryId} deletionApprovalRef must be null`);
  if (!entry.evidenceRefs?.includes(INVENTORY_REF)) errors.push(`${target.entryId} evidenceRefs missing inventory ref`);
  if (
    entry.consumerReachability === 'source_repo_only' &&
    (entry.packageCliCommands.length > 0 ||
      entry.packageRuntimeRefs.length > 0 ||
      entry.installedSurfaceRefs.length > 0)
  ) {
    errors.push(`${target.entryId} source_repo_only has package or installed surface refs`);
  }
  if (
    entry.consumerReachability === 'consumer_runtime_reachable' &&
    entry.packageCliCommands.length === 0 &&
    entry.packageRuntimeRefs.length === 0 &&
    entry.installedSurfaceRefs.length === 0
  ) {
    errors.push(`${target.entryId} consumer_runtime_reachable lacks consumer refs`);
  }
  if (entry.consumerReachability === 'blocked_by_ambiguous_call_graph') {
    if (!Array.isArray(entry.blockingQuestions) || entry.blockingQuestions.length === 0) {
      errors.push(`${target.entryId} ambiguous entry missing blockingQuestions`);
    }
  }
  if (entry.recommendedMigrationStrategy === 'repo_internal_reclassify') {
    if (entry.consumerReachability !== 'source_repo_only') {
      errors.push(`${target.entryId} repo_internal_reclassify requires source_repo_only`);
    }
    if (entry.recommendedTargetPaths.length !== 0) {
      errors.push(`${target.entryId} repo_internal_reclassify targetPaths must be empty`);
    }
  }
  if (entry.recommendedMigrationStrategy === 'package_runtime_module') {
    if (!entry.recommendedTargetPaths.some((targetPath) => targetPath.startsWith('packages/bmad-speckit/src/'))) {
      errors.push(`${target.entryId} package_runtime_module missing package source target`);
    }
    if (!entry.recommendedTargetPaths.some((targetPath) => targetPath.startsWith('packages/bmad-speckit/dist/'))) {
      errors.push(`${target.entryId} package_runtime_module missing package dist target`);
    }
  }
  if (entry.minimumTests.length === 0) errors.push(`${target.entryId} minimumTests must not be empty`);
  const totalRefs =
    entry.packageJsonScripts.length +
    entry.packageCliCommands.length +
    entry.packageRuntimeRefs.length +
    entry.installedSurfaceRefs.length +
    entry.acceptanceTestRefs.length +
    entry.sourceScriptRefs.length +
    entry.docsRefsCount;
  if (totalRefs === 0) errors.push(`${target.entryId} caller inventory is empty`);
}

function validateRegistry(registry, inventory, errors) {
  if (!registry) return;
  const wave = registry.waves?.find((candidate) => candidate.waveId === WAVE_ID);
  if (!wave) {
    errors.push(`registry missing ${WAVE_ID}`);
    return;
  }
  if (wave.contractPath !== CONTRACT_PATH) errors.push('registry Wave 3.2 contractPath mismatch');
  if (wave.refinesWaveId !== REFINES_WAVE_ID) errors.push('registry Wave 3.2 refinesWaveId mismatch');
  if (!Array.isArray(wave.entries) || wave.entries.length !== TARGETS.length) {
    errors.push(`registry Wave 3.2 must contain ${TARGETS.length} entries`);
    return;
  }
  const invById = new Map((inventory?.entries || []).map((entry) => [entry.entryId, entry]));
  const seen = new Set();
  for (const target of TARGETS) {
    const entry = wave.entries.find((candidate) => candidate.entryId === target.entryId);
    const inv = invById.get(target.entryId);
    if (!entry) {
      errors.push(`registry missing ${target.entryId}`);
      continue;
    }
    if (seen.has(entry.entryId)) errors.push(`registry duplicate ${entry.entryId}`);
    seen.add(entry.entryId);
    if (entry.refinesWaveId !== ENTRY_REFINES_WAVE_ID) errors.push(`${target.entryId} refinesWaveId mismatch`);
    if (entry.originalPath !== target.originalPath) errors.push(`${target.entryId} originalPath mismatch`);
    if (entry.originalPathStatus !== 'retained') errors.push(`${target.entryId} originalPathStatus must be retained`);
    if (entry.originalClassBeforeMigration !== 'unknown_requires_wave_3_2_classification') {
      errors.push(`${target.entryId} originalClassBeforeMigration mismatch`);
    }
    if (entry.deletionAllowed !== false) errors.push(`${target.entryId} registry deletionAllowed must be false`);
    if (entry.deletionApprovalRef !== null) errors.push(`${target.entryId} registry deletionApprovalRef must be null`);
    if (!entry.evidenceRefs?.includes(INVENTORY_REF)) errors.push(`${target.entryId} registry missing inventory evidence`);
    if (inv) {
      if (entry.migrationStrategy !== inv.recommendedMigrationStrategy) {
        errors.push(`${target.entryId} registry migrationStrategy differs from inventory`);
      }
      if (JSON.stringify(entry.targetPaths || []) !== JSON.stringify(inv.recommendedTargetPaths || [])) {
        errors.push(`${target.entryId} registry targetPaths differ from inventory`);
      }
      if (entry.migrationStrategy === 'package_runtime_module' && entry.migrationStatus === 'validated') {
        errors.push(`${target.entryId} must not be validated in Wave 3.2 package migration planning`);
      }
    }
  }
}

function validateMatrix(inventory, errors) {
  if (!fs.existsSync(MATRIX_PATH)) {
    errors.push(`missing file: ${repoPath(MATRIX_PATH)}`);
    return;
  }
  const text = fs.readFileSync(MATRIX_PATH, 'utf8');
  for (const required of [
    '| rootMainAgentTotal | 31 |',
    '| settledEntriesExcludedFromWave3.2 | 6 |',
    '| wave3.2TargetEntries | 25 |',
    '| deletionAllowedCount | 0 |',
    '| implementationMigrationCountInWave3.2 | 0 |',
  ]) {
    if (!text.includes(required)) errors.push(`classification matrix missing ${required}`);
  }
  const rowCount = text
    .split(/\r?\n/u)
    .filter((line) => TARGETS.some((target) => line.startsWith(`| ${target.entryId} |`))).length;
  if (rowCount !== TARGETS.length) errors.push(`classification matrix row count expected 25 got ${rowCount}`);
  for (const entry of inventory?.entries || []) {
    if (!text.includes(`| ${entry.entryId} | ${entry.originalPath} |`)) {
      errors.push(`classification matrix missing row for ${entry.entryId}`);
    }
    if (!text.includes(`${entry.recommendedMigrationStrategy}`)) {
      errors.push(`classification matrix missing strategy ${entry.recommendedMigrationStrategy}`);
    }
  }
}

function validateEvidence(inventory, errors) {
  if (!fs.existsSync(EVIDENCE_PATH)) return;
  const evidence = readJson(EVIDENCE_PATH, errors);
  if (!evidence) return;
  if (evidence.schemaVersion !== 'script-migration-evidence/v1') errors.push('evidence schemaVersion mismatch');
  if (evidence.waveId !== WAVE_ID) errors.push('evidence waveId mismatch');
  if (evidence.contractPath !== CONTRACT_PATH) errors.push('evidence contractPath mismatch');
  if (evidence.sourcePlanHash !== SOURCE_PLAN_HASH) errors.push('evidence sourcePlanHash mismatch');
  if (evidence.rootScriptsDeleted !== false) errors.push('evidence rootScriptsDeleted must be false');
  if (evidence.implementationMigrated !== false) errors.push('evidence implementationMigrated must be false');
  if (evidence.publicCliChanged !== false) errors.push('evidence publicCliChanged must be false');
  if (!Array.isArray(evidence.entries) || evidence.entries.length !== TARGETS.length) {
    errors.push('evidence entries must contain 25 rows');
  }
  if (!Array.isArray(evidence.commands)) errors.push('evidence commands must be an array');
  const commandIds = new Set((evidence.commands || []).map((row) => row.commandId));
  for (let index = 1; index <= 12; index += 1) {
    const commandId = `CMD-${String(index).padStart(2, '0')}`;
    if (!commandIds.has(commandId)) errors.push(`evidence missing ${commandId}`);
  }
  for (const row of evidence.commands || []) {
    if (typeof row.exitCode !== 'number') errors.push(`evidence ${row.commandId} missing numeric exitCode`);
    if (!String(row.stdoutHash || '').startsWith('sha256:')) {
      errors.push(`evidence ${row.commandId} stdoutHash missing sha256 prefix`);
    }
    if (!String(row.stderrHash || '').startsWith('sha256:')) {
      errors.push(`evidence ${row.commandId} stderrHash missing sha256 prefix`);
    }
    if (row.exitCode !== 0 && evidence.result === 'passed') {
      errors.push(`evidence result passed with failing ${row.commandId}`);
    }
  }
  const invById = new Map((inventory?.entries || []).map((entry) => [entry.entryId, entry]));
  for (const target of TARGETS) {
    const entry = evidence.entries?.find((candidate) => candidate.entryId === target.entryId);
    if (!entry) {
      errors.push(`evidence missing entry ${target.entryId}`);
      continue;
    }
    const inv = invById.get(target.entryId);
    if (entry.originalPath !== target.originalPath) errors.push(`evidence ${target.entryId} originalPath mismatch`);
    if (entry.deletionAllowed !== false) errors.push(`evidence ${target.entryId} deletionAllowed must be false`);
    if (inv) {
      if (entry.recommendedMigrationStrategy !== inv.recommendedMigrationStrategy) {
        errors.push(`evidence ${target.entryId} strategy mismatch`);
      }
      if (entry.consumerReachability !== inv.consumerReachability) {
        errors.push(`evidence ${target.entryId} consumerReachability mismatch`);
      }
    }
    if (!entry.evidenceRefs?.includes(INVENTORY_REF)) {
      errors.push(`evidence ${target.entryId} missing inventory evidence ref`);
    }
  }
}

function validateSummary(errors) {
  if (!fs.existsSync(SUMMARY_PATH)) return;
  const summary = fs.readFileSync(SUMMARY_PATH, 'utf8');
  for (const text of [
    'rootScriptsDeleted=false',
    'implementationMigrated=false',
    'No root script deletion was performed or approved.',
    'Recommended Next Implementation Wave Order',
  ]) {
    if (!summary.includes(text)) errors.push(`summary.md missing ${text}`);
  }
  for (const target of TARGETS) {
    if (!summary.includes(target.originalPath)) errors.push(`summary.md missing ${target.originalPath}`);
  }
}

function validateNoForbiddenDiff(errors) {
  const result = spawnSync('git', ['status', '--short', '--', 'scripts', 'packages/bmad-speckit/bin', 'packages/bmad-speckit/src/main-agent', 'packages/bmad-speckit/dist/main-agent'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    errors.push(`git status guard failed: ${result.stderr || result.stdout}`);
    return;
  }
  const lines = result.stdout.split(/\r?\n/u).filter(Boolean);
  for (const line of lines) {
    if (/^( D|D |R )\s+scripts[\\/]main-agent-/u.test(line)) {
      errors.push(`root main-agent script deletion/rename detected: ${line}`);
    }
    if (/^( M|M |A | A|D | D|R )\s+packages[\\/]bmad-speckit[\\/](bin|src[\\/]main-agent|dist[\\/]main-agent)[\\/]/u.test(line)) {
      errors.push(`Wave 3.2 package runtime implementation diff forbidden: ${line}`);
    }
  }
}

function validateAnalyzerCheck(errors) {
  const result = spawnSync(process.execPath, ['tools/script-migration/analyze-main-agent-wave-3-2.cjs', '--check'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) errors.push(`analyzer --check failed: ${result.stdout}${result.stderr}`);
}

function hashText(text) {
  return `sha256:${crypto.createHash('sha256').update(text || '', 'utf8').digest('hex')}`;
}

function previewText(text) {
  return String(text || '').slice(0, 1600);
}

function runEvidenceCommand(commandId, command, script, maxBuffer = 80 * 1024 * 1024) {
  const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer,
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const exitCode = typeof result.status === 'number' ? result.status : 1;
  process.stdout.write(
    `[${commandId}] exit=${exitCode} stdoutHash=${hashText(stdout)} stderrHash=${hashText(stderr)}\n`
  );
  if (exitCode !== 0) {
    process.stdout.write(stdout);
    process.stderr.write(stderr);
  }
  return {
    commandId,
    command,
    exitCode,
    stdoutHash: hashText(stdout),
    stderrHash: hashText(stderr),
    stdoutPreview: previewText(stdout),
    stderrPreview: previewText(stderr),
  };
}

function placeholderEvidenceCommand(commandId, command) {
  return {
    commandId,
    command,
    exitCode: 0,
    stdoutHash: hashText(''),
    stderrHash: hashText(''),
    stdoutPreview: '',
    stderrPreview: '',
  };
}

function buildEvidence(inventory, commands, validatedAt) {
  return {
    schemaVersion: 'script-migration-evidence/v1',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    sourcePlanHash: SOURCE_PLAN_HASH,
    validatedAt,
    entries: inventory.entries.map((entry) => ({
      entryId: entry.entryId,
      originalPath: entry.originalPath,
      recommendedMigrationStrategy: entry.recommendedMigrationStrategy,
      consumerReachability: entry.consumerReachability,
      targetPaths: entry.recommendedTargetPaths || [],
      commands: [],
      installMatrixEvidence: [],
      result: 'passed',
      deletionAllowed: false,
      deletionApprovalRef: null,
      evidenceRefs: [INVENTORY_REF, 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/classification-matrix.md'],
    })),
    commands,
    rootScriptsDeleted: false,
    implementationMigrated: false,
    publicCliChanged: false,
    result: commands.every((command) => command.exitCode === 0) ? 'passed' : 'failed',
  };
}

function writeEvidence(inventory, commands, validatedAt) {
  fs.mkdirSync(WAVE_DIR, { recursive: true });
  fs.writeFileSync(
    EVIDENCE_PATH,
    `${JSON.stringify(buildEvidence(inventory, commands, validatedAt), null, 2)}\n`,
    'utf8'
  );
}

function writeSummary(inventory) {
  const groups = new Map();
  for (const entry of inventory.entries) {
    const group = groups.get(entry.recommendedMigrationStrategy) || [];
    group.push(entry);
    groups.set(entry.recommendedMigrationStrategy, group);
  }
  const lines = [
    `# Script Migration Summary: ${WAVE_ID}`,
    '',
    '## Scope',
    '',
    `- rootMainAgentTotal=${inventory.rootMainAgentTotal}`,
    `- settledEntriesExcludedFromWave3.2=${inventory.settledEntriesExcludedFromWave3_2}`,
    `- wave3.2TargetEntries=${inventory.wave3_2TargetEntries}`,
    '- rootScriptsDeleted=false',
    '- implementationMigrated=false',
    '- publicCliChanged=false',
    '- No root script deletion was performed or approved.',
    '- No package CLI, package Main Agent source, or package Main Agent dist implementation migration was performed.',
    '',
    '## Classified Entries',
    '',
  ];
  for (const [strategy, entries] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    lines.push(`### ${strategy}`, '');
    for (const entry of entries) {
      const targets =
        entry.recommendedTargetPaths.length > 0 ? entry.recommendedTargetPaths.join(', ') : 'none';
      lines.push(
        `- ${entry.originalPath} -> ${targets}; reachability=${entry.consumerReachability}; deletion=not_allowed`
      );
    }
    lines.push('');
  }
  lines.push(
    '## Evidence',
    '',
    '- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/evidence.json',
    '- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/caller-inventory.json',
    '- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/classification-matrix.md',
    '',
    '## Recommended Next Implementation Wave Order',
    '',
    '1. Migrate entries with `consumer_runtime_reachable` because package runtime can directly reach them.',
    '2. Migrate entries with `installed_surface_reachable` after confirming generated consumer surfaces need executable runtime behavior.',
    '3. Keep `source_repo_only` entries retained as source-dev scripts unless a later wave proves consumer reachability.',
    '',
    '## Residual Risks',
    '',
    '- Wave 3.2 is a classification closure only; package runtime implementations are not migrated in this wave.',
    '- `source_repo_only` decisions are based on current static references and must be revisited if installed surfaces or CLI dispatch changes.',
    ''
  );
  fs.mkdirSync(WAVE_DIR, { recursive: true });
  fs.writeFileSync(SUMMARY_PATH, lines.join('\n'), 'utf8');
}

function writeEvidenceMode() {
  const validatedAt = new Date().toISOString();
  const commands = [];
  commands.push(
    runEvidenceCommand(
      'CMD-01',
      'pwsh.exe -NoLogo -NoProfile -Command "& { git status --short --branch }"',
      '& { git status --short --branch }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-02',
      'pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }"',
      '& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-03',
      'pwsh.exe -NoLogo -NoProfile -Command "& { <candidate set check> }"',
      '& { node -e "const fs=require(\'fs\');const files=fs.readdirSync(\'scripts\').filter((f)=>/^main-agent-.*\\.ts$/.test(f)).sort();const settled=new Set([\'main-agent-release-gate.ts\',\'main-agent-quality-gate.ts\',\'main-agent-delivery-truth-gate.ts\',\'main-agent-bmad-help-five-layer-matrix.ts\',\'main-agent-host-matrix-pr-orchestrator.ts\',\'main-agent-orchestration.ts\']);const target=files.filter((f)=>!settled.has(f));console.log(\'rootMainAgentTotal=\'+files.length);console.log(\'settledEntriesExcludedFromWave3.2=\'+settled.size);console.log(\'wave3.2TargetEntries=\'+target.length);console.log(target.map((f)=>\'scripts/\'+f).join(\'\\n\'));if(files.length!==31||settled.size!==6||target.length!==25)process.exit(1);" }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-04',
      'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/analyze-main-agent-wave-3-2.cjs --write; exit `$LASTEXITCODE }"',
      '& { node tools/script-migration/analyze-main-agent-wave-3-2.cjs --write; exit $LASTEXITCODE }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-05',
      'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-main-agent-wave-3-2.cjs; exit `$LASTEXITCODE }"',
      '& { node tools/script-migration/validate-main-agent-wave-3-2.cjs; exit $LASTEXITCODE }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-06',
      'pwsh.exe -NoLogo -NoProfile -Command "& { node tools/script-migration/validate-registry.cjs; exit `$LASTEXITCODE }"',
      '& { node tools/script-migration/validate-registry.cjs; exit $LASTEXITCODE }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-07',
      'pwsh.exe -NoLogo -NoProfile -Command "& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-2-contract.test.ts; exit `$LASTEXITCODE }"',
      '& { npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-2-contract.test.ts; exit $LASTEXITCODE }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-08',
      'pwsh.exe -NoLogo -NoProfile -Command "& { npm run test --prefix packages/bmad-speckit; exit `$LASTEXITCODE }"',
      '& { npm run test --prefix packages/bmad-speckit; exit $LASTEXITCODE }',
      160 * 1024 * 1024
    )
  );
  const inventory = readJson(INVENTORY_PATH, []);
  writeEvidence(
    inventory,
    [
      ...commands,
      placeholderEvidenceCommand(
        'CMD-09',
        'pwsh.exe -NoLogo -NoProfile -Command "& { <evidence receipt check> }"'
      ),
      placeholderEvidenceCommand(
        'CMD-10',
        'pwsh.exe -NoLogo -NoProfile -Command "& { <no deletion/no implementation migration check> }"'
      ),
      placeholderEvidenceCommand(
        'CMD-11',
        'pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit `$LASTEXITCODE }"'
      ),
      placeholderEvidenceCommand(
        'CMD-12',
        'pwsh.exe -NoLogo -NoProfile -Command "& { git status --short }"'
      ),
    ],
    validatedAt
  );
  writeSummary(inventory);
  commands.push(
    runEvidenceCommand(
      'CMD-09',
      'pwsh.exe -NoLogo -NoProfile -Command "& { <evidence receipt check> }"',
      "& { $e = Get-Content -Raw 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/evidence.json' | ConvertFrom-Json; if ($e.waveId -ne 'main-agent-runtime-migration-wave-3.2') { exit 1 }; if (@($e.entries).Count -ne 25) { exit 1 }; if ($e.rootScriptsDeleted -ne $false) { exit 1 }; if ($e.implementationMigrated -ne $false) { exit 1 }; exit 0 }"
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-10',
      'pwsh.exe -NoLogo -NoProfile -Command "& { <no deletion/no implementation migration check> }"',
      "& { $files = Get-ChildItem scripts -Filter 'main-agent-*.ts' | Select-Object -ExpandProperty Name; if (@($files).Count -ne 31) { Write-Error ('main-agent root script count mismatch: ' + @($files).Count); exit 1 }; $status = git status --short -- scripts packages/bmad-speckit/bin packages/bmad-speckit/src/main-agent packages/bmad-speckit/dist/main-agent; $status; if ($status | Select-String -Pattern '^( D|D |R )\\s+scripts[\\/]main-agent-') { exit 1 }; if ($status | Select-String -Pattern '^( M|M |A | A|D | D|R )\\s+packages[\\/]bmad-speckit[\\/](bin|src[\\/]main-agent|dist[\\/]main-agent)[\\/]') { exit 1 }; exit 0 }"
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-11',
      'pwsh.exe -NoLogo -NoProfile -Command "& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit `$LASTEXITCODE }"',
      '& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; exit $LASTEXITCODE }'
    )
  );
  commands.push(
    runEvidenceCommand(
      'CMD-12',
      'pwsh.exe -NoLogo -NoProfile -Command "& { git status --short }"',
      '& { git status --short }'
    )
  );
  writeEvidence(inventory, commands, validatedAt);
  writeSummary(inventory);
  const refresh = runEvidenceCommand(
    'REGISTRY-REFRESH',
    'node tools/script-migration/analyze-main-agent-wave-3-2.cjs --write',
    '& { node tools/script-migration/analyze-main-agent-wave-3-2.cjs --write; exit $LASTEXITCODE }'
  );
  if (commands.some((command) => command.exitCode !== 0) || refresh.exitCode !== 0) {
    process.exitCode = 1;
  }
}

function main() {
  const errors = [];
  validateCandidateSet(errors);
  const inventory = readJson(INVENTORY_PATH, errors);
  const registry = readYaml(REGISTRY_PATH, errors);
  validateInventory(inventory, errors);
  validateRegistry(registry, inventory, errors);
  validateMatrix(inventory, errors);
  validateEvidence(inventory, errors);
  validateSummary(errors);
  validateNoForbiddenDiff(errors);
  validateAnalyzerCheck(errors);
  const deletionAllowedCount =
    (inventory?.entries || []).filter((entry) => entry.deletionAllowed === true).length +
    (registry?.waves?.find((wave) => wave.waveId === WAVE_ID)?.entries || []).filter(
      (entry) => entry.deletionAllowed === true
    ).length;
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    waveId: WAVE_ID,
    targetEntries: TARGETS.length,
    deletionAllowedCount,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

if (process.argv.includes('--write-evidence')) {
  writeEvidenceMode();
} else {
  main();
}
