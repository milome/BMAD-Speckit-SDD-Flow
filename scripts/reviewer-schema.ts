import {
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
  type ReviewerProfileId,
} from './reviewer-contract';
import type {
  ReadinessDriftSeverity,
  ReadinessEffectiveVerdict,
  RunScoreRecord,
} from '../packages/scoring/writer/types';

export const REVIEW_INPUT_V1_VERSION = 'review_input_v1' as const;
export const REVIEW_OUTPUT_V1_VERSION = 'review_output_v1' as const;
export const REVIEW_HANDOFF_V1_VERSION = 'review_handoff_v1' as const;
export const REVIEW_HOST_CLOSEOUT_V1_VERSION = 'review_host_closeout_v1' as const;
export const REVIEW_HOST_CLOSEOUT_RUNNER = 'runAuditorHost' as const;
export const REVIEW_GOVERNANCE_CLOSURE_V1_VERSION = 'review_governance_closure_v1' as const;
export const REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION = 'review_closeout_envelope_v1' as const;

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

export const REVIEW_RERUN_DECISION_VALUES = [
  'none',
  'rerun_required',
  'rerun_scheduled',
  'rerun_blocked',
] as const;
export type ReviewRerunDecision = (typeof REVIEW_RERUN_DECISION_VALUES)[number];

export const REVIEW_SCORING_FAILURE_MODE_VALUES = [
  'not_run',
  'succeeded',
  'non_blocking_failure',
] as const;
export type ReviewScoringFailureMode = (typeof REVIEW_SCORING_FAILURE_MODE_VALUES)[number];

export const REVIEW_PACKET_EXECUTION_CLOSURE_STATUS_VALUES = [
  'awaiting_rerun_gate',
  'retry_pending',
  'gate_passed',
  'escalated',
] as const;
export type ReviewPacketExecutionClosureStatus =
  (typeof REVIEW_PACKET_EXECUTION_CLOSURE_STATUS_VALUES)[number];

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

export interface ReviewGovernanceClosureV1 {
  contractVersion: typeof REVIEW_GOVERNANCE_CLOSURE_V1_VERSION;
  implementationReadinessStatusRequired: true;
  implementationReadinessGateName: 'implementation-readiness';
  gatesLoopRequired: true;
  rerunGatesRequired: true;
  packetExecutionClosureRequired: true;
}

export interface ReviewCloseoutEnvelopeV1 {
  contractVersion: typeof REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION;
  resultCode: ReviewResultCode;
  requiredFixes: string[];
  requiredFixesDetail: ReviewRequiredFixDetailV1[];
  rerunDecision: ReviewRerunDecision;
  scoringFailureMode: ReviewScoringFailureMode;
  packetExecutionClosureStatus: ReviewPacketExecutionClosureStatus;
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
  governanceClosure?: ReviewGovernanceClosureV1;
  closeoutEnvelope?: ReviewCloseoutEnvelopeV1;
}

export interface ReviewHostCloseoutV1 extends RunAuditorHostInvocationInput {
  contractVersion: typeof REVIEW_HOST_CLOSEOUT_V1_VERSION;
  runner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  profile: ReviewerProfileId;
  stage: ReviewCloseoutStage;
  governanceClosure?: ReviewGovernanceClosureV1;
  closeoutEnvelope?: ReviewCloseoutEnvelopeV1;
}

export interface ReviewHandoffV1 {
  contractVersion: typeof REVIEW_HANDOFF_V1_VERSION;
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  profile: ReviewerProfileId;
  output: ReviewOutputV1;
  closeout: ReviewHostCloseoutV1;
}

export interface ReviewCloseoutEnvelopeDerivationInput {
  auditStatus: ReviewResult;
  scoringFailureMode?: ReviewScoringFailureMode;
  requiredFixes?: string[];
  requiredFixesDetail?: ReviewRequiredFixDetailV1[];
  scoreRecord?: Pick<
    RunScoreRecord,
    'effective_verdict' | 'blocking_reason' | 're_readiness_required' | 'drift_severity'
  > | null;
}

const BASE_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  additionalProperties: false,
} as const;

export const REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA = {
  ...BASE_SCHEMA,
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

export const REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA = {
  ...BASE_SCHEMA,
  required: [
    'contractVersion',
    'implementationReadinessStatusRequired',
    'implementationReadinessGateName',
    'gatesLoopRequired',
    'rerunGatesRequired',
    'packetExecutionClosureRequired',
  ],
  properties: {
    contractVersion: { const: REVIEW_GOVERNANCE_CLOSURE_V1_VERSION },
    implementationReadinessStatusRequired: { const: true },
    implementationReadinessGateName: { const: 'implementation-readiness' },
    gatesLoopRequired: { const: true },
    rerunGatesRequired: { const: true },
    packetExecutionClosureRequired: { const: true },
  },
} as const;

export const REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA = {
  ...BASE_SCHEMA,
  required: [
    'contractVersion',
    'resultCode',
    'requiredFixes',
    'requiredFixesDetail',
    'rerunDecision',
    'scoringFailureMode',
    'packetExecutionClosureStatus',
  ],
  properties: {
    contractVersion: { const: REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION },
    resultCode: { type: 'string', enum: [...REVIEW_RESULT_CODES] },
    requiredFixes: {
      type: 'array',
      items: { type: 'string' },
    },
    requiredFixesDetail: {
      type: 'array',
      items: REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA,
    },
    rerunDecision: { type: 'string', enum: [...REVIEW_RERUN_DECISION_VALUES] },
    scoringFailureMode: { type: 'string', enum: [...REVIEW_SCORING_FAILURE_MODE_VALUES] },
    packetExecutionClosureStatus: {
      type: 'string',
      enum: [...REVIEW_PACKET_EXECUTION_CLOSURE_STATUS_VALUES],
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
    governanceClosure: REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA,
    closeoutEnvelope: REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA,
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
    governanceClosure: REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA,
    closeoutEnvelope: REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA,
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

export function buildReviewGovernanceClosureV1(): ReviewGovernanceClosureV1 {
  return {
    contractVersion: REVIEW_GOVERNANCE_CLOSURE_V1_VERSION,
    implementationReadinessStatusRequired: true,
    implementationReadinessGateName: 'implementation-readiness',
    gatesLoopRequired: true,
    rerunGatesRequired: true,
    packetExecutionClosureRequired: true,
  };
}

export function buildReviewCloseoutEnvelopeV1(input: {
  resultCode: ReviewResultCode;
  requiredFixes: string[];
  requiredFixesDetail: ReviewRequiredFixDetailV1[];
  rerunDecision: ReviewRerunDecision;
  scoringFailureMode: ReviewScoringFailureMode;
  packetExecutionClosureStatus: ReviewPacketExecutionClosureStatus;
}): ReviewCloseoutEnvelopeV1 {
  return {
    contractVersion: REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION,
    ...input,
  };
}

function synthesizeRequiredFixDetails(
  requiredFixes: string[],
  detailInput?: ReviewRequiredFixDetailV1[]
): ReviewRequiredFixDetailV1[] {
  if (detailInput && detailInput.length > 0) {
    return detailInput;
  }
  return requiredFixes.map((summary, index) => ({
    id: `required-fix-${index + 1}`,
    summary,
    severity: 'required',
  }));
}

function normalizeRequiredFixes(
  input: ReviewCloseoutEnvelopeDerivationInput,
  effectiveVerdict: ReadinessEffectiveVerdict | undefined,
  blockingReason: string | null
): { requiredFixes: string[]; requiredFixesDetail: ReviewRequiredFixDetailV1[] } {
  const requiredFixes = [...new Set((input.requiredFixes ?? []).map((item) => item.trim()).filter(Boolean))];

  if (
    requiredFixes.length === 0 &&
    blockingReason &&
    effectiveVerdict &&
    effectiveVerdict !== 'approved' &&
    effectiveVerdict !== 'unknown'
  ) {
    requiredFixes.push(blockingReason);
  }

  return {
    requiredFixes,
    requiredFixesDetail: synthesizeRequiredFixDetails(requiredFixes, input.requiredFixesDetail),
  };
}

function deriveResultCode(
  auditStatus: ReviewResult,
  effectiveVerdict?: ReadinessEffectiveVerdict
): ReviewResultCode {
  if (effectiveVerdict === 'blocked' || effectiveVerdict === 'blocked_pending_rereadiness') {
    return 'blocked';
  }
  if (effectiveVerdict === 'required_fixes') {
    return 'required_fixes';
  }
  if (effectiveVerdict === 'approved') {
    return 'approved';
  }
  if (auditStatus === 'FAIL') {
    return 'required_fixes';
  }
  if (auditStatus === 'UNKNOWN') {
    return 'unknown';
  }
  return 'approved';
}

function deriveRerunDecision(
  resultCode: ReviewResultCode,
  effectiveVerdict?: ReadinessEffectiveVerdict
): ReviewRerunDecision {
  if (effectiveVerdict === 'blocked_pending_rereadiness') {
    return 'rerun_required';
  }
  if (resultCode === 'approved') {
    return 'none';
  }
  if (resultCode === 'unknown') {
    return 'rerun_blocked';
  }
  return 'rerun_required';
}

function derivePacketExecutionClosureStatus(
  resultCode: ReviewResultCode,
  effectiveVerdict: ReadinessEffectiveVerdict | undefined,
  driftSeverity: ReadinessDriftSeverity | undefined
): ReviewPacketExecutionClosureStatus {
  if (resultCode === 'approved') {
    return 'gate_passed';
  }
  if (effectiveVerdict === 'blocked_pending_rereadiness') {
    return 'awaiting_rerun_gate';
  }
  if (resultCode === 'unknown') {
    return 'escalated';
  }
  if (driftSeverity === 'critical') {
    return 'retry_pending';
  }
  return 'retry_pending';
}

export function deriveReviewCloseoutEnvelopeV1(
  input: ReviewCloseoutEnvelopeDerivationInput
): ReviewCloseoutEnvelopeV1 {
  const effectiveVerdict = input.scoreRecord?.effective_verdict;
  const driftSeverity = input.scoreRecord?.drift_severity;
  const blockingReason = input.scoreRecord?.blocking_reason ?? null;
  const { requiredFixes, requiredFixesDetail } = normalizeRequiredFixes(
    input,
    effectiveVerdict,
    blockingReason
  );
  const resultCode = deriveResultCode(input.auditStatus, effectiveVerdict);
  const rerunDecision = deriveRerunDecision(resultCode, effectiveVerdict);
  const packetExecutionClosureStatus = derivePacketExecutionClosureStatus(
    resultCode,
    effectiveVerdict,
    driftSeverity
  );

  return buildReviewCloseoutEnvelopeV1({
    resultCode,
    requiredFixes,
    requiredFixesDetail,
    rerunDecision,
    scoringFailureMode: input.scoringFailureMode ?? 'not_run',
    packetExecutionClosureStatus,
  });
}

export function isReviewCloseoutApproved(
  envelope: Pick<ReviewCloseoutEnvelopeV1, 'resultCode' | 'packetExecutionClosureStatus'>
): boolean {
  return envelope.resultCode === 'approved' && envelope.packetExecutionClosureStatus === 'gate_passed';
}
