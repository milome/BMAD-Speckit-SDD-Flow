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
import {
  buildPassImplementationEntryGate,
  buildSixModelResultsForImplementationReady,
  writeMinimalRegistryAndProjectContext,
} from '../helpers/runtime-registry-fixture';
import { writeFakeReqTraceSkill } from '../helpers/requirement-fixture-runtime';

describe('main-agent child result E2E', () => {
  it('ingests a completed child task report and advances the main flow to review', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-child-result-'));
    try {
      writeMinimalRegistryAndProjectContext(root, {
        flow: 'story',
        stage: 'implement',
        sourceMode: 'full_bmad',
        storyId: '15.4',
        runId: 'run-15-4',
        implementationEntryGate: buildPassImplementationEntryGate({
          flow: 'story',
        }),
        confirmedSource: true,
        currentMentalModel: 'implementation_readiness',
        sixModelResults: buildSixModelResultsForImplementationReady(),
      });
      writeFakeReqTraceSkill(root);

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
      });
      expect(surface.mainAgentNextAction).toBe('run_execution_closure_gate');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
