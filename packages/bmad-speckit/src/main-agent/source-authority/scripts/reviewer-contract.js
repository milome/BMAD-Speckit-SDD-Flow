"use strict";
/**
 * Cross-host reviewer / facilitator contract freeze.
 *
 * Batch 1 only freezes product identity, profile vocabulary, facilitator target
 * state, anti-regression hard constraints, and parity evidence requirements.
 * Runtime registry / schema / routing execution lands in later batches.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEWER_CONTRACT_FREEZE = exports.REVIEWER_STRICT_ALIGNMENT_EVIDENCE = exports.REVIEWER_REQUIRED_ROLLOUT_PROOFS = exports.REVIEWER_COMPATIBILITY_GUARDS = exports.REVIEWER_HOST_ADAPTER_BOUNDARY = exports.REVIEWER_CLOSEOUT_ENVELOPE_FIELDS = exports.REVIEWER_GOVERNANCE_GATE_CONTRACT = exports.REVIEWER_HARD_CONSTRAINTS = exports.IMPLEMENT_AUDIT_REQUIRED_DIMENSIONS = exports.CODEX_FACILITATOR_TARGET_PATH = exports.CLAUDE_FACILITATOR_AGENT_MENTION = exports.CLAUDE_FACILITATOR_TARGET_PATH = exports.CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH = exports.FACILITATOR_DISPLAY_NAME = exports.FACILITATOR_PRODUCT_IDENTITY = exports.STORY_AUDIT_CANONICAL_PROFILE = exports.REVIEWER_PROFILE_DEFINITION_SOURCES = exports.SPECIALIZED_REVIEWER_PROFILES = exports.REVIEWER_PROFILES = exports.REVIEWER_SHARED_CORE_PROFILE_PACK_PATH = exports.REVIEWER_SHARED_CORE_BASE_PROMPT_PATH = exports.REVIEWER_SHARED_CORE_METADATA_PATH = exports.REVIEWER_SHARED_CORE_ROOT = exports.CODEX_REVIEWER_RUNTIME_TARGET_PATH = exports.CODEX_REVIEWER_CANONICAL_SOURCE_PATH = exports.CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH = exports.CLAUDE_REVIEWER_RUNTIME_TARGET_PATH = exports.CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH = exports.CURSOR_REVIEWER_RUNTIME_TARGET_PATH = exports.CURSOR_REVIEWER_CANONICAL_SOURCE_PATH = exports.CURSOR_REVIEWER_PREFERRED_EXECUTOR = exports.REVIEWER_DISPLAY_NAME = exports.REVIEWER_PRODUCT_IDENTITY = exports.REVIEWER_CONTRACT_FREEZE_VERSION = void 0;
exports.isReviewerProfileId = isReviewerProfileId;
exports.getReviewerProfileFromDefinitionSource = getReviewerProfileFromDefinitionSource;
exports.REVIEWER_CONTRACT_FREEZE_VERSION = 'reviewer_contract_freeze_v1';
exports.REVIEWER_PRODUCT_IDENTITY = 'bmad_code_reviewer';
exports.REVIEWER_DISPLAY_NAME = 'code-reviewer';
exports.CURSOR_REVIEWER_PREFERRED_EXECUTOR = 'code-reviewer';
exports.CURSOR_REVIEWER_CANONICAL_SOURCE_PATH = '_bmad/cursor/agents/code-reviewer.md';
exports.CURSOR_REVIEWER_RUNTIME_TARGET_PATH = '.cursor/agents/code-reviewer.md';
exports.CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH = '_bmad/claude/agents/code-reviewer.md';
exports.CLAUDE_REVIEWER_RUNTIME_TARGET_PATH = '.claude/agents/code-reviewer.md';
exports.CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH = exports.CLAUDE_REVIEWER_RUNTIME_TARGET_PATH;
exports.CODEX_REVIEWER_CANONICAL_SOURCE_PATH = '_bmad/codex/agents/code-reviewer.toml';
exports.CODEX_REVIEWER_RUNTIME_TARGET_PATH = '.codex/agents/code-reviewer.toml';
exports.REVIEWER_SHARED_CORE_ROOT = '_bmad/core/agents/code-reviewer';
exports.REVIEWER_SHARED_CORE_METADATA_PATH = `${exports.REVIEWER_SHARED_CORE_ROOT}/metadata.json`;
exports.REVIEWER_SHARED_CORE_BASE_PROMPT_PATH = `${exports.REVIEWER_SHARED_CORE_ROOT}/base-prompt.md`;
exports.REVIEWER_SHARED_CORE_PROFILE_PACK_PATH = `${exports.REVIEWER_SHARED_CORE_ROOT}/profiles.json`;
exports.REVIEWER_PROFILES = [
    'story_audit',
    'spec_audit',
    'plan_audit',
    'tasks_audit',
    'implement_audit',
    'bugfix_doc_audit',
    'tasks_doc_audit',
];
exports.SPECIALIZED_REVIEWER_PROFILES = [
    'implement_audit',
    'bugfix_doc_audit',
    'tasks_doc_audit',
];
exports.REVIEWER_PROFILE_DEFINITION_SOURCES = {
    'bmad-story-audit': 'story_audit',
    'auditor-spec': 'spec_audit',
    'auditor-plan': 'plan_audit',
    'auditor-gaps': 'tasks_audit',
    'auditor-tasks': 'tasks_audit',
    'auditor-implement': 'implement_audit',
    'auditor-bugfix': 'bugfix_doc_audit',
    'auditor-tasks-doc': 'tasks_doc_audit',
};
exports.STORY_AUDIT_CANONICAL_PROFILE = 'story_audit';
exports.FACILITATOR_PRODUCT_IDENTITY = 'party_mode_facilitator';
exports.FACILITATOR_DISPLAY_NAME = 'party-mode-facilitator';
exports.CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH = '.cursor/agents/party-mode-facilitator.md';
exports.CLAUDE_FACILITATOR_TARGET_PATH = '.claude/agents/party-mode-facilitator.md';
exports.CLAUDE_FACILITATOR_AGENT_MENTION = '@"party-mode-facilitator (agent)"';
exports.CODEX_FACILITATOR_TARGET_PATH = '.codex/agents/party-mode-facilitator.toml';
exports.IMPLEMENT_AUDIT_REQUIRED_DIMENSIONS = [
    'functional_correctness',
    'code_quality',
    'test_coverage',
    'security',
];
exports.REVIEWER_HARD_CONSTRAINTS = {
    implementAuditRequiredDimensions: exports.IMPLEMENT_AUDIT_REQUIRED_DIMENSIONS,
    perUserStoryTddRedGreenRequired: true,
    strictConvergenceRequired: true,
    requiredFixesRequired: true,
    requiredFixesDetailRequired: true,
    closeoutRunner: 'runAuditorHost',
};
exports.REVIEWER_GOVERNANCE_GATE_CONTRACT = {
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
};
exports.REVIEWER_CLOSEOUT_ENVELOPE_FIELDS = [
    'resultCode',
    'requiredFixes',
    'requiredFixesDetail',
    'rerunDecision',
    'scoringFailureMode',
    'packetExecutionClosureStatus',
];
exports.REVIEWER_HOST_ADAPTER_BOUNDARY = {
    projectionOnly: true,
    hostLocalStageSemanticsForbidden: true,
    hostLocalRoutePrecedenceForbidden: true,
    hostLocalFallbackBusinessRulesForbidden: true,
};
exports.REVIEWER_COMPATIBILITY_GUARDS = {
    codexNoopRequired: false,
    codexBehaviorChangeAllowed: true,
};
exports.REVIEWER_REQUIRED_ROLLOUT_PROOFS = [
    'parity_proof',
    'consumer_install_proof',
    'rollback_proof',
    'codex_parity_proof',
    'codex_closeout_proof',
    'codex_scoring_proof',
];
exports.REVIEWER_STRICT_ALIGNMENT_EVIDENCE = [
    'cursor_preferred_vs_fallback',
    'claude_preferred_vs_fallback',
    'cross_host_output_parity',
    'closeout_contract_parity',
    'governance_closure_parity',
    'parsable_scoring_block_parity',
    'result_code_and_required_fixes_parity',
    'codex_parity_proof',
    'codex_closeout_proof',
    'codex_scoring_proof',
    'rollback_proof',
];
exports.REVIEWER_CONTRACT_FREEZE = {
    version: exports.REVIEWER_CONTRACT_FREEZE_VERSION,
    reviewer: {
        identity: exports.REVIEWER_PRODUCT_IDENTITY,
        displayName: exports.REVIEWER_DISPLAY_NAME,
        sharedCore: {
            rootPath: exports.REVIEWER_SHARED_CORE_ROOT,
            metadataPath: exports.REVIEWER_SHARED_CORE_METADATA_PATH,
            basePromptPath: exports.REVIEWER_SHARED_CORE_BASE_PROMPT_PATH,
            profilePackPath: exports.REVIEWER_SHARED_CORE_PROFILE_PACK_PATH,
        },
        cursor: {
            preferredExecutor: exports.CURSOR_REVIEWER_PREFERRED_EXECUTOR,
            canonicalSourcePath: exports.CURSOR_REVIEWER_CANONICAL_SOURCE_PATH,
            runtimeTargetPath: exports.CURSOR_REVIEWER_RUNTIME_TARGET_PATH,
        },
        claude: {
            canonicalSourcePath: exports.CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH,
            runtimeTargetPath: exports.CLAUDE_REVIEWER_RUNTIME_TARGET_PATH,
            definitionSourcePath: exports.CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH,
        },
        codex: {
            canonicalSourcePath: exports.CODEX_REVIEWER_CANONICAL_SOURCE_PATH,
            runtimeTargetPath: exports.CODEX_REVIEWER_RUNTIME_TARGET_PATH,
        },
        profiles: exports.REVIEWER_PROFILES,
        specializedProfiles: exports.SPECIALIZED_REVIEWER_PROFILES,
        definitionSources: exports.REVIEWER_PROFILE_DEFINITION_SOURCES,
        storyAuditCanonicalProfile: exports.STORY_AUDIT_CANONICAL_PROFILE,
    },
    facilitator: {
        identity: exports.FACILITATOR_PRODUCT_IDENTITY,
        displayName: exports.FACILITATOR_DISPLAY_NAME,
        cursorDefinitionSourcePath: exports.CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
        claudeTarget: {
            agentPath: exports.CLAUDE_FACILITATOR_TARGET_PATH,
            agentMention: exports.CLAUDE_FACILITATOR_AGENT_MENTION,
        },
        codexTarget: {
            agentPath: exports.CODEX_FACILITATOR_TARGET_PATH,
        },
    },
    hardConstraints: exports.REVIEWER_HARD_CONSTRAINTS,
    governanceGateContract: exports.REVIEWER_GOVERNANCE_GATE_CONTRACT,
    closeoutEnvelopeFields: exports.REVIEWER_CLOSEOUT_ENVELOPE_FIELDS,
    hostAdapterBoundary: exports.REVIEWER_HOST_ADAPTER_BOUNDARY,
    compatibilityGuards: exports.REVIEWER_COMPATIBILITY_GUARDS,
    requiredRolloutProofs: exports.REVIEWER_REQUIRED_ROLLOUT_PROOFS,
    strictAlignmentEvidence: exports.REVIEWER_STRICT_ALIGNMENT_EVIDENCE,
};
function isReviewerProfileId(value) {
    return exports.REVIEWER_PROFILES.includes(value);
}
function getReviewerProfileFromDefinitionSource(sourceId) {
    return exports.REVIEWER_PROFILE_DEFINITION_SOURCES[sourceId];
}
