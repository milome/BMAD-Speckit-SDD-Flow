import { createHash } from 'node:crypto';
import type {
  ExecutionDisciplineProfile,
  OrchestrationFlow,
} from './orchestration-dispatch-contract';

function sha256Json(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
    )
    .join(',')}}`;
}

function baseProfile(flow: OrchestrationFlow): Omit<ExecutionDisciplineProfile, 'profileHash'> {
  const common = {
    flow,
    authority: 'discipline_profile_only' as const,
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
      prosePassIsCompletion: false as const,
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

function withHash(
  profile: Omit<ExecutionDisciplineProfile, 'profileHash'>
): ExecutionDisciplineProfile {
  return {
    ...profile,
    profileHash: sha256Json(profile),
  };
}

export const EXECUTION_DISCIPLINE_PROFILES: Record<OrchestrationFlow, ExecutionDisciplineProfile> =
  {
    story: withHash(baseProfile('story')),
    bugfix: withHash(baseProfile('bugfix')),
    standalone_tasks: withHash(baseProfile('standalone_tasks')),
  };

export function resolveExecutionDisciplineProfile(
  flow: OrchestrationFlow
): ExecutionDisciplineProfile {
  return EXECUTION_DISCIPLINE_PROFILES[flow];
}
