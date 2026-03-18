/**
 * SFT-extract subcommand: extract SFT training dataset from scoring data.
 * Ported from scripts/sft-extract.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=error
 */
const path = require('path');
const { getScoringDataPath } = require('@bmad-speckit/scoring/constants/path');
const { extractSftDataset, formatSummary } = require('@bmad-speckit/scoring/analytics/sft-extractor');

function getThreshold(opts) {
  const cli = opts.threshold;
  if (cli != null) {
    const n = Number(cli);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  const env = process.env.SFT_THRESHOLD;
  if (env != null) {
    const n = Number(env);
    if (!Number.isNaN(n) && n >= 0) return n;
  }
  return 60;
}

async function sftExtractCommand(opts) {
  const threshold = getThreshold(opts);
  const output = opts.output;
  const dataPathArg = opts.dataPath;

  const dataPath = dataPathArg != null && dataPathArg !== ''
    ? (path.isAbsolute(dataPathArg) ? dataPathArg : path.resolve(process.cwd(), dataPathArg))
    : getScoringDataPath();
  const outputPath = output
    ? (path.isAbsolute(output) ? output : path.resolve(process.cwd(), output))
    : undefined;

  const { summary } = await extractSftDataset(dataPath, outputPath, { threshold });
  console.log(formatSummary(summary));
}

module.exports = { sftExtractCommand };
