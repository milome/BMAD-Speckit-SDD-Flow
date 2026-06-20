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
exports.governanceExecutionStoreDir = governanceExecutionStoreDir;
exports.governanceExecutionLoopDir = governanceExecutionLoopDir;
exports.governanceExecutionRecordPath = governanceExecutionRecordPath;
exports.governanceExecutionId = governanceExecutionId;
exports.readGovernancePacketExecutionRecord = readGovernancePacketExecutionRecord;
exports.writeGovernancePacketExecutionRecord = writeGovernancePacketExecutionRecord;
exports.createGovernancePacketExecutionRecord = createGovernancePacketExecutionRecord;
exports.listGovernancePacketExecutionRecords = listGovernancePacketExecutionRecords;
exports.updateGovernancePacketExecutionRecord = updateGovernancePacketExecutionRecord;
exports.findLatestActiveGovernancePacketExecutionRecord = findLatestActiveGovernancePacketExecutionRecord;
exports.findGovernancePacketExecutionRecordByExecutionId = findGovernancePacketExecutionRecordByExecutionId;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function nowIso() {
    return new Date().toISOString();
}
function sanitizeToken(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}
function governanceExecutionStoreDir(projectRoot) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'executions');
}
function governanceExecutionLoopDir(projectRoot, loopStateId) {
    return path.join(governanceExecutionStoreDir(projectRoot), sanitizeToken(loopStateId));
}
function governanceExecutionRecordPath(projectRoot, loopStateId, attemptNumber) {
    return path.join(governanceExecutionLoopDir(projectRoot, loopStateId), `${String(attemptNumber).padStart(4, '0')}.json`);
}
function governanceExecutionId(loopStateId, attemptNumber) {
    return `gov-exec-${sanitizeToken(loopStateId)}-${String(attemptNumber).padStart(4, '0')}`;
}
function readGovernancePacketExecutionRecord(projectRoot, loopStateId, attemptNumber) {
    const file = governanceExecutionRecordPath(projectRoot, loopStateId, attemptNumber);
    if (!fs.existsSync(file)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeGovernancePacketExecutionRecord(projectRoot, record) {
    const file = governanceExecutionRecordPath(projectRoot, record.loopStateId, record.attemptNumber);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
    return record;
}
function createGovernancePacketExecutionRecord(input) {
    const existing = readGovernancePacketExecutionRecord(input.projectRoot, input.loopStateId, input.attemptNumber);
    if (existing) {
        return existing;
    }
    const createdAt = nowIso();
    const record = {
        version: 1,
        executionId: governanceExecutionId(input.loopStateId, input.attemptNumber),
        queueItemId: input.queueItemId ?? null,
        loopStateId: input.loopStateId,
        attemptNumber: input.attemptNumber,
        rerunGate: input.rerunGate,
        artifactPath: input.artifactPath ?? null,
        packetPaths: input.packetPaths,
        authoritativeHost: input.authoritativeHost,
        fallbackHosts: [...new Set(input.fallbackHosts ?? [])].filter((host) => host !== input.authoritativeHost),
        status: 'pending_dispatch',
        dispatchAttemptCount: 0,
        executionAttemptCount: 0,
        leaseOwner: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        lastDispatchError: null,
        lastLaunch: null,
        lastExecutionResult: null,
        lastRerunGateResult: null,
        rerunGateSchedule: null,
        history: [{ at: createdAt, kind: 'created', note: 'execution record created' }],
        createdAt,
        updatedAt: createdAt,
    };
    return writeGovernancePacketExecutionRecord(input.projectRoot, record);
}
function listGovernancePacketExecutionRecords(projectRoot, loopStateId) {
    const root = governanceExecutionStoreDir(projectRoot);
    if (!fs.existsSync(root)) {
        return [];
    }
    const records = [];
    for (const loopDir of fs.readdirSync(root)) {
        const fullLoopDir = path.join(root, loopDir);
        if (!fs.statSync(fullLoopDir).isDirectory()) {
            continue;
        }
        for (const file of fs.readdirSync(fullLoopDir)) {
            if (!file.endsWith('.json')) {
                continue;
            }
            records.push(JSON.parse(fs.readFileSync(path.join(fullLoopDir, file), 'utf8')));
        }
    }
    const filtered = typeof loopStateId === 'string' && loopStateId.trim() !== ''
        ? records.filter((record) => record.loopStateId === loopStateId)
        : records;
    return filtered.sort((left, right) => {
        if (left.loopStateId !== right.loopStateId) {
            return left.loopStateId.localeCompare(right.loopStateId);
        }
        return left.attemptNumber - right.attemptNumber;
    });
}
function updateGovernancePacketExecutionRecord(projectRoot, loopStateId, attemptNumber, mutate) {
    const existing = readGovernancePacketExecutionRecord(projectRoot, loopStateId, attemptNumber);
    if (!existing) {
        throw new Error(`Missing governance packet execution record for ${loopStateId}#${attemptNumber}`);
    }
    const next = mutate(existing);
    next.updatedAt = nowIso();
    return writeGovernancePacketExecutionRecord(projectRoot, next);
}
function findLatestActiveGovernancePacketExecutionRecord(projectRoot, loopStateId) {
    return (listGovernancePacketExecutionRecords(projectRoot)
        .filter((record) => record.loopStateId === loopStateId &&
        !['gate_passed', 'escalated'].includes(record.status))
        .sort((left, right) => right.attemptNumber - left.attemptNumber)[0] ?? null);
}
function findGovernancePacketExecutionRecordByExecutionId(projectRoot, executionId) {
    return (listGovernancePacketExecutionRecords(projectRoot).find((record) => record.executionId === executionId) ?? null);
}
