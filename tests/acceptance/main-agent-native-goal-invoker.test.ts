import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runNativeGoalInvocation } from '../../packages/bmad-speckit/src/main-agent/actions/native-goal-invoker';
import type {
  CompiledPromptRef,
  ExecutionPacket,
} from '../../packages/bmad-speckit/src/main-agent/source-authority/scripts/orchestration-dispatch-contract';

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
  it('prepares the exact /goal command for Codex main-session execution without spawning a CLI', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    const spawnSyncFn: NativeGoalSpawnSyncFn = () => {
      throw new Error('native goal invoker must not spawn host CLI subprocesses');
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

    expect(result.exitCode).toBe(1);
    expect(result.command).toBe('main-session-native-goal');
    expect(result.args).toEqual([fixture.commandText]);
    expect(result.taskReport.status).toBe('blocked');
    expect(result.taskReport.validationsRun).toContain('main-session-native-goal-preparation');
    expect(result.taskReport.driftFlags).toContain('main-session-native-goal-required');
    expect(fs.readFileSync(fixture.taskReportPath, 'utf8')).toContain(
      'main-session-native-goal-required'
    );
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

  it('ignores Codex binary override because native /goal execution must stay in the main session', () => {
    const fixture = createNativeGoalInvocationFixture('codex');
    const previousOverride = process.env.CODEX_WORKER_ADAPTER_BIN;
    const previousAllow = process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
    const fakeCodexPath = path.join(fixture.projectRoot, 'fake-codex');
    process.env.CODEX_WORKER_ADAPTER_BIN = fakeCodexPath;
    process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = 'true';
    const spawnSyncFn: NativeGoalSpawnSyncFn = () => {
      throw new Error('Codex binary override must not be used for native /goal');
    };

    try {
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

      expect(result.taskReport.status).toBe('blocked');
      expect(result.command).toBe('main-session-native-goal');
      expect(result.args).toEqual([fixture.commandText]);
      const receipt = JSON.parse(
        fs.readFileSync(
          receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId),
          'utf8'
        )
      );
      expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
      expect(receipt.command).not.toBe(fakeCodexPath);
      expect(receipt.nativeGoalCommandUsed).toBe(false);
    } finally {
      if (previousOverride === undefined) delete process.env.CODEX_WORKER_ADAPTER_BIN;
      else process.env.CODEX_WORKER_ADAPTER_BIN = previousOverride;
      if (previousAllow === undefined) delete process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE;
      else process.env.MAIN_AGENT_ALLOW_CODEX_BIN_OVERRIDE = previousAllow;
    }
  });

  it('prepares the exact /goal command for Claude main-session execution without spawning a CLI', () => {
    const fixture = createNativeGoalInvocationFixture('claude-code-cli');
    const spawnSyncFn: NativeGoalSpawnSyncFn = () => {
      throw new Error('native goal invoker must not spawn Claude CLI subprocesses');
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

    expect(result.taskReport.status).toBe('blocked');
    expect(result.command).toBe('main-session-native-goal');
    expect(result.args).toEqual([fixture.commandText]);
    const receipt = JSON.parse(
      fs.readFileSync(receiptPath(fixture.projectRoot, fixture.recordId, fixture.attemptId), 'utf8')
    );
    expect(receipt.host).toBe('claude-code-cli');
    expect(receipt.invokedCommandKind).toBe('main_session_native_goal_required');
    expect(receipt.nativeGoalCommandPrepared).toBe(true);
    expect(receipt.nativeGoalCommandUsed).toBe(false);
  });

  it('returns blocked TaskReport when the native goal command cannot be resolved', () => {
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
      spawnSyncFn: () => {
        throw new Error('spawn must not be called when command resolution fails');
      },
    });

    expect(result.taskReport.status).toBe('blocked');
    expect(result.taskReport.driftFlags).toContain('native-goal-document-missing');
    expect(JSON.parse(fs.readFileSync(fixture.taskReportPath, 'utf8')).driftFlags).toContain(
      'native-goal-document-missing'
    );
    expect(result.receiptPath).toBeNull();
  });
});
