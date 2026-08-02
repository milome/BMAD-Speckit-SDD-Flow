import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

function profilePolicy() {
  return require('../../tools/ci/test-profile-policy.cjs') as {
    buildTestProfilePolicy: (input: Record<string, unknown>) => any;
    selectProfileTests: (input: Record<string, unknown>) => any[];
    validateTestProfilePolicy: (policy: unknown, catalog?: unknown) => unknown;
  };
}

function profileGenerator() {
  return require('../../tools/ci/generate-test-profile-policy.cjs') as {
    buildPolicyFromHistory: (input: Record<string, unknown>) => any;
  };
}

const catalog = {
  schemaVersion: 'test-catalog/v1',
  tests: [
    {
      identityKey: 'root-vitest#tests/fast.test.ts',
      testPath: 'tests/fast.test.ts',
      runnerId: 'root-vitest',
      capabilityRefs: ['capability:fast'],
      classifications: { criticality: 'critical' },
      durationSummary: { durationMs: 1200, source: 'observed' },
    },
    {
      identityKey: 'root-vitest#tests/restored.test.ts',
      testPath: 'tests/restored.test.ts',
      runnerId: 'root-vitest',
      capabilityRefs: ['capability:restored'],
      classifications: { criticality: 'standard' },
      durationSummary: { durationMs: 9000, source: 'observed' },
    },
  ],
};

describe('CI test profile policy', () => {
  it('materializes the required governance fields for every retained test', () => {
    const policy = profilePolicy().buildTestProfilePolicy({
      catalog,
      prFastTestPaths: ['tests/fast.test.ts'],
      owner: 'ci-governance',
    });

    expect(policy.schemaVersion).toBe('test-profile-policy/v1');
    expect(policy.tests).toEqual([
      {
        testPath: 'tests/fast.test.ts',
        runner: 'root-vitest',
        capabilityRefs: ['capability:fast'],
        riskTier: 'high',
        profiles: ['nightly-full', 'pr-fast', 'release-full'],
        estimatedDurationMs: 1200,
        owner: 'ci-governance',
        lastFullRunAt: null,
      },
      {
        testPath: 'tests/restored.test.ts',
        runner: 'root-vitest',
        capabilityRefs: ['capability:restored'],
        riskTier: 'medium',
        profiles: ['nightly-full', 'release-full'],
        estimatedDurationMs: 9000,
        owner: 'ci-governance',
        lastFullRunAt: null,
      },
    ]);
    expect(profilePolicy().validateTestProfilePolicy(policy, catalog)).toEqual(policy);
  });

  it('uses a bounded cold-start estimate until observed timing is available', () => {
    const coldStartCatalog = {
      schemaVersion: 'test-catalog/v1',
      tests: [
        {
          identityKey: 'root-vitest#tests/cold-start.test.ts',
          executableIdentity: 'vitest::tests/cold-start.test.ts',
          testPath: 'tests/cold-start.test.ts',
          runnerId: 'root-vitest',
          capabilityRefs: [],
          classifications: { criticality: 'standard' },
          durationSummary: { durationMs: 60000, source: 'policy_default' },
        },
      ],
    };

    const coldStart = profilePolicy().buildTestProfilePolicy({
      catalog: coldStartCatalog,
      prFastTestPaths: ['tests/cold-start.test.ts'],
      owner: 'ci-governance',
    });
    const observed = profilePolicy().buildTestProfilePolicy({
      catalog: coldStartCatalog,
      prFastTestPaths: ['tests/cold-start.test.ts'],
      estimatedDurationsByIdentity: {
        'vitest::tests/cold-start.test.ts': 7200,
      },
      owner: 'ci-governance',
    });

    expect(coldStart.tests[0].estimatedDurationMs).toBe(5000);
    expect(observed.tests[0].estimatedDurationMs).toBe(7200);
  });

  it('selects the union of pr-fast membership and changed-code impact', () => {
    const policy = profilePolicy().buildTestProfilePolicy({
      catalog,
      prFastTestPaths: ['tests/fast.test.ts'],
      owner: 'ci-governance',
    });

    expect(
      profilePolicy()
        .selectProfileTests({
          catalog,
          profilePolicy: policy,
          profile: 'pr-fast',
          impactedTestIdentityKeys: ['root-vitest#tests/restored.test.ts'],
        })
        .map((test) => test.testPath)
    ).toEqual(['tests/fast.test.ts', 'tests/restored.test.ts']);
  });

  it('lets changed-code impact override default PR exclusion', () => {
    const policy = profilePolicy().buildTestProfilePolicy({
      catalog,
      prFastTestPaths: ['tests/fast.test.ts', 'tests/restored.test.ts'],
      prExcludedTestPaths: ['tests/restored.test.ts'],
      owner: 'ci-governance',
    });

    expect(
      policy.tests.find((test: any) => test.testPath === 'tests/restored.test.ts').profiles
    ).toEqual(['nightly-full', 'pr-excluded', 'release-full']);
    expect(
      profilePolicy()
        .selectProfileTests({
          catalog,
          profilePolicy: policy,
          profile: 'pr-fast',
          impactedTestIdentityKeys: ['root-vitest#tests/restored.test.ts'],
        })
        .map((test) => test.testPath)
    ).toEqual(['tests/fast.test.ts', 'tests/restored.test.ts']);
    expect(
      profilePolicy()
        .selectProfileTests({ catalog, profilePolicy: policy, profile: 'nightly-full' })
        .map((test) => test.testPath)
    ).toEqual(['tests/fast.test.ts', 'tests/restored.test.ts']);
  });

  it.each(['nightly-full', 'release-full'])(
    'selects every retained test for %s compensation',
    (profile) => {
      const policy = profilePolicy().buildTestProfilePolicy({
        catalog,
        prFastTestPaths: ['tests/fast.test.ts'],
        owner: 'ci-governance',
      });

      expect(
        profilePolicy()
          .selectProfileTests({ catalog, profilePolicy: policy, profile })
          .map((test) => test.testPath)
      ).toEqual(['tests/fast.test.ts', 'tests/restored.test.ts']);
    }
  );

  it('keeps release-full as a full profile when release surfaces change', () => {
    const policy = profilePolicy().buildTestProfilePolicy({
      catalog,
      prFastTestPaths: ['tests/fast.test.ts'],
      owner: 'ci-governance',
    });

    expect(
      profilePolicy()
        .selectProfileTests({
          catalog,
          profilePolicy: policy,
          profile: 'release-full',
          impactedTestIdentityKeys: ['root-vitest#tests/fast.test.ts'],
        })
        .map((test) => test.testPath)
    ).toEqual(['tests/fast.test.ts', 'tests/restored.test.ts']);
  });

  it('fails closed when policy and catalog paths drift', () => {
    const policy = profilePolicy().buildTestProfilePolicy({
      catalog,
      prFastTestPaths: ['tests/fast.test.ts'],
      owner: 'ci-governance',
    });
    policy.tests.pop();

    expect(() => profilePolicy().validateTestProfilePolicy(policy, catalog)).toThrow(
      'TEST_PROFILE_POLICY_CATALOG_DRIFT'
    );
  });

  it('reuses historical deletion review as pr-fast scheduling input, not deletion authority', () => {
    const { policy, statistics } = profileGenerator().buildPolicyFromHistory({
      catalog,
      history: {
        schemaVersion: 'test-deletion-authorizations/v1',
        authorizations: [
          {
            candidateBindings: [
              { testPath: 'tests/restored.test.ts' },
              { testPath: 'tests/no-longer-present.test.ts' },
            ],
          },
        ],
      },
    });

    expect(
      policy.tests.find((test: any) => test.testPath === 'tests/fast.test.ts').profiles
    ).toContain('pr-fast');
    expect(
      policy.tests.find((test: any) => test.testPath === 'tests/restored.test.ts').profiles
    ).not.toContain('pr-fast');
    expect(
      policy.tests.find((test: any) => test.testPath === 'tests/restored.test.ts').profiles
    ).toContain('pr-excluded');
    expect(statistics).toMatchObject({
      catalogTestCount: 2,
      historicalCandidateCount: 2,
      historicalCandidateMatchedCount: 1,
      historicalCandidateUnmatchedCount: 1,
      prFastTestCount: 1,
    });
  });

  it('combines explicit PR exclusions with historical deletion review', () => {
    const { policy, statistics } = profileGenerator().buildPolicyFromHistory({
      catalog,
      history: {
        schemaVersion: 'test-deletion-authorizations/v1',
        authorizations: [],
      },
      exclusions: {
        schemaVersion: 'pr-test-exclusions/v1',
        exclusions: [
          {
            testPath: 'tests/fast.test.ts',
            reasonCode: 'KNOWN_FAILING_TEST',
            observedAt: '2026-08-01T11:09:57.276Z',
          },
        ],
      },
    });

    expect(
      policy.tests.find((test: any) => test.testPath === 'tests/fast.test.ts').profiles
    ).toEqual(['nightly-full', 'pr-excluded', 'release-full']);
    expect(statistics).toMatchObject({
      explicitExclusionCount: 1,
      explicitExclusionMatchedCount: 1,
      explicitExclusionUnmatchedCount: 0,
      prExcludedTestCount: 1,
      prFastTestCount: 1,
    });
  });

  it('quarantines the source-composition missing-document baseline without removing full coverage', () => {
    const testPath = 'packages/bmad-speckit/tests/goal-contract-source-composition-policy.test.js';
    const policy = JSON.parse(readFileSync('repo-governance/ci/test-profile-policy.json', 'utf8'));
    const exclusions = JSON.parse(
      readFileSync('repo-governance/ci/pr-test-exclusions.json', 'utf8')
    );

    expect(exclusions.exclusions.find((entry: any) => entry.testPath === testPath)).toMatchObject({
      reasonCode: 'KNOWN_MISSING_DOCUMENT_DEPENDENCY',
    });
    expect(policy.tests.find((entry: any) => entry.testPath === testPath).profiles).toEqual([
      'nightly-full',
      'pr-excluded',
      'release-full',
    ]);
  });

  it('rejects explicit exclusions that duplicate after path normalization', () => {
    expect(() =>
      profileGenerator().buildPolicyFromHistory({
        catalog,
        history: {
          schemaVersion: 'test-deletion-authorizations/v1',
          authorizations: [],
        },
        exclusions: {
          schemaVersion: 'pr-test-exclusions/v1',
          exclusions: [
            {
              testPath: 'tests/fast.test.ts',
              reasonCode: 'KNOWN_FAILING_TEST',
              observedAt: '2026-08-01T11:09:57.276Z',
            },
            {
              testPath: 'tests\\fast.test.ts',
              reasonCode: 'KNOWN_FAILING_TEST_FIXTURE_DRIFT',
              observedAt: '2026-08-01T11:09:57.276Z',
            },
          ],
        },
      })
    ).toThrow('TEST_PROFILE_EXCLUSION_DUPLICATE');
  });

  it('rejects explicit exclusions that do not match the catalog', () => {
    expect(() =>
      profileGenerator().buildPolicyFromHistory({
        catalog,
        history: {
          schemaVersion: 'test-deletion-authorizations/v1',
          authorizations: [],
        },
        exclusions: {
          schemaVersion: 'pr-test-exclusions/v1',
          exclusions: [
            {
              testPath: 'tests/not-in-catalog.test.ts',
              reasonCode: 'KNOWN_FAILING_TEST',
              observedAt: '2026-08-01T11:09:57.276Z',
            },
          ],
        },
      })
    ).toThrow('TEST_PROFILE_EXCLUSION_UNMATCHED');
  });

  it('rejects explicit exclusion reason codes that the selector cannot consume', () => {
    expect(() =>
      profileGenerator().buildPolicyFromHistory({
        catalog,
        history: {
          schemaVersion: 'test-deletion-authorizations/v1',
          authorizations: [],
        },
        exclusions: {
          schemaVersion: 'pr-test-exclusions/v1',
          exclusions: [
            {
              testPath: 'tests/fast.test.ts',
              reasonCode: 'known-failing-test',
              observedAt: '2026-08-01T11:09:57.276Z',
            },
          ],
        },
      })
    ).toThrow('TEST_PROFILE_EXCLUSIONS_INVALID');
  });

  it.each([
    {
      schemaVersion: 'pr-test-exclusions/v1',
      exclusions: [],
      unexpectedRootField: true,
    },
    {
      schemaVersion: 'pr-test-exclusions/v1',
      exclusions: [
        {
          testPath: 'tests/fast.test.ts',
          reasonCode: 'KNOWN_FAILING_TEST',
          observedAt: '2026-08-01T11:09:57.276Z',
          unexpectedItemField: true,
        },
      ],
    },
  ])('rejects explicit exclusion fields outside the declared schema', (exclusions) => {
    expect(() =>
      profileGenerator().buildPolicyFromHistory({
        catalog,
        history: {
          schemaVersion: 'test-deletion-authorizations/v1',
          authorizations: [],
        },
        exclusions,
      })
    ).toThrow('TEST_PROFILE_EXCLUSIONS_INVALID');
  });
});
