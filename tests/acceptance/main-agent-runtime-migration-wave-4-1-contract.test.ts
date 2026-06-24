import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const LIVE_ROOT = process.cwd();
const WAVE_DIR_RELATIVE = 'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1';
const STRICT_BLOB_RESTORE_PATHS = [
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/source-inventory.json',
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/migration-queue.json',
  'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.0-rebaseline/package-source-parity-baseline.json',
  'repo-governance/script-migration-registry.yaml',
];
const STRICT_LIVE_RESTORE_PATHS = [
  `${WAVE_DIR_RELATIVE}/install-matrix/no-save.json`,
  `${WAVE_DIR_RELATIVE}/install-matrix/save-dev.json`,
  `${WAVE_DIR_RELATIVE}/install-matrix/npx-package.json`,
  `${WAVE_DIR_RELATIVE}/install-matrix/init-sync-consumer.json`,
];
const ROOT_ORCHESTRATION_RUNTIME_REFERENCE_SCAN_PATHS = [
  'package.json',
  'packages/bmad-speckit/bin/bmad-speckit.js',
  'packages/bmad-speckit/src',
  'tests/acceptance',
  'tests/unit',
  '.github',
];
const ROOT_ORCHESTRATION_RUNTIME_REFERENCE_PATTERNS = [
  /\bnode[^\n\r]*scripts[\\/]main-agent-orchestration\.ts/gu,
  /\btsx[^\n\r]*scripts[\\/]main-agent-orchestration\.ts/gu,
  /\bts-node[^\n\r]*scripts[\\/]main-agent-orchestration\.ts/gu,
  /from\s+['"](?:\.\.\/)*scripts[\\/]main-agent-orchestration(?:\.ts)?['"]/gu,
  /require\(\s*['"](?:\.\.\/)*scripts[\\/]main-agent-orchestration(?:\.ts)?['"]\s*\)/gu,
  /import\(\s*['"](?:\.\.\/)*scripts[\\/]main-agent-orchestration(?:\.ts)?['"]\s*\)/gu,
  /path\.join\([^)\n\r]*['"]scripts['"][^)\n\r]*['"]main-agent-orchestration\.ts['"][^)\n\r]*\)/gu,
];

function runSetupCommand(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `failed to prepare isolated Wave 4.1 validation tree: ${command} ${args.join(' ')}`,
        `cwd=${cwd}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  return result;
}

function linkNodeModules(targetRoot: string) {
  const source = path.join(LIVE_ROOT, 'node_modules');
  if (!fs.existsSync(source)) return;
  const target = path.join(targetRoot, 'node_modules');
  if (fs.existsSync(target)) return;
  fs.symlinkSync(source, target, process.platform === 'win32' ? 'junction' : 'dir');
}

function copyGeneratedBuildInput(relativePath: string, targetRoot: string) {
  const source = path.join(LIVE_ROOT, relativePath);
  if (!fs.existsSync(source)) return;
  const target = path.join(targetRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true, force: true });
}

function restoreHeadBlob(relativePath: string, targetRoot: string) {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const result = spawnSync('git', ['show', `HEAD:${normalizedPath}`], {
    cwd: LIVE_ROOT,
    encoding: 'buffer',
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `failed to restore HEAD blob for isolated Wave 4.1 validation: ${normalizedPath}`,
        result.stderr.toString('utf8'),
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
  const target = path.join(targetRoot, ...normalizedPath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, result.stdout);
}

function collectTextFiles(relativePath: string): string[] {
  const absolute = path.join(LIVE_ROOT, relativePath);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  const files: string[] = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTextFiles(path.relative(LIVE_ROOT, child)));
      continue;
    }
    if (/\.(?:json|js|ts|tsx|md)$/u.test(entry.name)) files.push(child);
  }
  return files;
}

function restoreLiveCheckoutFile(relativePath: string, targetRoot: string) {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const source = path.join(LIVE_ROOT, ...normalizedPath.split('/'));
  if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
    throw new Error(`failed to restore live checkout file for isolated Wave 4.1 validation: ${normalizedPath}`);
  }
  const target = path.join(targetRoot, ...normalizedPath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function restoreStrictValidationBlobs(targetRoot: string) {
  const ledgerPath = path.join(targetRoot, WAVE_DIR_RELATIVE, 'migration-ledger.json');
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const livePaths = new Set(STRICT_LIVE_RESTORE_PATHS);
  for (const strictPath of STRICT_BLOB_RESTORE_PATHS) restoreHeadBlob(strictPath, targetRoot);
  for (const entry of ledger.entries || []) {
    for (const sourcePath of [...(entry.packageImplementationSet || []), ...(entry.sourceAuthorityPaths || [])]) {
      livePaths.add(String(sourcePath).replace(/\\/g, '/'));
    }
  }
  for (const livePath of livePaths) restoreLiveCheckoutFile(livePath, targetRoot);
}

function prepareValidationRoot() {
  const tempParent = fs.mkdtempSync(path.join(os.tmpdir(), 'wave-4-1-contract-'));
  const targetRoot = path.join(tempParent, 'repo');
  fs.mkdirSync(targetRoot, { recursive: true });
  const archivePath = path.join(tempParent, 'head.tar');
  runSetupCommand('git', ['archive', '--format=tar', '-o', archivePath, 'HEAD'], LIVE_ROOT);
  runSetupCommand('tar', ['-xf', archivePath, '-C', targetRoot], LIVE_ROOT);
  fs.rmSync(archivePath, { force: true });
  restoreStrictValidationBlobs(targetRoot);
  linkNodeModules(targetRoot);
  copyGeneratedBuildInput('.specify', targetRoot);
  copyGeneratedBuildInput('_bmad-output/runtime/requirement-records/index.json', targetRoot);
  copyGeneratedBuildInput(
    '_bmad-output/runtime/requirement-records/REQ-CI-GOVERNANCE-MAPPING-FIXTURE/requirement-record.json',
    targetRoot
  );
  runSetupCommand('npm', ['run', 'build:scoring'], targetRoot);
  runSetupCommand('npm', ['run', 'build:runtime-context'], targetRoot);
  runSetupCommand('npm', ['run', 'build:runtime-emit'], targetRoot);
  runSetupCommand('npm', ['run', 'build:ralph-method'], targetRoot);
  runSetupCommand('npm', ['run', 'build:main-agent-dist'], targetRoot);
  return targetRoot;
}

const ROOT = prepareValidationRoot();
const require = createRequire(import.meta.url);
const WAVE_DIR = path.join(
  ROOT,
  'repo-governance',
  'script-migrations',
  'main-agent-runtime-migration-wave-4.1'
);
const LEDGER_PATH = path.join(WAVE_DIR, 'migration-ledger.json');
const SCOPE_BASELINE_PATH = path.join(WAVE_DIR, 'scope-baseline.json');
const PACKAGE_SOURCE_PARITY_EVIDENCE_PATH = path.join(WAVE_DIR, 'package-source-parity-evidence.json');
const FINAL_EVIDENCE_PACKET_PATH = path.join(WAVE_DIR, 'final-evidence-packet.json');
const SUMMARY_PATH = path.join(WAVE_DIR, 'summary.md');
const G003_DISCOVERY_PATH = path.join(
  WAVE_DIR,
  'owner-matrices',
  'G003.main-agent-orchestration.discovery.json'
);
const G003_MATRIX_PATH = path.join(
  WAVE_DIR,
  'owner-matrices',
  'G003.main-agent-orchestration.behavior-equivalence-matrix.json'
);
const {
  REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS,
  isJavaScriptRuntimeOutputPath,
  isTypeScriptDeclarationPath,
  isTypeScriptRuntimePath,
  sourceAuthorityPathToDistRuntimePath,
  summarizeLedger,
} = require(path.join(ROOT, 'tools', 'script-migration', 'main-agent-wave-4-1-utils.cjs'));

afterAll(() => {
  fs.rmSync(path.dirname(ROOT), { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

function runNode(args: string[]) {
  return spawnSync('node', args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

function parseStdout(result: ReturnType<typeof runNode>): any {
  return JSON.parse(result.stdout);
}

describe('main agent runtime migration wave 4.1 contract surfaces', () => {
  it('rejects active runtime or test commands that execute root main-agent orchestration TypeScript', () => {
    const hits: string[] = [];
    for (const scanPath of ROOT_ORCHESTRATION_RUNTIME_REFERENCE_SCAN_PATHS) {
      for (const file of collectTextFiles(scanPath)) {
        const relativeFile = path.relative(LIVE_ROOT, file).replace(/\\/g, '/');
        const content = fs.readFileSync(file, 'utf8');
        for (const pattern of ROOT_ORCHESTRATION_RUNTIME_REFERENCE_PATTERNS) {
          pattern.lastIndex = 0;
          for (const match of content.matchAll(pattern)) {
            hits.push(`${relativeFile}: ${match[0]}`);
          }
        }
      }
    }

    expect(hits).toEqual([]);
  });

  it('tracks G001 scope and owner-local evidence without marking the full 240-row goal complete', () => {
    expect(fs.existsSync(SCOPE_BASELINE_PATH)).toBe(true);
    expect(fs.existsSync(LEDGER_PATH)).toBe(true);

    const scope = JSON.parse(fs.readFileSync(SCOPE_BASELINE_PATH, 'utf8'));
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));

    expect(scope.sourceFacts.inventory.sha256).toBe(
      'sha256:897c403b25e2bf78b9bb1498a550294e4b990b71125b095b85ef7eb752a44c31'
    );
    expect(scope.fullUniverseTotals.allScripts).toBe(240);
    expect(scope.fullUniverseTotals.backlog_migration).toBe(206);
    expect(scope.fullUniverseTotals.settled_revalidation).toBe(34);
    expect(ledger.entries).toHaveLength(240);
    expect(ledger.totals.ownerCounts).toMatchObject({
      G003: 1,
      G004: 91,
      G005: 12,
      G006: 4,
      G007: 74,
      G008: 58,
    });

    const g003Rows = ledger.entries.filter((entry: any) => entry.matrixOwnerTaskId === 'G003');
    const sourceAuthorityRows = ledger.entries.filter(
      (entry: any) =>
        entry.packageImplementationSet.length > 0 &&
        entry.sourceAuthorityPaths.length > 0 &&
        entry.runtimeReplayPaths.length > 0 &&
        entry.distOutputPaths.length > 0
    );
    const fullCoverageRows = ledger.entries.filter(
      (entry: any) => entry.scenarioCoverageProof.coverageDecision === 'passed_full_original_behavior_coverage'
    );
    expect(g003Rows).toHaveLength(1);
    expect(g003Rows[0].originalPath).toBe('scripts/main-agent-orchestration.ts');
    expect(g003Rows[0].packageImplementationSet).toEqual([
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
    ]);
    expect(g003Rows[0].runtimeReplayPaths).toEqual([
      'packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-orchestration.js',
    ]);
    expect(g003Rows[0].behaviorEquivalenceMatrix.length).toBeGreaterThanOrEqual(25);
    expect(sourceAuthorityRows).toHaveLength(240);
    expect(fullCoverageRows.length).toBeGreaterThanOrEqual(1);
    expect(fullCoverageRows.some((entry: any) => entry.originalPath === 'scripts/main-agent-orchestration.ts')).toBe(
      true
    );

    for (const entry of ledger.entries) {
      expect(entry.matrixOwnerTaskId).toBe(entry.expectedMatrixOwnerTaskId);
      expect(entry.behaviorEquivalenceMatrixFirstGeneratedByTaskId).toBe(entry.matrixOwnerTaskId);
      for (const sourcePath of entry.sourceAuthorityPaths) {
        const expectedDistRuntimePath = sourceAuthorityPathToDistRuntimePath(sourcePath);
        expect(expectedDistRuntimePath).toBeTruthy();
        expect(entry.distOutputPaths).toContain(expectedDistRuntimePath);
        expect(entry.runtimeReplayPaths).toContain(expectedDistRuntimePath);
        expect(fs.existsSync(path.join(ROOT, expectedDistRuntimePath))).toBe(true);
        if (isTypeScriptRuntimePath(sourcePath)) {
          expect(isJavaScriptRuntimeOutputPath(expectedDistRuntimePath)).toBe(true);
        }
        if (isTypeScriptDeclarationPath(sourcePath)) {
          expect(isTypeScriptDeclarationPath(expectedDistRuntimePath)).toBe(true);
        }
      }
      for (const runtimePath of entry.runtimeReplayPaths) {
        expect(runtimePath).toMatch(/^packages\/bmad-speckit\/dist\//u);
        expect(entry.distOutputPaths).toContain(runtimePath);
      }
    }
  });

  it('passes preflight and final validation once all 240 rows have real equivalence evidence and closeout artifacts', () => {
    const preflight = runNode([
      'tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs',
      '--phase',
      'preflight',
      '--json',
    ]);
    expect(preflight.status, preflight.stderr || preflight.stdout).toBe(0);
    const preflightJson = parseStdout(preflight);
    expect(preflightJson.ledgerRowCount).toBe(240);
    expect(preflightJson.ownerAssignmentMismatchCount).toBe(0);
    expect(preflightJson.ownerCountsMatch).toBe(true);
    expect(preflightJson.strictCompletionGatePreview.reworkRequired).toBe(true);
    expect(preflightJson.strictCompletionGatePreview.missingPackageImplementationSetCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.invalidPackageImplementationPathCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.sourceAuthorityPathGapCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.runtimeReplayPathGapCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.distOutputPathGapCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.missingBehaviorEquivalenceMatrixCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.behaviorEquivalenceMatrixScenarioCoverageGapCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.missingBehaviorEquivalenceReplayProofCount).toBe(0);
    expect(preflightJson.strictCompletionGatePreview.acceptanceResultCoverageGapCount).toBe(38);

    expect(fs.existsSync(PACKAGE_SOURCE_PARITY_EVIDENCE_PATH)).toBe(true);
    expect(fs.existsSync(FINAL_EVIDENCE_PACKET_PATH)).toBe(true);
    expect(fs.existsSync(SUMMARY_PATH)).toBe(true);

    const packageSourceParityEvidence = JSON.parse(
      fs.readFileSync(PACKAGE_SOURCE_PARITY_EVIDENCE_PATH, 'utf8')
    );
    expect(packageSourceParityEvidence.rowCount).toBe(240);
    expect(packageSourceParityEvidence.entries).toHaveLength(240);
    expect(packageSourceParityEvidence.summary.all240RowsHavePackageImplementationSet).toBe(true);
    expect(packageSourceParityEvidence.summary.sourceKindParityViolationCount).toBe(0);
    for (const entry of packageSourceParityEvidence.entries) {
      expect(entry.packageImplementationSet.length).toBeGreaterThan(0);
      expect(entry.runtimeReplayPaths.length).toBeGreaterThan(0);
      expect(entry.distOutputPaths.length).toBeGreaterThan(0);
      expect(entry.sizeDeltaDecision).toBe('passed_within_strict_threshold');
      expect(entry.behaviorEquivalenceReplayProof.failedScenarioCount).toBe(0);
    }

    const finalPacket = JSON.parse(fs.readFileSync(FINAL_EVIDENCE_PACKET_PATH, 'utf8'));
    const acceptanceIds = finalPacket.acceptanceResults.map((result: any) => result.id);
    expect(finalPacket.acceptanceResults).toHaveLength(38);
    expect(acceptanceIds).toEqual(
      Array.from({ length: 38 }, (_value, index) => `ACC${String(index + 1).padStart(3, '0')}`)
    );
    expect(finalPacket.acceptanceResults.every((result: any) => result.status === 'pass')).toBe(true);
    expect(finalPacket.packageImplementationSetSummary.all240RowsHaveValidPackageImplementationSet).toBe(true);
    expect(finalPacket.behaviorEquivalenceSummary.matrixRowCount).toBe(240);
    expect(finalPacket.behaviorEquivalenceSummary.matrixScenarioCount).toBeGreaterThanOrEqual(240);
    expect(finalPacket.behaviorEquivalenceSummary.behaviorEquivalenceReplayFailureCount).toBe(0);
    expect(finalPacket.behaviorEquivalenceSummary.matrixFirstGeneratedByG009Count).toBe(0);
    expect(finalPacket.distCompilationSummary.checkedTypeScriptFamilySourcePathCount).toBe(197);
    expect(finalPacket.distCompilationSummary.checkedTypeScriptRuntimeSourcePathCount).toBe(196);
    expect(finalPacket.distCompilationSummary.checkedTypeScriptDeclarationSourcePathCount).toBe(1);
    expect(finalPacket.distCompilationSummary.allTypeScriptRuntimeSourceAuthorityPathsHaveDistJs).toBe(true);
    expect(finalPacket.distCompilationSummary.allTypeScriptDeclarationSourceAuthorityPathsHaveDistDeclarations).toBe(true);
    expect(finalPacket.distCompilationSummary.allTypeScriptSourceAuthorityPathsHaveDistProof).toBe(true);
    expect(finalPacket.distCompilationSummary.allTypeScriptSourceAuthorityPathsHaveDistJs).toBe(true);
    expect(finalPacket.installMatrix.allModesPassed).toBe(true);
    expect(finalPacket.installMatrix.modes.map((mode: any) => mode.mode).sort()).toEqual([
      'init-sync-consumer',
      'no-save',
      'npx-package',
      'save-dev',
    ]);
    for (const mode of finalPacket.installMatrix.modes) {
      expect(mode.status).toBe('passed');
      expect(mode.usedRootScript).toBe(false);
      expect(mode.usedTsx).toBe(false);
      expect(mode.usedTsNode).toBe(false);
      expect(mode.usedCompiledFallback).toBe(false);
      expect(mode.rootScriptDependencyCount).toBe(0);
    }
    const summaryText = fs.readFileSync(SUMMARY_PATH, 'utf8');
    expect(summaryText).toContain('all240RowsPassed=true');
    expect(summaryText).toContain('installMatrixPassed=true');

    const final = runNode([
      'tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs',
      '--phase',
      'final',
      '--json',
    ]);
    expect(final.status, final.stderr || final.stdout).toBe(0);
    const finalJson = parseStdout(final);
    expect(finalJson.reworkRequired).toBe(false);
    expect(finalJson.all240RowsPassed).toBe(true);
    expect(finalJson.all240RowsHavePackageImplementationSet).toBe(true);
    expect(finalJson.all240RowsHaveBehaviorEquivalenceMatrix).toBe(true);
    expect(finalJson.all240RowsHaveBehaviorEquivalenceReplayProof).toBe(true);
    expect(finalJson.scenarioCoverageGapCount).toBe(0);
    expect(finalJson.behaviorEquivalenceMatrixScenarioCoverageGapCount).toBe(0);
    expect(finalJson.behaviorEquivalenceReplayFailureCount).toBe(0);
    expect(finalJson.acceptanceResultCoverageGapCount).toBe(0);
    expect(finalJson.fallbackHitCount).toBe(0);
    expect(finalJson.closeoutArtifacts.ok).toBe(true);
    expect(finalJson.strictCompletionGatePreview.allStrictCompletionGatesPass).toBe(true);
    expect(finalJson.strictCompletionGatePreview.acceptanceResultCoverageGapCount).toBe(0);
  }, 120000);

  it('requires G003 source discovery and a separate owner-local behavior matrix before G003 can pass', () => {
    expect(fs.existsSync(G003_DISCOVERY_PATH)).toBe(true);
    expect(fs.existsSync(G003_MATRIX_PATH)).toBe(true);

    const discoveryRun = runNode([
      'tools/script-migration/discover-main-agent-wave-4-1-g003.cjs',
      '--json',
    ]);
    expect(discoveryRun.status, discoveryRun.stderr || discoveryRun.stdout).toBe(0);
    const discovery = parseStdout(discoveryRun);
    const artifact = JSON.parse(fs.readFileSync(G003_DISCOVERY_PATH, 'utf8'));
    const requiredActions = [
      'inspect',
      'dispatch-plan',
      'run-loop',
      'claim',
      'dispatch',
      'complete',
      'invalidate',
      'route-intake',
      'adaptive-intake',
      'confirm-scope',
      'confirm-closeout-acceptance',
      'route-confirmation-drift',
      'repair-confirmation-bookkeeping',
      'pre-confirmation-drilldown',
      'author-confirmation-ready-source',
      'authoring-repair',
      'post-close-defect-intake',
      'controlled-readiness-audit',
    ];

    expect(discovery.status).toBe('discovery_only_not_completion_evidence');
    expect(discovery.completionEvidenceAllowed).toBe(false);
    expect(discovery.ledgerMutationAllowed).toBe(false);
    expect(discovery.packageImplementationSetAllowed).toBe(false);
    expect(discovery.behaviorEquivalenceMatrixAllowed).toBe(false);
    expect(discovery.discovered.missingRequiredActions).toEqual([]);
    expect(artifact.status).toBe(discovery.status);
    expect(artifact.source.sha256).toBe(discovery.source.sha256);
    expect(artifact.discovered.envKeys).toContain('MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT');
    expect(artifact.discovered.parseArgFlags).toContain('--action');
    expect(artifact.discovered.parseArgFlags).toContain('--cwd');
    expect(artifact.discovered.parseArgFlags).toContain('--taskReportPath');
    for (const action of requiredActions) {
      expect(artifact.discovered.actionAliases).toContain(action);
      const row = artifact.discovered.requiredG003Actions.find((item: any) => item.action === action);
      expect(row?.discovered).toBe(true);
      expect(row?.sourceLineAnchors.length).toBeGreaterThan(0);
    }
    expect(Object.prototype.hasOwnProperty.call(artifact, 'packageImplementationSet')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(artifact, 'behaviorEquivalenceMatrix')).toBe(false);

    const matrix = JSON.parse(fs.readFileSync(G003_MATRIX_PATH, 'utf8'));
    expect(matrix.ownerTaskId).toBe('G003');
    expect(matrix.generatedBeforeG009).toBe(true);
    expect(matrix.originalPath).toBe('scripts/main-agent-orchestration.ts');
    expect(matrix.packageImplementationSet).toEqual([
      'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts',
    ]);
    expect(matrix.behaviorEquivalenceMatrix).toHaveLength(25);
    for (const scenario of matrix.behaviorEquivalenceMatrix) {
      for (const field of REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS) {
        expect(Object.prototype.hasOwnProperty.call(scenario, field)).toBe(true);
      }
      expect(scenario.packageEntryPoint).toBe(
        'packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'
      );
      expect(scenario.packageEntryCommand).toContain(
        'packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-orchestration.js'
      );
      expect(scenario.packageEntryCommand).not.toContain('scripts/main-agent-orchestration.ts');
      expect(scenario.packageEntryCommand).not.toMatch(/\b(?:tsx|ts-node)\b/u);
      expect(scenario.expectedOutputProvenance.expectedSource).toBe('source_derived_original');
      expect(scenario.expectedOutputProvenance.sourceLineAnchors.length).toBeGreaterThan(0);
      expect(scenario.scenarioCoverageProof.coverageDecision).toBe(
        'passed_full_original_behavior_coverage'
      );
    }

    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const g003Row = ledger.entries.find(
      (entry: any) => entry.originalPath === 'scripts/main-agent-orchestration.ts'
    );
    expect(g003Row.packageImplementationSet).toEqual(matrix.packageImplementationSet);
    expect(g003Row.behaviorEquivalenceMatrix).toHaveLength(matrix.behaviorEquivalenceMatrix.length);
    expect(g003Row.behaviorEquivalenceMatrixFirstGeneratedByTaskId).toBe('G003');
    expect(g003Row.behaviorEquivalenceReplayProof.failedScenarioCount).toBe(0);
    expect(g003Row.packageObservedExpectedOutputCount).toBeUndefined();
  });

  it('passes G003 owner-scope after matrix replay and requires completed install-matrix evidence', () => {
    const owner = runNode([
      'tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs',
      '--phase',
      'owner',
      '--owner',
      'G003',
      '--json',
    ]);
    expect(owner.status, owner.stderr || owner.stdout).toBe(0);
    const ownerJson = parseStdout(owner);
    expect(ownerJson.owner).toBe('G003');
    expect(ownerJson.ownerRowCount).toBe(1);
    expect(ownerJson.ownerRowsPassed).toBe(true);
    expect(ownerJson.ownerRowsHaveBehaviorEquivalenceMatrix).toBe(true);
    expect(ownerJson.ownerRowsHaveReplayFailureCount).toBe(0);
    expect(ownerJson.firstGenerationProofGapCount).toBe(0);

    const install = runNode([
      'tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs',
      '--phase',
      'install-matrix',
      '--json',
    ]);
    expect(install.status, install.stderr || install.stdout).toBe(0);
    const installJson = parseStdout(install);
    expect(installJson.reworkRequired).toBe(false);
    expect(installJson.records).toHaveLength(4);
    for (const record of installJson.records) {
      expect(record.record.status).toBe('passed');
      expect(record.record.rootScriptDependencyCount).toBe(0);
      expect(record.record.usedRootScript).toBe(false);
      expect(record.record.usedTsx).toBe(false);
      expect(record.record.usedTsNode).toBe(false);
      expect(record.record.usedCompiledFallback).toBe(false);
    }
  });

  it('passes no-fallback scanning after compiled fallback, report-only actions, and descriptor-only helpers are reworked', () => {
    const noFallback = runNode([
      'tools/script-migration/validate-main-agent-runtime-migration-wave-4-1.cjs',
      '--phase',
      'no-fallback',
      '--json',
    ]);
    expect(noFallback.status, noFallback.stderr || noFallback.stdout).toBe(0);
    const noFallbackJson = parseStdout(noFallback);
    expect(noFallbackJson.scannedOriginalPathCount).toBe(240);
    expect(noFallbackJson.scanCoverageRows).toBe(240);
    expect(noFallbackJson.compiledFallbackHitCount).toBe(0);
    expect(noFallbackJson.reportOnlySourceHitCount).toBe(0);
    expect(noFallbackJson.descriptorOnlyHelperHitCount).toBe(0);
    expect(noFallbackJson.dynamicFallbackHitCount).toBe(0);
    expect(noFallbackJson.tsxHitCount).toBe(0);
    expect(noFallbackJson.tsNodeHitCount).toBe(0);
    expect(noFallbackJson.scanRoots).toContain('packages/bmad-speckit/package.json');
    expect(noFallbackJson.scanRoots).toContain('_bmad/codex');
    expect(noFallbackJson.scanRoots).toContain('repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/install-matrix');
    expect(noFallbackJson.forbiddenHitCount).toBe(0);
  }, 120000);

  it('counts incomplete behavior matrix scenario fields and invalid package implementation paths as strict gaps', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const row = structuredClone(ledger.entries[0]);
    row.packageImplementationSet = ['packages/bmad-speckit/dist/main-agent/fake.js'];
    row.behaviorEquivalenceMatrix = [
      {
        scenarioId: 'incomplete-scenario',
        originalEntryCommand: 'legacy-original-entry://scripts/main-agent-orchestration.ts --help',
        packageEntryCommand: 'node packages/bmad-speckit/bin/bmad-speckit.js main-agent --help',
      },
    ];

    const summary = summarizeLedger([row]);

    expect(REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS).toContain('originalEntryPoint');
    expect(REQUIRED_BEHAVIOR_MATRIX_SCENARIO_FIELDS).toContain('argumentCombination');
    expect(summary.all240RowsHaveValidPackageImplementationSet).toBe(false);
    expect(summary.invalidPackageImplementationPathCount).toBe(2);
    expect(summary.sampleFailures.invalidPackageImplementationPaths.map((item: any) => item.reason)).toContain(
      'missing_package_source_path'
    );
    expect(summary.allBehaviorEquivalenceMatrixScenariosHaveRequiredFields).toBe(false);
    expect(summary.behaviorEquivalenceMatrixScenarioFieldGapCount).toBe(1);
    expect(summary.sampleFailures.behaviorEquivalenceMatrixScenarioFieldGaps[0].missingFields).toContain(
      'originalEntryPoint'
    );
    expect(summary.sampleFailures.behaviorEquivalenceMatrixScenarioFieldGaps[0].missingFields).toContain(
      'argumentCombination'
    );
  });

  it('rejects semantically empty matrix fields, missing package source files, and mismatched ratio arithmetic', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const row = structuredClone(ledger.entries[0]);
    row.packageImplementationSet = ['packages/bmad-speckit/src/main-agent/does-not-exist.ts'];
    row.behaviorEquivalenceMatrix = [
      {
        scenarioId: '   ',
        originalEntryPoint: '',
        originalEntryCommand: 'legacy-original-entry://scripts/not-the-original.ts',
        packageEntryPoint: 'packages/bmad-speckit/src/main-agent/does-not-exist.ts',
        packageEntryCommand: 'tsx package-source-entry://main-agent-orchestration.ts',
        argumentCombination: {},
        args: 'not-array',
        env: [],
        fixtures: 'not-array',
        expectedStdout: [],
        expectedStderr: [],
        expectedExitCode: '0',
        expectedFileArtifacts: {},
        expectedErrorPaths: {},
        expectedOutputProvenance: {},
        scenarioCoverageProof: {},
      },
    ];
    row.behaviorEquivalenceReplayProof = {
      replayCommandId: 'CMD004',
      replayStdoutPath: 'stdout.log',
      replayStderrPath: 'stderr.log',
      replayResultArtifactHash: 'sha256:fake',
      scenarioCount: 2,
      passedScenarioCount: 2,
      failedScenarioCount: 0,
      acceptanceIds: ['ACC026'],
    };
    row.matrixFirstGenerationProof = {
      commandId: 'CMD017',
      ownerTaskId: row.matrixOwnerTaskId,
      artifactPath: 'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/owner-matrices/G003.json',
      artifactHash: 'sha256:fake',
      ledgerHashBeforeOwnerCompletion: 'sha256:fake',
      ownerCompletionEvidenceId: 'evidence:G003',
    };
    row.scenarioCoverageProof = {
      coverageDecision: 'passed_full_original_behavior_coverage',
      entryPointCount: 2,
      argCombinationCount: 1,
      envKeyCount: 0,
      fixtureCount: 0,
      fileArtifactCount: 0,
      errorPathCount: 0,
      coveredEntryPointCount: 1,
      coveredArgCombinationCount: 1,
      coveredEnvKeyCount: 0,
      coveredFixtureCount: 0,
      coveredFileArtifactCount: 0,
      coveredErrorPathCount: 0,
    };
    row.expectedOutputProvenance = {};
    row.semanticSizeProof = {
      semanticPackageBytes: row.semanticPackageBytes,
      semanticPackageLoc: row.semanticPackageLoc,
      semanticPackageByteRatio: row.semanticPackageByteRatio,
      semanticPackageLocRatio: row.semanticPackageLocRatio,
      commentOnlyBytes: 0,
      deadCodeBytes: 0,
      sharedOvercountBytes: 0,
      antiPaddingDecision: 'passed_no_semantic_padding',
    };
    row.originalBytes = 100;
    row.originalLoc = 100;
    row.packageBytes = 100;
    row.packageLoc = 100;
    row.packageByteRatio = 1.2;
    row.packageLocRatio = 1;

    const summary = summarizeLedger([row]);

    expect(summary.invalidPackageImplementationPathCount).toBe(1);
    expect(summary.behaviorEquivalenceMatrixScenarioFieldGapCount).toBe(1);
    expect(summary.sampleFailures.behaviorEquivalenceMatrixScenarioFieldGaps[0].problems).toContain(
      'invalid_scenarioId'
    );
    expect(summary.sampleFailures.behaviorEquivalenceMatrixScenarioFieldGaps[0].problems).toContain(
      'packageEntryCommand_uses_forbidden_original_or_fallback_runtime'
    );
    expect(summary.behaviorEquivalenceReplayFailureCount).toBe(1);
    expect(summary.scenarioCoverageGapCount).toBe(1);
    expect(summary.expectedOutputProvenanceGapCount).toBe(1);
    expect(summary.sizeDeltaComputationMismatchCount).toBe(1);
  });

  it('rejects public CLI bin-only packageImplementationSet evidence without package source', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const row = structuredClone(ledger.entries[0]);
    row.migrationStrategy = 'public_cli_de_surface';
    row.packageImplementationSet = ['packages/bmad-speckit/bin/bmad-speckit.js'];

    const summary = summarizeLedger([row]);

    expect(summary.all240RowsHaveValidPackageImplementationSet).toBe(false);
    expect(summary.invalidPackageImplementationPathCount).toBeGreaterThan(0);
    expect(summary.sampleFailures.invalidPackageImplementationPaths.map((item: any) => item.reason)).toContain(
      'missing_package_source_path'
    );
    expect(summary.sampleFailures.invalidPackageImplementationPaths.map((item: any) => item.reason)).toContain(
      'bin_only_without_source_pair'
    );
  });

  it('rejects source authority paths whose exact dist runtime output is not replayed', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const row = structuredClone(
      ledger.entries.find((entry: any) => entry.originalPath === 'scripts/main-agent-orchestration.ts')
    );
    const expectedDistRuntimePath = sourceAuthorityPathToDistRuntimePath(row.sourceAuthorityPaths[0]);

    expect(expectedDistRuntimePath).toBe(
      'packages/bmad-speckit/dist/main-agent/source-authority/scripts/main-agent-orchestration.js'
    );

    row.runtimeReplayPaths = ['packages/bmad-speckit/dist/main-agent/runtime.js'];
    row.distOutputPaths = ['packages/bmad-speckit/dist/main-agent/runtime.js'];

    const summary = summarizeLedger([row]);
    const sourceAuthorityProblems = summary.sampleFailures.sourceAuthorityPathGaps[0].problems.map(
      (problem: any) => problem.reason
    );

    expect(summary.sourceAuthorityPathGapCount).toBe(1);
    expect(sourceAuthorityProblems).toContain('sourceAuthorityPath_missing_expected_distOutputPath');
    expect(sourceAuthorityProblems).toContain('sourceAuthorityPath_missing_expected_runtimeReplayPath');
  });

  it('rejects scenario package entry points outside the row implementation set and any root scripts command', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const row = structuredClone(ledger.entries[0]);
    row.packageImplementationSet = ['packages/bmad-speckit/src/utils/path.ts'];
    row.behaviorEquivalenceMatrix = [
      {
        scenarioId: 'root-command-bypass',
        originalEntryPoint: row.originalPath,
        originalEntryCommand: `node ${row.originalPath}`,
        packageEntryPoint: 'packages/bmad-speckit/src/utils/tty.ts',
        packageEntryCommand: 'node scripts/analytics-cluster.ts',
        argumentCombination: { argv: [] },
        args: [],
        env: {},
        fixtures: [],
        expectedStdout: '',
        expectedStderr: '',
        expectedExitCode: 0,
        expectedFileArtifacts: [],
        expectedErrorPaths: [],
        expectedOutputProvenance: {
          expectedSource: 'source_derived_original',
          sourceDerivedProofId: 'proof:original-source',
          sourceLineAnchors: [`${row.originalPath}:1`],
        },
        scenarioCoverageProof: {
          coverageDecision: 'passed_full_original_behavior_coverage',
          entryPointCount: 1,
          argCombinationCount: 1,
          envKeyCount: 0,
          fixtureCount: 0,
          fileArtifactCount: 0,
          errorPathCount: 0,
          coveredEntryPointCount: 1,
          coveredArgCombinationCount: 1,
          coveredEnvKeyCount: 0,
          coveredFixtureCount: 0,
          coveredFileArtifactCount: 0,
          coveredErrorPathCount: 0,
        },
      },
    ];

    const summary = summarizeLedger([row]);
    const problems = summary.sampleFailures.behaviorEquivalenceMatrixScenarioFieldGaps[0].problems;

    expect(summary.behaviorEquivalenceMatrixScenarioFieldGapCount).toBe(1);
    expect(problems).toContain('packageEntryPoint_not_in_packageImplementationSet');
    expect(problems).toContain('packageEntryCommand_uses_forbidden_original_or_fallback_runtime');
  });

  it('allows package dist source-authority scripts paths without treating them as root fallback', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const row = structuredClone(ledger.entries.find((entry: any) => entry.originalPath === 'scripts/README.md'));
    const coverage = {
      coverageDecision: 'passed_full_original_behavior_coverage',
      staticAnalysisCommandId: `${row.matrixOwnerTaskId}_STATIC_README`,
      entryPointCount: 1,
      argCombinationCount: 1,
      envKeyCount: 0,
      fixtureCount: 1,
      fileArtifactCount: 0,
      errorPathCount: 0,
      coveredEntryPointCount: 1,
      coveredArgCombinationCount: 1,
      coveredEnvKeyCount: 0,
      coveredFixtureCount: 1,
      coveredFileArtifactCount: 0,
      coveredErrorPathCount: 0,
    };
    row.behaviorEquivalenceMatrix = [
      {
        scenarioId: `${row.matrixOwnerTaskId.toLowerCase()}_readme_md_no_args`,
        originalEntryPoint: row.originalPath,
        originalEntryCommand: `node ${row.originalPath} --cwd <fixture-root>`,
        packageEntryPoint: row.sourceAuthorityPaths[0],
        packageEntryCommand: `node ${row.runtimeReplayPaths[0]} --cwd <fixture-root>`,
        argumentCombination: '--cwd <fixture-root>',
        args: ['--cwd', '<fixture-root>'],
        env: {},
        fixtures: [{ id: 'readme_fixture', path: '<fixture-root>' }],
        expectedStdout: '',
        expectedStderr: '',
        expectedExitCode: 0,
        expectedFileArtifacts: [],
        expectedErrorPaths: [],
        expectedOutputProvenance: {
          expectedSource: 'source_derived_original',
          sourceDerivedProofId: `${row.matrixOwnerTaskId}_SOURCE_DERIVED_README`,
          sourceLineAnchors: [`${row.originalPath}:1`],
        },
        scenarioCoverageProof: coverage,
      },
    ];
    row.scenarioCoverageProof = coverage;
    row.expectedOutputProvenance = row.behaviorEquivalenceMatrix[0].expectedOutputProvenance;
    row.behaviorEquivalenceReplayProof = {
      replayCommandId: `${row.matrixOwnerTaskId}_REPLAY_README`,
      replayStdoutPath: 'stdout.log',
      replayStderrPath: 'stderr.log',
      replayResultArtifactHash: 'sha256:fake',
      scenarioCount: 1,
      passedScenarioCount: 1,
      failedScenarioCount: 0,
      acceptanceIds: ['ACC028'],
    };

    const summary = summarizeLedger([row]);

    expect(row.runtimeReplayPaths[0]).toContain('packages/bmad-speckit/dist/main-agent/source-authority/scripts/');
    expect(summary.behaviorEquivalenceMatrixScenarioFieldGapCount).toBe(0);
  });

  it('counts missing and hash-mutating G009 aggregation provenance as strict final gaps', () => {
    const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
    const missing = structuredClone(ledger.entries[0]);
    delete missing.g009AggregationProvenance;
    const missingSummary = summarizeLedger([missing]);
    expect(missingSummary.g009AggregationProofGapCount).toBe(1);

    const mismatch = structuredClone(ledger.entries[0]);
    mismatch.g009AggregationProvenance = {
      status: 'passed_hash_preserving_aggregation',
      ownerTaskId: mismatch.matrixOwnerTaskId,
      ownerArtifactPath: 'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/owner-matrices/G003.json',
      ownerArtifactHash: 'sha256:owner',
      ownerRowHash: 'sha256:owner-row',
      aggregateArtifactPath:
        'repo-governance/script-migrations/main-agent-runtime-migration-wave-4.1/behavior-equivalence-matrix.json',
      aggregateArtifactHash: 'sha256:aggregate',
      aggregatedRowHash: 'sha256:mutated-row',
    };
    const mismatchSummary = summarizeLedger([mismatch]);

    expect(mismatchSummary.g009AggregationProofGapCount).toBe(0);
    expect(mismatchSummary.g009AggregationHashMismatchCount).toBe(1);
    expect(mismatchSummary.sampleFailures.g009AggregationHashMismatches[0].problems).toContain(
      'aggregatedRowHash_does_not_match_ownerRowHash'
    );
  });
});
