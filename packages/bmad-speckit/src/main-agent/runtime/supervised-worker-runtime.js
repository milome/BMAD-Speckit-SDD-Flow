const fs = require('node:fs');
const path = require('node:path');
const { runtimeModeDir, writeRuntimeBlocker } = require('./host-runtime-mode');

const HEARTBEAT_TIMEOUT_MS = 120_000;

function progressPath(projectRoot, recordId, attemptId) {
  return path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'task-progress.jsonl');
}

function decisionPath(projectRoot, recordId, attemptId) {
  return path.join(runtimeModeDir(projectRoot, recordId, attemptId), 'supervisor-decision.json');
}

function appendTaskProgress(projectRoot, progress) {
  const filePath = progressPath(projectRoot, progress.recordId, progress.attemptId);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(progress)}\n`, 'utf8');
  return filePath;
}

function readTaskProgress(projectRoot, recordId, attemptId) {
  const filePath = progressPath(projectRoot, recordId, attemptId);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function evaluateSupervisedWorker(input) {
  const heartbeatTimeoutMs = HEARTBEAT_TIMEOUT_MS;
  const softProgressWindowMs = input.softProgressWindowMs ?? 300_000;
  const hardBudgetMs = input.hardBudgetMs ?? 3_600_000;
  const progress = readTaskProgress(input.projectRoot, input.recordId, input.attemptId);
  const latest = progress.at(-1) ?? null;
  const now = Date.parse(input.nowIso);
  const started = Date.parse(input.startedAtIso);
  const lastHeartbeat = latest ? Date.parse(latest.heartbeatAt) : NaN;
  const lastProgress = [...progress]
    .reverse()
    .find((item) => item.progressSeq > (input.lastProgressSeq ?? -1));
  let decision = 'running';
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

  const output = {
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

module.exports = {
  appendTaskProgress,
  readTaskProgress,
  evaluateSupervisedWorker,
};
