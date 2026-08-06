import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildMainAgentDispatchInstruction,
  importNativeGoalTaskReport,
  resolveMainAgentOrchestrationSurface,
  runMainAgentAutomaticLoop,
  writeMainAgentRunLoopTaskReport,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import { writeNativeGoalInvocationReceipt } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/host-runtime-mode';
import type { ExecutionPacket } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';
import { defaultRuntimeContextFile, writeRuntimeContext } from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/runtime-context';
import {
  cleanupRequirementWorkspace,
  materializeRequirementFixture,
  writeFakeReqTraceSkill,
} from '../helpers/requirement-fixture-runtime';
import {
  executeRequiredCommandsForPublishedFixture,
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';
import { prepareAuditDispatchRuntime } from './helpers/prompt-transaction-audit-dispatch-fixture';

type PublishedImplementationFixture = Awaited<
  ReturnType<typeof publishImplementationPromptFixture>
>;
type RequirementFixture = ReturnType<typeof materializeRequirementFixture> & {
  publicationFixture?: PublishedImplementationFixture['fixture'];
  pointer?: Record<string, unknown>;
  goalCommandText?: string;
};
type RunLoopFixtureInput = Parameters<typeof materializeRequirementFixture>[0] & {
  goalMode?: 'native_goal_document_ref' | 'direct_prompt';
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Stable(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value), 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

async function materializeRunLoopFixture(
  input: RunLoopFixtureInput = {}
): Promise<RequirementFixture> {
  const published = await publishImplementationPromptFixture({
    goalMode: input.goalMode ?? 'direct_prompt',
    configureRecord: (record, fixture) => ({
      ...record,
      transactionId: fixture.identity.transactionId,
    }),
  });
  const fixture = published.fixture;
  return {
    root: fixture.root,
    fixtureId: input.fixtureId ?? fixture.identity.requirementSetId,
    sourcePath: fixture.paths.sourcePath,
    sourceDocumentHash: fixture.identity.sourceDocumentHash,
    semanticModelHash: fixture.identity.semanticModelHash,
    implementationConfirmationHash: fixture.identity.implementationConfirmationHash,
    recordPath: fixture.paths.recordPath,
    recordId: fixture.authority.recordId,
    requirementSetId: fixture.identity.requirementSetId,
    runId: fixture.identity.implementationAttemptId,
    publicationFixture: fixture,
    pointer: published.pointer,
    goalCommandText: published.goalCommandText,
  };
}

function materializeLegacyRunLoopFixture(
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

function prepareNativeGoalImportFixture(
  fixture: RequirementFixture,
  input: { packetId?: string; sourceHash?: string; omitReceipt?: boolean } = {}
) {
  if (!fixture.publicationFixture || !fixture.pointer) {
    throw new Error('canonical_publication_fixture_required');
  }
  executeRequiredCommandsForPublishedFixture({
    fixture: fixture.publicationFixture,
    pointer: fixture.pointer,
  });
  const handoff = runMainAgentAutomaticLoop({
    ...runLoopArgs(fixture),
    host: 'codex',
  });
  const packet = handoff.dispatchInstruction?.packet as ExecutionPacket | undefined;
  const packetPath = handoff.dispatchInstruction?.packetPath;
  if (!packet?.compiledPromptRef || !packetPath) {
    throw new Error('canonical_native_goal_packet_missing');
  }
  if (input.packetId && input.packetId !== packet.packetId) {
    throw new Error(`canonical_native_goal_packet_id_mismatch:${input.packetId}:${packet.packetId}`);
  }
  packet.compiledPromptRef.sourceDocumentHash =
    input.sourceHash ?? packet.compiledPromptRef.sourceDocumentHash;
  fs.writeFileSync(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8');
  const modelPacket = JSON.parse(
    fs.readFileSync(packet.compiledPromptRef.modelPacketPath, 'utf8')
  ) as { requiredCommands?: Array<{ id?: unknown }> };
  if (input.omitReceipt) {
    const receiptPath = String(
      (modelPacket.requiredCommands?.[0] as { receiptPath?: unknown } | undefined)?.receiptPath ?? ''
    );
    if (!receiptPath) {
      throw new Error('canonical_native_goal_required_command_receipt_path_missing');
    }
    const absoluteReceiptPath = path.resolve(fixture.root, receiptPath);
    const relativeReceiptPath = path.relative(fixture.root, absoluteReceiptPath);
    if (
      !relativeReceiptPath ||
      relativeReceiptPath.startsWith('..') ||
      path.isAbsolute(relativeReceiptPath)
    ) {
      throw new Error('canonical_native_goal_required_command_receipt_path_outside_fixture');
    }
    if (fs.existsSync(absoluteReceiptPath)) {
      fs.unlinkSync(absoluteReceiptPath);
    }
  }
  return {
    packetPath,
    packet,
    compiledPromptRef: packet.compiledPromptRef,
    requiredCommandId: String(modelPacket.requiredCommands?.[0]?.id ?? ''),
  };
}

function refreshNativeGoalImportProvenance(
  fixture: RequirementFixture,
  compiled: ReturnType<typeof prepareNativeGoalImportFixture>,
  taskReportPath: string
): void {
  if (!fixture.publicationFixture || !fixture.pointer || !fixture.goalCommandText) {
    throw new Error('canonical_native_goal_provenance_missing');
  }
  const compiledPromptRef = compiled.packet.compiledPromptRef!;
  const stdoutPath = path.join(
    fixture.root,
    '_bmad-output',
    'runtime',
    'governance',
    'native-goal-import-fixture',
    `${compiled.packet.packetId}.stdout.log`
  );
  const stderrPath = `${stdoutPath}.stderr.log`;
  fs.mkdirSync(path.dirname(stdoutPath), { recursive: true });
  fs.writeFileSync(stdoutPath, 'native goal command output\n', 'utf8');
  fs.writeFileSync(stderrPath, '', 'utf8');
  const transactionManifestRef = fixture.pointer.transactionManifestRef as Record<string, unknown>;
  writeNativeGoalInvocationReceipt({
    projectRoot: fixture.root,
    recordId: fixture.recordId,
    attemptId: compiled.packet.packetId,
    packetId: compiled.packet.packetId,
    host: 'codex',
    goalExecutionPath: compiledPromptRef.goalExecutionPath!,
    goalCommandTextHash: sha256Stable(fixture.goalCommandText),
    invokedCommandKind: 'host_native_goal',
    executionSurface: 'host_native_goal',
    command: 'main-session-native-goal',
    args: [fixture.goalCommandText],
    taskReportPath,
    taskReportHash: sha256File(taskReportPath),
    nativeGoalCommandPrepared: true,
    nativeGoalCommandUsed: true,
    stdoutRef: stdoutPath,
    stderrRef: stderrPath,
    exitCode: 0,
    sourceDocumentHash: compiledPromptRef.sourceDocumentHash,
    implementationConfirmationHash: compiledPromptRef.implementationConfirmationHash,
    modelPacketHash: compiledPromptRef.modelPacketHash,
    auditReceiptHash: compiledPromptRef.auditReceiptHash,
    transactionManifestPath: String(transactionManifestRef.path),
    transactionManifestHash: String(transactionManifestRef.hash),
    currentDispatchPointerPath: fixture.publicationFixture.options.currentDispatchPointer,
    currentDispatchPointerHash: sha256File(
      fixture.publicationFixture.options.currentDispatchPointer
    ),
  });
}

function executeFixtureRequiredCommands(fixture: RequirementFixture): void {
  if (!fixture.publicationFixture || !fixture.pointer) return;
  executeRequiredCommandsForPublishedFixture({
    fixture: fixture.publicationFixture,
    pointer: fixture.pointer,
  });
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
        filesChanged: [],
        validationsRun: ['native goal required commands passed'],
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
  it('keeps controlled dispatch-plan at dispatch_implement until native goal is actually invoked', async () => {
    const fixture = await materializeRunLoopFixture({ goalMode: 'native_goal_document_ref' });
    try {
      const instruction = buildMainAgentDispatchInstruction({
        ...runLoopArgs(fixture),
        host: 'codex',
        hydratePacket: true,
      });
      const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
      const surface = resolveMainAgentOrchestrationSurface({
        ...runLoopArgs(fixture),
      });

      expect(instruction?.nextAction).toBe('dispatch_implement');
      expect(record.nativeGoalHandoff).toBeUndefined();
      expect(surface.mainAgentNextAction).toBe('dispatch_implement');
      expect(surface.mainAgentStageSummary?.nextAction).toBe('dispatch_implement');
    } finally {
      cleanupRequirementWorkspace(fixture.root);
    }
  });

  it('executes inspect dispatch claim dispatch report complete and final inspect from one call', async () => {
    const fixture = await materializeRunLoopFixture();
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
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
        'command-receipt.validate',
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

  it('resolves active requirement record instead of flat legacy runtime-context fallback', async () => {
    const fixture = await materializeRunLoopFixture();
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
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
        host: 'cursor',
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

  it('blocks instead of synthesizing completion when no real task report is provided', async () => {
    const fixture = await materializeRunLoopFixture();
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
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

  it('preserves codex as the host through dispatch state and final inspect', async () => {
    const fixture = await materializeRunLoopFixture({
      goalMode: 'native_goal_document_ref',
    });
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalExecutor: ({ packetId, taskReportPath }) => {
          writeImportTaskReport(taskReportPath, packetId, {
            validationsRun: ['codex-controlled-native-goal'],
          });
          return {
            exitCode: 0,
            stdout: 'native goal completed',
            stderr: '',
          };
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

  it('requires current main-session native goal execution before TaskReport import', async () => {
    const fixture = await materializeRunLoopFixture({
      goalMode: 'native_goal_document_ref',
    });
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport).toBeNull();
      expect(result.steps.find((step) => step.step === 'native-goal-invocation')?.summary).toContain(
        'status=awaiting_task_report'
      );
      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.finalSurface.pendingPacketStatus).toBe('dispatched');
      expect(result.finalSurface.mainAgentNextAction).toBe('await_native_goal_task_report');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('accepts dispatch-plan as a positional CLI action without treating it as cwd', async () => {
    const fixture = await materializeRunLoopFixture();
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
      const dispatchOutput = execFileSync(
        process.execPath,
        packageMainAgentCliArgs([
          '--action',
          'dispatch-plan',
          '--host',
          'cursor',
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

  it('does not advance blocked implementation task reports to review', async () => {
    const fixture = await materializeRunLoopFixture();
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'cursor',
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

  it('prepares Codex native goal for current main-session execution', async () => {
    const fixture = await materializeRunLoopFixture({ goalMode: 'native_goal_document_ref' });
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
      const result = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport).toBeNull();
      expect(result.steps.find((step) => step.step === 'native-goal-invocation')?.summary).toContain(
        'status=awaiting_task_report'
      );
      expect(result.finalSurface.pendingPacketStatus).toBe('dispatched');
      expect(result.finalSurface.mainAgentNextAction).toBe('await_native_goal_task_report');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('does not materialize a review dispatch instruction before execution closure passes', async () => {
    const fixture = await materializeRunLoopFixture({
      goalMode: 'native_goal_document_ref',
    });
    const root = fixture.root;
    try {
      prepareAuditDispatchRuntime(fixture.publicationFixture!, {
        executionClosureStatus: 'not_established',
      });
      executeFixtureRequiredCommands(fixture);
      const remediate = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalExecutor: ({ packetId, taskReportPath }) => {
          writeImportTaskReport(taskReportPath, packetId, {
            validationsRun: ['codex-controlled-native-goal'],
          });
          return {
            exitCode: 0,
            stdout: 'native goal completed',
            stderr: '',
          };
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
    const fixture = materializeLegacyRunLoopFixture({
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
    const fixture = materializeLegacyRunLoopFixture({
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

  it('continues rerun_gate remediation through main-session native goal blockers', async () => {
    const fixture = await materializeRunLoopFixture({ goalMode: 'native_goal_document_ref' });
    const root = fixture.root;
    try {
      executeFixtureRequiredCommands(fixture);
      const remediate = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalExecutor: () => ({
          exitCode: 1,
          stdout: '',
          stderr: 'native failed',
        }),
      });
      expect(remediate.status).toBe('blocked');
      expect(remediate.taskReport).toBeNull();
      expect(
        remediate.steps.find((step) => step.step === 'native-goal-invocation')?.summary
      ).toContain('status=blocked');
      expect(remediate.finalSurface.mainAgentNextAction).toBe(
        'await_native_goal_task_report'
      );

      const review = runMainAgentAutomaticLoop({
        ...runLoopArgs(fixture),
        host: 'codex',
        nativeGoalExecutor: () => ({
          exitCode: 1,
          stdout: '',
          stderr: 'native failed again',
        }),
      });
      expect(review.status).toBe('blocked');
      expect(review.dispatchInstruction).toBeNull();
      expect(review.steps.at(-1)).toMatchObject({
        step: 'native-goal-task-report',
        status: 'fail',
      });
      expect(review.finalSurface.mainAgentNextAction).toBe(
        'await_native_goal_task_report'
      );
      expect(review.finalSurface.orchestrationState?.host).toBe('codex');
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('imports a valid native goal TaskReport as an untrusted execution claim', async () => {
      const fixture = await materializeRunLoopFixture({
        goalMode: 'native_goal_document_ref',
      });
    const root = fixture.root;
    try {
      const compiled = prepareNativeGoalImportFixture(fixture);
      const taskReportPath = compiled.packet.compiledPromptRef.taskReportPath!;
      writeImportTaskReport(taskReportPath, compiled.packet.packetId);
      refreshNativeGoalImportProvenance(fixture, compiled, taskReportPath);
      const beforeImport = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
      const artifactIndexBeforeImport = (beforeImport.artifactIndex ?? []).map(
        ({
          artifactType,
          sourceOfTruthRole,
          recordId,
          requirementSetId,
          path: artifactPath,
          contentHash,
          producer,
          status,
        }: Record<string, unknown>) => ({
          artifactType,
          sourceOfTruthRole,
          recordId,
          requirementSetId,
          path: artifactPath,
          contentHash,
          producer,
          status,
        })
      );

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
            authorityClass: 'untrusted_claim',
            commandSuccessEligible: false,
            requirementClosureEligible: false,
            evidenceAcceptanceEligible: false,
          }),
        ])
      );
      expect(record.requirementClosures ?? []).toEqual([]);
      expect(
        (record.artifactIndex ?? []).map(
          ({
            artifactType,
            sourceOfTruthRole,
            recordId,
            requirementSetId,
            path: artifactPath,
            contentHash,
            producer,
            status,
          }: Record<string, unknown>) => ({
            artifactType,
            sourceOfTruthRole,
            recordId,
            requirementSetId,
            path: artifactPath,
            contentHash,
            producer,
            status,
          })
        )
      ).toEqual(artifactIndexBeforeImport);
      expect(record.deliveryEvidence ?? null).toBeNull();
    } finally {
      cleanupRequirementWorkspace(root);
    }
  });

  it('keeps execution closure waiting for native goal TaskReport until controlled import exists', async () => {
      const fixture = await materializeRunLoopFixture({
        goalMode: 'native_goal_document_ref',
      });
    const root = fixture.root;
    try {
      const compiled = prepareNativeGoalImportFixture(fixture);

      const surface = resolveMainAgentOrchestrationSurface({
        ...runLoopArgs(fixture),
      });
      expect(surface.sixModelRuntimeDecision?.nextAction).toBe('dispatch_remediation');
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

  it('rejects invalid native goal TaskReport import branches without advancing the model', async () => {
    const cases: Array<{
      name: string;
      configure: (fixture: RequirementFixture, reportPath: string, packetId: string) => void;
      expected: string;
      omitReceipt?: boolean;
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
        expected: 'required_command_receipt_missing:',
        omitReceipt: true,
      },
      {
        name: 'evidence',
        configure: (_fixture, reportPath, packetId) =>
          writeImportTaskReport(reportPath, packetId, { evidence: [] }),
        expected: 'evidence_empty',
      },
    ];

    for (const testCase of cases) {
      const fixture = await materializeRunLoopFixture({ goalMode: 'native_goal_document_ref' });
      const root = fixture.root;
      try {
        const compiled = prepareNativeGoalImportFixture(fixture, {
          sourceHash:
            testCase.name === 'source-hash'
              ? 'sha256:0000000000000000000000000000000000000000000000000000000000000000'
              : undefined,
          omitReceipt: testCase.omitReceipt,
        });
        const taskReportPath = compiled.packet.compiledPromptRef.taskReportPath!;
        testCase.configure(fixture, taskReportPath, compiled.packet.packetId);
        refreshNativeGoalImportProvenance(fixture, compiled, taskReportPath);

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
        expect(
          result.validationErrors.some(
            (error) =>
              error === testCase.expected ||
              (testCase.name === 'command' && error.startsWith(testCase.expected))
          ),
          testCase.name
        ).toBe(true);
        expect(result.controlledIngested, testCase.name).toBe(false);
        const record = JSON.parse(fs.readFileSync(fixture.recordPath, 'utf8'));
        expect(record.executionIterations ?? [], testCase.name).toEqual([]);
      } finally {
        cleanupRequirementWorkspace(root);
      }
    }
  });

  it('routes partial and blocked native goal TaskReport imports to remediation', async () => {
    for (const status of ['partial', 'blocked'] as const) {
      const fixture = await materializeRunLoopFixture({ goalMode: 'native_goal_document_ref' });
      const root = fixture.root;
      try {
        const compiled = prepareNativeGoalImportFixture(fixture);
        const taskReportPath = compiled.packet.compiledPromptRef.taskReportPath!;
        writeImportTaskReport(taskReportPath, compiled.packet.packetId, { status });
        refreshNativeGoalImportProvenance(fixture, compiled, taskReportPath);

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

  it('CLI --taskReportPath cannot bypass command Receipt validation', async () => {
    const fixture = await materializeRunLoopFixture();
    const root = fixture.root;
    const previousAllow = process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT;
    try {
      process.env.MAIN_AGENT_ALLOW_EXTERNAL_TASK_REPORT = 'true';

      const dispatchOutput = execFileSync(
        process.execPath,
        packageMainAgentCliArgs([
          '--host',
          'cursor',
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
          '--host',
          'cursor',
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
      expect(resultProcess.status).toBe(1);
      const result = parsePackageOrLegacyJson<{
        status: string;
        taskReport: {
          status: string;
          validationsRun: string[];
          evidence: string[];
          driftFlags?: string[];
        };
      }>(resultProcess.stdout);
      const after = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as {
        validationsRun: string[];
        evidence: string[];
      };

      expect(result.status).toBe('blocked');
      expect(result.taskReport.status).toBe('blocked');
      expect(result.taskReport.driftFlags).toContain(
        'required-command-receipt-validation-failed'
      );
      expect(result.taskReport.validationsRun).toEqual(['external-real-validation']);
      expect(result.taskReport.evidence).toContain('external-real-evidence');
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

  it('CLI --taskReportPath fails closed by default without explicit test authorization', async () => {
    const fixture = await materializeRunLoopFixture();
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
