import { describe, expect, it } from 'vitest';
import {
  createRequirementsContractSourceBindingCapsule,
  validateRequirementsContractSourceBindingCapsule,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-source-binding-capsule';
import { canonicalSourceSpanId } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-span-registry';

const hash = (digit: string) => `sha256:${digit.repeat(64)}`;

describe('semantic and source-binding authority separation', () => {
  const sourceSpan = {
    sourceArtifactId: 'SRC-001',
    sourceSnapshotHash: hash('2'),
    startByte: 0,
    endByteExclusive: 4,
    startLine: 1,
    startColumn: 1,
    endLine: 1,
    endColumn: 5,
    exactTextHash: hash('3'),
    normalizedTextHash: hash('4'),
    structuralAnchor: 'heading:scope',
  };
  const sourceSpanId = canonicalSourceSpanId(sourceSpan);

  const capsuleInput = () => ({
    recordId: 'REQ-001',
    semanticRevisionId: 'SEM-001',
    scopeSemanticHash: hash('1'),
    parentBindingRevisionId: null,
    resolverIdentity: 'source-resolver/v1',
    sourceArtifacts: [{
      sourceArtifactId: 'SRC-001',
      role: 'requirements_source',
      mediaType: 'text/markdown',
      sourceSnapshotHash: hash('2'),
      orderedPosition: 0,
      immutableBlobRef: 'authoring/source-snapshots/sha256-2.md',
    }],
    sourceSpans: [{ ...sourceSpan, sourceSpanId }],
    evidenceClaimBindings: [{
      evidenceClaimId: 'CLAIM-001',
      specSpanId: 'SPEC-SPAN-ABCDEF0123456789',
      authorityClass: 'source_grounded' as const,
      sourceSpanRefs: [sourceSpanId],
    }],
  });

  it('binds physical spans only for source-grounded claims', () => {
    const capsule = createRequirementsContractSourceBindingCapsule(capsuleInput());
    expect(validateRequirementsContractSourceBindingCapsule(capsule)).toEqual({ decision: 'pass', issueCodes: [] });
    expect(capsule).not.toHaveProperty('semantics');
    expect(capsule.sourceBindingHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
  });

  it('rejects fake physical spans for non-source authority', () => {
    expect(() => createRequirementsContractSourceBindingCapsule({
      recordId: 'REQ-001', semanticRevisionId: 'SEM-001', scopeSemanticHash: hash('1'),
      parentBindingRevisionId: null, resolverIdentity: 'source-resolver/v1', sourceArtifacts: [], sourceSpans: [],
      evidenceClaimBindings: [{ evidenceClaimId: 'CLAIM-002', specSpanId: 'SPEC-SPAN-2', authorityClass: 'human_confirmed', sourceSpanRefs: ['SOURCE-SPAN-FAKE'] }],
    })).toThrow('non_source_claim_physical_span_forbidden');
  });

  it('rejects artifact, snapshot and exact-hash identity mismatches', () => {
    const missingArtifact = capsuleInput();
    missingArtifact.sourceSpans[0] = { ...missingArtifact.sourceSpans[0], sourceArtifactId: 'SRC-MISSING' };
    missingArtifact.sourceSpans[0].sourceSpanId = canonicalSourceSpanId(missingArtifact.sourceSpans[0]);
    expect(() => createRequirementsContractSourceBindingCapsule(missingArtifact)).toThrow('source_binding_artifact_missing');

    const wrongSnapshot = capsuleInput();
    wrongSnapshot.sourceSpans[0] = { ...wrongSnapshot.sourceSpans[0], sourceSnapshotHash: hash('5') };
    wrongSnapshot.sourceSpans[0].sourceSpanId = canonicalSourceSpanId(wrongSnapshot.sourceSpans[0]);
    expect(() => createRequirementsContractSourceBindingCapsule(wrongSnapshot)).toThrow('source_binding_snapshot_hash_mismatch');

    const wrongExactHash = capsuleInput();
    wrongExactHash.sourceSpans[0] = { ...wrongExactHash.sourceSpans[0], exactTextHash: hash('5') };
    expect(() => createRequirementsContractSourceBindingCapsule(wrongExactHash)).toThrow('source_span_identity_mismatch');
  });

  it('rejects a physical source span that no source-grounded claim consumes', () => {
    const orphaned = capsuleInput();
    orphaned.evidenceClaimBindings = [];
    expect(() => createRequirementsContractSourceBindingCapsule(orphaned)).toThrow('source_binding_orphan_span');
  });
});
