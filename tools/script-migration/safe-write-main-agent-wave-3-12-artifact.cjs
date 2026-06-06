#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.12';
const WAVE_DIR = `repo-governance/script-migrations/${WAVE_ID}`;
const SAFE_WRITE_PATH = `${WAVE_DIR}/safe-write-receipts.json`;
const LEDGER_PATH = `${WAVE_DIR}/migration-ledger.json`;
const SCOPE_BASELINE_PATH = `${WAVE_DIR}/scope-baseline.json`;
const AUDIT_PATH = `${WAVE_DIR}/full-physical-script-closure-audit.json`;
const SUMMARY_PATH = `${WAVE_DIR}/summary.md`;
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const EXECUTION_CONTRACT_PATH =
  'docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md';
const EXPECTED_QUEUE_HASH = 'sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea';

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function repoPath(relativePath) {
  return path.join(ROOT, normalizePath(relativePath));
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function nowIso() {
  return new Date().toISOString();
}

function stamp() {
  return nowIso().replace(/[-:.]/g, '').replace('Z', 'Z');
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function sha256Text(text) {
  return sha256Buffer(Buffer.from(String(text), 'utf8'));
}

function sha256File(relativePath) {
  return sha256Buffer(fs.readFileSync(repoPath(relativePath)));
}

function sha256CanonicalTextFile(relativePath) {
  const text = fs.readFileSync(repoPath(relativePath), 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return sha256Text(text);
}

function canonicalize(value, omitTopLevelSelfVerification = false, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, false, depth + 1));
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (depth === 0 && omitTopLevelSelfVerification && key === 'selfVerification') continue;
    result[key] = canonicalize(value[key], false, depth + 1);
  }
  return result;
}

function hashCanonical(value, omitTopLevelSelfVerification = false) {
  return sha256Text(JSON.stringify(canonicalize(value, omitTopLevelSelfVerification)));
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function expectedTopLevelKeys(targetPath) {
  const normalized = normalizePath(targetPath);
  if (normalized === SAFE_WRITE_PATH) return ['waveId', 'generatedAt', 'receipts', 'selfVerification'];
  if (normalized.endsWith('/migration-ledger.json')) {
    return [
      'schemaVersion',
      'waveId',
      'sourcePlanPath',
      'sourcePlanHash',
      'sourceAuditPath',
      'sourceRegistryPath',
      'sourceSummaryPath',
      'executionContractPath',
      'executionContractHash',
      'queueHash',
      'counts',
      'entries',
      'generatedAt',
      'queueOrderProof',
    ];
  }
  if (normalized.endsWith('/scope-baseline.json')) {
    return ['schemaVersion', 'waveId', 'capturedAt', 'allowedWritePolicy', 'command', 'statusRows'];
  }
  if (normalized.endsWith('/package-command-evidence.json')) {
    return ['schemaVersion', 'waveId', 'generatedAt', 'ledgerPath', 'queueHash', 'rows'];
  }
  if (normalized.endsWith('/install-matrix.json')) {
    return ['schemaVersion', 'waveId', 'status', 'startedAt', 'completedAt', 'ledgerPath', 'queueHash', 'modes'];
  }
  if (normalized.endsWith('/evidence.json')) {
    return [
      'waveId',
      'sourcePlanPath',
      'sourcePlanHash',
      'executionContractPath',
      'executionContractHash',
      'auditContractPath',
      'queueHash',
      'validatedAt',
      'commands',
      'entries',
      'installMatrixEvidence',
      'safeWriteReceiptRefs',
      'artifactHashes',
      'residualRisks',
    ];
  }
  if (normalized.endsWith('/registry-evidence.json')) return ['waveId', 'validatedAt', 'entries'];
  if (normalized === 'repo-governance/script-migration-registry.yaml') return [];
  return [];
}

function parseArgs(argv) {
  const args = {
    requires: [],
    minBytes: 0,
    operation: 'safe_write_wave_3_12_artifact',
    json: false,
    generateLedger: false,
    captureScopeBaseline: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--target') args.target = argv[++index];
    else if (arg === '--draft' || arg === '--content-file') args.draft = argv[++index];
    else if (arg === '--require') args.requires.push(argv[++index]);
    else if (arg === '--min-bytes') args.minBytes = Number(argv[++index]);
    else if (arg === '--operation') args.operation = argv[++index];
    else if (arg === '--json') args.json = true;
    else if (arg === '--generate-ledger') args.generateLedger = true;
    else if (arg === '--capture-scope-baseline') args.captureScopeBaseline = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (args.generateLedger || args.captureScopeBaseline) return args;
  if (!args.target) throw new Error('--target is required');
  if (!args.draft) throw new Error('--draft or --content-file is required');
  if (!Number.isFinite(args.minBytes) || args.minBytes < 0) throw new Error('--min-bytes must be a non-negative number');
  return args;
}

function assertInsideRepo(relativePath) {
  const fullPath = path.resolve(ROOT, normalizePath(relativePath));
  if (fullPath !== ROOT && !fullPath.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`refusing to write outside repository: ${relativePath}`);
  }
  return fullPath;
}

function buildRequiredChecks(targetPath, content, options = {}) {
  const checks = [];
  if (Buffer.byteLength(content, 'utf8') < (options.minBytes || 0)) {
    checks.push({ type: 'minBytes', minBytes: options.minBytes || 0, status: 'failed' });
  } else if (options.minBytes) {
    checks.push({ type: 'minBytes', minBytes: options.minBytes, status: 'passed' });
  }
  for (const marker of options.requires || []) {
    checks.push({
      type: 'containsMarker',
      marker,
      status: content.includes(marker) ? 'passed' : 'failed',
    });
  }
  if (normalizePath(targetPath).endsWith('.json')) {
    const parsed = JSON.parse(content);
    checks.push({ type: 'jsonParse', status: 'passed' });
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      checks.push({ type: 'jsonObject', status: 'failed' });
    } else {
      checks.push({ type: 'jsonObject', status: 'passed' });
      for (const key of expectedTopLevelKeys(targetPath)) {
        checks.push({
          type: 'topLevelKey',
          key,
          status: Object.prototype.hasOwnProperty.call(parsed, key) ? 'passed' : 'failed',
        });
      }
    }
  }
  return checks;
}

function readJsonIfExists(relativePath) {
  const fullPath = repoPath(relativePath);
  if (!fs.existsSync(fullPath)) return null;
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function loadReceipts() {
  const manifest = readJsonIfExists(SAFE_WRITE_PATH);
  return Array.isArray(manifest?.receipts) ? manifest.receipts : [];
}

function saveReceipts(receipts) {
  const manifest = {
    waveId: WAVE_ID,
    generatedAt: nowIso(),
    receipts,
  };
  manifest.selfVerification = {
    hashKind: 'canonical_json_without_selfVerification',
    payloadSha256: hashCanonical(manifest, true),
    computedAt: nowIso(),
    status: 'passed',
  };

  const targetFullPath = assertInsideRepo(SAFE_WRITE_PATH);
  fs.mkdirSync(path.dirname(targetFullPath), { recursive: true });
  const marker = `${stamp()}.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  const draftFullPath = path.join(path.dirname(targetFullPath), `.${path.basename(SAFE_WRITE_PATH)}.draft.${marker}`);
  const content = formatJson(manifest);
  fs.writeFileSync(draftFullPath, content, 'utf8');
  if (fs.existsSync(targetFullPath)) {
    fs.copyFileSync(targetFullPath, repoPath(`${SAFE_WRITE_PATH}.bak.${marker}`));
  }
  fs.renameSync(draftFullPath, targetFullPath);
  return manifest;
}

function safeWriteFile(targetPath, content, options = {}) {
  const normalizedTarget = normalizePath(targetPath);
  const targetFullPath = assertInsideRepo(normalizedTarget);
  const startedAt = nowIso();
  const requiredChecks = buildRequiredChecks(normalizedTarget, content, options);
  if (requiredChecks.some((check) => check.status !== 'passed')) {
    throw new Error(`required safe-write check failed for ${normalizedTarget}: ${JSON.stringify(requiredChecks)}`);
  }

  fs.mkdirSync(path.dirname(targetFullPath), { recursive: true });
  const marker = `${stamp()}.${process.pid}.${crypto.randomBytes(4).toString('hex')}`;
  const draftFullPath = path.join(path.dirname(targetFullPath), `.${path.basename(normalizedTarget)}.draft.${marker}`);
  const draftPath = rel(draftFullPath);
  const backupPath = fs.existsSync(targetFullPath) ? `${normalizedTarget}.bak.${marker}` : null;
  fs.writeFileSync(draftFullPath, content, 'utf8');
  const draftSha256 = sha256Buffer(fs.readFileSync(draftFullPath));
  if (backupPath) fs.copyFileSync(targetFullPath, repoPath(backupPath));
  fs.renameSync(draftFullPath, targetFullPath);
  const postWriteSha256 = sha256File(normalizedTarget);
  if (postWriteSha256 !== draftSha256) {
    throw new Error(`post-write hash mismatch for ${normalizedTarget}`);
  }

  const receipt = {
    targetPath: normalizedTarget,
    artifactPath: normalizedTarget,
    operation: options.operation || 'safe_write_wave_3_12_artifact',
    hashKind: 'promoted_file_bytes',
    draftPath,
    backupPath,
    requiredChecks,
    draftSha256,
    promotedSha256: draftSha256,
    postWriteSha256,
    sha256: postWriteSha256,
    byteLength: Buffer.byteLength(content, 'utf8'),
    startedAt,
    completedAt: nowIso(),
    status: 'passed',
  };

  if (normalizedTarget !== SAFE_WRITE_PATH) {
    const receipts = loadReceipts().filter((item) => {
      return !(item.targetPath === receipt.targetPath && item.sha256 === receipt.sha256);
    });
    receipts.push(receipt);
    saveReceipts(receipts);
  }

  return receipt;
}

function slugFromOriginal(originalPath) {
  return path
    .basename(originalPath)
    .replace(/\.(ts|js|cjs|mjs|ps1|sh)$/u, '')
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

function pascalCase(value) {
  return String(value)
    .split(/[^a-z0-9]+/iu)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join('');
}

function publicCommand(entry) {
  const explicit = (entry.publicCommandsAfterMigration || []).find((command) =>
    String(command).startsWith('bmad-speckit ')
  );
  if (explicit) return explicit.replace(/^bmad-speckit\s+/u, '').trim().split(/\s+/u)[0];
  return slugFromOriginal(entry.originalPath);
}

function sourceTargets(entry) {
  return (entry.targetPaths || []).filter((targetPath) => {
    if (!targetPath.startsWith('packages/')) return false;
    if (targetPath.includes('/dist/')) return false;
    return true;
  });
}

function distPathForTarget(targetPath) {
  if (targetPath.startsWith('packages/bmad-speckit/src/main-agent/')) {
    return targetPath.replace('packages/bmad-speckit/src/main-agent/', 'packages/bmad-speckit/dist/main-agent/');
  }
  if (targetPath.startsWith('packages/scoring/') && targetPath.endsWith('.ts')) {
    return targetPath.replace('packages/scoring/', 'packages/scoring/dist/').replace(/\.ts$/u, '.js');
  }
  if (targetPath.startsWith('packages/runtime-context/src/') && targetPath.endsWith('.ts')) {
    return targetPath.replace('packages/runtime-context/src/', 'packages/runtime-context/dist/').replace(/\.ts$/u, '.js');
  }
  return null;
}

function packageForEntry(entry) {
  const targets = entry.targetPaths || [];
  if (targets.some((targetPath) => targetPath.startsWith('packages/scoring/'))) {
    return {
      name: '@bmad-speckit/scoring',
      path: 'packages/scoring',
      packageJsonPath: 'packages/scoring/package.json',
      buildCommandId: 'CMD014',
      testCommandId: 'CMD019',
    };
  }
  if (targets.some((targetPath) => targetPath.startsWith('packages/runtime-context/'))) {
    return {
      name: '@bmad-speckit/runtime-context',
      path: 'packages/runtime-context',
      packageJsonPath: 'packages/runtime-context/package.json',
      buildCommandId: 'CMD015',
      testCommandId: null,
      testNotApplicableReason: 'package_runtime_context_has_no_test_script_in_package_json',
    };
  }
  return {
    name: 'bmad-speckit',
    path: 'packages/bmad-speckit',
    packageJsonPath: 'packages/bmad-speckit/package.json',
    buildCommandId: 'CMD018',
    testCommandId: 'CMD020',
  };
}

function buildCommandIdForTarget(targetPath) {
  if (targetPath.startsWith('packages/scoring/')) return 'CMD014';
  if (targetPath.startsWith('packages/runtime-context/')) return 'CMD015';
  if (targetPath.startsWith('packages/runtime-emit/')) return 'CMD016';
  if (targetPath.startsWith('packages/ralph-method/')) return 'CMD017';
  return 'CMD018';
}

function testPathsForEntry(entry) {
  if (entry.migrationStrategy === 'public_cli_de_surface') {
    return ['packages/bmad-speckit/tests/main-agent-wave-3-12-public-cli.test.js'];
  }
  if ((entry.targetPaths || []).some((targetPath) => targetPath.startsWith('packages/scoring/'))) {
    return ['packages/scoring/__tests__/main-agent-wave-3-12-analytics-helpers.test.ts'];
  }
  if ((entry.targetPaths || []).some((targetPath) => targetPath.startsWith('packages/runtime-context/'))) {
    return [];
  }
  if (entry.migrationStrategy === 'package_runtime_module') {
    return ['packages/bmad-speckit/tests/main-agent-wave-3-12-runtime-modules.test.js'];
  }
  return ['packages/bmad-speckit/tests/main-agent-wave-3-12-durable-helpers.test.js'];
}

function callerSwitchPlanFor(entry, sources) {
  if (entry.migrationStrategy === 'public_cli_de_surface') {
    return [
      {
        targetPath: 'packages/bmad-speckit/bin/bmad-speckit.js',
        action: `add_or_update_package_cli_command:${publicCommand(entry)}`,
        status: 'pending',
        proofCommandIds: ['CMD009', 'CMD011', 'CMD023'],
      },
    ];
  }
  if (entry.migrationStrategy === 'package_runtime_module') {
    return [
      {
        targetPath: 'packages/bmad-speckit/src/main-agent/runtime.js',
        action: `register_package_runtime_action:${slugFromOriginal(entry.originalPath)}`,
        status: 'pending',
        proofCommandIds: ['CMD007', 'CMD011', 'CMD023'],
      },
    ];
  }
  return sources.map((sourcePath) => ({
    targetPath: sourcePath,
    action: `replace_root_script_dependency_with_package_helper:${slugFromOriginal(entry.originalPath)}`,
    status: 'pending',
    proofCommandIds: ['CMD008', 'CMD011', 'CMD020'],
  }));
}

function runnerApiFor(entry) {
  const slug = slugFromOriginal(entry.originalPath);
  if (entry.migrationStrategy === 'public_cli_de_surface') {
    return {
      moduleFormat: 'commonjs',
      exportName: `${slug.replace(/-([a-z0-9])/gu, (_, character) => character.toUpperCase())}Command`,
      cwdPolicy: 'consumer_cwd',
      argumentPolicy: 'commander_options_and_forwarded_argv',
      stdoutPolicy: 'preserve_script_semantic_stdout_or_json',
      stderrPolicy: 'preserve_script_semantic_stderr',
      exitCodePolicy: 'return_zero_on_success_nonzero_on_validation_or_runtime_failure',
    };
  }
  return {
    moduleFormat: 'commonjs',
    exportName: entry.migrationStrategy === 'package_runtime_module' ? `run${pascalCase(slug)}` : 'moduleExports',
    cwdPolicy: 'caller_supplied_or_process_cwd_without_repo_root_assumption',
    argumentPolicy: 'explicit_function_arguments_no_implicit_process_argv_dependency',
    stdoutPolicy: 'no_unexpected_stdout_for_imported_runtime_helper',
    stderrPolicy: 'throw_or_return_error_without_process_exit_for_imported_runtime_helper',
    exitCodePolicy: 'no_process_exit_from_imported_package_module',
  };
}

function cliProbeFor(entry) {
  if (entry.migrationStrategy !== 'public_cli_de_surface') return null;
  return {
    command: `node packages/bmad-speckit/bin/bmad-speckit.js ${publicCommand(entry)} --help`,
    cwd: '.',
    expectedExitCode: 0,
    provesCommandAvailability: true,
  };
}

function smokeProbeFor(entry, workspacePackage) {
  const slug = slugFromOriginal(entry.originalPath);
  if (entry.migrationStrategy === 'public_cli_de_surface') {
    const commandName = publicCommand(entry);
    return {
      probeId: `${entry.entryId || slug}:package-cli-help`,
      probeType: 'package_cli',
      commandId: 'CMD023',
      cwd: 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-sandbox/package-cli',
      argv: ['bmad-speckit', commandName, '--help'],
      inputFixture: 'no_stdin',
      expectedExitCode: 0,
      expectedResult: 'installed_package_cli_command_available_without_root_script_dispatch',
      expectedStdout: 'command_help_or_usage_text',
      stderrPolicy: 'no_unexpected_stderr',
    };
  }
  if (entry.migrationStrategy === 'package_runtime_module') {
    return {
      probeId: `${entry.entryId || slug}:installed-package-require`,
      probeType: 'installed_package_require',
      commandId: 'CMD023',
      cwd: 'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.12/install-sandbox/runtime-action',
      argv: ['node', '-e', `require('${workspacePackage.name}/dist/main-agent/index.js')`],
      inputFixture: 'minimal_runtime_action_fixture',
      expectedExitCode: 0,
      expectedResult: 'installed_package_runtime_action_require_succeeds_without_root_script_dispatch',
      expectedStdout: 'probe passed',
      stderrPolicy: 'no_unexpected_stderr',
    };
  }
  return {
    probeId: `${entry.entryId || slug}:package-import`,
    probeType: 'package_import',
    commandId: workspacePackage.testCommandId || workspacePackage.buildCommandId,
    cwd: workspacePackage.path,
    argv: ['node', '-e', 'require(process.env.BMAD_WAVE_3_12_PROBE_TARGET)'],
    inputFixture: 'package_helper_import_fixture',
    expectedExitCode: 0,
    expectedResult: 'package_helper_import_succeeds_without_root_script_dispatch',
    expectedStdout: 'probe passed',
    stderrPolicy: 'no_unexpected_stderr',
  };
}

function buildCopyPlanFor(sources) {
  return sources
    .map((sourcePath) => ({
      sourcePath,
      targetPath: distPathForTarget(sourcePath),
      copyCommandId: buildCommandIdForTarget(sourcePath),
    }))
    .filter((plan) => plan.targetPath);
}

function buildLedger() {
  const audit = JSON.parse(fs.readFileSync(repoPath(AUDIT_PATH), 'utf8'));
  const registry = yaml.load(fs.readFileSync(repoPath(REGISTRY_PATH), 'utf8'));
  const queue = audit.consumerReachableMigrationQueue;
  if (!Array.isArray(queue) || queue.length !== 102) {
    throw new Error(`queue length expected 102 got ${queue && queue.length}`);
  }
  const queueHash = sha256Text(queue.join('\n'));
  if (queueHash !== EXPECTED_QUEUE_HASH) throw new Error(`queue hash mismatch ${queueHash}`);
  const wave = (registry.waves || []).find((candidate) => candidate.waveId === WAVE_ID);
  if (!wave) throw new Error(`registry wave missing ${WAVE_ID}`);
  const registryEntries = new Map((wave.entries || []).map((entry) => [entry.originalPath, entry]));
  const entries = queue.map((originalPath, index) => {
    const registryEntry = registryEntries.get(originalPath);
    if (!registryEntry) throw new Error(`registry entry missing ${originalPath}`);
    const sources = sourceTargets(registryEntry);
    const buildCopyPlan = buildCopyPlanFor(sources);
    const tests = testPathsForEntry(registryEntry);
    const workspacePackage = packageForEntry(registryEntry);
    const callerSwitchPlan = callerSwitchPlanFor(registryEntry, sources);
    const entry = {
      queueIndex: index + 1,
      implementationState: 'pending',
      originalPath: registryEntry.originalPath,
      entryId: registryEntry.entryId,
      originalPathStatus: registryEntry.originalPathStatus,
      originalClassBeforeMigration: registryEntry.originalClassBeforeMigration,
      migrationStrategy: registryEntry.migrationStrategy,
      targetPaths: registryEntry.targetPaths || [],
      publicCommandsBeforeMigration: registryEntry.publicCommandsBeforeMigration || [],
      publicCommandsAfterMigration: registryEntry.publicCommandsAfterMigration || [],
      callerSwitchStatus: registryEntry.callerSwitchStatus,
      migrationStatus: registryEntry.migrationStatus,
      validationStatus: registryEntry.validationStatus,
      evidenceRefs: registryEntry.evidenceRefs || [],
      oldPathDisposition: registryEntry.oldPathDisposition,
      deletionAllowed: registryEntry.deletionAllowed,
      deletionApprovalRef: registryEntry.deletionApprovalRef ?? null,
      callerSwitchPlan,
      runnerApi: runnerApiFor(registryEntry),
      cliProbeCommand: cliProbeFor(registryEntry),
      buildCopyPlan,
      testPaths: tests,
      workspacePackage,
      smokeProbe: smokeProbeFor(registryEntry, workspacePackage),
      targetExistenceProof: {
        sourcePaths: sources,
        distPaths: buildCopyPlan.map((plan) => plan.targetPath),
        proofCommandIds: buildCopyPlan.length > 0 ? ['CMD010', workspacePackage.buildCommandId] : ['CMD010'],
      },
      rootScriptDependencyForbidden: {
        originalPath: registryEntry.originalPath,
        scanScopes: Array.from(new Set([...sources, ...callerSwitchPlan.map((plan) => plan.targetPath)])),
        forbiddenDependencyForms: [
          'direct require/import of original root script path',
          'tsx runtime dependency',
          'ts-node runtime dependency',
          'compiled main-agent fallback dispatch',
        ],
        proofCommandIds: ['CMD011', 'CMD023'],
      },
    };
    if (buildCopyPlan.length === 0) {
      entry.buildCopyNotApplicableReason =
        registryEntry.migrationStrategy === 'public_cli_de_surface'
          ? 'public_cli_command_source_is_shipped_as_package_src_not_main_agent_dist_copy'
          : 'no_dist_copy_target_derivable_for_declared_package_target';
    }
    if (tests.length === 0) {
      entry.testNotApplicableReason =
        workspacePackage.testNotApplicableReason || 'covered_by_workspace_build_without_dedicated_test_script';
    }
    return entry;
  });
  const counts = {
    total: entries.length,
    byOriginalClassBeforeMigration: {},
    byMigrationStrategy: {},
    byWorkspacePackage: {},
    byImplementationState: {},
  };
  for (const entry of entries) {
    counts.byOriginalClassBeforeMigration[entry.originalClassBeforeMigration] =
      (counts.byOriginalClassBeforeMigration[entry.originalClassBeforeMigration] || 0) + 1;
    counts.byMigrationStrategy[entry.migrationStrategy] = (counts.byMigrationStrategy[entry.migrationStrategy] || 0) + 1;
    counts.byWorkspacePackage[entry.workspacePackage.name] = (counts.byWorkspacePackage[entry.workspacePackage.name] || 0) + 1;
    counts.byImplementationState[entry.implementationState] =
      (counts.byImplementationState[entry.implementationState] || 0) + 1;
  }
  return {
    schemaVersion: 'main-agent-runtime-migration-wave-3.12-ledger/v1',
    waveId: WAVE_ID,
    sourcePlanPath: SUMMARY_PATH,
    sourcePlanHash: sha256File(SUMMARY_PATH),
    sourceAuditPath: AUDIT_PATH,
    sourceRegistryPath: REGISTRY_PATH,
    sourceSummaryPath: SUMMARY_PATH,
    executionContractPath: EXECUTION_CONTRACT_PATH,
    executionContractHash: sha256CanonicalTextFile(EXECUTION_CONTRACT_PATH),
    queueHash,
    counts,
    entries,
    generatedAt: nowIso(),
    queueOrderProof: {
      source: 'full-physical-script-closure-audit.consumerReachableMigrationQueue',
      hashAlgorithm: 'sha256',
      hashInput: 'queue originalPath values joined with LF and no trailing newline',
      firstPath: queue[0],
      lastPath: queue[queue.length - 1],
      count: queue.length,
      queueHash,
    },
  };
}

function parseGitStatusRows(text) {
  return String(text || '')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2),
      path: normalizePath(line.slice(3).trim()),
      raw: line,
    }));
}

function captureScopeBaseline() {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('git', ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git status --short failed: ${result.stderr || result.stdout}`);
  }
  const baseline = {
    schemaVersion: 'main-agent-runtime-migration-wave-3.12-scope-baseline/v1',
    waveId: WAVE_ID,
    capturedAt: nowIso(),
    allowedWritePolicy:
      'Final scope validation excludes these pre-existing dirty rows, then requires new changed paths to be in the ledger-derived allowed write union or explicit contract write union.',
    command: 'git status --short',
    statusRows: parseGitStatusRows(result.stdout),
  };
  const receipt = safeWriteFile(SCOPE_BASELINE_PATH, formatJson(baseline), {
    operation: 'wave_3_12_scope_baseline',
    requires: [WAVE_ID, 'statusRows'],
    minBytes: 100,
  });
  return { baseline, receipt };
}

function generateLedger() {
  const ledger = buildLedger();
  const receipt = safeWriteFile(LEDGER_PATH, formatJson(ledger), {
    operation: 'wave_3_12_migration_ledger',
    requires: [WAVE_ID, EXPECTED_QUEUE_HASH],
    minBytes: 1000,
  });
  return { ledger, receipt };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.generateLedger) {
    const { ledger, receipt } = generateLedger();
    const output = {
      status: 'passed',
      waveId: WAVE_ID,
      ledgerPath: LEDGER_PATH,
      entries: ledger.entries.length,
      queueHash: ledger.queueHash,
      receipt,
    };
    process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
    return;
  }
  if (args.captureScopeBaseline) {
    const { baseline, receipt } = captureScopeBaseline();
    const output = {
      status: 'passed',
      waveId: WAVE_ID,
      baselinePath: SCOPE_BASELINE_PATH,
      statusRows: baseline.statusRows.length,
      receipt,
    };
    process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
    return;
  }
  const draftPath = normalizePath(args.draft);
  assertInsideRepo(draftPath);
  const content = fs.readFileSync(repoPath(draftPath), 'utf8');
  const receipt = safeWriteFile(args.target, content, {
    operation: args.operation,
    requires: args.requires,
    minBytes: args.minBytes,
  });
  const output = { status: 'passed', waveId: WAVE_ID, receipt };
  process.stdout.write(args.json ? `${formatJson(output)}` : `${JSON.stringify(output)}\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  ROOT,
  SAFE_WRITE_PATH,
  SCOPE_BASELINE_PATH,
  WAVE_DIR,
  WAVE_ID,
  buildLedger,
  captureScopeBaseline,
  expectedTopLevelKeys,
  formatJson,
  generateLedger,
  hashCanonical,
  loadReceipts,
  normalizePath,
  nowIso,
  readJsonIfExists,
  rel,
  repoPath,
  safeWriteFile,
  saveReceipts,
  sha256CanonicalTextFile,
  sha256File,
  sha256Text,
};
