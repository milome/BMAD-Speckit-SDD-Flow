import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfigFromFile } from 'vite';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixture = require('../fixtures/test-portfolio/run-manifest-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');
const { createRunManifestPlan } = require('../../tools/ci/write-ci-run-manifest.cjs');
const {
  resolveCiShard,
  resolveVitestShard,
  runCiShard,
  runVitestShard,
} = require('../../tools/ci/run-vitest-shard.cjs');
const {
  resolveExactNodeTestPaths,
} = require('../../packages/bmad-speckit/scripts/run-node-tests.cjs');

const PARTIAL_CMD07_SELECTORS = [
  'tests/acceptance/main-agent-delivery-truth-gate.test.ts',
  'tests/acceptance/main-agent-closeout-source-authority.test.ts',
];

async function loadVitestConfigForSelectors(governedShard?: string) {
  const originalArgv = process.argv;
  const originalGovernedShard = process.env.CI_GOVERNED_SHARD;
  process.argv = [process.execPath, 'vitest', 'run', ...PARTIAL_CMD07_SELECTORS];
  if (governedShard === undefined) {
    delete process.env.CI_GOVERNED_SHARD;
  } else {
    process.env.CI_GOVERNED_SHARD = governedShard;
  }
  try {
    const config = await loadConfigFromFile(
      { command: 'serve', mode: 'test' },
      join(import.meta.dirname, '..', '..', 'vitest.config.ts'),
      process.cwd(),
      'silent'
    );
    return {
      config,
      governedShardAfterLoad: process.env.CI_GOVERNED_SHARD,
    };
  } finally {
    process.argv = originalArgv;
    if (originalGovernedShard === undefined) {
      delete process.env.CI_GOVERNED_SHARD;
    } else {
      process.env.CI_GOVERNED_SHARD = originalGovernedShard;
    }
  }
}

function writeTimingArtifact(request: any, identityKeys: string[]) {
  const commitSha = request.env.CI_COMMIT_SHA;
  const outputPath = request.env.CI_TIMING_OUTPUT;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    canonicalJsonBytes({
      commitSha,
      planHash: request.env.CI_PLAN_HASH,
      events: identityKeys.map((identityKey) => {
        const separator = identityKey.indexOf('::');
        return {
          eventId: sha256Bytes(canonicalJsonBytes({ commitSha, identityKey })),
          identityKey,
          runnerId: identityKey.slice(0, separator),
          testPath: identityKey.slice(separator + 2),
          durationMs: 1,
          outcome: 'passed',
        };
      }),
    })
  );
}

function writeJunitArtifact(request: any, identityKeys: string[]) {
  const outputPath = request.env.CI_JUNIT_OUTPUT;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<testsuites tests="${identityKeys.length}" failures="0">`,
      `  <testsuite name="${request.kind}" tests="${identityKeys.length}" failures="0">`,
      ...identityKeys.map(
        (identityKey) =>
          `    <testcase classname="${request.kind}" name="${identityKey}" time="0.001" />`
      ),
      '  </testsuite>',
      '</testsuites>',
      '',
    ].join('\n'),
    'utf8'
  );
}

function writeFailedJunitArtifact(request: any, identityKey: string) {
  const outputPath = request.env.CI_JUNIT_OUTPUT;
  const separator = identityKey.indexOf('::');
  const testPath = identityKey.slice(separator + 2);
  const suiteName = request.kind === 'vitest' ? testPath : 'node';
  const testName = request.kind === 'vitest' ? 'known baseline failure' : identityKey;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<testsuites tests="1" failures="1">',
      `  <testsuite name="${suiteName}" tests="1" failures="1">`,
      `    <testcase classname="${request.kind}" name="${testName}" time="0.001">`,
      '      <failure message="known baseline failure" />',
      '    </testcase>',
      '  </testsuite>',
      '</testsuites>',
      '',
    ].join('\n'),
    'utf8'
  );
}

function writeExecutableFixtures(repoRoot: string, identityKeys: string[]) {
  for (const identityKey of identityKeys) {
    const separator = identityKey.indexOf('::');
    const testPath = identityKey.slice(separator + 2);
    const absolutePath = join(repoRoot, ...testPath.split('/'));
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, '', 'utf8');
  }
}

function writeExactNodeFixture(repoRoot: string, source: string) {
  const packageRoot = join(repoRoot, 'packages', 'bmad-speckit');
  const testDir = join(packageRoot, 'tests');
  mkdirSync(testDir, { recursive: true });
  writeFileSync(join(testDir, 'a.test.js'), source, 'utf8');
  return packageRoot;
}

function runExactNodeFixture({
  packageRoot,
  commitSha = 'f'.repeat(40),
  planHash = `sha256:${'1'.repeat(64)}`,
  timingPath,
  junitPath,
}: {
  packageRoot: string;
  commitSha?: string;
  planHash?: string;
  timingPath: string;
  junitPath: string;
}) {
  return spawnSync(
    process.execPath,
    [
      join(process.cwd(), 'packages', 'bmad-speckit', 'scripts', 'run-node-tests.cjs'),
      '--ci-exact',
      'packages/bmad-speckit/tests/a.test.js',
    ],
    {
      cwd: packageRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        CI_COMMIT_SHA: commitSha,
        CI_PLAN_HASH: planHash,
        CI_NODE_PACKAGE_ROOT: packageRoot,
        CI_TIMING_OUTPUT: timingPath,
        CI_JUNIT_OUTPUT: junitPath,
      },
    }
  );
}

function manifest(
  lane = 'core',
  identityKeys = ['vitest::tests/a.test.ts', 'vitest::tests/b.test.ts'],
  expectedFailureIdentityKeys: string[] = []
) {
  const input = structuredClone(fixture);
  const expectedFailureIdentitySet = new Set(expectedFailureIdentityKeys);
  const selection = {
    ...input.shardPlan.selection,
    selectionStatus: 'ready',
    blockingGapCount: 0,
    uncoveredObligationIds: [],
    selected: identityKeys
      .map((identityKey) => {
        const separator = identityKey.indexOf('::');
        return {
          identityKey,
          runnerId: identityKey.slice(0, separator),
          testPath: identityKey.slice(separator + 2),
          lane,
          ...(expectedFailureIdentitySet.has(identityKey)
            ? { expectedFailureReasonCode: 'KNOWN_FAILING_TEST_FIXTURE_DRIFT' }
            : {}),
          reasonCodes: [
            'TASK8_FIXTURE',
            ...(expectedFailureIdentitySet.has(identityKey) ? ['PR_KNOWN_FAILURE_EXECUTION'] : []),
          ].sort(),
          coveredObligationIds: [],
        };
      })
      .sort((left, right) => left.identityKey.localeCompare(right.identityKey, 'en')),
  };
  const commitSha = input.repository.commitSha;
  const timingSummary = summarizeTimingEvents({
    commitSha,
    events: selection.selected
      .filter((item: any) => item.runnerId === 'vitest')
      .map((item: any) => ({
        eventId: sha256Bytes(canonicalJsonBytes({ commitSha, identityKey: item.identityKey })),
        identityKey: item.identityKey,
        runnerId: item.runnerId,
        testPath: item.testPath,
        durationMs: 1,
        outcome: 'passed',
      })),
  });
  const policy = {
    timing: {
      unknownDurationMs: 1,
      maxShardDurationMs: 120000,
      maxShardsPerLane: 4,
    },
  };
  const shardPlan = buildShardPlan({
    selection,
    timingSummary,
    policy,
    expectedCommitSha: commitSha,
    expectedEnvironmentClass: input.shardPlan.timingBinding.expectedEnvironmentClass,
  });
  Object.assign(input, {
    selectionHash: shardPlan.selectionHash,
    timingSummary,
    policy,
    policyHash: sha256Bytes(canonicalJsonBytes(policy)),
    shardPlan,
  });
  return createRunManifestPlan(input);
}

describe('exact Vitest shard execution', () => {
  it('keeps the consumer install config serial without overriding test timeout budgets', () => {
    const configSource = readFileSync(
      join(import.meta.dirname, '..', '..', 'vitest.consumer-install.config.ts'),
      'utf8'
    );
    const baseConfigSource = readFileSync(
      join(import.meta.dirname, '..', '..', 'vitest.config.ts'),
      'utf8'
    );
    const parallelConfigSource = readFileSync(
      join(import.meta.dirname, '..', '..', 'vitest.parallel-safe.config.ts'),
      'utf8'
    );

    expect(configSource).toContain("from './vitest.repo-mutating.config'");
    expect(configSource).not.toMatch(/\btestTimeout\s*:/);
    expect(baseConfigSource).toContain('requiresCanonicalPackage');
    expect(baseConfigSource).toContain(
      "globalSetup: ['tests/helpers/canonical-package-artifact.ts']"
    );
    expect(baseConfigSource).toContain('fileParallelism: false');
    expect(baseConfigSource).toContain('maxWorkers: 1');
    expect(baseConfigSource.indexOf('fileParallelism: false')).toBeLessThan(
      baseConfigSource.indexOf('...(requiresCanonicalPackage')
    );
    expect(baseConfigSource.indexOf('maxWorkers: 1')).toBeLessThan(
      baseConfigSource.indexOf('...(requiresCanonicalPackage')
    );
    expect(parallelConfigSource).toContain('fileParallelism: true');
  });

  it('skips command selector bundle preflight only for governed Vitest shards', async () => {
    const governedLoad = await loadVitestConfigForSelectors('1');
    expect(governedLoad.config?.path.replace(/\\/g, '/')).toBe(
      join(process.cwd(), 'vitest.config.ts').replace(/\\/g, '/')
    );
    expect(governedLoad.governedShardAfterLoad).toBeUndefined();
    await expect(loadVitestConfigForSelectors()).rejects.toThrow(
      /cmd07_selector_argument_missing/u
    );
  });

  it('resolves only the exact files from the governed manifest shard', () => {
    const input = manifest();

    expect(resolveVitestShard({ manifest: input, lane: 'core', shardId: 'core-01' })).toEqual({
      configPath: 'vitest.parallel-safe.config.ts',
      testPaths: ['tests/a.test.ts', 'tests/b.test.ts'],
      planHash: input.planHash,
    });
  });

  it('uses the serial config for the consumer install lane', () => {
    const input = manifest('consumer_install');

    expect(
      resolveVitestShard({
        manifest: input,
        lane: 'consumer_install',
        shardId: 'consumer_install-01',
      }).configPath
    ).toBe('vitest.repo-mutating.config.ts');
  });

  it('uses the serial config for catalog-declared repo-mutating tests', () => {
    const input = manifest('repo_mutating');

    expect(
      resolveVitestShard({
        manifest: input,
        lane: 'repo_mutating',
        shardId: 'repo_mutating-01',
      }).configPath
    ).toBe('vitest.repo-mutating.config.ts');
  });

  it('rejects missing shards, wrong runners, and outside-root paths', () => {
    const input = manifest();
    expect(() => resolveVitestShard({ manifest: input, lane: 'core', shardId: 'missing' })).toThrow(
      'CI_SHARD_NOT_FOUND'
    );

    for (const identityKey of [
      'node::tests/a.test.js',
      'vitest::packages/bmad-speckit/tests/a.test.js',
      'vitest::../outside.test.ts',
    ]) {
      const forged = structuredClone(input);
      const shardPlanBody = {
        ...forged.plan.shardPlan,
        shards: [
          {
            ...forged.plan.shardPlan.shards[0],
            identityKeys: [identityKey],
          },
        ],
      };
      delete shardPlanBody.shardPlanHash;
      forged.plan.shardPlan = {
        ...shardPlanBody,
        shardPlanHash: sha256Bytes(canonicalJsonBytes(shardPlanBody)),
      };
      forged.planHash = sha256Bytes(canonicalJsonBytes(forged.plan));
      expect(() =>
        resolveVitestShard({ manifest: forged, lane: 'core', shardId: 'core-01' })
      ).toThrow();
    }
  });

  it('rejects a Node-runner test disguised as a Vitest identity', () => {
    const input = manifest('core', ['vitest::packages/bmad-speckit/tests/a.test.js']);
    expect(() => resolveVitestShard({ manifest: input, lane: 'core', shardId: 'core-01' })).toThrow(
      'CI_SHARD_RUNNER_INVALID'
    );
  });

  it.each([
    'vitest::vitest.config.ts',
    'vitest::tools/ci/not-a-catalog-test.test.ts',
    'vitest::tests/not-a-catalog-test.test.yaml',
  ])('rejects the non-Catalog Vitest identity %s', (identityKey) => {
    const input = manifest('core', [identityKey]);

    expect(() => resolveVitestShard({ manifest: input, lane: 'core', shardId: 'core-01' })).toThrow(
      'CI_SHARD_PATH_INVALID'
    );
  });

  it('passes only the selected files and manifest commit to one Vitest process', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-vitest-shard-'));
    const calls: any[] = [];
    try {
      const input = manifest();
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts', 'vitest::tests/b.test.ts']);
      const result = runVitestShard({
        repoRoot,
        manifest: input,
        lane: 'core',
        shardId: 'core-01',
        runCommand: (request: any) => {
          calls.push(request);
          writeTimingArtifact(request, ['vitest::tests/a.test.ts', 'vitest::tests/b.test.ts']);
          writeJunitArtifact(request, ['vitest::tests/a.test.ts', 'vitest::tests/b.test.ts']);
          return { status: 0 };
        },
      });

      expect(calls).toHaveLength(1);
      expect(calls[0].args).toEqual([
        'exec',
        '--',
        'vitest',
        'run',
        '--config',
        'vitest.parallel-safe.config.ts',
        'tests/a.test.ts',
        'tests/b.test.ts',
      ]);
      expect(calls[0].env.CI_COMMIT_SHA).toBe('a'.repeat(40));
      expect(calls[0].env.CI_PLAN_HASH).toBe(input.planHash);
      expect(calls[0].env.CI_GOVERNED_SHARD).toBe('1');
      expect(calls[0].env.BMAD_SPECKIT_PRESERVE_PACKED_RUNTIME).toBe('1');
      expect(result.outcome).toBe('passed');
      expect(result.executedIdentityKeys).toEqual([
        'vitest::tests/a.test.ts',
        'vitest::tests/b.test.ts',
      ]);
      const persisted = JSON.parse(readFileSync(result.resultPath, 'utf8'));
      expect(result.commitSha).toBe(input.plan.repository.commitSha);
      expect(persisted.commitSha).toBe(input.plan.repository.commitSha);
      expect(persisted.planHash).toBe(result.planHash);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('executes a real exact Vitest file without discovering an unselected sentinel', () => {
    const repoRoot = process.cwd();
    const suffix = `${process.pid}-${Date.now()}`;
    const fixtureDir = join(repoRoot, 'tests', `.ci-shard-${suffix}`);
    const outputDir = `.artifacts/test-portfolio/lane-results/integration-${suffix}`;
    const selectedPath = `tests/.ci-shard-${suffix}/selected.test.ts`;
    const unselectedPath = join(fixtureDir, 'unselected.test.ts');
    try {
      mkdirSync(fixtureDir, { recursive: true });
      writeFileSync(
        join(fixtureDir, 'selected.test.ts'),
        "import { expect, it } from 'vitest'; it('selected', () => expect(true).toBe(true));\n",
        'utf8'
      );
      writeFileSync(unselectedPath, "throw new Error('UNSELECTED_TEST_EXECUTED');\n", 'utf8');

      const result = runVitestShard({
        repoRoot,
        manifest: manifest('core', [`vitest::${selectedPath}`]),
        lane: 'core',
        shardId: 'core-01',
        outputDir,
      });

      expect(result.exitCode).toBe(0);
      expect(result.executedIdentityKeys).toEqual([`vitest::${selectedPath}`]);
      expect(readFileSync(join(repoRoot, result.junitPath), 'utf8')).toContain(selectedPath);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
      rmSync(join(repoRoot, outputDir), { recursive: true, force: true });
    }
  });

  it('fails before runner invocation when a manifest-selected file is missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-missing-shard-path-'));
    try {
      expect(() =>
        runVitestShard({
          repoRoot,
          manifest: manifest('core', ['vitest::tests/missing.test.ts']),
          lane: 'core',
          shardId: 'core-01',
          runCommand: () => {
            throw new Error('RUNNER_MUST_NOT_START');
          },
        })
      ).toThrow('CI_SHARD_PATH_MISSING');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('preserves a failed runner exit code and its emitted lane evidence', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-failed-shard-'));
    try {
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts']);
      const result = runVitestShard({
        repoRoot,
        manifest: manifest('core', ['vitest::tests/a.test.ts']),
        lane: 'core',
        shardId: 'core-01',
        runCommand: (request: any) => {
          writeTimingArtifact(request, ['vitest::tests/a.test.ts']);
          writeJunitArtifact(request, ['vitest::tests/a.test.ts']);
          return { status: 7 };
        },
      });

      expect(result.outcome).toBe('failed');
      expect(result.exitCode).toBe(7);
      expect(readFileSync(join(repoRoot, result.junitPath), 'utf8')).toContain(
        'vitest::tests/a.test.ts'
      );
      expect(
        JSON.parse(readFileSync(join(repoRoot, result.timingPath), 'utf8')).events
      ).toHaveLength(1);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('preserves a failed runner exit when timing evidence covers only a valid subset', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-failed-partial-shard-'));
    try {
      const input = manifest('core', ['vitest::tests/a.test.ts', 'vitest::tests/b.test.ts']);
      writeExecutableFixtures(repoRoot, input.plan.shardPlan.shards[0].identityKeys);
      const result = runVitestShard({
        repoRoot,
        manifest: input,
        lane: 'core',
        shardId: 'core-01',
        runCommand: (request: any) => {
          writeTimingArtifact(request, ['vitest::tests/a.test.ts']);
          writeJunitArtifact(request, ['vitest::tests/a.test.ts']);
          return { status: 17 };
        },
      });

      expect(result.exitCode).toBe(17);
      expect(result.outcome).toBe('failed');
      expect(result.evidenceStatus).toEqual({
        junit: 'complete',
        timing: 'partial',
      });
      expect(
        JSON.parse(readFileSync(join(repoRoot, result.timingPath), 'utf8')).events
      ).toHaveLength(1);
      expect(JSON.parse(readFileSync(result.resultPath, 'utf8')).evidenceStatus.timing).toBe(
        'partial'
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('preserves a failed runner exit and marks malformed timing evidence invalid', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-failed-invalid-shard-'));
    try {
      const input = manifest('core', ['vitest::tests/a.test.ts']);
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts']);
      const result = runVitestShard({
        repoRoot,
        manifest: input,
        lane: 'core',
        shardId: 'core-01',
        runCommand: (request: any) => {
          mkdirSync(dirname(request.env.CI_TIMING_OUTPUT), { recursive: true });
          writeFileSync(request.env.CI_TIMING_OUTPUT, '{"not":"canonical"}', 'utf8');
          writeJunitArtifact(request, ['vitest::tests/a.test.ts']);
          return { status: 19 };
        },
      });

      expect(result.exitCode).toBe(19);
      expect(result.outcome).toBe('failed');
      expect(result.evidenceStatus).toEqual({
        junit: 'complete',
        timing: 'invalid',
      });
      expect(existsSync(join(repoRoot, result.timingPath))).toBe(false);
      expect(JSON.parse(readFileSync(result.resultPath, 'utf8')).evidenceStatus.timing).toBe(
        'invalid'
      );
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('does not reuse stale runner evidence when the current runner emits nothing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-stale-shard-'));
    try {
      const input = manifest('core', ['vitest::tests/a.test.ts']);
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts']);
      const outputDir = join(repoRoot, '.artifacts', 'test-portfolio', 'lane-results');
      const request = {
        kind: 'vitest',
        env: {
          CI_COMMIT_SHA: input.plan.repository.commitSha,
          CI_PLAN_HASH: input.planHash,
          CI_JUNIT_OUTPUT: join(outputDir, 'core-core-01.vitest.junit.xml'),
          CI_TIMING_OUTPUT: join(outputDir, 'core-core-01.vitest.timing.json'),
        },
      };
      writeTimingArtifact(request, ['vitest::tests/a.test.ts']);
      writeJunitArtifact(request, ['vitest::tests/a.test.ts']);

      const result = runVitestShard({
        repoRoot,
        manifest: input,
        lane: 'core',
        shardId: 'core-01',
        runCommand: () => ({ status: 9 }),
      });

      expect(result.exitCode).toBe(9);
      expect(result.outcome).toBe('failed');
      expect(() => readFileSync(join(repoRoot, result.junitPath), 'utf8')).toThrow();
      expect(() => readFileSync(join(repoRoot, result.timingPath), 'utf8')).toThrow();
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('deletes a stale normalized result before runner invocation and leaves none on throw', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-stale-result-'));
    try {
      const input = manifest('core', ['vitest::tests/a.test.ts']);
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts']);
      const resultPath = join(
        repoRoot,
        '.artifacts',
        'test-portfolio',
        'lane-results',
        'core-core-01.result.json'
      );
      mkdirSync(dirname(resultPath), { recursive: true });
      writeFileSync(resultPath, '{"stale":true}\n', 'utf8');

      expect(() =>
        runVitestShard({
          repoRoot,
          manifest: input,
          lane: 'core',
          shardId: 'core-01',
          runCommand: () => {
            if (existsSync(resultPath)) throw new Error('STALE_RESULT_VISIBLE');
            throw new Error('CURRENT_RUNNER_THROW');
          },
        })
      ).toThrow('CURRENT_RUNNER_THROW');
      expect(existsSync(resultPath)).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects timing evidence bound to a different manifest plan', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-stale-plan-'));
    try {
      const input = manifest('core', ['vitest::tests/a.test.ts']);
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts']);
      expect(() =>
        runVitestShard({
          repoRoot,
          manifest: input,
          lane: 'core',
          shardId: 'core-01',
          runCommand: (request: any) => {
            writeTimingArtifact(
              {
                ...request,
                env: { ...request.env, CI_PLAN_HASH: `sha256:${'0'.repeat(64)}` },
              },
              ['vitest::tests/a.test.ts']
            );
            writeJunitArtifact(request, ['vitest::tests/a.test.ts']);
            return { status: 0 };
          },
        })
      ).toThrow('CI_TIMING_EVIDENCE_INVALID');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects an output directory before starting a runner outside the governed root', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-output-boundary-'));
    const sentinel = join(repoRoot, 'tests', 'sentinel.txt');
    try {
      writeExecutableFixtures(repoRoot, ['vitest::tests/a.test.ts']);
      writeFileSync(sentinel, 'keep', 'utf8');
      expect(() =>
        runVitestShard({
          repoRoot,
          manifest: manifest('core', ['vitest::tests/a.test.ts']),
          lane: 'core',
          shardId: 'core-01',
          outputDir: 'tests',
          runCommand: () => {
            throw new Error('RUNNER_MUST_NOT_START');
          },
        })
      ).toThrow('CI_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
      expect(readFileSync(sentinel, 'utf8')).toBe('keep');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('partitions a mixed manifest shard by runner without inventing a second selection', () => {
    const input = manifest('core', [
      'vitest::tests/a.test.ts',
      'node::packages/bmad-speckit/tests/a.test.js',
    ]);

    expect(resolveCiShard({ manifest: input, lane: 'core', shardId: 'core-01' })).toEqual({
      configPath: 'vitest.parallel-safe.config.ts',
      vitestPaths: ['tests/a.test.ts'],
      nodePaths: ['packages/bmad-speckit/tests/a.test.js'],
      planHash: input.planHash,
    });
  });

  it('executes each runner subset exactly once and reports the full manifest identity set', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-mixed-shard-'));
    const calls: any[] = [];
    try {
      const input = manifest('core', [
        'vitest::tests/a.test.ts',
        'node::packages/bmad-speckit/tests/a.test.js',
      ]);
      writeExecutableFixtures(repoRoot, input.plan.shardPlan.shards[0].identityKeys);
      const result = runCiShard({
        repoRoot,
        manifest: input,
        lane: 'core',
        shardId: 'core-01',
        runCommand: (request: any) => {
          calls.push(request);
          writeTimingArtifact(
            request,
            request.kind === 'vitest'
              ? ['vitest::tests/a.test.ts']
              : ['node::packages/bmad-speckit/tests/a.test.js']
          );
          writeJunitArtifact(
            request,
            request.kind === 'vitest'
              ? ['vitest::tests/a.test.ts']
              : ['node::packages/bmad-speckit/tests/a.test.js']
          );
          return { status: 0 };
        },
      });

      expect(calls.map((call) => call.kind)).toEqual(['vitest', 'node_test']);
      expect(calls[0].args).toContain('tests/a.test.ts');
      expect(calls[1].args).toContain('packages/bmad-speckit/tests/a.test.js');
      expect(result.executedIdentityKeys).toEqual([
        'node::packages/bmad-speckit/tests/a.test.js',
        'vitest::tests/a.test.ts',
      ]);
      expect(result.outcome).toBe('passed');
      expect(
        JSON.parse(readFileSync(join(repoRoot, result.timingPath), 'utf8')).events
      ).toHaveLength(2);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('accepts a complete isolated expected-failure shard without hiding its failed identity', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-expected-failure-shard-'));
    const identityKeys = ['node::packages/bmad-speckit/tests/a.test.js', 'vitest::tests/a.test.ts'];
    try {
      const input = manifest('feature', identityKeys, identityKeys);
      const shard = input.plan.shardPlan.shards.find(
        (candidate: any) => candidate.shardId === 'feature-xfail-01'
      );
      expect(shard).toMatchObject({
        lane: 'feature',
        identityKeys,
        expectedFailureIdentityKeys: identityKeys,
      });
      writeExecutableFixtures(repoRoot, identityKeys);
      const result = runCiShard({
        repoRoot,
        manifest: input,
        lane: 'feature',
        shardId: 'feature-xfail-01',
        runCommand: (request: any) => {
          const identityKey = request.kind === 'vitest' ? identityKeys[1] : identityKeys[0];
          writeTimingArtifact(request, [identityKey]);
          writeFailedJunitArtifact(request, identityKey);
          return { status: 1 };
        },
      });

      expect(result).toMatchObject({
        outcome: 'expected_failed',
        failedIdentityKeys: identityKeys,
        exitCode: 0,
        evidenceStatus: {
          junit: 'complete',
          timing: 'complete',
        },
      });
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('keeps an expected-failure shard blocking when Node JUnit contains an unknown failure', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-expected-failure-unknown-node-'));
    const nodeIdentity = 'node::packages/bmad-speckit/tests/a.test.js';
    const vitestIdentity = 'vitest::tests/a.test.ts';
    const identityKeys = [nodeIdentity, vitestIdentity];
    try {
      const input = manifest('feature', identityKeys, identityKeys);
      writeExecutableFixtures(repoRoot, identityKeys);
      const result = runCiShard({
        repoRoot,
        manifest: input,
        lane: 'feature',
        shardId: 'feature-xfail-01',
        runCommand: (request: any) => {
          const identityKey = request.kind === 'vitest' ? vitestIdentity : nodeIdentity;
          writeTimingArtifact(request, [identityKey]);
          if (request.kind === 'vitest') {
            writeJunitArtifact(request, [identityKey]);
            return { status: 0 };
          }
          mkdirSync(dirname(request.env.CI_JUNIT_OUTPUT), { recursive: true });
          writeFileSync(
            request.env.CI_JUNIT_OUTPUT,
            [
              '<?xml version="1.0" encoding="UTF-8"?>',
              '<testsuites tests="2" failures="2">',
              '  <testsuite name="node" tests="2" failures="2">',
              `    <testcase classname="node" name="${identityKey}" time="0.001">`,
              '      <failure message="known baseline failure" />',
              '    </testcase>',
              '    <testcase classname="node" name="node::tests/unplanned.test.js" time="0.001">',
              '      <failure message="unknown failure" />',
              '    </testcase>',
              '  </testsuite>',
              '</testsuites>',
              '',
            ].join('\n'),
            'utf8'
          );
          return { status: 23 };
        },
      });

      expect(result).toMatchObject({
        outcome: 'failed',
        exitCode: 23,
        evidenceStatus: {
          junit: 'complete',
          timing: 'complete',
        },
      });
      expect(result).not.toHaveProperty('failedIdentityKeys');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('accepts only exact package-relative Node test paths', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-node-root-'));
    const packageRoot = join(repoRoot, 'packages', 'bmad-speckit');
    try {
      writeExecutableFixtures(repoRoot, [
        'node::packages/bmad-speckit/tests/a.test.js',
        'node::packages/bmad-speckit/tests/nested/b.test.js',
      ]);
      expect(
        resolveExactNodeTestPaths({
          packageRoot,
          requestedPaths: [
            'packages/bmad-speckit/tests/a.test.js',
            'packages/bmad-speckit/tests/nested/b.test.js',
          ],
        })
      ).toEqual(['tests/a.test.js', 'tests/nested/b.test.js']);

      expect(() =>
        resolveExactNodeTestPaths({
          packageRoot: join(repoRoot, 'wrong-package-root'),
          expectedPackageRoot: packageRoot,
          requestedPaths: ['packages/bmad-speckit/tests/a.test.js'],
        })
      ).toThrow('NODE_TEST_EXACT_ROOT_MISMATCH');

      for (const requestedPaths of [
        ['tests/a.test.js'],
        ['packages/bmad-speckit/tests/a'],
        ['packages/bmad-speckit/tests/../outside.test.js'],
        ['C:/repo/packages/bmad-speckit/tests/a.test.js'],
      ]) {
        expect(() =>
          resolveExactNodeTestPaths({
            packageRoot,
            requestedPaths,
          })
        ).toThrow('NODE_TEST_EXACT_PATH_INVALID');
      }
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('emits canonical timing evidence from the exact Node runner', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-node-exact-'));
    const packageRoot = writeExactNodeFixture(
      repoRoot,
      [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "test('passes', () => assert.equal(1, 1));",
      ].join('\n')
    );
    const outputDir = join(repoRoot, '.artifacts', 'test-portfolio', 'node-exact');
    const timingPath = join(outputDir, 'timing.json');
    const junitPath = join(outputDir, 'junit.xml');
    try {
      const commitSha = 'f'.repeat(40);
      const planHash = `sha256:${'1'.repeat(64)}`;
      const result = runExactNodeFixture({
        packageRoot,
        commitSha,
        planHash,
        timingPath,
        junitPath,
      });

      expect(result.status, result.stderr).toBe(0);
      const timing = JSON.parse(readFileSync(timingPath, 'utf8'));
      expect(timing.commitSha).toBe(commitSha);
      expect(timing.planHash).toBe(planHash);
      expect(timing.events).toEqual([
        expect.objectContaining({
          identityKey: 'node::packages/bmad-speckit/tests/a.test.js',
          runnerId: 'node',
          testPath: 'packages/bmad-speckit/tests/a.test.js',
          outcome: 'passed',
        }),
      ]);
      expect(timing.events[0].durationMs).toBeGreaterThan(0);
      expect(timing.events[0].eventId).toBe(
        sha256Bytes(
          canonicalJsonBytes({
            commitSha,
            identityKey: 'node::packages/bmad-speckit/tests/a.test.js',
          })
        )
      );
      const junit = readFileSync(junitPath, 'utf8');
      expect(junit).toContain('<testsuite name="node"');
      expect(junit).toContain('node::packages/bmad-speckit/tests/a.test.js');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('governs both exact Node outputs before deleting files or spawning a test process', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-node-governed-output-'));
    const executedSentinel = join(repoRoot, 'executed.txt');
    const packageRoot = writeExactNodeFixture(
      repoRoot,
      [
        "const test = require('node:test');",
        "const { writeFileSync } = require('node:fs');",
        `test('must not start', () => writeFileSync(${JSON.stringify(executedSentinel)}, 'ran'));`,
      ].join('\n')
    );
    const governedDir = join(repoRoot, '.artifacts', 'test-portfolio', 'node-exact');
    const junitPath = join(governedDir, 'junit.xml');
    const outsideTimingPath = join(repoRoot, 'outside-timing.json');
    try {
      mkdirSync(governedDir, { recursive: true });
      writeFileSync(junitPath, 'keep-junit', 'utf8');
      writeFileSync(outsideTimingPath, 'keep-timing', 'utf8');

      const result = runExactNodeFixture({
        packageRoot,
        timingPath: outsideTimingPath,
        junitPath,
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('CI_NODE_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
      expect(readFileSync(junitPath, 'utf8')).toBe('keep-junit');
      expect(readFileSync(outsideTimingPath, 'utf8')).toBe('keep-timing');
      expect(existsSync(executedSentinel)).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects an exact Node output path whose existing path chain contains a symlink', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-node-linked-output-'));
    const executedSentinel = join(repoRoot, 'executed.txt');
    const packageRoot = writeExactNodeFixture(
      repoRoot,
      [
        "const test = require('node:test');",
        "const { writeFileSync } = require('node:fs');",
        `test('must not start', () => writeFileSync(${JSON.stringify(executedSentinel)}, 'ran'));`,
      ].join('\n')
    );
    const artifactRoot = join(repoRoot, '.artifacts', 'test-portfolio');
    const realOutputDir = join(artifactRoot, 'real');
    const linkedOutputDir = join(artifactRoot, 'linked');
    try {
      mkdirSync(realOutputDir, { recursive: true });
      symlinkSync(
        realOutputDir,
        linkedOutputDir,
        process.platform === 'win32' ? 'junction' : 'dir'
      );

      const result = runExactNodeFixture({
        packageRoot,
        timingPath: join(linkedOutputDir, 'timing.json'),
        junitPath: join(linkedOutputDir, 'junit.xml'),
      });

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain('CI_NODE_ARTIFACT_PATH_OUTSIDE_GOVERNED_ROOT');
      expect(existsSync(join(realOutputDir, 'timing.json'))).toBe(false);
      expect(existsSync(join(realOutputDir, 'junit.xml'))).toBe(false);
      expect(existsSync(executedSentinel)).toBe(false);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });
});
