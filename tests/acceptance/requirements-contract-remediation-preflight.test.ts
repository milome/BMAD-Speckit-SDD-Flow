import { describe, expect, it } from 'vitest';
import { evaluateRequirementsContractRemediationCandidate } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-remediation-preflight';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('requirements remediation preflight', () => {
  it('blocks a semantic no-op before publication', () => {
    expect(evaluateRequirementsContractRemediationCandidate({
      currentSemanticIr: { scopeSemanticHash: hash('1') },
      candidateSemanticIr: { scopeSemanticHash: hash('1') },
      repairSteps: [{ findingId: 'F-1', classification: 'compiler_gap' }],
    })).toMatchObject({ decision: 'no_progress', issueCodes: ['judge_remediation_no_semantic_progress'] });
  });

  it('blocks an unsupported remediation classification', () => {
    expect(evaluateRequirementsContractRemediationCandidate({
      currentSemanticIr: { scopeSemanticHash: hash('1') },
      candidateSemanticIr: { scopeSemanticHash: hash('2') },
      repairSteps: [{ findingId: 'F-1', classification: 'non_actionable_suggestion' }],
    })).toMatchObject({ decision: 'blocked', issueCodes: ['requirements_remediation_not_materializable'] });
  });

  it('publishes only a changed semantic candidate', () => {
    expect(evaluateRequirementsContractRemediationCandidate({
      currentSemanticIr: { scopeSemanticHash: hash('1') },
      candidateSemanticIr: { scopeSemanticHash: hash('2') },
      repairSteps: [{ findingId: 'F-1', classification: 'compiler_gap' }],
    })).toMatchObject({
      decision: 'publish',
      beforeSemanticHash: hash('1'),
      afterSemanticHash: hash('2'),
    });
  });
});
