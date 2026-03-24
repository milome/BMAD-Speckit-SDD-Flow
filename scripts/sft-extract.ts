/**
 * SFT-extract CLI: 从 scoring 数据提取 SFT 训练数据集。
 *
 * 用途：筛选高分记录（phase_score >= minScore），提取 git diff 作为 input/output 对，写入 sft-dataset.jsonl。
 *
 * CLI 参数：--min-score, --output
 *
 * 示例：npx ts-node scripts/sft-extract.ts --min-score 80
 *
 * 退出码：0=成功，1=错误
 */
import * as path from 'path';
import { getScoringDataPath } from '../packages/scoring/constants/path';
import { extractSftDataset, formatSummary } from '../packages/scoring/analytics/sft-extractor';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    if (arg.includes('=')) {
      const idx = arg.indexOf('=');
      args[arg.slice(2, idx)] = arg.slice(idx + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next != null && !next.startsWith('--')) {
      args[key] = next;
      i++;
    }
  }
  return args;
}

const MIN_SCORE_FLOOR = 90;

function getMinScore(args: Record<string, string>): number {
  const cli = args['min-score'] ?? args.minScore;
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const minScore = getMinScore(args);
  const output = args.output ?? args['output'];

  const dataPath = getScoringDataPath();
  const outputPath = output
    ? (path.isAbsolute(output) ? output : path.resolve(process.cwd(), output))
    : undefined;

  const { summary } = await extractSftDataset(dataPath, outputPath, { minScore });
  console.log(formatSummary(summary));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
