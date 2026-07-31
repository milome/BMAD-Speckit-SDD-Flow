import { sha256Stable } from './requirements-contract-semantic-resolver';

export interface RequirementsJudgeClockAnchor {
  schemaVersion: 'requirements-contract-judge-clock-anchor/v1';
  attemptKeyHash: string;
  wallClockStartedAt: string;
  monotonicStartedMs: number;
  committedReceiptHash: string;
  anchorHash: string;
}

export interface RequirementsJudgeClockProgress {
  schemaVersion: 'requirements-contract-judge-clock-progress/v1';
  elapsedMonotonicMs: number;
  elapsedWallClockMs: number;
  issueCodes: string[];
  decision: 'continue' | 'block';
  progressHash: string;
}

const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/u;

function requireHash(value: unknown, code: string): string {
  if (typeof value !== 'string' || !HASH_PATTERN.test(value)) throw new Error(code);
  return value;
}

function timestampMs(value: string): number {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new Error('requirements_judge_clock_timestamp_invalid');
  return ms;
}

function anchorPayload(anchor: Omit<RequirementsJudgeClockAnchor, 'anchorHash'>) {
  return {
    schemaVersion: anchor.schemaVersion,
    attemptKeyHash: anchor.attemptKeyHash,
    wallClockStartedAt: anchor.wallClockStartedAt,
    monotonicStartedMs: anchor.monotonicStartedMs,
    committedReceiptHash: anchor.committedReceiptHash,
  };
}

export function createRequirementsJudgeClockAnchor(input: {
  attemptKeyHash: string;
  wallClockStartedAt: string;
  monotonicStartedMs: number;
  committedReceiptHash: string;
}): RequirementsJudgeClockAnchor {
  if (!Number.isFinite(input.monotonicStartedMs) || input.monotonicStartedMs < 0) {
    throw new Error('requirements_judge_clock_monotonic_invalid');
  }
  timestampMs(input.wallClockStartedAt);
  const payload = {
    schemaVersion: 'requirements-contract-judge-clock-anchor/v1' as const,
    attemptKeyHash: requireHash(input.attemptKeyHash, 'requirements_judge_clock_attempt_invalid'),
    wallClockStartedAt: input.wallClockStartedAt,
    monotonicStartedMs: input.monotonicStartedMs,
    committedReceiptHash: requireHash(
      input.committedReceiptHash,
      'requirements_judge_clock_receipt_invalid'
    ),
  };
  return { ...payload, anchorHash: sha256Stable(payload) };
}

export function restoreRequirementsJudgeClockAnchor(
  anchor: RequirementsJudgeClockAnchor
): RequirementsJudgeClockAnchor {
  const expected = sha256Stable(anchorPayload(anchor));
  if (anchor.anchorHash !== expected)
    throw new Error('requirements_judge_clock_anchor_hash_mismatch');
  return anchor;
}

export function evaluateRequirementsJudgeClockProgress(
  anchorInput: RequirementsJudgeClockAnchor,
  input: {
    monotonicNowMs: number;
    wallClockNow: string;
    noProgressThresholdMs: number;
  }
): RequirementsJudgeClockProgress {
  const anchor = restoreRequirementsJudgeClockAnchor(anchorInput);
  if (!Number.isFinite(input.monotonicNowMs) || input.monotonicNowMs < anchor.monotonicStartedMs) {
    throw new Error('requirements_judge_clock_restart_fault');
  }
  const elapsedMonotonicMs = input.monotonicNowMs - anchor.monotonicStartedMs;
  const elapsedWallClockMs =
    timestampMs(input.wallClockNow) - timestampMs(anchor.wallClockStartedAt);
  if (elapsedWallClockMs < 0) throw new Error('requirements_judge_clock_wall_clock_fault');
  const issueCodes =
    elapsedMonotonicMs >= input.noProgressThresholdMs ? ['elapsed_no_progress_threshold'] : [];
  const payload = {
    schemaVersion: 'requirements-contract-judge-clock-progress/v1' as const,
    elapsedMonotonicMs,
    elapsedWallClockMs,
    issueCodes,
    decision: issueCodes.length === 0 ? ('continue' as const) : ('block' as const),
  };
  return { ...payload, progressHash: sha256Stable(payload) };
}
