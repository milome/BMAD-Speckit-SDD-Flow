import { readGovernanceRemediationConfig } from './governance-remediation-config';
import {
  listGovernancePacketExecutionRecords,
  type GovernancePacketExecutionRecord,
  type GovernanceExecutionLaunchInfo,
  updateGovernancePacketExecutionRecord,
} from './governance-packet-execution-store';
import { createGovernanceHostDispatchAdapter } from './governance-host-dispatch-adapter';

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
  launchEnv?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
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
  outcome: GovernancePacketDispatchOutcome,
  metadata: Record<string, unknown> = {}
): GovernanceExecutionLaunchInfo {
  return {
    externalRunId: 'externalRunId' in outcome ? (outcome.externalRunId ?? null) : null,
    note: 'reason' in outcome ? (outcome.reason ?? null) : null,
    metadata: {
      ...(('metadata' in outcome && outcome.metadata && typeof outcome.metadata === 'object')
        ? outcome.metadata
        : {}),
      ...metadata,
    },
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
  const adapter =
    options.adapter ??
    createGovernanceHostDispatchAdapter({
      env: options.launchEnv,
      startupTimeoutMs: options.startupTimeoutMs,
    });
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
    const observedAt = nowIso(now);
    const maxDispatchAttempts =
      options.maxDispatchAttempts ?? config.execution?.escalation.afterDispatchFailures ?? 3;
    const hostCandidates = [leased.authoritativeHost, ...leased.fallbackHosts];
    let dispatchAttemptCount = leased.dispatchAttemptCount;
    const history = [...leased.history];
    let lastDispatchError: string | null = leased.lastDispatchError ?? null;
    let lastLaunch = leased.lastLaunch ?? null;
    let acceptedRecord: GovernancePacketExecutionRecord | null = null;

    for (const hostKind of hostCandidates) {
      const packetPath = leased.packetPaths[hostKind];
      dispatchAttemptCount += 1;

      if (!packetPath) {
        lastDispatchError = `missing packet for host ${hostKind}`;
        history.push({
          at: observedAt,
          kind: 'dispatch-failed',
          note: lastDispatchError,
        });
        if (dispatchAttemptCount >= maxDispatchAttempts) {
          break;
        }
        continue;
      }

      const outcome = await adapter.launch({
        executionId: leased.executionId,
        authoritativeHost: hostKind,
        packetPath,
        leaseOwner,
        timeoutMs:
          (options.timeoutMinutes ?? config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000,
        projectRoot,
      });

      lastLaunch = buildLaunchInfo(outcome, {
        configuredAuthoritativeHost: leased.authoritativeHost,
        dispatchedHost: hostKind,
        fallbackUsed: hostKind !== leased.authoritativeHost,
        packetPath,
      });

      if (outcome.kind === 'accepted') {
        history.push({
          at: observedAt,
          kind: 'dispatch-accepted',
          note:
            hostKind === leased.authoritativeHost
              ? outcome.reason ?? `accepted by ${hostKind}`
              : `fallback ${hostKind} accepted${outcome.reason ? `: ${outcome.reason}` : ''}`,
        });
        acceptedRecord = updateGovernancePacketExecutionRecord(
          projectRoot,
          leased.loopStateId,
          leased.attemptNumber,
          (current) => ({
            ...current,
            status: 'running',
            dispatchAttemptCount,
            lastDispatchError: null,
            lastLaunch,
            history,
          })
        );
        break;
      }

      lastDispatchError = outcome.reason;
      history.push({
        at: observedAt,
        kind: outcome.kind === 'rejected' ? 'dispatch-rejected' : 'dispatch-failed',
        note:
          hostKind === leased.authoritativeHost
            ? `${hostKind}: ${outcome.reason}`
            : `fallback ${hostKind}: ${outcome.reason}`,
      });

      if (dispatchAttemptCount >= maxDispatchAttempts) {
        break;
      }
    }

    if (acceptedRecord) {
      updated.push(acceptedRecord);
      continue;
    }

    const shouldEscalate = dispatchAttemptCount >= maxDispatchAttempts;
    updated.push(
      updateGovernancePacketExecutionRecord(
        projectRoot,
        leased.loopStateId,
        leased.attemptNumber,
        (current) => ({
          ...current,
          status: shouldEscalate ? 'escalated' : 'retry_pending',
          dispatchAttemptCount,
          leaseOwner: null,
          leaseAcquiredAt: null,
          leaseExpiresAt: null,
          lastDispatchError,
          lastLaunch,
          history: [
            ...history,
            ...(
              shouldEscalate
                ? [
                    {
                      at: observedAt,
                      kind: 'escalated' as const,
                      note: `dispatch failures reached ${maxDispatchAttempts}`,
                    },
                  ]
                : []
            ),
          ],
        })
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
