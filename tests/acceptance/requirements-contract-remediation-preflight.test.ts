import { describe, expect, it } from 'vitest';
import { evaluateRequirementsContractRemediationCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-preflight';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements remediation preflight', () => {
  it('blocks a semantic no-op before publication', () => {
    expect(evaluateRequirementsContractRemediationCandidate({
      beforeSemanticHash: hash('1'), repairSteps: [],
    })).toMatchObject({ decision: 'no_progress', issueCodes: ['judge_remediation_no_semantic_progress'] });
  });

  it('blocks a derived-only or unknown repair operation', () => {
    expect(evaluateRequirementsContractRemediationCandidate({
      beforeSemanticHash: hash('1'),
      repairSteps: [{ operation: 'rewrite_projection', targetNodeId: 'MUST-1', expectedBeforeHash: hash('1') }],
    })).toMatchObject({ decision: 'blocked', issueCodes: ['requirements_remediation_not_materializable'] });
  });
});
