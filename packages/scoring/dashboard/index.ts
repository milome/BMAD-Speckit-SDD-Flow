/**
 * Story 7.1: 仪表盘生成模块
 */
export {
  groupByRunId,
  getLatestRunRecords,
  getLatestRunRecordsV2,
  getRecentRuns,
  computeHealthScore,
  getDimensionScores,
  getWeakTop3,
  getWeakTop3EpicStory,
  getJourneyContractSummary,
  getGovernanceRoutingSummary,
  getGovernanceRoutingModeDistribution,
  getGovernanceSignalHotspots,
  getGovernanceRerunGateFailureTrend,
  getHighIterationTop3,
  countVetoTriggers,
  getTrend,
  aggregateByEpicStoryTimeWindow,
  aggregateByEpicOnly,
  getEpicAggregateRecords,
  computeEpicHealthScore,
  getEpicDimensionScores,
} from './compute';
export type {
  DimensionEntry,
  WeakEntry,
  HighIterEntry,
  JourneyContractSummaryEntry,
  GovernanceRoutingSummaryEntry,
  GovernanceRoutingModeDistributionSummaryEntry,
  GovernanceSignalHotspotSummaryEntry,
  GovernanceRerunGateFailureTrendSummaryEntry,
  TrendDirection,
  GetLatestRunRecordsV2Options,
} from './compute';
export { formatDashboardMarkdown } from './format';
export type { DashboardData, DashboardFormatOptions } from './format';
