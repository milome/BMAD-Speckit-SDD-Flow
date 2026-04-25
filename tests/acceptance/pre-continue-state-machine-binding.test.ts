import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { processQueue } from '../../scripts/bmad-runtime-worker';
import { createAcceptedPlaceholderDispatchAdapter } from '../../scripts/governance-packet-dispatch-worker';
import { runGovernanceRemediation } from '../../scripts/governance-remediation-runner';
import { readGovernanceCurrentRun } from '../../scripts/governance-runtime-queue';
import { readOrchestrationState } from '../../scripts/orchestration-state';
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
        join(project, '_bmad', '_config', 'governance-remediation.yaml'),
        [
          'version: 2',
          'primaryHost: claude',
          'packetHosts:',
          '  - claude',
          'provider:',
          '  mode: stub',
          '  id: pre-continue-test',
          'execution:',
          '  enabled: true',
          '  interactiveMode: main-agent',
          '  fallbackAutonomousMode: true',
          '  authoritativeHost: claude',
          '  fallbackHosts: []',
        ].join('\n'),
        'utf8',
      );
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
        next_action?: string;
        ready?: boolean;
        orchestration_state?: string;
        pending_packet?: string;
        session_id?: string;
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
      expect(hookResult.next_action).toBe('dispatch_remediation');
      expect(hookResult.ready).toBe(true);
      expect(typeof hookResult.orchestration_state).toBe('string');
      expect(typeof hookResult.pending_packet).toBe('string');
      expect(typeof hookResult.session_id).toBe('string');
      expect(existsSync(hookResult.orchestration_state!)).toBe(true);
      expect(existsSync(hookResult.pending_packet!)).toBe(true);

      const state = readOrchestrationState(project, hookResult.session_id!);
      expect(state?.currentPhase).toBe('arch');
      expect(state?.nextAction).toBe('dispatch_remediation');
      expect(state?.latestGate?.decision).toBe('auto_repairable_block');
      expect(state?.pendingPacket?.status).toBe('ready_for_main_agent');

      const queuePendingDir = join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending');
      expect(existsSync(queuePendingDir)).toBe(false);

      const remediation = await runGovernanceRemediation({
        projectRoot: project,
        outputPath: join(project, '_bmad-output', 'planning-artifacts', 'feature-x', 'attempt-remediate.md'),
        promptText: `GateFailure for ${hookResult.workflow} ${hookResult.step}: ${hookResult.failures.join('; ')}`,
        stageContextKnown: true,
        gateFailureExists: true,
        blockerOwnershipLocked: true,
        rootTargetLocked: true,
        equivalentAdapterCount: 1,
        attemptId: 'pre-continue-retry-01',
        sourceGateFailureIds: hookResult.failures.map((_, index) => `ARCHITECTURE-CONTRACT-GATE-${index + 1}`),
        capabilitySlot: `${hookResult.workflow}.${hookResult.step}`,
        canonicalAgent: 'Governance Gate Runner',
        actualExecutor: 'pre-continue-check',
        adapterPath: '_bmad/runtime/hooks/pre-continue-check.cjs',
        targetArtifacts: [hookResult.artifactPath],
        expectedDelta: 'repair governed contract sections before Continue',
        rerunOwner: 'PM',
        rerunGate: hookResult.gate,
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

  it('worker leaves pre-continue queue items untouched after the hard cut', async () => {
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

      await processQueue(project, {
        allowAutonomousFallback: true,
        dispatchAdapter: createAcceptedPlaceholderDispatchAdapter('pre-continue placeholder dispatch'),
      });

      const stageEventDir = join(
        project,
        '_bmad-output',
        'runtime',
        'governance',
        'queue',
        'pending-events'
      );
      expect(existsSync(stageEventDir)).toBe(false);

      const currentRun = readGovernanceCurrentRun<GovernanceExecutionResult>(project);
      expect(currentRun.length).toBe(0);
      expect(existsSync(join(project, '_bmad-output', 'runtime', 'governance', 'queue', 'pending', 'pc-1.json'))).toBe(true);
    } finally {
      rmSync(project, { recursive: true, force: true });
    }
  });
});
