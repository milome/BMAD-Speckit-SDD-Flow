import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildNativeGoalImportReturnMetadata,
  ensureMainAgentDispatchPacket,
  runMainAgentAutomaticLoop,
  type NativeGoalControlledExecutor,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/main-agent-orchestration';
import {
  executeRequiredCommandsForPublishedFixture,
  publishImplementationPromptFixture,
} from './helpers/prompt-transaction-implementation-publication-fixture';

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function receiptPath(root: string, recordId: string, attemptId: string): string {
  return path.join(
    root,
    '_bmad-output',
    'runtime',
    'requirement-records',
    recordId,
    'runtime-mode',
    attemptId,
    'native-goal-invocation-receipt.json'
  );
}

function orchestrationStatePath(fixture: {
  recordPath: string;
  requirementSetId: string;
}): string {
  return path.join(
    path.dirname(fixture.recordPath),
    'orchestration',
    'orchestration-state',
    `${fixture.requirementSetId}.json`
  );
}

describe('main-agent run-loop native goal invocation routing', () => {
  it.each([
    { host: 'codex' as const },
    { host: 'claude' as const },
  ])('persists $host awaiting_task_report without a synthetic TaskReport', async ({ host }) => {
    const { fixture, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const taskReportBefore = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host,
      });

      expect(result.status).toBe('blocked');
      expect(result.taskReport).toBeNull();
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      const packetId = result.dispatchInstruction!.packetId;
      const taskReportAfter = fs.existsSync(fixture.options.taskReportPath)
        ? fs.readFileSync(fixture.options.taskReportPath)
        : null;
      expect(taskReportAfter).toEqual(taskReportBefore);
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.authority.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.executionSurface).toBe('main_session_native_goal_required');
      expect(receipt.args).toEqual([goalCommandText]);
      expect(receipt.nativeGoalCommandPrepared).toBe(true);
      expect(receipt.nativeGoalCommandUsed).toBe(false);
      expect(receipt.packetId).toBe(packetId);
      expect(receipt.taskReportPath).toBe(fixture.options.taskReportPath);
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        packetId,
        invoked: true,
        imported: false,
        importStatus: 'awaiting_task_report',
        returnCommand: 'bmad-speckit',
        returnArgv: [
          'main-agent-orchestration',
          '--action',
          'import-native-goal-task-report',
          '--taskReportPath',
          fixture.options.taskReportPath,
        ],
      });
      expect(record.lastEventType).toBe('native_goal_handoff_recorded');
      expect(result.finalSurface.orchestrationState?.pendingPacket?.status).toBe('dispatched');
      expect(result.finalSurface.orchestrationState?.lastTaskReport ?? null).toBeNull();
      expect(result.finalSurface.orchestrationState?.gatesLoop?.noProgressCount ?? 0).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  it('infers Codex CLI host from process env even when state and config still say cursor', async () => {
    const previousEnv = {
      CODEX_THREAD_ID: process.env.CODEX_THREAD_ID,
      CODEX_MANAGED_BY_NPM: process.env.CODEX_MANAGED_BY_NPM,
      CODEX_MANAGED_PACKAGE_ROOT: process.env.CODEX_MANAGED_PACKAGE_ROOT,
    };
    const { fixture, goalCommandText } = await publishImplementationPromptFixture();
    try {
      process.env.CODEX_THREAD_ID = fixture.identity.transactionId;
      process.env.CODEX_MANAGED_BY_NPM = 'true';
      process.env.CODEX_MANAGED_PACKAGE_ROOT = fixture.paths.installedPackageRoot;
      fs.mkdirSync(path.join(fixture.root, '_bmad', '_config'), { recursive: true });
      fs.writeFileSync(
        path.join(fixture.root, '_bmad', '_config', 'governance-remediation.yaml'),
        ['version: 1', 'primaryHost: cursor', 'authoritativeHost: cursor'].join('\n'),
        'utf8'
      );
      ensureMainAgentDispatchPacket({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host: 'cursor',
      });
      const statePath = orchestrationStatePath({
        recordPath: fixture.paths.recordPath,
        requirementSetId: fixture.identity.requirementSetId,
      });
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      state.host = 'cursor';
      state.hostRecovery = {
        degradation_level: 'none',
        active_host_mode: 'cursor',
        orchestration_entry: 'main-agent-orchestration',
        updated_at: '2026-06-28T00:00:00.000Z',
      };
      writeJson(statePath, state);

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
      });

      expect(result.dispatchInstruction?.host).toBe('codex');
      expect(result.steps.some((step) => step.step === 'native-goal-invocation')).toBe(true);
      const packetId = result.dispatchInstruction!.packetId;
      const receipt = JSON.parse(
        fs.readFileSync(receiptPath(fixture.root, fixture.authority.recordId, packetId), 'utf8')
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.args).toEqual([goalCommandText]);
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        dispatchHost: 'codex',
        importStatus: 'awaiting_task_report',
      });
    } finally {
      fixture.cleanup();
      for (const [key, value] of Object.entries(previousEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it.each([
    { host: 'codex' as const, canonicalHost: 'codex' },
    { host: 'claude' as const, canonicalHost: 'claude-code-cli' },
  ])('ingests a real TaskReport produced by the $host controlled executor', async ({
    host,
    canonicalHost,
  }) => {
    const { fixture, pointer, goalCommandText } = await publishImplementationPromptFixture();
    try {
      const executor: NativeGoalControlledExecutor = (request) => {
        expect(request).toMatchObject({
          host: canonicalHost,
          commandText: goalCommandText,
          taskReportPath: fixture.options.taskReportPath,
        });
        executeRequiredCommandsForPublishedFixture({
          fixture,
          pointer,
        });
        writeJson(request.taskReportPath, {
          packetId: request.packetId,
          status: 'done',
          filesChanged: [],
          validationsRun: ['main-agent-controlled-native-goal'],
          evidence: ['controlled executor TaskReport'],
          downstreamContext: ['continue to execution closure'],
        });
        return {
          exitCode: 0,
          stdout: 'native goal completed',
          stderr: '',
        };
      };

      const result = runMainAgentAutomaticLoop({
        projectRoot: fixture.root,
        recordId: fixture.authority.recordId,
        requirementSetId: fixture.identity.requirementSetId,
        runId: fixture.identity.implementationAttemptId,
        flow: 'standalone_tasks',
        stage: 'implement',
        host,
        nativeGoalExecutor: executor,
      });

      expect(result.steps.filter((step) => step.status === 'fail')).toEqual([]);
      expect(result.status).toBe('completed');
      const packetId = result.dispatchInstruction!.packetId;
      expect(result.taskReport).toMatchObject({
        packetId,
        status: 'done',
      });
      const receipt = JSON.parse(
        fs.readFileSync(
          receiptPath(
            fixture.root,
            fixture.authority.recordId,
            packetId
          ),
          'utf8'
        )
      );
      expect(receipt).toMatchObject({
        executionSurface: 'host_native_goal',
        invokedCommandKind: 'host_native_goal',
        nativeGoalCommandPrepared: true,
        nativeGoalCommandUsed: true,
        exitCode: 0,
        taskReportPath: fixture.options.taskReportPath,
      });
      expect(receipt.taskReportHash).toMatch(/^sha256:[a-f0-9]{64}$/u);
      expect(receipt.transactionManifestHash).toBe(
        (pointer.transactionManifestRef as Record<string, unknown>).hash
      );
      const record = JSON.parse(fs.readFileSync(fixture.paths.recordPath, 'utf8'));
      expect(record.nativeGoalHandoff).toMatchObject({
        invoked: true,
        imported: true,
        importStatus: 'task_report_done',
      });
      expect(record.executionIterations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            executionIterationId: packetId,
            status: 'done',
          }),
        ])
      );
      const modelPacket = JSON.parse(
        fs.readFileSync(
          String((pointer.modelPacketRef as Record<string, unknown>).path),
          'utf8'
        )
      ) as Record<string, unknown>;
      const requiredCommand = (modelPacket.requiredCommands as Array<Record<string, unknown>>)[0];
      const executionIteration = (
        record.executionIterations as Array<Record<string, unknown>>
      ).find((iteration) => iteration.executionIterationId === packetId);
      expect(executionIteration?.commandRunRefs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            commandId: requiredCommand.id,
            runId: expect.stringMatching(/^RUN-[A-Za-z0-9._-]+$/u),
            exitCode: 0,
            executorIdentity: expect.objectContaining({
              class: 'goal_controlled_executor',
            }),
            transactionId: fixture.identity.transactionId,
            implementationAttemptId: fixture.identity.implementationAttemptId,
          }),
        ])
      );
      expect(executionIteration?.evidenceArtifactRefs).toEqual(
        expect.arrayContaining(
          [
            'native_goal_task_report',
            'native_goal_invocation_receipt',
            'prompt_transaction_manifest',
            'current_dispatch_pointer',
            'command_execution_receipt',
          ].map((artifactType) => expect.objectContaining({ artifactType }))
        )
      );
    } finally {
      fixture.cleanup();
    }
  });

  it('builds argv-safe TaskReport import metadata for paths with spaces and shell metacharacters', () => {
    const taskReportPath = path.join(
      'D:\\consumer workspace',
      '_bmad-output',
      'runtime',
      'task reports',
      'native goal & proof.json'
    );

    expect(buildNativeGoalImportReturnMetadata(taskReportPath)).toEqual({
      returnCommand: 'bmad-speckit',
      returnArgv: [
        'main-agent-orchestration',
        '--action',
        'import-native-goal-task-report',
        '--taskReportPath',
        taskReportPath,
      ],
    });
  });
});
