import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

describe('main-agent story E2E orchestration', () => {
  it('hydrates a dispatch packet, claims it, dispatches it, and completes it through the main-agent loop', async () => {
    const { fixture } = await publishImplementationPromptFixture({
      configureRecord: (record) => ({
        ...record,
        flow: 'story',
        stage: 'implement',
        entryFlow: 'story',
        sourceMode: 'full_bmad',
        storyId: '14.6',
        runId: 'run-14-6',
        artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.6',
        artifactPath: '_bmad-output/implementation-artifacts/epic-14/story-14.6/spec.md',
      }),
    });
    const root = fixture.root;
    const recordId = fixture.authority.recordId;
    const requirementSetId = fixture.identity.requirementSetId;
    try {
      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const dispatchPlan = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
        host: 'codex',
        hydratePacket: true,
      });
      expect(dispatchPlan).toMatchObject({
        host: 'codex',
        nextAction: 'dispatch_implement',
        taskType: 'implement',
        route: {
          tool: 'codex',
          subtype: 'main-session:implement',
        },
      });

      const sessionId = dispatchPlan!.sessionId;
      const packetId = dispatchPlan!.packetId;
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
    } finally {
      fixture.cleanup();
    }
  });
});
