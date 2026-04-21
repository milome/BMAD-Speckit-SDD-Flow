export type ReviewerHostId = 'cursor' | 'claude';
export type ReviewerProfileId =
  | 'story_audit'
  | 'spec_audit'
  | 'plan_audit'
  | 'tasks_audit'
  | 'implement_audit'
  | 'bugfix_doc_audit'
  | 'tasks_doc_audit';

export type ReviewerAuditEntryStage =
  | 'story'
  | 'spec'
  | 'plan'
  | 'gaps'
  | 'tasks'
  | 'implement'
  | 'bugfix'
  | 'document'
  | 'standalone_tasks';

export interface ReviewerRoute {
  tool: 'cursor-task' | 'mcp_task' | 'Agent';
  subtypeOrExecutor: string;
}

export interface ReviewerHostRouteSummary {
  carrierSourcePath: string;
  runtimeTargetPath: string;
  preferredRoute: ReviewerRoute;
  fallbackRoute: ReviewerRoute;
  fallbackReason: string;
}

export interface ReviewerAuditStageConsumer {
  entryStage: ReviewerAuditEntryStage;
  profile: ReviewerProfileId;
  closeoutStage:
    | 'story'
    | 'spec'
    | 'plan'
    | 'gaps'
    | 'tasks'
    | 'implement'
    | 'bugfix'
    | 'standalone_tasks';
  auditorScript: string;
  scoreStage: 'story' | 'spec' | 'plan' | 'gaps' | 'tasks' | 'implement';
  triggerStage?: string;
}

export interface ReviewerRouteExplainability {
  requestedSkillId: 'code-reviewer';
  matchedSkillId?: string;
  reviewerIdentity: 'bmad_code_reviewer';
  reviewerDisplayName: 'code-reviewer';
  registryVersion: 'reviewer_registry_v1';
  sharedCore: {
    version: 'reviewer_shared_core_v1';
    rootPath: string;
    basePromptPath: string;
    profilePackPath: string;
  };
  closeoutRunner: 'runAuditorHost';
  routeReasonSummary: string;
  fallbackStatus: 'fallback_ready';
  isomorphismMaturity: 'projection_wired';
  complexitySource: string;
  remainingBlocker: string;
  supportedProfiles: readonly ReviewerProfileId[];
  requiredRolloutProofs: readonly string[];
  compatibilityGuards: {
    codexNoopRequired: true;
    codexBehaviorChangeAllowed: false;
  };
  rolloutGate: {
    version: 'reviewer_rollout_gate_v1';
    status: 'blocked' | 'ready';
    requiredProofs: readonly string[];
    completeProofs: readonly string[];
    blockingProofs: readonly string[];
    cleanupAllowed: boolean;
    canClaimFullIsomorphism: boolean;
    summary: string;
  };
  hosts: Record<ReviewerHostId, ReviewerHostRouteSummary>;
  activeAuditConsumer: ReviewerAuditStageConsumer | null;
}

export interface ReviewerContractProjection {
  version: 'reviewer_contract_projection_v1';
  reviewerIdentity: 'bmad_code_reviewer';
  reviewerDisplayName: 'code-reviewer';
  facilitatorIdentity: 'party_mode_facilitator';
  registryVersion: 'reviewer_registry_v1';
  sharedCore: {
    version: 'reviewer_shared_core_v1';
    rootPath: string;
    basePromptPath: string;
    profilePackPath: string;
  };
  schemaVersions: {
    input: 'review_input_v1';
    output: 'review_output_v1';
    handoff: 'review_handoff_v1';
    closeout: 'review_host_closeout_v1';
  };
  closeoutRunner: 'runAuditorHost';
  governance: {
    implementationReadinessStatusRequired: true;
    implementationReadinessGateName: 'implementation-readiness';
    gatesLoopRequired: true;
    rerunGatesRequired: true;
    packetExecutionClosureRequired: true;
    packetExecutionClosureStatuses: readonly string[];
    closeoutEnvelopeFields: readonly string[];
  };
  hostAdapterBoundary: {
    projectionOnly: true;
    hostLocalStageSemanticsForbidden: true;
    hostLocalRoutePrecedenceForbidden: true;
    hostLocalFallbackBusinessRulesForbidden: true;
  };
  compatibilityGuards: {
    codexNoopRequired: true;
    codexBehaviorChangeAllowed: false;
  };
  requiredRolloutProofs: readonly string[];
  rolloutGate: {
    version: 'reviewer_rollout_gate_v1';
    status: 'blocked' | 'ready';
    requiredProofs: readonly string[];
    completeProofs: readonly string[];
    blockingProofs: readonly string[];
    cleanupAllowed: boolean;
    canClaimFullIsomorphism: boolean;
    summary: string;
  };
  supportedProfiles: readonly ReviewerProfileId[];
  supportedAuditEntryStages: readonly ReviewerAuditEntryStage[];
  activeAuditConsumer: ReviewerAuditStageConsumer | null;
}

const SUPPORTED_PROFILES: readonly ReviewerProfileId[] = [
  'story_audit',
  'spec_audit',
  'plan_audit',
  'tasks_audit',
  'implement_audit',
  'bugfix_doc_audit',
  'tasks_doc_audit',
] as const;

const AUDIT_CONSUMERS: Record<ReviewerAuditEntryStage, ReviewerAuditStageConsumer> = {
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

const HOSTS: Record<ReviewerHostId, ReviewerHostRouteSummary> = {
  cursor: {
    carrierSourcePath: '_bmad/cursor/agents/code-reviewer.md',
    runtimeTargetPath: '.cursor/agents/code-reviewer.md',
    preferredRoute: { tool: 'cursor-task', subtypeOrExecutor: 'code-reviewer' },
    fallbackRoute: { tool: 'mcp_task', subtypeOrExecutor: 'generalPurpose' },
    fallbackReason:
      'Use mcp_task/generalPurpose when cursor-task/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
  },
  claude: {
    carrierSourcePath: '_bmad/claude/agents/code-reviewer.md',
    runtimeTargetPath: '.claude/agents/code-reviewer.md',
    preferredRoute: { tool: 'Agent', subtypeOrExecutor: 'code-reviewer' },
    fallbackRoute: { tool: 'Agent', subtypeOrExecutor: 'general-purpose' },
    fallbackReason:
      'Use Agent/general-purpose only when Agent/code-reviewer is unavailable, while preserving the shared reviewer contract and runAuditorHost closeout.',
  },
};

export function mapFlowStageToReviewerAuditEntryStage(
  flow: string | null | undefined,
  stage: string | null | undefined
): ReviewerAuditEntryStage | null {
  if (!flow || !stage) return null;
  if (flow === 'story') {
    if (stage === 'story' || stage === 'story_audit') return 'story';
    if (stage === 'spec' || stage === 'specify') return 'spec';
    if (stage === 'plan') return 'plan';
    if (stage === 'gaps') return 'gaps';
    if (stage === 'tasks') return 'tasks';
    if (stage === 'implement') return 'implement';
    return null;
  }
  if (flow === 'bugfix') {
    return stage === 'bugfix' || stage === 'implement' || stage === 'post_audit'
      ? 'bugfix'
      : null;
  }
  if (flow === 'standalone_tasks') {
    return ['document', 'standalone_tasks', 'tasks', 'implement', 'post_audit'].includes(stage)
      ? 'standalone_tasks'
      : null;
  }
  return null;
}

export function buildReviewerContractProjection(input?: {
  auditEntryStage?: ReviewerAuditEntryStage | null;
}): ReviewerContractProjection {
  return {
    version: 'reviewer_contract_projection_v1',
    reviewerIdentity: 'bmad_code_reviewer',
    reviewerDisplayName: 'code-reviewer',
    facilitatorIdentity: 'party_mode_facilitator',
    registryVersion: 'reviewer_registry_v1',
    sharedCore: {
      version: 'reviewer_shared_core_v1',
      rootPath: '_bmad/core/agents/code-reviewer',
      basePromptPath: '_bmad/core/agents/code-reviewer/base-prompt.md',
      profilePackPath: '_bmad/core/agents/code-reviewer/profiles.json',
    },
    schemaVersions: {
      input: 'review_input_v1',
      output: 'review_output_v1',
      handoff: 'review_handoff_v1',
      closeout: 'review_host_closeout_v1',
    },
    closeoutRunner: 'runAuditorHost',
    governance: {
      implementationReadinessStatusRequired: true,
      implementationReadinessGateName: 'implementation-readiness',
      gatesLoopRequired: true,
      rerunGatesRequired: true,
      packetExecutionClosureRequired: true,
      packetExecutionClosureStatuses: [
        'awaiting_rerun_gate',
        'retry_pending',
        'gate_passed',
        'escalated',
      ],
      closeoutEnvelopeFields: [
        'resultCode',
        'requiredFixes',
        'requiredFixesDetail',
        'rerunDecision',
        'scoringFailureMode',
        'packetExecutionClosureStatus',
      ],
    },
    hostAdapterBoundary: {
      projectionOnly: true,
      hostLocalStageSemanticsForbidden: true,
      hostLocalRoutePrecedenceForbidden: true,
      hostLocalFallbackBusinessRulesForbidden: true,
    },
    compatibilityGuards: {
      codexNoopRequired: true,
      codexBehaviorChangeAllowed: false,
    },
    rolloutGate: {
      version: 'reviewer_rollout_gate_v1',
      status: 'blocked',
      requiredProofs: [
        'parity_proof',
        'consumer_install_proof',
        'rollback_proof',
        'codex_noop_proof',
      ],
      completeProofs: [],
      blockingProofs: [
        'parity_proof',
        'consumer_install_proof',
        'rollback_proof',
        'codex_noop_proof',
      ],
      cleanupAllowed: false,
      canClaimFullIsomorphism: false,
      summary:
        'Blocked until proofs are complete: parity_proof, consumer_install_proof, rollback_proof, codex_noop_proof',
    },
    requiredRolloutProofs: [
      'parity_proof',
      'consumer_install_proof',
      'rollback_proof',
      'codex_noop_proof',
    ],
    supportedProfiles: SUPPORTED_PROFILES,
    supportedAuditEntryStages: Object.keys(AUDIT_CONSUMERS) as ReviewerAuditEntryStage[],
    activeAuditConsumer: input?.auditEntryStage ? AUDIT_CONSUMERS[input.auditEntryStage] : null,
  };
}

export function buildReviewerRouteExplainability(input?: {
  requestedSkillId?: 'code-reviewer';
  auditEntryStage?: ReviewerAuditEntryStage | null;
}): ReviewerRouteExplainability {
  return {
    requestedSkillId: input?.requestedSkillId ?? 'code-reviewer',
    reviewerIdentity: 'bmad_code_reviewer',
    reviewerDisplayName: 'code-reviewer',
    registryVersion: 'reviewer_registry_v1',
    sharedCore: {
      version: 'reviewer_shared_core_v1',
      rootPath: '_bmad/core/agents/code-reviewer',
      basePromptPath: '_bmad/core/agents/code-reviewer/base-prompt.md',
      profilePackPath: '_bmad/core/agents/code-reviewer/profiles.json',
    },
    closeoutRunner: 'runAuditorHost',
    routeReasonSummary:
      'Registry-backed reviewer routing keeps shared-core semantics while preserving host-specific transport and carrier shape.',
    fallbackStatus: 'fallback_ready',
    isomorphismMaturity: 'projection_wired',
    complexitySource:
      'Dual-host carrier parity is in place, but legacy skill narrative cleanup and proof expansion still remain before rollout.',
    remainingBlocker:
      'Complete parity proof, rollback proof, Codex no-op proof, and rollout gate before declaring full isomorphism.',
    supportedProfiles: SUPPORTED_PROFILES,
    requiredRolloutProofs: [
      'parity_proof',
      'consumer_install_proof',
      'rollback_proof',
      'codex_noop_proof',
    ],
    compatibilityGuards: {
      codexNoopRequired: true,
      codexBehaviorChangeAllowed: false,
    },
    rolloutGate: {
      version: 'reviewer_rollout_gate_v1',
      status: 'blocked',
      requiredProofs: [
        'parity_proof',
        'consumer_install_proof',
        'rollback_proof',
        'codex_noop_proof',
      ],
      completeProofs: [],
      blockingProofs: [
        'parity_proof',
        'consumer_install_proof',
        'rollback_proof',
        'codex_noop_proof',
      ],
      cleanupAllowed: false,
      canClaimFullIsomorphism: false,
      summary:
        'Blocked until proofs are complete: parity_proof, consumer_install_proof, rollback_proof, codex_noop_proof',
    },
    hosts: HOSTS,
    activeAuditConsumer: input?.auditEntryStage ? AUDIT_CONSUMERS[input.auditEntryStage] : null,
  };
}
