import { describe, expect, it } from 'vitest';
import { auditRequirementsContractDirectConfirmationReads } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-direct-confirmation-read-bypass-audit';
import { renderRequirementsContractNormalizedPackage } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-package-renderer';
import { compareRequirementsContractCompactTraceParity } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-normalized-trace-graph';
import { normalizedPackageFixture } from './helpers/requirements-contract-normalized-package-fixture';

const HASH_D = `sha256:${'d'.repeat(64)}`;
const HASH_E = `sha256:${'e'.repeat(64)}`;

function compactTraceProjection() {
  return {
    canonicalTraceGraphHash: HASH_D,
    edgeTypeRegistryHash: HASH_D,
    bundleBindingHash: HASH_D,
    acceptanceBindingHash: HASH_D,
    acceptanceRootProofManifestHash: HASH_D,
    acceptanceRootIds: ['ACCEPTANCE-ROOT-001'],
    acceptanceRootCount: 1,
    acceptanceRootSetHash: HASH_D,
    atomicRows: [{ traceId: 'TRACE-001', edgeId: 'EDGE-001' }],
    fullPathRows: [{ pathTraceId: 'TRACE-PATH-001', orderedEdgeIds: ['EDGE-001'] }],
  };
}

describe('Normalized Contract Package Golden Corpus', () => {
  it('blocks duplicated semantic bodies and unresolved node or edge hash domains', () => {
    const duplicated = normalizedPackageFixture();
    const firstBodyHash = Object.keys(duplicated.semanticBodies)[0];
    duplicated.semanticBodies[HASH_D] = structuredClone(
      duplicated.semanticBodies[firstBodyHash]
    );
    duplicated.nodes['MUST-FR-002'] = {
      ...structuredClone(duplicated.nodes['MUST-FR-001']),
      bodyHash: HASH_D,
    };

    expect(renderRequirementsContractNormalizedPackage(duplicated)).toMatchObject({
      duplicatedSemanticBodyCount: 1,
      hashDomainMismatchCount: 0,
      decision: 'block',
    });

    const mismatched = normalizedPackageFixture();
    mismatched.nodes['MUST-FR-001'].bodyHash = HASH_E;
    expect(renderRequirementsContractNormalizedPackage(mismatched)).toMatchObject({
      duplicatedSemanticBodyCount: 0,
      hashDomainMismatchCount: expect.any(Number),
      decision: 'block',
    });
  });

  it('detects Compact Trace row loss and Source-to-ARTIFACT-24 drift', () => {
    const source = compactTraceProjection();
    const artifact = structuredClone(source);
    artifact.atomicRows = [];
    artifact.fullPathRows[0].orderedEdgeIds = ['EDGE-002'];

    expect(compareRequirementsContractCompactTraceParity(source, artifact)).toEqual({
      ok: false,
      issues: [
        'compact_trace_atomic_rows_mismatch',
        'compact_trace_full_path_rows_mismatch',
      ],
    });
  });

  it('rejects direct confirmation reads and legacy cross-product projection fields', () => {
    const directRead = auditRequirementsContractDirectConfirmationReads({
      files: [
        {
          path: 'src/production-consumer.ts',
          source: 'const targets = confirmation.currentTargetMap;',
        },
      ],
    });
    expect(directRead).toMatchObject({
      decision: 'block',
      findings: [{ code: 'direct_legacy_confirmation_field_read' }],
    });

    expect(() =>
      renderRequirementsContractNormalizedPackage({
        ...normalizedPackageFixture(),
        currentTargetMap: {},
      })
    ).toThrow('Normalized Contract Package schema validation failed');
  });
});
