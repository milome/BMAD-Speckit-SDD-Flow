import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  parseArgs,
  selectCriticalAuthorityPackagePaths,
} = require('../../tools/test-portfolio-audit/run.cjs');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  renderSummary: renderCanonicalSummary,
  writeAuditArtifacts: writeCanonicalArtifacts,
} = require('../../tools/test-portfolio-audit/report.cjs');
const { reduceAudit } = require('../../tools/test-portfolio-audit/audit.cjs');

const temporaryRoots: string[] = [];
const cliPath = join(process.cwd(), 'tools', 'test-portfolio-audit', 'run.cjs');
const routeFixture = join(process.cwd(), 'tests', 'fixtures', 'test-portfolio-audit', 'routes');

it('selects only root and declared workspace packages as critical authority packages', () => {
  expect(
    selectCriticalAuthorityPackagePaths([
      {
        packagePath: 'package.json',
        packageJson: { workspaces: ['packages/*'] },
      },
      {
        packagePath: 'packages/runtime/package.json',
        packageJson: { name: '@fixture/runtime' },
      },
      {
        packagePath: 'tests/fixtures/invalid/package.json',
        packageJson: { name: 'invalid-authority-fixture' },
      },
    ])
  ).toEqual(['package.json', 'packages/runtime/package.json']);
});

function createTemporaryRoot(prefix = 'test-portfolio-audit-'): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  });
}

function createIncompleteFixture(): string {
  const root = createTemporaryRoot('test-portfolio-audit-incomplete-');
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'unsupported-runner-fixture',
      private: true,
      scripts: { 'test:required': 'jest --runInBand' },
    }),
    'utf8'
  );
  writeFileSync(
    join(root, '.github', 'workflows', 'ci.yml'),
    [
      'name: CI',
      'on: [pull_request]',
      'jobs:',
      '  test:',
      '    runs-on: ubuntu-latest',
      '    steps:',
      '      - run: npm run test:required',
      '',
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'unsupported.test.ts'),
    "test('unsupported runner', () => expect(true).toBe(true));\n",
    'utf8'
  );
  return root;
}

function createFailedFixture(): string {
  const root = createTemporaryRoot('test-portfolio-audit-failed-');
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{ invalid json\n', 'utf8');
  writeFileSync(
    join(root, 'tests', 'unreachable.test.ts'),
    "test('unreachable', () => expect(true).toBe(true));\n",
    'utf8'
  );
  return root;
}

function createConfiguredVitestFixture(): string {
  const root = createTemporaryRoot('test-portfolio-audit-configured-vitest-');
  mkdirSync(join(root, 'contracts'), { recursive: true });
  mkdirSync(join(root, 'scripts'), { recursive: true });
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'configured-vitest-fixture',
      private: true,
      scripts: {
        'fixture:powershell': 'pwsh -File scripts/setup.ps1',
        'fixture:shell': 'sh scripts/setup.sh',
        'test:default': 'vitest run',
        'test:explicit': 'vitest run tests/explicit.test.ts',
      },
    }),
    'utf8'
  );
  writeFileSync(
    join(root, 'vitest.config.cjs'),
    [
      "const explicitTest = 'tests/explicit.test.ts';",
      "const requested = process.argv.some((arg) => arg.replace(/\\\\/g, '/').endsWith(explicitTest));",
      'module.exports = {',
      '  test: {',
      "    include: ['tests/**/*.test.ts'],",
      '    exclude: requested ? [] : [explicitTest],',
      '  },',
      '};',
      '',
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'default.test.ts'),
    [
      "import { readFileSync } from 'node:fs';",
      "import path from 'node:path';",
      "test('default route', () => {",
      "  expect(readFileSync(path.join(process.cwd(), 'scripts', 'setup.ps1'), 'utf8')).toContain('fixture');",
      "  expect(readFileSync(path.join(process.cwd(), 'scripts', 'setup.sh'), 'utf8')).toContain('fixture');",
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'explicit.test.ts'),
    "test('explicit route', () => expect(true).toBe(true));\n",
    'utf8'
  );
  writeFileSync(join(root, 'scripts', 'setup.ps1'), "Write-Output 'fixture'\n", 'utf8');
  writeFileSync(join(root, 'scripts', 'setup.sh'), "printf '%s\\n' 'fixture'\n", 'utf8');
  writeFileSync(join(root, 'contracts', 'audit.spec.yaml'), 'kind: contract\n', 'utf8');
  return root;
}

function createDualRunnerIdentityFixture(): string {
  const root = createTemporaryRoot('test-portfolio-audit-dual-runner-');
  mkdirSync(join(root, 'tests'), { recursive: true });
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'dual-runner-identity-fixture',
      private: true,
      scripts: {
        'test:node': 'node --test tests/shared.test.js',
        'test:vitest': 'vitest run',
      },
    }),
    'utf8'
  );
  writeFileSync(
    join(root, 'vitest.config.cjs'),
    "module.exports = { test: { globals: true, include: ['tests/shared.test.js'] } };\n",
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'shared.test.js'),
    [
      'if (process.env.VITEST) {',
      "  test('vitest identity', () => expect(1).toBe(1));",
      '} else {',
      "  require('node:test').test('node identity', () => require('node:assert').strictEqual(1, 1));",
      '}',
      '',
    ].join('\n'),
    'utf8'
  );
  return root;
}

function createDeterminismFixture(reverseOrder: boolean): string {
  const root = createTemporaryRoot('test-portfolio-audit-determinism-');
  const packageJson = reverseOrder
    ? {
        scripts: { test: 'vitest run' },
        private: true,
        name: 'determinism-fixture',
      }
    : {
        name: 'determinism-fixture',
        private: true,
        scripts: { test: 'vitest run' },
      };
  const files = [
    ['package.json', `${JSON.stringify(packageJson, null, 2)}\n`],
    ['vitest.config.cjs', "module.exports = { test: { include: ['tests/**/*.test.ts'] } };\n"],
    [
      'tests/alpha.test.ts',
      "test('alpha', () => expect({ ready: true }).toEqual({ ready: true }));\n",
    ],
    ['tests/zeta.test.ts', "test('zeta', () => expect([2, 1].sort()).toEqual([1, 2]));\n"],
  ] as const;

  for (const [relativePath, source] of reverseOrder ? [...files].reverse() : files) {
    mkdirSync(join(root, relativePath, '..'), { recursive: true });
    writeFileSync(join(root, relativePath), source, 'utf8');
  }
  return root;
}

function readReceipt(stdout: string): Record<string, any> {
  return JSON.parse(stdout.trim());
}

function readArtifact(outputDir: string): Record<string, any> {
  return JSON.parse(readFileSync(join(outputDir, 'test-portfolio-audit.json'), 'utf8'));
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('test portfolio audit CLI option contract', () => {
  it('accepts only the approved option surface and resolves paths', () => {
    const outputDir = createTemporaryRoot('test-portfolio-audit-options-');
    const parsed = parseArgs([
      '--json',
      '--repo-root',
      routeFixture,
      '--output-dir',
      outputDir,
      '--probe-limit',
      '7',
      '--probe-budget-ms',
      '120000',
      '--probe-sandbox-root',
      routeFixture,
    ]);

    expect(parsed).toEqual({
      json: true,
      repoRoot: resolve(routeFixture),
      outputDir: resolve(outputDir),
      probeLimit: 7,
      probeBudgetMs: 120000,
      probeSandboxRoot: resolve(routeFixture),
    });
  });

  it.each([
    ['negative probe limit', ['--probe-limit', '-1']],
    ['probe limit above twenty', ['--probe-limit', '21']],
    ['probe budget above maximum', ['--probe-budget-ms', '600001']],
    ['unknown option', ['--unknown-option']],
  ])('fails closed for %s', (_name, args) => {
    const result = runCli(args);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).not.toBe('');
  });

  it.each([
    '--repo-root',
    '--output-dir',
    '--probe-limit',
    '--probe-budget-ms',
    '--probe-sandbox-root',
  ])('fails closed when %s has no value', (option) => {
    const result = runCli([option]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('OPTION_VALUE_REQUIRED');
  });

  it.each(['--inventory', '--classification', '--confidence', '--expected-hash'])(
    'rejects caller-supplied audit authority through %s',
    (option) => {
      const result = runCli([option, 'caller-value']);

      expect(result.status).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('UNKNOWN_OPTION');
    }
  );
});

describe('test portfolio audit CLI orchestration', () => {
  it('runs the route fixture and writes exactly two deterministic-authority artifacts', () => {
    const outputDir = createTemporaryRoot('test-portfolio-audit-output-');
    const result = runCli([
      '--repo-root',
      routeFixture,
      '--output-dir',
      outputDir,
      '--probe-limit',
      '0',
      '--json',
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(readdirSync(outputDir).sort()).toEqual([
      'test-portfolio-audit.json',
      'test-portfolio-summary.md',
    ]);

    const artifact = readArtifact(outputDir);
    const receipt = readReceipt(result.stdout);
    expect(artifact.schemaVersion).toBe('test-portfolio-audit/v1');
    expect(artifact.status).toBe('COMPLETE');
    expect(artifact.tests.length).toBeGreaterThan(0);
    expect(artifact).not.toHaveProperty('timestamp');
    expect(artifact).not.toHaveProperty('auditSha256');
    expect(artifact).not.toHaveProperty('artifactSha256');
    expect(artifact).not.toHaveProperty('staticAnalysisDurationMs');
    expect(artifact).not.toHaveProperty('probeDurationMs');
    expect(artifact).not.toHaveProperty('totalDurationMs');
    expect(receipt).toMatchObject({
      schemaVersion: 'test-portfolio-audit-run-receipt/v1',
      status: 'COMPLETE',
      executableTestCount: artifact.tests.length,
      probe: {
        requested: 0,
        selected: 0,
        completed: 0,
        failed: 0,
        timedOut: 0,
      },
    });
    expect(isAbsolute(receipt.auditPath)).toBe(true);
    expect(isAbsolute(receipt.summaryPath)).toBe(true);
    expect(receipt.auditSha256).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(receipt.staticAnalysisDurationMs).toBeGreaterThanOrEqual(0);
    expect(receipt.probeDurationMs).toBeGreaterThanOrEqual(0);
    expect(receipt.totalDurationMs).toBeGreaterThanOrEqual(0);
  }, 30_000);

  it('maps an incomplete artifact to exit two with visible discovery issues', () => {
    const repoRoot = createIncompleteFixture();
    const outputDir = join(repoRoot, '.artifacts', 'ci');
    const result = runCli([
      '--repo-root',
      repoRoot,
      '--output-dir',
      outputDir,
      '--probe-limit',
      '0',
      '--json',
    ]);

    expect(result.status).toBe(2);
    const artifact = readArtifact(outputDir);
    const receipt = readReceipt(result.stdout);
    expect(artifact.status).toBe('INCOMPLETE');
    expect(receipt.status).toBe('INCOMPLETE');
    expect(artifact.issues.map((issue: { code: string }) => issue.code)).toContain(
      'CONFIGURED_RUNNER_UNSUPPORTED'
    );
  });

  it('maps a failed artifact to exit one with a visible fatal issue', () => {
    const repoRoot = createFailedFixture();
    const outputDir = join(repoRoot, '.artifacts', 'ci');
    const result = runCli([
      '--repo-root',
      repoRoot,
      '--output-dir',
      outputDir,
      '--probe-limit',
      '0',
      '--json',
    ]);

    expect(result.status).toBe(1);
    const artifact = readArtifact(outputDir);
    const receipt = readReceipt(result.stdout);
    expect(artifact.status).toBe('FAILED');
    expect(receipt.status).toBe('FAILED');
    expect(artifact.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'fatal',
          code: 'CONFIGURED_DISCOVERY_FAILED',
        }),
      ])
    );
  });

  it('disables requested probes without a sandbox and executes none in the source workspace', () => {
    const outputDir = createTemporaryRoot('test-portfolio-audit-no-sandbox-');
    const result = runCli([
      '--repo-root',
      routeFixture,
      '--output-dir',
      outputDir,
      '--probe-limit',
      '1',
      '--json',
    ]);

    expect(result.status).toBe(0);
    const artifact = readArtifact(outputDir);
    const receipt = readReceipt(result.stdout);
    expect(artifact.status).toBe('COMPLETE');
    expect(artifact.probe).toMatchObject({
      requested: 1,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
    });
    expect(artifact.issues.map((issue: { code: string }) => issue.code)).toContain(
      'PROBE_DISABLED_NO_SANDBOX'
    );
    expect(receipt.probe).toMatchObject({
      requested: 1,
      selected: 0,
      completed: 0,
      failed: 0,
      timedOut: 0,
      issueCodes: ['PROBE_DISABLED_NO_SANDBOX'],
    });
  }, 30_000);

  it('reconciles executable candidates with explicit Vitest script targets', () => {
    const repoRoot = createConfiguredVitestFixture();
    const outputDir = join(repoRoot, '.artifacts', 'ci');
    const result = runCli([
      '--repo-root',
      repoRoot,
      '--output-dir',
      outputDir,
      '--probe-limit',
      '0',
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const artifact = readArtifact(outputDir);
    const receipt = readReceipt(result.stdout);
    expect(receipt).toMatchObject({
      status: 'COMPLETE',
      discovery: {
        runnerResolvedCount: 2,
        candidateCount: 2,
        unexplainedRunnerOnlyCount: 0,
        unexplainedCandidateOnlyCount: 0,
      },
    });
    expect(
      artifact.tests.map((test: { runnerId: string; testPath: string }) => [
        test.runnerId,
        test.testPath,
      ])
    ).toEqual([
      ['root-vitest', 'tests/default.test.ts'],
      ['root-vitest', 'tests/explicit.test.ts'],
    ]);
    expect(
      artifact.tests.find((test: { testPath: string }) => test.testPath === 'tests/default.test.ts')
    ).toMatchObject({
      targetValidity: 'active',
      issueCodes: expect.not.arrayContaining(['TARGET_REFERENCE_UNRESOLVED']),
    });
  }, 30_000);

  it('preserves two runner identities for one normalized test path', () => {
    const repoRoot = createDualRunnerIdentityFixture();
    const outputDir = join(repoRoot, '.artifacts', 'ci');
    const result = runCli([
      '--repo-root',
      repoRoot.replace(/\\/gu, '/'),
      '--output-dir',
      outputDir,
      '--probe-limit',
      '0',
      '--json',
    ]);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const artifact = readArtifact(outputDir);
    const receipt = readReceipt(result.stdout);
    expect(receipt.discovery).toEqual({
      complete: true,
      runnerResolvedCount: 1,
      candidateCount: 1,
      unexplainedRunnerOnlyCount: 0,
      unexplainedCandidateOnlyCount: 0,
    });
    expect(
      artifact.tests.map((test: { identityKey: string; runnerId: string; testPath: string }) => ({
        identityKey: test.identityKey,
        runnerId: test.runnerId,
        testPath: test.testPath,
      }))
    ).toEqual([
      {
        identityKey: 'node-test#tests/shared.test.js',
        runnerId: 'node-test',
        testPath: 'tests/shared.test.js',
      },
      {
        identityKey: 'root-vitest#tests/shared.test.js',
        runnerId: 'root-vitest',
        testPath: 'tests/shared.test.js',
      },
    ]);
  }, 30_000);

  it('keeps canonical artifact bytes stable across filesystem, package, path, and timing permutations', () => {
    const roots = [createDeterminismFixture(false), createDeterminismFixture(true)];
    const runs = roots.map((repoRoot, index) => {
      const outputDir = join(repoRoot, '.artifacts', 'ci');
      const pathArgument = index === 0 ? repoRoot : repoRoot.replace(/\\/gu, '/');
      const result = runCli([
        '--repo-root',
        pathArgument,
        '--output-dir',
        outputDir,
        '--probe-limit',
        '0',
        '--json',
      ]);

      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      return {
        artifactBytes: readFileSync(join(outputDir, 'test-portfolio-audit.json')),
        receipt: readReceipt(result.stdout),
      };
    });

    expect(runs[1].artifactBytes.equals(runs[0].artifactBytes)).toBe(true);
    expect(
      runs.map(({ receipt }) => ({
        staticAnalysisDurationMs: receipt.staticAnalysisDurationMs,
        probeDurationMs: receipt.probeDurationMs,
        totalDurationMs: receipt.totalDurationMs,
      }))
    ).not.toEqual([
      {
        staticAnalysisDurationMs: runs[0].receipt.staticAnalysisDurationMs,
        probeDurationMs: runs[0].receipt.probeDurationMs,
        totalDurationMs: runs[0].receipt.totalDurationMs,
      },
      {
        staticAnalysisDurationMs: runs[0].receipt.staticAnalysisDurationMs,
        probeDurationMs: runs[0].receipt.probeDurationMs,
        totalDurationMs: runs[0].receipt.totalDurationMs,
      },
    ]);
  }, 60_000);
});

describe('test portfolio audit orchestration normalization', () => {
  it('does not treat findings for distinct target refs as contradictory evidence', () => {
    const identityKey = 'root-vitest#tests/multi-target.test.ts';
    const analyzerResult = (
      analyzerId: string,
      dimension: string,
      findings: Record<string, unknown>[]
    ) => ({
      analyzerId,
      analyzerVersion: '1',
      dimension,
      required: true,
      status: 'complete',
      findings: findings.map((finding) => ({
        identityKey,
        confidence: 'high',
        evidenceRefs: [],
        issueCodes: [],
        ...finding,
      })),
      issues: [],
    });
    const result = reduceAudit({
      repository: { commit: 'fixture', dirty: false },
      tool: { version: 'test-portfolio-audit/1', runnerVersions: [] },
      inventory: {
        tests: [
          {
            identityKey,
            testPath: 'tests/multi-target.test.ts',
            runnerId: 'root-vitest',
          },
        ],
      },
      routeGraph: { routes: [], issues: [] },
      discovery: {
        complete: true,
        runnerResolvedCount: 1,
        candidateCount: 1,
        unexplainedRunnerOnlyCount: 0,
        unexplainedCandidateOnlyCount: 0,
      },
      probeResults: { requested: 0, results: [] },
      analyzerResults: [
        analyzerResult('duplicate', 'executionMultiplicity', [{ value: 'single' }]),
        analyzerResult('target-validity', 'targetValidity', [
          { targetRef: 'src/active.ts', value: 'active' },
          { targetRef: 'src/obsolete.ts', value: 'obsolete_candidate' },
        ]),
        analyzerResult('oracle-effectiveness', 'oracleEffectiveness', [{ value: 'effective' }]),
        analyzerResult('parallel-safety', 'parallelSafety', [{ value: 'safe_candidate' }]),
        analyzerResult('criticality', 'criticality', [{ value: 'standard' }]),
      ],
    });

    expect(result.artifact.status).toBe('COMPLETE');
    expect(result.artifact.tests[0]).toMatchObject({
      targetValidity: 'ambiguous',
    });
    expect(result.artifact.tests[0].issueCodes).not.toContain('TARGET_CLASSIFICATION_CONFLICT');
  });
});

function canonicalReportFixture(priorityCount: number): Record<string, unknown> {
  const tests = Array.from({ length: priorityCount }, (_, index) => ({
    identityKey: `root-vitest::tests/priority-${String(index).padStart(2, '0')}.test.ts`,
    testPath: `tests/priority-${String(index).padStart(2, '0')}.test.ts`,
    runnerId: 'root-vitest',
    executionMultiplicity: 'single',
    targetValidity: 'active',
    oracleEffectiveness: 'ineffective_candidate',
    parallelSafety: 'unsafe',
    criticality: 'critical',
    durationMs: priorityCount - index,
    issueCodes: [],
    evidenceRefs: [],
    sourceBody: `sourceBody-${index}`,
  }));
  return {
    schemaVersion: 'test-portfolio-audit/v1',
    repository: { commit: 'fixture-commit', dirty: false },
    tool: {
      version: 'test-portfolio-audit/1',
      runnerVersions: [],
      analyzerVersions: [],
    },
    status: 'INCOMPLETE',
    discovery: {
      complete: true,
      runnerResolvedCount: priorityCount,
      candidateCount: priorityCount,
      unexplainedRunnerOnlyCount: 0,
      unexplainedCandidateOnlyCount: 0,
    },
    probe: {
      complete: false,
      requested: 2,
      selected: 1,
      completed: 1,
      failed: 0,
      timedOut: 0,
      unprobed: 1,
      budgetExhausted: true,
    },
    tests,
    issues: [],
    totals: {
      testCount: priorityCount,
      duplicateCount: 3,
      safeCandidateCount: 4,
      estimatedDuplicateDurationMs: 1200,
      estimatedParallelizableDurationMs: 3400,
      releaseGateMembership: {
        explicit: 2,
        inherited: 3,
        mixed: 1,
        none: 4,
        unknown: 0,
      },
    },
  };
}

describe('test portfolio canonical report projector', () => {
  it('renders only aggregates and at most twenty priority rows from the canonical artifact', () => {
    const artifact = canonicalReportFixture(30);
    const markdown = renderCanonicalSummary(artifact, { priorityLimit: 50 });

    expect(renderCanonicalSummary.length).toBe(1);
    expect(markdown).toContain('# Test Portfolio Audit');
    expect(markdown).toContain('Status: INCOMPLETE');
    expect(markdown).toContain('Discovery complete: yes');
    expect(markdown).toContain('Probe complete: no');
    expect(markdown).toContain('Estimated duplicate duration: 1200 ms');
    expect(markdown).toContain('Estimated parallelizable duration: 3400 ms');
    expect(markdown).toContain(
      'Release gate membership: explicit 2 | inherited 3 | mixed 1 | none 4 | unknown 0'
    );
    expect(markdown).toContain('Critical + ineffective');
    expect(markdown.match(/tests\/priority-\d+\.test\.ts/gu)?.length).toBe(20);
    expect(markdown).not.toContain('sourceBody');
  });

  it('orders priority rows by category, duration, and lexical path', () => {
    const artifact = canonicalReportFixture(0);
    artifact.tests = [
      {
        testPath: 'tests/f-critical-obsolete.test.ts',
        runnerId: 'root-vitest',
        criticality: 'critical',
        oracleEffectiveness: 'effective',
        executionMultiplicity: 'single',
        targetValidity: 'obsolete_candidate',
        parallelSafety: 'unsafe',
        durationMs: 1,
        issueCodes: ['CRITICAL_TARGET_OBSOLESCENCE_CONFLICT'],
      },
      {
        testPath: 'tests/e-critical-ineffective.test.ts',
        runnerId: 'root-vitest',
        criticality: 'critical',
        oracleEffectiveness: 'ineffective_candidate',
        executionMultiplicity: 'single',
        targetValidity: 'active',
        parallelSafety: 'unsafe',
        durationMs: 1,
        issueCodes: [],
      },
      {
        testPath: 'tests/d-critical-duplicate.test.ts',
        runnerId: 'root-vitest',
        criticality: 'critical',
        oracleEffectiveness: 'effective',
        executionMultiplicity: 'duplicate',
        targetValidity: 'active',
        parallelSafety: 'unsafe',
        durationMs: 10,
        issueCodes: [],
      },
      {
        testPath: 'tests/c-safe-duration.test.ts',
        runnerId: 'root-vitest',
        criticality: 'standard',
        oracleEffectiveness: 'effective',
        executionMultiplicity: 'single',
        targetValidity: 'active',
        parallelSafety: 'safe_candidate',
        durationMs: 100,
        issueCodes: [],
      },
      {
        testPath: 'tests/b-obsolete.test.ts',
        runnerId: 'root-vitest',
        criticality: 'standard',
        oracleEffectiveness: 'effective',
        executionMultiplicity: 'single',
        targetValidity: 'obsolete_candidate',
        parallelSafety: 'unsafe',
        durationMs: 1000,
        issueCodes: [],
      },
      {
        testPath: 'tests/a-duplicate.test.ts',
        runnerId: 'root-vitest',
        criticality: 'standard',
        oracleEffectiveness: 'effective',
        executionMultiplicity: 'duplicate',
        targetValidity: 'active',
        parallelSafety: 'unsafe',
        durationMs: 10000,
        issueCodes: [],
      },
    ];

    const markdown = renderCanonicalSummary(artifact);
    const orderedPaths = [
      'tests/f-critical-obsolete.test.ts',
      'tests/e-critical-ineffective.test.ts',
      'tests/d-critical-duplicate.test.ts',
      'tests/c-safe-duration.test.ts',
      'tests/b-obsolete.test.ts',
      'tests/a-duplicate.test.ts',
    ];
    for (let index = 1; index < orderedPaths.length; index += 1) {
      expect(markdown.indexOf(orderedPaths[index - 1])).toBeLessThan(
        markdown.indexOf(orderedPaths[index])
      );
    }
  });

  it('atomically writes exactly the canonical JSON and Markdown summary', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'test-portfolio-audit-output-'));
    temporaryRoots.push(outputDir);
    writeFileSync(join(outputDir, 'stale.txt'), 'stale\n', 'utf8');
    const artifact = canonicalReportFixture(2);
    const canonicalBytes = canonicalJsonBytes(artifact);
    const summaryMarkdown = renderCanonicalSummary(artifact);

    const result = writeCanonicalArtifacts({
      outputDir,
      canonicalBytes,
      summaryMarkdown,
    });

    expect(readdirSync(outputDir).sort()).toEqual([
      'test-portfolio-audit.json',
      'test-portfolio-summary.md',
    ]);
    expect(readFileSync(result.auditPath)).toEqual(canonicalBytes);
    expect(readFileSync(result.summaryPath, 'utf8')).toBe(summaryMarkdown);
    expect(result.auditSha256).toBe(sha256Bytes(canonicalBytes));
    expect(JSON.parse(readFileSync(result.auditPath, 'utf8'))).not.toHaveProperty('artifactSha256');
    expect(readdirSync(outputDir).some((name) => name.endsWith('.tmp'))).toBe(false);
  });
});
