"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidExecutionIntentCandidate = assertValidExecutionIntentCandidate;
exports.assertValidExecutionPlanDecision = assertValidExecutionPlanDecision;
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default({ allErrors: true, strict: true, allowUnionTypes: true });
const stringArraySchema = {
    type: 'array',
    items: { type: 'string' },
};
const structuredRecommendationItemSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'source', 'reason', 'confidence', 'consumed', 'filteredBecause'],
    properties: {
        value: { type: 'string', minLength: 1 },
        source: { type: 'string', const: 'model-provider' },
        reason: { type: 'string', minLength: 1 },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        consumed: { type: 'boolean' },
        matchedSkillId: { type: 'string' },
        matchedBy: { type: 'string', enum: ['exact-id', 'substring', 'token-overlap', 'unmatched'] },
        matchScore: { type: 'number' },
        filteredBecause: stringArraySchema,
    },
};
const executionIntentBaseSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
        'source',
        'skillChain',
        'subagentRoles',
        'providerRecommendedSkillChain',
        'providerRecommendedSubagentRoles',
        'providerRecommendationItems',
        'availableSkills',
        'skillPaths',
        'matchedAvailableSkills',
        'missingSkills',
        'skillMatchReasons',
        'semanticSkillFeatures',
        'semanticFeatureTopN',
        'skillAvailabilityMode',
        'interactionMode',
        'researchPolicy',
        'delegationPreference',
        'rationale',
    ],
    properties: {
        source: {
            type: 'string',
            enum: ['default', 'prompt-hints', 'model-hints', 'merged'],
        },
        stage: { type: 'string' },
        action: { type: 'string' },
        skillChain: stringArraySchema,
        subagentRoles: stringArraySchema,
        providerRecommendedSkillChain: stringArraySchema,
        providerRecommendedSubagentRoles: stringArraySchema,
        providerRecommendationItems: {
            type: 'object',
            additionalProperties: false,
            required: ['skills', 'subagentRoles'],
            properties: {
                skills: {
                    type: 'array',
                    items: structuredRecommendationItemSchema,
                },
                subagentRoles: {
                    type: 'array',
                    items: structuredRecommendationItemSchema,
                },
            },
        },
        availableSkills: stringArraySchema,
        skillPaths: stringArraySchema,
        matchedAvailableSkills: stringArraySchema,
        missingSkills: stringArraySchema,
        skillMatchReasons: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'requestedSkill',
                    'matchedSkillId',
                    'score',
                    'exactIdMatch',
                    'substringMatch',
                    'overlapTokens',
                ],
                properties: {
                    requestedSkill: { type: 'string', minLength: 1 },
                    matchedSkillId: { type: 'string', minLength: 1 },
                    matchedPath: { type: 'string' },
                    score: { type: 'number' },
                    exactIdMatch: { type: 'boolean' },
                    substringMatch: { type: 'boolean' },
                    overlapTokens: stringArraySchema,
                    title: { type: 'string' },
                    description: { type: 'string' },
                    summary: { type: 'string' },
                },
            },
        },
        semanticSkillFeatures: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'skillId',
                    'stageHints',
                    'actionHints',
                    'interactionHints',
                    'researchPolicyHints',
                    'delegationHints',
                    'constraintHints',
                ],
                properties: {
                    skillId: { type: 'string', minLength: 1 },
                    path: { type: 'string' },
                    title: { type: 'string' },
                    stageHints: stringArraySchema,
                    stageHintScores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                    },
                    actionHints: stringArraySchema,
                    actionHintScores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                    },
                    interactionHints: stringArraySchema,
                    interactionHintScores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                    },
                    researchPolicyHints: {
                        type: 'array',
                        items: { type: 'string', enum: ['allowed', 'forbidden', 'preferred'] },
                    },
                    researchPolicyHintScores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                    },
                    delegationHints: {
                        type: 'array',
                        items: { type: 'string', enum: ['decide-for-me', 'ask-me-first'] },
                    },
                    delegationHintScores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                    },
                    constraintHints: stringArraySchema,
                    constraintHintScores: {
                        type: 'object',
                        additionalProperties: { type: 'number' },
                    },
                },
            },
        },
        semanticFeatureTopN: {
            type: 'object',
            additionalProperties: false,
            required: [
                'stageHints',
                'actionHints',
                'interactionHints',
                'researchPolicyHints',
                'delegationHints',
                'constraintHints',
            ],
            properties: {
                stageHints: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['value', 'score', 'provenanceSkillIds'],
                        properties: {
                            value: { type: 'string', minLength: 1 },
                            score: { type: 'number' },
                            provenanceSkillIds: stringArraySchema,
                        },
                    },
                },
                actionHints: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['value', 'score', 'provenanceSkillIds'],
                        properties: {
                            value: { type: 'string', minLength: 1 },
                            score: { type: 'number' },
                            provenanceSkillIds: stringArraySchema,
                        },
                    },
                },
                interactionHints: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['value', 'score', 'provenanceSkillIds'],
                        properties: {
                            value: { type: 'string', minLength: 1 },
                            score: { type: 'number' },
                            provenanceSkillIds: stringArraySchema,
                        },
                    },
                },
                researchPolicyHints: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['value', 'score', 'provenanceSkillIds'],
                        properties: {
                            value: { type: 'string', minLength: 1 },
                            score: { type: 'number' },
                            provenanceSkillIds: stringArraySchema,
                        },
                    },
                },
                delegationHints: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['value', 'score', 'provenanceSkillIds'],
                        properties: {
                            value: { type: 'string', minLength: 1 },
                            score: { type: 'number' },
                            provenanceSkillIds: stringArraySchema,
                        },
                    },
                },
                constraintHints: {
                    type: 'array',
                    items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['value', 'score', 'provenanceSkillIds'],
                        properties: {
                            value: { type: 'string', minLength: 1 },
                            score: { type: 'number' },
                            provenanceSkillIds: stringArraySchema,
                        },
                    },
                },
            },
        },
        reviewerRouteExplainability: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                required: [
                    'requestedSkillId',
                    'reviewerIdentity',
                    'reviewerDisplayName',
                    'registryVersion',
                    'closeoutRunner',
                    'supportedProfiles',
                    'hosts',
                    'activeAuditConsumer',
                ],
                properties: {
                    requestedSkillId: { type: 'string', const: 'code-reviewer' },
                    matchedSkillId: { type: 'string' },
                    reviewerIdentity: { type: 'string', const: 'bmad_code_reviewer' },
                    reviewerDisplayName: { type: 'string', const: 'code-reviewer' },
                    registryVersion: { type: 'string', const: 'reviewer_registry_v1' },
                    sharedCore: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['version', 'rootPath', 'basePromptPath', 'profilePackPath'],
                        properties: {
                            version: { type: 'string', const: 'reviewer_shared_core_v1' },
                            rootPath: { type: 'string', minLength: 1 },
                            basePromptPath: { type: 'string', minLength: 1 },
                            profilePackPath: { type: 'string', minLength: 1 },
                        },
                    },
                    closeoutRunner: { type: 'string', const: 'runAuditorHost' },
                    routeReasonSummary: { type: 'string', minLength: 1 },
                    fallbackStatus: { type: 'string', const: 'fallback_ready' },
                    isomorphismMaturity: { type: 'string', const: 'projection_wired' },
                    complexitySource: { type: 'string', minLength: 1 },
                    remainingBlocker: { type: 'string', minLength: 1 },
                    supportedProfiles: stringArraySchema,
                    requiredRolloutProofs: stringArraySchema,
                    compatibilityGuards: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['codexNoopRequired', 'codexBehaviorChangeAllowed'],
                        properties: {
                            codexNoopRequired: { const: false },
                            codexBehaviorChangeAllowed: { const: true },
                        },
                    },
                    rolloutGate: {
                        type: 'object',
                        additionalProperties: false,
                        required: [
                            'version',
                            'status',
                            'requiredProofs',
                            'completeProofs',
                            'blockingProofs',
                            'cleanupAllowed',
                            'canClaimFullIsomorphism',
                            'summary',
                        ],
                        properties: {
                            version: { type: 'string', const: 'reviewer_rollout_gate_v1' },
                            status: { type: 'string', enum: ['blocked', 'ready'] },
                            requiredProofs: stringArraySchema,
                            completeProofs: stringArraySchema,
                            blockingProofs: stringArraySchema,
                            cleanupAllowed: { type: 'boolean' },
                            canClaimFullIsomorphism: { type: 'boolean' },
                            summary: { type: 'string', minLength: 1 },
                        },
                    },
                    hosts: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['cursor', 'claude', 'codex'],
                        properties: {
                            cursor: {
                                type: 'object',
                                additionalProperties: false,
                                required: [
                                    'carrierSourcePath',
                                    'runtimeTargetPath',
                                    'preferredRoute',
                                    'fallbackRoute',
                                    'fallbackReason',
                                ],
                                properties: {
                                    carrierSourcePath: { type: 'string', minLength: 1 },
                                    runtimeTargetPath: { type: 'string', minLength: 1 },
                                    preferredRoute: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['tool', 'subtypeOrExecutor'],
                                        properties: {
                                            tool: { type: 'string' },
                                            subtypeOrExecutor: { type: 'string' },
                                        },
                                    },
                                    fallbackRoute: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['tool', 'subtypeOrExecutor'],
                                        properties: {
                                            tool: { type: 'string' },
                                            subtypeOrExecutor: { type: 'string' },
                                        },
                                    },
                                    fallbackReason: { type: 'string', minLength: 1 },
                                },
                            },
                            claude: {
                                type: 'object',
                                additionalProperties: false,
                                required: [
                                    'carrierSourcePath',
                                    'runtimeTargetPath',
                                    'preferredRoute',
                                    'fallbackRoute',
                                    'fallbackReason',
                                ],
                                properties: {
                                    carrierSourcePath: { type: 'string', minLength: 1 },
                                    runtimeTargetPath: { type: 'string', minLength: 1 },
                                    preferredRoute: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['tool', 'subtypeOrExecutor'],
                                        properties: {
                                            tool: { type: 'string' },
                                            subtypeOrExecutor: { type: 'string' },
                                        },
                                    },
                                    fallbackRoute: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['tool', 'subtypeOrExecutor'],
                                        properties: {
                                            tool: { type: 'string' },
                                            subtypeOrExecutor: { type: 'string' },
                                        },
                                    },
                                    fallbackReason: { type: 'string', minLength: 1 },
                                },
                            },
                            codex: {
                                type: 'object',
                                additionalProperties: false,
                                required: [
                                    'carrierSourcePath',
                                    'runtimeTargetPath',
                                    'preferredRoute',
                                    'fallbackRoute',
                                    'fallbackReason',
                                ],
                                properties: {
                                    carrierSourcePath: { type: 'string', minLength: 1 },
                                    runtimeTargetPath: { type: 'string', minLength: 1 },
                                    preferredRoute: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['tool', 'subtypeOrExecutor'],
                                        properties: {
                                            tool: { type: 'string' },
                                            subtypeOrExecutor: { type: 'string' },
                                        },
                                    },
                                    fallbackRoute: {
                                        type: 'object',
                                        additionalProperties: false,
                                        required: ['tool', 'subtypeOrExecutor'],
                                        properties: {
                                            tool: { type: 'string' },
                                            subtypeOrExecutor: { type: 'string' },
                                        },
                                    },
                                    fallbackReason: { type: 'string', minLength: 1 },
                                },
                            },
                        },
                    },
                    activeAuditConsumer: {
                        anyOf: [
                            { type: 'null' },
                            {
                                type: 'object',
                                additionalProperties: false,
                                required: ['entryStage', 'profile', 'closeoutStage', 'auditorScript', 'scoreStage'],
                                properties: {
                                    entryStage: { type: 'string' },
                                    profile: { type: 'string' },
                                    closeoutStage: { type: 'string' },
                                    auditorScript: { type: 'string' },
                                    scoreStage: { type: 'string' },
                                    triggerStage: { type: 'string' },
                                },
                            },
                        ],
                    },
                },
            },
        },
        skillAvailabilityMode: {
            type: 'string',
            enum: ['advisory-only', 'execution-filtered', 'not-provided'],
        },
        interactionMode: {
            type: 'string',
            enum: ['single-agent', 'party-mode', 'review-first', 'implement-first'],
        },
        researchPolicy: { type: 'string', enum: ['allowed', 'forbidden', 'preferred'] },
        delegationPreference: { type: 'string', enum: ['decide-for-me', 'ask-me-first'] },
        constraints: stringArraySchema,
        rationale: { type: 'string', minLength: 1 },
        governanceConstraints: stringArraySchema,
        blockedByGovernance: stringArraySchema,
        advisoryOnly: { type: 'boolean' },
    },
};
const executionIntentCandidateSchema = {
    ...executionIntentBaseSchema,
    required: [...executionIntentBaseSchema.required, 'constraints', 'advisoryOnly'],
    properties: {
        ...executionIntentBaseSchema.properties,
        advisoryOnly: { type: 'boolean', const: true },
    },
};
const executionPlanDecisionSchema = {
    ...executionIntentBaseSchema,
    required: [
        ...executionIntentBaseSchema.required,
        'governanceConstraints',
        'blockedByGovernance',
        'advisoryOnly',
    ],
    properties: {
        ...executionIntentBaseSchema.properties,
        advisoryOnly: { type: 'boolean', const: false },
    },
};
const validateExecutionIntentCandidate = ajv.compile(executionIntentCandidateSchema);
const validateExecutionPlanDecision = ajv.compile(executionPlanDecisionSchema);
function assertValidExecutionIntentCandidate(value) {
    if (!validateExecutionIntentCandidate(value)) {
        throw new Error(`Invalid execution intent candidate: ${ajv.errorsText(validateExecutionIntentCandidate.errors, {
            separator: '; ',
        })}`);
    }
}
function assertValidExecutionPlanDecision(value) {
    if (!validateExecutionPlanDecision(value)) {
        throw new Error(`Invalid execution plan decision: ${ajv.errorsText(validateExecutionPlanDecision.errors, {
            separator: '; ',
        })}`);
    }
}
