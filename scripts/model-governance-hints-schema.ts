import Ajv from 'ajv';
import type {
  PromptRoutingDelegationPreference,
  PromptRoutingHintConfidence,
  PromptRoutingResearchPolicy,
} from './prompt-routing-hints-schema';

export type ModelGovernanceProviderMode =
  | 'stub'
  | 'openai-compatible'
  | 'anthropic-http'
  | 'http-json'
  | 'mcp'
  | 'cli'
  | 'cursor-native'
  | 'claude-native'
  | 'codex-native';

export type ModelGovernanceForbiddenOverrideKey =
  | 'blockerOwnership'
  | 'failedCheckSeverity'
  | 'artifactRootTarget'
  | 'downstreamContinuation';

export interface ModelGovernanceRecommendationItem {
  value: string;
  reason: string;
  confidence: PromptRoutingHintConfidence;
}

export interface StructuredGovernanceRecommendationItem {
  value: string;
  source: 'model-provider';
  reason: string;
  confidence: PromptRoutingHintConfidence;
  consumed: boolean;
  matchedSkillId?: string;
  matchedBy?: 'exact-id' | 'substring' | 'token-overlap' | 'unmatched';
  matchScore?: number;
  filteredBecause: string[];
}

export interface ModelGovernanceHintCandidate {
  source: 'model-provider';
  providerId: string;
  providerMode: ModelGovernanceProviderMode;
  confidence: PromptRoutingHintConfidence;
  suggestedStage?: string;
  suggestedAction?: string;
  suggestedArtifactTarget?: string;
  explicitRolePreference: string[];
  recommendedSkillChain: string[];
  recommendedSubagentRoles: string[];
  recommendedSkillItems?: ModelGovernanceRecommendationItem[];
  recommendedSubagentRoleItems?: ModelGovernanceRecommendationItem[];
  researchPolicy: PromptRoutingResearchPolicy;
  delegationPreference: PromptRoutingDelegationPreference;
  constraints: string[];
  rationale: string;
  overrideAllowed: false;
  forbiddenOverrides?: Partial<Record<ModelGovernanceForbiddenOverrideKey, string | boolean>>;
}

export interface FilteredModelGovernanceHints {
  source: 'model-provider';
  providerId: string;
  providerMode: ModelGovernanceProviderMode;
  confidence: PromptRoutingHintConfidence;
  suggestedStage?: string;
  suggestedAction?: string;
  suggestedArtifactTarget?: string;
  explicitRolePreference: string[];
  recommendedSkillChain: string[];
  recommendedSubagentRoles: string[];
  recommendedSkillItems: StructuredGovernanceRecommendationItem[];
  recommendedSubagentRoleItems: StructuredGovernanceRecommendationItem[];
  researchPolicy: PromptRoutingResearchPolicy;
  delegationPreference: PromptRoutingDelegationPreference;
  constraints: string[];
  rationale: string;
  overrideAllowed: false;
  debug: {
    strippedForbiddenOverrides: ModelGovernanceForbiddenOverrideKey[];
    ignoredBecause: string[];
  };
}

const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });

const stringArraySchema = {
  type: 'array',
  items: { type: 'string' },
} as const;

const recommendationItemSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['value', 'reason', 'confidence'],
  properties: {
    value: { type: 'string', minLength: 1 },
    reason: { type: 'string', minLength: 1 },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
  },
} as const;

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
} as const;

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
} as const;

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
} as const;

const validateModelGovernanceHintCandidate = ajv.compile(modelGovernanceHintCandidateSchema);
const validateFilteredModelGovernanceHints = ajv.compile(filteredModelGovernanceHintsSchema);

export function assertValidModelGovernanceHintCandidate(
  hint: unknown
): asserts hint is ModelGovernanceHintCandidate {
  if (!validateModelGovernanceHintCandidate(hint)) {
    throw new Error(
      `Invalid model governance hint candidate: ${ajv.errorsText(
        validateModelGovernanceHintCandidate.errors,
        { separator: '; ' }
      )}`
    );
  }
}

export function assertValidFilteredModelGovernanceHints(
  hints: unknown
): asserts hints is FilteredModelGovernanceHints {
  if (!validateFilteredModelGovernanceHints(hints)) {
    throw new Error(
      `Invalid filtered model governance hints: ${ajv.errorsText(
        validateFilteredModelGovernanceHints.errors,
        { separator: '; ' }
      )}`
    );
  }
}
