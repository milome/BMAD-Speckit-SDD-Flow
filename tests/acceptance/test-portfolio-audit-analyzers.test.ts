import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ORACLE_FIXTURE,
  TARGET_FIXTURE,
  analyzerInput,
  executionRoute,
  testIdentity,
  type ExecutionRoute,
} from '../fixtures/test-portfolio-audit/test-helpers';

const require = createRequire(import.meta.url);
const duplicate = require('../../tools/test-portfolio-audit/analyzers/duplicate.cjs');
const loadTargetValidity = () =>
  require('../../tools/test-portfolio-audit/analyzers/target-validity.cjs');
const loadOracleEffectiveness = () =>
  require('../../tools/test-portfolio-audit/analyzers/oracle-effectiveness.cjs');
const ROUTE_FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/routes');
const SHARED_IDENTITY = 'root-vitest::tests/shared.test.ts';

type RouteInvocation = {
  jobId: string;
  runnerId: string;
  delegatedFrom?: string;
};

describe('test portfolio analyzers', () => {
  it('marks repeated execution once inside one effective validation purpose', async () => {
    const result = await duplicate.analyze(
      analyzerInput({
        tests: [testIdentity(SHARED_IDENTITY)],
        routes: [
          executionRoute('route:pr/explicit', SHARED_IDENTITY, {
            sourceRef: 'workflow:pr#explicit',
          }),
          executionRoute('route:nightly/broad', SHARED_IDENTITY, {
            effectiveProfileId: 'schedule:test:ubuntu:nightly',
            purpose: 'nightly_validation',
            sourceRef: 'workflow:nightly#broad',
          }),
          executionRoute('route:pr/broad', SHARED_IDENTITY, {
            sourceRef: 'workflow:pr#broad',
          }),
        ],
        timings: { [SHARED_IDENTITY]: 1200 },
      })
    );

    expect(duplicate.routeGroupKey(executionRoute('route:pr/broad', SHARED_IDENTITY))).toBe(
      [
        SHARED_IDENTITY,
        'pull_request:test:ubuntu:required',
        'ubuntu',
        'required_pr_validation',
      ].join('\0')
    );
    expect(result).toMatchObject({
      analyzerId: 'duplicate-execution',
      analyzerVersion: '1',
      dimension: 'executionMultiplicity',
      required: true,
      status: 'complete',
      issues: [],
    });
    expect(result.findings).toEqual([
      {
        identityKey: SHARED_IDENTITY,
        value: 'duplicate',
        confidence: 'high',
        executionRouteRefs: ['route:pr/broad', 'route:pr/explicit'],
        evidenceRefs: ['workflow:pr#broad', 'workflow:pr#explicit'],
        issueCodes: ['DUPLICATE_EFFECTIVE_EXECUTION'],
        removableDurationMs: 1200,
      },
    ]);
  });

  it('keeps similar filenames single without repeated route evidence', async () => {
    const identities = ['root-vitest::tests/a.test.ts', 'root-vitest::tests/a-copy.test.ts'];
    const result = await duplicate.analyze(
      analyzerInput({
        tests: identities.map(testIdentity),
        routes: [],
      })
    );

    expect(result.findings).toEqual(
      identities
        .sort((left, right) => left.localeCompare(right, 'en'))
        .map((identityKey) => ({
          identityKey,
          value: 'single',
          confidence: 'high',
          executionRouteRefs: [],
          evidenceRefs: [],
          issueCodes: [],
        }))
    );
  });

  it('deduplicates repeated route refs before classifying execution', async () => {
    const route = executionRoute('route:pr/broad', SHARED_IDENTITY, {
      sourceRef: 'workflow:pr#broad',
    });
    const result = await duplicate.analyze(
      analyzerInput({
        tests: [testIdentity(SHARED_IDENTITY)],
        routes: [route, { ...route }],
      })
    );

    expect(result.findings).toEqual([
      {
        identityKey: SHARED_IDENTITY,
        value: 'single',
        confidence: 'high',
        executionRouteRefs: ['route:pr/broad'],
        evidenceRefs: ['workflow:pr#broad'],
        issueCodes: [],
      },
    ]);
  });

  it('marks route context incomplete instead of merging missing context', async () => {
    for (const field of ['effectiveProfileId', 'environmentId', 'purpose'] as const) {
      const routes = ['broad', 'explicit'].map((name) =>
        executionRoute(`route:pr/${name}`, SHARED_IDENTITY, {
          [field]: undefined,
          sourceRef: `workflow:pr#${name}`,
        })
      );
      const result = await duplicate.analyze(
        analyzerInput({
          tests: [testIdentity(SHARED_IDENTITY)],
          routes,
        })
      );

      expect(result.findings).toEqual([
        expect.objectContaining({
          identityKey: SHARED_IDENTITY,
          value: 'unknown',
          confidence: 'low',
          executionRouteRefs: ['route:pr/broad', 'route:pr/explicit'],
          evidenceRefs: ['workflow:pr#broad', 'workflow:pr#explicit'],
          issueCodes: ['DUPLICATE_ROUTE_CONTEXT_INCOMPLETE'],
        }),
      ]);
    }
  });

  it('does not collapse distinct platform environments', async () => {
    const result = await duplicate.analyze(
      analyzerInput({
        tests: [testIdentity('root-vitest::tests/platform.test.ts')],
        routes: ['ubuntu', 'windows'].map((environmentId) =>
          executionRoute(`route:pr/${environmentId}`, 'root-vitest::tests/platform.test.ts', {
            effectiveProfileId: `pull_request:test:${environmentId}:compat`,
            environmentId,
            purpose: 'platform_compatibility',
          })
        ),
      })
    );

    expect(result.findings[0]).toMatchObject({
      value: 'single',
      executionRouteRefs: ['route:pr/ubuntu', 'route:pr/windows'],
    });
  });

  it('counts delegated and direct runner routes only when both execute', async () => {
    const { buildExecutionRouteGraph } = require('../../tools/test-portfolio-audit/routes.cjs');
    const graph = buildExecutionRouteGraph({
      repoRoot: ROUTE_FIXTURE,
      inventory: [{ testPath: 'tests/shared.test.ts', runnerId: 'root-vitest' }],
    });
    const wrapperOnlyInvocations = (graph.invocations as RouteInvocation[]).filter(
      (invocation) => invocation.jobId === 'delegated' && invocation.runnerId === 'root-vitest'
    );
    const directAndDelegatedInvocations = (graph.invocations as RouteInvocation[]).filter(
      (invocation) =>
        invocation.jobId === 'delegated-and-direct' && invocation.runnerId === 'root-vitest'
    );
    const wrapperOnlyRoutes = (graph.routes as (ExecutionRoute & { jobId: string })[]).filter(
      (route) =>
        route.identityKey === 'root-vitest#tests/shared.test.ts' && route.jobId === 'delegated'
    );
    const directAndDelegatedRoutes = (
      graph.routes as (ExecutionRoute & { jobId: string })[]
    ).filter(
      (route) =>
        route.identityKey === 'root-vitest#tests/shared.test.ts' &&
        route.jobId === 'delegated-and-direct'
    );

    expect(wrapperOnlyInvocations).toEqual([
      expect.objectContaining({
        delegatedFrom: 'source:tools/run-root-tests.cjs',
      }),
    ]);
    expect(directAndDelegatedInvocations).toHaveLength(2);
    expect(
      directAndDelegatedInvocations.filter(
        (invocation) => invocation.delegatedFrom === 'source:tools/run-root-tests.cjs'
      )
    ).toHaveLength(1);
    expect(wrapperOnlyRoutes).toHaveLength(1);
    expect(directAndDelegatedRoutes).toHaveLength(2);

    const wrapperOnly = await duplicate.analyze(
      analyzerInput({
        tests: [testIdentity('root-vitest#tests/shared.test.ts')],
        routes: wrapperOnlyRoutes,
      })
    );
    const directAndDelegated = await duplicate.analyze(
      analyzerInput({
        tests: [testIdentity('root-vitest#tests/shared.test.ts')],
        routes: directAndDelegatedRoutes,
      })
    );

    expect(wrapperOnly.findings[0]).toMatchObject({
      value: 'single',
      executionRouteRefs: [wrapperOnlyRoutes[0].routeId],
    });
    expect(directAndDelegated.findings[0]).toMatchObject({
      value: 'duplicate',
      executionRouteRefs: directAndDelegatedRoutes.map((route) => route.routeId).sort(),
    });
  });
});

describe('target validity analyzer', () => {
  it('classifies target validity only with direct reachability and protection evidence', async () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json'],
    });

    expect([...sourceIndex.nodes.keys()]).toEqual(
      [...sourceIndex.nodes.keys()].sort((left, right) => left.localeCompare(right, 'en'))
    );
    expect(sourceIndex.packageExports.get('src/exported.ts')).toEqual([
      'source:package.json#exports:./exported',
    ]);
    expect(sourceIndex.packageBins.get('src/cli.ts')).toEqual([
      'source:package.json#bin:target-validity-cli',
    ]);
    expect(sourceIndex.productionEdges).toEqual(
      expect.arrayContaining([
        {
          from: 'src/entry.ts',
          to: 'src/production-imported.ts',
          evidenceRef: 'source:src/entry.ts#import:./production-imported',
        },
      ])
    );
    expect(sourceIndex.protectedBindings).toEqual(
      expect.arrayContaining([
        {
          targetPath: 'src/protected.ts',
          evidenceRef: 'compatibility:protected-api',
        },
      ])
    );
    expect(sourceIndex.dynamicUncertainty).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetPath: 'src/dynamic-registry.ts',
          issueCode: 'TARGET_DYNAMIC_REGISTRATION_UNRESOLVED',
        }),
      ])
    );

    const inventory = {
      tests: [
        testIdentity('root-vitest::tests/targets.test.ts', {
          testPath: 'tests/targets.test.ts',
        }),
        testIdentity('root-vitest::tests/broken.test.ts', {
          testPath: 'tests/broken.test.ts',
        }),
      ],
    };
    const result = await targetValidity.analyze({
      repoRoot: TARGET_FIXTURE,
      inventory,
      routeGraph: { routes: [] },
      sourceIndex,
    });

    expect(result).toMatchObject({
      analyzerId: 'target-validity',
      analyzerVersion: '1',
      dimension: 'targetValidity',
      required: true,
      status: 'complete',
      issues: [],
    });
    expect(
      new Set(result.findings.map((finding: { identityKey: string }) => finding.identityKey))
    ).toEqual(new Set(inventory.tests.map((test) => test.identityKey)));

    const targetFindings = result.findings.filter(
      (finding: { identityKey: string }) =>
        finding.identityKey === 'root-vitest::tests/targets.test.ts'
    );
    const byTarget = new Map(
      targetFindings.map((finding: { targetRef: string }) => [finding.targetRef, finding])
    );

    expect(byTarget.get('src/unused.ts')).toEqual({
      identityKey: 'root-vitest::tests/targets.test.ts',
      targetRef: 'src/unused.ts',
      value: 'obsolete_candidate',
      confidence: 'high',
      evidenceRefs: [
        'source:package.json#not-bin',
        'source:package.json#not-exported',
        'source:src/unused.ts#no-production-inbound',
        'source:src/unused.ts#no-protection',
      ],
      issueCodes: ['PRODUCT_TARGET_OBSOLETE_CANDIDATE'],
    });
    expect(byTarget.get('src/exported.ts')).toMatchObject({
      value: 'active',
      confidence: 'high',
      issueCodes: [],
    });
    expect(byTarget.get('src/cli.ts')).toMatchObject({
      value: 'active',
      confidence: 'high',
      issueCodes: [],
    });
    expect(byTarget.get('src/production-imported.ts')).toMatchObject({
      value: 'active',
      confidence: 'high',
      issueCodes: [],
    });
    expect(byTarget.get('src/protected.ts')).toMatchObject({
      value: 'active',
      confidence: 'high',
      issueCodes: [],
    });
    expect(byTarget.get('src/dynamic-registry.ts')).toMatchObject({
      value: 'ambiguous',
      confidence: 'low',
      issueCodes: ['TARGET_DYNAMIC_REGISTRATION_UNRESOLVED'],
    });
    expect(byTarget.get('src/generated-ownerless.ts')).toMatchObject({
      value: 'ambiguous',
      confidence: 'low',
      issueCodes: ['TARGET_GENERATED_OWNER_UNRESOLVED'],
    });
    expect(byTarget.get('src/conditional-target.ts')).toMatchObject({
      value: 'ambiguous',
      confidence: 'low',
      issueCodes: ['TARGET_PACKAGE_EXPORT_UNRESOLVED'],
    });
    expect(byTarget.get('src/protected-unbound.ts')).toMatchObject({
      value: 'ambiguous',
      confidence: 'low',
      issueCodes: ['TARGET_PROTECTION_BINDING_UNRESOLVED'],
    });
    expect(
      result.findings.find(
        (finding: { identityKey: string }) =>
          finding.identityKey === 'root-vitest::tests/broken.test.ts'
      )
    ).toMatchObject({
      value: 'ambiguous',
      confidence: 'low',
      issueCodes: ['TARGET_TEST_PARSE_ERROR'],
    });

    const repeated = await targetValidity.analyze({
      repoRoot: TARGET_FIXTURE,
      inventory,
      routeGraph: { routes: [] },
      sourceIndex,
    });
    expect(repeated).toEqual(result);
    for (const finding of result.findings) {
      expect(finding.evidenceRefs).toEqual([...new Set(finding.evidenceRefs)].sort());
      expect(finding.issueCodes).toEqual([...new Set(finding.issueCodes)].sort());
    }
  });
});

describe('oracle effectiveness analyzer', () => {
  it('detects oracle tautology as ineffective', async () => {
    const oracle = loadOracleEffectiveness();
    const finding = await oracle.analyzeTestFile({
      repoRoot: ORACLE_FIXTURE,
      testPath: 'tautology.test.ts',
    });

    expect(finding).toMatchObject({
      value: 'ineffective_candidate',
      issueCodes: ['ORACLE_TAUTOLOGY'],
    });
  });

  it.each([
    ['self-generated.test.ts', 'ORACLE_SELF_GENERATED_EXPECTED'],
    ['hidden-skip.test.ts', 'ORACLE_SKIP_AS_PASS'],
  ])('detects ineffective oracle provenance in %s', async (testPath, issueCode) => {
    const oracle = loadOracleEffectiveness();
    const finding = await oracle.analyzeTestFile({
      repoRoot: ORACLE_FIXTURE,
      testPath,
    });

    expect(finding).toMatchObject({
      value: 'ineffective_candidate',
      issueCodes: [issueCode],
    });
  });

  it('preserves source-only assertions as structural contracts', async () => {
    const oracle = loadOracleEffectiveness();
    const finding = await oracle.analyzeTestFile({
      repoRoot: ORACLE_FIXTURE,
      testPath: 'source-structural.test.ts',
    });

    expect(finding).toMatchObject({
      value: 'effective',
      evidenceRole: 'structural_contract',
      issueCodes: [],
    });
    expect(finding.claimedRoles).not.toContain('process_e2e');
  });

  it.each([
    ['negative-fixture.test.ts', 'behavioral'],
    ['process-boundary.test.ts', 'process_boundary'],
  ])('accepts independent oracle evidence in %s', async (testPath, evidenceRole) => {
    const oracle = loadOracleEffectiveness();
    const finding = await oracle.analyzeTestFile({
      repoRoot: ORACLE_FIXTURE,
      testPath,
    });

    expect(finding).toMatchObject({
      value: 'effective',
      evidenceRole,
      issueCodes: [],
    });
  });

  it('rejects exit-code-only behavior claims', async () => {
    const oracle = loadOracleEffectiveness();
    const finding = await oracle.analyzeTestFile({
      repoRoot: ORACLE_FIXTURE,
      testPath: 'exit-code-only.test.ts',
    });

    expect(finding).toMatchObject({
      value: 'ineffective_candidate',
      issueCodes: ['ORACLE_EXIT_CODE_ONLY'],
    });
  });

  it('reports source assertion role overclaim without discarding structural evidence', async () => {
    const oracle = loadOracleEffectiveness();
    const finding = await oracle.analyzeTestFile({
      repoRoot: ORACLE_FIXTURE,
      testPath: 'source-role-overclaim.test.ts',
    });

    expect(finding).toMatchObject({
      value: 'effective',
      evidenceRole: 'structural_contract',
      issueCodes: ['ORACLE_ROLE_OVERCLAIM'],
    });
    expect(finding.claimedRoles).toEqual(
      expect.arrayContaining(['behavioral', 'integration', 'process_e2e'])
    );
  });

  it('keeps batch findings complete and deterministic across per-test parse errors', async () => {
    const oracle = loadOracleEffectiveness();
    const tests = [
      'tautology.test.ts',
      'source-structural.test.ts',
      'self-generated.test.ts',
      'hidden-skip.test.ts',
      'negative-fixture.test.ts',
      'process-boundary.test.ts',
      'exit-code-only.test.ts',
      'source-role-overclaim.test.ts',
      'parse-error.test.ts',
    ].map((testPath) =>
      testIdentity(`root-vitest::${testPath}`, {
        testPath,
      })
    );
    const input = {
      repoRoot: ORACLE_FIXTURE,
      inventory: { tests },
      routeGraph: { routes: [] },
    };

    const result = await oracle.analyze(input);
    expect(result).toMatchObject({
      analyzerId: 'oracle-effectiveness',
      analyzerVersion: '1',
      dimension: 'oracleEffectiveness',
      required: true,
      status: 'complete',
      issues: [],
    });
    expect(result.findings).toHaveLength(tests.length);
    expect(result.findings.map((finding: { identityKey: string }) => finding.identityKey)).toEqual(
      tests.map((test) => test.identityKey).sort((left, right) => left.localeCompare(right, 'en'))
    );
    expect(
      result.findings.find(
        (finding: { identityKey: string }) =>
          finding.identityKey === 'root-vitest::parse-error.test.ts'
      )
    ).toMatchObject({
      value: 'ambiguous',
      confidence: 'low',
      issueCodes: ['ORACLE_TEST_PARSE_ERROR'],
    });
    expect(await oracle.analyze(input)).toEqual(result);
    for (const finding of result.findings) {
      expect(finding.evidenceRefs).toEqual([...new Set(finding.evidenceRefs)].sort());
      expect(finding.issueCodes).toEqual([...new Set(finding.issueCodes)].sort());
    }
  });

  it('keeps target validity and oracle effectiveness orthogonal for one test identity', async () => {
    const targetValidity = loadTargetValidity();
    const oracle = loadOracleEffectiveness();
    const test = testIdentity('root-vitest::tests/targets.test.ts', {
      testPath: 'tests/targets.test.ts',
    });
    const inventory = { tests: [test] };
    const targetResult = await targetValidity.analyze({
      repoRoot: TARGET_FIXTURE,
      inventory,
      routeGraph: { routes: [] },
      sourceIndex: targetValidity.buildSourceIndex({
        repoRoot: TARGET_FIXTURE,
        packagePaths: ['package.json'],
      }),
    });
    const oracleResult = await oracle.analyze({
      repoRoot: TARGET_FIXTURE,
      inventory,
      routeGraph: { routes: [] },
    });

    expect(targetResult.dimension).toBe('targetValidity');
    expect(oracleResult.dimension).toBe('oracleEffectiveness');
    expect(
      targetResult.findings.every(
        (finding: { identityKey: string; targetRef?: string }) =>
          finding.identityKey === test.identityKey && typeof finding.targetRef === 'string'
      )
    ).toBe(true);
    expect(oracleResult.findings).toEqual([
      expect.objectContaining({
        identityKey: test.identityKey,
        value: 'ambiguous',
        issueCodes: ['ORACLE_INDEPENDENCE_UNPROVEN'],
      }),
    ]);
    expect(oracleResult.findings[0]).not.toHaveProperty('targetRef');
  });
});
