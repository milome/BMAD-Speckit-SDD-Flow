/**
 * Dashboard subcommand: generate project health dashboard Markdown.
 * Ported from scripts/dashboard-generate.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=no data or error
 */
const fs = require('fs');
const path = require('path');
const { loadScoringModule } = require('../scoring-runtime');
const {
  loadDeferredGapGovernance,
} = require('../utils/deferred-gap-governance-loader');
const {
  buildDeferredGapAudit,
  renderDeferredGapMarkdownTable,
} = loadDeferredGapGovernance();

const EMPTY_DATA_MESSAGE = '暂无数据，请先完成至少一轮 Dev Story';
const INSUFFICIENT_RUN_MESSAGE = '数据不足，暂无完整 run（至少 2 stage）';
const EPIC_NO_COMPLETE_STORY_MESSAGE = (epicId) =>
  `Epic ${epicId} 下无完整 Story，暂无聚合数据`;
const OUTPUT_PATH = '_bmad-output/dashboard.md';
const OUTPUT_JSON_PATH = '_bmad-output/dashboard/runtime-dashboard.json';

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function appendDeferredGapSection(markdown, projectRoot) {
  const audit = buildDeferredGapAudit(projectRoot);
  const summaryLines = [
    '## Deferred Gap Governance Summary',
    '',
    `- Readiness Reports: ${audit.readiness_report_count}`,
    `- Deferred Gap Count: ${audit.deferred_gap_count}`,
    `- Deferred Gaps Explicit: ${audit.deferred_gaps_explicit ? 'yes' : 'no'}`,
    `- Alert Count: ${audit.alert_count}`,
    '',
  ];
  return `${markdown.trimEnd()}\n\n${summaryLines.join('\n')}${renderDeferredGapMarkdownTable(audit).trimEnd()}\n`;
}

function loadDashboardDeps() {
  return {
    getScoringDataPath: loadScoringModule('constants/path').getScoringDataPath,
    loadAndDedupeRecords: loadScoringModule('query/loader').loadAndDedupeRecords,
    parseEpicStoryFromRecord: loadScoringModule('query').parseEpicStoryFromRecord,
    ...loadScoringModule('dashboard'),
  };
}

function dashboardCommand(opts) {
  const {
    getScoringDataPath,
    loadAndDedupeRecords,
    parseEpicStoryFromRecord,
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
    queryRuntimeDashboard,
    writeDashboardSnapshotFiles,
  } = loadDashboardDeps();

  const strategy = opts.strategy || 'epic_story_window';
  const dataPathArg = opts.dataPath;
  const dataPath = dataPathArg != null && dataPathArg !== ''
    ? (path.isAbsolute(dataPathArg) ? dataPathArg : path.resolve(process.cwd(), dataPathArg))
    : getScoringDataPath();

  const records = loadAndDedupeRecords(dataPath).filter(
    (r) => r.scenario !== 'eval_question'
  );

  const outputPath = opts.output || OUTPUT_PATH;
  const jsonPath = opts.outputJson || OUTPUT_JSON_PATH;
  const includeRuntime = Boolean(opts.includeRuntime);
  const printJson = Boolean(opts.json);
  const showDeferredGaps = Boolean(opts.showDeferredGaps);

  const outDir = path.resolve(process.cwd(), path.dirname(outputPath));
  ensureDir(outDir);
  const outFile = path.resolve(process.cwd(), outputPath);
  const outJsonFile = path.resolve(process.cwd(), jsonPath);

  const epicRaw = opts.epic;
  const storyRaw = opts.story;
  const epic = epicRaw != null ? parseInt(epicRaw, 10) : undefined;
  const story = storyRaw != null ? parseInt(storyRaw, 10) : undefined;
  const windowHours = opts.windowHours != null ? parseInt(opts.windowHours, 10) : 24 * 7;
  const isEpicOnly =
    strategy === 'epic_story_window' &&
    epic != null &&
    !isNaN(epic) &&
    (story == null || isNaN(story));

  const snapshot = queryRuntimeDashboard({
    root: process.cwd(),
    dataPath,
    strategy,
    epic: epic != null && !isNaN(epic) ? epic : undefined,
    story: story != null && !isNaN(story) ? story : undefined,
    windowHours,
  });

  function writeArtifacts(markdown) {
    const finalMarkdown = showDeferredGaps
      ? appendDeferredGapSection(markdown, process.cwd())
      : markdown;
    const written = writeDashboardSnapshotFiles(snapshot, {
      markdownPath: outFile,
      jsonPath: outJsonFile,
      markdown: finalMarkdown,
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
  const vetoCount = countVetoTriggers(latestRecords);
  const trend = getTrend(records);

  let formatOpts;
  if (isEpicOnly && epic != null) {
    const storyIdsSet = new Set();
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
        .filter((x) => x != null)
    );
    const excludedStories = [];
    const seen = new Set();
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

  writeArtifacts(markdown);
}

module.exports = { dashboardCommand };
