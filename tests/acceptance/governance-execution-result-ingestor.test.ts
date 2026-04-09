import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGovernancePacketExecutionRecord } from '../../scripts/governance-packet-execution-store';
import {
  createAcceptedPlaceholderDispatchAdapter,
  processPendingExecutionRecords,
} from '../../scripts/governance-packet-dispatch-worker';
import { ingestGovernanceExecutionResult } from '../../scripts/governance-execution-result-ingestor';

describe('governance execution result ingestor', () => {
  it('moves running execution records into awaiting_rerun_gate on successful result', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-exec-result-ingestor-'));
    try {
      const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md');
      mkdirSync(path.dirname(packetPath), { recursive: true });
      writeFileSync(packetPath, '# packet\n', 'utf8');

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-result',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: { cursor: packetPath },
        authoritativeHost: 'cursor',
      });
      await processPendingExecutionRecords(root, {
        adapter: createAcceptedPlaceholderDispatchAdapter('execution accepted'),
      });

      const updated = ingestGovernanceExecutionResult({
        projectRoot: root,
        loopStateId: 'loop-result',
        attemptNumber: 1,
        result: {
          outcome: 'completed',
          observedAt: '2026-04-09T00:00:00.000Z',
          externalRunId: 'run-1',
        },
      });

      expect(updated.status).toBe('awaiting_rerun_gate');
      expect(updated.rerunGateSchedule?.status).toBe('scheduled');
      expect(updated.lastExecutionResult?.outcome).toBe('completed');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
