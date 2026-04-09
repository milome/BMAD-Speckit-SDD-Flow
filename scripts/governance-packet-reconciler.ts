import * as fs from 'node:fs';
import * as path from 'node:path';
import { readGovernanceRemediationConfig } from './governance-remediation-config';
import {
  governanceExecutionStoreDir,
  listGovernancePacketExecutionRecords,
  updateGovernancePacketExecutionRecord,
} from './governance-packet-execution-store';

export interface GovernancePacketReconciliationReport {
  reconciledAt: string;
  updatedRecordIds: string[];
  orphanPacketPaths: string[];
  orphanExecutionRecordIds: string[];
}

function nowIso(now = new Date()): string {
  return now.toISOString();
}

function listPacketFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...listPacketFiles(full));
    } else if (entry.isFile() && /\.((cursor|claude|codex|generic)-packet)\.md$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results.sort((left, right) => left.localeCompare(right));
}

function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) {
    return false;
  }
  const value = Date.parse(expiresAt);
  return Number.isFinite(value) && value <= now.getTime();
}

export function reconcileGovernanceExecutionRecords(
  projectRoot: string,
  now = new Date()
): GovernancePacketReconciliationReport {
  const config = readGovernanceRemediationConfig(projectRoot);
  const updatedRecordIds: string[] = [];
  const records = listGovernancePacketExecutionRecords(projectRoot);
  const executionIds = new Set(records.map((record) => record.executionId));
  const packetPaths = new Set(
    records.flatMap((record) => Object.values(record.packetPaths).filter(Boolean) as string[])
  );

  for (const record of records) {
    if (record.status === 'leased' && isExpired(record.leaseExpiresAt, now)) {
      updateGovernancePacketExecutionRecord(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
        ...current,
        status: 'retry_pending',
        leaseOwner: null,
        leaseAcquiredAt: null,
        leaseExpiresAt: null,
        history: [
          ...current.history,
          {
            at: nowIso(now),
            kind: 'reconciled',
            note: 'expired lease moved back to retry_pending',
          },
        ],
      }));
      updatedRecordIds.push(record.executionId);
      continue;
    }

    if (record.status === 'running') {
      const updatedAt = Date.parse(record.updatedAt);
      const timeoutMs = (config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000;
      if ((Number.isFinite(updatedAt) && updatedAt + timeoutMs <= now.getTime()) || isExpired(record.leaseExpiresAt, now)) {
        updateGovernancePacketExecutionRecord(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
          ...current,
          status: 'retry_pending',
          leaseOwner: null,
          leaseAcquiredAt: null,
          leaseExpiresAt: null,
          history: [
            ...current.history,
            {
              at: nowIso(now),
              kind: 'reconciled',
              note: 'stale running execution moved back to retry_pending',
            },
          ],
        }));
        updatedRecordIds.push(record.executionId);
        continue;
      }
    }

    if (
      record.status === 'awaiting_rerun_gate' &&
      record.rerunGateSchedule?.scheduledAt &&
      Date.parse(record.rerunGateSchedule.scheduledAt) + (config.execution?.execution.timeoutMinutes ?? 30) * 60 * 1000 <= now.getTime()
    ) {
      updateGovernancePacketExecutionRecord(projectRoot, record.loopStateId, record.attemptNumber, (current) => ({
        ...current,
        status: 'retry_pending',
        history: [
          ...current.history,
          {
            at: nowIso(now),
            kind: 'reconciled',
            note: 'awaiting_rerun_gate timed out and moved back to retry_pending',
          },
        ],
      }));
      updatedRecordIds.push(record.executionId);
    }
  }

  const orphanPacketPaths = listPacketFiles(path.join(projectRoot, '_bmad-output')).filter(
    (file) => !packetPaths.has(file)
  );
  const orphanExecutionRecordIds = listGovernancePacketExecutionRecords(projectRoot)
    .filter((record) =>
      Object.values(record.packetPaths).some((packetPath) => packetPath && !fs.existsSync(packetPath))
    )
    .map((record) => record.executionId);

  fs.mkdirSync(governanceExecutionStoreDir(projectRoot), { recursive: true });
  fs.writeFileSync(
    path.join(governanceExecutionStoreDir(projectRoot), 'reconciliation-report.json'),
    JSON.stringify(
      {
        reconciledAt: nowIso(now),
        updatedRecordIds,
        orphanPacketPaths,
        orphanExecutionRecordIds,
        trackedExecutionIds: [...executionIds].sort(),
      },
      null,
      2
    ) + '\n',
    'utf8'
  );

  return {
    reconciledAt: nowIso(now),
    updatedRecordIds,
    orphanPacketPaths,
    orphanExecutionRecordIds,
  };
}

function main(): void {
  if (process.env.BMAD_DISABLE_EMBEDDED_GOVERNANCE_CLIS === '1') {
    return;
  }
  if (require.main !== module) {
    return;
  }
  const projectRoot = process.argv[2] || process.cwd();
  process.stdout.write(
    JSON.stringify(reconcileGovernanceExecutionRecords(projectRoot), null, 2)
  );
}

main();
