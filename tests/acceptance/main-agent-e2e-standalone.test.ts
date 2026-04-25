import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveMainAgentOrchestrationSurface } from '../../scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent standalone E2E orchestration', () => {
  it('keeps standalone reroute decisions on the main-agent surface instead of silently auto-continuing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-e2e-standalone-'));
    try {
      const registry = defaultRuntimeContextRegistry(root);
      registry.implementationEntryIndex.standalone_tasks['tasks-14-8'] = {
        gateName: 'implementation-readiness',
        requestedFlow: 'standalone_tasks',
        recommendedFlow: 'story',
        decision: 'reroute',
        readinessStatus: 'repair_closed',
        blockerCodes: ['standalone_tasks_high_complexity'],
        blockerSummary: ['standalone_tasks must upgrade to story before implementation continues'],
        rerouteRequired: true,
        rerouteReason: 'standalone_tasks_high_complexity',
        evidenceSources: {
          readinessReportPath: null,
          remediationArtifactPath: null,
          executionRecordPath: null,
          authoritativeAuditReportPath: null,
        },
        semanticFingerprint: 'tasks-14-8',
        evaluatedAt: new Date().toISOString(),
      };
      writeRuntimeContextRegistry(root, registry);
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'standalone_tasks',
          stage: 'implement',
          sourceMode: 'standalone_story',
          contextScope: 'project',
          runId: 'tasks-14-8',
          artifactPath: '_bmad-output/implementation-artifacts/_orphan/TASKS_checkout_hardening.md',
          updatedAt: new Date().toISOString(),
        })
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
      });

      expect(surface.source).toBe('implementation_entry_gate');
      expect(surface.latestGate?.decision).toBe('reroute');
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
