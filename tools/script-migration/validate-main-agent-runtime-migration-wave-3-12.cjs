#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const {
  ROOT,
  SAFE_WRITE_PATH,
  WAVE_DIR,
  WAVE_ID,
  normalizePath,
  repoPath,
  sha256File,
} = require('./safe-write-main-agent-wave-3-12-artifact.cjs');

const EXPECTED_QUEUE_HASH = 'sha256:202c3a2f3305b084771c42dc5b385f4e82255475db7d994fa97d71a38b1617ea';
const EXPECTED_SOURCE_PLAN_HASH = 'sha256:7d729c4b2ca23fb701ad7155a5b7a2b58e053cf1f73b003f6df4320024b3a5af';
const LEDGER_PATH = `${WAVE_DIR}/migration-ledger.json`;
const SCOPE_BASELINE_PATH = `${WAVE_DIR}/scope-baseline.json`;
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const AUDIT_PATH = `${WAVE_DIR}/full-physical-script-closure-audit.json`;
const SUMMARY_PATH = `${WAVE_DIR}/summary.md`;
const EXECUTION_CONTRACT_PATH =
  'docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-goal-execution-plan.md';
const AUDIT_CONTRACT_PATH =
  'docs/plans/2026-06-06-main-agent-runtime-migration-wave-3-12-full-physical-closure-audit.md';

const SURFACES = [
  'tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs',
  'tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs',
  'tools/script-migration/run-main-agent-wave-3-12-package-command.cjs',
  'tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs',
  'tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts',
];

const PHASES = new Set([
  'bootstrap',
  'actions',
  'helpers',
  'public-cli',
  'target-existence',
  'caller-switch',
  'builds',
  'install',
  'evidence',
  'root-retention',
  'scope',
  'final',
]);

const SMOKE_PROBE_TYPES = new Set(['package_import', 'package_cli', 'installed_package_require']);

const CATEGORY_EXPECTATIONS = {
  actions: {
    className: 'consumer_runtime_reachable',
    strategy: 'package_runtime_module',
    expectedCount: 28,
  },
  helpers: {
    className: 'package_runtime_helper',
    strategy: 'durable_helper_copy',
    expectedCount: 65,
  },
  'public-cli': {
    className: 'public_cli',
    strategy: 'public_cli_de_surface',
    expectedCount: 9,
  },
};

function parseArgs(argv) {
  const args = { phase: 'final' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--phase') args.phase = argv[++index];
    else throw new Error(`unknown argument: ${arg}`);
  }
  if (!PHASES.has(args.phase)) throw new Error(`unknown phase: ${args.phase}`);
  return args;
}

function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

function readText(relativePath, errors, { required = true } = {}) {
  if (!exists(relativePath)) {
    if (required) errors.push(`missing file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function readJson(relativePath, errors, { required = true } = {}) {
  const text = readText(relativePath, errors, { required });
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`invalid JSON ${relativePath}: ${error.message}`);
    return null;
  }
}

function readYaml(relativePath, errors) {
  const text = readText(relativePath, errors);
  if (!text) return null;
  try {
    return yaml.load(text);
  } catch (error) {
    errors.push(`invalid YAML ${relativePath}: ${error.message}`);
    return null;
  }
}

function isObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function nonEmpty(value) {
  return typeof value === 'string' && value.length > 0;
}

function expect(condition, errors, message) {
  if (!condition) errors.push(message);
}

function ledgerEntries(ledger) {
  return Array.isArray(ledger?.entries) ? ledger.entries : [];
}

function validateLedgerSchema(errors) {
  const ledger = readJson(LEDGER_PATH, errors);
  if (!ledger) return null;
  const entries = ledgerEntries(ledger);
  const requiredTopLevel = [
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
  for (const key of requiredTopLevel) expect(Object.prototype.hasOwnProperty.call(ledger, key), errors, `ledger missing ${key}`);
  expect(ledger.waveId === WAVE_ID, errors, `ledger waveId expected ${WAVE_ID} got ${ledger.waveId}`);
  expect(ledger.queueHash === EXPECTED_QUEUE_HASH, errors, `ledger queueHash expected ${EXPECTED_QUEUE_HASH} got ${ledger.queueHash}`);
  expect(entries.length === 102, errors, `ledger entries expected 102 got ${entries.length}`);
  expect(ledger.sourcePlanPath === SUMMARY_PATH, errors, `ledger sourcePlanPath must be ${SUMMARY_PATH}`);
  expect(ledger.sourcePlanHash === EXPECTED_SOURCE_PLAN_HASH, errors, `ledger sourcePlanHash must be ${EXPECTED_SOURCE_PLAN_HASH}`);
  expect(ledger.executionContractPath === EXECUTION_CONTRACT_PATH, errors, `ledger executionContractPath must be ${EXECUTION_CONTRACT_PATH}`);
  expect(ledger.executionContractHash === sha256File(EXECUTION_CONTRACT_PATH), errors, 'ledger executionContractHash must match current execution contract');
  expect(ledger.sourceAuditPath === AUDIT_PATH, errors, `ledger sourceAuditPath must be ${AUDIT_PATH}`);
  expect(ledger.sourceRegistryPath === REGISTRY_PATH, errors, `ledger sourceRegistryPath must be ${REGISTRY_PATH}`);
  expect(ledger.sourceSummaryPath === SUMMARY_PATH, errors, `ledger sourceSummaryPath must be ${SUMMARY_PATH}`);
  expect(isObject(ledger.counts), errors, 'ledger counts must be object');
  expect(isObject(ledger.queueOrderProof), errors, 'ledger queueOrderProof must be object');
  expect(ledger.queueOrderProof?.firstPath === 'scripts/analytics-cluster.ts', errors, 'ledger first queue path mismatch');
  expect(ledger.queueOrderProof?.lastPath === 'scripts/write-runtime-registry.js', errors, 'ledger last queue path mismatch');

  const requiredEntryFields = [
    'callerSwitchPlan',
    'runnerApi',
    'cliProbeCommand',
    'buildCopyPlan',
    'testPaths',
    'workspacePackage',
    'targetExistenceProof',
    'rootScriptDependencyForbidden',
    'smokeProbe',
  ];

  const seen = new Set();
  for (const entry of entries) {
    const id = entry.originalPath || '<unknown>';
    expect(!seen.has(id), errors, `duplicate ledger entry ${id}`);
    seen.add(id);
    for (const key of requiredEntryFields) {
      expect(Object.prototype.hasOwnProperty.call(entry, key), errors, `${id}: missing ${key}`);
    }
    expect(Array.isArray(entry.targetPaths) && entry.targetPaths.length > 0, errors, `${id}: targetPaths must be non-empty`);
    expect(Array.isArray(entry.callerSwitchPlan), errors, `${id}: callerSwitchPlan must be an array`);
    if (Array.isArray(entry.callerSwitchPlan)) {
      if (entry.callerSwitchPlan.length === 0) {
        expect(
          entry.callerSwitchStatus === 'not_applicable' && nonEmpty(entry.callerSwitchNotApplicableReason),
          errors,
          `${id}: callerSwitchPlan empty without not-applicable reason`
        );
      }
      entry.callerSwitchPlan.forEach((plan, index) => {
        expect(isObject(plan), errors, `${id}: callerSwitchPlan[${index}] must be object`);
        expect(nonEmpty(plan?.targetPath), errors, `${id}: callerSwitchPlan[${index}].targetPath missing`);
        expect(nonEmpty(plan?.action), errors, `${id}: callerSwitchPlan[${index}].action missing`);
        expect(nonEmpty(plan?.status), errors, `${id}: callerSwitchPlan[${index}].status missing`);
        expect(Array.isArray(plan?.proofCommandIds), errors, `${id}: callerSwitchPlan[${index}].proofCommandIds missing`);
      });
    }
    expect(isObject(entry.runnerApi), errors, `${id}: runnerApi must be object`);
    for (const key of [
      'moduleFormat',
      'exportName',
      'cwdPolicy',
      'argumentPolicy',
      'stdoutPolicy',
      'stderrPolicy',
      'exitCodePolicy',
    ]) {
      expect(nonEmpty(entry.runnerApi?.[key]), errors, `${id}: runnerApi.${key} missing`);
    }
    if (entry.cliProbeCommand !== null && entry.cliProbeCommand !== undefined) {
      expect(isObject(entry.cliProbeCommand), errors, `${id}: cliProbeCommand must be object or null`);
      expect(nonEmpty(entry.cliProbeCommand?.command), errors, `${id}: cliProbeCommand.command missing`);
      expect(nonEmpty(entry.cliProbeCommand?.cwd), errors, `${id}: cliProbeCommand.cwd missing`);
      expect(Object.prototype.hasOwnProperty.call(entry.cliProbeCommand || {}, 'expectedExitCode'), errors, `${id}: cliProbeCommand.expectedExitCode missing`);
      expect(Object.prototype.hasOwnProperty.call(entry.cliProbeCommand || {}, 'provesCommandAvailability'), errors, `${id}: cliProbeCommand.provesCommandAvailability missing`);
    }
    expect(Array.isArray(entry.buildCopyPlan), errors, `${id}: buildCopyPlan must be an array`);
    if (Array.isArray(entry.buildCopyPlan)) {
      if (entry.buildCopyPlan.length === 0) {
        expect(nonEmpty(entry.buildCopyNotApplicableReason), errors, `${id}: buildCopyPlan empty without reason`);
      }
      entry.buildCopyPlan.forEach((plan, index) => {
        expect(isObject(plan), errors, `${id}: buildCopyPlan[${index}] must be object`);
        expect(nonEmpty(plan?.sourcePath), errors, `${id}: buildCopyPlan[${index}].sourcePath missing`);
        expect(nonEmpty(plan?.targetPath), errors, `${id}: buildCopyPlan[${index}].targetPath missing`);
        expect(nonEmpty(plan?.copyCommandId), errors, `${id}: buildCopyPlan[${index}].copyCommandId missing`);
      });
    }
    expect(Array.isArray(entry.testPaths), errors, `${id}: testPaths must be an array`);
    if (Array.isArray(entry.testPaths) && entry.testPaths.length === 0) {
      expect(nonEmpty(entry.testNotApplicableReason), errors, `${id}: testPaths empty without reason`);
    }
    expect(isObject(entry.workspacePackage), errors, `${id}: workspacePackage must be object`);
    expect(nonEmpty(entry.workspacePackage?.name), errors, `${id}: workspacePackage.name missing`);
    expect(nonEmpty(entry.workspacePackage?.path), errors, `${id}: workspacePackage.path missing`);
    expect(nonEmpty(entry.workspacePackage?.packageJsonPath), errors, `${id}: workspacePackage.packageJsonPath missing`);
    expect(nonEmpty(entry.workspacePackage?.buildCommandId), errors, `${id}: workspacePackage.buildCommandId missing`);
    expect(
      nonEmpty(entry.workspacePackage?.testCommandId) || nonEmpty(entry.workspacePackage?.testNotApplicableReason),
      errors,
      `${id}: workspacePackage test command or not-applicable reason missing`
    );
    expect(isObject(entry.targetExistenceProof), errors, `${id}: targetExistenceProof must be object`);
    expect(Array.isArray(entry.targetExistenceProof?.sourcePaths) && entry.targetExistenceProof.sourcePaths.length > 0, errors, `${id}: targetExistenceProof.sourcePaths missing`);
    expect(Array.isArray(entry.targetExistenceProof?.distPaths), errors, `${id}: targetExistenceProof.distPaths missing`);
    expect(Array.isArray(entry.targetExistenceProof?.proofCommandIds), errors, `${id}: targetExistenceProof.proofCommandIds missing`);
    expect(isObject(entry.rootScriptDependencyForbidden), errors, `${id}: rootScriptDependencyForbidden must be object`);
    expect(nonEmpty(entry.rootScriptDependencyForbidden?.originalPath), errors, `${id}: rootScriptDependencyForbidden.originalPath missing`);
    expect(Array.isArray(entry.rootScriptDependencyForbidden?.scanScopes), errors, `${id}: rootScriptDependencyForbidden.scanScopes missing`);
    expect(Array.isArray(entry.rootScriptDependencyForbidden?.forbiddenDependencyForms), errors, `${id}: rootScriptDependencyForbidden.forbiddenDependencyForms missing`);
    expect(Array.isArray(entry.rootScriptDependencyForbidden?.proofCommandIds), errors, `${id}: rootScriptDependencyForbidden.proofCommandIds missing`);
    expect(isObject(entry.smokeProbe), errors, `${id}: smokeProbe must be object`);
    expect(nonEmpty(entry.smokeProbe?.probeId), errors, `${id}: smokeProbe.probeId missing`);
    expect(SMOKE_PROBE_TYPES.has(entry.smokeProbe?.probeType), errors, `${id}: smokeProbe.probeType invalid ${entry.smokeProbe?.probeType}`);
    expect(nonEmpty(entry.smokeProbe?.commandId), errors, `${id}: smokeProbe.commandId missing`);
    expect(nonEmpty(entry.smokeProbe?.cwd), errors, `${id}: smokeProbe.cwd missing`);
    expect(Array.isArray(entry.smokeProbe?.argv), errors, `${id}: smokeProbe.argv missing`);
    expect(nonEmpty(entry.smokeProbe?.inputFixture), errors, `${id}: smokeProbe.inputFixture missing`);
    expect(Object.prototype.hasOwnProperty.call(entry.smokeProbe || {}, 'expectedExitCode'), errors, `${id}: smokeProbe.expectedExitCode missing`);
    expect(nonEmpty(entry.smokeProbe?.expectedResult), errors, `${id}: smokeProbe.expectedResult missing`);
    expect(nonEmpty(entry.smokeProbe?.stderrPolicy), errors, `${id}: smokeProbe.stderrPolicy missing`);
    expect(
      nonEmpty(entry.smokeProbe?.expectedStdout) || nonEmpty(entry.smokeProbe?.expectedArtifactEffect),
      errors,
      `${id}: smokeProbe expectedStdout or expectedArtifactEffect missing`
    );
  }
  return ledger;
}

function validateSurfaces(errors) {
  for (const surface of SURFACES) expect(exists(surface), errors, `missing validation surface: ${surface}`);
}

function validateAuditAndRegistryBaseline(errors, ledger) {
  const audit = readJson(AUDIT_PATH, errors);
  const registry = readYaml(REGISTRY_PATH, errors);
  if (!audit || !registry || !ledger) return;
  const queue = Array.isArray(audit.consumerReachableMigrationQueue) ? audit.consumerReachableMigrationQueue : [];
  expect(queue.length === 102, errors, `audit consumerReachableMigrationQueue expected 102 got ${queue.length}`);
  const ledgerPaths = ledgerEntries(ledger).map((entry) => entry.originalPath);
  expect(JSON.stringify(queue) === JSON.stringify(ledgerPaths), errors, 'ledger path order must match audit queue order');
  const waves = Array.isArray(registry?.waves) ? registry.waves : [];
  const wave = waves.find((item) => item.waveId === WAVE_ID);
  expect(Boolean(wave), errors, `registry missing ${WAVE_ID}`);
  const registryEntries = new Map((wave?.entries || []).map((entry) => [entry.originalPath, entry]));
  for (const entry of ledgerEntries(ledger)) {
    const registryEntry = registryEntries.get(entry.originalPath);
    expect(Boolean(registryEntry), errors, `registry missing ledger entry ${entry.originalPath}`);
    if (registryEntry) {
      for (const key of [
        'entryId',
        'originalClassBeforeMigration',
        'migrationStrategy',
        'callerSwitchStatus',
        'migrationStatus',
        'validationStatus',
        'deletionAllowed',
      ]) {
        expect(entry[key] === registryEntry[key], errors, `${entry.originalPath}: ledger ${key} does not match registry`);
      }
    }
  }
}

function validateRootRetention(errors, ledger) {
  for (const entry of ledgerEntries(ledger)) {
    expect(exists(entry.originalPath), errors, `root script missing: ${entry.originalPath}`);
    expect(entry.deletionAllowed === false, errors, `${entry.originalPath}: deletionAllowed must be false`);
    expect(entry.deletionApprovalRef === null, errors, `${entry.originalPath}: deletionApprovalRef must be null`);
  }
}

function packageSourceTargets(entry) {
  return (entry.targetPaths || []).filter((targetPath) => {
    if (targetPath === 'packages/bmad-speckit/bin/bmad-speckit.js') return false;
    if (targetPath.includes('/dist/')) return false;
    return targetPath.startsWith('packages/');
  });
}

function validateCategory(phase, errors, ledger) {
  const expectation = CATEGORY_EXPECTATIONS[phase];
  const entries = ledgerEntries(ledger).filter((entry) => {
    return entry.originalClassBeforeMigration === expectation.className && entry.migrationStrategy === expectation.strategy;
  });
  expect(entries.length === expectation.expectedCount, errors, `${phase} expected ${expectation.expectedCount} entries got ${entries.length}`);
  for (const entry of entries) {
    for (const targetPath of packageSourceTargets(entry)) {
      expect(exists(targetPath), errors, `${phase}: missing source target ${targetPath}`);
    }
  }
}

function validateTargetExistence(errors, ledger) {
  for (const entry of ledgerEntries(ledger)) {
    for (const targetPath of entry.targetExistenceProof?.sourcePaths || []) {
      expect(exists(targetPath), errors, `${entry.originalPath}: missing package source target ${targetPath}`);
    }
    for (const targetPath of entry.targetExistenceProof?.distPaths || []) {
      expect(exists(targetPath), errors, `${entry.originalPath}: missing dist target ${targetPath}`);
    }
  }
}

function validateCallerSwitch(errors, ledger) {
  const forbidden = [
    /\b(?:npx|pnpm|yarn|node)\s+(?:[^'"`;&|]*\s+)?tsx\b/u,
    /\b(?:npx|pnpm|yarn|node)\s+(?:[^'"`;&|]*\s+)?ts-node\b/u,
    /\brequire\(['"]tsx['"]\)/u,
    /\brequire\(['"]ts-node(?:\/register)?['"]\)/u,
    /\bfrom\s+['"]tsx['"]/u,
    /\bfrom\s+['"]ts-node(?:\/register)?['"]/u,
    /scripts[\\/][^'")\s]+\.ts/u,
    /compiled[\\/]main-agent-orchestration\.cjs/u,
  ];
  const scanned = new Set();
  for (const entry of ledgerEntries(ledger)) {
    for (const scanScope of entry.rootScriptDependencyForbidden?.scanScopes || []) {
      if (!exists(scanScope) || scanned.has(scanScope)) continue;
      scanned.add(scanScope);
      const text = readText(scanScope, errors);
      for (const pattern of forbidden) {
        expect(!pattern.test(text), errors, `${scanScope}: forbidden dependency form ${pattern}`);
      }
    }
  }
}

function validatePackageCommandEvidence(errors, ledger) {
  const artifact = readJson(`${WAVE_DIR}/package-command-evidence.json`, errors);
  if (!artifact) return;
  expect(artifact.waveId === WAVE_ID, errors, 'package-command-evidence waveId mismatch');
  expect(artifact.queueHash === EXPECTED_QUEUE_HASH, errors, 'package-command-evidence queueHash mismatch');
  const rows = Array.isArray(artifact.rows) ? artifact.rows : [];
  const commandsById = new Set(rows.map((row) => row.commandId).filter(Boolean));
  for (const entry of ledgerEntries(ledger)) {
    for (const plan of entry.buildCopyPlan || []) {
      expect(commandsById.has(plan.copyCommandId), errors, `${entry.originalPath}: missing build command evidence ${plan.copyCommandId}`);
    }
    if (entry.workspacePackage?.testCommandId) {
      expect(commandsById.has(entry.workspacePackage.testCommandId), errors, `${entry.originalPath}: missing test command evidence ${entry.workspacePackage.testCommandId}`);
    }
  }
  for (const row of rows) {
    expect(['passed', 'not_applicable'].includes(row.status), errors, `package command ${row.commandId || row.command}: invalid status ${row.status}`);
    expect(Array.isArray(row.touchedTargetPaths), errors, `package command ${row.commandId || row.command}: touchedTargetPaths missing`);
    if (row.status === 'not_applicable') {
      expect(row.ledgerQuery?.provesNotApplicable === true, errors, `package command ${row.commandId || row.command}: missing not-applicable proof`);
    }
  }
}

function validateInstall(errors) {
  const matrix = readJson(`${WAVE_DIR}/install-matrix.json`, errors);
  if (!matrix) return;
  expect(matrix.waveId === WAVE_ID, errors, 'install-matrix waveId mismatch');
  expect(matrix.queueHash === EXPECTED_QUEUE_HASH, errors, 'install-matrix queueHash mismatch');
  expect(matrix.status === 'passed', errors, 'install-matrix status must be passed');
  const coverage = matrix.categoryCoverage || {};
  for (const category of ['consumer_runtime_reachable', 'package_runtime_helper', 'public_cli']) {
    expect(Array.isArray(coverage[category]) && coverage[category].length > 0, errors, `install-matrix missing categoryCoverage ${category}`);
  }
  for (const mode of matrix.modes || []) {
    for (const row of mode.rows || []) {
      expect(row.usedRootScript === false, errors, `${mode.mode || mode.installMode}: ${row.rowId} usedRootScript must be false`);
      expect(row.usedTsx === false, errors, `${mode.mode || mode.installMode}: ${row.rowId} usedTsx must be false`);
      expect(row.usedTsNode === false, errors, `${mode.mode || mode.installMode}: ${row.rowId} usedTsNode must be false`);
      expect(row.usedCompiledFallback === false, errors, `${mode.mode || mode.installMode}: ${row.rowId} usedCompiledFallback must be false`);
      expect(
        typeof row.installSandboxPath === 'string' && row.installSandboxPath.startsWith(`${WAVE_DIR}/install-sandbox/`),
        errors,
        `${mode.mode || mode.installMode}: ${row.rowId} installSandboxPath must stay under install-sandbox`
      );
    }
  }
}

function validateSafeWriteReceipts(errors, requiredTargets = []) {
  const receipts = readJson(SAFE_WRITE_PATH, errors, { required: requiredTargets.length > 0 });
  if (!receipts) return;
  expect(receipts.waveId === WAVE_ID, errors, 'safe-write-receipts waveId mismatch');
  expect(Array.isArray(receipts.receipts), errors, 'safe-write-receipts.receipts must be array');
  const passed = new Map((receipts.receipts || []).filter((receipt) => receipt.status === 'passed').map((receipt) => [receipt.targetPath, receipt]));
  for (const target of requiredTargets) {
    const receipt = passed.get(target);
    expect(Boolean(receipt), errors, `missing passed safe-write receipt for ${target}`);
    if (receipt && exists(target)) {
      expect(sha256File(target) === receipt.sha256, errors, `safe-write receipt hash mismatch for ${target}`);
    }
  }
}

function explicitContractWriteUnion() {
  return new Set([
    WAVE_DIR,
    `${WAVE_DIR}/migration-ledger.json`,
    `${WAVE_DIR}/scope-baseline.json`,
    `${WAVE_DIR}/package-command-evidence.json`,
    `${WAVE_DIR}/install-matrix.json`,
    `${WAVE_DIR}/evidence.json`,
    `${WAVE_DIR}/summary.md`,
    `${WAVE_DIR}/safe-write-receipts.json`,
    `${WAVE_DIR}/registry-evidence.json`,
    REGISTRY_PATH,
    'package.json',
    'packages/bmad-speckit/package.json',
    'tools/script-migration/validate-main-agent-runtime-migration-wave-3-12.cjs',
    'tools/script-migration/run-main-agent-wave-3-12-install-matrix.cjs',
    'tools/script-migration/run-main-agent-wave-3-12-package-command.cjs',
    'tools/script-migration/safe-write-main-agent-wave-3-12-artifact.cjs',
    'tests/acceptance/main-agent-runtime-migration-wave-3-12-contract.test.ts',
    'packages/scoring/eval-questions/__tests__/cli-integration.test.ts',
    'packages/scoring/scripts/run-tests.cjs',
    'packages/bmad-speckit/tests/main-agent-wave-3-12-runtime-modules.test.js',
    'packages/bmad-speckit/tests/main-agent-wave-3-12-durable-helpers.test.js',
    'packages/bmad-speckit/tests/main-agent-wave-3-12-public-cli.test.js',
  ]);
}

function ledgerAllowedWriteUnion(ledger) {
  const allowed = explicitContractWriteUnion();
  for (const entry of ledgerEntries(ledger)) {
    for (const targetPath of entry.targetPaths || []) allowed.add(normalizePath(targetPath));
    for (const targetPath of entry.testPaths || []) allowed.add(normalizePath(targetPath));
    for (const plan of entry.callerSwitchPlan || []) {
      if (plan?.targetPath) allowed.add(normalizePath(plan.targetPath));
    }
    for (const plan of entry.buildCopyPlan || []) {
      if (plan?.targetPath) allowed.add(normalizePath(plan.targetPath));
    }
  }
  return allowed;
}

function isAllowedByPrefix(relativePath) {
  return relativePath.startsWith(`${WAVE_DIR}/install-sandbox/`);
}

function gitStatusRows() {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('git', ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) throw new Error(`git status --short failed: ${result.stderr || result.stdout}`);
  return String(result.stdout || '')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => ({
      status: line.slice(0, 2),
      path: normalizePath(line.slice(3).trim()),
      raw: line,
    }));
}

function untrackedFilesUnder(relativePath) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('git', ['ls-files', '--others', '--exclude-standard', '--', normalizePath(relativePath)], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) throw new Error(`git ls-files --others failed: ${result.stderr || result.stdout}`);
  return String(result.stdout || '')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map(normalizePath);
}

function isAllowedCollapsedUntrackedDirectory(relativePath, allowed) {
  if (!relativePath.endsWith('/')) return false;
  const files = untrackedFilesUnder(relativePath);
  return files.length > 0 && files.every((filePath) => allowed.has(filePath) || isAllowedByPrefix(filePath));
}

function validateScope(errors, ledger) {
  const baseline = readJson(SCOPE_BASELINE_PATH, errors);
  if (!baseline) return;
  expect(baseline.waveId === WAVE_ID, errors, 'scope-baseline waveId mismatch');
  expect(Array.isArray(baseline.statusRows), errors, 'scope-baseline.statusRows must be array');
  const baselineRows = new Set((baseline.statusRows || []).map((row) => normalizePath(row.path)));
  const allowed = ledgerAllowedWriteUnion(ledger);
  const forbidden = [];
  for (const row of gitStatusRows()) {
    const rowPath = normalizePath(row.path);
    if (baselineRows.has(rowPath)) continue;
    if (allowed.has(rowPath)) continue;
    if (isAllowedByPrefix(rowPath)) continue;
    if (isAllowedCollapsedUntrackedDirectory(rowPath, allowed)) continue;
    forbidden.push(row);
  }
  expect(forbidden.length === 0, errors, `scope changed paths outside allowed union: ${JSON.stringify(forbidden)}`);
}

function validateEvidence(errors, ledger) {
  const evidence = readJson(`${WAVE_DIR}/evidence.json`, errors);
  if (!evidence) return;
  expect(evidence.waveId === WAVE_ID, errors, 'evidence waveId mismatch');
  expect(evidence.queueHash === EXPECTED_QUEUE_HASH, errors, 'evidence queueHash mismatch');
  expect(evidence.sourcePlanPath === SUMMARY_PATH, errors, 'evidence sourcePlanPath mismatch');
  expect(evidence.sourcePlanHash === EXPECTED_SOURCE_PLAN_HASH, errors, 'evidence sourcePlanHash mismatch');
  expect(evidence.executionContractPath === EXECUTION_CONTRACT_PATH, errors, 'evidence executionContractPath mismatch');
  expect(evidence.executionContractHash === sha256File(EXECUTION_CONTRACT_PATH), errors, 'evidence executionContractHash mismatch');
  expect(evidence.auditContractPath === AUDIT_CONTRACT_PATH, errors, 'evidence auditContractPath mismatch');
  expect(Array.isArray(evidence.entries) && evidence.entries.length === ledgerEntries(ledger).length, errors, 'evidence entries must cover ledger entries');
  for (const entry of evidence.entries || []) {
    expect(Array.isArray(entry.evidenceCommandIds) && entry.evidenceCommandIds.length > 0, errors, `${entry.originalPath}: evidenceCommandIds missing`);
    expect(entry.result === 'passed', errors, `${entry.originalPath}: evidence result must be passed`);
    expect(entry.validationStatus === 'passed', errors, `${entry.originalPath}: evidence validationStatus must be passed`);
    expect(isObject(entry.smokeProbeResult), errors, `${entry.originalPath}: smokeProbeResult missing`);
    expect(
      (Array.isArray(entry.packageCommandEvidenceRefs) && entry.packageCommandEvidenceRefs.length > 0) ||
        (Array.isArray(entry.installMatrixProbeIds) && entry.installMatrixProbeIds.length > 0),
      errors,
      `${entry.originalPath}: package command or install matrix evidence refs missing`
    );
    expect(isObject(entry.artifactHashRefs), errors, `${entry.originalPath}: artifactHashRefs missing`);
  }
  validateSafeWriteReceipts(errors, [
    `${WAVE_DIR}/evidence.json`,
    `${WAVE_DIR}/install-matrix.json`,
    `${WAVE_DIR}/package-command-evidence.json`,
  ]);
}

function validateRegistryFinal(errors, ledger) {
  const registry = readYaml(REGISTRY_PATH, errors);
  if (!registry) return;
  const wave = (registry.waves || []).find((item) => item.waveId === WAVE_ID);
  expect(Boolean(wave), errors, `registry missing ${WAVE_ID}`);
  expect(wave?.status === 'completed' || wave?.status === 'validated', errors, `registry wave status must be completed/validated got ${wave?.status}`);
  expect(String(wave?.title || '').includes('runtime migration'), errors, 'registry wave title must include runtime migration');
  expect(!String(wave?.title || '').endsWith('full physical script closure audit'), errors, 'registry wave title must not remain full physical script closure audit');
  const entries = new Map((wave?.entries || []).map((entry) => [entry.originalPath, entry]));
  for (const ledgerEntry of ledgerEntries(ledger)) {
    const entry = entries.get(ledgerEntry.originalPath);
    expect(Boolean(entry), errors, `registry final missing ${ledgerEntry.originalPath}`);
    if (!entry) continue;
    expect(entry.migrationStatus === 'validated', errors, `${entry.originalPath}: migrationStatus must be validated`);
    expect(entry.validationStatus === 'passed', errors, `${entry.originalPath}: validationStatus must be passed`);
    expect(entry.deletionAllowed === false, errors, `${entry.originalPath}: deletionAllowed must be false`);
    expect(entry.deletionApprovalRef === null, errors, `${entry.originalPath}: deletionApprovalRef must be null`);
    expect((entry.evidenceRefs || []).includes(`${WAVE_DIR}/evidence.json`), errors, `${entry.originalPath}: evidenceRefs missing evidence.json`);
  }
}

function validatePhase(phase, errors) {
  const ledger = validateLedgerSchema(errors);
  if (phase === 'bootstrap') {
    validateSurfaces(errors);
    validateAuditAndRegistryBaseline(errors, ledger);
    validateRootRetention(errors, ledger);
    validateSafeWriteReceipts(errors, [LEDGER_PATH, SCOPE_BASELINE_PATH]);
    return;
  }
  validateAuditAndRegistryBaseline(errors, ledger);
  validateRootRetention(errors, ledger);
  if (phase === 'actions' || phase === 'helpers' || phase === 'public-cli') validateCategory(phase, errors, ledger);
  else if (phase === 'target-existence') validateTargetExistence(errors, ledger);
  else if (phase === 'caller-switch') validateTargetExistence(errors, ledger), validateCallerSwitch(errors, ledger);
  else if (phase === 'builds') validatePackageCommandEvidence(errors, ledger);
  else if (phase === 'install') validateInstall(errors);
  else if (phase === 'evidence') validateEvidence(errors, ledger);
  else if (phase === 'root-retention') validateRootRetention(errors, ledger);
  else if (phase === 'scope') validateScope(errors, ledger);
  else if (phase === 'final') {
    validateCategory('actions', errors, ledger);
    validateCategory('helpers', errors, ledger);
    validateCategory('public-cli', errors, ledger);
    validateTargetExistence(errors, ledger);
    validateCallerSwitch(errors, ledger);
    validatePackageCommandEvidence(errors, ledger);
    validateInstall(errors);
    validateEvidence(errors, ledger);
    validateRegistryFinal(errors, ledger);
    validateScope(errors, ledger);
  }
}

function main() {
  const errors = [];
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    validatePhase(args.phase, errors);
  } catch (error) {
    errors.push(error.stack || error.message);
  }
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    waveId: WAVE_ID,
    phase: args?.phase || 'unknown',
    ledgerPath: normalizePath(LEDGER_PATH),
    cwd: ROOT,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
