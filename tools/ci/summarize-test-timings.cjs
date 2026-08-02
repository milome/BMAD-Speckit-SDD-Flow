'use strict';

const path = require('node:path');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');

const TIMING_EVENT_FIELDS = Object.freeze([
  'eventId',
  'identityKey',
  'testPath',
  'runnerId',
  'durationMs',
  'outcome',
]);
const REGISTERED_TIMING_RUNNER_IDS = new Set(['node', 'vitest']);
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

function requireExactKeys(value, expectedKeys, code) {
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (actual.join('\0') !== expected.join('\0')) fail(code);
}

function normalizeCommitSha(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/iu.test(value.trim())) {
    fail('TIMING_COMMIT_SHA_INVALID');
  }
  return value.trim().toLowerCase();
}

function normalizeObservationContext(run) {
  const fields = ['environmentClass', 'observedAt', 'provenance', 'artifactHashes'];
  const presentFields = fields.filter((field) => Object.prototype.hasOwnProperty.call(run, field));
  if (presentFields.length === 0) return {};
  if (presentFields.length !== fields.length) fail('TIMING_RUN_PROVENANCE_INVALID');
  if (
    typeof run.environmentClass !== 'string' ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(run.environmentClass) ||
    typeof run.observedAt !== 'string' ||
    Number.isNaN(Date.parse(run.observedAt)) ||
    new Date(run.observedAt).toISOString() !== run.observedAt ||
    !TIMING_PROVENANCE_VALUES.has(run.provenance)
  ) {
    fail('TIMING_RUN_PROVENANCE_INVALID');
  }
  const artifactHashes = requireDenseArray(run.artifactHashes, 'TIMING_RUN_PROVENANCE_INVALID', {
    nonEmpty: true,
  });
  if (
    artifactHashes.some((hash) => typeof hash !== 'string' || !SHA256_PATTERN.test(hash)) ||
    artifactHashes.length !== new Set(artifactHashes).size
  ) {
    fail('TIMING_RUN_PROVENANCE_INVALID');
  }
  const canonicalArtifactHashes = [...artifactHashes].sort(compareText);
  if (canonicalArtifactHashes.some((hash, index) => hash !== artifactHashes[index])) {
    fail('TIMING_RUN_PROVENANCE_INVALID');
  }
  return {
    environmentClass: run.environmentClass,
    observedAt: run.observedAt,
    provenance: run.provenance,
    artifactHashes: canonicalArtifactHashes,
  };
}

function hasControlCharacter(value) {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}

function isWindowsAbsoluteOrDrivePrefixed(value) {
  return (
    /^[A-Za-z]:/u.test(value) ||
    path.win32.isAbsolute(value) ||
    value.startsWith('\\\\') ||
    value.startsWith('//')
  );
}

function normalizeTimingTestPath(value, code = 'TIMING_EVENT_INVALID') {
  if (typeof value !== 'string') fail(code);
  const trimmed = value.trim();
  if (trimmed === '' || hasControlCharacter(value) || isWindowsAbsoluteOrDrivePrefixed(trimmed)) {
    fail(code);
  }
  const normalized = path.posix.normalize(trimmed.replace(/\\/g, '/'));
  if (
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized) ||
    isWindowsAbsoluteOrDrivePrefixed(normalized)
  ) {
    fail(code);
  }
  return normalized;
}

function normalizeEvent(event, commitSha) {
  if (!isPlainObject(event)) fail('TIMING_EVENT_INVALID');
  requireExactKeys(event, TIMING_EVENT_FIELDS, 'TIMING_EVENT_INVALID');
  if (
    !REGISTERED_TIMING_RUNNER_IDS.has(event.runnerId) ||
    typeof event.identityKey !== 'string' ||
    event.identityKey.trim() === '' ||
    typeof event.eventId !== 'string' ||
    event.eventId.trim() === '' ||
    !Number.isSafeInteger(event.durationMs) ||
    event.durationMs <= 0 ||
    !['passed', 'failed', 'skipped'].includes(event.outcome)
  ) {
    fail('TIMING_EVENT_INVALID');
  }
  const runnerId = event.runnerId;
  const testPath = normalizeTimingTestPath(event.testPath);
  const identityKey = `${runnerId}::${testPath}`;
  if (event.identityKey.trim().replace(/\\/g, '/') !== identityKey) {
    fail('TIMING_EVENT_INVALID');
  }
  const eventId = event.eventId.trim();
  const expectedEventId = sha256Bytes(canonicalJsonBytes({ commitSha, identityKey }));
  if (eventId !== expectedEventId) {
    fail('TIMING_EVENT_ID_MISMATCH');
  }
  const normalized = {
    identityKey,
    testPath,
    runnerId,
    durationMs: Math.round(event.durationMs),
    outcome: event.outcome,
    eventId,
  };
  return normalized;
}

function compareEvent(left, right) {
  const identityOrder = compareText(left.identityKey, right.identityKey);
  if (identityOrder !== 0) return identityOrder;
  const durationOrder = left.durationMs - right.durationMs;
  if (durationOrder !== 0) return durationOrder;
  const outcomeOrder = compareText(left.outcome, right.outcome);
  if (outcomeOrder !== 0) return outcomeOrder;
  return compareText(left.eventId || '', right.eventId || '');
}

function normalizeRun(run) {
  if (!isPlainObject(run)) fail('TIMING_RUN_INVALID');
  const commitSha = normalizeCommitSha(run.commitSha);
  return {
    commitSha,
    ...normalizeObservationContext(run),
    events: requireDenseArray(run.events, 'TIMING_EVENTS_INVALID', { nonEmpty: true })
      .map((event) => normalizeEvent(event, commitSha))
      .sort(compareEvent),
  };
}

function median(values) {
  const ordered = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? Math.round((ordered[midpoint - 1] + ordered[midpoint]) / 2)
    : ordered[midpoint];
}

function summarizeTimingEvents({
  commitSha,
  events,
  previousRuns = [],
  historyWindowCommits = 20,
  environmentClass,
  observedAt,
  provenance,
  artifactHashes,
}) {
  if (
    !Number.isSafeInteger(historyWindowCommits) ||
    historyWindowCommits < 1 ||
    historyWindowCommits > 100
  ) {
    fail('TIMING_HISTORY_WINDOW_INVALID');
  }
  const currentRunInput = { commitSha, events };
  const observationContext = { environmentClass, observedAt, provenance, artifactHashes };
  if (Object.values(observationContext).some((value) => value !== undefined)) {
    Object.assign(currentRunInput, observationContext);
  }
  const currentRun = normalizeRun(currentRunInput);
  const runs = [
    ...requireDenseArray(previousRuns, 'TIMING_PREVIOUS_RUNS_INVALID').map(normalizeRun),
    currentRun,
  ];
  const retainedRuns = runs.slice(-historyWindowCommits);
  const commitShas = new Set();
  const eventIds = new Set();
  for (const run of retainedRuns) {
    if (commitShas.has(run.commitSha)) fail('TIMING_COMMIT_DUPLICATE');
    commitShas.add(run.commitSha);
    for (const event of run.events) {
      if (!event.eventId) continue;
      if (eventIds.has(event.eventId)) fail('TIMING_EVENT_ID_DUPLICATE');
      eventIds.add(event.eventId);
    }
  }
  const durations = new Map();
  for (const event of retainedRuns.flatMap((run) => run.events)) {
    if (!durations.has(event.identityKey)) durations.set(event.identityKey, []);
    durations.get(event.identityKey).push(event.durationMs);
  }
  const timings = Object.fromEntries(
    [...durations]
      .sort(([left], [right]) => compareText(left, right))
      .map(([identityKey, samples]) => {
        const medianMs = median(samples);
        const maxMs = Math.max(...samples);
        return [
          identityKey,
          {
            sampleCount: samples.length,
            medianMs,
            maxMs,
            conservativeMs: Math.max(medianMs, maxMs),
          },
        ];
      })
  );
  const summary = {
    schemaVersion: 'ci-test-timing-summary/v1',
    commitShas: retainedRuns.map((run) => run.commitSha),
    runs: retainedRuns,
    timings,
  };
  return {
    ...summary,
    timingSnapshotHash: sha256Bytes(canonicalJsonBytes(summary)),
  };
}

function summarizeTimingArtifacts({
  commitSha,
  environmentClass,
  observedAt,
  provenance,
  artifacts,
  previousSummary,
  historyWindowCommits = 20,
}) {
  const normalizedCommitSha = normalizeCommitSha(commitSha);
  const normalizedArtifacts = requireDenseArray(artifacts, 'TIMING_ARTIFACTS_INVALID', {
    nonEmpty: true,
  }).map((record) => {
    if (!isPlainObject(record) || !isPlainObject(record.artifact)) {
      fail('TIMING_ARTIFACTS_INVALID');
    }
    requireExactKeys(record, ['artifactHash', 'artifact'], 'TIMING_ARTIFACTS_INVALID');
    if (typeof record.artifactHash !== 'string' || !SHA256_PATTERN.test(record.artifactHash)) {
      fail('TIMING_ARTIFACTS_INVALID');
    }
    requireExactKeys(
      record.artifact,
      ['commitSha', 'planHash', 'events'],
      'TIMING_ARTIFACT_INVALID'
    );
    if (
      normalizeCommitSha(record.artifact.commitSha) !== normalizedCommitSha ||
      typeof record.artifact.planHash !== 'string' ||
      !SHA256_PATTERN.test(record.artifact.planHash)
    ) {
      fail('TIMING_ARTIFACT_INVALID');
    }
    return {
      artifactHash: record.artifactHash,
      planHash: record.artifact.planHash,
      events: requireDenseArray(record.artifact.events, 'TIMING_EVENTS_INVALID', {
        nonEmpty: true,
      }),
    };
  });
  const artifactHashes = normalizedArtifacts.map((record) => record.artifactHash).sort(compareText);
  if (artifactHashes.length !== new Set(artifactHashes).size) {
    fail('TIMING_ARTIFACTS_INVALID');
  }
  const previousRuns =
    previousSummary === undefined
      ? []
      : structuredClone(validateTimingSummary(previousSummary).runs);
  return summarizeTimingEvents({
    commitSha: normalizedCommitSha,
    environmentClass,
    observedAt,
    provenance,
    artifactHashes,
    events: normalizedArtifacts.flatMap((record) => record.events),
    previousRuns,
    historyWindowCommits,
  });
}

function summarizeTimingArtifactFiles({
  repoRoot = process.cwd(),
  artifactPaths,
  commitSha,
  environmentClass,
  observedAt,
  provenance,
  previousSummary,
  historyWindowCommits = 20,
}) {
  if (typeof repoRoot !== 'string' || repoRoot.trim() === '') fail('TIMING_REPO_ROOT_INVALID');
  const records = requireDenseArray(artifactPaths, 'TIMING_ARTIFACT_PATHS_INVALID', {
    nonEmpty: true,
  }).map((artifactPath) => {
    if (typeof artifactPath !== 'string' || artifactPath.trim() === '') {
      fail('TIMING_ARTIFACT_PATHS_INVALID');
    }
    const receipt = readCanonicalArtifact({
      repoRoot,
      filePath: path.resolve(repoRoot, artifactPath),
    });
    return {
      artifactHash: receipt.sha256,
      artifact: receipt.artifact,
    };
  });
  return summarizeTimingArtifacts({
    commitSha,
    environmentClass,
    observedAt,
    provenance,
    artifacts: records,
    previousSummary,
    historyWindowCommits,
  });
}

function createBootstrapTimingSummary() {
  const summary = {
    schemaVersion: 'ci-test-timing-summary/v1',
    commitShas: [],
    runs: [],
    timings: {},
  };
  return {
    ...summary,
    timingSnapshotHash: sha256Bytes(canonicalJsonBytes(summary)),
  };
}

function validateTimingSummary(summary) {
  if (!isPlainObject(summary) || summary.schemaVersion !== 'ci-test-timing-summary/v1') {
    fail('TIMING_SUMMARY_INVALID');
  }
  requireExactKeys(
    summary,
    ['schemaVersion', 'commitShas', 'runs', 'timings', 'timingSnapshotHash'],
    'TIMING_SUMMARY_INVALID'
  );
  const { timingSnapshotHash, ...body } = summary;
  const expectedHash = sha256Bytes(canonicalJsonBytes(body));
  if (timingSnapshotHash !== expectedHash) fail('TIMING_SNAPSHOT_HASH_MISMATCH');

  const runs = requireDenseArray(summary.runs, 'TIMING_SUMMARY_INVALID');
  const commitShas = requireDenseArray(summary.commitShas, 'TIMING_SUMMARY_INVALID');
  if (commitShas.length !== runs.length) {
    fail('TIMING_SUMMARY_INVALID');
  }
  if (runs.length === 0) {
    if (!isPlainObject(summary.timings) || Object.keys(summary.timings).length !== 0) {
      fail('TIMING_SUMMARY_INVALID');
    }
    const bootstrap = createBootstrapTimingSummary();
    if (!canonicalJsonBytes(bootstrap).equals(canonicalJsonBytes(summary))) {
      fail('TIMING_SUMMARY_INVALID');
    }
    return summary;
  }
  const currentRun = runs.at(-1);
  const recomputed = summarizeTimingEvents({
    ...currentRun,
    previousRuns: runs.slice(0, -1),
    historyWindowCommits: runs.length,
  });
  if (!canonicalJsonBytes(recomputed).equals(canonicalJsonBytes(summary))) {
    fail('TIMING_SUMMARY_INVALID');
  }
  return summary;
}

function timingWeight(timingSummary, identityKey) {
  if (!Object.prototype.hasOwnProperty.call(timingSummary.timings, identityKey)) return null;
  const timing = timingSummary.timings[identityKey];
  if (
    !isPlainObject(timing) ||
    !Number.isSafeInteger(timing.conservativeMs) ||
    timing.conservativeMs <= 0
  ) {
    fail('TIMING_WEIGHT_INVALID', { identityKey });
  }
  return timing.conservativeMs;
}

function observationFields(run) {
  if (
    !run ||
    typeof run.environmentClass !== 'string' ||
    typeof run.observedAt !== 'string' ||
    !TIMING_PROVENANCE_VALUES.has(run.provenance) ||
    !Array.isArray(run.artifactHashes)
  ) {
    return null;
  }
  return {
    observedCommitSha: run.commitSha,
    observedEnvironmentClass: run.environmentClass,
    observedAt: run.observedAt,
    provenance: run.provenance,
    artifactHashes: [...run.artifactHashes],
  };
}

function resolveTimingAuthority({
  timingSummary: rawTimingSummary,
  identityKeys: rawIdentityKeys,
  expectedCommitSha,
  expectedEnvironmentClass,
}) {
  const timingSummary = validateTimingSummary(rawTimingSummary);
  const commitSha = normalizeCommitSha(expectedCommitSha);
  if (
    typeof expectedEnvironmentClass !== 'string' ||
    !ENVIRONMENT_CLASS_PATTERN.test(expectedEnvironmentClass)
  ) {
    fail('TIMING_ENVIRONMENT_CLASS_INVALID');
  }
  const identityKeys = requireDenseArray(rawIdentityKeys, 'TIMING_IDENTITIES_INVALID', {
    nonEmpty: true,
  }).map((identityKey) => {
    if (typeof identityKey !== 'string' || identityKey.trim() === '') {
      fail('TIMING_IDENTITIES_INVALID');
    }
    return identityKey.trim();
  });
  if (identityKeys.length !== new Set(identityKeys).size) {
    fail('TIMING_IDENTITIES_INVALID');
  }
  identityKeys.sort(compareText);

  const commitRun = timingSummary.runs.find((run) => run.commitSha === commitSha);
  const observation = observationFields(commitRun);
  let matchingRun = null;
  let status = 'fallback';
  let fallbackReasonCode = 'TIMING_SUMMARY_EMPTY';

  if (timingSummary.runs.length > 0) {
    status = 'stale';
    fallbackReasonCode = 'TIMING_COMMIT_MISMATCH';
  }
  if (commitRun && !observation) {
    fallbackReasonCode = 'TIMING_PROVENANCE_MISSING';
  } else if (observation && observation.observedEnvironmentClass !== expectedEnvironmentClass) {
    fallbackReasonCode = 'TIMING_ENVIRONMENT_MISMATCH';
  } else if (observation) {
    matchingRun = commitRun;
    status = 'fresh';
    fallbackReasonCode = null;
  }

  const freshIdentitySet = new Set(
    matchingRun ? matchingRun.events.map((event) => event.identityKey) : []
  );
  const fallbackIdentityKeys = identityKeys.filter(
    (identityKey) => !freshIdentitySet.has(identityKey)
  );
  const staleTimingCount =
    status === 'stale'
      ? fallbackIdentityKeys.filter(
          (identityKey) => timingWeight(timingSummary, identityKey) !== null
        ).length
      : 0;
  if (status === 'fresh' && fallbackIdentityKeys.length > 0) {
    status = 'fallback';
    fallbackReasonCode = 'TIMING_IDENTITY_NOT_OBSERVED';
  }

  return {
    freshIdentityKeys: [...freshIdentitySet]
      .filter((identityKey) => identityKeys.includes(identityKey))
      .sort(compareText),
    binding: {
      expectedCommitSha: commitSha,
      expectedEnvironmentClass,
      status,
      observedCommitSha: observation?.observedCommitSha ?? null,
      observedEnvironmentClass: observation?.observedEnvironmentClass ?? null,
      observedAt: observation?.observedAt ?? null,
      provenance: observation?.provenance ?? null,
      artifactHashes: observation?.artifactHashes ?? [],
      freshTimingCount: identityKeys.length - fallbackIdentityKeys.length,
      staleTimingCount,
      fallbackTimingCount: fallbackIdentityKeys.length,
      fallbackIdentityKeys,
      fallbackReasonCodes: fallbackReasonCode ? [fallbackReasonCode] : [],
    },
  };
}

function parseCliArgs(args) {
  const options = {};
  const allowedFlags = new Set([
    '--artifact-index',
    '--commit-sha',
    '--environment-class',
    '--observed-at',
    '--provenance',
    '--previous-summary',
    '--output',
  ]);
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowedFlags.has(flag) || typeof value !== 'string' || value.trim() === '') {
      fail('TIMING_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  for (const required of [
    'artifact-index',
    'commit-sha',
    'environment-class',
    'observed-at',
    'provenance',
    'output',
  ]) {
    if (!options[required]) fail('TIMING_CLI_ARGS_INVALID');
  }
  return options;
}

function main(
  args = process.argv.slice(2),
  { repoRoot = process.cwd(), writeOutput = (value) => process.stdout.write(value) } = {}
) {
  const options = parseCliArgs(args);
  const artifactIndex = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, options['artifact-index']),
  }).artifact;
  if (!Array.isArray(artifactIndex)) fail('TIMING_ARTIFACT_INDEX_INVALID');
  const previousSummary = options['previous-summary']
    ? readCanonicalArtifact({
        repoRoot,
        filePath: path.resolve(repoRoot, options['previous-summary']),
      }).artifact
    : undefined;
  const summary = summarizeTimingArtifactFiles({
    repoRoot,
    artifactPaths: artifactIndex,
    commitSha: options['commit-sha'],
    environmentClass: options['environment-class'],
    observedAt: options['observed-at'],
    provenance: options.provenance,
    previousSummary,
  });
  const outputPath = path.resolve(repoRoot, options.output);
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: path.dirname(outputPath),
    fileName: path.basename(outputPath),
    artifact: summary,
  });
  writeOutput(`${JSON.stringify(receipt)}\n`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  createBootstrapTimingSummary,
  main,
  normalizeTimingTestPath,
  parseCliArgs,
  resolveTimingAuthority,
  summarizeTimingArtifactFiles,
  summarizeTimingArtifacts,
  summarizeTimingEvents,
  timingWeight,
  validateTimingSummary,
};
