import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { resolveMainAgentOrchestrationSurface } from '../../scripts/main-agent-orchestration';
import { runAuditorHost } from '../../scripts/run-auditor-host';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';

describe('main-agent drift surface E2E', () => {
  it('keeps raw drift signals visible to the main-agent surface after closeout blocks', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-drift-e2e-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'post_audit',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '15.3',
          runId: 'run-15-3',
          updatedAt: new Date().toISOString(),
        })
      );

      const artifactDocPath = path.join(root, 'specs', 'demo', 'implement.md');
      const reportPath = path.join(root, 'specs', 'demo', 'implement.audit.md');
      mkdirSync(path.dirname(reportPath), { recursive: true });
      writeFileSync(
        reportPath,
        [
          'status: PASS',
          `reportPath: ${reportPath.replace(/\\/g, '/')}`,
          'iteration_count: 0',
          'required_fixes_count: 0',
          'score_trigger_present: true',
          `artifactDocPath: ${artifactDocPath.replace(/\\/g, '/')}`,
          'converged: true',
        ].join('\n'),
        'utf8'
      );

      await runAuditorHost(
        {
          projectRoot: root,
          reportPath,
          stage: 'implement',
          artifactPath: artifactDocPath,
        },
        {
          scoreCommand: vi.fn().mockResolvedValue({
            parsedRecord: {
              effective_verdict: 'blocked',
              blocking_reason:
                'Critical readiness drift detected against the current implementation baseline.',
              re_readiness_required: true,
              drift_severity: 'critical',
              drift_signals: ['closure_task_id', 'smoke_task_chain'],
              drifted_dimensions: ['Evidence Proof Chain', 'Smoke E2E Readiness'],
              readiness_baseline_run_id: 'readiness-15-3',
            },
          }),
        }
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
      });
      expect(surface.drift).toMatchObject({
        driftSignals: ['closure_task_id', 'smoke_task_chain'],
        driftSeverity: 'critical',
        effectiveVerdict: 'blocked',
        reReadinessRequired: true,
      });
      expect(surface.mainAgentCanContinue).toBe(false);
      expect(surface.continueDecision).toBe('rerun');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
