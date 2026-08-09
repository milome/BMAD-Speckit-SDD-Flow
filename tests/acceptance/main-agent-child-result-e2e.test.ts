import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  claimMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  ingestMainAgentTaskReport,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { publishImplementationPromptFixture } from './helpers/prompt-transaction-implementation-publication-fixture';

describe('main-agent child result E2E', () => {
  it('ingests a completed child task report and advances the main flow to review', async () => {
    const { fixture } = await publishImplementationPromptFixture({
      goalMode: 'direct_prompt',
      configureRecord: (record, publicationFixture) => ({
        ...record,
        transactionId: publicationFixture.identity.transactionId,
        flow: 'story',
        stage: 'implement',
        entryFlow: 'story',
        sourceMode: 'full_bmad',
        storyId: '15.4',
        runId: 'run-15-4',
      }),
    });
    const root = fixture.root;
    const recordId = fixture.authority.recordId;
    const requirementSetId = fixture.identity.requirementSetId;
    const implementationAttemptId = fixture.identity.implementationAttemptId;
    try {
      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
        host: 'cursor',
        preferredPacketId: implementationAttemptId,
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');
      const dispatch = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
        host: 'cursor',
        preferredPacketId: implementationAttemptId,
        hydratePacket: true,
      });
      claimMainAgentPendingPacket(root, dispatch!.sessionId);
      markMainAgentPacketDispatched(root, dispatch!.sessionId, dispatch!.packetId);

      const state = ingestMainAgentTaskReport(root, dispatch!.sessionId, {
        packetId: dispatch!.packetId,
        status: 'done',
        filesChanged: ['src/foo.ts'],
        validationsRun: ['npm test'],
        evidence: ['report.md'],
        downstreamContext: [],
      });

      expect(state.pendingPacket?.status).toBe('completed');
      expect(state.nextAction).toBe('run_execution_closure_gate');
      expect(state.lastTaskReport).toMatchObject({
        packetId: dispatch!.packetId,
        status: 'done',
      });
      expect(state.gatesLoop?.circuitOpen).toBe(false);

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        recordId,
        requirementSetId,
      });
      expect(surface.mainAgentNextAction).toBe('run_execution_closure_gate');
    } finally {
      fixture.cleanup();
    }
  });
});
