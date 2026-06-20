"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateAuditScoringConvergence = evaluateAuditScoringConvergence;
function normalized(value) {
    return String(value ?? '').trim();
}
function isPassVerdict(value) {
    return ['pass', 'passed', 'no_gap', 'no_new_gap', 'no_new_valid_gap'].includes(normalized(value).toLowerCase());
}
function isNoNewGapVerdict(value) {
    return ['no_new_gap', 'no_new_valid_gap', 'bounded_no_new_gap'].includes(normalized(value).toLowerCase());
}
function expectedWriterForStage(stage) {
    return normalized(stage).toLowerCase() === 'implementation_readiness'
        ? 'controlledReadinessAuditBridge'
        : 'runAuditorHost';
}
function writerAllowed(stage, writer) {
    const expected = expectedWriterForStage(stage);
    if (expected === 'controlledReadinessAuditBridge') {
        return writer === expected;
    }
    return writer === 'runAuditorHost' || writer === 'existingHostRunner';
}
function dimensionContractMatches(input) {
    const auditContract = normalized(input.auditDimensionContractId);
    const scoreContract = normalized(input.scoreReceipt?.dimensionContractId);
    return Boolean(auditContract && scoreContract && auditContract === scoreContract);
}
function hasExpectedDimensionScores(input) {
    const expected = input.scoreReceipt?.expectedDimensions ?? [];
    const actual = new Set((input.scoreReceipt?.dimensionScores ?? []).map((row) => normalized(row.dimension)));
    return expected.length > 0 && expected.every((dimension) => actual.has(normalized(dimension)));
}
function hashesAreFresh(input) {
    const auditHash = normalized(input.auditReportHash);
    return Boolean(auditHash &&
        normalized(input.scoreAttemptAuditReportHash) === auditHash &&
        normalized(input.scoreReceipt?.scoreRecordHash));
}
function validIterationCount(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}
function evaluateAuditScoringConvergence(input) {
    const blockers = [];
    const receipt = input.scoreReceipt ?? null;
    const scoreMaterialized = receipt?.scoreWriteStatus === 'written' &&
        Boolean(normalized(receipt.scoreRecordPath)) &&
        Boolean(normalized(receipt.scoreRecordHash));
    if (input.policy.auditPassRequired && !isPassVerdict(input.auditVerdict)) {
        blockers.push('audit_verdict_not_pass');
    }
    if (input.policy.criticalAuditorNoNewGapRequired !== false &&
        !isNoNewGapVerdict(input.criticalAuditorVerdict)) {
        blockers.push('critical_auditor_no_new_gap_missing');
    }
    if (input.policy.scoreReceiptRequired && !scoreMaterialized) {
        blockers.push('score_receipt_missing_or_failed');
    }
    if (input.policy.dimensionContractMatchRequired) {
        if (!dimensionContractMatches(input)) {
            blockers.push('dimension_contract_mismatch');
        }
        else if (!hasExpectedDimensionScores(input)) {
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
    const blockedByScoreMaterialization = blockers.some((blocker) => [
        'score_receipt_missing_or_failed',
        'dimension_contract_mismatch',
        'dimension_scores_missing_expected_dimensions',
        'score_threshold_not_passed',
        'score_veto_triggered',
        'iteration_count_missing_or_invalid',
        'audit_score_hashes_not_fresh',
        'score_writer_forbidden_for_stage',
    ].includes(blocker));
    let nextAction = 'none';
    const sameAuditHash = normalized(input.auditReportHash) &&
        normalized(input.auditReportHash) === normalized(input.scoreAttemptAuditReportHash);
    const sameDimensionContract = dimensionContractMatches(input);
    if (blockers.length > 0) {
        nextAction =
            sameAuditHash && sameDimensionContract
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
