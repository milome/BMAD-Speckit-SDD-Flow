import type { AuditScoringConvergencePolicy } from './orchestration-dispatch-contract';

export type AuditScoringConvergenceNextAction =
  | 'none'
  | 'rerun_score_materialization'
  | 'rerun_audit_with_score_contract';

export type AuditScoringConvergenceWriter =
  | 'controlledReadinessAuditBridge'
  | 'runAuditorHost'
  | 'existingHostRunner';

export interface AuditScoringConvergenceInput {
  policy: AuditScoringConvergencePolicy;
  stage: string;
  auditVerdict?: 'pass' | 'fail' | 'blocked' | string | null;
  criticalAuditorVerdict?: 'no_new_gap' | 'no_new_valid_gap' | 'new_gap' | string | null;
  auditReportHash?: string | null;
  scoreAttemptAuditReportHash?: string | null;
  auditDimensionContractId?: string | null;
  scoreReceipt?: {
    scoreRecordPath?: string | null;
    scoreRecordHash?: string | null;
    scoreWriteStatus?: 'written' | 'failed' | 'skipped' | string | null;
    dimensionContractId?: string | null;
    dimensionMode?: string | null;
    expectedDimensions?: string[] | null;
    dimensionScores?: Array<{ dimension: string; score: number }> | null;
    thresholdPassed?: boolean | null;
    vetoTriggered?: boolean | null;
    iterationCount?: number | null;
  } | null;
  writer?: AuditScoringConvergenceWriter | string | null;
}

export interface AuditScoringConvergenceDecision {
  roundCreditGranted: boolean;
  blockedByScoreMaterialization: boolean;
  roundCreditBlockers: string[];
  nextAction: AuditScoringConvergenceNextAction;
}

function normalized(value: unknown): string {
  return String(value ?? '').trim();
}

function isPassVerdict(value: unknown): boolean {
  return ['pass', 'passed', 'no_gap', 'no_new_gap', 'no_new_valid_gap'].includes(
    normalized(value).toLowerCase()
  );
}

function isNoNewGapVerdict(value: unknown): boolean {
  return ['no_new_gap', 'no_new_valid_gap', 'bounded_no_new_gap'].includes(
    normalized(value).toLowerCase()
  );
}

function expectedWriterForStage(stage: string): AuditScoringConvergenceWriter {
  return normalized(stage).toLowerCase() === 'implementation_readiness'
    ? 'controlledReadinessAuditBridge'
    : 'runAuditorHost';
}

function writerAllowed(stage: string, writer: string): boolean {
  const expected = expectedWriterForStage(stage);
  if (expected === 'controlledReadinessAuditBridge') {
    return writer === expected;
  }
  return writer === 'runAuditorHost' || writer === 'existingHostRunner';
}

function dimensionContractMatches(input: AuditScoringConvergenceInput): boolean {
  const auditContract = normalized(input.auditDimensionContractId);
  const scoreContract = normalized(input.scoreReceipt?.dimensionContractId);
  return Boolean(auditContract && scoreContract && auditContract === scoreContract);
}

function hasExpectedDimensionScores(input: AuditScoringConvergenceInput): boolean {
  const expected = input.scoreReceipt?.expectedDimensions ?? [];
  const actual = new Set(
    (input.scoreReceipt?.dimensionScores ?? []).map((row) => normalized(row.dimension))
  );
  return expected.length > 0 && expected.every((dimension) => actual.has(normalized(dimension)));
}

function hashesAreFresh(input: AuditScoringConvergenceInput): boolean {
  const auditHash = normalized(input.auditReportHash);
  return Boolean(
    auditHash &&
      normalized(input.scoreAttemptAuditReportHash) === auditHash &&
      normalized(input.scoreReceipt?.scoreRecordHash)
  );
}

function validIterationCount(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function evaluateAuditScoringConvergence(
  input: AuditScoringConvergenceInput
): AuditScoringConvergenceDecision {
  const blockers: string[] = [];
  const receipt = input.scoreReceipt ?? null;
  const scoreMaterialized =
    receipt?.scoreWriteStatus === 'written' &&
    Boolean(normalized(receipt.scoreRecordPath)) &&
    Boolean(normalized(receipt.scoreRecordHash));

  if (input.policy.auditPassRequired && !isPassVerdict(input.auditVerdict)) {
    blockers.push('audit_verdict_not_pass');
  }

  if (
    input.policy.criticalAuditorNoNewGapRequired !== false &&
    !isNoNewGapVerdict(input.criticalAuditorVerdict)
  ) {
    blockers.push('critical_auditor_no_new_gap_missing');
  }

  if (input.policy.scoreReceiptRequired && !scoreMaterialized) {
    blockers.push('score_receipt_missing_or_failed');
  }

  if (input.policy.dimensionContractMatchRequired) {
    if (!dimensionContractMatches(input)) {
      blockers.push('dimension_contract_mismatch');
    } else if (!hasExpectedDimensionScores(input)) {
      blockers.push('dimension_scores_missing_expected_dimensions');
    }
  }

  if (input.policy.thresholdPassRequired && receipt?.thresholdPassed !== true) {
    blockers.push('score_threshold_not_passed');
  }

  if (input.policy.vetoForbidden && receipt?.vetoTriggered === true) {
    blockers.push('score_veto_triggered');
  }

  if (input.policy.iterationCountRequired && !validIterationCount(receipt?.iterationCount)) {
    blockers.push('iteration_count_missing_or_invalid');
  }

  if (input.policy.freshHashesRequired && !hashesAreFresh(input)) {
    blockers.push('audit_score_hashes_not_fresh');
  }

  const writer = normalized(input.writer);
  if (!writer || !writerAllowed(input.stage, writer)) {
    blockers.push('score_writer_forbidden_for_stage');
  }

  const blockedByScoreMaterialization = blockers.some((blocker) =>
    [
      'score_receipt_missing_or_failed',
      'dimension_contract_mismatch',
      'dimension_scores_missing_expected_dimensions',
      'score_threshold_not_passed',
      'score_veto_triggered',
      'iteration_count_missing_or_invalid',
      'audit_score_hashes_not_fresh',
      'score_writer_forbidden_for_stage',
    ].includes(blocker)
  );

  let nextAction: AuditScoringConvergenceNextAction = 'none';
  const sameAuditHash =
    normalized(input.auditReportHash) &&
    normalized(input.auditReportHash) === normalized(input.scoreAttemptAuditReportHash);
  const sameDimensionContract = dimensionContractMatches(input);
  if (blockers.length > 0) {
    nextAction = sameAuditHash && sameDimensionContract
      ? 'rerun_score_materialization'
      : 'rerun_audit_with_score_contract';
  }

  return {
    roundCreditGranted: blockers.length === 0,
    blockedByScoreMaterialization,
    roundCreditBlockers: blockers,
    nextAction,
  };
}
