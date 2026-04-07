import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { runGovernanceRemediation } from '../../scripts/governance-remediation-runner';
import { readGovernanceCurrentRun } from '../../scripts/governance-runtime-queue';
import type { GovernanceExecutionResult } from '../../scripts/governance-hook-types';

const ROOT = join(import.meta.dirname, '..', '..');

describe('pre-continue state machine binding', () => {
  it('binds workflow/step/artifact/scope into a queued runtime event and reuses rerunGate in remediation loop', async () => {
    const project = mkdtempSync(join(tmpdir(), 'pre-continue-binding-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '_bmad', '_config'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'planning-artifacts', 'feature-x'), { recursive: true });
      mkdirSync(join(project, '.git'), { recursive: true });
      writeFileSync(join(project, '.git', 'HEAD'), 'ref: refs/heads/feature-x\n', 'utf8');
      writeFileSync(join(project, '_bmad', '_config', 'architecture-gates.yaml'), readFileSync(join(ROOT, '_bmad', '_config', 'architecture-gates.yaml'), 'utf8'), 'utf8');
      writeFileSync(
        join(project, '_bmad-output', 'planning-artifacts', 'feature-x', 'architecture.md'),
        ['## P0 Key Path Sequences', '{{journey_key_path_sequences}}'].join('\n'),
        'utf8'
      );

      let stdout = '';
      try {
        stdout = execFileSync(
          process.execPath,
          [
            join(ROOT, '_bmad', 'runtime', 'hooks', 'pre-continue-check.cjs'),
            'bmad-create-architecture',
            'step-04-decisions',
          ],
          {
            cwd: project,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
          },
        );
      } catch (error: any) {
        stdout = error.stdout || '';
      }

      const hookResult = JSON.parse(stdout) as {
        ok: boolean;
        gate: string;
        workflow: string;
        step: string;
        artifactPath: string;
        scope: { branch: string; epicId: string | null; storyId: string | null };
        failures: string[];
      };

      expect(hookResult.ok).toBe(false);
      expect(hookResult.gate).toBe('architecture-contract-gate');
      expect(hookResult.workflow).toBe('bmad-create-architecture');
      expect(hookResult.step).toBe('step-04-decisions');
      expect(hookResult.scope.branch).toBe('feature-x');
      expect(hookResult.artifactPath).toBe(
        join(project, '_bmad-output', 'planning-artifacts', 'feature-x', 'architecture.md').replace(/\\/g, '/'),
      );
      expect(hookResult.failures.length).toBeGreaterThan(0);

      const pendingDir = join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending');
      const pendingFiles = readdirSync(pendingDir).filter((file) => file.endsWith('.json'));
      expect(pendingFiles.length).toBe(1);

      const queued = JSON.parse(readFileSync(join(pendingDir, pendingFiles[0]), 'utf8')) as {
        type: string;
        payload: {
          workflow: string;
          step: string;
          gate: string;
          rerunGate: string;
          branch: string;
          artifactPath: string;
          sourceGateFailureIds: string[];
          failures: string[];
        };
      };

      expect(queued.type).toBe('governance-pre-continue-check');
      expect(queued.payload.workflow).toBe('bmad-create-architecture');
      expect(queued.payload.step).toBe('step-04-decisions');
      expect(queued.payload.gate).toBe('architecture-contract-gate');
      expect(queued.payload.rerunGate).toBe('architecture-contract-gate');
      expect(queued.payload.branch).toBe('feature-x');
      expect(queued.payload.artifactPath).toBe(hookResult.artifactPath);
      expect(queued.payload.failures).toEqual(hookResult.failures);
      expect(queued.payload.sourceGateFailureIds.length).toBe(hookResult.failures.length);

      const remediation = await runGovernanceRemediation({
        projectRoot: project,
        outputPath: join(project, '_bmad-output', 'planning-artifacts', 'feature-x', 'attempt-remediate.md'),
        promptText: `GateFailure for ${queued.payload.workflow} ${queued.payload.step}: ${queued.payload.failures.join('; ')}`,
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 1,
        attemptId: 'pre-continue-retry-01',
        sourceGateFailureIds: queued.payload.sourceGateFailureIds,
        capabilitySlot: `${queued.payload.workflow}.${queued.payload.step}`,
        canonicalAgent: 'Governance Gate Runner',
        actualExecutor: 'pre-continue-check',
        adapterPath: '_bmad/runtime/hooks/pre-continue-check.cjs',
        targetArtifacts: [queued.payload.artifactPath],
        expectedDelta: 'repair governed contract sections before Continue',
        rerunOwner: 'PM',
        rerunGate: queued.payload.rerunGate,
        outcome: 'blocked',
        hostKind: 'claude',
      });

      expect(remediation.shouldContinue).toBe(true);
      expect(remediation.stopReason).toBeNull();
      expect(remediation.loopState.rerunGate).toBe('architecture-contract-gate');
      expect(remediation.executorPacket?.prompt).toContain('Awaiting Rerun Gate: architecture-contract-gate');
      expect(remediation.executionPlanDecision?.blockedByGovernance).toEqual(
        expect.arrayContaining(['entry-routing', 'blocker-ownership', 'artifact-target']),
      );
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });

  it('worker keeps pre-continue queue items at shouldContinue=false while preserving rerunGate semantics', async () => {
    const project = mkdtempSync(join(tmpdir(), 'pre-continue-worker-'));
    try {
      cpSync(join(ROOT, '_bmad'), join(project, '_bmad'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending'), { recursive: true });
      mkdirSync(join(project, '_bmad-output', 'planning-artifacts', 'feature-z'), { recursive: true });
      writeFileSync(
        join(project, '_bmad-output', 'planning-artifacts', 'feature-z', 'architecture.md'),
        ['## P0 Key Path Sequences', 'Filled during remediation handoff.'].join('\n'),
        'utf8',
      );
      writeFileSync(
        join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending', 'pc-1.json'),
        JSON.stringify(
          {
            id: 'pc-1',
            type: 'governance-pre-continue-check',
            timestamp: '2026-04-07T00:00:00.000Z',
            payload: {
              projectRoot: project,
              workflow: 'bmad-create-architecture',
              step: 'step-04-decisions',
              artifactPath: join(project, '_bmad-output', 'planning-artifacts', 'feature-z', 'architecture.md').replace(/\\/g, '/'),
              branch: 'feature-z',
              gate: 'architecture-contract-gate',
              status: 'fail',
              rerunGate: 'architecture-contract-gate',
              sourceGateFailureIds: ['ARCH-1', 'ARCH-2'],
              failures: ['missing section content: P0 Key Path Sequences'],
            },
          },
          null,
          2,
        ),
        'utf8',
      );

      await processQueue(project);

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(project);
      expect(currentRun.length).toBe(1);
      expect(currentRun[0]?.type).toBe('governance-pre-continue-check');
      expect(currentRun[0]?.result?.shouldContinue).toBe(false);
      expect(currentRun[0]?.result?.gateCheck?.rerunGate).toBe('architecture-contract-gate');
      expect(currentRun[0]?.result?.runnerSummaryLines).toEqual(
        expect.arrayContaining([expect.stringContaining('Should Continue: no')]),
      );
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
