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
exports.orchestrationStateDir = orchestrationStateDir;
exports.orchestrationStateDirForRecordPath = orchestrationStateDirForRecordPath;
exports.orchestrationStatePath = orchestrationStatePath;
exports.createDefaultOrchestrationState = createDefaultOrchestrationState;
exports.readOrchestrationState = readOrchestrationState;
exports.readOrchestrationStateAtPath = readOrchestrationStateAtPath;
exports.writeOrchestrationState = writeOrchestrationState;
exports.writeOrchestrationStateAtPath = writeOrchestrationStateAtPath;
exports.updateOrchestrationState = updateOrchestrationState;
exports.claimPendingPacket = claimPendingPacket;
exports.completePendingPacket = completePendingPacket;
exports.markPendingPacketDispatched = markPendingPacketDispatched;
exports.recordGatesLoopRetry = recordGatesLoopRetry;
exports.recordGatesLoopNoProgress = recordGatesLoopNoProgress;
exports.resetGatesLoopProgress = resetGatesLoopProgress;
exports.invalidatePendingPacket = invalidatePendingPacket;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function text(value) {
    return typeof value === 'string' ? value.trim() : '';
}
function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function normalizePathForRuntime(value) {
    return value.replace(/\\/g, '/');
}
function resolveActiveRequirementRecordPath(projectRoot) {
    const indexPath = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', 'index.json');
    if (!fs.existsSync(indexPath))
        return null;
    try {
        const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        const active = object(index.active) ??
            object(index.currentRequirementRef) ??
            object(index.currentRequirement);
        const records = Array.isArray(index.records)
            ? index.records.filter((item) => Boolean(object(item)))
            : [];
        const activeRequirementSetId = text(active?.requirementSetId ?? active?.recordId);
        const activeRecordId = text(active?.recordId);
        const directPath = text(active?.recordPath ?? active?.path ?? active?.controlRecordPath);
        const matched = records.find((record) => {
            const requirementSetId = text(record.requirementSetId ?? record.recordId);
            const recordId = text(record.recordId);
            return ((activeRequirementSetId && requirementSetId === activeRequirementSetId) ||
                (activeRecordId && recordId === activeRecordId));
        });
        const recordPath = directPath || text(matched?.recordPath ?? matched?.path ?? matched?.controlRecordPath);
        if (recordPath)
            return path.resolve(projectRoot, normalizePathForRuntime(recordPath));
        if (activeRequirementSetId) {
            return path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records', activeRequirementSetId, 'requirement-record.json');
        }
        return null;
    }
    catch {
        return null;
    }
}
function orchestrationStateDir(projectRoot) {
    const recordPath = resolveActiveRequirementRecordPath(projectRoot);
    if (recordPath) {
        return path.join(path.dirname(recordPath), 'orchestration', 'orchestration-state');
    }
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state');
}
function orchestrationStateDirForRecordPath(projectRoot, recordPath) {
    const normalized = text(recordPath);
    if (!normalized) {
        return orchestrationStateDir(projectRoot);
    }
    const resolved = path.isAbsolute(normalized)
        ? normalized
        : path.resolve(projectRoot, normalizePathForRuntime(normalized));
    return path.join(path.dirname(resolved), 'orchestration', 'orchestration-state');
}
function orchestrationStatePath(projectRoot, sessionId) {
    return path.join(orchestrationStateDir(projectRoot), `${sessionId}.json`);
}
function requirementScopedStateCandidates(projectRoot, sessionId) {
    const recordsRoot = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records');
    if (!fs.existsSync(recordsRoot)) {
        return [];
    }
    return fs
        .readdirSync(recordsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(recordsRoot, entry.name, 'orchestration', 'orchestration-state', `${sessionId}.json`));
}
function existingOrchestrationStatePath(projectRoot, sessionId) {
    const primaryPath = orchestrationStatePath(projectRoot, sessionId);
    const legacyProjectionPath = path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state', `${sessionId}.json`);
    const primaryIsLegacyProjection = path.resolve(primaryPath) === path.resolve(legacyProjectionPath);
    const candidates = [
        ...(primaryIsLegacyProjection ? [] : [primaryPath]),
        ...requirementScopedStateCandidates(projectRoot, sessionId),
        legacyProjectionPath,
    ];
    const seen = new Set();
    for (const candidate of candidates) {
        const normalized = path.resolve(candidate);
        if (seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        if (fs.existsSync(normalized)) {
            return normalized;
        }
    }
    return null;
}
function createDefaultOrchestrationState(input) {
    return {
        version: 1,
        sessionId: input.sessionId,
        host: input.host,
        flow: input.flow,
        currentPhase: input.currentPhase,
        nextAction: input.nextAction,
        pendingPacket: input.pendingPacket ?? null,
        originalExecutionPacketId: null,
        gatesLoop: {
            retryCount: 0,
            maxRetries: 3,
            noProgressCount: 0,
            circuitOpen: false,
            rerunGate: null,
            activePacketId: null,
            lastResult: null,
        },
        closeout: {
            invoked: false,
            approved: false,
            scoreWriteResult: null,
            handoffPersisted: false,
            resultCode: null,
        },
        lastTaskReport: null,
    };
}
function readOrchestrationState(projectRoot, sessionId) {
    const file = existingOrchestrationStatePath(projectRoot, sessionId);
    if (!file || !fs.existsSync(file)) {
        return null;
    }
    return readOrchestrationStateAtPath(file);
}
function readOrchestrationStateAtPath(file) {
    if (!file || !fs.existsSync(file)) {
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
    catch {
        return null;
    }
}
function writeOrchestrationState(projectRoot, state) {
    const file = existingOrchestrationStatePath(projectRoot, state.sessionId) ??
        orchestrationStatePath(projectRoot, state.sessionId);
    writeOrchestrationStateAtPath(file, state);
    const legacyProjectionPath = path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'orchestration-state', `${state.sessionId}.json`);
    if (path.resolve(file) !== path.resolve(legacyProjectionPath)) {
        writeOrchestrationStateAtPath(legacyProjectionPath, state);
    }
}
function writeOrchestrationStateAtPath(file, state) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tempFile = `${file}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(state, null, 2) + '\n', 'utf8');
    fs.renameSync(tempFile, file);
}
function updateOrchestrationState(projectRoot, sessionId, updater) {
    const current = readOrchestrationState(projectRoot, sessionId);
    if (!current) {
        throw new Error(`Orchestration state not found for session: ${sessionId}`);
    }
    const next = updater(current);
    writeOrchestrationState(projectRoot, next);
    return next;
}
function claimPendingPacket(projectRoot, sessionId, owner) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => ({
        ...current,
        pendingPacket: current.pendingPacket
            ? {
                ...current.pendingPacket,
                status: 'claimed_by_main_agent',
                claimOwner: owner,
            }
            : null,
    }));
}
function completePendingPacket(projectRoot, sessionId, packetId) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => ({
        ...current,
        pendingPacket: current.pendingPacket && current.pendingPacket.packetId === packetId
            ? {
                ...current.pendingPacket,
                status: 'completed',
            }
            : (current.pendingPacket ?? null),
    }));
}
function markPendingPacketDispatched(projectRoot, sessionId, packetId) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => ({
        ...current,
        pendingPacket: current.pendingPacket && current.pendingPacket.packetId === packetId
            ? {
                ...current.pendingPacket,
                status: 'dispatched',
            }
            : (current.pendingPacket ?? null),
    }));
}
function recordGatesLoopRetry(projectRoot, sessionId, input = {}) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => ({
        ...current,
        gatesLoop: {
            retryCount: (current.gatesLoop?.retryCount ?? 0) + 1,
            maxRetries: current.gatesLoop?.maxRetries ?? 3,
            noProgressCount: current.gatesLoop?.noProgressCount ?? 0,
            circuitOpen: current.gatesLoop?.circuitOpen ?? false,
            rerunGate: input.rerunGate ?? current.gatesLoop?.rerunGate ?? null,
            activePacketId: input.activePacketId ?? current.gatesLoop?.activePacketId ?? null,
            lastResult: input.lastResult ?? current.gatesLoop?.lastResult ?? null,
        },
    }));
}
function recordGatesLoopNoProgress(projectRoot, sessionId, input = {}) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => {
        const nextNoProgress = (current.gatesLoop?.noProgressCount ?? 0) + 1;
        const maxNoProgressCount = input.maxNoProgressCount ?? 2;
        return {
            ...current,
            gatesLoop: {
                retryCount: current.gatesLoop?.retryCount ?? 0,
                maxRetries: current.gatesLoop?.maxRetries ?? 3,
                noProgressCount: nextNoProgress,
                circuitOpen: (current.gatesLoop?.circuitOpen ?? false) || nextNoProgress >= maxNoProgressCount,
                rerunGate: current.gatesLoop?.rerunGate ?? null,
                activePacketId: current.gatesLoop?.activePacketId ?? null,
                lastResult: input.lastResult ?? current.gatesLoop?.lastResult ?? null,
            },
        };
    });
}
function resetGatesLoopProgress(projectRoot, sessionId, input = {}) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => ({
        ...current,
        gatesLoop: {
            retryCount: current.gatesLoop?.retryCount ?? 0,
            maxRetries: current.gatesLoop?.maxRetries ?? 3,
            noProgressCount: 0,
            circuitOpen: false,
            rerunGate: current.gatesLoop?.rerunGate ?? null,
            activePacketId: current.gatesLoop?.activePacketId ?? null,
            lastResult: input.lastResult ?? current.gatesLoop?.lastResult ?? null,
        },
    }));
}
function invalidatePendingPacket(projectRoot, sessionId, packetId) {
    return updateOrchestrationState(projectRoot, sessionId, (current) => ({
        ...current,
        pendingPacket: current.pendingPacket && current.pendingPacket.packetId === packetId
            ? {
                ...current.pendingPacket,
                status: 'invalidated',
            }
            : (current.pendingPacket ?? null),
    }));
}
