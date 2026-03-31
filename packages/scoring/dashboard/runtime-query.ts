import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCanonicalCandidatesFromRecordsSync } from '../analytics/candidate-builder';
import {
  assessSampleForTarget,
  buildDatasetRedactionPreview,
  buildDatasetRedactionSummary,
  type DatasetRedactionPreviewItem,
  type DatasetExportTarget,
} from '../analytics/validation-report';
import type { CanonicalSftSample, DatasetBundleManifest } from '../analytics/types';
import { loadAndDedupeRecords } from '../query/loader';
import type { RunScoreRecord } from '../writer/types';
import { readRuntimeEvents } from '../runtime/event-store';
import { buildRunProjection } from '../runtime/projection';
import type {
  RuntimeEvent,
  RuntimeRunProjection,
  RuntimeRunStatus,
  RuntimeScopeRef,
} from '../runtime/types';
import {
  computeHealthScore,
  getDimensionScores,
  getHighIterationTop3,
  getLatestRunRecords,
  getLatestRunRecordsV2,
  getTrend,
  getWeakTop3,
  type DimensionEntry,
  type HighIterEntry,
  type TrendDirection,
  type WeakEntry,
} from './compute';
import { buildVetoItemIds } from '../veto';

type SelectionSource = 'runtime' | 'scores' | 'none';
type RuntimeStatusLike = RuntimeRunStatus | 'unknown';
export type DashboardWorkItemType = 'story' | 'standalone_task' | 'bugfix';
export type DashboardArtifactScope = 'story_scoped' | 'orphan_scoped';
export type DashboardBoardStatus = 'todo' | 'in_progress' | 'done';

export interface RuntimeDashboardQueryOptions {
  root?: string;
  dataPath?: string;
  strategy?: 'epic_story_window' | 'run_id';
  epic?: number;
  story?: number;
  windowHours?: number;
  workItemId?: string;
  boardGroupId?: string;
}

export interface RuntimeDashboardSelection {
  run_id: string | null;
  source: SelectionSource;
  has_runtime: boolean;
  has_scores: boolean;
  work_item_id?: string | null;
  board_group_id?: string | null;
}

export interface DashboardOverviewPanel {
  status: RuntimeStatusLike;
  health_score: number | null;
  trend: TrendDirection;
  veto_count: number;
  dimensions: DimensionEntry[];
  weak_top3: WeakEntry[];
  high_iteration_top3: HighIterEntry[];
  score_record_count: number;
  last_updated_at: string | null;
}

export interface DashboardRuntimeContextPanel {
  run_id: string | null;
  status: RuntimeStatusLike;
  current_stage: string | null;
  flow: string | null;
  scope: RuntimeScopeRef | null;
  last_event_at: string | null;
  work_item?: {
    work_item_id: string;
    work_item_type: DashboardWorkItemType;
    artifact_scope: DashboardArtifactScope;
    board_group_id: string;
    board_group_label: string;
    linked_story_key?: string | null;
  } | null;
}

export interface DashboardStageTimelineEntry {
  stage: string;
  status: RuntimeStatusLike;
  started_at?: string;
  completed_at?: string;
  phase_score: number | null;
  raw_phase_score: number | null;
  veto_triggered: boolean;
  iteration_count: number | null;
  score_timestamp: string | null;
}

export interface DashboardScoreDetailRecord {
  run_id: string;
  stage: string;
  timestamp: string;
  phase_score: number;
  raw_phase_score: number | null;
  phase_weight: number;
  iteration_count: number;
  first_pass: boolean;
  veto_triggered: boolean;
  tier_coefficient: number | null;
  check_item_count: number;
  source_path?: string;
  base_commit_hash?: string;
  dimension_scores?: Record<string, number>;
  findings: DashboardScoreFinding[];
}

export interface DashboardScoreFinding {
  run_id: string;
  stage: string;
  timestamp: string;
  item_id: string;
  note: string;
  score_delta: number;
}

export interface DashboardScoreDetailPayload {
  run_id: string | null;
  records: DashboardScoreDetailRecord[];
  findings: DashboardScoreFinding[];
}

export interface DashboardWorkItem {
  work_item_id: string;
  work_item_type: DashboardWorkItemType;
  artifact_scope: DashboardArtifactScope;
  title: string;
  slug: string;
  flow: 'story' | 'standalone_tasks' | 'bugfix' | 'epic' | 'unknown';
  board_group_id: string;
  board_group_label: string;
  board_status: DashboardBoardStatus;
  epic_id?: string | null;
  story_key?: string | null;
  linked_story_key?: string | null;
  linked_epic_id?: string | null;
  primary_run_id?: string | null;
  run_ids: string[];
  runtime_status: 'pending' | 'running' | 'passed' | 'failed' | 'vetoed' | 'skipped' | 'unknown';
  current_stage?: string | null;
  phase_score?: number | null;
  findings_count: number;
  sft_status?: 'ready' | 'partial' | 'blocked' | 'none';
  source_path?: string | null;
  artifact_doc_path?: string | null;
  last_updated_at?: string | null;
}

export interface DashboardBoardGroup {
  board_group_id: string;
  board_group_label: string;
  kind: 'epic' | 'standalone_ops' | 'bugfix_queue';
  sort_order: number;
  counts: {
    todo: number;
    in_progress: number;
    done: number;
  };
}

export interface DashboardWorkboardPayload {
  active_board_group_id: string | null;
  active_work_item_id: string | null;
  board_groups: DashboardBoardGroup[];
  work_items: DashboardWorkItem[];
}

export interface DashboardSftSummary {
  total_candidates: number;
  accepted: number;
  rejected: number;
  downgraded: number;
  by_split: Record<'train' | 'validation' | 'test' | 'holdout', number>;
  target_availability: Record<DatasetExportTarget, {
    compatible: number;
    incompatible: number;
  }>;
  rejection_reasons: Array<{
    reason: string;
    count: number;
  }>;
  redaction_status_counts: {
    clean: number;
    redacted: number;
    blocked: number;
  };
  redaction_applied_rules: Array<{
    rule: string;
    count: number;
  }>;
  redaction_finding_kinds: Array<{
    kind: string;
    count: number;
  }>;
  redaction_preview: Array<{
    sample_id: string;
    status: 'clean' | 'redacted' | 'blocked';
    applied_rules: string[];
    finding_kinds: string[];
    rejection_reasons?: string[];
  }>;
  last_bundle: {
    bundle_id: string;
    export_target: DatasetExportTarget;
    created_at: string;
    bundle_dir: string;
    manifest_path: string;
  } | null;
}

function normalizeRedactionPreviewStatus(
  status: DatasetRedactionPreviewItem['status']
): 'clean' | 'redacted' | 'blocked' {
  return status;
}

export interface RuntimeDashboardSnapshot {
  generated_at: string;
  selection: RuntimeDashboardSelection;
  overview: DashboardOverviewPanel;
  runtime_context: DashboardRuntimeContextPanel;
  stage_timeline: DashboardStageTimelineEntry[];
  score_detail: DashboardScoreDetailPayload;
  sft_summary: DashboardSftSummary;
  workboard: DashboardWorkboardPayload;
}

type ScoreRecordWithDerived = RunScoreRecord & {
  veto_triggered?: boolean;
  tier_coefficient?: number;
  raw_phase_score?: number;
};

interface RunWorkItemSeed {
  run_id: string;
  scope: RuntimeScopeRef | null;
  flow: string | null;
  source_path: string | null;
  runtime_status: RuntimeStatusLike;
  current_stage: string | null;
  has_stage_execution: boolean;
  last_updated_at: string | null;
  score_records: RunScoreRecord[];
}

interface WorkItemIdentity {
  work_item_id: string;
  work_item_type: DashboardWorkItemType;
  artifact_scope: DashboardArtifactScope;
  title: string;
  slug: string;
  flow: DashboardWorkItem['flow'];
  board_group_id: string;
  board_group_label: string;
  board_group_kind: DashboardBoardGroup['kind'];
  epic_id?: string | null;
  story_key?: string | null;
  linked_story_key?: string | null;
  linked_epic_id?: string | null;
}

interface WorkItemAggregateCandidate extends DashboardWorkItem {
  _board_group_kind: DashboardBoardGroup['kind'];
}

function compareTimestamps(left?: string | null, right?: string | null): number {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return rightValue - leftValue;
}

function compareTimestampsAsc(left?: string | null, right?: string | null): number {
  return compareTimestamps(right, left);
}

function normalizePath(value?: string | null): string {
  return (value ?? '').replace(/\\/g, '/');
}

function titleFromSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugFromPath(sourcePath?: string | null): string | null {
  const normalized = normalizePath(sourcePath);
  if (!normalized) return null;
  const basename = normalized.split('/').pop() ?? normalized;
  const withoutExtension = basename.replace(/\.[a-z0-9]+$/i, '');
  const withoutPrefix = withoutExtension.replace(/^bugfix[-_]+/i, '').replace(/^standalone[-_]+/i, '');
  const slug = withoutPrefix.trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return slug || null;
}

function parseEpicNumber(epicId?: string | null): string | null {
  if (!epicId) return null;
  const match = /epic[-_]?(\d+)/i.exec(epicId);
  return match?.[1] ?? null;
}

function classifyArtifactScope(sourcePath?: string | null, scope?: RuntimeScopeRef | null): DashboardArtifactScope {
  if (scope?.story_key) return 'story_scoped';
  const normalized = normalizePath(sourcePath);
  if (normalized.includes('/_orphan/')) return 'orphan_scoped';
  return 'story_scoped';
}

function inferFlowForSeed(seed: Pick<RunWorkItemSeed, 'flow' | 'scope' | 'source_path'>): DashboardWorkItem['flow'] {
  if (seed.scope?.story_key) return 'story';
  if (seed.flow === 'story' || seed.flow === 'standalone_tasks' || seed.flow === 'bugfix' || seed.flow === 'epic') {
    return seed.flow;
  }
  const normalized = normalizePath(seed.source_path).toLowerCase();
  if (normalized.includes('/standalone_tasks/')) return 'standalone_tasks';
  if (normalized.includes('/bugfix/') || normalized.includes('/bugfix_') || normalized.includes('/bugfix-')) return 'bugfix';
  if (normalized.includes('/story-') || normalized.includes('/story/')) return 'story';
  return 'unknown';
}

function deriveWorkItemIdentity(seed: RunWorkItemSeed): WorkItemIdentity | null {
  const flow = inferFlowForSeed(seed);
  const artifactScope = classifyArtifactScope(seed.source_path, seed.scope);
  const storyKey = seed.scope?.story_key ?? null;
  const epicId = seed.scope?.epic_id ?? null;

  if (storyKey) {
    const epicNumber = parseEpicNumber(epicId);
    return {
      work_item_id: `story:${storyKey}`,
      work_item_type: 'story',
      artifact_scope: 'story_scoped',
      title: storyKey,
      slug: storyKey,
      flow: 'story',
      board_group_id: epicId ? `epic:${epicId}` : 'epic:unassigned',
      board_group_label: epicNumber ? `Epic ${epicNumber}` : 'Unassigned Story',
      board_group_kind: 'epic',
      epic_id: epicId,
      story_key: storyKey,
      linked_story_key: null,
      linked_epic_id: null,
    };
  }

  const slug = slugFromPath(seed.source_path) ?? seed.run_id.toLowerCase();
  if (flow === 'standalone_tasks') {
    return {
      work_item_id: `standalone_task:orphan:${slug}`,
      work_item_type: 'standalone_task',
      artifact_scope: artifactScope,
      title: titleFromSlug(slug),
      slug,
      flow,
      board_group_id: 'queue:standalone-ops',
      board_group_label: 'Standalone / Ops',
      board_group_kind: 'standalone_ops',
      epic_id: null,
      story_key: null,
      linked_story_key: null,
      linked_epic_id: null,
    };
  }

  if (flow === 'bugfix') {
    return {
      work_item_id: `bugfix:orphan:${slug}`,
      work_item_type: 'bugfix',
      artifact_scope: artifactScope,
      title: titleFromSlug(slug),
      slug,
      flow,
      board_group_id: 'queue:bugfix',
      board_group_label: 'Bugfix Queue',
      board_group_kind: 'bugfix_queue',
      epic_id: null,
      story_key: null,
      linked_story_key: null,
      linked_epic_id: null,
    };
  }

  return null;
}

function summarizeRuntimeStatus(seeds: RunWorkItemSeed[]): RuntimeStatusLike {
  const statuses = seeds.map((seed) => seed.runtime_status);
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('vetoed')) return 'vetoed';
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('passed')) return 'passed';
  if (statuses.includes('skipped')) return 'skipped';
  return 'unknown';
}

function deriveBoardStatus(
  runtimeStatus: RuntimeStatusLike,
  seeds: RunWorkItemSeed[],
  findingsCount: number,
  latestScoreRecord: RunScoreRecord | null
): DashboardBoardStatus {
  const hasStageExecution = seeds.some((seed) => seed.has_stage_execution);
  if (latestScoreRecord == null && !hasStageExecution && (runtimeStatus === 'pending' || runtimeStatus === 'unknown')) {
    return 'todo';
  }
  if (runtimeStatus === 'running' || runtimeStatus === 'failed' || runtimeStatus === 'vetoed') {
    return 'in_progress';
  }
  if (runtimeStatus === 'pending') {
    return hasStageExecution || latestScoreRecord != null ? 'in_progress' : 'todo';
  }
  if (findingsCount > 0) {
    return 'in_progress';
  }
  return latestScoreRecord == null ? 'todo' : 'done';
}

function deriveSftStatus(boardStatus: DashboardBoardStatus, latestScoreRecord: RunScoreRecord | null): DashboardWorkItem['sft_status'] {
  if (boardStatus === 'todo' || latestScoreRecord == null) return 'none';
  if (latestScoreRecord.phase_score >= 90) return 'ready';
  return 'partial';
}

function buildRunWorkItemSeeds(
  events: RuntimeEvent[],
  projections: RuntimeRunProjection[],
  scoreRecords: RunScoreRecord[]
): RunWorkItemSeed[] {
  const seeds = new Map<string, RunWorkItemSeed>();

  const ensureSeed = (runId: string): RunWorkItemSeed => {
    const existing = seeds.get(runId);
    if (existing) return existing;
    const created: RunWorkItemSeed = {
      run_id: runId,
      scope: null,
      flow: null,
      source_path: null,
      runtime_status: 'unknown',
      current_stage: null,
      has_stage_execution: false,
      last_updated_at: null,
      score_records: [],
    };
    seeds.set(runId, created);
    return created;
  };

  for (const event of events) {
    const seed = ensureSeed(event.run_id);
    if (event.scope) seed.scope = { ...(seed.scope ?? {}), ...event.scope };
    if (event.flow) seed.flow = event.flow;
    const sourcePath = event.source?.source_path ?? (typeof event.payload?.path === 'string' ? event.payload.path : null);
    if (sourcePath) seed.source_path = sourcePath;
    seed.last_updated_at = compareTimestamps(seed.last_updated_at, event.timestamp) > 0 ? seed.last_updated_at : event.timestamp;
    if (event.event_type === 'stage.started' || event.event_type === 'stage.completed' || event.event_type === 'stage.failed' || event.event_type === 'stage.vetoed') {
      seed.has_stage_execution = true;
    }
  }

  for (const projection of projections) {
    const seed = ensureSeed(projection.run_id);
    seed.scope = projection.current_scope ?? seed.scope;
    seed.flow = projection.current_scope?.flow ?? seed.flow;
    seed.runtime_status = projection.status;
    seed.current_stage = projection.current_stage;
    seed.has_stage_execution = seed.has_stage_execution || projection.stage_history.length > 0;
    seed.last_updated_at = compareTimestamps(seed.last_updated_at, projection.last_event_at) > 0 ? seed.last_updated_at : projection.last_event_at;
    const projectedSourcePath = projection.artifact_refs[0]?.path ?? projection.score_refs[0]?.path ?? seed.source_path;
    if (projectedSourcePath) seed.source_path = projectedSourcePath;
  }

  for (const record of scoreRecords) {
    const seed = ensureSeed(record.run_id);
    seed.score_records.push(record);
    if (seed.runtime_status === 'unknown') seed.runtime_status = 'passed';
    if (seed.current_stage == null) seed.current_stage = record.stage;
    if (record.source_path) seed.source_path = record.source_path;
    seed.last_updated_at = compareTimestamps(seed.last_updated_at, record.timestamp) > 0 ? seed.last_updated_at : record.timestamp;
  }

  return [...seeds.values()];
}

function buildScoreFindings(record: RunScoreRecord): DashboardScoreFinding[] {
  return record.check_items
    .filter((item) => item.passed === false)
    .map((item) => ({
      run_id: record.run_id,
      stage: record.stage,
      timestamp: record.timestamp,
      item_id: item.item_id,
      note: item.note ?? item.item_id,
      score_delta: item.score_delta,
    }));
}

function buildWorkboard(
  events: RuntimeEvent[],
  projections: RuntimeRunProjection[],
  scoreRecords: RunScoreRecord[],
  selectedRunId: string | null,
  options: Pick<RuntimeDashboardQueryOptions, 'workItemId' | 'boardGroupId'> = {}
): DashboardWorkboardPayload {
  const seeds = buildRunWorkItemSeeds(events, projections, scoreRecords);
  const grouped = new Map<string, { identity: WorkItemIdentity; seeds: RunWorkItemSeed[] }>();

  for (const seed of seeds) {
    const identity = deriveWorkItemIdentity(seed);
    if (!identity) continue;
    const existing = grouped.get(identity.work_item_id);
    if (existing) existing.seeds.push(seed);
    else grouped.set(identity.work_item_id, { identity, seeds: [seed] });
  }

  const workItems: WorkItemAggregateCandidate[] = [...grouped.values()].map(({ identity, seeds }) => {
    const allScoreRecords = seeds.flatMap((seed) => seed.score_records).sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
    const latestScoreRecord = allScoreRecords[0] ?? null;
    const runtimeStatus = summarizeRuntimeStatus(seeds);
    const findingsCount = allScoreRecords.reduce((count, record) => count + buildScoreFindings(record).length, 0);
    const boardStatus = deriveBoardStatus(runtimeStatus, seeds, findingsCount, latestScoreRecord);
    const latestSeed = [...seeds].sort((left, right) => compareTimestamps(left.last_updated_at, right.last_updated_at))[0] ?? seeds[0];
    const primarySeed = seeds.find((seed) => seed.run_id === selectedRunId) ?? seeds.find((seed) => seed.runtime_status === 'running') ?? latestSeed;

    return {
      work_item_id: identity.work_item_id,
      work_item_type: identity.work_item_type,
      artifact_scope: identity.artifact_scope,
      title: identity.title,
      slug: identity.slug,
      flow: identity.flow,
      board_group_id: identity.board_group_id,
      board_group_label: identity.board_group_label,
      board_status: boardStatus,
      epic_id: identity.epic_id ?? null,
      story_key: identity.story_key ?? null,
      linked_story_key: identity.linked_story_key ?? null,
      linked_epic_id: identity.linked_epic_id ?? null,
      primary_run_id: primarySeed?.run_id ?? null,
      run_ids: seeds.map((seed) => seed.run_id),
      runtime_status: runtimeStatus,
      current_stage: primarySeed?.current_stage ?? latestScoreRecord?.stage ?? null,
      phase_score: boardStatus === 'todo' ? null : latestScoreRecord?.phase_score ?? null,
      findings_count: findingsCount,
      sft_status: deriveSftStatus(boardStatus, latestScoreRecord),
      source_path: primarySeed?.source_path ?? latestScoreRecord?.source_path ?? null,
      artifact_doc_path: latestScoreRecord?.source_path ?? primarySeed?.source_path ?? null,
      last_updated_at: primarySeed?.last_updated_at ?? latestScoreRecord?.timestamp ?? null,
      _board_group_kind: identity.board_group_kind,
    };
  });

  workItems.sort((left, right) => compareTimestamps(left.last_updated_at, right.last_updated_at) || left.title.localeCompare(right.title));

  const groupMap = new Map<string, DashboardBoardGroup>();
  for (const item of workItems) {
    const existing = groupMap.get(item.board_group_id) ?? {
      board_group_id: item.board_group_id,
      board_group_label: item.board_group_label,
      kind: item._board_group_kind,
      sort_order: item._board_group_kind === 'epic' ? 0 : item._board_group_kind === 'standalone_ops' ? 1 : 2,
      counts: { todo: 0, in_progress: 0, done: 0 },
    };
    existing.counts[item.board_status] += 1;
    groupMap.set(item.board_group_id, existing);
  }

  const boardGroups = [...groupMap.values()].sort((left, right) => left.sort_order - right.sort_order || left.board_group_label.localeCompare(right.board_group_label));
  const activeBoardGroupId = options.boardGroupId ?? boardGroups[0]?.board_group_id ?? null;
  const filteredWorkItems = workItems.filter((item) => item.board_group_id === activeBoardGroupId);
  const activeWorkItemId = options.workItemId ?? filteredWorkItems[0]?.work_item_id ?? null;

  return {
    active_board_group_id: activeBoardGroupId,
    active_work_item_id: activeWorkItemId,
    board_groups: boardGroups,
    work_items: workItems.map(({ _board_group_kind, ...item }) => item),
  };
}

function buildRuntimeProjections(events: RuntimeEvent[]): RuntimeRunProjection[] {
  const runIds = [...new Set(events.map((event) => event.run_id))];
  return runIds
    .map((runId) => buildRunProjection(events, runId))
    .filter((item): item is RuntimeRunProjection => item != null);
}

function inferRuntimeRootFromDataPath(dataPath: string | undefined, fallbackRoot: string): string {
  if (dataPath == null || dataPath === '') {
    return fallbackRoot;
  }

  const resolved = path.resolve(dataPath);
  const normalized = resolved.replace(/\\/g, '/');
  const knownSuffixes = ['/packages/scoring/data', '/_bmad-output/scoring'];
  for (const suffix of knownSuffixes) {
    if (normalized.endsWith(suffix)) {
      return resolved.slice(0, resolved.length - suffix.length);
    }
  }

  return fallbackRoot;
}

function selectRuntimeProjection(
  projections: RuntimeRunProjection[]
): RuntimeRunProjection | null {
  if (projections.length === 0) {
    return null;
  }

  const active = projections
    .filter((projection) => projection.status === 'running' || projection.status === 'pending')
    .sort((left, right) => compareTimestamps(left.last_event_at, right.last_event_at));

  if (active.length > 0) {
    return active[0] ?? null;
  }

  const latest = [...projections].sort((left, right) =>
    compareTimestamps(left.last_event_at, right.last_event_at)
  );
  return latest[0] ?? null;
}

function resolveSelectedScoreRecords(
  scoreRecords: RunScoreRecord[],
  options: RuntimeDashboardQueryOptions,
  projection: RuntimeRunProjection | null
): RunScoreRecord[] {
  if (projection) {
    return scoreRecords
      .filter((record) => record.run_id === projection.run_id)
      .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
  }

  if (scoreRecords.length === 0) {
    return [];
  }

  if (options.strategy === 'epic_story_window') {
    return getLatestRunRecordsV2(scoreRecords, {
      strategy: 'epic_story_window',
      epic: options.epic,
      story: options.story,
      windowHours: options.windowHours,
    });
  }

  return getLatestRunRecords(scoreRecords);
}

function mapDimensionScores(
  scores?: Array<{ dimension: string; score: number }>
): Record<string, number> | undefined {
  if (!scores || scores.length === 0) {
    return undefined;
  }

  return Object.fromEntries(scores.map((score) => [score.dimension, score.score]));
}

function isScoreRecordVetoed(record: RunScoreRecord): boolean {
  const derived = record as ScoreRecordWithDerived;
  if (derived.veto_triggered != null) {
    return derived.veto_triggered;
  }

  const vetoIds = buildVetoItemIds();
  return record.check_items.some((item) => item.passed === false && vetoIds.has(item.item_id));
}

function countVetoTriggeredRecords(records: RunScoreRecord[]): number {
  return records.filter((record) => isScoreRecordVetoed(record)).length;
}

function buildScoreDetailRecords(records: RunScoreRecord[]): DashboardScoreDetailRecord[] {
  return records
    .slice()
    .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp))
    .map((record) => {
      const derived = record as ScoreRecordWithDerived;
      return {
        run_id: record.run_id,
        stage: record.stage,
        timestamp: record.timestamp,
        phase_score: record.phase_score,
        raw_phase_score: derived.raw_phase_score ?? record.phase_score,
        phase_weight: record.phase_weight,
        iteration_count: record.iteration_count,
        first_pass: record.first_pass,
        veto_triggered: isScoreRecordVetoed(record),
        tier_coefficient: derived.tier_coefficient ?? null,
        check_item_count: record.check_items.length,
        source_path: record.source_path,
        base_commit_hash: record.base_commit_hash,
        dimension_scores: mapDimensionScores(record.dimension_scores),
        findings: buildScoreFindings(record),
      };
    });
}

function buildSyntheticRuntimeContext(
  scoreDetailRecords: DashboardScoreDetailRecord[]
): DashboardRuntimeContextPanel {
  if (scoreDetailRecords.length === 0) {
    return {
      run_id: null,
      status: 'unknown',
      current_stage: null,
      flow: null,
      scope: null,
      last_event_at: null,
    };
  }

  const latest = scoreDetailRecords[0]!;
  return {
    run_id: latest.run_id,
    status: 'passed',
    current_stage: latest.stage,
    flow: 'story',
    scope: null,
    last_event_at: latest.timestamp,
  };
}

function buildStageTimeline(
  projection: RuntimeRunProjection | null,
  scoreDetailRecords: DashboardScoreDetailRecord[]
): DashboardStageTimelineEntry[] {
  const byStage = new Map<string, DashboardScoreDetailRecord>();
  for (const record of scoreDetailRecords) {
    byStage.set(record.stage, record);
  }

  if (projection && projection.stage_history.length > 0) {
    const stages: DashboardStageTimelineEntry[] = projection.stage_history.map((stage) => {
      const scoreDetail = byStage.get(stage.stage);
      return {
        stage: stage.stage,
        status: stage.status,
        started_at: stage.started_at,
        completed_at: stage.completed_at,
        phase_score: scoreDetail?.phase_score ?? null,
        raw_phase_score: scoreDetail?.raw_phase_score ?? null,
        veto_triggered: scoreDetail?.veto_triggered ?? false,
        iteration_count: scoreDetail?.iteration_count ?? null,
        score_timestamp: scoreDetail?.timestamp ?? null,
      };
    });

    for (const record of scoreDetailRecords) {
      if (projection.stage_history.some((item) => item.stage === record.stage)) {
        continue;
      }
      stages.push({
        stage: record.stage,
        status: 'passed',
        phase_score: record.phase_score,
        raw_phase_score: record.raw_phase_score,
        veto_triggered: record.veto_triggered,
        iteration_count: record.iteration_count,
        score_timestamp: record.timestamp,
      });
    }

    return stages;
  }

  return scoreDetailRecords
    .slice()
    .sort((left, right) => compareTimestampsAsc(left.timestamp, right.timestamp))
    .map((record) => ({
      stage: record.stage,
      status: 'passed',
      phase_score: record.phase_score,
      raw_phase_score: record.raw_phase_score,
      veto_triggered: record.veto_triggered,
      iteration_count: record.iteration_count,
      score_timestamp: record.timestamp,
      completed_at: record.timestamp,
    }));
}

function createEmptyTargetAvailability(): DashboardSftSummary['target_availability'] {
  return {
    openai_chat: { compatible: 0, incompatible: 0 },
    hf_conversational: { compatible: 0, incompatible: 0 },
    hf_tool_calling: { compatible: 0, incompatible: 0 },
  };
}

function countRejectionReasons(samples: CanonicalSftSample[]): DashboardSftSummary['rejection_reasons'] {
  const counts = new Map<string, number>();

  for (const sample of samples) {
    for (const reason of sample.quality.rejection_reasons) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([reason, count]) => ({ reason, count }));
}

function buildTargetAvailability(
  samples: CanonicalSftSample[]
): DashboardSftSummary['target_availability'] {
  const targetAvailability = createEmptyTargetAvailability();

  const targets: DatasetExportTarget[] = ['openai_chat', 'hf_conversational', 'hf_tool_calling'];
  for (const sample of samples) {
    for (const target of targets) {
      const decision = assessSampleForTarget(sample, target);
      if (decision.exportable) {
        targetAvailability[target].compatible += 1;
      } else {
        targetAvailability[target].incompatible += 1;
      }
    }
  }

  return targetAvailability;
}

function findLatestBundle(root: string): DashboardSftSummary['last_bundle'] {
  const bundlesRoot = path.join(root, '_bmad-output', 'datasets');
  if (!fs.existsSync(bundlesRoot)) {
    return null;
  }

  const manifests: Array<{
    manifest: DatasetBundleManifest;
    bundleDir: string;
    manifestPath: string;
  }> = [];

  for (const dirent of fs.readdirSync(bundlesRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory()) {
      continue;
    }
    const bundleDir = path.join(bundlesRoot, dirent.name);
    const manifestPath = path.join(bundleDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as DatasetBundleManifest;
      if (manifest.bundle_id && manifest.export_target && manifest.created_at) {
        manifests.push({ manifest, bundleDir, manifestPath });
      }
    } catch {
      continue;
    }
  }

  if (manifests.length === 0) {
    return null;
  }

  manifests.sort((left, right) => compareTimestamps(left.manifest.created_at, right.manifest.created_at));
  const latest = manifests[0]!;

  return {
    bundle_id: latest.manifest.bundle_id,
    export_target: latest.manifest.export_target,
    created_at: latest.manifest.created_at,
    bundle_dir: path.relative(root, latest.bundleDir).replace(/\\/g, '/'),
    manifest_path: path.relative(root, latest.manifestPath).replace(/\\/g, '/'),
  };
}

function buildSftSummary(
  records: RunScoreRecord[],
  root: string
): DashboardSftSummary {
  const summary: DashboardSftSummary = {
    total_candidates: 0,
    accepted: 0,
    rejected: 0,
    downgraded: 0,
    by_split: {
      train: 0,
      validation: 0,
      test: 0,
      holdout: 0,
    },
    target_availability: createEmptyTargetAvailability(),
    rejection_reasons: [],
    redaction_status_counts: {
      clean: 0,
      redacted: 0,
      blocked: 0,
    },
    redaction_applied_rules: [],
    redaction_finding_kinds: [],
    redaction_preview: [],
    last_bundle: findLatestBundle(root),
  };

  if (records.length === 0) {
    return summary;
  }

  const { samples } = buildCanonicalCandidatesFromRecordsSync(records, {
    cwd: root,
    minScore: 90,
  });

  summary.total_candidates = samples.length;
  summary.target_availability = buildTargetAvailability(samples);
  summary.rejection_reasons = countRejectionReasons(samples);
  const redactionSummary = buildDatasetRedactionSummary(samples);
  summary.redaction_status_counts = redactionSummary.status_counts;
  summary.redaction_applied_rules = redactionSummary.applied_rules;
  summary.redaction_finding_kinds = redactionSummary.finding_kinds;
  summary.redaction_preview = buildDatasetRedactionPreview(samples).map((item) => ({
    sample_id: item.sample_id,
    status: normalizeRedactionPreviewStatus(item.status),
    applied_rules: item.applied_rules,
    finding_kinds: item.finding_kinds,
    ...(item.rejection_reasons ? { rejection_reasons: item.rejection_reasons } : {}),
  }));

  for (const sample of samples) {
    if (sample.quality.acceptance_decision === 'accepted') summary.accepted += 1;
    if (sample.quality.acceptance_decision === 'rejected') summary.rejected += 1;
    if (sample.quality.acceptance_decision === 'downgraded') summary.downgraded += 1;
    summary.by_split[sample.split.assignment] += 1;
  }

  return summary;
}

export function buildRuntimeDashboardModel(input: {
  root?: string;
  events: RuntimeEvent[];
  scoreRecords: RunScoreRecord[];
  options?: RuntimeDashboardQueryOptions;
}): RuntimeDashboardSnapshot {
  const options = input.options ?? {};
  const scoreRecords = input.scoreRecords.filter((record) => record.scenario !== 'eval_question');
  const projections = buildRuntimeProjections(input.events);
  const selectedProjection = selectRuntimeProjection(projections);
  const selectedScoreRecords = resolveSelectedScoreRecords(scoreRecords, options, selectedProjection);
  const scoreDetailRecords = buildScoreDetailRecords(selectedScoreRecords);
  const scoreFindings = selectedScoreRecords
    .flatMap((record) => buildScoreFindings(record))
    .sort((left, right) => compareTimestamps(left.timestamp, right.timestamp));
  const runtimeContext = selectedProjection
    ? {
        run_id: selectedProjection.run_id,
        status: selectedProjection.status,
        current_stage: selectedProjection.current_stage,
        flow: selectedProjection.current_scope?.flow ?? null,
        scope: selectedProjection.current_scope,
        last_event_at: selectedProjection.last_event_at,
        work_item: null,
      }
    : buildSyntheticRuntimeContext(scoreDetailRecords);

  const selectedRunId =
    selectedProjection?.run_id ??
    (selectedScoreRecords.length > 0
      ? [...new Set(selectedScoreRecords.map((record) => record.run_id))][0] ?? null
      : null);

  const selection: RuntimeDashboardSelection = {
    run_id: selectedRunId,
    source: selectedProjection ? 'runtime' : selectedScoreRecords.length > 0 ? 'scores' : 'none',
    has_runtime: selectedProjection != null,
    has_scores: selectedScoreRecords.length > 0,
  };

  const workboard = buildWorkboard(input.events, projections, selectedScoreRecords, selectedRunId, {
    workItemId: options.workItemId,
    boardGroupId: options.boardGroupId,
  });
  const activeWorkItem = workboard.work_items.find((item) => item.work_item_id === workboard.active_work_item_id) ?? null;

  if (runtimeContext) {
    runtimeContext.work_item = activeWorkItem
      ? {
          work_item_id: activeWorkItem.work_item_id,
          work_item_type: activeWorkItem.work_item_type,
          artifact_scope: activeWorkItem.artifact_scope,
          board_group_id: activeWorkItem.board_group_id,
          board_group_label: activeWorkItem.board_group_label,
          linked_story_key: activeWorkItem.linked_story_key ?? null,
        }
      : null;
  }

  selection.work_item_id = activeWorkItem?.work_item_id ?? null;
  selection.board_group_id = workboard.active_board_group_id;

  return {
    generated_at: new Date().toISOString(),
    selection,
    overview: {
      status: runtimeContext.status,
      health_score:
        selectedScoreRecords.length > 0 ? computeHealthScore(selectedScoreRecords) : null,
      trend: getTrend(scoreRecords),
      veto_count: countVetoTriggeredRecords(selectedScoreRecords),
      dimensions:
        selectedScoreRecords.length > 0
          ? getDimensionScores(selectedScoreRecords)
          : ['功能性', '代码质量', '测试覆盖', '安全性'].map((dimension) => ({
              dimension,
              score: '无数据' as const,
            })),
      weak_top3: getWeakTop3(selectedScoreRecords),
      high_iteration_top3: getHighIterationTop3(selectedScoreRecords),
      score_record_count: selectedScoreRecords.length,
      last_updated_at:
        runtimeContext.last_event_at ??
        (scoreDetailRecords[0]?.timestamp ?? null),
    },
    runtime_context: runtimeContext,
    stage_timeline: buildStageTimeline(selectedProjection, scoreDetailRecords),
    score_detail: {
      run_id: selectedRunId,
      records: scoreDetailRecords,
      findings: scoreFindings,
    },
    sft_summary: buildSftSummary(selectedScoreRecords, input.root ?? options.root ?? process.cwd()),
    workboard,
  };
}

export function queryRuntimeDashboard(
  options: RuntimeDashboardQueryOptions = {}
): RuntimeDashboardSnapshot {
  const explicitRoot = options.root ?? process.cwd();
  const root = inferRuntimeRootFromDataPath(options.dataPath, explicitRoot);
  const events = readRuntimeEvents({ root });
  const scoreRecords = loadAndDedupeRecords(options.dataPath);
  return buildRuntimeDashboardModel({
    root,
    events,
    scoreRecords,
    options: {
      ...options,
      root,
    },
  });
}
