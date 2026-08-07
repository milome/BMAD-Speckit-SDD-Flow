import { describe, expect, it } from 'vitest';
import {
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

describe('main-agent orchestration state idempotency', () => {
  it('keeps repeated claim dispatch and complete calls on the same packet stable', async () => {
    const { fixture } = await publishImplementationPromptFixture({
      configureRecord: (record) => ({
        ...record,
        flow: 'story',
        stage: 'implement',
        entryFlow: 'story',
        sourceMode: 'full_bmad',
        storyId: 'T1.2',
        runId: 'run-T1-2',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-T1/story-T1.2',
        artifactPath: '_bmad-output/implementation-artifacts/epic-T1/story-T1.2/spec.md',
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

      claimMainAgentPendingPacket(root, sessionId, 'main-agent');
      claimMainAgentPendingPacket(root, sessionId, 'main-agent');
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
      completeMainAgentPendingPacket(root, sessionId, packetId);
      const completed = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
      });
      expect(completed.pendingPacketStatus).toBe('completed');
      expect(completed.orchestrationState?.pendingPacket?.packetId).toBe(packetId);
    } finally {
      fixture.cleanup();
    }
  });
});
