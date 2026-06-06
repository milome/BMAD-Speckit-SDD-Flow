#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.11';
const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.10';
const CONTRACT_PATH = 'docs/plans/2026-06-05-main-agent-runtime-migration-wave-3-11-goal-execution-plan.md';
const WAVE_TITLE = 'Main Agent runtime migration wave 3.11 consumer reachable closure migration';
const WAVE_DIR = `repo-governance/script-migrations/${WAVE_ID}`;
const REGISTRY_PATH = 'repo-governance/script-migration-registry.yaml';
const CLOSURE_AUDIT_PATH = 'repo-governance/script-migrations/consumer-reachable-closure-audit/audit-report.json';
const SAFE_WRITE_PATH = `${WAVE_DIR}/safe-write-receipts.json`;
const INSTALL_MATRIX_DIR = `${WAVE_DIR}/install-matrix`;

const HASH_RE = /^sha256:[0-9a-f]{64}$/u;
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;
const COMMAND_STATUS = new Set(['passed', 'failed', 'blocked']);
const ARTIFACT_STATUS = new Set([
  'running',
  'awaiting_final_validator_self_receipt',
  'sealed_snapshot',
  'passed',
  'failed',
  'blocked',
]);
const ACCEPTANCE_IDS = Array.from({ length: 14 }, (_, index) => `ACC${String(index + 1).padStart(3, '0')}`);
const MANUAL_IDS = ['MAN001', 'MAN002', 'MAN003', 'MAN004'];

const EXPECTED_ENTRIES = [
  {
    entryId: 'host-runtime-mode',
    originalPath: 'scripts/host-runtime-mode.ts',
    semantic: 'package_runtime_module',
    strategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/runtime/host-runtime-mode.js',
      'packages/bmad-speckit/dist/main-agent/runtime/host-runtime-mode.js',
    ],
    exports: [
      'normalizeRuntimeHost',
      'selectExecutionRuntimeMode',
      'runtimeModeDir',
      'writeExecutionRuntimeModeSelection',
      'validateNativeGoalReadiness',
      'writeRuntimeBlocker',
      'writeNativeGoalInvocationReceipt',
      'validateNativeGoalInvocationReceipt',
    ],
  },
  {
    entryId: 'supervised-worker-runtime',
    originalPath: 'scripts/supervised-worker-runtime.ts',
    semantic: 'package_runtime_module',
    strategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/runtime/supervised-worker-runtime.js',
      'packages/bmad-speckit/dist/main-agent/runtime/supervised-worker-runtime.js',
    ],
    exports: ['appendTaskProgress', 'readTaskProgress', 'evaluateSupervisedWorker'],
  },
  {
    entryId: 'diagnose-bmad-state',
    originalPath: 'scripts/diagnose-bmad-state.ts',
    semantic: 'package_runtime_module',
    strategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/runtime/diagnose-bmad-state.js',
      'packages/bmad-speckit/dist/main-agent/runtime/diagnose-bmad-state.js',
    ],
    exports: ['collectReviewerProjectionDiagnosis', 'collectReadinessProjectionDiagnosis', 'diagnoseBmadState'],
  },
  {
    entryId: 'parallel-mission-control',
    originalPath: 'scripts/parallel-mission-control.ts',
    semantic: 'package_runtime_module',
    strategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/runtime/parallel-mission-control.js',
      'packages/bmad-speckit/dist/main-agent/runtime/parallel-mission-control.js',
    ],
    exports: [
      'DEFAULT_PROTECTED_WRITE_PATHS',
      'evaluateParallelMissionEvidenceIntegration',
      'buildParallelMissionPlan',
      'buildPrTopology',
      'validatePrTopologyForReleaseGate',
    ],
  },
  {
    entryId: 'bmad-state-reader',
    originalPath: 'scripts/bmad-state-reader.ts',
    semantic: 'package_local_helper',
    strategy: 'durable_helper_copy',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/helpers/bmad-state-reader.js',
      'packages/bmad-speckit/dist/main-agent/helpers/bmad-state-reader.js',
    ],
    exports: ['readBmadProgress', 'readStoryState', 'getCurrentStoryState', 'buildPaths'],
  },
  {
    entryId: 'e2e-verify-paths',
    originalPath: 'scripts/e2e-verify-paths.ts',
    semantic: 'package_local_helper',
    strategy: 'durable_helper_copy',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/helpers/e2e-verify-paths.js',
      'packages/bmad-speckit/dist/main-agent/helpers/e2e-verify-paths.js',
    ],
    exports: ['runE2eVerifyPaths', 'main'],
  },
  {
    entryId: 'query-validate',
    originalPath: 'scripts/query-validate.ts',
    semantic: 'package_local_helper',
    strategy: 'durable_helper_copy',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/helpers/query-validate.js',
      'packages/bmad-speckit/dist/main-agent/helpers/query-validate.js',
    ],
    exports: ['runQueryValidation', 'main'],
  },
  {
    entryId: 'runtime-step-state',
    originalPath: 'scripts/runtime-step-state.ts',
    semantic: 'package_local_helper',
    strategy: 'durable_helper_copy',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/helpers/runtime-step-state.js',
      'packages/bmad-speckit/dist/main-agent/helpers/runtime-step-state.js',
    ],
    exports: ['resolveRuntimeStepState', 'persistRuntimeStepState'],
  },
  {
    entryId: 'verify-agent-files',
    originalPath: 'scripts/verify-agent-files.ts',
    semantic: 'package_local_helper',
    strategy: 'durable_helper_copy',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/helpers/verify-agent-files.js',
      'packages/bmad-speckit/dist/main-agent/helpers/verify-agent-files.js',
    ],
    exports: ['verifyAgentFiles', 'REQUIRED_AGENTS', 'REQUIRED_SPECKIT_ALIASES', 'REQUIRED_AUDITORS', 'main'],
  },
  {
    entryId: 'eval-question-generate',
    originalPath: 'scripts/eval-question-generate.ts',
    semantic: 'public_cli_package_action',
    strategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js', 'packages/bmad-speckit/src/commands/eval-question-generate.js'],
    exportTargetPaths: ['packages/bmad-speckit/src/commands/eval-question-generate.js'],
    exports: ['evalQuestionGenerateCommand', 'evalQuestionGenerateCli', 'main', 'RUN_ID_UNRESOLVED'],
  },
  {
    entryId: 'check-story-score-written',
    originalPath: 'scripts/check-story-score-written.ts',
    semantic: 'public_cli_package_action_existing_root_legacy',
    strategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js', 'packages/bmad-speckit/src/commands/check-score.js'],
    exportTargetPaths: ['packages/bmad-speckit/src/commands/check-score.js'],
    exports: ['checkScoreCommand'],
  },
  {
    entryId: 'create-second-story',
    originalPath: 'scripts/create-second-story.ts',
    semantic: 'repo_internal_test_seed_only',
    strategy: 'repo_internal_reclassify',
    targetPaths: ['scripts/create-second-story.ts'],
    exportTargetPaths: [],
    exports: [],
  },
  {
    entryId: 'verify-score-auto-scoped-bundle',
    originalPath: 'scripts/verify-score-auto-scoped-bundle.cjs',
    semantic: 'repo_internal_verification_harness',
    strategy: 'repo_internal_reclassify',
    targetPaths: ['scripts/verify-score-auto-scoped-bundle.cjs'],
    exportTargetPaths: [],
    exports: [],
  },
];

const REQUIRED_COMMAND_IDS = [
  'cmd-git-status-baseline',
  'cmd-encoding-pre-implementation',
  'cmd-build-scoring',
  'cmd-test-scoring-eval-questions',
  'cmd-build-main-agent-dist',
  'cmd-test-package-build-dispatch-regressions',
  'cmd-test-runtime-modules',
  'cmd-test-helpers',
  'cmd-test-eval-question-generate',
  'cmd-test-check-score',
  'cmd-smoke-eval-question-generate-source-tree',
  'cmd-test-runtime-acceptance-import-switches',
  'cmd-closure-audit-write',
  'cmd-validate-registry',
  'cmd-assert-no-migration-internal-exact',
  'cmd-assert-root-scripts-not-deleted',
  'cmd-assert-public-cli-dispatch',
  'cmd-assert-closure-audit-exact-wave-3-11',
  'cmd-validate-wave-3-11-pre-evidence',
  'cmd-test-wave-3-11-contract-pre-evidence',
  'cmd-test-install-surface-regressions',
  'cmd-run-install-matrix',
  'cmd-validate-wave-3-11-evidence-running',
  'cmd-assert-final-closeout-language',
  'cmd-encoding-final',
  'cmd-test-wave-3-11-contract-final',
  'cmd-validate-wave-3-11-final',
];
const MAX_REQUIRED_COMMAND_ATTEMPTS = 2;

const REQUIRED_COMMAND_FRAGMENTS = {
  'cmd-git-status-baseline': ['git status --short --branch'],
  'cmd-encoding-pre-implementation': ['check-encoding-integrity.js'],
  'cmd-build-scoring': ['npm run build:scoring'],
  'cmd-test-scoring-eval-questions': [
    'npx vitest run',
    'template-generator.test.ts',
    'manifest-loader.test.ts',
    'run-core.test.ts',
    'cli-integration.test.ts',
    'eval-question-flow.test.ts',
  ],
  'cmd-build-main-agent-dist': ['npm run build:main-agent-dist'],
  'cmd-test-package-build-dispatch-regressions': [
    'npm run test --prefix packages/bmad-speckit',
    'main-agent-build-dist.test.js',
    'main-agent-no-root-ts-dispatch.test.js',
    'main-agent-dist-no-root-ts-dispatch.test.js',
  ],
  'cmd-test-runtime-modules': ['npm run test --prefix packages/bmad-speckit', 'main-agent-wave-3-11-runtime-modules.test.js'],
  'cmd-test-helpers': ['npm run test --prefix packages/bmad-speckit', 'main-agent-wave-3-11-helpers.test.js'],
  'cmd-test-eval-question-generate': ['npm run test --prefix packages/bmad-speckit', 'eval-question-generate-command.test.js'],
  'cmd-test-check-score': ['npm run test --prefix packages/bmad-speckit', 'check-score-command.test.js'],
  'cmd-smoke-eval-question-generate-source-tree': [
    'validate-main-agent-runtime-migration-wave-3-11.cjs',
    '--assert eval-question-source-smoke',
  ],
  'cmd-test-runtime-acceptance-import-switches': [
    'npx vitest run',
    'main-agent-host-runtime-mode.test.ts',
    'main-agent-supervised-worker-timeout.test.ts',
    'diagnose-bmad-state-reviewer-projection.test.ts',
    'parallel-mission-evidence-integration.test.ts',
  ],
  'cmd-closure-audit-write': ['audit-consumer-reachable-closure.cjs', '--write', '--pretty', '--quiet'],
  'cmd-validate-registry': ['validate-registry.cjs'],
  'cmd-assert-no-migration-internal-exact': [
    'validate-main-agent-runtime-migration-wave-3-11.cjs',
    '--assert no-migration-internal-exact',
  ],
  'cmd-assert-root-scripts-not-deleted': [
    'validate-main-agent-runtime-migration-wave-3-11.cjs',
    '--assert root-scripts-not-deleted',
  ],
  'cmd-assert-public-cli-dispatch': ['validate-main-agent-runtime-migration-wave-3-11.cjs', '--assert public-cli-dispatch'],
  'cmd-assert-closure-audit-exact-wave-3-11': [
    'validate-main-agent-runtime-migration-wave-3-11.cjs',
    '--assert closure-audit-exact-wave-3-11',
  ],
  'cmd-validate-wave-3-11-pre-evidence': ['validate-main-agent-runtime-migration-wave-3-11.cjs', '--pre-evidence'],
  'cmd-test-wave-3-11-contract-pre-evidence': [
    'MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE',
    'pre-evidence',
    'main-agent-runtime-migration-wave-3-11-contract.test.ts',
  ],
  'cmd-test-install-surface-regressions': ['npm run test --prefix packages/bmad-speckit', 'sync-service.test.js'],
  'cmd-run-install-matrix': ['run-main-agent-wave-3-11-install-matrix.cjs'],
  'cmd-validate-wave-3-11-evidence-running': ['validate-main-agent-runtime-migration-wave-3-11.cjs', '--evidence-running'],
  'cmd-assert-final-closeout-language': [
    'validate-main-agent-runtime-migration-wave-3-11.cjs',
    '--assert final-closeout-language',
  ],
  'cmd-encoding-final': ['check-encoding-integrity.js'],
  'cmd-test-wave-3-11-contract-final': [
    'MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE',
    'final-closeout',
    'main-agent-runtime-migration-wave-3-11-contract.test.ts',
  ],
  'cmd-validate-wave-3-11-final': ['node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs'],
};

const EVIDENCE_RUNNING_SELF_COMMAND_ID = 'cmd-validate-wave-3-11-evidence-running';
const FINAL_ACCEPTANCE_COMMAND_ID = 'cmd-test-wave-3-11-contract-final';
const FINAL_VALIDATOR_COMMAND_ID = 'cmd-validate-wave-3-11-final';
const FINAL_ACCEPTANCE_PREREQ_COMMAND_IDS = REQUIRED_COMMAND_IDS.slice(
  0,
  REQUIRED_COMMAND_IDS.indexOf(FINAL_ACCEPTANCE_COMMAND_ID)
);
const FINAL_VALIDATOR_PREREQ_COMMAND_IDS = REQUIRED_COMMAND_IDS.slice(
  0,
  REQUIRED_COMMAND_IDS.indexOf(FINAL_VALIDATOR_COMMAND_ID)
);
const EVIDENCE_RUNNING_PREREQ_COMMAND_IDS = REQUIRED_COMMAND_IDS.slice(
  0,
  REQUIRED_COMMAND_IDS.indexOf(EVIDENCE_RUNNING_SELF_COMMAND_ID)
);

const ACC_COMMAND_REQUIREMENTS = {
  ACC001: ['cmd-git-status-baseline', 'cmd-encoding-pre-implementation'],
  ACC002: ['cmd-build-main-agent-dist'],
  ACC003: ['cmd-test-runtime-modules'],
  ACC004: ['cmd-test-runtime-acceptance-import-switches'],
  ACC005: ['cmd-build-main-agent-dist', 'cmd-test-helpers'],
  ACC006: [
    'cmd-build-scoring',
    'cmd-test-scoring-eval-questions',
    'cmd-test-eval-question-generate',
    'cmd-smoke-eval-question-generate-source-tree',
    'cmd-run-install-matrix',
  ],
  ACC007: ['cmd-test-check-score', 'cmd-assert-public-cli-dispatch', 'cmd-validate-registry'],
  ACC008: ['cmd-assert-no-migration-internal-exact'],
  ACC009: ['cmd-validate-registry'],
  ACC010: ['cmd-closure-audit-write', 'cmd-assert-closure-audit-exact-wave-3-11'],
  ACC011: [
    'cmd-build-scoring',
    'cmd-test-scoring-eval-questions',
    'cmd-build-main-agent-dist',
    'cmd-test-package-build-dispatch-regressions',
    'cmd-test-runtime-modules',
    'cmd-test-helpers',
    'cmd-test-eval-question-generate',
    'cmd-test-check-score',
  ],
  ACC012: ['cmd-test-install-surface-regressions', 'cmd-run-install-matrix', EVIDENCE_RUNNING_SELF_COMMAND_ID],
};

const MANUAL_COMMAND_REQUIREMENTS = {
  MAN001: ['cmd-assert-root-scripts-not-deleted'],
  MAN002: ['cmd-assert-public-cli-dispatch'],
  MAN003: ['cmd-assert-closure-audit-exact-wave-3-11'],
  MAN004: ['cmd-assert-final-closeout-language'],
};

const PRE_EVIDENCE_SAFE_WRITE_TARGETS = [
  REGISTRY_PATH,
  CLOSURE_AUDIT_PATH,
  `${WAVE_DIR}/preflight.json`,
  `${WAVE_DIR}/source-inventory.json`,
  `${WAVE_DIR}/no-migration-internal.json`,
  `${WAVE_DIR}/classification-evidence.json`,
  `${WAVE_DIR}/registry-evidence.json`,
  SAFE_WRITE_PATH,
];

const EVIDENCE_RUNNING_SAFE_WRITE_TARGETS = [
  ...PRE_EVIDENCE_SAFE_WRITE_TARGETS,
  `${WAVE_DIR}/evidence.json`,
  `${WAVE_DIR}/root-script-regression-proof.json`,
  `${WAVE_DIR}/install-matrix.json`,
];

const FINAL_SAFE_WRITE_TARGETS = [
  ...EVIDENCE_RUNNING_SAFE_WRITE_TARGETS,
  `${WAVE_DIR}/summary.md`,
  `${WAVE_DIR}/final-evidence-packet.json`,
];

const REQUIRED_INSTALL_MODES = ['save-dev', 'no-save', 'npx-package', 'init-sync-consumer'];
const REQUIRED_INSTALL_ROW_IDS = ['IM001', 'IM002', 'IM003', 'IM004'];
const INSTALL_MATRIX_CLEANUP_SURFACES = [
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
const SAFE_WRITE_DETAIL_FIELDS = [
  'artifactPath',
  'operation',
  'hashKind',
  'draftPath',
  'backupPath',
  'requiredChecks',
  'draftSha256',
  'promotedSha256',
  'postWriteSha256',
  'byteLength',
  'startedAt',
  'completedAt',
];

function repoPath(relativePath) {
  return path.join(ROOT, relativePath);
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function exists(relativePath) {
  return fs.existsSync(repoPath(relativePath));
}

function readText(relativePath, errors) {
  if (!exists(relativePath)) {
    errors.push(`missing file: ${relativePath}`);
    return '';
  }
  return fs.readFileSync(repoPath(relativePath), 'utf8');
}

function readJson(relativePath, errors, { required = true } = {}) {
  if (!exists(relativePath)) {
    if (required) errors.push(`missing file: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(repoPath(relativePath), 'utf8'));
  } catch (error) {
    errors.push(`invalid JSON: ${relativePath}: ${error.message}`);
    return null;
  }
}

function readYaml(relativePath, errors) {
  const text = readText(relativePath, errors);
  if (!text) return null;
  try {
    return yaml.load(text);
  } catch (error) {
    errors.push(`invalid YAML: ${relativePath}: ${error.message}`);
    return null;
  }
}

function sha256Buffer(buffer) {
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}

function sha256Text(text) {
  return `sha256:${crypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
}

function sha256File(relativePath) {
  return sha256Buffer(fs.readFileSync(repoPath(relativePath)));
}

function canonicalize(value, omitTopLevelSealHash = false, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => canonicalize(item, false, depth + 1));
  const result = {};
  for (const key of Object.keys(value).sort()) {
    if (depth === 0 && omitTopLevelSealHash && key === 'sealHash') continue;
    result[key] = canonicalize(value[key], false, depth + 1);
  }
  return result;
}

function hashCanonical(value, omitTopLevelSealHash = false) {
  return sha256Text(JSON.stringify(canonicalize(value, omitTopLevelSealHash)));
}

function expectEqual(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label} expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

function expectArray(errors, label, value) {
  if (!Array.isArray(value)) errors.push(`${label} must be an array`);
}

function expectIncludes(errors, label, values, expected) {
  if (!Array.isArray(values) || !values.includes(expected)) {
    errors.push(`${label} missing ${expected}`);
  }
}

function expectArrayEqual(errors, label, actual, expected) {
  if (!Array.isArray(actual)) {
    errors.push(`${label} must be an array`);
    return;
  }
  expectEqual(errors, label, JSON.stringify(actual), JSON.stringify(expected));
}

function expectHash(errors, label, value) {
  if (!HASH_RE.test(String(value || ''))) errors.push(`${label} must be sha256:<64-hex>`);
}

function expectIsoTimestamp(errors, label, value) {
  if (!ISO_8601_RE.test(String(value || ''))) errors.push(`${label} must be an ISO 8601 UTC timestamp`);
}

function expectObject(errors, label, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) errors.push(`${label} must be an object`);
}

function expectField(errors, label, object, field) {
  if (!object || !Object.prototype.hasOwnProperty.call(object, field)) errors.push(`${label} missing ${field}`);
}

function normalizeEvidencePath(value) {
  return String(value || '').replace(/\\/g, '/');
}

function shouldVerifyCurrentSafeWriteHash(targetPath) {
  const normalized = normalizeEvidencePath(targetPath);
  return ![REGISTRY_PATH, CLOSURE_AUDIT_PATH, `${WAVE_DIR}/evidence.json`].includes(normalized);
}

function expectPathEndsWith(errors, label, value, suffix) {
  const normalized = normalizeEvidencePath(value);
  if (!normalized.endsWith(suffix)) {
    errors.push(`${label} expected path ending ${JSON.stringify(suffix)} but got ${JSON.stringify(value)}`);
  }
}

function expectCommandFragments(errors, label, command, fragments) {
  const text = String(command || '');
  for (const fragment of fragments) {
    if (!text.includes(fragment)) errors.push(`${label} command missing fragment ${JSON.stringify(fragment)}`);
  }
}

function expectNoForbiddenClassification(errors, label, value) {
  if (
    [
      'repo_internal_reclassify_possible',
      'unknown_requires_followup',
      'blocked_requires_followup',
      'follow_up_only',
    ].includes(value)
  ) {
    errors.push(`${label} must not be ${value}`);
  }
}

function latestReceiptsByTarget(receipts) {
  const latest = new Map();
  for (const receipt of receipts || []) {
    latest.set(receipt.targetPath, receipt);
  }
  return latest;
}

function expectedSafeWriteTopLevelKeys(targetPath) {
  const normalized = targetPath.replace(/\\/g, '/');
  if (normalized === REGISTRY_PATH) return [];
  if (normalized === CLOSURE_AUDIT_PATH) return ['generatedAt', 'entries'];
  if (normalized.endsWith('/preflight.json')) {
    return ['waveId', 'startedAt', 'completedAt', 'gitStatusShortHash', 'sourceInventoryHash', 'commands'];
  }
  if (normalized.endsWith('/source-inventory.json')) return ['waveId', 'generatedAt', 'entries'];
  if (normalized.endsWith('/no-migration-internal.json')) return ['waveId', 'generatedAt', 'entries'];
  if (normalized.endsWith('/root-script-regression-proof.json')) return ['waveId', 'generatedAt', 'sourceInventoryRef', 'entries'];
  if (normalized.endsWith('/classification-evidence.json')) {
    return ['waveId', 'generatedAt', 'refinesWaveId', 'auditReportPath', 'registryPath', 'entries'];
  }
  if (normalized.endsWith('/registry-evidence.json')) return ['waveId', 'validatedAt', 'entries'];
  if (normalized.startsWith(`${WAVE_DIR}/evidence-history/`) && normalized.endsWith('.evidence.json')) {
    return ['waveId', 'archivedAt', 'repairRoundId', 'blockedReason', 'blockedCommandId', 'evidence'];
  }
  if (normalized.endsWith('/evidence.json')) {
    return ['waveId', 'status', 'startedAt', 'completedAt', 'commandRows', 'acceptanceStatus', 'manualVerificationStatus'];
  }
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
  if (normalized.startsWith(`${INSTALL_MATRIX_DIR}/`) && normalized.endsWith('.json')) {
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
  if (normalized === SAFE_WRITE_PATH) return ['waveId', 'generatedAt', 'receipts', 'selfVerification'];
  return [];
}

function receiptCheckKeys(receipt) {
  return (receipt.requiredChecks || [])
    .filter((check) => check && typeof check === 'object' && check.type === 'topLevelKey' && check.status === 'passed')
    .map((check) => check.key);
}

function receiptHasPassedCheck(receipt, type) {
  return (receipt.requiredChecks || []).some(
    (check) => check && typeof check === 'object' && check.type === type && check.status === 'passed'
  );
}

function validateSelfVerification(artifact, errors) {
  expectObject(errors, 'safe-write-receipts.selfVerification', artifact.selfVerification);
  const verification = artifact.selfVerification || {};
  expectEqual(
    errors,
    'safe-write-receipts.selfVerification.hashKind',
    verification.hashKind,
    'canonical_json_without_selfVerification'
  );
  expectHash(errors, 'safe-write-receipts.selfVerification.payloadSha256', verification.payloadSha256);
  expectIsoTimestamp(errors, 'safe-write-receipts.selfVerification.computedAt', verification.computedAt);
  expectEqual(errors, 'safe-write-receipts.selfVerification.status', verification.status, 'passed');
  const payload = { ...artifact };
  delete payload.selfVerification;
  expectEqual(
    errors,
    'safe-write-receipts.selfVerification.payloadSha256',
    verification.payloadSha256,
    hashCanonical(payload)
  );
}

function expectExactOriginalPaths(errors, label, entries, expectedEntries, field = 'originalPath') {
  const actual = (entries || []).map((entry) => entry[field]).sort();
  const expected = expectedEntries.map((entry) => entry.originalPath).sort();
  expectEqual(errors, `${label} exact paths`, JSON.stringify(actual), JSON.stringify(expected));
}

function sourceInventoryByPath(errors) {
  const inventory = readJson(`${WAVE_DIR}/source-inventory.json`, errors);
  const byPath = new Map();
  for (const entry of inventory?.entries || []) byPath.set(entry.originalPath, entry);
  return byPath;
}

function listFiles(relativeRoot) {
  const absoluteRoot = repoPath(relativeRoot);
  if (!fs.existsSync(absoluteRoot)) return [];
  const stat = fs.statSync(absoluteRoot);
  if (stat.isFile()) return [absoluteRoot];
  const files = [];
  const stack = [absoluteRoot];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        stack.push(full);
      } else {
        files.push(full);
      }
    }
  }
  return files;
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: options.maxBuffer || 80 * 1024 * 1024,
    env: { ...process.env, ...(options.env || {}) },
  });
}

function parseArgs(argv) {
  const parsed = { mode: 'full', assert: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--pre-evidence') {
      parsed.mode = 'pre-evidence';
    } else if (arg === '--evidence-running') {
      parsed.mode = 'evidence-running';
    } else if (arg === '--final-acceptance') {
      parsed.mode = 'final-acceptance';
    } else if (arg === '--assert') {
      parsed.mode = 'assert';
      parsed.assert = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return parsed;
}

function validateSourceInventory(errors) {
  const inventory = readJson(`${WAVE_DIR}/source-inventory.json`, errors);
  if (!inventory) return;
  expectEqual(errors, 'source-inventory.waveId', inventory.waveId, WAVE_ID);
  if (!Array.isArray(inventory.entries)) {
    errors.push('source-inventory.entries must be an array');
    return;
  }
  expectEqual(errors, 'source-inventory.entries length', inventory.entries.length, EXPECTED_ENTRIES.length);
  for (const expected of EXPECTED_ENTRIES) {
    const entry = inventory.entries.find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`source-inventory missing ${expected.originalPath}`);
      continue;
    }
    expectEqual(errors, `${expected.originalPath} auditSemanticClassification`, entry.auditSemanticClassification, expected.semantic);
    expectEqual(errors, `${expected.originalPath} migrationStrategy`, entry.migrationStrategy, expected.strategy);
    expectEqual(errors, `${expected.originalPath} retainedRootPath`, entry.retainedRootPath, true);
    expectEqual(errors, `${expected.originalPath} deletionAllowed`, entry.deletionAllowed, false);
    for (const targetPath of expected.targetPaths) {
      expectIncludes(errors, `${expected.originalPath} targetPaths`, entry.targetPaths, targetPath);
    }
    expectHash(errors, `${expected.originalPath} originalPathSha256`, entry.originalPathSha256);
  }
}

function validatePreflight(errors) {
  const preflight = readJson(`${WAVE_DIR}/preflight.json`, errors);
  if (!preflight) return;
  expectEqual(errors, 'preflight.waveId', preflight.waveId, WAVE_ID);
  expectHash(errors, 'preflight.gitStatusShortHash', preflight.gitStatusShortHash);
  expectHash(errors, 'preflight.sourceInventoryHash', preflight.sourceInventoryHash);
  if (exists(`${WAVE_DIR}/source-inventory.json`)) {
    expectEqual(
      errors,
      'preflight.sourceInventoryHash',
      preflight.sourceInventoryHash,
      sha256File(`${WAVE_DIR}/source-inventory.json`)
    );
  }
  expectArray(errors, 'preflight.commands', preflight.commands);
  let gitStatusRow = null;
  let encodingRow = null;
  for (const command of preflight.commands || []) {
    validateCommandRow(command, errors, { requireId: false });
    if (String(command.command || '').includes('git status --short --branch')) gitStatusRow = command;
    if (String(command.command || '').includes('check-encoding-integrity.js')) encodingRow = command;
    if (command.status !== 'passed') errors.push(`preflight command is not passed: ${command.command}`);
  }
  if (!gitStatusRow) {
    errors.push('preflight.commands missing git status --short --branch row');
  } else {
    expectEqual(errors, 'preflight.gitStatusShortHash', preflight.gitStatusShortHash, gitStatusRow.stdoutHash);
  }
  if (!encodingRow) {
    errors.push('preflight.commands missing encoding integrity gate row');
  }
}

function validateExports(errors) {
  for (const entry of EXPECTED_ENTRIES) {
    const exportTargetPaths = entry.exportTargetPaths || entry.targetPaths;
    for (const targetPath of exportTargetPaths) {
      if (!exists(targetPath)) {
        errors.push(`missing target file: ${targetPath}`);
        continue;
      }
      if (!targetPath.endsWith('.js')) continue;
      const mod = require(repoPath(targetPath));
      for (const exportName of entry.exports) {
        if (mod[exportName] === undefined) errors.push(`${targetPath} missing export ${exportName}`);
      }
    }
  }
}

function expectedRegistryMetadata(expected) {
  const sourceCommand = [`source repository ${expected.originalPath}`];
  if (expected.strategy === 'package_runtime_module') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: expected.semantic,
      callerSwitchStatus: 'switched',
      oldPathDisposition: 'retained_source_root_legacy_package_runtime_module',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  if (expected.strategy === 'durable_helper_copy') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: expected.semantic,
      callerSwitchStatus: 'not_applicable',
      oldPathDisposition: 'retained_source_root_legacy_package_local_helper',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  if (expected.entryId === 'eval-question-generate') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: expected.semantic,
      callerSwitchStatus: 'switched',
      oldPathDisposition: 'retained_legacy_root_public_cli_replaced',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: ['bmad-speckit eval-question-generate'],
    };
  }
  if (expected.entryId === 'check-story-score-written') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: expected.semantic,
      callerSwitchStatus: 'switched_existing_package_runtime',
      oldPathDisposition: 'retained_legacy_root_public_cli_replaced',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: ['bmad-speckit check-score'],
    };
  }
  if (expected.entryId === 'create-second-story') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: expected.semantic,
      callerSwitchStatus: 'not_applicable',
      oldPathDisposition: 'retained_source_repo_internal_test_seed_only',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  if (expected.entryId === 'verify-score-auto-scoped-bundle') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: expected.semantic,
      callerSwitchStatus: 'not_applicable',
      oldPathDisposition: 'retained_source_repo_internal_verification_harness',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  throw new Error(`No registry metadata expectation for ${expected.entryId}`);
}

function validateNoForbiddenRuntimeRefs(errors) {
  const scanRoots = [
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'packages/bmad-speckit/src/main-agent/runtime',
    'packages/bmad-speckit/src/main-agent/helpers',
    'packages/bmad-speckit/src/commands/eval-question-generate.js',
    'packages/bmad-speckit/src/commands/check-score.js',
    'packages/bmad-speckit/dist/main-agent/runtime',
    'packages/bmad-speckit/dist/main-agent/helpers',
    'packages/bmad-speckit/tests/main-agent-wave-3-11-runtime-modules.test.js',
    'packages/bmad-speckit/tests/main-agent-wave-3-11-helpers.test.js',
    'packages/bmad-speckit/tests/eval-question-generate-command.test.js',
    'packages/bmad-speckit/tests/check-score-command.test.js',
    'tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs',
  ];
  const forbidden = [
    { id: 'root TypeScript script', pattern: /(?:require|import|spawnSync|execFileSync|node)\s*\(?[^;\n]*scripts[\\/][^'"\n]*\.ts/u },
    { id: 'runRepoScript', pattern: /runRepoScript\(/u },
    { id: 'ts-node', pattern: /(^|[^A-Za-z0-9_-])ts-node(?:\.cmd)?($|[^A-Za-z0-9_-])/iu },
    { id: 'compiled fallback', pattern: /compiled[\\/]main-agent-orchestration\.cjs/u },
  ];
  const tsxPattern = new RegExp(`\\b${['t', 's', 'x'].join('')}\\b`);
  for (const root of scanRoots) {
    for (const filePath of listFiles(root)) {
      if (!/\.(?:js|cjs)$/u.test(filePath)) continue;
      const relative = rel(filePath);
      const text = fs.readFileSync(filePath, 'utf8');
      for (const item of forbidden) {
        if (item.pattern.test(text)) errors.push(`${relative} contains forbidden ${item.id}`);
      }
      if (tsxPattern.test(text)) errors.push(`${relative} contains forbidden tsx dependency`);
    }
  }
}

function validateClosureAuditWriterSafeWrite(errors) {
  const text = readText('tools/script-migration/audit-consumer-reachable-closure.cjs', errors);
  if (!text) return;
  if (!text.includes("require('./main-agent-wave-3-11-evidence-utils.cjs')")) {
    errors.push('closure audit writer must use Wave 3.11 evidence safe-write utilities');
  }
  if (!text.includes('safeWriteFile(') || !text.includes('saveSafeWriteReceipts(')) {
    errors.push('closure audit --write path must promote audit-report.json through D010 safe-write receipts');
  }
  if (/fs\.writeFileSync\(\s*args\.out\s*,/u.test(text)) {
    errors.push('closure audit --write path still uses direct fs.writeFileSync(args.out, ...) overwrite');
  }
}

function validateEvidenceWriterSafeWrite(errors) {
  const text = readText('tools/script-migration/write-main-agent-wave-3-11-evidence.cjs', errors);
  if (!text) return;
  for (const required of [
    "'--write-summary'",
    "'--write-unsealed-final-packet'",
    "operation: 'evidence_post_final_validator_no_receipt'",
    'safeWriteFile(EVIDENCE_PATH',
    'final_evidence_packet_unsealed',
    'summary_final_closeout',
  ]) {
    if (!text.includes(required)) errors.push(`evidence writer missing deterministic final-closeout hook: ${required}`);
  }
  if (/fs\.writeFileSync\(\s*repoPath\(\s*EVIDENCE_PATH\s*\)/u.test(text)) {
    errors.push('evidence writer must not direct-write evidence.json with fs.writeFileSync(repoPath(EVIDENCE_PATH), ...)');
  }
  const appendStart = text.indexOf('function appendFinalValidatorRow()');
  const appendEnd = text.indexOf('function main()', appendStart);
  const appendBody = appendStart === -1 || appendEnd === -1 ? '' : text.slice(appendStart, appendEnd);
  if (!appendBody) {
    errors.push('evidence writer missing appendFinalValidatorRow() body');
  } else {
    if (appendBody.includes('saveSafeWriteReceipts(') || appendBody.includes('SAFE_WRITE_PATH')) {
      errors.push('appendFinalValidatorRow() must not mutate safe-write-receipts.json after final validator returns');
    }
    const spawnIndex = appendBody.indexOf('spawnSync(');
    for (const guard of [
      'cmd-validate-wave-3-11-final already exists in evidence.json',
      'awaiting_final_validator_self_receipt',
      'cmd-test-wave-3-11-contract-final must be passed before final validator invocation',
    ]) {
      const guardIndex = appendBody.indexOf(guard);
      if (guardIndex === -1) {
        errors.push(`appendFinalValidatorRow() missing pre-spawn guard: ${guard}`);
      } else if (spawnIndex !== -1 && spawnIndex < guardIndex) {
        errors.push(`appendFinalValidatorRow() must check ${guard} before spawnSync()`);
      }
    }
  }
  const unsealedStart = text.indexOf('function writeUnsealedFinalPacket()');
  const unsealedEnd = text.indexOf('function sealFinalPacket()', unsealedStart);
  const unsealedBody = unsealedStart === -1 || unsealedEnd === -1 ? '' : text.slice(unsealedStart, unsealedEnd);
  if (!unsealedBody) {
    errors.push('evidence writer missing writeUnsealedFinalPacket() body');
  } else {
    for (const required of ['awaiting_final_validator_self_receipt', 'ACC013', 'ACC014', 'self_excluded']) {
      if (!unsealedBody.includes(required)) {
        errors.push(`writeUnsealedFinalPacket() missing self-exclusion guard fragment: ${required}`);
      }
    }
  }
  const runStart = text.indexOf('function runEvidenceCommand(commandId)');
  const runEnd = text.indexOf('function writeRootScriptProof()', runStart);
  const runBody = runStart === -1 || runEnd === -1 ? '' : text.slice(runStart, runEnd);
  if (!runBody) {
    errors.push('evidence writer missing runEvidenceCommand(commandId) body');
  } else if (runBody.includes('writeRootScriptProof()')) {
    errors.push('runEvidenceCommand() must not auto-create root-script-regression-proof.json');
  }
  const proofStart = text.indexOf('function writeRootScriptProof()');
  const proofEnd = text.indexOf('function writeSummary()', proofStart);
  const proofBody = proofStart === -1 || proofEnd === -1 ? '' : text.slice(proofStart, proofEnd);
  if (!proofBody) {
    errors.push('evidence writer missing writeRootScriptProof() body');
  } else if (proofBody.includes("'cmd-git-status-baseline'")) {
    errors.push('writeRootScriptProof() must not synthesize behavior proof from cmd-git-status-baseline');
  }
}

function validateRegistryWave(errors) {
  const registry = readYaml(REGISTRY_PATH, errors);
  if (!registry) return;
  const wave = (registry.waves || []).find((candidate) => candidate.waveId === WAVE_ID);
  if (!wave) {
    errors.push(`registry missing wave ${WAVE_ID}`);
    return;
  }
  expectEqual(errors, 'registry wave refinesWaveId', wave.refinesWaveId, REFINES_WAVE_ID);
  expectEqual(errors, 'registry wave title', wave.title, WAVE_TITLE);
  expectEqual(errors, 'registry wave status', wave.status, 'validated');
  expectEqual(errors, 'registry wave contractPath', wave.contractPath, CONTRACT_PATH);
  expectIsoTimestamp(errors, 'registry wave startedAt', wave.startedAt);
  expectIsoTimestamp(errors, 'registry wave completedAt', wave.completedAt);
  if (!Array.isArray(wave.entries)) {
    errors.push('registry wave entries must be an array');
    return;
  }
  expectEqual(errors, 'registry Wave 3.11 entries length', wave.entries.length, EXPECTED_ENTRIES.length);
  for (const expected of EXPECTED_ENTRIES) {
    const entry = wave.entries.find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`registry Wave 3.11 missing ${expected.originalPath}`);
      continue;
    }
    const metadata = expectedRegistryMetadata(expected);
    expectEqual(errors, `${expected.entryId} entryId`, entry.entryId, expected.entryId);
    expectEqual(errors, `${expected.entryId} refinesWaveId`, entry.refinesWaveId, REFINES_WAVE_ID);
    expectEqual(errors, `${expected.entryId} originalPathStatus`, entry.originalPathStatus, metadata.originalPathStatus);
    expectEqual(
      errors,
      `${expected.entryId} originalClassBeforeMigration`,
      entry.originalClassBeforeMigration,
      metadata.originalClassBeforeMigration
    );
    expectEqual(errors, `${expected.entryId} migrationStrategy`, entry.migrationStrategy, expected.strategy);
    expectEqual(errors, `${expected.entryId} migrationStatus`, entry.migrationStatus, 'validated');
    expectEqual(errors, `${expected.entryId} validationStatus`, entry.validationStatus, 'passed');
    expectEqual(errors, `${expected.entryId} callerSwitchStatus`, entry.callerSwitchStatus, metadata.callerSwitchStatus);
    expectEqual(errors, `${expected.entryId} oldPathDisposition`, entry.oldPathDisposition, metadata.oldPathDisposition);
    expectEqual(errors, `${expected.entryId} deletionAllowed`, entry.deletionAllowed, false);
    expectEqual(errors, `${expected.entryId} deletionApprovalRef`, entry.deletionApprovalRef, null);
    expectEqual(
      errors,
      `${expected.entryId} evidenceRefs`,
      JSON.stringify(entry.evidenceRefs || []),
      JSON.stringify([`${WAVE_DIR}/registry-evidence.json`])
    );
    expectArrayEqual(errors, `${expected.entryId} targetPaths`, entry.targetPaths, expected.targetPaths);
    expectArrayEqual(
      errors,
      `${expected.entryId} publicCommandsBeforeMigration`,
      entry.publicCommandsBeforeMigration,
      metadata.publicCommandsBeforeMigration
    );
    expectArrayEqual(
      errors,
      `${expected.entryId} publicCommandsAfterMigration`,
      entry.publicCommandsAfterMigration,
      metadata.publicCommandsAfterMigration
    );
  }
}

function validateRegistryEvidence(errors, { required = true } = {}) {
  const evidence = readJson(`${WAVE_DIR}/registry-evidence.json`, errors, { required });
  if (!evidence) return;
  expectEqual(errors, 'registry-evidence.waveId', evidence.waveId, WAVE_ID);
  expectIsoTimestamp(errors, 'registry-evidence.validatedAt', evidence.validatedAt);
  expectArray(errors, 'registry-evidence.entries', evidence.entries);
  expectEqual(errors, 'registry-evidence.entries length', evidence.entries?.length, EXPECTED_ENTRIES.length);
  expectExactOriginalPaths(errors, 'registry-evidence.entries', evidence.entries, EXPECTED_ENTRIES);
  for (const expected of EXPECTED_ENTRIES) {
    const entry = (evidence.entries || []).find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`registry-evidence missing ${expected.originalPath}`);
      continue;
    }
    for (const field of ['entryId', 'originalPath', 'targetPaths', 'commands', 'installMatrixEvidence', 'result']) {
      expectField(errors, `registry-evidence ${expected.entryId}`, entry, field);
    }
    expectEqual(errors, `registry-evidence ${expected.entryId} entryId`, entry.entryId, expected.entryId);
    expectEqual(errors, `registry-evidence ${expected.entryId} result`, entry.result, 'passed');
    for (const targetPath of expected.targetPaths) {
      expectIncludes(errors, `registry-evidence ${expected.entryId} targetPaths`, entry.targetPaths, targetPath);
    }
    expectArray(errors, `registry-evidence ${expected.entryId}.commands`, entry.commands);
    for (const command of entry.commands || []) {
      for (const field of ['command', 'exitCode', 'stdoutHash', 'stderrHash']) {
        expectField(errors, `registry-evidence ${expected.entryId}.commands[]`, command, field);
      }
      expectHash(errors, `registry-evidence ${expected.entryId}.commands[].stdoutHash`, command.stdoutHash);
      expectHash(errors, `registry-evidence ${expected.entryId}.commands[].stderrHash`, command.stderrHash);
      if (command.exitCode !== 0) {
        errors.push(`registry-evidence ${expected.entryId} passed entry contains nonzero command row`);
      }
    }
  }
}

function validateClassificationEvidence(errors, { required = true } = {}) {
  const evidence = readJson(`${WAVE_DIR}/classification-evidence.json`, errors, { required });
  if (!evidence) return;
  expectEqual(errors, 'classification-evidence.waveId', evidence.waveId, WAVE_ID);
  expectEqual(errors, 'classification-evidence.refinesWaveId', evidence.refinesWaveId, REFINES_WAVE_ID);
  expectEqual(errors, 'classification-evidence.auditReportPath', evidence.auditReportPath, CLOSURE_AUDIT_PATH);
  expectEqual(errors, 'classification-evidence.registryPath', evidence.registryPath, REGISTRY_PATH);
  expectIsoTimestamp(errors, 'classification-evidence.generatedAt', evidence.generatedAt);
  expectArray(errors, 'classification-evidence.entries', evidence.entries);
  expectEqual(errors, 'classification-evidence.entries length', evidence.entries?.length, EXPECTED_ENTRIES.length);
  expectExactOriginalPaths(errors, 'classification-evidence.entries', evidence.entries, EXPECTED_ENTRIES);
  for (const expected of EXPECTED_ENTRIES) {
    const entry = (evidence.entries || []).find((candidate) => candidate.originalPath === expected.originalPath);
    if (!entry) {
      errors.push(`classification-evidence missing ${expected.originalPath}`);
      continue;
    }
    for (const field of [
      'originalPath',
      'currentClassification',
      'migrationStrategy',
      'auditSemanticClassification',
      'registryMigrationStrategy',
      'status',
      'evidenceRefs',
    ]) {
      expectField(errors, `classification-evidence ${expected.entryId}`, entry, field);
    }
    expectEqual(errors, `${expected.entryId} currentClassification`, entry.currentClassification, expected.semantic);
    expectEqual(errors, `${expected.entryId} migrationStrategy`, entry.migrationStrategy, expected.strategy);
    expectEqual(errors, `${expected.entryId} auditSemanticClassification`, entry.auditSemanticClassification, expected.semantic);
    expectEqual(errors, `${expected.entryId} registryMigrationStrategy`, entry.registryMigrationStrategy, expected.strategy);
    expectEqual(errors, `${expected.entryId} classification status`, entry.status, 'passed');
    expectArray(errors, `${expected.entryId} evidenceRefs`, entry.evidenceRefs);
    expectNoForbiddenClassification(errors, `${expected.entryId} currentClassification`, entry.currentClassification);
    expectNoForbiddenClassification(errors, `${expected.entryId} auditSemanticClassification`, entry.auditSemanticClassification);
  }
}

function validateNoMigrationInternalArtifact(errors, { required = true } = {}) {
  const artifact = readJson(`${WAVE_DIR}/no-migration-internal.json`, errors, { required });
  if (!artifact) return;
  const expected = EXPECTED_ENTRIES.filter((entry) => entry.strategy === 'repo_internal_reclassify');
  expectEqual(errors, 'no-migration-internal.waveId', artifact.waveId, WAVE_ID);
  expectIsoTimestamp(errors, 'no-migration-internal.generatedAt', artifact.generatedAt);
  expectArray(errors, 'no-migration-internal.entries', artifact.entries);
  expectEqual(errors, 'no-migration-internal.entries length', artifact.entries?.length, expected.length);
  expectExactOriginalPaths(errors, 'no-migration-internal.entries', artifact.entries, expected);
  for (const item of expected) {
    const entry = (artifact.entries || []).find((candidate) => candidate.originalPath === item.originalPath);
    if (!entry) {
      errors.push(`no-migration-internal missing ${item.originalPath}`);
      continue;
    }
    for (const field of ['originalPath', 'currentClassification', 'reason', 'consumerReachable', 'packageSurfaceConsumed']) {
      expectField(errors, `no-migration-internal ${item.entryId}`, entry, field);
    }
    expectEqual(errors, `${item.entryId} currentClassification`, entry.currentClassification, item.semantic);
    if (Object.prototype.hasOwnProperty.call(entry, 'classification')) {
      expectEqual(errors, `${item.entryId} classification alias`, entry.classification, entry.currentClassification);
    }
    expectEqual(errors, `${item.entryId} consumerReachable`, entry.consumerReachable, false);
    expectEqual(errors, `${item.entryId} packageSurfaceConsumed`, entry.packageSurfaceConsumed, false);
    expectNoForbiddenClassification(errors, `${item.entryId} currentClassification`, entry.currentClassification);
  }
}

function validateClosureAuditExact(errors) {
  const report = readJson(CLOSURE_AUDIT_PATH, errors);
  if (!report) return;
  const entries = Array.isArray(report.entries) ? report.entries : [];
  for (const expected of EXPECTED_ENTRIES) {
    const entry = entries.find((candidate) => candidate.scriptPath === expected.originalPath);
    if (!entry) {
      errors.push(`closure audit missing ${expected.originalPath}`);
      continue;
    }
    const correction = entry.evidence?.correctionOverride?.correctedTo || null;
    const actual = entry.currentClassification || entry.currentStrategy || correction;
    if (actual !== expected.semantic) {
      errors.push(`closure audit ${expected.originalPath} expected ${expected.semantic} but got ${actual}`);
    }
    if (correction && correction !== expected.semantic) {
      errors.push(`closure audit ${expected.originalPath} correctionOverride expected ${expected.semantic} but got ${correction}`);
    }
    if (correction) {
      expectEqual(errors, `closure audit ${expected.originalPath} currentStrategy`, entry.currentStrategy, expected.semantic);
      expectEqual(errors, `closure audit ${expected.originalPath} currentClassification`, entry.currentClassification, expected.semantic);
    }
    for (const [field, value] of [
      ['currentStrategy', entry.currentStrategy],
      ['currentClassification', entry.currentClassification],
      ['matrixClassification', entry.matrixClassification],
      ['targetWave', entry.targetWave],
    ]) {
      expectNoForbiddenClassification(errors, `closure audit ${expected.originalPath} ${field}`, value);
    }
    if (
      entry.recommendation?.verdict === 'follow_up_only' ||
      entry.recommendation?.recommendedStrategy === 'repo_internal_reclassify_possible'
    ) {
      errors.push(`closure audit ${expected.originalPath} remains recommendation-only/follow-up`);
    }
  }
}

function validateNoMigrationInternalExact(errors) {
  const artifact = readJson(`${WAVE_DIR}/no-migration-internal.json`, errors);
  if (!artifact) return;
  const expected = EXPECTED_ENTRIES.filter((entry) => entry.strategy === 'repo_internal_reclassify');
  const actualPaths = (artifact.entries || []).map((entry) => entry.originalPath).sort();
  const expectedPaths = expected.map((entry) => entry.originalPath).sort();
  expectEqual(errors, 'no-migration-internal exact paths', JSON.stringify(actualPaths), JSON.stringify(expectedPaths));
  for (const item of expected) {
    const entry = (artifact.entries || []).find((candidate) => candidate.originalPath === item.originalPath);
    if (entry) expectEqual(errors, `${item.originalPath} classification`, entry.currentClassification, item.semantic);
  }
}

function validatePublicCliDispatch(errors) {
  const cli = readText('packages/bmad-speckit/bin/bmad-speckit.js', errors);
  if (!cli) return;
  if (!/\.command\('eval-question-generate'\)/u.test(cli)) errors.push('package CLI missing eval-question-generate command');
  if (!cli.includes("../src/commands/eval-question-generate") && !cli.includes('../src/commands/eval-question-generate')) {
    errors.push('package CLI does not load eval-question-generate package command');
  }
  if (!/\.command\('check-score'\)/u.test(cli)) errors.push('package CLI missing check-score command');
  if (!cli.includes("../src/commands/check-score") && !cli.includes('../src/commands/check-score')) {
    errors.push('package CLI does not load check-score package command');
  }
  const evalBlock = cli.slice(cli.indexOf(".command('eval-question-generate'"), cli.indexOf(".command('coach'"));
  if (evalBlock.includes('emitDeprecatedAlias')) errors.push('eval-question-generate must not route through emitDeprecatedAlias');
}

function validateRootScriptsNotDeleted(errors) {
  for (const entry of EXPECTED_ENTRIES) {
    if (!exists(entry.originalPath)) errors.push(`original root script missing: ${entry.originalPath}`);
  }
  const result = run('git', ['status', '--short', '--', 'scripts']);
  if (result.status !== 0) {
    errors.push(`git status scripts failed: ${result.stderr || result.stdout}`);
    return;
  }
  const badLines = result.stdout.split(/\r?\n/u).filter((line) => /^( D|D |R )\s+scripts[\\/]/u.test(line));
  if (badLines.length > 0) errors.push(`root script deletion or rename detected: ${badLines.join('; ')}`);
  const statusByPath = new Map();
  for (const line of result.stdout.split(/\r?\n/u).filter(Boolean)) {
    const match = line.match(/^(.{2})\s+(.+)$/u);
    if (!match) continue;
    const statusPath = match[2].split(' -> ').pop().replace(/\\/g, '/');
    statusByPath.set(statusPath, line);
  }
  const proof = readJson(`${WAVE_DIR}/root-script-regression-proof.json`, errors);
  if (!proof) return;
  const sourceInventory = sourceInventoryByPath(errors);
  const evidence = readJson(`${WAVE_DIR}/evidence.json`, errors, { required: false });
  const evidenceRowsById = new Map((evidence?.commandRows || []).map((row) => [row.commandId, row]));
  expectEqual(errors, 'root-script-regression-proof.waveId', proof.waveId, WAVE_ID);
  expectEqual(errors, 'root-script-regression-proof.sourceInventoryRef', proof.sourceInventoryRef, `${WAVE_DIR}/source-inventory.json`);
  expectIsoTimestamp(errors, 'root-script-regression-proof.generatedAt', proof.generatedAt);
  expectArray(errors, 'root-script-regression-proof.entries', proof.entries);
  expectEqual(errors, 'root-script-regression-proof.entries length', proof.entries?.length, EXPECTED_ENTRIES.length);
  expectExactOriginalPaths(errors, 'root-script-regression-proof.entries', proof.entries, EXPECTED_ENTRIES);
  for (const entry of EXPECTED_ENTRIES) {
    const row = (proof.entries || []).find((candidate) => candidate.originalPath === entry.originalPath);
    if (!row) {
      errors.push(`root-script-regression-proof missing ${entry.originalPath}`);
      continue;
    }
    for (const field of [
      'originalPath',
      'baselineSha256',
      'currentSha256',
      'worktreeStatus',
      'contentChanged',
      'behaviorProofStatus',
      'acceptedCommandIds',
      'evidenceRefs',
      'preservedBehavior',
    ]) {
      expectField(errors, `root-script-regression-proof ${entry.entryId}`, row, field);
    }
    expectHash(errors, `root-script-regression-proof ${entry.entryId}.baselineSha256`, row.baselineSha256);
    expectHash(errors, `root-script-regression-proof ${entry.entryId}.currentSha256`, row.currentSha256);
    expectEqual(
      errors,
      `root-script-regression-proof ${entry.entryId}.baselineSha256`,
      row.baselineSha256,
      sourceInventory.get(entry.originalPath)?.originalPathSha256
    );
    if (exists(entry.originalPath)) {
      expectEqual(errors, `root-script-regression-proof ${entry.entryId}.currentSha256`, row.currentSha256, sha256File(entry.originalPath));
    }
    const statusLine = statusByPath.get(entry.originalPath) || '';
    const expectedContentChanged = row.currentSha256 !== row.baselineSha256 || statusLine.length > 0;
    expectEqual(errors, `root-script-regression-proof ${entry.entryId}.contentChanged`, row.contentChanged, expectedContentChanged);
    if (statusLine) expectEqual(errors, `root-script-regression-proof ${entry.entryId}.worktreeStatus`, row.worktreeStatus, statusLine);
    if (row.behaviorProofStatus === 'unknown' || row.behaviorProofStatus === 'manual_inspection') {
      errors.push(`root-script-regression-proof ${entry.entryId} invalid behaviorProofStatus ${row.behaviorProofStatus}`);
    }
    expectArray(errors, `root-script-regression-proof ${entry.entryId}.acceptedCommandIds`, row.acceptedCommandIds);
    expectArray(errors, `root-script-regression-proof ${entry.entryId}.evidenceRefs`, row.evidenceRefs);
    if (row.contentChanged === true) {
      expectEqual(errors, `root-script-regression-proof ${entry.entryId}.behaviorProofStatus`, row.behaviorProofStatus, 'covered');
      expectIncludes(errors, `root-script-regression-proof ${entry.entryId}.evidenceRefs`, row.evidenceRefs, `${WAVE_DIR}/evidence.json`);
      const flags = row.preservedBehavior || {};
      for (const flag of ['arguments', 'outputShape', 'exitCodeSemantics', 'errorNames']) {
        if (flags[flag] !== true) errors.push(`root_script_behavior_regression_proof_missing:${entry.originalPath}:${flag}`);
      }
      if (!Array.isArray(row.acceptedCommandIds) || row.acceptedCommandIds.length === 0) {
        errors.push(`root_script_behavior_regression_proof_missing:${entry.originalPath}:acceptedCommandIds`);
      }
      for (const commandId of row.acceptedCommandIds || []) {
        if (commandId === 'cmd-git-status-baseline') {
          errors.push(`root_script_behavior_regression_proof_missing:${entry.originalPath}:cmd-git-status-baseline-is-not-behavior-proof`);
          continue;
        }
        const command = evidenceRowsById.get(commandId);
        if (!command) errors.push(`root_script_behavior_regression_proof_missing:${entry.originalPath}:${commandId}`);
        else if (command.status !== 'passed') errors.push(`root script proof ${entry.originalPath} command ${commandId} is not passed`);
      }
    } else if (row.contentChanged === false) {
      expectEqual(errors, `root-script-regression-proof ${entry.entryId}.behaviorProofStatus`, row.behaviorProofStatus, 'unchanged');
    } else {
      errors.push(`root-script-regression-proof ${entry.entryId}.contentChanged must be boolean`);
    }
  }
}

function validateCommandRow(row, errors, { requireId = true } = {}) {
  const fields = ['command', 'cwd', 'exitCode', 'stdoutHash', 'stderrHash', 'startedAt', 'completedAt', 'status'];
  if (requireId) fields.push('commandId', 'sequence', 'attempt');
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(row, field)) errors.push(`command row missing ${field}`);
  }
  if (row.status && !COMMAND_STATUS.has(row.status)) errors.push(`invalid command row status ${row.status}`);
  if (row.exitCode === 0 && row.status !== 'passed') errors.push(`${row.commandId || row.command} exitCode 0 must be passed`);
  if (row.exitCode !== 0 && row.status === 'passed') errors.push(`${row.commandId || row.command} nonzero exitCode marked passed`);
  if (requireId) {
    if (!Number.isInteger(row.sequence) || row.sequence < 1) errors.push(`${row.commandId || row.command} sequence must be a positive integer`);
    if (!Number.isInteger(row.attempt) || row.attempt < 1) errors.push(`${row.commandId || row.command} attempt must be a positive integer`);
  }
  if (Object.prototype.hasOwnProperty.call(row, 'manualScenarioIds')) {
    expectArray(errors, `${row.commandId || row.command}.manualScenarioIds`, row.manualScenarioIds);
    for (const manualId of row.manualScenarioIds || []) {
      if (!MANUAL_IDS.includes(manualId)) {
        errors.push(`${row.commandId || row.command}.manualScenarioIds contains unknown id ${manualId}`);
      }
    }
  }
  expectHash(errors, `${row.commandId || row.command} stdoutHash`, row.stdoutHash);
  expectHash(errors, `${row.commandId || row.command} stderrHash`, row.stderrHash);
  expectIsoTimestamp(errors, `${row.commandId || row.command} startedAt`, row.startedAt);
  expectIsoTimestamp(errors, `${row.commandId || row.command} completedAt`, row.completedAt);
}

function latestCommandRowsById(rows) {
  const latest = new Map();
  for (const row of rows || []) {
    if (!row?.commandId) continue;
    const previous = latest.get(row.commandId);
    if (!previous || row.attempt > previous.attempt || (row.attempt === previous.attempt && row.sequence > previous.sequence)) {
      latest.set(row.commandId, row);
    }
  }
  return latest;
}

function validateBlockedEvidenceStatus(evidence, byId, errors) {
  expectField(errors, 'evidence', evidence, 'blockedReason');
  expectField(errors, 'evidence', evidence, 'blockedCommandId');
  expectField(errors, 'evidence', evidence, 'blockedAt');
  expectIsoTimestamp(errors, 'evidence.blockedAt', evidence.blockedAt);
  const expectedReason = `required_command_failed:${evidence.blockedCommandId}`;
  expectEqual(errors, 'evidence.blockedReason', evidence.blockedReason, expectedReason);
  const blockedRow = byId.get(evidence.blockedCommandId);
  if (!blockedRow) {
    errors.push(`evidence blockedCommandId ${evidence.blockedCommandId} has no command row`);
    return;
  }
  if (blockedRow.status !== 'failed') {
    errors.push(`evidence blockedCommandId ${evidence.blockedCommandId} latest row must be failed`);
  }
  if (blockedRow.attempt < MAX_REQUIRED_COMMAND_ATTEMPTS) {
    errors.push(`evidence blockedCommandId ${evidence.blockedCommandId} has not reached MAX_REQUIRED_COMMAND_ATTEMPTS`);
  }
}

function validateRepairRoundArchive(evidence, errors) {
  const hasRepairMetadata = Boolean(
    evidence.executionRoundId ||
      evidence.previousEvidenceArchivePath ||
      evidence.repairOfBlockedReason ||
      evidence.repairOfBlockedCommandId
  );
  if (!hasRepairMetadata) return;

  for (const field of [
    'executionRoundId',
    'previousEvidenceArchivePath',
    'repairOfBlockedReason',
    'repairOfBlockedCommandId',
  ]) {
    expectField(errors, 'evidence repair round', evidence, field);
  }

  const archivePath = normalizeEvidencePath(evidence.previousEvidenceArchivePath);
  if (!archivePath) return;
  if (!archivePath.startsWith(`${WAVE_DIR}/evidence-history/`) || !archivePath.endsWith('.evidence.json')) {
    errors.push(`evidence.previousEvidenceArchivePath must be under ${WAVE_DIR}/evidence-history/*.evidence.json`);
  }
  if (evidence.executionRoundId) {
    expectEqual(
      errors,
      'evidence.previousEvidenceArchivePath',
      archivePath,
      `${WAVE_DIR}/evidence-history/${evidence.executionRoundId}.evidence.json`
    );
  }

  const archive = readJson(archivePath, errors);
  if (!archive) return;
  expectEqual(errors, 'repair archive.waveId', archive.waveId, WAVE_ID);
  expectIsoTimestamp(errors, 'repair archive.archivedAt', archive.archivedAt);
  expectEqual(errors, 'repair archive.repairRoundId', archive.repairRoundId, evidence.executionRoundId);
  expectEqual(errors, 'repair archive.blockedReason', archive.blockedReason, evidence.repairOfBlockedReason);
  expectEqual(errors, 'repair archive.blockedCommandId', archive.blockedCommandId, evidence.repairOfBlockedCommandId);
  expectObject(errors, 'repair archive.evidence', archive.evidence);
  if (archive.evidence && typeof archive.evidence === 'object') {
    expectEqual(errors, 'repair archive.evidence.status', archive.evidence.status, 'blocked');
    expectEqual(errors, 'repair archive.evidence.blockedReason', archive.evidence.blockedReason, evidence.repairOfBlockedReason);
    expectEqual(errors, 'repair archive.evidence.blockedCommandId', archive.evidence.blockedCommandId, evidence.repairOfBlockedCommandId);
    expectArray(errors, 'repair archive.evidence.commandRows', archive.evidence.commandRows);
    validateBlockedEvidenceStatus(archive.evidence, latestCommandRowsById(archive.evidence.commandRows || []), errors);
  }
}

function validateAcceptanceStatus(value, errors, label) {
  if (!value || typeof value !== 'object') {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const id of ACCEPTANCE_IDS) {
    const row = value[id];
    if (!row) {
      errors.push(`${label} missing ${id}`);
      continue;
    }
    for (const field of ['status', 'evidenceRefs', 'commandIds', 'notes']) {
      if (!Object.prototype.hasOwnProperty.call(row, field)) errors.push(`${label}.${id} missing ${field}`);
    }
    if (!['passed', 'failed', 'blocked', 'pending', 'self_excluded'].includes(row.status)) {
      errors.push(`${label}.${id} invalid status ${row.status}`);
    }
    if (row.status === 'self_excluded' && !['ACC013', 'ACC014'].includes(id)) {
      errors.push(`${label}.${id} self_excluded is only allowed for ACC013/ACC014`);
    }
    if (row.status === 'self_excluded') {
      expectArray(errors, `${label}.${id}.pendingCommandIds`, row.pendingCommandIds);
      const pending = JSON.stringify(row.pendingCommandIds || []);
      const expectedPending = JSON.stringify([FINAL_ACCEPTANCE_COMMAND_ID, FINAL_VALIDATOR_COMMAND_ID]);
      expectEqual(errors, `${label}.${id}.pendingCommandIds`, pending, expectedPending);
      if (!row.reason) errors.push(`${label}.${id} self_excluded missing reason`);
    }
    expectArray(errors, `${label}.${id}.evidenceRefs`, row.evidenceRefs);
    expectArray(errors, `${label}.${id}.commandIds`, row.commandIds);
  }
}

function validateManualStatus(value, errors, label) {
  if (!value || typeof value !== 'object') {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const id of MANUAL_IDS) {
    const row = value[id];
    if (!row) {
      errors.push(`${label} missing ${id}`);
      continue;
    }
    for (const field of ['status', 'evidenceRefs', 'commandIds', 'notes']) {
      expectField(errors, `${label}.${id}`, row, field);
    }
    if (!['passed', 'failed', 'blocked', 'pending'].includes(row.status)) {
      errors.push(`${label}.${id} invalid status ${row.status}`);
    }
    expectArray(errors, `${label}.${id}.evidenceRefs`, row.evidenceRefs);
    expectArray(errors, `${label}.${id}.commandIds`, row.commandIds);
    if (row.status === 'passed') {
      for (const commandId of MANUAL_COMMAND_REQUIREMENTS[id] || []) {
        expectIncludes(errors, `${label}.${id}.commandIds`, row.commandIds, commandId);
      }
    }
  }
}

function validateEvidenceJson(errors, { stage = 'evidence-running' } = {}) {
  const evidence = readJson(`${WAVE_DIR}/evidence.json`, errors);
  if (!evidence) return;
  expectEqual(errors, 'evidence.waveId', evidence.waveId, WAVE_ID);
  expectField(errors, 'evidence', evidence, 'startedAt');
  expectField(errors, 'evidence', evidence, 'completedAt');
  expectIsoTimestamp(errors, 'evidence.startedAt', evidence.startedAt);
  if (evidence.completedAt !== null) expectIsoTimestamp(errors, 'evidence.completedAt', evidence.completedAt);
  if (evidence.status && !ARTIFACT_STATUS.has(evidence.status)) errors.push(`evidence invalid status ${evidence.status}`);
  validateAcceptanceStatus(evidence.acceptanceStatus, errors, 'evidence.acceptanceStatus');
  validateManualStatus(evidence.manualVerificationStatus, errors, 'evidence.manualVerificationStatus');
  expectField(errors, 'evidence', evidence, 'commandRows');
  const rows = evidence.commandRows || [];
  expectArray(errors, 'evidence.commandRows', rows);
  rows.forEach((row) => validateCommandRow(row, errors));
  const attemptsById = new Map();
  for (const row of rows) {
    if (!attemptsById.has(row.commandId)) attemptsById.set(row.commandId, []);
    attemptsById.get(row.commandId).push(row);
  }
  const byId = latestCommandRowsById(rows);
  const enforceForwardProgress = evidence.status !== 'blocked';
  rows.forEach((row, index) => {
    expectEqual(errors, `${row.commandId} contiguous sequence`, row.sequence, index + 1);
    const expectedIndex = REQUIRED_COMMAND_IDS.indexOf(row.commandId);
    if (expectedIndex === -1) errors.push(`unexpected evidence commandId ${row.commandId}`);
    const latestForPreviousCommands = latestCommandRowsById(rows.slice(0, index));
    const previousForCommand = latestForPreviousCommands.get(row.commandId);
    if (previousForCommand) {
      if (previousForCommand.status !== 'failed') {
        errors.push(`${row.commandId} retry at sequence ${index + 1} follows non-failed attempt ${previousForCommand.sequence}`);
      }
      if (row.attempt !== previousForCommand.attempt + 1) {
        errors.push(`${row.commandId} retry attempt must be ${previousForCommand.attempt + 1}`);
      }
    } else if (expectedIndex !== latestForPreviousCommands.size) {
      errors.push(`${row.commandId} appears before required order index ${expectedIndex + 1}`);
    }
    if (enforceForwardProgress) {
      const blockingPrevious = REQUIRED_COMMAND_IDS.slice(0, expectedIndex)
        .map((id) => latestForPreviousCommands.get(id))
        .find((previousRow) => previousRow?.status === 'failed');
      if (blockingPrevious) {
        errors.push(`${row.commandId} appears after failed required command ${blockingPrevious.commandId} at sequence ${blockingPrevious.sequence}`);
      }
    }
    if (row.commandId && REQUIRED_COMMAND_FRAGMENTS[row.commandId]) {
      expectCommandFragments(errors, `evidence ${row.commandId}`, row.command, REQUIRED_COMMAND_FRAGMENTS[row.commandId]);
    }
  });
  for (const [commandId, attempts] of attemptsById.entries()) {
    if (attempts.length > MAX_REQUIRED_COMMAND_ATTEMPTS) {
      errors.push(`${commandId} has more than MAX_REQUIRED_COMMAND_ATTEMPTS attempts`);
    }
    const passedAttempts = attempts.filter((row) => row.status === 'passed');
    if (passedAttempts.length > 1) errors.push(`${commandId} has multiple passed attempts`);
    const latest = byId.get(commandId);
    if (passedAttempts.length === 1 && latest.status !== 'passed') {
      errors.push(`${commandId} has a passed attempt followed by a non-passed retry`);
    }
  }
  const maxFailedCommandIds = Array.from(byId.values())
    .filter((row) => row.status === 'failed' && row.attempt >= MAX_REQUIRED_COMMAND_ATTEMPTS)
    .map((row) => row.commandId);
  if (maxFailedCommandIds.length > 0 && evidence.status !== 'blocked') {
    errors.push(`${maxFailedCommandIds.join(',')} reached required_command_failed but evidence.status is ${evidence.status}`);
  }
  validateRepairRoundArchive(evidence, errors);
  if (evidence.status === 'blocked') {
    validateBlockedEvidenceStatus(evidence, byId, errors);
    return;
  }

  const requiredBeforeSelf =
    stage === 'final'
      ? FINAL_VALIDATOR_PREREQ_COMMAND_IDS
      : stage === 'final-acceptance'
        ? FINAL_ACCEPTANCE_PREREQ_COMMAND_IDS
      : stage === 'evidence-running'
        ? EVIDENCE_RUNNING_PREREQ_COMMAND_IDS
        : [];
  for (const commandId of requiredBeforeSelf) {
    const row = byId.get(commandId);
    if (!row) {
      errors.push(`evidence missing required command ${commandId}`);
    } else if (row.status !== 'passed') {
      errors.push(`evidence required command ${commandId} is not passed`);
    }
  }
  if (stage === 'evidence-running') {
    const selfAttempts = attemptsById.get(EVIDENCE_RUNNING_SELF_COMMAND_ID) || [];
    if (selfAttempts.length > 0) {
      const latestSelf = byId.get(EVIDENCE_RUNNING_SELF_COMMAND_ID);
      if (latestSelf?.status !== 'failed' || latestSelf.attempt >= MAX_REQUIRED_COMMAND_ATTEMPTS) {
        errors.push(
          `${EVIDENCE_RUNNING_SELF_COMMAND_ID} may only be present before retry when the latest attempt is failed and repairable`
        );
      }
    }
    expectEqual(errors, 'evidence.status before evidence-running validator', evidence.status, 'running');
  }
  if (stage === 'final-acceptance' || stage === 'final') {
    expectEqual(errors, `${stage} evidence status before final validator self-receipt`, evidence.status, 'awaiting_final_validator_self_receipt');
    if (stage === 'final-acceptance' && byId.has(FINAL_ACCEPTANCE_COMMAND_ID)) {
      errors.push(`${FINAL_ACCEPTANCE_COMMAND_ID} must be absent before final acceptance invocation`);
    }
    const finalAcceptance = byId.get(FINAL_ACCEPTANCE_COMMAND_ID);
    if (stage === 'final') {
      if (!finalAcceptance) errors.push(`evidence missing final acceptance command ${FINAL_ACCEPTANCE_COMMAND_ID}`);
      else if (finalAcceptance.status !== 'passed') errors.push(`${FINAL_ACCEPTANCE_COMMAND_ID} must be passed before final validator`);
    }
    if (byId.has(FINAL_VALIDATOR_COMMAND_ID)) {
      errors.push(`${FINAL_VALIDATOR_COMMAND_ID} must be absent before final validator invocation`);
    }
    for (const id of ['ACC013', 'ACC014']) {
      const row = evidence.acceptanceStatus?.[id];
      expectEqual(errors, `evidence ${id} pre-final status`, row?.status, 'self_excluded');
      const pending = JSON.stringify(row?.pendingCommandIds || []);
      expectEqual(errors, `evidence ${id} pre-final pendingCommandIds`, pending, JSON.stringify([FINAL_ACCEPTANCE_COMMAND_ID, FINAL_VALIDATOR_COMMAND_ID]));
    }
    for (const id of ACCEPTANCE_IDS.slice(0, 12)) {
      expectEqual(errors, `final evidence ${id} status`, evidence.acceptanceStatus?.[id]?.status, 'passed');
    }
  }

  for (const [accId, commandIds] of Object.entries(ACC_COMMAND_REQUIREMENTS)) {
    const acc = evidence.acceptanceStatus?.[accId];
    if (!acc) continue;
    if (acc.status === 'passed') {
      for (const commandId of commandIds) {
        expectIncludes(errors, `evidence.acceptanceStatus.${accId}.commandIds`, acc.commandIds, commandId);
        const command = byId.get(commandId);
        if (!command) errors.push(`evidence.acceptanceStatus.${accId} passed but missing command ${commandId}`);
        else if (command.status !== 'passed') errors.push(`evidence.acceptanceStatus.${accId} passed but ${commandId} is ${command.status}`);
      }
    }
  }
  for (const [manualId, commandIds] of Object.entries(MANUAL_COMMAND_REQUIREMENTS)) {
    const manual = evidence.manualVerificationStatus?.[manualId];
    if (!manual) continue;
    if (manual.status === 'passed') {
      for (const commandId of commandIds) {
        expectIncludes(errors, `evidence.manualVerificationStatus.${manualId}.commandIds`, manual.commandIds, commandId);
        const command = byId.get(commandId);
        if (!command) {
          errors.push(`evidence.manualVerificationStatus.${manualId} passed but missing command ${commandId}`);
        } else {
          if (command.status !== 'passed') {
            errors.push(`evidence.manualVerificationStatus.${manualId} passed but ${commandId} is ${command.status}`);
          }
          expectIncludes(errors, `${commandId}.manualScenarioIds`, command.manualScenarioIds, manualId);
        }
      }
    }
  }
}

function validateInstallMatrix(errors) {
  const matrix = readJson(`${WAVE_DIR}/install-matrix.json`, errors);
  if (!matrix) return;
  expectEqual(errors, 'install-matrix.schemaVersion', matrix.schemaVersion, 'main-agent-runtime-migration-wave-3.11-install-matrix/v1');
  expectEqual(errors, 'install-matrix.waveId', matrix.waveId, WAVE_ID);
  expectEqual(errors, 'install-matrix.status', matrix.status, 'passed');
  expectIsoTimestamp(errors, 'install-matrix.startedAt', matrix.startedAt);
  expectIsoTimestamp(errors, 'install-matrix.completedAt', matrix.completedAt);
  expectEqual(errors, 'install-matrix.packageCwd', matrix.packageCwd, 'packages/bmad-speckit');
  expectEqual(errors, 'install-matrix.packageName', matrix.packageName, 'bmad-speckit');
  expectField(errors, 'install-matrix', matrix, 'packageVersion');
  expectField(errors, 'install-matrix', matrix, 'tarballPath');
  expectHash(errors, 'install-matrix.tarballSha256', matrix.tarballSha256);
  expectEqual(errors, 'install-matrix.scoringPackageSourceCwd', matrix.scoringPackageSourceCwd, 'packages/scoring');
  expectEqual(errors, 'install-matrix.scoringPackageName', matrix.scoringPackageName, '@bmad-speckit/scoring');
  expectField(errors, 'install-matrix', matrix, 'scoringWorkspaceVersion');
  expectObject(errors, 'install-matrix.scoringWorkspaceDistHashes', matrix.scoringWorkspaceDistHashes);
  for (const key of ['prepackPrepCommands', 'cleanupCommands', 'modes']) expectArray(errors, `install-matrix.${key}`, matrix[key]);
  for (const row of [...(matrix.prepackPrepCommands || []), ...(matrix.cleanupCommands || [])]) {
    validateCommandRow(row, errors, { requireId: false });
    if (row.status !== 'passed') errors.push(`install-matrix setup/cleanup command failed: ${row.command}`);
  }
  if (!(matrix.cleanupCommands || []).some((row) => String(row.command || '').includes('scripts/cleanup-packed-bmad.js'))) {
    errors.push('install-matrix cleanupCommands missing cleanup-packed-bmad.js command row');
  }
  for (const surface of INSTALL_MATRIX_CLEANUP_SURFACES) {
    if (!(matrix.cleanupCommands || []).some((row) => row.command === `runner-owned cleanup ${surface}`)) {
      errors.push(`install-matrix cleanupCommands missing runner-owned cleanup row for ${surface}`);
    }
  }
  if (!(matrix.cleanupCommands || []).some((row) => row.command === 'runner-owned staging absence check')) {
    errors.push('install-matrix cleanupCommands missing runner-owned staging absence check');
  }
  expectEqual(errors, 'install-matrix.modes length', matrix.modes?.length, REQUIRED_INSTALL_MODES.length);
  for (const mode of REQUIRED_INSTALL_MODES) {
    const modeRow = (matrix.modes || []).find((candidate) => candidate.mode === mode);
    if (!modeRow) {
      errors.push(`install-matrix missing mode ${mode}`);
      continue;
    }
    expectEqual(errors, `install-matrix ${mode} status`, modeRow.status, 'passed');
    expectArray(errors, `install-matrix ${mode}.commands`, modeRow.commands);
    expectArray(errors, `install-matrix ${mode}.rows`, modeRow.rows);
    for (const command of modeRow.commands || []) {
      validateCommandRow(command, errors, { requireId: false });
      if (command.status !== 'passed') errors.push(`install-matrix ${mode} command failed: ${command.command}`);
    }
    for (const field of ['consumerRoot', 'probeRoot', 'requireProbeRoot', 'packageRoot', 'receiptPath']) {
      expectField(errors, `install-matrix ${mode}`, modeRow, field);
    }
    let modeReceipt = null;
    if (!modeRow.receiptPath || !modeRow.receiptPath.startsWith(`${INSTALL_MATRIX_DIR}/`)) {
      errors.push(`install-matrix ${mode} receiptPath must be under ${INSTALL_MATRIX_DIR}`);
    } else if (!exists(modeRow.receiptPath)) {
      errors.push(`install-matrix ${mode} receipt missing: ${modeRow.receiptPath}`);
    } else {
      modeReceipt = readJson(modeRow.receiptPath, errors);
      expectEqual(errors, `install-matrix ${mode} receipt.waveId`, modeReceipt?.waveId, WAVE_ID);
      expectEqual(errors, `install-matrix ${mode} receipt.mode`, modeReceipt?.mode, mode);
      expectEqual(errors, `install-matrix ${mode} receipt.status`, modeReceipt?.status, 'passed');
      for (const field of ['consumerRoot', 'probeRoot', 'requireProbeRoot', 'packageRoot']) {
        expectEqual(errors, `install-matrix ${mode} receipt.${field}`, modeReceipt?.[field], modeRow[field]);
      }
      expectArray(errors, `install-matrix ${mode} receipt.rowIds`, modeReceipt?.rowIds);
      expectArray(errors, `install-matrix ${mode} receipt.commandRows`, modeReceipt?.commandRows);
      expectArray(errors, `install-matrix ${mode} receipt.rows`, modeReceipt?.rows);
      expectArray(errors, `install-matrix ${mode} receipt.assertions`, modeReceipt?.assertions);
    }
    if (mode === 'npx-package') {
      expectEqual(errors, 'install-matrix npx-package clean consumerRoot equals probeRoot', modeRow.probeRoot, modeRow.consumerRoot);
      expectPathEndsWith(errors, 'install-matrix npx-package consumerRoot', modeRow.consumerRoot, '/npx-consumer');
      expectPathEndsWith(errors, 'install-matrix npx-package requireProbeRoot', modeRow.requireProbeRoot, '/direct-require-consumer');
      expectPathEndsWith(
        errors,
        'install-matrix npx-package packageRoot',
        modeRow.packageRoot,
        '/direct-require-consumer/node_modules/bmad-speckit'
      );
      if (modeRow.requireProbeRoot === modeRow.consumerRoot) {
        errors.push('install-matrix npx-package requireProbeRoot must differ from clean consumerRoot');
      }
      if ((modeRow.commands || []).some((command) => command.cwd === modeRow.consumerRoot && command.command.includes('npm install'))) {
        errors.push('install-matrix npx-package clean consumerRoot must not preinstall bmad-speckit');
      }
      if (
        !(modeRow.commands || []).some(
          (command) =>
            command.cwd === modeRow.requireProbeRoot &&
            command.command.includes('npm install') &&
            command.command.includes('--no-save')
        )
      ) {
        errors.push('install-matrix npx-package must install tarball only in direct-require consumer');
      }
    } else if (mode === 'init-sync-consumer') {
      expectPathEndsWith(errors, 'install-matrix init-sync-consumer consumerRoot', modeRow.consumerRoot, '/parent');
      expectPathEndsWith(errors, 'install-matrix init-sync-consumer probeRoot', modeRow.probeRoot, '/parent/wave-3-11-sync');
      expectEqual(errors, 'install-matrix init-sync-consumer requireProbeRoot', modeRow.requireProbeRoot, modeRow.probeRoot);
      expectPathEndsWith(errors, 'install-matrix init-sync-consumer packageRoot', modeRow.packageRoot, '/parent/node_modules/bmad-speckit');
      if (modeRow.packageRoot === `${modeRow.probeRoot}/node_modules/bmad-speckit`) {
        errors.push('install-matrix init-sync-consumer packageRoot must resolve from parent install, not synced project node_modules');
      }
      if (
        !(modeRow.commands || []).some(
          (command) =>
            command.cwd === modeRow.consumerRoot &&
            command.command.includes(' init wave-3-11-sync ') &&
            command.command.includes('--bmad-path')
        )
      ) {
        errors.push('install-matrix init-sync-consumer missing installed init command from parent consumer');
      }
      if (
        !(modeRow.commands || []).some(
          (command) =>
            command.cwd === modeRow.probeRoot &&
            command.command.includes(' check --json --ignore-agent-tools')
        )
      ) {
        errors.push('install-matrix init-sync-consumer missing synced project check command');
      }
    } else {
      expectEqual(errors, `install-matrix ${mode} probeRoot`, modeRow.probeRoot, modeRow.consumerRoot);
      expectEqual(errors, `install-matrix ${mode} requireProbeRoot`, modeRow.requireProbeRoot, modeRow.consumerRoot);
      expectPathEndsWith(errors, `install-matrix ${mode} packageRoot`, modeRow.packageRoot, '/consumer/node_modules/bmad-speckit');
    }
    expectEqual(errors, `install-matrix ${mode}.rows length`, modeRow.rows?.length, REQUIRED_INSTALL_ROW_IDS.length);
    for (const rowId of REQUIRED_INSTALL_ROW_IDS) {
      const row = (modeRow.rows || []).find((candidate) => candidate.rowId === rowId);
      if (!row) {
        errors.push(`install-matrix ${mode} missing ${rowId}`);
        continue;
      }
      for (const field of [
        'mode',
        'rowId',
        'status',
        'command',
        'cwd',
        'exitCode',
        'receiptPath',
        'usedRootScript',
        'usedTsx',
        'usedTsNode',
        'usedCompiledFallback',
        'assertions',
      ]) {
        expectField(errors, `install-matrix ${mode} ${rowId}`, row, field);
      }
      expectEqual(errors, `install-matrix ${mode} ${rowId} mode`, row.mode, mode);
      expectEqual(errors, `install-matrix ${mode} ${rowId} usedRootScript`, row.usedRootScript, false);
      expectEqual(errors, `install-matrix ${mode} ${rowId} usedTsx`, row.usedTsx, false);
      expectEqual(errors, `install-matrix ${mode} ${rowId} usedTsNode`, row.usedTsNode, false);
      expectEqual(errors, `install-matrix ${mode} ${rowId} usedCompiledFallback`, row.usedCompiledFallback, false);
      expectEqual(errors, `install-matrix ${mode} ${rowId} status`, row.status, 'passed');
      expectEqual(errors, `install-matrix ${mode} ${rowId} exitCode`, row.exitCode, 0);
      expectArray(errors, `install-matrix ${mode} ${rowId}.assertions`, row.assertions);
      if (row.assertions?.length === 0) errors.push(`install-matrix ${mode} ${rowId} assertions must not be empty`);
      expectEqual(errors, `install-matrix ${mode} ${rowId} receiptPath`, row.receiptPath, modeRow.receiptPath);
      if (!row.receiptPath || !row.receiptPath.startsWith(`${INSTALL_MATRIX_DIR}/`)) {
        errors.push(`install-matrix ${mode} ${rowId} receiptPath must be under ${INSTALL_MATRIX_DIR}`);
      } else if (!exists(row.receiptPath)) {
        errors.push(`install-matrix ${mode} ${rowId} receipt missing: ${row.receiptPath}`);
      } else {
        const receipt = readJson(row.receiptPath, errors);
        expectEqual(errors, `install-matrix ${mode} ${rowId} receipt.waveId`, receipt?.waveId, WAVE_ID);
        expectEqual(errors, `install-matrix ${mode} ${rowId} receipt.mode`, receipt?.mode, mode);
        expectEqual(errors, `install-matrix ${mode} ${rowId} receipt.status`, receipt?.status, 'passed');
        expectIncludes(errors, `install-matrix ${mode} ${rowId} receipt.rowIds`, receipt?.rowIds, rowId);
        expectArray(errors, `install-matrix ${mode} ${rowId} receipt.commandRows`, receipt?.commandRows);
        const receiptRow = (receipt?.rows || []).find((candidate) => candidate.rowId === rowId);
        if (!receiptRow) {
          errors.push(`install-matrix ${mode} ${rowId} receipt missing row copy`);
        } else {
          expectEqual(errors, `install-matrix ${mode} ${rowId} receipt row command`, receiptRow.command, row.command);
          expectEqual(errors, `install-matrix ${mode} ${rowId} receipt row cwd`, receiptRow.cwd, row.cwd);
          expectEqual(errors, `install-matrix ${mode} ${rowId} receipt row status`, receiptRow.status, row.status);
        }
      }
      if (mode === 'npx-package') {
        if (rowId === 'IM001' || rowId === 'IM002') {
          expectEqual(errors, `install-matrix npx-package ${rowId} direct require cwd`, row.cwd, modeRow.requireProbeRoot);
          if (String(row.command || '').includes('npm exec')) {
            errors.push(`install-matrix npx-package ${rowId} direct require row must not use npm exec`);
          }
        } else {
          expectEqual(errors, `install-matrix npx-package ${rowId} CLI cwd`, row.cwd, modeRow.consumerRoot);
          expectCommandFragments(errors, `install-matrix npx-package ${rowId}`, row.command, [
            'npm exec',
            '--package',
            '--',
            'bmad-speckit',
            rowId === 'IM003' ? 'eval-question-generate' : 'check-score',
          ]);
          if (String(row.command || '').includes('bin/bmad-speckit.js')) {
            errors.push(`install-matrix npx-package ${rowId} CLI row must not invoke installed bin path directly`);
          }
        }
      } else if (mode === 'init-sync-consumer') {
        expectEqual(errors, `install-matrix init-sync-consumer ${rowId} cwd`, row.cwd, modeRow.probeRoot);
      } else {
        expectEqual(errors, `install-matrix ${mode} ${rowId} cwd`, row.cwd, modeRow.consumerRoot);
      }
      if (rowId === 'IM003') {
        expectEqual(errors, `install-matrix ${mode} IM003 currentWorkspaceScoringHashMatched`, row.currentWorkspaceScoringHashMatched, true);
        expectObject(errors, `install-matrix ${mode} IM003 installedScoringDistHashes`, row.installedScoringDistHashes);
        if (
          JSON.stringify(row.installedScoringDistHashes || {}) !==
          JSON.stringify(matrix.scoringWorkspaceDistHashes || {})
        ) {
          errors.push(`install-matrix ${mode} IM003 installed scoring hashes do not match workspace hashes`);
        }
        if (!row.installedScoringResolvedPath || row.installedScoringResolvedPath.startsWith('packages/scoring')) {
          errors.push(`install-matrix ${mode} IM003 installed scoring path must not resolve to repo source`);
        }
      }
    }
  }
  for (const leftover of INSTALL_MATRIX_CLEANUP_SURFACES) {
    if (exists(leftover)) errors.push(`install matrix cleanup leftover exists: ${leftover}`);
  }
}

function validateSafeWriteReceipts(errors, { required = false, requiredTargets = [] } = {}) {
  const receipts = readJson(SAFE_WRITE_PATH, errors, { required });
  if (!receipts) return;
  expectEqual(errors, 'safe-write-receipts.waveId', receipts.waveId, WAVE_ID);
  expectIsoTimestamp(errors, 'safe-write-receipts.generatedAt', receipts.generatedAt);
  validateSelfVerification(receipts, errors);
  expectArray(errors, 'safe-write-receipts.receipts', receipts.receipts);
  for (const receipt of receipts.receipts || []) {
    for (const field of ['targetPath', 'sha256', 'status', ...SAFE_WRITE_DETAIL_FIELDS]) {
      expectField(errors, `safe-write receipt ${receipt.targetPath || '<unknown>'}`, receipt, field);
    }
    if (!['passed', 'failed', 'blocked'].includes(receipt.status)) {
      errors.push(`${receipt.targetPath} invalid safe-write status ${receipt.status}`);
    }
    expectEqual(errors, `${receipt.targetPath} artifactPath`, receipt.artifactPath, receipt.targetPath);
    expectEqual(errors, `${receipt.targetPath} hashKind`, receipt.hashKind, 'promoted_file_bytes');
    expectEqual(errors, `${receipt.targetPath} sha256`, receipt.sha256, receipt.postWriteSha256);
    expectEqual(errors, `${receipt.targetPath} promotedSha256`, receipt.promotedSha256, receipt.draftSha256);
    expectHash(errors, `${receipt.targetPath} sha256`, receipt.sha256);
    expectHash(errors, `${receipt.targetPath} draftSha256`, receipt.draftSha256);
    expectHash(errors, `${receipt.targetPath} promotedSha256`, receipt.promotedSha256);
    expectHash(errors, `${receipt.targetPath} postWriteSha256`, receipt.postWriteSha256);
    expectArray(errors, `${receipt.targetPath}.requiredChecks`, receipt.requiredChecks);
    if (String(receipt.targetPath || '').endsWith('.json') && !receiptHasPassedCheck(receipt, 'jsonParse')) {
      errors.push(`${receipt.targetPath}.requiredChecks missing passed jsonParse`);
    }
    const actualCheckKeys = receiptCheckKeys(receipt);
    for (const key of expectedSafeWriteTopLevelKeys(receipt.targetPath)) {
      expectIncludes(errors, `${receipt.targetPath}.requiredChecks topLevelKey`, actualCheckKeys, key);
    }
    expectIsoTimestamp(errors, `${receipt.targetPath}.startedAt`, receipt.startedAt);
    expectIsoTimestamp(errors, `${receipt.targetPath}.completedAt`, receipt.completedAt);
    if (!Number.isInteger(receipt.byteLength) || receipt.byteLength <= 0) {
      errors.push(`${receipt.targetPath} byteLength must be a positive integer`);
    }
  }
  const latest = latestReceiptsByTarget((receipts.receipts || []).filter((receipt) => receipt.status === 'passed'));
  for (const [targetPath, receipt] of latest.entries()) {
    if (targetPath === SAFE_WRITE_PATH) continue;
    if (!exists(targetPath)) {
      errors.push(`safe-write latest target missing: ${targetPath}`);
    } else if (shouldVerifyCurrentSafeWriteHash(targetPath) && sha256File(targetPath) !== receipt.sha256) {
      errors.push(`safe-write latest target hash mismatch: ${targetPath}`);
    }
  }
  const dynamicTargets = new Set(requiredTargets);
  const evidence = readJson(`${WAVE_DIR}/evidence.json`, errors, { required: false });
  if (evidence?.previousEvidenceArchivePath) {
    dynamicTargets.add(normalizeEvidencePath(evidence.previousEvidenceArchivePath));
  }
  const matrix = readJson(`${WAVE_DIR}/install-matrix.json`, errors, { required: false });
  for (const mode of matrix?.modes || []) {
    for (const row of mode.rows || []) {
      if (row.receiptPath) dynamicTargets.add(row.receiptPath);
    }
  }
  for (const targetPath of dynamicTargets) {
    if (targetPath === SAFE_WRITE_PATH) {
      if (!exists(SAFE_WRITE_PATH)) errors.push(`safe-write required target missing: ${SAFE_WRITE_PATH}`);
      continue;
    }
    const receipt = latest.get(targetPath);
    if (!receipt) {
      errors.push(`safe-write required target has no passed receipt: ${targetPath}`);
      continue;
    }
    if (!exists(targetPath)) errors.push(`safe-write required target missing: ${targetPath}`);
    else if (shouldVerifyCurrentSafeWriteHash(targetPath) && sha256File(targetPath) !== receipt.sha256) {
      errors.push(`safe-write required target hash mismatch: ${targetPath}`);
    }
  }
}

function validateFinalPacketReceiptHistory(errors) {
  const receipts = readJson(SAFE_WRITE_PATH, errors);
  if (!receipts) return;
  const finalPacketReceipts = (receipts.receipts || []).filter(
    (receipt) => receipt.targetPath === `${WAVE_DIR}/final-evidence-packet.json` && receipt.status === 'passed'
  );
  const unsealedIndex = finalPacketReceipts.findIndex((receipt) => receipt.operation === 'final_evidence_packet_unsealed');
  const sealIndex = finalPacketReceipts.findIndex((receipt) => receipt.operation === 'final_evidence_packet_seal');
  if (unsealedIndex === -1) {
    errors.push('final-evidence-packet.json missing passed final_evidence_packet_unsealed safe-write receipt');
  }
  if (sealIndex === -1) {
    errors.push('final-evidence-packet.json missing passed final_evidence_packet_seal safe-write receipt');
  }
  if (unsealedIndex !== -1 && sealIndex !== -1 && unsealedIndex >= sealIndex) {
    errors.push('final_evidence_packet_unsealed receipt must appear before final_evidence_packet_seal receipt');
  }
}

function validateSummary(errors) {
  const text = readText(`${WAVE_DIR}/summary.md`, errors);
  if (!text) return;
  for (const required of [
    'Wave 3.11 covers only the thirteen declared entries',
    'No root script deletion was performed',
    'does not prove every source repository script is directly callable in a consumer project',
  ]) {
    if (!text.includes(required)) errors.push(`summary missing required narrow language: ${required}`);
  }
  const forbidden = [
    /all source repository scripts are directly callable in consumer projects/iu,
    /所有 scripts.*消费.*直接运行/iu,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(text)) errors.push(`summary contains overclaim pattern ${pattern}`);
  }
}

function validateFinalPacket(errors) {
  const packet = readJson(`${WAVE_DIR}/final-evidence-packet.json`, errors);
  if (!packet) return;
  for (const field of [
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
  ]) {
    expectField(errors, 'final packet', packet, field);
  }
  expectEqual(errors, 'final packet waveId', packet.waveId, WAVE_ID);
  expectEqual(errors, 'final packet sealed', packet.sealed, true);
  expectEqual(errors, 'final packet status', packet.status, 'sealed_snapshot');
  expectIsoTimestamp(errors, 'final packet generatedAt', packet.generatedAt);
  expectIsoTimestamp(errors, 'final packet sealedAt', packet.sealedAt);
  expectHash(errors, 'final packet sealHash', packet.sealHash);
  expectHash(errors, 'final packet sealedEvidenceJsonHash', packet.sealedEvidenceJsonHash);
  expectHash(errors, 'final packet installMatrixHash', packet.installMatrixHash);
  expectHash(errors, 'final packet summaryHash', packet.summaryHash);
  if (exists(`${WAVE_DIR}/install-matrix.json`)) {
    expectEqual(errors, 'final packet installMatrixHash', packet.installMatrixHash, sha256File(`${WAVE_DIR}/install-matrix.json`));
  }
  if (exists(`${WAVE_DIR}/summary.md`)) {
    expectEqual(errors, 'final packet summaryHash', packet.summaryHash, sha256File(`${WAVE_DIR}/summary.md`));
  }
  const safeWriteReceipts = readJson(SAFE_WRITE_PATH, errors, { required: false });
  const sealedEvidenceReceipt = (safeWriteReceipts?.receipts || []).find(
    (receipt) =>
      receipt.targetPath === `${WAVE_DIR}/evidence.json` &&
      receipt.status === 'passed' &&
      receipt.sha256 === packet.sealedEvidenceJsonHash
  );
  if (!sealedEvidenceReceipt) {
    errors.push('final packet sealedEvidenceJsonHash must match a passed safe-write receipt for evidence.json');
  } else if (
    packet.sealedAt &&
    sealedEvidenceReceipt.completedAt &&
    Date.parse(sealedEvidenceReceipt.completedAt) > Date.parse(packet.sealedAt)
  ) {
    errors.push('final packet sealedEvidenceJsonHash receipt must be completed before or at sealedAt');
  }
  expectEqual(errors, 'final packet finalEncodingCommandId', packet.finalEncodingCommandId, 'cmd-encoding-final');
  expectEqual(errors, 'final packet expectedFinalAcceptanceCommandId', packet.expectedFinalAcceptanceCommandId, FINAL_ACCEPTANCE_COMMAND_ID);
  expectEqual(errors, 'final packet expectedFinalValidatorCommandId', packet.expectedFinalValidatorCommandId, FINAL_VALIDATOR_COMMAND_ID);
  expectArray(errors, 'final packet residualRisks', packet.residualRisks);
  validateAcceptanceStatus(packet.acceptanceStatus, errors, 'finalPacket.acceptanceStatus');
  validateManualStatus(packet.manualVerificationStatus, errors, 'finalPacket.manualVerificationStatus');
  if (packet.sealHash && packet.sealHash !== hashCanonical(packet, true)) {
    errors.push('final packet sealHash does not match canonical D010 hash');
  }
  for (const id of ACCEPTANCE_IDS.slice(0, 12)) {
    expectEqual(errors, `final packet ${id} status`, packet.acceptanceStatus?.[id]?.status, 'passed');
  }
  for (const id of ['ACC013', 'ACC014']) {
    const row = packet.acceptanceStatus?.[id];
    expectEqual(errors, `final packet ${id} status`, row?.status, 'self_excluded');
    const pending = JSON.stringify(row?.pendingCommandIds || []);
    expectEqual(
      errors,
      `final packet ${id} pendingCommandIds`,
      pending,
      JSON.stringify(['cmd-test-wave-3-11-contract-final', 'cmd-validate-wave-3-11-final'])
    );
  }
  expectEqual(errors, 'final packet ACC014 reason', packet.acceptanceStatus?.ACC014?.reason, 'sealed_packet_cannot_validate_future_final_commands');
  const evidence = readJson(`${WAVE_DIR}/evidence.json`, errors, { required: false });
  if (evidence?.acceptanceStatus) {
    for (const id of ACCEPTANCE_IDS) {
      const packetAcc = packet.acceptanceStatus?.[id];
      const evidenceAcc = evidence.acceptanceStatus?.[id];
      if (!evidenceAcc) {
        errors.push(`final packet ${id} missing mirrored evidence acceptance row`);
        continue;
      }
      expectEqual(errors, `final packet ${id} mirrored status`, packetAcc?.status, evidenceAcc.status);
      expectEqual(
        errors,
        `final packet ${id} mirrored commandIds`,
        JSON.stringify(packetAcc?.commandIds || []),
        JSON.stringify(evidenceAcc.commandIds || [])
      );
      expectEqual(
        errors,
        `final packet ${id} mirrored evidenceRefs`,
        JSON.stringify(packetAcc?.evidenceRefs || []),
        JSON.stringify(evidenceAcc.evidenceRefs || [])
      );
      expectEqual(errors, `final packet ${id} mirrored notes`, packetAcc?.notes, evidenceAcc.notes);
      if (packetAcc?.status === 'self_excluded' || evidenceAcc.status === 'self_excluded') {
        expectEqual(
          errors,
          `final packet ${id} mirrored pendingCommandIds`,
          JSON.stringify(packetAcc?.pendingCommandIds || []),
          JSON.stringify(evidenceAcc.pendingCommandIds || [])
        );
        expectEqual(errors, `final packet ${id} mirrored reason`, packetAcc?.reason, evidenceAcc.reason);
      }
    }
  }
  const evidenceCommandRows = Array.isArray(evidence?.commandRows) ? evidence.commandRows : [];
  const evidenceRowsById = new Map(evidenceCommandRows.map((row) => [row.commandId, row]));
  for (const id of MANUAL_IDS) {
    const packetManual = packet.manualVerificationStatus?.[id];
    const evidenceManual = evidence?.manualVerificationStatus?.[id];
    expectEqual(errors, `final packet ${id} status`, packetManual?.status, 'passed');
    if (!evidenceManual) {
      errors.push(`final packet ${id} missing mirrored evidence manual verification row`);
      continue;
    }
    expectEqual(errors, `final packet ${id} mirrored status`, packetManual?.status, evidenceManual.status);
    expectEqual(
      errors,
      `final packet ${id} mirrored commandIds`,
      JSON.stringify(packetManual?.commandIds || []),
      JSON.stringify(evidenceManual.commandIds || [])
    );
    expectEqual(
      errors,
      `final packet ${id} mirrored evidenceRefs`,
      JSON.stringify(packetManual?.evidenceRefs || []),
      JSON.stringify(evidenceManual.evidenceRefs || [])
    );
    expectEqual(errors, `final packet ${id} mirrored notes`, packetManual?.notes, evidenceManual.notes);
    for (const commandId of MANUAL_COMMAND_REQUIREMENTS[id] || []) {
      expectIncludes(errors, `final packet ${id}.commandIds`, packetManual?.commandIds, commandId);
      const command = evidenceRowsById.get(commandId);
      if (!command) {
        errors.push(`final packet ${id} references missing evidence command ${commandId}`);
      } else {
        expectEqual(errors, `final packet ${id} evidence command status`, command.status, 'passed');
        expectIncludes(errors, `${commandId}.manualScenarioIds`, command.manualScenarioIds, id);
      }
    }
  }
}

function validateRequiredCommandCoverage(errors) {
  const validatorText = readText('tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs', errors);
  const runnerText = readText('tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs', errors);
  const testText = readText('tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts', errors);
  const combined = `${validatorText}\n${runnerText}\n${testText}`;
  for (const commandId of REQUIRED_COMMAND_IDS) {
    if (!combined.includes(commandId)) errors.push(`Required Test Command coverage missing ${commandId}`);
  }
  if (!testText.includes("'final-closeout': ['--final-acceptance']") || !testText.includes('expect(Object.keys(modes)).toContain(mode)')) {
    errors.push('final-closeout acceptance test mode must invoke --final-acceptance, not the default full validator');
  }
}

function validateEvalQuestionSourceSmoke(errors) {
  const outDir = repoPath(path.join(WAVE_DIR, 'tmp', `eval-questions-${crypto.randomUUID()}`));
  const fixture = repoPath(`${WAVE_DIR}/fixtures/coach-report.json`);
  fs.mkdirSync(outDir, { recursive: true });
  const result = run(process.execPath, [
    'packages/bmad-speckit/bin/bmad-speckit.js',
    'eval-question-generate',
    '--input',
    fixture,
    '--outputDir',
    outDir,
    '--version',
    'v1',
  ]);
  if (result.status !== 0) {
    errors.push(`eval-question source smoke failed: ${result.stderr || result.stdout}`);
    return;
  }
  const { loadManifest } = require(repoPath('packages/scoring/dist/eval-questions/manifest-loader.js'));
  const manifest = loadManifest(outDir);
  if (manifest.questions.length === 0) errors.push('eval-question source smoke generated no questions');
  for (const question of manifest.questions) {
    for (const field of ['id', 'title', 'path']) {
      if (!question[field]) errors.push(`eval-question source smoke question missing ${field}`);
    }
    if (!fs.existsSync(path.join(outDir, question.path))) {
      errors.push(`eval-question source smoke question file missing ${question.path}`);
    }
  }
  const normalized = rel(outDir);
  if (!normalized.startsWith(`${WAVE_DIR}/tmp/eval-questions-`)) {
    errors.push(`eval-question source smoke output escaped tmp dir: ${normalized}`);
  }
}

function validatePreEvidence(errors) {
  validateSourceInventory(errors);
  validatePreflight(errors);
  validateExports(errors);
  validateNoForbiddenRuntimeRefs(errors);
  validateClosureAuditWriterSafeWrite(errors);
  validateEvidenceWriterSafeWrite(errors);
  validateRegistryWave(errors);
  validateRegistryEvidence(errors, { required: true });
  validateClassificationEvidence(errors, { required: true });
  validateNoMigrationInternalArtifact(errors, { required: true });
  validateSafeWriteReceipts(errors, { required: true, requiredTargets: PRE_EVIDENCE_SAFE_WRITE_TARGETS });
  validateRequiredCommandCoverage(errors);
}

function validateEvidenceRunning(errors) {
  validatePreEvidence(errors);
  validateEvidenceJson(errors, { stage: 'evidence-running' });
  validateInstallMatrix(errors);
  validateSafeWriteReceipts(errors, { required: true, requiredTargets: EVIDENCE_RUNNING_SAFE_WRITE_TARGETS });
}

function validateFinalAcceptance(errors) {
  validatePreEvidence(errors);
  validateInstallMatrix(errors);
  validateSummary(errors);
  validateFinalPacket(errors);
  validateEvidenceJson(errors, { stage: 'final-acceptance' });
  validateSafeWriteReceipts(errors, { required: true, requiredTargets: FINAL_SAFE_WRITE_TARGETS });
  validateFinalPacketReceiptHistory(errors);
}

function validateFull(errors) {
  validatePreEvidence(errors);
  validateInstallMatrix(errors);
  validateSummary(errors);
  validateFinalPacket(errors);
  validateEvidenceJson(errors, { stage: 'final' });
  validateSafeWriteReceipts(errors, { required: true, requiredTargets: FINAL_SAFE_WRITE_TARGETS });
  validateFinalPacketReceiptHistory(errors);
}

function runAssertion(assertion, errors) {
  switch (assertion) {
    case 'no-migration-internal-exact':
      validateNoMigrationInternalExact(errors);
      break;
    case 'root-scripts-not-deleted':
      validateRootScriptsNotDeleted(errors);
      break;
    case 'public-cli-dispatch':
      validatePublicCliDispatch(errors);
      break;
    case 'closure-audit-exact-wave-3-11':
      validateClosureAuditExact(errors);
      break;
    case 'eval-question-source-smoke':
      validateEvalQuestionSourceSmoke(errors);
      break;
    case 'final-closeout-language':
      validateSummary(errors);
      break;
    default:
      errors.push(`unknown assertion: ${assertion}`);
  }
}

function main() {
  const errors = [];
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
    if (args.mode === 'assert') runAssertion(args.assert, errors);
    else if (args.mode === 'pre-evidence') validatePreEvidence(errors);
    else if (args.mode === 'evidence-running') validateEvidenceRunning(errors);
    else if (args.mode === 'final-acceptance') validateFinalAcceptance(errors);
    else validateFull(errors);
  } catch (error) {
    errors.push(error.stack || error.message);
  }
  const output = {
    status: errors.length === 0 ? 'passed' : 'failed',
    mode: args?.mode || 'unknown',
    assertion: args?.assert || null,
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    entries: EXPECTED_ENTRIES.length,
    errors,
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = errors.length === 0 ? 0 : 1;
}

main();
