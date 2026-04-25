import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildMainAgentDispatchInstruction, ensureMainAgentDispatchPacket } from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent host parity E2E', () => {
  it('keeps orchestration semantics identical while transport differs across cursor and claude', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-host-parity-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'story_audit',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.9',
          runId: 'run-14-9',
          artifactPath: '_bmad-output/implementation-artifacts/epic-14/story-14.9/story.md',
          updatedAt: new Date().toISOString(),
        })
      );

      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const cursorPlan = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        host: 'cursor',
        hydratePacket: true,
      });
      const claudePlan = buildMainAgentDispatchInstruction({
        projectRoot: root,
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
      rmSync(root, { recursive: true, force: true });
    }
  });
});
