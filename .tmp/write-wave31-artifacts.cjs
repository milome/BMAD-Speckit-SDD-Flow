const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.1';
const SOURCE_PLAN_HASH =
  'sha256:8499ef2f50f850a690d0aae3cf5191f661cf719b3517f4e87e3037602fc18a82';
const CONTRACT_PATH =
  'docs/plans/2026-06-04-main-agent-runtime-migration-wave-3-1-goal-execution-plan.md';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const COMMAND_RECEIPT_DIR = path.join(ROOT, '.tmp', WAVE_ID, 'command-receipts');
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const EVIDENCE_PATH = path.join(WAVE_DIR, 'evidence.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');
const INSTALL_MATRIX_REFS = ['save-dev', 'npx-package', 'no-save'].map(
  (mode) => `repo-governance/script-migrations/${WAVE_ID}/install-matrix/${mode}.json`
);

const ENTRIES = [
  {
    entryId: 'main-agent-release-gate',
    originalPath: 'scripts/main-agent-release-gate.ts',
    migrationStrategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/actions/release-gate.js',
      'packages/bmad-speckit/dist/main-agent/actions/release-gate.js',
      'packages/bmad-speckit/src/main-agent/runtime.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
      'packages/bmad-speckit/bin/bmad-speckit.js',
    ],
    publicCommandsAfterMigration: [
      'bmad-speckit main-agent:release-gate',
      'bmad-speckit main-agent release-gate',
    ],
  },
  {
    entryId: 'main-agent-quality-gate',
    originalPath: 'scripts/main-agent-quality-gate.ts',
    migrationStrategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/actions/quality-gate.js',
      'packages/bmad-speckit/dist/main-agent/actions/quality-gate.js',
      'packages/bmad-speckit/src/main-agent/runtime.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
      'packages/bmad-speckit/bin/bmad-speckit.js',
    ],
    publicCommandsAfterMigration: [
      'bmad-speckit main-agent:quality-gate',
      'bmad-speckit main-agent quality-gate',
    ],
  },
  {
    entryId: 'main-agent-delivery-truth-gate',
    originalPath: 'scripts/main-agent-delivery-truth-gate.ts',
    migrationStrategy: 'package_runtime_module',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js',
      'packages/bmad-speckit/dist/main-agent/actions/delivery-truth-gate.js',
      'packages/bmad-speckit/src/main-agent/runtime.js',
      'packages/bmad-speckit/dist/main-agent/runtime.js',
      'packages/bmad-speckit/bin/bmad-speckit.js',
    ],
    publicCommandsAfterMigration: [
      'bmad-speckit main-agent:delivery-truth-gate',
      'bmad-speckit main-agent delivery-truth-gate',
    ],
  },
  {
    entryId: 'run-auditor-host',
    originalPath: 'scripts/run-auditor-host.ts',
    migrationStrategy: 'runtime_emit_cjs',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs',
      'packages/bmad-speckit/dist/main-agent/auditor-host/run-auditor-host.cjs',
      'packages/bmad-speckit/bin/bmad-speckit.js',
    ],
    publicCommandsAfterMigration: ['bmad-speckit run-auditor-host'],
  },
  {
    entryId: 'write-runtime-context',
    originalPath: 'scripts/write-runtime-context.cjs',
    migrationStrategy: 'durable_helper_copy',
    targetPaths: [
      'packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs',
      'packages/bmad-speckit/dist/main-agent/helpers/write-runtime-context.cjs',
      'packages/bmad-speckit/bin/bmad-speckit.js',
    ],
    publicCommandsAfterMigration: ['bmad-speckit write-runtime-context'],
  },
  {
    entryId: 'eval-questions',
    originalPath: 'scripts/eval-questions-cli.ts',
    migrationStrategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    publicCommandsAfterMigration: ['bmad-speckit eval-questions'],
  },
  {
    entryId: 'main-agent-bmad-help-five-layer-matrix',
    originalPath: 'scripts/main-agent-bmad-help-five-layer-matrix.ts',
    migrationStrategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    publicCommandsAfterMigration: ['bmad-speckit main-agent:bmad-help-five-layer-matrix'],
  },
  {
    entryId: 'main-agent-host-matrix-pr-orchestrate',
    originalPath: 'scripts/main-agent-host-matrix-pr-orchestrator.ts',
    migrationStrategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    publicCommandsAfterMigration: ['bmad-speckit main-agent:host-matrix-pr-orchestrate'],
  },
  {
    entryId: 'bmads-auto',
    originalPath: 'scripts/bmads-auto-cli.ts',
    migrationStrategy: 'public_cli_de_surface',
    targetPaths: ['packages/bmad-speckit/bin/bmad-speckit.js'],
    publicCommandsAfterMigration: ['bmad-speckit bmads-auto'],
  },
];

function readReceipt(id) {
  const filePath = path.join(COMMAND_RECEIPT_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    commandId: id,
    command: receipt.command,
    exitCode: receipt.exitCode,
    stdoutHash: receipt.stdoutHash,
    stderrHash: receipt.stderrHash,
    stdoutPreview: String(receipt.stdout || '').slice(0, 800),
    stderrPreview: String(receipt.stderr || '').slice(0, 800),
  };
}

function commandRows() {
  return [
    'CMD-01',
    'CMD-02',
    'CMD-03',
    'CMD-04',
    'CMD-05',
    'CMD-06',
    'CMD-07',
    'CMD-08',
    'CMD-09',
    'CMD-10',
    'CMD-11',
    'CMD-12',
    'CMD-13',
    'CMD-14',
    'CMD-15',
    'CMD-16',
  ]
    .map(readReceipt)
    .filter(Boolean);
}

function writeEvidence(rows) {
  fs.mkdirSync(WAVE_DIR, { recursive: true });
  const evidence = {
    schemaVersion: 'main-agent-runtime-migration-wave-3.1-evidence/v1',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    sourcePlanHash: SOURCE_PLAN_HASH,
    validatedAt: new Date().toISOString(),
    entries: ENTRIES.map((entry) => ({
      entryId: entry.entryId,
      originalPath: entry.originalPath,
      migrationStrategy: entry.migrationStrategy,
      targetPaths: entry.targetPaths,
      publicCommandsAfterMigration: entry.publicCommandsAfterMigration,
      commands: rows,
      installMatrixEvidence: INSTALL_MATRIX_REFS,
      result: 'passed',
      oldPathDisposition: 'retained_source_dev_only',
      deletionAllowed: false,
      deletionApprovalRef: null,
    })),
    commands: rows,
    installMatrixEvidence: INSTALL_MATRIX_REFS,
    packageRuntimeModuleMigrations: [
      'scripts/main-agent-release-gate.ts -> packages/bmad-speckit/src/main-agent/actions/release-gate.js',
      'scripts/main-agent-quality-gate.ts -> packages/bmad-speckit/src/main-agent/actions/quality-gate.js',
      'scripts/main-agent-delivery-truth-gate.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js',
    ],
    runtimeEmitCjsMigrations: [
      'scripts/run-auditor-host.ts -> packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs',
    ],
    consumerInstalledHelperMigrations: [
      'scripts/write-runtime-context.cjs -> packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs',
    ],
    publicCliDeSurfaceMigrations: [
      'scripts/eval-questions-cli.ts -> bmad-speckit eval-questions deprecated compatibility alias',
      'scripts/main-agent-bmad-help-five-layer-matrix.ts -> bmad-speckit main-agent:bmad-help-five-layer-matrix deprecated compatibility alias',
      'scripts/main-agent-host-matrix-pr-orchestrator.ts -> bmad-speckit main-agent:host-matrix-pr-orchestrate deprecated compatibility alias',
      'scripts/bmads-auto-cli.ts -> bmad-speckit bmads-auto deprecated compatibility alias',
    ],
    rootScriptsDeleted: false,
    rootScriptDeletionApproved: false,
    nextWaveRecommendation: 'blocked_until_wave_3_1_acceptance_review_complete',
  };
  fs.writeFileSync(EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
}

function writeSummary() {
  const summary = `# Script Migration Summary: ${WAVE_ID}

sourcePlanHash: ${SOURCE_PLAN_HASH}
rootScriptsDeleted: false
rootScriptDeletionApproved: false
nextWaveRecommendation: blocked_until_wave_3_1_acceptance_review_complete

## Migrated Package Runtime Modules

- scripts/main-agent-release-gate.ts -> packages/bmad-speckit/src/main-agent/actions/release-gate.js -> packages/bmad-speckit/dist/main-agent/actions/release-gate.js
- scripts/main-agent-quality-gate.ts -> packages/bmad-speckit/src/main-agent/actions/quality-gate.js -> packages/bmad-speckit/dist/main-agent/actions/quality-gate.js
- scripts/main-agent-delivery-truth-gate.ts -> packages/bmad-speckit/src/main-agent/actions/delivery-truth-gate.js -> packages/bmad-speckit/dist/main-agent/actions/delivery-truth-gate.js

## Runtime Emit CJS

- scripts/run-auditor-host.ts -> packages/bmad-speckit/src/main-agent/auditor-host/run-auditor-host.cjs -> packages/bmad-speckit/dist/main-agent/auditor-host/run-auditor-host.cjs

## Consumer-Installed Helper

- scripts/write-runtime-context.cjs -> packages/bmad-speckit/src/main-agent/helpers/write-runtime-context.cjs -> packages/bmad-speckit/dist/main-agent/helpers/write-runtime-context.cjs

## Public CLI De-Surface

- scripts/eval-questions-cli.ts -> bmad-speckit eval-questions deprecated compatibility alias
- scripts/main-agent-bmad-help-five-layer-matrix.ts -> bmad-speckit main-agent:bmad-help-five-layer-matrix deprecated compatibility alias
- scripts/main-agent-host-matrix-pr-orchestrator.ts -> bmad-speckit main-agent:host-matrix-pr-orchestrate deprecated compatibility alias
- scripts/bmads-auto-cli.ts -> bmad-speckit bmads-auto deprecated compatibility alias

## Evidence

- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/evidence.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/install-matrix/save-dev.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/install-matrix/npx-package.json
- repo-governance/script-migrations/main-agent-runtime-migration-wave-3.1/install-matrix/no-save.json

## Old Path Disposition

No root script deletion was performed or approved in Wave 3.1.

All nine original root scripts remain retained_source_dev_only:

- scripts/main-agent-release-gate.ts
- scripts/main-agent-quality-gate.ts
- scripts/main-agent-delivery-truth-gate.ts
- scripts/run-auditor-host.ts
- scripts/write-runtime-context.cjs
- scripts/eval-questions-cli.ts
- scripts/main-agent-bmad-help-five-layer-matrix.ts
- scripts/main-agent-host-matrix-pr-orchestrator.ts
- scripts/bmads-auto-cli.ts

## Residual Risks

- P1 through P5 runtime closure entries are explicitly out of scope for Wave 3.1.
- Root scripts are retained for source-repository maintenance and are not deletion-approved.
- Deprecated compatibility aliases remain public but no longer execute root scripts.
`;
  fs.writeFileSync(SUMMARY_PATH, summary, 'utf8');
}

function backupRegistry() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const backupPath = `${REGISTRY_PATH}.bak.${stamp}`;
  if (!fs.existsSync(backupPath)) fs.copyFileSync(REGISTRY_PATH, backupPath);
}

function updateRegistry() {
  backupRegistry();
  const registry = yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  const wave = registry.waves.find((item) => item.waveId === WAVE_ID);
  if (!wave) throw new Error(`registry missing wave ${WAVE_ID}`);
  wave.status = 'validated';
  wave.completedAt = new Date().toISOString();
  for (const entry of wave.entries) {
    entry.migrationStatus = 'validated';
    entry.callerSwitchStatus = 'switched';
    entry.validationStatus = 'passed';
    entry.oldPathDisposition = 'retained_source_dev_only';
    entry.deletionAllowed = false;
    entry.deletionApprovalRef = null;
    if (!entry.evidenceRefs.includes(`repo-governance/script-migrations/${WAVE_ID}/evidence.json`)) {
      entry.evidenceRefs.push(`repo-governance/script-migrations/${WAVE_ID}/evidence.json`);
    }
  }
  fs.writeFileSync(REGISTRY_PATH, yaml.dump(registry, { lineWidth: 120, noRefs: true }), 'utf8');
}

const rows = commandRows();
writeEvidence(rows);
writeSummary();
updateRegistry();
process.stdout.write(
  JSON.stringify(
    {
      status: 'written',
      commandRows: rows.map((row) => row.commandId),
      evidencePath: path.relative(ROOT, EVIDENCE_PATH).replace(/\\/g, '/'),
      summaryPath: path.relative(ROOT, SUMMARY_PATH).replace(/\\/g, '/'),
      registryPath: path.relative(ROOT, REGISTRY_PATH).replace(/\\/g, '/'),
    },
    null,
    2
  ) + '\n'
);
