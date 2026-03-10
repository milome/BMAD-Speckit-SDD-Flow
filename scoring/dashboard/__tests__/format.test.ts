import { describe, it, expect } from 'vitest';
import { formatDashboardMarkdown } from '../format';

describe('formatDashboardMarkdown', () => {
  it('includes all sections', () => {
    const data = {
      healthScore: 78,
      dimensions: [
        { dimension: '功能性', score: 80 },
        { dimension: '代码质量', score: 75 },
        { dimension: '测试覆盖', score: 70 },
        { dimension: '安全性', score: '无数据' as const },
      ],
      weakTop3: [
        { stage: 'impl', epicStory: 'E6.S4', score: 65 },
        { stage: 'tasks', epicStory: 'E6.S4', score: 70 },
      ],
      highIterTop3: [
        { stage: 'spec', epicStory: 'E6.S1', iteration_count: 5 },
      ],
      vetoCount: 0,
      trend: '升' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('# 项目健康度仪表盘');
    expect(out).toContain('## 总分：78 分');
    expect(out).toContain('## 四维雷达图');
    expect(out).toContain('| 维度 | 分数 |');
    expect(out).toContain('功能性');
    expect(out).toContain('无数据');
    expect(out).toContain('## 短板 Top 3');
    expect(out).toContain('E6.S4 impl: 65 分');
    expect(out).toContain('## 高迭代 Top 3');
    expect(out).toContain('E6.S1 spec: 5 轮整改');
    expect(out).toContain('## Veto 触发统计');
    expect(out).toContain('Veto 触发：0 次');
    expect(out).toContain('## 趋势');
    expect(out).toContain('最近 5 run：升');
  });

  it('handles empty weakTop3', () => {
    const data = {
      healthScore: 0,
      dimensions: [],
      weakTop3: [],
      highIterTop3: [],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('（无数据）');
  });

  it('Story 9.4: appends evolution_trace to weakTop3 and highIterTop3 when present', () => {
    const data = {
      healthScore: 70,
      dimensions: [],
      weakTop3: [
        { stage: 'spec', epicStory: 'E9.S4', score: 60, evolution_trace: '第1轮 C → 第2轮 B' },
      ],
      highIterTop3: [
        { stage: 'spec', epicStory: 'E9.S4', iteration_count: 2, evolution_trace: '第1轮 C → 第2轮 B → 第3轮 A' },
      ],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('E9.S4 spec: 60 分（第1轮 C → 第2轮 B）');
    expect(out).toContain('E9.S4 spec: 2 轮整改（第1轮 C → 第2轮 B → 第3轮 A）');
  });

  it('shows 各 stage 均为一次通过 when highIterTop3 is empty (US-007)', () => {
    const data = {
      healthScore: 70,
      dimensions: [],
      weakTop3: [],
      highIterTop3: [],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('## 高迭代 Top 3');
    expect(out).toContain('各 stage 均为一次通过');
  });
});
