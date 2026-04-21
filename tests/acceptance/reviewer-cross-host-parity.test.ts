import { describe, expect, it } from 'vitest';
import { REVIEWER_PROFILES } from '../../scripts/reviewer-contract';
import { getReviewerRegistration } from '../../scripts/reviewer-registry';

describe('reviewer cross-host parity', () => {
  it('keeps cursor and claude registrations on the same shared core and closeout contract', () => {
    for (const profile of REVIEWER_PROFILES) {
      const registration = getReviewerRegistration(profile);
      expect(registration.hosts.cursor.closeout.contractVersion).toBe(
        registration.hosts.claude.closeout.contractVersion
      );
      expect(registration.hosts.cursor.closeout.runner).toBe(
        registration.hosts.claude.closeout.runner
      );
      expect(registration.hosts.cursor.closeout.stage).toBe(
        registration.hosts.claude.closeout.stage
      );
      expect(registration.hosts.cursor.governance).toStrictEqual(
        registration.hosts.claude.governance
      );
      expect(registration.sharedCore.rootPath).toBe('_bmad/core/agents/code-reviewer');
    }
  });

  it('keeps preferred/fallback route semantics parallel across hosts', () => {
    const implement = getReviewerRegistration('implement_audit');
    expect(implement.hosts.cursor.preferredRoute.subtypeOrExecutor).toBe('code-reviewer');
    expect(implement.hosts.claude.preferredRoute.subtypeOrExecutor).toBe('code-reviewer');
    expect(implement.hosts.cursor.fallbackRoute.subtypeOrExecutor).toBe('generalPurpose');
    expect(implement.hosts.claude.fallbackRoute.subtypeOrExecutor).toBe('general-purpose');
  });
});
