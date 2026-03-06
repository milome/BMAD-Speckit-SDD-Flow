/**
 * Story 7.1: 仪表盘生成模块
 */
export {
  groupByRunId,
  getLatestRunRecords,
  getRecentRuns,
  computeHealthScore,
  getDimensionScores,
  getWeakTop3,
  getHighIterationTop3,
  countVetoTriggers,
  getTrend,
} from './compute';
export type {
  DimensionEntry,
  WeakEntry,
  HighIterEntry,
  TrendDirection,
} from './compute';
export { formatDashboardMarkdown } from './format';
export type { DashboardData } from './format';
