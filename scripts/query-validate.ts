/**
 * Story 6.3: 验收脚本 - 验证 query 层 API
 * 调用 queryByStory(3,3)、queryByEpic(3)、queryLatest(10)，输出结果
 * 支持 SCORING_DATA_PATH 或 --data-path 覆盖数据路径
 */
import * as path from 'path';
import {
  queryByEpic,
  queryByStory,
  queryLatest,
} from '../packages/scoring/query';

function main() {
  const dataPath = process.env.SCORING_DATA_PATH ?? resolveDataPathFromArgs();
  const resolved = dataPath
    ? path.isAbsolute(dataPath)
      ? dataPath
      : path.resolve(process.cwd(), dataPath)
    : undefined;

  console.log('=== Story 6.3 query 层验收 ===');
  console.log('dataPath:', resolved ?? '(default: getScoringDataPath())');
  console.log();

  const byStory = queryByStory(3, 3, resolved);
  console.log('queryByStory(3, 3):', byStory.length, 'records');
  if (byStory.length > 0) {
    console.log('  sample:', JSON.stringify(byStory[0], null, 2).split('\n').slice(0, 5).join('\n'));
  }

  const byEpic = queryByEpic(3, resolved);
  console.log('queryByEpic(3):', byEpic.length, 'records');

  const latest = queryLatest(10, resolved);
  console.log('queryLatest(10):', latest.length, 'records');
  if (latest.length > 0) {
    console.log('  newest timestamp:', latest[0]?.timestamp);
  }

  console.log();
  console.log('=== 验收完成 ===');
}

function resolveDataPathFromArgs(): string | undefined {
  const idx = process.argv.indexOf('--data-path');
  if (idx >= 0 && process.argv[idx + 1]) {
    return process.argv[idx + 1];
  }
  return undefined;
}

main();
