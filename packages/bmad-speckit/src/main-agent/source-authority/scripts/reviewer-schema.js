"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_HANDOFF_V1_SCHEMA = exports.REVIEW_HOST_CLOSEOUT_V1_SCHEMA = exports.REVIEW_OUTPUT_V1_SCHEMA = exports.REVIEW_INPUT_V1_SCHEMA = exports.REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA = exports.REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA = exports.REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA = exports.REVIEW_CLOSEOUT_STAGES = exports.REVIEW_PACKET_EXECUTION_CLOSURE_STATUS_VALUES = exports.REVIEW_SCORING_FAILURE_MODE_VALUES = exports.REVIEW_RERUN_DECISION_VALUES = exports.REVIEW_RESULT_CODES = exports.REVIEW_RESULT_VALUES = exports.REVIEW_STRICTNESS_LEVELS = exports.REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION = exports.REVIEW_GOVERNANCE_CLOSURE_V1_VERSION = exports.REVIEW_HOST_CLOSEOUT_RUNNER = exports.REVIEW_HOST_CLOSEOUT_V1_VERSION = exports.REVIEW_HANDOFF_V1_VERSION = exports.REVIEW_OUTPUT_V1_VERSION = exports.REVIEW_INPUT_V1_VERSION = void 0;
exports.buildRunAuditorHostInput = buildRunAuditorHostInput;
exports.buildReviewHostCloseoutV1 = buildReviewHostCloseoutV1;
exports.buildReviewGovernanceClosureV1 = buildReviewGovernanceClosureV1;
exports.buildReviewCloseoutEnvelopeV1 = buildReviewCloseoutEnvelopeV1;
exports.deriveReviewCloseoutEnvelopeV1 = deriveReviewCloseoutEnvelopeV1;
exports.isReviewCloseoutApproved = isReviewCloseoutApproved;
const reviewer_contract_1 = require("./reviewer-contract");
exports.REVIEW_INPUT_V1_VERSION = 'review_input_v1';
exports.REVIEW_OUTPUT_V1_VERSION = 'review_output_v1';
exports.REVIEW_HANDOFF_V1_VERSION = 'review_handoff_v1';
exports.REVIEW_HOST_CLOSEOUT_V1_VERSION = 'review_host_closeout_v1';
exports.REVIEW_HOST_CLOSEOUT_RUNNER = 'runAuditorHost';
exports.REVIEW_GOVERNANCE_CLOSURE_V1_VERSION = 'review_governance_closure_v1';
exports.REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION = 'review_closeout_envelope_v1';
exports.REVIEW_STRICTNESS_LEVELS = ['standard', 'strict'];
exports.REVIEW_RESULT_VALUES = ['PASS', 'FAIL', 'UNKNOWN'];
exports.REVIEW_RESULT_CODES = ['approved', 'required_fixes', 'blocked', 'unknown'];
exports.REVIEW_RERUN_DECISION_VALUES = [
    'none',
    'rerun_required',
    'rerun_scheduled',
    'rerun_blocked',
];
exports.REVIEW_SCORING_FAILURE_MODE_VALUES = [
    'not_run',
    'succeeded',
    'non_blocking_failure',
];
exports.REVIEW_PACKET_EXECUTION_CLOSURE_STATUS_VALUES = [
    'awaiting_rerun_gate',
    'retry_pending',
    'gate_passed',
    'escalated',
];
exports.REVIEW_CLOSEOUT_STAGES = [
    'story',
    'spec',
    'plan',
    'gaps',
    'tasks',
    'implement',
    'bugfix',
    'standalone_tasks',
];
const BASE_SCHEMA = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
};
exports.REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA = {
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
};
exports.REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA = {
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
        contractVersion: { const: exports.REVIEW_GOVERNANCE_CLOSURE_V1_VERSION },
        implementationReadinessStatusRequired: { const: true },
        implementationReadinessGateName: { const: 'implementation-readiness' },
        gatesLoopRequired: { const: true },
        rerunGatesRequired: { const: true },
        packetExecutionClosureRequired: { const: true },
    },
};
exports.REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA = {
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
        contractVersion: { const: exports.REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION },
        resultCode: { type: 'string', enum: [...exports.REVIEW_RESULT_CODES] },
        requiredFixes: {
            type: 'array',
            items: { type: 'string' },
        },
        requiredFixesDetail: {
            type: 'array',
            items: exports.REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA,
        },
        rerunDecision: { type: 'string', enum: [...exports.REVIEW_RERUN_DECISION_VALUES] },
        scoringFailureMode: { type: 'string', enum: [...exports.REVIEW_SCORING_FAILURE_MODE_VALUES] },
        packetExecutionClosureStatus: {
            type: 'string',
            enum: [...exports.REVIEW_PACKET_EXECUTION_CLOSURE_STATUS_VALUES],
        },
    },
};
exports.REVIEW_INPUT_V1_SCHEMA = {
    ...BASE_SCHEMA,
    $id: exports.REVIEW_INPUT_V1_VERSION,
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
        contractVersion: { const: exports.REVIEW_INPUT_V1_VERSION },
        identity: { const: reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY },
        profile: { type: 'string', enum: [...reviewer_contract_1.REVIEWER_PROFILES] },
        stage: { type: 'string', enum: [...exports.REVIEW_CLOSEOUT_STAGES] },
        artifactDocPath: { type: 'string', minLength: 1 },
        reportPath: { type: 'string', minLength: 1 },
        iterationCount: { type: 'integer', minimum: 0 },
        strictness: { type: 'string', enum: [...exports.REVIEW_STRICTNESS_LEVELS] },
        projectRoot: { type: 'string', minLength: 1 },
    },
};
exports.REVIEW_OUTPUT_V1_SCHEMA = {
    ...BASE_SCHEMA,
    $id: exports.REVIEW_OUTPUT_V1_VERSION,
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
        contractVersion: { const: exports.REVIEW_OUTPUT_V1_VERSION },
        identity: { const: reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY },
        profile: { type: 'string', enum: [...reviewer_contract_1.REVIEWER_PROFILES] },
        stage: { type: 'string', enum: [...exports.REVIEW_CLOSEOUT_STAGES] },
        result: { type: 'string', enum: [...exports.REVIEW_RESULT_VALUES] },
        resultCode: { type: 'string', enum: [...exports.REVIEW_RESULT_CODES] },
        artifactDocPath: { type: 'string', minLength: 1 },
        reportPath: { type: 'string', minLength: 1 },
        requiredFixes: {
            type: 'array',
            items: { type: 'string' },
        },
        requiredFixesDetail: {
            type: 'array',
            items: exports.REVIEW_REQUIRED_FIX_DETAIL_V1_SCHEMA,
        },
        governanceClosure: exports.REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA,
        closeoutEnvelope: exports.REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA,
    },
};
exports.REVIEW_HOST_CLOSEOUT_V1_SCHEMA = {
    ...BASE_SCHEMA,
    $id: exports.REVIEW_HOST_CLOSEOUT_V1_VERSION,
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
        contractVersion: { const: exports.REVIEW_HOST_CLOSEOUT_V1_VERSION },
        runner: { const: exports.REVIEW_HOST_CLOSEOUT_RUNNER },
        projectRoot: { type: 'string', minLength: 1 },
        profile: { type: 'string', enum: [...reviewer_contract_1.REVIEWER_PROFILES] },
        stage: { type: 'string', enum: [...exports.REVIEW_CLOSEOUT_STAGES] },
        artifactPath: { type: 'string', minLength: 1 },
        reportPath: { type: 'string', minLength: 1 },
        iterationCount: {
            anyOf: [
                { type: 'integer', minimum: 0 },
                { type: 'string', minLength: 1 },
            ],
        },
        governanceClosure: exports.REVIEW_GOVERNANCE_CLOSURE_V1_SCHEMA,
        closeoutEnvelope: exports.REVIEW_CLOSEOUT_ENVELOPE_V1_SCHEMA,
    },
};
exports.REVIEW_HANDOFF_V1_SCHEMA = {
    ...BASE_SCHEMA,
    $id: exports.REVIEW_HANDOFF_V1_VERSION,
    required: ['contractVersion', 'identity', 'profile', 'output', 'closeout'],
    properties: {
        contractVersion: { const: exports.REVIEW_HANDOFF_V1_VERSION },
        identity: { const: reviewer_contract_1.REVIEWER_PRODUCT_IDENTITY },
        profile: { type: 'string', enum: [...reviewer_contract_1.REVIEWER_PROFILES] },
        output: exports.REVIEW_OUTPUT_V1_SCHEMA,
        closeout: exports.REVIEW_HOST_CLOSEOUT_V1_SCHEMA,
    },
};
function buildRunAuditorHostInput(closeout) {
    return {
        projectRoot: closeout.projectRoot,
        stage: closeout.stage,
        artifactPath: closeout.artifactPath,
        reportPath: closeout.reportPath,
        iterationCount: closeout.iterationCount,
    };
}
function buildReviewHostCloseoutV1(input) {
    return {
        contractVersion: exports.REVIEW_HOST_CLOSEOUT_V1_VERSION,
        runner: exports.REVIEW_HOST_CLOSEOUT_RUNNER,
        ...input,
    };
}
function buildReviewGovernanceClosureV1() {
    return {
        contractVersion: exports.REVIEW_GOVERNANCE_CLOSURE_V1_VERSION,
        implementationReadinessStatusRequired: true,
        implementationReadinessGateName: 'implementation-readiness',
        gatesLoopRequired: true,
        rerunGatesRequired: true,
        packetExecutionClosureRequired: true,
    };
}
function buildReviewCloseoutEnvelopeV1(input) {
    return {
        contractVersion: exports.REVIEW_CLOSEOUT_ENVELOPE_V1_VERSION,
        ...input,
    };
}
function synthesizeRequiredFixDetails(requiredFixes, detailInput) {
    if (detailInput && detailInput.length > 0) {
        return detailInput;
    }
    return requiredFixes.map((summary, index) => ({
        id: `required-fix-${index + 1}`,
        summary,
        severity: 'required',
    }));
}
function normalizeRequiredFixes(input, effectiveVerdict, blockingReason) {
    const requiredFixes = [
        ...new Set((input.requiredFixes ?? []).map((item) => item.trim()).filter(Boolean)),
    ];
    if (input.scoringFailureMode === 'non_blocking_failure' &&
        input.scoringFailureReason &&
        !requiredFixes.includes(input.scoringFailureReason)) {
        requiredFixes.push(input.scoringFailureReason);
    }
    if (requiredFixes.length === 0 &&
        blockingReason &&
        effectiveVerdict &&
        effectiveVerdict !== 'approved' &&
        effectiveVerdict !== 'unknown') {
        requiredFixes.push(blockingReason);
    }
    return {
        requiredFixes,
        requiredFixesDetail: synthesizeRequiredFixDetails(requiredFixes, input.requiredFixesDetail),
    };
}
function deriveResultCode(auditStatus, effectiveVerdict, scoringFailureMode) {
    if (scoringFailureMode === 'non_blocking_failure') {
        return 'blocked';
    }
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
function deriveRerunDecision(resultCode, effectiveVerdict) {
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
function derivePacketExecutionClosureStatus(resultCode, effectiveVerdict, driftSeverity, scoringFailureMode) {
    if (scoringFailureMode === 'non_blocking_failure') {
        return 'retry_pending';
    }
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
function deriveReviewCloseoutEnvelopeV1(input) {
    const effectiveVerdict = input.scoreRecord?.effective_verdict;
    const driftSeverity = input.scoreRecord?.drift_severity;
    const blockingReason = input.scoreRecord?.blocking_reason ?? null;
    const { requiredFixes, requiredFixesDetail } = normalizeRequiredFixes(input, effectiveVerdict, blockingReason);
    const resultCode = deriveResultCode(input.auditStatus, effectiveVerdict, input.scoringFailureMode);
    const rerunDecision = deriveRerunDecision(resultCode, effectiveVerdict);
    const packetExecutionClosureStatus = derivePacketExecutionClosureStatus(resultCode, effectiveVerdict, driftSeverity, input.scoringFailureMode);
    return buildReviewCloseoutEnvelopeV1({
        resultCode,
        requiredFixes,
        requiredFixesDetail,
        rerunDecision,
        scoringFailureMode: input.scoringFailureMode ?? 'not_run',
        packetExecutionClosureStatus,
    });
}
function isReviewCloseoutApproved(envelope) {
    return (envelope.resultCode === 'approved' && envelope.packetExecutionClosureStatus === 'gate_passed');
}
