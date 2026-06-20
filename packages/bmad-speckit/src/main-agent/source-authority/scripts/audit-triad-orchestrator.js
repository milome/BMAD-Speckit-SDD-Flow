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
exports.DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH = void 0;
exports.sha256Json = sha256Json;
exports.createAuditTriadExecutionPlan = createAuditTriadExecutionPlan;
exports.writeAuditTriadExecutionPlan = writeAuditTriadExecutionPlan;
exports.evaluateAuditTriadConvergence = evaluateAuditTriadConvergence;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const critical_auditor_profile_1 = require("./critical-auditor-profile");
exports.DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH = 'sha256:c8ed309d65d96bc2341ebb69cb0ab61499f75f4b526ccb79b1c5afe59727e408';
function sha256Text(value) {
    return `sha256:${(0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex')}`;
}
function sha256Json(value) {
    return sha256Text(stableStringify(value));
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(',')}}`;
}
function safeSegment(value) {
    return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}
function createAuditTriadExecutionPlan(input) {
    const profile = (0, critical_auditor_profile_1.resolveCriticalAuditorProfile)(input.projectRoot);
    const stageProfileId = (0, critical_auditor_profile_1.stageProfileForCallPoint)(input.callPoint);
    const validation = (0, critical_auditor_profile_1.validateCriticalAuditorProfileForStage)({ profile, stageProfileId });
    if (!validation.ok || !validation.stageProfile) {
        throw new Error(`audit_triad_profile_invalid:${validation.blockingReasons.join(',')}`);
    }
    const requiredCheckItemSetHash = sha256Json(validation.stageProfile.requiredCheckItemIds);
    const planDir = path.join(input.projectRoot, '_bmad-output', 'runtime', 'requirement-records', safeSegment(input.recordId), 'audit-triad', safeSegment(input.attemptId));
    const derivedCurrentEvidenceHash = input.modelPacketHash && input.auditReceiptHash
        ? sha256Text([
            input.modelPacketHash,
            input.auditReceiptHash,
            input.goalExecutionHash ?? 'no-goal',
        ].join('|'))
        : null;
    const hashBinding = {
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
        ...(input.modelPacketHash ? { modelPacketHash: input.modelPacketHash } : {}),
        ...(input.auditReceiptHash ? { auditReceiptHash: input.auditReceiptHash } : {}),
        ...(input.goalExecutionHash ? { goalExecutionHash: input.goalExecutionHash } : {}),
        criticalAuditorProfileHash: profile.profileHash,
        criticalAuditorStageProfileHash: validation.stageProfile.stageProfileHash,
        requiredCheckItemSetHash,
        currentAttemptHash: input.currentAttemptHash ?? sha256Text(input.attemptId),
        currentEvidenceHash: input.currentEvidenceHash ??
            derivedCurrentEvidenceHash ??
            exports.DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH,
    };
    return {
        schemaVersion: 'audit-triad-execution-plan/v1',
        recordId: input.recordId,
        stage: input.stage,
        stageProfileId,
        attemptId: input.attemptId,
        sourceDocumentHash: input.sourceDocumentHash,
        implementationConfirmationHash: input.implementationConfirmationHash,
        modelPacketHash: input.modelPacketHash ?? null,
        auditReceiptHash: input.auditReceiptHash ?? null,
        goalExecutionHash: input.goalExecutionHash ?? null,
        currentAttemptHash: hashBinding.currentAttemptHash,
        currentEvidenceHash: hashBinding.currentEvidenceHash,
        criticalAuditorProfileHash: profile.profileHash,
        criticalAuditorStageProfileHash: validation.stageProfile.stageProfileHash,
        requiredCheckItemSetHash,
        subagents: [
            'product_intent',
            'model_projection',
            'main_agent_execution',
        ].map((perspectiveId) => ({
            agentId: `${perspectiveId}-${safeSegment(input.attemptId)}`,
            perspectiveId,
            model: 'gpt-5.4',
            reasoningEffort: 'xhigh',
            readScope: ['docs/**', 'scripts/**', 'tests/**', '_bmad-output/**'],
            writeScope: [
                `_bmad-output/runtime/requirement-records/${safeSegment(input.recordId)}/audit-triad/${safeSegment(input.attemptId)}/reports/**`,
            ],
            forbiddenActions: ['modify_source', 'modify_runtime_state', 'modify_generated_surface'],
            reportPath: path.join(planDir, 'reports', `${perspectiveId}.json`),
            requiredCheckItemIds: validation.stageProfile.requiredCheckItemIds,
            currentHashBinding: hashBinding,
        })),
        roundPolicy: { consecutiveNoGapRoundsRequired: 3 },
        repairPolicy: {
            repairOwner: 'main_agent',
            repairReceiptRequired: true,
            feedbackDispatchRequired: true,
        },
        convergencePolicy: {
            resetOnHashChange: [
                'sourceDocumentHash',
                'implementationConfirmationHash',
                'modelPacketHash',
                'auditReceiptHash',
                'goalExecutionHash',
                'criticalAuditorProfileHash',
                'criticalAuditorStageProfileHash',
                'requiredCheckItemSetHash',
                'attemptId',
                'currentAttemptHash',
                'currentEvidenceHash',
            ],
            staleConvergenceForbidden: true,
        },
    };
}
function writeAuditTriadExecutionPlan(projectRoot, plan) {
    const filePath = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', safeSegment(plan.recordId), 'audit-triad', safeSegment(plan.attemptId), 'audit-triad-execution-plan.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    return filePath;
}
function same(value, expected) {
    return String(value ?? '') === String(expected ?? '');
}
function isSha256Hash(value) {
    return /^sha256:[a-f0-9]{64}$/u.test(value);
}
function currentHashBindingIssues(plan) {
    const issues = [];
    if (!plan.currentAttemptHash)
        issues.push('audit_triad_plan_current_attempt_hash_missing');
    else if (!isSha256Hash(plan.currentAttemptHash)) {
        issues.push('audit_triad_plan_current_attempt_hash_not_sha256');
    }
    else if (plan.currentAttemptHash !== sha256Text(plan.attemptId)) {
        issues.push('audit_triad_plan_current_attempt_hash_not_derived');
    }
    if (!plan.currentEvidenceHash)
        issues.push('audit_triad_plan_current_evidence_hash_missing');
    else if (!isSha256Hash(plan.currentEvidenceHash)) {
        issues.push('audit_triad_plan_current_evidence_hash_not_sha256');
    }
    else if (plan.currentEvidenceHash === exports.DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH) {
        issues.push('audit_triad_plan_current_evidence_hash_placeholder');
    }
    if (plan.stageProfileId === 'post_implementation_code_audit') {
        if (!plan.modelPacketHash)
            issues.push('audit_triad_plan_model_packet_hash_missing');
        else if (!isSha256Hash(plan.modelPacketHash)) {
            issues.push('audit_triad_plan_model_packet_hash_not_sha256');
        }
        if (!plan.auditReceiptHash)
            issues.push('audit_triad_plan_audit_receipt_hash_missing');
        else if (!isSha256Hash(plan.auditReceiptHash)) {
            issues.push('audit_triad_plan_audit_receipt_hash_not_sha256');
        }
        if (plan.goalExecutionHash && !isSha256Hash(plan.goalExecutionHash)) {
            issues.push('audit_triad_plan_goal_execution_hash_not_sha256');
        }
        if (plan.modelPacketHash && plan.auditReceiptHash) {
            const expectedEvidenceHash = sha256Text([plan.modelPacketHash, plan.auditReceiptHash, plan.goalExecutionHash ?? 'no-goal'].join('|'));
            if (plan.currentEvidenceHash !== expectedEvidenceHash) {
                issues.push('audit_triad_plan_current_evidence_hash_not_derived');
            }
        }
    }
    return issues;
}
function evaluateAuditTriadConvergence(input) {
    const blockers = [];
    blockers.push(...currentHashBindingIssues(input.plan));
    const rounds = input.rounds.slice(-input.plan.roundPolicy.consecutiveNoGapRoundsRequired);
    if (rounds.length !== input.plan.roundPolicy.consecutiveNoGapRoundsRequired) {
        blockers.push('audit_triad_three_rounds_missing');
    }
    for (const [index, round] of rounds.entries()) {
        const prefix = `round_${index + 1}`;
        if (round.stageProfileId !== input.plan.stageProfileId)
            blockers.push(`${prefix}_stage_profile_mismatch`);
        for (const perspective of [
            'product_intent',
            'model_projection',
            'main_agent_execution',
        ]) {
            if (!round.perspectiveResults[perspective])
                blockers.push(`${prefix}_perspective_missing:${perspective}`);
        }
        const agentIds = Object.values(round.perspectiveResults).map((result) => result.agentId);
        if (new Set(agentIds).size !== agentIds.length)
            blockers.push(`${prefix}_duplicate_agent`);
        for (const item of input.plan.subagents[0]?.requiredCheckItemIds ?? []) {
            if (!round.coveredCheckItemIds.includes(item))
                blockers.push(`${prefix}_check_item_missing:${item}`);
        }
        if (round.validatedGapRefs.length > 0)
            blockers.push(`${prefix}_validated_gap_unresolved`);
        if (round.vetoItemResults.some((item) => item.passed !== true))
            blockers.push(`${prefix}_veto_failed`);
        if (!same(round.sourceDocumentHash, input.plan.sourceDocumentHash))
            blockers.push(`${prefix}_source_hash_mismatch`);
        if (!same(round.implementationConfirmationHash, input.plan.implementationConfirmationHash))
            blockers.push(`${prefix}_confirmation_hash_mismatch`);
        if (!same(round.modelPacketHash ?? null, input.plan.modelPacketHash ?? null))
            blockers.push(`${prefix}_model_packet_hash_mismatch`);
        if (!same(round.auditReceiptHash ?? null, input.plan.auditReceiptHash ?? null))
            blockers.push(`${prefix}_audit_receipt_hash_mismatch`);
        if (!same(round.goalExecutionHash ?? null, input.plan.goalExecutionHash ?? null))
            blockers.push(`${prefix}_goal_execution_hash_mismatch`);
        if (!same(round.currentAttemptHash, input.plan.currentAttemptHash))
            blockers.push(`${prefix}_current_attempt_hash_mismatch`);
        if (!same(round.currentEvidenceHash, input.plan.currentEvidenceHash))
            blockers.push(`${prefix}_current_evidence_hash_mismatch`);
        if (!same(round.criticalAuditorProfileHash, input.plan.criticalAuditorProfileHash))
            blockers.push(`${prefix}_profile_hash_mismatch`);
        if (!same(round.criticalAuditorStageProfileHash, input.plan.criticalAuditorStageProfileHash))
            blockers.push(`${prefix}_stage_profile_hash_mismatch`);
        if (!same(round.requiredCheckItemSetHash, input.plan.requiredCheckItemSetHash))
            blockers.push(`${prefix}_check_item_set_hash_mismatch`);
        if (input.scoreReceiptRequired &&
            (!round.scoreReceiptRefs || round.scoreReceiptRefs.length === 0)) {
            blockers.push(`${prefix}_score_receipt_missing`);
        }
        if (input.runAuditorHostReceiptRequired &&
            (!round.runAuditorHostReceiptRefs || round.runAuditorHostReceiptRefs.length === 0)) {
            blockers.push(`${prefix}_run_auditor_host_receipt_missing`);
        }
    }
    const allValidatedGaps = input.rounds.flatMap((round) => round.validatedGapRefs);
    if (allValidatedGaps.length > 0) {
        if ((input.repairReceiptRefs ?? []).length === 0)
            blockers.push('main_agent_repair_receipt_missing');
        if ((input.repairFeedbackDispatchRefs ?? []).length === 0)
            blockers.push('repair_feedback_dispatch_missing');
    }
    if (blockers.length > 0) {
        return { ok: false, blockingReasons: Array.from(new Set(blockers)) };
    }
    return {
        ok: true,
        blockingReasons: [],
        convergenceReceipt: {
            schemaVersion: 'audit-triad-convergence-receipt/v1',
            recordId: input.plan.recordId,
            attemptId: input.plan.attemptId,
            stageProfileId: input.plan.stageProfileId,
            roundIds: rounds.map((round) => round.roundId),
            criticalAuditorProfileHash: input.plan.criticalAuditorProfileHash,
            criticalAuditorStageProfileHash: input.plan.criticalAuditorStageProfileHash,
            requiredCheckItemSetHash: input.plan.requiredCheckItemSetHash,
            auditReceiptHash: input.plan.auditReceiptHash ?? null,
            goalExecutionHash: input.plan.goalExecutionHash ?? null,
            currentAttemptHash: input.plan.currentAttemptHash,
            currentEvidenceHash: input.plan.currentEvidenceHash,
            validNoGapRounds: rounds.length,
        },
    };
}
