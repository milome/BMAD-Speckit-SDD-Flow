import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  claimMainAgentPendingPacket,
  ensureMainAgentDispatchPacket,
  ingestMainAgentTaskReport,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent child result E2E', () => {
  it('ingests a completed child task report and advances the main flow to review', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-child-result-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '15.4',
          runId: 'run-15-4',
          updatedAt: new Date().toISOString(),
        })
      );

      ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      const dispatch = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      claimMainAgentPendingPacket(root, dispatch!.sessionId);
      markMainAgentPacketDispatched(root, dispatch!.sessionId, dispatch!.packetId);

      const state = ingestMainAgentTaskReport(root, dispatch!.sessionId, {
        packetId: dispatch!.packetId,
        status: 'done',
        filesChanged: ['src/foo.ts'],
        validationsRun: ['npm test'],
        evidence: ['report.md'],
      });

      expect(state.pendingPacket?.status).toBe('completed');
      expect(state.nextAction).toBe('dispatch_review');
      expect(state.lastTaskReport).toMatchObject({
        packetId: dispatch!.packetId,
        status: 'done',
      });
      expect(state.gatesLoop?.circuitOpen).toBe(false);

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });
      expect(surface.mainAgentNextAction).toBe('dispatch_review');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
