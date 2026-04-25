/* eslint-disable no-console, @typescript-eslint/no-require-imports */

import { execSync } from 'child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseBmadAuditResult } from './parse-bmad-audit-result';
import { mainAuditorPostActions } from './auditor-post-actions';
import { getReviewerConsumerByAuditStage } from './reviewer-registry';
import {
  invalidateImplementationEntryGates,
  recordAuthoritativeAuditCloseout,
  recordLatestReviewerCloseout,
} from './runtime-context-registry';
import {
  buildReviewHostCloseoutV1,
  buildReviewGovernanceClosureV1,
  buildRunAuditorHostInput,
  deriveReviewCloseoutEnvelopeV1,
  isReviewCloseoutApproved,
  type ReviewCloseoutEnvelopeV1,
  type ReviewGovernanceClosureV1,
  type RunAuditorHostInvocationInput,
} from './reviewer-schema';
import { canMainAgentContinueFromCloseout } from './continue-state-contract';
import {
  checkPreconditionHash,
  loadLatestRecordByStage,
  type VersionLockResult,
} from '../packages/scoring/gate/version-lock';
const { scoreCommand: defaultScoreCommand } =
  require('../packages/bmad-speckit/src/commands/score.js') as {
    scoreCommand: (opts: Record<string, unknown>) => Promise<unknown>;
  };

type RunAuditorHostInput = RunAuditorHostInvocationInput;

interface RunAuditorHostDeps {
  scoreCommand?: (opts: Record<string, unknown>) => Promise<unknown>;
  executeAuditorScript?: (args: {
    projectRoot: string;
    auditorScript: string;
    artifactPath: string;
    iteration: string;
  }) => void;
  loadLatestRecordByStage?: typeof loadLatestRecordByStage;
  checkPreconditionHash?: typeof checkPreconditionHash;
}

interface RunAuditorHostResult {
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  governanceClosure: ReviewGovernanceClosureV1;
  closeoutEnvelope: ReviewCloseoutEnvelopeV1;
  scoreRecord?: Record<string, unknown>;
  scoreError?: string;
}

function parseArgs(argv: string[]): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === '--projectRoot' && argv[i + 1]) {
      out.projectRoot = argv[++i];
    } else if (token === '--stage' && argv[i + 1]) {
      out.stage = argv[++i];
    } else if (token === '--artifactPath' && argv[i + 1]) {
      out.artifactPath = argv[++i];
    } else if (token === '--reportPath' && argv[i + 1]) {
      out.reportPath = argv[++i];
    } else if (token === '--iterationCount' && argv[i + 1]) {
      out.iterationCount = argv[++i];
    }
  }
  return out;
}

function inferScoreStage(stage: string, artifactDocPath?: string): string {
  const mapped = getReviewerConsumerByAuditStage(stage as RunAuditorHostInput['stage'])?.scoreStage;
  if (mapped) {
    return mapped;
  }
  if (/tasks/i.test(artifactDocPath ?? '')) {
    return 'tasks';
  }
  if (/gaps/i.test(artifactDocPath ?? '')) {
    return 'gaps';
  }
  if (/plan/i.test(artifactDocPath ?? '')) {
    return 'plan';
  }
  if (/spec/i.test(artifactDocPath ?? '')) {
    return 'spec';
  }
  return 'implement';
}

function inferTriggerStage(stage: string): string | undefined {
  return getReviewerConsumerByAuditStage(stage as RunAuditorHostInput['stage'])?.triggerStage;
}

function inferEvent(stage: string): string {
  if (stage === 'story') {
    return 'story_status_change';
  }
  return 'stage_audit_complete';
}

function isOrphanCloseoutStage(stage: string): stage is 'bugfix' | 'standalone_tasks' {
  return stage === 'bugfix' || stage === 'standalone_tasks';
}

function normalizeComparablePath(value: string): string {
  return path.normalize(value).replace(/\\/g, '/');
}

function isStoryFlowSpecArtifact(artifactPath: string): boolean {
  return /^spec-E[^\\/]+-S[^\\/]+\.md$/i.test(path.basename(artifactPath));
}

function buildStorySpecVersionLockMessage(storyPath: string, result: VersionLockResult): string {
  const normalizedStoryPath = storyPath.replace(/\\/g, '/');
  switch (result.reason) {
    case 'hash mismatch':
      return `Story→Spec source_hash lock blocked: storyPath drift detected for ${normalizedStoryPath}. Re-run Story audit or regenerate spec against the latest Story document.`;
    case 'no prior record':
      return `Story→Spec source_hash lock warning: no prior story audit record found for ${normalizedStoryPath}; proceed with explicit caution.`;
    default:
      return `Story→Spec source_hash lock blocked: ${result.reason} (${normalizedStoryPath}).`;
  }
}

function validateOrphanCloseoutReport(input: {
  expectedStage: 'bugfix' | 'standalone_tasks';
  reportPath: string;
  artifactPath: string;
  parsedStage?: string;
  parsedReportPath?: string;
  parsedArtifactDocPath?: string;
}): void {
  const missingFields: string[] = [];
  if (!input.parsedStage?.trim()) {
    missingFields.push('stage');
  }
  if (!input.parsedReportPath?.trim()) {
    missingFields.push('reportPath');
  }
  if (!input.parsedArtifactDocPath?.trim()) {
    missingFields.push('artifactDocPath');
  }
  if (missingFields.length > 0) {
    throw new Error(
      `orphan closeout missing required fields for stage=${input.expectedStage}: ${missingFields.join(', ')}`
    );
  }

  if (input.parsedStage !== input.expectedStage) {
    throw new Error(
      `orphan closeout stage mismatch: expected ${input.expectedStage}, got ${input.parsedStage}`
    );
  }

  if (
    normalizeComparablePath(input.parsedReportPath!) !== normalizeComparablePath(input.reportPath)
  ) {
    throw new Error(
      `orphan closeout reportPath mismatch: expected ${input.reportPath}, got ${input.parsedReportPath}`
    );
  }

  if (
    normalizeComparablePath(input.parsedArtifactDocPath!) !== normalizeComparablePath(input.artifactPath)
  ) {
    throw new Error(
      `orphan closeout artifactDocPath mismatch: expected ${input.artifactPath}, got ${input.parsedArtifactDocPath}`
    );
  }
}

function resolveDefaultReportPath(stage: string, artifactPath: string): string {
  if (stage === 'spec' || stage === 'plan' || stage === 'tasks') {
    return artifactPath.replace(/\.md$/i, '-audit.md');
  }
  return artifactPath.replace(/\.md$/i, '.audit.md');
}

export async function runAuditorHost(
  input: RunAuditorHostInput,
  deps: RunAuditorHostDeps = {}
): Promise<RunAuditorHostResult> {
  const consumer = getReviewerConsumerByAuditStage(input.stage);
  const normalizedInput = buildRunAuditorHostInput(
    buildReviewHostCloseoutV1({
      projectRoot: input.projectRoot,
      profile: consumer.profile,
      stage: consumer.closeoutStage,
      artifactPath: input.artifactPath,
      reportPath:
        input.reportPath ?? resolveDefaultReportPath(input.stage, input.artifactPath),
      ...(input.iterationCount !== undefined ? { iterationCount: input.iterationCount } : {}),
    })
  );
  const hostStage = input.stage;
  const resolvedReportPath = normalizedInput.reportPath!;

  const auditorScript = path.resolve(normalizedInput.projectRoot, `scripts/${consumer.auditorScript}.ts`);

  if (!fs.existsSync(resolvedReportPath)) {
    if (!auditorScript || !fs.existsSync(auditorScript)) {
      throw new Error(
        `missing audit report at ${resolvedReportPath} and no local auditor script is available for stage=${hostStage}`
      );
    }
    const iteration = String(normalizedInput.iterationCount ?? '1');
    const executeAuditorScript =
      deps.executeAuditorScript ??
      ((args: {
        projectRoot: string;
        auditorScript: string;
        artifactPath: string;
        iteration: string;
      }) => {
        execSync(`npx ts-node ${args.auditorScript} ${args.artifactPath} ${args.iteration}`, {
          cwd: args.projectRoot,
          stdio: 'inherit',
        });
      });
    executeAuditorScript({
      projectRoot: normalizedInput.projectRoot,
      auditorScript,
      artifactPath: normalizedInput.artifactPath,
      iteration,
    });
  }

  const content = fs.readFileSync(resolvedReportPath, 'utf8');
  const parsed = parseBmadAuditResult(content);
  const status = parsed.status ?? 'UNKNOWN';
  const parsedArtifactDocPath = parsed.artifactDocPath?.trim();
  const parsedStoryPath = parsed.storyPath?.trim();
  const effectiveArtifactDocPath = parsedArtifactDocPath || normalizedInput.artifactPath;
  const expectedCloseoutStage = consumer.closeoutStage;
  if (isOrphanCloseoutStage(expectedCloseoutStage)) {
    validateOrphanCloseoutReport({
      expectedStage: expectedCloseoutStage,
      reportPath: resolvedReportPath,
      artifactPath: normalizedInput.artifactPath,
      parsedStage: parsed.stage,
      parsedReportPath: parsed.reportPath,
      parsedArtifactDocPath,
    });
  }
  const governanceClosure = buildReviewGovernanceClosureV1();
  const requiredFixesFromReport =
    parsed.requiredFixes && parsed.requiredFixes.length > 0
      ? parsed.requiredFixes
      : parsed.requiredFixesCount && parsed.requiredFixesCount > 0
        ? Array.from({ length: parsed.requiredFixesCount }, (_, index) => `Required fix #${index + 1}`)
        : [];

  const scoreCommand = deps.scoreCommand ?? defaultScoreCommand;
  const loadLatestRecordForStage = deps.loadLatestRecordByStage ?? loadLatestRecordByStage;
  const checkPreconditionHashFn = deps.checkPreconditionHash ?? checkPreconditionHash;
  let scoreRecord: Record<string, unknown> | undefined;
  let scoreError: string | undefined;
  let scoringFailureMode: 'not_run' | 'succeeded' | 'non_blocking_failure' =
    parsed.scoreTriggerPresent && scoreCommand ? 'succeeded' : 'not_run';
  let storySpecVersionLock: VersionLockResult | undefined;

  if (hostStage === 'spec' && isStoryFlowSpecArtifact(effectiveArtifactDocPath)) {
    if (!parsedStoryPath) {
      throw new Error(
        'story-flow spec closeout missing required fields: storyPath'
      );
    }

    const priorStoryRecord = loadLatestRecordForStage('story', undefined, parsedStoryPath);
    storySpecVersionLock = checkPreconditionHashFn(
      'spec',
      parsedStoryPath,
      priorStoryRecord?.source_hash ?? null
    );

    if (storySpecVersionLock.action === 'warn_and_proceed') {
      console.warn(buildStorySpecVersionLockMessage(parsedStoryPath, storySpecVersionLock));
    }
  }

  if (storySpecVersionLock?.action === 'block') {
    const blockingReason = buildStorySpecVersionLockMessage(parsedStoryPath!, storySpecVersionLock);
    scoreRecord = {
      effective_verdict: 'blocked',
      blocking_reason: blockingReason,
    };
    scoringFailureMode = 'not_run';
  } else if (parsed.scoreTriggerPresent && scoreCommand) {
    try {
      const scoreResult = await scoreCommand({
        reportPath: resolvedReportPath,
        stage: inferScoreStage(hostStage, effectiveArtifactDocPath),
        artifactDocPath: effectiveArtifactDocPath,
        sourceHashFilePath: effectiveArtifactDocPath,
        event: inferEvent(hostStage),
        triggerStage: inferTriggerStage(hostStage),
        iterationCount: String(normalizedInput.iterationCount ?? parsed.iterationCount ?? '0'),
        skipTriggerCheck: true,
      });

      if (scoreResult && typeof scoreResult === 'object') {
        const candidate = scoreResult as {
          parsedRecord?: Record<string, unknown>;
          record?: Record<string, unknown>;
        };
        scoreRecord = candidate.parsedRecord ?? candidate.record;
      }
    } catch (error) {
      scoringFailureMode = 'non_blocking_failure';
      scoreError = error instanceof Error ? error.message : String(error);
      console.error(`run-auditor-host: score write failure blocks closeout: ${scoreError}`);
    }
  }

  mainAuditorPostActions([
    '--projectRoot',
    normalizedInput.projectRoot,
    '--reportPath',
    resolvedReportPath,
    '--stage',
    hostStage,
  ]);

  const closeoutEnvelope = deriveReviewCloseoutEnvelopeV1({
    auditStatus: status,
    scoringFailureMode,
    ...(scoreError ? { scoringFailureReason: `Score write failed: ${scoreError}` } : {}),
    requiredFixes: requiredFixesFromReport,
    scoreRecord:
      scoreRecord &&
      typeof scoreRecord.effective_verdict === 'string'
        ? {
            effective_verdict: scoreRecord.effective_verdict as
              | 'approved'
              | 'required_fixes'
              | 'blocked'
              | 'blocked_pending_rereadiness'
              | 'unknown',
            blocking_reason:
              typeof scoreRecord.blocking_reason === 'string' ? scoreRecord.blocking_reason : undefined,
            re_readiness_required:
              typeof scoreRecord.re_readiness_required === 'boolean'
                ? scoreRecord.re_readiness_required
                : undefined,
            drift_severity:
              scoreRecord.drift_severity === 'major' || scoreRecord.drift_severity === 'critical'
                ? scoreRecord.drift_severity
                : scoreRecord.drift_severity === 'none'
                  ? 'none'
                  : undefined,
          }
        : null,
  });

  recordLatestReviewerCloseout(normalizedInput.projectRoot, {
    canMainAgentContinue: canMainAgentContinueFromCloseout({
      closeoutApproved: isReviewCloseoutApproved(closeoutEnvelope),
      scoreWriteResult:
        scoringFailureMode === 'succeeded'
          ? 'ok'
          : scoringFailureMode === 'non_blocking_failure'
            ? 'failed'
            : null,
      handoffPersisted: true,
      latestGateDecision: isReviewCloseoutApproved(closeoutEnvelope) ? 'pass' : 'true_blocker',
      fourSignalStatus: requiredFixesFromReport.length > 0 ? 'block' : 'pass',
    }),
    updatedAt: new Date().toISOString(),
    runner: 'runAuditorHost',
    profile: consumer.profile,
    stage: consumer.closeoutStage,
    artifactPath: effectiveArtifactDocPath,
    reportPath: resolvedReportPath,
    auditStatus: status,
    closeoutApproved: isReviewCloseoutApproved(closeoutEnvelope),
    governanceClosure,
      closeoutEnvelope,
      scoreWriteResult:
        scoringFailureMode === 'succeeded'
          ? 'ok'
          : scoringFailureMode === 'non_blocking_failure'
            ? 'failed'
            : null,
      handoffPersisted: true,
      ...(typeof scoreRecord?.readiness_baseline_run_id === 'string'
        ? { readinessBaselineRunId: scoreRecord.readiness_baseline_run_id }
        : {}),
      ...(Array.isArray(scoreRecord?.drift_signals)
        ? { driftSignals: scoreRecord.drift_signals as string[] }
        : {}),
      ...(Array.isArray(scoreRecord?.drifted_dimensions)
        ? { driftedDimensions: scoreRecord.drifted_dimensions as string[] }
        : {}),
      ...(typeof scoreRecord?.drift_severity === 'string'
        ? {
            driftSeverity:
              scoreRecord.drift_severity === 'major' ||
              scoreRecord.drift_severity === 'critical' ||
              scoreRecord.drift_severity === 'none'
                ? scoreRecord.drift_severity
                : null,
          }
        : {}),
      ...(typeof scoreRecord?.re_readiness_required === 'boolean'
        ? { reReadinessRequired: scoreRecord.re_readiness_required }
        : {}),
      ...(typeof scoreRecord?.blocking_reason === 'string'
        ? { blockingReason: scoreRecord.blocking_reason }
        : {}),
      ...(typeof scoreRecord?.effective_verdict === 'string'
        ? { effectiveVerdict: scoreRecord.effective_verdict }
        : {}),
      ...(scoreError ? { scoreError } : {}),
    });

  if (isOrphanCloseoutStage(consumer.closeoutStage)) {
    recordAuthoritativeAuditCloseout(normalizedInput.projectRoot, {
      flow: consumer.closeoutStage,
      artifactDocPath: effectiveArtifactDocPath,
      reportPath: resolvedReportPath,
      status,
      closeoutApproved: isReviewCloseoutApproved(closeoutEnvelope),
    });
    invalidateImplementationEntryGates(normalizedInput.projectRoot, {
      flow: consumer.closeoutStage,
    });
  } else if (consumer.closeoutStage === 'story') {
    invalidateImplementationEntryGates(normalizedInput.projectRoot, {
      flow: 'story',
    });
  }

  return {
    status,
    governanceClosure,
    closeoutEnvelope,
    ...(scoreRecord ? { scoreRecord } : {}),
    ...(scoreError ? { scoreError } : {}),
  };
}

export async function mainRunAuditorHost(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const projectRoot = args.projectRoot?.trim();
  const stage = args.stage?.trim();
  const artifactPath = args.artifactPath?.trim();

  if (!projectRoot || !stage || !artifactPath) {
    console.error(
      'run-auditor-host: usage --projectRoot <path> --stage <stage> --artifactPath <path> [--reportPath <path>] [--iterationCount <n>]'
    );
    return 1;
  }

  try {
    const result = await runAuditorHost({
      projectRoot,
      stage: stage as RunAuditorHostInput['stage'],
      artifactPath,
      reportPath: args.reportPath,
      iterationCount: args.iterationCount,
    });
    process.stdout.write(JSON.stringify(result));
    return result.status === 'PASS' && isReviewCloseoutApproved(result.closeoutEnvelope) ? 0 : 1;
  } catch (error) {
    console.error(`run-auditor-host: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (require.main === module) {
  mainRunAuditorHost(process.argv.slice(2)).then((code) => process.exit(code));
}
