import * as path from 'node:path';

export const RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT = path.join(
  process.cwd(),
  'packages',
  'scoring',
  'parsers',
  '__tests__',
  'fixtures'
);

export const RUNTIME_DASHBOARD_HOOK_FIXTURE_ROOT = path.join(
  process.cwd(),
  'tests',
  'fixtures',
  'runtime-hooks'
);

export const REAL_TOOL_TRACE_VARIANTS = ['clean', 'redacted', 'blocked'] as const;

export type RealToolTraceFixtureVariant = (typeof REAL_TOOL_TRACE_VARIANTS)[number];
export type RuntimeDashboardFixtureStage = 'implement' | 'tasks' | 'plan';

interface RealToolTraceFixtureManifestEntry {
  fixtureFile: string;
  stage: RuntimeDashboardFixtureStage;
  reportFixture: string;
}

export const REAL_TOOL_TRACE_FIXTURE_MANIFEST = {
  clean: {
    fixtureFile: 'cursor-post-tool-use-real.stdin.json',
    stage: 'implement',
    reportFixture: 'sample-implement-report-high-score.md',
  },
  redacted: {
    fixtureFile: 'cursor-post-tool-use-real-redacted.stdin.json',
    stage: 'tasks',
    reportFixture: 'sample-tasks-report-逐条对照.md',
  },
  blocked: {
    fixtureFile: 'cursor-post-tool-use-real-blocked.stdin.json',
    stage: 'plan',
    reportFixture: 'sample-plan-report.md',
  },
} as const satisfies Record<RealToolTraceFixtureVariant, RealToolTraceFixtureManifestEntry>;

export function getRealToolTraceVariantConfig(variant: RealToolTraceFixtureVariant): {
  fixturePath: string;
  fixtureFile: string;
  stage: RuntimeDashboardFixtureStage;
  reportFixture: string;
  reportFixturePath: string;
} {
  const config = REAL_TOOL_TRACE_FIXTURE_MANIFEST[variant];
  return {
    ...config,
    fixturePath: path.join(RUNTIME_DASHBOARD_HOOK_FIXTURE_ROOT, config.fixtureFile),
    reportFixturePath: path.join(RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT, config.reportFixture),
  };
}

export function getReportFixturePathForStage(stage: RuntimeDashboardFixtureStage): string {
  const entry = Object.values(REAL_TOOL_TRACE_FIXTURE_MANIFEST).find(
    (candidate) => candidate.stage === stage
  );

  if (!entry) {
    throw new Error(`no runtime dashboard report fixture configured for stage: ${stage}`);
  }

  return path.join(RUNTIME_DASHBOARD_REPORT_FIXTURE_ROOT, entry.reportFixture);
}
