import { describe, expect, it } from 'vitest';
import {
  applyRequirementsContractJudgeLifecycleEvent,
  createRequirementsContractJudgeActiveRequest,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

function activeRequest() {
  return createRequirementsContractJudgeActiveRequest({
    version: 1,
    previousVersion: null,
    semanticRevisionId: 'sem-1',
    auditPolicyHash: HASH('1'),
    providerSelectionHash: HASH('2'),
    judgeRequestHash: HASH('3'),
    requestPath: `quality/requests/${HASH('3').replace(':', '-')}/judge-request.json`,
  });
}

describe('requirements contract Judge active request lifecycle', () => {
  it('does not consume the one-shot evaluation on transport failure', () => {
    const pending = activeRequest();
    const failed = applyRequirementsContractJudgeLifecycleEvent(pending, {
      type: 'transport_failed',
      attemptOrdinal: 1,
      attemptPath: `quality/requests/${HASH('3').replace(':', '-')}/dispatch-attempts/1.json`,
      issueCode: 'judge_provider_payload_rejected',
    });

    expect(failed).toMatchObject({
      status: 'audit_pending',
      acceptedEvaluation: false,
      responseRef: null,
      attemptCount: 1,
    });

    const recovered = applyRequirementsContractJudgeLifecycleEvent(failed, {
      type: 'dispatch_scheduled',
    });
    expect(recovered.status).toBe('dispatch_pending');
    expect(recovered.judgeRequestHash).toBe(pending.judgeRequestHash);
  });

  it('accepts exactly one valid evaluation for a request hash', () => {
    const audited = applyRequirementsContractJudgeLifecycleEvent(activeRequest(), {
      type: 'response_accepted',
      attemptOrdinal: 1,
      attemptPath: `quality/requests/${HASH('3').replace(':', '-')}/dispatch-attempts/1.json`,
      responsePath: `quality/requests/${HASH('3').replace(':', '-')}/judge-response.json`,
      responseHash: HASH('4'),
      verdict: 'pass',
    });

    expect(audited).toMatchObject({ status: 'audited_pass', acceptedEvaluation: true });
    expect(() =>
      applyRequirementsContractJudgeLifecycleEvent(audited, {
        type: 'response_accepted',
        attemptOrdinal: 2,
        attemptPath: `quality/requests/${HASH('3').replace(':', '-')}/dispatch-attempts/2.json`,
        responsePath: `quality/requests/${HASH('3').replace(':', '-')}/judge-response.json`,
        responseHash: HASH('5'),
        verdict: 'pass',
      })
    ).toThrow('requirements_contract_judge_request_already_evaluated');
  });
});
