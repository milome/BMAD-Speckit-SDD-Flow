'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { validateSelection } = require('./select-ci-tests.cjs');
const {
  createBootstrapTimingSummary,
  resolveTimingAuthority,
  timingWeight,
  validateTimingSummary,
} = require('./summarize-test-timings.cjs');
const { readTestPolicy } = require('./test-policy.cjs');

const PROFILES = new Set([
  'pr-fast',
  'pr-full',
  'nightly-deep',
  'release-verify',
  'nightly-full',
  'release-full',
]);
const SHARD_GATE_FIELDS = Object.freeze([
  'shardCoverageMismatchCount',
  'shardDuplicateIdentityCount',
  'maxShardDurationExceededCount',
  'prWallClockBudgetExceededCount',
]);
const TIMING_BOUND_SHARD_GATE_FIELDS = Object.freeze([
  ...SHARD_GATE_FIELDS,
  'staleTimingUsedWithoutFallbackCount',
]);
const TIMING_BINDING_STATUSES = new Set(['fresh', 'stale', 'fallback']);
const TIMING_PROVENANCE_VALUES = new Set(['runner_observed']);
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/u;
const ENVIRONMENT_CLASS_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireDenseArray(value, code, { nonEmpty = false } = {}) {
  if (!Array.isArray(value) || (nonEmpty && value.length === 0)) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) fail(code);
  }
  return value;
}

function requirePositiveInteger(value, code, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail(code);
  return value;
}

function requireNonEmptyString(value, code) {
  if (typeof value !== 'string' || value.trim() === '') fail(code);
  return value.trim();
}

function requireHash(value, code) {
  const hash = requireNonEmptyString(value, code);
  if (!SHA256_PATTERN.test(hash)) fail(code);
  return hash;
}

function normalizeCommitSha(value, code) {
  const commitSha = requireNonEmptyString(value, code).toLowerCase();
  if (!/^[0-9a-f]{40}$/u.test(commitSha)) fail(code);
  return commitSha;
}

function normalizeExpectedTimingContext(expectedCommitSha, expectedEnvironmentClass) {
  const commitProvided = expectedCommitSha !== undefined;
  const environmentProvided = expectedEnvironmentClass !== undefined;
  if (!commitProvided && !environmentProvided) return null;
  if (!commitProvided || !environmentProvided) fail('SHARD_TIMING_BINDING_INPUT_INVALID');
  const environmentClass = requireNonEmptyString(
    expectedEnvironmentClass,
    'SHARD_TIMING_ENVIRONMENT_INVALID'
  );
  if (!ENVIRONMENT_CLASS_PATTERN.test(environmentClass)) {
    fail('SHARD_TIMING_ENVIRONMENT_INVALID');
  }
  return {
    expectedCommitSha: normalizeCommitSha(expectedCommitSha, 'SHARD_TIMING_COMMIT_INVALID'),
    expectedEnvironmentClass: environmentClass,
  };
}

function normalizeCanonicalStringArray(value, code) {
  const normalized = requireDenseArray(value, code).map((entry) =>
    requireNonEmptyString(entry, code)
  );
  const canonical = [...normalized].sort(compareText);
  if (
    normalized.length !== new Set(normalized).size ||
    normalized.some((entry, index) => entry !== canonical[index])
  ) {
    fail(code);
  }
  return normalized;
}

function normalizeIdentityKeys(value) {
  const values = requireDenseArray(value, 'SHARD_PLAN_IDENTITIES_INVALID', {
    nonEmpty: true,
  });
  if (values.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    fail('SHARD_PLAN_IDENTITIES_INVALID');
  }
  const normalized = values.map((entry) => entry.trim());
  if (new Set(normalized).size !== normalized.length) {
    fail('SHARD_PLAN_IDENTITY_DUPLICATE');
  }
  return normalized.sort(compareText);
}

function normalizeSelection(selection) {
  validateSelection(selection);
  const identities = new Set();
  return {
    profile: selection.profile,
    selected: requireDenseArray(selection.selected, 'SHARD_SELECTION_INVALID', {
      nonEmpty: true,
    })
      .map((item) => {
        if (!isPlainObject(item)) fail('SHARD_SELECTION_ITEM_INVALID');
        const normalized = {
          identityKey: requireNonEmptyString(item.identityKey, 'SHARD_SELECTION_IDENTITY_INVALID'),
          runnerId: requireNonEmptyString(item.runnerId, 'SHARD_SELECTION_RUNNER_INVALID'),
          testPath: requireNonEmptyString(item.testPath, 'SHARD_SELECTION_PATH_INVALID'),
          lane: requireNonEmptyString(item.lane, 'SHARD_SELECTION_LANE_INVALID'),
          expectedFailureReasonCode:
            item.expectedFailureReasonCode === undefined
              ? null
              : requireNonEmptyString(
                  item.expectedFailureReasonCode,
                  'SHARD_SELECTION_EXPECTED_FAILURE_INVALID'
                ),
          estimatedDurationMs:
            item.estimatedDurationMs === undefined ? null : item.estimatedDurationMs,
        };
        if (
          normalized.estimatedDurationMs !== null &&
          (!Number.isSafeInteger(normalized.estimatedDurationMs) ||
            normalized.estimatedDurationMs < 0 ||
            normalized.estimatedDurationMs > 3_600_000)
        ) {
          fail('SHARD_SELECTION_DURATION_INVALID');
        }
        if (identities.has(normalized.identityKey)) {
          fail('SHARD_SELECTION_IDENTITY_DUPLICATE', {
            identityKey: normalized.identityKey,
          });
        }
        identities.add(normalized.identityKey);
        return normalized;
      })
      .sort((left, right) => compareText(left.identityKey, right.identityKey)),
  };
}

function normalizeTimingPolicy(policy) {
  if (!isPlainObject(policy) || !isPlainObject(policy.timing)) {
    fail('SHARD_TIMING_POLICY_INVALID');
  }
  const timing = {
    unknownDurationMs: requirePositiveInteger(
      policy.timing.unknownDurationMs,
      'SHARD_UNKNOWN_DURATION_INVALID',
      480000
    ),
    maxShardDurationMs: requirePositiveInteger(
      policy.timing.maxShardDurationMs,
      'SHARD_MAX_DURATION_INVALID',
      480000
    ),
    maxShardsPerLane: requirePositiveInteger(
      policy.timing.maxShardsPerLane,
      'SHARD_MAX_COUNT_INVALID',
      64
    ),
    prP95Minutes: requirePositiveInteger(
      policy.timing.prP95Minutes ??
        policy?.budgets?.prP95Minutes ??
        Math.ceil(policy.timing.maxShardDurationMs / 60000),
      'SHARD_PR_TIME_BUDGET_INVALID',
      15
    ),
  };
  return timing;
}

function selectionHash(selection) {
  return sha256Bytes(canonicalJsonBytes(selection));
}

function normalizeWeights(weights, selection, timingPolicy) {
  if (!isPlainObject(weights)) fail('SHARD_PLAN_WEIGHTS_INVALID');
  const expectedIdentityKeys = selection.selected.map((item) => item.identityKey);
  const actualIdentityKeys = Object.keys(weights).sort(compareText);
  if (
    expectedIdentityKeys.length !== actualIdentityKeys.length ||
    expectedIdentityKeys.some((identityKey, index) => identityKey !== actualIdentityKeys[index])
  ) {
    fail('SHARD_PLAN_SELECTION_COVERAGE_MISMATCH');
  }
  return Object.fromEntries(
    actualIdentityKeys.map((identityKey) => {
      const weightMs = weights[identityKey];
      if (!Number.isSafeInteger(weightMs) || weightMs <= 0) {
        fail('SHARD_PLAN_WEIGHT_INVALID', { identityKey });
      }
      if (weightMs > timingPolicy.maxShardDurationMs) {
        fail('SHARD_WORK_UNIT_LIMIT_EXCEEDED', { identityKeys: [identityKey] });
      }
      return [identityKey, weightMs];
    })
  );
}

function validateTimingBinding(binding, selection) {
  if (!isPlainObject(binding)) fail('SHARD_TIMING_BINDING_INVALID');
  const expectedKeys = [
    'expectedCommitSha',
    'expectedEnvironmentClass',
    'status',
    'observedCommitSha',
    'observedEnvironmentClass',
    'observedAt',
    'provenance',
    'artifactHashes',
    'freshTimingCount',
    'staleTimingCount',
    'fallbackTimingCount',
    'fallbackIdentityKeys',
    'fallbackReasonCodes',
  ].sort(compareText);
  const actualKeys = Object.keys(binding).sort(compareText);
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((field, index) => field !== expectedKeys[index])
  ) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  const expectedCommitSha = normalizeCommitSha(
    binding.expectedCommitSha,
    'SHARD_TIMING_COMMIT_INVALID'
  );
  const expectedEnvironmentClass = requireNonEmptyString(
    binding.expectedEnvironmentClass,
    'SHARD_TIMING_ENVIRONMENT_INVALID'
  );
  if (
    !ENVIRONMENT_CLASS_PATTERN.test(expectedEnvironmentClass) ||
    !TIMING_BINDING_STATUSES.has(binding.status)
  ) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  if (
    binding.observedCommitSha !== null &&
    normalizeCommitSha(binding.observedCommitSha, 'SHARD_TIMING_BINDING_INVALID') !==
      binding.observedCommitSha
  ) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  if (
    binding.observedEnvironmentClass !== null &&
    (typeof binding.observedEnvironmentClass !== 'string' ||
      !ENVIRONMENT_CLASS_PATTERN.test(binding.observedEnvironmentClass))
  ) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  if (
    binding.observedAt !== null &&
    (typeof binding.observedAt !== 'string' ||
      Number.isNaN(Date.parse(binding.observedAt)) ||
      new Date(binding.observedAt).toISOString() !== binding.observedAt)
  ) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  if (binding.provenance !== null && !TIMING_PROVENANCE_VALUES.has(binding.provenance)) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  const artifactHashes = normalizeCanonicalStringArray(
    binding.artifactHashes,
    'SHARD_TIMING_BINDING_INVALID'
  );
  if (artifactHashes.some((hash) => !SHA256_PATTERN.test(hash))) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  const fallbackIdentityKeys = normalizeCanonicalStringArray(
    binding.fallbackIdentityKeys,
    'SHARD_TIMING_BINDING_INVALID'
  );
  const fallbackReasonCodes = normalizeCanonicalStringArray(
    binding.fallbackReasonCodes,
    'SHARD_TIMING_BINDING_INVALID'
  );
  const selectedIdentityKeys = selection.selected.map((item) => item.identityKey);
  if (
    !Number.isSafeInteger(binding.freshTimingCount) ||
    binding.freshTimingCount < 0 ||
    !Number.isSafeInteger(binding.staleTimingCount) ||
    binding.staleTimingCount < 0 ||
    !Number.isSafeInteger(binding.fallbackTimingCount) ||
    binding.fallbackTimingCount < 0 ||
    binding.freshTimingCount + binding.fallbackTimingCount !== selectedIdentityKeys.length ||
    binding.staleTimingCount > binding.fallbackTimingCount ||
    binding.fallbackTimingCount !== fallbackIdentityKeys.length ||
    fallbackIdentityKeys.some((identityKey) => !selectedIdentityKeys.includes(identityKey)) ||
    (binding.fallbackTimingCount === 0) !== (fallbackReasonCodes.length === 0) ||
    (binding.status === 'fresh' && binding.fallbackTimingCount !== 0) ||
    (binding.status === 'fallback' && binding.fallbackTimingCount === 0)
  ) {
    fail('SHARD_TIMING_BINDING_INVALID');
  }
  return {
    ...binding,
    expectedCommitSha,
    expectedEnvironmentClass,
    artifactHashes,
    fallbackIdentityKeys,
    fallbackReasonCodes,
  };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? Math.round((ordered[midpoint - 1] + ordered[midpoint]) / 2)
    : ordered[midpoint];
}

function allocateLane(items, shardCount, lane, { expectedFailure = false } = {}) {
  const shardIdPrefix = expectedFailure ? `${lane}-xfail` : lane;
  const shards = Array.from({ length: shardCount }, (_value, index) => ({
    lane,
    shardId: `${shardIdPrefix}-${String(index + 1).padStart(2, '0')}`,
    estimatedDurationMs: 0,
    identityKeys: [],
    ...(expectedFailure ? { expectedFailureIdentityKeys: [] } : {}),
  }));
  const ordered = [...items].sort(
    (left, right) =>
      right.weightMs - left.weightMs || compareText(left.identityKey, right.identityKey)
  );
  for (const item of ordered) {
    const target = [...shards].sort(
      (left, right) =>
        left.estimatedDurationMs - right.estimatedDurationMs ||
        compareText(left.shardId, right.shardId)
    )[0];
    target.identityKeys.push(item.identityKey);
    target.identityKeys.sort(compareText);
    if (expectedFailure) {
      target.expectedFailureIdentityKeys.push(item.identityKey);
      target.expectedFailureIdentityKeys.sort(compareText);
    }
    target.estimatedDurationMs += item.weightMs;
  }
  return shards;
}

function buildShardPlan({
  selection: rawSelection,
  timingSummary: rawTimingSummary,
  policy,
  expectedCommitSha,
  expectedEnvironmentClass,
}) {
  const selectionArtifact = structuredClone(validateSelection(rawSelection));
  const selection = normalizeSelection(selectionArtifact);
  const timingSummary = validateTimingSummary(rawTimingSummary);
  const timingPolicy = normalizeTimingPolicy(policy);
  const timingContext = normalizeExpectedTimingContext(expectedCommitSha, expectedEnvironmentClass);
  const timingDecision = timingContext
    ? resolveTimingAuthority({
        timingSummary,
        identityKeys: selection.selected.map((item) => item.identityKey),
        expectedCommitSha: timingContext.expectedCommitSha,
        expectedEnvironmentClass: timingContext.expectedEnvironmentClass,
      })
    : null;
  const freshIdentitySet = new Set(timingDecision?.freshIdentityKeys || []);
  const executionGroups = new Map();
  for (const item of selection.selected) {
    const expectedFailure = item.expectedFailureReasonCode !== null;
    const groupKey = `${item.lane}\0${expectedFailure ? 'expected_failure' : 'blocking'}`;
    if (!executionGroups.has(groupKey)) {
      executionGroups.set(groupKey, {
        lane: item.lane,
        expectedFailure,
        items: [],
      });
    }
    executionGroups.get(groupKey).items.push(item);
  }
  const shards = [];
  const weights = {};
  const shardCountsByLane = new Map();
  for (const group of [...executionGroups.values()].sort(
    (left, right) =>
      compareText(left.lane, right.lane) ||
      Number(left.expectedFailure) - Number(right.expectedFailure)
  )) {
    const { lane, expectedFailure, items: laneItems } = group;
    const knownWeights = laneItems
      .map((item) =>
        timingDecision && !freshIdentitySet.has(item.identityKey)
          ? null
          : timingWeight(timingSummary, item.identityKey)
      )
      .filter((value) => value !== null);
    const observedMedianAcrossLane = knownWeights.length > 0 ? median(knownWeights) : 0;
    const unknownWeight = Math.max(timingPolicy.unknownDurationMs, observedMedianAcrossLane);
    const weighted = laneItems.map((item) => ({
      identityKey: item.identityKey,
      weightMs:
        timingDecision && !freshIdentitySet.has(item.identityKey)
          ? (item.estimatedDurationMs ?? unknownWeight)
          : (timingWeight(timingSummary, item.identityKey) ??
            item.estimatedDurationMs ??
            unknownWeight),
    }));
    for (const item of weighted) weights[item.identityKey] = item.weightMs;
    if (weighted.some((item) => item.weightMs > timingPolicy.maxShardDurationMs)) {
      fail('SHARD_WORK_UNIT_LIMIT_EXCEEDED', {
        identityKeys: weighted
          .filter((item) => item.weightMs > timingPolicy.maxShardDurationMs)
          .map((item) => item.identityKey),
      });
    }
    const totalDurationMs = weighted.reduce((total, item) => total + item.weightMs, 0);
    const requiredShardCount = Math.max(
      1,
      Math.ceil(totalDurationMs / timingPolicy.maxShardDurationMs)
    );
    if (requiredShardCount > timingPolicy.maxShardsPerLane) {
      fail('SHARD_LANE_CAPACITY_EXCEEDED', {
        lane,
        totalDurationMs,
        maxShardDurationMs: timingPolicy.maxShardDurationMs,
        maxShardsPerLane: timingPolicy.maxShardsPerLane,
        laneCapacityMs: timingPolicy.maxShardDurationMs * timingPolicy.maxShardsPerLane,
        requiredShardCount,
      });
    }
    const shardCount = Math.min(weighted.length, requiredShardCount);
    const nextShardCount = (shardCountsByLane.get(lane) || 0) + shardCount;
    if (nextShardCount > timingPolicy.maxShardsPerLane) {
      fail('SHARD_LANE_CAPACITY_EXCEEDED', {
        lane,
        maxShardsPerLane: timingPolicy.maxShardsPerLane,
        requiredShardCount: nextShardCount,
      });
    }
    shardCountsByLane.set(lane, nextShardCount);
    shards.push(...allocateLane(weighted, shardCount, lane, { expectedFailure }));
  }
  shards.sort((left, right) => {
    const laneOrder = compareText(left.lane, right.lane);
    return laneOrder !== 0 ? laneOrder : compareText(left.shardId, right.shardId);
  });
  const selectedIdentityKeys = selection.selected.map((item) => item.identityKey);
  const plannedIdentityKeys = shards.flatMap((shard) => shard.identityKeys);
  const plannedIdentitySet = new Set(plannedIdentityKeys);
  const shardCoverageMismatchCount = selectedIdentityKeys.filter(
    (identityKey) => !plannedIdentitySet.has(identityKey)
  ).length;
  const shardDuplicateIdentityCount = plannedIdentityKeys.length - plannedIdentitySet.size;
  const maxShardDurationExceededCount = shards.filter(
    (shard) => shard.estimatedDurationMs > timingPolicy.maxShardDurationMs
  ).length;
  const prWallClockBudgetExceededCount =
    selection.profile === 'pr-fast' || selection.profile === 'pr-full'
      ? Number(
          Math.max(...shards.map((shard) => shard.estimatedDurationMs)) >
            timingPolicy.prP95Minutes * 60_000
        )
      : 0;
  if (shardCoverageMismatchCount > 0) fail('SHARD_COVERAGE_MISMATCH');
  if (shardDuplicateIdentityCount > 0) fail('SHARD_IDENTITY_DUPLICATE');
  if (maxShardDurationExceededCount > 0) fail('SHARD_WORK_UNIT_LIMIT_EXCEEDED');
  if (prWallClockBudgetExceededCount > 0) fail('SHARD_PR_TIME_BUDGET_EXCEEDED');

  const plan = {
    schemaVersion: 'ci-shard-plan/v1',
    profile: selection.profile,
    selection: selectionArtifact,
    selectionHash: selectionHash(selectionArtifact),
    ...(timingDecision ? { timingBinding: timingDecision.binding } : {}),
    timingSnapshotHash: timingSummary.timingSnapshotHash,
    timingPolicy,
    weights: Object.fromEntries(
      Object.entries(weights).sort(([left], [right]) => compareText(left, right))
    ),
    shards,
    gates: {
      shardCoverageMismatchCount,
      shardDuplicateIdentityCount,
      maxShardDurationExceededCount,
      prWallClockBudgetExceededCount,
      ...(timingDecision ? { staleTimingUsedWithoutFallbackCount: 0 } : {}),
    },
  };
  return {
    ...plan,
    shardPlanHash: sha256Bytes(canonicalJsonBytes(plan)),
  };
}

function normalizeShard(shard) {
  if (!isPlainObject(shard)) fail('SHARD_PLAN_SHARD_INVALID');
  const identityKeys = normalizeIdentityKeys(shard.identityKeys);
  const expectedFailureIdentityKeys =
    shard.expectedFailureIdentityKeys === undefined
      ? null
      : normalizeIdentityKeys(shard.expectedFailureIdentityKeys);
  if (
    expectedFailureIdentityKeys !== null &&
    (expectedFailureIdentityKeys.length !== identityKeys.length ||
      expectedFailureIdentityKeys.some((identityKey, index) => identityKey !== identityKeys[index]))
  ) {
    fail('SHARD_PLAN_EXPECTED_FAILURE_ISOLATION_INVALID');
  }
  const normalized = {
    lane: requireNonEmptyString(shard.lane, 'SHARD_PLAN_LANE_INVALID'),
    shardId: requireNonEmptyString(shard.shardId, 'SHARD_PLAN_SHARD_ID_INVALID'),
    estimatedDurationMs: shard.estimatedDurationMs,
    identityKeys,
    ...(expectedFailureIdentityKeys === null ? {} : { expectedFailureIdentityKeys }),
  };
  if (!Number.isSafeInteger(normalized.estimatedDurationMs) || normalized.estimatedDurationMs < 0) {
    fail('SHARD_PLAN_DURATION_INVALID');
  }
  return normalized;
}

function validateShardPlanHash(shardPlan) {
  const { shardPlanHash, ...body } = shardPlan;
  const expectedHash = sha256Bytes(canonicalJsonBytes(body));
  if (shardPlanHash !== expectedHash) fail('SHARD_PLAN_HASH_MISMATCH');
}

function validateShardPlan(shardPlan) {
  if (!isPlainObject(shardPlan)) fail('SHARD_PLAN_OBJECT_INVALID');
  if (shardPlan.schemaVersion !== 'ci-shard-plan/v1') {
    fail('SHARD_PLAN_SCHEMA_VERSION_INVALID');
  }
  if (!PROFILES.has(shardPlan.profile)) fail('SHARD_PLAN_PROFILE_INVALID');
  const selectionArtifact = structuredClone(
    isPlainObject(shardPlan.selection) ? shardPlan.selection : fail('SHARD_PLAN_SELECTION_INVALID')
  );
  validateSelection(selectionArtifact);
  const selection = normalizeSelection(selectionArtifact);
  if (shardPlan.timingBinding === undefined) fail('SHARD_TIMING_BINDING_REQUIRED');
  const timingBinding = validateTimingBinding(shardPlan.timingBinding, selection);
  const expectedSelectionHash = selectionHash(selectionArtifact);
  if (
    requireHash(shardPlan.selectionHash, 'SHARD_PLAN_SELECTION_HASH_INVALID') !==
    expectedSelectionHash
  ) {
    fail('SHARD_PLAN_SELECTION_HASH_MISMATCH');
  }
  if (shardPlan.profile !== selection.profile) {
    fail('SHARD_PLAN_PROFILE_MEMBERSHIP_MISMATCH');
  }
  const timingPolicy = normalizeTimingPolicy({ timing: shardPlan.timingPolicy });
  const weights = normalizeWeights(shardPlan.weights, selection, timingPolicy);
  const selectedByIdentity = new Map(selection.selected.map((item) => [item.identityKey, item]));
  const shards = requireDenseArray(shardPlan.shards, 'SHARD_PLAN_SHARDS_INVALID', {
    nonEmpty: true,
  })
    .map(normalizeShard)
    .sort((left, right) => {
      const laneOrder = compareText(left.lane, right.lane);
      return laneOrder !== 0 ? laneOrder : compareText(left.shardId, right.shardId);
    });
  const shardKeys = new Set();
  const identityKeys = new Set();
  const shardCountsByLane = new Map();
  for (const shard of shards) {
    const shardKey = `${shard.lane}\0${shard.shardId}`;
    if (shardKeys.has(shardKey)) fail('SHARD_PLAN_SHARD_DUPLICATE');
    shardKeys.add(shardKey);
    shardCountsByLane.set(shard.lane, (shardCountsByLane.get(shard.lane) || 0) + 1);
    if (shardCountsByLane.get(shard.lane) > timingPolicy.maxShardsPerLane) {
      fail('SHARD_PLAN_SHARD_COUNT_EXCEEDED', { lane: shard.lane });
    }
    if (shard.estimatedDurationMs > timingPolicy.maxShardDurationMs) {
      fail('SHARD_WORK_UNIT_LIMIT_EXCEEDED', { shardId: shard.shardId });
    }
    let expectedDurationMs = 0;
    for (const identityKey of shard.identityKeys) {
      if (identityKeys.has(identityKey)) fail('SHARD_PLAN_IDENTITY_DUPLICATE');
      identityKeys.add(identityKey);
      const selectedItem = selectedByIdentity.get(identityKey);
      if (!selectedItem) {
        validateShardPlanHash(shardPlan);
        fail('SHARD_PLAN_SELECTION_COVERAGE_MISMATCH');
      }
      if (selectedItem.lane !== shard.lane) {
        fail('SHARD_PLAN_LANE_MEMBERSHIP_MISMATCH', {
          identityKey,
          expectedLane: selectedItem.lane,
          actualLane: shard.lane,
        });
      }
      const expectedFailureIdentityKeys = new Set(shard.expectedFailureIdentityKeys || []);
      if (
        (selectedItem.expectedFailureReasonCode !== null) !==
        expectedFailureIdentityKeys.has(identityKey)
      ) {
        fail('SHARD_PLAN_EXPECTED_FAILURE_MEMBERSHIP_MISMATCH', { identityKey });
      }
      expectedDurationMs += weights[identityKey];
    }
    if (shard.estimatedDurationMs !== expectedDurationMs) {
      fail('SHARD_PLAN_DURATION_MISMATCH', {
        shardId: shard.shardId,
        expectedDurationMs,
        actualDurationMs: shard.estimatedDurationMs,
      });
    }
  }
  if (
    identityKeys.size !== selectedByIdentity.size ||
    selection.selected.some((item) => !identityKeys.has(item.identityKey))
  ) {
    fail('SHARD_PLAN_SELECTION_COVERAGE_MISMATCH');
  }
  if (!isPlainObject(shardPlan.gates)) fail('SHARD_PLAN_GATES_INVALID');
  const gateFields = TIMING_BOUND_SHARD_GATE_FIELDS;
  const gateKeys = Object.keys(shardPlan.gates).sort(compareText);
  if (gateKeys.join('\0') !== [...gateFields].sort(compareText).join('\0')) {
    fail('SHARD_PLAN_GATES_INVALID');
  }
  for (const field of gateFields) {
    if (!Number.isSafeInteger(shardPlan.gates[field]) || shardPlan.gates[field] !== 0) {
      fail('SHARD_PLAN_GATES_INVALID');
    }
  }
  const body = {
    schemaVersion: 'ci-shard-plan/v1',
    profile: PROFILES.has(shardPlan.profile)
      ? shardPlan.profile
      : fail('SHARD_PLAN_PROFILE_INVALID'),
    selection: selectionArtifact,
    selectionHash: expectedSelectionHash,
    timingBinding,
    timingSnapshotHash: requireHash(
      shardPlan.timingSnapshotHash,
      'SHARD_TIMING_SNAPSHOT_HASH_INVALID'
    ),
    timingPolicy,
    weights,
    shards,
    gates: Object.fromEntries(gateFields.map((field) => [field, 0])),
  };
  const { shardPlanHash: _shardPlanHash, ...actualBody } = shardPlan;
  if (!canonicalJsonBytes(body).equals(canonicalJsonBytes(actualBody))) {
    fail('SHARD_PLAN_NOT_CANONICAL');
  }
  validateShardPlanHash(shardPlan);
  return shardPlan;
}

function writeShardPlan({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio',
  shardPlan,
}) {
  validateShardPlan(shardPlan);
  return writeCanonicalArtifact({
    repoRoot,
    outputDir,
    fileName: 'ci-shard-plan.json',
    artifact: shardPlan,
  });
}

function parseCliArgs(args) {
  const options = {
    policy: 'repo-governance/ci/test-policy.json',
    outputDir: '.artifacts/test-portfolio',
    timingSummary: '.artifacts/test-portfolio/ci-test-timing-summary.json',
  };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--selection',
        '--policy',
        '--timing-summary',
        '--output-dir',
        '--commit-sha',
        '--environment-class',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('SHARD_PLAN_CLI_ARGS_INVALID');
    }
    const key = flag.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    options[key] = value;
  }
  if (!options.selection) fail('SHARD_PLAN_CLI_ARGS_INVALID');
  if (!options.commitSha || !options.environmentClass) {
    fail('SHARD_TIMING_BINDING_INPUT_INVALID');
  }
  return options;
}

function readOrCreateTimingSummary(repoRoot, filePath) {
  const target = path.resolve(repoRoot, filePath);
  if (fs.existsSync(target)) {
    return readCanonicalArtifact({ repoRoot, filePath: target }).artifact;
  }
  const timingSummary = createBootstrapTimingSummary();
  writeCanonicalArtifact({
    repoRoot,
    outputDir: path.dirname(target),
    fileName: path.basename(target),
    artifact: timingSummary,
  });
  return timingSummary;
}

function main(args = process.argv.slice(2)) {
  const options = parseCliArgs(args);
  const repoRoot = process.cwd();
  const selection = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options.selection),
  }).artifact;
  const timingSummary = readOrCreateTimingSummary(repoRoot, options.timingSummary);
  const policy = readTestPolicy(repoRoot, options.policy);
  const shardPlan = buildShardPlan({
    selection,
    timingSummary,
    policy,
    expectedCommitSha: options.commitSha,
    expectedEnvironmentClass: options.environmentClass,
  });
  const receipt = writeShardPlan({
    repoRoot,
    outputDir: options.outputDir,
    shardPlan,
  });
  process.stdout.write(
    `${JSON.stringify({
      ...receipt,
      shardCount: shardPlan.shards.length,
      timingSnapshotHash: shardPlan.timingSnapshotHash,
    })}\n`
  );
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildShardPlan,
  main,
  parseCliArgs,
  readOrCreateTimingSummary,
  validateShardPlan,
  writeShardPlan,
};
