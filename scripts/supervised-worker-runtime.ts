import * as fs from 'node:fs';
import * as path from 'node:path';
import { LONG_RUN_RUNTIME_POLICY } from './long-run-runtime-policy';
import { runtimeModeDir, writeRuntimeBlocker } from './host-runtime-mode';

export interface TaskProgress {
  packetId: string;
  attemptId: string;
  recordId: string;
  status: 'running' | 'progressing' | 'stale_recovery' | 'resumed';
  heartbeatAt: string;
  progressSeq: number;
  currentStep?: string;
  filesTouched?: string[];
  evidenceRefs?: string[];
  blockerSignals?: string[];
}

export interface SupervisorDecision {
  schemaVersion: 'supervisor-decision/v1';
  attemptId: string;
  recordId: string;
  packetId: string;
  lastHeartbeatAt: string | null;
  heartbeatTimeoutMs: number;
  softProgressWindowMs: number;
  hardBudgetMs: number;
  decision: 'running' | 'progressing' | 'stale_recovery' | 'resumed' | 'blocked';
  reasonCode: string;
  terminatedProcess: boolean;
  nextRequiredAction: string;
}

function progressPath(projectRoot: string, recordId: string, attemptId: string): string {
  return path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'task-progress.jsonl');
}

function decisionPath(projectRoot: string, recordId: string, attemptId: string): string {
  return path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'supervisor-decision.json');
}

export function appendTaskProgress(projectRoot: string, progress: TaskProgress): string {
  const filePath = progressPath(projectRoot, progress.recordId, progress.attemptId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(progress)}\n`, 'utf8');
  return filePath;
}

export function readTaskProgress(projectRoot: string, recordId: string, attemptId: string): TaskProgress[] {
  const filePath = progressPath(projectRoot, recordId, attemptId);
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TaskProgress);
}

export function evaluateSupervisedWorker(input: {
  projectRoot: string;
  recordId: string;
  packetId: string;
  attemptId: string;
  nowIso: string;
  startedAtIso: string;
  lastProgressSeq?: number;
  hardBudgetMs?: number;
  softProgressWindowMs?: number;
  recoveryFailed?: boolean;
}): SupervisorDecision {
  const heartbeatTimeoutMs = LONG_RUN_RUNTIME_POLICY.heartbeat_timeout_ms;
  const softProgressWindowMs = input.softProgressWindowMs ?? 300_000;
  const hardBudgetMs = input.hardBudgetMs ?? 3_600_000;
  const progress = readTaskProgress(input.projectRoot, input.recordId, input.attemptId);
  const latest = progress.at(-1) ?? null;
  const now = Date.parse(input.nowIso);
  const started = Date.parse(input.startedAtIso);
  const lastHeartbeat = latest ? Date.parse(latest.heartbeatAt) : NaN;
  const lastProgress = [...progress].reverse().find((item) => item.progressSeq > (input.lastProgressSeq ?? -1));
  let decision: SupervisorDecision['decision'] = 'running';
  let reasonCode = 'heartbeat_within_timeout';
  let terminatedProcess = false;
  let nextRequiredAction = 'continue_supervision';

  if (now - started > hardBudgetMs) {
    decision = 'blocked';
    reasonCode = 'hard_budget_exhausted';
    terminatedProcess = true;
    nextRequiredAction = 'block_attempt';
  } else if (input.recoveryFailed) {
    decision = 'blocked';
    reasonCode = 'stale_recovery_failed';
    terminatedProcess = true;
    nextRequiredAction = 'write_runtime_blocker';
  } else if (!latest || Number.isNaN(lastHeartbeat) || now - lastHeartbeat > heartbeatTimeoutMs) {
    decision = 'stale_recovery';
    reasonCode = 'heartbeat_timeout';
    nextRequiredAction = 'attempt_stale_recovery';
  } else if (lastProgress && now - Date.parse(lastProgress.heartbeatAt) <= softProgressWindowMs) {
    decision = latest.status === 'resumed' ? 'resumed' : 'progressing';
    reasonCode = 'progress_observed';
  } else if (now - lastHeartbeat <= heartbeatTimeoutMs) {
    decision = 'running';
    reasonCode = 'heartbeat_alive_no_completion';
  }

  const output: SupervisorDecision = {
    schemaVersion: 'supervisor-decision/v1',
    attemptId: input.attemptId,
    recordId: input.recordId,
    packetId: input.packetId,
    lastHeartbeatAt: latest?.heartbeatAt ?? null,
    heartbeatTimeoutMs,
    softProgressWindowMs,
    hardBudgetMs,
    decision,
    reasonCode,
    terminatedProcess,
    nextRequiredAction,
  };
  const filePath = decisionPath(input.projectRoot, input.recordId, input.attemptId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  if (decision === 'blocked') {
    writeRuntimeBlocker(input.projectRoot, input.recordId, input.attemptId, {
      schemaVersion: 'runtime-blocker/v1',
      reasonCode,
      host: 'supervised-worker',
      executionRuntimeMode: 'main_session_direct',
      attemptId: input.attemptId,
      packetId: input.packetId,
      goalExecutionHash: null,
      receiptHash: 'not_applicable',
      exitCode: 'not_available',
      blockedActions: ['sixModelResults', 'nextAction', 'record_closed'],
      recordHash: input.recordId,
      reasonDetails: { terminatedProcess },
    });
  }
  return output;
}
