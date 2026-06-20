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
exports.packetArtifactDir = packetArtifactDir;
exports.packetArtifactPath = packetArtifactPath;
exports.resolveDispatchRoute = resolveDispatchRoute;
exports.fallbackAllowed = fallbackAllowed;
exports.createExecutionPacket = createExecutionPacket;
exports.createResumePacket = createResumePacket;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const crypto = __importStar(require("node:crypto"));
const DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH = 'sha256:c8ed309d65d96bc2341ebb69cb0ab61499f75f4b526ccb79b1c5afe59727e408';
function sha256Text(value) {
    return `sha256:${crypto.createHash('sha256').update(value, 'utf8').digest('hex')}`;
}
function isSha256Hash(value) {
    return /^sha256:[a-f0-9]{64}$/u.test(value);
}
function currentEvidenceHashForCompiledPromptRef(ref) {
    return sha256Text([ref.modelPacketHash, ref.auditReceiptHash, ref.goalExecutionHash ?? 'no-goal'].join('|'));
}
function packetArtifactDir(projectRoot, sessionId) {
    try {
        const recordsRoot = path.join(projectRoot, '_bmad-output', 'runtime', 'requirement-records');
        if (fs.existsSync(recordsRoot)) {
            const directRecord = path.join(recordsRoot, sessionId, 'requirement-record.json');
            if (fs.existsSync(directRecord)) {
                return path.join(recordsRoot, sessionId, 'prompts', 'prompt-packets');
            }
            for (const dirent of fs.readdirSync(recordsRoot, { withFileTypes: true })) {
                if (!dirent.isDirectory())
                    continue;
                const recordPath = path.join(recordsRoot, dirent.name, 'requirement-record.json');
                if (!fs.existsSync(recordPath))
                    continue;
                const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
                if (record.runId === sessionId ||
                    record.recordId === sessionId ||
                    record.requirementSetId === sessionId) {
                    return path.join(recordsRoot, dirent.name, 'prompts', 'prompt-packets');
                }
            }
        }
    }
    catch {
        // Keep the legacy dev fallback below when the fs probe is unavailable.
    }
    return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'packets', sessionId);
}
function packetArtifactPath(projectRoot, sessionId, packetId) {
    return path.join(packetArtifactDir(projectRoot, sessionId), `${packetId}.json`);
}
function resolveDispatchRoute(host, taskType) {
    if (host === 'codex') {
        return {
            tool: 'codex',
            subtype: `worker:${taskType}`,
            fallback: 'disabled',
        };
    }
    if (host === 'cursor') {
        if (taskType === 'audit') {
            return {
                tool: 'Task',
                subtype: 'code-reviewer',
                fallback: 'mcp_task:generalPurpose',
            };
        }
        return {
            tool: 'mcp_task',
            subtype: 'generalPurpose',
            fallback: 'disabled',
        };
    }
    if (taskType === 'audit') {
        return {
            tool: 'Agent',
            subtype: 'code-reviewer',
            fallback: 'Agent:general-purpose',
        };
    }
    return {
        tool: 'Agent',
        subtype: 'general-purpose',
        fallback: 'disabled',
    };
}
function fallbackAllowed(_input) {
    return false;
}
function createExecutionPacket(input) {
    if (input.authorityMode === 'compiled_implementation_confirmation' &&
        !input.compiledPromptRef &&
        (!Array.isArray(input.compilerBlock) || input.compilerBlock.length === 0)) {
        throw new Error('compiledPromptRef or compilerBlock is required when authorityMode=compiled_implementation_confirmation');
    }
    if (input.authorityMode === 'legacy_generic_prompt' && !input.legacyPromptFallbackReason) {
        throw new Error('legacyPromptFallbackReason is required when authorityMode=legacy_generic_prompt');
    }
    if (input.authorityMode === 'compiled_implementation_confirmation' &&
        input.compiledPromptRef &&
        !input.executionStrategy &&
        input.taskType !== 'audit') {
        throw new Error('executionStrategy is required after compiled model_packet gate PASS');
    }
    if (input.executionStrategy && !input.compiledPromptRef) {
        throw new Error('executionStrategy cannot bypass compiledPromptRef model_packet authority');
    }
    if (input.taskType === 'audit') {
        if (input.authorityMode === 'legacy_generic_prompt') {
            throw new Error('audit packets cannot use legacy_generic_prompt');
        }
        if (!input.compiledPromptRef) {
            throw new Error('audit packets require compiledPromptRef current-attempt binding');
        }
        if (!input.auditExecutionProfile) {
            throw new Error('auditExecutionProfile is required for audit packets');
        }
        if (!input.auditTriadExecutionPlanRef) {
            throw new Error('auditTriadExecutionPlanRef is required for audit packets');
        }
        if (!input.auditExecutionProfile.runAuditorHostArgs) {
            throw new Error('runAuditorHostArgs are required for audit packets');
        }
        if (input.auditExecutionProfile.selfReviewDenied !== true) {
            throw new Error('audit packets must deny self review');
        }
        if (input.auditExecutionProfile.currentAttemptBinding.attemptId !== input.packetId) {
            throw new Error('auditExecutionProfile attemptId must match packetId');
        }
        if (input.auditTriadExecutionPlanRef.attemptId !== input.packetId) {
            throw new Error('auditTriadExecutionPlanRef attemptId must match packetId');
        }
        if (input.auditExecutionProfile.currentAttemptBinding.sourceDocumentHash !==
            input.compiledPromptRef.sourceDocumentHash) {
            throw new Error('auditExecutionProfile sourceDocumentHash must match compiledPromptRef');
        }
        if (input.auditExecutionProfile.currentAttemptBinding.implementationConfirmationHash !==
            input.compiledPromptRef.implementationConfirmationHash) {
            throw new Error('auditExecutionProfile implementationConfirmationHash must match compiledPromptRef');
        }
        if (input.auditExecutionProfile.currentAttemptBinding.modelPacketHash !==
            input.compiledPromptRef.modelPacketHash) {
            throw new Error('auditExecutionProfile modelPacketHash must match compiledPromptRef');
        }
        const currentAttemptHash = input.auditExecutionProfile.currentAttemptBinding.currentAttemptHash;
        if (!currentAttemptHash || !isSha256Hash(currentAttemptHash)) {
            throw new Error('auditExecutionProfile currentAttemptHash must be a canonical sha256 hash');
        }
        if (currentAttemptHash !== sha256Text(input.auditExecutionProfile.currentAttemptBinding.attemptId)) {
            throw new Error('auditExecutionProfile currentAttemptHash must be derived from attemptId');
        }
        const currentEvidenceHash = input.auditExecutionProfile.currentAttemptBinding.currentEvidenceHash;
        if (!currentEvidenceHash ||
            !isSha256Hash(currentEvidenceHash) ||
            currentEvidenceHash === DEFAULT_AUDIT_CURRENT_EVIDENCE_HASH) {
            throw new Error('auditExecutionProfile currentEvidenceHash must be a fresh non-placeholder hash');
        }
        if (currentEvidenceHash !== currentEvidenceHashForCompiledPromptRef(input.compiledPromptRef)) {
            throw new Error('auditExecutionProfile currentEvidenceHash must match compiledPromptRef evidence hashes');
        }
        if (input.auditTriadExecutionPlanRef.auditReceiptHash !== input.compiledPromptRef.auditReceiptHash) {
            throw new Error('auditTriadExecutionPlanRef auditReceiptHash must match compiledPromptRef');
        }
        if ((input.auditTriadExecutionPlanRef.goalExecutionHash ?? null) !==
            (input.compiledPromptRef.goalExecutionHash ?? null)) {
            throw new Error('auditTriadExecutionPlanRef goalExecutionHash must match compiledPromptRef');
        }
        if (input.auditTriadExecutionPlanRef.currentAttemptHash !== currentAttemptHash) {
            throw new Error('auditTriadExecutionPlanRef currentAttemptHash must match auditExecutionProfile');
        }
        if (input.auditTriadExecutionPlanRef.currentEvidenceHash !== currentEvidenceHash) {
            throw new Error('auditTriadExecutionPlanRef currentEvidenceHash must match auditExecutionProfile');
        }
        if (input.auditTriadExecutionPlanRef.stageProfileId !== input.auditExecutionProfile.stageProfileId) {
            throw new Error('auditTriadExecutionPlanRef stageProfileId must match auditExecutionProfile');
        }
        if (input.auditTriadExecutionPlanRef.criticalAuditorProfileHash !==
            input.auditExecutionProfile.profileHash) {
            throw new Error('auditTriadExecutionPlanRef profileHash must match auditExecutionProfile');
        }
        if (input.auditTriadExecutionPlanRef.criticalAuditorStageProfileHash !==
            input.auditExecutionProfile.stageProfileHash) {
            throw new Error('auditTriadExecutionPlanRef stageProfileHash must match auditExecutionProfile');
        }
        if (input.auditTriadExecutionPlanRef.requiredCheckItemSetHash !==
            input.auditExecutionProfile.requiredCheckItemSetHash) {
            throw new Error('auditTriadExecutionPlanRef requiredCheckItemSetHash must match auditExecutionProfile');
        }
    }
    if (input.executionStrategy && input.executionStrategy.availability !== 'available') {
        throw new Error('executionStrategy availability must be available');
    }
    if (input.executionStrategy &&
        input.compiledPromptRef &&
        input.executionStrategy.modelPacketHash !== input.compiledPromptRef.modelPacketHash) {
        throw new Error('executionStrategy modelPacketHash must match compiledPromptRef');
    }
    if (input.executionStrategy &&
        input.compiledPromptRef &&
        input.executionStrategy.sourceDocumentHash !== input.compiledPromptRef.sourceDocumentHash) {
        throw new Error('executionStrategy sourceDocumentHash must match compiledPromptRef');
    }
    if (input.executionStrategy &&
        input.compiledPromptRef &&
        input.executionStrategy.implementationConfirmationHash !==
            input.compiledPromptRef.implementationConfirmationHash) {
        throw new Error('executionStrategy implementationConfirmationHash must match compiledPromptRef');
    }
    return {
        ...input,
        sourceRecommendationPacketId: input.sourceRecommendationPacketId ?? null,
        downstreamConsumer: input.downstreamConsumer ?? null,
        authorityMode: input.authorityMode ?? 'legacy_generic_prompt',
        compiledPromptRef: input.compiledPromptRef ?? null,
        executionDisciplineProfile: input.executionDisciplineProfile ?? null,
        legacyPromptFallbackReason: input.legacyPromptFallbackReason ?? null,
        compilerBlock: input.compilerBlock ?? null,
        executionStrategy: input.executionStrategy ?? null,
        sddArtifactManifestRef: input.sddArtifactManifestRef ?? null,
        auditExecutionProfile: input.auditExecutionProfile ?? null,
        auditTriadExecutionPlanRef: input.auditTriadExecutionPlanRef ?? null,
    };
}
function createResumePacket(input) {
    return { ...input };
}
