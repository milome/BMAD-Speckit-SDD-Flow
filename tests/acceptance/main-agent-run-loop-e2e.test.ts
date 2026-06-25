import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../scripts/runtime-context';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeFakeReqTraceSkill,
} from '../helpers/requirement-fixture-runtime';

type RequirementFixture = ReturnType<typeof materializeRequirementFixture>;

function materializeRunLoopFixture(
  input: Parameters<typeof materializeRequirementFixture>[0] = {}
): RequirementFixture {
  const fixture = materializeRequirementFixture(input);
  writeFakeReqTraceSkill(fixture.root);
  return fixture;
}

function runLoopArgs(fixture: RequirementFixture): {
  projectRoot: string;
  recordId: string;
  requirementSetId: string;
  runId: string;
  flow: 'standalone_tasks';
  stage: 'implement';
} {
  return {
    projectRoot: fixture.root,
    recordId: fixture.recordId,
    requirementSetId: fixture.requirementSetId,
    runId: fixture.runId,
    flow: 'standalone_tasks',
    stage: 'implement',
  };
}

function cliRecordArgs(fixture: RequirementFixture): string[] {
  return [
    '--record-id',
    fixture.recordId,
    '--requirement-set-id',
    fixture.requirementSetId,
    '--run-id',
    fixture.runId,
    '--flow',
    'standalone_tasks',
    '--stage',
    'implement',
  ];
}

function packageMainAgentCliArgs(args: string[]): string[] {
  return [
    path.join(process.cwd(), 'packages', 'bmad-speckit', 'bin', 'bmad-speckit.js'),
    'main-agent-orchestration',
    '--json',
    ...args,
  ];
}

function parsePackageOrLegacyJson<T>(stdout: string): T {
  const parsed = JSON.parse(stdout) as { data?: unknown };
  return (parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed) as T;
}

function writeCodexImplementationWorker(root: string): void {
  fs.mkdirSync(path.join(root, '.codex', 'agents'), { recursive: true });
  for (const name of [
    'implementation-worker',
    'code-reviewer',
    'remediation-worker',
    'document-worker',
  ]) {
    fs.writeFileSync(
      path.join(root, '.codex', 'agents', `${name}.toml`),
      [
        `name = "${name}"`,
        `description = "Test ${name}"`,
        'sandbox_mode = "workspace-write"',
        'developer_instructions = """Follow dispatch packet instructions."""',
        '',
      ].join('\n'),
      'utf8'
    );
  }
}

function nativeGoalPacketIdFromArgs(args: string[]): string {
  const commandText = args.find((arg) => arg.startsWith('/goal ')) ?? '';
  const match = commandText.match(/trace-execution[\\/]+([^\\/]+)[\\/]+goal_execution\.md/u);
  if (!match) {
    throw new Error(`unable to resolve packet id from native goal args: ${commandText}`);
  }
  return match[1];
}

function writeNativeGoalTaskReport(root: string, sessionId: string, packetId: string, prefix: string) {
  const reportPath = path.join(
    root,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    sessionId,
    `${packetId}.json`
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        packetId,
        status: 'done',
        filesChanged: [],
        validationsRun: [`${prefix}-native-goal`],
        evidence: [`${prefix}-native-goal-task-report`],
        downstreamContext: [`${prefix} native goal completed`],
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

describe('main-agent automatic run-loop', () => {
  it('executes inspect dispatch claim dispatch report complete and final inspect from one call', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        executor: ({ projectRoot, instruction, args }) => {
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(result.status).toBe('completed');
      expect(result.steps.map((step) => step.step)).toEqual([
        'inspect.initial',
        'dispatch-plan',
        'claim',
        'long-run-policy.attach',
        'dispatch',
        'task-report.ingest',
        'inspect.final',
      ]);
      expect(result.finalSurface.pendingPacketStatus).toBe('completed');
      expect(result.finalSurface.orchestrationState?.longRun?.policyHash).toBeTruthy();
      expect(result.finalSurface.orchestrationState?.longRun?.active_host_mode).toBe('cursor');
      expect(result.finalSurface.orchestrationState?.lastTaskReport?.status).toBe('done');
      expect(result.finalSurface.mainAgentNextAction).toBe('run_execution_closure_gate');
      expect(result.mainAgentStageSummary).toMatchObject({
        schemaVersion: 'main-agent-stage-summary/v1',
        nextAction: 'run_execution_closure_gate',
        ready: true,
      });
      expect(result.mainAgentStageSummary?.userFacingMessage).toContain('下一步');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('resolves active requirement record instead of flat legacy runtime-context fallback', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      writeRuntimeContext(
        root,
        defaultRuntimeContextFile({
          flow: 'story',
          stage: 'story_create',
          sourceMode: 'full_bmad',
          contextScope: 'project',
          runId: 'flat-project-run',
        })
      );

      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        executor: ({ projectRoot, instruction, args }) => {
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(result.dispatchInstruction?.sessionId).toBe(fixture.requirementSetId);
      expect(result.finalSurface.orchestrationState?.currentPhase).toBe('implement');
      expect(result.mainAgentStageSummary?.currentMentalModel).toBe('implementation_readiness');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('blocks instead of synthesizing completion when no real task report is provided', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
      });

      expect(result.status).toBe('blocked');
      expect(result.steps.at(-1)).toMatchObject({
        step: 'task-report.load',
        status: 'fail',
      });
      expect(result.finalSurface.pendingPacketStatus).toBe('dispatched');
      expect(result.finalSurface.orchestrationState?.lastTaskReport ?? null).toBeNull();
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('preserves codex as the host through dispatch state and final inspect', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        executor: ({ projectRoot, instruction, args }) => {
          expect(instruction.host).toBe('codex');
          expect(instruction.route.tool).toBe('codex');
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, args);
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });

      expect(result.status).toBe('completed');
      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.finalSurface.orchestrationState?.host).toBe('codex');
      expect(result.finalSurface.orchestrationState?.longRun?.active_host_mode).toBe('codex');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('uses the Codex worker adapter by default for codex host run-loop instead of synthetic TaskReport', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      writeCodexImplementationWorker(root);

      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        args: { codexSmoke: 'true' },
      });

      expect(result.status).toBe('blocked');
      expect(result.steps.some((step) => step.step === 'codex-worker-adapter')).toBe(true);
      expect(result.taskReport?.validationsRun).toContain('codex-worker-adapter-smoke');
      expect(result.taskReport?.validationsRun).not.toContain('main-agent:run-loop-task-report');
      expect(result.taskReport?.driftFlags).toContain('codex-smoke-non-delivery-evidence');
      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.finalSurface.pendingPacketStatus).toBe('invalidated');
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('accepts dispatch-plan as a positional CLI action without treating it as cwd', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const dispatchOutput = execFileSync(
        process.execPath,
        packageMainAgentCliArgs([
          '--action',
          'dispatch-plan',
          '--cwd',
          root,
          ...cliRecordArgs(fixture),
        ]),
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      const dispatch = parsePackageOrLegacyJson<{ taskType: string; packetId: string }>(dispatchOutput);

      expect(dispatch.taskType).toBe('implement');
      expect(dispatch.packetId).toMatch(/^implement-/);
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('does not advance blocked implementation task reports to review', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        executor: ({ instruction }) => ({
          packetId: instruction.packetId,
          status: 'blocked',
          filesChanged: [],
          validationsRun: ['blocked-implementation-worker'],
          evidence: ['implementation worker blocked before producing code'],
          downstreamContext: [instruction.expectedDelta],
        }),
      });

      expect(result.status).toBe('blocked');
      expect(result.finalSurface.pendingPacketStatus).toBe('invalidated');
      expect(result.finalSurface.orchestrationState?.lastTaskReport?.status).toBe('blocked');
      expect(result.finalSurface.mainAgentNextAction).not.toBe('dispatch_review');
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('prepares Codex native goal for main-session execution without running a worker subprocess', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalSpawnSyncFn: (_command, args) => {
          const packetId = nativeGoalPacketIdFromArgs(args);
          writeNativeGoalTaskReport(root, fixture.requirementSetId, packetId, 'fake-codex');
          return { status: 0, stdout: 'native goal completed', stderr: '' };
        },
      });

      expect(result.status).toBe('blocked');
      expect(result.steps.find((step) => step.step === 'native-goal-invocation')?.summary).toContain(
        'command=main-session-native-goal'
      );
      expect(result.steps.some((step) => step.step === 'codex-worker-adapter')).toBe(false);
      expect(result.taskReport?.status).toBe('blocked');
      expect(result.taskReport?.validationsRun).toContain('main-session-native-goal-preparation');
      expect(result.taskReport?.driftFlags).toContain('main-session-native-goal-required');
      expect(result.taskReport?.validationsRun).not.toContain('codex-worker-adapter-smoke');
      expect(result.taskReport?.validationsRun).not.toContain('main-agent:run-loop-task-report');
      expect(result.finalSurface.pendingPacketStatus).toBe('invalidated');
      expect(result.finalSurface.mainAgentNextAction).toBe('dispatch_implement');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('does not materialize a review dispatch instruction before execution closure passes', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const remediate = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        executor: ({ projectRoot, instruction, args }) => {
          expect(instruction.taskType).toBe('implement');
          const reportPath = writeMainAgentRunLoopTaskReport(projectRoot, instruction, {
            ...args,
            reportStatus: 'done',
          });
          return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        },
      });
      expect(remediate.finalSurface.mainAgentNextAction).toBe('run_execution_closure_gate');

      const next = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
      });

      expect(next.status).toBe('blocked');
      expect(next.dispatchInstruction).toBeNull();
      expect(next.steps.at(-1)).toMatchObject({
        step: 'dispatch-plan',
        status: 'fail',
      });
      expect(next.finalSurface.mainAgentNextAction).toBe('run_execution_closure_gate');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('continues rerun_gate remediation through main-session native goal blockers', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    try {
      const remediate = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalSpawnSyncFn: () => ({ status: 1, stdout: '', stderr: 'native failed' }),
      });
      expect(remediate.status).toBe('blocked');
      expect(remediate.dispatchInstruction?.taskType).toBe('implement');
      expect(remediate.taskReport?.validationsRun).toContain('main-session-native-goal-preparation');
      expect(remediate.taskReport?.driftFlags).toContain('main-session-native-goal-required');
      expect(remediate.finalSurface.mainAgentNextAction).toBe('dispatch_implement');

      const review = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalSpawnSyncFn: () => ({ status: 1, stdout: '', stderr: 'native failed again' }),
      });
      expect(review.status).toBe('blocked');
      expect(review.dispatchInstruction?.taskType).toBe('implement');
      expect(review.dispatchInstruction?.nextAction).toBe('dispatch_implement');
      expect(review.steps.find((step) => step.step === 'native-goal-invocation')?.summary).toContain(
        'command=main-session-native-goal'
      );
      expect(review.finalSurface.orchestrationState?.host).toBe('codex');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('CLI --taskReportPath ingests an existing report without overwriting it', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    const previousAllow = process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
    try {
      process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT = 'true';

      const dispatchOutput = execFileSync(
        process.execPath,
        packageMainAgentCliArgs([
          '--cwd',
          root,
          '--action',
          'dispatch-plan',
          ...cliRecordArgs(fixture),
        ]),
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      const dispatch = parsePackageOrLegacyJson<{ packetId: string }>(dispatchOutput);
      const reportPath = path.join(
        root,
        '_bmad-output',
        'runtime',
        'evidence',
        'external-task-report.json'
      );
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(
        reportPath,
        JSON.stringify(
          {
            packetId: dispatch.packetId,
            status: 'done',
            filesChanged: ['tests/external-real-report.test.ts'],
            validationsRun: ['external-real-validation'],
            evidence: ['external-real-evidence'],
            downstreamContext: ['external task report must not be overwritten'],
          },
          null,
          2
        ) + '\n',
        'utf8'
      );

      const resultProcess = spawnSync(
        process.execPath,
        packageMainAgentCliArgs([
          '--cwd',
          root,
          '--action',
          'run-loop',
          ...cliRecordArgs(fixture),
          '--taskReportPath',
          reportPath,
        ]),
        { cwd: process.cwd(), encoding: 'utf8' }
      );
      expect(resultProcess.status).toBe(0);
      const result = parsePackageOrLegacyJson<{
        status: string;
        taskReport: { validationsRun: string[]; evidence: string[] };
      }>(resultProcess.stdout);
      const after = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        validationsRun: string[];
        evidence: string[];
      };

      expect(result.status).toBe('completed');
      expect(result.taskReport.validationsRun).toEqual(['external-real-validation']);
      expect(result.taskReport.evidence).toEqual(['external-real-evidence']);
      expect(after.validationsRun).toEqual(['external-real-validation']);
      expect(after.evidence).toEqual(['external-real-evidence']);
    } finally {
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
      } else {
        process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT = previousAllow;
      }
      cleanupRequirementWorkspace(root);
    }
  });

  it('CLI --taskReportPath fails closed by default without explicit test authorization', () => {
    const fixture = materializeRunLoopFixture();
    const root = fixture.root;
    const previousAllow = process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
    try {
      delete process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
      const reportPath = path.join(root, 'external-report.json');
      fs.writeFileSync(
        reportPath,
        JSON.stringify({
          packetId: 'placeholder',
          status: 'done',
          filesChanged: [],
          validationsRun: ['external'],
          evidence: ['external'],
          downstreamContext: [],
        }) + '\n',
        'utf8'
      );

      const resultProcess = spawnSync(
        process.execPath,
        packageMainAgentCliArgs([
          '--cwd',
          root,
          '--action',
          'run-loop',
          ...cliRecordArgs(fixture),
          '--taskReportPath',
          reportPath,
        ]),
        { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }
      );
      expect(resultProcess.status).toBe(1);
      const result = parsePackageOrLegacyJson<{
        status: string;
        taskReport?: { status: string; driftFlags?: string[] };
      }>(resultProcess.stdout);
      expect(result.status).toBe('blocked');
      expect(result.taskReport?.status).toBe('blocked');
      expect(result.taskReport?.driftFlags).toContain('external-task-report-denied');
    } finally {
      if (previousAllow === undefined) {
        delete process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
      } else {
        process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT = previousAllow;
      }
      cleanupRequirementWorkspace(root);
    }
  });
});
