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
          requirementKind: 'functional',
          polarity: 'positive',
        },
        {
          id: 'MUST-NFR-001',
          text: '系统必须在两秒内完成退款状态查询。',
          oracle: '性能测试证明 P95 查询耗时不超过两秒。',
          requirementKind: 'nonfunctional',
          polarity: 'positive',
        },
        {
          id: 'NEG-001',
          text: '系统 MUST NOT 把未验证的退款批次标记为完成。',
          oracle: '未验证批次必须保持非完成状态。',
          negativeAssertion: '未验证批次必须保持非完成状态。',
          blockingCondition: '未验证批次被标记为完成。',
          requirementKind: 'negative',
          polarity: 'negative',
        },
      ],
      atoms: [
        {
          id: 'MUST-FR-001-A1',
          action: '保存批量退款审计记录。',
          oracle: '终态批次存在审计记录。',
          requirementRef: 'MUST-FR-001',
        },
        {
          id: 'MUST-NFR-001-A1',
          action: '测量退款状态查询耗时。',
          oracle: 'P95 查询耗时不超过两秒。',
          requirementRef: 'MUST-NFR-001',
        },
        {
          id: 'NEG-001-A1',
          action: '拒绝未验证批次完成状态。',
          oracle: '未验证批次保持非完成状态。',
          requirementRef: 'NEG-001',
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
      {
        evidenceClaimId: 'CLAIM-NFR-001',
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('8'),
        sourceEvidenceRequired: true,
        decisionReceiptRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
      {
        evidenceClaimId: 'CLAIM-NEG-001',
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('9'),
        sourceEvidenceRequired: true,
        decisionReceiptRefs: [],
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
      {
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('8'),
        boundSemanticNodeIds: ['MUST-NFR-001', 'MUST-NFR-001-A1'],
        boundObligationIds: ['MUST-NFR-001'],
        evidenceClaimRefs: ['CLAIM-NFR-001'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: [],
      },
      {
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('9'),
        boundSemanticNodeIds: ['NEG-001', 'NEG-001-A1'],
        boundObligationIds: ['NEG-001'],
        evidenceClaimRefs: ['CLAIM-NEG-001'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: [],
      },
    ],
    executionConstraints: [],
    semanticProvenance: {
      'MUST-FR-001': 'MUST-FR-001',
      'MUST-NFR-001': 'MUST-NFR-001',
      'NEG-001': 'NEG-001',
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
        {
          evidenceClaimId: 'CLAIM-NFR-001',
          authorityClass: 'source_grounded',
          sourceSpanRefs: ['SOURCE-SPAN-002'],
          decisionReceiptRefs: [],
          premiseRefs: [],
          derivationReceiptRefs: [],
        },
        {
          evidenceClaimId: 'CLAIM-NEG-001',
          authorityClass: 'source_grounded',
          sourceSpanRefs: ['SOURCE-SPAN-003'],
          decisionReceiptRefs: [],
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
    expect(pages.html.match(/data-requirement-id=/gu)).toHaveLength(3);
    expect(pages.html.match(/data-requirement-id="MUST-FR-001"/gu)).toHaveLength(1);
    expect(pages.html.match(/data-requirement-id="MUST-NFR-001"/gu)).toHaveLength(1);
    expect(pages.html.match(/data-requirement-id="NEG-001"/gu)).toHaveLength(1);
    expect(pages.html).toContain(
      'data-requirement-id="MUST-FR-001" data-requirement-kind="functional" data-requirement-polarity="positive"'
    );
    expect(pages.html).toContain(
      'data-requirement-id="MUST-NFR-001" data-requirement-kind="nonfunctional" data-requirement-polarity="positive"'
    );
    expect(pages.html).toContain(
      'data-requirement-id="NEG-001" data-requirement-kind="negative" data-requirement-polarity="negative"'
    );
    expect(pages.html).toContain('系统 MUST NOT 把未验证的退款批次标记为完成。');
    expect(pages.html.match(/data-requirement-classification/gu)).toHaveLength(3);
    expect(pages.html).toContain('<strong>Requirement kind:</strong> negative');
    expect(pages.html).toContain('<strong>Polarity:</strong> negative');
    expect(pages.html).toContain(
      '<strong>Negative assertion:</strong> 未验证批次必须保持非完成状态。'
    );
    expect(pages.html).toContain(
      '<strong>Blocks completion when:</strong> 未验证批次被标记为完成。'
    );
    expect(pages.html.match(/未验证批次必须保持非完成状态。/gu)).toHaveLength(1);
    expect(pages.html.match(/未验证批次被标记为完成。/gu)).toHaveLength(1);
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

  it('blocks duplicate requirement identities before rendering', () => {
    const input = projectionInput();
    const requirements = (input.semanticIr.semanticPayload.semantics as any).requirements;
    requirements.push({ ...requirements[0] });

    expect(() => projectRequirementsContractFinalPages(input)).toThrow(
      /requirements_final_render_requirement_identity_duplicate/u
    );
  });
});
