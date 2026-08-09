import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  buildShardPlan,
  parseCliArgs,
  validateShardPlan,
  writeShardPlan,
} = require('../../tools/ci/build-shard-plan.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');
const { createRunManifestPlan } = require('../../tools/ci/write-ci-run-manifest.cjs');

const selection = {
  schemaVersion: 'test-selection/v1',
  selectionStatus: 'ready',
  blockingGapCount: 0,
  uncoveredObligationIds: [],
  requestedProfile: 'pr-fast',
  profile: 'pr-fast',
  expansionLevel: 'trace_capability',
  escalationReasonCodes: [],
  selected: [
    {
      identityKey: 'vitest::a.test.ts',
      runnerId: 'vitest',
      testPath: 'a.test.ts',
      lane: 'core',
      reasonCodes: ['SEMANTIC_CORE'],
      coveredObligationIds: ['requirement_confirmation/state_entry'],
    },
    {
      identityKey: 'vitest::b.test.ts',
      runnerId: 'vitest',
      testPath: 'b.test.ts',
      lane: 'core',
      reasonCodes: ['SEMANTIC_CORE'],
      coveredObligationIds: ['architecture_confirmation/state_entry'],
    },
    {
      identityKey: 'vitest::c.test.ts',
      runnerId: 'vitest',
      testPath: 'c.test.ts',
      lane: 'core',
      reasonCodes: ['SEMANTIC_CORE'],
      coveredObligationIds: ['implementation_readiness/state_entry'],
    },
  ],
  gates: {
    selectionOmissionCount: 0,
    selectionDuplicateCount: 0,
    unresolvedImpactBindingCount: 0,
  },
};

const policy = {
  timing: {
    unknownDurationMs: 60000,
    maxShardDurationMs: 8000,
    maxShardsPerLane: 2,
  },
};

const freshTimingContext = {
  environmentClass: 'windows-x64-node22',
  observedAt: '2026-07-30T08:30:00.000Z',
  provenance: 'runner_observed',
  artifactHashes: [`sha256:${'1'.repeat(64)}`],
};

function timingSummaryFrom(
  durations: Record<string, number>,
  observationContext: Record<string, unknown> = {}
) {
  const observations =
    Object.keys(durations).length > 0 ? durations : { 'vitest::timing-baseline.test.ts': 1 };
  return summarizeTimingEvents({
    commitSha: 'a'.repeat(40),
    ...observationContext,
    events: Object.entries(observations).map(([identityKey, durationMs]) => {
      const separatorIndex = identityKey.indexOf('::');
      const runnerId = identityKey.slice(0, separatorIndex);
      const testPath = identityKey.slice(separatorIndex + 2);
      return {
        eventId: sha256Bytes(canonicalJsonBytes({ commitSha: 'a'.repeat(40), identityKey })),
        identityKey,
        runnerId,
        testPath,
        durationMs,
        outcome: 'passed',
      };
    }),
  });
}

function validShardPlan() {
  return buildShardPlan({
    selection,
    timingSummary: timingSummaryFrom(
      {
        'vitest::a.test.ts': 8000,
        'vitest::b.test.ts': 7000,
        'vitest::c.test.ts': 1000,
      },
      freshTimingContext
    ),
    policy,
    expectedCommitSha: 'a'.repeat(40),
    expectedEnvironmentClass: 'windows-x64-node22',
  });
}

function expectIssueCode(action: () => unknown, issueCode: string) {
  try {
    action();
  } catch (error) {
    expect(error).toMatchObject({ code: issueCode });
    expect((error as Error).message).toBe(issueCode);
    return;
  }
  throw new Error(`Expected issue code ${issueCode}`);
}

describe('deterministic timing-driven shard plan', () => {
  it('accepts a bounded capacity of 64 shards per lane', () => {
    const plan = buildShardPlan({
      selection,
      timingSummary: timingSummaryFrom(
        {
          'vitest::a.test.ts': 8000,
          'vitest::b.test.ts': 7000,
          'vitest::c.test.ts': 1000,
        },
        freshTimingContext
      ),
      policy: {
        timing: {
          ...policy.timing,
          maxShardsPerLane: 64,
        },
      },
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });

    expect(plan.shards.length).toBeGreaterThan(0);
  });

  it.each([
    ['both values are absent', ['--selection', 'selection.json']],
    [
      'environment class is absent',
      ['--selection', 'selection.json', '--commit-sha', 'a'.repeat(40)],
    ],
    [
      'commit SHA is absent',
      ['--selection', 'selection.json', '--environment-class', 'windows-x64-node22'],
    ],
  ])('fails closed when timing authority CLI context is incomplete: %s', (_label, args) => {
    expectIssueCode(() => parseCliArgs(args), 'SHARD_TIMING_BINDING_INPUT_INVALID');
  });

  it('rejects a completable shard plan without timing authority binding', () => {
    const unboundPlan = buildShardPlan({
      selection,
      timingSummary: timingSummaryFrom(
        {
          'vitest::a.test.ts': 8000,
          'vitest::b.test.ts': 7000,
          'vitest::c.test.ts': 1000,
        },
        freshTimingContext
      ),
      policy,
    });

    expectIssueCode(() => validateShardPlan(unboundPlan), 'SHARD_TIMING_BINDING_REQUIRED');
  });

  it('binds exact-commit environment timing as fresh evidence', () => {
    const timingSummary = timingSummaryFrom(
      {
        'vitest::a.test.ts': 8000,
        'vitest::b.test.ts': 7000,
        'vitest::c.test.ts': 1000,
      },
      {
        environmentClass: 'windows-x64-node22',
        observedAt: '2026-07-29T08:30:00.000Z',
        provenance: 'runner_observed',
        artifactHashes: [`sha256:${'1'.repeat(64)}`],
      }
    );
    const plan = buildShardPlan({
      selection,
      timingSummary,
      policy,
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });

    expect(plan.timingBinding).toEqual({
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
      status: 'fresh',
      observedCommitSha: 'a'.repeat(40),
      observedEnvironmentClass: 'windows-x64-node22',
      observedAt: '2026-07-29T08:30:00.000Z',
      provenance: 'runner_observed',
      artifactHashes: [`sha256:${'1'.repeat(64)}`],
      freshTimingCount: 3,
      staleTimingCount: 0,
      fallbackTimingCount: 0,
      fallbackIdentityKeys: [],
      fallbackReasonCodes: [],
    });
    expect(plan.gates.staleTimingUsedWithoutFallbackCount).toBe(0);
    expect(validateShardPlan(plan)).toEqual(plan);

    const manifest = createRunManifestPlan({
      repository: { commitSha: 'a'.repeat(40), dirty: false },
      catalogHash: `sha256:${'1'.repeat(64)}`,
      semanticIndexHash: `sha256:${'2'.repeat(64)}`,
      packageDescriptorHash: `sha256:${'3'.repeat(64)}`,
      tarballSha256: `sha256:${'4'.repeat(64)}`,
      selectionHash: plan.selectionHash,
      timingSummary,
      policy,
      policyHash: sha256Bytes(canonicalJsonBytes(policy)),
      shardPlan: plan,
    });
    expect(manifest.plan.shardPlan.timingBinding).toEqual(plan.timingBinding);
    expect(() =>
      createRunManifestPlan({
        ...manifest.plan,
        repository: { commitSha: 'b'.repeat(40), dirty: false },
        timingSummary,
        policy,
        shardPlan: plan,
      })
    ).toThrow('CI_MANIFEST_TIMING_COMMIT_MISMATCH');
  });

  it('uses explicit fallback instead of stale timing from another environment', () => {
    const timingSummary = timingSummaryFrom(
      {
        'vitest::a.test.ts': 8000,
        'vitest::b.test.ts': 7000,
        'vitest::c.test.ts': 1000,
      },
      {
        environmentClass: 'linux-x64-node22',
        observedAt: '2026-07-29T08:30:00.000Z',
        provenance: 'runner_observed',
        artifactHashes: [`sha256:${'2'.repeat(64)}`],
      }
    );
    const plan = buildShardPlan({
      selection,
      timingSummary,
      policy: {
        timing: {
          unknownDurationMs: 60000,
          maxShardDurationMs: 180000,
          maxShardsPerLane: 2,
        },
      },
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });

    expect(plan.timingBinding).toMatchObject({
      status: 'stale',
      freshTimingCount: 0,
      staleTimingCount: 3,
      fallbackTimingCount: 3,
      fallbackIdentityKeys: ['vitest::a.test.ts', 'vitest::b.test.ts', 'vitest::c.test.ts'],
      fallbackReasonCodes: ['TIMING_ENVIRONMENT_MISMATCH'],
    });
    expect(Object.values(plan.weights)).toEqual([60000, 60000, 60000]);
    expect(plan.gates.staleTimingUsedWithoutFallbackCount).toBe(0);
  });

  it('records per-identity fallback when the fresh run did not execute a selected test', () => {
    const timingSummary = timingSummaryFrom(
      {
        'vitest::a.test.ts': 1000,
      },
      {
        environmentClass: 'windows-x64-node22',
        observedAt: '2026-07-29T08:30:00.000Z',
        provenance: 'runner_observed',
        artifactHashes: [`sha256:${'3'.repeat(64)}`],
      }
    );
    const plan = buildShardPlan({
      selection,
      timingSummary,
      policy: {
        timing: {
          unknownDurationMs: 60000,
          maxShardDurationMs: 180000,
          maxShardsPerLane: 2,
        },
      },
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });

    expect(plan.timingBinding).toMatchObject({
      status: 'fallback',
      freshTimingCount: 1,
      staleTimingCount: 0,
      fallbackTimingCount: 2,
      fallbackIdentityKeys: ['vitest::b.test.ts', 'vitest::c.test.ts'],
      fallbackReasonCodes: ['TIMING_IDENTITY_NOT_OBSERVED'],
    });
    expect(plan.weights).toEqual({
      'vitest::a.test.ts': 1000,
      'vitest::b.test.ts': 60000,
      'vitest::c.test.ts': 60000,
    });
  });

  it('uses deterministic longest-processing-time allocation', () => {
    const plan = buildShardPlan({
      selection,
      timingSummary: timingSummaryFrom(
        {
          'vitest::a.test.ts': 8000,
          'vitest::b.test.ts': 7000,
          'vitest::c.test.ts': 1000,
        },
        freshTimingContext
      ),
      policy,
    });

    expect(plan.shards.map((shard: any) => shard.identityKeys)).toEqual([
      ['vitest::a.test.ts'],
      ['vitest::b.test.ts', 'vitest::c.test.ts'],
    ]);
    expect(plan.gates).toEqual({
      shardCoverageMismatchCount: 0,
      shardDuplicateIdentityCount: 0,
      maxShardDurationExceededCount: 0,
      prWallClockBudgetExceededCount: 0,
    });
  });

  it('isolates PR expected failures from blocking tests in the same lane', () => {
    const expectedFailureSelection = structuredClone(selection);
    expectedFailureSelection.selected[1].reasonCodes.push('PR_KNOWN_FAILURE_EXECUTION');
    expectedFailureSelection.selected[1].reasonCodes.sort();
    expectedFailureSelection.selected[1].expectedFailureReasonCode =
      'KNOWN_FAILING_TEST_FIXTURE_DRIFT';
    const plan = buildShardPlan({
      selection: expectedFailureSelection,
      timingSummary: timingSummaryFrom(
        {
          'vitest::a.test.ts': 8000,
          'vitest::b.test.ts': 7000,
          'vitest::c.test.ts': 1000,
        },
        freshTimingContext
      ),
      policy: {
        timing: {
          unknownDurationMs: 60000,
          maxShardDurationMs: 180000,
          maxShardsPerLane: 3,
        },
      },
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });

    expect(plan.shards).toEqual([
      {
        lane: 'core',
        shardId: 'core-01',
        estimatedDurationMs: 9000,
        identityKeys: ['vitest::a.test.ts', 'vitest::c.test.ts'],
      },
      {
        lane: 'core',
        shardId: 'core-xfail-01',
        estimatedDurationMs: 7000,
        identityKeys: ['vitest::b.test.ts'],
        expectedFailureIdentityKeys: ['vitest::b.test.ts'],
      },
    ]);
    expect(validateShardPlan(plan)).toEqual(plan);
  });

  it('fails closed when the longest PR shard exceeds the PR wall-clock budget', () => {
    expect(() =>
      buildShardPlan({
        selection,
        timingSummary: timingSummaryFrom({
          'vitest::a.test.ts': 70_000,
          'vitest::b.test.ts': 70_000,
          'vitest::c.test.ts': 70_000,
        }),
        policy: {
          budgets: { prP95Minutes: 1 },
          timing: {
            unknownDurationMs: 60_000,
            maxShardDurationMs: 180_000,
            maxShardsPerLane: 3,
          },
        },
      })
    ).toThrow('SHARD_PR_TIME_BUDGET_EXCEEDED');
  });

  it('covers every selected identity once', () => {
    const plan = buildShardPlan({
      selection,
      timingSummary: timingSummaryFrom({}),
      policy: {
        timing: {
          unknownDurationMs: 60000,
          maxShardDurationMs: 120000,
          maxShardsPerLane: 2,
        },
      },
    });

    expect(plan.shards.flatMap((shard: any) => shard.identityKeys).sort()).toEqual([
      'vitest::a.test.ts',
      'vitest::b.test.ts',
      'vitest::c.test.ts',
    ]);
  });

  it('rejects non-canonical Selection order', () => {
    const reordered = structuredClone(selection);
    reordered.selected.reverse();

    expect(() =>
      buildShardPlan({
        selection: reordered,
        timingSummary: timingSummaryFrom({}),
        policy: {
          timing: {
            unknownDurationMs: 60000,
            maxShardDurationMs: 120000,
            maxShardsPerLane: 2,
          },
        },
      })
    ).toThrow('CI_SELECTION_SELECTED_ORDER_INVALID');
  });

  it('uses a conservative non-zero weight for unknown identities', () => {
    const unknownSelection = structuredClone(selection);
    unknownSelection.selected = [
      unknownSelection.selected[0],
      {
        identityKey: 'vitest::unknown.test.ts',
        runnerId: 'vitest',
        testPath: 'unknown.test.ts',
        lane: 'core',
        reasonCodes: ['CHANGED_TEST'],
        coveredObligationIds: [],
      },
    ];
    const plan = buildShardPlan({
      selection: unknownSelection,
      timingSummary: timingSummaryFrom({ 'vitest::a.test.ts': 90000 }),
      policy: {
        timing: {
          unknownDurationMs: 60000,
          maxShardDurationMs: 180000,
          maxShardsPerLane: 2,
        },
      },
    });

    const unknownShard = plan.shards.find((shard: any) =>
      shard.identityKeys.includes('vitest::unknown.test.ts')
    );

    expect(unknownShard.estimatedDurationMs).toBeGreaterThanOrEqual(90000);
  });

  it('rejects duplicate identities and work units beyond the policy bound', () => {
    expect(() =>
      buildShardPlan({
        selection: {
          ...selection,
          selected: [...selection.selected, structuredClone(selection.selected[0])],
        },
        timingSummary: timingSummaryFrom({}),
        policy,
      })
    ).toThrow('CI_SELECTION_DUPLICATE');

    const singleSelection = structuredClone(selection);
    singleSelection.selected = [singleSelection.selected[0]];
    expect(() =>
      buildShardPlan({
        selection: singleSelection,
        timingSummary: timingSummaryFrom({ 'vitest::a.test.ts': 8001 }),
        policy,
      })
    ).toThrow('SHARD_WORK_UNIT_LIMIT_EXCEEDED');
  });

  it('reports lane capacity exhaustion separately from a single oversized work unit', () => {
    const capacitySelection = structuredClone(selection);
    capacitySelection.requestedProfile = 'nightly-deep';
    capacitySelection.profile = 'nightly-deep';
    capacitySelection.selected = Array.from({ length: 5 }, (_value, index) => ({
      identityKey: `vitest::nightly-${index + 1}.test.ts`,
      runnerId: 'vitest',
      testPath: `nightly-${index + 1}.test.ts`,
      lane: 'feature',
      reasonCodes: ['NIGHTLY_APPLICABLE'],
      coveredObligationIds: [],
    }));

    try {
      buildShardPlan({
        selection: capacitySelection,
        timingSummary: timingSummaryFrom(
          Object.fromEntries(
            capacitySelection.selected.map((item: any) => [item.identityKey, 5000])
          )
        ),
        policy: {
          timing: {
            unknownDurationMs: 60000,
            maxShardDurationMs: 8000,
            maxShardsPerLane: 2,
          },
        },
      });
    } catch (error) {
      expect(error).toMatchObject({
        code: 'SHARD_LANE_CAPACITY_EXCEEDED',
        details: {
          lane: 'feature',
          totalDurationMs: 25000,
          maxShardDurationMs: 8000,
          maxShardsPerLane: 2,
          laneCapacityMs: 16000,
          requiredShardCount: 4,
        },
      });
      return;
    }

    throw new Error('Expected SHARD_LANE_CAPACITY_EXCEEDED');
  });

  it('rejects forged lanes and identity/path mismatches through Selection authority', () => {
    const forgedLane = structuredClone(selection);
    forgedLane.selected[0].lane = 'release-only-forged';
    expect(() =>
      buildShardPlan({
        selection: forgedLane,
        timingSummary: timingSummaryFrom({}),
        policy,
      })
    ).toThrow('CI_SELECTION_LANE_INVALID');

    const mismatchedIdentity = structuredClone(selection);
    mismatchedIdentity.selected[0].identityKey = 'vitest::different.test.ts';
    expect(() =>
      buildShardPlan({
        selection: mismatchedIdentity,
        timingSummary: timingSummaryFrom({}),
        policy,
      })
    ).toThrow('CI_SELECTION_IDENTITY_MISMATCH');
  });

  it('rejects a timing summary whose contents no longer match its snapshot hash', () => {
    const timingSummary = timingSummaryFrom(
      {
        'vitest::a.test.ts': 8000,
        'vitest::b.test.ts': 7000,
        'vitest::c.test.ts': 1000,
      },
      freshTimingContext
    );
    timingSummary.timings['vitest::a.test.ts'].conservativeMs = 1;

    expect(() => buildShardPlan({ selection, timingSummary, policy })).toThrow(
      'TIMING_SNAPSHOT_HASH_MISMATCH'
    );
  });

  it.each([
    ['sparse shard array', (plan: any) => delete plan.shards[0], 'SHARD_PLAN_SHARDS_INVALID'],
    ['invalid shard', (plan: any) => (plan.shards[0] = null), 'SHARD_PLAN_SHARD_INVALID'],
    ['invalid lane', (plan: any) => (plan.shards[0].lane = ''), 'SHARD_PLAN_LANE_INVALID'],
    [
      'invalid shardId',
      (plan: any) => (plan.shards[0].shardId = ''),
      'SHARD_PLAN_SHARD_ID_INVALID',
    ],
    [
      'invalid duration',
      (plan: any) => (plan.shards[0].estimatedDurationMs = -1),
      'SHARD_PLAN_DURATION_INVALID',
    ],
    [
      'sparse identity array',
      (plan: any) => delete plan.shards[0].identityKeys[0],
      'SHARD_PLAN_IDENTITIES_INVALID',
    ],
    [
      'duplicate shard',
      (plan: any) => plan.shards.push(structuredClone(plan.shards[0])),
      'SHARD_PLAN_SHARD_DUPLICATE',
    ],
    [
      'duplicate identity',
      (plan: any) => plan.shards[1].identityKeys.push(plan.shards[0].identityKeys[0]),
      'SHARD_PLAN_IDENTITY_DUPLICATE',
    ],
    [
      'invalid gates',
      (plan: any) => (plan.gates.shardCoverageMismatchCount = 1),
      'SHARD_PLAN_GATES_INVALID',
    ],
    ['invalid profile', (plan: any) => (plan.profile = 'unknown'), 'SHARD_PLAN_PROFILE_INVALID'],
  ])('reports a granular code for %s', (_label, mutate, code) => {
    const shardPlan = validShardPlan();
    mutate(shardPlan);

    expectIssueCode(() => writeShardPlan({ shardPlan }), code);
  });

  it.each([
    ['non-object plan', null, 'SHARD_PLAN_OBJECT_INVALID'],
    [
      'invalid schema version',
      { ...validShardPlan(), schemaVersion: 'ci-shard-plan/v2' },
      'SHARD_PLAN_SCHEMA_VERSION_INVALID',
    ],
  ])('reports a granular code for %s', (_label, shardPlan, code) => {
    expectIssueCode(() => writeShardPlan({ shardPlan }), code);
  });

  it('rejects a forged shard plan hash before writing the artifact', () => {
    const shardPlan = buildShardPlan({
      selection,
      timingSummary: timingSummaryFrom(
        {
          'vitest::a.test.ts': 8000,
          'vitest::b.test.ts': 7000,
          'vitest::c.test.ts': 1000,
        },
        freshTimingContext
      ),
      policy,
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-shard-plan-'));

    try {
      expect(() =>
        writeShardPlan({
          repoRoot,
          shardPlan: {
            ...shardPlan,
            shardPlanHash: `sha256:${'0'.repeat(64)}`,
          },
        })
      ).toThrow('SHARD_PLAN_HASH_MISMATCH');
    } finally {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it('projects directly into the single Run Manifest authority', () => {
    const timingSummary = timingSummaryFrom(
      {
        'vitest::a.test.ts': 8000,
        'vitest::b.test.ts': 7000,
        'vitest::c.test.ts': 1000,
      },
      freshTimingContext
    );
    const shardPlan = buildShardPlan({
      selection,
      timingSummary,
      policy,
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });
    const manifest = createRunManifestPlan({
      repository: { commitSha: 'a'.repeat(40), dirty: false },
      catalogHash: `sha256:${'1'.repeat(64)}`,
      semanticIndexHash: `sha256:${'2'.repeat(64)}`,
      packageDescriptorHash: `sha256:${'3'.repeat(64)}`,
      tarballSha256: `sha256:${'4'.repeat(64)}`,
      selectionHash: shardPlan.selectionHash,
      timingSummary,
      policy,
      policyHash: sha256Bytes(canonicalJsonBytes(policy)),
      shardPlan,
    });

    expect(manifest.planHash).toMatch(/^sha256:/);
    expect(manifest.matrix).toEqual(
      shardPlan.shards.map(({ lane, shardId }: any) => ({ lane, shardId }))
    );
  });

  it('preserves blocked selection evidence through shard planning and manifest projection', () => {
    const blockedSelection = {
      ...selection,
      selectionStatus: 'blocked',
      blockingGapCount: 2,
      uncoveredObligationIds: [
        'architecture_confirmation/fail_closed',
        'requirement_confirmation/stale_evidence_rejection',
      ],
    };
    const timingSummary = timingSummaryFrom(
      {
        'vitest::a.test.ts': 8000,
        'vitest::b.test.ts': 7000,
        'vitest::c.test.ts': 1000,
      },
      freshTimingContext
    );
    const shardPlan = buildShardPlan({
      selection: blockedSelection,
      timingSummary,
      policy,
      expectedCommitSha: 'a'.repeat(40),
      expectedEnvironmentClass: 'windows-x64-node22',
    });
    const manifest = createRunManifestPlan({
      repository: { commitSha: 'a'.repeat(40), dirty: false },
      catalogHash: `sha256:${'1'.repeat(64)}`,
      semanticIndexHash: `sha256:${'2'.repeat(64)}`,
      packageDescriptorHash: `sha256:${'3'.repeat(64)}`,
      tarballSha256: `sha256:${'4'.repeat(64)}`,
      selectionHash: shardPlan.selectionHash,
      timingSummary,
      policy,
      policyHash: sha256Bytes(canonicalJsonBytes(policy)),
      shardPlan,
    });

    expect(shardPlan.selection).toMatchObject({
      selectionStatus: 'blocked',
      blockingGapCount: 2,
      uncoveredObligationIds: blockedSelection.uncoveredObligationIds,
    });
    expect(manifest.plan.shardPlan.selection).toMatchObject({
      selectionStatus: 'blocked',
      blockingGapCount: 2,
      uncoveredObligationIds: blockedSelection.uncoveredObligationIds,
    });
    expect(manifest.matrix.length).toBeGreaterThan(0);
  });
});
