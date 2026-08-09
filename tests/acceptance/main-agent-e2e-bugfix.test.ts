import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  ensureMainAgentDispatchPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

describe('main-agent bugfix E2E orchestration', () => {
  it('builds a bugfix implementation dispatch plan through the same main-agent loop', async () => {
    const { fixture } = await publishImplementationPromptFixture({
      configureRecord: (record) => ({
        ...record,
        flow: 'bugfix',
        stage: 'implement',
        entryFlow: 'bugfix',
        sourceMode: 'seeded_solutioning',
        runId: 'run-bugfix-14-7',
        artifactRoot: '_bmad-output/implementation-artifacts/_orphan',
        artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_login_loop.md',
      }),
    });
    try {
      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        flow: 'bugfix',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const dispatchPlan = buildMainAgentDispatchInstruction({
        projectRoot: fixture.root,
        flow: 'bugfix',
        stage: 'implement',
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        host: 'claude',
        hydratePacket: true,
      });

      expect(dispatchPlan).toMatchObject({
        host: 'claude',
        nextAction: 'dispatch_implement',
        taskType: 'implement',
        route: {
          tool: 'Agent',
          subtype: 'general-purpose',
        },
      });
    } finally {
      fixture.cleanup();
    }
  });
});
