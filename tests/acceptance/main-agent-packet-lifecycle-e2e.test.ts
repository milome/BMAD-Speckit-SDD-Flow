import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  invalidateMainAgentPendingPacket,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../scripts/main-agent-orchestration';
import {
  buildPassImplementationEntryGate,
  buildSixModelResultsForImplementationReady,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';
import { writeFakeReqTraceSkill } from '../helpers/requirement-fixture-runtime';

describe('main-agent packet lifecycle E2E', () => {
  it('observes the full packet lifecycle through the main-agent surface', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-packet-e2e-'));
    try {
      writeMinimalRegistryAndProjectContext(root, {
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        storyId: '15.1',
        runId: 'run-15-1',
        implementationEntryGate: buildPassImplementationEntryGate({
          flow: 'story',
        }),
        confirmedSource: true,
        currentMentalModel: 'implementation_readiness',
        sixModelResults: buildSixModelResultsForImplementationReady(),
      });
      writeFakeReqTraceSkill(root);

      const ready = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      const sessionId = ready.sessionId!;
      const packetId = ready.orchestrationState!.pendingPacket!.packetId;
      expect(ready.pendingPacketStatus).toBe('ready_for_main_agent');

      claimMainAgentPendingPacket(root, sessionId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      markMainAgentPacketDispatched(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('dispatched');

      completeMainAgentPendingPacket(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('completed');

      invalidateMainAgentPendingPacket(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('invalidated');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
