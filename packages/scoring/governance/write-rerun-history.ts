import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAndDedupeRecords } from '../query/loader';
import { parseEpicStoryFromRecord } from '../query/parse-epic-story';
import { writeScoreRecordSync } from '../writer/write-score';
import type {
  GovernanceExecutorRoutingRecord,
  GovernanceRerunHistoryEntry,
  RunScoreRecord,
} from '../writer/types';

interface GovernanceRuntimeContextLike {
  epicId?: string;
  runId?: string;
  stage?: string;
  storyId?: string;
}

interface GovernanceRuntimePolicyLike {
  triggerStage?: string;
}

interface GovernanceExecutorRoutingLike {
  routingMode?: 'targeted' | 'generic';
  executorRoute?: 'journey-contract-remediation' | 'default-gate-remediation';
  prioritizedSignals?: string[];
}

export interface WriteGovernanceRerunHistoryInput {
  projectRoot: string;
  eventId: string;
  timestamp: string;
  rerunGate: string;
  outcome: string;
  decisionMode?: 'targeted' | 'generic' | 'idle';
  attemptId?: string;
  loopStateId?: string;
  runtimeContext?: GovernanceRuntimeContextLike | null;
  runtimePolicy?: GovernanceRuntimePolicyLike | null;
  executorRouting?: GovernanceExecutorRoutingLike;
  remediationAuditTraceSummaryLines?: string[];
  runnerSummaryLines?: string[];
}

function normalizeSummaryLines(lines?: string[]): string[] | undefined {
  const normalized = [...new Set((lines ?? []).map((line) => line.trim()).filter(Boolean))];
  return normalized.length > 0 ? normalized : undefined;
}

function resolveScoringDataPath(projectRoot: string): string {
  const envPath = process.env.SCORING_DATA_PATH;
  if (envPath && envPath.trim() !== '') {
    return path.isAbsolute(envPath) ? envPath : path.resolve(projectRoot, envPath);
  }

  const candidates = [
    path.join(projectRoot, 'packages', 'scoring', 'data'),
    path.join(projectRoot, 'scoring', 'data'),
    path.join(projectRoot, '_bmad-output', 'scoring'),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]!;
}

function parseEpicStoryFromRuntimeContext(
  runtimeContext?: GovernanceRuntimeContextLike | null
): { epicId: number; storyId: number } | null {
  const dottedStory = runtimeContext?.storyId?.match(/^(\d+)\.(\d+)$/);
  if (dottedStory) {
    return {
      epicId: Number(dottedStory[1]),
      storyId: Number(dottedStory[2]),
    };
  }

  const epic = runtimeContext?.epicId?.match(/(\d+)/);
  const story = runtimeContext?.storyId?.match(/(\d+)$/);
  if (epic && story) {
    return {
      epicId: Number(epic[1]),
      storyId: Number(story[1]),
    };
  }

  return null;
}

function effectiveStage(record: RunScoreRecord): string {
  return record.trigger_stage === 'speckit_5_2' ? 'implement' : record.stage;
}

function sanitizeRunToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function buildSyntheticRunId(input: {
  epicStory: { epicId: number; storyId: number } | null;
  stage: string;
  runGroupId?: string;
  timestamp: string;
}): string {
  const timeToken = new Date(input.timestamp).getTime();
  if (input.epicStory) {
    return `gov-e${input.epicStory.epicId}-s${input.epicStory.storyId}-${sanitizeRunToken(
      input.stage
    )}-${timeToken}`;
  }

  const baseToken = sanitizeRunToken(input.runGroupId ?? 'runtime-governance');
  return `gov-${baseToken}-${timeToken}`;
}

function normalizeExecutorRouting(
  routing?: GovernanceExecutorRoutingLike
): GovernanceExecutorRoutingRecord | undefined {
  if (!routing?.routingMode || !routing.executorRoute) {
    return undefined;
  }

  return {
    routing_mode: routing.routingMode,
    executor_route: routing.executorRoute,
    prioritized_signals: [...new Set((routing.prioritizedSignals ?? []).filter(Boolean))].sort(),
  };
}

function mergeGovernanceRerunHistory(
  existing: GovernanceRerunHistoryEntry[] | undefined,
  incoming: GovernanceRerunHistoryEntry[] | undefined
): GovernanceRerunHistoryEntry[] | undefined {
  const merged = new Map<string, GovernanceRerunHistoryEntry>();

  for (const item of existing ?? []) {
    if (item?.event_id) {
      merged.set(item.event_id, item);
    }
  }

  for (const item of incoming ?? []) {
    if (item?.event_id) {
      merged.set(item.event_id, item);
    }
  }

  if (merged.size === 0) {
    return undefined;
  }

  return [...merged.values()].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function findTargetRecord(input: {
  dataPath: string;
  epicStory: { epicId: number; storyId: number } | null;
  stage: string;
  runGroupId?: string;
}): RunScoreRecord | undefined {
  const records = loadAndDedupeRecords(input.dataPath).filter((record) => record.scenario === 'real_dev');

  const candidates = records.filter((record) => {
    if (effectiveStage(record) !== input.stage) {
      return false;
    }

    if (input.epicStory) {
      const parsed = parseEpicStoryFromRecord(record);
      return (
        parsed != null &&
        parsed.epicId === input.epicStory.epicId &&
        parsed.storyId === input.epicStory.storyId
      );
    }

    return (
      (input.runGroupId != null && record.run_group_id === input.runGroupId) ||
      (input.runGroupId != null && record.run_id === input.runGroupId)
    );
  });

  return [...candidates].sort((left, right) => right.timestamp.localeCompare(left.timestamp))[0];
}

export function writeGovernanceRerunHistory(
  input: WriteGovernanceRerunHistoryInput
): RunScoreRecord {
  const dataPath = resolveScoringDataPath(input.projectRoot);
  const epicStory = parseEpicStoryFromRuntimeContext(input.runtimeContext);
  const rawStage = input.runtimeContext?.stage ?? 'post_impl';
  const stage = rawStage === 'post_audit' ? 'post_impl' : rawStage;
  const runGroupId = input.runtimeContext?.runId;
  const target = findTargetRecord({
    dataPath,
    epicStory,
    stage,
    runGroupId,
  });

  const entry: GovernanceRerunHistoryEntry = {
    event_id: input.eventId,
    timestamp: input.timestamp,
    rerun_gate: input.rerunGate,
    outcome: input.outcome,
    ...(input.decisionMode != null ? { decision_mode: input.decisionMode } : {}),
    ...(input.attemptId != null ? { attempt_id: input.attemptId } : {}),
    ...(input.loopStateId != null ? { loop_state_id: input.loopStateId } : {}),
    ...(normalizeExecutorRouting(input.executorRouting) != null
      ? { executor_routing: normalizeExecutorRouting(input.executorRouting) }
      : {}),
    ...(normalizeSummaryLines(input.remediationAuditTraceSummaryLines) != null
      ? { summary_lines: normalizeSummaryLines(input.remediationAuditTraceSummaryLines) }
      : {}),
    ...(normalizeSummaryLines(input.runnerSummaryLines) != null
      ? { runner_summary_lines: normalizeSummaryLines(input.runnerSummaryLines) }
      : {}),
  };

  const nextRecord: RunScoreRecord = {
    ...(target ?? {
      run_id: buildSyntheticRunId({
        epicStory,
        stage,
        runGroupId,
        timestamp: input.timestamp,
      }),
      scenario: 'real_dev',
      stage,
      phase_score: 100,
      phase_weight: 0,
      check_items: [],
      timestamp: input.timestamp,
      iteration_count: 0,
      iteration_records: [],
      first_pass: true,
    }),
    ...(runGroupId != null ? { run_group_id: target?.run_group_id ?? runGroupId } : {}),
    ...(input.runtimePolicy?.triggerStage != null && target?.trigger_stage == null
      ? { trigger_stage: input.runtimePolicy.triggerStage }
      : {}),
    governance_rerun_history: mergeGovernanceRerunHistory(target?.governance_rerun_history, [
      entry,
    ]),
  };

  writeScoreRecordSync(nextRecord, 'both', { dataPath });
  return nextRecord;
}
