import { describe, expect, it } from 'vitest';
import { validateRequirementsContractJudgeResponse } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-judge-lifecycle';

const HASH = (digit: string) => `sha256:${digit.repeat(64)}`;

function completeResponse() {
  return {
    schemaVersion: 'requirements-contract-judge-response/v2',
    judgeRequestHash: HASH('1'),
    verdict: 'pass',
    findings: [],
    advisoryObservations: [],
    checkedDimensionIds: ['authority', 'completeness'],
    dimensionResults: [
      { dimensionId: 'authority', decision: 'pass', findingRefs: [] },
      { dimensionId: 'completeness', decision: 'pass', findingRefs: [] },
    ],
    reviewedArtifactRefs: ['judge-audit-packet', 'final-markdown'],
    reviewedMustRefs: ['MUST-001'],
    insufficientAuditReasons: [],
  };
}

describe('requirements contract Judge response audit completeness', () => {
  it('accepts pass only after every required dimension, artifact, and MUST was reviewed', () => {
    expect(
      validateRequirementsContractJudgeResponse({
        response: completeResponse(),
        judgeRequestHash: HASH('1'),
        requiredDimensionIds: ['completeness', 'authority'],
        requiredArtifactRefs: ['final-markdown', 'judge-audit-packet'],
        requiredMustRefs: ['MUST-001'],
      })
    ).toMatchObject({ verdict: 'pass', findings: [] });
  });

  it('rejects incomplete pass and pass with a blocking finding', () => {
    expect(() =>
      validateRequirementsContractJudgeResponse({
        response: { ...completeResponse(), checkedDimensionIds: ['authority'] },
        judgeRequestHash: HASH('1'),
        requiredDimensionIds: ['authority', 'completeness'],
        requiredArtifactRefs: ['final-markdown', 'judge-audit-packet'],
        requiredMustRefs: ['MUST-001'],
      })
    ).toThrow('judge_audit_incomplete');

    expect(() =>
      validateRequirementsContractJudgeResponse({
        response: {
          ...completeResponse(),
          findings: [
            {
              findingId: 'F-001',
              severity: 'Major',
              summary: 'Missing rule',
              affectedMustRefs: ['MUST-001'],
              affectedArtifactRefs: ['final-markdown'],
              logicalEvidenceRefs: ['EVD-001'],
            },
          ],
        },
        judgeRequestHash: HASH('1'),
        requiredDimensionIds: ['authority', 'completeness'],
        requiredArtifactRefs: ['final-markdown', 'judge-audit-packet'],
        requiredMustRefs: ['MUST-001'],
      })
    ).toThrow('requirements_contract_judge_pass_with_blocking_finding');
  });

  it.each([
    {
      affectedMustRefs: ['MUST-UNKNOWN'],
      affectedArtifactRefs: ['final-markdown'],
      issueCode: 'requirements_contract_judge_finding_must_ref_unknown',
    },
    {
      affectedMustRefs: ['MUST-001'],
      affectedArtifactRefs: ['artifact-unknown'],
      issueCode: 'requirements_contract_judge_finding_artifact_ref_unknown',
    },
  ])('rejects finding refs outside the frozen request manifest', ({
    affectedMustRefs,
    affectedArtifactRefs,
    issueCode,
  }) => {
    const base = completeResponse();
    const response = {
      ...base,
      verdict: 'fail',
      findings: [{
        findingId: 'F-UNKNOWN-REF',
        severity: 'Major',
        summary: 'The finding must stay within frozen request authority.',
        affectedMustRefs,
        affectedArtifactRefs,
        logicalEvidenceRefs: ['EVIDENCE-CLAIM-MUST-001'],
      }],
      dimensionResults: base.dimensionResults.map((result) => ({
        ...result,
        decision: 'fail',
        findingRefs: ['F-UNKNOWN-REF'],
      })),
    };

    expect(() => validateRequirementsContractJudgeResponse({
      response,
      judgeRequestHash: HASH('1'),
      requiredDimensionIds: ['authority', 'completeness'],
      requiredArtifactRefs: ['final-markdown', 'judge-audit-packet'],
      requiredMustRefs: ['MUST-001'],
    })).toThrow(issueCode);
  });
});
