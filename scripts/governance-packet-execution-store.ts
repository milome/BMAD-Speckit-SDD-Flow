import * as fs from 'node:fs';
import * as path from 'node:path';
import type { GovernanceHostKind, GovernanceRerunGateResult } from './governance-remediation-runner';

export type GovernancePacketExecutionStatus =
  | 'pending_dispatch'
  | 'leased'
  | 'running'
  | 'awaiting_rerun_gate'
  | 'retry_pending'
  | 'gate_passed'
  | 'escalated';

export interface GovernanceExecutionLaunchInfo {
  externalRunId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GovernanceExecutionResultProjection {
  outcome: 'accepted' | 'completed' | 'failed' | 'timeout' | 'cancelled';
  observedAt: string;
  externalRunId?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GovernanceRerunGateScheduleProjection {
  status: 'pending' | 'scheduled' | 'completed' | 'failed';
  scheduledAt?: string | null;
  observedAt?: string | null;
  note?: string | null;
}

export interface GovernancePacketExecutionHistoryEntry {
  at: string;
  kind:
    | 'created'
    | 'dispatch-lease-acquired'
    | 'dispatch-accepted'
    | 'dispatch-rejected'
    | 'dispatch-failed'
    | 'execution-result'
    | 'rerun-gate-result'
    | 'reconciled'
    | 'escalated';
  note?: string | null;
}

export interface GovernancePacketExecutionRecord {
  version: 1;
  executionId: string;
  queueItemId?: string | null;
  loopStateId: string;
  attemptNumber: number;
  rerunGate: string;
  artifactPath?: string | null;
  packetPaths: Partial<Record<GovernanceHostKind, string>>;
  authoritativeHost: GovernanceHostKind;
  fallbackHosts: GovernanceHostKind[];
  status: GovernancePacketExecutionStatus;
  dispatchAttemptCount: number;
  executionAttemptCount: number;
  leaseOwner?: string | null;
  leaseAcquiredAt?: string | null;
  leaseExpiresAt?: string | null;
  lastDispatchError?: string | null;
  lastLaunch?: GovernanceExecutionLaunchInfo | null;
  lastExecutionResult?: GovernanceExecutionResultProjection | null;
  lastRerunGateResult?: GovernanceRerunGateResult | null;
  rerunGateSchedule?: GovernanceRerunGateScheduleProjection | null;
  history: GovernancePacketExecutionHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateGovernancePacketExecutionRecordInput {
  projectRoot: string;
  queueItemId?: string | null;
  loopStateId: string;
  attemptNumber: number;
  rerunGate: string;
  artifactPath?: string | null;
  packetPaths: Partial<Record<GovernanceHostKind, string>>;
  authoritativeHost: GovernanceHostKind;
  fallbackHosts?: GovernanceHostKind[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function sanitizeToken(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

export function governanceExecutionStoreDir(projectRoot: string): string {
  return path.join(projectRoot, '_bmad-output', 'runtime', 'governance', 'executions');
}

export function governanceExecutionLoopDir(projectRoot: string, loopStateId: string): string {
  return path.join(governanceExecutionStoreDir(projectRoot), sanitizeToken(loopStateId));
}

export function governanceExecutionRecordPath(
  projectRoot: string,
  loopStateId: string,
  attemptNumber: number
): string {
  return path.join(
    governanceExecutionLoopDir(projectRoot, loopStateId),
    `${String(attemptNumber).padStart(4, '0')}.json`
  );
}

export function governanceExecutionId(loopStateId: string, attemptNumber: number): string {
  return `gov-exec-${sanitizeToken(loopStateId)}-${String(attemptNumber).padStart(4, '0')}`;
}

export function readGovernancePacketExecutionRecord(
  projectRoot: string,
  loopStateId: string,
  attemptNumber: number
): GovernancePacketExecutionRecord | null {
  const file = governanceExecutionRecordPath(projectRoot, loopStateId, attemptNumber);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GovernancePacketExecutionRecord;
}

export function writeGovernancePacketExecutionRecord(
  projectRoot: string,
  record: GovernancePacketExecutionRecord
): GovernancePacketExecutionRecord {
  const file = governanceExecutionRecordPath(projectRoot, record.loopStateId, record.attemptNumber);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return record;
}

export function createGovernancePacketExecutionRecord(
  input: CreateGovernancePacketExecutionRecordInput
): GovernancePacketExecutionRecord {
  const existing = readGovernancePacketExecutionRecord(
    input.projectRoot,
    input.loopStateId,
    input.attemptNumber
  );
  if (existing) {
    return existing;
  }

  const createdAt = nowIso();
  const record: GovernancePacketExecutionRecord = {
    version: 1,
    executionId: governanceExecutionId(input.loopStateId, input.attemptNumber),
    queueItemId: input.queueItemId ?? null,
    loopStateId: input.loopStateId,
    attemptNumber: input.attemptNumber,
    rerunGate: input.rerunGate,
    artifactPath: input.artifactPath ?? null,
    packetPaths: input.packetPaths,
    authoritativeHost: input.authoritativeHost,
    fallbackHosts: [...new Set(input.fallbackHosts ?? [])].filter(
      (host) => host !== input.authoritativeHost
    ),
    status: 'pending_dispatch',
    dispatchAttemptCount: 0,
    executionAttemptCount: 0,
    leaseOwner: null,
    leaseAcquiredAt: null,
    leaseExpiresAt: null,
    lastDispatchError: null,
    lastLaunch: null,
    lastExecutionResult: null,
    lastRerunGateResult: null,
    rerunGateSchedule: null,
    history: [{ at: createdAt, kind: 'created', note: 'execution record created' }],
    createdAt,
    updatedAt: createdAt,
  };

  return writeGovernancePacketExecutionRecord(input.projectRoot, record);
}

export function listGovernancePacketExecutionRecords(
  projectRoot: string,
  loopStateId?: string
): GovernancePacketExecutionRecord[] {
  const root = governanceExecutionStoreDir(projectRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  const records: GovernancePacketExecutionRecord[] = [];
  for (const loopDir of fs.readdirSync(root)) {
    const fullLoopDir = path.join(root, loopDir);
    if (!fs.statSync(fullLoopDir).isDirectory()) {
      continue;
    }
    for (const file of fs.readdirSync(fullLoopDir)) {
      if (!file.endsWith('.json')) {
        continue;
      }
      records.push(
        JSON.parse(
          fs.readFileSync(path.join(fullLoopDir, file), 'utf8')
        ) as GovernancePacketExecutionRecord
      );
    }
  }

  const filtered =
    typeof loopStateId === 'string' && loopStateId.trim() !== ''
      ? records.filter((record) => record.loopStateId === loopStateId)
      : records;

  return filtered.sort((left, right) => {
    if (left.loopStateId !== right.loopStateId) {
      return left.loopStateId.localeCompare(right.loopStateId);
    }
    return left.attemptNumber - right.attemptNumber;
  });
}

export function updateGovernancePacketExecutionRecord(
  projectRoot: string,
  loopStateId: string,
  attemptNumber: number,
  mutate: (record: GovernancePacketExecutionRecord) => GovernancePacketExecutionRecord
): GovernancePacketExecutionRecord {
  const existing = readGovernancePacketExecutionRecord(projectRoot, loopStateId, attemptNumber);
  if (!existing) {
    throw new Error(
      `Missing governance packet execution record for ${loopStateId}#${attemptNumber}`
    );
  }

  const next = mutate(existing);
  next.updatedAt = nowIso();
  return writeGovernancePacketExecutionRecord(projectRoot, next);
}

export function findLatestActiveGovernancePacketExecutionRecord(
  projectRoot: string,
  loopStateId: string
): GovernancePacketExecutionRecord | null {
  return (
    listGovernancePacketExecutionRecords(projectRoot)
      .filter(
        (record) =>
          record.loopStateId === loopStateId &&
          !['gate_passed', 'escalated'].includes(record.status)
      )
      .sort((left, right) => right.attemptNumber - left.attemptNumber)[0] ?? null
  );
}

export function findGovernancePacketExecutionRecordByExecutionId(
  projectRoot: string,
  executionId: string
): GovernancePacketExecutionRecord | null {
  return (
    listGovernancePacketExecutionRecords(projectRoot).find(
      (record) => record.executionId === executionId
    ) ?? null
  );
}
