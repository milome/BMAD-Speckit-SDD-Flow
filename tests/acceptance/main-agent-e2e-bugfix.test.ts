import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  ensureMainAgentDispatchPacket,
} from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent bugfix E2E orchestration', () => {
  it('builds a bugfix implementation dispatch plan through the same main-agent loop', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-e2e-bugfix-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'bugfix',
          stage: 'implement',
          sourceMode: 'seeded_solutioning',
          contextScope: 'project',
          runId: 'run-bugfix-14-7',
          artifactRoot: '_bmad-output/implementation-artifacts/_orphan',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/BUGFIX_login_loop.md',
          updatedAt: new Date().toISOString(),
        })
      );

      const hydrated = ensureMainAgentDispatchPacket({
        projectRoot: root,
        flow: 'bugfix',
        stage: 'implement',
      });
      expect(hydrated.pendingPacketStatus).toBe('ready_for_main_agent');

      const dispatchPlan = buildMainAgentDispatchInstruction({
        projectRoot: root,
        flow: 'bugfix',
        stage: 'implement',
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
      rmSync(root, { recursive: true, force: true });
    }
  });
});
