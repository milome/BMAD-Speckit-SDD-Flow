import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLAUDE_FACILITATOR_TARGET_PATH,
  CLAUDE_FACILITATOR_TARGET_SUBTYPE,
  CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH,
  CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH,
  CURSOR_REVIEWER_PREFERRED_EXECUTOR,
  FACILITATOR_DISPLAY_NAME,
  FACILITATOR_PRODUCT_IDENTITY,
  REVIEWER_CONTRACT_FREEZE,
  REVIEWER_DISPLAY_NAME,
  REVIEWER_HARD_CONSTRAINTS,
  REVIEWER_PRODUCT_IDENTITY,
  REVIEWER_PROFILES,
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
    expect(CLAUDE_REVIEWER_DEFINITION_SOURCE_PATH).toBe('.claude/agents/code-reviewer.md');
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
    expect(getReviewerProfileFromDefinitionSource('auditor-bugfix')).toBe('bugfix_doc_audit');
    expect(getReviewerProfileFromDefinitionSource('auditor-tasks-doc')).toBe(
      'tasks_doc_audit'
    );
    expect(isReviewerProfileId('plan_audit')).toBe(true);
    expect(isReviewerProfileId('invalid_profile')).toBe(false);
  });

  it('freezes facilitator as a formal specialized subtype target instead of a wrapper recommendation', () => {
    expect(FACILITATOR_PRODUCT_IDENTITY).toBe('party_mode_facilitator');
    expect(FACILITATOR_DISPLAY_NAME).toBe('party-mode-facilitator');
    expect(CLAUDE_FACILITATOR_TARGET_PATH).toBe('.claude/agents/party-mode-facilitator.md');
    expect(CLAUDE_FACILITATOR_TARGET_SUBTYPE).toBe('party-mode-facilitator');
    expect(CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH).toBe(
      '.cursor/agents/party-mode-facilitator.md'
    );
    expect(
      existsSync(path.join(process.cwd(), CURSOR_FACILITATOR_DEFINITION_SOURCE_PATH))
    ).toBe(true);
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
    expect(REVIEWER_STRICT_ALIGNMENT_EVIDENCE).toStrictEqual([
      'cursor_preferred_vs_fallback',
      'claude_preferred_vs_fallback',
      'cross_host_output_parity',
      'closeout_contract_parity',
      'parsable_scoring_block_parity',
      'result_code_and_required_fixes_parity',
    ]);
  });
});
