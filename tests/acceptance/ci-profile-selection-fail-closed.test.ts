import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixture = require('../fixtures/test-portfolio/selection-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { bindingForPath } = require('../../tools/ci/build-changed-code-impact.cjs');

function coreFreezeFor(catalog: any, policy: any) {
  const coreTest = catalog.tests.find((test: any) =>
    (test.capabilityRefs || []).includes('six-model-state-machine')
  );
  const obligationId = 'requirement_confirmation/state_entry';
  return {
    schemaVersion: 'test-portfolio-core-freeze/v2',
    selected: [
      {
        identityKey: coreTest.identityKey,
        coveredObligationIds: [obligationId],
      },
    ],
    coverage: [
      {
        obligationId,
        applicability: 'applicable',
        minimumEvidenceKind: 'indirect',
        status: 'covered',
        selectedEvidence: [{ identityKey: coreTest.identityKey, evidenceKind: 'direct' }],
        evidenceDiagnostics: [],
      },
    ],
    gaps: [],
    hashes: {
      catalogSha256: sha256Bytes(canonicalJsonBytes(catalog)),
      policySha256: sha256Bytes(canonicalJsonBytes(policy)),
    },
  };
}

function coverageReportFor(catalog: any, coreFreeze: any, policy: any, journeyGap = false) {
  return {
    schemaVersion: 'six-model-coverage-gap-report/v1',
    obligations: [
      ...coreFreeze.coverage.map((item: any) => ({
        obligationId: item.obligationId,
        applicability: item.applicability,
        minimumEvidenceKind: item.minimumEvidenceKind || 'indirect',
        coverageStatus: item.status,
      })),
      ...(journeyGap
        ? [
            {
              obligationId: 'journey/six-model-complete-record-closed',
              applicability: 'applicable',
              minimumEvidenceKind: 'direct',
              coverageStatus: 'missing_test',
              candidateTestIdentityRefs: [],
              selectedTestIdentityRefs: [],
              directEvidenceKind: null,
              oracleIndependence: 'unresolved',
            },
          ]
        : []),
    ],
    gates: {
      unmappedCriticalTransitionCount: journeyGap ? 1 : 0,
    },
    hashes: {
      catalogSha256: sha256Bytes(canonicalJsonBytes(catalog)),
      coreFreezeSha256: sha256Bytes(canonicalJsonBytes(coreFreeze)),
      policySha256: sha256Bytes(canonicalJsonBytes(policy)),
    },
  };
}

function select(input: Record<string, unknown>) {
  const { selectCiTests } = require('../../tools/ci/select-ci-tests.cjs');
  const coreFreeze = input.coreFreeze || coreFreezeFor(input.catalog, input.policy);
  return selectCiTests({
    ...input,
    coreFreeze,
    coverageReport:
      input.coverageReport || coverageReportFor(input.catalog, coreFreeze, input.policy),
  });
}

function impact(overrides: Record<string, unknown> = {}) {
  return {
    changedPaths: [],
    changedTestIdentityKeys: [],
    pathBindings: [],
    traceRefs: [],
    capabilityRefs: [],
    featureRefs: [],
    packageIds: [],
    unresolvedRefs: [],
    ...overrides,
  };
}

describe('changed-code impact fixture boundary', () => {
  it('ignores orphan fixture assets instead of inventing a package binding', () => {
    expect(
      bindingForPath({
        changedPath: 'tests/fixtures/test-portfolio-audit/routes/.github/workflows/governed.yml',
        tests: [],
        consumersByTarget: new Map(),
        facts: {
          sourceIndex: {
            packageRecords: [
              {
                packageDirectory: 'tests/fixtures/test-portfolio-audit',
                packageJson: { name: 'package:test-portfolio-route-fixture' },
              },
            ],
          },
        },
      })
    ).toBeNull();
  });

  it('keeps fixture assets that are explicitly owned by an executable test', () => {
    const changedPath = 'tests/fixtures/test-portfolio-audit/routes/.github/workflows/governed.yml';
    const binding = bindingForPath({
      changedPath,
      tests: [
        {
          identityKey: 'vitest::tests/fixture-owner.test.ts',
          testPath: 'tests/fixture-owner.test.ts',
          fixtureRefs: [changedPath],
          targetRefs: [],
          traceRefs: [],
          capabilityRefs: [],
          featureRefs: [],
          evidenceRefs: [],
          packageId: 'root',
        },
      ],
      consumersByTarget: new Map(),
      facts: { sourceIndex: { packageRecords: [] } },
    });

    expect(binding?.testIdentityRefs).toEqual(['vitest::tests/fixture-owner.test.ts']);
    expect(binding?.bindingKinds).toContain('fixture_dependency');
  });
});

describe('CI profile selection safety', () => {
  it('uses the same semantic core authority for all four profiles', () => {
    const selections = ['pr-fast', 'pr-full', 'nightly-deep', 'release-verify'].map(
      (requestedProfile) =>
        select({
          catalog: fixture.catalog,
          policy: fixture.policy,
          impact: impact({
            traceRefs: ['trace:selector'],
            capabilityRefs: ['capability:selector'],
            featureRefs: ['feature:portfolio'],
            packageIds: ['root'],
          }),
          requestedProfile,
        })
    );

    expect(
      selections.map((selection) =>
        selection.selected
          .filter((item: any) => item.reasonCodes.includes('SEMANTIC_CORE'))
          .map((item: any) => item.identityKey)
      )
    ).toEqual([
      ['vitest::tests/core.test.ts'],
      ['vitest::tests/core.test.ts'],
      ['vitest::tests/core.test.ts'],
      ['vitest::tests/core.test.ts'],
    ]);
  });

  it.each(['pr-fast', 'pr-full', 'nightly-deep', 'release-verify'])(
    'blocks %s when the critical journey remains uncovered',
    (requestedProfile) => {
      const policy = structuredClone(fixture.policy);
      policy.semanticJourneys = [
        {
          journeyId: 'six-model-complete-record-closed',
          applicability: 'applicable',
          minimumEvidenceKind: 'direct',
        },
      ];
      const coreFreeze = coreFreezeFor(fixture.catalog, policy);
      const selection = select({
        catalog: fixture.catalog,
        policy,
        coreFreeze,
        coverageReport: coverageReportFor(fixture.catalog, coreFreeze, policy, true),
        impact: impact({
          traceRefs: ['trace:selector'],
          capabilityRefs: ['capability:selector'],
          featureRefs: ['feature:portfolio'],
          packageIds: ['root'],
        }),
        requestedProfile,
      });

      expect(selection).toMatchObject({
        selectionStatus: 'blocked',
        blockingGapCount: 1,
        uncoveredObligationIds: ['journey/six-model-complete-record-closed'],
      });
    }
  );

  it.each([
    ['pr-fast', 'pr-fast', 'feature', false],
    ['pr-full', 'pr-full', 'feature', true],
    ['nightly-deep', 'nightly-deep', 'package', true],
    ['release-verify', 'release-verify', 'package', true],
  ])(
    'keeps pr-fast bounded and raises explicit wider profiles without downgrading %s',
    (requestedProfile, expectedProfile, expectedExpansionLevel, expectsEscalation) => {
      const selection = select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({
          changedPaths: ['packages/bmad-speckit/src/utils/main-agent/state.ts'],
          featureRefs: ['feature:portfolio'],
        }),
        requestedProfile,
      });

      expect(selection.profile).toBe(expectedProfile);
      expect(selection.escalationReasonCodes.includes('HIGH_DIFFUSION_PATH')).toBe(
        expectsEscalation
      );
      expect(selection.expansionLevel).toBe(expectedExpansionLevel);
    }
  );

  it('keeps release-surface changes in pr-fast when the PR profile is requested', () => {
    const selection = select({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ changedPaths: ['package.json'] }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.profile).toBe('pr-fast');
    expect(selection.escalationReasonCodes).not.toContain('RELEASE_SURFACE_PATH');
    expect(selection.selected.map((item: any) => item.identityKey)).not.toContain(
      'vitest::tests/release.test.ts'
    );
  });

  it.each(['pr-full', 'nightly-deep', 'release-verify'])(
    'forces release-surface changes to release-verify for explicit wider profile %s',
    (requestedProfile) => {
      const selection = select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({ changedPaths: ['package.json'] }),
        requestedProfile,
      });

      expect(selection.profile).toBe('release-verify');
      expect(selection.escalationReasonCodes).toContain('RELEASE_SURFACE_PATH');
      expect(selection.selected.map((item: any) => item.identityKey)).toContain(
        'vitest::tests/release.test.ts'
      );
    }
  );

  it('rejects missing or empty Task 4 policy authority fields in the selector', () => {
    const cases = [
      ['profiles missing', (policy: any) => delete policy.profiles, 'PROFILE_POLICY_INVALID'],
      ['profiles empty', (policy: any) => (policy.profiles = []), 'PROFILE_POLICY_INVALID'],
      [
        'high diffusion rules missing',
        (policy: any) => delete policy.selection.highDiffusionPathRules,
        'PROFILE_HIGH_DIFFUSION_PATH_RULES_INVALID',
      ],
      [
        'release surface rules empty',
        (policy: any) => (policy.selection.releaseSurfacePathRules = []),
        'PROFILE_RELEASE_SURFACE_PATH_RULES_INVALID',
      ],
      [
        'product survival refs empty',
        (policy: any) => (policy.selection.productSurvivalCapabilityRefs = []),
        'PRODUCT_SURVIVAL_CAPABILITY_REFS_INVALID',
      ],
      [
        'release capability refs empty',
        (policy: any) => (policy.selection.releaseCapabilityRefs = []),
        'RELEASE_CAPABILITY_REFS_INVALID',
      ],
      [
        'release binding kinds missing',
        (policy: any) => delete policy.selection.releaseRequiredBindingKinds,
        'RELEASE_REQUIRED_BINDING_KINDS_INVALID',
      ],
    ] as const;

    for (const [label, mutate, code] of cases) {
      const policy = structuredClone(fixture.policy);
      mutate(policy);
      expect(
        () =>
          select({
            catalog: fixture.catalog,
            policy,
            impact: impact(),
            requestedProfile: 'pr-fast',
          }),
        label
      ).toThrow(code);
    }
  });

  it('rejects inherited governance input containers', () => {
    expect(() =>
      select({
        catalog: Object.create({ tests: fixture.catalog.tests }),
        policy: fixture.policy,
        impact: impact(),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('CI_SELECTION_CATALOG_INVALID');

    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: Object.create({ selection: fixture.policy.selection }),
        impact: impact(),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('CI_SELECTION_POLICY_INVALID');

    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: Object.create({ traceRefs: ['trace:selector'] }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('IMPACT_INVALID');
  });

  it('accepts ordinary source changes only through their own resolvable path binding', () => {
    const selection = select({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        changedPaths: ['src/selector.ts'],
        pathBindings: [
          {
            changedPath: 'src/selector.ts',
            traceRefs: ['trace:selector'],
          },
        ],
      }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::tests/exact.test.ts'
    );
  });

  it('fails closed for an unmapped changed path instead of selecting every test', () => {
    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({ changedPaths: ['unknown-runner.config.ts'] }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('PROFILE_SELECTION_UNRESOLVED');
  });

  it('requires every changed path to have its own governed coverage', () => {
    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({
          changedPaths: ['package.json', 'unknown-runner.config.ts'],
          featureRefs: ['feature:portfolio'],
        }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('PROFILE_SELECTION_UNRESOLVED');
  });

  it('accepts changed-test path coverage only from its matching changed identity or path binding', () => {
    const changedIdentity = select({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        changedPaths: ['tests/exact.test.ts'],
        changedTestIdentityKeys: ['vitest::tests/exact.test.ts'],
      }),
      requestedProfile: 'pr-fast',
    });
    expect(changedIdentity.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::tests/exact.test.ts'
    );

    const catalogBinding = select({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        changedPaths: ['tests/exact.test.ts'],
        pathBindings: [
          {
            changedPath: 'tests/exact.test.ts',
            traceRefs: ['trace:selector'],
          },
        ],
      }),
      requestedProfile: 'pr-fast',
    });
    expect(catalogBinding.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::tests/exact.test.ts'
    );
  });

  it('does not allow unrelated global refs to cover a changed path', () => {
    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({
          changedPaths: ['tests/exact.test.ts'],
          featureRefs: ['feature:portfolio'],
        }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('PROFILE_SELECTION_UNRESOLVED');
  });

  it('rejects duplicate, non-changed, empty, and unresolved path bindings', () => {
    const cases = [
      [
        'duplicate',
        impact({
          changedPaths: ['src/selector.ts'],
          pathBindings: [
            { changedPath: 'src/selector.ts', traceRefs: ['trace:selector'] },
            { changedPath: './src/selector.ts', traceRefs: ['trace:selector'] },
          ],
        }),
        'IMPACT_PATH_BINDING_DUPLICATE',
      ],
      [
        'non-changed',
        impact({
          pathBindings: [{ changedPath: 'src/selector.ts', traceRefs: ['trace:selector'] }],
        }),
        'IMPACT_PATH_BINDING_NOT_CHANGED',
      ],
      [
        'empty',
        impact({
          changedPaths: ['package.json'],
          pathBindings: [{ changedPath: 'package.json' }],
        }),
        'IMPACT_PATH_BINDING_EMPTY',
      ],
      [
        'unresolved',
        impact({
          changedPaths: ['src/selector.ts'],
          pathBindings: [{ changedPath: 'src/selector.ts', traceRefs: ['trace:missing'] }],
        }),
        'IMPACT_PATH_BINDING_UNRESOLVED',
      ],
    ] as const;

    for (const [label, testImpact, code] of cases) {
      expect(
        () =>
          select({
            catalog: fixture.catalog,
            policy: fixture.policy,
            impact: testImpact,
            requestedProfile: 'pr-fast',
          }),
        label
      ).toThrow(code);
    }
  });

  it('fails closed when pr-full cannot form a complete Feature or Package boundary', () => {
    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({
          traceRefs: ['trace:selector'],
          capabilityRefs: ['capability:selector'],
        }),
        requestedProfile: 'pr-full',
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });

  it.each([
    ['missing', ['trace_capability', 'feature']],
    ['reordered', ['feature', 'trace_capability', 'package']],
    ['extra', ['trace_capability', 'feature', 'package', 'repository']],
  ])('rejects an expansionOrder with %s levels', (_label, expansionOrder) => {
    const policy = structuredClone(fixture.policy);
    policy.selection.expansionOrder = expansionOrder;

    expect(() =>
      select({
        catalog: fixture.catalog,
        policy,
        impact: impact(),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('PROFILE_EXPANSION_ORDER_INVALID');
  });

  it('rejects unknown profiles and invalid generated selection gates', () => {
    expect(() =>
      select({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact(),
        requestedProfile: 'contributor-skip',
      })
    ).toThrow('PROFILE_UNKNOWN');
  });

  it('blocks when a required Product Survival capability has no executable binding', () => {
    const policy = structuredClone(fixture.policy);
    policy.selection.productSurvivalCapabilityRefs.push('capability:missing');

    expect(() =>
      select({
        catalog: fixture.catalog,
        policy,
        impact: impact(),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('PRODUCT_SURVIVAL_BINDING_MISSING');
  });
});
