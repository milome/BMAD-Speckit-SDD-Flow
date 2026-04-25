import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { RecommendationPacket } from '../../scripts/orchestration-dispatch-contract';
import {
  claimMainAgentPendingPacket,
  completeMainAgentPendingPacket,
  invalidateMainAgentPendingPacket,
  mainMainAgentOrchestration,
  markMainAgentPacketDispatched,
  resolveMainAgentOrchestrationSurface,
} from '../../scripts/main-agent-orchestration';
import {
  createDefaultOrchestrationState,
  writeOrchestrationState,
} from '../../scripts/orchestration-state';
import {
  defaultRuntimeContextFile,
  writeRuntimeContext,
} from '../../scripts/runtime-context';
import {
  defaultRuntimeContextRegistry,
  readRuntimeContextRegistry,
  writeRuntimeContextRegistry,
} from '../../scripts/runtime-context-registry';
import { resolveBmadHelpRuntimePolicy } from '../../scripts/bmad-config';
import { runAuditorHost } from '../../scripts/run-auditor-host';

function writePacket(root: string, sessionId: string, packet: RecommendationPacket): string {
  const packetPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'packets',
    sessionId,
    `${packet.packetId}.json`
  );
  mkdirSync(path.dirname(packetPath), { recursive: true });
  writeFileSync(packetPath, JSON.stringify(packet, null, 2), 'utf8');
  return packetPath;
}

describe('main-agent orchestration consumer', () => {
  it('prefers orchestration-state and recommendation packet over verdict-only routing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-orch-state-'));
    try {
      const sessionId = 'story-14.1';
      const packet: RecommendationPacket = {
        packetId: 'pkt-main-agent-01',
        parentSessionId: sessionId,
        flow: 'story',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['spec.md'],
        allowedWriteScope: ['src/**', 'tests/**'],
        expectedDelta: 'repair readiness blockers',
        successCriteria: ['rerun gate can pass'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, sessionId, packet);
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.1',
          runId: 'run-14-1',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.1',
          updatedAt: new Date().toISOString(),
        })
      );
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: new Date().toISOString(),
          },
        })
      );

      const state = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(state.source).toBe('orchestration_state');
      expect(state.sessionId).toBe(sessionId);
      expect(state.pendingPacketStatus).toBe('ready_for_main_agent');
      expect(state.pendingPacket).toMatchObject({
        packetId: packet.packetId,
        recommendedTaskType: 'remediate',
      });
      expect(state.latestGate?.decision).toBe('auto_repairable_block');
      expect(state.mainAgentNextAction).toBe('dispatch_remediation');
      expect(state.mainAgentReady).toBe(true);

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(policy.mainAgentOrchestration.source).toBe('orchestration_state');
      expect(policy.mainAgentOrchestration.pendingPacketStatus).toBe('ready_for_main_agent');
      expect(policy.helpRouting.mainAgentOrchestration.pendingPacketStatus).toBe(
        'ready_for_main_agent'
      );
      expect(policy.mainAgentNextAction).toBe('dispatch_remediation');
      expect(policy.mainAgentReady).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('drives the packet lifecycle through claim, dispatch, complete, and invalidate transitions', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-packet-lifecycle-'));
    try {
      const sessionId = 'bugfix-run-01';
      const packet: RecommendationPacket = {
        packetId: 'pkt-bugfix-01',
        parentSessionId: sessionId,
        flow: 'bugfix',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['BUGFIX_demo.md'],
        allowedWriteScope: ['src/**'],
        expectedDelta: 'repair bugfix blockers',
        successCriteria: ['bugfix audit passes'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, sessionId, packet);
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'claude',
          flow: 'bugfix',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: new Date().toISOString(),
          },
        })
      );

      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('ready_for_main_agent');

      claimMainAgentPendingPacket(root, sessionId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      markMainAgentPacketDispatched(root, sessionId, packet.packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('dispatched');

      completeMainAgentPendingPacket(root, sessionId, packet.packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('completed');

      invalidateMainAgentPendingPacket(root, sessionId, packet.packetId);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'bugfix',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('invalidated');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('exposes a repo-native CLI surface for main-agent packet lifecycle operations', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-cli-surface-'));
    try {
      const sessionId = 'story-14.5';
      const packet: RecommendationPacket = {
        packetId: 'pkt-cli-01',
        parentSessionId: sessionId,
        flow: 'story',
        phase: 'implement',
        recommendedRole: 'remediation-worker',
        recommendedTaskType: 'remediate',
        inputArtifacts: ['spec.md'],
        allowedWriteScope: ['src/**'],
        expectedDelta: 'repair blockers',
        successCriteria: ['gate can rerun'],
        stopConditions: ['true blocker detected'],
      };
      const packetPath = writePacket(root, sessionId, packet);
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.5',
          runId: 'run-14-5',
          updatedAt: new Date().toISOString(),
        })
      );
      writeOrchestrationState(
        root,
        createDefaultOrchestrationState({
          sessionId,
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_remediation',
          pendingPacket: {
            packetId: packet.packetId,
            packetPath,
            packetKind: 'recommendation',
            status: 'ready_for_main_agent',
            createdAt: new Date().toISOString(),
          },
        })
      );

      expect(mainMainAgentOrchestration(['--cwd', root, '--action', 'claim'])).toBe(0);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('claimed_by_main_agent');

      expect(mainMainAgentOrchestration(['--cwd', root, '--action', 'dispatch'])).toBe(0);
      expect(
        resolveMainAgentOrchestrationSurface({
          projectRoot: root,
          flow: 'story',
          stage: 'implement',
        }).pendingPacketStatus
      ).toBe('dispatched');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads implementation-entry gate from registry when no explicit gate is passed in', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-registry-gate-'));
    try {
      const registry = defaultRuntimeContextRegistry(root);
      registry.implementationEntryIndex.story['run-14-3'] = {
        gateName: 'implementation-readiness',
        requestedFlow: 'story',
        recommendedFlow: 'story',
        decision: 'reroute',
        readinessStatus: 'repair_closed',
        blockerCodes: ['manual-reroute'],
        blockerSummary: ['This run must return to the user before continuing.'],
        rerouteRequired: true,
        rerouteReason: 'manual-reroute',
        evidenceSources: {
          readinessReportPath: null,
          remediationArtifactPath: null,
          executionRecordPath: null,
          authoritativeAuditReportPath: null,
        },
        semanticFingerprint: 'run-14-3',
        evaluatedAt: new Date().toISOString(),
      };
      writeRuntimeContextRegistry(root, registry);
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.3',
          runId: 'run-14-3',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.3',
          updatedAt: new Date().toISOString(),
        })
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(surface.source).toBe('implementation_entry_gate');
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
      expect(surface.latestGate?.decision).toBe('reroute');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('uses fourSignal and gatesLoop to block continuation even when the stored nextAction looks runnable', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-four-signal-loop-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'implement',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.4',
          runId: 'run-14-4',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.4',
          updatedAt: new Date().toISOString(),
        })
      );
      writeOrchestrationState(
        root,
        {
          version: 1,
          sessionId: 'run-14-4',
          host: 'cursor',
          flow: 'story',
          currentPhase: 'implement',
          nextAction: 'dispatch_implement',
          pendingPacket: null,
          originalExecutionPacketId: null,
          fourSignal: {
            latestStatus: 'block',
            latestHits: ['smoke_task_chain'],
            driftDetected: true,
            missingEvidence: false,
          },
          latestGate: {
            gateId: 'implementation-readiness',
            decision: 'pass',
            reason: 'readiness previously passed',
          },
          gatesLoop: {
            retryCount: 2,
            maxRetries: 3,
            noProgressCount: 2,
            circuitOpen: true,
            rerunGate: 'implementation-readiness',
            activePacketId: 'pkt-loop-01',
            lastResult: 'no-progress',
          },
          closeout: {
            invoked: false,
            approved: false,
            scoreWriteResult: null,
            handoffPersisted: false,
            resultCode: null,
          },
        }
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'implement',
      });

      expect(surface.fourSignal?.latestStatus).toBe('block');
      expect(surface.gatesLoop?.circuitOpen).toBe(true);
      expect(surface.mainAgentCanContinue).toBe(false);
      expect(surface.continueDecision).toBe('blocked');
      expect(surface.mainAgentNextAction).toBe('await_user');
      expect(surface.mainAgentReady).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('surfaces raw drift fields from latestReviewerCloseout to the main-agent surface', async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'main-agent-drift-surface-'));
    try {
      writeRuntimeContextRegistry(root, defaultRuntimeContextRegistry(root));
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'post_audit',
          sourceMode: 'full_bmad',
          contextScope: 'story',
          storyId: '14.2',
          runId: 'run-14-2',
          artifactRoot: '_bmad-output/implementation-artifacts/epic-14/story-14.2',
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
              drift_signals: ['smoke_task_chain'],
              drifted_dimensions: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
              readiness_baseline_run_id: 'readiness-14-2',
            },
          }),
        }
      );

      const surface = resolveMainAgentOrchestrationSurface({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
      });

      expect(surface.closeout?.driftSeverity).toBe('critical');
      expect(surface.drift).toMatchObject({
        driftSignals: ['smoke_task_chain'],
        driftedDimensions: ['Smoke E2E Readiness', 'P0 Journey Coverage'],
        driftSeverity: 'critical',
        effectiveVerdict: 'blocked',
        reReadinessRequired: true,
        readinessBaselineRunId: 'readiness-14-2',
      });

      const registry = readRuntimeContextRegistry(root);
      expect(registry.latestReviewerCloseout).toMatchObject({
        driftSeverity: 'critical',
        effectiveVerdict: 'blocked',
        driftSignals: ['smoke_task_chain'],
      });

      const policy = resolveBmadHelpRuntimePolicy({
        projectRoot: root,
        flow: 'story',
        stage: 'post_audit',
      });
      expect(policy.mainAgentOrchestration.drift?.driftSignals).toEqual(['smoke_task_chain']);
      expect(policy.helpRouting.mainAgentOrchestration.drift?.effectiveVerdict).toBe('blocked');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
