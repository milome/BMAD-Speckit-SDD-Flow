"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEWER_AUDIT_STAGE_CONSUMERS = exports.REVIEWER_REGISTRY = exports.REVIEWER_CONTRACT_PROJECTION_VERSION = exports.REVIEWER_REGISTRY_VERSION = exports.REVIEWER_ROLLOUT_GATE_VERSION = exports.REVIEWER_SHARED_CORE_VERSION = void 0;
exports.listReviewerRegistrations = listReviewerRegistrations;
exports.getReviewerRegistration = getReviewerRegistration;
exports.isReviewerAuditEntryStage = isReviewerAuditEntryStage;
exports.getReviewerConsumerByAuditStage = getReviewerConsumerByAuditStage;
exports.buildReviewerRouteExplainability = buildReviewerRouteExplainability;
exports.buildReviewerContractProjection = buildReviewerContractProjection;
exports.mapFlowStageToReviewerAuditEntryStage = mapFlowStageToReviewerAuditEntryStage;
const reviewer_contract_1 = require("./reviewer-contract");
const reviewer_schema_1 = require("./reviewer-schema");
const reviewer_shared_core_1 = require("./reviewer-shared-core");
const reviewer_rollout_gate_1 = require("./reviewer-rollout-gate");
var reviewer_shared_core_2 = require("./reviewer-shared-core");
Object.defineProperty(exports, "REVIEWER_SHARED_CORE_VERSION", { enumerable: true, get: function () { return reviewer_shared_core_2.REVIEWER_SHARED_CORE_VERSION; } });
var reviewer_rollout_gate_2 = require("./reviewer-rollout-gate");
Object.defineProperty(exports, "REVIEWER_ROLLOUT_GATE_VERSION", { enumerable: true, get: function () { return reviewer_rollout_gate_2.REVIEWER_ROLLOUT_GATE_VERSION; } });
exports.REVIEWER_REGISTRY_VERSION = 'reviewer_registry_v1';
exports.REVIEWER_CONTRACT_PROJECTION_VERSION = 'reviewer_contract_projection_v1';
function createRegistration(profile, stage) {
    const governance = {
        implementationReadinessStatusRequired: reviewer_contract_1.REVIEWER_GOVERNANCE_GATE_CONTRACT.implementationReadinessStatusRequired,
        implementationReadinessGateName: reviewer_contract_1.REVIEWER_GOVERNANCE_GATE_CONTRACT.implementationReadinessGateName,
        gatesLoopRequired: reviewer_contract_1.REVIEWER_GOVERNANCE_GATE_CONTRACT.gatesLoopRequired,
        rerunGatesRequired: reviewer_contract_1.REVIEWER_GOVERNANCE_GATE_CONTRACT.rerunGatesRequired,
        packetExecutionClosureRequired: reviewer_contract_1.REVIEWER_GOVERNANCE_GATE_CONTRACT.packetExecutionClosureRequired,
        packetExecutionClosureStatuses: reviewer_contract_1.REVIEWER_GOVERNANCE_GATE_CONTRACT.packetExecutionClosureStatuses,
        closeoutEnvelopeFields: reviewer_contract_1.REVIEWER_CLOSEOUT_ENVELOPE_FIELDS,
    };
    return {
        identity: reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY,
        profile,
        sharedCore: {
            version: reviewer_shared_core_1.REVIEWER_SHARED_CORE_VERSION,
            rootPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.rootPath,
            basePromptPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.basePromptPath,
            profilePackPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.profilePackPath,
            hostAdapterProjectionOnly: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.hostAdapterProjectionOnly,
        },
        hostAdapterBoundary: reviewer_contract_1.REVIEWER_HOST_ADAPTER_BOUNDARY,
        hosts: {
            cursor: {
                preferredRoute: {
                    tool: 'cursor-task',
                    subtypeOrExecutor: 'code-reviewer',
                },
                fallbackRoute: {
                    tool: 'mcp_task',
                    subtypeOrExecutor: 'generalPurpose',
                },
                closeout: {
                    contractVersion: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_V1_VERSION,
                    runner: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_RUNNER,
                    stage,
                },
                governance,
            },
            claude: {
                preferredRoute: {
                    tool: 'Agent',
                    subtypeOrExecutor: 'code-reviewer',
                },
                fallbackRoute: {
                    tool: 'Agent',
                    subtypeOrExecutor: 'general-purpose',
                },
                closeout: {
                    contractVersion: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_V1_VERSION,
                    runner: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_RUNNER,
                    stage,
                },
                governance,
            },
            codex: {
                preferredRoute: {
                    tool: 'codex',
                    subtypeOrExecutor: 'worker:audit',
                },
                fallbackRoute: {
                    tool: 'codex',
                    subtypeOrExecutor: 'worker:audit',
                },
                closeout: {
                    contractVersion: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_V1_VERSION,
                    runner: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_RUNNER,
                    stage,
                },
                governance,
            },
        },
    };
}
exports.REVIEWER_REGISTRY = {
    story_audit: createRegistration('story_audit', 'story'),
    spec_audit: createRegistration('spec_audit', 'spec'),
    plan_audit: createRegistration('plan_audit', 'plan'),
    tasks_audit: createRegistration('tasks_audit', 'tasks'),
    implement_audit: createRegistration('implement_audit', 'implement'),
    bugfix_doc_audit: createRegistration('bugfix_doc_audit', 'bugfix'),
    tasks_doc_audit: createRegistration('tasks_doc_audit', 'standalone_tasks'),
};
const REVIEWER_SHARED_CORE_PROFILE_IDS = reviewer_shared_core_1.REVIEWER_SHARED_CORE_PROFILE_PACK.map((entry) => entry.profile);
if (JSON.stringify(REVIEWER_SHARED_CORE_PROFILE_IDS) !== JSON.stringify([...reviewer_contract_1.REVIEWER_PROFILES])) {
    throw new Error(`Reviewer shared core registry mismatch: expected ${JSON.stringify(reviewer_contract_1.REVIEWER_PROFILES)}, got ${JSON.stringify(REVIEWER_SHARED_CORE_PROFILE_IDS)}`);
}
exports.REVIEWER_AUDIT_STAGE_CONSUMERS = {
    story: {
        entryStage: 'story',
        profile: 'story_audit',
        closeoutStage: 'story',
        auditorScript: 'auditor-document',
        scoreStage: 'story',
        triggerStage: 'bmad_story_stage2',
    },
    spec: {
        entryStage: 'spec',
        profile: 'spec_audit',
        closeoutStage: 'spec',
        auditorScript: 'auditor-spec',
        scoreStage: 'spec',
        triggerStage: 'speckit_1_2',
    },
    plan: {
        entryStage: 'plan',
        profile: 'plan_audit',
        closeoutStage: 'plan',
        auditorScript: 'auditor-plan',
        scoreStage: 'plan',
        triggerStage: 'speckit_2_2',
    },
    gaps: {
        entryStage: 'gaps',
        profile: 'tasks_audit',
        closeoutStage: 'gaps',
        auditorScript: 'auditor-gaps',
        scoreStage: 'gaps',
        triggerStage: 'speckit_3_2',
    },
    tasks: {
        entryStage: 'tasks',
        profile: 'tasks_audit',
        closeoutStage: 'tasks',
        auditorScript: 'auditor-tasks',
        scoreStage: 'tasks',
        triggerStage: 'speckit_4_2',
    },
    implement: {
        entryStage: 'implement',
        profile: 'implement_audit',
        closeoutStage: 'implement',
        auditorScript: 'auditor-implement',
        scoreStage: 'implement',
        triggerStage: 'speckit_5_2',
    },
    bugfix: {
        entryStage: 'bugfix',
        profile: 'bugfix_doc_audit',
        closeoutStage: 'bugfix',
        auditorScript: 'auditor-bugfix',
        scoreStage: 'implement',
        triggerStage: 'speckit_5_2',
    },
    document: {
        entryStage: 'document',
        profile: 'tasks_doc_audit',
        closeoutStage: 'standalone_tasks',
        auditorScript: 'auditor-tasks-doc',
        scoreStage: 'tasks',
        triggerStage: 'speckit_4_2',
    },
    standalone_tasks: {
        entryStage: 'standalone_tasks',
        profile: 'tasks_doc_audit',
        closeoutStage: 'standalone_tasks',
        auditorScript: 'auditor-tasks-doc',
        scoreStage: 'tasks',
        triggerStage: 'speckit_4_2',
    },
};
const REVIEWER_SUPPORTED_AUDIT_ENTRY_STAGES = Object.keys(exports.REVIEWER_AUDIT_STAGE_CONSUMERS);
const REVIEWER_HOST_ROUTE_SUMMARY = {
    cursor: {
        carrierSourcePath: reviewer_contract_1.CURSOR_REVIEWER_CANONICAL_SOURCE_PATH,
        runtimeTargetPath: reviewer_contract_1.CURSOR_REVIEWER_RUNTIME_TARGET_PATH,
        preferredRoute: exports.REVIEWER_REGISTRY.story_audit.hosts.cursor.preferredRoute,
        fallbackRoute: exports.REVIEWER_REGISTRY.story_audit.hosts.cursor.fallbackRoute,
        fallbackReason: 'Use mcp_task/generalPurpose when cursor-task/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
    },
    claude: {
        carrierSourcePath: reviewer_contract_1.CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH,
        runtimeTargetPath: reviewer_contract_1.CLAUDE_REVIEWER_RUNTIME_TARGET_PATH,
        preferredRoute: exports.REVIEWER_REGISTRY.story_audit.hosts.claude.preferredRoute,
        fallbackRoute: exports.REVIEWER_REGISTRY.story_audit.hosts.claude.fallbackRoute,
        fallbackReason: 'Use Agent/general-purpose only when Agent/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
    },
    codex: {
        carrierSourcePath: reviewer_contract_1.CODEX_REVIEWER_CANONICAL_SOURCE_PATH,
        runtimeTargetPath: reviewer_contract_1.CODEX_REVIEWER_RUNTIME_TARGET_PATH,
        preferredRoute: exports.REVIEWER_REGISTRY.story_audit.hosts.codex.preferredRoute,
        fallbackRoute: exports.REVIEWER_REGISTRY.story_audit.hosts.codex.fallbackRoute,
        fallbackReason: 'Codex uses the no-hooks worker adapter for audit packets; flat or no-op reviewer fallback is disabled.',
    },
};
function listReviewerRegistrations() {
    return reviewer_contract_1.REVIEWER_PROFILES.map((profile) => exports.REVIEWER_REGISTRY[profile]);
}
function getReviewerRegistration(profile) {
    return exports.REVIEWER_REGISTRY[profile];
}
function isReviewerAuditEntryStage(value) {
    return value in exports.REVIEWER_AUDIT_STAGE_CONSUMERS;
}
function getReviewerConsumerByAuditStage(stage) {
    return exports.REVIEWER_AUDIT_STAGE_CONSUMERS[stage];
}
function buildReviewerRouteExplainability(input) {
    return {
        requestedSkillId: input?.requestedSkillId ?? 'code-reviewer',
        ...(input?.matchedSkillId ? { matchedSkillId: input.matchedSkillId } : {}),
        reviewerIdentity: reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY,
        reviewerDisplayName: reviewer_contract_1.REVIEWER_DISPLAY_NAME,
        registryVersion: exports.REVIEWER_REGISTRY_VERSION,
        sharedCore: {
            version: reviewer_shared_core_1.REVIEWER_SHARED_CORE_VERSION,
            rootPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.rootPath,
            basePromptPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.basePromptPath,
            profilePackPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.profilePackPath,
        },
        closeoutRunner: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_RUNNER,
        routeReasonSummary: 'Registry-backed reviewer routing keeps shared-core semantics while preserving host-specific transport and carrier shape.',
        fallbackStatus: 'fallback_ready',
        isomorphismMaturity: 'projection_wired',
        complexitySource: 'Tri-host carrier parity is in place; Codex closeout and scoring proofs are required before rollout.',
        remainingBlocker: 'Complete parity proof, rollback proof, Codex parity, Codex closeout, Codex scoring, and rollout gate before declaring full isomorphism.',
        supportedProfiles: reviewer_contract_1.REVIEWER_PROFILES,
        requiredRolloutProofs: reviewer_contract_1.REVIEWER_REQUIRED_ROLLOUT_PROOFS,
        compatibilityGuards: reviewer_contract_1.REVIEWER_COMPATIBILITY_GUARDS,
        rolloutGate: (0, reviewer_rollout_gate_1.buildReviewerRolloutGate)(),
        hosts: REVIEWER_HOST_ROUTE_SUMMARY,
        activeAuditConsumer: input?.auditEntryStage
            ? getReviewerConsumerByAuditStage(input.auditEntryStage)
            : null,
    };
}
function buildReviewerContractProjection(input) {
    return {
        version: exports.REVIEWER_CONTRACT_PROJECTION_VERSION,
        reviewerIdentity: reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY,
        reviewerDisplayName: reviewer_contract_1.REVIEWER_DISPLAY_NAME,
        facilitatorIdentity: reviewer_contract_1.FACILITATOR_PRODUCT_IDENTITY,
        registryVersion: exports.REVIEWER_REGISTRY_VERSION,
        sharedCore: {
            version: reviewer_shared_core_1.REVIEWER_SHARED_CORE_VERSION,
            rootPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.rootPath,
            basePromptPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.basePromptPath,
            profilePackPath: reviewer_shared_core_1.REVIEWER_SHARED_CORE_METADATA.profilePackPath,
        },
        schemaVersions: {
            input: reviewer_schema_1.REVIEW_INPUT_V1_VERSION,
            output: reviewer_schema_1.REVIEW_OUTPUT_V1_VERSION,
            handoff: reviewer_schema_1.REVIEW_HANDOFF_V1_VERSION,
            closeout: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_V1_VERSION,
        },
        closeoutRunner: reviewer_schema_1.REVIEW_HOST_CLOSEOUT_RUNNER,
        governance: exports.REVIEWER_REGISTRY.implement_audit.hosts.cursor.governance,
        hostAdapterBoundary: reviewer_contract_1.REVIEWER_HOST_ADAPTER_BOUNDARY,
        compatibilityGuards: reviewer_contract_1.REVIEWER_COMPATIBILITY_GUARDS,
        requiredRolloutProofs: reviewer_contract_1.REVIEWER_REQUIRED_ROLLOUT_PROOFS,
        rolloutGate: (0, reviewer_rollout_gate_1.buildReviewerRolloutGate)(),
        supportedProfiles: reviewer_contract_1.REVIEWER_PROFILES,
        supportedAuditEntryStages: REVIEWER_SUPPORTED_AUDIT_ENTRY_STAGES,
        activeAuditConsumer: input?.auditEntryStage
            ? getReviewerConsumerByAuditStage(input.auditEntryStage)
            : null,
    };
}
function mapFlowStageToReviewerAuditEntryStage(flow, stage) {
    if (!flow || !stage) {
        return null;
    }
    if (flow === 'story') {
        switch (stage) {
            case 'story':
            case 'story_audit':
                return 'story';
            case 'spec':
            case 'specify':
                return 'spec';
            case 'plan':
                return 'plan';
            case 'gaps':
                return 'gaps';
            case 'tasks':
                return 'tasks';
            case 'implement':
                return 'implement';
            default:
                return null;
        }
    }
    if (flow === 'bugfix') {
        if (stage === 'bugfix' || stage === 'implement' || stage === 'post_audit') {
            return 'bugfix';
        }
        return null;
    }
    if (flow === 'standalone_tasks') {
        if (stage === 'document' ||
            stage === 'standalone_tasks' ||
            stage === 'tasks' ||
            stage === 'implement' ||
            stage === 'post_audit') {
            return 'standalone_tasks';
        }
        return null;
    }
    return null;
}
