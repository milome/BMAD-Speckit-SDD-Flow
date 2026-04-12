import {
  FACILITATOR_PRODUCT_IDENTITY,
  REVIEWER_DISPLAY_NAME,
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
  type ReviewerProfileId,
} from './reviewer-contract';
import {
  REVIEW_HANDOFF_V1_VERSION,
  REVIEW_HOST_CLOSEOUT_RUNNER,
  REVIEW_HOST_CLOSEOUT_V1_VERSION,
  REVIEW_INPUT_V1_VERSION,
  REVIEW_OUTPUT_V1_VERSION,
  type RunAuditorHostStage,
  type ReviewCloseoutStage,
} from './reviewer-schema';

export const REVIEWER_REGISTRY_VERSION = 'reviewer_registry_v1' as const;
export const REVIEWER_CONTRACT_PROJECTION_VERSION = 'reviewer_contract_projection_v1' as const;

export type ReviewerHostId = 'cursor' | 'claude';
export type ReviewerRouteTool = 'cursor-task' | 'mcp_task' | 'Agent';

export interface ReviewerRoute {
  tool: ReviewerRouteTool;
  subtypeOrExecutor: string;
}

export interface ReviewerHostCloseoutBinding {
  contractVersion: typeof REVIEW_HOST_CLOSEOUT_V1_VERSION;
  runner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  stage: ReviewCloseoutStage;
}

export interface ReviewerHostRegistration {
  preferredRoute: ReviewerRoute;
  fallbackRoute: ReviewerRoute;
  closeout: ReviewerHostCloseoutBinding;
}

export interface ReviewerRegistration {
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  profile: ReviewerProfileId;
  hosts: Record<ReviewerHostId, ReviewerHostRegistration>;
}

export interface ReviewerHostRouteSummary {
  preferredRoute: ReviewerRoute;
  fallbackRoute: ReviewerRoute;
}

export interface ReviewerAuditStageConsumer {
  entryStage: RunAuditorHostStage;
  profile: ReviewerProfileId;
  closeoutStage: ReviewCloseoutStage;
  auditorScript: string;
  scoreStage: 'story' | 'spec' | 'plan' | 'gaps' | 'tasks' | 'implement';
  triggerStage?: string;
}

export interface ReviewerRouteExplainability {
  requestedSkillId: 'code-reviewer';
  matchedSkillId?: string;
  reviewerIdentity: typeof REVIEWER_PRODUCT_IDENTITY;
  reviewerDisplayName: typeof REVIEWER_DISPLAY_NAME;
  registryVersion: typeof REVIEWER_REGISTRY_VERSION;
  closeoutRunner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  supportedProfiles: readonly ReviewerProfileId[];
  hosts: Record<ReviewerHostId, ReviewerHostRouteSummary>;
  activeAuditConsumer: ReviewerAuditStageConsumer | null;
}

export interface ReviewerContractProjection {
  version: typeof REVIEWER_CONTRACT_PROJECTION_VERSION;
  reviewerIdentity: typeof REVIEWER_PRODUCT_IDENTITY;
  reviewerDisplayName: typeof REVIEWER_DISPLAY_NAME;
  facilitatorIdentity: typeof FACILITATOR_PRODUCT_IDENTITY;
  registryVersion: typeof REVIEWER_REGISTRY_VERSION;
  schemaVersions: {
    input: typeof REVIEW_INPUT_V1_VERSION;
    output: typeof REVIEW_OUTPUT_V1_VERSION;
    handoff: typeof REVIEW_HANDOFF_V1_VERSION;
    closeout: typeof REVIEW_HOST_CLOSEOUT_V1_VERSION;
  };
  closeoutRunner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  supportedProfiles: readonly ReviewerProfileId[];
  supportedAuditEntryStages: readonly RunAuditorHostStage[];
  activeAuditConsumer: ReviewerAuditStageConsumer | null;
}

function createRegistration(
  profile: ReviewerProfileId,
  stage: ReviewCloseoutStage
): ReviewerRegistration {
  return {
    identity: REVIEWER_PRODUCT_IDENTITY,
    profile,
    hosts: {
      cursor: {
        preferredRoute: {
          tool: 'cursor-task',
          subtypeOrExecutor: 'code-reviewer',
        },
        fallbackRoute: {
          tool: 'mcp_task',
          subtypeOrExecutor: 'generalPurpose',
        },
        closeout: {
          contractVersion: REVIEW_HOST_CLOSEOUT_V1_VERSION,
          runner: REVIEW_HOST_CLOSEOUT_RUNNER,
          stage,
        },
      },
      claude: {
        preferredRoute: {
          tool: 'Agent',
          subtypeOrExecutor: 'code-reviewer',
        },
        fallbackRoute: {
          tool: 'Agent',
          subtypeOrExecutor: 'general-purpose',
        },
        closeout: {
          contractVersion: REVIEW_HOST_CLOSEOUT_V1_VERSION,
          runner: REVIEW_HOST_CLOSEOUT_RUNNER,
          stage,
        },
      },
    },
  };
}

export const REVIEWER_REGISTRY: Record<ReviewerProfileId, ReviewerRegistration> = {
  story_audit: createRegistration('story_audit', 'story'),
  spec_audit: createRegistration('spec_audit', 'spec'),
  plan_audit: createRegistration('plan_audit', 'plan'),
  tasks_audit: createRegistration('tasks_audit', 'tasks'),
  implement_audit: createRegistration('implement_audit', 'implement'),
  bugfix_doc_audit: createRegistration('bugfix_doc_audit', 'bugfix'),
  tasks_doc_audit: createRegistration('tasks_doc_audit', 'standalone_tasks'),
};

export const REVIEWER_AUDIT_STAGE_CONSUMERS: Record<
  RunAuditorHostStage,
  ReviewerAuditStageConsumer
> = {
  story: {
    entryStage: 'story',
    profile: 'story_audit',
    closeoutStage: 'story',
    auditorScript: 'auditor-document',
    scoreStage: 'story',
    triggerStage: 'bmad_story_stage2',
  },
  spec: {
    entryStage: 'spec',
    profile: 'spec_audit',
    closeoutStage: 'spec',
    auditorScript: 'auditor-spec',
    scoreStage: 'spec',
    triggerStage: 'speckit_1_2',
  },
  plan: {
    entryStage: 'plan',
    profile: 'plan_audit',
    closeoutStage: 'plan',
    auditorScript: 'auditor-plan',
    scoreStage: 'plan',
    triggerStage: 'speckit_2_2',
  },
  gaps: {
    entryStage: 'gaps',
    profile: 'tasks_audit',
    closeoutStage: 'gaps',
    auditorScript: 'auditor-gaps',
    scoreStage: 'gaps',
    triggerStage: 'speckit_3_2',
  },
  tasks: {
    entryStage: 'tasks',
    profile: 'tasks_audit',
    closeoutStage: 'tasks',
    auditorScript: 'auditor-tasks',
    scoreStage: 'tasks',
    triggerStage: 'speckit_4_2',
  },
  implement: {
    entryStage: 'implement',
    profile: 'implement_audit',
    closeoutStage: 'implement',
    auditorScript: 'auditor-implement',
    scoreStage: 'implement',
    triggerStage: 'speckit_5_2',
  },
  bugfix: {
    entryStage: 'bugfix',
    profile: 'bugfix_doc_audit',
    closeoutStage: 'bugfix',
    auditorScript: 'auditor-bugfix',
    scoreStage: 'implement',
    triggerStage: 'speckit_5_2',
  },
  document: {
    entryStage: 'document',
    profile: 'tasks_doc_audit',
    closeoutStage: 'standalone_tasks',
    auditorScript: 'auditor-tasks-doc',
    scoreStage: 'tasks',
    triggerStage: 'speckit_4_2',
  },
  standalone_tasks: {
    entryStage: 'standalone_tasks',
    profile: 'tasks_doc_audit',
    closeoutStage: 'standalone_tasks',
    auditorScript: 'auditor-tasks-doc',
    scoreStage: 'tasks',
    triggerStage: 'speckit_4_2',
  },
};

const REVIEWER_SUPPORTED_AUDIT_ENTRY_STAGES = Object.keys(
  REVIEWER_AUDIT_STAGE_CONSUMERS
) as RunAuditorHostStage[];

const REVIEWER_HOST_ROUTE_SUMMARY: Record<ReviewerHostId, ReviewerHostRouteSummary> = {
  cursor: {
    preferredRoute: REVIEWER_REGISTRY.story_audit.hosts.cursor.preferredRoute,
    fallbackRoute: REVIEWER_REGISTRY.story_audit.hosts.cursor.fallbackRoute,
  },
  claude: {
    preferredRoute: REVIEWER_REGISTRY.story_audit.hosts.claude.preferredRoute,
    fallbackRoute: REVIEWER_REGISTRY.story_audit.hosts.claude.fallbackRoute,
  },
};

export function listReviewerRegistrations(): ReviewerRegistration[] {
  return REVIEWER_PROFILES.map((profile) => REVIEWER_REGISTRY[profile]);
}

export function getReviewerRegistration(profile: ReviewerProfileId): ReviewerRegistration {
  return REVIEWER_REGISTRY[profile];
}

export function isReviewerAuditEntryStage(value: string): value is RunAuditorHostStage {
  return value in REVIEWER_AUDIT_STAGE_CONSUMERS;
}

export function getReviewerConsumerByAuditStage(
  stage: RunAuditorHostStage
): ReviewerAuditStageConsumer {
  return REVIEWER_AUDIT_STAGE_CONSUMERS[stage];
}

export function buildReviewerRouteExplainability(input?: {
  requestedSkillId?: 'code-reviewer';
  matchedSkillId?: string;
  auditEntryStage?: RunAuditorHostStage | null;
}): ReviewerRouteExplainability {
  return {
    requestedSkillId: input?.requestedSkillId ?? 'code-reviewer',
    ...(input?.matchedSkillId ? { matchedSkillId: input.matchedSkillId } : {}),
    reviewerIdentity: REVIEWER_PRODUCT_IDENTITY,
    reviewerDisplayName: REVIEWER_DISPLAY_NAME,
    registryVersion: REVIEWER_REGISTRY_VERSION,
    closeoutRunner: REVIEW_HOST_CLOSEOUT_RUNNER,
    supportedProfiles: REVIEWER_PROFILES,
    hosts: REVIEWER_HOST_ROUTE_SUMMARY,
    activeAuditConsumer: input?.auditEntryStage
      ? getReviewerConsumerByAuditStage(input.auditEntryStage)
      : null,
  };
}

export function buildReviewerContractProjection(input?: {
  auditEntryStage?: RunAuditorHostStage | null;
}): ReviewerContractProjection {
  return {
    version: REVIEWER_CONTRACT_PROJECTION_VERSION,
    reviewerIdentity: REVIEWER_PRODUCT_IDENTITY,
    reviewerDisplayName: REVIEWER_DISPLAY_NAME,
    facilitatorIdentity: FACILITATOR_PRODUCT_IDENTITY,
    registryVersion: REVIEWER_REGISTRY_VERSION,
    schemaVersions: {
      input: REVIEW_INPUT_V1_VERSION,
      output: REVIEW_OUTPUT_V1_VERSION,
      handoff: REVIEW_HANDOFF_V1_VERSION,
      closeout: REVIEW_HOST_CLOSEOUT_V1_VERSION,
    },
    closeoutRunner: REVIEW_HOST_CLOSEOUT_RUNNER,
    supportedProfiles: REVIEWER_PROFILES,
    supportedAuditEntryStages: REVIEWER_SUPPORTED_AUDIT_ENTRY_STAGES,
    activeAuditConsumer: input?.auditEntryStage
      ? getReviewerConsumerByAuditStage(input.auditEntryStage)
      : null,
  };
}

export function mapFlowStageToReviewerAuditEntryStage(
  flow: string | null | undefined,
  stage: string | null | undefined
): RunAuditorHostStage | null {
  if (!flow || !stage) {
    return null;
  }

  if (flow === 'story') {
    switch (stage) {
      case 'story':
      case 'story_audit':
        return 'story';
      case 'spec':
      case 'specify':
        return 'spec';
      case 'plan':
        return 'plan';
      case 'gaps':
        return 'gaps';
      case 'tasks':
        return 'tasks';
      case 'implement':
        return 'implement';
      default:
        return null;
    }
  }

  if (flow === 'bugfix') {
    if (stage === 'bugfix' || stage === 'implement' || stage === 'post_audit') {
      return 'bugfix';
    }
    return null;
  }

  if (flow === 'standalone_tasks') {
    if (
      stage === 'document' ||
      stage === 'standalone_tasks' ||
      stage === 'tasks' ||
      stage === 'implement' ||
      stage === 'post_audit'
    ) {
      return 'standalone_tasks';
    }
    return null;
  }

  return null;
}
