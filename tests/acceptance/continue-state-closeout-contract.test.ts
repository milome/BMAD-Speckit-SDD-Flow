import { describe, expect, it } from 'vitest';
import {
  canMainAgentContinue,
  canMainAgentContinueFromCloseout,
  type ContinueStateEvaluationInput,
} from '../../scripts/continue-state-contract';

describe('continue-state closeout contract', () => {
  it('allows continue only when closeout is approved, score/handoff persisted, and no blocking governance verdict remains', () => {
    const blockedInput: ContinueStateEvaluationInput = {
      latestGateDecision: 'pass',
      fourSignalStatus: 'block',
      closeoutApproved: true,
      scoreWriteResult: 'ok',
      handoffPersisted: true,
      circuitOpen: false,
    };
    expect(canMainAgentContinue(blockedInput)).toBe(false);

    const missingCloseout: ContinueStateEvaluationInput = {
      latestGateDecision: 'pass',
      fourSignalStatus: 'pass',
      closeoutApproved: false,
      scoreWriteResult: 'ok',
      handoffPersisted: true,
      circuitOpen: false,
    };
    expect(canMainAgentContinue(missingCloseout)).toBe(false);

    const allowed: ContinueStateEvaluationInput = {
      latestGateDecision: 'pass',
      fourSignalStatus: 'pass',
      closeoutApproved: true,
      scoreWriteResult: 'ok',
      handoffPersisted: true,
      circuitOpen: false,
    };
    expect(canMainAgentContinue(allowed)).toBe(true);
  });

  it('blocks continue when latest readiness verdict is a true blocker or reroute', () => {
    expect(
      canMainAgentContinue({
        latestGateDecision: 'true_blocker',
        fourSignalStatus: 'pass',
        closeoutApproved: true,
        scoreWriteResult: 'ok',
        handoffPersisted: true,
        circuitOpen: false,
      })
    ).toBe(false);

    expect(
      canMainAgentContinue({
        latestGateDecision: 'reroute',
        fourSignalStatus: 'pass',
        closeoutApproved: true,
        scoreWriteResult: 'ok',
        handoffPersisted: true,
        circuitOpen: false,
      })
    ).toBe(false);
  });

  it('derives continue-state from closeout truth fields', () => {
    expect(
      canMainAgentContinueFromCloseout({
        closeoutApproved: true,
        scoreWriteResult: 'ok',
        handoffPersisted: true,
        latestGateDecision: 'pass',
        fourSignalStatus: 'pass',
      })
    ).toBe(true);

    expect(
      canMainAgentContinueFromCloseout({
        closeoutApproved: false,
        scoreWriteResult: 'ok',
        handoffPersisted: true,
        latestGateDecision: 'pass',
        fourSignalStatus: 'pass',
      })
    ).toBe(false);
  });
});
