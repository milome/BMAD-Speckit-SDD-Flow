import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

import '../fixtures/test-portfolio/ci-changed-code-impact.contract';

const require = createRequire(import.meta.url);
const fixture = require('../fixtures/test-portfolio/selection-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

function selector() {
  const implementation = require('../../tools/ci/select-ci-tests.cjs') as {
    buildImpactFromChangedPaths: (input: Record<string, unknown>) => any;
    parseCliArgs: (args: string[]) => any;
    selectCiTests: (input: Record<string, unknown>) => any;
    validateSelection: (selection: Record<string, unknown>) => any;
    writeSelection: (input: Record<string, unknown>) => any;
  };
  return {
    ...implementation,
    selectCiTests: (input: Record<string, unknown>) => {
      const coreFreeze = input.coreFreeze || coreFreezeFor(input.catalog, input.policy);
      return implementation.selectCiTests({
        ...input,
        coreFreeze,
        coverageReport:
          input.coverageReport || coverageReportFor(input.catalog, coreFreeze, input.policy),
      });
    },
  };
}

function coreFreezeFor(catalog: any, policy: any, overrides: Record<string, unknown> = {}) {
  const coreTest = catalog?.tests?.find((test: any) =>
    (test.capabilityRefs || []).includes('six-model-state-machine')
  );
  const identityKey = coreTest?.identityKey || 'vitest::tests/core.test.ts';
  const obligationId = 'requirement_confirmation/state_entry';
  return {
    schemaVersion: 'test-portfolio-core-freeze/v2',
    selected: [
      {
        identityKey,
        coveredObligationIds: [obligationId],
      },
    ],
    coverage: [
      {
        obligationId,
        applicability: 'applicable',
        minimumEvidenceKind: 'indirect',
        status: 'covered',
        selectedEvidence: [{ identityKey, evidenceKind: 'direct' }],
        evidenceDiagnostics: [],
      },
    ],
    gaps: [],
    hashes: {
      catalogSha256: sha256Bytes(canonicalJsonBytes(catalog)),
      policySha256: sha256Bytes(canonicalJsonBytes(policy)),
    },
    ...overrides,
  };
}

function coverageReportFor(
  catalog: any,
  coreFreeze: any,
  policy: any,
  overrides: Record<string, unknown> = {}
) {
  return {
    schemaVersion: 'six-model-coverage-gap-report/v1',
    obligations: coreFreeze.coverage.map((item: any) => ({
      obligationId: item.obligationId,
      applicability: item.applicability,
      minimumEvidenceKind: item.minimumEvidenceKind || 'indirect',
      coverageStatus: item.status,
    })),
    gates: {
      unmappedCriticalTransitionCount: 0,
    },
    hashes: {
      catalogSha256: sha256Bytes(canonicalJsonBytes(catalog)),
      coreFreezeSha256: sha256Bytes(canonicalJsonBytes(coreFreeze)),
      policySha256: sha256Bytes(canonicalJsonBytes(policy)),
    },
    ...overrides,
  };
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

function prTestExclusions(testPaths: string[]) {
  return {
    schemaVersion: 'pr-test-exclusions/v1',
    exclusions: testPaths.map((testPath) => ({
      testPath,
      reasonCode: 'KNOWN_FAILING_TEST_FIXTURE_DRIFT',
      observedAt: '2026-08-01T00:00:00.000Z',
    })),
  };
}

describe('trace-governed CI selection', () => {
  it('integrates CI self-hosting fallback into production path binding', () => {
    const { bindingForPath } = require('../../tools/ci/build-changed-code-impact.cjs') as {
      bindingForPath: (input: Record<string, unknown>) => any;
    };
    const selfHostingTests = [
      {
        identityKey: 'root-vitest#tests/acceptance/ci-selection.test.ts',
        testPath: 'tests/acceptance/ci-selection.test.ts',
        fixtureRefs: [],
        targetRefs: [],
      },
      {
        identityKey: 'root-vitest#tests/acceptance/release-ci-parity.test.ts',
        testPath: 'tests/acceptance/release-ci-parity.test.ts',
        fixtureRefs: [],
        targetRefs: [],
      },
      {
        identityKey: 'root-vitest#tests/acceptance/test-portfolio-audit-cli.test.ts',
        testPath: 'tests/acceptance/test-portfolio-audit-cli.test.ts',
        fixtureRefs: [],
        targetRefs: [],
      },
    ];
    const productTest = {
      identityKey: 'root-vitest#tests/acceptance/product-runtime.test.ts',
      testPath: 'tests/acceptance/product-runtime.test.ts',
      fixtureRefs: [],
      targetRefs: [],
    };
    const facts = { sourceIndex: {} };
    const consumersByTarget = new Map();

    expect(
      bindingForPath({
        changedPath: 'tools/ci/ensure-test-timing-summary.cjs',
        tests: [...selfHostingTests, productTest],
        consumersByTarget,
        facts,
      })
    ).toEqual({
      changedPath: 'tools/ci/ensure-test-timing-summary.cjs',
      testIdentityRefs: [
        'root-vitest#tests/acceptance/ci-selection.test.ts',
        'root-vitest#tests/acceptance/release-ci-parity.test.ts',
        'root-vitest#tests/acceptance/test-portfolio-audit-cli.test.ts',
      ],
      traceRefs: [],
      capabilityRefs: [],
      featureRefs: [],
      packageIds: [],
      bindingKinds: ['ci_self_hosting'],
      evidenceRefs: ['policy:ci-self-hosting:tools/ci/ensure-test-timing-summary.cjs'],
    });

    const directTarget = {
      identityKey: 'root-vitest#tests/acceptance/direct-target.test.ts',
      testPath: 'tests/acceptance/direct-target.test.ts',
      fixtureRefs: [],
      targetRefs: ['tools/ci/ensure-test-timing-summary.cjs'],
    };
    const directBinding = bindingForPath({
      changedPath: 'tools/ci/ensure-test-timing-summary.cjs',
      tests: [...selfHostingTests, directTarget],
      consumersByTarget,
      facts,
    });
    expect(directBinding.testIdentityRefs).toEqual([directTarget.identityKey]);
    expect(directBinding.bindingKinds).toEqual(['direct_target']);
    expect(directBinding.evidenceRefs).not.toContain(
      'policy:ci-self-hosting:tools/ci/ensure-test-timing-summary.cjs'
    );

    expect(
      bindingForPath({
        changedPath: 'tools/ci/new-runner.cjs',
        tests: [productTest],
        consumersByTarget,
        facts,
      })
    ).toBeNull();
    expect(
      bindingForPath({
        changedPath: 'packages/product/src/index.ts',
        tests: selfHostingTests,
        consumersByTarget,
        facts,
      })
    ).toBeNull();
  });

  it('uses the catalog package identity for package-owned production changes', () => {
    const { bindingForPath } = require('../../tools/ci/build-changed-code-impact.cjs') as {
      bindingForPath: (input: Record<string, unknown>) => any;
    };
    const packageTest = {
      identityKey: 'package-node-test#packages/bmad-speckit/tests/cli.test.js',
      testPath: 'packages/bmad-speckit/tests/cli.test.js',
      packageId: 'packages/bmad-speckit',
      fixtureRefs: [],
      targetRefs: [],
    };
    const facts = {
      sourceIndex: {
        packageRecords: [
          {
            packageDirectory: 'packages/bmad-speckit',
            packagePath: 'packages/bmad-speckit/package.json',
            packageJson: { name: 'bmad-speckit' },
          },
        ],
      },
    };

    expect(
      bindingForPath({
        changedPath: 'packages/bmad-speckit/scripts/run-node-tests.cjs',
        tests: [packageTest],
        consumersByTarget: new Map(),
        facts,
      })
    ).toEqual({
      changedPath: 'packages/bmad-speckit/scripts/run-node-tests.cjs',
      testIdentityRefs: [],
      traceRefs: [],
      capabilityRefs: [],
      featureRefs: [],
      packageIds: ['packages/bmad-speckit'],
      bindingKinds: ['package_ownership'],
      evidenceRefs: [],
    });
  });

  it('builds deterministic exact-test and package impact from changed paths', () => {
    expect(
      selector().buildImpactFromChangedPaths({
        catalog: fixture.catalog,
        policy: fixture.policy,
        changedPaths: ['packages/p/src/index.ts', 'tests/exact.test.ts'],
      })
    ).toEqual({
      changedPaths: ['packages/p/src/index.ts', 'tests/exact.test.ts'],
      changedTestIdentityKeys: ['vitest::tests/exact.test.ts'],
      pathBindings: [
        {
          changedPath: 'packages/p/src/index.ts',
          capabilityRefs: [],
          featureRefs: [],
          packageIds: ['@bmad-speckit/p'],
          traceRefs: [],
        },
        {
          changedPath: 'tests/exact.test.ts',
          capabilityRefs: ['capability:selector'],
          featureRefs: ['feature:portfolio'],
          packageIds: ['root'],
          traceRefs: ['trace:selector'],
        },
      ],
      traceRefs: ['trace:selector'],
      capabilityRefs: ['capability:selector'],
      featureRefs: ['feature:portfolio'],
      packageIds: ['@bmad-speckit/p', 'root'],
      unresolvedRefs: [],
    });
  });

  it('binds a changed fixture to its executable owner without broad expansion', () => {
    const catalog = structuredClone(fixture.catalog);
    const exact = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/exact.test.ts'
    );
    exact.fixtureRefs = ['tests/fixtures/exact-input.json'];

    expect(
      selector().buildImpactFromChangedPaths({
        catalog,
        policy: fixture.policy,
        changedPaths: ['tests/fixtures/exact-input.json'],
      })
    ).toMatchObject({
      changedPaths: ['tests/fixtures/exact-input.json'],
      changedTestIdentityKeys: ['vitest::tests/exact.test.ts'],
      pathBindings: [
        {
          changedPath: 'tests/fixtures/exact-input.json',
          capabilityRefs: ['capability:selector'],
          featureRefs: ['feature:portfolio'],
          packageIds: ['root'],
          traceRefs: ['trace:selector'],
        },
      ],
      unresolvedRefs: [],
    });
  });

  it('allows explicit profile-rule paths and fails closed on unbound changed paths', () => {
    expect(
      selector().buildImpactFromChangedPaths({
        catalog: fixture.catalog,
        policy: fixture.policy,
        changedPaths: ['package.json'],
      })
    ).toMatchObject({
      changedPaths: ['package.json'],
      pathBindings: [],
      unresolvedRefs: [],
    });

    expect(() =>
      selector().buildImpactFromChangedPaths({
        catalog: fixture.catalog,
        policy: fixture.policy,
        changedPaths: ['docs/unbound.md'],
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });

  it('ignores metadata-only paths but rejects uncovered product paths during profile resolution', () => {
    expect(() =>
      selector().selectCiTests({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({
          changedPaths: ['.gitignore', 'docs/ci/test-portfolio-operations.md'],
        }),
        requestedProfile: 'pr-fast',
      })
    ).not.toThrow();

    expect(() =>
      selector().selectCiTests({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({
          changedPaths: ['tools/ci/unbound-selector.cjs'],
        }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('PROFILE_SELECTION_UNRESOLVED');
  });

  it('does not bind an ordinary source change to every root test', () => {
    expect(() =>
      selector().buildImpactFromChangedPaths({
        catalog: fixture.catalog,
        policy: fixture.policy,
        changedPaths: ['src/selector.ts'],
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });

  it('accepts a complete committed-diff CLI binding and rejects partial SHA input', () => {
    expect(
      selector().parseCliArgs([
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--core-freeze',
        '.artifacts/test-portfolio/core-freeze.json',
        '--coverage-report',
        '.artifacts/test-portfolio/six-model-coverage-gap-report.json',
        '--facts',
        '.artifacts/test-portfolio/facts.json',
        '--base-sha',
        '1111111',
        '--commit-sha',
        '2222222',
        '--requested-profile',
        'pr-fast',
      ])
    ).toMatchObject({
      'core-freeze': '.artifacts/test-portfolio/core-freeze.json',
      'coverage-report': '.artifacts/test-portfolio/six-model-coverage-gap-report.json',
      facts: '.artifacts/test-portfolio/facts.json',
      'base-sha': '1111111',
      'commit-sha': '2222222',
    });

    expect(() =>
      selector().parseCliArgs([
        '--catalog',
        '.artifacts/test-portfolio/test-catalog.json',
        '--core-freeze',
        '.artifacts/test-portfolio/core-freeze.json',
        '--coverage-report',
        '.artifacts/test-portfolio/six-model-coverage-gap-report.json',
        '--facts',
        '.artifacts/test-portfolio/facts.json',
        '--base-sha',
        '1111111',
        '--requested-profile',
        'pr-fast',
      ])
    ).toThrow('CI_SELECTION_CLI_ARGS_INVALID');
  });

  it('rejects non-canonical Facts bytes in committed-diff CLI mode', () => {
    const root = mkdtempSync(join(tmpdir(), 'ci-selection-committed-'));
    temporaryRoots.push(root);
    mkdirSync(join(root, '.artifacts/test-portfolio'), { recursive: true });
    mkdirSync(join(root, 'repo-governance/ci'), { recursive: true });
    mkdirSync(join(root, 'src'), { recursive: true });
    writeFileSync(join(root, 'src/value.ts'), 'export const value = 1;\n', 'utf8');
    execFileSync('git', ['init'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 'ci@example.invalid'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'CI Test'], { cwd: root });
    execFileSync('git', ['add', 'src/value.ts'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: root });
    const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    writeFileSync(join(root, 'src/value.ts'), 'export const value = 2;\n', 'utf8');
    execFileSync('git', ['add', 'src/value.ts'], { cwd: root });
    execFileSync('git', ['commit', '-m', 'change value'], { cwd: root });
    const commitSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
    const facts = {
      schemaVersion: 'test-portfolio-audit-facts/v1',
      repository: { commit: commitSha, dirty: false },
      sourceIndex: { productionEdges: [] },
    };
    const { catalogFactsHash } = require('../../tools/ci/generate-test-catalog.cjs');
    const catalog = {
      ...structuredClone(fixture.catalog),
      schemaVersion: 'test-catalog/v1',
      repository: { commit: commitSha, dirty: false },
      factsHash: catalogFactsHash(facts),
    };
    const policy = JSON.parse(
      readFileSync(join(process.cwd(), 'repo-governance/ci/test-policy.json'), 'utf8')
    );
    writeFileSync(
      join(root, '.artifacts/test-portfolio/test-catalog.json'),
      canonicalJsonBytes(catalog)
    );
    writeFileSync(
      join(root, '.artifacts/test-portfolio/core-freeze.json'),
      canonicalJsonBytes(coreFreezeFor(catalog, policy))
    );
    writeFileSync(
      join(root, '.artifacts/test-portfolio/six-model-coverage-gap-report.json'),
      canonicalJsonBytes(coverageReportFor(catalog, coreFreezeFor(catalog, policy), policy))
    );
    writeFileSync(
      join(root, '.artifacts/test-portfolio/facts.json'),
      `${JSON.stringify(facts, null, 2)}\n`,
      'utf8'
    );
    writeFileSync(join(root, 'repo-governance/ci/test-policy.json'), canonicalJsonBytes(policy));
    const { buildTestProfilePolicy } = require('../../tools/ci/test-profile-policy.cjs');
    writeFileSync(
      join(root, 'repo-governance/ci/test-profile-policy.json'),
      canonicalJsonBytes(
        buildTestProfilePolicy({
          catalog,
          prFastTestPaths: catalog.tests.map((test: any) => test.testPath),
        })
      )
    );
    writeFileSync(
      join(root, 'repo-governance/ci/pr-test-exclusions.json'),
      canonicalJsonBytes({
        schemaVersion: 'pr-test-exclusions/v1',
        exclusions: [],
      })
    );
    const scriptPath = join(process.cwd(), 'tools/ci/select-ci-tests.cjs');
    let stderr = '';
    try {
      execFileSync(
        process.execPath,
        [
          scriptPath,
          '--catalog',
          '.artifacts/test-portfolio/test-catalog.json',
          '--core-freeze',
          '.artifacts/test-portfolio/core-freeze.json',
          '--coverage-report',
          '.artifacts/test-portfolio/six-model-coverage-gap-report.json',
          '--facts',
          '.artifacts/test-portfolio/facts.json',
          '--base-sha',
          baseSha,
          '--commit-sha',
          commitSha,
          '--policy',
          'repo-governance/ci/test-policy.json',
          '--requested-profile',
          'pr-fast',
        ],
        { cwd: root, encoding: 'utf8', stdio: 'pipe' }
      );
    } catch (error: any) {
      stderr = error.stderr;
    }
    expect(stderr).toContain('CI_ARTIFACT_NOT_CANONICAL');
  });

  it('always includes core and stops at the first complete trace/capability boundary', () => {
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        changedTestIdentityKeys: ['vitest::tests/exact.test.ts'],
        traceRefs: ['trace:selector'],
        capabilityRefs: ['capability:selector'],
        featureRefs: ['feature:portfolio'],
        packageIds: ['root'],
      }),
      requestedProfile: 'pr-fast',
    });

    expect(
      fixture.catalog.tests.find((test: any) => test.identityKey === 'vitest::tests/core.test.ts')
        .lifecycleState
    ).not.toBe('core_permanent');
    expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/exact.test.ts',
    ]);
    expect(selection.selected[0]).toMatchObject({
      lane: 'core',
      reasonCodes: expect.arrayContaining(['SEMANTIC_CORE']),
      coveredObligationIds: ['requirement_confirmation/state_entry'],
    });
    expect(selection.expansionLevel).toBe('trace_capability');
    expect(selection.gates).toEqual({
      selectionOmissionCount: 0,
      selectionDuplicateCount: 0,
      unresolvedImpactBindingCount: 0,
    });
  });

  it('fails closed when the dynamic core freeze authority is missing or invalid', () => {
    const input = {
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact(),
      requestedProfile: 'pr-fast',
    };
    const implementation = require('../../tools/ci/select-ci-tests.cjs');
    expect(() => implementation.selectCiTests(input)).toThrow('CI_SELECTION_CORE_FREEZE_INVALID');

    const validFreeze = coreFreezeFor(fixture.catalog, fixture.policy);
    const cases = [
      [
        'legacy schema',
        { ...validFreeze, schemaVersion: 'test-portfolio-core-freeze/v1' },
        'CI_SELECTION_CORE_FREEZE_INVALID',
      ],
      [
        'catalog hash mismatch',
        {
          ...validFreeze,
          hashes: {
            ...validFreeze.hashes,
            catalogSha256: `sha256:${'0'.repeat(64)}`,
          },
        },
        'CI_SELECTION_CORE_FREEZE_CATALOG_HASH_MISMATCH',
      ],
      [
        'policy hash mismatch',
        {
          ...validFreeze,
          hashes: {
            ...validFreeze.hashes,
            policySha256: `sha256:${'0'.repeat(64)}`,
          },
        },
        'CI_SELECTION_CORE_FREEZE_POLICY_HASH_MISMATCH',
      ],
      [
        'unknown identity',
        {
          ...validFreeze,
          selected: [
            {
              identityKey: 'vitest::tests/missing.test.ts',
              coveredObligationIds: ['requirement_confirmation/state_entry'],
            },
          ],
        },
        'CI_SELECTION_CORE_FREEZE_IDENTITY_MISSING',
      ],
      [
        'duplicate identity',
        {
          ...validFreeze,
          selected: [...validFreeze.selected, ...validFreeze.selected],
        },
        'CI_SELECTION_CORE_FREEZE_DUPLICATE',
      ],
      [
        'coverage mismatch',
        {
          ...validFreeze,
          selected: [
            {
              ...validFreeze.selected[0],
              coveredObligationIds: ['requirement_confirmation/fail_closed'],
            },
          ],
        },
        'CI_SELECTION_CORE_FREEZE_COVERAGE_MISMATCH',
      ],
    ] as const;

    for (const [label, coreFreeze, code] of cases) {
      expect(
        () =>
          selector().selectCiTests({
            ...input,
            coreFreeze,
          }),
        label
      ).toThrow(code);
    }
  });

  it('projects a blocked selection from an authoritative gapped core freeze', () => {
    const validFreeze = coreFreezeFor(fixture.catalog, fixture.policy);
    const obligationId = 'requirement_confirmation/state_entry';
    const coreFreeze = {
      ...validFreeze,
      selected: [],
      coverage: [
        {
          ...validFreeze.coverage[0],
          status: 'missing_test',
          selectedEvidence: [],
        },
      ],
      gaps: [{ obligationId, reason: 'missing_test' }],
    };

    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      coreFreeze,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selectionStatus).toBe('blocked');
    expect(selection.uncoveredObligationIds).toEqual([obligationId]);
    expect(selection.blockingGapCount).toBe(1);
  });

  it('fails closed when the coverage report is missing, stale, or disagrees with atomic gaps', () => {
    const coreFreeze = coreFreezeFor(fixture.catalog, fixture.policy);
    const coverageReport = coverageReportFor(fixture.catalog, coreFreeze, fixture.policy);
    const input = {
      catalog: fixture.catalog,
      policy: fixture.policy,
      coreFreeze,
      impact: impact(),
      requestedProfile: 'pr-fast',
    };
    const implementation = require('../../tools/ci/select-ci-tests.cjs');

    expect(() => implementation.selectCiTests(input)).toThrow(
      'CI_SELECTION_COVERAGE_REPORT_INVALID'
    );

    const cases = [
      [
        'legacy schema',
        { ...coverageReport, schemaVersion: 'six-model-coverage-gap-report/v0' },
        'CI_SELECTION_COVERAGE_REPORT_INVALID',
      ],
      [
        'catalog hash drift',
        {
          ...coverageReport,
          hashes: {
            ...coverageReport.hashes,
            catalogSha256: `sha256:${'0'.repeat(64)}`,
          },
        },
        'CI_SELECTION_COVERAGE_REPORT_CATALOG_HASH_MISMATCH',
      ],
      [
        'core freeze hash drift',
        {
          ...coverageReport,
          hashes: {
            ...coverageReport.hashes,
            coreFreezeSha256: `sha256:${'0'.repeat(64)}`,
          },
        },
        'CI_SELECTION_COVERAGE_REPORT_CORE_FREEZE_HASH_MISMATCH',
      ],
      [
        'policy hash drift',
        {
          ...coverageReport,
          hashes: {
            ...coverageReport.hashes,
            policySha256: `sha256:${'0'.repeat(64)}`,
          },
        },
        'CI_SELECTION_COVERAGE_REPORT_POLICY_HASH_MISMATCH',
      ],
      [
        'atomic gap drift',
        {
          ...coverageReport,
          obligations: coverageReport.obligations.map((row: any) => ({
            ...row,
            coverageStatus: 'missing_test',
          })),
        },
        'CI_SELECTION_COVERAGE_REPORT_ATOMIC_GAPS_MISMATCH',
      ],
      [
        'atomic coverage omitted',
        {
          ...coverageReport,
          obligations: [],
        },
        'CI_SELECTION_COVERAGE_REPORT_ATOMIC_COVERAGE_MISMATCH',
      ],
    ] as const;

    for (const [label, candidate, code] of cases) {
      expect(
        () => implementation.selectCiTests({ ...input, coverageReport: candidate }),
        label
      ).toThrow(code);
    }
  });

  it('blocks an uncovered critical journey even when the atomic core has no gaps', () => {
    const policy = structuredClone(fixture.policy);
    policy.semanticJourneys = [
      {
        journeyId: 'six-model-complete-record-closed',
        applicability: 'applicable',
        minimumEvidenceKind: 'direct',
      },
    ];
    const coreFreeze = coreFreezeFor(fixture.catalog, policy);
    const atomicCoverage = coverageReportFor(fixture.catalog, coreFreeze, policy);
    const journeyObligationId = 'journey/six-model-complete-record-closed';
    const coverageReport = {
      ...atomicCoverage,
      obligations: [
        ...atomicCoverage.obligations,
        {
          obligationId: journeyObligationId,
          applicability: 'applicable',
          minimumEvidenceKind: 'direct',
          coverageStatus: 'missing_test',
          candidateTestIdentityRefs: [],
          selectedTestIdentityRefs: [],
          directEvidenceKind: null,
          oracleIndependence: 'unresolved',
        },
      ],
      gates: {
        unmappedCriticalTransitionCount: 1,
      },
    };

    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy,
      coreFreeze,
      coverageReport,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selectionStatus).toBe('blocked');
    expect(selection.blockingGapCount).toBe(1);
    expect(selection.uncoveredObligationIds).toEqual([journeyObligationId]);
    expect(selection.coverageReportHash).toBe(sha256Bytes(canonicalJsonBytes(coverageReport)));
  });

  it('fails closed when the coverage report omits a policy-declared critical journey', () => {
    const policy = structuredClone(fixture.policy);
    policy.semanticJourneys = [
      {
        journeyId: 'six-model-complete-record-closed',
        applicability: 'applicable',
        minimumEvidenceKind: 'direct',
      },
    ];
    const coreFreeze = coreFreezeFor(fixture.catalog, policy);

    expect(() =>
      selector().selectCiTests({
        catalog: fixture.catalog,
        policy,
        coreFreeze,
        coverageReport: coverageReportFor(fixture.catalog, coreFreeze, policy),
        impact: impact(),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('CI_SELECTION_COVERAGE_REPORT_JOURNEYS_MISMATCH');
  });

  it('selects graph-resolved direct target identities even without trace or capability refs', () => {
    const catalog = structuredClone(fixture.catalog);
    catalog.tests.push({
      identityKey: 'vitest::tests/direct-target.test.ts',
      runnerId: 'vitest',
      testPath: 'tests/direct-target.test.ts',
      lifecycleState: 'retained_on_demand',
      capabilityRefs: [],
      traceRefs: [],
      featureRefs: [],
      packageId: 'root',
      releaseGateMembership: 'none',
    });
    const selection = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact({
        changedPaths: ['src/direct-target.ts'],
        pathBindings: [
          {
            changedPath: 'src/direct-target.ts',
            testIdentityRefs: ['vitest::tests/direct-target.test.ts'],
            traceRefs: [],
            capabilityRefs: [],
            featureRefs: [],
            packageIds: [],
            bindingKinds: ['direct_target'],
            evidenceRefs: ['source:tests/feature.test.ts#import:../src/direct-target.ts'],
          },
        ],
      }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/direct-target.test.ts',
    ]);
    expect(
      selection.selected.find(
        (item: any) => item.identityKey === 'vitest::tests/direct-target.test.ts'
      ).reasonCodes
    ).toContain('DIRECT_TARGET_IMPACT');
  });

  it('projects audit Catalog identities into canonical execution identities', () => {
    const catalog = structuredClone(fixture.catalog);
    const core = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/core.test.ts'
    );
    core.identityKey = 'root-vitest#tests/core.test.ts';
    core.runnerId = 'root-vitest';
    core.executableIdentity = 'vitest::tests/core.test.ts';

    const packageTest = catalog.tests.find(
      (test: any) => test.identityKey === 'node::packages/p/tests/package.test.js'
    );
    packageTest.identityKey = 'package-node-test#packages/bmad-speckit/tests/package.test.js';
    packageTest.runnerId = 'package-node-test';
    packageTest.testPath = 'packages/bmad-speckit/tests/package.test.js';
    packageTest.executableIdentity = 'node::packages/bmad-speckit/tests/package.test.js';

    const selection = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact({ changedTestIdentityKeys: [packageTest.identityKey] }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
      'node::packages/bmad-speckit/tests/package.test.js',
      'vitest::tests/core.test.ts',
    ]);
    expect(selection.selected.map((item: any) => item.runnerId)).toEqual(['node', 'vitest']);
  });

  it('fails closed when an unselected Catalog execution identity is invalid', () => {
    const catalog = structuredClone(fixture.catalog);
    const deletionCandidate = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/delete.test.ts'
    );
    deletionCandidate.executableIdentity = 'vitest::tests/other.test.ts';

    expect(() =>
      selector().selectCiTests({
        catalog,
        policy: fixture.policy,
        impact: impact(),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('CI_SELECTION_EXECUTABLE_IDENTITY_INVALID');
  });

  it.each([
    ['traceRefs', 'trace:selector', 'trace:missing'],
    ['capabilityRefs', 'capability:selector', 'capability:missing'],
    ['featureRefs', 'feature:portfolio', 'feature:missing'],
    ['packageIds', 'root', '@bmad-speckit/missing'],
  ])('fails closed when %s only partially binds', (field, knownRef, missingRef) => {
    expect(() =>
      selector().selectCiTests({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({ [field]: [knownRef, missingRef] }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });

  it('continues from an incomplete exact boundary to a complete Feature boundary', () => {
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        traceRefs: ['trace:selector', 'trace:missing'],
        featureRefs: ['feature:portfolio'],
      }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.expansionLevel).toBe('feature');
    expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/exact.test.ts',
      'vitest::tests/feature.test.ts',
    ]);
  });

  it('expands from Feature to Package and never substitutes the whole Catalog', () => {
    const featureSelection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ featureRefs: ['feature:portfolio'] }),
      requestedProfile: 'pr-fast',
    });
    expect(featureSelection.expansionLevel).toBe('feature');
    expect(featureSelection.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/exact.test.ts',
      'vitest::tests/feature.test.ts',
    ]);

    const packageSelection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ packageIds: ['@bmad-speckit/p'] }),
      requestedProfile: 'pr-fast',
    });
    expect(packageSelection.expansionLevel).toBe('package');
    expect(packageSelection.selected.map((item: any) => item.identityKey)).toEqual([
      'node::packages/p/tests/package.test.js',
      'vitest::tests/core.test.ts',
    ]);

    expect(() =>
      selector().selectCiTests({
        catalog: fixture.catalog,
        policy: fixture.policy,
        impact: impact({ unresolvedRefs: ['src/unknown.ts'] }),
        requestedProfile: 'pr-fast',
      })
    ).toThrow('IMPACT_BINDING_UNRESOLVED');
  });

  it('keeps changed tests selected while excluding unrelated deletion candidates', () => {
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ changedTestIdentityKeys: ['vitest::tests/delete.test.ts'] }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::tests/delete.test.ts'
    );
    expect(selection.selected.map((item: any) => item.identityKey)).not.toContain(
      'vitest::tests/feature.test.ts'
    );
  });

  it('keeps pr-full bounded to complete direct target impact without a wider semantic boundary', () => {
    const changedPath = 'tools/ci/direct-only.cjs';
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        changedPaths: [changedPath],
        pathBindings: [
          {
            changedPath,
            testIdentityRefs: ['vitest::tests/exact.test.ts'],
            traceRefs: [],
            capabilityRefs: [],
            featureRefs: [],
            packageIds: [],
            bindingKinds: ['direct_target'],
            evidenceRefs: ['source:tests/exact.test.ts#target:tools/ci/direct-only.cjs'],
          },
        ],
      }),
      requestedProfile: 'pr-full',
    });

    expect(selection).toMatchObject({
      profile: 'pr-full',
      expansionLevel: 'trace_capability',
      gates: {
        selectionDuplicateCount: 0,
        selectionOmissionCount: 0,
        unresolvedImpactBindingCount: 0,
      },
    });
    expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/exact.test.ts',
    ]);
    expect(selection.selected.map((item: any) => item.identityKey)).not.toContain(
      'vitest::tests/feature.test.ts'
    );
  });

  it('includes the affected Feature working set alongside exact on-demand tests in pr-fast', () => {
    const catalog = structuredClone(fixture.catalog);
    const exact = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/exact.test.ts'
    );
    exact.lifecycleState = 'retained_on_demand';
    catalog.tests.push({
      identityKey: 'vitest::tests/working-set.test.ts',
      runnerId: 'vitest',
      testPath: 'tests/working-set.test.ts',
      lifecycleState: 'feature_working_set',
      capabilityRefs: [],
      traceRefs: [],
      featureRefs: ['feature:portfolio'],
      packageId: 'root',
      releaseGateMembership: 'none',
    });

    const selection = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact({
        traceRefs: ['trace:selector'],
        capabilityRefs: ['capability:selector'],
      }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/exact.test.ts',
      'vitest::tests/working-set.test.ts',
    ]);
  });

  it('includes feature-working tests from explicitly impacted packages in pr-fast', () => {
    const catalog = structuredClone(fixture.catalog);
    catalog.tests.push({
      identityKey: 'vitest::packages/p/tests/working-set.test.ts',
      runnerId: 'vitest',
      testPath: 'packages/p/tests/working-set.test.ts',
      lifecycleState: 'feature_working_set',
      capabilityRefs: [],
      traceRefs: [],
      featureRefs: [],
      packageId: '@bmad-speckit/p',
      releaseGateMembership: 'none',
    });

    const selection = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact({
        traceRefs: ['trace:selector'],
        capabilityRefs: ['capability:selector'],
        packageIds: ['@bmad-speckit/p'],
      }),
      requestedProfile: 'pr-fast',
    });

    expect(selection.expansionLevel).toBe('trace_capability');
    expect(selection.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::packages/p/tests/working-set.test.ts'
    );
    expect(
      selection.selected.find(
        (item: any) => item.identityKey === 'vitest::packages/p/tests/working-set.test.ts'
      ).reasonCodes
    ).toContain('FEATURE_WORKING_SET');
  });

  it('routes catalog-declared parallel-unsafe tests to the serial repo-mutating lane', () => {
    const catalog = structuredClone(fixture.catalog);
    const exact = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/exact.test.ts'
    );
    exact.classifications = {
      ...(exact.classifications || {}),
      parallelSafety: 'unsafe',
    };

    const selection = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact({
        changedTestIdentityKeys: [exact.identityKey],
      }),
      requestedProfile: 'pr-fast',
    });
    const selected = selection.selected.find((test: any) => test.identityKey === exact.identityKey);

    expect(selected).toMatchObject({
      lane: 'repo_mutating',
      reasonCodes: expect.arrayContaining(['CHANGED_TEST', 'REPO_MUTATING']),
    });
  });

  it('selects only applicable on-demand tests for nightly and explicit release bindings', () => {
    const nightly = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact(),
      requestedProfile: 'nightly-deep',
    });
    expect(nightly.selected.map((item: any) => item.identityKey)).not.toContain(
      'vitest::tests/delete.test.ts'
    );
    expect(nightly.selected.map((item: any) => item.identityKey)).toContain(
      'vitest::tests/feature.test.ts'
    );

    const release = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact(),
      requestedProfile: 'release-verify',
    });
    expect(release.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/release.test.ts',
    ]);
  });

  it('does not reintroduce ordinary direct-impact tests into release verification', () => {
    const catalog = structuredClone(fixture.catalog);
    catalog.tests.push({
      identityKey: 'vitest::tests/ordinary-direct.test.ts',
      runnerId: 'vitest',
      testPath: 'tests/ordinary-direct.test.ts',
      lifecycleState: 'retained_on_demand',
      capabilityRefs: [],
      traceRefs: [],
      featureRefs: [],
      packageId: 'root',
      releaseGateMembership: 'none',
    });

    const release = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact({
        changedPaths: ['src/ordinary.ts'],
        pathBindings: [
          {
            changedPath: 'src/ordinary.ts',
            testIdentityRefs: ['vitest::tests/ordinary-direct.test.ts'],
            traceRefs: [],
            capabilityRefs: [],
            featureRefs: [],
            packageIds: [],
            bindingKinds: ['direct_target'],
            evidenceRefs: ['source:tests/ordinary-direct.test.ts#import:../src/ordinary.ts'],
          },
        ],
      }),
      requestedProfile: 'release-verify',
    });

    expect(release.selected.map((item: any) => item.identityKey)).toEqual([
      'vitest::tests/core.test.ts',
      'vitest::tests/release.test.ts',
    ]);
  });

  it('never reintroduces a deletion candidate into nightly through a changed identity', () => {
    const nightly = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ changedTestIdentityKeys: ['vitest::tests/delete.test.ts'] }),
      requestedProfile: 'nightly-deep',
    });

    expect(nightly.selected.map((item: any) => item.identityKey)).not.toContain(
      'vitest::tests/delete.test.ts'
    );
  });

  it('treats release gate membership as metadata rather than selection authority', () => {
    const catalog = structuredClone(fixture.catalog);
    const membershipOnly = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/feature.test.ts'
    );
    membershipOnly.releaseGateMembership = 'release';

    const release = selector().selectCiTests({
      catalog,
      policy: fixture.policy,
      impact: impact(),
      requestedProfile: 'release-verify',
    });

    expect(release.selected.map((item: any) => item.identityKey)).not.toContain(
      'vitest::tests/feature.test.ts'
    );
    expect(
      release.selected.find((item: any) => item.identityKey === 'vitest::tests/release.test.ts')
        .reasonCodes
    ).toEqual(expect.arrayContaining(['RELEASE_CAPABILITY', 'RELEASE_GATE_MEMBERSHIP']));
  });

  it('fails closed when a release capability has no executable Catalog binding', () => {
    const policy = structuredClone(fixture.policy);
    policy.selection.releaseCapabilityRefs.push('capability:missing');

    expect(() =>
      selector().selectCiTests({
        catalog: fixture.catalog,
        policy,
        impact: impact(),
        requestedProfile: 'release-verify',
      })
    ).toThrow('RELEASE_CAPABILITY_BINDING_MISSING');
  });

  it('fails closed when a governed release capability loses its Catalog binding', () => {
    const catalog = structuredClone(fixture.catalog);
    const release = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/release.test.ts'
    );
    release.capabilityRefs = release.capabilityRefs.filter(
      (capabilityRef: string) => capabilityRef !== 'governance-proof-round-2'
    );

    expect(() =>
      selector().selectCiTests({
        catalog,
        policy: fixture.policy,
        impact: impact(),
        requestedProfile: 'release-verify',
      })
    ).toThrow('RELEASE_CAPABILITY_BINDING_MISSING');
  });

  it('fails closed when release tests do not cover every required critical binding kind', () => {
    const catalog = structuredClone(fixture.catalog);
    const release = catalog.tests.find(
      (test: any) => test.identityKey === 'vitest::tests/release.test.ts'
    );
    release.classifications.criticalBindings = release.classifications.criticalBindings.filter(
      (binding: any) => binding.kind !== 'protected_acceptance_or_proof'
    );

    expect(() =>
      selector().selectCiTests({
        catalog,
        policy: fixture.policy,
        impact: impact(),
        requestedProfile: 'release-verify',
      })
    ).toThrow('RELEASE_REQUIRED_BINDING_KIND_MISSING');
  });

  it('tracks explicit release coverage for every protected delivery capability', () => {
    const policy = JSON.parse(
      readFileSync(join(process.cwd(), 'repo-governance/ci/test-policy.json'), 'utf8')
    );
    const protectedCapabilityIds = policy.protectedCapabilities.map(
      (capability: any) => capability.capabilityId
    );

    expect(policy.selection.releaseCapabilityRefs).toEqual(
      expect.arrayContaining(protectedCapabilityIds)
    );
  });

  it('lets changed-code impact restore an explicitly excluded obligation provider in PR selection', () => {
    const profilePolicy = {
      schemaVersion: 'test-profile-policy/v1',
      tests: fixture.catalog.tests.map((test: any) => ({
        testPath: test.testPath,
        runner: test.runnerId,
        capabilityRefs: test.capabilityRefs || [],
        riskTier: 'low',
        profiles:
          test.identityKey === 'vitest::tests/core.test.ts'
            ? ['nightly-full', 'pr-excluded', 'release-full']
            : ['nightly-full', 'pr-fast', 'release-full'],
        estimatedDurationMs: 1,
        owner: 'ci-governance',
        lastFullRunAt: null,
      })),
    };
    const prSelection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      profilePolicy,
      impact: impact({
        changedTestIdentityKeys: ['vitest::tests/core.test.ts'],
      }),
      requestedProfile: 'pr-fast',
    });
    const nightlySelection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      profilePolicy,
      impact: impact(),
      requestedProfile: 'nightly-full',
    });

    expect(prSelection.selected.map((test: any) => test.identityKey)).toContain(
      'vitest::tests/core.test.ts'
    );
    expect(prSelection.selectionStatus).toBe('ready');
    expect(prSelection.blockingGapCount).toBe(0);
    expect(prSelection.uncoveredObligationIds).toEqual([]);
    expect(nightlySelection.selected.map((test: any) => test.identityKey)).toContain(
      'vitest::tests/core.test.ts'
    );
    expect(nightlySelection.selectionStatus).toBe('ready');
  });

  it('lets changed-code impact override explicit PR quarantine while full profiles retain it', () => {
    const profilePolicy = {
      schemaVersion: 'test-profile-policy/v1',
      tests: fixture.catalog.tests.map((test: any) => ({
        testPath: test.testPath,
        runner: test.runnerId,
        capabilityRefs: test.capabilityRefs || [],
        riskTier: 'low',
        profiles: ['nightly-full', 'pr-fast', 'release-full'],
        estimatedDurationMs: 1,
        owner: 'ci-governance',
        lastFullRunAt: null,
      })),
    };
    const quarantinedIdentity = 'vitest::tests/exact.test.ts';
    const selectionInput = {
      catalog: fixture.catalog,
      policy: fixture.policy,
      profilePolicy,
      prTestExclusions: prTestExclusions(['tests/exact.test.ts']),
    };
    const prSelection = selector().selectCiTests({
      ...selectionInput,
      impact: impact({
        changedTestIdentityKeys: [quarantinedIdentity],
        impactedTestIdentityKeys: [quarantinedIdentity],
      }),
      requestedProfile: 'pr-fast',
    });
    const prBaselineSelection = selector().selectCiTests({
      ...selectionInput,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });
    const nightlyFullSelection = selector().selectCiTests({
      ...selectionInput,
      impact: impact(),
      requestedProfile: 'nightly-full',
    });
    const releaseFullSelection = selector().selectCiTests({
      ...selectionInput,
      impact: impact(),
      requestedProfile: 'release-full',
    });

    expect(prSelection.selected.map((test: any) => test.identityKey)).toContain(
      quarantinedIdentity
    );
    expect(
      prSelection.selected.find((test: any) => test.identityKey === quarantinedIdentity)
    ).toMatchObject({
      expectedFailureReasonCode: 'KNOWN_FAILING_TEST_FIXTURE_DRIFT',
      reasonCodes: expect.arrayContaining(['PR_KNOWN_FAILURE_EXECUTION']),
    });
    expect(prBaselineSelection.selected.map((test: any) => test.identityKey)).not.toContain(
      quarantinedIdentity
    );
    expect(nightlyFullSelection.selected.map((test: any) => test.identityKey)).toContain(
      quarantinedIdentity
    );
    expect(
      nightlyFullSelection.selected.find((test: any) => test.identityKey === quarantinedIdentity)
    ).not.toHaveProperty('expectedFailureReasonCode');
    expect(releaseFullSelection.selected.map((test: any) => test.identityKey)).toContain(
      quarantinedIdentity
    );
    expect(
      releaseFullSelection.selected.find((test: any) => test.identityKey === quarantinedIdentity)
    ).not.toHaveProperty('expectedFailureReasonCode');
  });

  it('recomputes obligation coverage from a non-excluded candidate in the final PR selection', () => {
    const profilePolicy = {
      schemaVersion: 'test-profile-policy/v1',
      tests: fixture.catalog.tests.map((test: any) => ({
        testPath: test.testPath,
        runner: test.runnerId,
        capabilityRefs: test.capabilityRefs || [],
        riskTier: 'low',
        profiles:
          test.identityKey === 'vitest::tests/core.test.ts'
            ? ['nightly-full', 'pr-excluded', 'release-full']
            : ['nightly-full', 'pr-fast', 'release-full'],
        estimatedDurationMs: 1,
        owner: 'ci-governance',
        lastFullRunAt: null,
      })),
    };
    const obligationId = 'requirement_confirmation/state_entry';
    const coreFreeze = coreFreezeFor(fixture.catalog, fixture.policy, {
      candidateEvidence: [
        {
          identityKey: 'vitest::tests/core.test.ts',
          obligationEvidence: { [obligationId]: 'direct' },
          obligationOracleIndependence: { [obligationId]: 'independent' },
          oracleIndependence: 'independent',
        },
        {
          identityKey: 'vitest::tests/exact.test.ts',
          obligationEvidence: { [obligationId]: 'indirect' },
          obligationOracleIndependence: { [obligationId]: 'independent' },
          oracleIndependence: 'independent',
        },
      ],
    });
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      profilePolicy,
      coreFreeze,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selectionStatus).toBe('ready');
    expect(selection.blockingGapCount).toBe(0);
    expect(selection.uncoveredObligationIds).toEqual([]);
    expect(
      selection.selected.find((test: any) => test.identityKey === 'vitest::tests/exact.test.ts')
        .coveredObligationIds
    ).toEqual([obligationId]);
  });

  it('does not let a dependent fallback candidate recover an excluded obligation', () => {
    const profilePolicy = {
      schemaVersion: 'test-profile-policy/v1',
      tests: fixture.catalog.tests.map((test: any) => ({
        testPath: test.testPath,
        runner: test.runnerId,
        capabilityRefs: test.capabilityRefs || [],
        riskTier: 'low',
        profiles:
          test.identityKey === 'vitest::tests/core.test.ts'
            ? ['nightly-full', 'pr-excluded', 'release-full']
            : ['nightly-full', 'pr-fast', 'release-full'],
        estimatedDurationMs: 1,
        owner: 'ci-governance',
        lastFullRunAt: null,
      })),
    };
    const obligationId = 'requirement_confirmation/state_entry';
    const coreFreeze = coreFreezeFor(fixture.catalog, fixture.policy, {
      candidateEvidence: [
        {
          identityKey: 'vitest::tests/core.test.ts',
          obligationEvidence: { [obligationId]: 'direct' },
          obligationOracleIndependence: { [obligationId]: 'independent' },
          oracleIndependence: 'independent',
        },
        {
          identityKey: 'vitest::tests/exact.test.ts',
          obligationEvidence: { [obligationId]: 'indirect' },
          obligationOracleIndependence: { [obligationId]: 'dependent' },
          oracleIndependence: 'dependent',
        },
      ],
    });
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      profilePolicy,
      coreFreeze,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selectionStatus).toBe('blocked');
    expect(selection.blockingGapCount).toBe(1);
    expect(selection.uncoveredObligationIds).toEqual([obligationId]);
    expect(
      selection.selected.find((test: any) => test.identityKey === 'vitest::tests/exact.test.ts')
        .coveredObligationIds
    ).toEqual([]);
  });

  it('recomputes journey coverage after pr-exclusions remove the only selected provider', () => {
    const policy = structuredClone(fixture.policy);
    policy.semanticJourneys = [
      {
        journeyId: 'six-model-complete-record-closed',
        applicability: 'applicable',
        minimumEvidenceKind: 'direct',
      },
    ];
    const profilePolicy = {
      schemaVersion: 'test-profile-policy/v1',
      tests: fixture.catalog.tests.map((test: any) => ({
        testPath: test.testPath,
        runner: test.runnerId,
        capabilityRefs: test.capabilityRefs || [],
        riskTier: 'low',
        profiles:
          test.identityKey === 'vitest::tests/core.test.ts'
            ? ['nightly-full', 'pr-excluded', 'release-full']
            : ['nightly-full', 'pr-fast', 'release-full'],
        estimatedDurationMs: 1,
        owner: 'ci-governance',
        lastFullRunAt: null,
      })),
    };
    const atomicObligationId = 'requirement_confirmation/state_entry';
    const coreFreeze = coreFreezeFor(fixture.catalog, policy, {
      candidateEvidence: [
        {
          identityKey: 'vitest::tests/core.test.ts',
          obligationEvidence: { [atomicObligationId]: 'direct' },
          obligationOracleIndependence: { [atomicObligationId]: 'independent' },
          oracleIndependence: 'independent',
        },
        {
          identityKey: 'vitest::tests/exact.test.ts',
          obligationEvidence: { [atomicObligationId]: 'indirect' },
          obligationOracleIndependence: { [atomicObligationId]: 'independent' },
          oracleIndependence: 'independent',
        },
      ],
    });
    const atomicCoverage = coverageReportFor(fixture.catalog, coreFreeze, policy);
    const journeyObligationId = 'journey/six-model-complete-record-closed';
    const coverageReport = {
      ...atomicCoverage,
      obligations: [
        ...atomicCoverage.obligations,
        {
          obligationId: journeyObligationId,
          applicability: 'applicable',
          minimumEvidenceKind: 'direct',
          coverageStatus: 'covered',
          candidateTestIdentityRefs: ['vitest::tests/core.test.ts'],
          selectedTestIdentityRefs: ['vitest::tests/core.test.ts'],
          directEvidenceKind: 'direct',
          oracleIndependence: 'independent',
        },
      ],
      gates: {
        unmappedCriticalTransitionCount: 0,
      },
    };
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy,
      profilePolicy,
      coreFreeze,
      coverageReport,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });

    expect(selection.selectionStatus).toBe('blocked');
    expect(selection.blockingGapCount).toBe(1);
    expect(selection.uncoveredObligationIds).toEqual([journeyObligationId]);
  });

  it('binds recoverable explicit-exclusion obligations to non-excluded authority tests', () => {
    const policy = JSON.parse(
      readFileSync(join(process.cwd(), 'repo-governance/ci/test-policy.json'), 'utf8')
    );
    const profilePolicy = JSON.parse(
      readFileSync(join(process.cwd(), 'repo-governance/ci/test-profile-policy.json'), 'utf8')
    );
    const expectedBindings = {
      'tests/acceptance/requirements-contract-six-model-runtime-bridge-authority.test.ts': [
        'trace:six-model/audit-review/state-entry',
        'trace:six-model/delivery-confirmation/fail-closed',
        'trace:six-model/delivery-confirmation/state-entry',
        'trace:six-model/execution-closure/authority-rejection',
        'trace:six-model/execution-closure/state-entry',
        'trace:six-model/implementation-readiness/authority-rejection',
        'trace:six-model/implementation-readiness/state-entry',
        'trace:six-model/implementation-readiness/successful-promotion',
      ],
      'tests/acceptance/requirements-contract-six-model-receipt-projection-transaction.test.ts': [
        'trace:six-model/execution-closure/evidence-binding',
        'trace:six-model/implementation-readiness/evidence-binding',
      ],
      'tests/unit/main-agent-implementation-readiness-gate.test.ts': [
        'trace:six-model/implementation-readiness/fail-closed',
      ],
    };

    for (const [testPath, evidenceRefs] of Object.entries(expectedBindings)) {
      expect(
        profilePolicy.tests.find((record: any) => record.testPath === testPath).profiles
      ).toEqual(['nightly-full', 'pr-fast', 'release-full']);
      expect(
        policy.semanticEvidenceBindings
          .find((record: any) => record.testPath === testPath)
          ?.bindings.map((binding: any) => binding.evidenceRef)
      ).toEqual(expect.arrayContaining(evidenceRefs));
      for (const evidenceRef of evidenceRefs) {
        expect(
          policy.semanticEvidenceBindings
            .filter((record: any) =>
              record.bindings.some((binding: any) => binding.evidenceRef === evidenceRef)
            )
            .map((record: any) => record.testPath)
        ).toEqual([testPath]);
      }
    }
  });

  it('writes canonical selection only below the governed artifact root', () => {
    const root = mkdtempSync(join(tmpdir(), 'ci-selection-'));
    temporaryRoots.push(root);
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ featureRefs: ['feature:portfolio'] }),
      requestedProfile: 'pr-fast',
    });

    const receipt = selector().writeSelection({
      repoRoot: root,
      outputDir: '.artifacts/test-portfolio',
      selection,
    });
    expect(receipt).toMatchObject({
      selectedCount: selection.selected.length,
      profile: 'pr-fast',
      expansionLevel: 'feature',
    });
    expect(readFileSync(receipt.path, 'utf8')).toMatch(/"schemaVersion":"test-selection\/v1"/u);

    expect(() =>
      selector().writeSelection({
        repoRoot: root,
        outputDir: '../outside',
        selection,
      })
    ).toThrow('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
  });

  it('rejects non-canonical selected, reason, and escalation arrays before hashing', () => {
    const root = mkdtempSync(join(tmpdir(), 'ci-selection-canonical-'));
    temporaryRoots.push(root);
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        changedTestIdentityKeys: ['vitest::tests/exact.test.ts'],
        traceRefs: ['trace:selector'],
        capabilityRefs: ['capability:selector'],
      }),
      requestedProfile: 'pr-fast',
    });

    const selectedOutOfOrder = structuredClone(selection);
    selectedOutOfOrder.selected.reverse();
    expect(() => selector().validateSelection(selectedOutOfOrder)).toThrow(
      'CI_SELECTION_SELECTED_ORDER_INVALID'
    );
    expect(() =>
      selector().writeSelection({
        repoRoot: root,
        outputDir: '.artifacts/test-portfolio',
        selection: selectedOutOfOrder,
      })
    ).toThrow('CI_SELECTION_SELECTED_ORDER_INVALID');

    const duplicateReasons = structuredClone(selection);
    duplicateReasons.selected[0].reasonCodes.push(duplicateReasons.selected[0].reasonCodes[0]);
    expect(() => selector().validateSelection(duplicateReasons)).toThrow(
      'CI_SELECTION_REASON_CODES_INVALID'
    );

    const reasonsOutOfOrder = structuredClone(selection);
    reasonsOutOfOrder.selected[1].reasonCodes = ['TRACE_CAPABILITY_IMPACT', 'CHANGED_TEST'];
    expect(() => selector().validateSelection(reasonsOutOfOrder)).toThrow(
      'CI_SELECTION_REASON_CODES_INVALID'
    );

    const escalationOutOfOrder = structuredClone(selection);
    escalationOutOfOrder.escalationReasonCodes = ['RELEASE_SURFACE_PATH', 'HIGH_DIFFUSION_PATH'];
    expect(() => selector().validateSelection(escalationOutOfOrder)).toThrow(
      'CI_SELECTION_ESCALATION_REASON_CODES_INVALID'
    );
  });

  it.each([
    ['drive-relative', 'C:repo/tests/core.test.ts', 'C:repo/tests/core.test.ts'],
    ['trimmed drive-absolute', ' C:\\repo\\tests\\core.test.ts', 'C:/repo/tests/core.test.ts'],
    ['normalized drive-relative', './C:repo/tests/core.test.ts', 'C:repo/tests/core.test.ts'],
    ['normalized drive-absolute', './C:/repo/tests/core.test.ts', 'C:/repo/tests/core.test.ts'],
  ])('rejects %s selected paths with canonical identities', (_label, testPath, identityPath) => {
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact(),
      requestedProfile: 'pr-fast',
    });
    selection.selected[0].testPath = testPath;
    selection.selected[0].identityKey = `vitest::${identityPath}`;

    expect(() => selector().validateSelection(selection)).toThrow('CI_SELECTION_PATH_INVALID');
  });

  it('produces the same selection hash when only object key insertion order changes', () => {
    const firstRoot = mkdtempSync(join(tmpdir(), 'ci-selection-hash-first-'));
    const secondRoot = mkdtempSync(join(tmpdir(), 'ci-selection-hash-second-'));
    temporaryRoots.push(firstRoot, secondRoot);
    const selection = selector().selectCiTests({
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({ featureRefs: ['feature:portfolio'] }),
      requestedProfile: 'pr-fast',
    });
    const reorderedObject = {
      gates: selection.gates,
      selected: selection.selected,
      coverageReportHash: selection.coverageReportHash,
      uncoveredObligationIds: selection.uncoveredObligationIds,
      blockingGapCount: selection.blockingGapCount,
      selectionStatus: selection.selectionStatus,
      expansionLevel: selection.expansionLevel,
      escalationReasonCodes: selection.escalationReasonCodes,
      requestedProfile: selection.requestedProfile,
      profile: selection.profile,
      schemaVersion: selection.schemaVersion,
    };

    const first = selector().writeSelection({
      repoRoot: firstRoot,
      outputDir: '.artifacts/test-portfolio',
      selection,
    });
    const second = selector().writeSelection({
      repoRoot: secondRoot,
      outputDir: '.artifacts/test-portfolio',
      selection: reorderedObject,
    });

    expect(first.sha256).toBe(second.sha256);
  });

  it('keeps selection semantics stable while binding the exact Catalog artifact', () => {
    const input = {
      catalog: fixture.catalog,
      policy: fixture.policy,
      impact: impact({
        traceRefs: ['trace:selector'],
        capabilityRefs: ['capability:selector'],
      }),
      requestedProfile: 'pr-fast',
    };
    const first = selector().selectCiTests(input);
    const second = selector().selectCiTests({
      ...input,
      catalog: { ...fixture.catalog, tests: [...fixture.catalog.tests].reverse() },
      impact: {
        ...(input.impact as Record<string, unknown>),
        traceRefs: [...((input.impact as any).traceRefs || [])].reverse(),
        capabilityRefs: [...((input.impact as any).capabilityRefs || [])].reverse(),
      },
    });

    const { coverageReportHash: firstCoverageReportHash, ...firstSemantics } = first;
    const { coverageReportHash: secondCoverageReportHash, ...secondSemantics } = second;
    expect(canonicalJsonBytes(firstSemantics)).toEqual(canonicalJsonBytes(secondSemantics));
    expect(firstCoverageReportHash).not.toBe(secondCoverageReportHash);
  });
});
