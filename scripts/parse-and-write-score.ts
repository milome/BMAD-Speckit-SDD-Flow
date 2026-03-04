/**
 * Story 3.3 T3.2: CLI 入口
 * 接收 --reportPath、--stage、--runId、--scenario、--writeMode、--dataPath
 */
import * as path from 'path';
import { parseAndWriteScore } from '../scoring/orchestrator';

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--') && i + 1 < process.argv.length) {
      const key = arg.slice(2);
      const val = process.argv[i + 1];
      if (!val.startsWith('--')) {
        args[key] = val;
        i++;
      }
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const reportPath = args.reportPath;
  const stage = (args.stage ?? 'prd') as 'prd' | 'arch' | 'story';
  const runId = args.runId ?? `cli-${Date.now()}`;
  const scenario = (args.scenario ?? 'real_dev') as 'real_dev' | 'eval_question';
  const writeMode = (args.writeMode ?? 'single_file') as 'single_file' | 'jsonl' | 'both';
  const dataPath = args.dataPath;

  if (!reportPath) {
    console.error('Usage: npx ts-node scripts/parse-and-write-score.ts --reportPath <path> [--stage prd|arch|story] [--runId <id>] [--scenario real_dev|eval_question] [--writeMode single_file|jsonl|both] [--dataPath <path>]');
    process.exit(1);
  }

  await parseAndWriteScore({
    reportPath,
    stage,
    runId,
    scenario,
    writeMode,
    dataPath,
  });
  console.log(`parseAndWriteScore: wrote record for runId=${runId}, stage=${stage}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
