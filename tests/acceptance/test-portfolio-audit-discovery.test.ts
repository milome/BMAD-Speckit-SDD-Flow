import { createRequire } from 'node:module';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  discoverNodeTests,
  discoverVitestTests,
  reconcileDiscovery,
  scanFilesystemCandidates,
} = require('../../tools/test-portfolio-audit/discovery.cjs');
const { compareTestIdentity } = require('../../tools/test-portfolio-audit/canonical.cjs');

const FIXTURE = join(process.cwd(), 'tests/fixtures/test-portfolio-audit/discovery');
const temporaryRoots: string[] = [];

function createTemporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

function writeFixtureFile(root: string, relativePath: string, source = ''): string {
  const filePath = join(root, relativePath);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, source, 'utf8');
  return filePath;
}

function resolveExpectedVitestCli(): string {
  try {
    return require.resolve('vitest/vitest.mjs');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error;
    return join(dirname(require.resolve('vitest/package.json')), 'vitest.mjs');
  }
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true });
  }
});

describe('test portfolio discovery', () => {
  it('scans test-shaped files and configured literal includes in deterministic order', () => {
    const root = createTemporaryRoot('test-portfolio-filesystem-');
    writeFixtureFile(root, 'tests/zeta.test.ts');
    writeFixtureFile(root, 'tests/alpha.spec.js');
    writeFixtureFile(root, 'tests/configured.check.ts');
    writeFixtureFile(root, 'node_modules/ignored.test.ts');
    writeFixtureFile(root, 'dist/ignored.spec.ts');
    writeFixtureFile(root, '.git/ignored.test.js');
    writeFixtureFile(root, '.worktrees/ignored.test.ts');
    writeFixtureFile(root, '.codex-tmp/ignored.test.ts');
    writeFixtureFile(root, '.artifacts/ignored.test.ts');

    expect(
      scanFilesystemCandidates({
        repoRoot: root,
        configuredIncludes: ['tests/configured.check.ts'],
      })
    ).toEqual(['tests/alpha.spec.js', 'tests/configured.check.ts', 'tests/zeta.test.ts']);
  });

  it('uses Vitest resolved files instead of filename glob authority', () => {
    const result = discoverVitestTests({
      repoRoot: FIXTURE,
      configPath: 'vitest.config.ts',
    });

    expect(result.status).toBe('complete');
    expect(result.tests).toEqual([
      {
        testPath: 'tests/runner-only.check.ts',
        runnerId: 'root-vitest',
      },
    ]);
    expect(result.explicitExclusions).toEqual(['tests/candidate-only.test.ts']);
    expect(result.configuredCandidateRefs).toEqual([
      {
        testPath: 'tests/runner-only.check.ts',
        sourceRef: 'source:vitest.config.ts#test.include',
      },
    ]);
    expect(result.issues).toEqual([]);
  }, 30_000);

  it('fails closed when the Vitest runner cannot resolve its executable set', () => {
    let outputPath = '';
    const calls: Array<{
      command: string;
      args: string[];
      options: Record<string, unknown>;
    }> = [];

    const result = discoverVitestTests({
      repoRoot: FIXTURE,
      configPath: 'vitest.config.ts',
      spawn(command: string, args: string[], options: Record<string, unknown>) {
        outputPath = args.find((arg) => arg.startsWith('--json='))!.slice('--json='.length);
        calls.push({ command, args, options });
        return { status: 1, stderr: 'runner failed' };
      },
    });

    expect(result).toMatchObject({
      runnerId: 'root-vitest',
      status: 'unsupported',
      tests: [],
      issues: [{ code: 'RUNNER_DISCOVERY_FAILED', runnerId: 'root-vitest' }],
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe(process.execPath);
    expect(calls[0].args[0]).toBe(resolveExpectedVitestCli());
    expect(calls[0].options).toMatchObject({
      cwd: FIXTURE,
      encoding: 'utf8',
      windowsHide: true,
    });
    expect(existsSync(outputPath)).toBe(false);
    expect(existsSync(dirname(outputPath))).toBe(false);
  });

  it('marks dynamic Vitest exclusions unsupported without inventing literal exclusions', () => {
    const root = createTemporaryRoot('test-portfolio-dynamic-exclusion-');
    const runnerPath = writeFixtureFile(
      root,
      'tests/runner-only.check.ts',
      "test('runner', () => {});\n"
    );
    writeFixtureFile(
      root,
      'vitest.config.ts',
      [
        "import { defineConfig } from 'vitest/config';",
        "const exclusions = ['tests/candidate-only.test.ts'];",
        'export default defineConfig({',
        '  test: {',
        "    include: ['tests/runner-only.check.ts'],",
        '    exclude: [...exclusions],',
        '  },',
        '});',
        '',
      ].join('\n')
    );

    const result = discoverVitestTests({
      repoRoot: root,
      configPath: 'vitest.config.ts',
      spawn(_command: string, args: string[]) {
        const outputPath = args.find((arg) => arg.startsWith('--json='))!.slice('--json='.length);
        writeFileSync(outputPath, `${JSON.stringify([{ file: runnerPath }])}\n`, 'utf8');
        return { status: 0, stderr: '' };
      },
    });

    expect(result.status).toBe('unsupported');
    expect(result.tests).toEqual([
      {
        testPath: 'tests/runner-only.check.ts',
        runnerId: 'root-vitest',
      },
    ]);
    expect(result.explicitExclusions).toEqual([]);
    expect(result.issues).toEqual([
      {
        code: 'VITEST_EXCLUSION_DYNAMIC',
        runnerId: 'root-vitest',
        sourceRef: 'source:vitest.config.ts#test.exclude',
      },
    ]);
  });

  it('binds the package Node adapter to its declared discovery contract', () => {
    const result = discoverNodeTests({ repoRoot: process.cwd() });

    expect(result.status).toBe('complete');
    expect(result.runnerId).toBe('package-node-test');
    expect(result.tests.length).toBeGreaterThan(0);
    expect(result.tests).toEqual([...result.tests].sort(compareTestIdentity));
    expect(result.issues).toEqual([]);
  });

  it('rejects a missing Node runner discovery contract', () => {
    const root = createTemporaryRoot('test-portfolio-node-drift-');
    writeFixtureFile(
      root,
      'packages/bmad-speckit/scripts/run-node-tests.cjs',
      'module.exports = {};\n'
    );
    writeFixtureFile(root, 'packages/bmad-speckit/tests/example.test.js');

    expect(discoverNodeTests({ repoRoot: root })).toMatchObject({
      runnerId: 'package-node-test',
      status: 'unsupported',
      tests: [],
      issues: [{ code: 'NODE_RUNNER_CONVENTION_DRIFT' }],
    });
  });

  it('rejects a Node runner whose exported contract version changes after loading', () => {
    const root = createTemporaryRoot('test-portfolio-node-version-drift-');
    const scriptPath = writeFixtureFile(
      root,
      'packages/bmad-speckit/scripts/run-node-tests.cjs',
      "module.exports.DISCOVERY_CONTRACT_VERSION = 'node-runner-discovery/v1';\n"
    );
    writeFixtureFile(root, 'packages/bmad-speckit/tests/example.test.js');

    expect(discoverNodeTests({ repoRoot: root }).status).toBe('complete');
    writeFileSync(
      scriptPath,
      "module.exports.DISCOVERY_CONTRACT_VERSION = 'node-runner-discovery/v2';\n",
      'utf8'
    );

    expect(discoverNodeTests({ repoRoot: root })).toMatchObject({
      runnerId: 'package-node-test',
      status: 'unsupported',
      tests: [],
      issues: [{ code: 'NODE_RUNNER_CONVENTION_DRIFT' }],
    });
  });

  it.each([
    ['absent', false],
    ['present', true],
  ])('restores an adapter module cache entry that was %s before discovery', (_state, present) => {
    const root = createTemporaryRoot('test-portfolio-node-cache-');
    const scriptPath = writeFixtureFile(
      root,
      'packages/bmad-speckit/scripts/run-node-tests.cjs',
      "module.exports.DISCOVERY_CONTRACT_VERSION = 'node-runner-discovery/v1';\n"
    );
    writeFixtureFile(root, 'packages/bmad-speckit/tests/example.test.js');
    const resolvedScript = require.resolve(scriptPath);
    delete require.cache[resolvedScript];
    if (present) require(resolvedScript);
    const originalCacheEntry = require.cache[resolvedScript];

    try {
      expect(discoverNodeTests({ repoRoot: root }).status).toBe('complete');
      expect(require.cache[resolvedScript]).toBe(originalCacheEntry);
    } finally {
      delete require.cache[resolvedScript];
    }
  });

  it('keeps both unexplained directions visible before configured refs are supplied', () => {
    const filesystemCandidates = scanFilesystemCandidates({ repoRoot: FIXTURE });
    const result = reconcileDiscovery({
      runnerResults: [
        {
          runnerId: 'fixture-vitest',
          status: 'complete',
          tests: [{ testPath: 'tests/runner-only.check.ts', runnerId: 'fixture-vitest' }],
          explicitExclusions: ['tests/candidate-only.test.ts'],
          issues: [],
        },
      ],
      filesystemCandidates,
      configuredCandidateRefs: [],
    });

    expect(result.runnerResolved).toEqual(['tests/runner-only.check.ts']);
    expect(result.candidates).toEqual(['tests/candidate-only.test.ts']);
    expect(result.runnerOnly).toEqual(['tests/runner-only.check.ts']);
    expect(result.candidateOnly).toEqual(['tests/candidate-only.test.ts']);
    expect(result.unexplainedRunnerOnly).toEqual(['tests/runner-only.check.ts']);
    expect(result.explainedCandidateOnly).toEqual([
      {
        testPath: 'tests/candidate-only.test.ts',
        reason: 'EXPLICIT_RUNNER_EXCLUSION',
      },
    ]);
    expect(result.unexplainedCandidateOnly).toEqual([]);
    expect(result.complete).toBe(false);
  });

  it('reconciles the real adapter when configured includes join the candidate set', () => {
    const runnerResult = discoverVitestTests({
      repoRoot: FIXTURE,
      configPath: 'vitest.config.ts',
    });
    const result = reconcileDiscovery({
      runnerResults: [runnerResult],
      filesystemCandidates: scanFilesystemCandidates({ repoRoot: FIXTURE }),
      configuredCandidateRefs: runnerResult.configuredCandidateRefs,
    });

    expect(result.runnerResolved).toEqual(['tests/runner-only.check.ts']);
    expect(result.candidates).toEqual([
      'tests/candidate-only.test.ts',
      'tests/runner-only.check.ts',
    ]);
    expect(result.runnerOnly).toEqual([]);
    expect(result.candidateOnly).toEqual(['tests/candidate-only.test.ts']);
    expect(result.unexplainedRunnerOnly).toEqual([]);
    expect(result.explainedCandidateOnly).toEqual([
      {
        testPath: 'tests/candidate-only.test.ts',
        reason: 'EXPLICIT_RUNNER_EXCLUSION',
      },
    ]);
    expect(result.unexplainedCandidateOnly).toEqual([]);
    expect(result.complete).toBe(true);
  }, 30_000);
});
