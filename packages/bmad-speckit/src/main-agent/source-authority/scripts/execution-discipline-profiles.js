"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXECUTION_DISCIPLINE_PROFILES = void 0;
exports.resolveExecutionDisciplineProfile = resolveExecutionDisciplineProfile;
const node_crypto_1 = require("node:crypto");
function sha256Json(value) {
    return `sha256:${(0, node_crypto_1.createHash)('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}
function stableStringify(value) {
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    return `{${Object.keys(value)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
        .join(',')}}`;
}
function baseProfile(flow) {
    const common = {
        flow,
        authority: 'discipline_profile_only',
        rules: [
            'Preserve compiled model_packet.json requirement authority.',
            'Do not add, remove, or rewrite confirmed MUST/TRACE/EVD/ACC/E2E rows.',
            'Record parseable audit and score evidence before no-gap credit.',
        ],
        requiredEvidence: ['task_report', 'validation_commands', 'audit_report', 'score_receipt'],
        auditScoringConvergencePolicy: {
            auditPassRequired: true,
            criticalAuditorNoNewGapRequired: true,
            scoreReceiptRequired: true,
            dimensionContractMatchRequired: true,
            thresholdPassRequired: true,
            vetoForbidden: true,
            iterationCountRequired: true,
            freshHashesRequired: true,
        },
        forbiddenOverrides: [
            'traceRows',
            'covers',
            'requiredCommands',
            'taskList',
            'section7Tasks',
            'legacyPromptBody',
            'sourcePathAuthority',
        ],
        lintPolicy: {
            required: true,
            blockOnWarnings: true,
            forbiddenWaivers: ['unrelated task', 'out of scope lint'],
        },
        docCommentPolicy: {
            publicApiRequired: true,
            languages: ['typescript', 'javascript', 'python'],
        },
        subagentContinuityPolicy: {
            returnAllowedOnlyOn: [
                'scope_complete',
                'real_blocker',
                'audit_boundary',
                'resume_checkpoint',
            ],
        },
        auditReportContract: {
            parseableScoreBlockRequired: true,
            allowedGrades: ['A', 'B', 'C', 'D'],
            forbidScoreRanges: true,
        },
        hostCloseoutPolicy: {
            prosePassIsCompletion: false,
        },
    };
    if (flow === 'bugfix') {
        return {
            profileId: 'bugfix_execution',
            sourceReferences: ['bmad-bug-assistant/SKILL.md', 'bugfix audit template'],
            dimensionContractSelector: 'bugfix',
            failureExclusionPolicy: {
                objectiveFieldsRequired: true,
                userApprovalRequiredForExcludedTests: false,
            },
            testExecutionPolicy: {
                projectRootRequired: true,
                pytestCleanupEvidenceRequired: true,
            },
            ...common,
        };
    }
    if (flow === 'standalone_tasks') {
        return {
            profileId: 'standalone_tasks_execution',
            sourceReferences: ['bmad-standalone-tasks/SKILL.md', 'standalone task audit template'],
            dimensionContractSelector: 'tasks',
            failureExclusionPolicy: {
                objectiveFieldsRequired: true,
                userApprovalRequiredForExcludedTests: false,
            },
            testExecutionPolicy: {
                projectRootRequired: true,
                pytestCleanupEvidenceRequired: false,
            },
            ...common,
        };
    }
    return {
        profileId: 'story_execution',
        sourceReferences: ['bmad-story-assistant/SKILL.md', 'story audit template'],
        dimensionContractSelector: 'story',
        failureExclusionPolicy: {
            objectiveFieldsRequired: true,
            userApprovalRequiredForExcludedTests: true,
        },
        testExecutionPolicy: {
            projectRootRequired: true,
            pytestCleanupEvidenceRequired: false,
        },
        ...common,
    };
}
function withHash(profile) {
    return {
        ...profile,
        profileHash: sha256Json(profile),
    };
}
exports.EXECUTION_DISCIPLINE_PROFILES = {
    story: withHash(baseProfile('story')),
    bugfix: withHash(baseProfile('bugfix')),
    standalone_tasks: withHash(baseProfile('standalone_tasks')),
};
function resolveExecutionDisciplineProfile(flow) {
    return exports.EXECUTION_DISCIPLINE_PROFILES[flow];
}
