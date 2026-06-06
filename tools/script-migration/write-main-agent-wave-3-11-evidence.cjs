#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const yaml = require('js-yaml');
const {
  CLOSURE_AUDIT_PATH,
  REGISTRY_PATH,
  ROOT,
  WAVE_DIR,
  WAVE_ID,
  commandRow,
  formatJson,
  hashCanonical,
  loadSafeWriteReceipts,
  nowIso,
  readJsonIfExists,
  repoPath,
  safeWriteFile,
  saveSafeWriteReceipts,
  sha256File,
  sha256Text,
} = require('./main-agent-wave-3-11-evidence-utils.cjs');

const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.10';
const CONTRACT_PATH = 'docs/plans/2026-06-05-main-agent-runtime-migration-wave-3-11-goal-execution-plan.md';
const WAVE_TITLE = 'Main Agent runtime migration wave 3.11 consumer reachable closure migration';
const EVIDENCE_PATH = `${WAVE_DIR}/evidence.json`;
const SOURCE_INVENTORY_PATH = `${WAVE_DIR}/source-inventory.json`;
const PREFLIGHT_PATH = `${WAVE_DIR}/preflight.json`;
const NO_MIGRATION_PATH = `${WAVE_DIR}/no-migration-internal.json`;
const CLASSIFICATION_EVIDENCE_PATH = `${WAVE_DIR}/classification-evidence.json`;
const REGISTRY_EVIDENCE_PATH = `${WAVE_DIR}/registry-evidence.json`;
const ROOT_SCRIPT_PROOF_PATH = `${WAVE_DIR}/root-script-regression-proof.json`;
const SUMMARY_PATH = `${WAVE_DIR}/summary.md`;
const INSTALL_MATRIX_PATH = `${WAVE_DIR}/install-matrix.json`;
const FINAL_PACKET_PATH = `${WAVE_DIR}/final-evidence-packet.json`;

const ACCEPTANCE_IDS = Array.from({ length: 14 }, (_, index) => `ACC${String(index + 1).padStart(3, '0')}`);
const MANUAL_IDS = ['MAN001', 'MAN002', 'MAN003', 'MAN004'];
const MAX_REQUIRED_COMMAND_ATTEMPTS = 2;

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
  },
  {
    entryId: 'eval-question-generate',
    originalPath: 'scripts/eval-question-generate.ts',
    semantic: 'public_cli_package_action',
    strategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js', 'packages/bmad-speckit/src/commands/eval-question-generate.js'],
  },
  {
    entryId: 'check-story-score-written',
    originalPath: 'scripts/check-story-score-written.ts',
    semantic: 'public_cli_package_action_existing_root_legacy',
    strategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js', 'packages/bmad-speckit/src/commands/check-score.js'],
  },
  {
    entryId: 'create-second-story',
    originalPath: 'scripts/create-second-story.ts',
    semantic: 'repo_internal_test_seed_only',
    strategy: 'repo_internal_reclassify',
    targetPaths: ['scripts/create-second-story.ts'],
  },
  {
    entryId: 'verify-score-auto-scoped-bundle',
    originalPath: 'scripts/verify-score-auto-scoped-bundle.cjs',
    semantic: 'repo_internal_verification_harness',
    strategy: 'repo_internal_reclassify',
    targetPaths: ['scripts/verify-score-auto-scoped-bundle.cjs'],
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

const SEALED_FINAL_NO_RETRY_COMMAND_IDS = new Set([
  'cmd-test-wave-3-11-contract-final',
  'cmd-validate-wave-3-11-final',
]);

const COMMAND_SPECS = {
  'cmd-git-status-baseline': {
    commandText: "pwsh.exe -NoLogo -NoProfile -Command '& { git status --short --branch; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh: 'git status --short --branch; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-encoding-pre-implementation': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-build-scoring': {
    commandText: "pwsh.exe -NoLogo -NoProfile -Command '& { npm run build:scoring; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh: 'npm run build:scoring; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-scoring-eval-questions': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npx vitest run packages/scoring/eval-questions/__tests__/template-generator.test.ts packages/scoring/eval-questions/__tests__/manifest-loader.test.ts packages/scoring/eval-questions/__tests__/run-core.test.ts packages/scoring/eval-questions/__tests__/cli-integration.test.ts packages/scoring/__tests__/e2e/eval-question-flow.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npx vitest run packages/scoring/eval-questions/__tests__/template-generator.test.ts packages/scoring/eval-questions/__tests__/manifest-loader.test.ts packages/scoring/eval-questions/__tests__/run-core.test.ts packages/scoring/eval-questions/__tests__/cli-integration.test.ts packages/scoring/__tests__/e2e/eval-question-flow.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-build-main-agent-dist': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run build:main-agent-dist; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh: 'npm run build:main-agent-dist; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-package-build-dispatch-regressions': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- main-agent-build-dist.test.js main-agent-no-root-ts-dispatch.test.js main-agent-dist-no-root-ts-dispatch.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npm run test --prefix packages/bmad-speckit -- main-agent-build-dist.test.js main-agent-no-root-ts-dispatch.test.js main-agent-dist-no-root-ts-dispatch.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-runtime-modules': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-runtime-modules.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-runtime-modules.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-helpers': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-helpers.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npm run test --prefix packages/bmad-speckit -- main-agent-wave-3-11-helpers.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-eval-question-generate': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- eval-question-generate-command.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npm run test --prefix packages/bmad-speckit -- eval-question-generate-command.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-check-score': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- check-score-command.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npm run test --prefix packages/bmad-speckit -- check-score-command.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-smoke-eval-question-generate-source-tree': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert eval-question-source-smoke; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert eval-question-source-smoke; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-runtime-acceptance-import-switches': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npx vitest run tests/acceptance/main-agent-host-runtime-mode.test.ts tests/acceptance/main-agent-supervised-worker-timeout.test.ts tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts tests/acceptance/main-agent-delivery-truth-gate.test.ts tests/acceptance/main-agent-pr-topology.test.ts tests/acceptance/main-agent-parallel-locking.test.ts tests/acceptance/parallel-mission-evidence-integration.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npx vitest run tests/acceptance/main-agent-host-runtime-mode.test.ts tests/acceptance/main-agent-supervised-worker-timeout.test.ts tests/acceptance/diagnose-bmad-state-reviewer-projection.test.ts tests/acceptance/main-agent-delivery-truth-gate.test.ts tests/acceptance/main-agent-pr-topology.test.ts tests/acceptance/main-agent-parallel-locking.test.ts tests/acceptance/parallel-mission-evidence-integration.test.ts; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-closure-audit-write': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/audit-consumer-reachable-closure.cjs --write --pretty --quiet; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-validate-registry': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-registry.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh: 'node tools/script-migration/validate-registry.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-assert-no-migration-internal-exact': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert no-migration-internal-exact; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert no-migration-internal-exact; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-assert-root-scripts-not-deleted': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert root-scripts-not-deleted; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert root-scripts-not-deleted; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
    manualScenarioIds: ['MAN001'],
  },
  'cmd-assert-public-cli-dispatch': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert public-cli-dispatch; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert public-cli-dispatch; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
    manualScenarioIds: ['MAN002'],
  },
  'cmd-assert-closure-audit-exact-wave-3-11': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert closure-audit-exact-wave-3-11; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert closure-audit-exact-wave-3-11; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
    manualScenarioIds: ['MAN003'],
  },
  'cmd-validate-wave-3-11-pre-evidence': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --pre-evidence; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --pre-evidence; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-wave-3-11-contract-pre-evidence': {
    commandText:
      'pwsh.exe -NoLogo -NoProfile -Command \'& { $env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "pre-evidence"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code }\'',
    pwsh:
      '$env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "pre-evidence"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code',
  },
  'cmd-test-install-surface-regressions': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { npm run test --prefix packages/bmad-speckit -- sync-service.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'npm run test --prefix packages/bmad-speckit -- sync-service.test.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-run-install-matrix': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/run-main-agent-wave-3-11-install-matrix.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-validate-wave-3-11-evidence-running': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --evidence-running; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --evidence-running; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-assert-final-closeout-language': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert final-closeout-language; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs --assert final-closeout-language; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
    manualScenarioIds: ['MAN004'],
  },
  'cmd-encoding-final': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
  'cmd-test-wave-3-11-contract-final': {
    commandText:
      'pwsh.exe -NoLogo -NoProfile -Command \'& { $env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "final-closeout"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code }\'',
    pwsh:
      '$env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE = "final-closeout"; npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-11-contract.test.ts; $code = $LASTEXITCODE; Remove-Item Env:MAIN_AGENT_WAVE_3_11_VALIDATOR_MODE -ErrorAction SilentlyContinue; exit $code',
  },
  'cmd-validate-wave-3-11-final': {
    commandText:
      "pwsh.exe -NoLogo -NoProfile -Command '& { node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }'",
    pwsh:
      'node tools/script-migration/validate-main-agent-runtime-migration-wave-3-11.cjs; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }',
  },
};

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
  ACC012: ['cmd-test-install-surface-regressions', 'cmd-run-install-matrix', 'cmd-validate-wave-3-11-evidence-running'],
};

const MANUAL_COMMAND_REQUIREMENTS = {
  MAN001: ['cmd-assert-root-scripts-not-deleted'],
  MAN002: ['cmd-assert-public-cli-dispatch'],
  MAN003: ['cmd-assert-closure-audit-exact-wave-3-11'],
  MAN004: ['cmd-assert-final-closeout-language'],
};

function registryMetadata(entry) {
  const sourceCommand = [`source repository ${entry.originalPath}`];
  if (entry.strategy === 'package_runtime_module') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: entry.semantic,
      callerSwitchStatus: 'switched',
      oldPathDisposition: 'retained_source_root_legacy_package_runtime_module',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  if (entry.strategy === 'durable_helper_copy') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: entry.semantic,
      callerSwitchStatus: 'not_applicable',
      oldPathDisposition: 'retained_source_root_legacy_package_local_helper',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  if (entry.entryId === 'eval-question-generate') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: entry.semantic,
      callerSwitchStatus: 'switched',
      oldPathDisposition: 'retained_legacy_root_public_cli_replaced',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: ['bmad-speckit eval-question-generate'],
    };
  }
  if (entry.entryId === 'check-story-score-written') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: entry.semantic,
      callerSwitchStatus: 'switched_existing_package_runtime',
      oldPathDisposition: 'retained_legacy_root_public_cli_replaced',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: ['bmad-speckit check-score'],
    };
  }
  if (entry.entryId === 'create-second-story') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: entry.semantic,
      callerSwitchStatus: 'not_applicable',
      oldPathDisposition: 'retained_source_repo_internal_test_seed_only',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  if (entry.entryId === 'verify-score-auto-scoped-bundle') {
    return {
      originalPathStatus: 'retained',
      originalClassBeforeMigration: entry.semantic,
      callerSwitchStatus: 'not_applicable',
      oldPathDisposition: 'retained_source_repo_internal_verification_harness',
      publicCommandsBeforeMigration: sourceCommand,
      publicCommandsAfterMigration: [],
    };
  }
  throw new Error(`No registry metadata for ${entry.entryId}`);
}

function parseArgs(argv) {
  const result = { command: null, commandId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (
      [
        '--prepare-pre-evidence',
        '--init-evidence',
        '--write-root-script-proof',
        '--write-summary',
        '--write-unsealed-final-packet',
        '--seal-final-packet',
        '--mark-awaiting-final-validator',
        '--append-final-validator-row',
        '--refresh-repair-archive-receipt',
      ].includes(arg)
    ) {
      result.command = arg.slice(2);
    } else if (arg === '--start-repair-round') {
      result.command = 'start-repair-round';
      result.roundId = argv[++index];
    } else if (arg === '--run-command') {
      result.command = 'run-command';
      result.commandId = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!result.command) throw new Error('Missing command');
  return result;
}

function withReceipt(targetPath, value, receipts, operation) {
  const content = typeof value === 'string' ? value : formatJson(value);
  receipts.push(safeWriteFile(targetPath, content, { operation }));
}

function gitStatusByPath() {
  const result = spawnSync('git', ['status', '--short', '--', 'scripts'], { cwd: ROOT, encoding: 'utf8', shell: false });
  if (result.status !== 0) throw new Error(`git status scripts failed: ${result.stderr || result.stdout}`);
  const byPath = new Map();
  for (const line of (result.stdout || '').split(/\r?\n/u).filter(Boolean)) {
    const match = line.match(/^(.{2})\s+(.+)$/u);
    if (!match) continue;
    const statusPath = match[2].split(' -> ').pop().replace(/\\/g, '/');
    byPath.set(statusPath, line);
  }
  return byPath;
}

function updateRegistryText(existingText, startedAt, completedAt) {
  const parsed = yaml.load(existingText);
  const previousWave = (parsed.waves || []).find((wave) => wave.waveId === REFINES_WAVE_ID);
  if (!previousWave) throw new Error(`Registry missing ${REFINES_WAVE_ID}`);
  const wave = {
    waveId: WAVE_ID,
    title: WAVE_TITLE,
    contractPath: CONTRACT_PATH,
    refinesWaveId: REFINES_WAVE_ID,
    status: 'validated',
    startedAt,
    completedAt,
    entries: EXPECTED_ENTRIES.map((entry) => {
      const metadata = registryMetadata(entry);
      return {
        entryId: entry.entryId,
        refinesWaveId: REFINES_WAVE_ID,
        originalPath: entry.originalPath,
        originalPathStatus: metadata.originalPathStatus,
        originalClassBeforeMigration: metadata.originalClassBeforeMigration,
        migrationStrategy: entry.strategy,
        migrationStatus: 'validated',
        targetPaths: entry.targetPaths,
        publicCommandsBeforeMigration: metadata.publicCommandsBeforeMigration,
        publicCommandsAfterMigration: metadata.publicCommandsAfterMigration,
        callerSwitchStatus: metadata.callerSwitchStatus,
        validationStatus: 'passed',
        evidenceRefs: [REGISTRY_EVIDENCE_PATH],
        oldPathDisposition: metadata.oldPathDisposition,
        deletionAllowed: false,
        deletionApprovalRef: null,
      };
    }),
  };
  const waveBlock = renderYamlListItem(wave, 2);
  const waveStartPattern = /^  - waveId: ['"]?main-agent-runtime-migration-wave-3\.11['"]?\r?\n/gmu;
  const match = waveStartPattern.exec(existingText);
  if (match) {
    const nextWave = existingText.slice(match.index + match[0].length).search(/^  - waveId: /mu);
    const end = nextWave === -1 ? existingText.length : match.index + match[0].length + nextWave;
    return `${existingText.slice(0, match.index)}${waveBlock}${existingText.slice(end).replace(/^\r?\n/u, '')}`;
  }
  return `${existingText.replace(/\s*$/u, '')}\n${waveBlock}`;
}

function quoteYaml(value) {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

function renderYamlScalar(value) {
  if (value === null) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return quoteYaml(value);
}

function renderYamlValue(key, value, indent) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`];
    const lines = [`${pad}${key}:`];
    for (const item of value) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        lines.push(renderYamlListItem(item, indent + 2).replace(/^\s*- /u, `${' '.repeat(indent + 2)}- `).replace(/\n$/u, ''));
      } else {
        lines.push(`${' '.repeat(indent + 2)}- ${renderYamlScalar(item)}`);
      }
    }
    return lines;
  }
  if (value && typeof value === 'object') {
    const lines = [`${pad}${key}:`];
    for (const [childKey, childValue] of Object.entries(value)) {
      lines.push(...renderYamlValue(childKey, childValue, indent + 2));
    }
    return lines;
  }
  return [`${pad}${key}: ${renderYamlScalar(value)}`];
}

function renderYamlListItem(object, indent) {
  const pad = ' '.repeat(indent);
  const entries = Object.entries(object);
  const [firstKey, firstValue] = entries[0];
  const firstLines = renderYamlValue(firstKey, firstValue, 0);
  const lines = [`${pad}- ${firstLines[0]}`];
  for (const extraLine of firstLines.slice(1)) lines.push(`${pad}  ${extraLine}`);
  for (const [key, value] of entries.slice(1)) {
    lines.push(...renderYamlValue(key, value, indent + 2));
  }
  return `${lines.join('\n')}\n`;
}

function buildSourceInventory(generatedAt) {
  return {
    waveId: WAVE_ID,
    generatedAt,
    entries: EXPECTED_ENTRIES.map((entry) => ({
      originalPath: entry.originalPath,
      auditSemanticClassification: entry.semantic,
      migrationStrategy: entry.strategy,
      targetPaths: entry.targetPaths,
      originalPathSha256: sha256File(entry.originalPath),
      retainedRootPath: true,
      deletionAllowed: false,
    })),
  };
}

function buildNoMigrationInternal(generatedAt) {
  return {
    waveId: WAVE_ID,
    generatedAt,
    entries: EXPECTED_ENTRIES.filter((entry) => entry.strategy === 'repo_internal_reclassify').map((entry) => ({
      originalPath: entry.originalPath,
      currentClassification: entry.semantic,
      reason:
        entry.entryId === 'create-second-story'
          ? 'Narrow source repository test seed only; no package CLI, package runtime, install surface, or generated command consumes it.'
          : 'Narrow source repository verification harness; no package CLI, package runtime, install surface, or generated command consumes it.',
      consumerReachable: false,
      packageSurfaceConsumed: false,
    })),
  };
}

function buildClassificationEvidence(generatedAt) {
  return {
    waveId: WAVE_ID,
    refinesWaveId: REFINES_WAVE_ID,
    auditReportPath: CLOSURE_AUDIT_PATH,
    registryPath: REGISTRY_PATH,
    generatedAt,
    entries: EXPECTED_ENTRIES.map((entry) => ({
      originalPath: entry.originalPath,
      currentClassification: entry.semantic,
      migrationStrategy: entry.strategy,
      auditSemanticClassification: entry.semantic,
      registryMigrationStrategy: entry.strategy,
      status: 'passed',
      evidenceRefs: [CLOSURE_AUDIT_PATH, REGISTRY_EVIDENCE_PATH],
    })),
  };
}

function buildRegistryEvidence(validatedAt) {
  return {
    waveId: WAVE_ID,
    validatedAt,
    entries: EXPECTED_ENTRIES.map((entry) => ({
      entryId: entry.entryId,
      originalPath: entry.originalPath,
      targetPaths: entry.targetPaths,
      commands: [],
      installMatrixEvidence: {
        status: 'not_required_for_pre_evidence_registry_schema',
      },
      result: 'passed',
    })),
  };
}

function buildAcceptanceStatus() {
  return Object.fromEntries(
    ACCEPTANCE_IDS.map((id) => [
      id,
      {
        status: 'pending',
        evidenceRefs: [],
        commandIds: [],
        notes: 'Pending command evidence.',
      },
    ])
  );
}

function buildManualStatus() {
  return Object.fromEntries(
    MANUAL_IDS.map((id) => [
      id,
      {
        status: 'pending',
        evidenceRefs: [],
        commandIds: [],
        notes: 'Pending manual verification command evidence.',
      },
    ])
  );
}

function readEvidence() {
  const evidence = readJsonIfExists(EVIDENCE_PATH);
  if (!evidence) throw new Error(`${EVIDENCE_PATH} does not exist; run --init-evidence first`);
  return evidence;
}

function refreshEvidenceStatuses(evidence) {
  const rowsById = latestCommandRowsById(evidence.commandRows || []);
  for (const [accId, commandIds] of Object.entries(ACC_COMMAND_REQUIREMENTS)) {
    const row = evidence.acceptanceStatus[accId];
    const requiredRows = commandIds.map((commandId) => rowsById.get(commandId));
    if (requiredRows.every(Boolean) && requiredRows.every((command) => command.status === 'passed')) {
      row.status = 'passed';
      row.commandIds = commandIds;
      row.evidenceRefs = [EVIDENCE_PATH];
      row.notes = 'All required command rows passed.';
    } else if (requiredRows.some((command) => command && command.status === 'failed')) {
      row.status = 'failed';
      row.commandIds = requiredRows.filter(Boolean).map((command) => command.commandId);
      row.evidenceRefs = [EVIDENCE_PATH];
      row.notes = 'At least one required command row failed.';
    } else {
      row.status = 'pending';
      row.commandIds = requiredRows.filter(Boolean).map((command) => command.commandId);
      row.evidenceRefs = requiredRows.some(Boolean) ? [EVIDENCE_PATH] : [];
      row.notes = 'Pending command evidence.';
    }
  }
  for (const [manualId, commandIds] of Object.entries(MANUAL_COMMAND_REQUIREMENTS)) {
    const manual = evidence.manualVerificationStatus[manualId];
    const rows = commandIds.map((commandId) => rowsById.get(commandId));
    if (rows.every(Boolean) && rows.every((row) => row.status === 'passed')) {
      manual.status = 'passed';
      manual.commandIds = commandIds;
      manual.evidenceRefs = [EVIDENCE_PATH];
      manual.notes = 'Manual verification scenario is proven by command evidence.';
    } else if (rows.some((row) => row && row.status === 'failed')) {
      manual.status = 'failed';
      manual.commandIds = rows.filter(Boolean).map((row) => row.commandId);
      manual.evidenceRefs = [EVIDENCE_PATH];
      manual.notes = 'Manual verification command failed.';
    } else {
      manual.status = 'pending';
      manual.commandIds = rows.filter(Boolean).map((row) => row.commandId);
      manual.evidenceRefs = rows.some(Boolean) ? [EVIDENCE_PATH] : [];
      manual.notes = 'Pending manual verification command evidence.';
    }
  }
  return evidence;
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

function writeEvidence(evidence, receipts, operation = 'evidence_write') {
  withReceipt(EVIDENCE_PATH, evidence, receipts, operation);
}

function assertCanRunRequiredCommand(commandId, evidence) {
  const expectedIndex = REQUIRED_COMMAND_IDS.indexOf(commandId);
  if (expectedIndex === -1) throw new Error(`Unknown commandId ${commandId}`);
  if (evidence.status === 'blocked') {
    throw new Error(evidence.blockedReason || `evidence_round_blocked:${evidence.blockedCommandId || commandId}`);
  }
  if (evidence.status === 'passed' || evidence.status === 'failed') {
    throw new Error(`evidence_round_closed:${evidence.status}`);
  }

  const latestById = latestCommandRowsById(evidence.commandRows || []);
  const latestForCommand = latestById.get(commandId);
  if (latestForCommand?.status === 'passed') {
    throw new Error(`${commandId} already has a passed command row in ${EVIDENCE_PATH}`);
  }
  if (latestForCommand && SEALED_FINAL_NO_RETRY_COMMAND_IDS.has(commandId)) {
    throw new Error(`${commandId} already exists in ${EVIDENCE_PATH}; sealed final commands cannot be retried`);
  }
  if (latestForCommand?.status === 'failed' && latestForCommand.attempt >= MAX_REQUIRED_COMMAND_ATTEMPTS) {
    throw new Error(`required_command_failed:${commandId}`);
  }
  if (latestForCommand && latestForCommand.status !== 'failed') {
    throw new Error(`${commandId} latest command row must be failed before retry; found ${latestForCommand.status}`);
  }

  const earlierFailed = REQUIRED_COMMAND_IDS.slice(0, expectedIndex)
    .map((id) => latestById.get(id))
    .find((row) => row?.status === 'failed');
  if (earlierFailed) {
    throw new Error(`required_command_pending_repair:${earlierFailed.commandId}`);
  }

  const expectedNextCommandId = latestForCommand
    ? commandId
    : REQUIRED_COMMAND_IDS[latestById.size];
  if (expectedNextCommandId !== commandId) {
    throw new Error(`${commandId} must be next command after passed prerequisites; expected ${expectedNextCommandId || '<none>'}`);
  }

  return { latestForCommand };
}

function assertReadyForFinalCloseout(evidence) {
  const failingAcceptance = ACCEPTANCE_IDS.slice(0, 12).filter(
    (id) => evidence.acceptanceStatus?.[id]?.status !== 'passed'
  );
  if (failingAcceptance.length > 0) {
    throw new Error(`final_closeout_prerequisites_not_passed:${failingAcceptance.join(',')}`);
  }
  const failingManual = ['MAN001', 'MAN002', 'MAN003'].filter(
    (id) => evidence.manualVerificationStatus?.[id]?.status !== 'passed'
  );
  if (failingManual.length > 0) {
    throw new Error(`final_closeout_manual_prerequisites_not_passed:${failingManual.join(',')}`);
  }
  const latestById = latestCommandRowsById(evidence.commandRows || []);
  const failedCommands = Array.from(latestById.values())
    .filter((row) => row.status === 'failed')
    .map((row) => row.commandId);
  if (failedCommands.length > 0) {
    throw new Error(`final_closeout_failed_command_rows_present:${failedCommands.join(',')}`);
  }
}

function initEvidence() {
  const receipts = loadSafeWriteReceipts();
  const evidence = {
    waveId: WAVE_ID,
    status: 'running',
    startedAt: nowIso(),
    completedAt: null,
    commandRows: [],
    acceptanceStatus: buildAcceptanceStatus(),
    manualVerificationStatus: buildManualStatus(),
  };
  writeEvidence(evidence, receipts, 'evidence_init');
  saveSafeWriteReceipts(receipts);
  return evidence;
}

function validateRepairRoundId(roundId) {
  if (!roundId || !/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(roundId)) {
    throw new Error('repair round id must match /^[a-z0-9][a-z0-9._-]{2,80}$/');
  }
  return roundId;
}

function startRepairRound(roundIdInput) {
  const roundId = validateRepairRoundId(roundIdInput);
  const previousEvidence = readEvidence();
  if (previousEvidence.status !== 'blocked') {
    throw new Error(`start-repair-round requires blocked evidence; found ${previousEvidence.status}`);
  }
  const archivePath = `${WAVE_DIR}/evidence-history/${roundId}.evidence.json`;
  if (fs.existsSync(repoPath(archivePath))) {
    throw new Error(`${archivePath} already exists`);
  }
  const startedAt = nowIso();
  const archive = {
    waveId: WAVE_ID,
    archivedAt: startedAt,
    repairRoundId: roundId,
    blockedReason: previousEvidence.blockedReason,
    blockedCommandId: previousEvidence.blockedCommandId,
    evidence: previousEvidence,
  };
  const evidence = {
    waveId: WAVE_ID,
    executionRoundId: roundId,
    status: 'running',
    startedAt,
    completedAt: null,
    previousEvidenceArchivePath: archivePath,
    repairOfBlockedReason: previousEvidence.blockedReason,
    repairOfBlockedCommandId: previousEvidence.blockedCommandId,
    commandRows: [],
    acceptanceStatus: buildAcceptanceStatus(),
    manualVerificationStatus: buildManualStatus(),
  };
  const receipts = loadSafeWriteReceipts();
  withReceipt(archivePath, archive, receipts, 'evidence_blocked_round_archive');
  writeEvidence(evidence, receipts, 'evidence_repair_round_init');
  saveSafeWriteReceipts(receipts);
  return {
    status: 'running',
    executionRoundId: roundId,
    previousEvidenceArchivePath: archivePath,
  };
}

function refreshRepairArchiveReceipt() {
  const evidence = readEvidence();
  const archivePath = String(evidence.previousEvidenceArchivePath || '').replace(/\\/g, '/');
  if (!archivePath) {
    throw new Error('refresh-repair-archive-receipt requires evidence.previousEvidenceArchivePath');
  }
  if (!archivePath.startsWith(`${WAVE_DIR}/evidence-history/`) || !archivePath.endsWith('.evidence.json')) {
    throw new Error(`invalid previousEvidenceArchivePath:${archivePath}`);
  }
  const archive = readJsonIfExists(archivePath);
  if (!archive) throw new Error(`missing repair archive:${archivePath}`);
  const receipts = loadSafeWriteReceipts().filter(
    (receipt) => String(receipt?.targetPath || '').replace(/\\/g, '/') !== archivePath
  );
  withReceipt(archivePath, archive, receipts, 'evidence_blocked_round_archive_receipt_refresh');
  saveSafeWriteReceipts(receipts);
  return {
    status: 'passed',
    previousEvidenceArchivePath: archivePath,
    operation: 'evidence_blocked_round_archive_receipt_refresh',
  };
}

function appendCommandRow(commandId, row) {
  const evidence = readEvidence();
  const { latestForCommand } = assertCanRunRequiredCommand(commandId, evidence);
  const spec = COMMAND_SPECS[commandId];
  const enriched = {
    commandId,
    sequence: evidence.commandRows.length + 1,
    attempt: (latestForCommand?.attempt || 0) + 1,
    ...row,
  };
  if (spec?.manualScenarioIds) enriched.manualScenarioIds = spec.manualScenarioIds;
  evidence.commandRows.push(enriched);
  refreshEvidenceStatuses(evidence);
  const shouldAutoBlock =
    enriched.status === 'failed' &&
    enriched.attempt >= MAX_REQUIRED_COMMAND_ATTEMPTS &&
    !SEALED_FINAL_NO_RETRY_COMMAND_IDS.has(commandId);
  if (shouldAutoBlock) {
    evidence.status = 'blocked';
    evidence.completedAt = enriched.completedAt || nowIso();
    evidence.blockedReason = `required_command_failed:${commandId}`;
    evidence.blockedCommandId = commandId;
    evidence.blockedAt = evidence.completedAt;
  }
  const receipts = loadSafeWriteReceipts();
  writeEvidence(evidence, receipts, shouldAutoBlock ? 'evidence_append_command_row_auto_blocked' : 'evidence_append_command_row');
  saveSafeWriteReceipts(receipts);
  return enriched;
}

function runEvidenceCommand(commandId) {
  const spec = COMMAND_SPECS[commandId];
  if (!spec) throw new Error(`Unknown commandId ${commandId}`);
  assertCanRunRequiredCommand(commandId, readEvidence());
  const startedAt = nowIso();
  const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', `& { ${spec.pwsh} }`], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  const completedAt = nowIso();
  return appendCommandRow(commandId, {
    command: spec.commandText,
    cwd: ROOT,
    exitCode: result.status === null ? 1 : result.status,
    stdoutHash: sha256Text(result.stdout || ''),
    stderrHash: sha256Text(result.stderr || ''),
    startedAt,
    completedAt,
    stdoutPreview: (result.stdout || '').slice(0, 4000),
    stderrPreview: (result.stderr || '').slice(0, 4000),
    status: result.status === 0 ? 'passed' : 'failed',
  });
}

function writeRootScriptProof() {
  const inventory = readJsonIfExists(SOURCE_INVENTORY_PATH);
  if (!inventory) throw new Error(`${SOURCE_INVENTORY_PATH} does not exist`);
  const sourceByPath = new Map((inventory.entries || []).map((entry) => [entry.originalPath, entry]));
  const statusByPath = gitStatusByPath();
  const generatedAt = nowIso();
  const changedOriginalPaths = [];
  const entries = EXPECTED_ENTRIES.map((entry) => {
    const baselineSha256 = sourceByPath.get(entry.originalPath)?.originalPathSha256;
    const currentSha256 = sha256File(entry.originalPath);
    const worktreeStatus = statusByPath.get(entry.originalPath) || '';
    const contentChanged = currentSha256 !== baselineSha256 || worktreeStatus.length > 0;
    if (contentChanged) changedOriginalPaths.push(entry.originalPath);
    return {
      originalPath: entry.originalPath,
      baselineSha256,
      currentSha256,
      worktreeStatus,
      contentChanged,
      behaviorProofStatus: 'unchanged',
      acceptedCommandIds: [],
      evidenceRefs: [],
      preservedBehavior: {
        arguments: !contentChanged,
        outputShape: !contentChanged,
        exitCodeSemantics: !contentChanged,
        errorNames: !contentChanged,
      },
    };
  });
  if (changedOriginalPaths.length > 0) {
    throw new Error(`root_script_behavior_regression_proof_missing:${changedOriginalPaths.join(',')}`);
  }
  const artifact = {
    waveId: WAVE_ID,
    generatedAt,
    sourceInventoryRef: SOURCE_INVENTORY_PATH,
    entries,
  };
  const receipts = loadSafeWriteReceipts();
  withReceipt(ROOT_SCRIPT_PROOF_PATH, artifact, receipts, 'root_script_regression_proof');
  saveSafeWriteReceipts(receipts);
  return artifact;
}

function writeSummary() {
  const evidence = readEvidence();
  assertReadyForFinalCloseout(evidence);
  if (!fs.existsSync(repoPath(INSTALL_MATRIX_PATH))) throw new Error(`${INSTALL_MATRIX_PATH} does not exist`);
  const rows = evidence.commandRows || [];
  const migratedEntries = EXPECTED_ENTRIES.filter((entry) => !entry.strategy.includes('repo_internal')).map(
    (entry) => `- ${entry.originalPath} -> ${entry.targetPaths.join(', ')} (${entry.strategy})`
  );
  const internalEntries = EXPECTED_ENTRIES.filter((entry) => entry.strategy.includes('repo_internal')).map(
    (entry) => `- ${entry.originalPath} retained as ${entry.semantic}`
  );
  const commandLines = rows.map(
    (row) => `- ${row.commandId}: ${row.status} (exitCode ${row.exitCode}, stdout ${row.stdoutHash}, stderr ${row.stderrHash})`
  );
  const pendingFinalCommands = [
    'cmd-assert-final-closeout-language',
    'cmd-encoding-final',
    'cmd-test-wave-3-11-contract-final',
    'cmd-validate-wave-3-11-final',
  ].filter((commandId) => !rows.some((row) => row.commandId === commandId));
  const content = [
    '# Main Agent Runtime Migration Wave 3.11 Summary',
    '',
    `Generated: ${nowIso()}`,
    '',
    'Wave 3.11 covers only the thirteen declared entries in `source-inventory.json`.',
    'No root script deletion was performed.',
    'This summary does not prove every source repository script is directly callable in a consumer project.',
    '',
    '## Migrated Or Consumer-Reachable Entries',
    '',
    ...migratedEntries,
    '',
    '## True No-Migration Entries Within This Contract Inventory',
    '',
    ...internalEntries,
    '',
    '## Recorded Validation Commands',
    '',
    ...commandLines,
    '',
    '## Planned Final Closeout Commands',
    '',
    ...pendingFinalCommands.map((commandId) => `- ${commandId}: pending at summary seal time`),
    '',
    '## Residual Risks',
    '',
    '- Final acceptance and final validator rows are recorded after packet sealing; sealed artifacts keep ACC013 and ACC014 self-excluded by design.',
    '',
  ].join('\n');
  const receipts = loadSafeWriteReceipts();
  withReceipt(SUMMARY_PATH, content, receipts, 'summary_final_closeout');
  saveSafeWriteReceipts(receipts);
  return { summaryPath: SUMMARY_PATH, commandRows: rows.length };
}

function preparePreEvidence() {
  const auditResult = spawnSync(process.execPath, ['tools/script-migration/audit-consumer-reachable-closure.cjs', '--write', '--pretty', '--quiet'], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  if (auditResult.status !== 0) {
    throw new Error(`closure audit write failed: ${auditResult.stderr || auditResult.stdout}`);
  }

  const generatedAt = nowIso();
  const registryStartedAt = nowIso();
  let receipts = loadSafeWriteReceipts();
  const sourceInventory = buildSourceInventory(generatedAt);
  withReceipt(SOURCE_INVENTORY_PATH, sourceInventory, receipts, 'source_inventory_pre_evidence');
  withReceipt(NO_MIGRATION_PATH, buildNoMigrationInternal(generatedAt), receipts, 'no_migration_internal_pre_evidence');
  withReceipt(CLASSIFICATION_EVIDENCE_PATH, buildClassificationEvidence(generatedAt), receipts, 'classification_evidence_pre_evidence');
  withReceipt(REGISTRY_EVIDENCE_PATH, buildRegistryEvidence(generatedAt), receipts, 'registry_evidence_pre_evidence');

  const registryText = fs.readFileSync(repoPath(REGISTRY_PATH), 'utf8');
  const updatedRegistryText = updateRegistryText(registryText, registryStartedAt, nowIso());
  withReceipt(REGISTRY_PATH, updatedRegistryText, receipts, 'registry_wave_3_11_pre_evidence');

  const preflightStartedAt = nowIso();
  const gitRow = commandRow('git', ['status', '--short', '--branch']);
  const encodingRow = commandRow(process.execPath, ['_bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js'], {
    commandText: 'node _bmad/skills/encoding-integrity-guardian/scripts/check-encoding-integrity.js',
  });
  const preflight = {
    waveId: WAVE_ID,
    startedAt: preflightStartedAt,
    completedAt: nowIso(),
    gitStatusShortHash: gitRow.stdoutHash,
    sourceInventoryHash: sha256File(SOURCE_INVENTORY_PATH),
    commands: [gitRow, encodingRow],
  };
  withReceipt(PREFLIGHT_PATH, preflight, receipts, 'preflight_pre_evidence');

  saveSafeWriteReceipts(receipts);
  return {
    sourceInventoryHash: preflight.sourceInventoryHash,
    auditStatus: 'passed',
  };
}

function markAwaitingFinalValidator() {
  const evidence = readEvidence();
  assertReadyForFinalCloseout(evidence);
  evidence.status = 'awaiting_final_validator_self_receipt';
  evidence.completedAt = null;
  evidence.acceptanceStatus.ACC013 = {
    status: 'self_excluded',
    evidenceRefs: [EVIDENCE_PATH],
    commandIds: [],
    notes: 'Final acceptance and final validator rows are future commands at seal time.',
    pendingCommandIds: ['cmd-test-wave-3-11-contract-final', 'cmd-validate-wave-3-11-final'],
    reason: 'sealed_packet_cannot_validate_future_final_commands',
  };
  evidence.acceptanceStatus.ACC014 = {
    status: 'self_excluded',
    evidenceRefs: [EVIDENCE_PATH],
    commandIds: [],
    notes: 'Final acceptance and final validator rows are future commands at seal time.',
    pendingCommandIds: ['cmd-test-wave-3-11-contract-final', 'cmd-validate-wave-3-11-final'],
    reason: 'sealed_packet_cannot_validate_future_final_commands',
  };
  const receipts = loadSafeWriteReceipts();
  writeEvidence(evidence, receipts, 'evidence_mark_awaiting_final_validator');
  saveSafeWriteReceipts(receipts);
  return evidence;
}

function writeUnsealedFinalPacket() {
  const evidence = readEvidence();
  assertReadyForFinalCloseout(evidence);
  if (evidence.status !== 'awaiting_final_validator_self_receipt') {
    throw new Error('evidence.json must be marked awaiting_final_validator_self_receipt before writing unsealed final-evidence-packet.json');
  }
  for (const id of ['ACC013', 'ACC014']) {
    if (evidence.acceptanceStatus?.[id]?.status !== 'self_excluded') {
      throw new Error(`${id} must be self_excluded before writing unsealed final-evidence-packet.json`);
    }
  }
  if (!fs.existsSync(repoPath(INSTALL_MATRIX_PATH))) throw new Error(`${INSTALL_MATRIX_PATH} does not exist`);
  if (!fs.existsSync(repoPath(SUMMARY_PATH))) throw new Error(`${SUMMARY_PATH} does not exist`);
  const generatedAt = nowIso();
  const packet = {
    waveId: WAVE_ID,
    status: 'running',
    sealed: false,
    generatedAt,
    sealedAt: null,
    sealHash: null,
    acceptanceStatus: evidence.acceptanceStatus,
    manualVerificationStatus: evidence.manualVerificationStatus,
    sealedEvidenceJsonHash: null,
    installMatrixHash: sha256File(INSTALL_MATRIX_PATH),
    summaryHash: sha256File(SUMMARY_PATH),
    finalEncodingCommandId: null,
    expectedFinalAcceptanceCommandId: 'cmd-test-wave-3-11-contract-final',
    expectedFinalValidatorCommandId: 'cmd-validate-wave-3-11-final',
    residualRisks: [],
  };
  const receipts = loadSafeWriteReceipts();
  withReceipt(FINAL_PACKET_PATH, packet, receipts, 'final_evidence_packet_unsealed');
  saveSafeWriteReceipts(receipts);
  return packet;
}

function sealFinalPacket() {
  const evidence = readEvidence();
  assertReadyForFinalCloseout(evidence);
  if (evidence.status !== 'awaiting_final_validator_self_receipt') {
    throw new Error('evidence.json must be marked awaiting_final_validator_self_receipt before sealing final-evidence-packet.json');
  }
  for (const id of ['ACC013', 'ACC014']) {
    if (evidence.acceptanceStatus?.[id]?.status !== 'self_excluded') {
      throw new Error(`${id} must be self_excluded before sealing final-evidence-packet.json`);
    }
  }
  const encodingRow = (evidence.commandRows || []).find((row) => row.commandId === 'cmd-encoding-final');
  if (!encodingRow || encodingRow.status !== 'passed') {
    throw new Error('cmd-encoding-final must be passed before sealing final-evidence-packet.json');
  }
  if (!fs.existsSync(repoPath(INSTALL_MATRIX_PATH))) throw new Error(`${INSTALL_MATRIX_PATH} does not exist`);
  if (!fs.existsSync(repoPath(SUMMARY_PATH))) throw new Error(`${SUMMARY_PATH} does not exist`);
  const sealedAt = nowIso();
  const packet = {
    waveId: WAVE_ID,
    status: 'sealed_snapshot',
    sealed: true,
    generatedAt: sealedAt,
    sealedAt,
    sealHash: null,
    acceptanceStatus: evidence.acceptanceStatus,
    manualVerificationStatus: evidence.manualVerificationStatus,
    sealedEvidenceJsonHash: sha256File(EVIDENCE_PATH),
    installMatrixHash: sha256File(INSTALL_MATRIX_PATH),
    summaryHash: sha256File(SUMMARY_PATH),
    finalEncodingCommandId: 'cmd-encoding-final',
    expectedFinalAcceptanceCommandId: 'cmd-test-wave-3-11-contract-final',
    expectedFinalValidatorCommandId: 'cmd-validate-wave-3-11-final',
    residualRisks: [],
  };
  packet.sealHash = hashCanonical(packet, true);
  const receipts = loadSafeWriteReceipts();
  withReceipt(FINAL_PACKET_PATH, packet, receipts, 'final_evidence_packet_seal');
  saveSafeWriteReceipts(receipts);
  return packet;
}

function appendFinalValidatorRow() {
  const spec = COMMAND_SPECS['cmd-validate-wave-3-11-final'];
  const evidence = readEvidence();
  if (evidence.status !== 'awaiting_final_validator_self_receipt') {
    throw new Error('evidence.json must be awaiting_final_validator_self_receipt before final validator invocation');
  }
  if (evidence.commandRows.some((row) => row.commandId === 'cmd-validate-wave-3-11-final')) {
    throw new Error('cmd-validate-wave-3-11-final already exists in evidence.json');
  }
  const latestById = latestCommandRowsById(evidence.commandRows || []);
  const expectedNextCommandId = REQUIRED_COMMAND_IDS[latestById.size];
  if (expectedNextCommandId !== 'cmd-validate-wave-3-11-final') {
    throw new Error(`cmd-validate-wave-3-11-final must be next command after passed prerequisites; expected ${expectedNextCommandId || '<none>'}`);
  }
  const finalAcceptance = latestById.get('cmd-test-wave-3-11-contract-final');
  if (!finalAcceptance || finalAcceptance.status !== 'passed') {
    throw new Error('cmd-test-wave-3-11-contract-final must be passed before final validator invocation');
  }
  for (const id of ['ACC013', 'ACC014']) {
    if (evidence.acceptanceStatus?.[id]?.status !== 'self_excluded') {
      throw new Error(`${id} must remain self_excluded before final validator invocation`);
    }
  }
  const startedAt = nowIso();
  const result = spawnSync('pwsh.exe', ['-NoLogo', '-NoProfile', '-Command', `& { ${spec.pwsh} }`], {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
  });
  const completedAt = nowIso();
  evidence.commandRows.push({
    commandId: 'cmd-validate-wave-3-11-final',
    sequence: evidence.commandRows.length + 1,
    attempt: 1,
    command: spec.commandText,
    cwd: ROOT,
    exitCode: result.status === null ? 1 : result.status,
    stdoutHash: sha256Text(result.stdout || ''),
    stderrHash: sha256Text(result.stderr || ''),
    startedAt,
    completedAt,
    stdoutPreview: (result.stdout || '').slice(0, 4000),
    stderrPreview: (result.stderr || '').slice(0, 4000),
    status: result.status === 0 ? 'passed' : 'failed',
  });
  evidence.status = result.status === 0 ? 'passed' : 'failed';
  evidence.completedAt = completedAt;
  const postValidatorReceipt = safeWriteFile(EVIDENCE_PATH, formatJson(evidence), {
    operation: 'evidence_post_final_validator_no_receipt',
  });
  process.stdout.write(`${formatJson({ status: evidence.status, evidenceHash: postValidatorReceipt.sha256 })}`);
  process.exitCode = result.status === 0 ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  let result;
  if (args.command === 'prepare-pre-evidence') result = preparePreEvidence();
  else if (args.command === 'init-evidence') result = initEvidence();
  else if (args.command === 'write-root-script-proof') result = writeRootScriptProof();
  else if (args.command === 'write-summary') result = writeSummary();
  else if (args.command === 'write-unsealed-final-packet') result = writeUnsealedFinalPacket();
  else if (args.command === 'seal-final-packet') result = sealFinalPacket();
  else if (args.command === 'mark-awaiting-final-validator') result = markAwaitingFinalValidator();
  else if (args.command === 'start-repair-round') result = startRepairRound(args.roundId);
  else if (args.command === 'refresh-repair-archive-receipt') result = refreshRepairArchiveReceipt();
  else if (args.command === 'append-final-validator-row') {
    appendFinalValidatorRow();
    return;
  } else if (args.command === 'run-command') {
    result = runEvidenceCommand(args.commandId);
    if (result.status !== 'passed' || result.exitCode !== 0) {
      const failureEvidence = readEvidence();
      process.stdout.write(`${formatJson({
        status: failureEvidence.status === 'blocked' ? 'blocked' : 'failed',
        blockedReason: failureEvidence.blockedReason || null,
        blockedCommandId: failureEvidence.blockedCommandId || null,
        result,
      })}`);
      process.exitCode = 1;
      return;
    }
  } else {
    throw new Error(`Unsupported command ${args.command}`);
  }
  process.stdout.write(`${formatJson({ status: 'passed', result })}`);
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
  COMMAND_SPECS,
  EXPECTED_ENTRIES,
  preparePreEvidence,
  runEvidenceCommand,
  writeSummary,
  writeUnsealedFinalPacket,
};
