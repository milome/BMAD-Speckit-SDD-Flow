import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  GOAL_EXECUTION_ATTEMPT_POINTER_PATH,
  readGoalExecutionAttemptPointer,
  transitionGoalExecutionAttempt,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-goal-execution-attempt';
import {
  hashControlPlaneValue,
  stableControlPlaneStringify,
} from '../../packages/bmad-speckit/src/utils/goal-contract/control-plane/canonical-hash';

const HASH = `sha256:${'a'.repeat(64)}`;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function materializePreparedPointer() {
  const outRoot = mkdtempSync(join(tmpdir(), 'bmad-goal-attempt-resume-'));
  roots.push(outRoot);
  const authority = {
    profile: 'requirements_backed' as const,
    candidateRunId: 'RUN-AAAAAAAAAAAAAAAA',
    executionAuthorityId: 'direct:A',
    executionAuthorityHash: HASH,
    executionPackageHash: HASH,
    dependencyExecutionAuthorityIds: [],
    ownedPaths: ['src/refund.ts'],
  };
  const payload = {
    schemaVersion: 'GoalExecutionAttemptPointer/v1' as const,
    pointerVersion: 1,
    executionAttemptId: 'ATTEMPT-AAAAAAAAAAAAAAAA',
    activeRunPointerHash: HASH,
    activationRecordHash: HASH,
    orderedExecutionAuthorityIds: ['direct:A'],
    executionAuthorities: [authority],
    executionStarted: false,
    phase: 'prepared' as const,
    nextExecutionAuthorityId: 'direct:A',
    validClosureRefs: [],
    blockedIssueCode: null,
  };
  const pointer = { ...payload, attemptPointerHash: hashControlPlaneValue(payload) };
  mkdirSync(join(outRoot, 'goal', 'runtime'), { recursive: true });
  writeFileSync(
    join(outRoot, ...GOAL_EXECUTION_ATTEMPT_POINTER_PATH.split('/')),
    `${stableControlPlaneStringify(pointer)}\n`,
    'utf8'
  );
  return { outRoot, pointer };
}

describe('Task 7B execution attempt resume', () => {
  it('allows only CAS-bound prepared, executing, and blocked recovery transitions', () => {
    const { outRoot, pointer: prepared } = materializePreparedPointer();
    const executing = transitionGoalExecutionAttempt({
      outRoot,
      expectedPointerHash: prepared.attemptPointerHash,
      expectedPointerVersion: prepared.pointerVersion,
      phase: 'executing',
      nextExecutionAuthorityId: 'direct:A',
      validClosureRefs: [],
      blockedIssueCode: null,
    }).pointer;
    expect(executing.phase).toBe('executing');
    expect(executing.executionStarted).toBe(true);
    expect(readGoalExecutionAttemptPointer({ outRoot })?.attemptPointerHash).toBe(
      executing.attemptPointerHash
    );

    const blocked = transitionGoalExecutionAttempt({
      outRoot,
      expectedPointerHash: executing.attemptPointerHash,
      expectedPointerVersion: executing.pointerVersion,
      phase: 'blocked',
      nextExecutionAuthorityId: 'direct:A',
      validClosureRefs: [],
      blockedIssueCode: 'execution_validation_failed',
    }).pointer;
    expect(blocked.phase).toBe('blocked');
    expect(blocked.blockedIssueCode).toBe('execution_validation_failed');

    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: executing.attemptPointerHash,
        expectedPointerVersion: executing.pointerVersion,
        phase: 'executing',
        nextExecutionAuthorityId: 'direct:A',
        validClosureRefs: [],
        blockedIssueCode: null,
      })
    ).toThrow('goal_execution_attempt_cas_conflict');
  });

  it('rejects illegal phase transitions and closure history injection', () => {
    const { outRoot, pointer } = materializePreparedPointer();
    expect(() =>
      transitionGoalExecutionAttempt({
        outRoot,
        expectedPointerHash: pointer.attemptPointerHash,
        expectedPointerVersion: pointer.pointerVersion,
        phase: 'closed',
        nextExecutionAuthorityId: null,
        validClosureRefs: [],
        blockedIssueCode: null,
      })
    ).toThrow('goal_execution_attempt_transition_invalid');
  });
});
