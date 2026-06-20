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
exports.decisionMatrixDir = decisionMatrixDir;
exports.resolveSixModelRuntimeDecision = resolveSixModelRuntimeDecision;
exports.writeSixModelRuntimeDecision = writeSixModelRuntimeDecision;
exports.writeSplitBrainBlocker = writeSplitBrainBlocker;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const reconfirmation_runtime_1 = require("./reconfirmation-runtime");
function text(value) {
    return String(value ?? '').trim();
}
function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function sha256Text(value) {
    return `sha256:${(0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex')}`;
}
function safeSegment(value) {
    return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}
function decisionMatrixDir(projectRoot, recordId, attemptId) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', safeSegment(recordId), 'decision-matrix', safeSegment(attemptId));
}
function modelResult(record, model) {
    const results = object(record.sixModelResults);
    return model ? object(results?.[model]) : null;
}
function statusFor(record, model) {
    return text(modelResult(record, model)?.status);
}
function hasCurrentPass(record, model) {
    return statusFor(record, model) === 'pass';
}
function isTerminalCloseout(record) {
    const closeout = object(record.closeout);
    return (text(record.status) === 'closed' ||
        text(record.lastEventType) === 'record_closed' ||
        text(closeout?.decision) === 'pass');
}
function isCurrentImplementationCompletion(input) {
    const pendingTaskType = text(input.pendingPacketTaskType);
    const pendingPacketKind = text(input.pendingPacketKind);
    return (text(input.lastTaskReportStatus) === 'done' &&
        (pendingTaskType === 'implement' ||
            (pendingTaskType === '' && pendingPacketKind === 'execution')) &&
        text(input.pendingPacketId) !== '' &&
        text(input.pendingPacketId) === text(input.lastTaskReportPacketId));
}
function nextModelFor(action) {
    switch (action) {
        case 'enter_architecture_confirmation':
            return 'architecture_confirmation';
        case 'run_implementation_readiness_gate':
            return 'implementation_readiness';
        case 'dispatch_implement':
        case 'run_execution_closure_gate':
            return 'execution_closure';
        case 'dispatch_review':
            return 'audit_review';
        case 'run_closeout':
            return 'delivery_confirmation';
        case 'record_closed':
            return 'closed';
        default:
            return null;
    }
}
function taskTypeFor(action) {
    switch (action) {
        case 'dispatch_implement':
            return 'implement';
        case 'dispatch_review':
            return 'audit';
        case 'dispatch_remediation':
            return 'remediate';
        case 'run_closeout':
        case 'record_closed':
            return 'closeout';
        default:
            return null;
    }
}
function blockingReasons(result) {
    return Array.isArray(result?.blockingReasons)
        ? result.blockingReasons.map((item) => text(item)).filter(Boolean)
        : [];
}
function resolveSixModelRuntimeDecision(input) {
    const record = input.record ?? {};
    const recordId = text(record.recordId) || 'requirement-record';
    const requirementSetId = text(record.requirementSetId) || recordId;
    const currentMentalModel = text(record.currentMentalModel) || null;
    const currentResult = modelResult(record, currentMentalModel);
    const currentModelStatus = text(currentResult?.status) || null;
    const reasonRefs = blockingReasons(currentResult).map((id) => ({
        sourceType: 'model_result',
        id,
    }));
    let nextAction = 'await_user';
    let ready = false;
    let transitionMode = 'requires_user_or_gate';
    if ((0, reconfirmation_runtime_1.hasOpenReconfirmationRequest)(record)) {
        nextAction = 'run_pre_confirmation_drilldown';
        ready = false;
        transitionMode = 'blocked';
        reasonRefs.push(...(0, reconfirmation_runtime_1.buildOpenReconfirmationBlockingReasonRefs)(record));
    }
    else if (isTerminalCloseout(record)) {
        nextAction = 'record_closed';
        ready = true;
        transitionMode = 'auto_after_controlled_ingest';
    }
    else if (text(record.status) === 'awaiting_user_acceptance') {
        nextAction = 'await_user_acceptance';
        ready = false;
        transitionMode = 'requires_user_or_gate';
    }
    else if (text(record.status) !== 'user_confirmed') {
        nextAction = 'run_pre_confirmation_drilldown';
        reasonRefs.push({ sourceType: 'requirement_record', id: recordId });
    }
    else if (currentMentalModel === 'requirement_confirmation') {
        if (currentModelStatus === 'pass') {
            nextAction = 'enter_architecture_confirmation';
            ready = true;
            transitionMode = 'auto_after_controlled_ingest';
        }
        else {
            nextAction = 'run_pre_confirmation_drilldown';
        }
    }
    else if (currentMentalModel === 'architecture_confirmation') {
        if (currentModelStatus === 'pass') {
            nextAction = 'run_implementation_readiness_gate';
            ready = true;
            transitionMode = 'auto_after_controlled_ingest';
        }
        else {
            nextAction = 'prepare_architecture_confirmation';
        }
    }
    else if (currentMentalModel === 'implementation_readiness') {
        if (currentModelStatus === 'pass') {
            if (isCurrentImplementationCompletion(input) &&
                !hasCurrentPass(record, 'execution_closure')) {
                nextAction = 'run_execution_closure_gate';
                ready = true;
                transitionMode = 'requires_user_or_gate';
            }
            else {
                nextAction = 'dispatch_implement';
                ready = true;
                transitionMode = 'auto_after_controlled_ingest';
            }
        }
        else if (currentModelStatus === 'blocked' || currentModelStatus === 'fail') {
            nextAction = 'dispatch_remediation';
            ready = true;
            transitionMode = 'blocked';
        }
        else if (currentModelStatus === 'stale') {
            nextAction = 'recompute_current_model_gate';
        }
        else {
            nextAction = 'run_implementation_readiness_gate';
        }
    }
    else if (currentMentalModel === 'execution_closure') {
        if (currentModelStatus === 'pass') {
            nextAction = 'dispatch_review';
            ready = true;
            transitionMode = 'auto_after_controlled_ingest';
        }
        else if (currentModelStatus === 'blocked' || currentModelStatus === 'fail') {
            nextAction = 'dispatch_remediation';
            ready = true;
            transitionMode = 'blocked';
        }
        else if (currentModelStatus === 'stale') {
            nextAction = 'recompute_current_model_gate';
        }
        else {
            nextAction = 'run_execution_closure_gate';
            ready = true;
        }
    }
    else if (currentMentalModel === 'audit_review') {
        if (currentModelStatus === 'pass' && hasCurrentPass(record, 'execution_closure')) {
            nextAction = 'run_closeout';
            ready = true;
            transitionMode = 'auto_after_controlled_ingest';
        }
        else if (currentModelStatus === 'blocked' || currentModelStatus === 'fail') {
            nextAction = 'dispatch_remediation';
            ready = true;
            transitionMode = 'blocked';
        }
        else if (currentModelStatus === 'stale') {
            nextAction = 'recompute_current_model_gate';
        }
        else {
            nextAction = 'dispatch_review';
            ready = true;
        }
    }
    else if (currentMentalModel === 'delivery_confirmation') {
        if (currentModelStatus === 'awaiting_user_acceptance') {
            nextAction = 'await_user_acceptance';
            ready = false;
            transitionMode = 'requires_user_or_gate';
        }
        else if (currentModelStatus === 'pass' && hasCurrentPass(record, 'audit_review')) {
            nextAction = 'record_closed';
            ready = true;
            transitionMode = 'auto_after_controlled_ingest';
        }
        else {
            nextAction = 'run_closeout';
            ready = true;
        }
    }
    else {
        nextAction = 'run_pre_confirmation_drilldown';
    }
    const recordHash = sha256Text(JSON.stringify(record));
    return {
        schemaVersion: 'six-model-runtime-decision/v1',
        recordId,
        requirementSetId,
        attemptId: input.attemptId,
        currentMentalModel,
        currentModelStatus,
        nextAction,
        ready,
        nextMentalModel: nextModelFor(nextAction),
        allowedDispatchTaskType: taskTypeFor(nextAction),
        transitionMode,
        blockingReasonRefs: reasonRefs,
        userFacingStagePrompt: nextAction === 'await_user_acceptance'
            ? '交付确认页已生成，等待用户打开 closeout-confirmation-current.html 核验，并执行 confirm-closeout-acceptance 后才写入 record_closed。'
            : `当前六心智阶段: ${currentMentalModel ?? 'unknown'} (${currentModelStatus ?? 'unknown'}); 下一步: ${nextAction ?? 'none'}.`,
        recordHash,
    };
}
function writeSixModelRuntimeDecision(input) {
    const filePath = path.join(decisionMatrixDir(input.projectRoot, input.decision.recordId, input.decision.attemptId), 'six-model-runtime-decision.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(input.decision, null, 2)}\n`, 'utf8');
    return filePath;
}
function writeSplitBrainBlocker(input) {
    const blocker = {
        schemaVersion: 'split-brain-blocker/v1',
        blockerId: 'split_brain_orchestration_state_next_action',
        orchestrationStateNextAction: input.orchestrationStateNextAction,
        matrixNextAction: input.decision.nextAction,
        currentMentalModel: input.decision.currentMentalModel,
        currentModelStatus: input.decision.currentModelStatus,
        pendingPacketId: input.pendingPacketId ?? null,
        lastTaskReportStatus: input.lastTaskReportStatus ?? null,
        recordHash: input.decision.recordHash,
        decisionRef: input.decisionRef,
    };
    const filePath = path.join(decisionMatrixDir(input.projectRoot, input.decision.recordId, input.decision.attemptId), 'split-brain-blocker.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(blocker, null, 2)}\n`, 'utf8');
    return filePath;
}
