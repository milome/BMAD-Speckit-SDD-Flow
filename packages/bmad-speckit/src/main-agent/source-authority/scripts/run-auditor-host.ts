/* eslint-disable no-console, @typescript-eslint/no-require-imports */

import { execSync } from 'child_process';
import { createHash, randomUUID } from 'node:crypto';
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
import { appendControlEventAndReplay } from './requirement-record-control-store';
const { scoreCommand: defaultScoreCommand } =
  require('../packages/bmad-speckit/src/commands/score.ts') as {
    scoreCommand: (opts: Record<string, unknown>) => Promise<unknown>;
  };

interface ControlledAuditBinding {
  roundId: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  projectionSetHash: string;
  currentAttemptHash: string;
  currentEvidenceHash: string;
}

interface BoundReceiptRef {
  path: string;
  contentHash: string;
  receiptHash: string;
}

type RunAuditorHostInput = RunAuditorHostInvocationInput & {
  controlledAuditBinding?: ControlledAuditBinding;
};

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
  scoreReceiptRef?: BoundReceiptRef;
  runAuditorHostReceiptRef?: BoundReceiptRef;
}

type LatestCloseoutPayload = Parameters<typeof recordLatestReviewerCloseout>[1];

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256Json(value: unknown): string {
  return sha256Text(stableStringify(value));
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function safeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/gu, '-') || 'unknown';
}

function assertCanonicalHash(field: string, value: string): void {
  if (!/^sha256:[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`run_auditor_host_controlled_binding_hash_invalid:${field}`);
  }
}

function assertPathWithinRoot(projectRoot: string, candidatePath: string): string {
  const root = path.resolve(projectRoot);
  const candidate = path.resolve(candidatePath);
  const relative = path.relative(root, candidate);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('run_auditor_host_controlled_output_outside_project_root');
  }
  return candidate;
}

function rootRelativePath(projectRoot: string, candidatePath: string): string {
  return path.relative(path.resolve(projectRoot), path.resolve(candidatePath)).replace(/\\/gu, '/');
}

function readJsonRecord(filePath: string): Record<string, unknown> {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`run_auditor_host_json_record_invalid:${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

function writeImmutableReceipt(
  projectRoot: string,
  receiptPath: string,
  payload: Record<string, unknown>
): { receipt: Record<string, unknown>; ref: BoundReceiptRef } {
  const resolvedPath = assertPathWithinRoot(projectRoot, receiptPath);
  const receipt = {
    ...payload,
    receiptHash: sha256Json(payload),
  };
  if (fs.existsSync(resolvedPath)) {
    const existing = readJsonRecord(resolvedPath);
    if (stableStringify(existing) !== stableStringify(receipt)) {
      throw new Error(`run_auditor_host_receipt_conflict:${rootRelativePath(projectRoot, resolvedPath)}`);
    }
  } else {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temporaryPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
      fs.renameSync(temporaryPath, resolvedPath);
    } finally {
      if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
    }
  }
  return {
    receipt,
    ref: {
      path: rootRelativePath(projectRoot, resolvedPath),
      contentHash: sha256File(resolvedPath),
      receiptHash: String(receipt.receiptHash),
    },
  };
}

function resolveControlledAuditContext(input: {
  projectRoot: string;
  reportPath: string;
  binding?: ControlledAuditBinding;
}):
  | {
      binding: ControlledAuditBinding;
      scoreRunId: string;
      scoreDataPath: string;
      scoreRecordPath: string;
      receiptDir: string;
    }
  | undefined {
  const binding = input.binding;
  if (!binding) return undefined;
  if (!binding.roundId.trim()) {
    throw new Error('run_auditor_host_controlled_binding_round_id_missing');
  }
  for (const [field, value] of [
    ['sourceDocumentHash', binding.sourceDocumentHash],
    ['semanticModelHash', binding.semanticModelHash],
    ['projectionSetHash', binding.projectionSetHash],
    ['currentAttemptHash', binding.currentAttemptHash],
    ['currentEvidenceHash', binding.currentEvidenceHash],
  ] as const) {
    assertCanonicalHash(field, value);
  }
  const scoreRunId = `audit-${sha256Json(binding).slice('sha256:'.length, 39)}`;
  const scoreDataPath = assertPathWithinRoot(
    input.projectRoot,
    path.join(input.projectRoot, '_bmad-output', 'scoring')
  );
  return {
    binding,
    scoreRunId,
    scoreDataPath,
    scoreRecordPath: path.join(scoreDataPath, `${scoreRunId}.json`),
    receiptDir: assertPathWithinRoot(
      input.projectRoot,
      path.join(path.dirname(input.reportPath), 'run-auditor-host', safeSegment(binding.roundId))
    ),
  };
}

function validateControlledScoreRecord(input: {
  scoreRecord: Record<string, unknown>;
  scoreRunId: string;
  expectedStage: string;
  reportPath: string;
  artifactPath: string;
}): void {
  const expectedReportHash = sha256File(input.reportPath).slice('sha256:'.length);
  const expectedArtifactHash = sha256File(input.artifactPath).slice('sha256:'.length);
  if (
    input.scoreRecord.run_id !== input.scoreRunId ||
    input.scoreRecord.stage !== input.expectedStage ||
    input.scoreRecord.scenario !== 'real_dev'
  ) {
    throw new Error('run_auditor_host_controlled_score_identity_mismatch');
  }
  if (input.scoreRecord.content_hash !== expectedReportHash) {
    throw new Error('run_auditor_host_controlled_score_report_hash_mismatch');
  }
  if (input.scoreRecord.source_hash !== expectedArtifactHash) {
    throw new Error('run_auditor_host_controlled_score_artifact_hash_mismatch');
  }
  if (
    typeof input.scoreRecord.dimension_contract_id !== 'string' ||
    !Array.isArray(input.scoreRecord.expected_dimensions) ||
    !Array.isArray(input.scoreRecord.dimension_scores) ||
    typeof input.scoreRecord.phase_score !== 'number' ||
    typeof input.scoreRecord.iteration_count !== 'number'
  ) {
    throw new Error('run_auditor_host_controlled_score_contract_incomplete');
  }
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

function syncLatestReviewerCloseoutToRequirementRecord(
  projectRoot: string,
  closeout: LatestCloseoutPayload
): void {
  try {
    const indexPath = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      'index.json'
    );
    if (!fs.existsSync(indexPath)) return;
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as {
      active?: { requirementSetId?: string };
    };
    const requirementSetId = index.active?.requirementSetId;
    if (!requirementSetId) return;
    const recordPath = path.join(
      projectRoot,
      '_bmad-output',
      'runtime',
      'requirement-records',
      requirementSetId,
      'requirement-record.json'
    );
    if (!fs.existsSync(recordPath)) return;
    appendControlEventAndReplay({
      recordPath,
      writerId: 'run-auditor-host-closeout-sync',
      eventType: 'latest_reviewer_closeout_synced',
      payload: closeout as unknown as Record<string, unknown>,
      reduce: (record) => ({
        ...record,
        latestReviewerCloseout: closeout as unknown as Record<string, unknown>,
        lastEventType: 'latest_reviewer_closeout_synced',
        updatedAt: closeout.updatedAt,
      }),
      skipSchemaGate: true,
    });
  } catch {
    // Legacy closeout surfaces may not have an active requirement record; keep existing registry behavior.
  }
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
    normalizeComparablePath(input.parsedArtifactDocPath!) !==
    normalizeComparablePath(input.artifactPath)
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
      reportPath: input.reportPath ?? resolveDefaultReportPath(input.stage, input.artifactPath),
      ...(input.iterationCount !== undefined ? { iterationCount: input.iterationCount } : {}),
    })
  );
  const hostStage = input.stage;
  const resolvedReportPath = normalizedInput.reportPath!;
  const controlledAudit = resolveControlledAuditContext({
    projectRoot: normalizedInput.projectRoot,
    reportPath: resolvedReportPath,
    binding: input.controlledAuditBinding,
  });

  const auditorScript = path.resolve(
    normalizedInput.projectRoot,
    `scripts/${consumer.auditorScript}.ts`
  );

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
        ? Array.from(
            { length: parsed.requiredFixesCount },
            (_, index) => `Required fix #${index + 1}`
          )
        : [];

  const scoreCommand = controlledAudit ? defaultScoreCommand : (deps.scoreCommand ?? defaultScoreCommand);
  const loadLatestRecordForStage = deps.loadLatestRecordByStage ?? loadLatestRecordByStage;
  const checkPreconditionHashFn = deps.checkPreconditionHash ?? checkPreconditionHash;
  let scoreRecord: Record<string, unknown> | undefined;
  let scoreError: string | undefined;
  let scoringFailureMode: 'not_run' | 'succeeded' | 'non_blocking_failure' =
    parsed.scoreTriggerPresent ? 'succeeded' : 'not_run';
  let storySpecVersionLock: VersionLockResult | undefined;

  if (hostStage === 'spec' && isStoryFlowSpecArtifact(effectiveArtifactDocPath)) {
    if (!parsedStoryPath) {
      throw new Error('story-flow spec closeout missing required fields: storyPath');
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
  } else if (parsed.scoreTriggerPresent) {
    try {
      if (!controlledAudit || !fs.existsSync(controlledAudit.scoreRecordPath)) {
        const scoreResult = await scoreCommand({
          reportPath: resolvedReportPath,
          stage: inferScoreStage(hostStage, effectiveArtifactDocPath),
          artifactDocPath: effectiveArtifactDocPath,
          sourceHashFilePath: effectiveArtifactDocPath,
          event: inferEvent(hostStage),
          triggerStage: inferTriggerStage(hostStage),
          iterationCount: String(normalizedInput.iterationCount ?? parsed.iterationCount ?? '0'),
          skipTriggerCheck: true,
          ...(controlledAudit
            ? {
                runId: controlledAudit.scoreRunId,
                dataPath: controlledAudit.scoreDataPath,
              }
            : {}),
        });

        if (!controlledAudit && scoreResult && typeof scoreResult === 'object') {
          const candidate = scoreResult as {
            parsedRecord?: Record<string, unknown>;
            record?: Record<string, unknown>;
          };
          scoreRecord = candidate.parsedRecord ?? candidate.record;
        }
      }
      if (controlledAudit) {
        if (!fs.existsSync(controlledAudit.scoreRecordPath)) {
          throw new Error('controlled_score_record_missing_after_writer');
        }
        scoreRecord = readJsonRecord(controlledAudit.scoreRecordPath);
        validateControlledScoreRecord({
          scoreRecord,
          scoreRunId: controlledAudit.scoreRunId,
          expectedStage: inferScoreStage(hostStage, effectiveArtifactDocPath),
          reportPath: resolvedReportPath,
          artifactPath: effectiveArtifactDocPath,
        });
      }
    } catch (error) {
      scoreError = error instanceof Error ? error.message : String(error);
      if (controlledAudit) {
        throw new Error(`run_auditor_host_controlled_score_write_failed:${scoreError}`);
      }
      scoringFailureMode = 'non_blocking_failure';
      console.error(`run-auditor-host: score write failure blocks closeout: ${scoreError}`);
    }
  } else if (controlledAudit) {
    throw new Error('run_auditor_host_controlled_score_trigger_missing');
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
      scoreRecord && typeof scoreRecord.effective_verdict === 'string'
        ? {
            effective_verdict: scoreRecord.effective_verdict as
              | 'approved'
              | 'required_fixes'
              | 'blocked'
              | 'blocked_pending_rereadiness'
              | 'unknown',
            blocking_reason:
              typeof scoreRecord.blocking_reason === 'string'
                ? scoreRecord.blocking_reason
                : undefined,
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
  let scoreReceiptRef: BoundReceiptRef | undefined;
  let runAuditorHostReceiptRef: BoundReceiptRef | undefined;
  let scoreReceiptHash: string | undefined;
  if (controlledAudit && scoreRecord) {
    const scoreReceiptResult = writeImmutableReceipt(
      normalizedInput.projectRoot,
      path.join(controlledAudit.receiptDir, 'score-materialization-receipt.json'),
      {
        schemaVersion: 'run-auditor-host-score-receipt/v1',
        producerIdentity: {
          id: 'runAuditorHost',
          role: 'score_materializer',
        },
        roundId: controlledAudit.binding.roundId,
        scoreRunId: controlledAudit.scoreRunId,
        stage: String(scoreRecord.stage),
        auditReportPath: rootRelativePath(normalizedInput.projectRoot, resolvedReportPath),
        auditReportHash: sha256File(resolvedReportPath),
        artifactPath: rootRelativePath(normalizedInput.projectRoot, effectiveArtifactDocPath),
        artifactHash: sha256File(effectiveArtifactDocPath),
        scoreRecordPath: rootRelativePath(
          normalizedInput.projectRoot,
          controlledAudit.scoreRecordPath
        ),
        scoreRecordHash: sha256File(controlledAudit.scoreRecordPath),
        scoreWriteStatus: 'written',
        dimensionContractId: scoreRecord.dimension_contract_id,
        dimensionMode: scoreRecord.dimension_mode,
        expectedDimensions: scoreRecord.expected_dimensions,
        dimensionScores: scoreRecord.dimension_scores,
        phaseScore: scoreRecord.phase_score,
        vetoTriggered: scoreRecord.veto_triggered === true,
        iterationCount: scoreRecord.iteration_count,
        sourceDocumentHash: controlledAudit.binding.sourceDocumentHash,
        semanticModelHash: controlledAudit.binding.semanticModelHash,
        projectionSetHash: controlledAudit.binding.projectionSetHash,
        currentAttemptHash: controlledAudit.binding.currentAttemptHash,
        currentEvidenceHash: controlledAudit.binding.currentEvidenceHash,
      }
    );
    scoreReceiptRef = scoreReceiptResult.ref;
    scoreReceiptHash = String(scoreReceiptResult.receipt.receiptHash);
  }

  const latestCloseout: LatestCloseoutPayload = {
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
  };
  recordLatestReviewerCloseout(normalizedInput.projectRoot, latestCloseout);
  syncLatestReviewerCloseoutToRequirementRecord(normalizedInput.projectRoot, latestCloseout);
  if (controlledAudit && scoreReceiptRef && scoreReceiptHash) {
    runAuditorHostReceiptRef = writeImmutableReceipt(
      normalizedInput.projectRoot,
      path.join(controlledAudit.receiptDir, 'host-closeout-receipt.json'),
      {
        schemaVersion: 'run-auditor-host-closeout-receipt/v1',
        producerIdentity: {
          id: 'runAuditorHost',
          role: 'host_closeout',
        },
        roundId: controlledAudit.binding.roundId,
        auditStatus: status,
        closeoutApproved: isReviewCloseoutApproved(closeoutEnvelope),
        governanceClosureHash: sha256Json(governanceClosure),
        closeoutEnvelopeHash: sha256Json(closeoutEnvelope),
        scoreReceiptPath: scoreReceiptRef.path,
        scoreReceiptHash,
        scoreRecordPath: rootRelativePath(
          normalizedInput.projectRoot,
          controlledAudit.scoreRecordPath
        ),
        scoreRecordHash: sha256File(controlledAudit.scoreRecordPath),
        sourceDocumentHash: controlledAudit.binding.sourceDocumentHash,
        semanticModelHash: controlledAudit.binding.semanticModelHash,
        projectionSetHash: controlledAudit.binding.projectionSetHash,
        currentAttemptHash: controlledAudit.binding.currentAttemptHash,
        currentEvidenceHash: controlledAudit.binding.currentEvidenceHash,
      }
    ).ref;
  }

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
    ...(scoreReceiptRef ? { scoreReceiptRef } : {}),
    ...(runAuditorHostReceiptRef ? { runAuditorHostReceiptRef } : {}),
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

function isDirectRunAuditorHostCli(entry: string | undefined): boolean {
  return /(^|[\\/])run-auditor-host(\.[cm]?js|\.ts)?$/iu.test(entry ?? '');
}

if (require.main === module && isDirectRunAuditorHostCli(process.argv[1])) {
  mainRunAuditorHost(process.argv.slice(2)).then((code) => process.exit(code));
}
