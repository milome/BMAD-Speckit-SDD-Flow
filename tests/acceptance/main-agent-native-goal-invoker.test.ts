import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  CompiledPromptRef,
  ExecutionPacket,
  TaskReport,
} from '../../scripts/orchestration-dispatch-contract';

type NativeGoalSpawnSyncFn = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    encoding: 'utf8';
    timeout: number;
    shell: boolean;
  }
) => {
  status?: number | null;
  stdout?: string | Buffer | null;
  stderr?: string | Buffer | null;
  error?: Error | null;
};

const { runNativeGoalInvocation } = require(
  '../../packages/bmad-speckit/src/main-agent/actions/native-goal-invoker.js'
) as {
  runNativeGoalInvocation: (input: {
    projectRoot: string;
    host: string;
    packet: ExecutionPacket;
    compiledPromptRef: CompiledPromptRef;
    taskReportPath: string;
    timeoutMs?: number;
    spawnSyncFn?: NativeGoalSpawnSyncFn;
    recordId?: string;
    attemptId?: string;
  }) => {
    command: string;
    args: string[];
    exitCode: number;
    stdoutPath: string;
    stderrPath: string;
    receiptPath: string | null;
    taskReportPath: string;
    taskReport: TaskReport;
  };
};

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
  const commandText = `/goal Execute ${packetId} by following ${goalExecutionPath}; use ${modelPacketPath} as authority; stop only on final pass or reconfirm_required.`;

  writeJson(modelPacketPath, { packetId, host });
  fs.writeFileSync(humanPromptPath, 'native goal human prompt fixture\n', 'utf8');
  fs.writeFileSync(goalExecutionPath, '# native goal execution fixture\n', 'utf8');
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
  return { projectRoot, packet, compiledPromptRef, taskReportPath, commandText, recordId, attemptId };
}

function doneReport(packetId: string): TaskReport {
  return {
    packetId,
    status: 'done',
    filesChanged: ['packages/bmad-speckit/src/main-agent/actions/native-goal-invoker.js'],
    validationsRun: ['native-goal-fixture'],
    evidence: ['native goal fixture wrote TaskReport'],
    downstreamContext: ['native goal completed'],
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

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('main-agent host-native goal invoker', () => {
  it('passes the exact /goal command text as Codex initial prompt and writes invocation receipt', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    const calls: Array<{ command: string; args: string[]; options: Record<string, unknown> }> = [];
    const spawnSyncFn: NativeGoalSpawnSyncFn = (command, args, options) => {
      calls.push({ command, args, options: options as Record<string, unknown> });
      writeJson(fixture.taskReportPath, doneReport(fixture.packet.packetId));
      return { status: 0, stdout: 'codex stdout', stderr: 'codex stderr' };
    };

    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      spawnSyncFn,
    });

    expect(result.taskReport.status).toBe('done');
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('codex');
    expect(calls[0].args).toEqual([
      'exec',
      '--cd',
      fixture.projectRoot,
      '--sandbox',
      'workspace-write',
      '-a',
      'never',
      '--json',
      fixture.commandText,
    ]);
    expect(calls[0].options.cwd).toBe(fixture.projectRoot);
    expect(fs.readFileSync(result.stdoutPath, 'utf8')).toBe('codex stdout');
    expect(fs.readFileSync(result.stderrPath, 'utf8')).toBe('codex stderr');
    const receipt = JSON.parse(
      fs.readFileSync(receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId), 'utf8')
    );
    expect(receipt).toMatchObject({
      invokedCommandKind: 'host_native_goal',
      packetId: fixture.packet.packetId,
      attemptId: fixture.attemptId,
      goalExecutionHash: fixture.compiledPromptRef.goalExecutionHash,
      taskReportPath: fixture.taskReportPath,
      command: 'codex',
      args: calls[0].args,
      nativeGoalCommandUsed: true,
      exitCode: 0,
    });
    expect(receipt.goalCommandTextHash).toBe(sha256Text(fixture.commandText));
  });

  it('passes the exact /goal command text as Claude initial prompt', () => {
    const fixture = createNativeGoalInvocationFixture('claude-code-cli');
    const calls: Array<{ command: string; args: string[] }> = [];
    const spawnSyncFn: NativeGoalSpawnSyncFn = (command, args) => {
      calls.push({ command, args });
      writeJson(fixture.taskReportPath, doneReport(fixture.packet.packetId));
      return { status: 0, stdout: 'claude stdout', stderr: '' };
    };

    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'claude-code-cli',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      spawnSyncFn,
    });

    expect(result.taskReport.status).toBe('done');
    expect(calls).toHaveLength(1);
    expect(calls[0].command).toBe('claude');
    expect(calls[0].args).toEqual([
      '-p',
      fixture.commandText,
      '--permission-mode',
      'auto',
      '--output-format',
      'stream-json',
      '--add-dir',
      fixture.projectRoot,
    ]);
  });

  it('returns and writes blocked TaskReport when host-native command exits non-zero', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      spawnSyncFn: () => ({ status: 2, stdout: '', stderr: 'failed' }),
    });

    expect(result.taskReport.status).toBe('blocked');
    expect(result.taskReport.driftFlags).toContain('native-goal-invocation-failed');
    expect(JSON.parse(fs.readFileSync(fixture.taskReportPath, 'utf8')).driftFlags).toContain(
      'native-goal-invocation-failed'
    );
    const receipt = JSON.parse(
      fs.readFileSync(receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId), 'utf8')
    );
    expect(receipt.exitCode).toBe(2);
  });

  it('returns blocked TaskReport when native command exits zero but TaskReport is missing', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      spawnSyncFn: () => ({ status: 0, stdout: '', stderr: '' }),
    });

    expect(result.taskReport.status).toBe('blocked');
    expect(result.taskReport.driftFlags).toContain('native-goal-task-report-missing');
  });

  it('rejects strict TaskReport when packetId does not match dispatch packet', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    const result = runNativeGoalInvocation({
      projectRoot: fixture.projectRoot,
      host: 'codex',
      packet: fixture.packet,
      compiledPromptRef: fixture.compiledPromptRef,
      taskReportPath: fixture.taskReportPath,
      recordId: fixture.recordId,
      attemptId: fixture.attemptId,
      spawnSyncFn: () => {
        writeJson(fixture.taskReportPath, doneReport('different-packet'));
        return { status: 0, stdout: '', stderr: '' };
      },
    });

    expect(result.taskReport.status).toBe('blocked');
    expect(result.taskReport.driftFlags).toContain('native-goal-task-report-packet-mismatch');
  });
});
