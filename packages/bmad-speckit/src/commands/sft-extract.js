/**
 * SFT-extract subcommand: extract SFT training dataset from scoring data.
 * Ported from scripts/sft-extract.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=error
 */
const path = require('path');
const { getScoringDataPath } = require('@bmad-speckit/scoring/constants/path');
const { extractSftDataset, formatSummary } = require('@bmad-speckit/scoring/analytics/sft-extractor');
const { createRuntimeClient } = require('../runtime-client');

const MIN_SCORE_FLOOR = 90;
const LEGACY_TARGET = 'legacy_instruction_io';

function getMinScore(opts) {
  const cli = opts.minScore;
  if (cli != null) {
    const n = Number(cli);
    if (!Number.isNaN(n)) {
      if (n < MIN_SCORE_FLOOR) {
        throw new Error(`最低下限不能低于${MIN_SCORE_FLOOR}，请重新设置（当前值：${n}）`);
      }
      return n;
    }
  }
  return MIN_SCORE_FLOOR;
}

function parseInteger(value, fallback, fieldName) {
  if (value == null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} 必须是数字`);
  }
  return parsed;
}

async function sftExtractCommand(opts) {
  const minScore = getMinScore(opts);
  const target = opts.target || LEGACY_TARGET;
  const output = opts.output;
  const dataPathArg = opts.dataPath;

  const dataPath = dataPathArg != null && dataPathArg !== ''
    ? (path.isAbsolute(dataPathArg) ? dataPathArg : path.resolve(process.cwd(), dataPathArg))
    : getScoringDataPath();
  const outputPath = output
    ? (path.isAbsolute(output) ? output : path.resolve(process.cwd(), output))
    : undefined;

  if (target !== LEGACY_TARGET) {
    const bundleDir = opts.bundleDir
      ? (path.isAbsolute(opts.bundleDir) ? opts.bundleDir : path.resolve(process.cwd(), opts.bundleDir))
      : outputPath
        ? path.dirname(outputPath)
        : undefined;

    const client = createRuntimeClient({
      cwd: process.cwd(),
      dataPath,
    });

    const result = await client.request('writeSftBundle', {
      minScore,
      target,
      dataPath,
      bundleDir,
      splitSeed:
        opts.splitSeed == null || opts.splitSeed === ''
          ? undefined
          : parseInteger(opts.splitSeed, undefined, 'splitSeed'),
      maxTokens:
        opts.maxTokens == null || opts.maxTokens === ''
          ? undefined
          : parseInteger(opts.maxTokens, undefined, 'maxTokens'),
      dropNoCodePair: Boolean(opts.dropNoCodePair),
    });
    console.log(JSON.stringify(result));
    return;
  }

  const { summary } = await extractSftDataset(dataPath, outputPath, { minScore });
  console.log(formatSummary(summary));
}

module.exports = { sftExtractCommand };
