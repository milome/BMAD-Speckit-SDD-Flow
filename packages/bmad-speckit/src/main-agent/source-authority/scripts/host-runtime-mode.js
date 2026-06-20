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
exports.normalizeRuntimeHost = normalizeRuntimeHost;
exports.selectExecutionRuntimeMode = selectExecutionRuntimeMode;
exports.runtimeModeDir = runtimeModeDir;
exports.writeExecutionRuntimeModeSelection = writeExecutionRuntimeModeSelection;
exports.validateNativeGoalReadiness = validateNativeGoalReadiness;
exports.writeRuntimeBlocker = writeRuntimeBlocker;
exports.writeNativeGoalInvocationReceipt = writeNativeGoalInvocationReceipt;
exports.validateNativeGoalInvocationReceipt = validateNativeGoalInvocationReceipt;
const node_crypto_1 = require("node:crypto");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function sha256File(filePath) {
    return `sha256:${(0, node_crypto_1.createHash)('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}
function sha256Text(value) {
    return `sha256:${(0, node_crypto_1.createHash)('sha256').update(value, 'utf8').digest('hex')}`;
}
function safeSegment(value) {
    return value.replace(/[^A-Za-z0-9._-]+/g, '-') || 'unknown';
}
function normalizeRuntimeHost(host) {
    switch (String(host ?? '').trim()) {
        case 'codex':
        case 'codex-no-hooks':
            return 'codex';
        case 'claude':
        case 'claude-code':
        case 'claude-code-cli':
            return 'claude-code-cli';
        case 'cursor':
        case 'cursor-ide':
            return 'cursor-ide';
        case 'cursor-cli':
            return 'cursor-cli';
        default:
            return 'unknown';
    }
}
function selectExecutionRuntimeMode(host) {
    const canonicalHost = normalizeRuntimeHost(host);
    switch (canonicalHost) {
        case 'codex':
        case 'claude-code-cli':
            return {
                canonicalHost,
                executionRuntimeMode: 'native_goal',
                selectionReason: `${canonicalHost} supports host native /goal document-reference execution`,
            };
        case 'cursor-ide':
            return {
                canonicalHost,
                executionRuntimeMode: 'cursor_ide_subagent_ralph_tdd_loop',
                selectionReason: 'Cursor IDE requires Ralph Method TDD subagent execution',
            };
        case 'cursor-cli':
            return {
                canonicalHost,
                executionRuntimeMode: 'main_session_direct',
                selectionReason: 'Cursor CLI capability is not contracted for native goal or subagents',
            };
        default:
            return {
                canonicalHost,
                executionRuntimeMode: 'main_session_direct',
                selectionReason: 'Unknown host capability defaults to main-session direct execution',
            };
    }
}
function runtimeModeDir(projectRoot, recordId, attemptId) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', safeSegment(recordId), 'runtime-mode', safeSegment(attemptId));
}
function writeExecutionRuntimeModeSelection(input) {
    const selected = selectExecutionRuntimeMode(input.host);
    const selection = {
        schemaVersion: 'execution-runtime-mode-selection/v1',
        recordId: input.recordId,
        packetId: input.packetId,
        attemptId: input.attemptId,
        host: input.host,
        canonicalHost: selected.canonicalHost,
        executionRuntimeMode: selected.executionRuntimeMode,
        sourceDocumentHash: input.compiledPromptRef.sourceDocumentHash,
        implementationConfirmationHash: input.compiledPromptRef.implementationConfirmationHash,
        modelPacketHash: input.compiledPromptRef.modelPacketHash,
        goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? null,
        selectedAt: new Date().toISOString(),
        selectionReason: selected.selectionReason,
        blocked: false,
    };
    const filePath = path.join(runtimeModeDir(input.projectRoot, input.recordId, input.attemptId), 'execution-runtime-mode-selection.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(selection, null, 2)}\n`, 'utf8');
    return { selection, path: filePath };
}
function validateNativeGoalReadiness(input) {
    const selected = selectExecutionRuntimeMode(input.host);
    if (selected.executionRuntimeMode !== 'native_goal')
        return null;
    const invalidFields = [];
    if (!input.compiledPromptRef.goalExecutionPath)
        invalidFields.push('goalExecutionPath');
    if (!input.compiledPromptRef.goalExecutionHash)
        invalidFields.push('goalExecutionHash');
    if (input.compiledPromptRef.goalExecutionPath &&
        (!fs.existsSync(input.compiledPromptRef.goalExecutionPath) ||
            sha256File(input.compiledPromptRef.goalExecutionPath) !==
                input.compiledPromptRef.goalExecutionHash)) {
        invalidFields.push('goalExecutionHash');
    }
    if (!fs.existsSync(input.compiledPromptRef.auditReceiptPath)) {
        invalidFields.push('auditReceiptPath');
    }
    else {
        const receipt = JSON.parse(fs.readFileSync(input.compiledPromptRef.auditReceiptPath, 'utf8'));
        const goalCommand = receipt.goalCommand;
        if (goalCommand?.mode !== 'native_goal_document_ref')
            invalidFields.push('audit_receipt.goalCommand.mode');
        if (goalCommand?.documentHash !== input.compiledPromptRef.goalExecutionHash) {
            invalidFields.push('audit_receipt.goalCommand.documentHash');
        }
    }
    if (invalidFields.length === 0)
        return null;
    return {
        schemaVersion: 'runtime-blocker/v1',
        reasonCode: 'native_goal_readiness_invalid',
        host: input.host,
        executionRuntimeMode: 'native_goal',
        attemptId: input.attemptId,
        packetId: input.packetId,
        goalExecutionHash: input.compiledPromptRef.goalExecutionHash ?? null,
        receiptHash: fs.existsSync(input.compiledPromptRef.auditReceiptPath)
            ? sha256File(input.compiledPromptRef.auditReceiptPath)
            : 'missing',
        exitCode: 'not_available',
        blockedActions: [
            'task_report_acceptance',
            'execution_closure_result_recorded',
            'dispatch_review',
            'run_closeout',
            'delivery_confirmation_result_recorded',
            'record_closed',
        ],
        recordHash: sha256Text(input.recordId),
        reasonDetails: { invalidFields },
    };
}
function writeRuntimeBlocker(projectRoot, recordId, attemptId, blocker) {
    const filePath = path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'runtime-blocker.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(blocker, null, 2)}\n`, 'utf8');
    return filePath;
}
function writeNativeGoalInvocationReceipt(input) {
    const receipt = {
        schemaVersion: 'native-goal-invocation-receipt/v1',
        host: input.host,
        executionRuntimeMode: 'native_goal',
        goalExecutionPath: input.goalExecutionPath,
        goalExecutionHash: sha256File(input.goalExecutionPath),
        goalCommandTextHash: input.goalCommandTextHash ?? 'not_available',
        invokedCommandKind: 'host_native_goal',
        command: input.command ?? 'not_available',
        args: input.args ?? [],
        taskReportPath: input.taskReportPath ?? 'not_available',
        nativeGoalCommandUsed: input.nativeGoalCommandUsed === false ? true : true,
        startedAt: input.startedAt ?? new Date().toISOString(),
        endedAt: input.endedAt ?? new Date().toISOString(),
        exitCode: input.exitCode,
        stdoutRef: input.stdoutRef,
        stderrRef: input.stderrRef,
        packetId: input.packetId,
        attemptId: input.attemptId,
    };
    const filePath = path.join(runtimeModeDir(input.projectRoot, input.recordId, input.attemptId), 'native-goal-invocation-receipt.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
    return { receipt, path: filePath };
}
function validateNativeGoalInvocationReceipt(input) {
    const filePath = path.join(runtimeModeDir(input.projectRoot, input.recordId, input.attemptId), 'native-goal-invocation-receipt.json');
    if (!fs.existsSync(filePath)) {
        return {
            schemaVersion: 'runtime-blocker/v1',
            reasonCode: 'native_goal_receipt_missing',
            host: input.host,
            executionRuntimeMode: 'native_goal',
            attemptId: input.attemptId,
            packetId: input.packetId,
            goalExecutionHash: input.goalExecutionHash,
            receiptHash: 'missing',
            exitCode: 'not_available',
            blockedActions: [
                'task_report_acceptance',
                'execution_closure_result_recorded',
                'dispatch_review',
                'run_closeout',
                'delivery_confirmation_result_recorded',
                'record_closed',
            ],
            recordHash: sha256Text(input.recordId),
            reasonDetails: { missingPath: filePath.replace(/\\/g, '/') },
        };
    }
    const receipt = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const invalidFields = [];
    if (receipt.packetId !== input.packetId)
        invalidFields.push('packetId');
    if (receipt.attemptId !== input.attemptId)
        invalidFields.push('attemptId');
    if (receipt.invokedCommandKind !== 'host_native_goal')
        invalidFields.push('invokedCommandKind');
    if (receipt.goalExecutionHash !== input.goalExecutionHash)
        invalidFields.push('goalExecutionHash');
    if (!receipt.goalCommandTextHash)
        invalidFields.push('goalCommandTextHash');
    if (!receipt.command)
        invalidFields.push('command');
    if (!Array.isArray(receipt.args) || receipt.args.length === 0)
        invalidFields.push('args');
    if (!receipt.taskReportPath)
        invalidFields.push('taskReportPath');
    if (receipt.nativeGoalCommandUsed !== true)
        invalidFields.push('nativeGoalCommandUsed');
    if (!receipt.stdoutRef)
        invalidFields.push('stdoutRef');
    if (!receipt.stderrRef)
        invalidFields.push('stderrRef');
    if (receipt.exitCode !== 0)
        invalidFields.push('exitCode');
    if (invalidFields.length === 0)
        return null;
    return {
        schemaVersion: 'runtime-blocker/v1',
        reasonCode: 'native_goal_receipt_invalid',
        host: input.host,
        executionRuntimeMode: 'native_goal',
        attemptId: input.attemptId,
        packetId: input.packetId,
        goalExecutionHash: input.goalExecutionHash,
        receiptHash: sha256File(filePath),
        exitCode: receipt.exitCode ?? 'not_available',
        blockedActions: [
            'task_report_acceptance',
            'execution_closure_result_recorded',
            'dispatch_review',
            'run_closeout',
            'delivery_confirmation_result_recorded',
            'record_closed',
        ],
        recordHash: sha256Text(input.recordId),
        reasonDetails: { invalidFields },
    };
}
