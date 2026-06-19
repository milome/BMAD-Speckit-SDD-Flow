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
const ACTIVE_WAVE_STATUSES = new Set(['planned', 'in_progress', 'validated', 'blocked']);
const ORIGINAL_PATH_EXISTENCE_EXEMPT_STATUSES = new Set([
  'deleted_after_approval',
  'source_history_only',
]);
const PACKAGE_SOURCE_PARITY_STRATEGIES = new Set([
  'package_runtime_module',
  'runtime_emit_cjs',
  'durable_helper_copy',
  'public_cli_de_surface',
  'compatibility_alias',
]);

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

function claimsPassed(entry) {
  return entry.migrationStatus === 'validated' || entry.validationStatus === 'passed';
}

function targetSetKey(targetPaths) {
  return JSON.stringify(
    [...new Set((targetPaths || []).map((targetPath) => String(targetPath || '').replace(/\\/g, '/')))].sort()
  );
}

function waveRefinesAncestor(waveId, ancestorWaveId, waveRefinements) {
  const seen = new Set();
  let current = waveId;
  while (current != null && !seen.has(current)) {
    if (current === ancestorWaveId) return true;
    seen.add(current);
    current = waveRefinements.get(current);
  }
  return false;
}

function explicitlyRefinesActiveRecord(wave, entry, previous, waveRefinements) {
  if (entry.deletionAllowed !== false) return false;
  return [wave.waveId, wave.refinesWaveId, entry.refinesWaveId]
    .filter(Boolean)
    .some((candidateWaveId) => waveRefinesAncestor(candidateWaveId, previous.waveId, waveRefinements));
}

function repoPathExists(relativePath) {
  return fs.existsSync(path.join(ROOT, relativePath || ''));
}

function readRepoTextIfExists(relativePath) {
  const filePath = path.join(ROOT, relativePath || '');
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
  return fs.readFileSync(filePath, 'utf8');
}

function isCjsTarget(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/').endsWith('.cjs');
}

function isSharedPackagePlumbing(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  return new Set([
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'packages/bmad-speckit/src/main-agent/index.js',
    'packages/bmad-speckit/src/main-agent/runtime.js',
  ]).has(normalized);
}

function isPackageSourceParityCandidate(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  if (!normalized.startsWith('packages/')) return false;
  if (isCjsTarget(normalized)) return false;
  if (isSharedPackagePlumbing(normalized)) return false;
  if (
    normalized.includes('/dist/') ||
    normalized.includes('/bin/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    normalized.includes('/fixtures/') ||
    normalized.includes('/compiled/')
  ) {
    return false;
  }
  if (!/\.(?:js|mjs|ts|mts|cts)$/.test(normalized)) return false;
  return repoPathExists(normalized);
}

function packageSourceParityTargets(entry) {
  return (entry.targetPaths || [])
    .map((targetPath) => String(targetPath || '').replace(/\\/g, '/'))
    .filter(isPackageSourceParityCandidate);
}

function normalizedSourceStats(source) {
  const withoutBlockComments = String(source || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = withoutBlockComments
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line, index) => {
      if (index === 0 && line.startsWith('#!')) return '';
      return line;
    })
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('//'))
    .filter((line) => !line.startsWith('#'));
  const normalizedText = lines.join('\n');
  return {
    bytes: Buffer.byteLength(normalizedText, 'utf8'),
    loc: lines.length,
  };
}

function normalizedRepoSourceStats(relativePath) {
  const source = readRepoTextIfExists(relativePath);
  if (source == null) return null;
  return normalizedSourceStats(source);
}

function combinedPackageSourceStats(targetPaths) {
  const combined = { bytes: 0, loc: 0 };
  for (const targetPath of targetPaths) {
    const stats = normalizedRepoSourceStats(targetPath);
    if (!stats) continue;
    combined.bytes += stats.bytes;
    combined.loc += stats.loc;
  }
  return combined;
}

function sizeDeltaThreshold(entry, originalBytes) {
  const percent = entry.migrationStrategy === 'runtime_emit_cjs' ? 0.01 : 0.10;
  return Math.max(Math.ceil(originalBytes * percent), 1024);
}

function hasPackageSourceParityEvidence(rows) {
  return rows.some((row) => {
    const parity =
      row.packageSourceParity ||
      row.packageSourceParityEvidence ||
      row.sourceParity ||
      row.parityEvidence;
    if (!parity || typeof parity !== 'object') return false;
    const packagePaths =
      parity.packageEquivalentPaths ||
      parity.packageSourcePaths ||
      parity.targetPaths;
    return (
      Array.isArray(packagePaths) &&
      packagePaths.length > 0 &&
      Number.isFinite(Number(parity.originalNormalizedBytes)) &&
      Number.isFinite(Number(parity.packageNormalizedBytes)) &&
      Number.isFinite(Number(parity.byteDelta)) &&
      ['passed', 'partial', 'blocked'].includes(String(parity.decision || parity.result || ''))
    );
  });
}

function sourceTargetIssues(entry) {
  const issues = [];
  for (const targetPath of entry.targetPaths || []) {
    const normalizedTarget = String(targetPath || '').replace(/\\/g, '/');
    if (
      !normalizedTarget.startsWith('packages/') &&
      !normalizedTarget.startsWith('scripts/')
    ) {
      continue;
    }
    const source = readRepoTextIfExists(normalizedTarget);
    if (!source) continue;
    if (normalizedTarget.startsWith('packages/') && isCjsTarget(normalizedTarget)) {
      issues.push({
        kind: 'CJS target cannot satisfy package source parity',
        targetPath: normalizedTarget,
      });
    }
    if (
      normalizedTarget.includes('compiled/main-agent-orchestration.cjs') ||
      source.includes('main-agent-orchestration.cjs')
    ) {
      issues.push({
        kind: 'compiled orchestration fallback',
        targetPath: normalizedTarget,
      });
    }
    if (
      source.includes('createPackageRuntimeReportAction') ||
      (source.includes('package-runtime-dispatch') &&
        source.includes('package_runtime_module') &&
        source.includes('consumerRuntimeProof'))
    ) {
      issues.push({
        kind: 'report-only package runtime action',
        targetPath: normalizedTarget,
      });
    }
    if (
      source.includes('createDurableHelperDescriptor') ||
      (source.includes('durable_helper_copy') && source.includes('consumerRuntimeProof'))
    ) {
      issues.push({
        kind: 'descriptor-only durable helper',
        targetPath: normalizedTarget,
      });
    }
  }
  return issues;
}

function matchingEvidenceRows(entry) {
  const rows = [];
  for (const ref of entry.evidenceRefs || []) {
    const evidencePath = path.join(ROOT, ref);
    if (!fs.existsSync(evidencePath)) continue;
    const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
    if (!Array.isArray(evidence.entries)) continue;
    for (const row of evidence.entries) {
      if (
        row.entryId === entry.entryId ||
        row.originalPath === entry.originalPath ||
        (Array.isArray(row.targetPaths) &&
          row.targetPaths.some((targetPath) => (entry.targetPaths || []).includes(targetPath)))
      ) {
        rows.push(row);
      }
    }
  }
  return rows;
}

function rowHasPassingCommand(row) {
  return (
    Array.isArray(row.commands) &&
    row.commands.some((command) => command && command.exitCode === 0)
  );
}

function validateParityEvidenceGate(entry, errors) {
  if (!claimsPassed(entry)) return;

  if (String(entry.originalClassBeforeMigration || '').includes('source_authority_incomplete')) {
    errors.push(`validated or passed entry is still source-authority incomplete for ${entry.entryId}`);
  }

  for (const targetPath of entry.targetPaths || []) {
    if (
      String(targetPath || '').startsWith('packages/') &&
      !String(targetPath || '').includes('#') &&
      !repoPathExists(targetPath)
    ) {
      errors.push(`validated or passed entry targetPath missing for ${entry.entryId}: ${targetPath}`);
    }
  }

  for (const issue of sourceTargetIssues(entry)) {
    errors.push(
      `validated or passed entry ${entry.entryId} is backed by ${issue.kind}: ${issue.targetPath}`
    );
  }

  if (!PACKAGE_SOURCE_PARITY_STRATEGIES.has(entry.migrationStrategy)) {
    return;
  }

  const rows = matchingEvidenceRows(entry);
  if (rows.length === 0) {
    errors.push(`validated or passed entry lacks matching evidence row for ${entry.entryId}`);
    return;
  }
  if (!rows.some((row) => row.result === 'passed' && rowHasPassingCommand(row))) {
    errors.push(`validated or passed entry lacks passing command evidence for ${entry.entryId}`);
  }

  if (!String(entry.originalPath || '').startsWith('scripts/')) {
    return;
  }

  const packageTargets = packageSourceParityTargets(entry);
  if (packageTargets.length === 0) {
    errors.push(`validated or passed entry lacks package source equivalent for ${entry.entryId}`);
    return;
  }

  if (!hasPackageSourceParityEvidence(rows)) {
    errors.push(`validated or passed entry lacks package source parity evidence for ${entry.entryId}`);
  }

  const originalStats = normalizedRepoSourceStats(entry.originalPath);
  if (!originalStats) {
    errors.push(`validated or passed entry lacks original source for package source parity: ${entry.entryId}`);
    return;
  }

  const packageStats = combinedPackageSourceStats(packageTargets);
  const delta = Math.abs(originalStats.bytes - packageStats.bytes);
  const threshold = sizeDeltaThreshold(entry, originalStats.bytes);
  if (packageStats.bytes < Math.ceil(originalStats.bytes * 0.70)) {
    errors.push(
      `validated or passed entry package source parity size delta is blocked for ${entry.entryId}: original=${originalStats.bytes} package=${packageStats.bytes}`
    );
  } else if (delta > threshold) {
    errors.push(
      `validated or passed entry package source parity size delta exceeds threshold for ${entry.entryId}: original=${originalStats.bytes} package=${packageStats.bytes} delta=${delta} threshold=${threshold}`
    );
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
  const waveRefinements = new Map();
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
    waveRefinements.set(wave.waveId, wave.refinesWaveId || null);
    if (!WAVE_STATUSES.includes(wave.status)) errors.push(`invalid wave status for ${wave.waveId}: ${wave.status}`);
    if (!Array.isArray(wave.entries)) {
      errors.push(`wave ${wave.waveId} entries must be an array`);
      continue;
    }
    const entryIds = new Set();
    for (const entry of wave.entries) {
      validateEntry(wave, entry, entryIds, activeOriginalPaths, waveRefinements, errors);
    }
  }
  validateBootstrapContent(registry, errors);
  validatePhysicalScriptClosure(registry, errors);
}

function validateEntry(wave, entry, entryIds, activeOriginalPaths, waveRefinements, errors) {
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
  if (!ORIGINAL_PATH_EXISTENCE_EXEMPT_STATUSES.has(entry.originalPathStatus) && !fs.existsSync(path.join(ROOT, entry.originalPath || ''))) {
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
  if (claimsPassed(entry) && !entry.evidenceRefs.some((ref) => fs.existsSync(path.join(ROOT, ref)))) {
    errors.push(`validated or passed entry lacks existing evidenceRefs for ${entry.entryId}`);
  }
  for (const ref of entry.evidenceRefs || []) {
    const evidencePath = path.join(ROOT, ref);
    if (fs.existsSync(evidencePath)) validateEvidenceFile(evidencePath, errors);
  }
  validateParityEvidenceGate(entry, errors);
  if (ACTIVE_WAVE_STATUSES.has(wave.status)) {
    const targets = targetSetKey(entry.targetPaths || []);
    const previousRecords = activeOriginalPaths.get(entry.originalPath) || [];
    for (const previous of previousRecords) {
      if (previous.targets !== targets && !explicitlyRefinesActiveRecord(wave, entry, previous, waveRefinements)) {
        errors.push(`conflicting active migration targetPaths for ${entry.originalPath}`);
      }
    }
    previousRecords.push({
      targets,
      waveId: wave.waveId,
    });
    activeOriginalPaths.set(entry.originalPath, previousRecords);
  }
}

function listPhysicalScripts() {
  const result = spawnSync('rg', ['--files', 'scripts'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status === 0) {
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/\\/g, '/'))
      .filter(Boolean)
      .sort();
  }
  return listFiles(path.join(ROOT, 'scripts'))
    .map((filePath) => relativeToRoot(filePath))
    .sort();
}

function validatePhysicalScriptClosure(registry, errors) {
  if (!Array.isArray(registry.waves)) return;
  const registeredScripts = new Set();
  for (const wave of registry.waves) {
    for (const entry of wave.entries || []) {
      const originalPath = String(entry.originalPath || '').replace(/\\/g, '/');
      if (originalPath.startsWith('scripts/')) registeredScripts.add(originalPath);
    }
  }
  const missing = listPhysicalScripts().filter((scriptPath) => !registeredScripts.has(scriptPath));
  if (missing.length > 0) {
    errors.push(
      `physical scripts closure incomplete: ${missing.length} scripts are missing registry entries: ${missing.join(', ')}`
    );
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
    if (mainEntry.originalPath !== 'scripts/main-agent-orchestration.ts') errors.push('main-agent-orchestration originalPath mismatch');
    if (mainEntry.migrationStrategy !== 'package_runtime_module') errors.push('main-agent-orchestration strategy mismatch');
    if (mainEntry.migrationStatus === 'validated') errors.push('main-agent-orchestration migrationStatus must not be validated until parity evidence exists');
    if (mainEntry.validationStatus === 'passed') errors.push('main-agent-orchestration validationStatus must not be passed until parity evidence exists');
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
