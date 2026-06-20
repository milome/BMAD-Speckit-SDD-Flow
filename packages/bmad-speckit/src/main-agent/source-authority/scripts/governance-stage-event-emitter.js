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
exports.buildGovernanceStageRerunResultEvent = buildGovernanceStageRerunResultEvent;
exports.persistGovernanceStageRerunResultEvent = persistGovernanceStageRerunResultEvent;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
function queueDir(projectRoot) {
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'queue');
}
function pendingEventDir(projectRoot) {
    return path.join(queueDir(projectRoot), 'pending-events');
}
function sanitizeEventToken(value) {
    return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}
function buildGovernanceStageRerunResultEvent(input) {
    return {
        type: 'governance-rerun-result',
        payload: {
            projectRoot: input.projectRoot,
            ...(input.configPath ? { configPath: input.configPath } : {}),
            ...(input.journeyContractHints && input.journeyContractHints.length > 0
                ? { journeyContractHints: input.journeyContractHints }
                : {}),
            ...(input.sourceEventType ? { sourceEventType: input.sourceEventType } : {}),
            runnerInput: input.runnerInput,
            ...(input.rerunGateResult ? { rerunGateResult: input.rerunGateResult } : {}),
        },
    };
}
function persistGovernanceStageRerunResultEvent(event) {
    const projectRoot = event.payload.projectRoot;
    const dir = pendingEventDir(projectRoot);
    fs.mkdirSync(dir, { recursive: true });
    const runnerInput = event.payload.runnerInput ?? {};
    const rerunGate = typeof runnerInput.rerunGate === 'string' && runnerInput.rerunGate.trim() !== ''
        ? runnerInput.rerunGate
        : 'unknown-gate';
    const attemptId = typeof runnerInput.attemptId === 'string' && runnerInput.attemptId.trim() !== ''
        ? runnerInput.attemptId
        : 'unknown-attempt';
    const fileName = `${sanitizeEventToken(rerunGate)}--${sanitizeEventToken(attemptId)}--${Date.now()}.json`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(event, null, 2) + '\n', 'utf8');
    return filePath;
}
