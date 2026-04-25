import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createGovernancePacketExecutionRecord,
  readGovernancePacketExecutionRecord,
} from '../../scripts/governance-packet-execution-store';
import {
  createAcceptedPlaceholderDispatchAdapter,
  processPendingExecutionRecords,
} from '../../scripts/governance-packet-dispatch-worker';

describe.skip('legacy archived: packet dispatch plane', () => {
  it('leases and launches pending execution records in the archived dispatch plane', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-dispatch-worker-'));
    try {
      const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md');
      mkdirSync(path.dirname(packetPath), { recursive: true });
      writeFileSync(packetPath, '# packet\n', 'utf8');

      const record = createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-dispatch',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: { cursor: packetPath },
        authoritativeHost: 'cursor',
      });

      const [updated] = await processPendingExecutionRecords(root, {
        adapter: createAcceptedPlaceholderDispatchAdapter('dispatch accepted'),
        leaseOwner: 'test-dispatcher',
      });

      expect(updated?.executionId).toBe(record.executionId);
      expect(updated?.status).toBe('running');
      expect(updated?.leaseOwner).toBe('test-dispatcher');
      expect(readGovernancePacketExecutionRecord(root, 'loop-dispatch', 1)?.status).toBe('running');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
