import { describe, expect, it } from 'vitest';
import {
  advanceRequirementsAuthoringOperationBudget,
  createRequirementsAuthoringOperationBudget,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-authoring-operation-budget';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements authoring operation budget', () => {
  it('allows one repair and two Judge calls across operation ids', () => {
    const first = createRequirementsAuthoringOperationBudget({
      operationId: 'OP-1', initialSemanticHash: hash('1'), auditPolicyHash: hash('2'),
      triggeringAuditBindingHash: hash('3'), triggeringJudgeDecisionHash: hash('4'),
      judgeInvocationCount: 1, automaticRepairCount: 0, terminalStatus: 'active',
    });
    const repaired = advanceRequirementsAuthoringOperationBudget({
      budget: first, operationId: 'OP-2', automaticRepair: true,
    });
    const secondJudge = advanceRequirementsAuthoringOperationBudget({
      budget: repaired, operationId: 'OP-2', judgeInvocation: true, terminalStatus: 'blocked',
    });
    expect(secondJudge).toMatchObject({ judgeInvocationCount: 2, automaticRepairCount: 1, terminalStatus: 'blocked' });
    expect(() => advanceRequirementsAuthoringOperationBudget({
      budget: secondJudge, operationId: 'OP-3', judgeInvocation: true,
    })).toThrow('requirements_judge_invocation_budget_exhausted');
  });
});
