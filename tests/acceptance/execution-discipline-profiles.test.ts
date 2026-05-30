import { describe, expect, it } from 'vitest';
import {
  EXECUTION_DISCIPLINE_PROFILES,
  resolveExecutionDisciplineProfile,
} from '../../scripts/execution-discipline-profiles';
import { createHash } from 'node:crypto';

const FLOWS = ['story', 'bugfix', 'standalone_tasks'] as const;
const FORBIDDEN_AUTHORITY_FIELDS = [
  'traceRows',
  'covers',
  'requiredCommands',
  'taskList',
  'section7Tasks',
  'legacyPromptBody',
  'sourcePathAuthority',
];

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

function canonicalProfileHash(profile: Record<string, unknown>): string {
  const clone = { ...profile };
  delete clone.profileHash;
  return `sha256:${createHash('sha256').update(stableStringify(clone), 'utf8').digest('hex')}`;
}

describe('execution discipline profiles', () => {
  it('provides immutable metadata-only profiles for every implementation flow', () => {
    for (const flow of FLOWS) {
      const profile = resolveExecutionDisciplineProfile(flow);
      expect(profile.flow).toBe(flow);
      expect(profile.authority).toBe('discipline_profile_only');
      expect(profile.profileHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(profile.requiredEvidence).toEqual(
        expect.arrayContaining([
          'task_report',
          'validation_commands',
          'audit_report',
          'score_receipt',
        ])
      );
      expect(profile.auditScoringConvergencePolicy).toMatchObject({
        auditPassRequired: true,
        scoreReceiptRequired: true,
        dimensionContractMatchRequired: true,
        thresholdPassRequired: true,
        vetoForbidden: true,
        iterationCountRequired: true,
        freshHashesRequired: true,
      });
    }
    expect(Object.keys(EXECUTION_DISCIPLINE_PROFILES).sort()).toEqual([...FLOWS].sort());
  });

  it('keeps source authority fields out of every profile', () => {
    for (const profile of Object.values(EXECUTION_DISCIPLINE_PROFILES)) {
      const profileAuthoritySurface = Object.keys(profile).filter(
        (key) => key !== 'forbiddenOverrides'
      );
      for (const forbidden of FORBIDDEN_AUTHORITY_FIELDS) {
        expect(profileAuthoritySurface).not.toContain(forbidden);
      }
      expect(profile.forbiddenOverrides).toEqual(
        expect.arrayContaining([
          'traceRows',
          'covers',
          'requiredCommands',
          'taskList',
          'section7Tasks',
          'legacyPromptBody',
          'sourcePathAuthority',
        ])
      );
    }
  });

  it('uses the same canonical stable hash contract consumed by req-trace', () => {
    for (const profile of Object.values(EXECUTION_DISCIPLINE_PROFILES)) {
      expect(profile.profileHash).toBe(
        canonicalProfileHash(profile as unknown as Record<string, unknown>)
      );
    }
  });

  it('preserves distinct source-specific profile quality rules', () => {
    const story = resolveExecutionDisciplineProfile('story');
    const bugfix = resolveExecutionDisciplineProfile('bugfix');
    const tasks = resolveExecutionDisciplineProfile('standalone_tasks');

    expect(story.dimensionContractSelector).toBe('story');
    expect(bugfix.dimensionContractSelector).toBe('bugfix');
    expect(tasks.dimensionContractSelector).toBe('tasks');
    expect(story.failureExclusionPolicy.userApprovalRequiredForExcludedTests).toBe(true);
    expect(bugfix.failureExclusionPolicy.userApprovalRequiredForExcludedTests).toBe(false);
    expect(bugfix.testExecutionPolicy.pytestCleanupEvidenceRequired).toBe(true);
    expect(tasks.testExecutionPolicy.pytestCleanupEvidenceRequired).toBe(false);

    for (const profile of [story, bugfix, tasks]) {
      expect(profile.lintPolicy).toMatchObject({ required: true, blockOnWarnings: true });
      expect(profile.docCommentPolicy.publicApiRequired).toBe(true);
      expect(profile.subagentContinuityPolicy.returnAllowedOnlyOn).toEqual(
        expect.arrayContaining([
          'scope_complete',
          'real_blocker',
          'audit_boundary',
          'resume_checkpoint',
        ])
      );
      expect(profile.auditReportContract).toMatchObject({
        parseableScoreBlockRequired: true,
        allowedGrades: ['A', 'B', 'C', 'D'],
        forbidScoreRanges: true,
      });
      expect(profile.hostCloseoutPolicy.prosePassIsCompletion).toBe(false);
    }
  });
});
