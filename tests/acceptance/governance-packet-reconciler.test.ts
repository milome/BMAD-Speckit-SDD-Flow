import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createGovernancePacketExecutionRecord,
  readGovernancePacketExecutionRecord,
  updateGovernancePacketExecutionRecord,
} from '../../scripts/governance-packet-execution-store';
import { reconcileGovernanceExecutionRecords } from '../../scripts/governance-packet-reconciler';

function setupRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'gov-packet-reconciler-'));
  mkdirSync(path.join(root, '_bmad'), { recursive: true });
  return root;
}

describe('governance packet reconciler', () => {
  it('retries expired leases, retries stale running executions, and reports orphans', () => {
    const root = setupRoot();
    try {
      const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md');
      mkdirSync(path.dirname(packetPath), { recursive: true });
      writeFileSync(packetPath, '# packet\n', 'utf8');
      writeFileSync(
        path.join(root, '_bmad-output', 'planning-artifacts', 'orphan.cursor-packet.md'),
        '# orphan packet\n',
        'utf8'
      );

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        loopStateId: 'loop-lease',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, 'attempt-1.md'),
        packetPaths: { cursor: packetPath },
        authoritativeHost: 'cursor',
      });
      updateGovernancePacketExecutionRecord(root, 'loop-lease', 1, (record) => ({
        ...record,
        status: 'leased',
        leaseOwner: 'worker-1',
        leaseAcquiredAt: '2026-04-09T00:00:00.000Z',
        leaseExpiresAt: '2026-04-09T00:01:00.000Z',
      }));

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        loopStateId: 'loop-running',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, 'attempt-2.md'),
        packetPaths: { cursor: path.join(root, '_bmad-output', 'planning-artifacts', 'missing.cursor-packet.md') },
        authoritativeHost: 'cursor',
      });
      updateGovernancePacketExecutionRecord(root, 'loop-running', 1, (record) => ({
        ...record,
        status: 'running',
        updatedAt: '2026-04-09T00:00:00.000Z',
        leaseOwner: 'worker-2',
        leaseAcquiredAt: '2026-04-09T00:00:00.000Z',
        leaseExpiresAt: '2026-04-09T00:01:00.000Z',
      }));

      const report = reconcileGovernanceExecutionRecords(root, new Date('2026-04-09T01:00:00.000Z'));

      expect(readGovernancePacketExecutionRecord(root, 'loop-lease', 1)?.status).toBe('retry_pending');
      expect(readGovernancePacketExecutionRecord(root, 'loop-running', 1)?.status).toBe('retry_pending');
      expect(report.updatedRecordIds).toHaveLength(2);
      expect(report.orphanPacketPaths.some((file) => file.endsWith('orphan.cursor-packet.md'))).toBe(true);
      expect(report.orphanExecutionRecordIds).toContain('gov-exec-loop-running-0001');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
