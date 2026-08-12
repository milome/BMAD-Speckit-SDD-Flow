import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyRequirementsContractJudgeLifecycleEvent,
  createRequirementsContractJudgeActiveRequest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements contract one-shot lifecycle hard cut', () => {
  it('does not retain the legacy convergence implementation', () => {
    expect(
      existsSync(
        path.resolve(
          'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-convergence.ts'
        )
      )
    ).toBe(false);
  });

  it('accepts at most one evaluation for each judgeRequestHash', () => {
    const requestHash = HASH('1');
    const current = createRequirementsContractJudgeActiveRequest({
      version: 1,
      previousVersion: null,
      semanticRevisionId: 'SEM-001',
      auditPolicyHash: HASH('2'),
      providerSelectionHash: HASH('3'),
      judgeRequestHash: requestHash,
      requestPath: `quality/requests/${requestHash.replace(':', '-')}/judge-request.json`,
    });
    const evaluated = applyRequirementsContractJudgeLifecycleEvent(current, {
      type: 'response_accepted',
      attemptOrdinal: 1,
      attemptPath: `quality/requests/${requestHash.replace(':', '-')}/dispatch-attempts/1.json`,
      responsePath: `quality/requests/${requestHash.replace(':', '-')}/judge-response.json`,
      responseHash: HASH('4'),
      verdict: 'pass',
    });

    expect(evaluated).toMatchObject({ status: 'audited_pass', acceptedEvaluation: true });
    expect(() =>
      applyRequirementsContractJudgeLifecycleEvent(evaluated, {
        type: 'dispatch_scheduled',
      })
    ).toThrow('requirements_contract_judge_request_already_evaluated');
  });
});
