const path = require('node:path');

const { stableUnique } = require('./canonical.cjs');
const { collectAuditFacts, selectCriticalAuthorityPackagePaths } = require('./facts.cjs');
const { reduceAudit } = require('./audit.cjs');
const { renderSummary, writeAuditArtifacts } = require('./report.cjs');

function auditError(code, message = code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function duration(value) {
  return Math.max(0, Math.round(value));
}

function buildRunReceipt({
  reduced,
  writes,
  probeResults,
  staticDurationMs,
  probeDurationMs,
  totalDurationMs,
}) {
  return {
    schemaVersion: 'test-portfolio-audit-run-receipt/v1',
    status: reduced.artifact.status,
    auditPath: writes.auditPath,
    summaryPath: writes.summaryPath,
    auditSha256: writes.auditSha256,
    executableTestCount: reduced.artifact.tests.length,
    discovery: reduced.artifact.discovery,
    findings: reduced.artifact.totals,
    probe: {
      ...reduced.artifact.probe,
      issueCodes: stableUnique(probeResults.issueCodes || []),
    },
    staticAnalysisDurationMs: duration(staticDurationMs),
    probeDurationMs: duration(probeDurationMs),
    totalDurationMs: duration(totalDurationMs),
  };
}

async function runAudit(options) {
  const facts = await collectAuditFacts(options);
  const reduced = reduceAudit(facts);
  const summaryMarkdown = renderSummary(reduced.artifact);
  const writes = writeAuditArtifacts({
    outputDir: options.outputDir,
    canonicalBytes: reduced.canonicalBytes,
    summaryMarkdown,
  });
  return {
    ...reduced,
    ...writes,
    receipt: buildRunReceipt({
      reduced,
      writes,
      probeResults: facts.probeResults,
      staticDurationMs: facts.durations.staticAnalysisMs,
      probeDurationMs: facts.durations.probeMs,
      totalDurationMs: facts.durations.totalMs,
    }),
  };
}

function requireNext(argv, index, option) {
  const value = argv[index];
  if (value === undefined || value.startsWith('--')) {
    throw auditError('OPTION_VALUE_REQUIRED', `OPTION_VALUE_REQUIRED:${option}`);
  }
  return value;
}

function parseBoundedInteger(value, minimum, maximum, option) {
  if (!/^-?\d+$/u.test(value)) {
    throw auditError('OPTION_VALUE_INVALID', `OPTION_VALUE_INVALID:${option}`);
  }
  const numeric = Number(value);
  if (!Number.isSafeInteger(numeric) || numeric < minimum || numeric > maximum) {
    throw auditError('OPTION_VALUE_OUT_OF_RANGE', `OPTION_VALUE_OUT_OF_RANGE:${option}`);
  }
  return numeric;
}

function parseArgs(argv) {
  const options = {
    json: false,
    repoRoot: process.cwd(),
    outputDir: null,
    probeLimit: 20,
    probeBudgetMs: 600_000,
    probeSandboxRoot: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === '--json') options.json = true;
    else if (option === '--repo-root') options.repoRoot = requireNext(argv, ++index, option);
    else if (option === '--output-dir') options.outputDir = requireNext(argv, ++index, option);
    else if (option === '--probe-limit') {
      options.probeLimit = parseBoundedInteger(requireNext(argv, ++index, option), 0, 20, option);
    } else if (option === '--probe-budget-ms') {
      options.probeBudgetMs = parseBoundedInteger(
        requireNext(argv, ++index, option),
        0,
        600_000,
        option
      );
    } else if (option === '--probe-sandbox-root') {
      options.probeSandboxRoot = requireNext(argv, ++index, option);
    } else {
      throw auditError('UNKNOWN_OPTION', `UNKNOWN_OPTION:${option}`);
    }
  }
  options.repoRoot = path.resolve(options.repoRoot);
  options.outputDir = path.resolve(
    options.outputDir || path.join(options.repoRoot, '.artifacts', 'ci')
  );
  options.probeSandboxRoot = options.probeSandboxRoot
    ? path.resolve(options.probeSandboxRoot)
    : null;
  return options;
}

function renderConsoleReceipt(receipt) {
  return [
    `Status: ${receipt.status}`,
    `Audit: ${receipt.auditPath}`,
    `Summary: ${receipt.summaryPath}`,
    `Tests: ${receipt.executableTestCount}`,
    '',
  ].join('\n');
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await runAudit(options);
    process.stdout.write(
      options.json ? `${JSON.stringify(result.receipt)}\n` : renderConsoleReceipt(result.receipt)
    );
    process.exitCode =
      result.artifact.status === 'COMPLETE' ? 0 : result.artifact.status === 'INCOMPLETE' ? 2 : 1;
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();

module.exports = {
  main,
  parseArgs,
  runAudit,
  selectCriticalAuthorityPackagePaths,
};
