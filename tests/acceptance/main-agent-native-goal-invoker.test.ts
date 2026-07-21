import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  runNativeGoalInvocation,
  type NativeGoalControlledExecutor,
} from '../../packages/bmad-speckit/src/main-agent/actions/native-goal-invoker';
import type {
  CompiledPromptRef,
  ExecutionPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';

const roots: string[] = [];

function sha256Text(value: string): string {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function sha256File(filePath: string): string {
  return `sha256:${createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')}`;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createNativeGoalInvocationFixture(host: 'codex' | 'claude-code-cli' = 'codex'): {
  projectRoot: string;
  packet: ExecutionPacket;
  compiledPromptRef: CompiledPromptRef;
  taskReportPath: string;
  commandText: string;
  recordId: string;
  attemptId: string;
  attemptBundle: {
    sourceDocumentHash: string;
    implementationConfirmationHash: string;
    modelPacketHash: string;
    auditReceiptHash: string;
    goalExecutionHash: string;
    transactionManifestPath: string;
    transactionManifestHash: string;
    currentDispatchPointerPath: string;
    currentDispatchPointerHash: string;
  };
} {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'native-goal-invoker-'));
  roots.push(projectRoot);
  const recordId = `REQ-native-${host}`;
  const attemptId = 'attempt-native-1';
  const packetId = 'packet-native-1';
  const outDir = path.join(projectRoot, '_bmad-output', 'runtime', 'trace-execution', packetId);
  const taskReportPath = path.join(
    projectRoot,
    '_bmad-output',
    'runtime',
    'governance',
    'task-reports',
    `${packetId}.json`
  );
  fs.mkdirSync(outDir, { recursive: true });
  const modelPacketPath = path.join(outDir, 'model_packet.json');
  const humanPromptPath = path.join(outDir, 'human_prompt.txt');
  const auditReceiptPath = path.join(outDir, 'audit_receipt.json');
  const goalExecutionPath = path.join(outDir, 'goal_execution.md');
  const transactionManifestPath = path.join(outDir, 'prompt-transaction-manifest.json');
  const currentDispatchPointerPath = path.join(outDir, 'current-dispatch-pointer.json');
  const commandText = `/goal Execute ${packetId} by following ${goalExecutionPath}; use ${modelPacketPath} as authority; stop only on final pass or reconfirm_required.`;

  writeJson(modelPacketPath, { packetId, host });
  fs.writeFileSync(humanPromptPath, 'native goal human prompt fixture\n', 'utf8');
  fs.writeFileSync(goalExecutionPath, '# native goal execution fixture\n', 'utf8');
  writeJson(transactionManifestPath, { packetId, status: 'current' });
  writeJson(currentDispatchPointerPath, { packetId, status: 'current' });
  writeJson(auditReceiptPath, {
    decision: 'pass',
    goalCommand: {
      mode: 'native_goal_document_ref',
      commandText,
      chars: Array.from(commandText).length,
      documentPath: goalExecutionPath,
      documentHash: sha256File(goalExecutionPath),
      nativeGoalCommandUsed: true,
    },
    continuationDirective: {
      directive: commandText,
      nativeGoalCommandUsed: true,
    },
  });

  const compiledPromptRef: CompiledPromptRef = {
    modelPacketPath,
    modelPacketHash: sha256File(modelPacketPath),
    humanPromptPath,
    humanPromptHash: sha256File(humanPromptPath),
    auditReceiptPath,
    auditReceiptHash: sha256File(auditReceiptPath),
    goalExecutionPath,
    goalExecutionHash: sha256File(goalExecutionPath),
    taskReportPath,
    sourceDocumentHash: sha256Text('source'),
    implementationConfirmationHash: sha256Text('confirmation'),
  };
  const packet: ExecutionPacket = {
    packetId,
    parentSessionId: recordId,
    flow: 'standalone_tasks',
    phase: 'implement',
    taskType: 'implement',
    role: 'implementation-worker',
    inputArtifacts: [modelPacketPath],
    allowedWriteScope: ['scripts/**', 'tests/**', '_bmad-output/**'],
    expectedDelta: 'run native goal invocation',
    successCriteria: ['TaskReport written'],
    stopConditions: ['reconfirm_required'],
    authorityMode: 'compiled_implementation_confirmation',
    compiledPromptRef,
  };
  return {
    projectRoot,
    packet,
    compiledPromptRef,
    taskReportPath,
    commandText,
    recordId,
    attemptId,
    attemptBundle: {
      sourceDocumentHash: compiledPromptRef.sourceDocumentHash,
      implementationConfirmationHash: compiledPromptRef.implementationConfirmationHash,
      modelPacketHash: compiledPromptRef.modelPacketHash,
      auditReceiptHash: compiledPromptRef.auditReceiptHash,
      goalExecutionHash: compiledPromptRef.goalExecutionHash!,
      transactionManifestPath,
      transactionManifestHash: sha256File(transactionManifestPath),
      currentDispatchPointerPath,
      currentDispatchPointerHash: sha256File(currentDispatchPointerPath),
    },
  };
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

function writeDoneTaskReport(filePath: string, packetId: string): void {
  writeJson(filePath, {
    packetId,
    status: 'done',
    filesChanged: [],
    validationsRun: ['native-goal-controlled-executor'],
    evidence: ['controlled executor produced this TaskReport'],
    downstreamContext: ['continue to controlled TaskReport ingest'],
  });
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('main-agent host-native goal invoker', () => {
  it.each(['codex', 'claude-code-cli'] as const)(
    'executes the exact /goal command through the %s Main Agent controlled executor',
    (host) => {
      const fixture = createNativeGoalInvocationFixture(host);
      const executor: NativeGoalControlledExecutor = (request) => {
        expect(request).toMatchObject({
          projectRoot: fixture.projectRoot,
          host,
          commandText: fixture.commandText,
          goalExecutionPath: fixture.compiledPromptRef.goalExecutionPath,
          goalExecutionHash: fixture.compiledPromptRef.goalExecutionHash,
          packetId: fixture.packet.packetId,
          taskReportPath: fixture.taskReportPath,
        });
        writeDoneTaskReport(request.taskReportPath, request.packetId);
        return {
          exitCode: 0,
          stdout: 'native goal completed',
          stderr: '',
        };
      };

      const result = runNativeGoalInvocation({
        projectRoot: fixture.projectRoot,
        host,
        packet: fixture.packet,
        compiledPromptRef: fixture.compiledPromptRef,
        taskReportPath: fixture.taskReportPath,
        recordId: fixture.recordId,
        attemptId: fixture.attemptId,
        attemptBundle: fixture.attemptBundle,
        executor,
      });

      expect(result.status).toBe('executed');
      expect(result.exitCode).toBe(0);
      expect(result.command).toBe('host-native-goal');
      expect(result.args).toEqual([fixture.commandText]);
      expect(result.taskReport).toMatchObject({
        packetId: fixture.packet.packetId,
        status: 'done',
      });
      expect(fs.readFileSync(result.stdoutPath, 'utf8')).toBe('native goal completed');
      expect(fs.readFileSync(result.stderrPath, 'utf8')).toBe('');
      const receipt = JSON.parse(
        fs.readFileSync(
          receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId),
          'utf8'
        )
      );
      expect(receipt).toMatchObject({
        invokedCommandKind: 'host_native_goal',
        executionSurface: 'host_native_goal',
        packetId: fixture.packet.packetId,
        attemptId: fixture.attemptId,
        goalExecutionHash: fixture.compiledPromptRef.goalExecutionHash,
        taskReportPath: fixture.taskReportPath,
        command: 'host-native-goal',
        args: [fixture.commandText],
        nativeGoalCommandPrepared: true,
        nativeGoalCommandUsed: true,
        exitCode: 0,
        sourceDocumentHash: fixture.attemptBundle.sourceDocumentHash,
        implementationConfirmationHash:
          fixture.attemptBundle.implementationConfirmationHash,
        modelPacketHash: fixture.attemptBundle.modelPacketHash,
        auditReceiptHash: fixture.attemptBundle.auditReceiptHash,
        transactionManifestPath: fixture.attemptBundle.transactionManifestPath,
        transactionManifestHash: fixture.attemptBundle.transactionManifestHash,
        currentDispatchPointerPath: fixture.attemptBundle.currentDispatchPointerPath,
        currentDispatchPointerHash: fixture.attemptBundle.currentDispatchPointerHash,
      });
      expect(receipt.taskReportHash).toBe(sha256File(fixture.taskReportPath));
      expect(receipt.goalCommandTextHash).toBe(sha256Text(fixture.commandText));
    }
  );

  it('persists an explicit handoff without fabricating a TaskReport when no executor is available', () => {
    const fixture = createNativeGoalInvocationFixture('codex');

    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      attemptBundle: fixture.attemptBundle,
    });

    expect(result.status).toBe('awaiting_task_report');
    expect(result.exitCode).toBe(1);
    expect(result.command).toBe('main-session-native-goal');
    expect(result.args).toEqual([fixture.commandText]);
    expect(result.taskReport).toBeNull();
    expect(fs.existsSync(fixture.taskReportPath)).toBe(false);
    expect(fs.readFileSync(result.stdoutPath, 'utf8')).toBe('');
    expect(fs.readFileSync(result.stderrPath, 'utf8')).toContain(
      'Main session native /goal execution required'
    );
    const receipt = JSON.parse(
      fs.readFileSync(receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId), 'utf8')
    );
    expect(receipt).toMatchObject({
      invokedCommandKind: 'main_session_native_goal_required',
      executionSurface: 'main_session_native_goal_required',
      packetId: fixture.packet.packetId,
      attemptId: fixture.attemptId,
      goalExecutionHash: fixture.compiledPromptRef.goalExecutionHash,
      taskReportPath: fixture.taskReportPath,
      command: 'main-session-native-goal',
      args: [fixture.commandText],
      nativeGoalCommandPrepared: true,
      nativeGoalCommandUsed: false,
      exitCode: 1,
    });
    expect(receipt.goalCommandTextHash).toBe(sha256Text(fixture.commandText));
  });

  it('records a failed controlled execution without fabricating a TaskReport', () => {
    const fixture = createNativeGoalInvocationFixture('codex');

    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      attemptBundle: fixture.attemptBundle,
      executor: () => ({
        exitCode: 1,
        stdout: '',
        stderr: 'native goal failed',
      }),
    });

    expect(result.status).toBe('blocked');
    expect(result.taskReport).toBeNull();
    expect(fs.existsSync(fixture.taskReportPath)).toBe(false);
    expect(result.command).toBe('host-native-goal');
    expect(result.args).toEqual([fixture.commandText]);
    const receipt = JSON.parse(
      fs.readFileSync(
        receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId),
        'utf8'
      )
    );
    expect(receipt.invokedCommandKind).toBe('host_native_goal');
    expect(receipt.command).toBe('host-native-goal');
    expect(receipt.nativeGoalCommandUsed).toBe(true);
    expect(receipt.exitCode).toBe(1);
  });

  it('fails command resolution without writing a synthetic TaskReport', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    fs.rmSync(fixture.compiledPromptRef.goalExecutionPath!, { force: true });
    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      attemptBundle: fixture.attemptBundle,
      executor: () => {
        throw new Error('executor must not be called when command resolution fails');
      },
    });

    expect(result.status).toBe('blocked');
    expect(result.taskReport).toBeNull();
    expect(result.validationErrors).toContain('native-goal-document-missing');
    expect(fs.existsSync(fixture.taskReportPath)).toBe(false);
    expect(result.receiptPath).toBeNull();
  });
});
