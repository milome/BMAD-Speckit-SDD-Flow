'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  compareText,
  fail,
  readCanonicalArtifact,
  writeCanonicalArtifact,
} = require('./canonical-artifact.cjs');
const { buildProductFailureRecords } = require('./generate-six-model-coverage-gap-report.cjs');
const { sha256Bytes } = require('../test-portfolio-audit/canonical.cjs');

const DEFAULT_OUTPUT = '.artifacts/test-portfolio/product-failure-records.json';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveRepoInputPath(repoRoot, value, code) {
  const root = fs.realpathSync(path.resolve(repoRoot));
  const target = path.resolve(root, value);
  let resolvedTarget;
  try {
    resolvedTarget = fs.realpathSync(target);
  } catch {
    fail(code);
  }
  const relative = path.relative(root, resolvedTarget);
  if (
    relative === '' ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    fail(code);
  }
  return resolvedTarget;
}

function readJsonWithHash(repoRoot, value, code) {
  const target = resolveRepoInputPath(repoRoot, value, code);
  let bytes;
  let artifact;
  try {
    bytes = fs.readFileSync(target);
    artifact = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(code);
  }
  return {
    artifact,
    sha256: sha256Bytes(bytes),
  };
}

function requireCommitSha(value, code) {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/iu.test(value.trim())) fail(code);
  return value.trim().toLowerCase();
}

function normalizeRepoPaths(values, code) {
  if (!Array.isArray(values)) fail(code);
  const normalized = values.map((value) => {
    if (typeof value !== 'string' || value.trim() === '') fail(code);
    const candidate = value.trim().replace(/\\/gu, '/');
    if (
      path.posix.isAbsolute(candidate) ||
      candidate === '..' ||
      candidate.startsWith('../') ||
      candidate.includes('/../') ||
      path.posix.normalize(candidate) !== candidate
    ) {
      fail(code);
    }
    return candidate;
  });
  return [...new Set(normalized)].sort(compareText);
}

function validateRunReceipt(runReceipt, catalogCommitSha) {
  if (
    !isObject(runReceipt) ||
    typeof runReceipt.exactCommand !== 'string' ||
    runReceipt.exactCommand.trim() === '' ||
    !Number.isSafeInteger(runReceipt.exitCode) ||
    runReceipt.exitCode === 0
  ) {
    fail('PRODUCT_FAILURE_RECORDS_RUN_RECEIPT_INVALID');
  }
  const commitSha = requireCommitSha(
    runReceipt.commitSha,
    'PRODUCT_FAILURE_RECORDS_RUN_RECEIPT_INVALID'
  );
  if (commitSha !== catalogCommitSha) {
    fail('PRODUCT_FAILURE_RECORDS_COMMIT_MISMATCH');
  }
  return {
    commitSha,
    exactCommand: runReceipt.exactCommand.trim(),
    exitCode: runReceipt.exitCode,
    changedProductPaths: normalizeRepoPaths(
      runReceipt.changedProductPaths,
      'PRODUCT_FAILURE_RECORDS_RUN_RECEIPT_INVALID'
    ),
  };
}

function selectionIdentityKeys(selection) {
  if (
    !isObject(selection) ||
    selection.schemaVersion !== 'test-selection/v1' ||
    !Array.isArray(selection.selected)
  ) {
    fail('PRODUCT_FAILURE_RECORDS_SELECTION_INVALID');
  }
  const identities = [];
  for (const entry of selection.selected) {
    if (!isObject(entry)) fail('PRODUCT_FAILURE_RECORDS_SELECTION_INVALID');
    const entryIdentities = [entry.identityKey, entry.executableIdentity].filter(
      (value) => typeof value === 'string' && value.trim() !== ''
    );
    if (entryIdentities.length === 0) fail('PRODUCT_FAILURE_RECORDS_SELECTION_INVALID');
    identities.push(...entryIdentities.map((value) => value.trim()));
  }
  return identities;
}

function parseCliArgs(args) {
  const options = {
    selections: [],
    output: DEFAULT_OUTPUT,
  };
  const seenFlags = new Set();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (
      !['--test-report', '--catalog', '--run-receipt', '--selection', '--output'].includes(flag) ||
      typeof value !== 'string' ||
      value.trim() === ''
    ) {
      fail('PRODUCT_FAILURE_RECORDS_CLI_ARGS_INVALID');
    }
    if (flag === '--selection') {
      options.selections.push(value);
      continue;
    }
    if (seenFlags.has(flag)) fail('PRODUCT_FAILURE_RECORDS_CLI_ARGS_INVALID');
    seenFlags.add(flag);
    const key = flag.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
    options[key] = value;
  }
  if (
    !options.testReport ||
    !options.catalog ||
    !options.runReceipt ||
    options.selections.length === 0
  ) {
    fail('PRODUCT_FAILURE_RECORDS_CLI_ARGS_INVALID');
  }
  return options;
}

function buildProductFailureRecordsWrapper({
  repoRoot,
  testReportPath,
  catalogPath,
  runReceiptPath,
  selectionPaths,
}) {
  const catalogReceipt = readCanonicalArtifact({
    repoRoot,
    filePath: path.resolve(repoRoot, catalogPath),
  });
  const catalogCommitSha = requireCommitSha(
    catalogReceipt.artifact?.repository?.commit,
    'PRODUCT_FAILURE_RECORDS_CATALOG_INVALID'
  );
  const testReportReceipt = readJsonWithHash(
    repoRoot,
    testReportPath,
    'PRODUCT_FAILURE_RECORDS_TEST_REPORT_INVALID'
  );
  const runReceipt = readJsonWithHash(
    repoRoot,
    runReceiptPath,
    'PRODUCT_FAILURE_RECORDS_RUN_RECEIPT_INVALID'
  );
  const normalizedRun = validateRunReceipt(runReceipt.artifact, catalogCommitSha);
  const selectionArtifacts = selectionPaths
    .map((selectionPath) => {
      const receipt = readCanonicalArtifact({
        repoRoot,
        filePath: path.resolve(repoRoot, selectionPath),
      });
      return {
        path: path.relative(repoRoot, path.resolve(repoRoot, selectionPath)).replace(/\\/gu, '/'),
        sha256: receipt.sha256,
        identityKeys: selectionIdentityKeys(receipt.artifact),
      };
    })
    .sort((left, right) => compareText(left.path, right.path));
  const requiredSelectionIdentityKeys = [
    ...new Set(selectionArtifacts.flatMap((artifact) => artifact.identityKeys)),
  ].sort(compareText);
  const records = buildProductFailureRecords({
    testReport: testReportReceipt.artifact,
    catalog: catalogReceipt.artifact,
    requiredSelectionIdentityKeys,
    exactCommand: normalizedRun.exactCommand,
    exitCode: normalizedRun.exitCode,
    changedProductPaths: normalizedRun.changedProductPaths,
  });
  return {
    schemaVersion: 'product-failure-records/v1',
    commitSha: normalizedRun.commitSha,
    catalogSha256: catalogReceipt.sha256,
    testReportSha256: testReportReceipt.sha256,
    runReceiptSha256: runReceipt.sha256,
    selectionArtifacts: selectionArtifacts.map(({ path: artifactPath, sha256 }) => ({
      path: artifactPath,
      sha256,
    })),
    records,
    summary: {
      recordCount: records.length,
      requiredSelectionCount: requiredSelectionIdentityKeys.length,
      selectionArtifactCount: selectionArtifacts.length,
      selectedFailureCount: records.filter((record) => record.selectionRemainsRequired).length,
      portfolioBlockingCount: records.filter((record) => record.blocksPortfolioCorrectness).length,
    },
  };
}

function main(args = process.argv.slice(2)) {
  const repoRoot = process.cwd();
  const options = parseCliArgs(args);
  const wrapper = buildProductFailureRecordsWrapper({
    repoRoot,
    testReportPath: options.testReport,
    catalogPath: options.catalog,
    runReceiptPath: options.runReceipt,
    selectionPaths: options.selections,
  });
  const outputPath = path.resolve(repoRoot, options.output);
  const receipt = writeCanonicalArtifact({
    repoRoot,
    outputDir: path.dirname(outputPath),
    fileName: path.basename(outputPath),
    artifact: wrapper,
  });
  process.stdout.write(
    `${JSON.stringify({
      outputPath: path.relative(repoRoot, receipt.path).replace(/\\/gu, '/'),
      sha256: receipt.sha256,
      summary: wrapper.summary,
    })}\n`
  );
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
  buildProductFailureRecordsWrapper,
  main,
  parseCliArgs,
};
