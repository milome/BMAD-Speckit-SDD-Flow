import { join } from 'node:path';

export type TestIdentity = {
  identityKey: string;
  testPath?: string;
  claimedRoles?: string[];
};

export type ExecutionRoute = {
  routeId: string;
  identityKey: string;
  effectiveProfileId?: string;
  environmentId?: string;
  purpose?: string;
  sourceRef?: string;
};

export const TEST_PORTFOLIO_FIXTURE_ROOT = join(
  process.cwd(),
  'tests/fixtures/test-portfolio-audit'
);
export const TARGET_FIXTURE = join(TEST_PORTFOLIO_FIXTURE_ROOT, 'target-validity');
export const ORACLE_FIXTURE = join(TEST_PORTFOLIO_FIXTURE_ROOT, 'oracle-effectiveness');

export function testIdentity(
  identityKey: string,
  overrides: Omit<Partial<TestIdentity>, 'identityKey'> = {}
): TestIdentity {
  return { identityKey, ...overrides };
}

export function executionRoute(
  routeId: string,
  identityKey: string,
  overrides: Partial<ExecutionRoute> = {}
): ExecutionRoute {
  return {
    routeId,
    identityKey,
    effectiveProfileId: 'pull_request:test:ubuntu:required',
    environmentId: 'ubuntu',
    purpose: 'required_pr_validation',
    ...overrides,
  };
}

export function analyzerInput({
  tests,
  routes,
  timings = {},
}: {
  tests: TestIdentity[];
  routes: ExecutionRoute[];
  timings?: Record<string, number>;
}) {
  return {
    inventory: {
      tests: [...tests].sort((left, right) =>
        left.identityKey.localeCompare(right.identityKey, 'en')
      ),
    },
    routeGraph: {
      routes: [...routes].sort((left, right) => left.routeId.localeCompare(right.routeId, 'en')),
    },
    timings: Object.fromEntries(
      Object.entries(timings).sort(([left], [right]) => left.localeCompare(right, 'en'))
    ),
  };
}
