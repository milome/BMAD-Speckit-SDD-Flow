import { describe, expect, it } from 'vitest';
import { REVIEWER_PROFILES } from '../../scripts/reviewer-contract';
import {
  REVIEWER_SHARED_CORE_PROFILE_PACK,
  REVIEWER_SHARED_CORE_METADATA,
} from '../../scripts/reviewer-shared-core';
import { REVIEWER_AUDIT_STAGE_CONSUMERS, listReviewerRegistrations } from '../../scripts/reviewer-registry';

describe('reviewer shared profile contract', () => {
  it('keeps shared reviewer profile pack aligned with frozen reviewer profiles', () => {
    expect(REVIEWER_SHARED_CORE_METADATA.identity).toBe('bmad_code_reviewer');
    expect(REVIEWER_SHARED_CORE_PROFILE_PACK.map((entry) => entry.profile)).toStrictEqual(
      REVIEWER_PROFILES
    );
  });

  it('maps every shared profile into registry registrations and audit-stage consumers without drift', () => {
    const registrations = new Set(listReviewerRegistrations().map((entry) => entry.profile));
    const consumerProfiles = new Set(
      Object.values(REVIEWER_AUDIT_STAGE_CONSUMERS).map((entry) => entry.profile)
    );

    for (const profile of REVIEWER_PROFILES) {
      expect(registrations.has(profile)).toBe(true);
      expect(consumerProfiles.has(profile)).toBe(true);
    }
  });
});
