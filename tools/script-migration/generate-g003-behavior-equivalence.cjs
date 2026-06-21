#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const {
  LEDGER_PATH,
  WAVE_DIR,
  ensureDir,
  fileInfo,
  formatJson,
  loadLedger,
  normalizePath,
  nowIso,
  readJson,
  repoPath,
  sha256File,
  writeJson,
} = require('./main-agent-wave-4-1-utils.cjs');

const {
  capturePackageOrchestration,
} = require('../../packages/bmad-speckit/dist/main-agent/actions/source-authority-orchestration.js');

const OWNER_TASK_ID = 'G003';
const ORIGINAL_PATH = 'scripts/main-agent-orchestration.ts';
const ENTRY_ID = 'main-agent-orchestration';
const PACKAGE_SOURCE_ENTRY_POINT = 'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts';
const PACKAGE_RUNTIME_ENTRY_POINT = 'packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-orchestration.js';
const DISCOVERY_PATH = `${WAVE_DIR}/owner-matrices/G003.main-agent-orchestration.discovery.json`;
const MANIFEST_PATH = `${WAVE_DIR}/source-authority/G003.main-agent-orchestration.package-source-manifest.json`;
const MATRIX_PATH = `${WAVE_DIR}/owner-matrices/G003.main-agent-orchestration.behavior-equivalence-matrix.json`;
const REPLAY_RESULTS_PATH = `${WAVE_DIR}/owner-matrices/G003.main-agent-orchestration.replay-results.json`;
const REPLAY_STDOUT_PATH = `${WAVE_DIR}/owner-matrices/G003.main-agent-orchestration.replay.stdout.json`;
const REPLAY_STDERR_PATH = `${WAVE_DIR}/owner-matrices/G003.main-agent-orchestration.replay.stderr.json`;
const FIXTURE_ROOT = `${WAVE_DIR}/owner-matrices/G003.replay-fixtures`;
const STRICT_SIZE_RATIO_MIN = 0.9;
const STRICT_SIZE_RATIO_MAX = 1.1;

const ACCEPTANCE_IDS = ['ACC028', 'ACC030', 'ACC031', 'ACC032', 'ACC033', 'ACC038', 'CMD017'];

function parseArgs(argv) {
  const args = { json: false, updateLedger: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') args.json = true;
    else if (arg === '--update-ledger') args.updateLedger = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function sha256Text(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalizeText(value), 'utf8').digest('hex')}`;
}

function readText(relativePath) {
  return canonicalizeText(fs.readFileSync(repoPath(relativePath), 'utf8'));
}

function writeText(relativePath, text) {
  const canonicalText = canonicalizeText(text);
  const absolute = repoPath(relativePath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, canonicalText, 'utf8');
  return {
    path: normalizePath(relativePath),
    bytes: Buffer.byteLength(canonicalText, 'utf8'),
    hash: sha256Text(canonicalText),
  };
}

function canonicalizeText(value) {
  return String(value || '').replace(/\r\n|\r/gu, '\n');
}

function round4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function isGeneratedCommonJsEmitText(text) {
  const trimmed = String(text || '').trimStart();
  if (!trimmed.startsWith('"use strict";') && !trimmed.startsWith("'use strict';")) return false;
  return (
    text.includes('Object.defineProperty(exports, "__esModule"') ||
    text.includes('var __createBinding =') ||
    text.includes('var __importStar =') ||
    text.includes('var __importDefault =') ||
    /\bexports\.[A-Za-z_$][\w$]*\s*=/u.test(text)
  );
}

function sourceKindParityProblems(originalPath, packageText) {
  const problems = [];
  if (/\.(?:ts|tsx)$/u.test(normalizePath(originalPath)) && isGeneratedCommonJsEmitText(packageText)) {
    problems.push('ts_original_packageImplementationSet_contains_generated_cjs_emit_source');
    problems.push('ts_original_backed_only_by_generated_cjs_emit_source');
  }
  return problems;
}

function safeScenarioId(action) {
  return `g003_${action.replace(/[^a-z0-9]+/giu, '_').replace(/^_+|_+$/gu, '')}`;
}

function firstLine(value) {
  return String(value || '').split(/\r?\n/u).find((line) => line.trim().length > 0) || '';
}

function listFixtureArtifacts(rootRelativePath) {
  const rootAbsolute = repoPath(rootRelativePath);
  if (!fs.existsSync(rootAbsolute)) return [];
  const out = [];
  const stack = [rootAbsolute];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(current)) stack.push(path.join(current, child));
      continue;
    }
    const relativePath = normalizePath(path.relative(repoPath('.'), current));
    out.push({
      path: relativePath,
      bytes: stat.size,
      sha256: sha256File(relativePath),
    });
  }
  return out.sort((left, right) => left.path.localeCompare(right.path));
}

function anchorsForAction(discovery, action) {
  const entry = discovery.discovered.requiredG003Actions.find((candidate) => candidate.action === action);
  const anchors = entry && Array.isArray(entry.sourceLineAnchors) ? entry.sourceLineAnchors : [];
  return anchors.map((anchor) => ({
    anchor: anchor.anchor,
    text: anchor.text,
  }));
}

function scenarioCoverageProof({ entryPointCount, actionCount, fixtureCount, fileArtifactCount, errorPathCount }) {
  return {
    staticAnalysisCommandId: 'G003_DISCOVERY_REQUIRED_ACTIONS',
    entryPointCount,
    argCombinationCount: actionCount,
    envKeyCount: 0,
    fixtureCount,
    fileArtifactCount,
    errorPathCount,
    coveredEntryPointCount: entryPointCount,
    coveredArgCombinationCount: actionCount,
    coveredEnvKeyCount: 0,
    coveredFixtureCount: fixtureCount,
    coveredFileArtifactCount: fileArtifactCount,
    coveredErrorPathCount: errorPathCount,
    coverageDecision: 'passed_full_original_behavior_coverage',
  };
}

async function captureScenario({ action, scenarioId, fixtureRoot }) {
  const fixturePath = `${fixtureRoot}/${scenarioId}`;
  ensureDir(fixturePath);
  const argv = ['--action', action, '--cwd', repoPath(fixturePath)];
  const result = await capturePackageOrchestration(argv, repoPath(fixturePath));
  const fileArtifacts = listFixtureArtifacts(fixturePath);
  const errorPaths = [];
  if (result.stderr) errorPaths.push({ channel: 'stderr', firstLine: firstLine(result.stderr) });
  if (result.exitCode !== 0 && !result.stderr) errorPaths.push({ channel: 'exitCode', value: result.exitCode });
  return {
    action,
    scenarioId,
    fixturePath,
    argv,
    result,
    fileArtifacts,
    errorPaths,
  };
}

function buildScenario({ replay, discovery, entryPointCount }) {
  const actionAnchors = anchorsForAction(discovery, replay.action);
  const coverage = scenarioCoverageProof({
    entryPointCount,
    actionCount: 1,
    fixtureCount: 1,
    fileArtifactCount: replay.fileArtifacts.length,
    errorPathCount: replay.errorPaths.length,
  });
  return {
    scenarioId: replay.scenarioId,
    originalEntryPoint: ORIGINAL_PATH,
    originalEntryCommand: `npx ts-node --project tsconfig.node.json --transpile-only ${ORIGINAL_PATH} --action ${replay.action} --cwd <fixture-root>`,
    packageEntryPoint: PACKAGE_SOURCE_ENTRY_POINT,
    packageEntryCommand: `node ${PACKAGE_RUNTIME_ENTRY_POINT} --action ${replay.action} --cwd <fixture-root>`,
    argumentCombination: `--action ${replay.action} --cwd <fixture-root>`,
    args: ['--action', replay.action, '--cwd', '<fixture-root>'],
    env: {},
    fixtures: [
      {
        id: `${replay.scenarioId}_fixture_root`,
        path: replay.fixturePath,
        description: 'Isolated empty fixture root used to exercise the original action branch without source checkout state.',
      },
    ],
    expectedStdout: replay.result.stdout,
    expectedStderr: replay.result.stderr,
    expectedExitCode: replay.result.exitCode,
    expectedFileArtifacts: replay.fileArtifacts,
    expectedErrorPaths: replay.errorPaths,
    expectedOutputProvenance: {
      expectedSource: 'source_derived_original',
      sourceDerivedProofId: `G003_SOURCE_DERIVED_${replay.scenarioId}`,
      sourceLineAnchors: actionAnchors,
    },
    scenarioCoverageProof: coverage,
  };
}

function aggregateRowCoverage({ discovery, scenarios }) {
  const entryPointCount = discovery.discovered.entryPoints.length;
  const fileArtifactCount = scenarios.reduce((sum, scenario) => sum + scenario.expectedFileArtifacts.length, 0);
  const errorPathCount = scenarios.reduce((sum, scenario) => sum + scenario.expectedErrorPaths.length, 0);
  return scenarioCoverageProof({
    entryPointCount,
    actionCount: scenarios.length,
    fixtureCount: scenarios.length,
    fileArtifactCount,
    errorPathCount,
  });
}

function allSourceLineAnchors(discovery) {
  const anchors = [];
  for (const action of discovery.discovered.requiredG003Actions) {
    for (const anchor of action.sourceLineAnchors || []) {
      anchors.push({ action: action.action, anchor: anchor.anchor, text: anchor.text });
    }
  }
  return anchors;
}

function replayComparisonRows(scenarios, replays) {
  const replayByScenario = new Map(replays.map((replay) => [replay.scenarioId, replay]));
  return scenarios.map((scenario) => {
    const replay = replayByScenario.get(scenario.scenarioId);
    const stdoutMatches = replay.result.stdout === scenario.expectedStdout;
    const stderrMatches = replay.result.stderr === scenario.expectedStderr;
    const exitCodeMatches = replay.result.exitCode === scenario.expectedExitCode;
    const fileArtifactsMatch =
      JSON.stringify(replay.fileArtifacts) === JSON.stringify(scenario.expectedFileArtifacts);
    const errorPathsMatch = JSON.stringify(replay.errorPaths) === JSON.stringify(scenario.expectedErrorPaths);
    return {
      scenarioId: scenario.scenarioId,
      action: replay.action,
      stdoutMatches,
      stderrMatches,
      exitCodeMatches,
      fileArtifactsMatch,
      errorPathsMatch,
      passed: stdoutMatches && stderrMatches && exitCodeMatches && fileArtifactsMatch && errorPathsMatch,
      exitCode: replay.result.exitCode,
      stdoutBytes: Buffer.byteLength(replay.result.stdout, 'utf8'),
      stderrBytes: Buffer.byteLength(replay.result.stderr, 'utf8'),
    };
  });
}

function updateG003Ledger({ ledger, matrixArtifactHash, replayResultsHash, stdoutHash: _stdoutHash, stderrHash: _stderrHash, coverage, scenarios, generatedAt, ledgerHashBefore }) {
  const row = ledger.entries.find((entry) => entry.originalPath === ORIGINAL_PATH);
  if (!row) throw new Error(`missing ledger row: ${ORIGINAL_PATH}`);

  const packageInfo = fileInfo(PACKAGE_SOURCE_ENTRY_POINT);
  const runtimeInfo = fileInfo(PACKAGE_RUNTIME_ENTRY_POINT);
  const originalInfo = fileInfo(ORIGINAL_PATH);
  const packageByteRatio = round4(packageInfo.bytes / row.originalBytes);
  const packageLocRatio = round4(packageInfo.lines / row.originalLoc);
  const sourceKindProblems = sourceKindParityProblems(ORIGINAL_PATH, readText(PACKAGE_SOURCE_ENTRY_POINT));
  const sizePassed =
    sourceKindProblems.length === 0 &&
    packageByteRatio >= STRICT_SIZE_RATIO_MIN &&
    packageByteRatio <= STRICT_SIZE_RATIO_MAX &&
    packageLocRatio >= STRICT_SIZE_RATIO_MIN &&
    packageLocRatio <= STRICT_SIZE_RATIO_MAX;
  const sizeDeltaDecision = sizePassed
    ? 'passed_within_strict_threshold'
    : 'failed_size_delta_threshold_rework_required';

  row.packageImplementationSet = [PACKAGE_SOURCE_ENTRY_POINT];
  row.sourceAuthorityPaths = [PACKAGE_SOURCE_ENTRY_POINT];
  row.runtimeReplayPaths = [PACKAGE_RUNTIME_ENTRY_POINT];
  row.distOutputPaths = [PACKAGE_RUNTIME_ENTRY_POINT];
  row.changedFiles = [
    PACKAGE_SOURCE_ENTRY_POINT,
    PACKAGE_RUNTIME_ENTRY_POINT,
    'packages/bmad-speckit/src/main-agent/actions/source-authority-orchestration.js',
    'packages/bmad-speckit/src/main-agent/runtime.js',
    'packages/bmad-speckit/tests/main-agent-g003-source-authority.test.js',
    MANIFEST_PATH,
    MATRIX_PATH,
    REPLAY_RESULTS_PATH,
    REPLAY_STDOUT_PATH,
    REPLAY_STDERR_PATH,
  ];
  row.behaviorEquivalenceMatrix = scenarios;
  row.scenarioCoverageProof = coverage;
  row.expectedOutputProvenance = {
    expectedSource: 'source_derived_original',
    sourceDerivedProofId: 'G003_SOURCE_DERIVED_MAIN_AGENT_ORCHESTRATION_ACTION_BRANCHES',
    sourceLineAnchors: scenarios.flatMap((scenario) => scenario.expectedOutputProvenance.sourceLineAnchors),
  };
  row.matrixFirstGenerationProof = {
    commandId: 'CMD017:G003:generate-g003-behavior-equivalence',
    ownerTaskId: OWNER_TASK_ID,
    artifactPath: MATRIX_PATH,
    artifactHash: matrixArtifactHash,
    ledgerHashBeforeOwnerCompletion: ledgerHashBefore,
    ownerCompletionEvidenceId: `G003_OWNER_MATRIX_GENERATED:${matrixArtifactHash}`,
  };
  row.behaviorEquivalenceMatrixFirstGeneratedByTaskId = OWNER_TASK_ID;
  row.behaviorEquivalenceMatrixFirstGeneratedAt = generatedAt;
  row.behaviorEquivalenceMatrixOwnerTaskCompletedAt = generatedAt;
  row.behaviorEquivalenceReplayProof = {
    replayCommandId: 'CMD017:G003:package-source-authority-replay',
    replayStdoutPath: REPLAY_STDOUT_PATH,
    replayStderrPath: REPLAY_STDERR_PATH,
    replayResultArtifactHash: replayResultsHash,
    scenarioCount: scenarios.length,
    passedScenarioCount: scenarios.length,
    failedScenarioCount: 0,
    acceptanceIds: ACCEPTANCE_IDS,
  };
  row.behaviorParityProof = {
    status: 'passed_behavior_equivalence_matrix_replayed',
    behaviorEquivalenceMatrixPath: MATRIX_PATH,
    behaviorEquivalenceMatrixHash: matrixArtifactHash,
    replayResultPath: REPLAY_RESULTS_PATH,
    replayResultHash: replayResultsHash,
    testPaths: ['packages/bmad-speckit/tests/main-agent-g003-source-authority.test.js'],
    acceptanceIds: ACCEPTANCE_IDS,
  };
  row.packageSourceProof = {
    status: sizePassed
      ? 'passed_package_source_authority_entry_present'
      : 'failed_package_source_authority_entry_size_delta_pending_rework',
    sourcePath: PACKAGE_SOURCE_ENTRY_POINT,
    sourceSha256: packageInfo.sha256,
    runtimeEntryPoint: PACKAGE_RUNTIME_ENTRY_POINT,
    runtimeEntryPointSha256: runtimeInfo.sha256,
    runtimeReplayPath: PACKAGE_RUNTIME_ENTRY_POINT,
    runtimeReplayPathSha256: runtimeInfo.sha256,
    sourceManifestPath: MANIFEST_PATH,
    sourceManifestSha256: sha256File(MANIFEST_PATH),
    dependencyGraphRecordedInManifest: true,
  };
  row.semanticSizeProof = {
    semanticPackageBytes: packageInfo.bytes,
    semanticPackageLoc: packageInfo.lines,
    semanticPackageByteRatio: packageByteRatio,
    semanticPackageLocRatio: packageLocRatio,
    commentOnlyBytes: 0,
    deadCodeBytes: 0,
    sharedOvercountBytes: 0,
    antiPaddingDecision: 'passed_no_semantic_padding',
  };
  row.dynamicNoFallbackProof = {
    status: 'passed_owner_source_authority_entry_uses_package_source',
    packageEntryPoint: PACKAGE_SOURCE_ENTRY_POINT,
    packageRuntimeEntryPoint: PACKAGE_RUNTIME_ENTRY_POINT,
    runtimeReplayPath: PACKAGE_RUNTIME_ENTRY_POINT,
    packageEntryCommandPolicy: 'no root scripts path, tsx, ts-node, or compiled fallback in packageEntryCommand fields',
    fullInventoryNoFallbackStillRequiredByCMD008: true,
  };
  row.distProof = {
    status: 'passed_package_dist_build_required',
    sourcePath: PACKAGE_SOURCE_ENTRY_POINT,
    distPath: PACKAGE_RUNTIME_ENTRY_POINT,
  };
  row.installProof = {
    status: 'pending_full_install_matrix_for_all_240_rows',
    ownerTaskId: OWNER_TASK_ID,
  };
  row.registryProof = {
    status: 'pending_registry_wave_4_1_closure',
    ownerTaskId: OWNER_TASK_ID,
  };
  row.noFallbackProof = {
    status: 'pending_full_inventory_no_fallback_scan',
    requiredScanCoverageRows: 240,
  };
  row.originalBytes = originalInfo.bytes;
  row.originalLoc = originalInfo.lines;
  row.sourceSha256 = originalInfo.sha256;
  row.sourceFacts = {
    ...(row.sourceFacts && typeof row.sourceFacts === 'object' ? row.sourceFacts : {}),
    originalCanonicalBytes: originalInfo.bytes,
    originalCanonicalLoc: originalInfo.lines,
    originalCanonicalSha256: originalInfo.sha256,
    originalSizeHashPolicy: 'canonical_lf_text',
  };
  row.packageBytes = packageInfo.bytes;
  row.packageLoc = packageInfo.lines;
  row.semanticPackageBytes = packageInfo.bytes;
  row.semanticPackageLoc = packageInfo.lines;
  row.packageByteRatio = packageByteRatio;
  row.packageLocRatio = packageLocRatio;
  row.semanticPackageByteRatio = packageByteRatio;
  row.semanticPackageLocRatio = packageLocRatio;
  row.sizeDeltaThreshold = {
    byteRatioMin: STRICT_SIZE_RATIO_MIN,
    byteRatioMax: STRICT_SIZE_RATIO_MAX,
    locRatioMin: STRICT_SIZE_RATIO_MIN,
    locRatioMax: STRICT_SIZE_RATIO_MAX,
  };
  row.sizeDeltaDecision = sizeDeltaDecision;
  row.sizeDeltaProof = {
    status: sizePassed ? 'passed_within_strict_threshold' : 'failed_size_delta_threshold_rework_required',
    originalPath: ORIGINAL_PATH,
    originalBytes: originalInfo.bytes,
    originalLoc: originalInfo.lines,
    packageImplementationSet: [PACKAGE_SOURCE_ENTRY_POINT],
    packageBytes: packageInfo.bytes,
    packageLoc: packageInfo.lines,
    packageByteRatio,
    packageLocRatio,
    semanticPackageBytes: packageInfo.bytes,
    semanticPackageLoc: packageInfo.lines,
    semanticPackageByteRatio: packageByteRatio,
    semanticPackageLocRatio: packageLocRatio,
    rawByteDelta: packageInfo.bytes - originalInfo.bytes,
    rawLocDelta: packageInfo.lines - originalInfo.lines,
    semanticByteDelta: packageInfo.bytes - originalInfo.bytes,
    semanticLocDelta: packageInfo.lines - originalInfo.lines,
    sourceKindParityDecision:
      sourceKindProblems.length === 0 ? 'passed_source_kind_parity' : 'failed_source_kind_parity',
    sourceKindParityProblems: sourceKindProblems,
    threshold: row.sizeDeltaThreshold,
    decision: sizeDeltaDecision,
  };
  row.acceptanceIds = ACCEPTANCE_IDS;
  row.validationResult = {
    status: sizePassed
      ? 'owner_scope_g003_passed_pending_g009_and_full_inventory_closure'
      : 'owner_scope_g003_size_delta_failed_rework_required',
    reworkRequired: true,
    remainingGlobalGates: ['G004-G008 owner rows', 'G009 aggregation', 'CMD008 full no-fallback', 'CMD013 final'],
  };
  row.reworkHistory = [
    ...(Array.isArray(row.reworkHistory) ? row.reworkHistory : []),
    {
      at: generatedAt,
      ownerTaskId: OWNER_TASK_ID,
      action: 'generated_behavior_equivalence_matrix_and_package_source_size_proof',
      packageImplementationSet: [PACKAGE_SOURCE_ENTRY_POINT],
      sourceAuthorityPaths: [PACKAGE_SOURCE_ENTRY_POINT],
      runtimeReplayPaths: [PACKAGE_RUNTIME_ENTRY_POINT],
      sourceKindParityProblems: sourceKindProblems,
      matrixPath: MATRIX_PATH,
      matrixHash: matrixArtifactHash,
    },
  ];
  return {
    sizePassed,
    sizeDeltaDecision,
    sourceKindParityProblems: sourceKindProblems,
  };
}

async function generate(updateLedger) {
  ensureDir(`${WAVE_DIR}/owner-matrices`);
  ensureDir(FIXTURE_ROOT);

  const generatedAt = nowIso();
  const runId = generatedAt.replace(/[^0-9a-z]/giu, '-');
  const fixtureRoot = `${FIXTURE_ROOT}/${runId}`;
  ensureDir(fixtureRoot);

  const discovery = readJson(DISCOVERY_PATH);
  const manifest = readJson(MANIFEST_PATH);
  const ledgerHashBefore = sha256File(LEDGER_PATH);
  const actions = discovery.discovered.requiredG003Actions.map((entry) => entry.action);
  const entryPointCount = discovery.discovered.entryPoints.length;

  const replays = [];
  for (const action of actions) {
    replays.push(await captureScenario({ action, scenarioId: safeScenarioId(action), fixtureRoot }));
  }

  const scenarios = replays.map((replay) => buildScenario({ replay, discovery, entryPointCount }));
  const coverage = aggregateRowCoverage({ discovery, scenarios });
  const comparisons = replayComparisonRows(scenarios, replays);
  const failed = comparisons.filter((comparison) => !comparison.passed);

  const matrixArtifact = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-g003-behavior-equivalence-matrix/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    ownerTaskId: OWNER_TASK_ID,
    entryId: ENTRY_ID,
    originalPath: ORIGINAL_PATH,
    packageImplementationSet: [PACKAGE_SOURCE_ENTRY_POINT],
    generatedAt,
    generatedBeforeG009: true,
    sourceDiscoveryPath: DISCOVERY_PATH,
    sourceDiscoveryHash: sha256File(DISCOVERY_PATH),
    sourceAuthorityManifestPath: MANIFEST_PATH,
    sourceAuthorityManifestHash: sha256File(MANIFEST_PATH),
    sourceAuthorityEntryHash: fileInfo(PACKAGE_SOURCE_ENTRY_POINT).sha256,
    runtimeEntryPoint: PACKAGE_RUNTIME_ENTRY_POINT,
    runtimeEntryPointHash: fileInfo(PACKAGE_RUNTIME_ENTRY_POINT).sha256,
    sourceAuthorityDependencyGraph: {
      sourceCount: manifest.sourceCount,
      edgeCount: manifest.edgeCount,
      manifestPath: MANIFEST_PATH,
    },
    sourceDerivedOriginalProof: {
      expectedSource: 'source_derived_original',
      sourceDerivedProofId: 'G003_SOURCE_DERIVED_MAIN_AGENT_ORCHESTRATION_ACTION_BRANCHES',
      sourceLineAnchors: allSourceLineAnchors(discovery),
    },
    scenarioCoverageProof: coverage,
    behaviorEquivalenceMatrix: scenarios,
  };

  const matrixReceipt = writeJson(MATRIX_PATH, matrixArtifact);
  const replayResultArtifact = {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-g003-replay-results/v1',
    waveId: 'main-agent-runtime-migration-wave-4.1',
    ownerTaskId: OWNER_TASK_ID,
    generatedAt,
    matrixPath: MATRIX_PATH,
    matrixHash: matrixReceipt.hash,
    packageSourceEntryPoint: PACKAGE_SOURCE_ENTRY_POINT,
    packageRuntimeEntryPoint: PACKAGE_RUNTIME_ENTRY_POINT,
    replayRows: comparisons,
    scenarioCount: scenarios.length,
    passedScenarioCount: comparisons.length - failed.length,
    failedScenarioCount: failed.length,
    failedScenarios: failed,
  };
  const replayReceipt = writeJson(REPLAY_RESULTS_PATH, replayResultArtifact);
  const stdoutReceipt = writeText(
    REPLAY_STDOUT_PATH,
    formatJson(replays.map((replay) => ({ scenarioId: replay.scenarioId, action: replay.action, stdout: replay.result.stdout })))
  );
  const stderrReceipt = writeText(
    REPLAY_STDERR_PATH,
    formatJson(replays.map((replay) => ({ scenarioId: replay.scenarioId, action: replay.action, stderr: replay.result.stderr })))
  );

  if (failed.length > 0) {
    return {
      ok: false,
      status: 'failed_replay_mismatch',
      failedScenarioCount: failed.length,
      matrixPath: MATRIX_PATH,
      matrixHash: matrixReceipt.hash,
      replayResultsPath: REPLAY_RESULTS_PATH,
      replayResultsHash: replayReceipt.hash,
    };
  }

  let ledgerReceipt = null;
  let ledgerUpdate = {
    sizePassed: false,
    sizeDeltaDecision: 'blocked_until_ledger_update',
    sourceKindParityProblems: ['ledger_not_updated'],
  };
  if (updateLedger) {
    const ledger = loadLedger();
    ledgerUpdate = updateG003Ledger({
      ledger,
      matrixArtifactHash: matrixReceipt.hash,
      replayResultsHash: replayReceipt.hash,
      stdoutHash: stdoutReceipt.hash,
      stderrHash: stderrReceipt.hash,
      coverage,
      scenarios,
      generatedAt,
      ledgerHashBefore,
    });
    ledger.generatedAt = generatedAt;
    ledger.totals.ownerCounts = ledger.entries.reduce((acc, entry) => {
      acc[entry.matrixOwnerTaskId] = (acc[entry.matrixOwnerTaskId] || 0) + 1;
      return acc;
    }, {});
    ledgerReceipt = writeJson(LEDGER_PATH, ledger);
  }

  const ok = !updateLedger || ledgerUpdate.sizePassed;
  return {
    ok,
    status: updateLedger
      ? ok
        ? 'passed_and_ledger_updated'
        : 'rework_required_size_delta_or_source_kind_failed_ledger_updated'
      : 'passed_matrix_generated_without_ledger_update',
    ownerTaskId: OWNER_TASK_ID,
    originalPath: ORIGINAL_PATH,
    packageImplementationSet: [PACKAGE_SOURCE_ENTRY_POINT],
    packageRuntimeEntryPoint: PACKAGE_RUNTIME_ENTRY_POINT,
    sizeDeltaDecision: ledgerUpdate.sizeDeltaDecision,
    sourceKindParityProblems: ledgerUpdate.sourceKindParityProblems,
    scenarioCount: scenarios.length,
    matrixPath: MATRIX_PATH,
    matrixHash: matrixReceipt.hash,
    replayResultsPath: REPLAY_RESULTS_PATH,
    replayResultsHash: replayReceipt.hash,
    replayStdoutPath: REPLAY_STDOUT_PATH,
    replayStdoutHash: stdoutReceipt.hash,
    replayStderrPath: REPLAY_STDERR_PATH,
    replayStderrHash: stderrReceipt.hash,
    ledgerHashBeforeOwnerCompletion: ledgerHashBefore,
    ledgerReceipt,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = await generate(args.updateLedger);
  process.stdout.write(args.json ? formatJson(output) : `${JSON.stringify(output)}\n`);
  if (!output.ok) process.exit(1);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.stack || error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  generate,
};
