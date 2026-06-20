"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidPromptRoutingRuleSet = assertValidPromptRoutingRuleSet;
exports.assertValidPromptRoutingHints = assertValidPromptRoutingHints;
const ajv_1 = __importDefault(require("ajv"));
const ajv = new ajv_1.default({ allErrors: true, strict: true, allowUnionTypes: true });
const aliasMapSchema = {
    type: 'object',
    minProperties: 1,
    additionalProperties: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', minLength: 1 },
    },
};
const promptRoutingRuleSetSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
        'version',
        'defaults',
        'stageAliases',
        'actionAliases',
        'artifactAliases',
        'roleAliases',
        'researchPolicyAliases',
        'delegationAliases',
        'constraintAliases',
    ],
    properties: {
        version: { type: 'number' },
        defaults: {
            type: 'object',
            additionalProperties: false,
            required: ['confidenceThresholds', 'researchPolicy', 'delegationPreference'],
            properties: {
                confidenceThresholds: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['medium', 'high'],
                    properties: {
                        medium: { type: 'number', minimum: 0 },
                        high: { type: 'number', minimum: 0 },
                    },
                },
                researchPolicy: { type: 'string', enum: ['allowed', 'forbidden', 'preferred'] },
                delegationPreference: { type: 'string', enum: ['decide-for-me', 'ask-me-first'] },
            },
        },
        stageAliases: aliasMapSchema,
        actionAliases: aliasMapSchema,
        artifactAliases: aliasMapSchema,
        roleAliases: aliasMapSchema,
        researchPolicyAliases: {
            type: 'object',
            additionalProperties: false,
            required: ['forbidden', 'preferred'],
            properties: {
                forbidden: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
                preferred: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
            },
        },
        delegationAliases: {
            type: 'object',
            additionalProperties: false,
            required: ['decide-for-me', 'ask-me-first'],
            properties: {
                'decide-for-me': {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'string', minLength: 1 },
                },
                'ask-me-first': {
                    type: 'array',
                    minItems: 1,
                    items: { type: 'string', minLength: 1 },
                },
            },
        },
        constraintAliases: aliasMapSchema,
    },
};
const promptRoutingHintsSchema = {
    type: 'object',
    additionalProperties: false,
    required: [
        'source',
        'confidence',
        'explicitRolePreference',
        'researchPolicy',
        'delegationPreference',
        'constraints',
        'overrideAllowed',
        'debug',
    ],
    properties: {
        source: { type: 'string', const: 'user-input' },
        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        requestedAction: { type: 'string' },
        inferredStage: { type: 'string' },
        inferredArtifactTarget: { type: 'string' },
        explicitRolePreference: {
            type: 'array',
            items: { type: 'string' },
        },
        recommendedSkillChain: {
            type: 'array',
            items: { type: 'string' },
        },
        recommendedSubagentRoles: {
            type: 'array',
            items: { type: 'string' },
        },
        researchPolicy: { type: 'string', enum: ['allowed', 'forbidden', 'preferred'] },
        delegationPreference: { type: 'string', enum: ['decide-for-me', 'ask-me-first'] },
        constraints: {
            type: 'array',
            items: { type: 'string' },
        },
        overrideAllowed: { type: 'boolean', const: false },
        debug: {
            type: 'object',
            additionalProperties: false,
            required: [
                'score',
                'normalizedInput',
                'matchedStageAliases',
                'matchedActionAliases',
                'matchedArtifactAliases',
                'matchedRoleAliases',
                'matchedResearchPolicyAliases',
                'matchedDelegationAliases',
                'matchedConstraintAliases',
            ],
            properties: {
                score: { type: 'number', minimum: 0 },
                normalizedInput: { type: 'string' },
                matchedStageAliases: { type: 'array', items: { type: 'string' } },
                matchedActionAliases: { type: 'array', items: { type: 'string' } },
                matchedArtifactAliases: { type: 'array', items: { type: 'string' } },
                matchedRoleAliases: { type: 'array', items: { type: 'string' } },
                matchedResearchPolicyAliases: { type: 'array', items: { type: 'string' } },
                matchedDelegationAliases: { type: 'array', items: { type: 'string' } },
                matchedConstraintAliases: { type: 'array', items: { type: 'string' } },
            },
        },
    },
};
const validatePromptRoutingRuleSet = ajv.compile(promptRoutingRuleSetSchema);
const validatePromptRoutingHints = ajv.compile(promptRoutingHintsSchema);
function assertValidPromptRoutingRuleSet(ruleSet) {
    if (!validatePromptRoutingRuleSet(ruleSet)) {
        throw new Error(`Invalid prompt routing rule set: ${ajv.errorsText(validatePromptRoutingRuleSet.errors, {
            separator: '; ',
        })}`);
    }
}
function assertValidPromptRoutingHints(hints) {
    if (!validatePromptRoutingHints(hints)) {
        throw new Error(`Invalid prompt routing hints: ${ajv.errorsText(validatePromptRoutingHints.errors, {
            separator: '; ',
        })}`);
    }
}
