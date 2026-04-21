import {
  FACILITATOR_PRODUCT_IDENTITY,
  CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH,
  CLAUDE_REVIEWER_RUNTIME_TARGET_PATH,
  CURSOR_REVIEWER_CANONICAL_SOURCE_PATH,
  CURSOR_REVIEWER_RUNTIME_TARGET_PATH,
  REVIEWER_CLOSEOUT_ENVELOPE_FIELDS,
  REVIEWER_COMPATIBILITY_GUARDS,
  REVIEWER_DISPLAY_NAME,
  REVIEWER_GOVERNANCE_GATE_CONTRACT,
  REVIEWER_HOST_ADAPTER_BOUNDARY,
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
  REVIEWER_REQUIRED_ROLLOUT_PROOFS,
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
import {
  REVIEWER_SHARED_CORE_METADATA,
  REVIEWER_SHARED_CORE_PROFILE_PACK,
  REVIEWER_SHARED_CORE_VERSION,
} from './reviewer-shared-core';
import {
  buildReviewerRolloutGate,
  type ReviewerRolloutGate,
} from './reviewer-rollout-gate';

export { REVIEWER_SHARED_CORE_VERSION } from './reviewer-shared-core';
export { REVIEWER_ROLLOUT_GATE_VERSION } from './reviewer-rollout-gate';

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

export interface ReviewerHostGovernanceBinding {
  implementationReadinessStatusRequired: boolean;
  implementationReadinessGateName: string;
  gatesLoopRequired: boolean;
  rerunGatesRequired: boolean;
  packetExecutionClosureRequired: boolean;
  packetExecutionClosureStatuses: readonly string[];
  closeoutEnvelopeFields: readonly string[];
}

export interface ReviewerHostRegistration {
  preferredRoute: ReviewerRoute;
  fallbackRoute: ReviewerRoute;
  closeout: ReviewerHostCloseoutBinding;
  governance: ReviewerHostGovernanceBinding;
}

export interface ReviewerRegistration {
  identity: typeof REVIEWER_PRODUCT_IDENTITY;
  profile: ReviewerProfileId;
  sharedCore: {
    version: typeof REVIEWER_SHARED_CORE_VERSION;
    rootPath: string;
    basePromptPath: string;
    profilePackPath: string;
    hostAdapterProjectionOnly: boolean;
  };
  hostAdapterBoundary: typeof REVIEWER_HOST_ADAPTER_BOUNDARY;
  hosts: Record<ReviewerHostId, ReviewerHostRegistration>;
}

export interface ReviewerHostRouteSummary {
  carrierSourcePath: string;
  runtimeTargetPath: string;
  preferredRoute: ReviewerRoute;
  fallbackRoute: ReviewerRoute;
  fallbackReason: string;
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
  sharedCore: {
    version: typeof REVIEWER_SHARED_CORE_VERSION;
    rootPath: string;
    basePromptPath: string;
    profilePackPath: string;
  };
  closeoutRunner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  routeReasonSummary: string;
  fallbackStatus: 'fallback_ready';
  isomorphismMaturity: 'projection_wired';
  complexitySource: string;
  remainingBlocker: string;
  supportedProfiles: readonly ReviewerProfileId[];
  requiredRolloutProofs: readonly string[];
  compatibilityGuards: typeof REVIEWER_COMPATIBILITY_GUARDS;
  rolloutGate: ReviewerRolloutGate;
  hosts: Record<ReviewerHostId, ReviewerHostRouteSummary>;
  activeAuditConsumer: ReviewerAuditStageConsumer | null;
}

export interface ReviewerContractProjection {
  version: typeof REVIEWER_CONTRACT_PROJECTION_VERSION;
  reviewerIdentity: typeof REVIEWER_PRODUCT_IDENTITY;
  reviewerDisplayName: typeof REVIEWER_DISPLAY_NAME;
  facilitatorIdentity: typeof FACILITATOR_PRODUCT_IDENTITY;
  registryVersion: typeof REVIEWER_REGISTRY_VERSION;
  sharedCore: {
    version: typeof REVIEWER_SHARED_CORE_VERSION;
    rootPath: string;
    basePromptPath: string;
    profilePackPath: string;
  };
  schemaVersions: {
    input: typeof REVIEW_INPUT_V1_VERSION;
    output: typeof REVIEW_OUTPUT_V1_VERSION;
    handoff: typeof REVIEW_HANDOFF_V1_VERSION;
    closeout: typeof REVIEW_HOST_CLOSEOUT_V1_VERSION;
  };
  closeoutRunner: typeof REVIEW_HOST_CLOSEOUT_RUNNER;
  governance: ReviewerHostGovernanceBinding;
  hostAdapterBoundary: typeof REVIEWER_HOST_ADAPTER_BOUNDARY;
  compatibilityGuards: typeof REVIEWER_COMPATIBILITY_GUARDS;
  requiredRolloutProofs: readonly string[];
  rolloutGate: ReviewerRolloutGate;
  supportedProfiles: readonly ReviewerProfileId[];
  supportedAuditEntryStages: readonly RunAuditorHostStage[];
  activeAuditConsumer: ReviewerAuditStageConsumer | null;
}

function createRegistration(
  profile: ReviewerProfileId,
  stage: ReviewCloseoutStage
): ReviewerRegistration {
  const governance: ReviewerHostGovernanceBinding = {
    implementationReadinessStatusRequired:
      REVIEWER_GOVERNANCE_GATE_CONTRACT.implementationReadinessStatusRequired,
    implementationReadinessGateName:
      REVIEWER_GOVERNANCE_GATE_CONTRACT.implementationReadinessGateName,
    gatesLoopRequired: REVIEWER_GOVERNANCE_GATE_CONTRACT.gatesLoopRequired,
    rerunGatesRequired: REVIEWER_GOVERNANCE_GATE_CONTRACT.rerunGatesRequired,
    packetExecutionClosureRequired:
      REVIEWER_GOVERNANCE_GATE_CONTRACT.packetExecutionClosureRequired,
    packetExecutionClosureStatuses:
      REVIEWER_GOVERNANCE_GATE_CONTRACT.packetExecutionClosureStatuses,
    closeoutEnvelopeFields: REVIEWER_CLOSEOUT_ENVELOPE_FIELDS,
  };

  return {
    identity: REVIEWER_PRODUCT_IDENTITY,
    profile,
    sharedCore: {
      version: REVIEWER_SHARED_CORE_VERSION,
      rootPath: REVIEWER_SHARED_CORE_METADATA.rootPath,
      basePromptPath: REVIEWER_SHARED_CORE_METADATA.basePromptPath,
      profilePackPath: REVIEWER_SHARED_CORE_METADATA.profilePackPath,
      hostAdapterProjectionOnly: REVIEWER_SHARED_CORE_METADATA.hostAdapterProjectionOnly,
    },
    hostAdapterBoundary: REVIEWER_HOST_ADAPTER_BOUNDARY,
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
        governance,
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
        governance,
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

const REVIEWER_SHARED_CORE_PROFILE_IDS = REVIEWER_SHARED_CORE_PROFILE_PACK.map(
  (entry) => entry.profile
);

if (JSON.stringify(REVIEWER_SHARED_CORE_PROFILE_IDS) !== JSON.stringify([...REVIEWER_PROFILES])) {
  throw new Error(
    `Reviewer shared core registry mismatch: expected ${JSON.stringify(REVIEWER_PROFILES)}, got ${JSON.stringify(REVIEWER_SHARED_CORE_PROFILE_IDS)}`
  );
}

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
    carrierSourcePath: CURSOR_REVIEWER_CANONICAL_SOURCE_PATH,
    runtimeTargetPath: CURSOR_REVIEWER_RUNTIME_TARGET_PATH,
    preferredRoute: REVIEWER_REGISTRY.story_audit.hosts.cursor.preferredRoute,
    fallbackRoute: REVIEWER_REGISTRY.story_audit.hosts.cursor.fallbackRoute,
    fallbackReason:
      'Use mcp_task/generalPurpose when cursor-task/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
  },
  claude: {
    carrierSourcePath: CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH,
    runtimeTargetPath: CLAUDE_REVIEWER_RUNTIME_TARGET_PATH,
    preferredRoute: REVIEWER_REGISTRY.story_audit.hosts.claude.preferredRoute,
    fallbackRoute: REVIEWER_REGISTRY.story_audit.hosts.claude.fallbackRoute,
    fallbackReason:
      'Use Agent/general-purpose only when Agent/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
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
    sharedCore: {
      version: REVIEWER_SHARED_CORE_VERSION,
      rootPath: REVIEWER_SHARED_CORE_METADATA.rootPath,
      basePromptPath: REVIEWER_SHARED_CORE_METADATA.basePromptPath,
      profilePackPath: REVIEWER_SHARED_CORE_METADATA.profilePackPath,
    },
    closeoutRunner: REVIEW_HOST_CLOSEOUT_RUNNER,
    routeReasonSummary:
      'Registry-backed reviewer routing keeps shared-core semantics while preserving host-specific transport and carrier shape.',
    fallbackStatus: 'fallback_ready',
    isomorphismMaturity: 'projection_wired',
    complexitySource:
      'Dual-host carrier parity is in place, but legacy skill narrative cleanup and proof expansion still remain before rollout.',
    remainingBlocker:
      'Complete parity proof, rollback proof, Codex no-op proof, and rollout gate before declaring full isomorphism.',
    supportedProfiles: REVIEWER_PROFILES,
    requiredRolloutProofs: REVIEWER_REQUIRED_ROLLOUT_PROOFS,
    compatibilityGuards: REVIEWER_COMPATIBILITY_GUARDS,
    rolloutGate: buildReviewerRolloutGate(),
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
    sharedCore: {
      version: REVIEWER_SHARED_CORE_VERSION,
      rootPath: REVIEWER_SHARED_CORE_METADATA.rootPath,
      basePromptPath: REVIEWER_SHARED_CORE_METADATA.basePromptPath,
      profilePackPath: REVIEWER_SHARED_CORE_METADATA.profilePackPath,
    },
    schemaVersions: {
      input: REVIEW_INPUT_V1_VERSION,
      output: REVIEW_OUTPUT_V1_VERSION,
      handoff: REVIEW_HANDOFF_V1_VERSION,
      closeout: REVIEW_HOST_CLOSEOUT_V1_VERSION,
    },
    closeoutRunner: REVIEW_HOST_CLOSEOUT_RUNNER,
    governance: REVIEWER_REGISTRY.implement_audit.hosts.cursor.governance,
    hostAdapterBoundary: REVIEWER_HOST_ADAPTER_BOUNDARY,
    compatibilityGuards: REVIEWER_COMPATIBILITY_GUARDS,
    requiredRolloutProofs: REVIEWER_REQUIRED_ROLLOUT_PROOFS,
    rolloutGate: buildReviewerRolloutGate(),
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
