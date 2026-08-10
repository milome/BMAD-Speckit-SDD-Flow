import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { writeCanonicalArtifact } = require('../../tools/ci/canonical-artifact.cjs');

export function runProfileWithSelectionStatus(
  selectionStatus: 'ready' | 'blocked',
  {
    seedTimingSummary = true,
    seedDefaultFailureRecords = false,
    failureRecordsPath,
    planningBudgetMs,
    planningDiagnosticsError,
    profile = 'pr-fast',
    stageDurationsMs = {},
  }: {
    seedTimingSummary?: boolean;
    seedDefaultFailureRecords?: boolean;
    failureRecordsPath?: string;
    planningBudgetMs?: number;
    planningDiagnosticsError?: Error;
    profile?: 'pr-fast' | 'nightly-full';
    stageDurationsMs?: Record<string, number>;
  } = {}
) {
  const repoRoot = mkdtempSync(join(tmpdir(), 'ci-governed-profile-'));
  execFileSync('git', ['init', '--quiet'], { cwd: repoRoot });
  const calls: string[] = [];
  const manifestMatrix = [{ lane: 'core', shardId: 'core-01' }];
  const timingSummaryPath = join(repoRoot, '.artifacts/test-portfolio/ci-test-timing-summary.json');
  const timingSummary = {
    schemaVersion: 'ci-test-timing-summary/v1',
    commitSha: 'a'.repeat(40),
    environmentClass: 'windows-x64-node22',
    testTimings: [],
  };
  if (seedTimingSummary) {
    writeCanonicalArtifact({
      repoRoot,
      outputDir: '.artifacts/test-portfolio',
      fileName: 'ci-test-timing-summary.json',
      artifact: timingSummary,
    });
  }
  const defaultFailureRecordsPath = '.artifacts/test-portfolio/product-failure-records.json';
  if (seedDefaultFailureRecords) {
    writeCanonicalArtifact({
      repoRoot,
      outputDir: '.artifacts/test-portfolio',
      fileName: 'product-failure-records.json',
      artifact: { schemaVersion: 'product-failure-records/v1', stale: true },
    });
  }
  if (failureRecordsPath) {
    writeCanonicalArtifact({
      repoRoot,
      outputDir: dirname(join(repoRoot, failureRecordsPath)),
      fileName: basename(failureRecordsPath),
      artifact: { schemaVersion: 'product-failure-records/v1', explicit: true },
    });
  }
  let timingSummaryExistsAtFreeze: boolean | null = null;
  let failureRecordsExistsAtCoverage: boolean | null = null;
  let coverageArgs: string[] | null = null;
  let planningDiagnosticsWritten = false;
  let elapsedMs = 0;
  const spawn = (_file: string, args: string[]) => {
    const scriptName = args[0] === 'run' ? args[1] : args[0];
    calls.push(scriptName);
    elapsedMs += stageDurationsMs[scriptName] || 0;
    if (scriptName === 'tools/ci/freeze-core-portfolio.cjs') {
      timingSummaryExistsAtFreeze = existsSync(timingSummaryPath);
    }
    if (scriptName === 'tools/ci/generate-six-model-coverage-gap-report.cjs') {
      coverageArgs = args.slice(1);
      failureRecordsExistsAtCoverage = existsSync(
        join(repoRoot, failureRecordsPath || defaultFailureRecordsPath)
      );
    }
    if (scriptName === 'ci:select') {
      writeCanonicalArtifact({
        repoRoot,
        outputDir: '.artifacts/test-portfolio',
        fileName: 'test-selection.json',
        artifact: {
          schemaVersion: 'test-selection/v1',
          coverageReportHash: `sha256:${'c'.repeat(64)}`,
          selectionStatus,
          blockingGapCount: selectionStatus === 'blocked' ? 1 : 0,
          uncoveredObligationIds:
            selectionStatus === 'blocked'
              ? ['requirement_confirmation/stale_evidence_rejection']
              : [],
          requestedProfile: profile,
          profile,
          expansionLevel: 'trace_capability',
          escalationReasonCodes: [],
          selected: [],
          gates: {
            selectionOmissionCount: 0,
            selectionDuplicateCount: 0,
            unresolvedImpactBindingCount: 0,
          },
        },
      });
    }
    if (scriptName === 'ci:shard-plan') {
      writeCanonicalArtifact({
        repoRoot,
        outputDir: '.artifacts/test-portfolio',
        fileName: 'ci-shard-plan.json',
        artifact: { schemaVersion: 'ci-shard-plan/v1', shards: manifestMatrix },
      });
    }
    if (scriptName === 'ci:manifest') {
      writeCanonicalArtifact({
        repoRoot,
        outputDir: '.artifacts/test-portfolio',
        fileName: 'ci-run-manifest.json',
        artifact: { matrix: manifestMatrix },
      });
    }
    return { status: 0 };
  };

  try {
    const { runGovernedProfile } = require('../../tools/ci/run-governed-profile.cjs');
    const result = runGovernedProfile({
      repoRoot,
      profile,
      baseSha: 'b'.repeat(40),
      commitSha: 'a'.repeat(40),
      changedPaths: [],
      failureRecordsPath,
      planningBudgetMs,
      spawn,
      now: () => elapsedMs,
      listTrackedChanges: () => [],
      restoreTrackedChanges: () => {},
      planningDiagnosticsWriter: () => {
        planningDiagnosticsWritten = true;
        if (planningDiagnosticsError) throw planningDiagnosticsError;
        return {
          json: { path: join(repoRoot, '.artifacts/test-portfolio/final/diagnostics.json') },
          markdown: { path: join(repoRoot, '.artifacts/test-portfolio/final/diagnostics.md') },
        };
      },
    });
    return {
      calls,
      result,
      shardPlanExists: existsSync(join(repoRoot, '.artifacts/test-portfolio/ci-shard-plan.json')),
      manifestExists: existsSync(join(repoRoot, '.artifacts/test-portfolio/ci-run-manifest.json')),
      timingSummaryExistsAtFreeze,
      failureRecordsExistsAtCoverage,
      coverageArgs,
      planningDiagnosticsWritten,
      timingSummary: existsSync(timingSummaryPath)
        ? JSON.parse(readFileSync(timingSummaryPath, 'utf8'))
        : null,
    };
  } finally {
    rmSync(repoRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  }
}
