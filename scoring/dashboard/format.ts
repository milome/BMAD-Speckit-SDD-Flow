/**
 * Story 7.1: 仪表盘 Markdown 格式化
 */
import type {
  DimensionEntry,
  WeakEntry,
  HighIterEntry,
  TrendDirection,
} from './compute';

export interface DashboardData {
  healthScore: number;
  dimensions: DimensionEntry[];
  weakTop3: WeakEntry[];
  highIterTop3: HighIterEntry[];
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

export function formatDashboardMarkdown(
  data: DashboardData,
  options?: DashboardFormatOptions
): string {
  const lines: string[] = [];
  const viewMode = options?.viewMode ?? 'single_story';
  const epicId = options?.epicId;
  const storyIds = options?.storyIds ?? [];
  const excludedStories = options?.excludedStories ?? [];

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
