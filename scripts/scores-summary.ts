/**
 * Story 6.4: /bmad-scores CLI 入口
 * 用法：
 *   npx ts-node scripts/scores-summary.ts                 # 全部摘要
 *   npx ts-node scripts/scores-summary.ts --epic 3       # Epic 3 汇总
 *   npx ts-node scripts/scores-summary.ts --story 3.3    # Story 3.3 明细
 */
import { getScoringDataPath } from '../packages/scoring/constants/path';
import {
  queryByEpic,
  queryByStory,
  queryLatest,
  parseEpicStoryFromRecord,
} from '../packages/scoring/query';
import { loadAndDedupeRecords } from '../packages/scoring/query/loader';
import { formatScoresToTable } from '../packages/scoring/scores/format-table';

const EMPTY_DATA_MESSAGE = '暂无评分数据，请先完成至少一轮 Dev Story';
const NO_PARSABLE_MESSAGE =
  '当前评分记录无可解析 Epic/Story，请确认 run_id 约定';
const NO_MATCH_MESSAGE = '无可筛选数据';
const DEFAULT_LIMIT = 100;

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

function hasParsableRealDevRecords(dataPath: string): boolean {
  const records = loadAndDedupeRecords(dataPath);
  const realDev = records.filter((r) => r.scenario !== 'eval_question');
  return realDev.some((r) => parseEpicStoryFromRecord(r) != null);
}

function main(): void {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const epicArg = args.epic ?? args['epic'];
  const storyArg = args.story ?? args['story'];

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

  const dataPath = getScoringDataPath();

  if (epicArg == null && storyArg == null) {
    const records = queryLatest(DEFAULT_LIMIT, dataPath);
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
    const [e, s] = String(storyArg).split('.');
    const epicId = parseInt(e!, 10);
    const storyId = parseInt(s!, 10);
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

main();
