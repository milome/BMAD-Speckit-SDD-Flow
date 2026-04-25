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

describe('main-agent closeout E2E', () => {
  it('routes post-audit success to run_closeout through the main-agent surface', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-closeout-e2e-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'post_audit',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '15.5',
          runId: 'run-15-5',
          updatedAt: new Date().toISOString(),
        })
      );

      const artifactDocPath = path.join(root, 'specs', 'demo', 'post-audit.md');
      const reportPath = path.join(root, 'specs', 'demo', 'post-audit.audit.md');
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
          stage: 'story',
          artifactPath: artifactDocPath,
        },
        {
          scoreCommand: vi.fn().mockResolvedValue({ parsedRecord: { effective_verdict: 'approved' } }),
        }
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
      });

      expect(surface.mainAgentCanContinue).toBe(true);
      expect(surface.continueDecision).toBe('continue');
      expect(surface.mainAgentNextAction).toBe('run_closeout');
      expect(surface.mainAgentReady).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
