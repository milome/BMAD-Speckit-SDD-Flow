/**
 * Dashboard-generate CLI: 生成项目健康度仪表盘 Markdown。
 *
 * 用途：聚合 scoring 数据，计算健康分数、短板 Top3、高迭代 Top3，输出 _bmad-output/dashboard.md。
 *
 * CLI 参数：--strategy (epic_story_window|run_id), --dataPath, --epic, --story, --windowHours, --output (默认 _bmad-output/dashboard.md)
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
  getJourneyContractSummary,
  getGovernanceRoutingSummary,
  getGovernanceRoutingModeDistribution,
  getGovernanceSignalHotspots,
  getGovernanceRerunGateFailureTrend,
  countVetoTriggers,
  getTrend,
  aggregateByEpicOnly,
  aggregateByEpicStoryTimeWindow,
  formatDashboardMarkdown,
  queryRuntimeDashboard,
  writeDashboardSnapshotFiles,
} from '../packages/scoring/dashboard';

const EMPTY_DATA_MESSAGE = '暂无数据，请先完成至少一轮 Dev Story';
const INSUFFICIENT_RUN_MESSAGE = '数据不足，暂无完整 run（至少 2 stage）';
const EPIC_NO_COMPLETE_STORY_MESSAGE = (epicId: number) =>
  `Epic ${epicId} 下无完整 Story，暂无聚合数据`;
const OUTPUT_PATH = '_bmad-output/dashboard.md';
const OUTPUT_JSON_PATH = '_bmad-output/dashboard/runtime-dashboard.json';

function resolveScopedAnalyticsRecords(
  records: ReturnType<typeof loadAndDedupeRecords>,
  strategy: 'epic_story_window' | 'run_id',
  epic: number | undefined,
  story: number | undefined,
  windowHours: number
) {
  if (strategy !== 'epic_story_window') {
    return records;
  }

  if (epic != null && !isNaN(epic) && story != null && !isNaN(story)) {
    return aggregateByEpicStoryTimeWindow(records, epic, story, windowHours);
  }

  if (epic != null && !isNaN(epic)) {
    return aggregateByEpicOnly(records, epic, windowHours);
  }

  return records;
}

function parseArgs(): Record<string, string> {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const val = process.argv[i + 1];
      if (val != null && !val.startsWith('--')) {
        args[key] = val;
        i++;
      } else {
        args[key] = 'true';
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

  const outputArg = args.output;
  const outputRel = outputArg != null && outputArg !== '' ? outputArg : OUTPUT_PATH;
  const outDir = path.resolve(process.cwd(), path.dirname(outputRel));
  ensureDir(outDir);
  const outFile = path.resolve(process.cwd(), outputRel);
  const outputJsonArg = args['output-json'];
  const outputJsonRel =
    outputJsonArg != null && outputJsonArg !== '' ? outputJsonArg : OUTPUT_JSON_PATH;
  const outJsonFile = path.resolve(process.cwd(), outputJsonRel);
  const printJson = args.json === 'true';
  const includeRuntime = args['include-runtime'] === 'true';

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
  const analyticsRecords = resolveScopedAnalyticsRecords(
    records,
    strategy,
    epic != null && !isNaN(epic) ? epic : undefined,
    story != null && !isNaN(story) ? story : undefined,
    windowHours
  );

  const snapshot = queryRuntimeDashboard({
    root: process.cwd(),
    dataPath,
    strategy,
    epic: epic != null && !isNaN(epic) ? epic : undefined,
    story: story != null && !isNaN(story) ? story : undefined,
    windowHours,
  });

  function writeArtifacts(markdown: string): void {
    const written = writeDashboardSnapshotFiles(snapshot, {
      markdownPath: outFile,
      jsonPath: outJsonFile,
      markdown,
      includeRuntime,
    });
    console.log(printJson ? written.json.trimEnd() : written.markdown.trimEnd());
  }

  if (records.length === 0) {
    writeArtifacts(EMPTY_DATA_MESSAGE);
    return;
  }

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
    writeArtifacts(msg);
    return;
  }

  const healthScore = isEpicOnly ? computeEpicHealthScore(latestRecords) : computeHealthScore(latestRecords);
  const dimensions = isEpicOnly ? getEpicDimensionScores(latestRecords) : getDimensionScores(latestRecords);
  const weakTop3 =
    strategy === 'epic_story_window'
      ? getWeakTop3EpicStory(latestRecords)
      : getWeakTop3(latestRecords);
  const highIterTop3 = getHighIterationTop3(latestRecords);
  const journeyContractSummary = getJourneyContractSummary(latestRecords);
  const vetoCount = countVetoTriggers(latestRecords);
  const trend = getTrend(records);
  const governanceRoutingSummary = getGovernanceRoutingSummary(analyticsRecords);
  const governanceRoutingModeDistribution =
    getGovernanceRoutingModeDistribution(analyticsRecords);
  const governanceSignalHotspots = getGovernanceSignalHotspots(analyticsRecords);
  const governanceGateFailureTrend =
    getGovernanceRerunGateFailureTrend(analyticsRecords);

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
    {
      healthScore,
      dimensions,
      weakTop3,
      highIterTop3,
      journeyContractSummary,
      governanceRoutingSummary,
      governanceRoutingModeDistribution,
      governanceSignalHotspots,
      governanceGateFailureTrend,
      vetoCount,
      trend,
    },
    formatOpts
  );

  writeArtifacts(markdown);
}

main();
