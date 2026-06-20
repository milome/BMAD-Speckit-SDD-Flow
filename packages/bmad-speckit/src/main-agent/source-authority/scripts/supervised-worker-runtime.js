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
exports.appendTaskProgress = appendTaskProgress;
exports.readTaskProgress = readTaskProgress;
exports.evaluateSupervisedWorker = evaluateSupervisedWorker;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const long_run_runtime_policy_1 = require("./long-run-runtime-policy");
const host_runtime_mode_1 = require("./host-runtime-mode");
function progressPath(projectRoot, recordId, attemptId) {
    return path.join((0, host_runtime_mode_1.runtimeModeDir)(projectRoot, recordId, attemptId), 'task-progress.jsonl');
}
function decisionPath(projectRoot, recordId, attemptId) {
    return path.join((0, host_runtime_mode_1.runtimeModeDir)(projectRoot, recordId, attemptId), 'supervisor-decision.json');
}
function appendTaskProgress(projectRoot, progress) {
    const filePath = progressPath(projectRoot, progress.recordId, progress.attemptId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(progress)}\n`, 'utf8');
    return filePath;
}
function readTaskProgress(projectRoot, recordId, attemptId) {
    const filePath = progressPath(projectRoot, recordId, attemptId);
    if (!fs.existsSync(filePath))
        return [];
    return fs
        .readFileSync(filePath, 'utf8')
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}
function evaluateSupervisedWorker(input) {
    const heartbeatTimeoutMs = long_run_runtime_policy_1.LONG_RUN_RUNTIME_POLICY.heartbeat_timeout_ms;
    const softProgressWindowMs = input.softProgressWindowMs ?? 300_000;
    const hardBudgetMs = input.hardBudgetMs ?? 3_600_000;
    const progress = readTaskProgress(input.projectRoot, input.recordId, input.attemptId);
    const latest = progress.at(-1) ?? null;
    const now = Date.parse(input.nowIso);
    const started = Date.parse(input.startedAtIso);
    const lastHeartbeat = latest ? Date.parse(latest.heartbeatAt) : NaN;
    const lastProgress = [...progress]
        .reverse()
        .find((item) => item.progressSeq > (input.lastProgressSeq ?? -1));
    let decision = 'running';
    let reasonCode = 'heartbeat_within_timeout';
    let terminatedProcess = false;
    let nextRequiredAction = 'continue_supervision';
    if (now - started > hardBudgetMs) {
        decision = 'blocked';
        reasonCode = 'hard_budget_exhausted';
        terminatedProcess = true;
        nextRequiredAction = 'block_attempt';
    }
    else if (input.recoveryFailed) {
        decision = 'blocked';
        reasonCode = 'stale_recovery_failed';
        terminatedProcess = true;
        nextRequiredAction = 'write_runtime_blocker';
    }
    else if (!latest || Number.isNaN(lastHeartbeat) || now - lastHeartbeat > heartbeatTimeoutMs) {
        decision = 'stale_recovery';
        reasonCode = 'heartbeat_timeout';
        nextRequiredAction = 'attempt_stale_recovery';
    }
    else if (lastProgress && now - Date.parse(lastProgress.heartbeatAt) <= softProgressWindowMs) {
        decision = latest.status === 'resumed' ? 'resumed' : 'progressing';
        reasonCode = 'progress_observed';
    }
    else if (now - lastHeartbeat <= heartbeatTimeoutMs) {
        decision = 'running';
        reasonCode = 'heartbeat_alive_no_completion';
    }
    const output = {
        schemaVersion: 'supervisor-decision/v1',
        attemptId: input.attemptId,
        recordId: input.recordId,
        packetId: input.packetId,
        lastHeartbeatAt: latest?.heartbeatAt ?? null,
        heartbeatTimeoutMs,
        softProgressWindowMs,
        hardBudgetMs,
        decision,
        reasonCode,
        terminatedProcess,
        nextRequiredAction,
    };
    const filePath = decisionPath(input.projectRoot, input.recordId, input.attemptId);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    if (decision === 'blocked') {
        (0, host_runtime_mode_1.writeRuntimeBlocker)(input.projectRoot, input.recordId, input.attemptId, {
            schemaVersion: 'runtime-blocker/v1',
            reasonCode,
            host: 'supervised-worker',
            executionRuntimeMode: 'main_session_direct',
            attemptId: input.attemptId,
            packetId: input.packetId,
            goalExecutionHash: null,
            receiptHash: 'not_applicable',
            exitCode: 'not_available',
            blockedActions: ['sixModelResults', 'nextAction', 'record_closed'],
            recordHash: input.recordId,
            reasonDetails: { terminatedProcess },
        });
    }
    return output;
}
