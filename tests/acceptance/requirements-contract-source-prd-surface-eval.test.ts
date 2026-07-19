import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  evaluateSourcePrdSurfaceCases,
  type SourcePrdSurfaceEvaluationCase,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-evaluation';
import { lintRequirementsContractSourcePrd } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/lint-requirements-contract-source-prd';

const CANONICAL_DISCOVERY_ENVELOPE = path.resolve(
  '_bmad/shared/requirements-contract/templates/discovery-prd-envelope-template.md'
);
const DISCOVERY_PROJECTIONS = [
  '_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/templates/prd-template.md',
  '_bmad/bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
  '_bmad/core/tasks/bmad-create-prd/templates/prd-template.md',
  'packages/bmad-speckit/_bmad/bmm/workflows/2-plan-workflows/bmad-create-prd/templates/prd-template.md',
  'packages/bmad-speckit/_bmad/bmm/workflows/2-plan-workflows/create-prd/templates/prd-template.md',
  'packages/bmad-speckit/_bmad/core/tasks/bmad-create-prd/templates/prd-template.md',
].map((candidate) => path.resolve(candidate));
const GOLDEN_SOURCE_PRD = path.resolve(
  'packages/bmad-speckit/src/main-agent/source-authority/tests/fixtures/source-prd/golden-source-prd.md'
);
const FORBIDDEN_DISCOVERY_AUTHORITY =
  /implementationConfirmation|currentTargetMap|## Trace Matrix Source|## Acceptance Evidence|## Implementation Path Map|source_prd_draft_ready/gu;

function productionSurfaceCase(): SourcePrdSurfaceEvaluationCase {
  const canonicalPresent = existsSync(CANONICAL_DISCOVERY_ENVELOPE);
  const canonical = canonicalPresent
    ? readFileSync(CANONICAL_DISCOVERY_ENVELOPE, 'utf8')
    : '';
  const sourcePrdLint = lintRequirementsContractSourcePrd({
    source: GOLDEN_SOURCE_PRD,
    entrySource: 'source_prd_draft',
    json: true,
  });
  return {
    caseRef: path.basename(CANONICAL_DISCOVERY_ENVELOPE),
    canonicalDiscoveryEnvelopePresent: canonicalPresent,
    sourcePrdLintPassed: sourcePrdLint.ok && sourcePrdLint.sourcePrdDraftReady,
    discoveryEnvelopeAuthorityMutationCount:
      canonical.includes('artifactRole: discovery_envelope') &&
      canonical.includes('authority: none')
        ? 0
        : 1,
    discoveryEnvelopeForbiddenProjectionCount:
      canonical.match(FORBIDDEN_DISCOVERY_AUTHORITY)?.length ?? 0,
    installedSurfaceMismatchCount: DISCOVERY_PROJECTIONS.filter(
      (projectionPath) =>
        !existsSync(projectionPath) ||
        readFileSync(projectionPath, 'utf8') !== canonical
    ).length,
    canonicalRendererBypassCount: 0,
    postCutoverV1OutputCount: 0,
  };
}

describe('requirements contract Source PRD surface evaluation', () => {
  it('keeps discovery surfaces non-authoritative and Source PRD lint-ready', () => {
    const productionCase = productionSurfaceCase();

    const result = evaluateSourcePrdSurfaceCases([productionCase]);

    expect(result.missingCanonicalSurfaceCount).toBe(0);
    expect(result.sourcePrdLintFailureCount).toBe(0);
    expect(result.discoveryEnvelopeAuthorityMutationCount).toBe(0);
    expect(result.discoveryEnvelopeForbiddenProjectionCount).toBe(0);
    expect(result.installedSurfaceMismatchCount).toBe(0);
    expect(result.decision).toBe('pass');
  });

  it('blocks a renderer bypass or authoritative Discovery Envelope mutation', () => {
    const invalid: SourcePrdSurfaceEvaluationCase = {
      ...productionSurfaceCase(),
      discoveryEnvelopeAuthorityMutationCount: 1,
      canonicalRendererBypassCount: 1,
    };

    const result = evaluateSourcePrdSurfaceCases([invalid]);

    expect(result.discoveryEnvelopeAuthorityMutationCount).toBe(1);
    expect(result.canonicalRendererBypassCount).toBe(1);
    expect(result.decision).toBe('block');
  });
});
