import { describe, expect, it } from 'vitest';
import {
  canonicalSourceSpanId,
  canonicalSpecSpanId,
  createSourceSpanRegistry,
  createSpecSpanRegistry,
  resolveEvidenceClaimAuthority,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-span-registry';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('spec span and source span authority branches', () => {
  it('creates stable content-derived identifiers instead of ordinal identities', () => {
    const spec = canonicalSpecSpanId({ normalizedClaimHash: hash('1'), obligationIds: ['OBL-002', 'OBL-001'] });
    const source = canonicalSourceSpanId({ sourceArtifactId: 'SRC-001', sourceSnapshotHash: hash('2'), startByte: 5, endByteExclusive: 12, exactTextHash: hash('3') });
    expect(spec).toBe(canonicalSpecSpanId({ normalizedClaimHash: hash('1'), obligationIds: ['OBL-001', 'OBL-002'] }));
    expect(source).toMatch(/^SOURCE-SPAN-[A-F0-9]{20}$/u);
    expect(source).not.toMatch(/^SOURCE-SPAN-\d+$/u);
  });

  it('rejects supplied span identifiers that do not exactly match canonical content', () => {
    expect(() => createSpecSpanRegistry([{
      specSpanId: 'SPEC-SPAN-00000000000000000000',
      authorityClass: 'source_grounded',
      normalizedClaimHash: hash('1'),
      boundSemanticNodeIds: ['MUST-001'],
      boundObligationIds: ['OBL-001'],
      evidenceClaimRefs: ['CLAIM-001'],
      decisionReceiptRefs: [],
      derivationReceiptRefs: [],
    }])).toThrow('spec_span_identity_mismatch');

    const sourceSpan = {
      sourceArtifactId: 'SRC-001',
      sourceSnapshotHash: hash('2'),
      startByte: 5,
      endByteExclusive: 12,
      startLine: 1,
      startColumn: 6,
      endLine: 1,
      endColumn: 13,
      exactTextHash: hash('3'),
      normalizedTextHash: hash('4'),
      structuralAnchor: 'heading:scope',
    };
    expect(() => createSourceSpanRegistry([{
      ...sourceSpan,
      sourceSpanId: canonicalSourceSpanId({ ...sourceSpan, exactTextHash: hash('5') }),
    }])).toThrow('source_span_identity_mismatch');
  });

  it.each([
    ['source_grounded', { sourceSpanRefs: ['SOURCE-SPAN-ABCDEF0123456789'] }, 'source_span'],
    ['human_confirmed', { decisionReceiptRefs: ['DECISION-001'] }, 'decision_receipt'],
    ['derived', { premiseRefs: ['POLICY-001'], derivationReceiptRefs: ['DERIVE-001'] }, 'derivation_chain'],
  ] as const)('resolves %s only through its authority branch', (authorityClass, refs, branch) => {
    expect(resolveEvidenceClaimAuthority({ evidenceClaimId: 'CLAIM-001', authorityClass, ...refs })).toMatchObject({ decision: 'pass', branch });
  });

  it('reports missing branch evidence without fabricating a span', () => {
    const result = resolveEvidenceClaimAuthority({ evidenceClaimId: 'CLAIM-002', authorityClass: 'human_confirmed', decisionReceiptRefs: [] });
    expect(result).toEqual({ decision: 'block', branch: 'decision_receipt', issueCodes: ['human_confirmed_decision_receipt_missing'] });
    expect(result).not.toHaveProperty('sourceSpanRefs');
  });
});
