import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const fixtureInput = require('../fixtures/test-portfolio/run-manifest-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const {
  createRunManifestPlan,
  finalizeRunManifest,
  validateRunManifest,
  writeRunManifest,
} = require('../../tools/ci/write-ci-run-manifest.cjs');
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');

const temporaryRoots: string[] = [];
const environmentClass = 'windows-x64-node22';

afterEach(() => {
  while (temporaryRoots.length > 0) {
    rmSync(temporaryRoots.pop()!, { force: true, recursive: true });
  }
});

function validLaneResults(manifest: any) {
  return manifest.plan.shardPlan.shards.map((shard: any) => ({
    lane: shard.lane,
    shardId: shard.shardId,
    commitSha: manifest.plan.repository.commitSha,
    planHash: manifest.planHash,
    packageDescriptorHash: manifest.plan.packageDescriptorHash,
    tarballSha256: manifest.plan.tarballSha256,
    outcome: 'passed',
    executedIdentityKeys: [...shard.identityKeys],
  }));
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

function replaceEnumerableKeysWithJoinedShadow(manifest: any) {
  const matrix = manifest.matrix;
  const gates = manifest.gates;
  delete manifest.matrix;
  delete manifest.gates;
  Object.defineProperties(manifest, {
    matrix: { configurable: true, value: matrix },
    gates: { configurable: true, value: gates },
  });
  manifest['gates\0matrix'] = true;
  return manifest;
}

function rehashShardPlan(manifestInput: any) {
  const { shardPlanHash: _ignored, ...body } = manifestInput.shardPlan;
  manifestInput.shardPlan = {
    ...body,
    shardPlanHash: sha256Bytes(canonicalJsonBytes(body)),
  };
  return manifestInput;
}

function timingGovernedInput() {
  const governedInput = structuredClone(fixtureInput);
  const currentRun = governedInput.timingSummary.runs.at(-1);
  governedInput.timingSummary = summarizeTimingEvents({
    commitSha: currentRun.commitSha,
    environmentClass,
    observedAt: '2026-07-30T08:30:00.000Z',
    provenance: 'runner_observed',
    artifactHashes: [`sha256:${'5'.repeat(64)}`],
    events: currentRun.events,
  });
  governedInput.shardPlan = buildShardPlan({
    selection: governedInput.shardPlan.selection,
    timingSummary: governedInput.timingSummary,
    policy: governedInput.policy,
    expectedCommitSha: governedInput.repository.commitSha,
    expectedEnvironmentClass: environmentClass,
  });
  return governedInput;
}

const input = timingGovernedInput();

function rehashRunManifest(manifest: any) {
  rehashShardPlan(manifest.plan);
  manifest.planHash = sha256Bytes(canonicalJsonBytes(manifest.plan));
  for (const result of manifest.results) result.planHash = manifest.planHash;
  return manifest;
}

describe('single CI Run Manifest', () => {
  it.each(['planned', 'complete'])(
    'rejects a %s manifest whose timing binding targets another commit',
    (status) => {
      const planned = createRunManifestPlan(timingGovernedInput());
      const manifest =
        status === 'planned'
          ? planned
          : finalizeRunManifest(planned, { laneResults: validLaneResults(planned) });
      manifest.plan.shardPlan.timingBinding.expectedCommitSha = 'b'.repeat(40);
      rehashRunManifest(manifest);

      expectIssueCode(
        () => validateRunManifest(manifest),
        'CI_MANIFEST_TIMING_COMMIT_MISMATCH'
      );
    }
  );

  it.each(['planned', 'complete'])(
    'rejects a %s manifest with fresh timing status but no provenance',
    (status) => {
      const planned = createRunManifestPlan(timingGovernedInput());
      const manifest =
        status === 'planned'
          ? planned
          : finalizeRunManifest(planned, { laneResults: validLaneResults(planned) });
      manifest.plan.shardPlan.timingBinding.provenance = null;
      rehashRunManifest(manifest);

      expectIssueCode(
        () => validateRunManifest(manifest),
        'CI_MANIFEST_TIMING_AUTHORITY_INVALID'
      );
    }
  );

  it.each(['planned', 'complete'])(
    'rejects a %s manifest that claims stale timing was used without fallback',
    (status) => {
      const planned = createRunManifestPlan(timingGovernedInput());
      const manifest =
        status === 'planned'
          ? planned
          : finalizeRunManifest(planned, { laneResults: validLaneResults(planned) });
      manifest.plan.shardPlan.gates.staleTimingUsedWithoutFallbackCount = 1;
      rehashRunManifest(manifest);

      expectIssueCode(() => validateRunManifest(manifest), 'SHARD_PLAN_GATES_INVALID');
    }
  );

  it('keeps explicit conservative timing fallback valid through completion', () => {
    const fallbackInput = structuredClone(fixtureInput);
    fallbackInput.shardPlan = buildShardPlan({
      selection: fallbackInput.shardPlan.selection,
      timingSummary: fallbackInput.timingSummary,
      policy: fallbackInput.policy,
      expectedCommitSha: fallbackInput.repository.commitSha,
      expectedEnvironmentClass: environmentClass,
    });

    const planned = createRunManifestPlan(fallbackInput);
    const completed = finalizeRunManifest(planned, {
      laneResults: validLaneResults(planned),
    });

    expect(planned.plan.shardPlan.timingBinding).toMatchObject({
      status: 'stale',
      fallbackTimingCount: 3,
      fallbackReasonCodes: ['TIMING_PROVENANCE_MISSING'],
    });
    expect(planned.plan.shardPlan.gates.staleTimingUsedWithoutFallbackCount).toBe(0);
    expect(validateRunManifest(completed)).toEqual(completed);
  });

  it('emits a compact matrix and keeps full identities inside the immutable plan', () => {
    const manifest = createRunManifestPlan(input);

    expect(manifest.matrix).toEqual([
      { lane: 'core', shardId: 'core-01' },
      { lane: 'feature', shardId: 'feature-01' },
    ]);
    expect(manifest.plan.shardPlan).toEqual(input.shardPlan);
    expect(manifest.plan.timingSnapshotHash).toBe(input.timingSummary.timingSnapshotHash);
    expect(manifest.plan.policyHash).toBe(input.policyHash);
    expect(manifest.plan).not.toHaveProperty('timingSummary');
    expect(manifest.plan).not.toHaveProperty('policy');
    expect(manifest.plan).not.toHaveProperty('shards');
    expect(manifest.plan.shardPlan.shards[0].identityKeys).toEqual([
      'vitest::tests/core-a.test.ts',
      'vitest::tests/core-b.test.ts',
    ]);
    expect(manifest.status).toBe('planned');
    expect(manifest.results).toEqual([]);
    expect(manifest.gates).toBeNull();
  });

  it('rejects a non-canonical reordered Shard Plan', () => {
    const reordered = structuredClone(input);
    reordered.shardPlan.shards.reverse();
    for (const shard of reordered.shardPlan.shards) shard.identityKeys.reverse();

    expect(() => createRunManifestPlan(reordered)).toThrow('SHARD_PLAN_NOT_CANONICAL');
  });

  it('rejects duplicate shard keys and duplicate planned identities', () => {
    const duplicateShard = structuredClone(input);
    duplicateShard.shardPlan.shards.push(structuredClone(duplicateShard.shardPlan.shards[0]));
    expectIssueCode(() => createRunManifestPlan(duplicateShard), 'SHARD_PLAN_SHARD_DUPLICATE');

    const duplicateIdentity = structuredClone(input);
    duplicateIdentity.shardPlan.shards[1].identityKeys.push('vitest::tests/core-a.test.ts');
    expectIssueCode(
      () => createRunManifestPlan(duplicateIdentity),
      'SHARD_PLAN_IDENTITY_DUPLICATE'
    );
  });

  it('finalizes the same authority and preserves planHash', () => {
    const planned = createRunManifestPlan(input);
    const completed = finalizeRunManifest(planned, {
      laneResults: validLaneResults(planned),
    });

    expect(completed.status).toBe('complete');
    expect(completed.planHash).toBe(planned.planHash);
    expect(completed.plan).toEqual(planned.plan);
    expect(completed.gates).toEqual({
      missingShardCount: 0,
      omittedIdentityCount: 0,
      duplicateExecutionCount: 0,
      unplannedExecutionCount: 0,
      requiredCoreIdentityMissingCount: 0,
    });
  });

  it('records failed finalization without creating a second manifest authority', () => {
    const planned = createRunManifestPlan(input);
    const failed = finalizeRunManifest(planned, {
      laneResults: validLaneResults(planned).slice(0, 1),
    });

    expect(failed.status).toBe('failed');
    expect(failed.planHash).toBe(planned.planHash);
    expect(failed.plan).toEqual(planned.plan);
    expect(failed.failure.issueCode).toBe('CI_REQUIRED_SHARD_MISSING');
  });

  it('rejects ungoverned top-level authority fields for every manifest state', () => {
    const planned = createRunManifestPlan(input);
    planned.shards = structuredClone(planned.plan.shardPlan.shards);
    expect(() => validateRunManifest(planned)).toThrow('CI_MANIFEST_PLANNED_STATE_INVALID');

    const completePlan = createRunManifestPlan(input);
    const complete = finalizeRunManifest(completePlan, {
      laneResults: validLaneResults(completePlan),
    });
    complete.shardPlan = structuredClone(complete.plan.shardPlan);
    expect(() => validateRunManifest(complete)).toThrow('CI_MANIFEST_COMPLETE_STATE_INVALID');

    const failedPlan = createRunManifestPlan(input);
    const failed = finalizeRunManifest(failedPlan, {
      laneResults: validLaneResults(failedPlan).slice(0, 1),
    });
    failed.extra = true;
    expect(() => validateRunManifest(failed)).toThrow('CI_MANIFEST_FAILED_STATE_INVALID');
  });

  it.each([
    ['planned', () => createRunManifestPlan(input), 'CI_MANIFEST_PLANNED_STATE_INVALID'],
    [
      'complete',
      () => {
        const planned = createRunManifestPlan(input);
        return finalizeRunManifest(planned, { laneResults: validLaneResults(planned) });
      },
      'CI_MANIFEST_COMPLETE_STATE_INVALID',
    ],
    [
      'failed',
      () => {
        const planned = createRunManifestPlan(input);
        return finalizeRunManifest(planned, {
          laneResults: validLaneResults(planned).slice(0, 1),
        });
      },
      'CI_MANIFEST_FAILED_STATE_INVALID',
    ],
  ])('rejects joined-key shadow authority in the %s state', (_status, createManifest, code) => {
    const manifest = replaceEnumerableKeysWithJoinedShadow(createManifest());

    expectIssueCode(() => validateRunManifest(manifest), code);
  });

  it('rejects plan drift and non-compact matrix rows', () => {
    const planDrift = createRunManifestPlan(input);
    planDrift.plan.catalogHash = `sha256:${'3'.repeat(64)}`;
    expect(() => validateRunManifest(planDrift)).toThrow('CI_MANIFEST_PLAN_HASH_MISMATCH');

    const expandedMatrix = createRunManifestPlan(input);
    expandedMatrix.matrix[0].identityKeys = ['vitest::tests/core-a.test.ts'];
    expect(() => validateRunManifest(expandedMatrix)).toThrow('CI_MANIFEST_MATRIX_INVALID');
  });

  it('rejects forged completion and sparse plan arrays', () => {
    const planned = createRunManifestPlan(input);
    const forged = {
      ...planned,
      status: 'complete',
      results: [],
      gates: {
        missingShardCount: 0,
        omittedIdentityCount: 0,
        duplicateExecutionCount: 0,
        unplannedExecutionCount: 0,
        requiredCoreIdentityMissingCount: 0,
      },
    };
    expect(() => validateRunManifest(forged)).toThrow('CI_REQUIRED_SHARD_MISSING');

    const sparseShards = structuredClone(input);
    delete sparseShards.shardPlan.shards[0];
    expectIssueCode(() => createRunManifestPlan(sparseShards), 'SHARD_PLAN_SHARDS_INVALID');

    const sparseIdentities = structuredClone(input);
    delete sparseIdentities.shardPlan.shards[0].identityKeys[0];
    expectIssueCode(() => createRunManifestPlan(sparseIdentities), 'SHARD_PLAN_IDENTITIES_INVALID');
  });

  it.each([
    ['non-object plan', null, 'SHARD_PLAN_OBJECT_INVALID'],
    [
      'invalid schema version',
      { ...structuredClone(input.shardPlan), schemaVersion: 'ci-shard-plan/v2' },
      'SHARD_PLAN_SCHEMA_VERSION_INVALID',
    ],
  ])('preserves the granular Shard Plan code for %s', (_label, shardPlan, code) => {
    const invalidInput = structuredClone(input);
    invalidInput.shardPlan = shardPlan;

    expectIssueCode(() => createRunManifestPlan(invalidInput), code);
  });

  it('rejects a shard hash paired with different shard contents', () => {
    const forged = structuredClone(input);
    forged.shardPlan.shards[0].identityKeys = ['vitest::tests/forged.test.ts'];

    expect(() => createRunManifestPlan(forged)).toThrow('SHARD_PLAN_HASH_MISMATCH');
  });

  it.each([
    ['selection-external identity', 'vitest::tests/not-selected.test.ts'],
    ['Windows absolute identity', 'vitest::C:/repo/tests/forged.test.ts'],
    ['Windows drive-relative identity', 'vitest::C:repo/tests/forged.test.ts'],
    ['UNC identity', 'vitest:://server/share/forged.test.ts'],
  ])('rejects a rehashed %s', (_label, identityKey) => {
    const forged = structuredClone(input);
    forged.shardPlan.shards[0].identityKeys[0] = identityKey;

    expectIssueCode(
      () => createRunManifestPlan(rehashShardPlan(forged)),
      'SHARD_PLAN_SELECTION_COVERAGE_MISMATCH'
    );
  });

  it('rejects rehashed lane membership and work-unit bound drift', () => {
    const laneDrift = structuredClone(input);
    laneDrift.shardPlan.shards[0].lane = 'feature';
    expectIssueCode(
      () => createRunManifestPlan(rehashShardPlan(laneDrift)),
      'SHARD_PLAN_LANE_MEMBERSHIP_MISMATCH'
    );

    const durationDrift = structuredClone(input);
    durationDrift.shardPlan.shards[0].estimatedDurationMs = 900000;
    expectIssueCode(
      () => createRunManifestPlan(rehashShardPlan(durationDrift)),
      'SHARD_WORK_UNIT_LIMIT_EXCEEDED'
    );
  });

  it('rejects rehashed shard layouts that were not produced by deterministic LPT', () => {
    const renamedShard = structuredClone(input);
    renamedShard.shardPlan.shards[0].shardId = 'core-99';
    expectIssueCode(
      () => createRunManifestPlan(rehashShardPlan(renamedShard)),
      'SHARD_PLAN_DERIVATION_MISMATCH'
    );

    const splitShard = structuredClone(input);
    splitShard.shardPlan.shards[0] = {
      lane: 'core',
      shardId: 'core-01',
      estimatedDurationMs: 1000,
      identityKeys: ['vitest::tests/core-a.test.ts'],
    };
    splitShard.shardPlan.shards.splice(1, 0, {
      lane: 'core',
      shardId: 'core-02',
      estimatedDurationMs: 1000,
      identityKeys: ['vitest::tests/core-b.test.ts'],
    });
    expectIssueCode(
      () => createRunManifestPlan(rehashShardPlan(splitShard)),
      'SHARD_PLAN_DERIVATION_MISMATCH'
    );
  });

  it.each([
    [
      'timing snapshot',
      (forged: any) => {
        forged.shardPlan.timingSnapshotHash = `sha256:${'2'.repeat(64)}`;
      },
    ],
    [
      'timing policy',
      (forged: any) => {
        forged.shardPlan.timingPolicy.maxShardDurationMs = 30000;
      },
    ],
    [
      'timing weights',
      (forged: any) => {
        forged.shardPlan.weights['vitest::tests/core-a.test.ts'] = 1500;
        forged.shardPlan.shards[0].estimatedDurationMs = 2500;
      },
    ],
  ])('rejects a rehashed Shard Plan with self-declared %s drift', (_label, mutate) => {
    const forged = structuredClone(input);
    mutate(forged);

    expectIssueCode(
      () => createRunManifestPlan(rehashShardPlan(forged)),
      'SHARD_PLAN_DERIVATION_MISMATCH'
    );
  });

  it('rejects authoritative timing or policy drift from the frozen Shard Plan', () => {
    const timingDrift = structuredClone(input);
    const currentRun = timingDrift.timingSummary.runs.at(-1);
    timingDrift.timingSummary = summarizeTimingEvents({
      commitSha: currentRun.commitSha,
      events: currentRun.events.map((event: any) => ({
        ...event,
        durationMs: event.durationMs + 500,
      })),
    });
    expectIssueCode(() => createRunManifestPlan(timingDrift), 'SHARD_PLAN_DERIVATION_MISMATCH');

    const policyDrift = structuredClone(input);
    policyDrift.policy.timing.maxShardDurationMs = 30000;
    policyDrift.policyHash = sha256Bytes(canonicalJsonBytes(policyDrift.policy));
    expectIssueCode(() => createRunManifestPlan(policyDrift), 'SHARD_PLAN_DERIVATION_MISMATCH');
  });

  it('rejects policy bytes that do not match the frozen policy hash', () => {
    const forged = structuredClone(input);
    forged.policy.timing.maxShardsPerLane = 3;

    expectIssueCode(() => createRunManifestPlan(forged), 'CI_MANIFEST_POLICY_HASH_MISMATCH');
  });

  it('writes one canonical governed manifest artifact', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'ci-run-manifest-'));
    temporaryRoots.push(repoRoot);
    const manifest = createRunManifestPlan(input);
    const receipt = writeRunManifest({ repoRoot, manifest });
    const bytes = readFileSync(receipt.path);

    expect(receipt.status).toBe('planned');
    expect(receipt.planHash).toBe(manifest.planHash);
    expect(bytes).toEqual(canonicalJsonBytes(manifest));
  });
});
