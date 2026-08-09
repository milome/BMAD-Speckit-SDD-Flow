'use strict';

const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const { canonicalJsonBytes, sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');
const {
  compareText,
  fail,
  readCanonicalArtifact,
  resolveOutputPath,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');

const PASSING_OUTCOMES = new Set(['passed', 'expected_failed']);
const PLANNING_OUTCOME = 'not_run';
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/u;
const SIX_MODEL_IDS = new Set([
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
]);
const STATUS_BEHAVIORS = Object.freeze({
  not_established: Object.freeze(['applicability_or_not_applicable', 'state_entry']),
  blocked: Object.freeze(['authority_rejection', 'fail_closed']),
  stale: Object.freeze(['invalidation', 'reconfirmation', 'stale_evidence_rejection']),
  pass: Object.freeze(['evidence_binding', 'successful_promotion']),
  awaiting_user_acceptance: Object.freeze([
    'delivery_confirmation',
    'record_closed_final_transition',
  ]),
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function artifactHash(value) {
  return sha256Bytes(canonicalJsonBytes(value));
}

function validatedCanonicalStrings(value, code) {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim() === '')
  ) {
    fail(code);
  }
  const canonical = value.map((entry) => entry.trim()).sort(compareText);
  if (
    new Set(canonical).size !== canonical.length ||
    canonical.some((entry, index) => entry !== value[index])
  ) {
    fail(code);
  }
  return canonical;
}

function diagnosticsBody(report) {
  const { diagnosticsHash: _hash, ...body } = report;
  return body;
}

function semanticIndexBody(index) {
  const { semanticIndexHash: _hash, ...body } = index;
  return body;
}

function semanticIndexMaps(index) {
  if (
    !isPlainObject(index) ||
    index.schemaVersion !== 'ci-shard-semantic-index/v1' ||
    index.semanticIndexHash !== artifactHash(semanticIndexBody(index)) ||
    !Array.isArray(index.tests) ||
    !Array.isArray(index.shards)
  ) {
    fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
  }
  const uncoveredObligationRefs = validatedCanonicalStrings(
    index.uncoveredObligationRefs,
    'CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID'
  );
  if (!Array.isArray(index.obligationBindings)) {
    fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
  }
  const obligationBindings = new Map();
  for (const binding of index.obligationBindings) {
    if (
      !isPlainObject(binding) ||
      typeof binding.obligationId !== 'string' ||
      binding.obligationId.trim() === '' ||
      (binding.modelRef !== null && !SIX_MODEL_IDS.has(binding.modelRef)) ||
      typeof binding.transitionRef !== 'string' ||
      binding.transitionRef.trim() === '' ||
      obligationBindings.has(binding.obligationId)
    ) {
      fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
    }
    obligationBindings.set(binding.obligationId, binding);
  }
  const tests = new Map();
  for (const test of index.tests) {
    if (
      !isPlainObject(test) ||
      typeof test.identityKey !== 'string' ||
      tests.has(test.identityKey)
    ) {
      fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
    }
    if (test.obligationRefs.some((obligationId) => !obligationBindings.has(obligationId))) {
      fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
    }
    tests.set(test.identityKey, test);
  }
  const shards = new Map();
  for (const shard of index.shards) {
    if (!isPlainObject(shard) || !Array.isArray(shard.identityKeys)) {
      fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
    }
    const key = `${shard.lane}\0${shard.shardId}`;
    if (shards.has(key)) fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
    if (shard.identityKeys.some((identityKey) => !tests.has(identityKey))) {
      fail('CI_DIAGNOSTICS_SEMANTIC_INDEX_INVALID');
    }
    shards.set(key, shard);
  }
  return { tests, shards, uncoveredObligationRefs, obligationBindings };
}

function resultKey(value) {
  return `${value.lane}\0${value.shardId}`;
}

function normalizeLaneResults(laneResults, shards) {
  if (!Array.isArray(laneResults)) fail('CI_DIAGNOSTICS_LANE_RESULTS_INVALID');
  const results = new Map();
  for (const result of laneResults) {
    if (
      !isPlainObject(result) ||
      typeof result.lane !== 'string' ||
      typeof result.shardId !== 'string' ||
      typeof result.outcome !== 'string' ||
      !Array.isArray(result.executedIdentityKeys)
    ) {
      fail('CI_DIAGNOSTICS_LANE_RESULT_INVALID');
    }
    const key = resultKey(result);
    const shard = shards.get(key);
    if (!shard) fail('CI_DIAGNOSTICS_UNPLANNED_SHARD_RESULT');
    if (results.has(key)) fail('CI_DIAGNOSTICS_DUPLICATE_SHARD_RESULT');
    const shardIdentities = new Set(shard.identityKeys);
    if (result.executedIdentityKeys.some((identityKey) => !shardIdentities.has(identityKey))) {
      fail('CI_DIAGNOSTICS_UNPLANNED_IDENTITY');
    }
    const failedIdentityKeys = Array.isArray(result.failedIdentityKeys)
      ? [...new Set(result.failedIdentityKeys)].sort(compareText)
      : [];
    if (failedIdentityKeys.some((identityKey) => !shardIdentities.has(identityKey))) {
      fail('CI_DIAGNOSTICS_UNPLANNED_IDENTITY');
    }
    results.set(key, { ...result, failedIdentityKeys });
  }
  return results;
}

function laneResultRef(laneResultRefs, key) {
  const value = laneResultRefs?.[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function failureFingerprint(input) {
  return artifactHash({
    lane: input.lane,
    shardId: input.shardId,
    identityKey: input.identityKey,
    outcome: input.outcome,
    evidenceStatus: input.evidenceStatus || null,
  });
}

function infrastructureFailures(values) {
  if (!Array.isArray(values)) fail('CI_DIAGNOSTICS_INFRASTRUCTURE_FAILURES_INVALID');
  return values.map((value) => {
    if (
      !isPlainObject(value) ||
      typeof value.lane !== 'string' ||
      value.lane.trim() === '' ||
      typeof value.shardId !== 'string' ||
      value.shardId.trim() === '' ||
      typeof value.outcome !== 'string' ||
      value.outcome.trim() === ''
    ) {
      fail('CI_DIAGNOSTICS_INFRASTRUCTURE_FAILURES_INVALID');
    }
    const failure = {
      lane: value.lane.trim(),
      shardId: value.shardId.trim(),
      identityKey: null,
      modelRefs: [],
      obligationRefs: [],
      transitionRefs: [],
      outcome: value.outcome.trim(),
      failureFingerprint: failureFingerprint({
        lane: value.lane.trim(),
        shardId: value.shardId.trim(),
        identityKey: null,
        outcome: value.outcome.trim(),
        evidenceStatus: value.evidenceStatus || null,
      }),
      logRef:
        typeof value.logRef === 'string' && value.logRef.trim() !== '' ? value.logRef.trim() : null,
      targetRefs: [],
      changedPaths: [],
      diagnosticPriority: 'normal',
    };
    return failure;
  });
}

function projectedTestResults({ tests, shards, results, laneResultRefs }) {
  const projected = new Map();
  const failures = [];
  for (const [key, shard] of [...shards].sort(([left], [right]) => compareText(left, right))) {
    const result = results.get(key) || null;
    const failedIdentities = new Set(result?.failedIdentityKeys || []);
    const executedIdentities = new Set(result?.executedIdentityKeys || []);
    const logRef =
      typeof result?.junitPath === 'string' && result.junitPath.trim() !== ''
        ? result.junitPath.trim()
        : laneResultRef(laneResultRefs, key);
    for (const identityKey of shard.identityKeys) {
      const semantic = tests.get(identityKey);
      const identityFailed = failedIdentities.has(identityKey);
      const identityMissing = result !== null && !executedIdentities.has(identityKey);
      const outcome = identityMissing
        ? 'missing'
        : identityFailed
          ? result.outcome
          : result?.outcome === PLANNING_OUTCOME
            ? PLANNING_OUTCOME
            : result && PASSING_OUTCOMES.has(result.outcome)
              ? 'passed'
              : 'unknown';
      const fingerprint =
        identityFailed || identityMissing
          ? failureFingerprint({ ...result, identityKey, outcome })
          : null;
      projected.set(identityKey, {
        identityKey,
        outcome,
        failureFingerprint: fingerprint,
        logRef: fingerprint ? logRef : null,
      });
      if (fingerprint) {
        failures.push({
          lane: shard.lane,
          shardId: shard.shardId,
          identityKey,
          modelRefs: [...semantic.modelRefs],
          obligationRefs: [...semantic.obligationRefs],
          transitionRefs: [...semantic.transitionRefs],
          outcome,
          failureFingerprint: fingerprint,
          logRef,
          targetRefs: [...semantic.targetRefs],
          changedPaths: [...semantic.changedPaths],
          diagnosticPriority: 'normal',
        });
      }
    }
    if (
      !result ||
      (result.outcome !== PLANNING_OUTCOME &&
        !PASSING_OUTCOMES.has(result.outcome) &&
        failedIdentities.size === 0)
    ) {
      const outcome = result?.outcome || 'missing';
      const ref = laneResultRef(laneResultRefs, key);
      failures.push({
        lane: shard.lane,
        shardId: shard.shardId,
        identityKey: null,
        modelRefs: [],
        obligationRefs: [],
        transitionRefs: [],
        outcome,
        failureFingerprint: failureFingerprint({
          lane: shard.lane,
          shardId: shard.shardId,
          identityKey: null,
          outcome,
          evidenceStatus: result?.evidenceStatus || null,
        }),
        logRef: ref,
        targetRefs: [],
        changedPaths: [],
        diagnosticPriority: 'normal',
      });
    }
  }
  failures.sort((left, right) =>
    compareText(
      `${left.lane}\0${left.shardId}\0${left.identityKey || ''}`,
      `${right.lane}\0${right.shardId}\0${right.identityKey || ''}`
    )
  );
  return { projected, failures };
}

function modelProjection(index, projected, obligationBindings) {
  const models = new Map();
  for (const semantic of index.tests) {
    for (const modelId of semantic.modelRefs) {
      if (!models.has(modelId)) models.set(modelId, new Map());
      const obligations = models.get(modelId);
      for (const obligationId of semantic.obligationRefs.filter(
        (ref) => obligationBindings.get(ref)?.modelRef === modelId
      )) {
        if (!obligations.has(obligationId)) obligations.set(obligationId, new Map());
        const shards = obligations.get(obligationId);
        const key = `${semantic.lane}\0${semantic.shardId}`;
        if (!shards.has(key)) {
          shards.set(key, {
            lane: semantic.lane,
            shardId: semantic.shardId,
            tests: [],
          });
        }
        shards.get(key).tests.push(projected.get(semantic.identityKey));
      }
    }
  }
  return [...models]
    .sort(([left], [right]) => compareText(left, right))
    .map(([modelId, obligations]) => ({
      modelId,
      obligations: [...obligations]
        .sort(([left], [right]) => compareText(left, right))
        .map(([obligationId, shards]) => ({
          obligationId,
          transitionRef: obligationBindings.get(obligationId).transitionRef,
          shards: [...shards]
            .sort(([left], [right]) => compareText(left, right))
            .map(([, shard]) => ({
              ...shard,
              tests: shard.tests.sort((left, right) =>
                compareText(left.identityKey, right.identityKey)
              ),
            })),
        })),
    }));
}

function unavailableStatusProjection() {
  return {
    status: 'unavailable',
    reasonCodes: ['status_projection_unavailable'],
  };
}

function statusSnapshotBody(snapshot) {
  const { statusSnapshotHash: _hash, ...body } = snapshot;
  return body;
}

function validStatusSnapshot(snapshot) {
  if (
    !isPlainObject(snapshot) ||
    snapshot.schemaVersion !== 'ci-six-model-runtime-status-snapshot/v1' ||
    typeof snapshot.recordId !== 'string' ||
    snapshot.recordId.trim() === '' ||
    typeof snapshot.attemptId !== 'string' ||
    snapshot.attemptId.trim() === '' ||
    !SIX_MODEL_IDS.has(snapshot.currentMentalModel) ||
    !Object.prototype.hasOwnProperty.call(STATUS_BEHAVIORS, snapshot.effectiveStatus) ||
    !SHA256_PATTERN.test(snapshot.sourceDocumentHash) ||
    !SHA256_PATTERN.test(snapshot.implementationConfirmationHash) ||
    !SHA256_PATTERN.test(snapshot.semanticModelHash) ||
    !SHA256_PATTERN.test(snapshot.statusSnapshotHash)
  ) {
    return false;
  }
  return snapshot.statusSnapshotHash === artifactHash(statusSnapshotBody(snapshot));
}

function resolveStatusProjection(statusSnapshot, expectedAttemptId, expectedAuthorityHashes) {
  if (statusSnapshot === undefined || statusSnapshot === null) {
    return unavailableStatusProjection();
  }
  if (!validStatusSnapshot(statusSnapshot)) {
    return {
      status: 'unavailable',
      reasonCodes: ['status_projection_invalid'],
    };
  }
  if (
    typeof expectedAttemptId !== 'string' ||
    expectedAttemptId.trim() === '' ||
    statusSnapshot.attemptId !== expectedAttemptId.trim()
  ) {
    return {
      status: 'stale',
      reasonCodes: ['status_projection_stale'],
    };
  }
  if (
    !isPlainObject(expectedAuthorityHashes) ||
    !SHA256_PATTERN.test(expectedAuthorityHashes.sourceDocumentHash) ||
    !SHA256_PATTERN.test(expectedAuthorityHashes.implementationConfirmationHash) ||
    !SHA256_PATTERN.test(expectedAuthorityHashes.semanticModelHash)
  ) {
    return unavailableStatusProjection();
  }
  if (
    statusSnapshot.sourceDocumentHash !== expectedAuthorityHashes.sourceDocumentHash ||
    statusSnapshot.implementationConfirmationHash !==
      expectedAuthorityHashes.implementationConfirmationHash ||
    statusSnapshot.semanticModelHash !== expectedAuthorityHashes.semanticModelHash
  ) {
    return {
      status: 'stale',
      reasonCodes: ['status_projection_stale'],
    };
  }
  return {
    status: 'applied',
    reasonCodes: [],
    recordId: statusSnapshot.recordId,
    attemptId: statusSnapshot.attemptId,
    currentMentalModel: statusSnapshot.currentMentalModel,
    effectiveStatus: statusSnapshot.effectiveStatus,
    expectedBehaviorRefs: [...STATUS_BEHAVIORS[statusSnapshot.effectiveStatus]],
    sourceDocumentHash: statusSnapshot.sourceDocumentHash,
    implementationConfirmationHash: statusSnapshot.implementationConfirmationHash,
    semanticModelHash: statusSnapshot.semanticModelHash,
    statusSnapshotHash: statusSnapshot.statusSnapshotHash,
  };
}

function prioritizedFailures(failures, statusProjection, obligationBindings) {
  if (statusProjection.status !== 'applied') {
    return failures.map((failure) => ({ ...failure, diagnosticPriority: 'normal' }));
  }
  const expectedBehaviors = new Set(statusProjection.expectedBehaviorRefs);
  return failures.map((failure) => {
    if (!failure.modelRefs.includes(statusProjection.currentMentalModel)) {
      return { ...failure, diagnosticPriority: 'normal' };
    }
    const expectedBehaviorFailure = failure.obligationRefs.some((obligationId) => {
      const binding = obligationBindings.get(obligationId);
      return (
        binding?.modelRef === statusProjection.currentMentalModel &&
        expectedBehaviors.has(binding.transitionRef)
      );
    });
    return {
      ...failure,
      diagnosticPriority: expectedBehaviorFailure ? 'high' : 'model',
    };
  });
}

function buildSixModelCiDiagnostics({
  semanticIndex,
  laneResults,
  laneResultRefs = {},
  infrastructureFailureInputs = [],
  statusSnapshot,
  expectedAttemptId,
  expectedAuthorityHashes,
}) {
  const { tests, shards, uncoveredObligationRefs, obligationBindings } =
    semanticIndexMaps(semanticIndex);
  const results = normalizeLaneResults(laneResults, shards);
  const { projected, failures } = projectedTestResults({
    tests,
    shards,
    results,
    laneResultRefs,
  });
  const statusProjection = resolveStatusProjection(
    statusSnapshot,
    expectedAttemptId,
    expectedAuthorityHashes
  );
  const combinedFailures = [
    ...failures,
    ...infrastructureFailures(infrastructureFailureInputs),
  ].sort((left, right) =>
    compareText(
      `${left.lane}\0${left.shardId}\0${left.identityKey || ''}\0${left.outcome}`,
      `${right.lane}\0${right.shardId}\0${right.identityKey || ''}\0${right.outcome}`
    )
  );
  const prioritized = prioritizedFailures(combinedFailures, statusProjection, obligationBindings);
  const body = {
    schemaVersion: 'six-model-ci-diagnostics/v1',
    semanticIndexHash: semanticIndex.semanticIndexHash,
    statusProjection,
    uncoveredObligationRefs,
    models: modelProjection(semanticIndex, projected, obligationBindings),
    failures: prioritized,
    summary: {
      modelCount: new Set(semanticIndex.tests.flatMap((test) => test.modelRefs)).size,
      obligationCount: new Set(semanticIndex.tests.flatMap((test) => test.obligationRefs)).size,
      shardCount: semanticIndex.shards.length,
      testCount: semanticIndex.tests.length,
      uncoveredObligationCount: uncoveredObligationRefs.length,
      failureCount: prioritized.length,
      unattributedFailureCount: prioritized.filter((failure) => failure.identityKey === null)
        .length,
      expectedFailureCount: prioritized.filter((failure) => failure.outcome === 'expected_failed')
        .length,
    },
  };
  return { ...body, diagnosticsHash: artifactHash(body) };
}

function buildSixModelPlanningDiagnostics({ semanticIndex }) {
  return buildSixModelCiDiagnostics({
    semanticIndex,
    laneResults: semanticIndex.shards.map((shard) => ({
      lane: shard.lane,
      shardId: shard.shardId,
      outcome: PLANNING_OUTCOME,
      executedIdentityKeys: [...shard.identityKeys],
      failedIdentityKeys: [],
    })),
  });
}

function buildInfrastructureOnlyDiagnostics({ outcome, logRef = null }) {
  const failures = infrastructureFailures([
    {
      lane: 'infrastructure',
      shardId: 'artifact-ingestion',
      outcome,
      logRef,
    },
  ]);
  const body = {
    schemaVersion: 'six-model-ci-diagnostics/v1',
    semanticIndexHash: null,
    statusProjection: unavailableStatusProjection(),
    uncoveredObligationRefs: [],
    models: [],
    failures,
    summary: {
      modelCount: 0,
      obligationCount: 0,
      shardCount: 0,
      testCount: 0,
      uncoveredObligationCount: 0,
      failureCount: failures.length,
      unattributedFailureCount: failures.length,
      expectedFailureCount: 0,
    },
  };
  return { ...body, diagnosticsHash: artifactHash(body) };
}

function validateSixModelCiDiagnostics(report) {
  if (
    !isPlainObject(report) ||
    report.schemaVersion !== 'six-model-ci-diagnostics/v1' ||
    report.diagnosticsHash !== artifactHash(diagnosticsBody(report)) ||
    !Array.isArray(report.models) ||
    !Array.isArray(report.failures) ||
    !Array.isArray(report.uncoveredObligationRefs) ||
    !isPlainObject(report.summary)
  ) {
    fail('CI_SIX_MODEL_DIAGNOSTICS_INVALID');
  }
  const uncoveredObligationRefs = validatedCanonicalStrings(
    report.uncoveredObligationRefs,
    'CI_SIX_MODEL_DIAGNOSTICS_INVALID'
  );
  if (report.summary.uncoveredObligationCount !== uncoveredObligationRefs.length) {
    fail('CI_SIX_MODEL_DIAGNOSTICS_INVALID');
  }
  return report;
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\|/gu, '\\|')
    .replace(/\r?\n/gu, ' ');
}

function renderSixModelCiDiagnosticsMarkdown(report) {
  validateSixModelCiDiagnostics(report);
  const lines = [
    '# Six-Model CI Diagnostics',
    '',
    `Status projection: ${report.statusProjection.status}`,
    '',
    `Failures: ${report.summary.failureCount}; unattributed: ${report.summary.unattributedFailureCount}; uncovered obligations: ${report.summary.uncoveredObligationCount}`,
    '',
    '| Model | Obligation | Shard | Test | Outcome | Fingerprint | Log |',
    '| --- | --- | --- | --- | --- | --- | --- |',
  ];
  if (report.failures.length === 0) {
    lines.push('| - | - | - | - | passed | - | - |');
  } else {
    for (const failure of report.failures) {
      lines.push(
        `| ${markdownCell(failure.modelRefs.join(', ')) || '-'} | ${
          markdownCell(failure.obligationRefs.join(', ')) || '-'
        } | ${markdownCell(`${failure.lane}/${failure.shardId}`)} | ${
          markdownCell(failure.identityKey) || '-'
        } | ${markdownCell(failure.outcome)} | ${markdownCell(failure.failureFingerprint)} | ${
          markdownCell(failure.logRef) || '-'
        } |`
      );
    }
  }
  if (report.uncoveredObligationRefs.length > 0) {
    lines.push('', '## Uncovered Obligations', '');
    for (const obligationId of report.uncoveredObligationRefs) {
      lines.push(`- ${markdownCell(obligationId)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function writeMarkdownArtifact({ repoRoot, outputDir, markdown }) {
  const target = resolveOutputPath(repoRoot, outputDir, 'six-model-ci-diagnostics.md');
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  try {
    fs.mkdirSync(require('node:path').dirname(target), { recursive: true });
    fs.writeFileSync(temporary, markdown, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
  }
  const bytes = Buffer.from(markdown, 'utf8');
  return { path: target, sha256: sha256Bytes(bytes), bytes: bytes.length };
}

function writeSixModelCiDiagnostics({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio/final',
  report,
}) {
  validateSixModelCiDiagnostics(report);
  const json = writeCanonicalArtifact({
    repoRoot,
    outputDir,
    fileName: 'six-model-ci-diagnostics.json',
    artifact: report,
  });
  const markdown = renderSixModelCiDiagnosticsMarkdown(report);
  return {
    json,
    markdown: writeMarkdownArtifact({ repoRoot, outputDir, markdown }),
  };
}

function parseCliArgs(args) {
  const options = { 'output-dir': '.artifacts/test-portfolio/final' };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--semantic-index', '--mode', '--output-dir'].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_DIAGNOSTICS_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (!options['semantic-index'] || options.mode !== 'planning') {
    fail('CI_DIAGNOSTICS_CLI_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const options = parseCliArgs(args);
  const semanticIndex = readCanonicalArtifact({
    repoRoot,
    filePath: require('node:path').resolve(repoRoot, options['semantic-index']),
  }).artifact;
  const report = buildSixModelPlanningDiagnostics({ semanticIndex });
  const receipts = writeSixModelCiDiagnostics({
    repoRoot,
    outputDir: options['output-dir'],
    report,
  });
  process.stdout.write(
    `${JSON.stringify({
      diagnosticsPath: receipts.json.path,
      diagnosticsSha256: receipts.json.sha256,
      diagnosticsMarkdownPath: receipts.markdown.path,
    })}\n`
  );
  return 0;
}

module.exports = {
  buildInfrastructureOnlyDiagnostics,
  buildSixModelCiDiagnostics,
  buildSixModelPlanningDiagnostics,
  main,
  parseCliArgs,
  renderSixModelCiDiagnosticsMarkdown,
  validateSixModelCiDiagnostics,
  writeSixModelCiDiagnostics,
};

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}
