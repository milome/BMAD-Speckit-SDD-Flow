import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importNativeGoalTaskReport,
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { createDefaultOrchestrationState, writeOrchestrationStateAtPath } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-state';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeCompiledImplementPacket,
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

function prepareNativeGoalImportFixture(
  fixture: RequirementFixture,
  input: { packetId?: string; sourceHash?: string } = {}
) {
  const packetId = input.packetId ?? 'implement-native-goal-current';
  const compiled = writeCompiledImplementPacket({ root: fixture.root, fixture, packetId });
  const modelPacket = JSON.parse(fs.readFileSync(compiled.compiledPromptRef.modelPacketPath, 'utf8'));
  modelPacket.requiredCommands = [{ id: 'CMD-NATIVE-GOAL', command: 'npm test -- --native-goal' }];
  fs.writeFileSync(
    compiled.compiledPromptRef.modelPacketPath,
    `${JSON.stringify(modelPacket, null, 2)}\n`,
    'utf8'
  );
  compiled.packet.compiledPromptRef.taskReportPath = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    fixture.requirementSetId,
    `${packetId}.json`
  );
  compiled.packet.compiledPromptRef.sourceDocumentHash = input.sourceHash ?? fixture.sourceDocumentHash;
  compiled.packet.compiledPromptRef.modelPacketHash = `sha256:test-${packetId}`;
  fs.writeFileSync(compiled.packetPath, `${JSON.stringify(compiled.packet, null, 2)}\n`, 'utf8');
  const state = createDefaultOrchestrationState({
    sessionId: fixture.requirementSetId,
    host: 'codex',
    flow: 'standalone_tasks',
    currentPhase: 'implement',
    nextAction: 'dispatch_implement',
    pendingPacket: {
      packetId,
      packetPath: compiled.packetPath,
      packetKind: 'execution',
      status: 'dispatched',
      createdAt: '2026-05-30T00:00:00.000Z',
      claimOwner: null,
    },
  });
  writeOrchestrationStateAtPath(
    path.join(
      fixture.root,
      '_bmad-output',
      'runtime',
      'requirement-records',
      fixture.requirementSetId,
      'orchestration',
      'orchestration-state',
      `${fixture.requirementSetId}.json`
    ),
    state
  );
  return compiled;
}

function writeImportTaskReport(
  reportPath: string,
  packetId: string,
  overrides: Partial<{
    packetId: string;
    status: 'done' | 'partial' | 'blocked';
    filesChanged: string[];
    validationsRun: string[];
    evidence: string[];
    downstreamContext: string[];
  }> = {}
) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        packetId,
        status: 'done',
        filesChanged: ['tests/native-goal-result.test.ts'],
        validationsRun: ['CMD-NATIVE-GOAL passed'],
        evidence: ['native-goal-task-report-evidence'],
        downstreamContext: ['native goal completed in main session'],
        ...overrides,
      },
      null,
      2
    )}\n`,
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
        host: 'cursor',
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
        host: 'cursor',
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

  it('routes run_closeout through delivery closeout instead of stale dispatch_review projection', () => {
    const fixture = materializeRunLoopFixture({
      currentMentalModel: 'audit_review',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
        audit_review: { status: 'pass' },
      },
      orchestrationNextAction: 'dispatch_review',
      pendingPacket: {
        packetId: 'audit-stale',
        packetKind: 'execution',
        status: 'invalidated',
      },
      lastTaskReport: {
        packetId: 'audit-stale',
        status: 'done',
      },
    });
    const root = fixture.root;
    try {
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8')) as Record<
        string,
        unknown
      >;
      record.deliveryEvidence = {
        requiredCommands: [
          {
            commandId: 'CMD-CURRENT',
            command: 'node -e "process.exit(0)"',
            blockingIfMissing: true,
            negativeOrRegression: true,
            closeoutAttemptId: 'implement-current',
            lastRunRef: {
              commandId: 'CMD-CURRENT',
              runId: 'implement-current',
              closeoutAttemptId: 'implement-current',
            },
          },
        ],
      };
      record.executionIterations = [
        {
          executionIterationId: 'exec-current',
          commandRunRefs: [
            {
              commandId: 'CMD-CURRENT',
              runId: 'implement-current',
              closeoutAttemptId: 'implement-current',
              exitCode: 0,
            },
          ],
        },
      ];
      fs.writeFileSync(fixture.recordPath, JSON.stringify(record, null, 2) + '\n', 'utf8');

      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
      });

      expect(result.status).toBe('blocked');
      expect(result.dispatchInstruction).toBeNull();
      expect(result.steps.map((step) => step.step)).not.toContain('dispatch-plan');
      expect(result.steps).toContainEqual(
        expect.objectContaining({
          step: 'delivery-closeout',
          status: 'fail',
        })
      );
      expect(result.taskReport).toMatchObject({
        packetId: 'implement-current',
        status: 'blocked',
      });
      expect(result.taskReport?.validationsRun).toContain('main-agent:delivery-closeout-gate');
      expect(
        result.taskReport?.evidence.some((entry) =>
          entry.includes('delivery-closeout-report.json')
        )
      ).toBe(true);
      expect(result.finalSurface.mainAgentStageSummary?.nextMentalModel).toBe(
        'delivery_confirmation'
      );
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('reuses evidence-bound closeout attempt even after an earlier blocked closeout check', () => {
    const fixture = materializeRunLoopFixture({
      currentMentalModel: 'audit_review',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
        audit_review: { status: 'pass' },
      },
    });
    const root = fixture.root;
    try {
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8')) as Record<
        string,
        unknown
      >;
      record.closeout = {
        currentAttemptId: 'closeout-stale',
        attempts: [
          {
            closeoutAttemptId: 'implement-current',
            decision: 'blocked',
            blockingReasons: ['delivery_truth_gate_not_passed'],
          },
        ],
      };
      record.deliveryEvidence = {
        requiredCommands: [
          {
            commandId: 'CMD-CURRENT',
            command: 'node -e "process.exit(0)"',
            blockingIfMissing: true,
            negativeOrRegression: true,
            closeoutAttemptId: 'implement-current',
            lastRunRef: {
              commandId: 'CMD-CURRENT',
              runId: 'implement-current',
              closeoutAttemptId: 'implement-current',
            },
          },
        ],
      };
      record.executionIterations = [
        {
          executionIterationId: 'exec-current',
          commandRunRefs: [
            {
              commandId: 'CMD-CURRENT',
              runId: 'implement-current',
              closeoutAttemptId: 'implement-current',
              exitCode: 0,
            },
          ],
        },
      ];
      fs.writeFileSync(fixture.recordPath, JSON.stringify(record, null, 2) + '\n', 'utf8');

      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
      });

      expect(result.status).toBe('blocked');
      expect(result.steps).toContainEqual(
        expect.objectContaining({
          step: 'delivery-closeout',
          status: 'fail',
        })
      );
      expect(result.taskReport).toMatchObject({
        packetId: 'implement-current',
        status: 'blocked',
      });
      expect(result.taskReport?.driftFlags ?? []).not.toContain(
        'deliveryEvidence.requiredCommands_current_attempt_missing'
      );
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

  it('imports a valid native goal TaskReport through controlled ingest evidence', () => {
    const fixture = materializeRunLoopFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    const root = fixture.root;
    try {
      const compiled = prepareNativeGoalImportFixture(fixture);
      const taskReportPath = compiled.packet.compiledPromptRef.taskReportPath!;
      writeImportTaskReport(taskReportPath, compiled.packet.packetId);

      const imported = importNativeGoalTaskReport({
        projectRoot: root,
        flow: 'standalone_tasks',
        stage: 'implement',
        recordId: fixture.recordId,
        requirementSetId: fixture.requirementSetId,
        runId: fixture.runId,
        taskReportPath,
      });
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));

      expect(imported).toMatchObject({
        status: 'imported',
        controlledIngested: true,
        packetId: compiled.packet.packetId,
      });
      expect(record.nativeGoalHandoff).toMatchObject({
        packetId: compiled.packet.packetId,
        imported: true,
        importStatus: 'task_report_done',
        returnAction: 'import-native-goal-task-report',
      });
      expect(record.executionIterations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            eventType: 'execution_iteration_recorded',
            executionIterationId: compiled.packet.packetId,
            sourceDocumentHash: fixture.sourceDocumentHash,
          }),
        ])
      );
      expect(record.requirementClosures).toEqual([
        expect.objectContaining({
          eventType: 'requirement_closure_recorded',
          requirementId: fixture.recordId,
          status: 'pass',
        }),
      ]);
      expect(record.artifactIndex).toHaveLength(1);
      expect(record.artifactIndex[0]).toMatchObject({
        artifactType: 'native_goal_task_report',
      });
      expect(path.normalize(record.artifactIndex[0].path)).toBe(path.normalize(taskReportPath));
      expect(record.deliveryEvidence.requiredCommands).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commandId: 'CMD-NATIVE-GOAL',
            closeoutAttemptId: compiled.packet.packetId,
            artifactRefs: expect.arrayContaining([
              expect.objectContaining({ artifactType: 'native_goal_task_report' }),
            ]),
          }),
        ])
      );
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('keeps execution closure waiting for native goal TaskReport until controlled import exists', () => {
    const fixture = materializeRunLoopFixture({
      currentMentalModel: 'execution_closure',
      sixModelResults: {
        requirement_confirmation: { status: 'pass' },
        architecture_confirmation: { status: 'pass' },
        implementation_readiness: { status: 'pass' },
        execution_closure: { status: 'pass' },
      },
    });
    const root = fixture.root;
    try {
      const compiled = prepareNativeGoalImportFixture(fixture);
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
      record.nativeGoalHandoff = {
        schemaVersion: 'native-goal-handoff/v1',
        packetId: compiled.packet.packetId,
        taskReportPath: compiled.packet.compiledPromptRef.taskReportPath,
        imported: false,
      };
      fs.writeFileSync(fixture.recordPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

      const surface = resolveMainAgentOrchestrationSurface({
        ...runLoopArgs(fixture),
      });
      expect(surface.sixModelRuntimeDecision?.nextAction).toBe('await_native_goal_task_report');
      expect(surface.mainAgentStageSummary?.nextAction).toBe('await_native_goal_task_report');

      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
      });

      expect(result.finalSurface.mainAgentStageSummary?.nextAction).toBe(
        'await_native_goal_task_report'
      );
      expect(result.dispatchInstruction).toBeNull();
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('rejects invalid native goal TaskReport import branches without advancing the model', () => {
    const cases: Array<{
      name: string;
      configure: (fixture: RequirementFixture, reportPath: string, packetId: string) => void;
      expected: string;
    }> = [
      {
        name: 'schema',
        configure: (_fixture, reportPath) => {
          fs.mkdirSync(path.dirname(reportPath), { recursive: true });
          fs.writeFileSync(reportPath, '{"packetId":"broken"}\n', 'utf8');
        },
        expected: 'schema_invalid',
      },
      {
        name: 'packet',
        configure: (_fixture, reportPath, packetId) =>
          writeImportTaskReport(reportPath, packetId, { packetId: 'other-packet' }),
        expected: 'packetId_mismatch',
      },
      {
        name: 'source-hash',
        configure: (_fixture, reportPath, packetId) => writeImportTaskReport(reportPath, packetId),
        expected: 'sourceDocumentHash_mismatch',
      },
      {
        name: 'scope',
        configure: (_fixture, reportPath, packetId) =>
          writeImportTaskReport(reportPath, packetId, { filesChanged: ['outside/native.js'] }),
        expected: 'filesChanged_out_of_scope:outside/native.js',
      },
      {
        name: 'command',
        configure: (_fixture, reportPath, packetId) =>
          writeImportTaskReport(reportPath, packetId, { validationsRun: ['npm test'] }),
        expected: 'required_command_coverage_missing',
      },
      {
        name: 'evidence',
        configure: (_fixture, reportPath, packetId) =>
          writeImportTaskReport(reportPath, packetId, { evidence: [] }),
        expected: 'evidence_empty',
      },
    ];

    for (const testCase of cases) {
      const fixture = materializeRunLoopFixture();
      const root = fixture.root;
      try {
        const compiled = prepareNativeGoalImportFixture(fixture, {
          sourceHash:
            testCase.name === 'source-hash'
              ? 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
              : undefined,
        });
        const taskReportPath = compiled.packet.compiledPromptRef.taskReportPath!;
        testCase.configure(fixture, taskReportPath, compiled.packet.packetId);

        const result = importNativeGoalTaskReport({
          projectRoot: root,
          flow: 'standalone_tasks',
          stage: 'implement',
          recordId: fixture.recordId,
          requirementSetId: fixture.requirementSetId,
          runId: fixture.runId,
          taskReportPath,
        });

        expect(result.status, testCase.name).toBe('invalid');
        expect(result.reasonCode, testCase.name).toBe('native_goal_task_report_invalid');
        expect(result.validationErrors, testCase.name).toContain(testCase.expected);
        expect(result.controlledIngested, testCase.name).toBe(false);
        const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
        expect(record.executionIterations ?? [], testCase.name).toEqual([]);
      } finally {
        cleanupRequirementWorkspace(root);
      }
    }
  });

  it('routes partial and blocked native goal TaskReport imports to remediation', () => {
    for (const status of ['partial', 'blocked'] as const) {
      const fixture = materializeRunLoopFixture();
      const root = fixture.root;
      try {
        const compiled = prepareNativeGoalImportFixture(fixture);
        const taskReportPath = compiled.packet.compiledPromptRef.taskReportPath!;
        writeImportTaskReport(taskReportPath, compiled.packet.packetId, { status });

        const result = importNativeGoalTaskReport({
          projectRoot: root,
          flow: 'standalone_tasks',
          stage: 'implement',
          recordId: fixture.recordId,
          requirementSetId: fixture.requirementSetId,
          runId: fixture.runId,
          taskReportPath,
        });

        expect(result.status).toBe('imported');
        expect(result.nextAction).toBe('dispatch_remediation');
        const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
        expect(record.nativeGoalHandoff.importStatus).toBe(`task_report_${status}`);
        expect(record.nativeGoalHandoff.imported).toBe(false);
      } finally {
        cleanupRequirementWorkspace(root);
      }
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
          '--host',
          'cursor',
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
