/**
 * Story 5.5 B07: SFT 数据集提取 CLI
 * 用法：
 *   npx ts-node scripts/analytics-sft-extract.ts --dataPath scoring/data --output scoring/data/sft-dataset.jsonl
 */
import * as path from 'path';
import { extractSftDataset } from '../packages/scoring/analytics/sft-extractor';

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dataPath = args.dataPath ?? args.data ?? path.join(process.cwd(), 'packages', 'scoring', 'data');
  const output = args.output ?? path.join(dataPath, 'sft-dataset.jsonl');

  const entries = await extractSftDataset(dataPath, output);
  console.log(`extractSftDataset: wrote ${entries.length} entries to ${output}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
