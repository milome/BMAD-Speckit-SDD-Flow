import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createGovernancePacketExecutionRecord,
  governanceExecutionRecordPath,
  listGovernancePacketExecutionRecords,
  readGovernancePacketExecutionRecord,
} from '../../scripts/governance-packet-execution-store';

describe('governance packet execution store', () => {
  it('creates and persists a pending dispatch execution record idempotently', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-packet-exec-store-'));
    try {
      mkdirSync(path.join(root, '_bmad-output'), { recursive: true });

      const first = createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-alpha',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: {
          cursor: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md'),
        },
        authoritativeHost: 'cursor',
        fallbackHosts: ['claude'],
      });
      const second = createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-alpha',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: {
          cursor: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md'),
        },
        authoritativeHost: 'cursor',
      });

      expect(first.status).toBe('pending_dispatch');
      expect(first.authoritativeHost).toBe('cursor');
      expect(first.packetPaths.cursor).toContain('.cursor-packet.md');
      expect(second.executionId).toBe(first.executionId);

      const persisted = readGovernancePacketExecutionRecord(root, 'loop-alpha', 1);
      expect(persisted?.executionId).toBe(first.executionId);
      expect(listGovernancePacketExecutionRecords(root)).toHaveLength(1);
      expect(
        JSON.parse(
          readFileSync(governanceExecutionRecordPath(root, 'loop-alpha', 1), 'utf8')
        ).status
      ).toBe('pending_dispatch');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
