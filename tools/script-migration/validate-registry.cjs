#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_REGISTRY = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const PACKAGE_ROOT = path.join(ROOT, 'packages', 'bmad-speckit');

const STRATEGIES = ['package_runtime_module', 'runtime_emit_cjs', 'durable_helper_copy', 'skill_local_helper', 'test_helper_move', 'repo_internal_reclassify', 'public_cli_de_surface', 'compatibility_alias', 'deprecated_no_migration'];
const MIGRATION_STATUSES = ['planned', 'in_progress', 'migrated', 'caller_switched', 'validated', 'blocked', 'superseded'];
const VALIDATION_STATUSES = ['pending', 'partial', 'passed', 'failed', 'blocked'];
const WAVE_STATUSES = ['planned', 'in_progress', 'validated', 'blocked', 'superseded'];
const ACTIVE_WAVE_STATUSES = new Set(['planned', 'in_progress', 'validated']);

const REQUIRED_WAVE_FIELDS = ['waveId', 'title', 'contractPath', 'status', 'startedAt', 'completedAt', 'entries'];
const REQUIRED_ENTRY_FIELDS = ['entryId', 'originalPath', 'originalPathStatus', 'originalClassBeforeMigration', 'migrationStrategy', 'migrationStatus', 'targetPaths', 'publicCommandsBeforeMigration', 'publicCommandsAfterMigration', 'callerSwitchStatus', 'validationStatus', 'evidenceRefs', 'oldPathDisposition', 'deletionAllowed', 'deletionApprovalRef'];

function parseArgs(argv) {
  const options = { registryPath: DEFAULT_REGISTRY, checkPackExclusion: false, packListFixture: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--registry') {
      options.registryPath = path.resolve(argv[++index] || '');
    } else if (arg === '--check-pack-exclusion') {
      options.checkPackExclusion = true;
    } else if (arg === '--pack-list-fixture') {
      options.packListFixture = path.resolve(argv[++index] || '');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

function relativeToRoot(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function readRegistry(registryPath, errors) {
  if (!fs.existsSync(registryPath)) {
    errors.push(`registry missing: ${relativeToRoot(registryPath)}`);
    return null;
  }
  if (registryPath.split(path.sep).includes('_bmad')) {
    errors.push(`script-migration-registry.yaml must not be under _bmad: ${registryPath}`);
  }
  try {
    return yaml.load(fs.readFileSync(registryPath, 'utf8'));
  } catch (error) {
    errors.push(`failed to parse registry YAML: ${error.message}`);
    return null;
  }
}

function expectExactArray(actual, expected, name, errors) {
  if (!Array.isArray(actual)) {
    errors.push(`${name} must be an array`);
    return;
  }
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    errors.push(`${name} must exactly match ${expected.join(', ')}`);
  }
}

const hasOwn = (object, field) => Object.prototype.hasOwnProperty.call(object, field);

function validateEvidenceFile(evidencePath, errors) {
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  for (const field of ['waveId', 'validatedAt', 'entries']) {
    if (!hasOwn(evidence, field)) errors.push(`${relativeToRoot(evidencePath)} missing ${field}`);
  }
  if (!Array.isArray(evidence.entries)) {
    errors.push(`${relativeToRoot(evidencePath)} entries must be an array`);
    return;
  }
  for (const entry of evidence.entries) {
    for (const field of ['entryId', 'originalPath', 'targetPaths', 'commands', 'installMatrixEvidence', 'result']) {
      if (!hasOwn(entry, field)) errors.push(`${relativeToRoot(evidencePath)} entry missing ${field}`);
    }
    if (!Array.isArray(entry.commands)) {
      errors.push(`${relativeToRoot(evidencePath)} commands must be an array`);
      continue;
    }
    for (const row of entry.commands) {
      for (const field of ['command', 'exitCode', 'stdoutHash', 'stderrHash']) {
        if (!hasOwn(row, field)) errors.push(`${relativeToRoot(evidencePath)} command row missing ${field}`);
      }
      if (row.exitCode === 0) {
        if (!String(row.stdoutHash || '').startsWith('sha256:')) errors.push(`${row.command} stdoutHash missing sha256 prefix`);
        if (!String(row.stderrHash || '').startsWith('sha256:')) errors.push(`${row.command} stderrHash missing sha256 prefix`);
      }
    }
    if (entry.result === 'passed' && entry.commands.some((row) => row.exitCode !== 0)) {
      errors.push(`${relativeToRoot(evidencePath)} passed entry has failing command rows`);
    }
  }
}

function validateRegistry(registry, errors) {
  if (!registry || typeof registry !== 'object') return;
  if (registry.registryKind !== 'source_repo_script_migration_registry') errors.push('registryKind must be source_repo_script_migration_registry');
  if (registry.installSurface !== 'excluded') errors.push('installSurface must be excluded');
  if (registry.consumerRuntimeDependency !== false) errors.push('consumerRuntimeDependency must be false');
  if (registry.registryVersion !== 1) errors.push('registryVersion must be 1');
  expectExactArray(registry.allowedMigrationStrategies, STRATEGIES, 'allowedMigrationStrategies', errors);
  expectExactArray(registry.allowedMigrationStatuses, MIGRATION_STATUSES, 'allowedMigrationStatuses', errors);
  expectExactArray(registry.allowedValidationStatuses, VALIDATION_STATUSES, 'allowedValidationStatuses', errors);
  if (!Array.isArray(registry.waves) || registry.waves.length === 0) {
    errors.push('waves must be a non-empty array');
    return;
  }

  const waveIds = new Set();
  const activeOriginalPaths = new Map();
  for (const wave of registry.waves) {
    for (const field of REQUIRED_WAVE_FIELDS) {
      if (!hasOwn(wave, field)) errors.push(`wave missing ${field}`);
    }
    if (waveIds.has(wave.waveId)) errors.push(`duplicate waveId: ${wave.waveId}`);
    waveIds.add(wave.waveId);
    if (wave.refinesWaveId != null && !waveIds.has(wave.refinesWaveId)) {
      errors.push(`wave ${wave.waveId} refines unknown or later waveId: ${wave.refinesWaveId}`);
    }
    if (!WAVE_STATUSES.includes(wave.status)) errors.push(`invalid wave status for ${wave.waveId}: ${wave.status}`);
    if (!Array.isArray(wave.entries)) {
      errors.push(`wave ${wave.waveId} entries must be an array`);
      continue;
    }
    const entryIds = new Set();
    for (const entry of wave.entries) {
      validateEntry(wave, entry, entryIds, activeOriginalPaths, errors);
    }
  }
  validateBootstrapContent(registry, errors);
}

function validateEntry(wave, entry, entryIds, activeOriginalPaths, errors) {
  for (const field of REQUIRED_ENTRY_FIELDS) {
    if (!hasOwn(entry, field)) errors.push(`entry ${entry.entryId || '<unknown>'} missing ${field}`);
  }
  if (entryIds.has(entry.entryId)) errors.push(`duplicate entryId in ${wave.waveId}: ${entry.entryId}`);
  entryIds.add(entry.entryId);
  for (const field of ['targetPaths', 'publicCommandsBeforeMigration', 'publicCommandsAfterMigration', 'evidenceRefs']) {
    if (!Array.isArray(entry[field])) errors.push(`${entry.entryId}.${field} must be an array`);
  }
  if (!STRATEGIES.includes(entry.migrationStrategy)) errors.push(`invalid migrationStrategy for ${entry.entryId}: ${entry.migrationStrategy}`);
  if (!MIGRATION_STATUSES.includes(entry.migrationStatus)) errors.push(`invalid migrationStatus for ${entry.entryId}: ${entry.migrationStatus}`);
  if (!VALIDATION_STATUSES.includes(entry.validationStatus)) errors.push(`invalid validationStatus for ${entry.entryId}: ${entry.validationStatus}`);
  if (entry.originalPathStatus !== 'deleted_after_approval' && !fs.existsSync(path.join(ROOT, entry.originalPath || ''))) {
    errors.push(`originalPath missing for ${entry.entryId}: ${entry.originalPath}`);
  }
  if (entry.deletionAllowed === true && entry.deletionApprovalRef == null) {
    errors.push(`deletionApprovalRef is required when deletionAllowed is true for ${entry.entryId}`);
  }
  if (entry.migrationStrategy === 'package_runtime_module' && !entry.targetPaths.some((target) => target.startsWith('packages/bmad-speckit/src/'))) {
    errors.push(`package_runtime_module targetPaths must include packages/bmad-speckit/src/ for ${entry.entryId}`);
  }
  for (const command of entry.publicCommandsAfterMigration || []) {
    if (/scripts\/|\.ts\b|tsx|ts-node/.test(command)) errors.push(`publicCommandsAfterMigration is not package runtime safe for ${entry.entryId}: ${command}`);
  }
  if ((entry.migrationStatus === 'validated' || entry.validationStatus === 'passed') && !entry.evidenceRefs.some((ref) => fs.existsSync(path.join(ROOT, ref)))) {
    errors.push(`validated or passed entry lacks existing evidenceRefs for ${entry.entryId}`);
  }
  for (const ref of entry.evidenceRefs || []) {
    const evidencePath = path.join(ROOT, ref);
    if (fs.existsSync(evidencePath)) validateEvidenceFile(evidencePath, errors);
  }
  if (ACTIVE_WAVE_STATUSES.has(wave.status)) {
    const targets = JSON.stringify(entry.targetPaths || []);
    const previous = activeOriginalPaths.get(entry.originalPath);
    if (previous && previous.targets !== targets) {
      const explicitlyRefinesPrevious =
        wave.refinesWaveId === previous.waveId && entry.deletionAllowed === false;
      if (!explicitlyRefinesPrevious) {
        errors.push(`conflicting active migration targetPaths for ${entry.originalPath}`);
      }
    }
    activeOriginalPaths.set(entry.originalPath, {
      targets,
      waveId: wave.waveId,
    });
  }
}

function validateBootstrapContent(registry, errors) {
  const bootstrap = registry.waves.find((wave) => wave.waveId === 'script-migration-registry-bootstrap');
  const mainAgent = registry.waves.find((wave) => wave.waveId === 'main-agent-migration-wave-1');
  const mainAgentWave2 = registry.waves.find((wave) => wave.waveId === 'main-agent-source-authority-wave-2');
  if (!bootstrap) errors.push('missing script-migration-registry-bootstrap wave');
  if (!mainAgent) errors.push('missing main-agent-migration-wave-1 wave');
  if (!mainAgentWave2) errors.push('missing main-agent-source-authority-wave-2 wave');
  const registryEntry = bootstrap && bootstrap.entries.find((entry) => entry.entryId === 'script-migration-registry');
  const mainEntry = mainAgent && mainAgent.entries.find((entry) => entry.entryId === 'main-agent-orchestration');
  const mainWave2Entry =
    mainAgentWave2 &&
    mainAgentWave2.entries.find((entry) => entry.entryId === 'main-agent-orchestration');
  if (!registryEntry) errors.push('missing script-migration-registry entry');
  if (!mainEntry) errors.push('missing main-agent-orchestration entry');
  if (registryEntry && registryEntry.originalClassBeforeMigration !== 'source_repo_governance') errors.push('script-migration-registry entry must be source_repo_governance');
  if (mainEntry) {
    if (mainAgent.status !== 'validated') errors.push('main-agent-migration-wave-1 status must be validated');
    if (mainEntry.originalPath !== 'scripts/main-agent-orchestration.ts') errors.push('main-agent-orchestration originalPath mismatch');
    if (mainEntry.migrationStrategy !== 'package_runtime_module') errors.push('main-agent-orchestration strategy mismatch');
    if (mainEntry.migrationStatus !== 'validated') errors.push('main-agent-orchestration migrationStatus must be validated');
    if (mainEntry.validationStatus !== 'passed') errors.push('main-agent-orchestration validationStatus must be passed');
    if (mainEntry.oldPathDisposition !== 'retained_source_dev_only') errors.push('main-agent-orchestration oldPathDisposition must be retained_source_dev_only');
    if (mainEntry.deletionAllowed !== false) errors.push('main-agent-orchestration deletionAllowed must be false');
  }
  if (mainAgentWave2) {
    if (mainAgentWave2.refinesWaveId !== 'main-agent-migration-wave-1') {
      errors.push('main-agent-source-authority-wave-2 must refine main-agent-migration-wave-1');
    }
  }
  if (mainWave2Entry) {
    if (mainWave2Entry.originalPath !== 'scripts/main-agent-orchestration.ts') {
      errors.push('main-agent-source-authority-wave-2 originalPath mismatch');
    }
    if (mainWave2Entry.originalClassBeforeMigration !== 'package_runtime_source_authority_incomplete') {
      errors.push('main-agent-source-authority-wave-2 class must be package_runtime_source_authority_incomplete');
    }
    if (mainWave2Entry.migrationStrategy !== 'package_runtime_module') {
      errors.push('main-agent-source-authority-wave-2 strategy mismatch');
    }
    if (mainWave2Entry.oldPathDisposition !== 'retained_source_dev_only') {
      errors.push('main-agent-source-authority-wave-2 oldPathDisposition must be retained_source_dev_only');
    }
    if (mainWave2Entry.deletionAllowed !== false) {
      errors.push('main-agent-source-authority-wave-2 deletionAllowed must be false');
    }
    if (mainWave2Entry.deletionApprovalRef !== null) {
      errors.push('main-agent-source-authority-wave-2 deletionApprovalRef must be null');
    }
    if (!mainWave2Entry.targetPaths.some((target) => target.startsWith('packages/bmad-speckit/dist/main-agent/'))) {
      errors.push('main-agent-source-authority-wave-2 must include dist main-agent targetPaths');
    }
  }
}

function parsePackOutput(text) {
  const start = text.indexOf('[');
  if (start < 0) throw new Error('npm pack output missing JSON array');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, index + 1));
    }
  }
  throw new Error('npm pack output JSON array was incomplete');
}

function collectPackedPaths(packJson) {
  return packJson.flatMap((entry) => (entry.files || []).map((file) => file.path));
}

function validatePackedPaths(label, packJson, errors) {
  for (const packedPath of collectPackedPaths(packJson)) {
    if (packedPath.startsWith('repo-governance/')) errors.push(`${label} pack leaks ${packedPath}`);
  }
}

function runPack(cwd) {
  const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 80 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`npm pack failed in ${cwd}: ${result.stderr || result.stdout}`);
  return parsePackOutput(result.stdout);
}

function scanForbiddenReferences(errors) {
  for (const manifestPath of [path.join(ROOT, 'package.json'), path.join(PACKAGE_ROOT, 'package.json')]) {
    const pkg = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if ((pkg.files || []).some((entry) => entry === 'repo-governance' || entry === 'repo-governance/')) {
      errors.push(`${relativeToRoot(manifestPath)} files includes repo-governance`);
    }
  }
  for (const dir of [path.join(PACKAGE_ROOT, 'bin'), path.join(PACKAGE_ROOT, 'src')]) {
    for (const filePath of listFiles(dir)) {
      if (fs.readFileSync(filePath, 'utf8').includes('repo-governance')) errors.push(`${relativeToRoot(filePath)} references repo-governance`);
    }
  }
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    if (entry.isFile()) files.push(full);
  }
  return files;
}

function validatePackExclusion(options, errors) {
  if (options.packListFixture) {
    validatePackedPaths('fixture', parsePackOutput(fs.readFileSync(options.packListFixture, 'utf8')), errors);
  } else {
    validatePackedPaths('root', runPack(ROOT), errors);
    validatePackedPaths('packages/bmad-speckit', runPack(PACKAGE_ROOT), errors);
  }
  scanForbiddenReferences(errors);
}

function main() {
  const errors = [];
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    const registry = readRegistry(options.registryPath, errors);
    validateRegistry(registry, errors);
    if (options.checkPackExclusion) validatePackExclusion(options, errors);
  } catch (error) {
    errors.push(error.message);
  }

  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    registryPath: options ? relativeToRoot(options.registryPath) : null,
    packExclusion: options && options.checkPackExclusion ? (errors.length === 0 ? 'passed' : 'failed') : 'not_requested',
    errors,
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
  if (errors.length > 0) process.exit(1);
}

main();
