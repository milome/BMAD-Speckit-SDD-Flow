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

export function formatDashboardMarkdown(data: DashboardData): string {
  const lines: string[] = [];

  lines.push('# 项目健康度仪表盘');
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
      lines.push(`- ${w.epicStory} ${w.stage}: ${w.score} 分`);
    }
  }
  lines.push('');

  lines.push('## 高迭代 Top 3');
  lines.push('');
  if (data.highIterTop3.length === 0) {
    lines.push('各 stage 均为一次通过');
  } else {
    for (const h of data.highIterTop3) {
      lines.push(`- ${h.epicStory} ${h.stage}: ${h.iteration_count} 轮整改`);
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
