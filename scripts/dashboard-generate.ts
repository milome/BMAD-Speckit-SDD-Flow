/**
 * Dashboard-generate CLI: 生成项目健康度仪表盘 Markdown。
 *
 * 用途：聚合 scoring 数据，计算健康分数、短板 Top3、高迭代 Top3，输出 _bmad-output/dashboard.md。
 *
 * CLI 参数：--strategy (epic_story_window|run_id), --dataPath, --epic, --story, --windowHours
 *
 * 示例：npx ts-node scripts/dashboard-generate.ts --epic 2
 *
 * 退出码：0=成功，1=无数据或错误
 */
import * as fs from 'fs';
import * as path from 'path';
import { getScoringDataPath } from '../packages/scoring/constants/path';
import { loadAndDedupeRecords } from '../packages/scoring/query/loader';
import { parseEpicStoryFromRecord } from '../packages/scoring/query';
import {
  getLatestRunRecords,
  getLatestRunRecordsV2,
  computeHealthScore,
  computeEpicHealthScore,
  getDimensionScores,
  getEpicDimensionScores,
  getWeakTop3,
  getWeakTop3EpicStory,
  getHighIterationTop3,
  countVetoTriggers,
  getTrend,
  aggregateByEpicOnly,
  formatDashboardMarkdown,
} from '../packages/scoring/dashboard';

const EMPTY_DATA_MESSAGE = '暂无数据，请先完成至少一轮 Dev Story';
const INSUFFICIENT_RUN_MESSAGE = '数据不足，暂无完整 run（至少 2 stage）';
const EPIC_NO_COMPLETE_STORY_MESSAGE = (epicId: number) =>
  `Epic ${epicId} 下无完整 Story，暂无聚合数据`;
const OUTPUT_PATH = '_bmad-output/dashboard.md';

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

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main(): void {
  const args = parseArgs();
  const strategy = (args.strategy ?? 'epic_story_window') as 'epic_story_window' | 'run_id';
  const dataPathArg = args.dataPath;
  const dataPath = dataPathArg != null && dataPathArg !== ''
    ? (path.isAbsolute(dataPathArg) ? dataPathArg : path.resolve(process.cwd(), dataPathArg))
    : getScoringDataPath();

  const records = loadAndDedupeRecords(dataPath).filter(
    (r) => r.scenario !== 'eval_question'
  );

  const outDir = path.resolve(process.cwd(), path.dirname(OUTPUT_PATH));
  ensureDir(outDir);
  const outFile = path.resolve(process.cwd(), OUTPUT_PATH);

  if (records.length === 0) {
    const content = EMPTY_DATA_MESSAGE + '\n';
    fs.writeFileSync(outFile, content, 'utf-8');
    console.log(EMPTY_DATA_MESSAGE);
    return;
  }

  const epicRaw = args.epic;
  const storyRaw = args.story;
  const epic = epicRaw != null ? parseInt(epicRaw, 10) : undefined;
  const story = storyRaw != null ? parseInt(storyRaw, 10) : undefined;
  const windowHours = args.windowHours != null ? parseInt(args.windowHours, 10) : 24 * 7;
  const isEpicOnly =
    strategy === 'epic_story_window' &&
    epic != null &&
    !isNaN(epic) &&
    (story == null || isNaN(story));

  const latestRecords =
    strategy === 'epic_story_window'
      ? getLatestRunRecordsV2(records, {
          strategy: 'epic_story_window',
          epic: epic != null && !isNaN(epic) ? epic : undefined,
          story: story != null && !isNaN(story) ? story : undefined,
          windowHours,
        })
      : getLatestRunRecords(records);

  if (latestRecords.length === 0) {
    const msg = isEpicOnly && epic != null ? EPIC_NO_COMPLETE_STORY_MESSAGE(epic) : INSUFFICIENT_RUN_MESSAGE;
    const content = msg + '\n';
    fs.writeFileSync(outFile, content, 'utf-8');
    console.log(msg);
    return;
  }

  const healthScore = isEpicOnly ? computeEpicHealthScore(latestRecords) : computeHealthScore(latestRecords);
  const dimensions = isEpicOnly ? getEpicDimensionScores(latestRecords) : getDimensionScores(latestRecords);
  const weakTop3 =
    strategy === 'epic_story_window'
      ? getWeakTop3EpicStory(latestRecords)
      : getWeakTop3(latestRecords);
  const highIterTop3 = getHighIterationTop3(latestRecords);
  const vetoCount = countVetoTriggers(latestRecords);
  const trend = getTrend(records);

  let formatOpts: { viewMode?: 'epic_aggregate'; epicId?: number; storyIds?: number[]; excludedStories?: string[] } | undefined;
  if (isEpicOnly && epic != null) {
    const storyIdsSet = new Set<number>();
    for (const r of latestRecords) {
      const p = parseEpicStoryFromRecord(r);
      if (p) storyIdsSet.add(p.storyId);
    }
    const storyIds = [...storyIdsSet].sort((a, b) => a - b);
    const candidates = aggregateByEpicOnly(records, epic, windowHours);
    const inResult = new Set(
      latestRecords
        .map((r) => {
          const p = parseEpicStoryFromRecord(r);
          return p ? `E${p.epicId}.S${p.storyId}` : null;
        })
        .filter((x): x is string => x != null)
    );
    const excludedStories: string[] = [];
    const seen = new Set<string>();
    for (const r of candidates) {
      const p = parseEpicStoryFromRecord(r);
      if (p) {
        const key = `E${p.epicId}.S${p.storyId}`;
        if (!inResult.has(key) && !seen.has(key)) {
          seen.add(key);
          excludedStories.push(key);
        }
      }
    }
    formatOpts = { viewMode: 'epic_aggregate', epicId: epic, storyIds, excludedStories };
  }

  const markdown = formatDashboardMarkdown(
    { healthScore, dimensions, weakTop3, highIterTop3, vetoCount, trend },
    formatOpts
  );

  fs.writeFileSync(outFile, markdown, 'utf-8');
  console.log(markdown);
}

main();
