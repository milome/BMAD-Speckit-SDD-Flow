import type { GovernanceRerunHistoryEntry, RunScoreRecord } from '../writer/types';

export interface GovernanceRoutingModeDistributionEntry {
  mode: 'generic' | 'targeted' | 'idle';
  count: number;
}

export interface GovernanceSignalHotspotEntry {
  signal: string;
  count: number;
  affected_stages: string[];
  rerun_gates: string[];
}

export interface GovernanceRerunGateFailureTrendEntry {
  rerun_gate: string;
  failure_count: number;
  total_events: number;
  latest_outcome: string;
  latest_timestamp: string;
  trend: 'worsening' | 'improving' | 'flat';
}

interface GovernanceEventEnvelope {
  record: RunScoreRecord;
  event: GovernanceRerunHistoryEntry;
}

function effectiveStage(record: RunScoreRecord): string {
  return record.trigger_stage === 'speckit_5_2' ? 'implement' : record.stage;
}

function allGovernanceEvents(records: RunScoreRecord[]): GovernanceEventEnvelope[] {
  return records.flatMap((record) =>
    (record.governance_rerun_history ?? []).map((event) => ({ record, event }))
  );
}

function eventMode(event: GovernanceRerunHistoryEntry): GovernanceRoutingModeDistributionEntry['mode'] | null {
  return event.executor_routing?.routing_mode ?? event.decision_mode ?? null;
}

function isFailureOutcome(outcome: string): boolean {
  return !/^(pass|passed|success|succeeded|completed|ready)$/i.test(outcome.trim());
}

/**
 * 聚合 governance 历史中的 routing mode 分布。
 * @param {RunScoreRecord[]} records - scoring records
 * @returns {GovernanceRoutingModeDistributionEntry[]} routing mode 分布
 */
export function summarizeGovernanceRoutingModeDistribution(
  records: RunScoreRecord[]
): GovernanceRoutingModeDistributionEntry[] {
  const byMode = new Map<GovernanceRoutingModeDistributionEntry['mode'], number>();

  for (const { event } of allGovernanceEvents(records)) {
    const mode = eventMode(event);
    if (!mode) continue;
    byMode.set(mode, (byMode.get(mode) ?? 0) + 1);
  }

  return [...byMode.entries()]
    .map(([mode, count]) => ({ mode, count }))
    .sort((left, right) => {
      if (left.mode === right.mode) return 0;
      return left.mode.localeCompare(right.mode);
    });
}

/**
 * 聚合 governance 历史中的 prioritized signals，输出热点 signal。
 * @param {RunScoreRecord[]} records - scoring records
 * @returns {GovernanceSignalHotspotEntry[]} signal 热点列表
 */
export function summarizeGovernanceSignalHotspots(
  records: RunScoreRecord[]
): GovernanceSignalHotspotEntry[] {
  const bySignal = new Map<
    string,
    { count: number; stages: Set<string>; rerunGates: Set<string> }
  >();

  for (const { record, event } of allGovernanceEvents(records)) {
    for (const signal of event.executor_routing?.prioritized_signals ?? []) {
      const current = bySignal.get(signal) ?? {
        count: 0,
        stages: new Set<string>(),
        rerunGates: new Set<string>(),
      };
      current.count += 1;
      current.stages.add(effectiveStage(record));
      current.rerunGates.add(event.rerun_gate);
      bySignal.set(signal, current);
    }
  }

  return [...bySignal.entries()]
    .map(([signal, value]) => ({
      signal,
      count: value.count,
      affected_stages: [...value.stages].sort(),
      rerun_gates: [...value.rerunGates].sort(),
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.signal.localeCompare(right.signal);
    });
}

/**
 * 聚合 governance 历史中的 rerun gate 失败趋势。
 * 趋势规则：首事件非失败且最新事件为失败 => worsening；首事件失败且最新事件非失败 => improving；其余 flat。
 * @param {RunScoreRecord[]} records - scoring records
 * @returns {GovernanceRerunGateFailureTrendEntry[]} rerun gate 趋势列表
 */
export function summarizeGovernanceRerunGateFailureTrend(
  records: RunScoreRecord[]
): GovernanceRerunGateFailureTrendEntry[] {
  const byGate = new Map<string, GovernanceRerunHistoryEntry[]>();

  for (const { event } of allGovernanceEvents(records)) {
    const entries = byGate.get(event.rerun_gate) ?? [];
    entries.push(event);
    byGate.set(event.rerun_gate, entries);
  }

  return [...byGate.entries()]
    .map(([rerunGate, events]) => {
      const sorted = [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
      const first = sorted[0]!;
      const latest = sorted[sorted.length - 1]!;
      const firstFailed = isFailureOutcome(first.outcome);
      const latestFailed = isFailureOutcome(latest.outcome);
      const trend: GovernanceRerunGateFailureTrendEntry['trend'] =
        !firstFailed && latestFailed
          ? 'worsening'
          : firstFailed && !latestFailed
            ? 'improving'
            : 'flat';

      return {
        rerun_gate: rerunGate,
        failure_count: sorted.filter((event) => isFailureOutcome(event.outcome)).length,
        total_events: sorted.length,
        latest_outcome: latest.outcome,
        latest_timestamp: latest.timestamp,
        trend,
      };
    })
    .sort((left, right) => {
      if (right.failure_count !== left.failure_count) {
        return right.failure_count - left.failure_count;
      }
      return left.rerun_gate.localeCompare(right.rerun_gate);
    });
}
