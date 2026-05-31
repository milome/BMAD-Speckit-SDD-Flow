import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../scripts/main-agent-orchestration';
import {
  buildPassImplementationEntryGate,
  buildSixModelResultsForImplementationReady,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';
import { writeFakeReqTraceSkill } from '../helpers/requirement-fixture-runtime';

function makeRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-idempotency-'));
  writeMinimalRegistryAndProjectContext(root, {
    flow: 'story',
    stage: 'implement',
    sourceMode: 'full_bmad',
    storyId: 'T1.2',
    runId: 'run-T1-2',
    implementationEntryGate: buildPassImplementationEntryGate({
      flow: 'story',
    }),
    confirmedSource: true,
    currentMentalModel: 'implementation_readiness',
    sixModelResults: buildSixModelResultsForImplementationReady(),
  });
  writeFakeReqTraceSkill(root);
  return root;
}

describe('main-agent orchestration state idempotency', () => {
  it('keeps repeated claim dispatch and complete calls on the same packet stable', () => {
    const root = makeRoot();
    try {
      const ready = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      const sessionId = ready.sessionId!;
      const packetId = ready.orchestrationState!.pendingPacket!.packetId;

      claimMainAgentPendingPacket(root, sessionId, 'main-agent');
      claimMainAgentPendingPacket(root, sessionId, 'main-agent');
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      markMainAgentPacketDispatched(root, sessionId, packetId);
      markMainAgentPacketDispatched(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('dispatched');

      completeMainAgentPendingPacket(root, sessionId, packetId);
      completeMainAgentPendingPacket(root, sessionId, packetId);
      const completed = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      expect(completed.pendingPacketStatus).toBe('completed');
      expect(completed.orchestrationState?.pendingPacket?.packetId).toBe(packetId);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
