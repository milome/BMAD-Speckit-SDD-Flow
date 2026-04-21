import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLAUDE_FACILITATOR_AGENT_MENTION,
  CLAUDE_FACILITATOR_TARGET_PATH,
  CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH,
  CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH,
  CLAUDE_REVIEWER_RUNTIME_TARGET_PATH,
  CURSOR_REVIEWER_CANONICAL_SOURCE_PATH,
  CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
  CURSOR_REVIEWER_PREFERRED_EXECUTOR,
  CURSOR_REVIEWER_RUNTIME_TARGET_PATH,
  FACILITATOR_DISPLAY_NAME,
  FACILITATOR_PRODUCT_IDENTITY,
  REVIEWER_CLOSEOUT_ENVELOPE_FIELDS,
  REVIEWER_COMPATIBILITY_GUARDS,
  REVIEWER_CONTRACT_FREEZE,
  REVIEWER_DISPLAY_NAME,
  REVIEWER_GOVERNANCE_GATE_CONTRACT,
  REVIEWER_HARD_CONSTRAINTS,
  REVIEWER_HOST_ADAPTER_BOUNDARY,
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
  REVIEWER_REQUIRED_ROLLOUT_PROOFS,
  REVIEWER_SHARED_CORE_BASE_PROMPT_PATH,
  REVIEWER_SHARED_CORE_METADATA_PATH,
  REVIEWER_SHARED_CORE_PROFILE_PACK_PATH,
  REVIEWER_SHARED_CORE_ROOT,
  REVIEWER_STRICT_ALIGNMENT_EVIDENCE,
  SPECIALIZED_REVIEWER_PROFILES,
  STORY_AUDIT_CANONICAL_PROFILE,
  getReviewerProfileFromDefinitionSource,
  isReviewerProfileId,
} from '../../scripts/reviewer-contract';

describe('reviewer contract freeze', () => {
  it('freezes reviewer identity without conflating product identity and host-visible executor names', () => {
    expect(REVIEWER_CONTRACT_FREEZE.version).toBe('reviewer_contract_freeze_v1');
    expect(REVIEWER_PRODUCT_IDENTITY).toBe('bmad_code_reviewer');
    expect(REVIEWER_DISPLAY_NAME).toBe('code-reviewer');
    expect(CURSOR_REVIEWER_PREFERRED_EXECUTOR).toBe(REVIEWER_DISPLAY_NAME);
    expect(CURSOR_REVIEWER_CANONICAL_SOURCE_PATH).toBe('_bmad/cursor/agents/code-reviewer.md');
    expect(CURSOR_REVIEWER_RUNTIME_TARGET_PATH).toBe('.cursor/agents/code-reviewer.md');
    expect(CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH).toBe('_bmad/claude/agents/code-reviewer.md');
    expect(CLAUDE_REVIEWER_RUNTIME_TARGET_PATH).toBe('.claude/agents/code-reviewer.md');
    expect(CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH).toBe('.claude/agents/code-reviewer.md');
    expect(existsSync(path.join(process.cwd(), CURSOR_REVIEWER_CANONICAL_SOURCE_PATH))).toBe(true);
    expect(existsSync(path.join(process.cwd(), CURSOR_REVIEWER_RUNTIME_TARGET_PATH))).toBe(true);
    expect(existsSync(path.join(process.cwd(), CLAUDE_REVIEWER_CANONICAL_SOURCE_PATH))).toBe(true);
    expect(existsSync(path.join(process.cwd(), CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH))).toBe(true);
  });

  it('freezes the first-wave reviewer profile vocabulary and canonical source mapping', () => {
    expect(REVIEWER_PROFILES).toStrictEqual([
      'story_audit',
      'spec_audit',
      'plan_audit',
      'tasks_audit',
      'implement_audit',
      'bugfix_doc_audit',
      'tasks_doc_audit',
    ]);
    expect(SPECIALIZED_REVIEWER_PROFILES).toStrictEqual([
      'implement_audit',
      'bugfix_doc_audit',
      'tasks_doc_audit',
    ]);
    expect(STORY_AUDIT_CANONICAL_PROFILE).toBe('story_audit');
    expect(getReviewerProfileFromDefinitionSource('bmad-story-audit')).toBe('story_audit');
    expect(getReviewerProfileFromDefinitionSource('auditor-implement')).toBe('implement_audit');
    expect(getReviewerProfileFromDefinitionSource('auditor-gaps')).toBe('tasks_audit');
    expect(getReviewerProfileFromDefinitionSource('auditor-bugfix')).toBe('bugfix_doc_audit');
    expect(getReviewerProfileFromDefinitionSource('auditor-tasks-doc')).toBe(
      'tasks_doc_audit'
    );
    expect(isReviewerProfileId('plan_audit')).toBe(true);
    expect(isReviewerProfileId('invalid_profile')).toBe(false);
  });

  it('freezes shared reviewer core paths in a host-neutral location', () => {
    expect(REVIEWER_SHARED_CORE_ROOT).toBe('_bmad/core/agents/code-reviewer');
    expect(REVIEWER_SHARED_CORE_METADATA_PATH).toBe(
      '_bmad/core/agents/code-reviewer/metadata.json'
    );
    expect(REVIEWER_SHARED_CORE_BASE_PROMPT_PATH).toBe(
      '_bmad/core/agents/code-reviewer/base-prompt.md'
    );
    expect(REVIEWER_SHARED_CORE_PROFILE_PACK_PATH).toBe(
      '_bmad/core/agents/code-reviewer/profiles.json'
    );
    expect(REVIEWER_CONTRACT_FREEZE.reviewer.sharedCore).toStrictEqual({
      rootPath: REVIEWER_SHARED_CORE_ROOT,
      metadataPath: REVIEWER_SHARED_CORE_METADATA_PATH,
      basePromptPath: REVIEWER_SHARED_CORE_BASE_PROMPT_PATH,
      profilePackPath: REVIEWER_SHARED_CORE_PROFILE_PACK_PATH,
    });
    expect(existsSync(path.join(process.cwd(), REVIEWER_SHARED_CORE_METADATA_PATH))).toBe(true);
    expect(existsSync(path.join(process.cwd(), REVIEWER_SHARED_CORE_BASE_PROMPT_PATH))).toBe(true);
    expect(existsSync(path.join(process.cwd(), REVIEWER_SHARED_CORE_PROFILE_PACK_PATH))).toBe(
      true
    );
  });

  it('freezes facilitator as a single Claude agent mention target instead of a subtype contract', () => {
    expect(FACILITATOR_PRODUCT_IDENTITY).toBe('party_mode_facilitator');
    expect(FACILITATOR_DISPLAY_NAME).toBe('party-mode-facilitator');
    expect(CLAUDE_FACILITATOR_TARGET_PATH).toBe('.claude/agents/party-mode-facilitator.md');
    expect(CLAUDE_FACILITATOR_AGENT_MENTION).toBe('@"party-mode-facilitator (agent)"');
    expect(CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH).toBe(
      '.cursor/agents/party-mode-facilitator.md'
    );
    expect(
      existsSync(path.join(process.cwd(), CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH))
    ).toBe(true);
    expect(existsSync(path.join(process.cwd(), CLAUDE_FACILITATOR_TARGET_PATH))).toBe(true);
  });

  it('freezes non-weakenable review constraints and parity evidence requirements', () => {
    expect(REVIEWER_HARD_CONSTRAINTS.implementAuditRequiredDimensions).toStrictEqual([
      'functional_correctness',
      'code_quality',
      'test_coverage',
      'security',
    ]);
    expect(REVIEWER_HARD_CONSTRAINTS.perUserStoryTddRedGreenRequired).toBe(true);
    expect(REVIEWER_HARD_CONSTRAINTS.strictConvergenceRequired).toBe(true);
    expect(REVIEWER_HARD_CONSTRAINTS.requiredFixesRequired).toBe(true);
    expect(REVIEWER_HARD_CONSTRAINTS.requiredFixesDetailRequired).toBe(true);
    expect(REVIEWER_HARD_CONSTRAINTS.closeoutRunner).toBe('runAuditorHost');
    expect(REVIEWER_GOVERNANCE_GATE_CONTRACT).toStrictEqual({
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
    });
    expect(REVIEWER_CLOSEOUT_ENVELOPE_FIELDS).toStrictEqual([
      'resultCode',
      'requiredFixes',
      'requiredFixesDetail',
      'rerunDecision',
      'scoringFailureMode',
      'packetExecutionClosureStatus',
    ]);
    expect(REVIEWER_HOST_ADAPTER_BOUNDARY).toStrictEqual({
      projectionOnly: true,
      hostLocalStageSemanticsForbidden: true,
      hostLocalRoutePrecedenceForbidden: true,
      hostLocalFallbackBusinessRulesForbidden: true,
    });
    expect(REVIEWER_COMPATIBILITY_GUARDS).toStrictEqual({
      codexNoopRequired: true,
      codexBehaviorChangeAllowed: false,
    });
    expect(REVIEWER_REQUIRED_ROLLOUT_PROOFS).toStrictEqual([
      'parity_proof',
      'consumer_install_proof',
      'rollback_proof',
      'codex_noop_proof',
    ]);
    expect(REVIEWER_STRICT_ALIGNMENT_EVIDENCE).toStrictEqual([
      'cursor_preferred_vs_fallback',
      'claude_preferred_vs_fallback',
      'cross_host_output_parity',
      'closeout_contract_parity',
      'governance_closure_parity',
      'parsable_scoring_block_parity',
      'result_code_and_required_fixes_parity',
      'codex_noop_proof',
      'rollback_proof',
    ]);
  });
});
