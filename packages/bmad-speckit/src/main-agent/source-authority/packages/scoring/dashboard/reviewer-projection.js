"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapFlowStageToReviewerAuditEntryStage = mapFlowStageToReviewerAuditEntryStage;
exports.buildReviewerContractProjection = buildReviewerContractProjection;
exports.buildReviewerRouteExplainability = buildReviewerRouteExplainability;
const SUPPORTED_PROFILES = [
    'story_audit',
    'spec_audit',
    'plan_audit',
    'tasks_audit',
    'implement_audit',
    'bugfix_doc_audit',
    'tasks_doc_audit',
];
const REQUIRED_ROLLOUT_PROOFS = [
    'parity_proof',
    'consumer_install_proof',
    'rollback_proof',
    'codex_parity_proof',
    'codex_closeout_proof',
    'codex_scoring_proof',
];
const REVIEWER_ROLLOUT_BLOCKER = 'Complete parity proof, rollback proof, Codex parity, Codex closeout, Codex scoring, and rollout gate before declaring full isomorphism.';
function buildBlockedReviewerRolloutGate() {
    return {
        version: 'reviewer_rollout_gate_v1',
        status: 'blocked',
        requiredProofs: REQUIRED_ROLLOUT_PROOFS,
        completeProofs: [],
        blockingProofs: REQUIRED_ROLLOUT_PROOFS,
        cleanupAllowed: false,
        canClaimFullIsomorphism: false,
        summary: 'Reviewer rollout remains blocked until Codex closeout and scoring proofs are present.',
    };
}
const AUDIT_CONSUMERS = {
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
const HOSTS = {
    cursor: {
        carrierSourcePath: '_bmad/cursor/agents/code-reviewer.md',
        runtimeTargetPath: '.cursor/agents/code-reviewer.md',
        preferredRoute: { tool: 'cursor-task', subtypeOrExecutor: 'code-reviewer' },
        fallbackRoute: { tool: 'mcp_task', subtypeOrExecutor: 'generalPurpose' },
        fallbackReason: 'Use mcp_task/generalPurpose when cursor-task/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
    },
    claude: {
        carrierSourcePath: '_bmad/claude/agents/code-reviewer.md',
        runtimeTargetPath: '.claude/agents/code-reviewer.md',
        preferredRoute: { tool: 'Agent', subtypeOrExecutor: 'code-reviewer' },
        fallbackRoute: { tool: 'Agent', subtypeOrExecutor: 'general-purpose' },
        fallbackReason: 'Use Agent/general-purpose only when Agent/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
    },
    codex: {
        carrierSourcePath: '_bmad/codex/agents/code-reviewer.toml',
        runtimeTargetPath: '.codex/agents/code-reviewer.toml',
        preferredRoute: { tool: 'codex', subtypeOrExecutor: 'worker:audit' },
        fallbackRoute: { tool: 'codex', subtypeOrExecutor: 'worker:audit' },
        fallbackReason: 'Codex uses the no-hooks worker adapter for audit packets; flat or no-op reviewer fallback is disabled.',
    },
};
function mapFlowStageToReviewerAuditEntryStage(flow, stage) {
    if (!flow || !stage)
        return null;
    if (flow === 'story') {
        if (stage === 'story' || stage === 'story_audit')
            return 'story';
        if (stage === 'spec' || stage === 'specify')
            return 'spec';
        if (stage === 'plan')
            return 'plan';
        if (stage === 'gaps')
            return 'gaps';
        if (stage === 'tasks')
            return 'tasks';
        if (stage === 'implement')
            return 'implement';
        return null;
    }
    if (flow === 'bugfix') {
        return stage === 'bugfix' || stage === 'implement' || stage === 'post_audit' ? 'bugfix' : null;
    }
    if (flow === 'standalone_tasks') {
        return ['document', 'standalone_tasks', 'tasks', 'implement', 'post_audit'].includes(stage)
            ? 'standalone_tasks'
            : null;
    }
    return null;
}
function buildReviewerContractProjection(input) {
    return {
        version: 'reviewer_contract_projection_v1',
        reviewerIdentity: 'bmad_code_reviewer',
        reviewerDisplayName: 'code-reviewer',
        facilitatorIdentity: 'party_mode_facilitator',
        registryVersion: 'reviewer_registry_v1',
        sharedCore: {
            version: 'reviewer_shared_core_v1',
            rootPath: '_bmad/core/agents/code-reviewer',
            basePromptPath: '_bmad/core/agents/code-reviewer/base-prompt.md',
            profilePackPath: '_bmad/core/agents/code-reviewer/profiles.json',
        },
        schemaVersions: {
            input: 'review_input_v1',
            output: 'review_output_v1',
            handoff: 'review_handoff_v1',
            closeout: 'review_host_closeout_v1',
        },
        closeoutRunner: 'runAuditorHost',
        governance: {
            implementationReadinessStatusRequired: true,
            implementationReadinessGateName: 'implementation-readiness',
            gatesLoopRequired: true,
            rerunGatesRequired: true,
            packetExecutionClosureRequired: true,
            packetExecutionClosureStatuses: [
                'awaiting_rerun_gate',
                'retry_pending',
                'gate_passed',
                'escalated',
            ],
            closeoutEnvelopeFields: [
                'resultCode',
                'requiredFixes',
                'requiredFixesDetail',
                'rerunDecision',
                'scoringFailureMode',
                'packetExecutionClosureStatus',
            ],
        },
        hostAdapterBoundary: {
            projectionOnly: true,
            hostLocalStageSemanticsForbidden: true,
            hostLocalRoutePrecedenceForbidden: true,
            hostLocalFallbackBusinessRulesForbidden: true,
        },
        compatibilityGuards: {
            codexNoopRequired: false,
            codexBehaviorChangeAllowed: true,
        },
        rolloutGate: buildBlockedReviewerRolloutGate(),
        requiredRolloutProofs: REQUIRED_ROLLOUT_PROOFS,
        supportedProfiles: SUPPORTED_PROFILES,
        supportedAuditEntryStages: Object.keys(AUDIT_CONSUMERS),
        activeAuditConsumer: input?.auditEntryStage ? AUDIT_CONSUMERS[input.auditEntryStage] : null,
    };
}
function buildReviewerRouteExplainability(input) {
    return {
        requestedSkillId: input?.requestedSkillId ?? 'code-reviewer',
        reviewerIdentity: 'bmad_code_reviewer',
        reviewerDisplayName: 'code-reviewer',
        registryVersion: 'reviewer_registry_v1',
        sharedCore: {
            version: 'reviewer_shared_core_v1',
            rootPath: '_bmad/core/agents/code-reviewer',
            basePromptPath: '_bmad/core/agents/code-reviewer/base-prompt.md',
            profilePackPath: '_bmad/core/agents/code-reviewer/profiles.json',
        },
        closeoutRunner: 'runAuditorHost',
        routeReasonSummary: 'Registry-backed reviewer routing keeps shared-core semantics while preserving host-specific transport and carrier shape.',
        fallbackStatus: 'fallback_ready',
        isomorphismMaturity: 'projection_wired',
        complexitySource: 'Tri-host carrier parity is wired, but Codex closeout and scoring proofs are required before rollout.',
        remainingBlocker: REVIEWER_ROLLOUT_BLOCKER,
        supportedProfiles: SUPPORTED_PROFILES,
        requiredRolloutProofs: REQUIRED_ROLLOUT_PROOFS,
        compatibilityGuards: {
            codexNoopRequired: false,
            codexBehaviorChangeAllowed: true,
        },
        rolloutGate: buildBlockedReviewerRolloutGate(),
        hosts: HOSTS,
        activeAuditConsumer: input?.auditEntryStage ? AUDIT_CONSUMERS[input.auditEntryStage] : null,
    };
}
