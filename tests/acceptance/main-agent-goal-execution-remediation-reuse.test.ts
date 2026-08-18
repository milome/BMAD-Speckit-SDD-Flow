import { describe, expect, it } from 'vitest';

import {
  deriveGoalExecutionInvalidationSet,
  type GoalExecutionAttemptAuthority,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-execution-attempt';

const HASH = `sha256:${'a'.repeat(64)}`;

function authority(
  executionAuthorityId: string,
  dependencyExecutionAuthorityIds: string[] = []
): GoalExecutionAttemptAuthority {
  return {
    profile: 'requirements_backed',
    candidateRunId: 'RUN-001',
    executionAuthorityId,
    executionAuthorityHash: HASH,
    executionPackageHash: HASH,
    dependencyExecutionAuthorityIds,
    ownedPaths: [`src/${executionAuthorityId}.ts`],
  };
}

const AUTHORITIES = [
  authority('A'),
  authority('B', ['A']),
  authority('C', ['B']),
  authority('D'),
  authority('E', ['D']),
];

describe('Task 7B remediation reuse', () => {
  it('invalidates the changed authority and only its transitive dependents', () => {
    expect(deriveGoalExecutionInvalidationSet(AUTHORITIES, ['B'])).toEqual(['B', 'C']);
  });

  it('preserves unrelated predecessors and independent closed branches', () => {
    const invalidated = new Set(deriveGoalExecutionInvalidationSet(AUTHORITIES, ['D']));
    expect([...invalidated]).toEqual(['D', 'E']);
    expect(['A', 'B', 'C'].every((authorityId) => !invalidated.has(authorityId))).toBe(true);
  });

  it.each([[[]], [['UNKNOWN']], [['A', 'A']]] as const)(
    'rejects caller-selected invalid remediation boundaries: %#',
    (roots) => {
      expect(() => deriveGoalExecutionInvalidationSet(AUTHORITIES, roots)).toThrow(
        'goal_execution_remediation_boundary_invalid'
      );
    }
  );
});
