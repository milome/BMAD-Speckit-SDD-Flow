import { describe, expect, it } from 'vitest';
import {
  projectRequirementsContractFinalPages,
  validateRequirementsContractFinalRenderProjection,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-acceptance';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function projectionInput() {
  const semanticIr = createRequirementsContractSemanticIr({
    recordId: 'REQ-FINAL-RENDER-001',
    requestId: 'REQ-FINAL-RENDER-001',
    parentSemanticRevisionId: null,
    compilerVersion: 'requirements-contract-cp02-compiler/v1',
    semantics: {
      requirements: [
        {
          id: 'MUST-FR-001',
          text: '系统必须保存批量退款审计记录。',
          oracle: '合同测试证明终态批次写入审计记录。',
        },
      ],
      atoms: [
        {
          id: 'MUST-FR-001-A1',
          action: '保存批量退款审计记录。',
          oracle: '终态批次存在审计记录。',
          requirementRef: 'MUST-FR-001',
        },
      ],
      decisions: [
        {
          id: 'DECISION-001',
          questionId: 'QUESTION-AUDIT',
          question: '审计记录保留多久？',
          affectedFieldIds: ['audit.retentionDays'],
          answerValue: 180,
          decisionReceiptRef: 'DECISION-001',
        },
      ],
    },
    evidenceClaims: [
      {
        evidenceClaimId: 'CLAIM-MUST-001',
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('6'),
        sourceEvidenceRequired: true,
        decisionReceiptRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
      {
        evidenceClaimId: 'CLAIM-DECISION-001',
        authorityClass: 'human_confirmed',
        normalizedClaimHash: hash('7'),
        sourceEvidenceRequired: false,
        decisionReceiptRefs: ['DECISION-001'],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
    ],
    specSpanRegistry: [
      {
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('6'),
        boundSemanticNodeIds: ['MUST-FR-001', 'MUST-FR-001-A1'],
        boundObligationIds: ['MUST-FR-001'],
        evidenceClaimRefs: ['CLAIM-MUST-001'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: [],
      },
      {
        authorityClass: 'human_confirmed',
        normalizedClaimHash: hash('7'),
        boundSemanticNodeIds: ['DECISION-001'],
        boundObligationIds: [],
        evidenceClaimRefs: ['CLAIM-DECISION-001'],
        decisionReceiptRefs: ['DECISION-001'],
        derivationReceiptRefs: [],
      },
    ],
    executionConstraints: [],
    semanticProvenance: {
      'MUST-FR-001': 'MUST-FR-001',
      'DECISION-001': 'DECISION-001',
    },
  });
  return {
    requestId: 'REQ-FINAL-RENDER-001',
    confirmationLanguage: 'zh-CN',
    semanticIr,
    resolvedEvidenceIndex: {
      schemaVersion: 'requirements-contract-resolved-evidence-index/v1',
      semanticRevisionId: semanticIr.semanticRevisionId,
      bindingRevisionId: 'BINDREV-FINAL-001',
      sourceBindingHash: hash('2'),
      resolutions: [
        {
          evidenceClaimId: 'CLAIM-MUST-001',
          authorityClass: 'source_grounded',
          sourceSpanRefs: ['SOURCE-SPAN-001'],
          decisionReceiptRefs: [],
          premiseRefs: [],
          derivationReceiptRefs: [],
        },
        {
          evidenceClaimId: 'CLAIM-DECISION-001',
          authorityClass: 'human_confirmed',
          sourceSpanRefs: [],
          decisionReceiptRefs: ['DECISION-001'],
          premiseRefs: [],
          derivationReceiptRefs: [],
        },
      ],
    },
    effectivePass: {
      schemaVersion: 'requirements-effective-pass-receipt/v2',
      semanticRevisionId: semanticIr.semanticRevisionId,
      scopeSemanticHash: semanticIr.scopeSemanticHash,
      sourceBindingHash: hash('2'),
      buildManifestHash: hash('3'),
      judgeRequestHash: hash('4'),
      requirementsEffectivePassHash: hash('5'),
      decision: 'pass',
    },
  };
}

describe('Requirements final render lint', () => {
  it('projects every frozen requirement and user decision without delivery Judge fields', () => {
    const input = projectionInput();
    const pages = projectRequirementsContractFinalPages(input);
    const lint = validateRequirementsContractFinalRenderProjection({ ...input, pages });

    expect(lint).toMatchObject({ decision: 'pass', issueCodes: [] });
    expect(pages.markdown).toContain('MUST-FR-001');
    expect(pages.markdown).toContain('audit.retentionDays');
    expect(pages.markdown).toContain('180');
    expect(pages.html).toContain('CLAIM-DECISION-001');
    expect(pages.html).toContain(pages.exactConfirmationText);
    expect(JSON.stringify(pages)).not.toMatch(
      /executionFinalJudge|delivery closeout|judge-review-campaign/iu
    );
  });

  it('blocks projection loss and identity drift', () => {
    const input = projectionInput();
    const pages = projectRequirementsContractFinalPages(input);

    expect(
      validateRequirementsContractFinalRenderProjection({
        ...input,
        pages: { ...pages, markdown: pages.markdown.replace('audit.retentionDays', '') },
      }).issueCodes
    ).toContain('requirements_final_render_decision_projection_gap');
    expect(
      validateRequirementsContractFinalRenderProjection({
        ...input,
        effectivePass: { ...input.effectivePass, semanticRevisionId: 'SEMREV-STALE' },
        pages,
      }).issueCodes
    ).toContain('requirements_final_render_effective_pass_stale');
  });
});
