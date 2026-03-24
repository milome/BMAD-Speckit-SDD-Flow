/**
 * SFT-extract subcommand: extract SFT training dataset from scoring data.
 * Ported from scripts/sft-extract.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=error
 */
const path = require('path');
const { getScoringDataPath } = require('@bmad-speckit/scoring/constants/path');
const { extractSftDataset, formatSummary } = require('@bmad-speckit/scoring/analytics/sft-extractor');

const MIN_SCORE_FLOOR = 90;

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

async function sftExtractCommand(opts) {
  const minScore = getMinScore(opts);
  const output = opts.output;
  const dataPathArg = opts.dataPath;

  const dataPath = dataPathArg != null && dataPathArg !== ''
    ? (path.isAbsolute(dataPathArg) ? dataPathArg : path.resolve(process.cwd(), dataPathArg))
    : getScoringDataPath();
  const outputPath = output
    ? (path.isAbsolute(output) ? output : path.resolve(process.cwd(), output))
    : undefined;

  const { summary } = await extractSftDataset(dataPath, outputPath, { minScore });
  console.log(formatSummary(summary));
}

module.exports = { sftExtractCommand };
