/**
 * Story 4.2 / 6.1 / 6.2 CLI: AI Coach 诊断入口
 * 用法：
 *   npx ts-node scripts/coach-diagnose.ts                     # 无参：discovery 最新 run_id → 诊断
 *   npx ts-node scripts/coach-diagnose.ts --run-id=sample-run --format=json
 *   npx ts-node scripts/coach-diagnose.ts --epic 3            # Story 6.2: 仅诊断 Epic 3
 *   npx ts-node scripts/coach-diagnose.ts --story 3.3         # Story 6.2: 仅诊断 Story 3.3
 *   npx ts-node scripts/coach-diagnose.ts --limit 50          # discovery 最多考虑 50 条
 */
import { coachDiagnose, discoverLatestRunId, formatToMarkdown } from '../scoring/coach';
import { filterByEpicStory } from '../scoring/coach/filter-epic-story';
import { getScoringDataPath } from '../scoring/constants/path';

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

const EMPTY_DATA_MESSAGE = '暂无评分数据，请先完成至少一轮 Dev Story';
const DEFAULT_LIMIT = 100;

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const envRunId = process.env.npm_config_run_id ?? process.env.RUN_ID;
  const envFormat = process.env.npm_config_format ?? process.env.FORMAT;
  const envLimit = process.env.COACH_DISCOVERY_LIMIT;
  const runId = args['run-id'] ?? args.runId ?? envRunId;
  const format = (args.format ?? envFormat ?? 'markdown').toLowerCase();
  const limit = parseInt(args.limit ?? envLimit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT;

  if (format !== 'json' && format !== 'markdown') {
    console.error(`Invalid --format value: ${format}. Expected json or markdown.`);
    process.exit(1);
  }

  const epicArg = args.epic ?? args['epic'];
  const storyArg = args.story ?? args['story'];
  if (epicArg != null && storyArg != null) {
    console.error('--epic and --story are mutually exclusive.');
    process.exit(1);
  }
  if (epicArg != null) {
    if (!/^\d+$/.test(String(epicArg))) {
      console.error(`Invalid --epic value: ${epicArg}. Expected positive integer.`);
      process.exit(1);
    }
  }
  if (storyArg != null) {
    if (!/^\d+\.\d+$/.test(String(storyArg))) {
      console.error(`Invalid --story value: ${storyArg}. Expected X.Y (e.g. 3.3).`);
      process.exit(1);
    }
  }

  const dataPath = getScoringDataPath();

  if (epicArg != null || storyArg != null) {
    const epicId = epicArg != null ? parseInt(String(epicArg), 10) : undefined;
    const storyId = storyArg != null ? (() => {
      const parts = String(storyArg).split('.');
      return parseInt(parts[1]!, 10);
    })() : undefined;
    const epicForStory = storyArg != null ? parseInt(String(storyArg).split('.')[0]!, 10) : epicId;
    const filter = { epicId: epicForStory, storyId };
    const filtered = filterByEpicStory(dataPath, filter);
    if ('error' in filtered) {
      console.log(filtered.error);
      process.exit(0);
    }
    const result = await coachDiagnose(filtered.runId, { dataPath, records: filtered.records });
    if ('error' in result) {
      console.error(JSON.stringify(result, null, 2));
      process.exit(1);
    }
    if (format === 'markdown') {
      console.log(formatToMarkdown(result));
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
    return;
  }

  let effectiveRunId = runId != null && runId !== '' ? runId : null;
  let truncated = false;

  if (effectiveRunId == null) {
    const discovered = discoverLatestRunId(dataPath, limit);
    if (discovered == null) {
      console.log(EMPTY_DATA_MESSAGE);
      process.exit(0);
    }
    effectiveRunId = discovered.runId;
    truncated = discovered.truncated;
  }

  const result = await coachDiagnose(effectiveRunId, { dataPath });
  if ('error' in result) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  if (format === 'markdown') {
    const markdown = formatToMarkdown(result);
    if (truncated) {
      console.log(`> 仅展示最近 ${limit} 条\n\n${markdown}`);
    } else {
      console.log(markdown);
    }
    return;
  }
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

