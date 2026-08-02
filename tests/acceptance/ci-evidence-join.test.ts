import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const input = require('../fixtures/test-portfolio/run-manifest-input.json');
const {
  canonicalJsonBytes,
  sha256Bytes,
} = require('../../tools/test-portfolio-audit/canonical.cjs');
const { buildShardPlan } = require('../../tools/ci/build-shard-plan.cjs');
const { summarizeTimingEvents } = require('../../tools/ci/summarize-test-timings.cjs');
const { createRunManifestPlan } = require('../../tools/ci/write-ci-run-manifest.cjs');
const {
  joinCiEvidence,
  parseCliArgs,
} = require('../../tools/ci/join-ci-evidence.cjs');

function fixture() {
  const manifest = createRunManifestPlan(input);
  const laneResults = manifest.plan.shardPlan.shards.map((shard: any) => ({
    lane: shard.lane,
    shardId: shard.shardId,
    commitSha: manifest.plan.repository.commitSha,
    planHash: manifest.planHash,
    packageDescriptorHash: manifest.plan.packageDescriptorHash,
    tarballSha256: manifest.plan.tarballSha256,
    outcome: 'passed',
    executedIdentityKeys: [...shard.identityKeys],
  }));
  return { manifest, laneResults };
}

function expectedFailureFixture() {
  const expectedInput = structuredClone(input);
  const identityKey = 'vitest::tests/feature.test.ts';
  const selection = structuredClone(expectedInput.shardPlan.selection);
  const selectedItem = selection.selected.find((item: any) => item.identityKey === identityKey);
  selectedItem.expectedFailureReasonCode = 'KNOWN_FAILING_TEST_FIXTURE_DRIFT';
  selectedItem.reasonCodes = [...selectedItem.reasonCodes, 'PR_KNOWN_FAILURE_EXECUTION'].sort();
  const timingSummary = summarizeTimingEvents({
    commitSha: expectedInput.repository.commitSha,
    events: expectedInput.timingSummary.runs.flatMap((run: any) => run.events),
  });
  const shardPlan = buildShardPlan({
    selection,
    timingSummary,
    policy: expectedInput.policy,
    expectedCommitSha: expectedInput.repository.commitSha,
    expectedEnvironmentClass: expectedInput.shardPlan.timingBinding.expectedEnvironmentClass,
  });
  Object.assign(expectedInput, {
    selectionHash: shardPlan.selectionHash,
    timingSummary,
    policyHash: sha256Bytes(canonicalJsonBytes(expectedInput.policy)),
    shardPlan,
  });
  const manifest = createRunManifestPlan(expectedInput);
  const laneResults = manifest.plan.shardPlan.shards.map((shard: any) => ({
    lane: shard.lane,
    shardId: shard.shardId,
    commitSha: manifest.plan.repository.commitSha,
    planHash: manifest.planHash,
    packageDescriptorHash: manifest.plan.packageDescriptorHash,
    tarballSha256: manifest.plan.tarballSha256,
    outcome: shard.expectedFailureIdentityKeys ? 'expected_failed' : 'passed',
    executedIdentityKeys: [...shard.identityKeys],
    ...(shard.expectedFailureIdentityKeys
      ? {
          failedIdentityKeys: [...shard.expectedFailureIdentityKeys],
          evidenceStatus: { junit: 'complete', timing: 'complete' },
        }
      : {}),
  }));
  return { identityKey, manifest, laneResults };
}

describe('fail-closed CI Evidence Join', () => {
  it('publishes join exports before the CLI enters circular manifest validation', () => {
    const source = readFileSync('tools/ci/join-ci-evidence.cjs', 'utf8');

    expect(source.indexOf('module.exports = {')).toBeGreaterThanOrEqual(0);
    expect(source.indexOf('module.exports = {')).toBeLessThan(
      source.indexOf('if (require.main === module)')
    );
  });

  it('defaults the final manifest to the workflow upload directory', () => {
    expect(
      parseCliArgs([
        '--manifest',
        '.artifacts/test-portfolio/ci-run-manifest.json',
        '--lane-results-dir',
        '.artifacts/test-portfolio/lane-results',
      ])
    ).toMatchObject({
      'output-dir': '.artifacts/test-portfolio/final',
    });
  });

  it.each(['failed', 'cancelled', 'skipped'])('rejects a required %s lane', (outcome) => {
    const { manifest, laneResults } = fixture();
    laneResults[0].outcome = outcome;

    expect(() => joinCiEvidence({ manifest, laneResults })).toThrow('CI_REQUIRED_LANE_NOT_PASSED');
  });

  it('rejects stale plan hashes and unplanned or duplicate shard results', () => {
    const stale = fixture();
    stale.laneResults[0].planHash = 'sha256:stale';
    expect(() => joinCiEvidence(stale)).toThrow('CI_LANE_PLAN_HASH_MISMATCH');

    const wrongCommit = fixture();
    wrongCommit.laneResults[0].commitSha = 'f'.repeat(40);
    expect(() => joinCiEvidence(wrongCommit)).toThrow('CI_LANE_COMMIT_SHA_MISMATCH');

    const wrongDescriptor = fixture();
    wrongDescriptor.laneResults[0].packageDescriptorHash = `sha256:${'f'.repeat(64)}`;
    expect(() => joinCiEvidence(wrongDescriptor)).toThrow(
      'CI_LANE_PACKAGE_DESCRIPTOR_HASH_MISMATCH'
    );

    const wrongTarball = fixture();
    wrongTarball.laneResults[0].tarballSha256 = `sha256:${'e'.repeat(64)}`;
    expect(() => joinCiEvidence(wrongTarball)).toThrow('CI_LANE_TARBALL_HASH_MISMATCH');

    const unplanned = fixture();
    unplanned.laneResults[0].shardId = 'missing';
    expect(() => joinCiEvidence(unplanned)).toThrow('CI_UNPLANNED_SHARD_RESULT');

    const duplicate = fixture();
    duplicate.laneResults.push(structuredClone(duplicate.laneResults[0]));
    expect(() => joinCiEvidence(duplicate)).toThrow('CI_DUPLICATE_SHARD_RESULT');
  });

  it('rejects missing shards and omitted selected identities', () => {
    const missingShard = fixture();
    missingShard.laneResults.pop();
    expect(() => joinCiEvidence(missingShard)).toThrow('CI_REQUIRED_SHARD_MISSING');

    const omitted = fixture();
    omitted.laneResults[0].executedIdentityKeys.pop();
    expect(() => joinCiEvidence(omitted)).toThrow('CI_SELECTED_TEST_NOT_EXECUTED');
  });

  it('rejects duplicate and globally unplanned execution identities', () => {
    const duplicate = fixture();
    duplicate.laneResults[0].executedIdentityKeys.push(
      duplicate.laneResults[0].executedIdentityKeys[0]
    );
    expect(() => joinCiEvidence(duplicate)).toThrow('CI_TEST_EXECUTED_MORE_THAN_ONCE');

    const unplanned = fixture();
    unplanned.laneResults[0].executedIdentityKeys.push('vitest::tests/unplanned.test.ts');
    expect(() => joinCiEvidence(unplanned)).toThrow('CI_UNPLANNED_TEST_EXECUTED');
  });

  it('rejects cross-shard identity swaps even when global counts still match', () => {
    const swapped = fixture();
    const first = swapped.laneResults[0].executedIdentityKeys[0];
    const second = swapped.laneResults[1].executedIdentityKeys[0];
    swapped.laneResults[0].executedIdentityKeys[0] = second;
    swapped.laneResults[1].executedIdentityKeys[0] = first;

    expect(() => joinCiEvidence(swapped)).toThrow('CI_SHARD_IDENTITY_MISMATCH');
  });

  it('accepts only shard-declared expected failures', () => {
    const expected = expectedFailureFixture();
    expect(joinCiEvidence(expected)).toMatchObject({
      laneResults: expect.arrayContaining([
        expect.objectContaining({
          outcome: 'expected_failed',
          failedIdentityKeys: [expected.identityKey],
        }),
      ]),
    });

    const undeclared = fixture();
    undeclared.laneResults[0].outcome = 'expected_failed';
    undeclared.laneResults[0].failedIdentityKeys = [
      undeclared.laneResults[0].executedIdentityKeys[0],
    ];
    expect(() => joinCiEvidence(undeclared)).toThrow('CI_EXPECTED_FAILURE_NOT_DECLARED');

    const wrongIdentity = expectedFailureFixture();
    const expectedResult = wrongIdentity.laneResults.find(
      (result: any) => result.outcome === 'expected_failed'
    );
    expectedResult.failedIdentityKeys = ['vitest::tests/unplanned.test.ts'];
    expect(() => joinCiEvidence(wrongIdentity)).toThrow('CI_EXPECTED_FAILURE_IDENTITY_MISMATCH');

    const incompleteEvidence = expectedFailureFixture();
    const incompleteResult = incompleteEvidence.laneResults.find(
      (result: any) => result.outcome === 'expected_failed'
    );
    incompleteResult.evidenceStatus.timing = 'partial';
    expect(() => joinCiEvidence(incompleteEvidence)).toThrow(
      'CI_EXPECTED_FAILURE_EVIDENCE_INCOMPLETE'
    );
  });

  it('returns deterministic lane results and all-zero gates', () => {
    const first = fixture();
    const second = fixture();
    second.laneResults.reverse();
    for (const result of second.laneResults) result.executedIdentityKeys.reverse();

    const firstJoin = joinCiEvidence(first);
    const secondJoin = joinCiEvidence(second);
    expect(canonicalJsonBytes(firstJoin)).toEqual(canonicalJsonBytes(secondJoin));
    expect(firstJoin.gates).toEqual({
      missingShardCount: 0,
      omittedIdentityCount: 0,
      duplicateExecutionCount: 0,
      unplannedExecutionCount: 0,
      requiredCoreIdentityMissingCount: 0,
    });
  });
});
