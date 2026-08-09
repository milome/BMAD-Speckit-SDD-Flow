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

const SIX_MODEL_IDS = new Set([
  'requirement_confirmation',
  'architecture_confirmation',
  'implementation_readiness',
  'execution_closure',
  'audit_review',
  'delivery_confirmation',
]);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requireDenseArray(value, code) {
  if (!Array.isArray(value)) fail(code);
  for (let index = 0; index < value.length; index += 1) {
    if (!Object.prototype.hasOwnProperty.call(value, index)) fail(code);
  }
  return value;
}

function canonicalStrings(value, code) {
  const strings = requireDenseArray(value, code).map((entry) => {
    if (typeof entry !== 'string' || entry.trim() === '') fail(code);
    return entry.trim();
  });
  if (new Set(strings).size !== strings.length) fail(code);
  return [...strings].sort(compareText);
}

function artifactHash(value) {
  return sha256Bytes(canonicalJsonBytes(value));
}

function shardPlanBody(shardPlan) {
  const { shardPlanHash: _hash, ...body } = shardPlan;
  return body;
}

function coverageRows(coverageReport) {
  if (
    !isPlainObject(coverageReport) ||
    coverageReport.schemaVersion !== 'six-model-coverage-gap-report/v1'
  ) {
    fail('CI_SEMANTIC_INDEX_COVERAGE_REPORT_INVALID');
  }
  const rows = new Map();
  for (const row of requireDenseArray(
    coverageReport.obligations,
    'CI_SEMANTIC_INDEX_COVERAGE_REPORT_INVALID'
  )) {
    if (
      !isPlainObject(row) ||
      typeof row.obligationId !== 'string' ||
      row.obligationId.trim() === '' ||
      typeof row.model !== 'string' ||
      row.model.trim() === '' ||
      typeof row.transition !== 'string' ||
      row.transition.trim() === ''
    ) {
      fail('CI_SEMANTIC_INDEX_COVERAGE_REPORT_INVALID');
    }
    if (rows.has(row.obligationId)) fail('CI_SEMANTIC_INDEX_OBLIGATION_DUPLICATE');
    rows.set(row.obligationId, {
      model: row.model.trim(),
      transition: row.transition.trim(),
    });
  }
  return rows;
}

function catalogTests(catalog) {
  if (!isPlainObject(catalog)) fail('CI_SEMANTIC_INDEX_CATALOG_INVALID');
  const tests = new Map();
  for (const test of requireDenseArray(catalog.tests, 'CI_SEMANTIC_INDEX_CATALOG_INVALID')) {
    if (!isPlainObject(test)) fail('CI_SEMANTIC_INDEX_CATALOG_INVALID');
    const identityKey = test.executableIdentity ?? test.identityKey;
    if (typeof identityKey !== 'string' || identityKey.trim() === '') {
      fail('CI_SEMANTIC_INDEX_CATALOG_INVALID');
    }
    if (tests.has(identityKey)) fail('CI_SEMANTIC_INDEX_CATALOG_IDENTITY_DUPLICATE');
    tests.set(identityKey, {
      targetRefs: canonicalStrings(test.targetRefs || [], 'CI_SEMANTIC_INDEX_TARGET_REFS_INVALID'),
    });
  }
  return tests;
}

function validateInputs({ selection, shardPlan, coverageReport, catalog, changedPaths }) {
  validateSelection(selection);
  if (!isPlainObject(shardPlan) || shardPlan.schemaVersion !== 'ci-shard-plan/v1') {
    fail('CI_SEMANTIC_INDEX_SHARD_PLAN_INVALID');
  }
  const selectionHash = artifactHash(selection);
  if (
    shardPlan.selectionHash !== selectionHash ||
    !canonicalJsonBytes(shardPlan.selection).equals(canonicalJsonBytes(selection))
  ) {
    fail('CI_SEMANTIC_INDEX_SELECTION_MISMATCH');
  }
  if (shardPlan.shardPlanHash !== artifactHash(shardPlanBody(shardPlan))) {
    fail('CI_SEMANTIC_INDEX_SHARD_PLAN_HASH_MISMATCH');
  }
  const coverageReportHash = artifactHash(coverageReport);
  if (selection.coverageReportHash !== coverageReportHash) {
    fail('CI_SEMANTIC_INDEX_COVERAGE_HASH_MISMATCH');
  }
  const obligations = coverageRows(coverageReport);
  const uncoveredObligationRefs = canonicalStrings(
    selection.uncoveredObligationIds || [],
    'CI_SEMANTIC_INDEX_OBLIGATIONS_INVALID'
  );
  for (const obligationId of uncoveredObligationRefs) {
    if (!obligations.has(obligationId)) {
      fail('CI_SEMANTIC_INDEX_OBLIGATION_UNKNOWN', { obligationId });
    }
  }
  return {
    selectionHash,
    coverageReportHash,
    obligations,
    uncoveredObligationRefs,
    catalogTestsByIdentity: catalogTests(catalog),
    changedPaths: canonicalStrings(changedPaths || [], 'CI_SEMANTIC_INDEX_CHANGED_PATHS_INVALID'),
  };
}

function placementByIdentity(selection, shardPlan) {
  const selected = new Set(selection.selected.map((item) => item.identityKey));
  const placements = new Map();
  for (const shard of requireDenseArray(shardPlan.shards, 'CI_SEMANTIC_INDEX_SHARDS_INVALID')) {
    if (
      !isPlainObject(shard) ||
      typeof shard.lane !== 'string' ||
      typeof shard.shardId !== 'string'
    ) {
      fail('CI_SEMANTIC_INDEX_SHARDS_INVALID');
    }
    for (const identityKey of requireDenseArray(
      shard.identityKeys,
      'CI_SEMANTIC_INDEX_IDENTITIES_INVALID'
    )) {
      if (!selected.has(identityKey)) {
        fail('CI_SEMANTIC_INDEX_UNKNOWN_IDENTITY', { identityKey });
      }
      if (placements.has(identityKey)) {
        fail('CI_SEMANTIC_INDEX_DUPLICATE_IDENTITY', { identityKey });
      }
      placements.set(identityKey, { lane: shard.lane, shardId: shard.shardId });
    }
  }
  const omitted = [...selected].filter((identityKey) => !placements.has(identityKey));
  if (omitted.length > 0) fail('CI_SEMANTIC_INDEX_IDENTITY_OMITTED', { identityKeys: omitted });
  return placements;
}

function testSemantics({
  selection,
  placements,
  obligations,
  catalogTestsByIdentity,
  changedPaths,
}) {
  return [...selection.selected]
    .sort((left, right) => compareText(left.identityKey, right.identityKey))
    .map((item) => {
      const catalogTest = catalogTestsByIdentity.get(item.identityKey);
      if (!catalogTest) {
        fail('CI_SEMANTIC_INDEX_CATALOG_IDENTITY_MISSING', { identityKey: item.identityKey });
      }
      const obligationRefs = canonicalStrings(
        item.coveredObligationIds || [],
        'CI_SEMANTIC_INDEX_OBLIGATIONS_INVALID'
      );
      const modelRefs = new Set();
      const transitionRefs = new Set();
      for (const obligationId of obligationRefs) {
        const row = obligations.get(obligationId);
        if (!row) fail('CI_SEMANTIC_INDEX_OBLIGATION_UNKNOWN', { obligationId });
        if (SIX_MODEL_IDS.has(row.model)) modelRefs.add(row.model);
        transitionRefs.add(row.transition);
      }
      const placement = placements.get(item.identityKey);
      return {
        identityKey: item.identityKey,
        lane: placement.lane,
        shardId: placement.shardId,
        modelRefs: [...modelRefs].sort(compareText),
        obligationRefs,
        transitionRefs: [...transitionRefs].sort(compareText),
        targetRefs: catalogTest.targetRefs,
        changedPaths: changedPaths.filter((changedPath) =>
          catalogTest.targetRefs.includes(changedPath)
        ),
      };
    });
}

function shardSemantics(shardPlan, tests, obligations) {
  const testsByIdentity = new Map(tests.map((test) => [test.identityKey, test]));
  return [...shardPlan.shards]
    .sort(
      (left, right) =>
        compareText(left.lane, right.lane) || compareText(left.shardId, right.shardId)
    )
    .map((shard) => {
      const shardTests = shard.identityKeys.map((identityKey) => testsByIdentity.get(identityKey));
      const modelRefs = [...new Set(shardTests.flatMap((test) => test.modelRefs))].sort(
        compareText
      );
      const obligationRefs = [...new Set(shardTests.flatMap((test) => test.obligationRefs))].sort(
        compareText
      );
      const transitionRefs = [...new Set(shardTests.flatMap((test) => test.transitionRefs))].sort(
        compareText
      );
      const modelCoverage = Object.fromEntries(
        modelRefs.map((model) => [
          model,
          {
            testCount: shardTests.filter((test) => test.modelRefs.includes(model)).length,
            obligationCount: obligationRefs.filter(
              (obligationId) => obligations.get(obligationId)?.model === model
            ).length,
          },
        ])
      );
      return {
        lane: shard.lane,
        shardId: shard.shardId,
        testCount: shard.identityKeys.length,
        identityKeys: [...shard.identityKeys],
        modelRefs,
        obligationRefs,
        transitionRefs,
        modelCoverage,
      };
    });
}

function obligationBindings(selection, uncoveredObligationRefs, obligations) {
  const obligationRefs = new Set(uncoveredObligationRefs);
  for (const item of selection.selected) {
    for (const obligationId of item.coveredObligationIds || []) {
      obligationRefs.add(obligationId);
    }
  }
  return [...obligationRefs].sort(compareText).map((obligationId) => {
    const binding = obligations.get(obligationId);
    if (!binding) fail('CI_SEMANTIC_INDEX_OBLIGATION_UNKNOWN', { obligationId });
    return {
      obligationId,
      modelRef: SIX_MODEL_IDS.has(binding.model) ? binding.model : null,
      transitionRef: binding.transition,
    };
  });
}

function buildShardSemanticIndex(input) {
  const normalized = validateInputs(input);
  const placements = placementByIdentity(input.selection, input.shardPlan);
  const tests = testSemantics({
    selection: input.selection,
    placements,
    obligations: normalized.obligations,
    catalogTestsByIdentity: normalized.catalogTestsByIdentity,
    changedPaths: normalized.changedPaths,
  });
  const body = {
    schemaVersion: 'ci-shard-semantic-index/v1',
    selectionHash: normalized.selectionHash,
    shardPlanHash: input.shardPlan.shardPlanHash,
    coverageReportHash: normalized.coverageReportHash,
    catalogHash: artifactHash(input.catalog),
    changedPathsHash: artifactHash(normalized.changedPaths),
    uncoveredObligationRefs: normalized.uncoveredObligationRefs,
    obligationBindings: obligationBindings(
      input.selection,
      normalized.uncoveredObligationRefs,
      normalized.obligations
    ),
    tests,
    shards: shardSemantics(input.shardPlan, tests, normalized.obligations),
  };
  return {
    ...body,
    semanticIndexHash: artifactHash(body),
  };
}

function validateShardSemanticIndex(index, input) {
  const expected = buildShardSemanticIndex(input);
  if (!canonicalJsonBytes(index).equals(canonicalJsonBytes(expected))) {
    fail('CI_SEMANTIC_INDEX_DERIVATION_MISMATCH');
  }
  return index;
}

function writeShardSemanticIndex({
  repoRoot = process.cwd(),
  outputDir = '.artifacts/test-portfolio',
  index,
}) {
  return writeCanonicalArtifact({
    repoRoot,
    outputDir,
    fileName: 'ci-shard-semantic-index.json',
    artifact: index,
  });
}

function parseCliArgs(args) {
  const options = { 'output-dir': '.artifacts/test-portfolio' };
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      ![
        '--selection',
        '--shard-plan',
        '--coverage-report',
        '--catalog',
        '--changed-paths',
        '--output-dir',
      ].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('CI_SEMANTIC_INDEX_CLI_ARGS_INVALID');
    }
    options[flag.slice(2)] = value;
  }
  if (
    !options.selection ||
    !options['shard-plan'] ||
    !options['coverage-report'] ||
    !options.catalog
  ) {
    fail('CI_SEMANTIC_INDEX_CLI_ARGS_INVALID');
  }
  return options;
}

function main(args = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const options = parseCliArgs(args);
  const read = (filePath) =>
    readCanonicalArtifact({ repoRoot, filePath: path.resolve(repoRoot, filePath) }).artifact;
  const changedPaths = options['changed-paths']
    ? read(options['changed-paths'])
    : fs.existsSync(path.resolve(repoRoot, '.artifacts/test-portfolio/changed-paths.json'))
      ? read('.artifacts/test-portfolio/changed-paths.json')
      : [];
  const index = buildShardSemanticIndex({
    selection: read(options.selection),
    shardPlan: read(options['shard-plan']),
    coverageReport: read(options['coverage-report']),
    catalog: read(options.catalog),
    changedPaths,
  });
  const receipt = writeShardSemanticIndex({
    repoRoot,
    outputDir: options['output-dir'],
    index,
  });
  process.stdout.write(
    `${JSON.stringify({ ...receipt, semanticIndexHash: index.semanticIndexHash })}\n`
  );
  return 0;
}

module.exports = {
  SIX_MODEL_IDS,
  buildShardSemanticIndex,
  main,
  parseCliArgs,
  validateShardSemanticIndex,
  writeShardSemanticIndex,
};

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}
