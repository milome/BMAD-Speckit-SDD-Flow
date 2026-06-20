"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidModelGovernanceHintCandidate = assertValidModelGovernanceHintCandidate;
exports.assertValidFilteredModelGovernanceHints = assertValidFilteredModelGovernanceHints;
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default({ allErrors: true, strict: true, allowUnionTypes: true });
const stringArraySchema = {
    type: 'array',
    items: { type: 'string' },
};
const recommendationItemSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'reason', 'confidence'],
    properties: {
        value: { type: 'string', minLength: 1 },
        reason: { type: 'string', minLength: 1 },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    },
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
const modelGovernanceHintCandidateSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
        'source',
        'providerId',
        'providerMode',
        'confidence',
        'explicitRolePreference',
        'recommendedSkillChain',
        'recommendedSubagentRoles',
        'researchPolicy',
        'delegationPreference',
        'constraints',
        'rationale',
        'overrideAllowed',
    ],
    properties: {
        source: { type: 'string', const: 'model-provider' },
        providerId: { type: 'string', minLength: 1 },
        providerMode: {
            type: 'string',
            enum: [
                'stub',
                'openai-compatible',
                'anthropic-http',
                'http-json',
                'mcp',
                'cli',
                'cursor-native',
                'claude-native',
                'codex-native',
            ],
        },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        suggestedStage: { type: 'string' },
        suggestedAction: { type: 'string' },
        suggestedArtifactTarget: { type: 'string' },
        explicitRolePreference: stringArraySchema,
        recommendedSkillChain: stringArraySchema,
        recommendedSubagentRoles: stringArraySchema,
        recommendedSkillItems: {
            type: 'array',
            items: recommendationItemSchema,
        },
        recommendedSubagentRoleItems: {
            type: 'array',
            items: recommendationItemSchema,
        },
        researchPolicy: { type: 'string', enum: ['allowed', 'forbidden', 'preferred'] },
        delegationPreference: { type: 'string', enum: ['decide-for-me', 'ask-me-first'] },
        constraints: stringArraySchema,
        rationale: { type: 'string', minLength: 1 },
        overrideAllowed: { type: 'boolean', const: false },
        forbiddenOverrides: {
            type: 'object',
            additionalProperties: false,
            properties: {
                blockerOwnership: { type: 'string' },
                failedCheckSeverity: { type: 'string' },
                artifactRootTarget: { type: 'string' },
                downstreamContinuation: { type: 'boolean' },
            },
        },
    },
};
const filteredModelGovernanceHintsSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
        'source',
        'providerId',
        'providerMode',
        'confidence',
        'explicitRolePreference',
        'recommendedSkillChain',
        'recommendedSubagentRoles',
        'researchPolicy',
        'delegationPreference',
        'constraints',
        'rationale',
        'overrideAllowed',
        'debug',
    ],
    properties: {
        source: { type: 'string', const: 'model-provider' },
        providerId: { type: 'string', minLength: 1 },
        providerMode: {
            type: 'string',
            enum: [
                'stub',
                'openai-compatible',
                'anthropic-http',
                'http-json',
                'mcp',
                'cli',
                'cursor-native',
                'claude-native',
                'codex-native',
            ],
        },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        suggestedStage: { type: 'string' },
        suggestedAction: { type: 'string' },
        suggestedArtifactTarget: { type: 'string' },
        explicitRolePreference: stringArraySchema,
        recommendedSkillChain: stringArraySchema,
        recommendedSubagentRoles: stringArraySchema,
        recommendedSkillItems: {
            type: 'array',
            items: structuredRecommendationItemSchema,
        },
        recommendedSubagentRoleItems: {
            type: 'array',
            items: structuredRecommendationItemSchema,
        },
        researchPolicy: { type: 'string', enum: ['allowed', 'forbidden', 'preferred'] },
        delegationPreference: { type: 'string', enum: ['decide-for-me', 'ask-me-first'] },
        constraints: stringArraySchema,
        rationale: { type: 'string', minLength: 1 },
        overrideAllowed: { type: 'boolean', const: false },
        debug: {
            type: 'object',
            additionalProperties: false,
            required: ['strippedForbiddenOverrides', 'ignoredBecause'],
            properties: {
                strippedForbiddenOverrides: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: [
                            'blockerOwnership',
                            'failedCheckSeverity',
                            'artifactRootTarget',
                            'downstreamContinuation',
                        ],
                    },
                },
                ignoredBecause: stringArraySchema,
            },
        },
    },
};
const validateModelGovernanceHintCandidate = ajv.compile(modelGovernanceHintCandidateSchema);
const validateFilteredModelGovernanceHints = ajv.compile(filteredModelGovernanceHintsSchema);
function assertValidModelGovernanceHintCandidate(hint) {
    if (!validateModelGovernanceHintCandidate(hint)) {
        throw new Error(`Invalid model governance hint candidate: ${ajv.errorsText(validateModelGovernanceHintCandidate.errors, { separator: '; ' })}`);
    }
}
function assertValidFilteredModelGovernanceHints(hints) {
    if (!validateFilteredModelGovernanceHints(hints)) {
        throw new Error(`Invalid filtered model governance hints: ${ajv.errorsText(validateFilteredModelGovernanceHints.errors, { separator: '; ' })}`);
    }
}
