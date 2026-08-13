import { describe, expect, it } from 'vitest';
import { compileRequirementsEffectivePassReceiptV2 } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-requirements-effective-pass-gate';
import { sha256Stable } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/requirements-contract-semantic-resolver';

const hash = (label: string) => sha256Stable({ label });

function authority() {
  return {
    activeSemanticRevisionId: 'SEM-FINAL',
    activeScopeSemanticHash: hash('scope'),
    activeSourceBindingHash: hash('source'),
    activeBuildManifestHash: hash('build'),
  };
}

function aggregate(overrides = {}) {
  return {
    schemaVersion: 'requirements-contract-requirements-audit-aggregate/v2',
    semanticRevisionId: 'SEM-FINAL',
    scopeSemanticHash: hash('scope'),
    sourceBindingHash: hash('source'),
    buildManifestHash: hash('build'),
    providerSelectionHash: hash('provider-selection'),
    judgeRequestHash: hash('judge-request'),
    judgeResponseHash: hash('judge-response'),
    requirementsAuditAggregateHash: hash('aggregate'),
    validatedDimensionIds: ['completeness'],
    reviewedArtifactRefs: ['final-markdown'],
    reviewedMustRefs: ['MUST-001'],
    findings: [],
    issueCodes: [],
    decision: 'pass',
    ...overrides,
  };
}

describe('requirements contract final acceptance effective pass gate', () => {
  it('emits mechanical EffectivePass only for complete current authority', () => {
    const receipt = compileRequirementsEffectivePassReceiptV2({
      activeAuthority: authority(),
      aggregate: aggregate(),
    });

    expect(receipt).toMatchObject({
      schemaVersion: 'requirements-effective-pass-receipt/v2',
      semanticRevisionId: 'SEM-FINAL',
      requirementsAuditAggregateHash: hash('aggregate'),
      decision: 'pass',
    });
    expect(receipt).toHaveProperty('requirementsEffectivePassHash');
  });

  it('fails closed for failed Judge aggregates and stale authority', () => {
    expect(() =>
      compileRequirementsEffectivePassReceiptV2({
        activeAuthority: authority(),
        aggregate: aggregate({
          findings: [{ findingId: 'F-001' }],
          decision: 'fail',
        }),
      })
    ).toThrow('requirements_effective_pass_blocked');

    expect(() =>
      compileRequirementsEffectivePassReceiptV2({
        activeAuthority: { ...authority(), activeBuildManifestHash: hash('stale') },
        aggregate: aggregate(),
      })
    ).toThrow('requirements_effective_pass_authority_stale');
  });
});
