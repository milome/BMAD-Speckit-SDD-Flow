const fs = require('node:fs');
const path = require('node:path');
const { safeWriteText, sha256File } = require('../utils/large-document-writer');
const { extractSourceObligations } = require('../utils/goal-contract/source-obligation-extractor');
const { buildSlotData } = require('../utils/goal-contract/slot-data-builder');
const {
  defaultReceiptPaths,
  writeCoverageReceipt,
  writeGenerationReceipt,
} = require('../utils/goal-contract/goal-contract-receipts');
const { goalContractReleaseGateCommand } = require('../utils/goal-contract/release-gate');

const PACKAGE_ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function take(args, name, fallback = undefined) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('-')) return fallback;
  return value;
}

function has(args, name) {
  return args.includes(name);
}

function emitJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function normalize(filePath) {
  return path.resolve(filePath).replace(/\\/g, '/');
}

function loadRenderer() {
  return require(firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'render-goal-contract.js'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'scripts', 'render-goal-contract.js'),
  ]));
}

function failurePayload(failureClass, error, extra = {}) {
  const payload = {
    ok: false,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    failureClass,
    message: error instanceof Error ? error.message : String(error),
    ...extra,
  };
  for (const field of ['sourceId', 'lineStart', 'lineEnd', 'matchedPhrase', 'sourceExcerpt', 'repairHint']) {
    if (error && Object.prototype.hasOwnProperty.call(error, field)) {
      payload[field] = error[field];
    }
  }
  return payload;
}

function generate(args) {
  const sourcePath = take(args, '--source');
  const outPath = take(args, '--out');
  if (!sourcePath || !outPath) {
    throw Object.assign(new Error('--source and --out are required'), { failureClass: 'invalid_arguments' });
  }
  if (!fs.existsSync(sourcePath)) {
    throw Object.assign(new Error(`source plan missing: ${sourcePath}`), { failureClass: 'source_plan_missing' });
  }

  const resolvedOut = path.resolve(outPath);
  const receipts = defaultReceiptPaths(resolvedOut);
  const coverageReceiptPath = path.resolve(take(args, '--coverage-receipt', receipts.coverageReceiptPath));
  const generationReceiptPath = path.resolve(take(args, '--generation-receipt', receipts.generationReceiptPath));
  const sourceText = fs.readFileSync(sourcePath, 'utf8');
  const source = extractSourceObligations({ sourcePath: normalize(sourcePath), sourceText });
  const profilePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-contract-profile.json'),
  ]);
  const templatePath = firstExistingPath([
    path.join(SOURCE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md'),
    path.join(PACKAGE_ROOT, '_bmad', 'shared', 'goal-contract', 'goal-execution-contract-template.md'),
  ]);
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  const templateText = fs.readFileSync(templatePath, 'utf8');
  const { slotData, registries, implementationProofAudit } = buildSlotData({
    source,
    profile,
    outPath: normalize(resolvedOut),
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
  });
  const { renderGoalContract } = loadRenderer();
  const rendered = renderGoalContract({
    templateText,
    profile,
    slotData,
    validateHashes: true,
    coverageReceipt: {
      sourcePlanHash: source.sourcePlanHash,
      sourceObligations: registries.sourceObligations,
      unmappedSourceObligations: [],
    },
    generationMode: 'source_plan_strict',
  });
  const writeReceipt = safeWriteText(resolvedOut, rendered.document, { mode: fs.existsSync(resolvedOut) ? 'replace' : 'create' });
  const goalContractHash = sha256File(resolvedOut);
  const coverageReceipt = {
    schemaVersion: 'goal-contract-source-coverage-receipt/v1',
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    sourceBytes: source.sourceBytes,
    sourceLines: source.sourceLines,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    sourceObligations: registries.sourceObligations,
    unmappedSourceObligations: [],
    orphanGeneratedRefs: [],
    blockingReasons: [],
    decision: 'pass',
  };
  writeCoverageReceipt(coverageReceiptPath, coverageReceipt);
  const generationReceipt = {
    ok: true,
    schemaVersion: 'goal-contract-generation-receipt/v1',
    sourcePlanPath: source.sourcePlanPath,
    sourcePlanHash: source.sourcePlanHash,
    goalContractPath: normalize(resolvedOut),
    goalContractHash,
    coverageReceiptPath: normalize(coverageReceiptPath),
    generationReceiptPath: normalize(generationReceiptPath),
    sourceObligationCount: registries.sourceObligations.length,
    unmappedSourceObligations: 0,
    rendererAudit: rendered.audit,
    coverageAudit: { decision: 'pass', unmappedSourceObligations: [] },
    implementationProofAudit,
    writeReceipt,
  };
  writeGenerationReceipt(generationReceiptPath, generationReceipt);
  return generationReceipt;
}

function goalContractCommand(_opts = {}, forwardedArgs = []) {
  const args = [...forwardedArgs];
  const subcommand = args.shift();
  const json = has(args, '--json') || _opts.json;
  try {
    if (subcommand === 'release-gate') {
      return goalContractReleaseGateCommand(_opts, args);
    }
    if (subcommand !== 'generate') {
      throw Object.assign(
        new Error('Usage: bmad-speckit goal-contract generate --source <plan.md> --out <goal.md> --json'),
        {
          failureClass: 'invalid_subcommand',
        }
      );
    }
    const result = generate(args);
    if (json) emitJson(result);
    else process.stdout.write(`${result.goalContractPath}\n`);
    return 0;
  } catch (error) {
    const failureClass = error.failureClass || error.code || 'goal_contract_generation_failed';
    const payload = failurePayload(failureClass, error, {
      ...(error.coverageAudit ? { coverageAudit: error.coverageAudit } : {}),
      ...(error.implementationProofAudit ? { implementationProofAudit: error.implementationProofAudit } : {}),
    });
    if (json) emitJson(payload);
    else console.error(payload.message);
    return 1;
  }
}

module.exports = {
  generate,
  goalContractCommand,
};
