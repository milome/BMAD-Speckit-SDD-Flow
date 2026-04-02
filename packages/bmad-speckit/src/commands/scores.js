/**
 * Scores subcommand: display scoring summary table.
 * Ported from scripts/scores-summary.ts to JS for CLI integration.
 *
 * Exit codes: 0=success, 1=error
 */
const { loadScoringModule } = require('../scoring-runtime');
const { getScoringDataPath } = loadScoringModule('constants/path');
const {
  queryByEpic,
  queryByStory,
  queryLatest,
  parseEpicStoryFromRecord,
} = loadScoringModule('query');
const { loadAndDedupeRecords } = loadScoringModule('query/loader');
const { formatScoresToTable } = loadScoringModule('scores/format-table');

const EMPTY_DATA_MESSAGE = '暂无评分数据，请先完成至少一轮 Dev Story';
const NO_PARSABLE_MESSAGE = '当前评分记录无可解析 Epic/Story，请确认 run_id 约定';
const NO_MATCH_MESSAGE = '无可筛选数据';
const DEFAULT_LIMIT = 100;

function hasParsableRealDevRecords(dataPath) {
  const records = loadAndDedupeRecords(dataPath);
  const realDev = records.filter((r) => r.scenario !== 'eval_question');
  return realDev.some((r) => parseEpicStoryFromRecord(r) != null);
}

function scoresCommand(opts) {
  const epicArg = opts.epic;
  const storyArg = opts.story;
  const limitArg = opts.limit;
  const dataPathArg = opts.dataPath;

  if (epicArg != null && storyArg != null) {
    console.error('--epic and --story are mutually exclusive.');
    process.exit(1);
  }
  if (epicArg != null && !/^\d+$/.test(String(epicArg))) {
    console.error(`Invalid --epic value: ${epicArg}. Expected positive integer.`);
    process.exit(1);
  }
  if (storyArg != null && !/^\d+\.\d+$/.test(String(storyArg))) {
    console.error(`Invalid --story value: ${storyArg}. Expected X.Y (e.g. 3.3).`);
    process.exit(1);
  }

  const dataPath = dataPathArg != null && dataPathArg !== ''
    ? dataPathArg
    : getScoringDataPath();
  const limit = limitArg != null ? parseInt(limitArg, 10) : DEFAULT_LIMIT;

  if (epicArg == null && storyArg == null) {
    const records = queryLatest(limit, dataPath);
    if (records.length === 0) {
      console.log(EMPTY_DATA_MESSAGE);
      return;
    }
    console.log(formatScoresToTable(records, 'all'));
    return;
  }

  if (epicArg != null) {
    const epicId = parseInt(String(epicArg), 10);
    const records = queryByEpic(epicId, dataPath);
    if (records.length === 0) {
      const latest = queryLatest(1, dataPath);
      if (latest.length === 0) {
        console.log(EMPTY_DATA_MESSAGE);
      } else if (!hasParsableRealDevRecords(dataPath)) {
        console.log(NO_PARSABLE_MESSAGE);
      } else {
        console.log(NO_MATCH_MESSAGE);
      }
      return;
    }
    console.log(formatScoresToTable(records, 'epic'));
    return;
  }

  if (storyArg != null) {
    const parts = String(storyArg).split('.');
    const epicId = parseInt(parts[0], 10);
    const storyId = parseInt(parts[1], 10);
    const records = queryByStory(epicId, storyId, dataPath);
    if (records.length === 0) {
      const latest = queryLatest(1, dataPath);
      if (latest.length === 0) {
        console.log(EMPTY_DATA_MESSAGE);
      } else if (!hasParsableRealDevRecords(dataPath)) {
        console.log(NO_PARSABLE_MESSAGE);
      } else {
        console.log(NO_MATCH_MESSAGE);
      }
      return;
    }
    console.log(formatScoresToTable(records, 'story'));
  }
}

module.exports = { scoresCommand };
