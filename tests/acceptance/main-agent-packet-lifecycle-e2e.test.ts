import { describe, expect, it } from 'vitest';
import {
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  invalidateMainAgentPendingPacket,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

describe('main-agent packet lifecycle E2E', () => {
  it('observes the full packet lifecycle through the main-agent surface', async () => {
    const { fixture } = await publishImplementationPromptFixture({
      configureRecord: (record) => ({
        ...record,
        flow: 'story',
        stage: 'implement',
        entryFlow: 'story',
        sourceMode: 'full_bmad',
        storyId: '15.1',
        runId: 'run-15-1',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-15/story-15.1',
        artifactPath: '_bmad-output/implementation-artifacts/epic-15/story-15.1/spec.md',
      }),
    });
    const root = fixture.root;
    const recordId = fixture.authority.recordId;
    const requirementSetId = fixture.identity.requirementSetId;
    try {
      const ready = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
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
          recordId,
          requirementSetId,
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      markMainAgentPacketDispatched(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
          recordId,
          requirementSetId,
        }).pendingPacketStatus
      ).toBe('dispatched');

      completeMainAgentPendingPacket(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
          recordId,
          requirementSetId,
        }).pendingPacketStatus
      ).toBe('completed');

      invalidateMainAgentPendingPacket(root, sessionId, packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
          recordId,
          requirementSetId,
        }).pendingPacketStatus
      ).toBe('invalidated');
    } finally {
      fixture.cleanup();
    }
  });
});
