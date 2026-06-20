"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainAuditReviewGate = mainAuditReviewGate;
/* eslint-disable no-console */
const crypto = __importStar(require("node:crypto"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const audit_triad_orchestrator_1 = require("./audit-triad-orchestrator");
const requirement_record_control_store_1 = require("./requirement-record-control-store");
const reconfirmation_runtime_1 = require("./reconfirmation-runtime");
function parseArgs(argv) {
    const out = { round: [], repairReceipt: [], repairFeedbackDispatch: [] };
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === '--help' || arg === '-h')
            out.help = true;
        else if (arg === '--json')
            out.json = true;
        else if (arg.startsWith('--')) {
            const key = arg
                .slice(2)
                .replace(/-([a-z])/gu, (_, letter) => letter.toUpperCase());
            const value = argv[index + 1];
            if (!value || value.startsWith('--'))
                throw new Error(`Missing value for ${arg}`);
            if (key === 'round' || key === 'repairReceipt' || key === 'repairFeedbackDispatch') {
                out[key].push(value);
            }
            else {
                out[key] = value;
            }
            index += 1;
        }
        else {
            throw new Error(`Unexpected positional argument: ${arg}`);
        }
    }
    return out;
}
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function nested(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function objects(value) {
    return Array.isArray(value)
        ? value.filter((item) => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
        : [];
}
function normalizePathForRecord(value) {
    return value.replace(/\\/gu, '/');
}
function readJson(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`JSON object expected: ${file}`);
    }
    return parsed;
}
function readJsonArray(file) {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (Array.isArray(parsed))
        return parsed;
    const wrapped = nested(parsed);
    return objects(wrapped.rounds);
}
function sha256File(file) {
    return `sha256:${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}`;
}
function defaultAuditTriadDir(recordPath, attemptId) {
    return path.join(path.dirname(recordPath), 'audit-triad', attemptId);
}
function defaultPlanPath(recordPath, attemptId) {
    return path.join(defaultAuditTriadDir(recordPath, attemptId), 'audit-triad-execution-plan.json');
}
function defaultRoundsPath(recordPath, attemptId) {
    return path.join(defaultAuditTriadDir(recordPath, attemptId), 'rounds.json');
}
function defaultReportPath(recordPath, attemptId) {
    return path.join(defaultAuditTriadDir(recordPath, attemptId), 'audit-review-report.json');
}
function resolveAttemptId(args, record) {
    if (args.attemptId)
        return args.attemptId;
    const latestIteration = objects(record.executionIterations).at(-1);
    const fromIteration = text(latestIteration?.runId) ||
        text(latestIteration?.executionIterationId) ||
        text(nested(record.closeout).currentAttemptId);
    if (fromIteration)
        return fromIteration;
    throw new Error('missing required args: attemptId');
}
function modelResult(record, model) {
    return nested(nested(record.sixModelResults)[model]);
}
function currentModelPassIssues(record, model) {
    const result = modelResult(record, model);
    const status = text(result.status);
    const issues = [];
    if (!status)
        issues.push(`${model}_result_missing`);
    else if (status !== 'pass')
        issues.push(`${model}_not_passed:${status}`);
    if (text(result.sourceDocumentHash) !== text(record.sourceDocumentHash)) {
        issues.push(`${model}_source_hash_mismatch`);
    }
    if (text(result.implementationConfirmationHash) !== text(record.implementationConfirmationHash)) {
        issues.push(`${model}_confirmation_hash_mismatch`);
    }
    return issues;
}
function currentHashes(record, reportHash, plan) {
    return {
        sourceDocumentHash: text(record.sourceDocumentHash),
        implementationConfirmationHash: text(record.implementationConfirmationHash),
        auditReviewReportHash: reportHash,
        criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
        criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
        requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
        currentAttemptHash: plan.currentAttemptHash,
        currentEvidenceHash: plan.currentEvidenceHash,
        ...(plan.modelPacketHash ? { modelPacketHash: plan.modelPacketHash } : {}),
    };
}
function readRounds(args, recordPath, attemptId) {
    const paths = [
        ...(args.round ?? []),
        ...(args.rounds ? [args.rounds] : []),
        ...(!args.rounds && (args.round ?? []).length === 0
            ? [defaultRoundsPath(recordPath, attemptId)]
            : []),
    ];
    return paths.flatMap((item) => readJsonArray(path.resolve(item)));
}
function evaluate(input) {
    const checks = [];
    const blockingReasons = [];
    const openReconfirmations = (0, reconfirmation_runtime_1.openReconfirmationRequests)(input.record);
    checks.push({
        id: 'no-open-reconfirmation-request',
        passed: openReconfirmations.length === 0,
        openRequestIds: openReconfirmations.map((request) => text(request.requestId)).filter(Boolean),
    });
    if (openReconfirmations.length > 0) {
        blockingReasons.push('open_reconfirmation_request_exists');
    }
    const executionIssues = currentModelPassIssues(input.record, 'execution_closure');
    checks.push({
        id: 'execution-closure-current-pass',
        passed: executionIssues.length === 0,
        blockingReasons: executionIssues,
    });
    blockingReasons.push(...executionIssues);
    const allowedCurrentModels = new Set(['execution_closure', 'audit_review']);
    const currentMentalModel = text(input.record.currentMentalModel);
    if (!allowedCurrentModels.has(currentMentalModel)) {
        blockingReasons.push(`audit_review_entry_model_invalid:${currentMentalModel || '<missing>'}`);
    }
    checks.push({
        id: 'audit-review-entry-model-valid',
        passed: allowedCurrentModels.has(currentMentalModel),
        currentMentalModel,
    });
    const planIssues = [
        text(input.plan.recordId) === text(input.record.recordId)
            ? ''
            : 'audit_triad_plan_record_mismatch',
        text(input.plan.attemptId) === input.attemptId ? '' : 'audit_triad_plan_attempt_mismatch',
        text(input.plan.sourceDocumentHash) === text(input.record.sourceDocumentHash)
            ? ''
            : 'audit_triad_plan_source_hash_mismatch',
        text(input.plan.implementationConfirmationHash) ===
            text(input.record.implementationConfirmationHash)
            ? ''
            : 'audit_triad_plan_confirmation_hash_mismatch',
    ].filter(Boolean);
    checks.push({
        id: 'audit-triad-plan-current',
        passed: planIssues.length === 0,
        stageProfileId: input.plan.stageProfileId,
        blockingReasons: planIssues,
    });
    blockingReasons.push(...planIssues);
    const convergence = (0, audit_triad_orchestrator_1.evaluateAuditTriadConvergence)({
        plan: input.plan,
        rounds: input.rounds,
        repairReceiptRefs: input.repairReceiptRefs,
        repairFeedbackDispatchRefs: input.repairFeedbackDispatchRefs,
        scoreReceiptRequired: true,
        runAuditorHostReceiptRequired: true,
    });
    checks.push({
        id: 'audit-triad-convergence-current',
        passed: convergence.ok,
        roundCount: input.rounds.length,
        blockingReasons: convergence.blockingReasons,
    });
    blockingReasons.push(...convergence.blockingReasons);
    const uniqueBlockingReasons = [...new Set(blockingReasons.filter(Boolean))];
    return {
        decision: uniqueBlockingReasons.length === 0 ? 'pass' : 'blocked',
        blockingReasons: uniqueBlockingReasons,
        checks,
        convergenceReceipt: convergence.convergenceReceipt,
    };
}
function updateRecord(record, input) {
    const gateCheckId = `audit-review:${input.attemptId}`;
    const previousSixModelResults = nested(record.sixModelResults);
    const gateCheck = {
        eventType: 'gate_check_recorded',
        checkId: gateCheckId,
        gate: 'Audit Review Gate',
        decision: input.decision,
        blockingReasons: input.blockingReasons,
        checks: input.checks,
        reportPath: normalizePathForRecord(input.reportPath),
        sourceRefs: [
            { sourceType: 'execution_iteration', id: input.attemptId },
            { sourceType: 'audit_triad_execution_plan', id: input.attemptId },
        ],
        recordedAt: input.evaluatedAt,
        recordedBy: input.evaluatedBy,
    };
    const resultPayload = {
        payloadKind: 'model_result',
        model: 'audit_review',
        recordId: text(record.recordId),
        requirementSetId: text(record.requirementSetId) || text(record.recordId),
        sourceDocumentHash: text(record.sourceDocumentHash),
        implementationConfirmationHash: text(record.implementationConfirmationHash),
        status: input.decision,
        resultRecordedAt: input.evaluatedAt,
        resultRecordedBy: input.evaluatedBy,
        blockingReasons: input.blockingReasons,
        sourceRefs: [
            { sourceType: 'execution_iteration', id: input.attemptId },
            { sourceType: 'gate_check', id: gateCheckId },
            { sourceType: 'audit_review_report', id: normalizePathForRecord(input.reportPath) },
        ],
        currentHashes: currentHashes(record, input.reportHash, input.plan),
    };
    const transition = input.decision === 'pass'
        ? {
            eventType: 'mental_model_transition_recorded',
            fromModel: 'execution_closure',
            toModel: 'audit_review',
            sourceRefs: [{ sourceType: 'model_result', id: 'execution_closure' }],
            recordedAt: input.evaluatedAt,
            recordedBy: input.evaluatedBy,
        }
        : null;
    return {
        ...record,
        gateChecks: [...objects(record.gateChecks), gateCheck],
        sixModelResults: {
            ...previousSixModelResults,
            audit_review: resultPayload,
        },
        currentMentalModel: 'audit_review',
        currentStage: 'audit_review',
        stage: text(record.stage) || 'audit_review',
        mentalModelTransitions: [
            ...objects(record.mentalModelTransitions),
            ...(transition ? [transition] : []),
        ],
        lastEventType: 'audit_review_result_recorded',
        updatedAt: input.evaluatedAt,
    };
}
function mainAuditReviewGate(argv) {
    const args = parseArgs(argv);
    if (args.help) {
        console.log('Usage: main-agent-audit-review-gate --requirement-record <json> --attempt-id <id> [--plan <json>] [--rounds <json-array>] [--round <json>] [--json]');
        return 0;
    }
    if (!args.requirementRecord)
        throw new Error('missing required args: requirementRecord');
    const recordPath = path.resolve(args.requirementRecord);
    const record = readJson(recordPath);
    const attemptId = resolveAttemptId(args, record);
    const evaluatedAt = args.evaluatedAt ?? new Date().toISOString();
    const evaluatedBy = args.evaluatedBy ?? 'agent';
    const planPath = path.resolve(args.plan ?? defaultPlanPath(recordPath, attemptId));
    const plan = readJson(planPath);
    const rounds = readRounds(args, recordPath, attemptId);
    const reportPath = path.resolve(args.reportPath ?? defaultReportPath(recordPath, attemptId));
    const evaluation = evaluate({
        record,
        attemptId,
        plan,
        rounds,
        repairReceiptRefs: args.repairReceipt ?? [],
        repairFeedbackDispatchRefs: args.repairFeedbackDispatch ?? [],
    });
    const report = {
        reportType: 'audit_review_report',
        generatedAt: evaluatedAt,
        recordId: text(record.recordId),
        requirementSetId: text(record.requirementSetId) || text(record.recordId),
        attemptId,
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        auditTriadExecutionPlanRef: {
            path: normalizePathForRecord(planPath),
            contentHash: sha256File(planPath),
            stageProfileId: plan.stageProfileId,
            criticalAuditorProfileHash: plan.criticalAuditorProfileHash,
            criticalAuditorStageProfileHash: plan.criticalAuditorStageProfileHash,
            requiredCheckItemSetHash: plan.requiredCheckItemSetHash,
        },
        roundCount: rounds.length,
        convergenceReceipt: evaluation.convergenceReceipt ?? null,
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const reportHash = sha256File(reportPath);
    const payload = {
        attemptId,
        planPath: normalizePathForRecord(planPath),
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        checks: evaluation.checks,
        reportPath: normalizePathForRecord(reportPath),
        reportHash,
        evaluatedAt,
        evaluatedBy,
    };
    const commit = (0, requirement_record_control_store_1.appendControlEventAndReplay)({
        recordPath,
        writerId: 'audit-review-gate-writer',
        eventType: 'audit_review_result_recorded',
        recordedAt: evaluatedAt,
        payload,
        reduce: (currentRecord) => updateRecord(currentRecord, {
            attemptId,
            plan,
            decision: evaluation.decision,
            blockingReasons: evaluation.blockingReasons,
            checks: evaluation.checks,
            reportPath,
            reportHash,
            evaluatedAt,
            evaluatedBy,
        }),
    });
    const output = {
        ok: true,
        reportPath: normalizePathForRecord(reportPath),
        decision: evaluation.decision,
        blockingReasons: evaluation.blockingReasons,
        controlEventId: commit.event.eventId,
        controlEventHash: commit.event.eventHash,
        eventLogPath: normalizePathForRecord(commit.eventLogPath),
        receiptPath: normalizePathForRecord(commit.receiptPath),
    };
    process.stdout.write(args.json ? `${JSON.stringify(output, null, 2)}\n` : `audit_review=${evaluation.decision}\n`);
    return evaluation.decision === 'pass' ? 0 : 1;
}
if (require.main === module) {
    try {
        process.exitCode = mainAuditReviewGate(process.argv.slice(2));
    }
    catch (error) {
        console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
        process.exitCode = 2;
    }
}
