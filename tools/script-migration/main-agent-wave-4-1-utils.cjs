#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-4.1';
const WAVE_DIR = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1';
const INVENTORY_PATH =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json';
const QUEUE_PATH =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json';
const PARITY_PATH =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json';
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const LEDGER_PATH = `${WAVE_DIR}/migration-ledger.json`;
const SCOPE_BASELINE_PATH = `${WAVE_DIR}/scope-baseline.json`;
const EVIDENCE_PATH = `${WAVE_DIR}/evidence.json`;
const REWORK_PATH = `${WAVE_DIR}/rework-iterations.json`;
const PACKAGE_SOURCE_PARITY_EVIDENCE_PATH = `${WAVE_DIR}/package-source-parity-evidence.json`;
const FINAL_EVIDENCE_PACKET_PATH = `${WAVE_DIR}/final-evidence-packet.json`;
const SUMMARY_PATH = `${WAVE_DIR}/summary.md`;
const INSTALL_MATRIX_DIR = `${WAVE_DIR}/install-matrix`;
const CONTRACT_PATH =
  'docs/plans/2026-06-20-main-agent-runtime-migration-wave-4-1-goal-execution-plan.md';

const EXPECTED_HASHES = {
  [INVENTORY_PATH]: 'sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31',
  [QUEUE_PATH]: 'sha256:3b3ccf1b1a88d9f7dd559413e4bcb502d0cdf7305b308b64e2b12f26ac42ddb5',
  [PARITY_PATH]: 'sha256:9d69564dc665ba50eb40fab76a955a8880602963dd57667f6b8d308074629dee',
  [REGISTRY_PATH]: 'sha256:bd5c33103773801a160eda784759b2ebbdcc76a5dac63282a5ad1243fb3f8205',
};

const OWNER_EXPECTED_COUNTS = {
  G003: 1,
  G004: 91,
  G005: 12,
  G006: 4,
  G007: 74,
  G008: 58,
};

const REQUIRED_LEDGER_FIELDS = [
  'originalPath',
  'entryId',
  'scopeClass',
  'priority',
  'migrationStrategy',
  'preliminaryParityStatus',
  'sourceSha256',
  'targetPaths',
  'matrixOwnerAssignmentRuleId',
  'expectedMatrixOwnerTaskId',
  'matrixOwnerTaskId',
  'packageImplementationSet',
  'sourceAuthorityPaths',
  'runtimeReplayPaths',
  'distOutputPaths',
  'changedFiles',
  'behaviorEquivalenceMatrix',
  'scenarioCoverageProof',
  'expectedOutputProvenance',
  'matrixFirstGenerationProof',
  'behaviorEquivalenceMatrixFirstGeneratedByTaskId',
  'behaviorEquivalenceMatrixFirstGeneratedAt',
  'behaviorEquivalenceMatrixOwnerTaskCompletedAt',
  'behaviorEquivalenceReplayProof',
  'behaviorParityProof',
  'packageSourceProof',
  'semanticSizeProof',
  'dynamicNoFallbackProof',
  'settledEquivalenceProof',
  'g009AggregationProvenance',
  'distProof',
  'installProof',
  'registryProof',
  'noFallbackProof',
  'originalBytes',
  'originalLoc',
  'packageBytes',
  'packageLoc',
  'semanticPackageBytes',
  'semanticPackageLoc',
  'packageByteRatio',
  'packageLocRatio',
  'semanticPackageByteRatio',
  'semanticPackageLocRatio',
  'sizeDeltaThreshold',
  'sizeDeltaDecision',
  'sizeDeltaProof',
  'reworkHistory',
  'acceptanceIds',
];

const REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS = [
  'scenarioId',
  'originalEntryPoint',
  'originalEntryCommand',
  'packageEntryPoint',
  'packageEntryCommand',
  'argumentCombination',
  'args',
  'env',
  'fixtures',
  'expectedStdout',
  'expectedStderr',
  'expectedExitCode',
  'expectedFileArtifacts',
  'expectedErrorPaths',
  'expectedOutputProvenance',
  'scenarioCoverageProof',
];

const PACKAGE_SOURCE_PREFIX = 'packages/bmad-speckit/src/';
const PACKAGE_BIN_PREFIX = 'packages/bmad-speckit/bin/';
const PACKAGE_DIST_PREFIX = 'packages/bmad-speckit/dist/';
const PACKAGE_IMPLEMENTATION_PREFIXES = [PACKAGE_SOURCE_PREFIX];
const STRICT_SIZE_RATIO_MIN = 0.9;
const STRICT_SIZE_RATIO_MAX = 1.1;

const REQUIRED_SIZE_DELTA_THRESHOLD_FIELDS = [
  'byteRatioMin',
  'byteRatioMax',
  'locRatioMin',
  'locRatioMax',
];

const REQUIRED_SIZE_DELTA_PROOF_FIELDS = [
  'status',
  'originalPath',
  'packageImplementationSet',
  'originalBytes',
  'originalLoc',
  'packageBytes',
  'packageLoc',
  'packageByteRatio',
  'packageLocRatio',
  'semanticPackageBytes',
  'semanticPackageLoc',
  'semanticPackageByteRatio',
  'semanticPackageLocRatio',
  'rawByteDelta',
  'rawLocDelta',
  'semanticByteDelta',
  'semanticLocDelta',
  'sourceKindParityDecision',
  'sourceKindParityProblems',
  'threshold',
  'decision',
];

const REQUIRED_MATRIX_FIRST_GENERATION_PROOF_FIELDS = [
  'commandId',
  'ownerTaskId',
  'artifactPath',
  'artifactHash',
  'ledgerHashBeforeOwnerCompletion',
  'ownerCompletionEvidenceId',
];

const REQUIRED_BEHAVIOR_REPLAY_PROOF_FIELDS = [
  'replayCommandId',
  'replayStdoutPath',
  'replayStderrPath',
  'replayResultArtifactHash',
  'scenarioCount',
  'passedScenarioCount',
  'failedScenarioCount',
  'acceptanceIds',
];

const REQUIRED_SCENARIO_COVERAGE_PROOF_COUNT_FIELDS = [
  'entryPointCount',
  'argCombinationCount',
  'envKeyCount',
  'fixtureCount',
  'fileArtifactCount',
  'errorPathCount',
  'coveredEntryPointCount',
  'coveredArgCombinationCount',
  'coveredEnvKeyCount',
  'coveredFixtureCount',
  'coveredFileArtifactCount',
  'coveredErrorPathCount',
];

const REQUIRED_SEMANTIC_SIZE_PROOF_FIELDS = [
  'semanticPackageBytes',
  'semanticPackageLoc',
  'semanticPackageByteRatio',
  'semanticPackageLocRatio',
  'commentOnlyBytes',
  'deadCodeBytes',
  'sharedOvercountBytes',
  'antiPaddingDecision',
];

const ALLOWED_EXPECTED_OUTPUT_SOURCES = new Set(['original_replay', 'source_derived_original']);

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

const CANONICAL_TEXT_EXTENSIONS = new Set([
  '.cjs',
  '.css',
  '.csv',
  '.cts',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.mjs',
  '.mts',
  '.md',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function isCanonicalTextPath(relativePath) {
  const normalized = normalizePath(relativePath).toLowerCase();
  if (normalized.endsWith('/package.json')) return true;
  return CANONICAL_TEXT_EXTENSIONS.has(path.extname(normalized));
}

function canonicalizeText(value) {
  return String(value || '').replace(/\r\n|\r/gu, '\n');
}

function canonicalFileBuffer(relativePath) {
  const raw = fs.readFileSync(repoPath(relativePath));
  if (!isCanonicalTextPath(relativePath) || raw.includes(0)) return raw;
  return Buffer.from(canonicalizeText(raw.toString('utf8')), 'utf8');
}

function hasOwn(value, field) {
  return value && Object.prototype.hasOwnProperty.call(value, field);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasSemanticValue(value) {
  if (isNonEmptyString(value)) return true;
  if (Array.isArray(value)) return value.length > 0;
  return isPlainObject(value) && Object.keys(value).length > 0;
}

function commandTokens(value) {
  return String(value || '')
    .split(/[\s"'`]+/u)
    .map((token) => normalizePath(token).replace(/^[([{]+/u, '').replace(/[)\]},;]+$/u, ''))
    .filter(Boolean);
}

function commandReferencesRootScriptsPath(command, originalPath) {
  const normalizedOriginalPath = normalizePath(originalPath);
  const normalizedRoot = normalizePath(ROOT);
  const absoluteOriginalPath = normalizePath(repoPath(normalizedOriginalPath));
  return commandTokens(command).some((token) => {
    if (token === normalizedOriginalPath || token === `./${normalizedOriginalPath}`) return true;
    if (token === absoluteOriginalPath) return true;
    if (/^(?:\.\.\/)+scripts\//u.test(token)) return true;
    if (/^(?:\.\/)?scripts\//u.test(token)) return true;
    return token.startsWith(`${normalizedRoot}/scripts/`);
  });
}

function commandUsesForbiddenTypeScriptRuntime(command) {
  return commandTokens(command).some((token) => {
    const executable = path.basename(token).toLowerCase().replace(/\.(?:cmd|exe|ps1|bat)$/u, '');
    return executable === 'tsx' || executable === 'ts-node';
  });
}

function round4(value) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function isValidPackageImplementationPath(value) {
  const normalized = normalizePath(value);
  return PACKAGE_IMPLEMENTATION_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function isPackageSourcePath(value) {
  return normalizePath(value).startsWith(PACKAGE_SOURCE_PREFIX);
}

function isPackageDistPath(value) {
  return normalizePath(value).startsWith(PACKAGE_DIST_PREFIX);
}

function isTypeScriptFamilyPath(value) {
  return /\.(?:ts|tsx|cts|mts)$/u.test(normalizePath(value));
}

function isTypeScriptDeclarationPath(value) {
  return /\.d\.(?:ts|cts|mts)$/u.test(normalizePath(value));
}

function isTypeScriptRuntimePath(value) {
  return isTypeScriptFamilyPath(value) && !isTypeScriptDeclarationPath(value);
}

function isJavaScriptRuntimeOutputPath(value) {
  return /\.(?:js|cjs|mjs)$/u.test(normalizePath(value));
}

function sourceAuthorityPathToDistRuntimePath(value) {
  const normalized = normalizePath(value);
  if (!normalized.startsWith('packages/bmad-speckit/src/main-agent/')) return null;
  const distPath = normalized.replace(
    'packages/bmad-speckit/src/main-agent/',
    'packages/bmad-speckit/dist/main-agent/'
  );
  if (isTypeScriptDeclarationPath(distPath)) return distPath;
  if (/\.(?:ts|tsx)$/u.test(distPath)) return distPath.replace(/\.(?:ts|tsx)$/u, '.js');
  if (/\.cts$/u.test(distPath)) return distPath.replace(/\.cts$/u, '.cjs');
  if (/\.mts$/u.test(distPath)) return distPath.replace(/\.mts$/u, '.mjs');
  return distPath;
}

function isPackageBinPath(value) {
  return normalizePath(value).startsWith(PACKAGE_BIN_PREFIX);
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

function sourceKindParityProblems(entry, aggregatePackageInfo) {
  if (!aggregatePackageInfo || !Array.isArray(aggregatePackageInfo.files)) {
    return ['missing_aggregate_package_info_for_source_kind_parity'];
  }
  const sourceFiles = aggregatePackageInfo.files.filter((file) => isPackageSourcePath(file.path));
  if (sourceFiles.length === 0) return ['missing_package_source_file_for_source_kind_parity'];
  const originalPath = normalizePath(entry.originalPath);
  const problems = [];
  if (isTypeScriptFamilyPath(originalPath)) {
    const tsSourceFiles = sourceFiles.filter((file) => isTypeScriptFamilyPath(file.path));
    if (tsSourceFiles.length === 0) {
      problems.push('typescript_original_missing_package_typescript_source_authority');
    }
    if (isTypeScriptDeclarationPath(originalPath)) {
      const declarationSourceFiles = sourceFiles.filter((file) => isTypeScriptDeclarationPath(file.path));
      if (declarationSourceFiles.length === 0) {
        problems.push('typescript_declaration_original_missing_package_declaration_source_authority');
      }
      return [...new Set(problems)];
    }
    const jsSourceAuthorityFiles = sourceFiles.filter((file) => /\.(?:js|cjs|mjs)$/u.test(file.path));
    if (jsSourceAuthorityFiles.length > 0) {
      problems.push('typescript_original_packageImplementationSet_contains_js_runtime_source');
    }
    const generatedCjsFiles = sourceFiles.filter((file) => {
      if (!/\.(?:js|cjs)$/u.test(file.path)) return false;
      return isGeneratedCommonJsEmitText(fs.readFileSync(repoPath(file.path), 'utf8'));
    });
    if (generatedCjsFiles.length > 0) {
      problems.push('typescript_original_packageImplementationSet_contains_generated_cjs_emit_source');
    }
    if (generatedCjsFiles.length === sourceFiles.length) {
      problems.push('typescript_original_backed_only_by_generated_cjs_emit_source');
    }
  }
  return [...new Set(problems)];
}

function packageImplementationPathProblem(entry, implementationPath) {
  const normalized = normalizePath(implementationPath);
  if (!isNonEmptyString(normalized)) return 'empty_path';
  if (isPackageBinPath(normalized)) return 'bin_path_not_source_authority';
  if (isPackageDistPath(normalized)) return 'dist_path_not_source_authority';
  if (!isValidPackageImplementationPath(normalized)) return 'outside_package_source_authority';
  if (isTypeScriptDeclarationPath(entry.originalPath) && !isTypeScriptDeclarationPath(normalized)) {
    return 'typescript_declaration_original_requires_package_declaration_source_authority';
  }
  if (isTypeScriptRuntimePath(entry.originalPath) && !isTypeScriptRuntimePath(normalized)) {
    return 'typescript_original_requires_package_typescript_source_authority';
  }
  const absolute = repoPath(normalized);
  if (!fs.existsSync(absolute)) return 'missing_file';
  if (!fs.statSync(absolute).isFile()) return 'not_a_file';
  return null;
}

function packageImplementationSetProblems(entry) {
  if (!Array.isArray(entry.packageImplementationSet) || entry.packageImplementationSet.length === 0) {
    return [{ packageImplementationPath: null, reason: 'missing_or_empty_packageImplementationSet' }];
  }
  const problems = [];
  let hasSourcePath = false;
  let hasBinPath = false;
  for (const implementationPath of entry.packageImplementationSet) {
    const normalized = normalizePath(implementationPath);
    if (isPackageSourcePath(normalized)) hasSourcePath = true;
    if (isPackageBinPath(normalized)) hasBinPath = true;
    const reason = packageImplementationPathProblem(entry, implementationPath);
    if (reason) problems.push({ packageImplementationPath: implementationPath, reason });
  }
  if (!hasSourcePath) {
    problems.push({ packageImplementationPath: entry.packageImplementationSet.join(';'), reason: 'missing_package_source_path' });
  }
  if (hasBinPath && !hasSourcePath) {
    problems.push({ packageImplementationPath: entry.packageImplementationSet.join(';'), reason: 'bin_only_without_source_pair' });
  }
  return problems;
}

function normalizedPackageImplementationSet(entry) {
  return new Set(
    Array.isArray(entry.packageImplementationSet) ? entry.packageImplementationSet.map((item) => normalizePath(item)) : []
  );
}

function sourceAuthorityPathProblems(entry) {
  if (!Array.isArray(entry.sourceAuthorityPaths) || entry.sourceAuthorityPaths.length === 0) {
    return [{ path: null, reason: 'missing_or_empty_sourceAuthorityPaths' }];
  }
  const problems = [];
  const implementationSet = normalizedPackageImplementationSet(entry);
  const distOutputSet = new Set(
    Array.isArray(entry.distOutputPaths) ? entry.distOutputPaths.map((item) => normalizePath(item)) : []
  );
  const runtimeReplaySet = new Set(
    Array.isArray(entry.runtimeReplayPaths) ? entry.runtimeReplayPaths.map((item) => normalizePath(item)) : []
  );
  for (const sourcePath of entry.sourceAuthorityPaths) {
    const normalized = normalizePath(sourcePath);
    if (!implementationSet.has(normalized)) {
      problems.push({ path: sourcePath, reason: 'sourceAuthorityPath_not_in_packageImplementationSet' });
    }
    const reason = packageImplementationPathProblem(entry, normalized);
    if (reason) problems.push({ path: sourcePath, reason });
    const expectedDistRuntimePath = sourceAuthorityPathToDistRuntimePath(normalized);
    if (!expectedDistRuntimePath) {
      problems.push({ path: sourcePath, reason: 'sourceAuthorityPath_not_mappable_to_dist_runtime' });
      continue;
    }
    if (isTypeScriptRuntimePath(normalized) && !isJavaScriptRuntimeOutputPath(expectedDistRuntimePath)) {
      problems.push({ path: sourcePath, reason: 'typescript_sourceAuthorityPath_expected_dist_runtime_not_js' });
    }
    if (isTypeScriptDeclarationPath(normalized) && !isTypeScriptDeclarationPath(expectedDistRuntimePath)) {
      problems.push({ path: sourcePath, reason: 'typescript_declaration_sourceAuthorityPath_expected_dist_declaration' });
    }
    if (!distOutputSet.has(expectedDistRuntimePath)) {
      problems.push({
        path: sourcePath,
        expectedDistRuntimePath,
        reason: 'sourceAuthorityPath_missing_expected_distOutputPath',
      });
    }
    if (!runtimeReplaySet.has(expectedDistRuntimePath)) {
      problems.push({
        path: sourcePath,
        expectedDistRuntimePath,
        reason: 'sourceAuthorityPath_missing_expected_runtimeReplayPath',
      });
    }
    const expectedAbsolute = repoPath(expectedDistRuntimePath);
    if (!fs.existsSync(expectedAbsolute)) {
      problems.push({
        path: sourcePath,
        expectedDistRuntimePath,
        reason: 'sourceAuthorityPath_expected_dist_runtime_missing_file',
      });
    } else if (!fs.statSync(expectedAbsolute).isFile()) {
      problems.push({
        path: sourcePath,
        expectedDistRuntimePath,
        reason: 'sourceAuthorityPath_expected_dist_runtime_not_file',
      });
    }
  }
  return problems;
}

function runtimeReplayPathProblems(entry) {
  if (!Array.isArray(entry.runtimeReplayPaths) || entry.runtimeReplayPaths.length === 0) {
    return [{ path: null, reason: 'missing_or_empty_runtimeReplayPaths' }];
  }
  const problems = [];
  const distOutputSet = new Set(
    Array.isArray(entry.distOutputPaths) ? entry.distOutputPaths.map((item) => normalizePath(item)) : []
  );
  for (const runtimePath of entry.runtimeReplayPaths) {
    const normalized = normalizePath(runtimePath);
    if (!isPackageDistPath(normalized)) problems.push({ path: runtimePath, reason: 'runtimeReplayPath_not_under_package_dist' });
    if (normalized.startsWith(PACKAGE_SOURCE_PREFIX)) problems.push({ path: runtimePath, reason: 'runtimeReplayPath_uses_package_src' });
    if (isTypeScriptRuntimePath(entry.originalPath) && !isJavaScriptRuntimeOutputPath(normalized)) {
      problems.push({ path: runtimePath, reason: 'typescript_original_runtimeReplayPath_must_be_dist_js' });
    }
    if (isTypeScriptDeclarationPath(entry.originalPath) && !isTypeScriptDeclarationPath(normalized)) {
      problems.push({ path: runtimePath, reason: 'typescript_declaration_original_runtimeReplayPath_must_be_dist_declaration' });
    }
    const absolute = repoPath(normalized);
    if (!fs.existsSync(absolute)) problems.push({ path: runtimePath, reason: 'runtimeReplayPath_missing_file' });
    else if (!fs.statSync(absolute).isFile()) problems.push({ path: runtimePath, reason: 'runtimeReplayPath_not_file' });
    if (distOutputSet.size > 0 && !distOutputSet.has(normalized)) {
      problems.push({ path: runtimePath, reason: 'runtimeReplayPath_not_in_distOutputPaths' });
    }
  }
  return problems;
}

function distOutputPathProblems(entry) {
  if (!Array.isArray(entry.distOutputPaths) || entry.distOutputPaths.length === 0) {
    return [{ path: null, reason: 'missing_or_empty_distOutputPaths' }];
  }
  const problems = [];
  const runtimeReplaySet = new Set(
    Array.isArray(entry.runtimeReplayPaths) ? entry.runtimeReplayPaths.map((item) => normalizePath(item)) : []
  );
  for (const distPath of entry.distOutputPaths) {
    const normalized = normalizePath(distPath);
    if (!isPackageDistPath(normalized)) problems.push({ path: distPath, reason: 'distOutputPath_not_under_package_dist' });
    if (normalized.startsWith(PACKAGE_SOURCE_PREFIX)) problems.push({ path: distPath, reason: 'distOutputPath_uses_package_src' });
    if (isTypeScriptRuntimePath(entry.originalPath) && !isJavaScriptRuntimeOutputPath(normalized)) {
      problems.push({ path: distPath, reason: 'typescript_original_distOutputPath_must_be_dist_js' });
    }
    if (isTypeScriptDeclarationPath(entry.originalPath) && !isTypeScriptDeclarationPath(normalized)) {
      problems.push({ path: distPath, reason: 'typescript_declaration_original_distOutputPath_must_be_dist_declaration' });
    }
    const absolute = repoPath(normalized);
    if (!fs.existsSync(absolute)) problems.push({ path: distPath, reason: 'distOutputPath_missing_file' });
    else if (!fs.statSync(absolute).isFile()) problems.push({ path: distPath, reason: 'distOutputPath_not_file' });
    if (runtimeReplaySet.size > 0 && !runtimeReplaySet.has(normalized)) {
      problems.push({ path: distPath, reason: 'distOutputPath_not_in_runtimeReplayPaths' });
    }
  }
  return problems;
}

function expectedOutputProvenanceProblems(provenance) {
  const problems = [];
  if (!isPlainObject(provenance)) return ['expectedOutputProvenance_not_object'];
  if (!ALLOWED_EXPECTED_OUTPUT_SOURCES.has(provenance.expectedSource)) {
    problems.push('expectedSource_not_original_authority');
  }
  if (provenance.expectedSource === 'original_replay') {
    if (!isNonEmptyString(provenance.originalReplayCommandId)) problems.push('missing_originalReplayCommandId');
    if (!isNonEmptyString(provenance.originalReplayArtifactHash)) problems.push('missing_originalReplayArtifactHash');
  }
  if (provenance.expectedSource === 'source_derived_original') {
    if (!isNonEmptyString(provenance.sourceDerivedProofId)) problems.push('missing_sourceDerivedProofId');
    if (!Array.isArray(provenance.sourceLineAnchors) || provenance.sourceLineAnchors.length === 0) {
      problems.push('missing_sourceLineAnchors');
    }
  }
  return problems;
}

function scenarioCoverageProofProblems(proof) {
  const problems = [];
  if (!isPlainObject(proof)) return ['scenarioCoverageProof_not_object'];
  if (proof.coverageDecision !== 'passed_full_original_behavior_coverage') {
    problems.push('coverageDecision_not_passed_full_original_behavior_coverage');
  }
  for (const field of REQUIRED_SCENARIO_COVERAGE_PROOF_COUNT_FIELDS) {
    if (typeof proof[field] !== 'number' || !Number.isFinite(proof[field]) || proof[field] < 0) {
      problems.push(`invalid_${field}`);
    }
  }
  const countPairs = [
    ['entryPointCount', 'coveredEntryPointCount'],
    ['argCombinationCount', 'coveredArgCombinationCount'],
    ['envKeyCount', 'coveredEnvKeyCount'],
    ['fixtureCount', 'coveredFixtureCount'],
    ['fileArtifactCount', 'coveredFileArtifactCount'],
    ['errorPathCount', 'coveredErrorPathCount'],
  ];
  for (const [discoveredField, coveredField] of countPairs) {
    if (
      typeof proof[discoveredField] === 'number' &&
      typeof proof[coveredField] === 'number' &&
      proof[coveredField] !== proof[discoveredField]
    ) {
      problems.push(`${coveredField}_does_not_equal_${discoveredField}`);
    }
  }
  return problems;
}

function behaviorScenarioProblems(entry, scenario) {
  const problems = [];
  if (!isPlainObject(scenario)) return ['scenario_not_object'];
  const ownerTaskId = String(entry.matrixOwnerTaskId || '');
  const ownerScenarioPrefix = `${ownerTaskId.toLowerCase()}_`;
  const ownerProofPrefix = `${ownerTaskId}_`;
  const requiredFieldGaps = REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS.filter((field) => !hasOwn(scenario, field));
  problems.push(...requiredFieldGaps.map((field) => `missing_${field}`));
  if (!isNonEmptyString(scenario.scenarioId)) problems.push('invalid_scenarioId');
  else if (ownerTaskId && !String(scenario.scenarioId).startsWith(ownerScenarioPrefix)) {
    problems.push('scenarioId_owner_prefix_mismatch');
  }
  if (!isNonEmptyString(scenario.originalEntryPoint)) problems.push('invalid_originalEntryPoint');
  if (!isNonEmptyString(scenario.originalEntryCommand)) problems.push('invalid_originalEntryCommand');
  if (isNonEmptyString(scenario.originalEntryCommand) && !normalizePath(scenario.originalEntryCommand).includes(entry.originalPath)) {
    problems.push('originalEntryCommand_does_not_reference_originalPath');
  }
  const packageEntryPoint = normalizePath(scenario.packageEntryPoint);
  if (!isNonEmptyString(packageEntryPoint) || !isPackageSourcePath(packageEntryPoint)) {
    problems.push('invalid_packageEntryPoint');
  } else {
    const absolutePackageEntryPoint = repoPath(packageEntryPoint);
    if (!fs.existsSync(absolutePackageEntryPoint)) {
      problems.push('packageEntryPoint_missing_file');
    } else if (!fs.statSync(absolutePackageEntryPoint).isFile()) {
      problems.push('packageEntryPoint_not_file');
    }
    if (!normalizedPackageImplementationSet(entry).has(packageEntryPoint)) {
      problems.push('packageEntryPoint_not_in_packageImplementationSet');
    }
  }
  if (!isNonEmptyString(scenario.packageEntryCommand)) problems.push('invalid_packageEntryCommand');
  const normalizedPackageEntryCommand = normalizePath(scenario.packageEntryCommand);
  const runtimeReplayPaths = Array.isArray(entry.runtimeReplayPaths)
    ? entry.runtimeReplayPaths.map((item) => normalizePath(item))
    : [];
  if (
    isNonEmptyString(scenario.packageEntryCommand) &&
    (commandReferencesRootScriptsPath(scenario.packageEntryCommand, entry.originalPath) ||
      commandUsesForbiddenTypeScriptRuntime(scenario.packageEntryCommand) ||
      normalizedPackageEntryCommand.includes('compiled/main-agent-orchestration.cjs') ||
      scenario.packageEntryCommand.includes('compiledOrchestrationModule'))
  ) {
    problems.push('packageEntryCommand_uses_forbidden_original_or_fallback_runtime');
  }
  if (isNonEmptyString(scenario.packageEntryCommand) && normalizedPackageEntryCommand.includes(PACKAGE_SOURCE_PREFIX)) {
    problems.push('packageEntryCommand_uses_package_src_instead_of_dist_runtime');
  }
  if (
    isNonEmptyString(scenario.packageEntryCommand) &&
    runtimeReplayPaths.length > 0 &&
    !runtimeReplayPaths.some((runtimePath) => normalizedPackageEntryCommand.includes(runtimePath))
  ) {
    problems.push('packageEntryCommand_missing_runtimeReplayPath');
  }
  if (!hasSemanticValue(scenario.argumentCombination)) problems.push('invalid_argumentCombination');
  if (!Array.isArray(scenario.args)) problems.push('args_not_array');
  if (!isPlainObject(scenario.env)) problems.push('env_not_object');
  if (!Array.isArray(scenario.fixtures)) problems.push('fixtures_not_array');
  if (typeof scenario.expectedStdout !== 'string') problems.push('expectedStdout_not_string');
  if (typeof scenario.expectedStderr !== 'string') problems.push('expectedStderr_not_string');
  if (!Number.isInteger(scenario.expectedExitCode)) problems.push('expectedExitCode_not_integer');
  if (!Array.isArray(scenario.expectedFileArtifacts)) problems.push('expectedFileArtifacts_not_array');
  if (!Array.isArray(scenario.expectedErrorPaths)) problems.push('expectedErrorPaths_not_array');
  problems.push(...expectedOutputProvenanceProblems(scenario.expectedOutputProvenance));
  problems.push(...scenarioCoverageProofProblems(scenario.scenarioCoverageProof));
  const scenarioProvenance = isPlainObject(scenario.expectedOutputProvenance)
    ? scenario.expectedOutputProvenance
    : {};
  if (
    isNonEmptyString(scenarioProvenance.originalReplayCommandId) &&
    !String(scenarioProvenance.originalReplayCommandId).startsWith(ownerProofPrefix)
  ) {
    problems.push('originalReplayCommandId_owner_prefix_mismatch');
  }
  if (
    isNonEmptyString(scenarioProvenance.sourceDerivedProofId) &&
    !String(scenarioProvenance.sourceDerivedProofId).startsWith(ownerProofPrefix)
  ) {
    problems.push('sourceDerivedProofId_owner_prefix_mismatch');
  }
  if (
    isPlainObject(scenario.scenarioCoverageProof) &&
    isNonEmptyString(scenario.scenarioCoverageProof.staticAnalysisCommandId) &&
    !String(scenario.scenarioCoverageProof.staticAnalysisCommandId).startsWith(ownerProofPrefix)
  ) {
    problems.push('staticAnalysisCommandId_owner_prefix_mismatch');
  }
  return [...new Set(problems)];
}

function rowExpectedOutputProvenanceProblems(entry) {
  const problems = expectedOutputProvenanceProblems(entry.expectedOutputProvenance);
  const ownerProofPrefix = `${String(entry.matrixOwnerTaskId || '')}_`;
  if (
    entry.expectedOutputProvenance &&
    isNonEmptyString(entry.expectedOutputProvenance.originalReplayCommandId) &&
    !String(entry.expectedOutputProvenance.originalReplayCommandId).startsWith(ownerProofPrefix)
  ) {
    problems.push('originalReplayCommandId_owner_prefix_mismatch');
  }
  if (
    entry.expectedOutputProvenance &&
    isNonEmptyString(entry.expectedOutputProvenance.sourceDerivedProofId) &&
    !String(entry.expectedOutputProvenance.sourceDerivedProofId).startsWith(ownerProofPrefix)
  ) {
    problems.push('sourceDerivedProofId_owner_prefix_mismatch');
  }
  if (entry.expectedOutputProvenance && entry.expectedOutputProvenance.expectedSource === 'package_observed') {
    problems.push('expectedSource_package_observed');
  }
  return problems;
}

function rowScenarioCoverageProofProblems(entry) {
  return scenarioCoverageProofProblems(entry.scenarioCoverageProof);
}

function behaviorReplayProofProblems(entry) {
  const proof = entry.behaviorEquivalenceReplayProof;
  if (!isPlainObject(proof)) return ['behaviorEquivalenceReplayProof_not_object'];
  const problems = [];
  for (const field of REQUIRED_BEHAVIOR_REPLAY_PROOF_FIELDS) {
    if (!hasOwn(proof, field)) problems.push(`missing_${field}`);
  }
  if (!isNonEmptyString(proof.replayCommandId)) problems.push('invalid_replayCommandId');
  if (!isNonEmptyString(proof.replayStdoutPath)) problems.push('invalid_replayStdoutPath');
  if (!isNonEmptyString(proof.replayStderrPath)) problems.push('invalid_replayStderrPath');
  if (!isNonEmptyString(proof.replayResultArtifactHash)) problems.push('invalid_replayResultArtifactHash');
  const scenarioCount = Array.isArray(entry.behaviorEquivalenceMatrix) ? entry.behaviorEquivalenceMatrix.length : 0;
  if (proof.scenarioCount !== scenarioCount) problems.push('scenarioCount_does_not_match_behaviorEquivalenceMatrix');
  if (proof.passedScenarioCount !== scenarioCount) problems.push('passedScenarioCount_does_not_match_behaviorEquivalenceMatrix');
  if (proof.failedScenarioCount !== 0) problems.push('failedScenarioCount_not_zero');
  if (!Array.isArray(proof.acceptanceIds) || proof.acceptanceIds.length === 0) problems.push('acceptanceIds_not_non_empty_array');
  return [...new Set(problems)];
}

function matrixFirstGenerationProofProblems(entry) {
  const proof = entry.matrixFirstGenerationProof;
  if (!isPlainObject(proof)) return ['matrixFirstGenerationProof_not_object'];
  const problems = [];
  for (const field of REQUIRED_MATRIX_FIRST_GENERATION_PROOF_FIELDS) {
    if (!hasOwn(proof, field)) problems.push(`missing_${field}`);
  }
  if (proof.ownerTaskId !== entry.matrixOwnerTaskId) problems.push('ownerTaskId_does_not_match_matrixOwnerTaskId');
  if (!isNonEmptyString(proof.commandId)) problems.push('invalid_commandId');
  if (!isNonEmptyString(proof.artifactPath)) problems.push('invalid_artifactPath');
  if (!isNonEmptyString(proof.artifactHash)) problems.push('invalid_artifactHash');
  if (!isNonEmptyString(proof.ledgerHashBeforeOwnerCompletion)) {
    problems.push('invalid_ledgerHashBeforeOwnerCompletion');
  }
  if (!isNonEmptyString(proof.ownerCompletionEvidenceId)) problems.push('invalid_ownerCompletionEvidenceId');
  if (entry.behaviorEquivalenceMatrixFirstGeneratedByTaskId !== entry.matrixOwnerTaskId) {
    problems.push('behaviorEquivalenceMatrixFirstGeneratedByTaskId_does_not_match_matrixOwnerTaskId');
  }
  return [...new Set(problems)];
}

function semanticSizeProofProblems(entry) {
  const proof = entry.semanticSizeProof;
  if (!isPlainObject(proof)) return ['semanticSizeProof_not_object'];
  const problems = [];
  for (const field of REQUIRED_SEMANTIC_SIZE_PROOF_FIELDS) {
    if (!hasOwn(proof, field)) problems.push(`missing_${field}`);
  }
  if (proof.antiPaddingDecision !== 'passed_no_semantic_padding') problems.push('antiPaddingDecision_not_passed');
  for (const field of ['commentOnlyBytes', 'deadCodeBytes', 'sharedOvercountBytes']) {
    if (typeof proof[field] !== 'number' || proof[field] < 0) problems.push(`invalid_${field}`);
  }
  if (proof.semanticPackageBytes !== entry.semanticPackageBytes) problems.push('semanticPackageBytes_mismatch');
  if (proof.semanticPackageLoc !== entry.semanticPackageLoc) problems.push('semanticPackageLoc_mismatch');
  if (proof.semanticPackageByteRatio !== entry.semanticPackageByteRatio) problems.push('semanticPackageByteRatio_mismatch');
  if (proof.semanticPackageLocRatio !== entry.semanticPackageLocRatio) problems.push('semanticPackageLocRatio_mismatch');
  return [...new Set(problems)];
}

function sizeDeltaProofProblems(entry, aggregatePackageInfo, sourceKindProblems) {
  const proof = entry.sizeDeltaProof;
  if (!isPlainObject(proof)) return ['sizeDeltaProof_not_object'];
  const problems = [];
  for (const field of REQUIRED_SIZE_DELTA_PROOF_FIELDS) {
    if (!hasOwn(proof, field)) problems.push(`missing_${field}`);
  }
  if (proof.originalPath !== entry.originalPath) problems.push('originalPath_mismatch');
  if (proof.originalBytes !== entry.originalBytes) problems.push('originalBytes_mismatch');
  if (proof.originalLoc !== entry.originalLoc) problems.push('originalLoc_mismatch');
  if (proof.packageBytes !== entry.packageBytes) problems.push('packageBytes_mismatch');
  if (proof.packageLoc !== entry.packageLoc) problems.push('packageLoc_mismatch');
  if (proof.packageByteRatio !== entry.packageByteRatio) problems.push('packageByteRatio_mismatch');
  if (proof.packageLocRatio !== entry.packageLocRatio) problems.push('packageLocRatio_mismatch');
  if (proof.semanticPackageBytes !== entry.semanticPackageBytes) problems.push('semanticPackageBytes_mismatch');
  if (proof.semanticPackageLoc !== entry.semanticPackageLoc) problems.push('semanticPackageLoc_mismatch');
  if (proof.semanticPackageByteRatio !== entry.semanticPackageByteRatio) problems.push('semanticPackageByteRatio_mismatch');
  if (proof.semanticPackageLocRatio !== entry.semanticPackageLocRatio) problems.push('semanticPackageLocRatio_mismatch');
  if (proof.rawByteDelta !== entry.packageBytes - entry.originalBytes) problems.push('rawByteDelta_mismatch');
  if (proof.rawLocDelta !== entry.packageLoc - entry.originalLoc) problems.push('rawLocDelta_mismatch');
  if (proof.semanticByteDelta !== entry.semanticPackageBytes - entry.originalBytes) {
    problems.push('semanticByteDelta_mismatch');
  }
  if (proof.semanticLocDelta !== entry.semanticPackageLoc - entry.originalLoc) {
    problems.push('semanticLocDelta_mismatch');
  }
  const expectedSourceKindDecision =
    Array.isArray(sourceKindProblems) && sourceKindProblems.length === 0
      ? 'passed_source_kind_parity'
      : 'failed_source_kind_parity';
  if (proof.sourceKindParityDecision !== expectedSourceKindDecision) {
    problems.push('sourceKindParityDecision_mismatch');
  }
  if (!Array.isArray(proof.sourceKindParityProblems)) {
    problems.push('sourceKindParityProblems_not_array');
  }
  if (
    Array.isArray(sourceKindProblems) &&
    Array.isArray(proof.sourceKindParityProblems) &&
    JSON.stringify(proof.sourceKindParityProblems) !== JSON.stringify(sourceKindProblems)
  ) {
    problems.push('sourceKindParityProblems_mismatch');
  }
  if (aggregatePackageInfo && Array.isArray(proof.packageImplementationSet)) {
    const proofSet = proof.packageImplementationSet.map((item) => normalizePath(item)).sort();
    const actualSet = aggregatePackageInfo.files.map((file) => normalizePath(file.path)).sort();
    if (JSON.stringify(proofSet) !== JSON.stringify(actualSet)) problems.push('packageImplementationSet_mismatch');
  }
  return [...new Set(problems)];
}

function g009AggregationProvenanceProblems(entry) {
  const proof = entry.g009AggregationProvenance;
  if (!isPlainObject(proof)) return { gaps: ['g009AggregationProvenance_not_object'], hashMismatches: [] };
  const gaps = [];
  const hashMismatches = [];
  const requiredFields = [
    'status',
    'ownerTaskId',
    'ownerArtifactPath',
    'ownerArtifactHash',
    'ownerRowHash',
    'aggregateArtifactPath',
    'aggregateArtifactHash',
    'aggregatedRowHash',
  ];
  for (const field of requiredFields) {
    if (!hasOwn(proof, field)) gaps.push(`missing_${field}`);
  }
  if (proof.status !== 'passed_hash_preserving_aggregation') gaps.push('status_not_passed_hash_preserving_aggregation');
  if (proof.ownerTaskId !== entry.matrixOwnerTaskId) gaps.push('ownerTaskId_does_not_match_matrixOwnerTaskId');
  for (const field of [
    'ownerArtifactPath',
    'ownerArtifactHash',
    'ownerRowHash',
    'aggregateArtifactPath',
    'aggregateArtifactHash',
    'aggregatedRowHash',
  ]) {
    if (!isNonEmptyString(proof[field])) gaps.push(`invalid_${field}`);
  }
  if (
    isNonEmptyString(proof.ownerRowHash) &&
    isNonEmptyString(proof.aggregatedRowHash) &&
    proof.ownerRowHash !== proof.aggregatedRowHash
  ) {
    hashMismatches.push('aggregatedRowHash_does_not_match_ownerRowHash');
  }
  return { gaps: [...new Set(gaps)], hashMismatches: [...new Set(hashMismatches)] };
}

function repoPath(relativePath) {
  return path.join(ROOT, normalizePath(relativePath));
}

function readText(relativePath) {
  return canonicalFileBuffer(relativePath).toString('utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function sha256File(relativePath) {
  return sha256Buffer(canonicalFileBuffer(relativePath));
}

function nowIso() {
  return new Date().toISOString();
}

function formatJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function ensureDir(relativePath) {
  fs.mkdirSync(repoPath(relativePath), { recursive: true });
}

function writeJson(relativePath, value) {
  const target = repoPath(relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, formatJson(value), 'utf8');
  return {
    path: normalizePath(relativePath),
    bytes: Buffer.byteLength(formatJson(value), 'utf8'),
    hash: sha256File(relativePath),
  };
}

function fileInfo(relativePath) {
  const text = readText(relativePath);
  return {
    path: normalizePath(relativePath),
    bytes: Buffer.byteLength(text, 'utf8'),
    lines: text.split(/\n/u).length,
    sha256: sha256File(relativePath),
  };
}

function aggregatePackageImplementationInfo(entry) {
  if (!Array.isArray(entry.packageImplementationSet) || entry.packageImplementationSet.length === 0) {
    return null;
  }
  const normalizedPaths = [...new Set(entry.packageImplementationSet.map((item) => normalizePath(item)))];
  const files = [];
  for (const implementationPath of normalizedPaths) {
    const absolute = repoPath(implementationPath);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      return null;
    }
    files.push(fileInfo(implementationPath));
  }
  return {
    files,
    bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    lines: files.reduce((sum, file) => sum + file.lines, 0),
  };
}

function loadSources() {
  const inventory = readJson(INVENTORY_PATH);
  const queue = readJson(QUEUE_PATH);
  const parity = readJson(PARITY_PATH);
  const queueByPath = new Map(queue.queue.map((entry) => [normalizePath(entry.originalPath), entry]));
  const parityByPath = new Map(parity.entries.map((entry) => [normalizePath(entry.originalPath), entry]));
  const inventoryByPath = new Map(inventory.scripts.map((entry) => [normalizePath(entry.path), entry]));
  return { inventory, queue, parity, queueByPath, parityByPath, inventoryByPath };
}

function sourceHashReport() {
  return Object.fromEntries(
    Object.entries(EXPECTED_HASHES).map(([relativePath, expected]) => {
      const actual = sha256File(relativePath);
      return [relativePath, { expected, actual, ok: expected === actual }];
    })
  );
}

function dirtyWorktreeSnapshot() {
  const result = spawnSync('git', ['status', '--short'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return {
    command: 'git status --short',
    exitCode: result.status,
    stdout: result.stdout.split(/\r?\n/).filter(Boolean),
    stderr: result.stderr.split(/\r?\n/).filter(Boolean),
  };
}

function deriveScopeClass(originalPath, queueByPath) {
  return queueByPath.has(normalizePath(originalPath)) ? 'backlog_migration' : 'settled_revalidation';
}

function deriveOwner(scopeClass, priority, migrationStrategy, originalPath) {
  if (
    originalPath === 'scripts/main-agent-orchestration.ts' &&
    priority === 'P0-core-source-authority' &&
    migrationStrategy === 'package_runtime_module'
  ) {
    return { ruleId: 'owner_rule_p0_core', ownerTaskId: 'G003' };
  }
  if (
    scopeClass === 'backlog_migration' &&
    priority === 'P1-real-package-source-required' &&
    migrationStrategy === 'package_runtime_module'
  ) {
    return { ruleId: 'owner_rule_p1_runtime', ownerTaskId: 'G004' };
  }
  if (
    scopeClass === 'backlog_migration' &&
    priority === 'P1-real-package-source-required' &&
    migrationStrategy === 'public_cli_de_surface'
  ) {
    return { ruleId: 'owner_rule_p1_public_cli', ownerTaskId: 'G005' };
  }
  if (
    scopeClass === 'backlog_migration' &&
    priority === 'P1-real-package-source-required' &&
    ['compatibility_alias', 'runtime_emit_cjs', 'durable_helper_copy'].includes(migrationStrategy)
  ) {
    return { ruleId: 'owner_rule_p1_alias_cjs_helper', ownerTaskId: 'G006' };
  }
  if (
    scopeClass === 'backlog_migration' &&
    priority === 'P2-helper-and-functional-evidence' &&
    migrationStrategy === 'durable_helper_copy'
  ) {
    return { ruleId: 'owner_rule_p2_durable_helper', ownerTaskId: 'G007' };
  }
  if (
    (scopeClass === 'backlog_migration' &&
      priority === 'P2-helper-and-functional-evidence' &&
      ['package_runtime_module', 'public_cli_de_surface'].includes(migrationStrategy)) ||
    (scopeClass === 'backlog_migration' && priority === 'P3-parity-evidence-and-size-ledger') ||
    scopeClass === 'settled_revalidation'
  ) {
    return { ruleId: 'owner_rule_g008_residual_or_settled', ownerTaskId: 'G008' };
  }
  return { ruleId: 'owner_rule_unmatched', ownerTaskId: 'blocked_until_contract_amendment' };
}

function emptyCoverageProof() {
  return {
    staticAnalysisCommandId: null,
    entryPointCount: 0,
    argCombinationCount: 0,
    envKeyCount: 0,
    fixtureCount: 0,
    fileArtifactCount: 0,
    errorPathCount: 0,
    coveredEntryPointCount: 0,
    coveredArgCombinationCount: 0,
    coveredEnvKeyCount: 0,
    coveredFixtureCount: 0,
    coveredFileArtifactCount: 0,
    coveredErrorPathCount: 0,
    coverageDecision: 'blocked_until_full_original_behavior_coverage',
  };
}

function buildLedgerEntry({ parityEntry, inventoryEntry, queueEntry }) {
  const originalPath = normalizePath(parityEntry.originalPath);
  const scopeClass = queueEntry ? 'backlog_migration' : 'settled_revalidation';
  const latest = parityEntry.latestRegistryState || inventoryEntry.latestRegistryState || {};
  const priority = queueEntry ? queueEntry.priority : 'settled_revalidation';
  const migrationStrategy = queueEntry
    ? queueEntry.migrationStrategy
    : latest.migrationStrategy || 'repo_internal_reclassify';
  const owner = deriveOwner(scopeClass, priority, migrationStrategy, originalPath);
  const originalBytes = inventoryEntry.rawBytes;
  const originalLoc = inventoryEntry.rawLines;
  return {
    originalPath,
    entryId: queueEntry ? queueEntry.entryId : latest.entryId,
    scopeClass,
    priority,
    migrationStrategy,
    preliminaryParityStatus: parityEntry.preliminaryParityStatus,
    sourceSha256: parityEntry.originalSha256 || inventoryEntry.sha256,
    targetPaths: latest.targetPaths || [],
    matrixOwnerAssignmentRuleId: owner.ruleId,
    expectedMatrixOwnerTaskId: owner.ownerTaskId,
    matrixOwnerTaskId: owner.ownerTaskId,
    packageImplementationSet: [],
    sourceAuthorityPaths: [],
    runtimeReplayPaths: [],
    distOutputPaths: [],
    changedFiles: [],
    behaviorEquivalenceMatrix: [],
    scenarioCoverageProof: emptyCoverageProof(),
    expectedOutputProvenance: {
      expectedSource: 'blocked_until_original_replay_or_source_derived',
    },
    matrixFirstGenerationProof: {
      status: 'blocked_until_owner_task_artifact_hash_recorded',
    },
    behaviorEquivalenceMatrixFirstGeneratedByTaskId: 'blocked_until_matrix_owner_task_generates_matrix',
    behaviorEquivalenceMatrixFirstGeneratedAt: null,
    behaviorEquivalenceMatrixOwnerTaskCompletedAt: null,
    behaviorEquivalenceReplayProof: {
      status: 'blocked_until_behavior_equivalence_matrix_replay_recorded',
      failedScenarioCount: null,
    },
    behaviorParityProof: {
      status: 'blocked_until_behavior_equivalence_matrix_replay_recorded',
    },
    packageSourceProof: {
      status: 'blocked_until_package_implementation_set_recorded',
    },
    semanticSizeProof: {
      semanticPackageBytes: 0,
      semanticPackageLoc: 0,
      semanticPackageByteRatio: null,
      semanticPackageLocRatio: null,
      commentOnlyBytes: null,
      deadCodeBytes: null,
      sharedOvercountBytes: null,
      antiPaddingDecision: 'blocked_until_semantic_size_scan',
    },
    dynamicNoFallbackProof: {
      status: 'blocked_until_dynamic_no_fallback_scan',
    },
    settledEquivalenceProof: {
      status:
        scopeClass === 'settled_revalidation'
          ? 'blocked_until_wave_4_1_package_equivalence_revalidated'
          : 'not_settled_revalidation_row',
    },
    g009AggregationProvenance: {
      status: 'blocked_until_owner_matrix_artifacts_exist',
    },
    distProof: {
      status: 'blocked_until_package_dist_generated_when_required',
    },
    installProof: {
      status: 'blocked_until_install_matrix_when_required',
    },
    registryProof: {
      status: 'blocked_until_registry_wave_4_1_evidence_recorded',
    },
    noFallbackProof: {
      status: 'blocked_until_full_inventory_no_fallback_scan',
    },
    originalBytes,
    originalLoc,
    packageBytes: 0,
    packageLoc: 0,
    semanticPackageBytes: 0,
    semanticPackageLoc: 0,
    packageByteRatio: null,
    packageLocRatio: null,
    semanticPackageByteRatio: null,
    semanticPackageLocRatio: null,
    sizeDeltaThreshold: {
      byteRatioMin: STRICT_SIZE_RATIO_MIN,
      byteRatioMax: STRICT_SIZE_RATIO_MAX,
      locRatioMin: STRICT_SIZE_RATIO_MIN,
      locRatioMax: STRICT_SIZE_RATIO_MAX,
    },
    sizeDeltaDecision: 'blocked_until_package_implementation_set_recorded',
    sizeDeltaProof: {
      status: 'blocked_until_package_size_metrics_recorded',
    },
    reworkHistory: [],
    acceptanceIds: [],
    validationResult: {
      status:
        scopeClass === 'backlog_migration'
          ? 'blocked_until_wave_4_1_implementation_proof_recorded'
          : 'blocked_until_wave_4_1_package_equivalence_revalidated',
      reworkRequired: true,
    },
    sourceFacts: {
      originalRawBytes: inventoryEntry.rawBytes,
      originalRawLines: inventoryEntry.rawLines,
      originalNormalizedBytes: inventoryEntry.normalizedBytes,
      originalNormalizedLoc: inventoryEntry.normalizedLoc,
      callerCount: inventoryEntry.callers ? inventoryEntry.callers.count : 0,
      latestRegistryState: latest,
      queueEntry: queueEntry || null,
    },
  };
}

function buildLedger() {
  const sources = loadSources();
  const entries = sources.parity.entries.map((parityEntry) => {
    const originalPath = normalizePath(parityEntry.originalPath);
    const inventoryEntry = sources.inventoryByPath.get(originalPath);
    if (!inventoryEntry) throw new Error(`missing inventory entry for ${originalPath}`);
    const queueEntry = sources.queueByPath.get(originalPath) || null;
    return buildLedgerEntry({ parityEntry, inventoryEntry, queueEntry });
  });
  return {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-ledger/v1',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    sourcePlanPath: INVENTORY_PATH,
    sourcePlanHash: EXPECTED_HASHES[INVENTORY_PATH],
    queuePath: QUEUE_PATH,
    queueHash: EXPECTED_HASHES[QUEUE_PATH],
    parityPath: PARITY_PATH,
    parityHash: EXPECTED_HASHES[PARITY_PATH],
    generatedAt: nowIso(),
    totals: {
      allScripts: entries.length,
      backlog_migration: entries.filter((entry) => entry.scopeClass === 'backlog_migration').length,
      settled_revalidation: entries.filter((entry) => entry.scopeClass === 'settled_revalidation').length,
      ownerCounts: countBy(entries, 'matrixOwnerTaskId'),
    },
    entries,
  };
}

function countBy(entries, key) {
  return entries.reduce((acc, entry) => {
    const value = entry[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function captureScopeBaseline() {
  const { inventory, queue, parity, queueByPath } = loadSources();
  const parityPaths = new Set(parity.entries.map((entry) => normalizePath(entry.originalPath)));
  const settledRows = parity.entries.filter((entry) => !queueByPath.has(normalizePath(entry.originalPath)));
  return {
    schemaVersion: 'main-agent-runtime-migration-wave-4-1-scope-baseline/v1',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    capturedAt: nowIso(),
    sourceHashes: sourceHashReport(),
    sourceFacts: {
      inventory: fileInfo(INVENTORY_PATH),
      queue: fileInfo(QUEUE_PATH),
      parity: fileInfo(PARITY_PATH),
      registry: fileInfo(REGISTRY_PATH),
    },
    fullUniverseTotals: {
      allScripts: inventory.scripts.length,
      parityRows: parity.entries.length,
      allInventoryRowsHaveParityRows: inventory.scripts.every((entry) => parityPaths.has(entry.path)),
      backlog_migration: queue.queue.length,
      settled_revalidation: settledRows.length,
    },
    backlogQueueTotals: queue.totals,
    deterministicOwnerAssignmentCounts: OWNER_EXPECTED_COUNTS,
    dirtyWorktreeSnapshot: dirtyWorktreeSnapshot(),
  };
}

function summarizeLedger(entries) {
  const missingRequiredFields = [];
  const ownerAssignmentMismatches = [];
  const missingOwnerAssignmentRule = [];
  const unexpectedOwnerAssignment = [];
  const missingPackageImplementationSet = [];
  const invalidPackageImplementationPaths = [];
  const sourceAuthorityPathGaps = [];
  const runtimeReplayPathGaps = [];
  const distOutputPathGaps = [];
  const missingBehaviorEquivalenceMatrix = [];
  const behaviorEquivalenceMatrixScenarioFieldGaps = [];
  const behaviorEquivalenceMatrixScenarioCoverageGaps = [];
  const missingBehaviorEquivalenceReplayProof = [];
  const scenarioCoverageGaps = [];
  const expectedOutputProvenanceGaps = [];
  const packageObservedExpectedOutputRows = [];
  const firstGenerationProofGaps = [];
  const matrixOwnerCompletionTimingGaps = [];
  const semanticSizePaddingViolations = [];
  const sizeDeltaProofGaps = [];
  const sourceKindParityViolations = [];
  const semanticZeroSizeMetrics = [];
  const semanticSizeDeltaViolations = [];
  const zeroSizeMetrics = [];
  const sizeDeltaViolations = [];
  const sizeDeltaComputationMismatches = [];
  const semanticSizeComputationMismatches = [];
  const sizeDeltaThresholdShapeGaps = [];
  const settledEquivalenceBypasses = [];
  const g009AggregationProofGaps = [];
  const g009AggregationHashMismatches = [];
  const ownerCounts = countBy(entries, 'matrixOwnerTaskId');

  for (const entry of entries) {
    for (const field of REQUIRED_LEDGER_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(entry, field)) {
        missingRequiredFields.push({ originalPath: entry.originalPath, field });
      }
    }
    const expected = deriveOwner(entry.scopeClass, entry.priority, entry.migrationStrategy, entry.originalPath);
    if (!entry.matrixOwnerAssignmentRuleId) missingOwnerAssignmentRule.push(entry.originalPath);
    if (expected.ruleId !== entry.matrixOwnerAssignmentRuleId || expected.ownerTaskId !== entry.expectedMatrixOwnerTaskId) {
      ownerAssignmentMismatches.push({
        originalPath: entry.originalPath,
        expected,
        actualRuleId: entry.matrixOwnerAssignmentRuleId,
        actualOwnerTaskId: entry.expectedMatrixOwnerTaskId,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(OWNER_EXPECTED_COUNTS, entry.matrixOwnerTaskId)) {
      unexpectedOwnerAssignment.push(entry.originalPath);
    }
    if (entry.matrixOwnerTaskId !== entry.expectedMatrixOwnerTaskId) {
      ownerAssignmentMismatches.push({
        originalPath: entry.originalPath,
        expectedOwnerTaskId: entry.expectedMatrixOwnerTaskId,
        actualOwnerTaskId: entry.matrixOwnerTaskId,
      });
    }
    const packageImplementationProblems = packageImplementationSetProblems(entry);
    if (!Array.isArray(entry.packageImplementationSet) || entry.packageImplementationSet.length === 0) {
      missingPackageImplementationSet.push(entry.originalPath);
    }
    for (const problem of packageImplementationProblems) {
      if (problem.reason !== 'missing_or_empty_packageImplementationSet') {
        invalidPackageImplementationPaths.push({
          originalPath: entry.originalPath,
          ...problem,
        });
      }
    }
    const sourceAuthorityProblems = sourceAuthorityPathProblems(entry);
    if (sourceAuthorityProblems.length > 0) {
      sourceAuthorityPathGaps.push({ originalPath: entry.originalPath, problems: sourceAuthorityProblems });
    }
    const runtimeReplayProblems = runtimeReplayPathProblems(entry);
    if (runtimeReplayProblems.length > 0) {
      runtimeReplayPathGaps.push({ originalPath: entry.originalPath, problems: runtimeReplayProblems });
    }
    const distOutputProblems = distOutputPathProblems(entry);
    if (distOutputProblems.length > 0) {
      distOutputPathGaps.push({ originalPath: entry.originalPath, problems: distOutputProblems });
    }
    const aggregatePackageInfo =
      packageImplementationProblems.length === 0 &&
      sourceAuthorityProblems.length === 0 &&
      runtimeReplayProblems.length === 0 &&
      distOutputProblems.length === 0
        ? aggregatePackageImplementationInfo(entry)
        : null;
    const sourceKindProblems = aggregatePackageInfo ? sourceKindParityProblems(entry, aggregatePackageInfo) : [];
    if (sourceKindProblems.length > 0) {
      sourceKindParityViolations.push({ originalPath: entry.originalPath, problems: sourceKindProblems });
    }
    const sizeProofProblems = sizeDeltaProofProblems(entry, aggregatePackageInfo, sourceKindProblems);
    if (sizeProofProblems.length > 0) {
      sizeDeltaProofGaps.push({ originalPath: entry.originalPath, problems: sizeProofProblems });
    }
    if (
      aggregatePackageInfo &&
      (entry.packageBytes !== aggregatePackageInfo.bytes || entry.packageLoc !== aggregatePackageInfo.lines)
    ) {
      sizeDeltaComputationMismatches.push(entry.originalPath);
    }
    if (
      aggregatePackageInfo &&
      (entry.semanticPackageBytes !== aggregatePackageInfo.bytes ||
        entry.semanticPackageLoc !== aggregatePackageInfo.lines)
    ) {
      semanticSizeComputationMismatches.push(entry.originalPath);
    }
    if (!Array.isArray(entry.behaviorEquivalenceMatrix) || entry.behaviorEquivalenceMatrix.length === 0) {
      missingBehaviorEquivalenceMatrix.push(entry.originalPath);
    } else {
      for (const [scenarioIndex, scenario] of entry.behaviorEquivalenceMatrix.entries()) {
        const scenarioProblems = behaviorScenarioProblems(entry, scenario);
        if (scenarioProblems.length > 0) {
          behaviorEquivalenceMatrixScenarioFieldGaps.push({
            originalPath: entry.originalPath,
            scenarioIndex,
            scenarioId: scenario && scenario.scenarioId ? scenario.scenarioId : null,
            problems: scenarioProblems,
            missingFields: scenarioProblems
              .filter((problem) => problem.startsWith('missing_'))
              .map((problem) => problem.replace(/^missing_/u, '')),
          });
        }
        if (
          !scenario ||
          !scenario.scenarioCoverageProof ||
          scenario.scenarioCoverageProof.coverageDecision !== 'passed_full_original_behavior_coverage'
        ) {
          behaviorEquivalenceMatrixScenarioCoverageGaps.push({
            originalPath: entry.originalPath,
            scenarioIndex,
            scenarioId: scenario && scenario.scenarioId ? scenario.scenarioId : null,
          });
        }
        if (
          scenario &&
          scenario.expectedOutputProvenance &&
          scenario.expectedOutputProvenance.expectedSource === 'package_observed'
        ) {
          packageObservedExpectedOutputRows.push(entry.originalPath);
        }
      }
    }
    const replayProofProblems = behaviorReplayProofProblems(entry);
    if (replayProofProblems.length > 0) {
      missingBehaviorEquivalenceReplayProof.push({ originalPath: entry.originalPath, problems: replayProofProblems });
    }
    const rowCoverageProblems = rowScenarioCoverageProofProblems(entry);
    if (rowCoverageProblems.length > 0) {
      scenarioCoverageGaps.push({ originalPath: entry.originalPath, problems: rowCoverageProblems });
    }
    const rowExpectedOutputProblems = rowExpectedOutputProvenanceProblems(entry);
    if (rowExpectedOutputProblems.length > 0) {
      expectedOutputProvenanceGaps.push({ originalPath: entry.originalPath, problems: rowExpectedOutputProblems });
    }
    if (entry.expectedOutputProvenance && entry.expectedOutputProvenance.expectedSource === 'package_observed') {
      packageObservedExpectedOutputRows.push(entry.originalPath);
    }
    const firstGenerationProblems = matrixFirstGenerationProofProblems(entry);
    if (firstGenerationProblems.length > 0) {
      firstGenerationProofGaps.push({ originalPath: entry.originalPath, problems: firstGenerationProblems });
    }
    if (
      !entry.behaviorEquivalenceMatrixOwnerTaskCompletedAt ||
      !entry.behaviorEquivalenceMatrixFirstGeneratedAt ||
      new Date(entry.behaviorEquivalenceMatrixFirstGeneratedAt).getTime() >
        new Date(entry.behaviorEquivalenceMatrixOwnerTaskCompletedAt).getTime()
    ) {
      matrixOwnerCompletionTimingGaps.push(entry.originalPath);
    }
    const semanticProofProblems = semanticSizeProofProblems(entry);
    if (semanticProofProblems.length > 0) {
      semanticSizePaddingViolations.push({ originalPath: entry.originalPath, problems: semanticProofProblems });
    }
    const g009AggregationProblems = g009AggregationProvenanceProblems(entry);
    if (g009AggregationProblems.gaps.length > 0) {
      g009AggregationProofGaps.push({ originalPath: entry.originalPath, problems: g009AggregationProblems.gaps });
    }
    if (g009AggregationProblems.hashMismatches.length > 0) {
      g009AggregationHashMismatches.push({
        originalPath: entry.originalPath,
        problems: g009AggregationProblems.hashMismatches,
      });
    }
    if (entry.semanticPackageBytes <= 0 || entry.semanticPackageLoc <= 0) {
      semanticZeroSizeMetrics.push(entry.originalPath);
    }
    if (
      typeof entry.semanticPackageByteRatio !== 'number' ||
      typeof entry.semanticPackageLocRatio !== 'number' ||
      entry.semanticPackageByteRatio < STRICT_SIZE_RATIO_MIN ||
      entry.semanticPackageByteRatio > STRICT_SIZE_RATIO_MAX ||
      entry.semanticPackageLocRatio < STRICT_SIZE_RATIO_MIN ||
      entry.semanticPackageLocRatio > STRICT_SIZE_RATIO_MAX
    ) {
      semanticSizeDeltaViolations.push(entry.originalPath);
    }
    if (
      entry.originalBytes > 0 &&
      entry.originalLoc > 0 &&
      entry.semanticPackageBytes > 0 &&
      entry.semanticPackageLoc > 0 &&
      (entry.semanticPackageByteRatio !== round4(entry.semanticPackageBytes / entry.originalBytes) ||
        entry.semanticPackageLocRatio !== round4(entry.semanticPackageLoc / entry.originalLoc))
    ) {
      semanticSizeComputationMismatches.push(entry.originalPath);
    }
    if (entry.originalBytes <= 0 || entry.originalLoc <= 0 || entry.packageBytes <= 0 || entry.packageLoc <= 0) {
      zeroSizeMetrics.push(entry.originalPath);
    }
    if (
      typeof entry.packageByteRatio !== 'number' ||
      typeof entry.packageLocRatio !== 'number' ||
      entry.packageByteRatio < STRICT_SIZE_RATIO_MIN ||
      entry.packageByteRatio > STRICT_SIZE_RATIO_MAX ||
      entry.packageLocRatio < STRICT_SIZE_RATIO_MIN ||
      entry.packageLocRatio > STRICT_SIZE_RATIO_MAX
    ) {
      sizeDeltaViolations.push(entry.originalPath);
    }
    if (
      entry.originalBytes > 0 &&
      entry.originalLoc > 0 &&
      entry.packageBytes > 0 &&
      entry.packageLoc > 0 &&
      (entry.packageByteRatio !== round4(entry.packageBytes / entry.originalBytes) ||
        entry.packageLocRatio !== round4(entry.packageLoc / entry.originalLoc))
    ) {
      sizeDeltaComputationMismatches.push(entry.originalPath);
    }
    if (
      !entry.sizeDeltaThreshold ||
      REQUIRED_SIZE_DELTA_THRESHOLD_FIELDS.some((field) => typeof entry.sizeDeltaThreshold[field] !== 'number') ||
      entry.sizeDeltaThreshold.byteRatioMin !== STRICT_SIZE_RATIO_MIN ||
      entry.sizeDeltaThreshold.byteRatioMax !== STRICT_SIZE_RATIO_MAX ||
      entry.sizeDeltaThreshold.locRatioMin !== STRICT_SIZE_RATIO_MIN ||
      entry.sizeDeltaThreshold.locRatioMax !== STRICT_SIZE_RATIO_MAX
    ) {
      sizeDeltaThresholdShapeGaps.push(entry.originalPath);
    }
    if (
      entry.scopeClass === 'settled_revalidation' &&
      (!entry.settledEquivalenceProof || entry.settledEquivalenceProof.status !== 'passed')
    ) {
      settledEquivalenceBypasses.push(entry.originalPath);
    }
  }

  const ownerAssignmentMismatchCount = ownerAssignmentMismatches.length;
  const missingOwnerAssignmentRuleCount = missingOwnerAssignmentRule.length;
  const unexpectedOwnerAssignmentCount = unexpectedOwnerAssignment.length;
  const ownerAssignmentRowCount = entries.length;
  const ownerCountsMatch = Object.entries(OWNER_EXPECTED_COUNTS).every(([owner, count]) => ownerCounts[owner] === count);
  return {
    ledgerRowCount: entries.length,
    backlog_migration: entries.filter((entry) => entry.scopeClass === 'backlog_migration').length,
    settled_revalidation: entries.filter((entry) => entry.scopeClass === 'settled_revalidation').length,
    noUnmappedInventoryRows: entries.length === 240,
    requiredLedgerFieldsPresent: missingRequiredFields.length === 0,
    missingRequiredFieldCount: missingRequiredFields.length,
    missingRequiredFields: missingRequiredFields.slice(0, 20),
    ownerCounts,
    ownerCountsMatch,
    ownerAssignmentMismatchCount,
    missingOwnerAssignmentRuleCount,
    unexpectedOwnerAssignmentCount,
    ownerAssignmentRowCount,
    all240RowsHavePackageImplementationSet: missingPackageImplementationSet.length === 0,
    missingPackageImplementationSetCount: missingPackageImplementationSet.length,
    all240RowsHaveValidPackageImplementationSet:
      missingPackageImplementationSet.length === 0 &&
      invalidPackageImplementationPaths.length === 0 &&
      sourceAuthorityPathGaps.length === 0 &&
      runtimeReplayPathGaps.length === 0 &&
      distOutputPathGaps.length === 0,
    invalidPackageImplementationPathCount: invalidPackageImplementationPaths.length,
    sourceAuthorityPathGapCount: sourceAuthorityPathGaps.length,
    runtimeReplayPathGapCount: runtimeReplayPathGaps.length,
    distOutputPathGapCount: distOutputPathGaps.length,
    all240RowsHaveBehaviorEquivalenceMatrix: missingBehaviorEquivalenceMatrix.length === 0,
    missingBehaviorEquivalenceMatrixCount: missingBehaviorEquivalenceMatrix.length,
    allBehaviorEquivalenceMatrixScenariosHaveRequiredFields:
      missingBehaviorEquivalenceMatrix.length === 0 && behaviorEquivalenceMatrixScenarioFieldGaps.length === 0,
    behaviorEquivalenceMatrixScenarioFieldGapCount: behaviorEquivalenceMatrixScenarioFieldGaps.length,
    behaviorEquivalenceMatrixScenarioCoverageGapCount: behaviorEquivalenceMatrixScenarioCoverageGaps.length,
    all240RowsHaveBehaviorEquivalenceReplayProof: missingBehaviorEquivalenceReplayProof.length === 0,
    missingBehaviorEquivalenceReplayProofCount: missingBehaviorEquivalenceReplayProof.length,
    behaviorEquivalenceReplayFailureCount: missingBehaviorEquivalenceReplayProof.length,
    all240RowsMatrixGeneratedByOwnerTask: firstGenerationProofGaps.length === 0,
    all240RowsMatchDeterministicOwnerAssignment:
      ownerAssignmentMismatchCount === 0 &&
      missingOwnerAssignmentRuleCount === 0 &&
      unexpectedOwnerAssignmentCount === 0 &&
      ownerCountsMatch,
    matrixFirstGeneratedByG009Count: entries.filter(
      (entry) => entry.behaviorEquivalenceMatrixFirstGeneratedByTaskId === 'G009'
    ).length,
    firstGenerationProofGapCount: firstGenerationProofGaps.length,
    matrixOwnerCompletionTimingGapCount: matrixOwnerCompletionTimingGaps.length,
    all240RowsHaveFullScenarioCoverage: scenarioCoverageGaps.length === 0,
    scenarioCoverageGapCount: scenarioCoverageGaps.length,
    expectedOutputProvenanceGapCount: expectedOutputProvenanceGaps.length,
    packageObservedExpectedOutputCount: packageObservedExpectedOutputRows.length,
    semanticSizePaddingViolationCount: semanticSizePaddingViolations.length,
    sizeDeltaProofGapCount: sizeDeltaProofGaps.length,
    sourceKindParityViolationCount: sourceKindParityViolations.length,
    g009AggregationProofGapCount: g009AggregationProofGaps.length,
    g009AggregationHashMismatchCount: g009AggregationHashMismatches.length,
    semanticZeroSizeMetricCount: semanticZeroSizeMetrics.length,
    semanticSizeDeltaViolationCount: semanticSizeDeltaViolations.length,
    semanticSizeComputationMismatchCount: semanticSizeComputationMismatches.length,
    settledEquivalenceBypassCount: settledEquivalenceBypasses.length,
    all240RowsHaveSizeDeltaDecision: entries.every(
      (entry) => entry.sizeDeltaDecision === 'passed_within_strict_threshold'
    ),
    sizeDeltaThresholdShapeGapCount: sizeDeltaThresholdShapeGaps.length,
    zeroSizeMetricCount: zeroSizeMetrics.length,
    sizeDeltaViolationCount: sizeDeltaViolations.length,
    sizeDeltaComputationMismatchCount: sizeDeltaComputationMismatches.length,
    sampleFailures: {
      missingPackageImplementationSet: missingPackageImplementationSet.slice(0, 10),
      invalidPackageImplementationPaths: invalidPackageImplementationPaths.slice(0, 10),
      sourceAuthorityPathGaps: sourceAuthorityPathGaps.slice(0, 10),
      runtimeReplayPathGaps: runtimeReplayPathGaps.slice(0, 10),
      distOutputPathGaps: distOutputPathGaps.slice(0, 10),
      missingBehaviorEquivalenceMatrix: missingBehaviorEquivalenceMatrix.slice(0, 10),
      behaviorEquivalenceMatrixScenarioFieldGaps: behaviorEquivalenceMatrixScenarioFieldGaps.slice(0, 10),
      behaviorEquivalenceMatrixScenarioCoverageGaps: behaviorEquivalenceMatrixScenarioCoverageGaps.slice(0, 10),
      scenarioCoverageGaps: scenarioCoverageGaps.slice(0, 10),
      expectedOutputProvenanceGaps: expectedOutputProvenanceGaps.slice(0, 10),
      firstGenerationProofGaps: firstGenerationProofGaps.slice(0, 10),
      g009AggregationProofGaps: g009AggregationProofGaps.slice(0, 10),
      g009AggregationHashMismatches: g009AggregationHashMismatches.slice(0, 10),
      matrixOwnerCompletionTimingGaps: matrixOwnerCompletionTimingGaps.slice(0, 10),
      semanticSizePaddingViolations: semanticSizePaddingViolations.slice(0, 10),
      sizeDeltaProofGaps: sizeDeltaProofGaps.slice(0, 10),
      sourceKindParityViolations: sourceKindParityViolations.slice(0, 10),
      semanticSizeComputationMismatches: semanticSizeComputationMismatches.slice(0, 10),
      sizeDeltaThresholdShapeGaps: sizeDeltaThresholdShapeGaps.slice(0, 10),
      sizeDeltaComputationMismatches: sizeDeltaComputationMismatches.slice(0, 10),
    },
  };
}

function loadLedger() {
  return readJson(LEDGER_PATH);
}

module.exports = {
  CONTRACT_PATH,
  EVIDENCE_PATH,
  EXPECTED_HASHES,
  INSTALL_MATRIX_DIR,
  INVENTORY_PATH,
  LEDGER_PATH,
  OWNER_EXPECTED_COUNTS,
  FINAL_EVIDENCE_PACKET_PATH,
  PACKAGE_SOURCE_PARITY_EVIDENCE_PATH,
  PARITY_PATH,
  PACKAGE_DIST_PREFIX,
  PACKAGE_IMPLEMENTATION_PREFIXES,
  PACKAGE_SOURCE_PREFIX,
  QUEUE_PATH,
  REGISTRY_PATH,
  REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS,
  REQUIRED_LEDGER_FIELDS,
  REQUIRED_SIZE_DELTA_THRESHOLD_FIELDS,
  REWORK_PATH,
  ROOT,
  SCOPE_BASELINE_PATH,
  SUMMARY_PATH,
  WAVE_DIR,
  WAVE_ID,
  buildLedger,
  captureScopeBaseline,
  deriveOwner,
  ensureDir,
  fileInfo,
  formatJson,
  isJavaScriptRuntimeOutputPath,
  isTypeScriptDeclarationPath,
  isTypeScriptFamilyPath,
  isTypeScriptRuntimePath,
  loadLedger,
  loadSources,
  normalizePath,
  nowIso,
  readJson,
  repoPath,
  sha256File,
  sourceHashReport,
  sourceAuthorityPathToDistRuntimePath,
  summarizeLedger,
  writeJson,
};
