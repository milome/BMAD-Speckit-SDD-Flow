import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveMainAgentOrchestrationSurface } from '../../scripts/main-agent-orchestration';
import {
  createDefaultOrchestrationState,
  recordGatesLoopNoProgress,
  recordGatesLoopRetry,
  resetGatesLoopProgress,
  writeOrchestrationState,
} from '../../scripts/orchestration-state';

describe('main-agent gatesLoop E2E', () => {
  it('opens the circuit after repeated no-progress and changes the main-agent branch', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-gates-loop-e2e-'));
    try {
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId: 'story-15.2',
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
        })
      );

      recordGatesLoopRetry(root, 'story-15.2', {
        rerunGate: 'implementation-readiness',
        activePacketId: 'pkt-loop-15-2',
        lastResult: 'retry-scheduled',
      });
      recordGatesLoopNoProgress(root, 'story-15.2', {
        lastResult: 'no-progress-1',
        maxNoProgressCount: 2,
      });
      recordGatesLoopNoProgress(root, 'story-15.2', {
        lastResult: 'no-progress-2',
        maxNoProgressCount: 2,
      });

      const blocked = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      expect(blocked.gatesLoop?.circuitOpen).toBe(true);
      expect(blocked.mainAgentNextAction).toBe('await_user');
      expect(blocked.mainAgentReady).toBe(false);

      resetGatesLoopProgress(root, 'story-15.2', {
        lastResult: 'progress-restored',
      });
      const reopened = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      expect(reopened.gatesLoop?.circuitOpen).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
