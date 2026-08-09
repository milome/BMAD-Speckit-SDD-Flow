import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  ensureMainAgentDispatchPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { publishImplementationPromptFixture } from './helpers/prompt-transaction-implementation-publication-fixture';
import { writeFakeReqTraceSkill } from '../helpers/requirement-fixture-runtime';

describe('main-agent host parity E2E', () => {
  it('keeps orchestration semantics identical while transport differs across cursor and claude', async () => {
    const { fixture } = await publishImplementationPromptFixture({
      configureRecord: (record) => ({
        ...record,
        flow: 'story',
        entryFlow: 'story',
        stage: 'implement',
        storyId: '14.9',
        runId: 'run-14-9',
      }),
    });
    try {
      writeFakeReqTraceSkill(fixture.root);
      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        flow: 'story',
        stage: 'implement',
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const cursorPlan = buildMainAgentDispatchInstruction({
        projectRoot: fixture.root,
        flow: 'story',
        stage: 'implement',
        host: 'cursor',
        hydratePacket: true,
      });
      const claudePlan = buildMainAgentDispatchInstruction({
        projectRoot: fixture.root,
        flow: 'story',
        stage: 'implement',
        host: 'claude',
        hydratePacket: true,
      });

      expect(cursorPlan?.nextAction).toBe(claudePlan?.nextAction);
      expect(cursorPlan?.taskType).toBe(claudePlan?.taskType);
      expect(cursorPlan?.packetId).toBe(claudePlan?.packetId);
      expect(cursorPlan?.route.tool).toBe('mcp_task');
      expect(cursorPlan?.route.subtype).toBe('generalPurpose');
      expect(claudePlan?.route.tool).toBe('Agent');
      expect(claudePlan?.route.subtype).toBe('general-purpose');
    } finally {
      fixture.cleanup();
    }
  });
});
