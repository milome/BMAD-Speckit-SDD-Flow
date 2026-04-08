/**
 * Story 7.1: 仪表盘 Markdown 格式化
 */

import type {
  DimensionEntry,
  WeakEntry,
  HighIterEntry,
  JourneyContractSummaryEntry,
  GovernanceRoutingSummaryEntry,
  GovernanceRoutingModeDistributionSummaryEntry,
  GovernanceSignalHotspotSummaryEntry,
  GovernanceRerunGateFailureTrendSummaryEntry,
  TrendDirection,
} from './compute';

/**
 * Normalize governance runner summary lines.
 * @param {unknown} runnerSummaryLines - candidate summary lines
 * @returns {string[]} normalized summary lines
 */
function normalizeGovernanceRunnerSummaryLines(runnerSummaryLines: unknown): string[] {
  if (!Array.isArray(runnerSummaryLines)) {
    return [];
  }
  return runnerSummaryLines.filter((line): line is string => typeof line === 'string');
}

/**
 * Build governance latest raw event section lines.
 * @param {string[]} runnerSummaryLines - normalized summary lines
 * @returns {string[]} raw event section lines
 */
function buildGovernanceLatestRawEventSectionLines(runnerSummaryLines: string[]): string[] {
  const normalized = normalizeGovernanceRunnerSummaryLines(runnerSummaryLines);
  return [
    '## Governance Latest Raw Event',
    '',
    ...(normalized.length > 0 ? normalized : ['暂无 governance raw event 摘要']),
    '',
  ];
}

export interface DashboardData {
  healthScore: number;
  dimensions: DimensionEntry[];
  weakTop3: WeakEntry[];
  highIterTop3: HighIterEntry[];
  journeyContractSummary?: JourneyContractSummaryEntry[];
  governanceRoutingSummary?: GovernanceRoutingSummaryEntry;
  governanceRoutingModeDistribution?: GovernanceRoutingModeDistributionSummaryEntry[];
  governanceSignalHotspots?: GovernanceSignalHotspotSummaryEntry[];
  governanceGateFailureTrend?: GovernanceRerunGateFailureTrendSummaryEntry[];
  vetoCount: number;
  trend: TrendDirection;
}

/** Story 9.3: Epic 聚合视图扩展 */
export interface DashboardFormatOptions {
  viewMode?: 'single_story' | 'epic_aggregate';
  epicId?: number;
  storyIds?: number[];
  excludedStories?: string[];
}

function formatGovernanceHistorySummary(
  governanceRoutingModeDistribution: GovernanceRoutingModeDistributionSummaryEntry[],
  governanceSignalHotspots: GovernanceSignalHotspotSummaryEntry[],
  governanceGateFailureTrend: GovernanceRerunGateFailureTrendSummaryEntry[]
): string[] {
  const lines: string[] = [];
  lines.push('## Governance History Summary');
  lines.push('');

  if (
    governanceRoutingModeDistribution.length === 0 &&
    governanceSignalHotspots.length === 0 &&
    governanceGateFailureTrend.length === 0
  ) {
    lines.push('暂无治理历史摘要');
    lines.push('');
    return lines;
  }

  const dominantMode = [...governanceRoutingModeDistribution].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    return left.mode.localeCompare(right.mode);
  })[0];
  const totalModeEvents = governanceRoutingModeDistribution.reduce((sum, item) => sum + item.count, 0);
  if (dominantMode) {
    lines.push(
      `- Dominant Routing Mode: ${dominantMode.mode} (${dominantMode.count}/${totalModeEvents})`
    );
  }

  const topSignal = governanceSignalHotspots[0];
  if (topSignal) {
    lines.push(
      `- Top Signal: ${topSignal.signal} (${topSignal.count} 次；阶段 ${topSignal.affected_stages.join('、') || '-'}；gates ${
        topSignal.rerun_gates.join('、') || '-'
      })`
    );
  }

  const worseningGates = governanceGateFailureTrend
    .filter((item) => item.trend === 'worsening')
    .map((item) => item.rerun_gate);
  lines.push(
    `- Worsening Gates: ${worseningGates.length > 0 ? worseningGates.join('、') : 'none'}`
  );
  lines.push('');
  return lines;
}

/**
 * Format dashboard data as Markdown.
 * @param {DashboardData} data - Health score, dimensions, weakTop3, highIterTop3, vetoCount, trend
 * @param {DashboardFormatOptions} [options] - viewMode, epicId, storyIds, excludedStories for epic aggregate view
 * @returns {string} Markdown string
 */
export function formatDashboardMarkdown(
  data: DashboardData,
  options?: DashboardFormatOptions
): string {
  const lines: string[] = [];
  const viewMode = options?.viewMode ?? 'single_story';
  const epicId = options?.epicId;
  const storyIds = options?.storyIds ?? [];
  const excludedStories = options?.excludedStories ?? [];
  const journeyContractSummary = data.journeyContractSummary ?? [];
  const governanceRoutingSummary = data.governanceRoutingSummary;
  const governanceRoutingModeDistribution = data.governanceRoutingModeDistribution ?? [];
  const governanceSignalHotspots = data.governanceSignalHotspots ?? [];
  const governanceGateFailureTrend = data.governanceGateFailureTrend ?? [];

  if (viewMode === 'epic_aggregate' && epicId != null) {
    lines.push(`# Epic ${epicId} 聚合视图`);
    lines.push('');
    if (storyIds.length > 0) {
      lines.push(`纳入 Story：${storyIds.map((s) => `E${epicId}.S${s}`).join(', ')}`);
      lines.push('');
    }
    if (excludedStories.length > 0) {
      lines.push(`已排除：${excludedStories.join('、')}（未达完整 run）`);
      lines.push('');
    }
  } else {
    lines.push('# 项目健康度仪表盘');
  }
  lines.push('');
  lines.push(`## 总分：${data.healthScore} 分`);
  lines.push('');

  lines.push(
    ...formatGovernanceHistorySummary(
      governanceRoutingModeDistribution,
      governanceSignalHotspots,
      governanceGateFailureTrend
    )
  );

  lines.push('## 四维雷达图');
  lines.push('');
  lines.push('| 维度 | 分数 |');
  lines.push('|------|------|');
  for (const d of data.dimensions) {
    const score = d.score === '无数据' ? '无数据' : String(d.score);
    lines.push(`| ${d.dimension} | ${score} |`);
  }
  lines.push('');

  lines.push('## 短板 Top 3');
  lines.push('');
  if (data.weakTop3.length === 0) {
    lines.push('（无数据）');
  } else {
    for (const w of data.weakTop3) {
      const base = `- ${w.epicStory} ${w.stage}: ${w.score} 分`;
      lines.push(w.evolution_trace ? `${base}（${w.evolution_trace}）` : base);
    }
  }
  lines.push('');

  lines.push('## 高迭代 Top 3');
  lines.push('');
  if (data.highIterTop3.length === 0) {
    lines.push('各 stage 均为一次通过');
  } else {
    for (const h of data.highIterTop3) {
      const base = `- ${h.epicStory} ${h.stage}: ${h.iteration_count} 轮整改`;
      lines.push(h.evolution_trace ? `${base}（${h.evolution_trace}）` : base);
    }
  }
  lines.push('');

  lines.push('## Journey Contract Gaps');
  lines.push('');
  if (journeyContractSummary.length === 0) {
    lines.push('未发现 Journey contract 漏洞');
  } else {
    for (const item of journeyContractSummary) {
      const stages = item.affected_stages.length > 0 ? item.affected_stages.join('、') : '-';
      const stories = item.epic_stories.length > 0 ? item.epic_stories.join('、') : '-';
      lines.push(`- ${item.label}: ${item.count} 次；影响阶段 ${stages}；关联 Story ${stories}`);
    }
  }
  lines.push('');

  lines.push('## Governance Executor Routing');
  lines.push('');
  if (!governanceRoutingSummary) {
    lines.push('暂无治理 rerun executor routing 记录');
  } else {
    lines.push(`- Routing Mode: ${governanceRoutingSummary.routingMode}`);
    lines.push(`- Executor Route: ${governanceRoutingSummary.executorRoute}`);
    lines.push(
      `- Signals: ${governanceRoutingSummary.prioritizedSignals.join('、') || '(none)'}`
    );
    lines.push(`- Source: ${governanceRoutingSummary.source ?? '(unknown)'}`);
    lines.push(`- Event Count: ${governanceRoutingSummary.eventCount}`);
    lines.push(`- Latest Event: ${governanceRoutingSummary.latestTimestamp}`);
    lines.push(
      `- Affected Stages: ${governanceRoutingSummary.affectedStages.join('、') || '(none)'}`
    );
    if (governanceRoutingSummary.summaryLines.length > 0) {
      lines.push('- Trace Summary:');
      for (const line of governanceRoutingSummary.summaryLines) {
        lines.push(`  - ${line}`);
      }
    }
  }
  lines.push('');

  lines.push(
    ...buildGovernanceLatestRawEventSectionLines(
      governanceRoutingSummary?.runnerSummaryLines ?? []
    )
  );

  lines.push('## Governance Routing Mode Distribution');
  lines.push('');
  if (governanceRoutingModeDistribution.length === 0) {
    lines.push('暂无治理 routing mode 分布记录');
  } else {
    for (const item of governanceRoutingModeDistribution) {
      lines.push(`- ${item.mode}: ${item.count}`);
    }
  }
  lines.push('');

  lines.push('## Governance Signal Hotspots');
  lines.push('');
  if (governanceSignalHotspots.length === 0) {
    lines.push('暂无治理 signal hotspot 记录');
  } else {
    for (const item of governanceSignalHotspots) {
      lines.push(
        `- ${item.signal}: ${item.count} 次；影响阶段 ${item.affected_stages.join('、') || '-'}；gates ${
          item.rerun_gates.join('、') || '-'
        }`
      );
    }
  }
  lines.push('');

  lines.push('## Governance Gate Failure Trend');
  lines.push('');
  if (governanceGateFailureTrend.length === 0) {
    lines.push('暂无治理 rerun gate failure trend 记录');
  } else {
    for (const item of governanceGateFailureTrend) {
      lines.push(
        `- ${item.rerun_gate}: ${item.trend}；失败 ${item.failure_count}/${item.total_events}；latest ${item.latest_outcome} @ ${item.latest_timestamp}`
      );
    }
  }
  lines.push('');

  lines.push('## Veto 触发统计');
  lines.push('');
  lines.push(`Veto 触发：${data.vetoCount} 次`);
  lines.push('');

  lines.push('## 趋势');
  lines.push('');
  lines.push(`最近 5 run：${data.trend}`);
  lines.push('');

  return lines.join('\n');
}
