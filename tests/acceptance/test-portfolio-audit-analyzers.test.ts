import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  analyzerInput,
  executionRoute,
  testIdentity,
  type ExecutionRoute,
} from '../fixtures/test-portfolio-audit/test-helpers';

const require = createRequire(import.meta.url);
const duplicate = require('../../tools/test-portfolio-audit/analyzers/duplicate.cjs');
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
