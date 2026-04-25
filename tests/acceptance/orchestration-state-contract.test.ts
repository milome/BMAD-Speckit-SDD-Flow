import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RecommendationPacket } from '../../scripts/orchestration-dispatch-contract';
import {
  claimPendingPacket,
  completePendingPacket,
  createDefaultOrchestrationState,
  invalidatePendingPacket,
  markPendingPacketDispatched,
  orchestrationStatePath,
  recordGatesLoopNoProgress,
  recordGatesLoopRetry,
  readOrchestrationState,
  resetGatesLoopProgress,
  writeOrchestrationState,
} from '../../scripts/orchestration-state';

describe('orchestration state contract', () => {
  it('writes and reads orchestration state for one interactive session', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'orch-state-'));
    try {
      const state = createDefaultOrchestrationState({
        sessionId: 'session-01',
        host: 'cursor',
        flow: 'story',
        currentPhase: 'implement',
        nextAction: 'dispatch_remediation',
      });

      writeOrchestrationState(root, state);
      const roundTrip = readOrchestrationState(root, 'session-01');

      expect(orchestrationStatePath(root, 'session-01')).toContain(
        path.join('_bmad-output', 'runtime', 'governance', 'orchestration-state')
      );
      expect(roundTrip?.currentPhase).toBe('implement');
      expect(roundTrip?.nextAction).toBe('dispatch_remediation');
      expect(roundTrip?.host).toBe('cursor');
      expect(roundTrip?.flow).toBe('story');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('claims, completes, and invalidates pending packets through state transitions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'orch-state-packet-'));
    try {
      const packet: RecommendationPacket = {
        packetId: 'pkt-01',
        parentSessionId: 'session-02',
        flow: 'bugfix',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['BUGFIX_demo.md'],
        allowedWriteScope: ['src/**', 'tests/**'],
        expectedDelta: 'repair regression and preserve closeout semantics',
        successCriteria: ['tests pass'],
        stopConditions: ['true blocker detected'],
        providerReasoning: 'narrow remediation packet',
      };

      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId: 'session-02',
          host: 'claude',
          flow: 'bugfix',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath: path.join('packets', 'session-02', `${packet.packetId}.json`),
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: '2026-04-24T00:00:00.000Z',
          },
        })
      );

      const claimed = claimPendingPacket(root, 'session-02', 'main-agent');
      expect(claimed.pendingPacket?.status).toBe('claimed_by_main_agent');
      expect(claimed.pendingPacket?.claimOwner).toBe('main-agent');

      const dispatched = markPendingPacketDispatched(root, 'session-02', packet.packetId);
      expect(dispatched.pendingPacket?.status).toBe('dispatched');

      const completed = completePendingPacket(root, 'session-02', packet.packetId);
      expect(completed.pendingPacket?.status).toBe('completed');

      const invalidated = invalidatePendingPacket(root, 'session-02', packet.packetId);
      expect(invalidated.pendingPacket?.status).toBe('invalidated');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('tracks gatesLoop retry/no-progress/circuit state transitions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'orch-state-gates-loop-'));
    try {
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId: 'session-03',
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
        })
      );

      const retry = recordGatesLoopRetry(root, 'session-03', {
        rerunGate: 'implementation-readiness',
        activePacketId: 'pkt-03',
        lastResult: 'retry-scheduled',
      });
      expect(retry.gatesLoop?.retryCount).toBe(1);
      expect(retry.gatesLoop?.rerunGate).toBe('implementation-readiness');
      expect(retry.gatesLoop?.activePacketId).toBe('pkt-03');

      const noProgress = recordGatesLoopNoProgress(root, 'session-03', {
        lastResult: 'no-progress',
        maxNoProgressCount: 2,
      });
      expect(noProgress.gatesLoop?.noProgressCount).toBe(1);
      expect(noProgress.gatesLoop?.circuitOpen).toBe(false);

      const opened = recordGatesLoopNoProgress(root, 'session-03', {
        lastResult: 'still-no-progress',
        maxNoProgressCount: 2,
      });
      expect(opened.gatesLoop?.noProgressCount).toBe(2);
      expect(opened.gatesLoop?.circuitOpen).toBe(true);

      const reset = resetGatesLoopProgress(root, 'session-03', {
        lastResult: 'progress-restored',
      });
      expect(reset.gatesLoop?.noProgressCount).toBe(0);
      expect(reset.gatesLoop?.circuitOpen).toBe(false);
      expect(reset.gatesLoop?.lastResult).toBe('progress-restored');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
