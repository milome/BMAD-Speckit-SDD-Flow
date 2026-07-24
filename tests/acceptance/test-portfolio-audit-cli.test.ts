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
