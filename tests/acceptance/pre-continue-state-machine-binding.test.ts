import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { readGovernanceCurrentRun } from '../../scripts/governance-runtime-queue';
import type { GovernanceExecutionResult } from '../../scripts/governance-hook-types';

const ROOT = join(import.meta.dirname, '..', '..');

describe('pre-continue state machine binding', () => {
  it('binds workflow/step/artifact/scope into governance queue and current-run projection', async () => {
    const project = mkdtempSync(join(tmpdir(), 'pre-continue-binding-'));
    try {
      mkdirSync(join(project, '_bmad', '_config'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'planning-artifacts', 'feature-x'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-x\n', 'utf8');
      writeFileSync(
        join(project, '_bmad', '_config', 'architecture-gates.yaml'),
        readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8'),
        'utf8'
      );
      writeFileSync(
        join(project, '_bmad-output', 'planning-artifacts', 'feature-x', 'architecture.md'),
        [
          '## P0 Key Path Sequences',
          'Deferred to Implementation',
          '',
          '## Business Completion State vs System Completion State',
          'Deferred to Implementation',
          '',
          '## Sync / Async Boundaries',
          'Deferred to Implementation',
          '',
          '## Fallback And Compensation Strategy',
          'Deferred to Implementation',
          '',
          '## Minimum Observability Contract',
          'Deferred to Implementation',
          '',
          '## Testability And Smoke E2E Preconditions',
          'Deferred to Implementation',
          '',
          '## Data Architecture',
          'Version: v1\nExample: sample',
          '',
          '## Authentication & Security',
          'Version: v1\nExample: sample',
          '',
          '## API & Communication Patterns',
          'Version: v1\nExample: sample',
          '',
          '## Frontend Architecture',
          'Version: v1\nExample: sample',
          '',
          '## Infrastructure & Deployment',
          'Version: v1\nExample: sample',
        ].join('\n'),
        'utf8'
      );

      let stdout = '';
      try {
        stdout = execFileSync(process.execPath, [join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs'), 'bmad-create-architecture', 'step-04-decisions'], {
          cwd: project,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error: any) {
        stdout = error.stdout || '';
        // gate failure is expected; queue side effects are what this test verifies
      }

      expect(stdout).toContain('"ok":false');
      await processQueue(project);

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(project);
      expect(currentRun.length).toBeGreaterThan(0);
      const latest = currentRun.at(-1);
      expect(latest?.type).toBe('governance-pre-continue-check');
      expect(latest?.result?.gateCheck).toMatchObject({
        gate: 'architecture-contract-gate',
        workflow: 'bmad-create-architecture',
        step: 'step-04-decisions',
        artifactPath: join(project, '_bmad-output', 'planning-artifacts', 'feature-x', 'architecture.md').replace(/\\/g, '/'),
      });
      expect(latest?.result?.gateCheck?.scope).toMatchObject({
        branch: 'feature-x',
      });
      expect(latest?.result?.shouldContinue).toBe(false);
      expect(latest?.result?.loopStateId).toBeTruthy();
      expect(latest?.result?.runnerSummaryLines?.join('\n')).toContain('Governance Remediation Runner Summary');
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
