import { readGovernanceRemediationConfig } from './governance-remediation-config';
import {
  listGovernancePacketExecutionRecords,
  type GovernancePacketExecutionRecord,
  type GovernanceExecutionLaunchInfo,
  updateGovernancePacketExecutionRecord,
} from './governance-packet-execution-store';

export interface GovernancePacketDispatchAccepted {
  kind: 'accepted';
  externalRunId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface GovernancePacketDispatchRejected {
  kind: 'rejected';
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface GovernancePacketDispatchFailed {
  kind: 'failed';
  reason: string;
  metadata?: Record<string, unknown>;
}

export type GovernancePacketDispatchOutcome =
  | GovernancePacketDispatchAccepted
  | GovernancePacketDispatchRejected
  | GovernancePacketDispatchFailed;

export interface GovernancePacketDispatchAdapter {
  launch(input: {
    executionId: string;
    authoritativeHost: GovernancePacketExecutionRecord['authoritativeHost'];
    packetPath: string;
    leaseOwner: string;
    timeoutMs: number;
    projectRoot: string;
  }): Promise<GovernancePacketDispatchOutcome>;
}

export interface GovernancePacketDispatchWorkerOptions {
  adapter?: GovernancePacketDispatchAdapter;
  leaseOwner?: string;
  now?: Date;
  leaseTimeoutSeconds?: number;
  timeoutMinutes?: number;
  maxDispatchAttempts?: number;
}

export class StubGovernanceExecutionAdapter implements GovernancePacketDispatchAdapter {
  constructor(private readonly outcome: GovernancePacketDispatchOutcome) {}

  async launch(): Promise<GovernancePacketDispatchOutcome> {
    return this.outcome;
  }
}

function nowIso(input?: Date): string {
  return (input ?? new Date()).toISOString();
}

function addSeconds(input: Date, seconds: number): string {
  return new Date(input.getTime() + seconds * 1000).toISOString();
}

function isLeaseActive(record: GovernancePacketExecutionRecord, now: Date): boolean {
  if (!record.leaseOwner || !record.leaseExpiresAt) {
    return false;
  }
  const expiresAt = Date.parse(record.leaseExpiresAt);
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

function buildLaunchInfo(
  outcome: GovernancePacketDispatchOutcome
): GovernanceExecutionLaunchInfo {
  return {
    externalRunId: 'externalRunId' in outcome ? (outcome.externalRunId ?? null) : null,
    note: 'reason' in outcome ? (outcome.reason ?? null) : null,
    metadata: 'metadata' in outcome ? (outcome.metadata ?? null) : null,
  };
}

export function createAcceptedPlaceholderDispatchAdapter(
  reason = 'execution accepted into placeholder dispatch lane'
): GovernancePacketDispatchAdapter {
  return {
    async launch(input) {
      return {
        kind: 'accepted',
        reason,
        externalRunId: `placeholder-${input.executionId}`,
      };
    },
  };
}

export async function processPendingExecutionRecords(
  projectRoot: string,
  options: GovernancePacketDispatchWorkerOptions = {}
): Promise<GovernancePacketExecutionRecord[]> {
  const config = readGovernanceRemediationConfig(projectRoot);
  const adapter = options.adapter ?? createAcceptedPlaceholderDispatchAdapter();
  const now = options.now ?? new Date();
  const leaseOwner = options.leaseOwner ?? `dispatch-worker-${process.pid}`;
  const records = listGovernancePacketExecutionRecords(projectRoot).filter((record) =>
    ['pending_dispatch', 'retry_pending', 'leased'].includes(record.status)
  );
  const updated: GovernancePacketExecutionRecord[] = [];

  for (const record of records) {
    if (record.status === 'leased' && isLeaseActive(record, now)) {
      continue;
    }

    const packetPath = record.packetPaths[record.authoritativeHost];
    if (!packetPath) {
      updated.push(
        updateGovernancePacketExecutionRecord(
          projectRoot,
          record.loopStateId,
          record.attemptNumber,
          (current) => ({
            ...current,
            status: 'escalated',
            leaseOwner: null,
            leaseAcquiredAt: null,
            leaseExpiresAt: null,
            lastDispatchError: `missing packet for authoritative host ${current.authoritativeHost}`,
            history: [
              ...current.history,
              {
                at: nowIso(now),
                kind: 'escalated',
                note: `missing packet for authoritative host ${current.authoritativeHost}`,
              },
            ],
          })
        )
      );
      continue;
    }

    const leased = updateGovernancePacketExecutionRecord(
      projectRoot,
      record.loopStateId,
      record.attemptNumber,
      (current) => ({
        ...current,
        status: 'leased',
        leaseOwner,
        leaseAcquiredAt: nowIso(now),
        leaseExpiresAt: addSeconds(
          now,
          options.leaseTimeoutSeconds ?? config.execution?.dispatch.leaseTimeoutSeconds ?? 900
        ),
        history: [
          ...current.history,
          { at: nowIso(now), kind: 'dispatch-lease-acquired', note: leaseOwner },
        ],
      })
    );

    const outcome = await adapter.launch({
      executionId: leased.executionId,
      authoritativeHost: leased.authoritativeHost,
      packetPath,
      leaseOwner,
      timeoutMs:
        (options.timeoutMinutes ?? config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000,
      projectRoot,
    });
    const observedAt = nowIso(now);
    const nextDispatchAttemptCount = leased.dispatchAttemptCount + 1;
    const maxDispatchAttempts =
      options.maxDispatchAttempts ?? config.execution?.escalation.afterDispatchFailures ?? 3;

    updated.push(
      updateGovernancePacketExecutionRecord(
        projectRoot,
        leased.loopStateId,
        leased.attemptNumber,
        (current) => {
          if (outcome.kind === 'accepted') {
            return {
              ...current,
              status: 'running',
              dispatchAttemptCount: nextDispatchAttemptCount,
              lastDispatchError: null,
              lastLaunch: buildLaunchInfo(outcome),
              history: [
                ...current.history,
                { at: observedAt, kind: 'dispatch-accepted', note: outcome.reason ?? null },
              ],
            };
          }

          const shouldEscalate = nextDispatchAttemptCount >= maxDispatchAttempts;
          return {
            ...current,
            status: shouldEscalate ? 'escalated' : 'retry_pending',
            dispatchAttemptCount: nextDispatchAttemptCount,
            leaseOwner: null,
            leaseAcquiredAt: null,
            leaseExpiresAt: null,
            lastDispatchError: outcome.reason,
            lastLaunch: buildLaunchInfo(outcome),
            history: [
              ...current.history,
              {
                at: observedAt,
                kind: outcome.kind === 'rejected' ? 'dispatch-rejected' : 'dispatch-failed',
                note: outcome.reason,
              },
            ],
          };
        }
      )
    );
  }

  return updated;
}

function main(): void {
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
    return;
  }
  if (require.main !== module) {
    return;
  }
  const projectRoot = process.argv[2] || process.cwd();
  void processPendingExecutionRecords(projectRoot)
    .then((records) => {
      process.stdout.write(JSON.stringify(records, null, 2));
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}

main();
