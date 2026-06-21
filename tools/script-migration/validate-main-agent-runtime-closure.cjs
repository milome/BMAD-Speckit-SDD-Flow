#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-closure-wave-3';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INVENTORY_PATH = path.join(WAVE_DIR, 'closure-inventory.json');
const PRIORITY_PATH = path.join(WAVE_DIR, 'priority-matrix.md');
const EVIDENCE_PATH = path.join(WAVE_DIR, 'evidence.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const CLI_PATH = path.join(ROOT, 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js');

const REQUIRED_TARGET_PATHS = [
  'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/closure-inventory.json',
  'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/priority-matrix.md',
  'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/evidence.json',
  'repo-governance/script-migrations/main-agent-runtime-closure-wave-3/summary.md',
  'tools/script-migration/validate-main-agent-runtime-closure.cjs',
  'tests/acceptance/main-agent-runtime-closure-wave-3-contract.test.ts',
];

const EXPECTED_PUBLIC_SEEDS = [
  ['bmad-speckit bmads-auto', 'scripts/bmads-auto-cli.ts'],
  [
    'bmad-speckit main-agent:bmad-help-five-layer-matrix',
    'scripts/main-agent-bmad-help-five-layer-matrix.ts',
  ],
  ['bmad-speckit main-agent:quality-gate', 'scripts/main-agent-quality-gate.ts'],
  [
    'bmad-speckit main-agent:host-matrix-pr-orchestrate',
    'scripts/main-agent-host-matrix-pr-orchestrator.ts',
  ],
  ['bmad-speckit main-agent:release-gate', 'scripts/main-agent-release-gate.ts'],
  [
    'bmad-speckit main-agent:delivery-truth-gate',
    'scripts/main-agent-delivery-truth-gate.ts',
  ],
  ['bmad-speckit write-runtime-context', 'scripts/write-runtime-context.cjs'],
  ['bmad-speckit run-auditor-host', 'scripts/run-auditor-host.ts'],
  ['bmad-speckit eval-questions', 'scripts/eval-questions-cli.ts'],
];

const CLASSIFICATIONS = new Set([
  'consumer_runtime_public_cli',
  'consumer_runtime_compat_cli',
  'package_runtime_fallback',
  'validated_wave_2_retained_source_dev_only',
  'source_dev_only',
  'repo_maintenance',
  'ci_release_gate',
  'test_fixture_or_helper',
  'durable_helper_candidate',
  'skill_local_helper_candidate',
  'auditor_runtime_candidate',
  'public_cli_de_surface_candidate',
  'deprecated_public_cli_de_surface_candidate',
  'deprecated_no_migration',
  'unknown_requires_followup',
]);

const PRIORITY_RANGES = {
  P0: [90, 100],
  P1: [75, 89],
  P2: [60, 74],
  P3: [45, 59],
  P4: [25, 44],
  P5: [0, 24],
};

const TARGET_WAVES = new Set([
  'main-agent-runtime-migration-wave-3.1',
  'later_wave',
  'none_source_dev_only',
  'none_repo_maintenance',
  'none_test_only',
  'none_deprecated',
  'blocked_requires_followup',
]);

const REQUIRED_INVENTORY_FIELDS = [
  'schemaVersion',
  'waveId',
  'generatedAt',
  'inputs',
  'publicRunRepoScriptSeeds',
  'changedScriptsBaseline',
  'closureEntries',
  'unclassifiedEntries',
  'nextWaveCandidates',
];

const REQUIRED_CLOSURE_FIELDS = [
  'scriptPath',
  'classification',
  'priorityBand',
  'priorityScore',
  'migrationStrategy',
  'consumerReachability',
  'callers',
  'installSurfaces',
  'packageCliCommands',
  'registryStatus',
  'targetWave',
  'deletionAllowed',
  'evidenceRefs',
];

const REQUIRED_UNCLASSIFIED_FIELDS = [
  'scriptPath',
  'blockingReason',
  'requiredEvidence',
  'stopCondition',
];

const REQUIRED_CANDIDATE_FIELDS = [
  'candidateId',
  'scriptPath',
  'priorityBand',
  'migrationStrategy',
  'reason',
  'blockedBy',
  'deletionAllowed',
];

const POST_WAVE_ALLOWED_SCRIPT_CHANGES = new Map([
  [
    'scripts/prepublish-check.js',
    {
      allowedStatuses: new Set(['M']),
      reason: 'repo maintenance prepublish gate may evolve after the frozen Wave 3 inventory',
    },
  ],
  [
    'scripts/check-goal-contract-release-gate.js',
    {
      allowedStatuses: new Set(['A']),
      replacementPath: 'packages/bmad-speckit/src/utils/goal-contract/release-gate.js',
      reason: 'post-wave root helper migrated into package runtime before release',
    },
  ],
  [
    'scripts/generate-codex-agents-from-claude.js',
    {
      allowedStatuses: new Set(['M']),
      replacementPath: 'packages/bmad-speckit/src/main-agent/helpers/generate-codex-agents-from-claude.js',
      reason: 'post-wave helper is covered by the Wave 3.12 migration registry and evidence ledger',
    },
  ],
]);

const POST_WAVE_ALLOWED_WORKTREE_DELETIONS = new Map([
  [
    'scripts/check-goal-contract-release-gate.js',
    {
      replacementPath: 'packages/bmad-speckit/src/utils/goal-contract/release-gate.js',
      reason: 'post-wave root helper migrated into package runtime before release',
    },
  ],
]);

const hasOwn = (object, field) => Object.prototype.hasOwnProperty.call(object, field);
const toRepoPath = (filePath) => path.relative(ROOT, filePath).replace(/\\/g, '/');

function readJson(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${toRepoPath(filePath)}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON ${toRepoPath(filePath)}: ${error.message}`);
    return null;
  }
}

function readYaml(filePath, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`missing file: ${toRepoPath(filePath)}`);
    return null;
  }
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`invalid YAML ${toRepoPath(filePath)}: ${error.message}`);
    return null;
  }
}

function requireFields(object, fields, label, errors) {
  if (!object || typeof object !== 'object') {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const field of fields) {
    if (!hasOwn(object, field)) errors.push(`${label} missing ${field}`);
  }
}

function normalizeScript(scriptName) {
  return scriptName.startsWith('scripts/') ? scriptName : `scripts/${scriptName}`;
}

function directRunRepoScriptSeeds() {
  const source = fs.readFileSync(CLI_PATH, 'utf8');
  const seeds = [];
  const lines = source.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*runRepoScript\('([^']+)'/u);
    if (match) {
      seeds.push({
        dispatchLine: index + 1,
        scriptPath: normalizeScript(match[1]),
        currentDispatch: lines[index].trim(),
      });
    }
  }
  return seeds;
}

function changedScriptsFromGit(errors) {
  const result = spawnSync(
    'git',
    ['diff', '--name-status', '335f2c402010f2f912488d61575b5ce0c090513a..HEAD', '--', 'scripts'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    errors.push(`git changed scripts scan failed: ${result.stderr || result.stdout}`);
    return [];
  }
  return result.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [status, scriptPath] = line.split(/\s+/u);
      return { status, scriptPath: scriptPath.replace(/\\/g, '/') };
    });
}

function isAllowedPostWaveScriptChange(row) {
  const allowance = POST_WAVE_ALLOWED_SCRIPT_CHANGES.get(row.scriptPath);
  if (!allowance) return false;
  if (!allowance.allowedStatuses.has(row.status)) return false;
  if (allowance.replacementPath && !fs.existsSync(path.join(ROOT, allowance.replacementPath))) {
    return false;
  }
  return true;
}

function isAllowedPostWaveWorktreeDeletion(line) {
  const trimmed = line.trim();
  let scriptPath = null;
  const deleted = trimmed.match(/^D\s+(scripts[\\/]\S+)/u);
  if (deleted) {
    scriptPath = deleted[1].replace(/\\/g, '/');
  } else {
    const renamed = trimmed.match(/^R\d*\s+(scripts[\\/]\S+)(?:\s+->\s+|\s+)(\S+)/u);
    scriptPath = renamed?.[1]?.replace(/\\/g, '/') || null;
  }
  const allowance = scriptPath ? POST_WAVE_ALLOWED_WORKTREE_DELETIONS.get(scriptPath) : null;
  if (!allowance) return false;
  return fs.existsSync(path.join(ROOT, allowance.replacementPath));
}

function validateInventory(inventory, registry, errors) {
  requireFields(inventory, REQUIRED_INVENTORY_FIELDS, 'closure-inventory.json', errors);
  if (!inventory) return;
  if (inventory.schemaVersion !== 'main-agent-runtime-closure-inventory/v1') {
    errors.push('closure-inventory.json schemaVersion mismatch');
  }
  if (inventory.waveId !== WAVE_ID) errors.push('closure-inventory.json waveId mismatch');
  for (const field of [
    'publicRunRepoScriptSeeds',
    'closureEntries',
    'unclassifiedEntries',
    'nextWaveCandidates',
  ]) {
    if (!Array.isArray(inventory[field])) errors.push(`closure-inventory.json ${field} must be an array`);
  }

  validatePublicSeeds(inventory, errors);
  validateChangedScriptsBaseline(inventory, errors);
  validateClosureEntries(inventory, registry, errors);
  validatePriority(inventory, errors);
}

function validatePublicSeeds(inventory, errors) {
  const directSeeds = directRunRepoScriptSeeds();
  const inventorySeeds = inventory.publicRunRepoScriptSeeds || [];
  if (inventorySeeds.length !== 9) {
    errors.push(`publicRunRepoScriptSeeds must contain 9 entries, got ${inventorySeeds.length}`);
  }
  const expectedScriptSet = new Set(EXPECTED_PUBLIC_SEEDS.map(([, scriptPath]) => scriptPath));
  const actualScriptSet = new Set(inventorySeeds.map((seed) => seed.scriptPath));
  for (const [publicCommand, scriptPath] of EXPECTED_PUBLIC_SEEDS) {
    const seed = inventorySeeds.find(
      (candidate) => candidate.publicCommand === publicCommand && candidate.scriptPath === scriptPath
    );
    if (!seed) errors.push(`missing public seed ${publicCommand} -> ${scriptPath}`);
  }
  for (const seed of directSeeds) {
    if (!expectedScriptSet.has(seed.scriptPath)) {
      errors.push(`unexpected direct runRepoScript seed in CLI: ${seed.scriptPath}`);
    }
    if (!actualScriptSet.has(seed.scriptPath)) {
      errors.push(`direct runRepoScript seed absent from inventory: ${seed.scriptPath}`);
    }
  }
}

function validateChangedScriptsBaseline(inventory, errors) {
  const baseline = inventory.changedScriptsBaseline || {};
  if (baseline.baselineCommit !== '335f2c402010f2f912488d61575b5ce0c090513a') {
    errors.push('changedScriptsBaseline.baselineCommit mismatch');
  }
  if (baseline.expectedCountFromPriorMatrix !== 140) {
    errors.push('changedScriptsBaseline.expectedCountFromPriorMatrix must be 140');
  }
  const changed = changedScriptsFromGit(errors);
  const represented = new Set([
    ...(inventory.closureEntries || []).map((entry) => entry.scriptPath),
    ...(inventory.unclassifiedEntries || []).map((entry) => entry.scriptPath),
  ]);
  const representedChanged = changed.filter((row) => represented.has(row.scriptPath));
  const unrepresentedChanged = changed.filter(
    (row) => !represented.has(row.scriptPath) && !isAllowedPostWaveScriptChange(row)
  );
  if (baseline.actualCountFromCommand !== representedChanged.length) {
    errors.push(
      `changedScriptsBaseline.actualCountFromCommand must be ${representedChanged.length}, got ${baseline.actualCountFromCommand}`
    );
  }
  if (baseline.countStatus !== (representedChanged.length === 140 ? 'matches_prior_matrix' : 'baseline_drift')) {
    errors.push('changedScriptsBaseline.countStatus mismatch');
  }
  for (const row of unrepresentedChanged) {
    errors.push(`changed script absent from closureEntries and unclassifiedEntries: ${row.scriptPath}`);
  }
}

function validateClosureEntries(inventory, registry, errors) {
  const allowedStrategies = new Set(registry?.allowedMigrationStrategies || []);
  const entries = inventory.closureEntries || [];
  const entriesByPath = new Map(entries.map((entry) => [entry.scriptPath, entry]));
  for (const entry of entries) {
    requireFields(entry, REQUIRED_CLOSURE_FIELDS, `closure entry ${entry.scriptPath || '<unknown>'}`, errors);
    if (!CLASSIFICATIONS.has(entry.classification)) {
      errors.push(`invalid classification for ${entry.scriptPath}: ${entry.classification}`);
    }
    if (!allowedStrategies.has(entry.migrationStrategy)) {
      errors.push(`invalid migrationStrategy for ${entry.scriptPath}: ${entry.migrationStrategy}`);
    }
    if (!Object.prototype.hasOwnProperty.call(PRIORITY_RANGES, entry.priorityBand)) {
      errors.push(`invalid priorityBand for ${entry.scriptPath}: ${entry.priorityBand}`);
    } else {
      const [min, max] = PRIORITY_RANGES[entry.priorityBand];
      if (!Number.isInteger(entry.priorityScore) || entry.priorityScore < min || entry.priorityScore > max) {
        errors.push(`priorityScore out of ${entry.priorityBand} range for ${entry.scriptPath}`);
      }
    }
    if (!TARGET_WAVES.has(entry.targetWave)) {
      errors.push(`invalid targetWave for ${entry.scriptPath}: ${entry.targetWave}`);
    }
    if (entry.deletionAllowed !== false) errors.push(`deletionAllowed must be false for ${entry.scriptPath}`);
    for (const field of ['callers', 'installSurfaces', 'packageCliCommands', 'evidenceRefs']) {
      if (!Array.isArray(entry[field])) errors.push(`${entry.scriptPath}.${field} must be an array`);
    }
    validateStrategyShape(entry, errors);
  }
  validateSpecificClassifications(entriesByPath, errors);
  for (const entry of inventory.unclassifiedEntries || []) {
    requireFields(entry, REQUIRED_UNCLASSIFIED_FIELDS, `unclassified entry ${entry.scriptPath || '<unknown>'}`, errors);
    if (!Array.isArray(entry.requiredEvidence)) {
      errors.push(`unclassified entry requiredEvidence must be an array for ${entry.scriptPath}`);
    }
  }
}

function validateStrategyShape(entry, errors) {
  if (
    entry.classification === 'consumer_runtime_public_cli' &&
    entry.migrationStrategy !== 'package_runtime_module'
  ) {
    errors.push(`consumer public runtime must use package_runtime_module for ${entry.scriptPath}`);
  }
  if (
    entry.classification === 'durable_helper_candidate' &&
    entry.migrationStrategy !== 'durable_helper_copy'
  ) {
    errors.push(`consumer-installed helper must use durable_helper_copy for ${entry.scriptPath}`);
  }
  if (
    entry.classification === 'skill_local_helper_candidate' &&
    entry.migrationStrategy !== 'skill_local_helper'
  ) {
    errors.push(`skill local helper must use skill_local_helper for ${entry.scriptPath}`);
  }
  if (
    entry.classification === 'deprecated_public_cli_de_surface_candidate' &&
    !['public_cli_de_surface', 'deprecated_no_migration'].includes(entry.migrationStrategy)
  ) {
    errors.push(`deprecated public CLI must de-surface or skip migration for ${entry.scriptPath}`);
  }
}

function validateSpecificClassifications(entriesByPath, errors) {
  const expectClass = (scriptPath, allowed) => {
    const entry = entriesByPath.get(scriptPath);
    if (!entry) {
      errors.push(`missing closure entry for ${scriptPath}`);
      return null;
    }
    if (!allowed.includes(entry.classification)) {
      errors.push(`${scriptPath} classification must be ${allowed.join(' or ')}, got ${entry.classification}`);
    }
    return entry;
  };
  expectClass('scripts/bmads-auto-cli.ts', ['deprecated_public_cli_de_surface_candidate']);
  expectClass('scripts/main-agent-bmad-help-five-layer-matrix.ts', [
    'consumer_runtime_public_cli',
    'public_cli_de_surface_candidate',
  ]);
  expectClass('scripts/main-agent-quality-gate.ts', ['consumer_runtime_public_cli']);
  expectClass('scripts/main-agent-host-matrix-pr-orchestrator.ts', [
    'consumer_runtime_public_cli',
    'public_cli_de_surface_candidate',
  ]);
  expectClass('scripts/main-agent-release-gate.ts', ['consumer_runtime_public_cli']);
  expectClass('scripts/main-agent-delivery-truth-gate.ts', ['consumer_runtime_public_cli']);
  expectClass('scripts/write-runtime-context.cjs', [
    'consumer_runtime_public_cli',
    'durable_helper_candidate',
  ]);
  expectClass('scripts/run-auditor-host.ts', [
    'consumer_runtime_public_cli',
    'auditor_runtime_candidate',
  ]);
  expectClass('scripts/eval-questions-cli.ts', [
    'consumer_runtime_public_cli',
    'public_cli_de_surface_candidate',
  ]);
  const orchestration = expectClass('scripts/main-agent-orchestration.ts', [
    'validated_wave_2_retained_source_dev_only',
  ]);
  if (orchestration && orchestration.deletionAllowed !== false) {
    errors.push('scripts/main-agent-orchestration.ts must not be selected for deletion');
  }
}

function validatePriority(inventory, errors) {
  const entries = inventory.closureEntries || [];
  const candidates = inventory.nextWaveCandidates || [];
  for (const candidate of candidates) {
    requireFields(candidate, REQUIRED_CANDIDATE_FIELDS, `nextWaveCandidate ${candidate.scriptPath || '<unknown>'}`, errors);
    if (candidate.deletionAllowed !== false) {
      errors.push(`nextWaveCandidate deletionAllowed must be false for ${candidate.scriptPath}`);
    }
  }
  if (candidates.length > 12) errors.push(`nextWaveCandidates must contain no more than 12 items, got ${candidates.length}`);
  const candidatePaths = new Set(candidates.map((candidate) => candidate.scriptPath));
  const unblockedP0 = entries.filter(
    (entry) => entry.priorityBand === 'P0' && entry.targetWave !== 'blocked_requires_followup'
  );
  for (const entry of unblockedP0) {
    if (!candidatePaths.has(entry.scriptPath)) {
      errors.push(`unblocked P0 missing from nextWaveCandidates: ${entry.scriptPath}`);
    }
  }
  const priorityText = fs.existsSync(PRIORITY_PATH) ? fs.readFileSync(PRIORITY_PATH, 'utf8') : '';
  for (const section of ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'Wave 3.1 Candidate Set', 'No Deletion Approval']) {
    if (!priorityText.includes(`## ${section}`)) errors.push(`priority-matrix.md missing section ${section}`);
  }
  for (const candidate of candidates) {
    if (!priorityText.includes(candidate.scriptPath)) {
      errors.push(`priority-matrix.md missing candidate ${candidate.scriptPath}`);
    }
  }
}

function validateRegistry(registry, evidence, errors) {
  if (!registry || !Array.isArray(registry.waves)) {
    errors.push('registry waves missing');
    return;
  }
  const wave = registry.waves.find((candidate) => candidate.waveId === WAVE_ID);
  if (!wave) {
    errors.push(`registry missing waveId: ${WAVE_ID}`);
    return;
  }
  if (wave.contractPath !== 'docs/plans/2026-06-03-main-agent-runtime-closure-wave-3-goal-execution-plan.md') {
    errors.push('Wave 3 registry contractPath mismatch');
  }
  const entry = (wave.entries || []).find(
    (candidate) => candidate.entryId === 'main-agent-runtime-closure-inventory'
  );
  if (!entry) {
    errors.push('Wave 3 registry missing main-agent-runtime-closure-inventory entry');
    return;
  }
  if (entry.originalPath !== 'docs/plans/SCRIPT_MATRIX_2026-06-01-consumer-deployment-and-invocation.md') {
    errors.push('Wave 3 registry originalPath mismatch');
  }
  if (entry.originalClassBeforeMigration !== 'source_repo_governance') {
    errors.push('Wave 3 registry originalClassBeforeMigration mismatch');
  }
  if (entry.migrationStrategy !== 'repo_internal_reclassify') {
    errors.push('Wave 3 registry migrationStrategy must be repo_internal_reclassify');
  }
  if (entry.oldPathDisposition !== 'retained_source_repo_governance') {
    errors.push('Wave 3 registry oldPathDisposition mismatch');
  }
  if (entry.deletionAllowed !== false || entry.deletionApprovalRef !== null) {
    errors.push('Wave 3 registry must not approve deletion');
  }
  for (const targetPath of REQUIRED_TARGET_PATHS) {
    if (!entry.targetPaths?.includes(targetPath)) {
      errors.push(`Wave 3 registry targetPaths missing ${targetPath}`);
    }
  }
  if (!entry.evidenceRefs?.includes(REQUIRED_TARGET_PATHS[2])) {
    errors.push('Wave 3 registry evidenceRefs missing evidence.json');
  }
  if (evidence?.entries?.some((evidenceEntry) => evidenceEntry.result === 'passed')) {
    if (wave.status !== 'validated') errors.push('Wave 3 registry wave must be validated after passed evidence');
    if (entry.migrationStatus !== 'validated') {
      errors.push('Wave 3 registry entry migrationStatus must be validated after passed evidence');
    }
    if (entry.validationStatus !== 'passed') {
      errors.push('Wave 3 registry entry validationStatus must be passed after passed evidence');
    }
  }
}

function validateEvidence(evidence, errors) {
  requireFields(evidence, ['waveId', 'validatedAt', 'entries'], 'evidence.json', errors);
  if (!evidence) return;
  if (evidence.waveId !== WAVE_ID) errors.push('evidence.json waveId mismatch');
  const entry = (evidence.entries || []).find(
    (candidate) => candidate.entryId === 'main-agent-runtime-closure-inventory'
  );
  if (!entry) {
    errors.push('evidence.json missing main-agent-runtime-closure-inventory entry');
    return;
  }
  requireFields(
    entry,
    ['entryId', 'originalPath', 'targetPaths', 'commands', 'installMatrixEvidence', 'result'],
    'evidence main-agent-runtime-closure-inventory',
    errors
  );
  if (entry.originalPath !== 'docs/plans/SCRIPT_MATRIX_2026-06-01-consumer-deployment-and-invocation.md') {
    errors.push('evidence entry originalPath mismatch');
  }
  for (const targetPath of REQUIRED_TARGET_PATHS) {
    if (!entry.targetPaths?.includes(targetPath)) errors.push(`evidence targetPaths missing ${targetPath}`);
  }
  if (entry.result === 'passed') {
    const requiredCommands = ['CMD-03', 'CMD-04', 'CMD-05', 'CMD-06', 'CMD-08', 'CMD-09'];
    for (const commandId of requiredCommands) {
      const row = entry.commands?.find((candidate) => String(candidate.command).includes(commandId));
      if (!row) {
        errors.push(`evidence commands missing ${commandId}`);
        continue;
      }
      if (row.exitCode !== 0) {
        errors.push(`passed evidence contains non-zero exitCode for ${commandId}: ${row.exitCode}`);
      }
    }
  }
  for (const row of entry.commands || []) {
    for (const field of ['command', 'exitCode', 'stdoutHash', 'stderrHash']) {
      if (!hasOwn(row, field)) errors.push(`evidence command row missing ${field}`);
    }
    if (row.exitCode === 0) {
      if (!String(row.stdoutHash || '').startsWith('sha256:')) {
        errors.push(`evidence ${row.command} stdoutHash missing sha256 prefix`);
      }
      if (!String(row.stderrHash || '').startsWith('sha256:')) {
        errors.push(`evidence ${row.command} stderrHash missing sha256 prefix`);
      }
    }
    const commandText = String(row.command || '');
    const combinedPreview = `${row.stdoutPreview || ''}\n${row.stderrPreview || ''}`;
    if (
      row.exitCode === 0 &&
      (commandText.includes('CMD-08') || commandText.includes('CMD-09')) &&
      /\b(failed tests?|AssertionError|Received:|expected .+ to be)\b/i.test(combinedPreview)
    ) {
      errors.push(`passed evidence contains stale failure output for ${commandText.slice(0, 64)}`);
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
    'No runtime migration was performed in Wave 3',
    'No public CLI dispatch was changed in Wave 3',
    'No root scripts deletion was performed or approved in Wave 3',
  ]) {
    if (!summary.includes(text)) errors.push(`summary.md missing required statement: ${text}`);
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
    if (!fs.existsSync(root)) continue;
    for (const filePath of walkFiles(root)) {
      if (!/\.(cjs|mjs|js|json)$/u.test(filePath)) continue;
      const text = fs.readFileSync(filePath, 'utf8');
      if (text.includes('repo-governance')) offenders.push(toRepoPath(filePath));
    }
  }
  if (offenders.length > 0) {
    errors.push(`package consumer runtime references repo-governance: ${offenders.join(', ')}`);
  }
}

function walkFiles(root) {
  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function validateNoScriptDeletion(errors) {
  const result = spawnSync('git', ['status', '--short'], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    errors.push(`git status failed: ${result.stderr || result.stdout}`);
    return;
  }
  const deletedScripts = result.stdout
    .split(/\r?\n/u)
    .filter((line) => /^ ?D\s+scripts[\\/]/u.test(line) || /^R.+scripts[\\/]/u.test(line))
    .filter((line) => !isAllowedPostWaveWorktreeDeletion(line));
  if (deletedScripts.length > 0) {
    errors.push(`root scripts deletion or rename detected: ${deletedScripts.join('; ')}`);
  }
}

function main() {
  const errors = [];
  const inventory = readJson(INVENTORY_PATH, errors);
  const evidence = readJson(EVIDENCE_PATH, errors);
  const registry = readYaml(REGISTRY_PATH, errors);

  validateInventory(inventory, registry, errors);
  validateRegistry(registry, evidence, errors);
  validateEvidence(evidence, errors);
  validateSummary(errors);
  validateNoRepoGovernanceRuntimeDependency(errors);
  validateNoScriptDeletion(errors);

  const result = {
    status: errors.length === 0 ? 'passed' : 'failed',
    waveId: WAVE_ID,
    inventoryPath: toRepoPath(INVENTORY_PATH),
    errors,
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
