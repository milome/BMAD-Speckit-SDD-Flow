import { describe, expect, it } from 'vitest';
import { createRequirementsContractSemanticIr } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-ir';
import { reconcileRequirementsContractProjectionLineage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-cp05-cp08';
import { createRequirementsConfirmationIrBoundRenderInput } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-confirmation-render-input';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

function fixture() {
  const ir = createRequirementsContractSemanticIr({
    recordId: 'REQ-LINEAGE',
    requestId: 'REQUEST-LINEAGE',
    parentSemanticRevisionId: null,
    compilerVersion: 'compiler/v1',
    semantics: {
      facts: [{ id: 'FACT-001' }],
      musts: [{ id: 'MUST-001' }],
      atoms: [{ id: 'ATOM-001' }],
      traces: [{ id: 'TRACE-001' }],
    },
    evidenceClaims: [
      {
        evidenceClaimId: 'CLAIM-SOURCE',
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('1'),
        sourceEvidenceRequired: true,
        decisionReceiptRefs: [],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
      {
        evidenceClaimId: 'CLAIM-HUMAN',
        authorityClass: 'human_confirmed',
        normalizedClaimHash: hash('2'),
        decisionReceiptRefs: ['DECISION-001'],
        premiseRefs: [],
        derivationReceiptRefs: [],
      },
      {
        evidenceClaimId: 'CLAIM-DERIVED',
        authorityClass: 'derived',
        normalizedClaimHash: hash('3'),
        decisionReceiptRefs: [],
        premiseRefs: ['PREMISE-001'],
        derivationReceiptRefs: ['DERIVATION-001'],
      },
    ],
    specSpanRegistry: [
      {
        authorityClass: 'source_grounded',
        normalizedClaimHash: hash('1'),
        boundSemanticNodeIds: ['FACT-001'],
        boundObligationIds: ['MUST-001'],
        evidenceClaimRefs: ['CLAIM-SOURCE'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: [],
      },
      {
        authorityClass: 'human_confirmed',
        normalizedClaimHash: hash('2'),
        boundSemanticNodeIds: ['MUST-001'],
        boundObligationIds: ['MUST-001'],
        evidenceClaimRefs: ['CLAIM-HUMAN'],
        decisionReceiptRefs: ['DECISION-001'],
        derivationReceiptRefs: [],
      },
      {
        authorityClass: 'derived',
        normalizedClaimHash: hash('3'),
        boundSemanticNodeIds: ['ATOM-001'],
        boundObligationIds: ['MUST-001'],
        evidenceClaimRefs: ['CLAIM-DERIVED'],
        decisionReceiptRefs: [],
        derivationReceiptRefs: ['DERIVATION-001'],
      },
    ],
    executionConstraints: [],
    semanticProvenance: { compiler: 'compiler/v1' },
  });
  const [derivedSpan, humanSpan, sourceSpan] = [...ir.semanticPayload.specSpanRegistry].sort(
    (left, right) => left.authorityClass.localeCompare(right.authorityClass)
  );
  return {
    ir,
    spans: {
      derived: derivedSpan.specSpanId,
      human: humanSpan.specSpanId,
      source: sourceSpan.specSpanId,
    },
  };
}

describe('span projection conservation', () => {
  it('binds render fields to frozen semantic identity and logical refs without citation authority', () => {
    const { ir, spans } = fixture();
    const result = createRequirementsConfirmationIrBoundRenderInput({
      semanticIr: ir,
      fields: [
        {
          fieldRef: 'must.MUST-001',
          value: 'Persist the approved scope.',
          specSpanRefs: [spans.human],
          evidenceClaimRefs: ['CLAIM-HUMAN'],
        },
      ],
    });

    expect(result).toMatchObject({
      schemaVersion: 'requirements-confirmation-ir-bound-render-input/v1',
      semanticRevisionId: ir.semanticRevisionId,
      scopeSemanticHash: ir.scopeSemanticHash,
      authority: 'none',
    });
    expect(result.fields[0]).toMatchObject({
      specSpanRefs: [spans.human],
      evidenceClaimRefs: ['CLAIM-HUMAN'],
    });
    expect(result).not.toHaveProperty('sourceBindingHash');
    expect(JSON.stringify(result)).not.toContain('sourceSpanRefs');
  });

  it('preserves fact-to-page logical lineage and resolves all authority classes without false source refs', () => {
    const { ir, spans } = fixture();
    const nodes = [
      {
        role: 'fact',
        id: 'FACT-001',
        factRefs: [],
        mustRefs: [],
        atomRefs: [],
        traceRefs: [],
        specSpanRefs: [spans.source],
        evidenceClaimRefs: ['CLAIM-SOURCE'],
      },
      {
        role: 'must',
        id: 'MUST-001',
        factRefs: ['FACT-001'],
        mustRefs: ['MUST-001'],
        atomRefs: [],
        traceRefs: [],
        specSpanRefs: [spans.human],
        evidenceClaimRefs: ['CLAIM-HUMAN'],
      },
      {
        role: 'atom',
        id: 'ATOM-001',
        factRefs: ['FACT-001'],
        mustRefs: ['MUST-001'],
        atomRefs: ['ATOM-001'],
        traceRefs: [],
        specSpanRefs: [spans.derived],
        evidenceClaimRefs: ['CLAIM-DERIVED'],
      },
      {
        role: 'trace',
        id: 'TRACE-001',
        factRefs: ['FACT-001'],
        mustRefs: ['MUST-001'],
        atomRefs: ['ATOM-001'],
        traceRefs: ['TRACE-001'],
        specSpanRefs: [spans.source, spans.human, spans.derived],
        evidenceClaimRefs: ['CLAIM-SOURCE', 'CLAIM-HUMAN', 'CLAIM-DERIVED'],
      },
      {
        role: 'judge_finding_seed',
        id: 'SEED-001',
        factRefs: ['FACT-001'],
        mustRefs: ['MUST-001'],
        atomRefs: ['ATOM-001'],
        traceRefs: ['TRACE-001'],
        specSpanRefs: [spans.source, spans.human, spans.derived],
        evidenceClaimRefs: ['CLAIM-SOURCE', 'CLAIM-HUMAN', 'CLAIM-DERIVED'],
      },
      {
        role: 'page',
        id: 'PAGE-001',
        factRefs: ['FACT-001'],
        mustRefs: ['MUST-001'],
        atomRefs: ['ATOM-001'],
        traceRefs: ['TRACE-001'],
        specSpanRefs: [spans.source, spans.human, spans.derived],
        evidenceClaimRefs: ['CLAIM-SOURCE', 'CLAIM-HUMAN', 'CLAIM-DERIVED'],
      },
    ] as const;
    const result = reconcileRequirementsContractProjectionLineage({
      semanticIr: ir,
      nodes: structuredClone(nodes),
      resolvedEvidenceIndex: {
        semanticRevisionId: ir.semanticRevisionId,
        resolutions: [
          {
            evidenceClaimId: 'CLAIM-SOURCE',
            authorityClass: 'source_grounded',
            sourceSpanRefs: ['SOURCE-SPAN-A'],
            decisionReceiptRefs: [],
            premiseRefs: [],
            derivationReceiptRefs: [],
          },
          {
            evidenceClaimId: 'CLAIM-HUMAN',
            authorityClass: 'human_confirmed',
            sourceSpanRefs: [],
            decisionReceiptRefs: ['DECISION-001'],
            premiseRefs: [],
            derivationReceiptRefs: [],
          },
          {
            evidenceClaimId: 'CLAIM-DERIVED',
            authorityClass: 'derived',
            sourceSpanRefs: [],
            decisionReceiptRefs: [],
            premiseRefs: ['PREMISE-001'],
            derivationReceiptRefs: ['DERIVATION-001'],
          },
        ],
      },
    });

    expect(result.decision).toBe('pass');
    expect(result.nodes).toEqual(nodes);
    expect(result.authorityResolutions).toEqual([
      expect.objectContaining({
        evidenceClaimId: 'CLAIM-DERIVED',
        branch: 'derivation_chain',
        sourceSpanRefs: [],
      }),
      expect.objectContaining({
        evidenceClaimId: 'CLAIM-HUMAN',
        branch: 'decision_receipt',
        sourceSpanRefs: [],
      }),
      expect.objectContaining({
        evidenceClaimId: 'CLAIM-SOURCE',
        branch: 'source_span',
        sourceSpanRefs: ['SOURCE-SPAN-A'],
      }),
    ]);
  });

  it('blocks unknown projection IDs instead of absorbing Markdown semantics into IR', () => {
    const { ir, spans } = fixture();
    const result = reconcileRequirementsContractProjectionLineage({
      semanticIr: ir,
      nodes: [
        {
          role: 'page',
          id: 'PAGE-EDITED',
          factRefs: ['FACT-ADDED-IN-MARKDOWN'],
          mustRefs: ['MUST-001'],
          atomRefs: ['ATOM-001'],
          traceRefs: ['TRACE-001'],
          specSpanRefs: [spans.source],
          evidenceClaimRefs: ['CLAIM-SOURCE'],
        },
      ],
      resolvedEvidenceIndex: { semanticRevisionId: ir.semanticRevisionId, resolutions: [] },
    });

    expect(result.decision).toBe('block');
    expect(result.issueCodes).toContain(
      'requirements_projection_unknown_semantic_id:FACT-ADDED-IN-MARKDOWN'
    );
    expect(result.earliestAffectedStage).toBe('cp05');
    expect(result.semanticMutationAccepted).toBe(false);
  });
});
