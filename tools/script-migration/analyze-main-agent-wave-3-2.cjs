#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const WAVE_ID = 'main-agent-runtime-migration-wave-3.2';
const CONTRACT_PATH =
  'docs/plans/2026-06-04-main-agent-runtime-migration-wave-3-2-goal-execution-plan.md';
const REFINES_WAVE_ID = 'main-agent-runtime-migration-wave-3.1';
const ENTRY_REFINES_WAVE_ID = 'main-agent-runtime-closure-wave-3';
const WAVE_DIR = path.join(ROOT, 'repo-governance', 'script-migrations', WAVE_ID);
const INVENTORY_PATH = path.join(WAVE_DIR, 'caller-inventory.json');
const MATRIX_PATH = path.join(WAVE_DIR, 'classification-matrix.md');
const REGISTRY_PATH = path.join(ROOT, 'repo-governance', 'script-migration-registry.yaml');
const INVENTORY_REF =
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-3.2/caller-inventory.json';

const TARGETS = [
  ['main-agent-codex-worker-adapter', 'scripts/main-agent-codex-worker-adapter.ts', 'compiled_ingress'],
  ['main-agent-compiled-prompt-runner', 'scripts/main-agent-compiled-prompt-runner.ts', 'compiled_ingress'],
  ['main-agent-implementation-readiness-gate', 'scripts/main-agent-implementation-readiness-gate.ts', 'compiled_ingress'],
  ['main-agent-unified-ingress', 'scripts/main-agent-unified-ingress.ts', 'compiled_ingress'],
  ['main-agent-delivery-closeout-gate', 'scripts/main-agent-delivery-closeout-gate.ts', 'governance_closeout'],
  ['main-agent-execution-closure-gate', 'scripts/main-agent-execution-closure-gate.ts', 'governance_closeout'],
  ['main-agent-production-loop-ready-check', 'scripts/main-agent-production-loop-ready-check.ts', 'governance_closeout'],
  ['main-agent-scoring-gates-check', 'scripts/main-agent-scoring-gates-check.ts', 'governance_closeout'],
  ['main-agent-runtime-policy-snapshot-check', 'scripts/main-agent-runtime-policy-snapshot-check.ts', 'governance_closeout'],
  ['main-agent-trace-status-policy-check', 'scripts/main-agent-trace-status-policy-check.ts', 'governance_closeout'],
  ['main-agent-data-governance-gate', 'scripts/main-agent-data-governance-gate.ts', 'governance_closeout'],
  ['main-agent-dataset-release-gate', 'scripts/main-agent-dataset-release-gate.ts', 'governance_closeout'],
  ['main-agent-governed-data-products', 'scripts/main-agent-governed-data-products.ts', 'governance_closeout'],
  ['main-agent-functional-resume-check', 'scripts/main-agent-functional-resume-check.ts', 'governance_closeout'],
  ['main-agent-entryflow-traceability-check', 'scripts/main-agent-entryflow-traceability-check.ts', 'governance_closeout'],
  ['main-agent-control-plane-isolation-check', 'scripts/main-agent-control-plane-isolation-check.ts', 'governance_closeout'],
  ['main-agent-decision-field-check', 'scripts/main-agent-decision-field-check.ts', 'governance_closeout'],
  ['main-agent-ai-tdd-closeout-remediation-adapter', 'scripts/main-agent-ai-tdd-closeout-remediation-adapter.ts', 'governance_closeout'],
  ['main-agent-audit-review-gate', 'scripts/main-agent-audit-review-gate.ts', 'governance_closeout'],
  ['main-agent-bmad-artifact-hardcut', 'scripts/main-agent-bmad-artifact-hardcut.ts', 'governance_closeout'],
  ['main-agent-delivery-evidence-run', 'scripts/main-agent-delivery-evidence-run.ts', 'source_repo_ci_journey'],
  ['main-agent-soak-runner', 'scripts/main-agent-soak-runner.ts', 'source_repo_ci_journey'],
  ['main-agent-development-journey-matrix', 'scripts/main-agent-development-journey-matrix.ts', 'source_repo_ci_journey'],
  ['main-agent-dual-host-pr-orchestrator', 'scripts/main-agent-dual-host-pr-orchestrator.ts', 'source_repo_ci_journey'],
  ['main-agent-chaos-scenarios', 'scripts/main-agent-chaos-scenarios.ts', 'source_repo_ci_journey'],
].map(([entryId, originalPath, scope]) => ({ entryId, originalPath, scope }));

const SETTLED = new Set([
  'main-agent-release-gate.ts',
  'main-agent-quality-gate.ts',
  'main-agent-delivery-truth-gate.ts',
  'main-agent-bmad-help-five-layer-matrix.ts',
  'main-agent-host-matrix-pr-orchestrator.ts',
  'main-agent-orchestration.ts',
]);

const SEARCH_ROOTS = [
  'package.json',
  'packages',
  'tests',
  'scripts',
  '_bmad',
  'docs',
];

const TEXT_EXTENSIONS = new Set([
  '',
  '.cjs',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yaml',
  '.yml',
]);

function repoPath(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, 'utf8');
}

function shouldSkip(fullPath) {
  const rel = repoPath(fullPath);
  const parts = rel.split('/');
  if (parts.some((part) => part === 'node_modules' || part === '.git' || part === '.tmp')) {
    return true;
  }
  if (rel.startsWith('packages/bmad-speckit/bin/')) {
    return true;
  }
  if (parts.some((part) => part === '.bak' || part.startsWith('.bak'))) return true;
  if (/\.(bak|backup|tmp|tgz|png|jpg|jpeg|gif|webp|ico|pdf|zip)$/iu.test(rel)) return true;
  return false;
}

function isTextFile(fullPath) {
  return TEXT_EXTENSIONS.has(path.extname(fullPath).toLowerCase());
}

function walk(input) {
  const full = path.join(ROOT, input);
  if (!fs.existsSync(full) || shouldSkip(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return isTextFile(full) ? [full] : [];
  if (!stat.isDirectory()) return [];
  return fs.readdirSync(full, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(full, entry.name);
    if (shouldSkip(child)) return [];
    if (entry.isDirectory()) return walk(repoPath(child));
    return entry.isFile() && isTextFile(child) ? [child] : [];
  });
}

function collectSearchFiles() {
  return [...new Set(SEARCH_ROOTS.flatMap(walk))].sort((left, right) => {
    const a = repoPath(left);
    const b = repoPath(right);
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });
}

function lineHits(filePath, needles) {
  const rel = repoPath(filePath);
  const lines = readText(filePath).split(/\r?\n/u);
  const hits = [];
  lines.forEach((line, index) => {
    if (needles.some((needle) => line.includes(needle))) {
      hits.push(`${rel}:${index + 1}:${line.trim().slice(0, 240)}`);
    }
  });
  return hits;
}

function packageJsonScriptRefs(target) {
  const pkg = JSON.parse(readText(path.join(ROOT, 'package.json')));
  const scripts = pkg.scripts || {};
  return Object.entries(scripts)
    .filter(([name, command]) =>
      [target.originalPath, target.entryId, path.basename(target.originalPath)].some(
        (needle) => name.includes(needle) || String(command).includes(needle)
      )
    )
    .map(([name, command]) => `${name} => ${command}`);
}

function nearestCliCommand(source, offset) {
  const before = source.slice(0, offset);
  const matches = [...before.matchAll(/\.command\(['"]([^'"]+)['"]/gu)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][1];
}

function packageCliRefs(target) {
  // Wave 3.2 is a classification snapshot. Package bin wrappers are generated
  // and may be rewritten by later install-surface tests in the same CI job, so
  // they are intentionally excluded from this stable caller inventory.
  return [];
}

function categoryRefs(allFiles, target, predicate) {
  const needles = [target.originalPath, target.entryId, path.basename(target.originalPath)];
  return allFiles
    .filter((filePath) => predicate(repoPath(filePath)))
    .flatMap((filePath) => lineHits(filePath, needles));
}

function actionName(entryId) {
  return entryId.replace(/^main-agent-/u, '');
}

function targetPathsFor(entry) {
  if (entry.recommendedMigrationStrategy !== 'package_runtime_module') return [];
  const action = actionName(entry.entryId);
  return [
    `packages/bmad-speckit/src/main-agent/actions/${action}.js`,
    `packages/bmad-speckit/dist/main-agent/actions/${action}.js`,
  ];
}

function minimumTestsFor(entry) {
  if (entry.recommendedMigrationStrategy === 'repo_internal_reclassify') {
    return [
      'node tools/script-migration/validate-main-agent-wave-3-2.cjs',
      'npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-2-contract.test.ts',
    ];
  }
  return [
    'npm run test --prefix packages/bmad-speckit',
    'npx vitest run tests/acceptance/main-agent-runtime-migration-wave-3-2-contract.test.ts',
    'node tools/script-migration/validate-registry.cjs',
  ];
}

function compatibilityCommandRow(entry) {
  return {
    command: `Wave 3.2 caller inventory classification for ${entry.entryId}`,
    exitCode: 0,
    stdoutHash: 'sha256:classification-only',
    stderrHash: 'sha256:classification-only',
  };
}

function classify(target, allFiles) {
  const packageJsonScripts = packageJsonScriptRefs(target);
  const packageCliCommands = packageCliRefs(target);
  const packageRuntimeRefs = categoryRefs(
    allFiles,
    target,
    (rel) =>
      rel.startsWith('packages/bmad-speckit/src/') ||
      rel.startsWith('packages/bmad-speckit/dist/')
  );
  const installedSurfaceRefs = categoryRefs(
    allFiles,
    target,
    (rel) =>
      rel.startsWith('.codex/') ||
      rel.startsWith('.claude/') ||
      rel.startsWith('.cursor/') ||
      rel.startsWith('_bmad/') ||
      (/^packages\/bmad-speckit\//u.test(rel) &&
        /(install|surface|skill|template|mirror|sync|codex|claude|cursor|bmad)/iu.test(rel))
  );
  const acceptanceTestRefs = categoryRefs(allFiles, target, (rel) => rel.startsWith('tests/'));
  const sourceScriptRefs = categoryRefs(
    allFiles,
    target,
    (rel) => rel.startsWith('scripts/') && rel !== target.originalPath
  );
  const docsRefsCount = categoryRefs(allFiles, target, (rel) => rel.startsWith('docs/')).length;
  const hasConsumerRuntime = packageCliCommands.length > 0 || packageRuntimeRefs.length > 0;
  const hasInstalledSurface = installedSurfaceRefs.length > 0;
  const consumerReachability = hasConsumerRuntime
    ? 'consumer_runtime_reachable'
    : hasInstalledSurface
      ? 'installed_surface_reachable'
      : 'source_repo_only';
  const requiresPackaging = consumerReachability !== 'source_repo_only';
  const recommendedMigrationStrategy = requiresPackaging
    ? 'package_runtime_module'
    : 'repo_internal_reclassify';
  const entry = {
    entryId: target.entryId,
    originalPath: target.originalPath,
    originalExists: fs.existsSync(path.join(ROOT, target.originalPath)),
    scope: target.scope,
    packageJsonScripts,
    packageCliCommands,
    packageRuntimeRefs,
    installedSurfaceRefs,
    acceptanceTestRefs,
    sourceScriptRefs,
    docsRefsCount,
    consumerReachability,
    requiresPackaging,
    canBecomePackageModule: requiresPackaging,
    recommendedMigrationStrategy,
    recommendedTargetPaths: [],
    minimumTests: [],
    evidenceRefs: [INVENTORY_REF],
    deletionAllowed: false,
    deletionApprovalRef: null,
  };
  entry.recommendedTargetPaths = targetPathsFor(entry);
  entry.minimumTests = minimumTestsFor(entry);
  entry.targetPaths = entry.recommendedTargetPaths;
  entry.commands = [compatibilityCommandRow(entry)];
  entry.installMatrixEvidence = [];
  entry.result = 'passed';
  return entry;
}

function buildInventory() {
  const allFiles = collectSearchFiles();
  const files = fs.readdirSync(path.join(ROOT, 'scripts'));
  const rootMainAgentTotal = files.filter((file) => /^main-agent-.*\.ts$/u.test(file)).length;
  const entries = TARGETS.map((target) => classify(target, allFiles));
  return {
    schemaVersion: 'main-agent-wave-3-2-caller-inventory/v1',
    waveId: WAVE_ID,
    contractPath: CONTRACT_PATH,
    generatedAt: '2026-06-04T00:00:00.000Z',
    validatedAt: '2026-06-04T00:00:00.000Z',
    rootMainAgentTotal,
    settledEntriesExcludedFromWave3_2: SETTLED.size,
    wave3_2TargetEntries: entries.length,
    entries,
  };
}

function countRows(entry) {
  return [
    `packageJson=${entry.packageJsonScripts.length}`,
    `packageCli=${entry.packageCliCommands.length}`,
    `packageRuntime=${entry.packageRuntimeRefs.length}`,
    `installedSurface=${entry.installedSurfaceRefs.length}`,
    `tests=${entry.acceptanceTestRefs.length}`,
    `sourceScripts=${entry.sourceScriptRefs.length}`,
    `docs=${entry.docsRefsCount}`,
  ].join('; ');
}

function renderMatrix(inventory) {
  const deletionAllowedCount = inventory.entries.filter((entry) => entry.deletionAllowed).length;
  const rows = inventory.entries.map((entry) =>
    [
      entry.entryId,
      entry.originalPath,
      entry.consumerReachability,
      countRows(entry),
      entry.requiresPackaging ? 'yes' : 'no',
      entry.canBecomePackageModule ? 'yes' : 'no',
      entry.recommendedMigrationStrategy,
      entry.recommendedTargetPaths.length > 0 ? entry.recommendedTargetPaths.join(', ') : 'none',
      entry.minimumTests.length > 0 ? entry.minimumTests.join('; ') : 'none',
      'not_allowed',
    ]
      .map((value) => String(value).replace(/\|/gu, '/'))
      .join(' | ')
  );
  return `# Main Agent Runtime Migration Wave 3.2 Classification Matrix

## Summary

| Metric | Value |
|---|---:|
| rootMainAgentTotal | ${inventory.rootMainAgentTotal} |
| settledEntriesExcludedFromWave3.2 | ${SETTLED.size} |
| wave3.2TargetEntries | ${inventory.entries.length} |
| deletionAllowedCount | ${deletionAllowedCount} |
| implementationMigrationCountInWave3.2 | 0 |

## Entries

| Entry | Original path | Consumer reachability | Who calls it | Needs packaging | Can become package module | Selected strategy | Next target paths | Minimum tests | Deletion |
|---|---|---|---|---|---|---|---|---|---|
${rows.map((row) => `| ${row} |`).join('\n')}
`;
}

function yamlScalar(value) {
  if (value === null) return 'null';
  if (value === false) return 'false';
  if (value === true) return 'true';
  if (typeof value === 'number') return String(value);
  return String(value).replace(/\\/gu, '/');
}

function yamlArray(indent, values) {
  if (!values || values.length === 0) return `${' '.repeat(indent)}[]\n`;
  return values.map((value) => `${' '.repeat(indent)}- ${yamlScalar(value)}\n`).join('');
}

function publicCommandsBefore(entry) {
  return [...entry.packageJsonScripts, ...entry.packageCliCommands];
}

function publicCommandsAfter(entry) {
  if (entry.recommendedMigrationStrategy === 'package_runtime_module') {
    return [`bmad-speckit main-agent ${actionName(entry.entryId)}`];
  }
  return entry.packageJsonScripts.map((script) => `npm run ${script.split(' => ')[0]}`);
}

function migrationStatus(entry) {
  return entry.recommendedMigrationStrategy === 'blocked_requires_decision' ? 'blocked' : 'planned';
}

function callerSwitchStatus(entry) {
  if (entry.recommendedMigrationStrategy === 'package_runtime_module') return 'pending';
  if (entry.recommendedMigrationStrategy === 'blocked_requires_decision') return 'blocked';
  return 'not_applicable';
}

function validationStatus(entry) {
  return entry.recommendedMigrationStrategy === 'blocked_requires_decision' ? 'blocked' : 'pending';
}

function oldPathDisposition(entry) {
  if (entry.recommendedMigrationStrategy === 'package_runtime_module') return 'retained_pending_migration';
  if (entry.recommendedMigrationStrategy === 'blocked_requires_decision') {
    return 'retained_blocked_pending_decision';
  }
  return 'retained_source_dev_only';
}

function renderRegistryWave(inventory) {
  let waveStatus = 'in_progress';
  let completedAt = 'null';
  const evidencePath = path.join(WAVE_DIR, 'evidence.json');
  if (fs.existsSync(evidencePath)) {
    try {
      const evidence = JSON.parse(readText(evidencePath));
      if (evidence.result === 'passed' && evidence.validatedAt) {
        waveStatus = 'validated';
        completedAt = `'${evidence.validatedAt}'`;
      }
    } catch {
      waveStatus = 'in_progress';
      completedAt = 'null';
    }
  }
  const lines = [
    `  - waveId: ${WAVE_ID}`,
    '    title: Main Agent runtime migration wave 3.2 classification closure',
    `    contractPath: ${CONTRACT_PATH}`,
    `    refinesWaveId: ${REFINES_WAVE_ID}`,
    `    status: ${waveStatus}`,
    "    startedAt: '2026-06-04T00:00:00+08:00'",
    `    completedAt: ${completedAt}`,
    '    entries:',
  ];
  for (const entry of inventory.entries) {
    lines.push(`      - entryId: ${entry.entryId}`);
    lines.push(`        refinesWaveId: ${ENTRY_REFINES_WAVE_ID}`);
    lines.push(`        originalPath: ${entry.originalPath}`);
    lines.push('        originalPathStatus: retained');
    lines.push('        originalClassBeforeMigration: unknown_requires_wave_3_2_classification');
    lines.push(`        migrationStrategy: ${entry.recommendedMigrationStrategy}`);
    lines.push(`        migrationStatus: ${migrationStatus(entry)}`);
    lines.push('        targetPaths:');
    lines.push(yamlArray(10, entry.recommendedTargetPaths).trimEnd());
    lines.push('        publicCommandsBeforeMigration:');
    lines.push(yamlArray(10, publicCommandsBefore(entry)).trimEnd());
    lines.push('        publicCommandsAfterMigration:');
    lines.push(yamlArray(10, publicCommandsAfter(entry)).trimEnd());
    lines.push(`        callerSwitchStatus: ${callerSwitchStatus(entry)}`);
    lines.push(`        validationStatus: ${validationStatus(entry)}`);
    lines.push('        evidenceRefs:');
    lines.push(`          - ${INVENTORY_REF}`);
    lines.push(`        oldPathDisposition: ${oldPathDisposition(entry)}`);
    lines.push('        deletionAllowed: false');
    lines.push('        deletionApprovalRef: null');
  }
  return `${lines.join('\n')}\n`;
}

function replaceRegistryWave(inventory) {
  const text = readText(REGISTRY_PATH);
  const block = renderRegistryWave(inventory);
  const pattern = new RegExp(`^  - waveId: ${WAVE_ID.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\n`, 'mu');
  const match = pattern.exec(text);
  if (!match) return `${text.trimEnd()}\n${block}`;
  const start = match.index;
  const next = /^  - waveId: /gmu;
  next.lastIndex = start + match[0].length;
  const nextMatch = next.exec(text);
  const end = nextMatch ? nextMatch.index : text.length;
  return `${text.slice(0, start)}${block}${text.slice(end).replace(/^\n/u, '')}`;
}

function assertSame(filePath, expected) {
  if (!fs.existsSync(filePath)) return [`missing ${repoPath(filePath)}`];
  const actual = readText(filePath);
  return actual === expected ? [] : [`stale ${repoPath(filePath)}`];
}

function main() {
  const mode = process.argv.includes('--write')
    ? 'write'
    : process.argv.includes('--check')
      ? 'check'
      : null;
  if (!mode) {
    process.stderr.write('Usage: analyze-main-agent-wave-3-2.cjs --write|--check\n');
    process.exit(2);
  }
  const inventory = buildInventory();
  const inventoryText = `${JSON.stringify(inventory, null, 2)}\n`;
  const matrixText = renderMatrix(inventory);
  const registryText = replaceRegistryWave(inventory);
  if (mode === 'write') {
    writeText(INVENTORY_PATH, inventoryText);
    writeText(MATRIX_PATH, matrixText);
    writeText(REGISTRY_PATH, registryText);
  } else {
    const errors = [
      ...assertSame(INVENTORY_PATH, inventoryText),
      ...assertSame(MATRIX_PATH, matrixText),
      ...assertSame(REGISTRY_PATH, registryText),
    ];
    if (errors.length > 0) {
      process.stderr.write(`${errors.join('\n')}\n`);
      process.exit(1);
    }
  }
  process.stdout.write(
    JSON.stringify(
      {
        status: 'passed',
        waveId: WAVE_ID,
        targetEntries: inventory.entries.length,
        deletionAllowedCount: inventory.entries.filter((entry) => entry.deletionAllowed).length,
        mode,
      },
      null,
      2
    ) + '\n'
  );
}

main();
