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
      journeyContractSummary: [
        {
          signal: 'smoke_task_chain' as const,
          label: 'Smoke Task Chain',
          count: 2,
          affected_stages: ['tasks', 'implement'],
          epic_stories: ['E6.S1', 'E6.S4'],
        },
      ],
      governanceRoutingSummary: {
        routingMode: 'targeted' as const,
        executorRoute: 'journey-contract-remediation' as const,
        prioritizedSignals: ['closure_task_id', 'smoke_task_chain'],
        summaryLines: [
          'Routing Mode: targeted',
          'Executor Route: journey-contract-remediation',
          'Stop Reason: (none)',
          'Journey Contract Signals: closure_task_id, smoke_task_chain',
        ],
        runnerSummaryLines: [
          '## Governance Remediation Runner Summary',
          '- Stop Reason: await human review',
          '',
          '## Loop State Trace Summary',
          '- Journey Contract Signals: closure_task_id, smoke_task_chain',
        ],
        source: 'scoring-governance-history' as const,
        latestTimestamp: '2026-03-28T12:05:00.000Z',
        eventCount: 2,
        affectedStages: ['implement', 'plan'],
        epicStories: ['E6.S1', 'E6.S4'],
      },
      governanceRoutingModeDistribution: [
        { mode: 'generic' as const, count: 2 },
        { mode: 'targeted' as const, count: 3 },
      ],
      governanceSignalHotspots: [
        {
          signal: 'smoke_task_chain',
          count: 2,
          affected_stages: ['implement'],
          rerun_gates: ['implementation-readiness'],
        },
      ],
      governanceGateFailureTrend: [
        {
          rerun_gate: 'implementation-readiness',
          failure_count: 2,
          total_events: 3,
          latest_outcome: 'blocked',
          latest_timestamp: '2026-03-28T12:05:00.000Z',
          trend: 'worsening' as const,
        },
      ],
      vetoCount: 0,
      trend: '升' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('# 项目健康度仪表盘');
    expect(out).toContain('## 总分：78 分');
    expect(out).toContain('## Governance History Summary');
    expect(out).toContain('Dominant Routing Mode: targeted (3/5)');
    expect(out).toContain(
      'Top Signal: smoke_task_chain (2 次；阶段 implement；gates implementation-readiness)'
    );
    expect(out).toContain('Worsening Gates: implementation-readiness');
    expect(out).toContain('## 四维雷达图');
    expect(out).toContain('| 维度 | 分数 |');
    expect(out).toContain('功能性');
    expect(out).toContain('无数据');
    expect(out).toContain('## 短板 Top 3');
    expect(out).toContain('E6.S4 impl: 65 分');
    expect(out).toContain('## 高迭代 Top 3');
    expect(out).toContain('E6.S1 spec: 5 轮整改');
    expect(out).toContain('## Journey Contract Gaps');
    expect(out).toContain('Smoke Task Chain: 2 次');
    expect(out).toContain('影响阶段 tasks、implement');
    expect(out).toContain('关联 Story E6.S1、E6.S4');
    expect(out).toContain('## Governance Executor Routing');
    expect(out).toContain('Routing Mode: targeted');
    expect(out).toContain('Executor Route: journey-contract-remediation');
    expect(out).toContain('Signals: closure_task_id、smoke_task_chain');
    expect(out).toContain('Event Count: 2');
    expect(out).toContain('Latest Event: 2026-03-28T12:05:00.000Z');
    expect(out).toContain('Affected Stages: implement、plan');
    expect(out).toContain('Trace Summary:');
    expect(out).toContain('Routing Mode: targeted');
    expect(out).toContain('Executor Route: journey-contract-remediation');
    expect(out).toContain('Stop Reason: (none)');
    expect(out).toContain('Journey Contract Signals: closure_task_id, smoke_task_chain');
    expect(out).toContain('## Governance Latest Raw Event');
    expect(out).toContain('## Governance Remediation Runner Summary');
    expect(out).toContain('- Stop Reason: await human review');
    expect(out).toContain('## Loop State Trace Summary');
    expect(out).toContain('## Governance Routing Mode Distribution');
    expect(out).toContain('targeted: 3');
    expect(out).toContain('generic: 2');
    expect(out).toContain('## Governance Signal Hotspots');
    expect(out).toContain('smoke_task_chain: 2 次');
    expect(out).toContain('gates implementation-readiness');
    expect(out).toContain('## Governance Gate Failure Trend');
    expect(out).toContain('implementation-readiness: worsening');
    expect(out).toContain('失败 2/3');
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
      journeyContractSummary: [],
      governanceRoutingModeDistribution: [],
      governanceSignalHotspots: [],
      governanceGateFailureTrend: [],
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
      journeyContractSummary: [],
      governanceRoutingModeDistribution: [],
      governanceSignalHotspots: [],
      governanceGateFailureTrend: [],
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
      journeyContractSummary: [],
      governanceRoutingModeDistribution: [],
      governanceSignalHotspots: [],
      governanceGateFailureTrend: [],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('## 高迭代 Top 3');
    expect(out).toContain('各 stage 均为一次通过');
  });

  it('shows no journey contract gaps when summary is empty', () => {
    const data = {
      healthScore: 70,
      dimensions: [],
      weakTop3: [],
      highIterTop3: [],
      journeyContractSummary: [],
      governanceRoutingModeDistribution: [],
      governanceSignalHotspots: [],
      governanceGateFailureTrend: [],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('## Journey Contract Gaps');
    expect(out).toContain('未发现 Journey contract 漏洞');
  });

  it('shows no governance executor routing summary when absent', () => {
    const data = {
      healthScore: 70,
      dimensions: [],
      weakTop3: [],
      highIterTop3: [],
      journeyContractSummary: [],
      governanceRoutingModeDistribution: [],
      governanceSignalHotspots: [],
      governanceGateFailureTrend: [],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data);
    expect(out).toContain('## Governance History Summary');
    expect(out).toContain('暂无治理历史摘要');
    expect(out).toContain('## Governance Executor Routing');
    expect(out).toContain('暂无治理 rerun executor routing 记录');
    expect(out).toContain('## Governance Routing Mode Distribution');
    expect(out).toContain('暂无治理 routing mode 分布记录');
    expect(out).toContain('## Governance Signal Hotspots');
    expect(out).toContain('暂无治理 signal hotspot 记录');
    expect(out).toContain('## Governance Gate Failure Trend');
    expect(out).toContain('暂无治理 rerun gate failure trend 记录');
  });

  it('reuses the same governance trace summary in epic aggregate view', () => {
    const data = {
      healthScore: 82,
      dimensions: [],
      weakTop3: [],
      highIterTop3: [],
      journeyContractSummary: [],
      governanceRoutingSummary: {
        routingMode: 'targeted' as const,
        executorRoute: 'journey-contract-remediation' as const,
        prioritizedSignals: ['closure_task_id', 'smoke_task_chain'],
        summaryLines: [
          'Routing Mode: targeted',
          'Executor Route: journey-contract-remediation',
          'Stop Reason: await human review',
          'Journey Contract Signals: closure_task_id, smoke_task_chain',
        ],
        runnerSummaryLines: [
          '## Governance Remediation Runner Summary',
          '- Stop Reason: await human review',
          '',
          '## Loop State Trace Summary',
          '- Journey Contract Signals: closure_task_id, smoke_task_chain',
        ],
        source: 'scoring-governance-history' as const,
        latestTimestamp: '2026-03-28T12:05:00.000Z',
        eventCount: 1,
        affectedStages: ['tasks'],
        epicStories: ['E6.S1'],
      },
      governanceRoutingModeDistribution: [{ mode: 'targeted' as const, count: 1 }],
      governanceSignalHotspots: [
        {
          signal: 'closure_task_id',
          count: 1,
          affected_stages: ['tasks'],
          rerun_gates: ['implementation-readiness'],
        },
      ],
      governanceGateFailureTrend: [
        {
          rerun_gate: 'implementation-readiness',
          failure_count: 1,
          total_events: 1,
          latest_outcome: 'blocked',
          latest_timestamp: '2026-03-28T12:05:00.000Z',
          trend: 'flat' as const,
        },
      ],
      vetoCount: 0,
      trend: '持平' as const,
    };
    const out = formatDashboardMarkdown(data, {
      viewMode: 'epic_aggregate',
      epicId: 9,
      storyIds: [1, 2],
      excludedStories: ['E9.S3'],
    });
    expect(out).toContain('# Epic 9 聚合视图');
    expect(out).toContain('纳入 Story：E9.S1, E9.S2');
    expect(out).toContain('已排除：E9.S3（未达完整 run）');
    expect(out).toContain('## Governance Executor Routing');
    expect(out).toContain('Trace Summary:');
    expect(out).toContain('Stop Reason: await human review');
    expect(out).toContain('Journey Contract Signals: closure_task_id, smoke_task_chain');
    expect(out).toContain('## Governance Latest Raw Event');
    expect(out).toContain('## Governance Remediation Runner Summary');
  });
});
