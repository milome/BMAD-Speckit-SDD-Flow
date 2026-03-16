/**
 * Story 4.2 / 6.1 / 6.2 CLI: AI Coach 诊断入口
 * 用法：
 *   npx ts-node scripts/coach-diagnose.ts                     # 无参：discovery 最新 run_id → 诊断
 *   npx ts-node scripts/coach-diagnose.ts --run-id=sample-run --format=json
 *   npx ts-node scripts/coach-diagnose.ts --epic 3            # Story 6.2: 仅诊断 Epic 3
 *   npx ts-node scripts/coach-diagnose.ts --story 3.3         # Story 6.2: 仅诊断 Story 3.3
 *   npx ts-node scripts/coach-diagnose.ts --limit 50          # discovery 最多考虑 50 条
 */
import { coachDiagnose, discoverLatestRunId, formatToMarkdown } from '../packages/scoring/coach';
import { getScoringDataPath } from '../packages/scoring/constants/path';
import {
  queryByEpic,
  queryByStory,
  queryLatest,
  parseEpicStoryFromRecord,
} from '../packages/scoring/query';
import { loadAndDedupeRecords } from '../packages/scoring/query/loader';

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
const EMPTY_REAL_DEV_MESSAGE = '暂无 real_dev 评分数据，请先完成至少一轮 Dev Story';
const EMPTY_EVAL_QUESTION_MESSAGE = '暂无 eval_question 评分数据';
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

  const scenarioArg = (args.scenario ?? args['scenario'] ?? 'real_dev').toLowerCase();
  if (scenarioArg !== 'real_dev' && scenarioArg !== 'eval_question' && scenarioArg !== 'all') {
    console.error(`Invalid --scenario value: ${scenarioArg}. Expected real_dev, eval_question, or all.`);
    process.exit(1);
  }
  const scenarioFilter: 'real_dev' | 'eval_question' | undefined =
    scenarioArg === 'all' ? undefined : scenarioArg === 'eval_question' ? 'eval_question' : 'real_dev';

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
    const storyId = storyArg != null
      ? parseInt(String(storyArg).split('.')[1]!, 10)
      : undefined;
    const epicForStory = storyArg != null
      ? parseInt(String(storyArg).split('.')[0]!, 10)
      : epicId!;
    const records =
      storyArg != null
        ? queryByStory(epicForStory, storyId!, dataPath)
        : queryByEpic(epicForStory, dataPath);
    if (records.length === 0) {
      const latest = queryLatest(1, dataPath);
      if (latest.length === 0) {
        console.log(EMPTY_DATA_MESSAGE);
      } else {
        const all = loadAndDedupeRecords(dataPath);
        const realDev = all.filter((r) => r.scenario !== 'eval_question');
        const hasParsable = realDev.some((r) => parseEpicStoryFromRecord(r) != null);
        console.log(
          hasParsable
            ? '无可筛选数据'
            : '当前评分记录无可解析 Epic/Story，请确认 run_id 约定'
        );
      }
      process.exit(0);
    }
    let latestRunId = records[0]!.run_id;
    let latestTs = new Date(records[0]!.timestamp).getTime();
    for (const r of records) {
      const t = new Date(r.timestamp).getTime();
      if (t > latestTs) {
        latestTs = t;
        latestRunId = r.run_id;
      }
    }
    const allRecords = loadAndDedupeRecords(dataPath).filter(
      (r) => r.run_id === latestRunId
    );
    const result = await coachDiagnose(latestRunId, {
      dataPath,
      records: allRecords,
    });
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
    const discovered = discoverLatestRunId(dataPath, limit, scenarioFilter);
    if (discovered == null) {
      const emptyMsg =
        scenarioFilter === 'real_dev'
          ? EMPTY_REAL_DEV_MESSAGE
          : scenarioFilter === 'eval_question'
            ? EMPTY_EVAL_QUESTION_MESSAGE
            : EMPTY_DATA_MESSAGE;
      console.log(emptyMsg);
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

