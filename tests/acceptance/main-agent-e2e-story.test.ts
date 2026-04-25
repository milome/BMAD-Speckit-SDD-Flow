import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent story E2E orchestration', () => {
  it('hydrates a dispatch packet, claims it, dispatches it, and completes it through the main-agent loop', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-e2e-story-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.6',
          runId: 'run-14-6',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.6',
          artifactPath: '_bmad-output/implementation-artifacts/epic-14/story-14.6/spec.md',
          updatedAt: new Date().toISOString(),
        })
      );

      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const dispatchPlan = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
        hydratePacket: true,
      });
      expect(dispatchPlan).toMatchObject({
        host: 'cursor',
        nextAction: 'dispatch_implement',
        taskType: 'implement',
        route: {
          tool: 'mcp_task',
          subtype: 'generalPurpose',
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
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
