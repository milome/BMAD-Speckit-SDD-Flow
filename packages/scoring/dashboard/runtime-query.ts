import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildCanonicalCandidatesFromRecordsSync } from '../analytics/candidate-builder';
import {
  assessSampleForTarget,
  buildDatasetRedactionPreview,
  buildDatasetRedactionSummary,
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

export interface RuntimeDashboardQueryOptions {
  root?: string;
  dataPath?: string;
  strategy?: 'epic_story_window' | 'run_id';
  epic?: number;
  story?: number;
  windowHours?: number;
}

export interface RuntimeDashboardSelection {
  run_id: string | null;
  source: SelectionSource;
  has_runtime: boolean;
  has_scores: boolean;
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
}

export interface DashboardScoreDetailPayload {
  run_id: string | null;
  records: DashboardScoreDetailRecord[];
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
    run_id: string;
    split: string;
    status: 'clean' | 'redacted' | 'blocked';
    applied_rules: string[];
    finding_kinds: string[];
    rejection_reasons: string[];
  }>;
  last_bundle: {
    bundle_id: string;
    export_target: DatasetExportTarget;
    created_at: string;
    bundle_dir: string;
    manifest_path: string;
  } | null;
}

export interface RuntimeDashboardSnapshot {
  generated_at: string;
  selection: RuntimeDashboardSelection;
  overview: DashboardOverviewPanel;
  runtime_context: DashboardRuntimeContextPanel;
  stage_timeline: DashboardStageTimelineEntry[];
  score_detail: DashboardScoreDetailPayload;
  sft_summary: DashboardSftSummary;
}

type ScoreRecordWithDerived = RunScoreRecord & {
  veto_triggered?: boolean;
  tier_coefficient?: number;
  raw_phase_score?: number;
};

function compareTimestamps(left?: string | null, right?: string | null): number {
  const leftValue = left ? new Date(left).getTime() : 0;
  const rightValue = right ? new Date(right).getTime() : 0;
  return rightValue - leftValue;
}

function compareTimestampsAsc(left?: string | null, right?: string | null): number {
  return compareTimestamps(right, left);
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
  summary.redaction_preview = buildDatasetRedactionPreview(samples);

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
  const runtimeContext = selectedProjection
    ? {
        run_id: selectedProjection.run_id,
        status: selectedProjection.status,
        current_stage: selectedProjection.current_stage,
        flow: selectedProjection.current_scope?.flow ?? null,
        scope: selectedProjection.current_scope,
        last_event_at: selectedProjection.last_event_at,
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
    },
    sft_summary: buildSftSummary(selectedScoreRecords, input.root ?? options.root ?? process.cwd()),
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
