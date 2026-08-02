/* eslint-disable no-console, @typescript-eslint/no-require-imports */

import { execSync } from 'child_process';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
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
import { resolveScoringDimensionContract } from '../packages/scoring/contracts/dimension-contracts';
import { appendControlEventAndReplay } from './requirement-record-control-store';
import { deriveAuditHostCompatibilityProjection } from './requirements-contract-audit-host-compatibility-projection';
const { scoreCommand: defaultScoreCommand } =
  require('../packages/bmad-speckit/src/commands/score.ts') as {
    scoreCommand: (opts: Record<string, unknown>) => Promise<unknown>;
  };
type ScoreCommand = typeof defaultScoreCommand;

interface ControlledAuditBinding {
  roundId: string;
  runAuditorHostInvocationId: string;
  auditEpochId: string;
  auditTargetBundleHash: string;
  sourceDocumentHash: string;
  semanticModelHash: string;
  implementationConfirmationHash: string;
  projectionSetHash: string;
  qualityRuleSetHash: string;
  criticalAuditorProfileHash: string;
  criticalAuditorStageProfileHash: string;
  requiredCheckItemSetHash: string;
  currentAttemptHash: string;
  currentEvidenceHash: string;
  readonlyAuditorRequestHash: string;
  readonlyAuditorResponseHash: string;
  readonlyAuditorHostInvocationReceiptRef: BoundReceiptRef;
  judgeRequestHash: string;
  judgeExecutionReceiptRef: BoundReceiptRef;
  judgeProviderInvocationReceiptRef: BoundReceiptRef;
  judgeAuthoritativeReportHash: string;
  judgeAuditReviewScoringContractHash: string;
  judgeAuditReviewScoringHash: string;
}

interface BoundReceiptRef {
  path: string;
  contentHash: string;
  receiptHash: string;
}

interface ControlledAuditContext {
  binding: ControlledAuditBinding;
  bindingHash: string;
  judgeVerdict: string;
  judgeAuditReviewScoring: Record<string, unknown>;
  judgeAuditReviewScoringContractHash: string;
  scoreDataPath: string;
  receiptDir: string;
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
  scoreWriterInvocationReceiptRef?: BoundReceiptRef;
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

function assertBoundReceiptRef(field: string, value: BoundReceiptRef): void {
  if (!value || typeof value !== 'object') {
    throw new Error(`run_auditor_host_controlled_binding_receipt_ref_missing:${field}`);
  }
  if (!value.path?.trim()) {
    throw new Error(`run_auditor_host_controlled_binding_receipt_path_missing:${field}`);
  }
  assertCanonicalHash(`${field}.contentHash`, value.contentHash);
  assertCanonicalHash(`${field}.receiptHash`, value.receiptHash);
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

function writeJsonAtomic(projectRoot: string, filePath: string, value: unknown): void {
  const resolvedPath = assertPathWithinRoot(projectRoot, filePath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const temporaryPath = `${resolvedPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fs.renameSync(temporaryPath, resolvedPath);
  } finally {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
  }
}

function readBoundReceipt(input: {
  projectRoot: string;
  ref: BoundReceiptRef;
  expectedSchemaVersion: string;
  errorCode: string;
}): { path: string; receipt: Record<string, unknown> } {
  assertBoundReceiptRef(input.errorCode, input.ref);
  const receiptPath = assertPathWithinRoot(
    input.projectRoot,
    path.resolve(input.projectRoot, input.ref.path)
  );
  if (!fs.existsSync(receiptPath)) {
    throw new Error(`${input.errorCode}_missing`);
  }
  const receipt = readJsonRecord(receiptPath);
  const receiptWithoutHash = { ...receipt };
  delete receiptWithoutHash.receiptHash;
  if (
    receipt.schemaVersion !== input.expectedSchemaVersion ||
    input.ref.contentHash !== sha256File(receiptPath) ||
    input.ref.receiptHash !== receipt.receiptHash ||
    receipt.receiptHash !== sha256Json(receiptWithoutHash)
  ) {
    throw new Error(`${input.errorCode}_invalid`);
  }
  return { path: receiptPath, receipt };
}

function controlledRoundIndex(roundId: string): number {
  const match = /^round-([1-9]\d*)$/u.exec(roundId);
  if (!match) throw new Error('run_auditor_host_controlled_binding_round_id_invalid');
  return Number(match[1]);
}

function assertUuidV4(field: string, value: string): void {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value
    )
  ) {
    throw new Error(`run_auditor_host_controlled_binding_uuid_invalid:${field}`);
  }
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
}): ControlledAuditContext | undefined {
  const binding = input.binding;
  if (!binding) return undefined;
  if (!binding.roundId.trim()) {
    throw new Error('run_auditor_host_controlled_binding_round_id_missing');
  }
  const roundIndex = controlledRoundIndex(binding.roundId);
  assertUuidV4('runAuditorHostInvocationId', binding.runAuditorHostInvocationId);
  for (const [field, value] of [
    ['auditEpochId', binding.auditEpochId],
    ['auditTargetBundleHash', binding.auditTargetBundleHash],
    ['sourceDocumentHash', binding.sourceDocumentHash],
    ['semanticModelHash', binding.semanticModelHash],
    ['implementationConfirmationHash', binding.implementationConfirmationHash],
    ['projectionSetHash', binding.projectionSetHash],
    ['qualityRuleSetHash', binding.qualityRuleSetHash],
    ['criticalAuditorProfileHash', binding.criticalAuditorProfileHash],
    ['criticalAuditorStageProfileHash', binding.criticalAuditorStageProfileHash],
    ['requiredCheckItemSetHash', binding.requiredCheckItemSetHash],
    ['currentAttemptHash', binding.currentAttemptHash],
    ['currentEvidenceHash', binding.currentEvidenceHash],
    ['readonlyAuditorRequestHash', binding.readonlyAuditorRequestHash],
    ['readonlyAuditorResponseHash', binding.readonlyAuditorResponseHash],
    ['judgeRequestHash', binding.judgeRequestHash],
    ['judgeAuthoritativeReportHash', binding.judgeAuthoritativeReportHash],
    ['judgeAuditReviewScoringContractHash', binding.judgeAuditReviewScoringContractHash],
    ['judgeAuditReviewScoringHash', binding.judgeAuditReviewScoringHash],
  ] as const) {
    assertCanonicalHash(field, value);
  }
  assertBoundReceiptRef(
    'readonlyAuditorHostInvocationReceiptRef',
    binding.readonlyAuditorHostInvocationReceiptRef
  );
  assertBoundReceiptRef('judgeExecutionReceiptRef', binding.judgeExecutionReceiptRef);
  assertBoundReceiptRef(
    'judgeProviderInvocationReceiptRef',
    binding.judgeProviderInvocationReceiptRef
  );
  if (
    !fs.existsSync(input.reportPath) ||
    sha256File(input.reportPath) !== binding.judgeAuthoritativeReportHash
  ) {
    throw new Error('run_auditor_host_controlled_judge_report_hash_mismatch');
  }
  const readonlyHost = readBoundReceipt({
    projectRoot: input.projectRoot,
    ref: binding.readonlyAuditorHostInvocationReceiptRef,
    expectedSchemaVersion: 'audit-readonly-auditor-host-invocation-receipt/v1',
    errorCode: 'run_auditor_host_controlled_readonly_host_receipt',
  }).receipt;
  if (
    readonlyHost.auditEpochId !== binding.auditEpochId ||
    readonlyHost.auditTargetBundleHash !== binding.auditTargetBundleHash ||
    Number(readonlyHost.roundIndex) !== roundIndex ||
    readonlyHost.requestHash !== binding.readonlyAuditorRequestHash ||
    readonlyHost.responseHash !== binding.readonlyAuditorResponseHash ||
    readonlyHost.responseProduced !== true ||
    Number(readonlyHost.exitCode) !== 0
  ) {
    throw new Error('run_auditor_host_controlled_readonly_host_receipt_binding_mismatch');
  }
  const judgeExecution = readBoundReceipt({
    projectRoot: input.projectRoot,
    ref: binding.judgeExecutionReceiptRef,
    expectedSchemaVersion: 'audit-judge-execution-receipt/v1',
    errorCode: 'run_auditor_host_controlled_judge_execution_receipt',
  }).receipt;
  const judgeProviderReceiptRef =
    judgeExecution.providerInvocationReceiptRef as BoundReceiptRef | undefined;
  const judgeVerdict = String(judgeExecution.verdict ?? '').trim();
  const judgeAuditReviewScoring =
    judgeExecution.auditReviewScoring &&
    typeof judgeExecution.auditReviewScoring === 'object' &&
    !Array.isArray(judgeExecution.auditReviewScoring)
      ? (judgeExecution.auditReviewScoring as Record<string, unknown>)
      : null;
  const judgeAuditReviewScoringContractHash = String(
    judgeExecution.auditReviewScoringContractHash ?? ''
  );
  if (
    judgeExecution.auditEpochId !== binding.auditEpochId ||
    judgeExecution.auditTargetBundleHash !== binding.auditTargetBundleHash ||
    Number(judgeExecution.roundIndex) !== roundIndex ||
    judgeExecution.judgeRequestHash !== binding.judgeRequestHash ||
    judgeExecution.readonlyAuditorResponseHash !== binding.readonlyAuditorResponseHash ||
    !judgeAuditReviewScoring ||
    sha256Json(judgeAuditReviewScoring) !== binding.judgeAuditReviewScoringHash ||
    judgeAuditReviewScoringContractHash !== binding.judgeAuditReviewScoringContractHash ||
    stableStringify(judgeProviderReceiptRef) !==
      stableStringify(binding.judgeProviderInvocationReceiptRef) ||
    !['no_new_valid_gap', 'no_new_confirmation_blocking_gap'].includes(judgeVerdict)
  ) {
    throw new Error('run_auditor_host_controlled_judge_execution_receipt_binding_mismatch');
  }
  const judgeProvider = readBoundReceipt({
    projectRoot: input.projectRoot,
    ref: binding.judgeProviderInvocationReceiptRef,
    expectedSchemaVersion: 'critical-auditor-judge-invocation-receipt/v1',
    errorCode: 'run_auditor_host_controlled_judge_provider_receipt',
  }).receipt;
  if (
    judgeProvider.requestHash !== binding.judgeRequestHash ||
    judgeProvider.sourceDocumentHash !== binding.sourceDocumentHash ||
    judgeProvider.semanticModelHash !== binding.semanticModelHash ||
    judgeProvider.projectionSetHash !== binding.projectionSetHash
  ) {
    throw new Error('run_auditor_host_controlled_judge_provider_receipt_binding_mismatch');
  }
  const scoreDataPath = assertPathWithinRoot(
    input.projectRoot,
    path.join(input.projectRoot, '_bmad-output', 'scoring')
  );
  return {
    binding,
    bindingHash: sha256Json(binding),
    judgeVerdict,
    judgeAuditReviewScoring,
    judgeAuditReviewScoringContractHash,
    scoreDataPath,
    receiptDir: assertPathWithinRoot(
      input.projectRoot,
      path.join(path.dirname(input.reportPath), 'run-auditor-host', safeSegment(binding.roundId))
    ),
  };
}

function validateControlledScoreRecord(input: {
  projectRoot: string;
  scoreRecord: Record<string, unknown>;
  scoreRunId: string;
  expectedStage: string;
  reportPath: string;
  artifactPath: string;
  judgeAuditReviewScoring: Record<string, unknown>;
}): {
  scoringPolicyPath: string;
  scoringPolicyHash: string;
  minimumPhaseScore: number;
  thresholdPassed: boolean;
} {
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
    typeof input.scoreRecord.dimension_mode !== 'string' ||
    !Array.isArray(input.scoreRecord.expected_dimensions) ||
    !Array.isArray(input.scoreRecord.dimension_scores) ||
    typeof input.scoreRecord.phase_score !== 'number' ||
    !Number.isFinite(input.scoreRecord.phase_score) ||
    typeof input.scoreRecord.iteration_count !== 'number' ||
    !Number.isInteger(input.scoreRecord.iteration_count) ||
    input.scoreRecord.iteration_count < 0
  ) {
    throw new Error('run_auditor_host_controlled_score_contract_incomplete');
  }
  const expectedContract = resolveScoringDimensionContract({ stage: input.expectedStage });
  if (
    expectedContract.status !== 'resolved' ||
    input.scoreRecord.dimension_contract_id !== expectedContract.dimensionContractId ||
    input.scoreRecord.dimension_mode !== expectedContract.dimensionMode
  ) {
    throw new Error('run_auditor_host_controlled_score_dimension_contract_mismatch');
  }
  const dimensionScores = input.scoreRecord.dimension_scores as Array<Record<string, unknown>>;
  const scoreByDimension = new Map(
    dimensionScores.map((row) => [String(row.dimension ?? '').trim(), row.score])
  );
  const scoreExpectedDimensions = (input.scoreRecord.expected_dimensions as unknown[]).map(String);
  if (
    scoreExpectedDimensions.some((dimension) => {
      const score = scoreByDimension.get(dimension);
      return typeof score !== 'number' || !Number.isFinite(score);
    })
  ) {
    throw new Error('run_auditor_host_controlled_score_dimension_scores_incomplete');
  }
  const scoringPolicyPath = assertPathWithinRoot(
    input.projectRoot,
    path.join(input.projectRoot, '_bmad', '_config', 'scoring-policy.contract.yaml')
  );
  if (!fs.existsSync(scoringPolicyPath)) {
    throw new Error('run_auditor_host_controlled_scoring_policy_missing');
  }
  const policy = yaml.load(fs.readFileSync(scoringPolicyPath, 'utf8')) as Record<string, unknown>;
  const passThresholds = policy?.passThresholds as Record<string, unknown> | undefined;
  const byStage = passThresholds?.byStage as Record<string, unknown> | undefined;
  const minimumPhaseScore = Number(
    byStage?.[input.expectedStage] ?? byStage?.audit_closeout ?? passThresholds?.default
  );
  if (
    policy?.schemaVersion !== 'scoring-policy.contract/v1' ||
    !Number.isFinite(minimumPhaseScore) ||
    minimumPhaseScore < 0 ||
    minimumPhaseScore > 100
  ) {
    throw new Error('run_auditor_host_controlled_scoring_policy_invalid');
  }
  const thresholdPassed = Number(input.scoreRecord.phase_score) >= minimumPhaseScore;
  return {
    scoringPolicyPath,
    scoringPolicyHash: sha256File(scoringPolicyPath),
    minimumPhaseScore,
    thresholdPassed,
  };
}

function controlledScoreWriterState(
  projectRoot: string,
  statePath: string,
  value: Record<string, unknown>
): Record<string, unknown> {
  const stateWithoutHash = { ...value };
  delete stateWithoutHash.stateHash;
  const state = {
    ...stateWithoutHash,
    stateHash: sha256Json(stateWithoutHash),
  };
  writeJsonAtomic(projectRoot, statePath, state);
  return state;
}

async function executeControlledScoreWriter(input: {
  projectRoot: string;
  controlledAudit: ControlledAuditContext;
  expectedStage: string;
  reportPath: string;
  artifactPath: string;
  iterationCount: string;
  event: string;
  triggerStage?: string;
  scoreCommand: ScoreCommand;
}): Promise<{
  scoreRecord: Record<string, unknown>;
  scoreRunId: string;
  scoreRecordPath: string;
  scoreWriterInvocationReceiptRef: BoundReceiptRef;
  scoreEvaluation: {
    scoringPolicyPath: string;
    scoringPolicyHash: string;
    minimumPhaseScore: number;
    thresholdPassed: boolean;
  };
}> {
  const receiptPath = path.join(
    input.controlledAudit.receiptDir,
    'score-writer-invocation-receipt.json'
  );
  const statePath = path.join(
    input.controlledAudit.receiptDir,
    'score-writer-invocation-state.json'
  );
  if (fs.existsSync(receiptPath)) {
    const receipt = readJsonRecord(receiptPath);
    const receiptRef: BoundReceiptRef = {
      path: rootRelativePath(input.projectRoot, receiptPath),
      contentHash: sha256File(receiptPath),
      receiptHash: String(receipt.receiptHash ?? ''),
    };
    const committed = readBoundReceipt({
      projectRoot: input.projectRoot,
      ref: receiptRef,
      expectedSchemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
      errorCode: 'run_auditor_host_controlled_score_writer_receipt',
    }).receipt;
    const scoreRunId = String(committed.scoreRunId ?? '');
    const scoreRecordPath = assertPathWithinRoot(
      input.projectRoot,
      path.resolve(input.projectRoot, String(committed.scoreRecordPath ?? ''))
    );
    const state = fs.existsSync(statePath) ? readJsonRecord(statePath) : null;
    const stateWithoutHash = state ? { ...state } : null;
    if (stateWithoutHash) delete stateWithoutHash.stateHash;
    if (
      committed.producerIdentity === null ||
      typeof committed.producerIdentity !== 'object' ||
      Array.isArray(committed.producerIdentity) ||
      (committed.producerIdentity as Record<string, unknown>).id !==
        'package-score-command' ||
      (committed.producerIdentity as Record<string, unknown>).role !== 'score_writer' ||
      committed.runAuditorHostInvocationId !==
        input.controlledAudit.binding.runAuditorHostInvocationId ||
      committed.bindingHash !== input.controlledAudit.bindingHash ||
      committed.roundId !== input.controlledAudit.binding.roundId ||
      committed.auditReportHash !== sha256File(input.reportPath) ||
      committed.artifactHash !== sha256File(input.artifactPath) ||
      committed.exitCode !== 0 ||
      !scoreRunId ||
      !fs.existsSync(scoreRecordPath) ||
      committed.scoreRecordHash !== sha256File(scoreRecordPath) ||
      !state ||
      state.schemaVersion !== 'run-auditor-host-score-writer-invocation-state/v1' ||
      state.status !== 'committed' ||
      state.runAuditorHostInvocationId !==
        input.controlledAudit.binding.runAuditorHostInvocationId ||
      state.invocationId !== committed.invocationId ||
      state.bindingHash !== input.controlledAudit.bindingHash ||
      state.roundId !== input.controlledAudit.binding.roundId ||
      state.scoreRunId !== scoreRunId ||
      state.scoreRecordPath !== committed.scoreRecordPath ||
      state.receiptHash !== committed.receiptHash ||
      state.receiptContentHash !== sha256File(receiptPath) ||
      state.stateHash !== sha256Json(stateWithoutHash)
    ) {
      throw new Error('run_auditor_host_controlled_score_writer_recovery_invalid');
    }
    const scoreRecord = readJsonRecord(scoreRecordPath);
    const scoreEvaluation = validateControlledScoreRecord({
      projectRoot: input.projectRoot,
      scoreRecord,
      scoreRunId,
      expectedStage: input.expectedStage,
      reportPath: input.reportPath,
      artifactPath: input.artifactPath,
      judgeAuditReviewScoring: input.controlledAudit.judgeAuditReviewScoring,
    });
    return {
      scoreRecord,
      scoreRunId,
      scoreRecordPath,
      scoreWriterInvocationReceiptRef: receiptRef,
      scoreEvaluation,
    };
  }

  const invocationId = randomUUID();
  const scoreRunId = `audit-${input.controlledAudit.bindingHash.slice('sha256:'.length, 23)}-${invocationId
    .replace(/-/gu, '')
    .slice(0, 12)}`;
  const scoreRecordPath = path.join(input.controlledAudit.scoreDataPath, `${scoreRunId}.json`);
  const startedAt = new Date().toISOString();
  const baseState = {
    schemaVersion: 'run-auditor-host-score-writer-invocation-state/v1',
    runAuditorHostInvocationId:
      input.controlledAudit.binding.runAuditorHostInvocationId,
    invocationId,
    bindingHash: input.controlledAudit.bindingHash,
    roundId: input.controlledAudit.binding.roundId,
    scoreRunId,
    scoreRecordPath: rootRelativePath(input.projectRoot, scoreRecordPath),
    startedAt,
  };
  controlledScoreWriterState(input.projectRoot, statePath, {
    ...baseState,
    status: 'prepared',
    completedAt: null,
    receiptHash: null,
    receiptContentHash: null,
    failureCode: null,
  });
  let scoreResult: unknown;
  try {
    scoreResult = await input.scoreCommand({
      reportPath: input.reportPath,
      stage: input.expectedStage,
      artifactDocPath: input.artifactPath,
      sourceHashFilePath: input.artifactPath,
      event: input.event,
      triggerStage: input.triggerStage,
      iterationCount: input.iterationCount,
      skipTriggerCheck: true,
      runId: scoreRunId,
      dataPath: input.controlledAudit.scoreDataPath,
      dimensionContractId: input.controlledAudit.judgeAuditReviewScoring.dimensionContractId,
      dimensionMode: input.controlledAudit.judgeAuditReviewScoring.dimensionMode,
      expectedDimensions: input.controlledAudit.judgeAuditReviewScoring.expectedDimensions,
    });
    if (!fs.existsSync(scoreRecordPath)) {
      throw new Error('controlled_score_record_missing_after_writer');
    }
    const scoreRecord = readJsonRecord(scoreRecordPath);
    const scoreEvaluation = validateControlledScoreRecord({
      projectRoot: input.projectRoot,
      scoreRecord,
      scoreRunId,
      expectedStage: input.expectedStage,
      reportPath: input.reportPath,
      artifactPath: input.artifactPath,
      judgeAuditReviewScoring: input.controlledAudit.judgeAuditReviewScoring,
    });
    const completedAt = new Date().toISOString();
    const receiptResult = writeImmutableReceipt(input.projectRoot, receiptPath, {
      schemaVersion: 'run-auditor-host-score-writer-invocation-receipt/v1',
      producerIdentity: {
        id: 'package-score-command',
        role: 'score_writer',
      },
      runAuditorHostInvocationId:
        input.controlledAudit.binding.runAuditorHostInvocationId,
      invocationId,
      bindingHash: input.controlledAudit.bindingHash,
      roundId: input.controlledAudit.binding.roundId,
      scoreRunId,
      auditReportPath: rootRelativePath(input.projectRoot, input.reportPath),
      auditReportHash: sha256File(input.reportPath),
      artifactPath: rootRelativePath(input.projectRoot, input.artifactPath),
      artifactHash: sha256File(input.artifactPath),
      scoreRecordPath: rootRelativePath(input.projectRoot, scoreRecordPath),
      scoreRecordHash: sha256File(scoreRecordPath),
      writerResultHash: sha256Json(scoreResult ?? null),
      scoringPolicyPath: rootRelativePath(
        input.projectRoot,
        scoreEvaluation.scoringPolicyPath
      ),
      scoringPolicyHash: scoreEvaluation.scoringPolicyHash,
      minimumPhaseScore: scoreEvaluation.minimumPhaseScore,
      thresholdPassed: scoreEvaluation.thresholdPassed,
      sourceDocumentHash: input.controlledAudit.binding.sourceDocumentHash,
      semanticModelHash: input.controlledAudit.binding.semanticModelHash,
      projectionSetHash: input.controlledAudit.binding.projectionSetHash,
      judgeExecutionReceiptPath: input.controlledAudit.binding.judgeExecutionReceiptRef.path,
      judgeExecutionReceiptHash:
        input.controlledAudit.binding.judgeExecutionReceiptRef.receiptHash,
      judgeAuditReviewScoringContractHash:
        input.controlledAudit.judgeAuditReviewScoringContractHash,
      judgeAuditReviewScoringHash:
        input.controlledAudit.binding.judgeAuditReviewScoringHash,
      startedAt,
      completedAt,
      exitCode: 0,
    });
    controlledScoreWriterState(input.projectRoot, statePath, {
      ...baseState,
      status: 'committed',
      completedAt,
      receiptHash: receiptResult.ref.receiptHash,
      receiptContentHash: receiptResult.ref.contentHash,
      failureCode: null,
    });
    return {
      scoreRecord,
      scoreRunId,
      scoreRecordPath,
      scoreWriterInvocationReceiptRef: receiptResult.ref,
      scoreEvaluation,
    };
  } catch (error) {
    controlledScoreWriterState(input.projectRoot, statePath, {
      ...baseState,
      status: 'failed',
      completedAt: new Date().toISOString(),
      receiptHash: null,
      receiptContentHash: null,
      failureCode: error instanceof Error ? error.message : String(error),
    });
    throw error;
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
    } else if (token === '--controlledAuditBindingFile' && argv[i + 1]) {
      out.controlledAuditBindingFile = argv[++i];
    } else if (token === '--resultPath' && argv[i + 1]) {
      out.resultPath = argv[++i];
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

  if (
    controlledAudit &&
    (deps.scoreCommand ||
      deps.executeAuditorScript ||
      deps.loadLatestRecordByStage ||
      deps.checkPreconditionHash)
  ) {
    throw new Error('run_auditor_host_controlled_dependency_injection_forbidden');
  }
  const scoreCommand = deps.scoreCommand ?? defaultScoreCommand;
  const loadLatestRecordForStage = deps.loadLatestRecordByStage ?? loadLatestRecordByStage;
  const checkPreconditionHashFn = deps.checkPreconditionHash ?? checkPreconditionHash;
  const expectedScoreStage = inferScoreStage(hostStage, effectiveArtifactDocPath);
  let scoreRecord: Record<string, unknown> | undefined;
  let scoreError: string | undefined;
  let scoreRunId: string | undefined;
  let scoreRecordPath: string | undefined;
  let scoreWriterInvocationReceiptRef: BoundReceiptRef | undefined;
  let controlledScoreEvaluation:
    | {
        scoringPolicyPath: string;
        scoringPolicyHash: string;
        minimumPhaseScore: number;
        thresholdPassed: boolean;
      }
    | undefined;
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
    if (controlledAudit) {
      throw new Error(`run_auditor_host_controlled_version_lock_blocked:${blockingReason}`);
    }
    scoreRecord = {
      effective_verdict: 'blocked',
      blocking_reason: blockingReason,
    };
    scoringFailureMode = 'not_run';
  } else if (parsed.scoreTriggerPresent) {
    try {
      if (controlledAudit) {
        const controlledScore = await executeControlledScoreWriter({
          projectRoot: normalizedInput.projectRoot,
          controlledAudit,
          expectedStage: expectedScoreStage,
          reportPath: resolvedReportPath,
          artifactPath: effectiveArtifactDocPath,
          iterationCount: String(
            normalizedInput.iterationCount ?? parsed.iterationCount ?? '0'
          ),
          event: inferEvent(hostStage),
          triggerStage: inferTriggerStage(hostStage),
          scoreCommand: defaultScoreCommand,
        });
        scoreRecord = controlledScore.scoreRecord;
        scoreRunId = controlledScore.scoreRunId;
        scoreRecordPath = controlledScore.scoreRecordPath;
        scoreWriterInvocationReceiptRef =
          controlledScore.scoreWriterInvocationReceiptRef;
        controlledScoreEvaluation = controlledScore.scoreEvaluation;
      } else {
        const scoreResult = await scoreCommand({
          reportPath: resolvedReportPath,
          stage: expectedScoreStage,
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

  if (!controlledAudit) {
    mainAuditorPostActions([
      '--projectRoot',
      normalizedInput.projectRoot,
      '--reportPath',
      resolvedReportPath,
      '--stage',
      hostStage,
    ]);
  }

  const closeoutEnvelope = deriveReviewCloseoutEnvelopeV1({
    auditStatus: status,
    scoringFailureMode,
    ...(scoreError ? { scoringFailureReason: `Score write failed: ${scoreError}` } : {}),
    requiredFixes: requiredFixesFromReport,
    scoreRecord:
      !controlledAudit && scoreRecord && typeof scoreRecord.effective_verdict === 'string'
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
  const closeoutApproved = isReviewCloseoutApproved(closeoutEnvelope);
  if (
    controlledAudit &&
    (status !== 'PASS' ||
      !closeoutApproved ||
      !scoreRecord ||
      !scoreRunId ||
      !scoreRecordPath ||
      !scoreWriterInvocationReceiptRef ||
      !controlledScoreEvaluation)
  ) {
    throw new Error('run_auditor_host_controlled_closeout_not_approved');
  }
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
        runAuditorHostInvocationId:
          controlledAudit.binding.runAuditorHostInvocationId,
        roundId: controlledAudit.binding.roundId,
        bindingHash: controlledAudit.bindingHash,
        auditEpochId: controlledAudit.binding.auditEpochId,
        auditTargetBundleHash: controlledAudit.binding.auditTargetBundleHash,
        scoreRunId,
        stage: String(scoreRecord.stage),
        auditReportPath: rootRelativePath(normalizedInput.projectRoot, resolvedReportPath),
        auditReportHash: sha256File(resolvedReportPath),
        artifactPath: rootRelativePath(normalizedInput.projectRoot, effectiveArtifactDocPath),
        artifactHash: sha256File(effectiveArtifactDocPath),
        scoreRecordPath: rootRelativePath(normalizedInput.projectRoot, scoreRecordPath!),
        scoreRecordHash: sha256File(scoreRecordPath!),
        scoreWriteStatus: 'written',
        scoreWriterInvocationReceiptRef,
        dimensionContractId: scoreRecord.dimension_contract_id,
        dimensionMode: scoreRecord.dimension_mode,
        expectedDimensions: scoreRecord.expected_dimensions,
        dimensionScores: scoreRecord.dimension_scores,
        phaseScore: scoreRecord.phase_score,
        minimumPhaseScore: controlledScoreEvaluation!.minimumPhaseScore,
        thresholdPassed: controlledScoreEvaluation!.thresholdPassed,
        scoringPolicyPath: rootRelativePath(
          normalizedInput.projectRoot,
          controlledScoreEvaluation!.scoringPolicyPath
        ),
        scoringPolicyHash: controlledScoreEvaluation!.scoringPolicyHash,
        vetoTriggered: scoreRecord.veto_triggered,
        iterationCount: scoreRecord.iteration_count,
        sourceDocumentHash: controlledAudit.binding.sourceDocumentHash,
        semanticModelHash: controlledAudit.binding.semanticModelHash,
        implementationConfirmationHash:
          controlledAudit.binding.implementationConfirmationHash,
        projectionSetHash: controlledAudit.binding.projectionSetHash,
        qualityRuleSetHash: controlledAudit.binding.qualityRuleSetHash,
        criticalAuditorProfileHash:
          controlledAudit.binding.criticalAuditorProfileHash,
        criticalAuditorStageProfileHash:
          controlledAudit.binding.criticalAuditorStageProfileHash,
        requiredCheckItemSetHash:
          controlledAudit.binding.requiredCheckItemSetHash,
        currentAttemptHash: controlledAudit.binding.currentAttemptHash,
        currentEvidenceHash: controlledAudit.binding.currentEvidenceHash,
        readonlyAuditorRequestHash:
          controlledAudit.binding.readonlyAuditorRequestHash,
        readonlyAuditorResponseHash:
          controlledAudit.binding.readonlyAuditorResponseHash,
        readonlyAuditorHostInvocationReceiptRef:
          controlledAudit.binding.readonlyAuditorHostInvocationReceiptRef,
        judgeRequestHash: controlledAudit.binding.judgeRequestHash,
        judgeVerdict: controlledAudit.judgeVerdict,
        judgeExecutionReceiptRef:
          controlledAudit.binding.judgeExecutionReceiptRef,
        judgeProviderInvocationReceiptRef:
          controlledAudit.binding.judgeProviderInvocationReceiptRef,
        judgeAuditReviewScoringContractHash:
          controlledAudit.judgeAuditReviewScoringContractHash,
        judgeAuditReviewScoringHash:
          controlledAudit.binding.judgeAuditReviewScoringHash,
      }
    );
    scoreReceiptRef = scoreReceiptResult.ref;
    scoreReceiptHash = String(scoreReceiptResult.receipt.receiptHash);
  }

  const authoritativeReceiptRef =
    controlledAudit && scoreReceiptRef && scoreReceiptHash
      ? writeImmutableReceipt(
          normalizedInput.projectRoot,
          path.join(controlledAudit.receiptDir, 'host-closeout-receipt.json'),
          {
            schemaVersion: 'run-auditor-host-closeout-receipt/v1',
            producerIdentity: {
              id: 'runAuditorHost',
              role: 'host_closeout',
            },
            runAuditorHostInvocationId:
              controlledAudit.binding.runAuditorHostInvocationId,
            roundId: controlledAudit.binding.roundId,
            bindingHash: controlledAudit.bindingHash,
            auditEpochId: controlledAudit.binding.auditEpochId,
            auditTargetBundleHash: controlledAudit.binding.auditTargetBundleHash,
            auditStatus: status,
            closeoutApproved,
            governanceClosureHash: sha256Json(governanceClosure),
            closeoutEnvelopeHash: sha256Json(closeoutEnvelope),
            scoreReceiptPath: scoreReceiptRef.path,
            scoreReceiptHash,
            scoreWriterInvocationReceiptRef,
            scoreRecordPath: rootRelativePath(normalizedInput.projectRoot, scoreRecordPath!),
            scoreRecordHash: sha256File(scoreRecordPath!),
            judgeVerdict: controlledAudit.judgeVerdict,
            judgeExecutionReceiptRef:
              controlledAudit.binding.judgeExecutionReceiptRef,
            judgeProviderInvocationReceiptRef:
              controlledAudit.binding.judgeProviderInvocationReceiptRef,
            judgeAuditReviewScoringContractHash:
              controlledAudit.judgeAuditReviewScoringContractHash,
            judgeAuditReviewScoringHash:
              controlledAudit.binding.judgeAuditReviewScoringHash,
            readonlyAuditorHostInvocationReceiptRef:
              controlledAudit.binding.readonlyAuditorHostInvocationReceiptRef,
            sourceDocumentHash: controlledAudit.binding.sourceDocumentHash,
            semanticModelHash: controlledAudit.binding.semanticModelHash,
            implementationConfirmationHash:
              controlledAudit.binding.implementationConfirmationHash,
            projectionSetHash: controlledAudit.binding.projectionSetHash,
            qualityRuleSetHash: controlledAudit.binding.qualityRuleSetHash,
            criticalAuditorProfileHash:
              controlledAudit.binding.criticalAuditorProfileHash,
            criticalAuditorStageProfileHash:
              controlledAudit.binding.criticalAuditorStageProfileHash,
            requiredCheckItemSetHash:
              controlledAudit.binding.requiredCheckItemSetHash,
            currentAttemptHash: controlledAudit.binding.currentAttemptHash,
            currentEvidenceHash: controlledAudit.binding.currentEvidenceHash,
          }
        ).ref
      : {
          path: rootRelativePath(normalizedInput.projectRoot, resolvedReportPath),
          contentHash: sha256File(resolvedReportPath),
          receiptHash: sha256Json({
            schemaVersion: 'run-auditor-host-local-authoritative-closeout/v1',
            auditStatus: status,
            closeoutEnvelope,
            governanceClosure,
            reportHash: sha256File(resolvedReportPath),
          }),
        };
  const projection = deriveAuditHostCompatibilityProjection({
    auditStatus: status,
    stage: consumer.closeoutStage,
    artifactPath: effectiveArtifactDocPath,
    reportPath: resolvedReportPath,
    governanceClosure,
    closeoutEnvelope,
    scoreWriteResult:
      scoringFailureMode === 'succeeded'
        ? 'ok'
        : scoringFailureMode === 'non_blocking_failure'
          ? 'failed'
          : null,
    handoffPersisted: true,
    authoritativeReceiptRef,
    scoreReceiptRef,
    scoreRecord: scoreRecord ?? null,
    ...(scoreError ? { scoreError } : {}),
    updatedAt: new Date().toISOString(),
  });
  const latestCloseout: LatestCloseoutPayload = {
    ...projection.latestCloseoutPatch,
    canMainAgentContinue: canMainAgentContinueFromCloseout({
      closeoutApproved: projection.closeoutApproved,
      scoreWriteResult:
        scoringFailureMode === 'succeeded'
          ? 'ok'
          : scoringFailureMode === 'non_blocking_failure'
            ? 'failed'
            : null,
      handoffPersisted: true,
      latestGateDecision: projection.latestGateDecision,
      fourSignalStatus: requiredFixesFromReport.length > 0 ? 'block' : 'pass',
    }),
    runner: 'runAuditorHost',
    profile: consumer.profile,
    stage: consumer.closeoutStage,
    artifactPath: effectiveArtifactDocPath,
    reportPath: resolvedReportPath,
  } as LatestCloseoutPayload;
  if (!controlledAudit) {
    recordLatestReviewerCloseout(normalizedInput.projectRoot, latestCloseout);
    syncLatestReviewerCloseoutToRequirementRecord(normalizedInput.projectRoot, latestCloseout);
  }
  if (controlledAudit && scoreReceiptRef && scoreReceiptHash) {
    runAuditorHostReceiptRef = authoritativeReceiptRef;
  }

  if (!controlledAudit && isOrphanCloseoutStage(consumer.closeoutStage)) {
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
  } else if (!controlledAudit && consumer.closeoutStage === 'story') {
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
    ...(scoreWriterInvocationReceiptRef ? { scoreWriterInvocationReceiptRef } : {}),
    ...(scoreReceiptRef ? { scoreReceiptRef } : {}),
    ...(runAuditorHostReceiptRef ? { runAuditorHostReceiptRef } : {}),
  };
}

export async function mainRunAuditorHost(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const projectRoot = args.projectRoot?.trim();
  const stage = args.stage?.trim();
  const artifactPath = args.artifactPath?.trim();
  const controlledAuditBindingFile = args.controlledAuditBindingFile?.trim();
  const resultPath = args.resultPath?.trim();

  if (!projectRoot || !stage || !artifactPath) {
    console.error(
      'run-auditor-host: usage --projectRoot <path> --stage <stage> --artifactPath <path> [--reportPath <path>] [--iterationCount <n>] [--controlledAuditBindingFile <path>] [--resultPath <path>]'
    );
    return 1;
  }

  try {
    const controlledAuditBinding = controlledAuditBindingFile
      ? (readJsonRecord(
          assertPathWithinRoot(projectRoot, controlledAuditBindingFile)
        ) as unknown as ControlledAuditBinding)
      : undefined;
    const result = await runAuditorHost({
      projectRoot,
      stage: stage as RunAuditorHostInput['stage'],
      artifactPath,
      reportPath: args.reportPath,
      iterationCount: args.iterationCount,
      ...(controlledAuditBinding ? { controlledAuditBinding } : {}),
    });
    const serialized = `${JSON.stringify(result)}\n`;
    if (resultPath) {
      const resolvedResultPath = assertPathWithinRoot(projectRoot, resultPath);
      fs.mkdirSync(path.dirname(resolvedResultPath), { recursive: true });
      const temporaryPath = `${resolvedResultPath}.${process.pid}.${randomUUID()}.tmp`;
      try {
        fs.writeFileSync(temporaryPath, serialized, 'utf8');
        fs.renameSync(temporaryPath, resolvedResultPath);
      } finally {
        if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
      }
    }
    process.stdout.write(serialized);
    const approved =
      result.status === 'PASS' && isReviewCloseoutApproved(result.closeoutEnvelope);
    if (
      controlledAuditBinding &&
      (!result.scoreWriterInvocationReceiptRef ||
        !result.scoreReceiptRef ||
        !result.runAuditorHostReceiptRef)
    ) {
      return 1;
    }
    return approved ? 0 : 1;
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
