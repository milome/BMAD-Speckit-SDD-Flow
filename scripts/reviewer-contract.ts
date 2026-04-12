/**
 * Cross-host reviewer / facilitator contract freeze.
 *
 * Batch 1 only freezes product identity, profile vocabulary, facilitator target
 * state, anti-regression hard constraints, and parity evidence requirements.
 * Runtime registry / schema / routing execution lands in later batches.
 */

export const REVIEWER_CONTRACT_FREEZE_VERSION = 'reviewer_contract_freeze_v1' as const;

export const REVIEWER_PRODUCT_IDENTITY = 'bmad_code_reviewer' as const;
export const REVIEWER_DISPLAY_NAME = 'code-reviewer' as const;
export const CURSOR_REVIEWER_PREFERRED_EXECUTOR = 'code-reviewer' as const;
export const CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH = '.claude/agents/code-reviewer.md' as const;

export const REVIEWER_PROFILES = [
  'story_audit',
  'spec_audit',
  'plan_audit',
  'tasks_audit',
  'implement_audit',
  'bugfix_doc_audit',
  'tasks_doc_audit',
] as const;

export type ReviewerProfileId = (typeof REVIEWER_PROFILES)[number];

export const SPECIALIZED_REVIEWER_PROFILES = [
  'implement_audit',
  'bugfix_doc_audit',
  'tasks_doc_audit',
] as const satisfies readonly ReviewerProfileId[];

export type SpecializedReviewerProfileId = (typeof SPECIALIZED_REVIEWER_PROFILES)[number];

export const REVIEWER_PROFILE_DEFINITION_SOURCES = {
  'bmad-story-audit': 'story_audit',
  'auditor-spec': 'spec_audit',
  'auditor-plan': 'plan_audit',
  'auditor-tasks': 'tasks_audit',
  'auditor-implement': 'implement_audit',
  'auditor-bugfix': 'bugfix_doc_audit',
  'auditor-tasks-doc': 'tasks_doc_audit',
} as const satisfies Record<string, ReviewerProfileId>;

export type ReviewerDefinitionSourceId = keyof typeof REVIEWER_PROFILE_DEFINITION_SOURCES;

export const STORY_AUDIT_CANONICAL_PROFILE = 'story_audit' as const;

export const FACILITATOR_PRODUCT_IDENTITY = 'party_mode_facilitator' as const;
export const FACILITATOR_DISPLAY_NAME = 'party-mode-facilitator' as const;
export const CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH =
  '.cursor/agents/party-mode-facilitator.md' as const;
export const CLAUDE_FACILITATOR_TARGET_PATH =
  '.claude/agents/party-mode-facilitator.md' as const;
export const CLAUDE_FACILITATOR_TARGET_SUBTYPE = 'party-mode-facilitator' as const;

export const IMPLEMENT_AUDIT_REQUIRED_DIMENSIONS = [
  'functional_correctness',
  'code_quality',
  'test_coverage',
  'security',
] as const;

export type ImplementAuditDimension = (typeof IMPLEMENT_AUDIT_REQUIRED_DIMENSIONS)[number];

export const REVIEWER_HARD_CONSTRAINTS = {
  implementAuditRequiredDimensions: IMPLEMENT_AUDIT_REQUIRED_DIMENSIONS,
  perUserStoryTddRedGreenRequired: true,
  strictConvergenceRequired: true,
  requiredFixesRequired: true,
  requiredFixesDetailRequired: true,
  closeoutRunner: 'runAuditorHost',
} as const;

export const REVIEWER_STRICT_ALIGNMENT_EVIDENCE = [
  'cursor_preferred_vs_fallback',
  'claude_preferred_vs_fallback',
  'cross_host_output_parity',
  'closeout_contract_parity',
  'parsable_scoring_block_parity',
  'result_code_and_required_fixes_parity',
] as const;

export type ReviewerStrictAlignmentEvidenceId =
  (typeof REVIEWER_STRICT_ALIGNMENT_EVIDENCE)[number];

export interface ReviewerContractFreeze {
  readonly version: typeof REVIEWER_CONTRACT_FREEZE_VERSION;
  readonly reviewer: {
    readonly identity: typeof REVIEWER_PRODUCT_IDENTITY;
    readonly displayName: typeof REVIEWER_DISPLAY_NAME;
    readonly cursor: {
      readonly preferredExecutor: typeof CURSOR_REVIEWER_PREFERRED_EXECUTOR;
    };
    readonly claude: {
      readonly definitionSourcePath: typeof CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH;
    };
    readonly profiles: readonly ReviewerProfileId[];
    readonly specializedProfiles: readonly SpecializedReviewerProfileId[];
    readonly definitionSources: Record<ReviewerDefinitionSourceId, ReviewerProfileId>;
    readonly storyAuditCanonicalProfile: typeof STORY_AUDIT_CANONICAL_PROFILE;
  };
  readonly facilitator: {
    readonly identity: typeof FACILITATOR_PRODUCT_IDENTITY;
    readonly displayName: typeof FACILITATOR_DISPLAY_NAME;
    readonly cursorDefinitionSourcePath: typeof CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH;
    readonly claudeTarget: {
      readonly agentPath: typeof CLAUDE_FACILITATOR_TARGET_PATH;
      readonly subagentType: typeof CLAUDE_FACILITATOR_TARGET_SUBTYPE;
    };
  };
  readonly hardConstraints: typeof REVIEWER_HARD_CONSTRAINTS;
  readonly strictAlignmentEvidence: readonly ReviewerStrictAlignmentEvidenceId[];
}

export const REVIEWER_CONTRACT_FREEZE: ReviewerContractFreeze = {
  version: REVIEWER_CONTRACT_FREEZE_VERSION,
  reviewer: {
    identity: REVIEWER_PRODUCT_IDENTITY,
    displayName: REVIEWER_DISPLAY_NAME,
    cursor: {
      preferredExecutor: CURSOR_REVIEWER_PREFERRED_EXECUTOR,
    },
    claude: {
      definitionSourcePath: CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH,
    },
    profiles: REVIEWER_PROFILES,
    specializedProfiles: SPECIALIZED_REVIEWER_PROFILES,
    definitionSources: REVIEWER_PROFILE_DEFINITION_SOURCES,
    storyAuditCanonicalProfile: STORY_AUDIT_CANONICAL_PROFILE,
  },
  facilitator: {
    identity: FACILITATOR_PRODUCT_IDENTITY,
    displayName: FACILITATOR_DISPLAY_NAME,
    cursorDefinitionSourcePath: CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
    claudeTarget: {
      agentPath: CLAUDE_FACILITATOR_TARGET_PATH,
      subagentType: CLAUDE_FACILITATOR_TARGET_SUBTYPE,
    },
  },
  hardConstraints: REVIEWER_HARD_CONSTRAINTS,
  strictAlignmentEvidence: REVIEWER_STRICT_ALIGNMENT_EVIDENCE,
};

export function isReviewerProfileId(value: string): value is ReviewerProfileId {
  return REVIEWER_PROFILES.includes(value as ReviewerProfileId);
}

export function getReviewerProfileFromDefinitionSource(
  sourceId: ReviewerDefinitionSourceId
): ReviewerProfileId {
  return REVIEWER_PROFILE_DEFINITION_SOURCES[sourceId];
}
