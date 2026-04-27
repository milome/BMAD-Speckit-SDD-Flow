import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDefaultOrchestrationState,
  recordGatesLoopNoProgress,
  recordGatesLoopRetry,
  resetGatesLoopProgress,
  writeOrchestrationState,
} from '../../scripts/orchestration-state';

describe('main-agent gates loop compensation', () => {
  it('tracks retry budget and opens the circuit after repeated no-progress cycles', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-gates-loop-'));
    try {
      const sessionId = 'gates-loop-session';
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
        })
      );

      const retry = recordGatesLoopRetry(root, sessionId, {
        rerunGate: 'implementation-readiness',
        activePacketId: 'packet-1',
        lastResult: 'auto_repairable_block',
      });
      expect(retry.gatesLoop?.retryCount).toBe(1);
      expect(retry.gatesLoop?.circuitOpen).toBe(false);

      const firstNoProgress = recordGatesLoopNoProgress(root, sessionId, {
        lastResult: 'no_progress',
        maxNoProgressCount: 2,
      });
      expect(firstNoProgress.gatesLoop?.noProgressCount).toBe(1);
      expect(firstNoProgress.gatesLoop?.circuitOpen).toBe(false);

      const secondNoProgress = recordGatesLoopNoProgress(root, sessionId, {
        lastResult: 'no_progress',
        maxNoProgressCount: 2,
      });
      expect(secondNoProgress.gatesLoop?.noProgressCount).toBe(2);
      expect(secondNoProgress.gatesLoop?.circuitOpen).toBe(true);

      const reset = resetGatesLoopProgress(root, sessionId, { lastResult: 'progress' });
      expect(reset.gatesLoop?.noProgressCount).toBe(0);
      expect(reset.gatesLoop?.circuitOpen).toBe(false);
      expect(reset.gatesLoop?.retryCount).toBe(1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
