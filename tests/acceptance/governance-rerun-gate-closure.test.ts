import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGovernancePacketExecutionRecord } from '../../scripts/governance-packet-execution-store';
import {
  createAcceptedPlaceholderDispatchAdapter,
  processPendingExecutionRecords,
} from '../../scripts/governance-packet-dispatch-worker';
import {
  ingestGovernanceExecutionResult,
  ingestGovernanceRerunGateResult,
} from '../../scripts/governance-execution-result-ingestor';

describe('governance rerun gate closure', () => {
  it('closes remediation only when rerun gate passes', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'gov-rerun-gate-closure-'));
    try {
      const packetPath = path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.cursor-packet.md');
      mkdirSync(path.dirname(packetPath), { recursive: true });
      writeFileSync(packetPath, '# packet\n', 'utf8');

      createGovernancePacketExecutionRecord({
        projectRoot: root,
        queueItemId: 'queue-1',
        loopStateId: 'loop-closure',
        attemptNumber: 1,
        rerunGate: 'implementation-readiness',
        artifactPath: path.join(root, '_bmad-output', 'planning-artifacts', 'attempt-1.md'),
        packetPaths: { cursor: packetPath },
        authoritativeHost: 'cursor',
      });
      await processPendingExecutionRecords(root, {
        adapter: createAcceptedPlaceholderDispatchAdapter('execution accepted'),
      });
      ingestGovernanceExecutionResult({
        projectRoot: root,
        loopStateId: 'loop-closure',
        attemptNumber: 1,
        result: {
          outcome: 'completed',
          observedAt: '2026-04-09T00:00:00.000Z',
        },
      });

      const pass = ingestGovernanceRerunGateResult({
        projectRoot: root,
        loopStateId: 'loop-closure',
        attemptNumber: 1,
        rerunGateResult: {
          gate: 'implementation-readiness',
          status: 'pass',
          blockerIds: [],
          summary: 'all clear',
        },
      });

      expect(pass?.status).toBe('gate_passed');
      expect(pass?.lastRerunGateResult?.status).toBe('pass');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
