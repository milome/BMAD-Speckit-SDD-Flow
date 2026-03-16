/**
 * SFT-extract CLI: 从 scoring 数据提取 SFT 训练数据集。
 *
 * 用途：筛选低分记录，提取 git diff 作为 input/output 对，写入 sft-dataset.jsonl。
 *
 * CLI 参数：--threshold, --output
 *
 * 示例：npx ts-node scripts/sft-extract.ts --threshold 50
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

function getThreshold(args: Record<string, string>): number {
  const cli = args.threshold ?? args['threshold'];
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

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const threshold = getThreshold(args);
  const output = args.output ?? args['output'];

  const dataPath = getScoringDataPath();
  const outputPath = output
    ? (path.isAbsolute(output) ? output : path.resolve(process.cwd(), output))
    : undefined;

  const { summary } = await extractSftDataset(dataPath, outputPath, { threshold });
  console.log(formatSummary(summary));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
