import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  type NativeGoalSpawnSyncFn,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeFakeReqTraceSkill,
} from '../helpers/requirement-fixture-runtime';

type RequirementFixture = ReturnType<typeof materializeRequirementFixture>;

function materializeNativeGoalFixture(
  input: Parameters<typeof materializeRequirementFixture>[0] = {}
): RequirementFixture {
  const fixture = materializeRequirementFixture(input);
  writeFakeReqTraceSkill(fixture.root);
  return fixture;
}

function runLoopArgs(fixture: RequirementFixture) {
  return {
    projectRoot: fixture.root,
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    runId: fixture.runId,
    flow: 'standalone_tasks' as const,
    stage: 'implement',
    host: 'codex' as const,
  };
}

function taskReportPath(root: string, sessionId: string, packetId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    sessionId,
    `${packetId}.json`
  );
}

function writeDoneTaskReport(root: string, sessionId: string, packetId: string): string {
  const reportPath = taskReportPath(root, sessionId, packetId);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        packetId,
        status: 'done',
        filesChanged: ['packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration.ts'],
        validationsRun: ['native-goal-rerun-loop-success'],
        evidence: ['native goal rerun loop success TaskReport'],
        downstreamContext: ['native goal progress restored'],
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  return reportPath;
}

function appendOpenRerunLoop(fixture: RequirementFixture): void {
  const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
  record.rerunLoops = [
    ...(Array.isArray(record.rerunLoops) ? record.rerunLoops : []),
    {
      rerunLoopId: 'rerun-native-open',
      status: 'open',
      sourceRefs: [{ sourceType: 'execution_iteration', id: 'exec-native-failed' }],
      blockerRefs: [{ sourceType: 'failure_record', id: 'failure-native-failed' }],
    },
  ];
  fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

describe('main-agent native goal rerun loop behavior', () => {
  it('blocks for main-session execution even when a native command mock would exit non-zero', () => {
    const fixture = materializeNativeGoalFixture();
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        nativeGoalSpawnSyncFn: () => ({
          status: 1,
          stdout: '',
          stderr: 'native goal failed',
        }),
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport?.status).toBe('blocked');
      expect(result.taskReport?.validationsRun).toContain('main-session-native-goal-preparation');
      expect(result.taskReport?.driftFlags).toContain('main-session-native-goal-required');
      expect(result.finalSurface.orchestrationState?.lastTaskReport?.status).toBe('blocked');
      expect(result.finalSurface.orchestrationState?.gatesLoop?.noProgressCount).toBe(1);
      expect(result.finalSurface.orchestrationState?.gatesLoop?.circuitOpen).toBe(false);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('records no progress until the main session writes the prepared native goal TaskReport', () => {
    const fixture = materializeNativeGoalFixture();
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        nativeGoalSpawnSyncFn: () => ({
          status: 0,
          stdout: 'no task report',
          stderr: '',
        }),
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport?.status).toBe('blocked');
      expect(result.taskReport?.validationsRun).toContain('main-session-native-goal-preparation');
      expect(result.taskReport?.driftFlags).toContain('main-session-native-goal-required');
      expect(result.finalSurface.orchestrationState?.gatesLoop?.lastResult).toBe(
        'task-report:blocked'
      );
      expect(result.finalSurface.orchestrationState?.gatesLoop?.noProgressCount).toBe(1);
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('opens the gates loop circuit after two native goal no-progress cycles', () => {
    const fixture = materializeNativeGoalFixture();
    const missingTaskReport: NativeGoalSpawnSyncFn = () => ({
      status: 0,
      stdout: 'still no task report',
      stderr: '',
    });
    try {
      const first = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        nativeGoalSpawnSyncFn: missingTaskReport,
      });
      expect(first.finalSurface.orchestrationState?.gatesLoop?.circuitOpen).toBe(false);

      const second = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        nativeGoalSpawnSyncFn: missingTaskReport,
      });
      expect(second.status).toBe('blocked');
      expect(second.finalSurface.orchestrationState?.gatesLoop?.noProgressCount).toBe(2);
      expect(second.finalSurface.orchestrationState?.gatesLoop?.circuitOpen).toBe(true);
      expect(second.finalSurface.mainAgentNextAction).toBe('await_user');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('routes an existing open rerun loop to dispatch_remediation', () => {
    const fixture = materializeNativeGoalFixture();
    try {
      appendOpenRerunLoop(fixture);
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        executor: ({ instruction }) => {
          expect(instruction.taskType).toBe('remediate');
          return {
            packetId: instruction.packetId,
            status: 'blocked',
            filesChanged: [],
            validationsRun: ['open-rerun-remediation-route'],
            evidence: ['open rerun routed to remediation'],
            downstreamContext: [instruction.expectedDelta],
          };
        },
      });

      expect(result.dispatchInstruction?.nextAction).toBe('dispatch_remediation');
      expect(result.dispatchInstruction?.taskType).toBe('remediate');
      expect(result.status).toBe('blocked');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('resets gates loop progress after the main session returns a done TaskReport', () => {
    const fixture = materializeNativeGoalFixture();
    try {
      const failed = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        nativeGoalSpawnSyncFn: () => ({ status: 1, stdout: '', stderr: 'first failed' }),
      });
      expect(failed.finalSurface.orchestrationState?.gatesLoop?.noProgressCount).toBe(1);

      const success = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        executor: ({ projectRoot, instruction }) => {
          const reportPath = writeDoneTaskReport(
            projectRoot,
            instruction.sessionId,
            instruction.packetId
          );
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(success.status).toBe('completed');
      expect(success.taskReport?.status).toBe('done');
      expect(success.finalSurface.orchestrationState?.gatesLoop?.noProgressCount).toBe(0);
      expect(success.finalSurface.orchestrationState?.gatesLoop?.circuitOpen).toBe(false);
      expect(success.finalSurface.pendingPacketStatus).toBe('completed');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });
});
