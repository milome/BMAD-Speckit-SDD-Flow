import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compactTraceFixture } from './helpers/requirements-contract-normalized-package-fixture';

const ownerPath = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compact-trace-matrix-projection.ts'
);

it('publishes the Compact Trace Matrix dual-projection owner', () => {
  expect(existsSync(ownerPath)).toBe(true);
});

describe.runIf(existsSync(ownerPath))('Compact Trace Matrix projection', () => {
  it('renders the complete atomic and acceptance-root universe to deterministic Markdown', async () => {
    const { renderRequirementsContractCompactTraceMatrixProjection } =
      await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compact-trace-matrix-projection');
    const projection =
      renderRequirementsContractCompactTraceMatrixProjection(compactTraceFixture());

    expect(projection).toMatchObject({
      atomicTraceRowCount: 1,
      fullPathRowCount: 1,
      acceptanceRootCount: 1,
      decision: 'pass',
    });
    expect(projection.markdown).toContain('TRACE-001');
    expect(projection.markdown).toContain('ACCEPTANCE-ROOT-001');
    expect(projection.jsonProjection.acceptanceRootIds).toEqual(['ACCEPTANCE-ROOT-001']);
    expect(projection.jsonProjection.atomicRows[0]).toMatchObject({
      factRefs: ['FACT-001'],
      mustRefs: ['MUST-FR-001'],
      atomRefs: ['ATOM-001'],
      originSpecSpanRefs: ['SPEC-SPAN-001'],
      evidenceClaimRefs: ['CLAIM-001'],
    });
    expect(projection.markdown).toContain('SPEC-SPAN-001');
    expect(projection.markdown).toContain('CLAIM-001');
    expect(projection.markdown).toContain('EVDREQ-001');
    expect(projection.jsonProjection.atomicRows[0].dimensions.evidenceRequirement).toEqual({
      state: 'bound',
      refs: ['EVDREQ-001'],
      proofRefs: ['PROOF-SOURCE-001'],
    });
    expect(projection.jsonProjection.atomicRows[0]).not.toHaveProperty('observedEvidence');
    expect(projection.jsonProjection.atomicRows[0]).not.toHaveProperty('artifactBytesHash');
  });

  it('blocks an Acceptance Root binding outside the declared root universe', async () => {
    const { renderRequirementsContractCompactTraceMatrixProjection } =
      await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compact-trace-matrix-projection');
    const matrix = compactTraceFixture();
    matrix.acceptanceRootBindings.push({
      acceptanceRootRef: 'ACCEPTANCE-ROOT-EXTRA',
      decision: 'trace_bound',
      traceRefs: ['TRACE-001'],
      proofRefs: ['PROOF-SOURCE-001'],
    });

    expect(renderRequirementsContractCompactTraceMatrixProjection(matrix)).toMatchObject({
      extraAcceptanceRootCount: 1,
      decision: 'block',
    });
  });

  it('blocks a full-path row that references an unknown atomic edge', async () => {
    const { renderRequirementsContractCompactTraceMatrixProjection } =
      await import('../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-compact-trace-matrix-projection');
    const matrix = compactTraceFixture();
    matrix.fullPathRows[0].orderedEdgeIds = ['EDGE-MISSING'];

    expect(renderRequirementsContractCompactTraceMatrixProjection(matrix)).toMatchObject({
      danglingPathEdgeRefCount: 1,
      decision: 'block',
    });
  });
});
