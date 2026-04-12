import {
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
  type ReviewerProfileId,
} from './reviewer-contract';

export const REVIEW_INPUT_V1_VERSION = 'review_input_v1' as const;
export const REVIEW_OUTPUT_V1_VERSION = 'review_output_v1' as const;
export const REVIEW_HANDOFF_V1_VERSION = 'review_handoff_v1' as const;
export const REVIEW_HOST_CLOSEOUT_V1_VERSION = 'review_host_closeout_v1' as const;
export const REVIEW_HOST_CLOSEOUT_RUNNER = 'runAuditorHost' as const;

export const REVIEW_STRICTNESS_LEVELS = ['standard', 'strict'] as const;
export type ReviewStrictness = (typeof REVIEW_STRICTNESS_LEVELS)[number];

export const REVIEW_RESULT_VALUES = ['PASS', 'FAIL', 'UNKNOWN'] as const;
export type ReviewResult = (typeof REVIEW_RESULT_VALUES)[number];

export const REVIEW_RESULT_CODES = [
  'approved',
  'required_fixes',
  'blocked',
  'unknown',
] as const;
export type ReviewResultCode = (typeof REVIEW_RESULT_CODES)[number];

export const REVIEW_CLOSEOUT_STAGES = [
  'story',
  'spec',
  'plan',
  'gaps',
  'tasks',
  'implement',
  'bugfix',
  'standalone_tasks',
] as const;
export type ReviewCloseoutStage = (typeof REVIEW_CLOSEOUT_STAGES)[number];

export type RunAuditorHostStage = ReviewCloseoutStage | 'document';

export interface RunAuditorHostInvocationInput {
  projectRoot: string;
  stage: RunAuditorHostStage;
  artifactPath: string;
  reportPath?: string;
  iterationCount?: string | number;
}

export interface ReviewInputV1 {
  contractVersion: typeof REVIEW_INPUT_V1_VERSION;
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  profile: ReviewerProfileId;
  stage: ReviewCloseoutStage;
  artifactDocPath: string;
  reportPath: string;
  iterationCount: number;
  strictness: ReviewStrictness;
  projectRoot?: string;
}

export interface ReviewRequiredFixDetailV1 {
  id: string;
  summary: string;
  severity: 'required' | 'recommended';
}

export interface ReviewOutputV1 {
  contractVersion: typeof REVIEW_OUTPUT_V1_VERSION;
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  profile: ReviewerProfileId;
  stage: ReviewCloseoutStage;
  result: ReviewResult;
  resultCode: ReviewResultCode;
  artifactDocPath: string;
  reportPath: string;
  requiredFixes: string[];
  requiredFixesDetail: ReviewRequiredFixDetailV1[];
}

export interface ReviewHostCloseoutV1 extends RunAuditorHostInvocationInput {
  contractVersion: typeof REVIEW_HOST_CLOSEOUT_V1_VERSION;
  runner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  profile: ReviewerProfileId;
  stage: ReviewCloseoutStage;
}

export interface ReviewHandoffV1 {
  contractVersion: typeof REVIEW_HANDOFF_V1_VERSION;
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  profile: ReviewerProfileId;
  output: ReviewOutputV1;
  closeout: ReviewHostCloseoutV1;
}

const BASE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
} as const;

export const REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA = {
  ...BASE_SCHEMA,
  $id: 'review_required_fix_detail_v1',
  required: ['id', 'summary', 'severity'],
  properties: {
    id: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    severity: {
      type: 'string',
      enum: ['required', 'recommended'],
    },
  },
} as const;

export const REVIEW_INPUT_V1_SCHEMA = {
  ...BASE_SCHEMA,
  $id: REVIEW_INPUT_V1_VERSION,
  required: [
    'contractVersion',
    'identity',
    'profile',
    'stage',
    'artifactDocPath',
    'reportPath',
    'iterationCount',
    'strictness',
  ],
  properties: {
    contractVersion: { const: REVIEW_INPUT_V1_VERSION },
    identity: { const: REVIEWER_PRODUCT_IDENTITY },
    profile: { type: 'string', enum: [...REVIEWER_PROFILES] },
    stage: { type: 'string', enum: [...REVIEW_CLOSEOUT_STAGES] },
    artifactDocPath: { type: 'string', minLength: 1 },
    reportPath: { type: 'string', minLength: 1 },
    iterationCount: { type: 'integer', minimum: 0 },
    strictness: { type: 'string', enum: [...REVIEW_STRICTNESS_LEVELS] },
    projectRoot: { type: 'string', minLength: 1 },
  },
} as const;

export const REVIEW_OUTPUT_V1_SCHEMA = {
  ...BASE_SCHEMA,
  $id: REVIEW_OUTPUT_V1_VERSION,
  required: [
    'contractVersion',
    'identity',
    'profile',
    'stage',
    'result',
    'resultCode',
    'artifactDocPath',
    'reportPath',
    'requiredFixes',
    'requiredFixesDetail',
  ],
  properties: {
    contractVersion: { const: REVIEW_OUTPUT_V1_VERSION },
    identity: { const: REVIEWER_PRODUCT_IDENTITY },
    profile: { type: 'string', enum: [...REVIEWER_PROFILES] },
    stage: { type: 'string', enum: [...REVIEW_CLOSEOUT_STAGES] },
    result: { type: 'string', enum: [...REVIEW_RESULT_VALUES] },
    resultCode: { type: 'string', enum: [...REVIEW_RESULT_CODES] },
    artifactDocPath: { type: 'string', minLength: 1 },
    reportPath: { type: 'string', minLength: 1 },
    requiredFixes: {
      type: 'array',
      items: { type: 'string' },
    },
    requiredFixesDetail: {
      type: 'array',
      items: REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA,
    },
  },
} as const;

export const REVIEW_HOST_CLOSEOUT_V1_SCHEMA = {
  ...BASE_SCHEMA,
  $id: REVIEW_HOST_CLOSEOUT_V1_VERSION,
  required: [
    'contractVersion',
    'runner',
    'projectRoot',
    'profile',
    'stage',
    'artifactPath',
    'reportPath',
  ],
  properties: {
    contractVersion: { const: REVIEW_HOST_CLOSEOUT_V1_VERSION },
    runner: { const: REVIEW_HOST_CLOSEOUT_RUNNER },
    projectRoot: { type: 'string', minLength: 1 },
    profile: { type: 'string', enum: [...REVIEWER_PROFILES] },
    stage: { type: 'string', enum: [...REVIEW_CLOSEOUT_STAGES] },
    artifactPath: { type: 'string', minLength: 1 },
    reportPath: { type: 'string', minLength: 1 },
    iterationCount: {
      anyOf: [{ type: 'integer', minimum: 0 }, { type: 'string', minLength: 1 }],
    },
  },
} as const;

export const REVIEW_HANDOFF_V1_SCHEMA = {
  ...BASE_SCHEMA,
  $id: REVIEW_HANDOFF_V1_VERSION,
  required: ['contractVersion', 'identity', 'profile', 'output', 'closeout'],
  properties: {
    contractVersion: { const: REVIEW_HANDOFF_V1_VERSION },
    identity: { const: REVIEWER_PRODUCT_IDENTITY },
    profile: { type: 'string', enum: [...REVIEWER_PROFILES] },
    output: REVIEW_OUTPUT_V1_SCHEMA,
    closeout: REVIEW_HOST_CLOSEOUT_V1_SCHEMA,
  },
} as const;

export function buildRunAuditorHostInput(
  closeout: ReviewHostCloseoutV1
): RunAuditorHostInvocationInput {
  return {
    projectRoot: closeout.projectRoot,
    stage: closeout.stage,
    artifactPath: closeout.artifactPath,
    reportPath: closeout.reportPath,
    iterationCount: closeout.iterationCount,
  };
}

export function buildReviewHostCloseoutV1(
  input: Omit<ReviewHostCloseoutV1, 'contractVersion' | 'runner'>
): ReviewHostCloseoutV1 {
  return {
    contractVersion: REVIEW_HOST_CLOSEOUT_V1_VERSION,
    runner: REVIEW_HOST_CLOSEOUT_RUNNER,
    ...input,
  };
}
