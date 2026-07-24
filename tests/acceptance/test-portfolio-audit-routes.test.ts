import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildExecutionRouteGraph,
  expandPackageScript,
  extractConfiguredCandidateRefs,
  parseCommandChain,
} = require('../../tools/test-portfolio-audit/routes.cjs');

const FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/routes');
const KNOWN_WRAPPER_SHA256 =
  'sha256:606dc9aced298e824225322eecca34f0e1054126cfcd46e7925a471397b635e8';

type Issue = {
  code: string;
  [key: string]: unknown;
};

type Invocation = {
  kind: string;
  runnerId: string;
  scriptRef: string;
  sourceRef: string;
  explicitTestPaths: string[];
  [key: string]: unknown;
};

type Route = {
  routeId: string;
  workflowPath: string;
  event: string;
  jobId: string;
  stepIndex: number;
  scriptRef: string;
  sourceRef: string;
  runnerId: string;
  testPath: string;
  identityKey: string;
  effectiveProfileId: string;
  environmentId: string;
  purpose: string;
};

function expectCommandDynamic(command: string): void {
  try {
    parseCommandChain(command);
  } catch (error) {
    expect(error).toMatchObject({ code: 'COMMAND_DYNAMIC_UNSUPPORTED' });
    return;
  }
  throw new Error(`Expected COMMAND_DYNAMIC_UNSUPPORTED for ${command}`);
}

function issueCodes(issues: Issue[]): string[] {
  return issues.map((issue) => issue.code);
}

function expectSorted(values: string[]): void {
  expect(values).toEqual([...values].sort((left, right) => left.localeCompare(right, 'en')));
}

describe('test portfolio execution routes', () => {
  it('parses quote-aware static command chains into exact argv arrays', () => {
    expect(parseCommandChain('npm run broad && npx vitest run "tests/shared.test.ts"')).toEqual([
      ['npm', 'run', 'broad'],
      ['npx', 'vitest', 'run', 'tests/shared.test.ts'],
    ]);

    expect(
      parseCommandChain(
        `npx vitest run "tests/a and b.test.ts" || node --test 'tests/node test.test.js'; vitest run "tests/&&.test.ts"`
      )
    ).toEqual([
      ['npx', 'vitest', 'run', 'tests/a and b.test.ts'],
      ['node', '--test', 'tests/node test.test.js'],
      ['vitest', 'run', 'tests/&&.test.ts'],
    ]);
  });

  it('fails closed on dynamic command construction and never exposes execution primitives', () => {
    for (const command of [
      'npx vitest run ${{ inputs.test }}',
      'npx vitest run $(node choose-test.cjs)',
      'npx vitest run `node choose-test.cjs`',
      'node choose-test.cjs > generated-command.txt',
      'npx vitest run "tests/shared.test.ts',
    ]) {
      expectCommandDynamic(command);
    }

    const source = readFileSync(
      join(process.cwd(), 'tools/test-portfolio-audit/routes.cjs'),
      'utf8'
    );
    expect(source).toContain('yaml.load');
    expect(source).not.toMatch(/\bshell\s*:\s*true\b/u);
    expect(source).not.toMatch(/\beval\s*\(/u);
    expect(source).not.toMatch(/\bexec(?:File|Sync)?\s*\(/u);
  });

  it('expands npm recursion, both prefix forms, and package-qualified recursion keys', () => {
    const combined = expandPackageScript({
      repoRoot: FIXTURE,
      packagePath: 'package.json',
      scriptName: 'test:all',
    });
    expect(combined.issues).toEqual([]);
    expect(combined.invocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'vitest',
          runnerId: 'root-vitest',
          scriptRef: 'package.json#scripts.broad',
          explicitTestPaths: [],
        }),
        expect.objectContaining({
          kind: 'vitest',
          runnerId: 'root-vitest',
          scriptRef: 'package.json#scripts.explicit',
          explicitTestPaths: ['tests/shared.test.ts'],
        }),
      ])
    );

    for (const scriptName of ['package-node', 'package-node-alt']) {
      const prefixed = expandPackageScript({
        repoRoot: FIXTURE,
        packagePath: 'package.json',
        scriptName,
      });
      expect(prefixed.issues).toEqual([]);
      expect(prefixed.invocations).toEqual([
        expect.objectContaining({
          kind: 'node-test',
          runnerId: 'node-test',
          packagePath: 'package-node/package.json',
          recursionKey: 'package-node/package.json#test',
          scriptRef: 'package-node/package.json#scripts.test',
          explicitTestPaths: ['package-node/tests/package.test.js'],
        }),
      ]);
    }
  });

  it('reports package cycles and unknown scripts without losing the package recursion key', () => {
    const cycle = expandPackageScript({
      repoRoot: FIXTURE,
      packagePath: 'package.json',
      scriptName: 'cycle:a',
    });
    expect(cycle.invocations).toEqual([]);
    expect(cycle.issues).toContainEqual(
      expect.objectContaining({
        code: 'PACKAGE_SCRIPT_CYCLE',
        key: 'package.json#cycle:a',
        cycle: ['package.json#cycle:a', 'package.json#cycle:b', 'package.json#cycle:a'],
      })
    );

    const unknown = expandPackageScript({
      repoRoot: FIXTURE,
      packagePath: 'package.json',
      scriptName: 'unknown',
    });
    expect(unknown.invocations).toEqual([]);
    expect(unknown.issues).toContainEqual(
      expect.objectContaining({
        code: 'PACKAGE_SCRIPT_UNKNOWN',
        key: 'package.json#missing-script',
      })
    );
  });

  it('binds the known wrapper hash and expands only its delegated scripts', () => {
    const result = expandPackageScript({
      repoRoot: FIXTURE,
      packagePath: 'package.json',
      scriptName: 'delegate',
    });

    expect(result.issues).toEqual([]);
    expect(result.wrapperSourceSha256).toBe(KNOWN_WRAPPER_SHA256);
    expect(result.invocations.map((row: Invocation) => row.scriptRef)).toEqual([
      'package-node/package.json#scripts.test',
      'package.json#scripts.broad',
      'package.json#scripts.test:governance-fixtures',
    ]);
    expect(result.invocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          runnerId: 'root-vitest',
          delegatedFrom: 'source:tools/run-root-tests.cjs',
        }),
        expect.objectContaining({
          runnerId: 'node-test',
          explicitTestPaths: ['tests/governance.test.js'],
          delegatedFrom: 'source:tools/run-root-tests.cjs',
        }),
      ])
    );
    expect(
      result.invocations.some(
        (row: Invocation) => row.sourceRef === 'source:tools/run-root-tests.cjs'
      )
    ).toBe(false);

    const drift = expandPackageScript({
      repoRoot: join(FIXTURE, 'wrapper-drift'),
      packagePath: 'package.json',
      scriptName: 'delegate',
    });
    expect(drift.invocations).toEqual([]);
    expect(drift.issues).toContainEqual(
      expect.objectContaining({
        code: 'KNOWN_WRAPPER_DRIFT',
        expectedSha256: KNOWN_WRAPPER_SHA256,
      })
    );
  });

  it('builds distinct PR, nightly, and finite platform matrix routes from YAML', () => {
    const graph = buildExecutionRouteGraph({
      repoRoot: FIXTURE,
      inventory: [
        { testPath: 'tests/shared.test.ts', runnerId: 'root-vitest' },
        { testPath: 'tests/platform.test.ts', runnerId: 'root-vitest' },
        { testPath: 'tests/governance.test.js', runnerId: 'node-test' },
        { testPath: 'package-node/tests/package.test.js', runnerId: 'node-test' },
      ],
    });

    for (const route of graph.routes as Route[]) {
      expect(route).toEqual({
        routeId: expect.any(String),
        workflowPath: expect.stringMatching(/^\.github\/workflows\/.+\.ya?ml$/u),
        event: expect.any(String),
        jobId: expect.any(String),
        stepIndex: expect.any(Number),
        scriptRef: expect.any(String),
        sourceRef: expect.any(String),
        runnerId: expect.any(String),
        testPath: expect.any(String),
        identityKey: `${route.runnerId}#${route.testPath}`,
        effectiveProfileId: expect.any(String),
        environmentId: expect.any(String),
        purpose: expect.any(String),
      });
    }

    const prShared = (graph.routes as Route[]).filter(
      (route) =>
        route.workflowPath === '.github/workflows/pr.yml' &&
        route.testPath === 'tests/shared.test.ts'
    );
    expect(prShared).toHaveLength(2);
    expect(new Set(prShared.map((route) => route.purpose))).toEqual(
      new Set(['required_pr_validation'])
    );
    expect(new Set(prShared.map((route) => route.environmentId))).toEqual(
      new Set(['ubuntu-latest'])
    );

    const nightlyShared = (graph.routes as Route[]).filter(
      (route) => route.jobId === 'nightly' && route.testPath === 'tests/shared.test.ts'
    );
    expect(nightlyShared).toHaveLength(1);
    expect(nightlyShared[0]).toMatchObject({
      event: 'schedule',
      purpose: 'nightly_validation',
      environmentId: 'macos-latest',
    });

    const platform = (graph.routes as Route[]).filter(
      (route) => route.jobId === 'platform' && route.testPath === 'tests/platform.test.ts'
    );
    expect(platform).toHaveLength(2);
    expect(platform.map((route) => route.environmentId)).toEqual([
      'ubuntu-latest',
      'windows-latest',
    ]);
    expect(new Set(platform.map((route) => route.purpose))).toEqual(
      new Set(['platform_validation'])
    );
    expect(new Set(platform.map((route) => route.effectiveProfileId)).size).toBe(2);

    const representativeProfiles = [
      prShared[0],
      nightlyShared[0],
      platform.find((route) => route.environmentId === 'windows-latest')!,
    ];
    expect(new Set(representativeProfiles.map((route) => route.purpose)).size).toBe(3);
    expect(new Set(representativeProfiles.map((route) => route.effectiveProfileId)).size).toBe(3);
    expect(new Set(representativeProfiles.map((route) => route.environmentId)).size).toBe(3);

    const manual = (graph.routes as Route[]).filter(
      (route) => route.jobId === 'manual' && route.testPath === 'tests/shared.test.ts'
    );
    expect(manual).toHaveLength(1);
    expect(manual[0]).toMatchObject({
      event: 'workflow_dispatch',
      purpose: 'workflow_dispatch_validation',
    });
    expect(manual[0].effectiveProfileId).not.toBe(prShared[0].effectiveProfileId);
    expect(manual[0].effectiveProfileId).not.toBe(nightlyShared[0].effectiveProfileId);
  });

  it('binds broad Vitest to all runner identities and explicit files only to exact inventory', () => {
    const inventory = [
      { testPath: 'tests/shared.test.ts', runnerId: 'root-vitest' },
      { testPath: 'tests/platform.test.ts', runnerId: 'root-vitest' },
    ];
    const graph = buildExecutionRouteGraph({ repoRoot: FIXTURE, inventory });

    const prBroad = (graph.invocations as Invocation[]).find(
      (row) =>
        row.sourceRef === 'source:.github/workflows/pr.yml#jobs.test.steps[0].run' &&
        row.scriptRef === 'package.json#scripts.broad'
    )!;
    expect(prBroad.explicitTestPaths).toEqual([]);
    expect(
      (graph.routes as Route[])
        .filter((route) => route.routeId.startsWith(`route:${prBroad.invocationId}`))
        .map((route) => route.testPath)
    ).toEqual(['tests/platform.test.ts', 'tests/shared.test.ts']);

    const prExplicit = (graph.invocations as Invocation[]).find(
      (row) =>
        row.sourceRef === 'source:.github/workflows/pr.yml#jobs.test.steps[0].run' &&
        row.scriptRef === 'package.json#scripts.explicit'
    )!;
    expect(prExplicit.explicitTestPaths).toEqual(['tests/shared.test.ts']);
    expect(
      (graph.routes as Route[])
        .filter((route) => route.routeId.startsWith(`route:${prExplicit.invocationId}`))
        .map((route) => route.testPath)
    ).toEqual(['tests/shared.test.ts']);
  });

  it('keeps dynamic workflows, undiscovered explicit tests, and unknown test commands visible', () => {
    const graph = buildExecutionRouteGraph({
      repoRoot: FIXTURE,
      inventory: [
        { testPath: 'tests/shared.test.ts', runnerId: 'root-vitest' },
        { testPath: 'tests/platform.test.ts', runnerId: 'root-vitest' },
      ],
    });

    expect(issueCodes(graph.issues)).toEqual(
      expect.arrayContaining([
        'COMMAND_DYNAMIC_UNSUPPORTED',
        'ROUTE_TEST_NOT_DISCOVERED',
        'UNKNOWN_TEST_LIKE_COMMAND',
        'WORKFLOW_MATRIX_DYNAMIC',
        'WORKFLOW_WORKING_DIRECTORY_DYNAMIC',
      ])
    );
    expect(graph.issues).toContainEqual(
      expect.objectContaining({
        code: 'ROUTE_TEST_NOT_DISCOVERED',
        testPath: 'tests/missing.test.ts',
      })
    );
    expect(
      (graph.routes as Route[])
        .filter(
          (route) =>
            route.workflowPath === '.github/workflows/dynamic.yml' &&
            [
              'dynamic-command',
              'dynamic-matrix',
              'dynamic-working-directory',
              'unknown-test-command',
            ].includes(route.jobId)
        )
        .map((route) => route.routeId)
    ).toEqual([]);

    const configured = extractConfiguredCandidateRefs(graph);
    expect(configured).toContainEqual({
      testPath: 'tests/missing.test.ts',
      evidenceRef: 'source:.github/workflows/dynamic.yml#jobs.missing-test.steps[0].run',
    });
    expectSorted(configured.map((row: { testPath: string }) => row.testPath));
  });

  it('sorts routes, invocations, issues, and configured refs deterministically', () => {
    const input = {
      repoRoot: FIXTURE,
      inventory: [
        { testPath: 'tests/shared.test.ts', runnerId: 'root-vitest' },
        { testPath: 'tests/platform.test.ts', runnerId: 'root-vitest' },
      ],
    };
    const first = buildExecutionRouteGraph(input);
    const second = buildExecutionRouteGraph({
      ...input,
      inventory: [...input.inventory].reverse(),
    });

    expect(second).toEqual(first);
    expectSorted(first.routes.map((route: Route) => route.routeId));
    expectSorted(first.invocations.map((row: { invocationId: string }) => row.invocationId));
    expectSorted(
      first.issues.map(
        (issue: Issue) =>
          `${issue.code}:${String(issue.sourceRef ?? '')}:${String(issue.testPath ?? '')}`
      )
    );

    const refs = extractConfiguredCandidateRefs(first);
    expect(refs).toEqual(extractConfiguredCandidateRefs(second));
    expect(refs).toEqual(
      [...refs].sort(
        (
          left: { testPath: string; evidenceRef: string },
          right: { testPath: string; evidenceRef: string }
        ) =>
          left.testPath.localeCompare(right.testPath, 'en') ||
          left.evidenceRef.localeCompare(right.evidenceRef, 'en')
      )
    );
  });
});
