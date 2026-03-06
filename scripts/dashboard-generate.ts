/**
 * Story 7.1: /bmad-dashboard CLI 入口
 * 用法：npx ts-node scripts/dashboard-generate.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { getScoringDataPath } from '../scoring/constants/path';
import { loadAndDedupeRecords } from '../scoring/query/loader';
import {
  getLatestRunRecords,
  computeHealthScore,
  getDimensionScores,
  getWeakTop3,
  getHighIterationTop3,
  countVetoTriggers,
  getTrend,
  formatDashboardMarkdown,
} from '../scoring/dashboard';

const EMPTY_DATA_MESSAGE = '暂无数据，请先完成至少一轮 Dev Story';
const OUTPUT_PATH = '_bmad-output/dashboard.md';

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main(): void {
  const dataPath = getScoringDataPath();
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

  const latestRecords = getLatestRunRecords(records);
  const healthScore = computeHealthScore(latestRecords);
  const dimensions = getDimensionScores(latestRecords);
  const weakTop3 = getWeakTop3(latestRecords);
  const highIterTop3 = getHighIterationTop3(latestRecords);
  const vetoCount = countVetoTriggers(latestRecords);
  const trend = getTrend(records);

  const markdown = formatDashboardMarkdown({
    healthScore,
    dimensions,
    weakTop3,
    highIterTop3,
    vetoCount,
    trend,
  });

  fs.writeFileSync(outFile, markdown, 'utf-8');
  console.log(markdown);
}

main();
