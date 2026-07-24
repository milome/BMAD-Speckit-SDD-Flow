export type TestIdentity = {
  identityKey: string;
};

export type ExecutionRoute = {
  routeId: string;
  identityKey: string;
  effectiveProfileId?: string;
  environmentId?: string;
  purpose?: string;
  sourceRef?: string;
};

export function testIdentity(identityKey: string): TestIdentity {
  return { identityKey };
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
