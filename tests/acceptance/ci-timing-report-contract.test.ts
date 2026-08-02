import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import CanonicalTimingReporter from '../../tools/ci/vitest-timing-reporter';

const require = createRequire(import.meta.url);
const fixture = require('../fixtures/test-portfolio/timing-events.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  createBootstrapTimingSummary,
  main: summarizeTimingMain,
  summarizeTimingArtifactFiles,
  summarizeTimingArtifacts,
  summarizeTimingEvents,
  validateTimingSummary,
} = require('../../tools/ci/summarize-test-timings.cjs');

function timingEventId(commitSha: string, identityKey: string): string {
  return sha256Bytes(canonicalJsonBytes({ commitSha, identityKey }));
}

let previousPlanHash: string | undefined;

beforeEach(() => {
  previousPlanHash = process.env.CI_PLAN_HASH;
  process.env.CI_PLAN_HASH = `sha256:${'1'.repeat(64)}`;
});

afterEach(() => {
  if (previousPlanHash === undefined) delete process.env.CI_PLAN_HASH;
  else process.env.CI_PLAN_HASH = previousPlanHash;
});

describe('canonical timing report contract', () => {
  it('represents the first run with an explicit empty timing snapshot', () => {
    const summary = createBootstrapTimingSummary();

    expect(summary).toEqual({
      schemaVersion: 'ci-test-timing-summary/v1',
      commitShas: [],
      runs: [],
      timings: {},
      timingSnapshotHash: sha256Bytes(
        canonicalJsonBytes({
          schemaVersion: 'ci-test-timing-summary/v1',
          commitShas: [],
          runs: [],
          timings: {},
        })
      ),
    });
    expect(validateTimingSummary(summary)).toEqual(summary);
  });

  it('records passed, failed, and skipped module outcomes', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-'));
    const outputFile = join(outputDir, 'events.json');
    const commitSha = 'd'.repeat(40);
    const previousCommitSha = process.env.CI_COMMIT_SHA;
    const module = (testPath: string, state: string, duration: number) =>
      ({
        moduleId: join(process.cwd(), testPath),
        state: () => state,
        diagnostic: () => ({ duration }),
      }) as never;

    try {
      process.env.CI_COMMIT_SHA = commitSha;
      const reporter = new CanonicalTimingReporter(outputFile);
      reporter.onTestRunEnd(
        [
          module('tests/passed.test.ts', 'passed', 1200),
          module('tests/failed.test.ts', 'failed', 2400),
          module('tests/skipped.test.ts', 'skipped', 0),
        ],
        [],
        'failed'
      );
      const artifact = JSON.parse(readFileSync(outputFile, 'utf8'));

      expect(artifact.commitSha).toBe(commitSha);
      expect(artifact.planHash).toBe(`sha256:${'1'.repeat(64)}`);
      expect(artifact.events).toEqual([
        {
          eventId: sha256Bytes(
            canonicalJsonBytes({
              commitSha,
              identityKey: 'vitest::tests/failed.test.ts',
            })
          ),
          identityKey: 'vitest::tests/failed.test.ts',
          runnerId: 'vitest',
          testPath: 'tests/failed.test.ts',
          durationMs: 2400,
          outcome: 'failed',
        },
        {
          eventId: sha256Bytes(
            canonicalJsonBytes({
              commitSha,
              identityKey: 'vitest::tests/passed.test.ts',
            })
          ),
          identityKey: 'vitest::tests/passed.test.ts',
          runnerId: 'vitest',
          testPath: 'tests/passed.test.ts',
          durationMs: 1200,
          outcome: 'passed',
        },
        {
          eventId: sha256Bytes(
            canonicalJsonBytes({
              commitSha,
              identityKey: 'vitest::tests/skipped.test.ts',
            })
          ),
          identityKey: 'vitest::tests/skipped.test.ts',
          runnerId: 'vitest',
          testPath: 'tests/skipped.test.ts',
          durationMs: 1,
          outcome: 'skipped',
        },
      ]);
    } finally {
      if (previousCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCommitSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('fails closed when the governed timing plan hash is missing', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-plan-invalid-'));
    const previousCommitSha = process.env.CI_COMMIT_SHA;
    try {
      process.env.CI_COMMIT_SHA = 'd'.repeat(40);
      delete process.env.CI_PLAN_HASH;
      const reporter = new CanonicalTimingReporter(join(outputDir, 'events.json'));
      expect(() =>
        reporter.onTestRunEnd(
          [
            {
              moduleId: join(process.cwd(), 'tests/plan-invalid.test.ts'),
              state: () => 'passed',
              diagnostic: () => ({ duration: 1 }),
            } as never,
          ],
          [],
          'passed'
        )
      ).toThrow('CI_TIMING_PLAN_HASH_REQUIRED');
    } finally {
      if (previousCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCommitSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('supports one-argument construction with delayed CI_COMMIT_SHA resolution', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-env-'));
    const outputFile = join(outputDir, 'events.json');
    const commitSha = 'e'.repeat(40);
    const previousCommitSha = process.env.CI_COMMIT_SHA;

    try {
      delete process.env.CI_COMMIT_SHA;
      const reporter = new CanonicalTimingReporter(outputFile);
      process.env.CI_COMMIT_SHA = commitSha;
      reporter.onTestRunEnd(
        [
          {
            moduleId: join(process.cwd(), 'tests/env.test.ts'),
            state: () => 'passed',
            diagnostic: () => ({ duration: 1 }),
          } as never,
        ],
        [],
        'passed'
      );
      const artifact = JSON.parse(readFileSync(outputFile, 'utf8'));

      expect(artifact.commitSha).toBe(commitSha);
      expect(artifact.events[0].eventId).toBe(
        sha256Bytes(
          canonicalJsonBytes({
            commitSha,
            identityKey: 'vitest::tests/env.test.ts',
          })
        )
      );
    } finally {
      if (previousCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCommitSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it.each([
    ['missing commit', undefined, undefined],
    ['invalid CI_COMMIT_SHA', 'invalid', 'f'.repeat(40)],
    ['invalid GITHUB_SHA fallback', undefined, 'invalid'],
    ['GITHUB_SHA is not the timing authority', undefined, 'f'.repeat(40)],
  ])('fails closed during timing production for %s', (_label, ciCommitSha, githubSha) => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-commit-invalid-'));
    const previousCiCommitSha = process.env.CI_COMMIT_SHA;
    const previousGithubSha = process.env.GITHUB_SHA;

    try {
      delete process.env.CI_COMMIT_SHA;
      delete process.env.GITHUB_SHA;
      const reporter = new CanonicalTimingReporter(join(outputDir, 'events.json'));
      if (ciCommitSha) process.env.CI_COMMIT_SHA = ciCommitSha;
      if (githubSha) process.env.GITHUB_SHA = githubSha;

      expect(() =>
        reporter.onTestRunEnd(
          [
            {
              moduleId: join(process.cwd(), 'tests/commit-invalid.test.ts'),
              state: () => 'passed',
              diagnostic: () => ({ duration: 1 }),
            } as never,
          ],
          [],
          'passed'
        )
      ).toThrow('CI_TIMING_COMMIT_SHA_REQUIRED');
    } finally {
      if (previousCiCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCiCommitSha;
      if (previousGithubSha === undefined) delete process.env.GITHUB_SHA;
      else process.env.GITHUB_SHA = previousGithubSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('records sub-millisecond and zero-resolution observations as one millisecond', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-invalid-'));
    const previousCommitSha = process.env.CI_COMMIT_SHA;

    try {
      process.env.CI_COMMIT_SHA = 'd'.repeat(40);
      const reporter = new CanonicalTimingReporter(join(outputDir, 'events.json'));
      reporter.onTestRunEnd(
        [
          {
            moduleId: join(process.cwd(), 'tests/zero-duration.test.ts'),
            state: () => 'passed',
            diagnostic: () => ({ duration: 0 }),
          },
          {
            moduleId: join(process.cwd(), 'tests/sub-millisecond-duration.test.ts'),
            state: () => 'passed',
            diagnostic: () => ({ duration: 0.25 }),
          },
        ] as never,
        [],
        'passed'
      );
      const artifact = JSON.parse(readFileSync(join(outputDir, 'events.json'), 'utf8'));

      expect(artifact.events.map((event: any) => event.durationMs)).toEqual([1, 1]);
    } finally {
      if (previousCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCommitSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it.each([-1, Number.NaN])('rejects an invalid reporter duration %s', (duration) => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-invalid-'));
    const previousCommitSha = process.env.CI_COMMIT_SHA;

    try {
      process.env.CI_COMMIT_SHA = 'd'.repeat(40);
      const reporter = new CanonicalTimingReporter(join(outputDir, 'events.json'));
      expect(() =>
        reporter.onTestRunEnd(
          [
            {
              moduleId: join(process.cwd(), 'tests/invalid-duration.test.ts'),
              state: () => 'passed',
              diagnostic: () => ({ duration }),
            },
          ] as never,
          [],
          'passed'
        )
      ).toThrow('CI_TIMING_DURATION_INVALID');
    } finally {
      if (previousCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCommitSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it.each([
    ['outside-root', join(process.cwd(), '..', 'outside-root.test.ts')],
    ['cross-drive', 'Z:\\outside\\cross-drive.test.ts'],
  ])('rejects reporter modules with a %s path', (_label, moduleId) => {
    const outputDir = mkdtempSync(join(tmpdir(), 'vitest-timing-reporter-path-invalid-'));
    const previousCommitSha = process.env.CI_COMMIT_SHA;

    try {
      process.env.CI_COMMIT_SHA = 'd'.repeat(40);
      const reporter = new CanonicalTimingReporter(join(outputDir, 'events.json'));

      expect(() =>
        reporter.onTestRunEnd(
          [
            {
              moduleId,
              state: () => 'passed',
              diagnostic: () => ({ duration: 1 }),
            } as never,
          ],
          [],
          'passed'
        )
      ).toThrow('CI_TIMING_TEST_PATH_INVALID');
    } finally {
      if (previousCommitSha === undefined) delete process.env.CI_COMMIT_SHA;
      else process.env.CI_COMMIT_SHA = previousCommitSha;
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it('aggregates real per-file observations by canonical identity', () => {
    const summary = summarizeTimingEvents(fixture);

    expect(summary.timings['vitest::tests/a.test.ts']).toEqual({
      sampleCount: 2,
      medianMs: 1500,
      maxMs: 1800,
      conservativeMs: 1800,
    });
    expect(summary.timings['vitest::tests/b.test.ts']).toEqual({
      sampleCount: 1,
      medianMs: 7000,
      maxMs: 7000,
      conservativeMs: 7000,
    });
  });

  it('accepts skipped timing evidence for an all-skipped selected module', () => {
    const commitSha = 'a'.repeat(40);
    const identityKey = 'vitest::tests/skipped.test.ts';
    const summary = summarizeTimingEvents({
      commitSha,
      events: [
        {
          eventId: timingEventId(commitSha, identityKey),
          identityKey,
          testPath: 'tests/skipped.test.ts',
          runnerId: 'vitest',
          durationMs: 1,
          outcome: 'skipped',
        },
      ],
    });

    expect(summary.timings[identityKey]).toEqual({
      sampleCount: 1,
      medianMs: 1,
      maxMs: 1,
      conservativeMs: 1,
    });
  });

  it('binds a timing run to its environment, observation time, provenance, and source artifacts', () => {
    const summary = summarizeTimingEvents({
      ...fixture,
      environmentClass: 'windows-x64-node22',
      observedAt: '2026-07-29T08:30:00.000Z',
      provenance: 'runner_observed',
      artifactHashes: [`sha256:${'1'.repeat(64)}`],
    });

    expect(summary.runs.at(-1)).toMatchObject({
      commitSha: fixture.commitSha,
      environmentClass: 'windows-x64-node22',
      observedAt: '2026-07-29T08:30:00.000Z',
      provenance: 'runner_observed',
      artifactHashes: [`sha256:${'1'.repeat(64)}`],
    });
    expect(validateTimingSummary(summary)).toEqual(summary);
  });

  it('summarizes multiple runner artifacts under one explicit observation context', () => {
    const commitSha = 'a'.repeat(40);
    const planHash = `sha256:${'2'.repeat(64)}`;
    const artifacts = [
      {
        artifactHash: `sha256:${'3'.repeat(64)}`,
        artifact: {
          commitSha,
          planHash,
          events: [
            {
              eventId: timingEventId(commitSha, 'vitest::tests/a.test.ts'),
              identityKey: 'vitest::tests/a.test.ts',
              testPath: 'tests/a.test.ts',
              runnerId: 'vitest',
              durationMs: 1200,
              outcome: 'passed',
            },
          ],
        },
      },
      {
        artifactHash: `sha256:${'4'.repeat(64)}`,
        artifact: {
          commitSha,
          planHash,
          events: [
            {
              eventId: timingEventId(commitSha, 'node::packages/bmad-speckit/tests/a.test.js'),
              identityKey: 'node::packages/bmad-speckit/tests/a.test.js',
              testPath: 'packages/bmad-speckit/tests/a.test.js',
              runnerId: 'node',
              durationMs: 2400,
              outcome: 'failed',
            },
          ],
        },
      },
    ];

    const summary = summarizeTimingArtifacts({
      commitSha,
      environmentClass: 'windows-x64-node22',
      observedAt: '2026-07-29T08:30:00.000Z',
      provenance: 'runner_observed',
      artifacts,
    });

    expect(summary.runs.at(-1)).toMatchObject({
      commitSha,
      environmentClass: 'windows-x64-node22',
      observedAt: '2026-07-29T08:30:00.000Z',
      provenance: 'runner_observed',
      artifactHashes: [`sha256:${'3'.repeat(64)}`, `sha256:${'4'.repeat(64)}`],
    });
    expect(Object.keys(summary.timings)).toEqual([
      'node::packages/bmad-speckit/tests/a.test.js',
      'vitest::tests/a.test.ts',
    ]);
  });

  it('loads canonical runner artifacts from governed paths and verifies their bytes', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'timing-artifact-files-'));
    const artifactDir = join(repoRoot, '.artifacts', 'test-portfolio', 'timing-observations');
    const commitSha = 'a'.repeat(40);
    const planHash = `sha256:${'2'.repeat(64)}`;
    const identityKey = 'vitest::tests/a.test.ts';
    const artifactPath = join(artifactDir, 'vitest-batch-01.json');
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      artifactPath,
      canonicalJsonBytes({
        commitSha,
        planHash,
        events: [
          {
            eventId: timingEventId(commitSha, identityKey),
            identityKey,
            testPath: 'tests/a.test.ts',
            runnerId: 'vitest',
            durationMs: 1200,
            outcome: 'passed',
          },
        ],
      })
    );

    try {
      const summary = summarizeTimingArtifactFiles({
        repoRoot,
        artifactPaths: ['.artifacts/test-portfolio/timing-observations/vitest-batch-01.json'],
        commitSha,
        environmentClass: 'windows-x64-node22',
        observedAt: '2026-07-29T08:30:00.000Z',
        provenance: 'runner_observed',
      });

      expect(summary.runs.at(-1).artifactHashes).toEqual([sha256Bytes(readFileSync(artifactPath))]);
      expect(summary.timings[identityKey].conservativeMs).toBe(1200);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('writes a canonical timing summary from an explicit artifact index', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'timing-artifact-index-'));
    const artifactDir = join(repoRoot, '.artifacts', 'test-portfolio', 'timing-observations');
    const commitSha = 'a'.repeat(40);
    const planHash = `sha256:${'2'.repeat(64)}`;
    const identityKey = 'vitest::tests/a.test.ts';
    mkdirSync(artifactDir, { recursive: true });
    writeFileSync(
      join(artifactDir, 'vitest-batch-01.json'),
      canonicalJsonBytes({
        commitSha,
        planHash,
        events: [
          {
            eventId: timingEventId(commitSha, identityKey),
            identityKey,
            testPath: 'tests/a.test.ts',
            runnerId: 'vitest',
            durationMs: 1200,
            outcome: 'passed',
          },
        ],
      })
    );
    writeFileSync(
      join(artifactDir, 'artifact-index.json'),
      canonicalJsonBytes(['.artifacts/test-portfolio/timing-observations/vitest-batch-01.json'])
    );

    try {
      expect(
        summarizeTimingMain(
          [
            '--artifact-index',
            '.artifacts/test-portfolio/timing-observations/artifact-index.json',
            '--commit-sha',
            commitSha,
            '--environment-class',
            'windows-x64-node22',
            '--observed-at',
            '2026-07-29T08:30:00.000Z',
            '--provenance',
            'runner_observed',
            '--output',
            '.artifacts/test-portfolio/ci-test-timing-summary.json',
          ],
          { repoRoot, writeOutput: () => {} }
        )
      ).toBe(0);
      const summary = JSON.parse(
        readFileSync(
          join(repoRoot, '.artifacts', 'test-portfolio', 'ci-test-timing-summary.json'),
          'utf8'
        )
      );
      expect(summary.runs.at(-1)).toMatchObject({
        commitSha,
        environmentClass: 'windows-x64-node22',
        provenance: 'runner_observed',
      });
      expect(summary.timings[identityKey].conservativeMs).toBe(1200);
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('rejects event IDs rebound to another commit or identity', () => {
    const originalCommitSha = 'a'.repeat(40);
    const reboundCommitSha = 'b'.repeat(40);
    const originalIdentityKey = 'vitest::tests/a.test.ts';
    const reboundIdentityKey = 'vitest::tests/b.test.ts';
    const eventId = timingEventId(originalCommitSha, originalIdentityKey);

    expect(() =>
      summarizeTimingEvents({
        commitSha: reboundCommitSha,
        events: [
          {
            eventId,
            identityKey: originalIdentityKey,
            testPath: 'tests/a.test.ts',
            runnerId: 'vitest',
            durationMs: 1000,
            outcome: 'passed',
          },
        ],
      })
    ).toThrow('TIMING_EVENT_ID_MISMATCH');

    expect(() =>
      summarizeTimingEvents({
        commitSha: originalCommitSha,
        events: [
          {
            eventId,
            identityKey: reboundIdentityKey,
            testPath: 'tests/b.test.ts',
            runnerId: 'vitest',
            durationMs: 1000,
            outcome: 'passed',
          },
        ],
      })
    ).toThrow('TIMING_EVENT_ID_MISMATCH');
  });

  it('normalizes path separators and bounds history by declared commit order', () => {
    const summary = summarizeTimingEvents({
      commitSha: 'c'.repeat(40),
      historyWindowCommits: 2,
      previousRuns: [
        {
          commitSha: 'a'.repeat(40),
          events: [
            {
              eventId: timingEventId('a'.repeat(40), 'vitest::tests/a.test.ts'),
              identityKey: 'vitest::tests\\a.test.ts',
              testPath: 'tests\\a.test.ts',
              runnerId: 'vitest',
              durationMs: 1000,
              outcome: 'passed',
            },
          ],
        },
        {
          commitSha: 'b'.repeat(40),
          events: [
            {
              eventId: timingEventId('b'.repeat(40), 'vitest::tests/a.test.ts'),
              identityKey: 'vitest::tests/a.test.ts',
              testPath: 'tests/a.test.ts',
              runnerId: 'vitest',
              durationMs: 1200,
              outcome: 'passed',
            },
          ],
        },
      ],
      events: [
        {
          eventId: timingEventId('c'.repeat(40), 'vitest::tests/a.test.ts'),
          identityKey: 'vitest::tests/a.test.ts',
          testPath: 'tests/a.test.ts',
          runnerId: 'vitest',
          durationMs: 1800,
          outcome: 'passed',
        },
      ],
    });

    expect(summary.commitShas).toEqual(['b'.repeat(40), 'c'.repeat(40)]);
    expect(summary.timings['vitest::tests/a.test.ts']).toEqual({
      sampleCount: 2,
      medianMs: 1500,
      maxMs: 1800,
      conservativeMs: 1800,
    });
  });

  it('does not let discarded history duplicate IDs block the retained window', () => {
    const duplicateOldEvent = {
      eventId: timingEventId('a'.repeat(40), 'vitest::tests/old.test.ts'),
      identityKey: 'vitest::tests/old.test.ts',
      testPath: 'tests/old.test.ts',
      runnerId: 'vitest',
      durationMs: 1000,
      outcome: 'passed',
    };

    const summary = summarizeTimingEvents({
      commitSha: 'c'.repeat(40),
      historyWindowCommits: 1,
      previousRuns: [
        {
          commitSha: 'a'.repeat(40),
          events: [duplicateOldEvent],
        },
        {
          commitSha: 'a'.repeat(40),
          events: [duplicateOldEvent],
        },
      ],
      events: [
        {
          eventId: timingEventId('c'.repeat(40), 'vitest::tests/current.test.ts'),
          identityKey: 'vitest::tests/current.test.ts',
          testPath: 'tests/current.test.ts',
          runnerId: 'vitest',
          durationMs: 2000,
          outcome: 'passed',
        },
      ],
    });

    expect(summary.commitShas).toEqual(['c'.repeat(40)]);
    expect(Object.keys(summary.timings)).toEqual(['vitest::tests/current.test.ts']);
  });

  it.each([
    ['drive-relative', 'C:repo/tests/a.test.ts', 'C:repo/tests/a.test.ts'],
    ['trimmed drive-absolute', ' C:\\repo\\tests\\a.test.ts', 'C:/repo/tests/a.test.ts'],
    ['normalized drive-relative', './C:repo/tests/a.test.ts', 'C:repo/tests/a.test.ts'],
    ['normalized drive-absolute', './C:/repo/tests/a.test.ts', 'C:/repo/tests/a.test.ts'],
  ])('rejects %s timing paths with canonical identities', (_label, testPath, identityPath) => {
    expect(() =>
      summarizeTimingEvents({
        commitSha: 'a'.repeat(40),
        events: [
          {
            eventId: 'path-bypass',
            identityKey: `vitest::${identityPath}`,
            testPath,
            runnerId: 'vitest',
            durationMs: 1,
            outcome: 'passed',
          },
        ],
      })
    ).toThrow('TIMING_EVENT_INVALID');
  });

  it.each([
    ['synthetic marker', { synthetic: true }],
    ['heartbeat marker', { heartbeat: true }],
  ])('rejects timing events with an extra %s field', (_label, extraField) => {
    const commitSha = 'a'.repeat(40);
    const identityKey = 'vitest::tests/a.test.ts';

    expect(() =>
      summarizeTimingEvents({
        commitSha,
        events: [
          {
            eventId: timingEventId(commitSha, identityKey),
            identityKey,
            testPath: 'tests/a.test.ts',
            runnerId: 'vitest',
            durationMs: 1,
            outcome: 'passed',
            ...extraField,
          },
        ],
      })
    ).toThrow('TIMING_EVENT_INVALID');
  });

  it.each(['heartbeat', 'unknown-runner'])(
    'rejects the synthetic or unknown runner %s',
    (runnerId) => {
      const commitSha = 'a'.repeat(40);
      const identityKey = `${runnerId}::tests/a.test.ts`;

      expect(() =>
        summarizeTimingEvents({
          commitSha,
          events: [
            {
              eventId: timingEventId(commitSha, identityKey),
              identityKey,
              testPath: 'tests/a.test.ts',
              runnerId,
              durationMs: 1,
              outcome: 'passed',
            },
          ],
        })
      ).toThrow('TIMING_EVENT_INVALID');
    }
  );

  it('accepts the explicitly registered Node runner', () => {
    const commitSha = 'a'.repeat(40);
    const identityKey = 'node::packages/bmad-speckit/tests/a.test.js';
    const summary = summarizeTimingEvents({
      commitSha,
      events: [
        {
          eventId: timingEventId(commitSha, identityKey),
          identityKey,
          testPath: 'packages/bmad-speckit/tests/a.test.js',
          runnerId: 'node',
          durationMs: 25,
          outcome: 'passed',
        },
      ],
    });

    expect(summary.timings[identityKey].conservativeMs).toBe(25);
  });

  it('rejects invalid events and duplicate explicit event IDs', () => {
    const invalidEvents = [
      { identityKey: '', durationMs: 1, outcome: 'passed' },
      {
        eventId: 'zero',
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: 0,
        outcome: 'passed',
      },
      {
        eventId: 'windows',
        identityKey: 'vitest::C:/repo/tests/a.test.ts',
        testPath: 'C:/repo/tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: 1,
        outcome: 'passed',
      },
      {
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: 1,
        outcome: 'passed',
      },
      {
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: -1,
        outcome: 'passed',
      },
      {
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: Number.NaN,
        outcome: 'passed',
      },
      {
        identityKey: 'vitest::tests/a.test.ts',
        testPath: 'tests/a.test.ts',
        runnerId: 'vitest',
        durationMs: 1,
        outcome: 'heartbeat',
      },
    ];
    for (const event of invalidEvents) {
      expect(() =>
        summarizeTimingEvents({
          commitSha: 'a'.repeat(40),
          events: [event],
        })
      ).toThrow('TIMING_EVENT_INVALID');
    }

    expect(() =>
      summarizeTimingEvents({
        commitSha: fixture.commitSha,
        events: [fixture.events[0], fixture.events[0]],
      })
    ).toThrow('TIMING_EVENT_ID_DUPLICATE');

    expect(() =>
      summarizeTimingEvents({
        commitSha: 'a'.repeat(40),
        events: [],
      })
    ).toThrow('TIMING_EVENTS_INVALID');
  });

  it('is byte-identical for equivalent event order', () => {
    const first = summarizeTimingEvents(fixture);
    const second = summarizeTimingEvents({
      ...fixture,
      events: [...fixture.events].reverse(),
    });

    expect(canonicalJsonBytes(first)).toEqual(canonicalJsonBytes(second));
    expect(first.timingSnapshotHash).toBe(second.timingSnapshotHash);
  });
});
