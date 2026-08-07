import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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
const { reduceAudit } = require('../../tools/test-portfolio-audit/audit.cjs');
const duplicate = require('../../tools/test-portfolio-audit/analyzers/duplicate.cjs');
const loadTargetValidity = () =>
  require('../../tools/test-portfolio-audit/analyzers/target-validity.cjs');
const loadOracleEffectiveness = () =>
  require('../../tools/test-portfolio-audit/analyzers/oracle-effectiveness.cjs');
const loadParallelSafety = () =>
  require('../../tools/test-portfolio-audit/analyzers/parallel-safety.cjs');
const loadCriticality = () => require('../../tools/test-portfolio-audit/analyzers/criticality.cjs');
const ROUTE_FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/routes');
const PARALLEL_FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/parallel-safety');
const CRITICALITY_FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/criticality');
const CRITICALITY_INVALID_AUTHORITY_FIXTURE = join(
  process.cwd(),
  'tests/fixtures/test-portfolio-audit/criticality-invalid-authority'
);
const SHARED_IDENTITY = 'root-vitest::tests/shared.test.ts';
const REDUCER_CONTRACT_IDENTITY = 'root-vitest::tests/package-install.test.ts';

type ReducerDimension =
  | 'executionMultiplicity'
  | 'targetValidity'
  | 'oracleEffectiveness'
  | 'parallelSafety'
  | 'criticality';

function reducerFinding(
  value: string,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    identityKey: REDUCER_CONTRACT_IDENTITY,
    value,
    confidence: 'high',
    evidenceRefs: ['source:tests/package-install.test.ts#L1'],
    issueCodes: [],
    ...extras,
  };
}

function reducerAnalyzerResult(
  dimension: ReducerDimension,
  findings: Array<Record<string, unknown>>,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  const analyzerIds: Record<ReducerDimension, string> = {
    executionMultiplicity: 'duplicate-execution',
    targetValidity: 'target-validity',
    oracleEffectiveness: 'oracle-effectiveness',
    parallelSafety: 'parallel-safety',
    criticality: 'criticality',
  };
  return {
    analyzerId: analyzerIds[dimension],
    analyzerVersion: '1',
    dimension,
    required: true,
    status: 'complete',
    findings,
    issues: [],
    ...extras,
  };
}

function reducerInput(
  analyzerResults: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    repository: { commit: 'fixture-commit', dirty: false },
    tool: { version: 'test-portfolio-audit/1', runnerVersions: [] },
    inventory: {
      tests: [
        {
          identityKey: REDUCER_CONTRACT_IDENTITY,
          testPath: 'tests/package-install.test.ts',
          runnerId: 'root-vitest',
          executionRouteRefs: ['route:ci/test-a', 'route:ci/test-b'],
        },
      ],
    },
    discovery: {
      complete: true,
      runnerResolvedCount: 1,
      candidateCount: 1,
      unexplainedRunnerOnlyCount: 0,
      unexplainedCandidateOnlyCount: 0,
    },
    routeGraph: { failed: false },
    analyzerResults,
    probeResults: {
      requested: 0,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      unprobed: 0,
      budgetExhausted: false,
      results: [],
    },
    timings: { [REDUCER_CONTRACT_IDENTITY]: 500 },
    issues: [],
    fatalIssues: [],
    ...overrides,
  };
}

function completeReducerResults(
  replacements: Partial<Record<ReducerDimension, Record<string, unknown>>> = {}
): Array<Record<string, unknown>> {
  const defaults: Record<ReducerDimension, Record<string, unknown>> = {
    executionMultiplicity: reducerAnalyzerResult('executionMultiplicity', [
      reducerFinding('duplicate', {
        executionRouteRefs: ['route:ci/test-b', 'route:ci/test-a'],
        removableDurationMs: 500,
      }),
    ]),
    targetValidity: reducerAnalyzerResult('targetValidity', [reducerFinding('active')]),
    oracleEffectiveness: reducerAnalyzerResult('oracleEffectiveness', [
      reducerFinding('ineffective_candidate'),
    ]),
    parallelSafety: reducerAnalyzerResult('parallelSafety', [reducerFinding('unsafe')]),
    criticality: reducerAnalyzerResult('criticality', [reducerFinding('critical')]),
  };
  return (Object.keys(defaults) as ReducerDimension[]).map(
    (dimension) => replacements[dimension] || defaults[dimension]
  );
}

type CriticalityBindingKind =
  | 'package_install'
  | 'packaged_runtime'
  | 'cli_bin'
  | 'main_agent_core'
  | 'release_path'
  | 'consumer_compatibility'
  | 'security_encoding_persistence'
  | 'protected_acceptance_or_proof'
  | 'active_regression_binding';

type CriticalityBinding = {
  kind: CriticalityBindingKind;
  evidenceRef: string;
};

function criticalitySourceIndex() {
  return {
    packageInstallBindings: new Map<string, CriticalityBinding[]>([
      [
        'tests/package-install.test.ts',
        [
          {
            kind: 'package_install',
            evidenceRef: 'source:package.json#testPortfolioAudit:packageInstallTests',
          },
        ],
      ],
    ]),
    packagedRuntimeBindings: new Map<string, CriticalityBinding[]>([
      [
        'tests/packaged-runtime.test.ts',
        [
          {
            kind: 'packaged_runtime',
            evidenceRef: 'source:package.json#main',
          },
        ],
      ],
    ]),
    cliBinBindings: new Map<string, CriticalityBinding[]>([
      [
        'tests/cli-bin.test.ts',
        [
          {
            kind: 'cli_bin',
            evidenceRef: 'source:package.json#bin:test-portfolio-fixture',
          },
        ],
      ],
    ]),
  };
}

function criticalityRouteGraph() {
  return {
    routes: [
      {
        routeId: 'route:release/evidence',
        identityKey: 'root-vitest::tests/release-evidence.test.ts',
        testPath: 'tests/release-evidence.test.ts',
        purpose: 'release_validation',
        sourceRef: 'workflow:.github/workflows/release.yml#job:release',
        selectionKind: 'explicit',
      },
      {
        routeId: 'route:compatibility/host-matrix',
        identityKey: 'root-vitest::tests/host-matrix.test.ts',
        testPath: 'tests/host-matrix.test.ts',
        purpose: 'extended_host_matrix',
        sourceRef: 'workflow:.github/workflows/release.yml#job:host-matrix',
      },
    ],
  };
}

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
    expect(
      targetValidity.resolveGeneratedSourceTarget(
        'tests/generated-runtime.test.ts',
        '../dist/runtime/render',
        new Map([['src/runtime/render.ts', {}]])
      )
    ).toBe('src/runtime/render.ts');
    expect(
      targetValidity.resolveTargetCandidate(
        'src/script-entry.ts',
        { path: 'nested/example.test.ts', packageDirectory: 'nested' },
        {
          repoRoot: TARGET_FIXTURE,
          nodes: new Map([['src/script-entry.ts', {}]]),
        }
      )
    ).toBe('src/script-entry.ts');
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
    expect([...sourceIndex.generatorOwners].sort()).toEqual([
      'src/generated-active.ts',
      'src/generated-retired.ts',
      'src/generated-unconsumed.ts',
    ]);
    expect(sourceIndex.scriptBindings.get('src/script-entry.ts')).toEqual([
      'source:package.json#scripts.fixture:script',
    ]);
    expect(sourceIndex.scriptBindings.get('src/array-target.ts')).toEqual([
      'source:package.json#scripts.fixture:array',
    ]);
    expect(sourceIndex.scriptBindings.get('scripts/setup.ps1')).toEqual([
      'source:package.json#scripts.fixture:powershell',
    ]);
    expect(sourceIndex.scriptBindings.get('scripts/setup.sh')).toEqual([
      'source:package.json#scripts.fixture:shell',
    ]);
    expect(sourceIndex.workflowBindings.get('src/workflow-entry.ts')).toEqual([
      'source:.github/workflows/target-validity.yml#jobs.fixture.steps[0].run',
    ]);
    expect(sourceIndex.workflowBindings.get('.github/workflows/target-validity.yml')).toEqual([
      'source:.github/workflows/target-validity.yml#workflow-definition',
    ]);
    expect(sourceIndex.registryBindings.get('src/registry-active.ts')).toEqual([
      'source:_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json#consumers[0].path',
      'source:_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json#discovery.declaredPaths[0]',
      'source:_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json#discovery.discoveredPaths[0]',
    ]);
    expect(
      sourceIndex.registryBindings.get(
        '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json'
      )
    ).toEqual([
      'source:_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json#schemaVersion',
    ]);
    expect(sourceIndex.generatedBindings.get('src/generated-active.ts')).toEqual([
      'source:package.json#testPortfolioAudit.generatorBindings[0]',
    ]);
    expect(sourceIndex.generatedBindings.has('src/generated-unconsumed.ts')).toBe(false);
    expect(sourceIndex.generatedBindingRecords).toEqual([
      {
        ownerPath: 'src/generator-source.ts',
        outputPath: 'src/generated-active.ts',
        consumerPath: 'src/generated-consumer.ts',
        evidenceRef: 'source:package.json#testPortfolioAudit.generatorBindings[0]',
      },
    ]);
    expect(sourceIndex.generatedUncertainty).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetPath: 'src/generated-unconsumed.ts',
          issueCode: 'TARGET_GENERATED_BINDING_UNRESOLVED',
          evidenceRef: 'source:package.json#testPortfolioAudit.generatorBindings[1]',
        }),
      ])
    );
    expect(sourceIndex.nodes.get('src/generator-source.ts')).toMatchObject({
      isGenerated: false,
    });
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
        testIdentity('root-vitest::tests/bindings.test.ts', {
          testPath: 'tests/bindings.test.ts',
        }),
        testIdentity('root-vitest::tests/advanced-bindings.test.ts', {
          testPath: 'tests/advanced-bindings.test.ts',
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
    expect(byTarget.get('src/generated-retired.ts')).toEqual({
      identityKey: 'root-vitest::tests/targets.test.ts',
      targetRef: 'src/generated-retired.ts',
      value: 'obsolete_candidate',
      confidence: 'high',
      evidenceRefs: [
        'source:package.json#not-bin',
        'source:package.json#not-exported',
        'source:src/generated-retired.ts#no-production-inbound',
        'source:src/generated-retired.ts#no-protection',
      ],
      issueCodes: ['PRODUCT_TARGET_OBSOLETE_CANDIDATE'],
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

    const bindingFindings = result.findings.filter(
      (finding: { identityKey: string }) =>
        finding.identityKey === 'root-vitest::tests/bindings.test.ts'
    );
    expect(bindingFindings.map((finding: { targetRef: string }) => finding.targetRef)).toEqual([
      '_bmad/shared/requirements-contract/requirements-contract-consumer-registry.json',
      '.github/workflows/target-validity.yml',
      'src/array-target.ts',
      'src/generated-active.ts',
      'src/generator-source.ts',
      'src/registry-active.ts',
      'src/script-entry.ts',
      'src/workflow-entry.ts',
    ]);
    expect(bindingFindings).toEqual(
      bindingFindings.map(() =>
        expect.objectContaining({
          value: 'active',
          confidence: 'high',
          issueCodes: [],
        })
      )
    );

    const advancedBindingFindings = result.findings.filter(
      (finding: { identityKey: string }) =>
        finding.identityKey === 'root-vitest::tests/advanced-bindings.test.ts'
    );
    expect(
      advancedBindingFindings.map((finding: { targetRef: string }) => finding.targetRef)
    ).toEqual([
      'scripts/setup.ps1',
      'scripts/setup.sh',
      'src/array-target.ts',
      'src/command-target.js',
      'src/copy-target.ts',
      'src/each-target.ts',
      'src/helper-target.ts',
      'src/registry-active.ts',
      'src/script-entry.ts',
      'src/ui.jsx',
      'src/workflow-entry.ts',
    ]);
    expect(advancedBindingFindings).toEqual(
      advancedBindingFindings.map(() =>
        expect.objectContaining({
          value: 'active',
          confidence: 'high',
          issueCodes: [],
        })
      )
    );

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

  it('prefers the nearest package when multiple packages declare the same bin', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json', 'packages/local/package.json'],
    });

    expect(sourceIndex.testTargets.get('packages/local/tests/process-bindings.test.ts')).toEqual([
      'packages/local/src/local-cli.mjs',
    ]);
  });

  it('keeps the local package bin executable by Node during runtime probes', () => {
    const packageRoot = join(TARGET_FIXTURE, 'packages/local');
    const packageManifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8')) as {
      bin: Record<string, string>;
    };
    const relativeBinPath = packageManifest.bin['target-validity-cli'];

    expect(relativeBinPath).toMatch(/\.mjs$/u);

    const binPath = join(packageRoot, relativeBinPath);
    expect(readFileSync(binPath, 'utf8').split(/\r?\n/u, 1)[0]).toBe('#!/usr/bin/env node');

    const execution = spawnSync(process.execPath, [binPath, 'inspect'], {
      cwd: packageRoot,
      encoding: 'utf8',
      windowsHide: true,
    });

    expect(execution.error).toBeUndefined();
    expect(execution.status).toBe(0);
    expect(execution.stdout.trim()).toBe('local cli: inspect');
  });

  it('resolves direct process targets relative to an explicit static cwd', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json', 'packages/local/package.json'],
    });

    expect(sourceIndex.testTargets.get('tests/process-cwd.test.ts')).toEqual([
      'packages/local/build.js',
    ]);
  });

  it('propagates executable argv and cwd through a local process helper', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json', 'packages/local/package.json'],
    });

    expect(sourceIndex.testTargets.get('packages/local/tests/process-helper.test.ts')).toEqual([
      'packages/local/helper-build.js',
    ]);
  });

  it('binds root cwd command paths and package operations deterministically', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json', 'packages/local/package.json'],
    });

    expect(sourceIndex.testTargets.get('packages/local/tests/root-cwd-command.test.ts')).toEqual([
      'src/root-command.ts',
    ]);
    expect(sourceIndex.testTargets.get('packages/local/tests/package-pack.test.ts')).toEqual([
      'packages/local/package.json',
    ]);
    expect(
      targetValidity.classifyTarget(
        'fixture#packages/local/tests/package-pack.test.ts',
        'packages/local/package.json',
        sourceIndex
      )
    ).toMatchObject({
      value: 'active',
      confidence: 'high',
      issueCodes: [],
    });
  });

  it('registers frozen YAML script owner paths as authoritative targets', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json'],
    });

    expect(sourceIndex.registryBindings.get('src/registry-script.ts')).toEqual([
      'source:_bmad/_config/script-owner-model-registry.yaml#scripts[0].path',
      'source:_bmad/_config/script-owner-model-registry.yaml#scripts[0].sourceRepoPath',
    ]);
    expect(
      targetValidity.classifyTarget(
        'fixture#registry-script',
        'src/registry-script.ts',
        sourceIndex
      )
    ).toMatchObject({
      value: 'active',
      confidence: 'high',
      issueCodes: [],
    });
  });

  it('binds package-owned directory scans to the package manifest', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: TARGET_FIXTURE,
      packagePaths: ['package.json'],
    });

    expect(sourceIndex.testTargets.get('tests/package-surface.test.ts')).toEqual(['package.json']);
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

  it('recognizes node:assert CLI source contracts as independent oracle evidence', async () => {
    const oracle = loadOracleEffectiveness();
    const testPath = 'packages/bmad-speckit/tests/main-agent-dist-no-root-ts-dispatch.test.js';
    const finding = await oracle.analyzeTestFile({
      repoRoot: process.cwd(),
      testPath,
    });

    expect(finding).toMatchObject({
      value: 'effective',
      confidence: 'high',
      issueCodes: [],
    });
    expect(finding.evidenceRefs).toEqual(
      expect.arrayContaining([expect.stringMatching(`source:${testPath}#assertion:line:`)])
    );
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

describe('parallel safety analyzer', () => {
  it.each([
    ['repo-write.test.ts', 'PARALLEL_REPO_GLOBAL_WRITE'],
    ['fixed-temp.test.ts', 'PARALLEL_FIXED_TEMP_PATH'],
    ['env-unrestored.test.ts', 'PARALLEL_PROCESS_ENV_MUTATION'],
    ['fixed-port.test.ts', 'PARALLEL_FIXED_PORT'],
    ['root-pack.test.ts', 'PARALLEL_ROOT_BUILD_OR_PACK'],
    ['root-build-script.test.ts', 'PARALLEL_ROOT_BUILD_OR_PACK'],
    ['root-build-wrapper.test.ts', 'PARALLEL_ROOT_BUILD_OR_PACK'],
    ['root-pack-wrapper.test.ts', 'PARALLEL_ROOT_BUILD_OR_PACK'],
  ])('marks %s unsafe with exact issue code', async (testPath, issueCode) => {
    const parallelSafety = loadParallelSafety();
    const result = await parallelSafety.analyzeTestFile({
      repoRoot: PARALLEL_FIXTURE,
      testPath,
    });

    expect(result).toMatchObject({
      value: 'unsafe',
      confidence: 'high',
    });
    expect(result.issueCodes).toContain(issueCode);
    expect(result.evidenceRefs.length).toBeGreaterThan(0);
  });

  it.each(['env-restored.test.ts', 'isolated-temp.test.ts'])(
    'keeps %s as a static safe candidate',
    async (testPath) => {
      const parallelSafety = loadParallelSafety();
      const result = await parallelSafety.analyzeTestFile({
        repoRoot: PARALLEL_FIXTURE,
        testPath,
      });

      expect(result).toMatchObject({
        value: 'safe_candidate',
        confidence: 'medium',
        issueCodes: [],
      });
    }
  );

  it('fails closed for one parse error without failing the analyzer batch', async () => {
    const parallelSafety = loadParallelSafety();
    const tests = ['isolated-temp.test.ts', 'parse-error.test.ts', 'repo-write.test.ts'].map(
      (testPath) =>
        testIdentity(`root-vitest::${testPath}`, {
          testPath,
        })
    );
    const input = {
      repoRoot: PARALLEL_FIXTURE,
      inventory: { tests },
      routeGraph: { routes: [] },
    };

    const result = await parallelSafety.analyze(input);

    expect(result).toMatchObject({
      analyzerId: 'parallel-safety',
      analyzerVersion: '1',
      dimension: 'parallelSafety',
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
      value: 'unknown',
      confidence: 'low',
      issueCodes: ['PARALLEL_ANALYSIS_INCOMPLETE'],
    });
    expect(await parallelSafety.analyze(input)).toEqual(result);
    for (const finding of result.findings) {
      expect(finding.evidenceRefs).toEqual([...new Set(finding.evidenceRefs)].sort());
      expect(finding.issueCodes).toEqual([...new Set(finding.issueCodes)].sort());
    }
  });
});

describe('criticality analyzer', () => {
  it('projects explicit package-script authority into exact critical test identities', async () => {
    const criticality = loadCriticality();
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: CRITICALITY_FIXTURE,
      packagePaths: ['package.json'],
    });

    const install = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/package-install.test.ts',
      identityKey: 'root-vitest#tests/package-install.test.ts',
      routeGraph: { routes: [] },
      sourceIndex,
    });
    const runtime = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/packaged-runtime.test.ts',
      identityKey: 'root-vitest#tests/packaged-runtime.test.ts',
      routeGraph: { routes: [] },
      sourceIndex,
    });
    const unbound = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/critical-name-only.test.ts',
      identityKey: 'root-vitest#tests/critical-name-only.test.ts',
      routeGraph: { routes: [] },
      sourceIndex,
    });

    expect(install).toMatchObject({
      value: 'critical',
      bindings: expect.arrayContaining([
        expect.objectContaining({ kind: 'package_install' }),
        expect.objectContaining({ kind: 'cli_bin' }),
        expect.objectContaining({ kind: 'consumer_compatibility' }),
      ]),
    });
    expect(runtime).toMatchObject({
      value: 'critical',
      bindings: [expect.objectContaining({ kind: 'packaged_runtime' })],
    });
    expect(unbound).toMatchObject({
      value: 'standard',
      bindings: [],
    });
    expect(sourceIndex.criticalBindingIssues).toEqual([]);
  });

  it('fails closed when critical authority references broad or missing package scripts', async () => {
    const criticality = loadCriticality();
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: CRITICALITY_INVALID_AUTHORITY_FIXTURE,
      packagePaths: ['package.json'],
    });
    const identityKey = 'root-vitest#tests/sample.check.ts';
    const result = await criticality.analyze({
      repoRoot: CRITICALITY_INVALID_AUTHORITY_FIXTURE,
      inventory: {
        tests: [
          {
            identityKey,
            testPath: 'tests/sample.check.ts',
            runnerId: 'root-vitest',
          },
        ],
      },
      routeGraph: { routes: [] },
      sourceIndex,
    });

    expect(result).toMatchObject({
      status: 'failed',
      findings: [],
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'CRITICAL_BINDING_SCRIPT_NOT_EXPLICIT' }),
        expect.objectContaining({ code: 'CRITICAL_BINDING_SCRIPT_UNRESOLVED' }),
        expect.objectContaining({ code: 'CRITICAL_BINDING_ID_DUPLICATE' }),
        expect.objectContaining({ code: 'CRITICAL_BINDING_KIND_UNSUPPORTED' }),
        expect.objectContaining({ code: 'CRITICAL_BINDING_KINDS_INVALID' }),
        expect.objectContaining({ code: 'CRITICAL_BINDING_SCRIPT_NAME_INVALID' }),
        expect.objectContaining({ code: 'CRITICAL_BINDING_TEST_UNRESOLVED' }),
      ]),
    });
  });

  it('ignores critical bindings from package manifests outside the authority package set', () => {
    const targetValidity = loadTargetValidity();
    const sourceIndex = targetValidity.buildSourceIndex({
      repoRoot: CRITICALITY_INVALID_AUTHORITY_FIXTURE,
      packagePaths: ['package.json'],
      criticalBindingPackagePaths: [],
    });

    expect(sourceIndex.criticalBindingIssues).toEqual([]);
    expect(sourceIndex.packageInstallBindings.size).toBe(0);
    expect(sourceIndex.cliBinBindings.size).toBe(0);
    expect(sourceIndex.mainAgentCoreBindings.size).toBe(0);
  });

  it.each([
    ['tests/package-install.test.ts', 'package_install'],
    ['tests/packaged-runtime.test.ts', 'packaged_runtime'],
    ['tests/cli-bin.test.ts', 'cli_bin'],
    ['tests/release-evidence.test.ts', 'release_path'],
  ] as const)('binds %s to explicit critical evidence', async (testPath, bindingKind) => {
    const criticality = loadCriticality();
    const result = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath,
      identityKey: `root-vitest::${testPath}`,
      routeGraph: criticalityRouteGraph(),
      sourceIndex: criticalitySourceIndex(),
    });

    expect(result).toMatchObject({ value: 'critical', confidence: 'high' });
    expect(result.bindings).toContainEqual(
      expect.objectContaining({
        kind: bindingKind,
      })
    );
    expect(result.evidenceRefs.length).toBeGreaterThan(0);
  });

  it('does not infer criticality from filename or caller-provided heuristics', async () => {
    const criticality = loadCriticality();
    const result = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/critical-name-only.test.ts',
      identityKey: 'root-vitest::tests/critical-name-only.test.ts',
      routeGraph: criticalityRouteGraph(),
      sourceIndex: {
        ...criticalitySourceIndex(),
        explicitBindings: [
          {
            testPath: 'tests/critical-name-only.test.ts',
            kind: 'package_install',
            evidenceRef: 'caller:declared-criticality',
          },
        ],
      },
      runtimeMs: 120_000,
      assertionCount: 50,
      executionFrequency: 500,
      declaredCriticality: 'critical',
    });

    expect(result).toMatchObject({
      value: 'standard',
      confidence: 'medium',
      bindings: [],
      evidenceRefs: [],
      issueCodes: [],
    });
  });

  it('records broad release execution as inherited membership without granting criticality', async () => {
    const criticality = loadCriticality();
    const result = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/critical-name-only.test.ts',
      identityKey: 'root-vitest::tests/critical-name-only.test.ts',
      routeGraph: {
        routes: [
          {
            routeId: 'route:release/broad',
            identityKey: 'root-vitest::tests/critical-name-only.test.ts',
            testPath: 'tests/critical-name-only.test.ts',
            purpose: 'release_validation',
            sourceRef: 'source:.github/workflows/release.yml#jobs.release.steps[0].run',
            selectionKind: 'inherited',
          },
        ],
      },
      sourceIndex: criticalitySourceIndex(),
    });

    expect(result).toMatchObject({
      value: 'standard',
      confidence: 'medium',
      bindings: [],
      releaseGateMembership: 'inherited',
      evidenceRefs: ['source:.github/workflows/release.yml#jobs.release.steps[0].run'],
      issueCodes: [],
    });
  });

  it('grants release-path criticality only to an explicitly selected release test', async () => {
    const criticality = loadCriticality();
    const result = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/release-evidence.test.ts',
      identityKey: 'root-vitest::tests/release-evidence.test.ts',
      routeGraph: criticalityRouteGraph(),
      sourceIndex: criticalitySourceIndex(),
    });

    expect(result).toMatchObject({
      value: 'critical',
      confidence: 'high',
      releaseGateMembership: 'explicit',
      bindings: [
        {
          kind: 'release_path',
          evidenceRef: 'workflow:.github/workflows/release.yml#job:release',
        },
      ],
    });
  });

  it('classifies an extended host matrix as specialized', async () => {
    const criticality = loadCriticality();
    const result = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/host-matrix.test.ts',
      identityKey: 'root-vitest::tests/host-matrix.test.ts',
      routeGraph: criticalityRouteGraph(),
      sourceIndex: criticalitySourceIndex(),
    });

    expect(result).toMatchObject({
      value: 'specialized',
      confidence: 'high',
    });
  });

  it('keeps batch findings complete and deterministic across per-test parse errors', async () => {
    const criticality = loadCriticality();
    const testPaths = [
      'tests/package-install.test.ts',
      'tests/packaged-runtime.test.ts',
      'tests/cli-bin.test.ts',
      'tests/release-evidence.test.ts',
      'tests/critical-name-only.test.ts',
      'tests/host-matrix.test.ts',
      'tests/parse-error.test.ts',
    ];
    const tests = testPaths.map((testPath) =>
      testIdentity(`root-vitest::${testPath}`, {
        testPath,
      })
    );
    const input = {
      repoRoot: CRITICALITY_FIXTURE,
      inventory: { tests },
      routeGraph: criticalityRouteGraph(),
      sourceIndex: criticalitySourceIndex(),
    };

    const result = await criticality.analyze(input);

    expect(result).toMatchObject({
      analyzerId: 'criticality',
      analyzerVersion: '1',
      dimension: 'criticality',
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
          finding.identityKey === 'root-vitest::tests/parse-error.test.ts'
      )
    ).toMatchObject({
      value: 'unknown',
      confidence: 'low',
      issueCodes: ['CRITICALITY_ANALYSIS_INCOMPLETE'],
    });
    expect(await criticality.analyze(input)).toEqual(result);
    for (const finding of result.findings) {
      expect(finding.bindings).toEqual(
        [...finding.bindings].sort((left, right) =>
          `${left.evidenceRef}\0${left.kind}`.localeCompare(
            `${right.evidenceRef}\0${right.kind}`,
            'en'
          )
        )
      );
      expect(finding.evidenceRefs).toEqual([...new Set(finding.evidenceRefs)].sort());
      expect(finding.issueCodes).toEqual([...new Set(finding.issueCodes)].sort());
    }
  });

  it('preserves the five analyzer dimensions as an orthogonal reducer contract', async () => {
    const parallelSafety = loadParallelSafety();
    const criticality = loadCriticality();
    const parallelFinding = await parallelSafety.analyzeTestFile({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/package-install.test.ts',
      identityKey: REDUCER_CONTRACT_IDENTITY,
    });
    const criticalityFinding = await criticality.analyzeTest({
      repoRoot: CRITICALITY_FIXTURE,
      testPath: 'tests/package-install.test.ts',
      identityKey: REDUCER_CONTRACT_IDENTITY,
      routeGraph: criticalityRouteGraph(),
      sourceIndex: criticalitySourceIndex(),
    });
    const reducerContractFixture = Object.freeze({
      identityKey: REDUCER_CONTRACT_IDENTITY,
      executionMultiplicity: 'duplicate',
      targetValidity: 'active',
      oracleEffectiveness: 'ineffective_candidate',
    });
    const reducedRow = {
      ...reducerContractFixture,
      parallelSafety: parallelFinding.value,
      criticality: criticalityFinding.value,
    };

    expect(reducedRow).toMatchObject({
      identityKey: REDUCER_CONTRACT_IDENTITY,
      executionMultiplicity: 'duplicate',
      targetValidity: 'active',
      oracleEffectiveness: 'ineffective_candidate',
      parallelSafety: 'unsafe',
      criticality: 'critical',
    });
    expect(parallelFinding).not.toHaveProperty('criticality');
    expect(criticalityFinding).not.toHaveProperty('parallelSafety');
  });
});

describe('test portfolio analyzer reducer', () => {
  it('keeps all five dimensions on one canonical identity row', () => {
    const criticalityResult = reducerAnalyzerResult('criticality', [
      reducerFinding('critical', { releaseGateMembership: 'explicit' }),
    ]);
    const result = reduceAudit(
      reducerInput(completeReducerResults({ criticality: criticalityResult }))
    );

    expect(result.artifact.tests[0]).toMatchObject({
      executionMultiplicity: 'duplicate',
      targetValidity: 'active',
      oracleEffectiveness: 'ineffective_candidate',
      parallelSafety: 'unsafe',
      criticality: 'critical',
      releaseGateMembership: 'explicit',
    });
    expect(result.artifact.totals).toMatchObject({
      releaseGateMembership: { explicit: 1 },
    });
  });

  it('raises a high-priority finding when explicit critical evidence targets obsolete code', () => {
    const targetResult = reducerAnalyzerResult('targetValidity', [
      reducerFinding('obsolete_candidate', {
        evidenceRefs: ['source:src/obsolete.ts#no-production-inbound'],
        targetRef: 'src/obsolete.ts',
      }),
    ]);
    const criticalityResult = reducerAnalyzerResult('criticality', [
      reducerFinding('critical', {
        evidenceRefs: ['source:package.json#bin:bmad-speckit'],
        releaseGateMembership: 'none',
      }),
    ]);
    const result = reduceAudit(
      reducerInput(
        completeReducerResults({
          targetValidity: targetResult,
          criticality: criticalityResult,
        })
      )
    );

    expect(result.artifact.tests[0]).toMatchObject({
      targetValidity: 'obsolete_candidate',
      criticality: 'critical',
      issueCodes: expect.arrayContaining(['CRITICAL_TARGET_OBSOLESCENCE_CONFLICT']),
    });
    expect(result.artifact.issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        code: 'CRITICAL_TARGET_OBSOLESCENCE_CONFLICT',
        identityKey: REDUCER_CONTRACT_IDENTITY,
      })
    );
  });

  it('turns conflicting definitive target evidence into ambiguous and incomplete', () => {
    const targetResult = reducerAnalyzerResult('targetValidity', [
      reducerFinding('active', {
        evidenceRefs: ['source:package.json#exports'],
      }),
      reducerFinding('obsolete_candidate', {
        evidenceRefs: ['source:src/a.ts#no-inbound'],
      }),
    ]);
    const result = reduceAudit(
      reducerInput(completeReducerResults({ targetValidity: targetResult }))
    );

    expect(result.artifact.tests[0]).toMatchObject({
      targetValidity: 'ambiguous',
      issueCodes: expect.arrayContaining(['TARGET_CLASSIFICATION_CONFLICT']),
    });
    expect(result.artifact.issues).toContainEqual(
      expect.objectContaining({
        severity: 'warning',
        code: 'TARGET_CLASSIFICATION_CONFLICT',
        identityKey: REDUCER_CONTRACT_IDENTITY,
      })
    );
    expect(result.artifact.status).toBe('INCOMPLETE');
  });

  it('does not default a missing required analyzer dimension to a positive value', () => {
    const analyzerResults = completeReducerResults().filter(
      (result) => result.dimension !== 'parallelSafety'
    );
    const result = reduceAudit(reducerInput(analyzerResults));

    expect(result.artifact.tests[0]).toMatchObject({
      parallelSafety: 'unknown',
      issueCodes: expect.arrayContaining(['PARALLEL_SAFETY_COVERAGE_MISSING']),
    });
    expect(result.artifact.issues).toContainEqual(
      expect.objectContaining({
        code: 'PARALLEL_SAFETY_COVERAGE_MISSING',
        identityKey: REDUCER_CONTRACT_IDENTITY,
      })
    );
    expect(result.artifact.status).toBe('INCOMPLETE');
  });

  it('records unsupported findings instead of dropping them', () => {
    const parallelResult = reducerAnalyzerResult('parallelSafety', [
      reducerFinding('optimistic-safe', {
        evidenceRefs: ['source:tests/package-install.test.ts#unsupported'],
        issueCodes: ['UPSTREAM_UNSUPPORTED_VALUE'],
      }),
    ]);
    const result = reduceAudit(
      reducerInput(completeReducerResults({ parallelSafety: parallelResult }))
    );

    expect(result.artifact.tests[0]).toMatchObject({
      parallelSafety: 'unknown',
      issueCodes: expect.arrayContaining([
        'ANALYZER_FINDING_VALUE_UNSUPPORTED',
        'PARALLEL_SAFETY_COVERAGE_MISSING',
        'UPSTREAM_UNSUPPORTED_VALUE',
      ]),
    });
    expect(result.artifact.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ANALYZER_FINDING_VALUE_UNSUPPORTED',
          identityKey: REDUCER_CONTRACT_IDENTITY,
          evidenceRef: 'source:tests/package-install.test.ts#unsupported',
        }),
        expect.objectContaining({
          code: 'PARALLEL_SAFETY_COVERAGE_MISSING',
          identityKey: REDUCER_CONTRACT_IDENTITY,
        }),
      ])
    );
    expect(result.artifact.status).toBe('INCOMPLETE');
  });

  it.each([
    ['unsafe', 'high', 'unsafe', 'high'],
    ['unknown', 'low', 'unknown', 'low'],
  ])(
    'allows the runtime probe to downgrade safe_candidate to %s',
    (probeValue, probeConfidence, expectedValue, expectedConfidence) => {
      const parallelResult = reducerAnalyzerResult('parallelSafety', [
        reducerFinding('safe_candidate', { confidence: 'medium' }),
      ]);
      const result = reduceAudit(
        reducerInput(completeReducerResults({ parallelSafety: parallelResult }), {
          probeResults: {
            requested: 1,
            selected: 1,
            completed: 1,
            failed: 0,
            timedOut: 0,
            unprobed: 0,
            budgetExhausted: false,
            results: [
              {
                identityKey: REDUCER_CONTRACT_IDENTITY,
                value: probeValue,
                confidence: probeConfidence,
                evidenceRefs: ['probe:runtime'],
                issueCodes: [`PROBE_${String(probeValue).toUpperCase()}`],
              },
            ],
          },
        })
      );

      expect(result.artifact.tests[0].parallelSafety).toBe(expectedValue);
      expect(result.artifact.tests[0].confidence.parallelSafety).toBe(expectedConfidence);
    }
  );

  it('does not let a successful probe upgrade unknown or safe_candidate to high confidence', () => {
    const safeProbe = {
      requested: 1,
      selected: 1,
      completed: 1,
      failed: 0,
      timedOut: 0,
      unprobed: 0,
      budgetExhausted: false,
      results: [
        {
          identityKey: REDUCER_CONTRACT_IDENTITY,
          value: 'safe_candidate',
          confidence: 'high',
          evidenceRefs: ['probe:runtime'],
          issueCodes: [],
        },
      ],
    };
    const safeStatic = reducerAnalyzerResult('parallelSafety', [
      reducerFinding('safe_candidate', { confidence: 'medium' }),
    ]);
    const unknownStatic = reducerAnalyzerResult('parallelSafety', [
      reducerFinding('unknown', { confidence: 'low' }),
    ]);

    const safeResult = reduceAudit(
      reducerInput(completeReducerResults({ parallelSafety: safeStatic }), {
        probeResults: safeProbe,
      })
    );
    const unknownResult = reduceAudit(
      reducerInput(completeReducerResults({ parallelSafety: unknownStatic }), {
        probeResults: safeProbe,
      })
    );

    expect(safeResult.artifact.tests[0]).toMatchObject({
      parallelSafety: 'safe_candidate',
      confidence: { parallelSafety: 'medium' },
    });
    expect(unknownResult.artifact.tests[0]).toMatchObject({
      parallelSafety: 'unknown',
      confidence: { parallelSafety: 'low' },
    });
  });

  it('marks failed required analyzers and declared coverage gaps incomplete', () => {
    const criticalityResult = reducerAnalyzerResult('criticality', [reducerFinding('critical')], {
      status: 'failed',
    });
    const oracleResult = reducerAnalyzerResult(
      'oracleEffectiveness',
      [reducerFinding('effective')],
      { coverageMissing: true }
    );
    const result = reduceAudit(
      reducerInput(
        completeReducerResults({
          criticality: criticalityResult,
          oracleEffectiveness: oracleResult,
        })
      )
    );

    expect(result.artifact.status).toBe('INCOMPLETE');
  });
});
