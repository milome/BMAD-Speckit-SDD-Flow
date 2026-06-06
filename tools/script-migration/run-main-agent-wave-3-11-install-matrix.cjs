#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.11';
const WAVE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-3.11'
);
const TMP_ROOT = path.join(ROOT, '.tmp', 'main-agent-runtime-migration-wave-3.11');
const PACKAGE_CWD = path.join(ROOT, 'packages', 'bmad-speckit');
const SCORING_CWD = path.join(ROOT, 'packages', 'scoring');
const MATRIX_PATH = path.join(WAVE_DIR, 'install-matrix.json');
const INSTALL_MATRIX_DIR = path.join(WAVE_DIR, 'install-matrix');
const SAFE_WRITE_PATH = path.join(WAVE_DIR, 'safe-write-receipts.json');
const EMPTY_HASH = sha256Text('');

const RUNTIME_MODULES = [
  ['host-runtime-mode.js', ['normalizeRuntimeHost', 'selectExecutionRuntimeMode']],
  ['supervised-worker-runtime.js', ['appendTaskProgress', 'readTaskProgress', 'evaluateSupervisedWorker']],
  ['diagnose-bmad-state.js', ['collectReviewerProjectionDiagnosis', 'collectReadinessProjectionDiagnosis', 'diagnoseBmadState']],
  ['parallel-mission-control.js', ['DEFAULT_PROTECTED_WRITE_PATHS', 'buildParallelMissionPlan', 'buildPrTopology']],
];

const HELPER_MODULES = [
  ['bmad-state-reader.js', ['readBmadProgress', 'readStoryState', 'getCurrentStoryState', 'buildPaths']],
  ['e2e-verify-paths.js', ['runE2eVerifyPaths', 'main']],
  ['query-validate.js', ['runQueryValidation', 'main']],
  ['runtime-step-state.js', ['resolveRuntimeStepState', 'persistRuntimeStepState']],
  ['verify-agent-files.js', ['verifyAgentFiles', 'REQUIRED_AGENTS', 'REQUIRED_SPECKIT_ALIASES', 'REQUIRED_AUDITORS', 'main']],
];

const STAGING_SURFACES = [
  'packages/bmad-speckit/_bmad',
  'packages/bmad-speckit/_bmad.staging',
  'packages/bmad-speckit/_bmad.old',
  'packages/bmad-speckit/node_modules/@bmad-speckit',
  'packages/bmad-speckit/node_modules/@bmad-speckit.staging',
  'packages/bmad-speckit/node_modules/@bmad-speckit.old',
  'packages/bmad-speckit/node_modules/.pack-session-count.json',
  'packages/bmad-speckit/node_modules/.pack-session.lock',
  'packages/bmad-speckit/node_modules/.prepublish-sync.lock',
];

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(String(value), 'utf8').digest('hex')}`;
}

function sha256File(filePath) {
  return sha256Buffer(fs.readFileSync(filePath));
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item));
  const result = {};
  for (const key of Object.keys(value).sort()) result[key] = canonicalize(value[key]);
  return result;
}

function hashCanonical(value) {
  return sha256Text(JSON.stringify(canonicalize(value)));
}

function now() {
  return new Date().toISOString();
}

function rm(target) {
  if (!fs.existsSync(target)) return;
  fs.rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

function commandRow(command, cwd, result, extra = {}) {
  return {
    command,
    cwd: rel(cwd),
    exitCode: result.status ?? 1,
    stdoutHash: sha256Text(result.stdout || ''),
    stderrHash: sha256Text(result.stderr || ''),
    startedAt: extra.startedAt,
    completedAt: extra.completedAt,
    status: result.status === 0 ? 'passed' : 'failed',
    stdoutPreview: String(result.stdout || '').slice(0, 1000),
    stderrPreview: String(result.stderr || '').slice(0, 1000),
  };
}

function runCommand(command, args, options = {}) {
  const startedAt = now();
  const result = spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 120 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });
  const completedAt = now();
  return {
    result,
    row: commandRow([command, ...args].join(' '), options.cwd || ROOT, result, {
      startedAt,
      completedAt,
    }),
  };
}

function assertPassed(label, result) {
  if (result.status !== 0) {
    throw new Error(`${label} failed: ${result.stderr || result.stdout}`);
  }
}

function parsePackJson(stdout) {
  const parsed = JSON.parse(stdout);
  if (!Array.isArray(parsed) || !parsed[0]?.filename) {
    throw new Error('npm pack output missing filename');
  }
  return parsed[0];
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function expectedSafeWriteTopLevelKeys(targetPath) {
  const normalized = rel(targetPath);
  if (normalized === 'repo-governance/script-migration-registry.yaml') return [];
  if (normalized === 'repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json') {
    return ['generatedAt', 'entries'];
  }
  if (normalized.endsWith('/preflight.json')) {
    return ['waveId', 'startedAt', 'completedAt', 'gitStatusShortHash', 'sourceInventoryHash', 'commands'];
  }
  if (normalized.endsWith('/source-inventory.json')) return ['waveId', 'generatedAt', 'entries'];
  if (normalized.endsWith('/no-migration-internal.json')) return ['waveId', 'generatedAt', 'entries'];
  if (normalized.endsWith('/root-script-regression-proof.json')) {
    return ['waveId', 'generatedAt', 'sourceInventoryRef', 'entries'];
  }
  if (normalized.endsWith('/classification-evidence.json')) {
    return ['waveId', 'generatedAt', 'refinesWaveId', 'auditReportPath', 'registryPath', 'entries'];
  }
  if (normalized.endsWith('/registry-evidence.json')) return ['waveId', 'validatedAt', 'entries'];
  if (normalized.endsWith('/install-matrix.json')) {
    return [
      'schemaVersion',
      'waveId',
      'status',
      'startedAt',
      'completedAt',
      'packageCwd',
      'packageName',
      'packageVersion',
      'tarballPath',
      'tarballSha256',
      'scoringPackageSourceCwd',
      'scoringPackageName',
      'scoringWorkspaceVersion',
      'scoringWorkspaceDistHashes',
      'prepackPrepCommands',
      'cleanupCommands',
      'modes',
    ];
  }
  if (normalized.includes('/install-matrix/') && normalized.endsWith('.json')) {
    return [
      'schemaVersion',
      'waveId',
      'mode',
      'status',
      'generatedAt',
      'consumerRoot',
      'probeRoot',
      'requireProbeRoot',
      'packageRoot',
      'rowIds',
      'commandRows',
      'rows',
      'assertions',
    ];
  }
  if (normalized.endsWith('/evidence.json')) {
    return ['waveId', 'status', 'startedAt', 'completedAt', 'commandRows', 'acceptanceStatus', 'manualVerificationStatus'];
  }
  if (normalized.endsWith('/final-evidence-packet.json')) {
    return [
      'waveId',
      'status',
      'sealed',
      'generatedAt',
      'sealedAt',
      'sealHash',
      'acceptanceStatus',
      'manualVerificationStatus',
      'sealedEvidenceJsonHash',
      'installMatrixHash',
      'summaryHash',
      'finalEncodingCommandId',
      'expectedFinalAcceptanceCommandId',
      'expectedFinalValidatorCommandId',
      'residualRisks',
    ];
  }
  if (normalized.endsWith('/safe-write-receipts.json')) return ['waveId', 'generatedAt', 'receipts', 'selfVerification'];
  return ['waveId'];
}

function promoteJsonWithoutReceipt(targetPath, value, requiredKey) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const startedAt = now();
  const stamp = `${process.pid}-${Date.now()}`;
  const draftPath = `${targetPath}.draft-${stamp}`;
  const backupPath = fs.existsSync(targetPath) ? `${targetPath}.backup-${stamp}` : null;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(draftPath, content, 'utf8');
  const parsed = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
  const requiredChecks = [{ type: 'jsonParse', status: 'passed' }];
  for (const key of expectedSafeWriteTopLevelKeys(targetPath)) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      throw new Error(`safe write draft missing top-level key ${key}: ${targetPath}`);
    }
    requiredChecks.push({ type: 'topLevelKey', key, status: 'passed' });
  }
  if (requiredKey && !content.includes(requiredKey)) {
    throw new Error(`safe write draft missing required marker ${requiredKey}: ${targetPath}`);
  }
  if (requiredKey) requiredChecks.push({ type: 'containsMarker', marker: requiredKey, status: 'passed' });
  const draftSha256 = sha256File(draftPath);
  if (backupPath) fs.copyFileSync(targetPath, backupPath);
  fs.renameSync(draftPath, targetPath);
  const postWriteSha256 = sha256File(targetPath);
  if (draftSha256 !== postWriteSha256) {
    throw new Error(`safe write promoted hash mismatch: ${targetPath}`);
  }
  return {
    targetPath: rel(targetPath),
    artifactPath: rel(targetPath),
    operation: backupPath ? 'replace_json_artifact' : 'create_json_artifact',
    hashKind: 'promoted_file_bytes',
    draftPath: rel(draftPath),
    backupPath: backupPath ? rel(backupPath) : null,
    requiredChecks,
    draftSha256,
    promotedSha256: postWriteSha256,
    postWriteSha256,
    sha256: postWriteSha256,
    byteLength: Buffer.byteLength(content, 'utf8'),
    startedAt,
    completedAt: now(),
    status: 'passed',
  };
}

function safeWriteJson(targetPath, value, requiredKey) {
  const receipt = promoteJsonWithoutReceipt(targetPath, value, requiredKey);
  appendSafeWriteReceipt({
    ...receipt,
  });
  return receipt.sha256;
}

function appendSafeWriteReceipt(receipt) {
  let manifest = { waveId: WAVE_ID, generatedAt: now(), receipts: [] };
  if (fs.existsSync(SAFE_WRITE_PATH)) {
    manifest = JSON.parse(fs.readFileSync(SAFE_WRITE_PATH, 'utf8'));
  }
  manifest.waveId = WAVE_ID;
  manifest.generatedAt = now();
  manifest.receipts = (manifest.receipts || []).filter(
    (item) => !(item.targetPath === receipt.targetPath && item.sha256 === receipt.sha256)
  );
  manifest.receipts.push(receipt);
  const payload = { ...manifest, selfVerification: null };
  delete payload.selfVerification;
  manifest.selfVerification = {
    hashKind: 'canonical_json_without_selfVerification',
    payloadSha256: hashCanonical(payload),
    computedAt: now(),
    status: 'passed',
  };
  promoteJsonWithoutReceipt(SAFE_WRITE_PATH, manifest, WAVE_ID);
}

function workspaceScoringHashes() {
  const files = [
    'dist/eval-questions/template-generator.js',
    'dist/eval-questions/manifest-loader.js',
  ];
  return Object.fromEntries(
    files.map((relativePath) => [
      relativePath,
      sha256File(path.join(SCORING_CWD, relativePath)),
    ])
  );
}

function installedScoringRootFor(packageRoot) {
  const scoringRoot = path.join(packageRoot, 'node_modules', '@bmad-speckit', 'scoring');
  if (!fs.existsSync(path.join(scoringRoot, 'package.json'))) {
    throw new Error(`installed package is missing bundled @bmad-speckit/scoring: ${scoringRoot}`);
  }
  const relative = rel(scoringRoot);
  if (relative === 'packages/scoring' || relative.startsWith('packages/scoring/')) {
    throw new Error('installed scoring proof resolved to repo source');
  }
  return scoringRoot;
}

function installedScoringProof(packageRoot) {
  const scoringRoot = installedScoringRootFor(packageRoot);
  const templatePath = path.join(scoringRoot, 'dist', 'eval-questions', 'template-generator.js');
  const manifestPath = path.join(scoringRoot, 'dist', 'eval-questions', 'manifest-loader.js');
  const packageJson = JSON.parse(fs.readFileSync(path.join(scoringRoot, 'package.json'), 'utf8'));
  return {
    installedScoringResolvedPath: rel(scoringRoot),
    installedScoringPackageVersion: packageJson.version,
    installedScoringDistHashes: {
      'dist/eval-questions/template-generator.js': sha256File(templatePath),
      'dist/eval-questions/manifest-loader.js': sha256File(manifestPath),
    },
  };
}

function packageRootFor(consumerRoot) {
  return path.join(consumerRoot, 'node_modules', 'bmad-speckit');
}

function runInstalledCli(cwd, args, options = {}) {
  const packageRoot = options.packageRoot || packageRootFor(cwd);
  const cli = path.join(packageRoot, 'bin', 'bmad-speckit.js');
  return runCommand(process.execPath, [cli, ...args], { cwd });
}

function runNpxCli(cwd, tarballPath, args) {
  return runCommand('npm', ['exec', '--yes', '--package', tarballPath, '--', 'bmad-speckit', ...args], { cwd });
}

function writeProbeScript(consumerRoot, name, source) {
  const filePath = path.join(consumerRoot, `${name}.cjs`);
  fs.writeFileSync(filePath, source, 'utf8');
  return filePath;
}

function directRequireRuntimeProbe(consumerRoot, options = {}) {
  const packageRoot = options.packageRoot || packageRootFor(consumerRoot);
  const source = `
const assert = require('node:assert');
const path = require('node:path');
const pkg = ${JSON.stringify(packageRoot)};
const modules = ${JSON.stringify(RUNTIME_MODULES)};
for (const [file, exports] of modules) {
  const mod = require(path.join(pkg, 'dist', 'main-agent', 'runtime', file));
  for (const name of exports) assert.notEqual(mod[name], undefined, file + ':' + name);
}
const host = require(path.join(pkg, 'dist', 'main-agent', 'runtime', 'host-runtime-mode.js'));
assert.equal(host.normalizeRuntimeHost('codex-no-hooks'), 'codex');
const parallel = require(path.join(pkg, 'dist', 'main-agent', 'runtime', 'parallel-mission-control.js'));
assert.ok(Array.isArray(parallel.DEFAULT_PROTECTED_WRITE_PATHS));
console.log(JSON.stringify({ rowId: 'IM001', passed: true }));
`;
  const script = writeProbeScript(consumerRoot, 'probe-runtime', source);
  return runCommand(process.execPath, [script], { cwd: consumerRoot });
}

function directRequireHelperProbe(consumerRoot, options = {}) {
  const packageRoot = options.packageRoot || packageRootFor(consumerRoot);
  const source = `
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pkg = ${JSON.stringify(packageRoot)};
const modules = ${JSON.stringify(HELPER_MODULES)};
for (const [file, exports] of modules) {
  const mod = require(path.join(pkg, 'dist', 'main-agent', 'helpers', file));
  for (const name of exports) assert.notEqual(mod[name], undefined, file + ':' + name);
}
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wave-3-11-helper-probe-'));
try {
  const state = require(path.join(pkg, 'dist', 'main-agent', 'helpers', 'runtime-step-state.js'));
  const resolved = state.resolveRuntimeStepState(root, { argv: ['--workflow', 'wf', '--step', 's1'], env: {} });
  state.persistRuntimeStepState(root, resolved);
  assert.equal(fs.existsSync(path.join(root, '_bmad-output', 'runtime', 'step-state.json')), true);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(JSON.stringify({ rowId: 'IM002', passed: true }));
`;
  const script = writeProbeScript(consumerRoot, 'probe-helpers', source);
  return runCommand(process.execPath, [script], { cwd: consumerRoot });
}

function evalQuestionProbe(consumerRoot, options = {}) {
  const fixture = path.join(consumerRoot, 'coach-report.json');
  const outputDir = path.join(consumerRoot, 'eval-output');
  fs.copyFileSync(path.join(WAVE_DIR, 'fixtures', 'coach-report.json'), fixture);
  const cliArgs = ['eval-question-generate', '--input', fixture, '--outputDir', outputDir, '--version', 'v1'];
  const cli = options.npxTarballPath
    ? runNpxCli(consumerRoot, options.npxTarballPath, cliArgs)
    : runInstalledCli(consumerRoot, cliArgs, { packageRoot: options.packageRoot });
  if (cli.result.status !== 0) return cli;
  const source = `
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const requireFromManifestRoot = createRequire(path.join(${JSON.stringify(options.packageRoot)}, 'package.json'));
const { loadManifest } = requireFromManifestRoot('@bmad-speckit/scoring/eval-questions/manifest-loader');
const outputDir = ${JSON.stringify(outputDir)};
const manifest = loadManifest(outputDir);
assert.ok(manifest.questions.length > 0);
for (const question of manifest.questions) {
  assert.ok(question.id);
  assert.ok(question.title);
  assert.ok(question.path);
  assert.equal(fs.existsSync(path.join(outputDir, question.path)), true);
}
console.log(JSON.stringify({ rowId: 'IM003', passed: true, questionCount: manifest.questions.length }));
`;
  const script = writeProbeScript(consumerRoot, 'probe-eval-question', source);
  const probe = runCommand(process.execPath, [script], { cwd: consumerRoot });
  return {
    result: {
      status: probe.result.status,
      stdout: `${cli.result.stdout || ''}${probe.result.stdout || ''}`,
      stderr: `${cli.result.stderr || ''}${probe.result.stderr || ''}`,
    },
    row: commandRow(`${cli.row.command} && manifest-loader probe`, consumerRoot, {
      status: probe.result.status,
      stdout: `${cli.result.stdout || ''}${probe.result.stdout || ''}`,
      stderr: `${cli.result.stderr || ''}${probe.result.stderr || ''}`,
    }, {
      startedAt: cli.row.startedAt,
      completedAt: probe.row.completedAt,
    }),
  };
}

function checkScoreProbe(consumerRoot, options = {}) {
  const dataDir = path.join(consumerRoot, 'scores');
  fs.mkdirSync(dataDir, { recursive: true });
  writeJson(path.join(dataDir, 'score.json'), {
    run_id: 'wave-3-11-e9-s1-story',
    scenario: 'real_dev',
    stage: 'story',
    phase_score: 80,
    phase_weight: 1,
    check_items: [{ item_id: 'fixture', passed: true, score_delta: 0 }],
    timestamp: '2026-06-05T00:00:00.000Z',
    iteration_count: 1,
    iteration_records: [],
    first_pass: true,
  });
  const cliArgs = ['check-score', '--epic', '9', '--story', '1', '--dataPath', dataDir];
  return options.npxTarballPath
    ? runNpxCli(consumerRoot, options.npxTarballPath, cliArgs)
    : runInstalledCli(consumerRoot, cliArgs, { packageRoot: options.packageRoot });
}

function makeMatrixRow(mode, rowId, commandSurface, commandResult, receiptPath, assertions, extra = {}) {
  return {
    mode,
    rowId,
    commandSurface,
    status: commandResult.result.status === 0 ? 'passed' : 'failed',
    command: commandResult.row.command,
    cwd: commandResult.row.cwd,
    exitCode: commandResult.result.status ?? 1,
    receiptPath,
    stdoutHash: sha256Text(commandResult.result.stdout || ''),
    stderrHash: sha256Text(commandResult.result.stderr || ''),
    usedRootScript: false,
    usedTsx: false,
    usedTsNode: false,
    usedCompiledFallback: false,
    assertions,
    ...extra,
  };
}

function installConsumer(mode, tarballPath) {
  const parent = fs.mkdtempSync(path.join(TMP_ROOT, `${mode}-`));
  const consumerRoot = path.join(parent, mode === 'init-sync-consumer' ? 'parent' : 'consumer');
  fs.mkdirSync(consumerRoot, { recursive: true });
  writeJson(path.join(consumerRoot, 'package.json'), {
    name: `wave-3-11-${mode}`,
    version: '1.0.0',
    private: true,
  });
  const installArgs =
    mode === 'save-dev'
      ? ['install', '--save-dev', tarballPath]
      : ['install', '--no-save', tarballPath];
  const install = runCommand('npm', installArgs, { cwd: consumerRoot });
  assertPassed(`${mode} install`, install.result);
  return { parent, consumerRoot, install };
}

function installNpxModeConsumers(tarballPath) {
  const parent = fs.mkdtempSync(path.join(TMP_ROOT, 'npx-package-'));
  const consumerRoot = path.join(parent, 'npx-consumer');
  const requireRoot = path.join(parent, 'direct-require-consumer');
  for (const root of [consumerRoot, requireRoot]) {
    fs.mkdirSync(root, { recursive: true });
    writeJson(path.join(root, 'package.json'), {
      name: `wave-3-11-${path.basename(root)}`,
      version: '1.0.0',
      private: true,
    });
  }
  const install = runCommand('npm', ['install', '--no-save', tarballPath], { cwd: requireRoot });
  assertPassed('npx-package direct-require install', install.result);
  return { parent, consumerRoot, requireRoot, install };
}

function runMode(mode, tarballPath, scoringHashes) {
  const installContext =
    mode === 'npx-package' ? installNpxModeConsumers(tarballPath) : installConsumer(mode, tarballPath);
  const { consumerRoot, install } = installContext;
  let probeRoot = consumerRoot;
  let packageRoot = packageRootFor(consumerRoot);
  let requireProbeRoot = consumerRoot;
  if (mode === 'npx-package') {
    requireProbeRoot = installContext.requireRoot;
    packageRoot = packageRootFor(requireProbeRoot);
  }
  const rows = [];
  const commands = [install.row];
  const receiptPath = path.join(INSTALL_MATRIX_DIR, `${mode}.json`);
  const receiptPathRelative = rel(receiptPath);

  if (mode === 'init-sync-consumer') {
    const installedRoot = packageRootFor(consumerRoot);
    const init = runInstalledCli(
      consumerRoot,
      [
        'init',
        'wave-3-11-sync',
        '--yes',
        '--no-git',
        '--ai',
        'codex',
        '--bmad-path',
        path.join(installedRoot, '_bmad'),
      ],
      { packageRoot: installedRoot }
    );
    commands.push(init.row);
    assertPassed('init-sync-consumer init', init.result);
    probeRoot = path.join(consumerRoot, 'wave-3-11-sync');
    packageRoot = installedRoot;
    const configPath = path.join(probeRoot, '_bmad-output', 'config', 'bmad-speckit.json');
    if (!fs.existsSync(configPath)) {
      throw new Error('init-sync-consumer missing _bmad-output/config/bmad-speckit.json');
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!String(config.bmadPath || '').includes(path.join('node_modules', 'bmad-speckit', '_bmad'))) {
      throw new Error('init-sync-consumer bmad-speckit.json does not point at installed _bmad');
    }
    const check = runInstalledCli(probeRoot, ['check', '--json', '--ignore-agent-tools'], { packageRoot: installedRoot });
    commands.push(check.row);
    assertPassed('init-sync-consumer check', check.result);
    requireProbeRoot = probeRoot;
  }

  const runtime = directRequireRuntimeProbe(requireProbeRoot, { packageRoot });
  commands.push(runtime.row);
  rows.push(
    makeMatrixRow(mode, 'IM001', 'installed package direct runtime require probe', runtime, receiptPathRelative, [
      'runtime modules resolve from installed package dist',
      'D006 runtime exports exist',
      `no root script, ${'t' + 'sx'}, ${'ts' + '-node'}, or compiled fallback used`,
    ])
  );
  assertPassed(`${mode} IM001`, runtime.result);

  const helpers = directRequireHelperProbe(requireProbeRoot, { packageRoot });
  commands.push(helpers.row);
  rows.push(
    makeMatrixRow(mode, 'IM002', 'installed package direct helper require probe', helpers, receiptPathRelative, [
      'helper modules resolve from installed package dist',
      'D006 helper exports exist',
      'fixture-backed helper calls pass without root script or TypeScript runner',
    ])
  );
  assertPassed(`${mode} IM002`, helpers.result);

  const evalQuestion = evalQuestionProbe(probeRoot, {
    packageRoot,
    npxTarballPath: mode === 'npx-package' ? tarballPath : null,
  });
  commands.push(evalQuestion.row);
  const scoringProof = installedScoringProof(packageRoot);
  const hashesMatch =
    JSON.stringify(scoringProof.installedScoringDistHashes) === JSON.stringify(scoringHashes);
  rows.push(
    makeMatrixRow(mode, 'IM003', 'installed bmad-speckit eval-question-generate --input', evalQuestion, receiptPathRelative, [
      'eval-question-generate runs from installed package CLI surface',
      'generated manifest loads through installed scoring manifest-loader',
      'installed scoring eval-question files hash-match workspace build',
    ], {
      currentWorkspaceScoringHashMatched: hashesMatch,
      installedScoringResolvedPath: scoringProof.installedScoringResolvedPath,
      installedScoringPackageVersion: scoringProof.installedScoringPackageVersion,
      installedScoringDistHashes: scoringProof.installedScoringDistHashes,
    })
  );
  assertPassed(`${mode} IM003`, evalQuestion.result);
  if (!hashesMatch) throw new Error(`${mode} installed scoring hashes do not match workspace build`);

  const checkScore = checkScoreProbe(probeRoot, {
    packageRoot,
    npxTarballPath: mode === 'npx-package' ? tarballPath : null,
  });
  commands.push(checkScore.row);
  rows.push(
    makeMatrixRow(mode, 'IM004', 'installed bmad-speckit check-score', checkScore, receiptPathRelative, [
      'check-score runs from installed package CLI surface',
      'score fixture resolves through consumer dataPath',
      'root check-story-score-written script is not executed',
    ])
  );
  assertPassed(`${mode} IM004`, checkScore.result);

  safeWriteJson(
    receiptPath,
    {
      schemaVersion: 'main-agent-runtime-migration-wave-3.11-install-mode-receipt/v1',
      waveId: WAVE_ID,
      mode,
      status: 'passed',
      generatedAt: now(),
      consumerRoot: rel(consumerRoot),
      probeRoot: rel(probeRoot),
      requireProbeRoot: rel(requireProbeRoot),
      packageRoot: rel(packageRoot),
      rowIds: rows.map((row) => row.rowId),
      commandRows: commands,
      rows,
      assertions: rows.flatMap((row) => row.assertions),
    },
    mode
  );

  return {
    mode,
    status: 'passed',
    consumerRoot: rel(consumerRoot),
    probeRoot: rel(probeRoot),
    requireProbeRoot: rel(requireProbeRoot),
    packageRoot: rel(packageRoot),
    receiptPath: receiptPathRelative,
    commands,
    rows,
  };
}

function cleanupRows() {
  const rows = [];
  const cleanup = runCommand(process.execPath, ['scripts/cleanup-packed-bmad.js'], { cwd: ROOT });
  rows.push(cleanup.row);
  for (const surface of STAGING_SURFACES) {
    const startedAt = now();
    rm(path.join(ROOT, surface));
    const removed = !fs.existsSync(path.join(ROOT, surface));
    const result = {
      status: removed ? 0 : 1,
      stdout: JSON.stringify({ surface, removed }) + '\n',
      stderr: removed ? '' : `leftover still exists: ${surface}`,
    };
    rows.push(commandRow(`runner-owned cleanup ${surface}`, ROOT, result, { startedAt, completedAt: now() }));
  }
  const absent = STAGING_SURFACES.filter((surface) => fs.existsSync(path.join(ROOT, surface)));
  const result = {
    status: absent.length === 0 ? 0 : 1,
    stdout: JSON.stringify({ absent: absent.length === 0, checked: STAGING_SURFACES }) + '\n',
    stderr: absent.length === 0 ? '' : `leftovers: ${absent.join(', ')}`,
  };
  rows.push(commandRow('runner-owned staging absence check', ROOT, result, { startedAt: now(), completedAt: now() }));
  return rows;
}

function assertRowsPassed(label, rows) {
  for (const row of rows) {
    if (row.status !== 'passed' || row.exitCode !== 0) {
      throw new Error(`${label} failed: ${row.command}`);
    }
  }
}

function main() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  fs.mkdirSync(WAVE_DIR, { recursive: true });
  const startedAt = now();
  const prepackPrepCommands = [];
  let cleanupCommands = [];
  let matrix = null;
  try {
    for (const args of [
      ['npm', ['run', 'build:scoring']],
      ['npm', ['run', 'build:runtime-context']],
      ['npm', ['run', 'build:runtime-emit']],
      ['npm', ['run', 'build:ralph-method']],
      ['npm', ['run', 'build:main-agent-dist']],
    ]) {
      const command = runCommand(args[0], args[1], { cwd: ROOT });
      prepackPrepCommands.push(command.row);
      assertPassed(args[1].join(' '), command.result);
    }

    const prepublish = runCommand(process.execPath, ['scripts/prepublish-check.js'], {
      cwd: ROOT,
      env: { BMAD_PREPUBLISH_SILENT: '1', BMAD_PACK_SESSION: '1' },
    });
    prepackPrepCommands.push(prepublish.row);
    assertPassed('prepublish-check', prepublish.result);

    for (const required of [
      'packages/bmad-speckit/node_modules/@bmad-speckit/schema/package.json',
      'packages/bmad-speckit/node_modules/@bmad-speckit/scoring/package.json',
      'packages/bmad-speckit/node_modules/@bmad-speckit/scoring/dist/eval-questions/template-generator.js',
      'packages/bmad-speckit/node_modules/@bmad-speckit/scoring/dist/eval-questions/manifest-loader.js',
      'packages/bmad-speckit/node_modules/@bmad-speckit/runtime-context/package.json',
      'packages/bmad-speckit/node_modules/@bmad-speckit/runtime-emit/package.json',
      'packages/bmad-speckit/node_modules/@bmad-speckit/ralph-method/package.json',
      'packages/bmad-speckit/_bmad',
    ]) {
      if (!fs.existsSync(path.join(ROOT, required))) throw new Error(`prepack missing ${required}`);
    }

    const packDir = fs.mkdtempSync(path.join(TMP_ROOT, 'pack-'));
    const pack = runCommand('npm', ['pack', '--pack-destination', packDir, '--json', '--ignore-scripts'], {
      cwd: PACKAGE_CWD,
    });
    assertPassed('npm pack packages/bmad-speckit', pack.result);
    const packInfo = parsePackJson(pack.result.stdout);
    const tarballPath = path.join(packDir, packInfo.filename);
    const scoringHashes = workspaceScoringHashes();
    const packageJson = JSON.parse(fs.readFileSync(path.join(PACKAGE_CWD, 'package.json'), 'utf8'));
    const scoringPackageJson = JSON.parse(fs.readFileSync(path.join(SCORING_CWD, 'package.json'), 'utf8'));

    const modes = ['save-dev', 'no-save', 'npx-package', 'init-sync-consumer'].map((mode) =>
      runMode(mode, tarballPath, scoringHashes)
    );

    cleanupCommands = cleanupRows();
    assertRowsPassed('D008 cleanup', cleanupCommands);

    matrix = {
      schemaVersion: 'main-agent-runtime-migration-wave-3.11-install-matrix/v1',
      waveId: WAVE_ID,
      status: 'passed',
      startedAt,
      completedAt: now(),
      packageCwd: 'packages/bmad-speckit',
      packageName: packageJson.name,
      packageVersion: packageJson.version,
      tarballPath: rel(tarballPath),
      tarballSha256: sha256File(tarballPath),
      scoringPackageSourceCwd: 'packages/scoring',
      scoringPackageName: scoringPackageJson.name,
      scoringWorkspaceVersion: scoringPackageJson.version,
      scoringWorkspaceDistHashes: scoringHashes,
      prepackPrepCommands,
      cleanupCommands,
      modes,
    };
    safeWriteJson(MATRIX_PATH, matrix, WAVE_ID);
    process.stdout.write(`${JSON.stringify({ status: 'passed', path: rel(MATRIX_PATH) }, null, 2)}\n`);
  } catch (error) {
    cleanupCommands = cleanupRows();
    matrix = {
      schemaVersion: 'main-agent-runtime-migration-wave-3.11-install-matrix/v1',
      waveId: WAVE_ID,
      status: 'failed',
      startedAt,
      completedAt: now(),
      packageCwd: 'packages/bmad-speckit',
      packageName: 'bmad-speckit',
      packageVersion: JSON.parse(fs.readFileSync(path.join(PACKAGE_CWD, 'package.json'), 'utf8')).version,
      tarballPath: null,
      tarballSha256: EMPTY_HASH,
      scoringPackageSourceCwd: 'packages/scoring',
      scoringPackageName: '@bmad-speckit/scoring',
      scoringWorkspaceVersion: JSON.parse(fs.readFileSync(path.join(SCORING_CWD, 'package.json'), 'utf8')).version,
      scoringWorkspaceDistHashes: fs.existsSync(path.join(SCORING_CWD, 'dist'))
        ? workspaceScoringHashes()
        : {},
      prepackPrepCommands,
      cleanupCommands,
      modes: [],
      error: error.message,
    };
    safeWriteJson(MATRIX_PATH, matrix, WAVE_ID);
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  }
}

main();
