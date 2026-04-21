import type {
  JourneyContractSignals,
  ReadinessDriftSeverity,
  ReadinessEffectiveVerdict,
  RunScoreRecord,
} from '../writer/types';

export interface ReadinessDriftEvaluation {
  readiness_baseline_run_id: string | null;
  drift_signals: string[];
  drifted_dimensions: string[];
  drift_severity: ReadinessDriftSeverity;
  re_readiness_required: boolean;
  blocking_reason: string | null;
  effective_verdict: ReadinessEffectiveVerdict;
}

export interface ReadinessDriftProjection extends ReadinessDriftEvaluation {
  readiness_score: number | null;
  readiness_raw_score: number | null;
  readiness_dimensions: Record<string, number> | null;
}

const DRIFT_SIGNAL_DIMENSION_MAP: Record<keyof JourneyContractSignals, string[]> = {
  smoke_task_chain: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
  closure_task_id: ['Evidence Proof Chain', 'Cross-Document Traceability'],
  journey_unlock: ['P0 Journey Coverage'],
  gap_split_contract: ['Cross-Document Traceability'],
  shared_path_reference: ['Evidence Proof Chain'],
};

const CRITICAL_SIGNALS = new Set<keyof JourneyContractSignals>([
  'smoke_task_chain',
  'closure_task_id',
]);

const MAJOR_SIGNALS = new Set<keyof JourneyContractSignals>([
  'journey_unlock',
  'gap_split_contract',
  'shared_path_reference',
]);

export function extractTriggeredJourneySignals(
  signals?: JourneyContractSignals | null
): Array<keyof JourneyContractSignals> {
  if (!signals) return [];
  return (Object.keys(DRIFT_SIGNAL_DIMENSION_MAP) as Array<keyof JourneyContractSignals>).filter(
    (key) => signals[key] === true
  );
}

export function deriveReadinessDriftSeverity(
  signalIds: Array<keyof JourneyContractSignals>
): ReadinessDriftSeverity {
  if (signalIds.some((signal) => CRITICAL_SIGNALS.has(signal))) {
    return 'critical';
  }
  if (signalIds.some((signal) => MAJOR_SIGNALS.has(signal))) {
    return 'major';
  }
  return 'none';
}

export function deriveReadinessDriftedDimensions(
  signalIds: Array<keyof JourneyContractSignals>
): string[] {
  return [...new Set(signalIds.flatMap((signal) => DRIFT_SIGNAL_DIMENSION_MAP[signal] ?? []))];
}

export function findLatestImplementationReadinessBaseline(
  records: RunScoreRecord[]
): RunScoreRecord | null {
  const readiness = records
    .filter((record) => record.scenario === 'real_dev' && record.stage === 'implementation_readiness')
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime());
  return readiness[0] ?? null;
}

export function evaluateReadinessDrift(input: {
  stage: string;
  signals?: JourneyContractSignals | null;
  signalBlockPresent?: boolean;
  allRecords: RunScoreRecord[];
}): ReadinessDriftEvaluation {
  const signalIds = extractTriggeredJourneySignals(input.signals);
  const driftSignals = signalIds.map((signal) => String(signal));
  const driftedDimensions = deriveReadinessDriftedDimensions(signalIds);
  const driftSeverity = deriveReadinessDriftSeverity(signalIds);
  const baseline = findLatestImplementationReadinessBaseline(input.allRecords);
  const baselineRunId = baseline?.run_id ?? null;

  if (input.stage !== 'implement' && input.stage !== 'tasks' && input.stage !== 'post_impl') {
    return {
      readiness_baseline_run_id: baselineRunId,
      drift_signals: driftSignals,
      drifted_dimensions: driftedDimensions,
      drift_severity: 'none',
      re_readiness_required: false,
      blocking_reason: null,
      effective_verdict: 'unknown',
    };
  }

  if (
    (input.stage === 'implement' || input.stage === 'post_impl') &&
    input.signalBlockPresent === false
  ) {
    return {
      readiness_baseline_run_id: baselineRunId,
      drift_signals: [],
      drifted_dimensions: [],
      drift_severity: 'major',
      re_readiness_required: true,
      blocking_reason:
        'Missing structured drift signal block for implementation verdict; re-readiness evidence is required.',
      effective_verdict: 'blocked_pending_rereadiness',
    };
  }

  if (baselineRunId == null) {
    return {
      readiness_baseline_run_id: null,
      drift_signals: driftSignals,
      drifted_dimensions: driftedDimensions,
      drift_severity: signalIds.length > 0 ? driftSeverity : 'major',
      re_readiness_required: true,
      blocking_reason: 'Missing implementation readiness baseline for implementation verdict.',
      effective_verdict: 'blocked_pending_rereadiness',
    };
  }

  if (driftSeverity === 'critical') {
    return {
      readiness_baseline_run_id: baselineRunId,
      drift_signals: driftSignals,
      drifted_dimensions: driftedDimensions,
      drift_severity: 'critical',
      re_readiness_required: true,
      blocking_reason: 'Critical readiness drift detected against the current implementation baseline.',
      effective_verdict: 'blocked',
    };
  }

  if (driftSeverity === 'major') {
    return {
      readiness_baseline_run_id: baselineRunId,
      drift_signals: driftSignals,
      drifted_dimensions: driftedDimensions,
      drift_severity: 'major',
      re_readiness_required: true,
      blocking_reason: 'Major readiness drift detected; implementation cannot be approved until re-readiness.',
      effective_verdict: 'required_fixes',
    };
  }

  return {
    readiness_baseline_run_id: baselineRunId,
    drift_signals: [],
    drifted_dimensions: [],
    drift_severity: 'none',
    re_readiness_required: false,
    blocking_reason: null,
    effective_verdict: 'approved',
  };
}

export function buildReadinessDriftProjection(input: {
  currentRecord?: RunScoreRecord | null;
  allRecords: RunScoreRecord[];
}): ReadinessDriftProjection {
  const baseline = findLatestImplementationReadinessBaseline(input.allRecords);
  const currentRecord =
    input.currentRecord ??
    input.allRecords
      .filter(
        (record) =>
          record.stage === 'implement' || record.stage === 'tasks' || record.stage === 'post_impl'
      )
      .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())[0] ??
    null;

  if (
    currentRecord &&
    (currentRecord.effective_verdict ||
      currentRecord.drift_severity ||
      currentRecord.drift_signals ||
      currentRecord.drifted_dimensions ||
      currentRecord.blocking_reason ||
      currentRecord.re_readiness_required)
  ) {
    return {
      readiness_baseline_run_id:
        currentRecord.readiness_baseline_run_id ?? baseline?.run_id ?? null,
      readiness_score: baseline?.phase_score ?? null,
      readiness_raw_score:
        (baseline as RunScoreRecord & { raw_phase_score?: number } | null)?.raw_phase_score ??
        baseline?.phase_score ??
        null,
      readiness_dimensions:
        baseline?.dimension_scores && baseline.dimension_scores.length > 0
          ? Object.fromEntries(baseline.dimension_scores.map((entry) => [entry.dimension, entry.score]))
          : null,
      drift_signals: currentRecord.drift_signals ?? [],
      drifted_dimensions: currentRecord.drifted_dimensions ?? [],
      drift_severity: currentRecord.drift_severity ?? 'none',
      re_readiness_required: currentRecord.re_readiness_required ?? false,
      blocking_reason: currentRecord.blocking_reason ?? null,
      effective_verdict: currentRecord.effective_verdict ?? 'unknown',
    };
  }

  const evaluation = evaluateReadinessDrift({
    stage: currentRecord?.stage ?? 'unknown',
    signals: currentRecord?.journey_contract_signals,
    allRecords: input.allRecords,
  });

  return {
    ...evaluation,
    readiness_score: baseline?.phase_score ?? null,
    readiness_raw_score:
      (baseline as RunScoreRecord & { raw_phase_score?: number } | null)?.raw_phase_score ??
      baseline?.phase_score ??
      null,
    readiness_dimensions:
      baseline?.dimension_scores && baseline.dimension_scores.length > 0
        ? Object.fromEntries(baseline.dimension_scores.map((entry) => [entry.dimension, entry.score]))
        : null,
  };
}
