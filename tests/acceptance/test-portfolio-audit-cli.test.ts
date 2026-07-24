import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  buildPortfolioAudit,
  discoverConfiguredTests,
  renderSummary,
  writeAuditArtifacts,
} = require('../../tools/test-portfolio-audit/run.cjs');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  renderSummary: renderCanonicalSummary,
  writeAuditArtifacts: writeCanonicalArtifacts,
} = require('../../tools/test-portfolio-audit/report.cjs');

const temporaryRoots: string[] = [];

function createFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'test-portfolio-audit-'));
  temporaryRoots.push(root);
  mkdirSync(join(root, 'src'), { recursive: true });
  mkdirSync(join(root, 'tests', 'acceptance'), { recursive: true });
  writeFileSync(join(root, 'src', 'target.ts'), 'export const value = 1;\n', 'utf8');
  writeFileSync(join(root, 'src', 'helper.test.ts'), 'export const helper = true;\n', 'utf8');
  writeFileSync(
    join(root, 'tests', 'effective.test.ts'),
    [
      "import { helper } from '../src/helper.test';",
      "import { value } from '../src/target';",
      "test('works', () => expect(helper && value).toBe(1));",
      '',
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'no-oracle.test.ts'),
    "test('does work', () => { const value = 1 + 1; void value; });\n",
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'unsafe.test.ts'),
    "test('mutates global state', () => { process.env.PORT = '3000'; });\n",
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'acceptance', 'release-install.test.ts'),
    "test('packages release', () => expect('package').toContain('pack'));\n",
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'string-fixture.test.ts'),
    [
      "test('keeps fixture text inert', () => {",
      "  const fixture = \"import '../missing'; process.env.PORT = '3000';\";",
      '  // 中文注释不得改变后续 token 的位置。',
      "  expect(fixture).toContain('PORT');",
      '});',
      '',
    ].join('\n'),
    'utf8'
  );
  writeFileSync(
    join(root, 'tests', 'custom-harness.test.js'),
    [
      'function check() { return true; }',
      'let failed = 0;',
      'if (!check()) failed++;',
      "if (failed > 0) throw new Error('failed');",
      '',
    ].join('\n'),
    'utf8'
  );
  return root;
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('test portfolio audit minimum end-to-end slice', () => {
  it('discovers executable files from the configured Vitest and Node runners', () => {
    const result = discoverConfiguredTests({ repoRoot: process.cwd() });

    expect(result.issues).toEqual([]);
    expect(result.tests.length).toBeGreaterThanOrEqual(900);
    expect(new Set(result.tests.map((row: { runnerId: string }) => row.runnerId))).toEqual(
      new Set(['root-vitest', 'bmad-speckit-node-test'])
    );
    const nodeRoute = result.tests.find(
      (row: { testPath: string }) =>
        row.testPath === 'packages/bmad-speckit/tests/ai-registry.test.js'
    );
    expect(
      nodeRoute.routeRefs.filter((value: string) =>
        value.startsWith('route:.github/workflows/ci.yml/test#')
      )
    ).toHaveLength(1);
    expect(
      result.tests.some(
        (row: { testPath: string }) =>
          row.testPath === 'tests/acceptance/accept-install-consumer-cli.test.ts'
      )
    ).toBe(true);
    const consumerInstall = result.tests.find(
      (row: { testPath: string }) =>
        row.testPath === 'tests/acceptance/accept-install-consumer-cli.test.ts'
    );
    expect(consumerInstall.routeRefs).toEqual([
      expect.stringMatching(/^route:\.github\/workflows\/ci\.yml\/test#L115$/),
    ]);
  }, 30_000);

  it('produces conservative evidence-backed classifications and exactly two artifacts', () => {
    const repoRoot = createFixture();
    const discoveredTests = [
      {
        testPath: 'tests/effective.test.ts',
        runnerId: 'root-vitest',
        routeRefs: ['route:ci/test#default', 'route:ci/test#focused'],
      },
      {
        testPath: 'tests/no-oracle.test.ts',
        runnerId: 'root-vitest',
        routeRefs: ['route:ci/test#default'],
      },
      {
        testPath: 'tests/unsafe.test.ts',
        runnerId: 'root-vitest',
        routeRefs: ['route:ci/test#default'],
      },
      {
        testPath: 'tests/acceptance/release-install.test.ts',
        runnerId: 'root-vitest',
        routeRefs: ['route:release/release#test'],
      },
      {
        testPath: 'tests/string-fixture.test.ts',
        runnerId: 'root-vitest',
        routeRefs: ['route:ci/test#default'],
      },
      {
        testPath: 'tests/custom-harness.test.js',
        runnerId: 'bmad-speckit-node-test',
        routeRefs: ['route:ci/test#node'],
      },
    ];

    const audit = buildPortfolioAudit({ repoRoot, discoveredTests, discoveryIssues: [] });
    const byPath = new Map(
      audit.tests.map((row: { testPath: string }) => [row.testPath, row] as const)
    );

    expect(audit.status).toBe('COMPLETE');
    expect(byPath.get('tests/effective.test.ts')).toMatchObject({
      executionMultiplicity: 'duplicate',
      targetValidity: 'active',
      oracleEffectiveness: 'effective',
    });
    expect(byPath.get('tests/no-oracle.test.ts')).toMatchObject({
      oracleEffectiveness: 'ineffective_candidate',
      issueCodes: expect.arrayContaining(['ORACLE_DIRECT_ASSERTION_NOT_FOUND']),
    });
    expect(byPath.get('tests/unsafe.test.ts')).toMatchObject({
      parallelSafety: 'unsafe',
      issueCodes: expect.arrayContaining(['PARALLEL_PROCESS_ENV_MUTATION']),
    });
    expect(byPath.get('tests/acceptance/release-install.test.ts')).toMatchObject({
      criticality: 'critical',
    });
    expect(byPath.get('tests/string-fixture.test.ts')).toMatchObject({
      targetValidity: 'ambiguous',
      oracleEffectiveness: 'effective',
      parallelSafety: 'unknown',
    });
    expect(byPath.get('tests/custom-harness.test.js')).toMatchObject({
      oracleEffectiveness: 'effective',
    });

    const outputDir = join(repoRoot, '.artifacts', 'ci');
    const written = writeAuditArtifacts({ audit, outputDir });
    expect(readdirSync(outputDir).sort()).toEqual([
      'test-portfolio-audit.json',
      'test-portfolio-summary.md',
    ]);
    expect(JSON.parse(readFileSync(written.jsonPath, 'utf8'))).toEqual(audit);
    expect(readFileSync(written.markdownPath, 'utf8')).toBe(renderSummary(audit));
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
    expect(markdown).toContain('Critical + ineffective');
    expect(markdown.match(/tests\/priority-\d+\.test\.ts/gu)?.length).toBe(20);
    expect(markdown).not.toContain('sourceBody');
  });

  it('orders priority rows by category, duration, and lexical path', () => {
    const artifact = canonicalReportFixture(0);
    artifact.tests = [
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
