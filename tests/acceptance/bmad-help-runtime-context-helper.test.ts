import { describe, expect, it } from 'vitest';
import {
  contextMaturityCandidateFromSourceMode,
  deriveContextMaturity,
} from '../../packages/runtime-context/src/context';

describe('bmad-help runtime-context helpers', () => {
  it('maps sourceMode to contextMaturity candidates and only returns full with complete evidence', () => {
    expect(contextMaturityCandidateFromSourceMode('standalone_story')).toBe('minimal');
    expect(contextMaturityCandidateFromSourceMode('seeded_solutioning')).toBe('seeded');
    expect(contextMaturityCandidateFromSourceMode('full_bmad')).toBe('full');

    expect(
      deriveContextMaturity('full_bmad', {
        artifactComplete: true,
        fourSignalsComplete: true,
        executionSpecific: true,
        governanceHealthy: true,
        runtimeScopeComplete: true,
      })
    ).toBe('full');

    expect(
      deriveContextMaturity('full_bmad', {
        artifactComplete: true,
        fourSignalsComplete: false,
        executionSpecific: true,
        governanceHealthy: false,
        runtimeScopeComplete: true,
      })
    ).toBe('seeded');

    expect(
      deriveContextMaturity(undefined, {
        followUpBudgetExhausted: true,
      })
    ).toBe('unclassified');
  });
});
