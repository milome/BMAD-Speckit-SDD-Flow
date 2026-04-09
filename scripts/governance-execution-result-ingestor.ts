import { readGovernanceRemediationConfig } from './governance-remediation-config';
import {
  findLatestActiveGovernancePacketExecutionRecord,
  type GovernanceExecutionResultProjection,
  type GovernancePacketExecutionRecord,
  updateGovernancePacketExecutionRecord,
} from './governance-packet-execution-store';
import type { GovernanceRerunGateResult } from './governance-remediation-runner';

export interface GovernanceExecutionResultIngestInput {
  loopStateId: string;
  attemptNumber: number;
  result: GovernanceExecutionResultProjection;
}

export interface GovernanceRerunGateResultIngestInput {
  loopStateId: string;
  attemptNumber?: number;
  rerunGateResult: GovernanceRerunGateResult;
}

type GovernanceExecutionResultIngestPayload = GovernanceExecutionResultIngestInput & {
  projectRoot: string;
};

type GovernanceRerunGateResultIngestPayload = GovernanceRerunGateResultIngestInput & {
  projectRoot: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function countHistoryEntries(
  record: GovernancePacketExecutionRecord,
  kind: GovernancePacketExecutionRecord['history'][number]['kind']
): number {
  return record.history.filter((entry) => entry.kind === kind).length;
}

export function ingestGovernanceExecutionResult(
  projectRootOrInput: string | GovernanceExecutionResultIngestPayload,
  maybeInput?: GovernanceExecutionResultIngestInput
): GovernancePacketExecutionRecord {
  const projectRoot =
    typeof projectRootOrInput === 'string'
      ? projectRootOrInput
      : projectRootOrInput.projectRoot;
  const input =
    typeof projectRootOrInput === 'string' ? (maybeInput as GovernanceExecutionResultIngestInput) : projectRootOrInput;
  const config = readGovernanceRemediationConfig(projectRoot);
  const maxFailures = config.execution?.escalation.afterExecutionFailures ?? 2;

  return updateGovernancePacketExecutionRecord(
    projectRoot,
    input.loopStateId,
    input.attemptNumber,
    (record) => {
      if (record.status !== 'running') {
        return record;
      }

      const isSuccess = input.result.outcome === 'completed';
      const failureCount = countHistoryEntries(record, 'execution-result') + (isSuccess ? 0 : 1);
      return {
        ...record,
        status: isSuccess
          ? 'awaiting_rerun_gate'
          : failureCount >= maxFailures
            ? 'escalated'
            : 'retry_pending',
        leaseOwner: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        executionAttemptCount: record.executionAttemptCount + 1,
        lastExecutionResult: input.result,
        rerunGateSchedule: isSuccess
          ? {
              status: config.execution?.rerunGate.autoSchedule ? 'scheduled' : 'pending',
              scheduledAt: config.execution?.rerunGate.autoSchedule ? nowIso() : null,
              observedAt: null,
              note: config.execution?.rerunGate.autoSchedule
                ? 'rerun gate scheduled after successful execution result ingestion'
                : 'rerun gate awaiting external scheduling',
            }
          : record.rerunGateSchedule,
        history: [
          ...record.history,
          {
            at: input.result.observedAt,
            kind: 'execution-result',
            note: `${input.result.outcome}${input.result.error ? `: ${input.result.error}` : ''}`,
          },
          ...(failureCount >= maxFailures && !isSuccess
            ? [
                {
                  at: input.result.observedAt,
                  kind: 'escalated' as const,
                  note: `execution failures reached ${maxFailures}`,
                },
              ]
            : []),
        ],
      };
    }
  );
}

export function ingestGovernanceRerunGateResult(
  projectRootOrInput: string | GovernanceRerunGateResultIngestPayload,
  maybeInput?: GovernanceRerunGateResultIngestInput
): GovernancePacketExecutionRecord | null {
  const projectRoot =
    typeof projectRootOrInput === 'string'
      ? projectRootOrInput
      : projectRootOrInput.projectRoot;
  const input =
    typeof projectRootOrInput === 'string' ? (maybeInput as GovernanceRerunGateResultIngestInput) : projectRootOrInput;
  const config = readGovernanceRemediationConfig(projectRoot);
  const target =
    typeof input.attemptNumber === 'number'
      ? { loopStateId: input.loopStateId, attemptNumber: input.attemptNumber }
      : findLatestActiveGovernancePacketExecutionRecord(projectRoot, input.loopStateId);
  if (!target) {
    return null;
  }

  const attemptNumber =
    'attemptNumber' in target ? target.attemptNumber : (target as GovernancePacketExecutionRecord).attemptNumber;
  const maxGateFailures = config.execution?.escalation.afterGateFailures ?? 2;

  return updateGovernancePacketExecutionRecord(
    projectRoot,
    input.loopStateId,
    attemptNumber,
    (record) => {
      if (!['awaiting_rerun_gate', 'retry_pending', 'pending_dispatch', 'running'].includes(record.status)) {
        return record;
      }

      const isPass = input.rerunGateResult.status === 'pass';
      const failureCount =
        countHistoryEntries(record, 'rerun-gate-result') + (isPass ? 0 : 1);

      return {
        ...record,
        status: isPass ? 'gate_passed' : failureCount >= maxGateFailures ? 'escalated' : 'retry_pending',
        leaseOwner: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        lastRerunGateResult: input.rerunGateResult,
        rerunGateSchedule: {
          ...(record.rerunGateSchedule ?? {
            status: 'pending' as const,
            scheduledAt: null,
            observedAt: null,
            note: null,
          }),
          status: isPass ? 'completed' : 'failed',
          observedAt: input.rerunGateResult.observedAt ?? nowIso(),
          note: input.rerunGateResult.summary ?? null,
        },
        history: [
          ...record.history,
          {
            at: input.rerunGateResult.observedAt ?? nowIso(),
            kind: 'rerun-gate-result',
            note: `${input.rerunGateResult.status}: ${input.rerunGateResult.summary ?? '(none)'}`,
          },
          ...(!isPass && failureCount >= maxGateFailures
            ? [
                {
                  at: input.rerunGateResult.observedAt ?? nowIso(),
                  kind: 'escalated' as const,
                  note: `rerun gate failures reached ${maxGateFailures}`,
                },
              ]
            : []),
        ],
      };
    }
  );
}

function main(): void {
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
    return;
  }
  if (require.main !== module) {
    return;
  }
  const payloadArg = process.argv[2];
  if (!payloadArg) {
    process.stderr.write(
      'Usage: node governance-execution-result-ingestor.cjs <json-payload>\n'
    );
    process.exit(1);
  }

  const payload = JSON.parse(payloadArg) as
    | ({ kind: 'execution'; projectRoot: string } & GovernanceExecutionResultIngestInput)
    | ({ kind: 'rerunGate'; projectRoot: string } & GovernanceRerunGateResultIngestInput);

  const result =
    payload.kind === 'execution'
      ? ingestGovernanceExecutionResult(payload.projectRoot, payload)
      : ingestGovernanceRerunGateResult(payload.projectRoot, payload);
  process.stdout.write(JSON.stringify(result, null, 2));
}

main();
