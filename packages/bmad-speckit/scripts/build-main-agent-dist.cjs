#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sourceRoot = path.join(packageRoot, 'src', 'main-agent');
const distRoot = path.join(packageRoot, 'dist', 'main-agent');
const packageSourceRoot = path.join(packageRoot, 'src');
const packageDistRoot = path.join(packageRoot, 'dist');
const packageBmadRoot = path.join(packageRoot, '_bmad');
const excludedRuntimeFiles = new Set([]);
const fullOrchestrationBridgeFiles = new Set([
  'actions/full-orchestration.js',
  'compiled/main-agent-orchestration.cjs',
]);

function collectRuntimeFiles(dir = sourceRoot, base = sourceRoot) {
  const collected = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collected.push(...collectRuntimeFiles(fullPath, base));
      continue;
    }
    if (!entry.isFile() || !/\.(?:js|cjs)$/u.test(entry.name)) continue;
    const relativePath = path.relative(base, fullPath).replace(/\\/g, '/');
    if (excludedRuntimeFiles.has(relativePath)) continue;
    collected.push(relativePath);
  }
  return collected.sort();
}

const staticFiles = [
  'index.js',
  'runtime.js',
  'runtime/host-runtime-mode.js',
  'runtime/supervised-worker-runtime.js',
  'runtime/diagnose-bmad-state.js',
  'runtime/parallel-mission-control.js',
  'actions/package-runtime-report.js',
  'actions/adaptive-intake-governance-gate.js',
  'actions/adaptive-intake-proof-gate.js',
  'actions/ai-tdd-contract-gate.js',
  'actions/ai-tdd-closeout-remediation-adapter.js',
  'actions/audit-review-gate.js',
  'actions/audit-stage-routing.js',
  'actions/auditor-post-actions.js',
  'actions/auditor-spec.js',
  'actions/bmad-runtime-worker.js',
  'actions/bmad-artifact-hardcut.js',
  'actions/inspect.js',
  'actions/chaos-scenarios.js',
  'actions/codex-worker-adapter.js',
  'actions/compiled-prompt-runner.js',
  'actions/confirm-scope.js',
  'actions/control-plane-isolation-check.js',
  'actions/data-governance-gate.js',
  'actions/delivery-closeout-gate.js',
  'actions/delivery-evidence-run.js',
  'actions/dataset-release-gate.js',
  'actions/decision-field-check.js',
  'actions/development-journey-matrix.js',
  'actions/dispatch-plan.js',
  'actions/dual-host-pr-orchestrator.js',
  'actions/e2e-dual-host-journey-runner.js',
  'actions/e2e-host-matrix-journey-runner.js',
  'actions/entryflow-traceability-check.js',
  'actions/execution-closure-gate.js',
  'actions/final-closeout-evidence-runner.js',
  'actions/functional-resume-check.js',
  'actions/governed-data-products.js',
  'actions/governance-packet-dispatch-worker.js',
  'actions/implementation-readiness-gate.js',
  'actions/initialize-six-model-requirement-confirmation.js',
  'actions/ingest-implementation-evidence.js',
  'actions/live-smoke-main-agent-runtime.js',
  'actions/orchestration-dispatch-contract.js',
  'actions/orchestration-governance-contract.js',
  'actions/orchestration-state.js',
  'actions/per-must-closure-evidence-index.js',
  'actions/pre-rerun-anti-false-positive-gate.js',
  'actions/print-resolved-audit-prompt.js',
  'actions/production-loop-ready-check.js',
  'actions/run-loop.js',
  'actions/release-gate.js',
  'actions/quality-gate.js',
  'actions/reconfirmation-runtime.js',
  'actions/record-main-agent-inspect-readiness-closure.js',
  'actions/requirement-record-control-store.js',
  'actions/requirement-record-live-schema-gate.js',
  'actions/requirement-record-schema-evolution.js',
  'actions/resolve-active-requirement.js',
  'actions/runtime-policy-snapshot-check.js',
  'actions/runtime-scoring-data-path.js',
  'actions/scoring-gates-check.js',
  'actions/render-audit-block-cli.js',
  'actions/skill-orchestration-audit.js',
  'actions/six-model-runtime-decision.js',
  'actions/delivery-truth-gate.js',
  'actions/soak-runner.js',
  'actions/strict-closeout-proof-gate.js',
  'actions/target-artifact-realization-gate.js',
  'actions/trace-status-policy-check.js',
  'actions/trace-040-evidence-packet-generator.js',
  'actions/unified-ingress.js',
  'actions/update-runtime-audit-index.js',
  'actions/verify-cursor-audit-granularity.js',
  'auditor-host/run-auditor-host.cjs',
  'helpers/durable-helper-report.js',
  'helpers/agent-display-names.js',
  'helpers/bmad-state-reader.js',
  'helpers/e2e-verify-paths.js',
  'helpers/governance-packet-execution-store.js',
  'helpers/governance-packet-reconciler.js',
  'helpers/governance-remediation-artifact.js',
  'helpers/governance-remediation-config.js',
  'helpers/governance-remediation-runner.js',
  'helpers/load-manifest.js',
  'helpers/model-governance-policy-filter.js',
  'helpers/party-mode-runtime.js',
  'helpers/party-mode-runtime-assets.js',
  'helpers/prompt-routing-governance.js',
  'helpers/prompt-routing-hints.js',
  'helpers/prompt-routing-hints-schema.js',
  'helpers/query-validate.js',
  'helpers/runtime-step-state.js',
  'helpers/skill-inventory-provider.js',
  'helpers/verify-agent-files.js',
  'helpers/write-runtime-context.cjs',
];
const files = Array.from(new Set([...staticFiles, ...collectRuntimeFiles()]));
const packageFiles = [
  'scoring-runtime.js',
];
const runtimeAssetDirectories = [
  '_bmad/core/agents/code-reviewer',
  '_bmad/core/skills/bmad-party-mode',
];

function copyRuntimeFile(relativePath) {
  const source = path.join(sourceRoot, relativePath);
  const target = path.join(distRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`main-agent source file missing: ${relativePath}`);
  }
  const text = fs.readFileSync(source, 'utf8');
  if (
    !fullOrchestrationBridgeFiles.has(relativePath) &&
    /scripts[\\/]main-agent-orchestration\.ts/.test(text)
  ) {
    throw new Error(`main-agent dist source references root orchestration script: ${relativePath}`);
  }
  if (
    !fullOrchestrationBridgeFiles.has(relativePath) &&
    /compiled[\\/]main-agent-orchestration\.cjs/.test(text)
  ) {
    throw new Error(`covered main-agent source references compiled fallback: ${relativePath}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

for (const file of files) copyRuntimeFile(file);

function copyPackageFile(relativePath) {
  const source = path.join(packageSourceRoot, relativePath);
  const target = path.join(packageDistRoot, relativePath);
  if (!fs.existsSync(source)) {
    throw new Error(`package source file missing: ${relativePath}`);
  }
  const text = fs.readFileSync(source, 'utf8');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, 'utf8');
}

for (const file of packageFiles) copyPackageFile(file);

function assertInsidePackageBmad(target) {
  const resolvedTarget = path.resolve(target);
  const resolvedBmadRoot = path.resolve(packageBmadRoot);
  if (resolvedTarget !== resolvedBmadRoot && !resolvedTarget.startsWith(`${resolvedBmadRoot}${path.sep}`)) {
    throw new Error(`refusing to modify path outside package _bmad: ${target}`);
  }
}

function copyDirectoryContents(source, target) {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) {
    throw new Error(`runtime asset directory missing: ${path.relative(repoRoot, source).replace(/\\/g, '/')}`);
  }
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile()) continue;
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.copyFileSync(sourcePath, targetPath);
  }
}

function copyRuntimeAssetDirectory(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(packageRoot, relativePath);
  assertInsidePackageBmad(target);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }
  copyDirectoryContents(source, target);
}

for (const directory of runtimeAssetDirectories) copyRuntimeAssetDirectory(directory);
process.stdout.write(
  `built dist/main-agent files=${files.length} package files=${packageFiles.length} runtime asset dirs=${runtimeAssetDirectories.length}\n`
);
