/**
 * Story 4.2 CLI: AI Coach 诊断入口
 * 用法：
 *   npx ts-node scripts/coach-diagnose.ts --run-id=sample-run --format=json
 *   npx ts-node scripts/coach-diagnose.ts --run-id sample-run --format markdown
 */
import { coachDiagnose, formatToMarkdown } from '../scoring/coach';

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      continue;
    }

    if (arg.includes('=')) {
      const idx = arg.indexOf('=');
      const key = arg.slice(2, idx);
      const value = arg.slice(idx + 1);
      args[key] = value;
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
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const positional = argv.filter((x) => !x.startsWith('--'));
  const envRunId = process.env.npm_config_run_id ?? process.env.RUN_ID;
  const envFormat = process.env.npm_config_format ?? process.env.FORMAT;
  const runId = args['run-id'] ?? args.runId ?? envRunId;
  const format = (args.format ?? envFormat ?? positional[0] ?? 'json').toLowerCase();

  if (runId == null || runId === '') {
    console.error('Usage: npm run coach:diagnose -- --run-id=<id> [--format=json|markdown]');
    process.exit(1);
  }
  if (format !== 'json' && format !== 'markdown') {
    console.error(`Invalid --format value: ${format}. Expected json or markdown.`);
    process.exit(1);
  }

  const result = await coachDiagnose(runId);
  if ('error' in result) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (format === 'markdown') {
    console.log(formatToMarkdown(result));
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

